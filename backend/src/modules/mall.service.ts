import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';
import { EconomyService } from './economy.service';

/**
 * Store and backpack.
 *
 * The original app has parallel actions for what is really one catalogue —
 * mall.getMallProductV/V2 for the store, getMyProduct/getUserProduct for the
 * backpack, buyTheme/buyCustomizeTheme alongside buyProduct, useTheme
 * alongside useProduct. They differ by item TYPE, not by behaviour, so each is
 * a thin view over MallProduct/UserProduct here. The action names are kept
 * exactly as the client sends them; only the implementation is shared.
 */
@Injectable()
export class MallModule extends ApiModule {
  constructor(private prisma: PrismaService, private economy: EconomyService) { super(); }

  /** Item types the app groups under "theme" rather than the generic store. */
  private static readonly THEME_TYPES = ['theme', 'room_bg'];

  private productView(p: any) {
    return {
      product_id: p.product_id, id: p.product_id,
      type: p.type, name: p.name, icon: p.icon, preview: p.preview,
      price: s(p.price), coin_type: p.coin_type, duration: p.duration,
      category: p.category, vip_only: p.vip_only, noble_only: p.noble_only,
      sort: p.sort,
    };
  }

  private ownedView(up: any) {
    const expired = up.expireAt ? up.expireAt.getTime() < Date.now() : false;
    return {
      ...this.productView(up.product),
      owned: 1,
      equipped: up.equipped ? 1 : 0,
      using: up.equipped ? 1 : 0, // the client reads either name depending on screen
      source: up.source,
      expireAt: up.expireAt ? Math.floor(up.expireAt.getTime() / 1000) : 0,
      expired: expired ? 1 : 0,
      days_left: up.expireAt ? Math.max(0, Math.ceil((up.expireAt.getTime() - Date.now()) / 86400000)) : 0,
    };
  }

  private async catalogue(type?: string | null, category?: number | null) {
    const rows = await this.prisma.mallProduct.findMany({
      where: { active: true, ...(type ? { type } : {}), ...(category ? { category } : {}) },
      orderBy: [{ sort: 'asc' }, { product_id: 'asc' }],
    });
    return rows.map(p => this.productView(p));
  }

  private async backpack(uid: number, type?: string | null) {
    const rows = await this.prisma.userProduct.findMany({
      where: { uid, ...(type ? { product: { type } } : {}) },
      include: { product: true }, orderBy: { createdAt: 'desc' },
    });
    return rows.map(r => this.ownedView(r));
  }

  /** Buy once, whatever the item is called on the screen that sold it. */
  private async buy(uid: number, productId: number) {
    if (!uid || !productId) return { code: 1, msg: 'bad_request' };
    const p = await this.prisma.mallProduct.findUnique({ where: { product_id: productId } });
    if (!p || !p.active) return { code: 1, msg: 'product_not_found' };

    const vip = await this.prisma.userVip.findUnique({ where: { uid } }).catch(() => null);
    if (p.vip_only && (vip?.vip_level ?? 0) < p.vip_only) return { code: 1, msg: 'vip_required' };
    if (p.noble_only && (vip?.noble_level ?? 0) < p.noble_only) return { code: 1, msg: 'noble_required' };

    const cur = EconomyService.currencyOf(p.coin_type);
    if (p.price > 0 && !await this.economy.debit(uid, cur, p.price, 'mall_buy', String(productId)))
      return { code: 1, msg: 'insufficient_balance' };

    // Re-buying extends the item rather than duplicating it.
    const existing = await this.prisma.userProduct.findUnique({
      where: { uid_product_id: { uid, product_id: productId } },
    });
    const base = existing?.expireAt && existing.expireAt > new Date() ? existing.expireAt : new Date();
    const expireAt = p.duration > 0 ? new Date(base.getTime() + p.duration * 86400000) : null;

    await this.prisma.userProduct.upsert({
      where: { uid_product_id: { uid, product_id: productId } },
      create: { uid, product_id: productId, source: 'buy', expireAt },
      update: { expireAt },
    });
    return { code: 0, product_id: productId, expireAt: expireAt ? Math.floor(expireAt.getTime() / 1000) : 0 };
  }

  /**
   * Equip an item. Only one of each type can be worn, and the worn item is
   * mirrored onto the User row because that is where every profile response
   * reads it from — the backpack flag alone would not change how the user looks
   * to anyone else.
   */
  private async use(uid: number, productId: number, on = true) {
    if (!uid || !productId) return { code: 1, msg: 'bad_request' };
    const up = await this.prisma.userProduct.findUnique({
      where: { uid_product_id: { uid, product_id: productId } }, include: { product: true },
    });
    if (!up) return { code: 1, msg: 'not_owned' };
    if (up.expireAt && up.expireAt < new Date()) return { code: 1, msg: 'expired' };

    await this.prisma.userProduct.updateMany({
      where: { uid, product: { type: up.product.type } }, data: { equipped: false },
    });
    if (on) await this.prisma.userProduct.update({
      where: { uid_product_id: { uid, product_id: productId } }, data: { equipped: true },
    });

    const field = ({ frame: 'avatarFrame', bubble: 'chatBubble', car: 'carFrame', theme: 'infoBgImg' } as any)[up.product.type];
    if (field) await this.prisma.user.update({
      where: { uid }, data: { [field]: on ? (up.product.preview || up.product.icon) : '' },
    }).catch(() => null);

    return { code: 0, product_id: productId, using: on ? 1 : 0 };
  }

  readonly handlers: Record<string, Handler> = {
    // ── store ──
    'mall.getMallProductV2': async (r: ActionReq) => ({
      list: await this.catalogue(r.type ? String(r.type) : null, r.category ? Number(r.category) : null),
    }),
    'mall.getMallProductV': async (r: ActionReq) => this.handlers['mall.getMallProductV2'](r),

    // ── backpack ──
    'mall.getMyProduct': async (r: ActionReq) => ({
      list: await this.backpack(this.uidOf(r), r.type ? String(r.type) : null),
    }),
    'mall.getUserProduct': async (r: ActionReq) => ({
      // Someone else's backpack: only what they are currently wearing is public.
      list: (await this.backpack(Number(r.target_uid || r.uid || 0))).filter(p => p.equipped === 1),
    }),
    'mall.getSomeUserCarFrame': async (r: ActionReq) => {
      const uids = String(r.uids || r.uid || '').split(',').map(Number).filter(Boolean);
      const rows = await this.prisma.userProduct.findMany({
        where: { uid: { in: uids }, equipped: true, product: { type: 'car' } }, include: { product: true },
      });
      return { list: rows.map(x => ({ uid: s(x.uid), carFrame: x.product.preview || x.product.icon })) };
    },

    // ── purchase ──
    'mall.buyProduct': async (r: ActionReq) =>
      this.buy(this.uidOf(r), Number(r.product_id || r.id || 0)),
    'mall.buyTheme': async (r: ActionReq) =>
      this.buy(this.uidOf(r), Number(r.product_id || r.theme_id || r.id || 0)),
    'mall.buyCustomizeTheme': async (r: ActionReq) =>
      this.buy(this.uidOf(r), Number(r.product_id || r.theme_id || r.id || 0)),

    // ── equip ──
    'mall.useProduct': async (r: ActionReq) =>
      this.use(this.uidOf(r), Number(r.product_id || r.id || 0), Number(r.status ?? r.use ?? 1) !== 0),
    'mall.useTheme': async (r: ActionReq) =>
      this.use(this.uidOf(r), Number(r.product_id || r.theme_id || r.id || 0), Number(r.status ?? 1) !== 0),

    // ── gifting an item ──
    'mall.giveAwayProduct': async (r: ActionReq) => {
      const from = this.uidOf(r), to = Number(r.target_uid || r.to_uid || 0);
      const pid = Number(r.product_id || r.id || 0);
      if (!from || !to || !pid) return { code: 1, msg: 'bad_request' };
      if (from === to) return { code: 1, msg: 'cannot_gift_self' };
      const bought = await this.buy(from, pid);
      if (bought.code !== 0) return bought;
      // The buyer pays; the recipient receives. Move it rather than duplicating.
      await this.prisma.userProduct.delete({ where: { uid_product_id: { uid: from, product_id: pid } } }).catch(() => null);
      const p = await this.prisma.mallProduct.findUnique({ where: { product_id: pid } });
      const expireAt = p && p.duration > 0 ? new Date(Date.now() + p.duration * 86400000) : null;
      await this.prisma.userProduct.upsert({
        where: { uid_product_id: { uid: to, product_id: pid } },
        create: { uid: to, product_id: pid, source: 'gift', expireAt },
        update: { expireAt },
      });
      await this.prisma.notice.create({
        data: { uid: to, type: 'gift', title: 'gift_received', body: String(pid) },
      }).catch(() => null);
      return { code: 0, product_id: pid, to_uid: s(to) };
    },

    'mall.giveAwayUserList': async (r: ActionReq) => {
      // Who you can gift to: people you follow, most recent first.
      const uid = this.uidOf(r);
      const { skip, take } = this.page(r);
      const rows = await this.prisma.friend.findMany({
        where: { uid, type: 'follow' }, orderBy: { createdAt: 'desc' }, skip, take,
      });
      const users = await this.prisma.user.findMany({ where: { uid: { in: rows.map(f => f.target_uid) } } });
      return { list: users.map(u => ({ uid: s(u.uid), nick: u.nick, avatar: u.avatar })) };
    },
  };
}
