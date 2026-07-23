import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';
import { EconomyService } from './economy.service';

/**
 * Gifts — catalogue, sending, and the maps/ranks built from the send history.
 *
 * Sending is the one action here with real consequences: it debits the sender,
 * credits the receiver's charm, and writes the GiftRecord that every rank in the
 * app is computed from. It goes through EconomyService so it cannot spend money
 * the user does not have.
 *
 * The animation fields (anim_type/anim_url) are what the gift engine keys on;
 * they are columns rather than a bundled lookup table so a new gift is a
 * database row plus an uploaded file, with no client release.
 */
@Injectable()
export class GiftModule extends ApiModule {
  constructor(private prisma: PrismaService, private economy: EconomyService) { super(); }

  private view(g: any) {
    return {
      gift_id: g.gift_id, id: g.gift_id, name: g.name, icon: g.icon,
      price: s(g.price), coin_type: g.coin_type, category: g.category,
      anim_type: g.anim_type, anim_url: g.anim_url,
      fullscreen: g.fullscreen ? 1 : 0,
    };
  }

  /** Tabs the gift panel renders, derived from the categories actually in use. */
  private async tabs() {
    const rows = await this.prisma.gift.groupBy({
      by: ['category'], where: { active: true }, _count: { _all: true },
    }).catch(() => [] as any[]);
    const NAMES: Record<number, string> = { 0: 'Popular', 1: 'Luxury', 2: 'Lucky', 3: 'Event' };
    return (rows as any[])
      .map(r => ({ id: r.category, name: NAMES[r.category] ?? `Tab ${r.category}`, num: r._count._all }))
      .sort((a, b) => a.id - b.id);
  }

  private async send(r: ActionReq) {
    const from = this.uidOf(r);
    const to = Number(r.to_uid || r.target_uid || r.toUid || 0);
    const rid = Number(r.rid || 0) || null;
    const giftId = Number(r.gift_id || r.giftId || 0);
    const num = Math.max(1, Number(r.num || 1) || 1);

    if (!from || !to || !giftId) return { code: 1, msg: 'bad_request' };
    if (from === to) return { code: 1, msg: 'cannot_gift_self' };

    const gift = await this.prisma.gift.findUnique({ where: { gift_id: giftId } });
    if (!gift || !gift.active) return { code: 1, msg: 'gift_not_found' };

    const total = gift.price * num;
    const cur = EconomyService.currencyOf(gift.coin_type);
    if (total > 0 && !await this.economy.debit(from, cur, total, 'gift_send', String(giftId)))
      return { code: 1, msg: 'insufficient_balance' };

    await this.prisma.giftRecord.create({
      data: { from_uid: from, to_uid: to, rid, gift_id: giftId, num, coin_total: BigInt(total) },
    });

    // The receiver's earnings and charm both move: beans are what they can cash
    // out, charm is what the ranks are ordered by.
    await this.economy.credit(to, 'beans', Math.floor(total / 2), 'gift_receive', String(giftId));
    await this.prisma.wealth.update({
      where: { uid: to }, data: { charm: { increment: BigInt(total) } },
    }).catch(() => null);
    await this.prisma.profile.update({
      where: { uid: to }, data: { gifts: { increment: num } },
    }).catch(() => null);
    await this.prisma.notice.create({
      data: { uid: to, type: 'gift', title: 'gift_received', body: `${giftId}:${num}` },
    }).catch(() => null);

    const bal = await this.economy.balance(from);
    return {
      code: 0, gift_id: giftId, num, to_uid: s(to),
      coin_total: s(total),
      // The client updates its balance from the send response rather than
      // re-fetching the wallet, so it must come back here.
      coins: s(bal.coins), diamonds: s(bal.diamonds),
      ...this.view(gift),
    };
  }

  /** uid -> which gifts they have received, and how many. */
  private async giftMap(uid: number) {
    const rows = await this.prisma.giftRecord.groupBy({
      by: ['gift_id'], where: { to_uid: uid }, _sum: { num: true },
    }).catch(() => [] as any[]);
    const gifts = await this.prisma.gift.findMany({
      where: { gift_id: { in: (rows as any[]).map(r => r.gift_id) } },
    });
    const by = new Map(gifts.map(g => [g.gift_id, g]));
    return (rows as any[])
      .filter(r => by.has(r.gift_id))
      .map(r => ({ ...this.view(by.get(r.gift_id)), num: s(r._sum.num ?? 0) }))
      .sort((a, b) => Number(b.num) - Number(a.num));
  }

  readonly handlers: Record<string, Handler> = {
    'gift.getClientGiftTabs': async () => ({ list: await this.tabs() }),

    'gift.getPacketGift': async (r: ActionReq) => {
      // Backpack gifts: gift-type products the user owns. There are none yet,
      // so this is genuinely empty rather than stubbed.
      const rows = await this.prisma.userProduct.findMany({
        where: { uid: this.uidOf(r), product: { type: 'gift' } }, include: { product: true },
      });
      return { list: rows.map(x => ({ product_id: x.product_id, name: x.product.name, icon: x.product.icon, num: 1 })) };
    },
    'gift.checkHasPacketGift': async (r: ActionReq) => {
      const n = await this.prisma.userProduct.count({ where: { uid: this.uidOf(r), product: { type: 'gift' } } });
      return { has: n > 0 ? 1 : 0, num: s(n) };
    },

    'gift.sendPrivateGift': async (r: ActionReq) => this.send(r),
    'gift.sendSongGift': async (r: ActionReq) => this.send(r),
    'Action/RoomApi.sendGift': async (r: ActionReq) => this.send(r),
    'Action/LiveRoom.sendLiveGift': async (r: ActionReq) => this.send(r),

    'gift.getUserGiftMap': async (r: ActionReq) => ({ list: await this.giftMap(Number(r.target_uid || this.uidOf(r))) }),
    'gift.getTopUserGiftMap': async (r: ActionReq) => ({ list: await this.giftMap(Number(r.target_uid || this.uidOf(r))) }),
    'gift.getUserSongGiftList': async (r: ActionReq) => ({ list: await this.giftMap(Number(r.target_uid || this.uidOf(r))) }),

    'gift.getReceieveGift': async (r: ActionReq) => {
      // Note the original app's spelling of "receive" — kept because the client
      // sends it.
      const uid = this.uidOf(r);
      const { skip, take } = this.page(r);
      const rows = await this.prisma.giftRecord.findMany({
        where: { to_uid: uid }, orderBy: { createdAt: 'desc' }, skip, take,
      });
      const [gifts, users] = await Promise.all([
        this.prisma.gift.findMany({ where: { gift_id: { in: rows.map(x => x.gift_id) } } }),
        this.prisma.user.findMany({ where: { uid: { in: rows.map(x => x.from_uid) } } }),
      ]);
      const gm = new Map(gifts.map(g => [g.gift_id, g]));
      const um = new Map(users.map(u => [u.uid, u]));
      return {
        list: rows.map(x => ({
          ...(gm.has(x.gift_id) ? this.view(gm.get(x.gift_id)) : { gift_id: x.gift_id }),
          num: s(x.num), coin_total: s(x.coin_total),
          from_uid: s(x.from_uid),
          from_nick: um.get(x.from_uid)?.nick ?? '',
          from_avatar: um.get(x.from_uid)?.avatar ?? '',
          time: Math.floor(x.createdAt.getTime() / 1000),
        })),
      };
    },

    'gift.getDrawGiftTemplate': async () => ({ list: [] }),
    'gift.shareGiftMapMoment': async () => ({ code: 0 }),
  };
}
