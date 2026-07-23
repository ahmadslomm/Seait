import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';
import { EconomyService } from './economy.service';

/** Wallet balances. One action in the original app, and it is read everywhere. */
@Injectable()
export class WalletModule extends ApiModule {
  constructor(private economy: EconomyService, private prisma: PrismaService) { super(); }

  readonly handlers: Record<string, Handler> = {
    'wallet.getWalletInfo': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const b = await this.economy.balance(uid);
      return {
        uid: s(uid),
        coins: s(b.coins), diamonds: s(b.diamonds), gold: s(b.gold), beans: s(b.beans),
        // Names the various screens use for the same two numbers.
        balance: s(b.coins), money: s(b.coins), diamond: s(b.diamonds),
      };
    },
  };
}

/** Activity banners — home carousel, room banners, Me-page promos. */
@Injectable()
export class ActivityModule extends ApiModule {
  constructor(private prisma: PrismaService) { super(); }

  private async banners(position: string) {
    const now = new Date();
    const rows = await this.prisma.banner.findMany({
      where: {
        active: true, position,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: { sort: 'asc' },
    });
    return rows.map(b => ({ id: b.id, image: b.image, img: b.image, url: b.link, link: b.link, sort: b.sort }));
  }

  readonly handlers: Record<string, Handler> = {
    'activity.getBannerListV2': async (r: ActionReq) => ({ list: await this.banners(String(r.position || 'home')) }),
    'activity.getBannerListV': async (r: ActionReq) => this.handlers['activity.getBannerListV2'](r),
    'activity.getBannerList': async (r: ActionReq) => this.handlers['activity.getBannerListV2'](r),
    'activity.clickBanner': async (r: ActionReq) => {
      const id = Number(r.id || r.banner_id || 0);
      if (id) await this.prisma.banner.update({ where: { id }, data: { clicks: { increment: 1 } } }).catch(() => null);
      return { code: 0 };
    },
    'activity.getRoomEvents': async (r: ActionReq) => ({ list: await this.banners('room') }),
  };
}

/** Search across users and rooms. */
@Injectable()
export class SearchModule extends ApiModule {
  constructor(private prisma: PrismaService) { super(); }

  private async users(q: string, take: number) {
    if (!q) return [];
    // A numeric query is almost always someone typing a uid, so match that
    // exactly first — searching nicknames for "1278472" finds nothing useful.
    const asUid = Number(q);
    const rows = await this.prisma.user.findMany({
      where: Number.isInteger(asUid) && asUid > 0
        ? { OR: [{ uid: asUid }, { nick: { contains: q, mode: 'insensitive' } }] }
        : { nick: { contains: q, mode: 'insensitive' } },
      take,
    });
    return rows.map(u => ({
      uid: s(u.uid), nick: u.nick, avatar: u.avatar, avatarFrame: u.avatarFrame,
      sex: s(u.sex), age: s(u.age), sign: u.sign, noble_level: u.noble_level,
    }));
  }

  readonly handlers: Record<string, Handler> = {
    'search.userSearch': async (r: ActionReq) => {
      const { take } = this.page(r);
      return { list: await this.users(String(r.keyword || r.key || r.q || '').trim(), take) };
    },
    'search.friendSearch': async (r: ActionReq) => this.handlers['search.userSearch'](r),
    'search.roomSearch': async (r: ActionReq) => {
      const q = String(r.keyword || r.key || r.q || '').trim();
      const { take } = this.page(r);
      if (!q) return { list: [] };
      const asRid = Number(q);
      const rooms = await this.prisma.room.findMany({
        where: {
          status: 1,
          ...(Number.isInteger(asRid) && asRid > 0
            ? { OR: [{ rid: asRid }, { name: { contains: q, mode: 'insensitive' } }] }
            : { name: { contains: q, mode: 'insensitive' } }),
        },
        take,
      });
      return {
        list: rooms.map(x => ({
          rid: x.rid, roomName: x.name, cover: x.cover,
          onlineNum: x.onlineNum, owner_uid: s(x.owner_uid),
        })),
      };
    },
    'search.recommend': async (r: ActionReq) => {
      const rooms = await this.prisma.room.findMany({ where: { status: 1 }, orderBy: { onlineNum: 'desc' }, take: 10 });
      return { list: rooms.map(x => ({ rid: x.rid, roomName: x.name, cover: x.cover, onlineNum: x.onlineNum })) };
    },
  };
}

/** Medals shown on profiles and in the room. */
@Injectable()
export class MedalModule extends ApiModule {
  constructor(private prisma: PrismaService) { super(); }

  private async owned(uid: number) {
    const rows = await this.prisma.userMedal.findMany({ where: { uid }, orderBy: { gotAt: 'desc' } });
    const medals = await this.prisma.medal.findMany({ where: { medal_id: { in: rows.map(r => r.medal_id) } } });
    const by = new Map(medals.map(m => [m.medal_id, m]));
    return rows.filter(r => by.has(r.medal_id)).map(r => {
      const m = by.get(r.medal_id)!;
      return {
        medal_id: m.medal_id, name: m.name, icon: m.icon, desc: m.desc,
        adorned: r.adorned ? 1 : 0,
        expireAt: r.expireAt ? Math.floor(r.expireAt.getTime() / 1000) : 0,
      };
    });
  }

  readonly handlers: Record<string, Handler> = {
    'medal.getMedalList': async () => ({
      list: await this.prisma.medal.findMany({ where: { active: true }, orderBy: { sort: 'asc' } }),
    }),
    'medal.getUserMedalListAll': async (r: ActionReq) => ({ list: await this.owned(Number(r.target_uid || this.uidOf(r))) }),
    'medal.getSomeUserMedalList': async (r: ActionReq) => ({ list: await this.owned(Number(r.target_uid || this.uidOf(r))) }),
    'medal.getUserMedalListAdorn': async (r: ActionReq) => ({
      list: (await this.owned(Number(r.target_uid || this.uidOf(r)))).filter(m => m.adorned === 1),
    }),
    'medal.adornMedalList': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const ids = String(r.medal_ids || r.medal_id || '').split(',').map(Number).filter(Boolean);
      await this.prisma.userMedal.updateMany({ where: { uid }, data: { adorned: false } });
      if (ids.length) await this.prisma.userMedal.updateMany({
        where: { uid, medal_id: { in: ids } }, data: { adorned: true },
      });
      return { code: 0, list: (await this.owned(uid)).filter(m => m.adorned === 1) };
    },
  };
}

/**
 * Agency / BD centre.
 *
 * `Action/BDCenter.inviteUserRes` is polled by the client (668 calls in one
 * session) for the state of an invitation it is showing. Returning an empty
 * envelope left that card stuck.
 */
@Injectable()
export class AgencyModule extends ApiModule {
  constructor(private prisma: PrismaService) { super(); }

  readonly handlers: Record<string, Handler> = {
    'Action/BDCenter.inviteUserRes': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const inv = await this.prisma.agencyInvite.findFirst({
        where: { uid, status: 0 }, orderBy: { createdAt: 'desc' },
      });
      if (!inv) return { hasInvite: 0, list: [] };
      const agency = await this.prisma.agency.findUnique({ where: { id: inv.agency_id } });
      const by = await this.prisma.user.findUnique({ where: { uid: inv.invitedBy } });
      return {
        hasInvite: 1,
        invite_id: inv.id,
        agency_id: inv.agency_id,
        agency_name: agency?.name ?? '',
        invitedBy: s(inv.invitedBy),
        invitedByNick: by?.nick ?? '',
        status: inv.status,
        createdAt: Math.floor(inv.createdAt.getTime() / 1000),
        list: [],
      };
    },
    'Action/BDCenter.inviteUser': async (r: ActionReq) => {
      const inviter = this.uidOf(r);
      const target = Number(r.target_uid || r.uid || 0);
      const agency = await this.prisma.agency.findFirst({ where: { owner_uid: inviter } });
      if (!agency || !target) return { code: 1, msg: 'not_permitted' };
      await this.prisma.agencyInvite.upsert({
        where: { agency_id_uid: { agency_id: agency.id, uid: target } },
        create: { agency_id: agency.id, uid: target, invitedBy: inviter },
        update: { status: 0, respondedAt: null },
      });
      await this.prisma.notice.create({
        data: { uid: target, type: 'guild', title: 'agency_invite', body: agency.name },
      }).catch(() => null);
      return { code: 0 };
    },
  };
}
