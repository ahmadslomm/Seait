import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';
import { RoomGateway } from '../gateway/room.gateway';

/**
 * Room discovery and metadata.
 *
 * `Action/LiveRoom.recommend` is the most-called action in the whole capture
 * (9,407 calls in one session) — it backs the Live tab, which polls it. The
 * room list shape is shared by half a dozen actions (recommend, discoverRoom,
 * getCountryRoomList*, getRecommendRoomV*), so they all render through one
 * `roomView`; only the selection differs.
 *
 * Live seat occupancy is not in the DB — it lives in the room gateway's memory
 * (see the seat/token bug) — so counts here come from the Room row, which the
 * gateway keeps updated. Anything needing true live seats must ask the gateway.
 */
@Injectable()
export class RoomModule extends ApiModule {
  constructor(private prisma: PrismaService, private gateway: RoomGateway) { super(); }

  private roomView(r: any, owner?: any) {
    return {
      rid: r.rid, roomId: s(r.rid),
      roomName: r.name, name: r.name,
      roomType: r.roomType, cover: r.cover, roomImg: r.cover,
      notice: r.notice, tag: r.tag, lock: r.lock,
      seatCount: r.seatCount, onlineNum: r.onlineNum, userNum: s(r.onlineNum),
      owner_uid: s(r.owner_uid), roomLevel: r.roomLevel, status: r.status,
      country: r.country ?? '',
      ...(owner ? { owner_nick: owner.nick, owner_avatar: owner.avatar } : {}),
    };
  }

  private async withOwners(rooms: any[]) {
    const owners = await this.prisma.user.findMany({
      where: { uid: { in: [...new Set(rooms.map(r => r.owner_uid))] } },
    });
    const by = new Map(owners.map(o => [o.uid, o]));
    return rooms.map(r => this.roomView(r, by.get(r.owner_uid)));
  }

  private async list(r: ActionReq, where: any = {}) {
    const { skip, take, page } = this.page(r, 20);
    const rooms = await this.prisma.room.findMany({
      where: { status: 1, ...where },
      orderBy: [{ onlineNum: 'desc' }, { roomLevel: 'desc' }], skip, take,
    });
    const list = await this.withOwners(rooms);
    const total = await this.prisma.room.count({ where: { status: 1, ...where } });
    // Clients differ on where they read the array from, so provide both.
    return { list, rooms: list, page, total, hasMore: skip + rooms.length < total ? 1 : 0 };
  }

  readonly handlers: Record<string, Handler> = {
    // ── discovery ──
    'Action/LiveRoom.recommend': async (r: ActionReq) => this.list(r),
    'room.getRecommendRoomV3': async (r: ActionReq) => this.list(r),
    'room.getRecommendRoomV': async (r: ActionReq) => this.list(r),
    'room.discoverRoom': async (r: ActionReq) => this.list(r),
    'room.userLoginRecommendRoom': async (r: ActionReq) => this.list(r),
    'Action/LiveSearch.recommend': async (r: ActionReq) => this.list(r),

    'room.getCountryRoomListV2': async (r: ActionReq) =>
      this.list(r, r.country ? { country: String(r.country) } : {}),
    'room.getCountryRoomListV': async (r: ActionReq) => this.handlers['room.getCountryRoomListV2'](r),

    'room.getCountryListV2': async () => {
      // Countries that actually have rooms, with a live count each.
      const rows = await this.prisma.room.groupBy({
        by: ['country'], where: { status: 1 }, _count: { _all: true },
      }).catch(() => [] as any[]);
      return {
        list: (rows as any[])
          .filter(x => x.country)
          .map(x => ({ country: x.country, num: x._count._all }))
          .sort((a, b) => b.num - a.num),
      };
    },
    'room.getCountryListV': async (r: ActionReq) => this.handlers['room.getCountryListV2'](r),

    // ── a single room ──
    'room.getRoomInfo': async (r: ActionReq) => {
      const rid = Number(r.rid || r.roomId || 0);
      const room = await this.prisma.room.findUnique({ where: { rid } });
      if (!room) return {};
      const owner = await this.prisma.user.findUnique({ where: { uid: room.owner_uid } });
      // Live seats come from the gateway; prisma.seat is only the fallback for
      // a room nobody has opened yet, because sit/stand never writes to it.
      const live = this.gateway.liveSeats(rid);
      const seats = live ?? (await this.prisma.seat.findMany({ where: { rid }, orderBy: { seatNo: 'asc' } }))
        .map(x => ({ seatNo: x.seatNo, uid: x.uid, micState: x.micState, lock: x.lock }));
      return {
        ...this.roomView(room, owner),
        seats: seats.map(x => ({
          seatNo: x.seatNo, uid: x.uid ? s(x.uid) : '',
          micState: x.micState, lock: x.lock,
        })),
      };
    },
    'Action/LiveRoom.getRoomInfo': async (r: ActionReq) => this.handlers['room.getRoomInfo'](r),
    'Action/LiveRoom.getLiveInfo': async (r: ActionReq) => this.handlers['room.getRoomInfo'](r),

    'room.getMyRoom': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const room = await this.prisma.room.findFirst({ where: { owner_uid: uid } });
      return room ? this.roomView(room) : {};
    },
    'room.getMyRoomList': async (r: ActionReq) => ({
      list: await this.withOwners(await this.prisma.room.findMany({ where: { owner_uid: this.uidOf(r) } })),
    }),

    // ── collections ──
    'room.collectRoom': async (r: ActionReq) => {
      const uid = this.uidOf(r), rid = Number(r.rid || 0);
      if (!uid || !rid) return { code: 1, msg: 'bad_request' };
      const on = Number(r.status ?? r.type ?? 1) !== 0;
      if (on) await this.prisma.roomCollect.upsert({
        where: { uid_rid: { uid, rid } }, create: { uid, rid }, update: {},
      });
      else await this.prisma.roomCollect.deleteMany({ where: { uid, rid } });
      return { code: 0, collected: on ? 1 : 0 };
    },
    'Action/LiveRoom.collectRoom': async (r: ActionReq) => this.handlers['room.collectRoom'](r),

    'room.getMyCollectRoomList': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const ids = (await this.prisma.roomCollect.findMany({ where: { uid } })).map(c => c.rid);
      const rooms = await this.prisma.room.findMany({ where: { rid: { in: ids } } });
      return { list: await this.withOwners(rooms) };
    },
    'Action/LiveRoom.getMyCollectRoomList': async (r: ActionReq) => this.handlers['room.getMyCollectRoomList'](r),

    // ── editing ──
    'room.updateRoomInfo': async (r: ActionReq) => {
      const uid = this.uidOf(r), rid = Number(r.rid || 0);
      const room = await this.prisma.room.findUnique({ where: { rid } });
      if (!room) return { code: 1, msg: 'room_not_found' };
      if (room.owner_uid !== uid) return { code: 1, msg: 'not_permitted' };
      const data: any = {};
      if (r.roomName ?? r.name) data.name = String(r.roomName ?? r.name);
      if (r.notice !== undefined) data.notice = String(r.notice);
      if (r.tag !== undefined) data.tag = String(r.tag);
      if (r.cover ?? r.roomImg) data.cover = String(r.cover ?? r.roomImg);
      if (r.lock !== undefined) data.lock = Number(r.lock) || 0;
      await this.prisma.room.update({ where: { rid }, data });
      return { code: 0, ...this.roomView(await this.prisma.room.findUnique({ where: { rid } })) };
    },
    'room.updateRoomImg': async (r: ActionReq) => this.handlers['room.updateRoomInfo'](r),
    'Action/LiveRoom.updateRoom': async (r: ActionReq) => this.handlers['room.updateRoomInfo'](r),
    'Action/LiveRoom.updateRoomImg': async (r: ActionReq) => this.handlers['room.updateRoomInfo'](r),

    // ── ranks inside a room ──
    'room.getRoomCharmRank': async (r: ActionReq) => this.charm(r),
    'room.getUserCharmRankV2': async (r: ActionReq) => this.charm(r),
    'room.getUserCharmRankV': async (r: ActionReq) => this.charm(r),

    'room.getUserContributeRank': async (r: ActionReq) => this.contribute(r),
    'Action/LiveRoom.getUserContributeRank': async (r: ActionReq) => this.contribute(r),
    'room.getSendGiftRankV2': async (r: ActionReq) => this.contribute(r),
    'room.getSendGiftRankV': async (r: ActionReq) => this.contribute(r),
  };

  /** Charm = what a seated user RECEIVED in this room. */
  private async charm(r: ActionReq) {
    const rid = Number(r.rid || 0);
    const rows = await this.prisma.giftRecord.groupBy({
      by: ['to_uid'], where: { rid }, _sum: { coin_total: true },
    }).catch(() => [] as any[]);
    return { list: await this.rankList(rows as any[], 'to_uid') };
  }

  /** Contribution = what a user SPENT in this room. */
  private async contribute(r: ActionReq) {
    const rid = Number(r.rid || 0);
    const rows = await this.prisma.giftRecord.groupBy({
      by: ['from_uid'], where: { rid }, _sum: { coin_total: true },
    }).catch(() => [] as any[]);
    return { list: await this.rankList(rows as any[], 'from_uid') };
  }

  private async rankList(rows: any[], key: string) {
    const sorted = rows
      .map(x => ({ uid: x[key], score: Number(x._sum.coin_total ?? 0) }))
      .sort((a, b) => b.score - a.score).slice(0, 50);
    const users = await this.prisma.user.findMany({ where: { uid: { in: sorted.map(x => x.uid) } } });
    const by = new Map(users.map(u => [u.uid, u]));
    return sorted.map((x, i) => ({
      rank: i + 1, uid: s(x.uid), score: s(x.score),
      nick: by.get(x.uid)?.nick ?? '', avatar: by.get(x.uid)?.avatar ?? '',
      avatarFrame: by.get(x.uid)?.avatarFrame ?? '',
    }));
  }
}
