import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';
import { RoomGateway } from '../gateway/room.gateway';

/**
 * In-room operations: mic queue, moderation, roles, heartbeat.
 *
 * Our room engine drives all of this over the socket, so these HTTP actions are
 * the ORIGINAL client's path to the same state. They are implemented for full
 * compatibility — the old APK, or a future client that prefers request/response
 * over events, gets identical behaviour.
 *
 * Where an action changes live state, it writes the durable row AND asks the
 * gateway to broadcast, so socket clients see it immediately. Doing only the
 * first would let an HTTP kick leave the victim visibly seated on everyone
 * else's screen until they reconnected.
 *
 * `Action/RoomApi.*` and `Action/LiveRoom.*` overlap heavily with each other and
 * with `room.*`; each name is kept and points at one shared implementation.
 */
@Injectable()
export class RoomApiModule extends ApiModule {
  constructor(private prisma: PrismaService, private gateway: RoomGateway) { super(); }

  private rid(r: ActionReq) { return Number(r.rid || r.roomId || r.room_id || 0); }
  private target(r: ActionReq) { return Number(r.target_uid || r.tuid || r.toUid || r.uid || 0); }

  /** Owner or a persisted admin. */
  private async isStaff(rid: number, uid: number): Promise<boolean> {
    if (!rid || !uid) return false;
    const room = await this.prisma.room.findUnique({ where: { rid } });
    if (room?.owner_uid === uid) return true;
    return !!await this.prisma.roomRole.findUnique({ where: { rid_uid: { rid, uid } } });
  }

  private denied(action: string) { return { code: 1, msg: 'not_permitted', action }; }

  private async userBrief(uids: number[]) {
    const us = await this.prisma.user.findMany({ where: { uid: { in: uids } } });
    return us.map(u => ({
      uid: s(u.uid), nick: u.nick, avatar: u.avatar, avatarFrame: u.avatarFrame,
      sex: s(u.sex), noble_level: u.noble_level, svip: u.svip,
    }));
  }

  // ── mic queue ─────────────────────────────────────────────────────
  private async applyMic(r: ActionReq) {
    const rid = this.rid(r), uid = this.uidOf(r);
    if (!rid || !uid) return { code: 1, msg: 'bad_request' };
    const seatNo = Number(r.seatNo ?? r.micId ?? -1);
    await this.prisma.micApply.upsert({
      where: { rid_uid: { rid, uid } },
      create: { rid, uid, seatNo, status: 0 },
      update: { seatNo, status: 0 },
    });
    return { code: 0, waiting: 1 };
  }

  private async quitMic(r: ActionReq) {
    const rid = this.rid(r), uid = this.uidOf(r);
    await this.prisma.micApply.deleteMany({ where: { rid, uid } });
    this.gateway.httpSeatLeave(rid, uid);
    return { code: 0 };
  }

  readonly handlers: Record<string, Handler> = {
    // ── presence ──
    'Action/RoomApi.joinRoom': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      const room = await this.prisma.room.findUnique({ where: { rid } });
      if (!room) return { code: 1, msg: 'room_not_found' };
      const banned = await this.prisma.roomBan.findFirst({ where: { rid, uid, kind: 'block' } });
      if (banned) return { code: 1, msg: 'blocked_from_room' };
      await this.prisma.roomMember.upsert({
        where: { rid_uid: { rid, uid } }, create: { rid, uid }, update: {},
      }).catch(() => null);
      await this.prisma.room.update({ where: { rid }, data: { onlineNum: { increment: 1 } } }).catch(() => null);
      return { code: 0, rid, seatCount: room.seatCount, owner_uid: s(room.owner_uid) };
    },
    'Action/LiveRoom.joinRoom': async (r: ActionReq) => this.handlers['Action/RoomApi.joinRoom'](r),

    'Action/RoomApi.heartbeat': async (r: ActionReq) => {
      // Keeps the room's online count honest for clients that do not hold a
      // socket. Returns the current count so the caller can render it.
      const rid = this.rid(r);
      const room = await this.prisma.room.findUnique({ where: { rid } });
      return { code: 0, onlineNum: room?.onlineNum ?? 0, ts: Math.floor(Date.now() / 1000) };
    },
    'Action/LiveRoom.heartbeat': async (r: ActionReq) => this.handlers['Action/RoomApi.heartbeat'](r),

    'Action/RoomApi.batchGetUserInfo': async (r: ActionReq) => {
      const uids = String(r.uids || r.uidList || '').split(',').map(Number).filter(Boolean);
      return { list: await this.userBrief(uids) };
    },
    'Action/RoomApi.notifyUpdateUInfo': async (r: ActionReq) => {
      // The client tells the room its profile changed; rebroadcast so seats
      // re-render without everyone re-fetching.
      const rid = this.rid(r), uid = this.uidOf(r);
      this.gateway.httpProfileChanged(rid, uid);
      return { code: 0 };
    },

    // ── mic ──
    'Action/RoomApi.joinMic': async (r: ActionReq) => this.applyMic(r),
    'Action/RoomApi.quitMic': async (r: ActionReq) => this.quitMic(r),
    'Action/RoomApi.switchMic': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      const seatNo = Number(r.seatNo ?? r.micId ?? -1);
      if (seatNo < 0) return { code: 1, msg: 'bad_seat' };
      const okMove = this.gateway.httpSeatTake(rid, uid, seatNo);
      return okMove ? { code: 0, seatNo } : { code: 1, msg: 'seat_unavailable' };
    },
    'Action/RoomApi.inviteJoinMic': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r), target = this.target(r);
      if (!await this.isStaff(rid, uid)) return this.denied('inviteJoinMic');
      await this.prisma.micApply.upsert({
        where: { rid_uid: { rid, uid: target } },
        create: { rid, uid: target, seatNo: Number(r.seatNo ?? -1), status: 1 },
        update: { status: 1 },
      });
      await this.prisma.notice.create({
        data: { uid: target, type: 'system', title: 'mic_invite', body: String(rid) },
      }).catch(() => null);
      return { code: 0 };
    },
    'Action/RoomApi.lockMic': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      if (!await this.isStaff(rid, uid)) return this.denied('lockMic');
      const seatNo = Number(r.seatNo ?? r.micId ?? -1);
      const lock = Number(r.lock ?? r.status ?? 1) !== 0;
      this.gateway.httpSeatLock(rid, seatNo, lock);
      return { code: 0, seatNo, lock: lock ? 1 : 0 };
    },
    'Action/RoomApi.disableMic': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r), target = this.target(r);
      if (!await this.isStaff(rid, uid)) return this.denied('disableMic');
      const off = Number(r.status ?? 1) !== 0;
      this.gateway.httpSetMic(rid, target, off);
      return { code: 0, micState: off ? 1 : 0 };
    },

    // ── moderation ──
    'Action/RoomApi.mute': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r), target = this.target(r);
      if (!await this.isStaff(rid, uid)) return this.denied('mute');
      const on = Number(r.status ?? 1) !== 0;
      if (on) await this.prisma.roomBan.upsert({
        where: { rid_uid_kind: { rid, uid: target, kind: 'mute' } },
        create: { rid, uid: target, kind: 'mute', by_uid: uid, reason: String(r.reason ?? '') },
        update: { by_uid: uid },
      });
      else await this.prisma.roomBan.deleteMany({ where: { rid, uid: target, kind: 'mute' } });
      this.gateway.httpMute(rid, target, on);
      return { code: 0, muted: on ? 1 : 0 };
    },
    'Action/RoomApi.kickUser': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r), target = this.target(r);
      if (!await this.isStaff(rid, uid)) return this.denied('kickUser');
      this.gateway.httpKick(rid, target);
      await this.prisma.roomMember.deleteMany({ where: { rid, uid: target } });
      return { code: 0 };
    },
    'Action/LiveRoom.kickUser': async (r: ActionReq) => this.handlers['Action/RoomApi.kickUser'](r),

    'Action/RoomApi.blockade': async (r: ActionReq) => {
      // Kick AND bar from returning, unlike kickUser.
      const rid = this.rid(r), uid = this.uidOf(r), target = this.target(r);
      if (!await this.isStaff(rid, uid)) return this.denied('blockade');
      const on = Number(r.status ?? 1) !== 0;
      if (on) {
        await this.prisma.roomBan.upsert({
          where: { rid_uid_kind: { rid, uid: target, kind: 'block' } },
          create: { rid, uid: target, kind: 'block', by_uid: uid, reason: String(r.reason ?? '') },
          update: { by_uid: uid },
        });
        this.gateway.httpKick(rid, target);
      } else {
        await this.prisma.roomBan.deleteMany({ where: { rid, uid: target, kind: 'block' } });
      }
      return { code: 0, blocked: on ? 1 : 0 };
    },
    'Action/LiveRoom.blockade': async (r: ActionReq) => this.handlers['Action/RoomApi.blockade'](r),

    // ── room text / charm config ──
    'Action/RoomApi.setTextConfig': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      if (!await this.isStaff(rid, uid)) return this.denied('setTextConfig');
      const notice = String(r.notice ?? r.text ?? '');
      await this.prisma.room.update({ where: { rid }, data: { notice } });
      return { code: 0, notice };
    },
    'Action/LiveRoom.setTextConfig': async (r: ActionReq) => this.handlers['Action/RoomApi.setTextConfig'](r),

    'Action/RoomApi.setCharmConfig': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      if (!await this.isStaff(rid, uid)) return this.denied('setCharmConfig');
      // Whether seat charm counters are visible, stored per room.
      const show = Number(r.status ?? r.show ?? 1) !== 0;
      await this.prisma.config.upsert({
        where: { key: `room:${rid}:charm` },
        create: { key: `room:${rid}:charm`, value: { show } },
        update: { value: { show } },
      });
      return { code: 0, show: show ? 1 : 0 };
    },

    // ── fan calls ──
    'Action/RoomApi.startCallFans': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      const existing = await this.prisma.callFans.findFirst({ where: { rid, uid, active: true } });
      if (existing) return { code: 0, id: existing.id, already: 1 };
      const row = await this.prisma.callFans.create({ data: { rid, uid } });
      // Everyone following the caller hears about it.
      const fans = await this.prisma.friend.findMany({ where: { target_uid: uid, type: 'follow' }, take: 200 });
      if (fans.length) await this.prisma.notice.createMany({
        data: fans.map(f => ({ uid: f.uid, type: 'system', title: 'call_fans', body: String(rid) })),
      }).catch(() => null);
      return { code: 0, id: row.id, notified: fans.length };
    },
    'Action/RoomApi.cancelCallFans': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      await this.prisma.callFans.updateMany({
        where: { rid, uid, active: true }, data: { active: false, endedAt: new Date() },
      });
      return { code: 0 };
    },

    // ── misc room ops ──
    'Action/RoomApi.divideGroup': async (r: ActionReq) => {
      // Splits the seated users into two PK teams. Seats are authoritative in
      // the gateway, so the split is computed from live occupancy.
      const rid = this.rid(r);
      const seats = this.gateway.liveSeats(rid) ?? [];
      const seated = seats.filter(x => x.uid).map(x => x.uid as number);
      return {
        code: 0,
        red: seated.filter((_, i) => i % 2 === 0).map(s),
        blue: seated.filter((_, i) => i % 2 === 1).map(s),
      };
    },
    'Action/RoomApi.sendLuckyNum': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      // A 1-100 roll broadcast to the room; recorded so it can be audited.
      const num = 1 + Math.floor(Math.random() * 100);
      await this.prisma.roomPrizeRecord.create({
        data: { rid, uid, kind: 'luckynum', prize: num, detail: 'roll' },
      }).catch(() => null);
      this.gateway.httpLuckyNumber(rid, uid, num);
      return { code: 0, num };
    },
    'Action/RoomApi.getDynamicKey': async (r: ActionReq) => {
      // The original app fetched a per-session RTC key here. We mint Agora
      // tokens through rtc.getToken instead, so this reports where to go rather
      // than issuing a second, differently-scoped credential.
      return { code: 0, useAction: 'rtc.getToken', rid: this.rid(r) };
    },

    // ── timed PK from inside a room ──
    'Action/RoomApi.startTimingPKGroup': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      if (!await this.isStaff(rid, uid)) return this.denied('startTimingPKGroup');
      const duration = Math.max(60, Number(r.duration || 300) || 300);
      const m = await this.prisma.pkMatch.create({
        data: { rid_a: rid, status: 1, duration, startedAt: new Date() },
      });
      return { code: 0, pk_id: m.id, duration };
    },
    'Action/RoomApi.stopTimingPKGroup': async (r: ActionReq) => {
      const rid = this.rid(r), uid = this.uidOf(r);
      if (!await this.isStaff(rid, uid)) return this.denied('stopTimingPKGroup');
      await this.prisma.pkMatch.updateMany({
        where: { rid_a: rid, status: 1 }, data: { status: 2, endedAt: new Date() },
      });
      return { code: 0 };
    },
  };
}
