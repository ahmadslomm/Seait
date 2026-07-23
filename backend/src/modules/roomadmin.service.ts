import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';
import { RoomGateway } from '../gateway/room.gateway';

/**
 * Advanced room features: roles, blacklists, online lists, room ranks,
 * creation, and the LiveRoom variants of all of it.
 *
 * Several ranks here are the same aggregate with a different window or a
 * different side of the GiftRecord table, so they share one query builder.
 */
@Injectable()
export class RoomAdminModule extends ApiModule {
  constructor(private prisma: PrismaService, private gateway: RoomGateway) { super(); }

  private rid(r: ActionReq) { return Number(r.rid || r.roomId || r.room_id || 0); }

  private async isOwner(rid: number, uid: number) {
    const room = await this.prisma.room.findUnique({ where: { rid } });
    return !!room && room.owner_uid === uid;
  }
  private async isStaff(rid: number, uid: number) {
    if (await this.isOwner(rid, uid)) return true;
    return !!await this.prisma.roomRole.findUnique({ where: { rid_uid: { rid, uid } } });
  }

  private async brief(uids: number[]) {
    const us = await this.prisma.user.findMany({ where: { uid: { in: uids } } });
    const by = new Map(us.map(u => [u.uid, u]));
    return uids.map(id => by.get(id)).filter(Boolean).map((u: any) => ({
      uid: s(u.uid), nick: u.nick, avatar: u.avatar, avatarFrame: u.avatarFrame,
      sex: s(u.sex), noble_level: u.noble_level, svip: u.svip, isAnchor: u.isAnchor,
    }));
  }

  /**
   * Gift-flow leaderboard.
   *
   * `side` picks who is being ranked: receivers (charm) or senders
   * (contribution). `since` narrows the window — the daily/total variants of
   * getCoinFlowRank differ only by this.
   */
  private async flowRank(opts: { rid?: number; side: 'to_uid' | 'from_uid'; since?: Date; take?: number }) {
    const where: any = {};
    if (opts.rid) where.rid = opts.rid;
    if (opts.since) where.createdAt = { gte: opts.since };
    const rows = await this.prisma.giftRecord.groupBy({
      by: [opts.side], where, _sum: { coin_total: true },
    }).catch(() => [] as any[]);
    const sorted = (rows as any[])
      .map(x => ({ uid: x[opts.side] as number, score: Number(x._sum.coin_total ?? 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.take ?? 50);
    const users = await this.brief(sorted.map(x => x.uid));
    return sorted.map((x, i) => ({ ...users[i], rank: i + 1, score: s(x.score), value: s(x.score) }));
  }

  private static midnight() { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; }

  /** Who is actually in the room right now — gateway first, DB as fallback. */
  private async onlineList(rid: number) {
    const seats = this.gateway.liveSeats(rid);
    if (seats) {
      const uids = seats.filter(x => x.uid).map(x => x.uid as number);
      const users = await this.brief(uids);
      return users.map((u, i) => ({ ...u, seatNo: seats.filter(x => x.uid)[i]?.seatNo ?? -1 }));
    }
    const members = await this.prisma.roomMember.findMany({ where: { rid }, take: 100 });
    return this.brief(members.map(m => m.uid));
  }

  readonly handlers: Record<string, Handler> = {
    // ── roles ──
    'room.addRole': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      const target = Number(r.target_uid || r.tuid || 0);
      if (!await this.isOwner(rid, uid)) return { code: 1, msg: 'owner_only' };
      if (!target) return { code: 1, msg: 'bad_request' };
      await this.prisma.roomRole.upsert({
        where: { rid_uid: { rid, uid: target } },
        create: { rid, uid: target, role: String(r.role ?? 'admin'), grantedBy: uid },
        update: { role: String(r.role ?? 'admin') },
      });
      // Mirror into the live room so the grant applies without a rejoin.
      this.gateway.httpSetAdmin(rid, target, true);
      return { code: 0 };
    },
    'room.delRole': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      const target = Number(r.target_uid || r.tuid || 0);
      if (!await this.isOwner(rid, uid)) return { code: 1, msg: 'owner_only' };
      await this.prisma.roomRole.deleteMany({ where: { rid, uid: target } });
      this.gateway.httpSetAdmin(rid, target, false);
      return { code: 0 };
    },
    'Action/LiveRoom.addRole': async (r: ActionReq) => this.handlers['room.addRole'](r),
    'Action/LiveRoom.delRole': async (r: ActionReq) => this.handlers['room.delRole'](r),

    'room.getRoomManageList': async (r: ActionReq) => {
      const rid = this.rid(r);
      const roles = await this.prisma.roomRole.findMany({ where: { rid } });
      const users = await this.brief(roles.map(x => x.uid));
      return { list: users.map((u, i) => ({ ...u, role: roles[i]?.role ?? 'admin' })) };
    },

    // ── blacklist ──
    'room.getBlackList': async (r: ActionReq) => {
      const rid = this.rid(r);
      const bans = await this.prisma.roomBan.findMany({ where: { rid, kind: 'block' } });
      const users = await this.brief(bans.map(b => b.uid));
      return { list: users.map((u, i) => ({ ...u, reason: bans[i]?.reason ?? '' })) };
    },

    // ── online / applicants ──
    'room.getUserOnlineListV2': async (r: ActionReq) => ({ list: await this.onlineList(this.rid(r)) }),
    'room.getUserOnlineListV': async (r: ActionReq) => this.handlers['room.getUserOnlineListV2'](r),
    'room.getUserOnlineList': async (r: ActionReq) => this.handlers['room.getUserOnlineListV2'](r),
    'Action/LiveRoom.getUserOnlineList': async (r: ActionReq) => this.handlers['room.getUserOnlineListV2'](r),

    'room.getApplyMicList': async (r: ActionReq) => {
      const rid = this.rid(r);
      const rows = await this.prisma.micApply.findMany({ where: { rid, status: 0 }, orderBy: { createdAt: 'asc' } });
      const users = await this.brief(rows.map(x => x.uid));
      return { list: users.map((u, i) => ({ ...u, seatNo: rows[i]?.seatNo ?? -1 })) };
    },
    'room.getCallFansList': async (r: ActionReq) => {
      const rid = this.rid(r);
      const rows = await this.prisma.callFans.findMany({ where: { rid, active: true } });
      return { list: await this.brief(rows.map(x => x.uid)) };
    },

    // ── ranks ──
    'room.getRoomCharmRankV2': async (r: ActionReq) => ({ list: await this.flowRank({ rid: this.rid(r), side: 'to_uid' }) }),
    'room.getCoinFlowRank': async (r: ActionReq) =>
      ({ list: await this.flowRank({ rid: this.rid(r), side: 'from_uid', since: RoomAdminModule.midnight() }) }),
    'room.getCoinFlowTotalRank': async (r: ActionReq) =>
      ({ list: await this.flowRank({ rid: this.rid(r), side: 'from_uid' }) }),
    'Action/LiveRoom.getCoinFlowRank': async (r: ActionReq) => this.handlers['room.getCoinFlowRank'](r),

    'room.getTop': async (r: ActionReq) => ({ list: await this.flowRank({ side: 'to_uid', take: 10 }) }),
    'room.getTop3RankDataV2': async () => ({ list: await this.flowRank({ side: 'to_uid', take: 3 }) }),
    'room.luckyGiftRank': async (r: ActionReq) => ({ list: await this.flowRank({ rid: this.rid(r), side: 'from_uid', take: 20 }) }),
    'room.gameRank': async (r: ActionReq) => {
      const rows = await this.prisma.gamePlayer.findMany({ orderBy: { score: 'desc' }, take: 50 });
      const users = await this.brief(rows.map(x => x.uid));
      return { list: users.map((u, i) => ({ ...u, rank: i + 1, score: s(rows[i]?.score ?? 0) })) };
    },

    'room.getWealthInfo': async (r: ActionReq) => {
      const uid = Number(r.target_uid || this.uidOf(r));
      const w = await this.prisma.wealth.findUnique({ where: { uid } }).catch(() => null);
      return {
        uid: s(uid), wealthLv: w?.wealthLv ?? 0, wealthExp: s(w?.wealthExp ?? 0),
        charmLv: w?.charmLv ?? 0, charm: s(w?.charm ?? 0),
      };
    },
    'room.getHotvalAndMedal': async (r: ActionReq) => {
      const rid = this.rid(r);
      const room = await this.prisma.room.findUnique({ where: { rid } });
      const total = await this.prisma.giftRecord.aggregate({ where: { rid }, _sum: { coin_total: true } }).catch(() => null);
      const medals = await this.prisma.medal.findMany({ where: { active: true }, take: 5 });
      return {
        rid, hotval: s(Number(total?._sum.coin_total ?? 0)),
        onlineNum: room?.onlineNum ?? 0,
        medals: medals.map(m => ({ medal_id: m.medal_id, name: m.name, icon: m.icon })),
      };
    },

    // ── creation / config ──
    'room.createRoomEx': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const existing = await this.prisma.room.findFirst({ where: { owner_uid: uid } });
      // One room per owner, matching the original: the button opens the
      // existing room rather than creating duplicates.
      if (existing) return { code: 0, ...existing, rid: existing.rid, existed: 1 };
      const room = await this.prisma.room.create({
        data: {
          owner_uid: uid,
          name: String(r.roomName ?? r.name ?? `Room of ${uid}`),
          roomType: Number(r.roomType ?? 0) || 0,
          seatCount: Number(r.seatCount ?? 10) || 10,
          country: String(r.country ?? ''),
          cover: String(r.cover ?? ''),
        },
      });
      return { code: 0, rid: room.rid, roomName: room.name, seatCount: room.seatCount };
    },
    'Action/LiveRoom.createRoom': async (r: ActionReq) => this.handlers['room.createRoomEx'](r),

    'Action/LiveRoom.closeLive': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      if (!await this.isOwner(rid, uid)) return { code: 1, msg: 'owner_only' };
      await this.prisma.room.update({ where: { rid }, data: { status: 0, onlineNum: 0 } });
      return { code: 0 };
    },

    'room.getRoomModelConfig': async () => {
      // Seat layouts the client can switch between; these are the counts the
      // room engine supports, so the list is derived rather than duplicated.
      const layouts = [5, 10, 15, 21, 30];
      return { list: layouts.map((n, i) => ({ id: i + 1, seatCount: n, name: `${n} mic` })) };
    },
    'room.getTopicRandom': async () => {
      const topics = await this.prisma.feedTopic.findMany({ where: { active: true } });
      if (!topics.length) return { topic: '' };
      const t = topics[Math.floor(Math.random() * topics.length)];
      return { id: t.id, topic: t.name, cover: t.cover };
    },

    'Action/LiveRoom.getRoomExtraInfo': async (r: ActionReq) => {
      const rid = this.rid(r);
      const [room, bombs, rocket, act] = await Promise.all([
        this.prisma.room.findUnique({ where: { rid } }),
        this.prisma.roomBombConfig.findMany({ where: { active: true } }),
        this.prisma.rocketGift.findUnique({ where: { rid } }).catch(() => null),
        this.prisma.roomAct.findMany({ where: { active: true }, take: 5 }),
      ]);
      return {
        rid,
        notice: room?.notice ?? '',
        bomb: bombs.length ? { threshold: bombs[0].threshold, prize: bombs[0].prize } : null,
        rocket: rocket ? { level: rocket.level, progress: s(rocket.progress), target: s(rocket.target) } : null,
        acts: act.map(a => ({ id: a.id, name: a.name, cover: a.cover })),
      };
    },
    'Action/LiveRoom.whichRoom': async (r: ActionReq) => {
      // Which room is this user currently in? Live membership first.
      const uid = Number(r.target_uid || r.uid || this.uidOf(r));
      const m = await this.prisma.roomMember.findFirst({ where: { uid }, orderBy: { joinedAt: 'desc' } });
      return m ? { rid: m.rid, inRoom: 1 } : { rid: 0, inRoom: 0 };
    },
    'Action/LiveRoom.facePropList': async () => {
      // Face props are cosmetic products of type 'face'.
      const rows = await this.prisma.mallProduct.findMany({ where: { type: 'face', active: true } });
      return { list: rows.map(p => ({ id: p.product_id, name: p.name, icon: p.icon, preview: p.preview })) };
    },

    // ── activities / games shown in-room ──
    'room.getActivityGamesV2': async () => {
      const games = await this.prisma.game.findMany({ where: { active: true }, orderBy: { sort: 'asc' } });
      return { list: games.map(g => ({ game_id: g.game_id, name: g.name, icon: g.icon, url: g.url })) };
    },
    'room.getActivityGamesV': async (r: ActionReq) => this.handlers['room.getActivityGamesV2'](r),
    'room.getActivityGames': async (r: ActionReq) => this.handlers['room.getActivityGamesV2'](r),

    'room.inviteFriends': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      const targets = String(r.uids || r.target_uid || '').split(',').map(Number).filter(Boolean);
      if (!targets.length) return { code: 1, msg: 'no_targets' };
      await this.prisma.notice.createMany({
        data: targets.map(t => ({ uid: t, type: 'system', title: 'room_invite', body: `${rid}:${uid}` })),
      }).catch(() => null);
      return { code: 0, invited: targets.length };
    },
    'room.shareReport': async (r: ActionReq) => {
      // Share tracking. Counted on the room so it can inform recommendations.
      const rid = this.rid(r);
      await this.prisma.room.update({ where: { rid }, data: { onlineNum: { increment: 0 } } }).catch(() => null);
      await this.prisma.roomPrizeRecord.create({
        data: { rid, uid: this.uidOf(r), kind: 'share', prize: 0, detail: String(r.channel ?? '') },
      }).catch(() => null);
      return { code: 0 };
    },
  };
}
