import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';
import { EconomyService } from './economy.service';

/**
 * In-room events: bombs, lucky bags, rocket gifts, room levels, activities.
 *
 * The original app ships each of these twice under a `Live*` and a plain name
 * (`Action/RoomBomb.*` and `Action/LiveRoomBomb.*`, `RocketGift`/`LiveRocketGift`,
 * `luckyBags`/`LiveLuckyBags`, `RoomLevel`/`LiveRoomLevel`) — the same feature
 * as seen from a voice room and from a live-stream room. Both names are kept
 * and both resolve to one implementation.
 */
@Injectable()
export class RoomEventsModule extends ApiModule {
  constructor(private prisma: PrismaService, private economy: EconomyService) { super(); }

  private rid(r: ActionReq) { return Number(r.rid || r.roomId || 0); }

  private async bombConfig() {
    const rows = await this.prisma.roomBombConfig.findMany({ where: { active: true }, orderBy: { threshold: 'asc' } });
    return { list: rows.map(b => ({ id: b.id, name: b.name, icon: b.icon, threshold: s(b.threshold), prize: s(b.prize) })) };
  }

  private async prizeRecords(rid: number, kind: string) {
    const rows = await this.prisma.roomPrizeRecord.findMany({
      where: { rid, kind }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    const users = await this.prisma.user.findMany({ where: { uid: { in: rows.map(x => x.uid) } } });
    const by = new Map(users.map(u => [u.uid, u]));
    return {
      list: rows.map(x => ({
        id: x.id, uid: s(x.uid), nick: by.get(x.uid)?.nick ?? '', avatar: by.get(x.uid)?.avatar ?? '',
        prize: s(x.prize), detail: x.detail, time: Math.floor(x.createdAt.getTime() / 1000),
      })),
    };
  }

  /** Rocket progress for a room, created on first read so it is never null. */
  private async rocket(rid: number) {
    const row = await this.prisma.rocketGift.upsert({
      where: { rid }, create: { rid }, update: {},
    }).catch(() => null);
    return row
      ? { rid, level: row.level, progress: s(row.progress), target: s(row.target),
          percent: Number(row.target) ? Math.min(100, Math.floor(Number(row.progress) * 100 / Number(row.target))) : 0 }
      : { rid, level: 0, progress: '0', target: '0', percent: 0 };
  }

  private async levelState(rid: number) {
    const [state, configs] = await Promise.all([
      this.prisma.roomLevelState.upsert({ where: { rid }, create: { rid }, update: {} }).catch(() => null),
      this.prisma.roomLevelConfig.findMany({ orderBy: { level: 'asc' } }),
    ]);
    const level = state?.level ?? 1;
    const next = configs.find(c => c.level === level + 1);
    return {
      rid, level, exp: s(state?.exp ?? 0),
      nextLevel: next?.level ?? level,
      needExp: s(next?.needExp ?? 0),
      list: configs.map(c => ({ level: c.level, needExp: s(c.needExp), prize: s(c.prize), icon: c.icon })),
    };
  }

  readonly handlers: Record<string, Handler> = {
    // ── bombs ──
    'Action/RoomBomb.getBombConfig': async () => this.bombConfig(),
    'Action/LiveRoomBomb.getBombConfig': async () => this.bombConfig(),
    'Action/RoomBomb.getRoomPrizeRecord': async (r: ActionReq) => this.prizeRecords(this.rid(r), 'bomb'),
    'Action/LiveRoomBomb.getRoomPrizeRecord': async (r: ActionReq) => this.prizeRecords(this.rid(r), 'bomb'),

    // ── lucky bags ──
    'Action/luckyBags.fetchBagInfos': async (r: ActionReq) => {
      const rid = this.rid(r);
      const now = new Date();
      const bags = await this.prisma.luckyBag.findMany({
        where: { rid, OR: [{ expireAt: null }, { expireAt: { gte: now } }] },
        orderBy: { createdAt: 'desc' }, take: 20,
      });
      return {
        list: bags.map(b => ({
          id: b.id, from_uid: s(b.from_uid), coins: s(b.coins),
          count: b.count, taken: b.taken, remain: Math.max(0, b.count - b.taken),
          time: Math.floor(b.createdAt.getTime() / 1000),
        })),
      };
    },
    'Action/LiveLuckyBags.fetchBagInfos': async (r: ActionReq) => this.handlers['Action/luckyBags.fetchBagInfos'](r),

    'Action/luckyBags.getBag': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const bagId = Number(r.bag_id || r.id || 0);
      const bag = await this.prisma.luckyBag.findUnique({ where: { id: bagId } });
      if (!bag) return { code: 1, msg: 'bag_not_found' };
      if (bag.expireAt && bag.expireAt < new Date()) return { code: 1, msg: 'bag_expired' };
      if (bag.taken >= bag.count) return { code: 1, msg: 'bag_empty' };

      // One claim per user; the unique key is what actually enforces it, so a
      // double-tap cannot claim twice even if both requests pass the check.
      const share = Math.max(1, Math.floor(bag.coins / Math.max(1, bag.count)));
      try {
        await this.prisma.luckyBagClaim.create({ data: { bag_id: bagId, uid, coins: share } });
      } catch {
        return { code: 1, msg: 'already_claimed' };
      }
      await this.prisma.luckyBag.update({ where: { id: bagId }, data: { taken: { increment: 1 } } });
      await this.economy.credit(uid, 'coins', share, 'luckybag', String(bagId));
      await this.prisma.roomPrizeRecord.create({
        data: { rid: bag.rid, uid, kind: 'luckybag', prize: share, detail: String(bagId) },
      }).catch(() => null);
      return { code: 0, coins: s(share) };
    },
    'Action/LiveLuckyBags.getBag': async (r: ActionReq) => this.handlers['Action/luckyBags.getBag'](r),

    // ── rockets ──
    'Action/RocketGift.gifts': async () => ({
      // Which gifts feed the rocket: the fullscreen ones, since that is what
      // the original reserved for it.
      list: (await this.prisma.gift.findMany({ where: { active: true, fullscreen: true } }))
        .map(g => ({ gift_id: g.gift_id, name: g.name, icon: g.icon, price: s(g.price) })),
    }),
    'Action/LiveRocketGift.gifts': async (r: ActionReq) => this.handlers['Action/RocketGift.gifts'](r),
    'Action/RocketGift.roomGifts': async (r: ActionReq) => this.rocket(this.rid(r)),
    'Action/LiveRocketGift.roomGifts': async (r: ActionReq) => this.rocket(this.rid(r)),

    // ── room levels ──
    'Action/RoomLevel.getRoomLevelInfo': async (r: ActionReq) => this.levelState(this.rid(r)),
    'Action/LiveRoomLevel.getRoomLevelInfo': async (r: ActionReq) => this.levelState(this.rid(r)),
    'Action/RoomLevel.getRoomLevelPrize': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      const level = Number(r.level || 0);
      const state = await this.prisma.roomLevelState.findUnique({ where: { rid } });
      if (!state || state.level < level) return { code: 1, msg: 'level_not_reached' };
      const claimed = new Set(((state.claimed as number[]) ?? []));
      if (claimed.has(level)) return { code: 1, msg: 'already_claimed' };
      const cfg = await this.prisma.roomLevelConfig.findUnique({ where: { level } });
      if (cfg?.prize) await this.economy.credit(uid, 'coins', cfg.prize, 'room_level', String(level));
      claimed.add(level);
      await this.prisma.roomLevelState.update({ where: { rid }, data: { claimed: [...claimed] } });
      return { code: 0, prize: s(cfg?.prize ?? 0) };
    },
    'Action/LiveRoomLevel.getRoomLevelPrize': async (r: ActionReq) => this.handlers['Action/RoomLevel.getRoomLevelPrize'](r),
    'Action/RoomLevel.getTaskList': async (r: ActionReq) => {
      const st = await this.levelState(this.rid(r));
      return {
        list: st.list.map((c: any) => ({
          level: c.level, needExp: c.needExp, prize: c.prize, icon: c.icon,
          done: Number(st.exp) >= Number(c.needExp) ? 1 : 0,
        })),
      };
    },
    'Action/LiveRoomLevel.getTaskList': async (r: ActionReq) => this.handlers['Action/RoomLevel.getTaskList'](r),

    // ── room activities ──
    'Action/RoomAct.getActInfoById': async (r: ActionReq) => {
      const id = Number(r.act_id || r.id || 0);
      const a = await this.prisma.roomAct.findUnique({ where: { id } });
      if (!a) return {};
      const joined = await this.prisma.roomActJoin.count({ where: { act_id: id } });
      return {
        id: a.id, name: a.name, cover: a.cover, desc: a.desc, joined: s(joined),
        startAt: a.startAt ? Math.floor(a.startAt.getTime() / 1000) : 0,
        endAt: a.endAt ? Math.floor(a.endAt.getTime() / 1000) : 0,
      };
    },
    'Action/RoomAct.joinAct': async (r: ActionReq) => {
      const id = Number(r.act_id || r.id || 0);
      const uid = this.uidOf(r), rid = this.rid(r);
      if (!id || !uid) return { code: 1, msg: 'bad_request' };
      try {
        await this.prisma.roomActJoin.create({ data: { act_id: id, rid, uid } });
      } catch { return { code: 0, already: 1 }; }
      return { code: 0 };
    },
    'activity.createRoomEvents': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const room = await this.prisma.room.findFirst({ where: { owner_uid: uid } });
      if (!room) return { code: 1, msg: 'no_room' };
      const a = await this.prisma.roomAct.create({
        data: {
          name: String(r.name ?? r.title ?? 'Room event'),
          desc: String(r.desc ?? ''), cover: String(r.cover ?? ''),
          startAt: r.startAt ? new Date(Number(r.startAt) * 1000) : null,
          endAt: r.endAt ? new Date(Number(r.endAt) * 1000) : null,
        },
      });
      return { code: 0, id: a.id };
    },

    // ── lucky number config ──
    'Action/LuckyNumber.getConfig': async (r: ActionReq) => {
      const rid = this.rid(r);
      const row = await this.prisma.config.findUnique({ where: { key: `room:${rid}:luckynum` } }).catch(() => null);
      return (row?.value as object) ?? { enabled: 0, min: 1, max: 100 };
    },
    'Action/LuckyNumber.setConfig': async (r: ActionReq) => {
      const rid = this.rid(r);
      const value = {
        enabled: Number(r.enabled ?? 1) !== 0 ? 1 : 0,
        min: Number(r.min ?? 1) || 1,
        max: Number(r.max ?? 100) || 100,
      };
      await this.prisma.config.upsert({
        where: { key: `room:${rid}:luckynum` },
        create: { key: `room:${rid}:luckynum`, value }, update: { value },
      });
      return { code: 0, ...value };
    },

    // ── charge gift bag ──
    'Action/ChargeGiftBag.getGiftBagStatus': async (r: ActionReq) => {
      // Whether the first-purchase bundle is still available to this user.
      const uid = this.uidOf(r);
      const spent = await this.prisma.walletTransaction.count({ where: { uid, reason: 'recharge' } });
      return { available: spent === 0 ? 1 : 0, claimed: spent > 0 ? 1 : 0 };
    },
  };
}
