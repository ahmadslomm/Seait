import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EconomyService, Currency } from '../modules/economy.service';
import { AuditService } from './audit.service';
import { AdminIdentity } from './admin-auth.service';

/**
 * Operator view of the economy: find a user, see their balances, and adjust
 * them — always through EconomyService, so an admin grant writes the same
 * ledger row and respects the same no-negative rule as an in-app spend. The
 * console never touches the wallet directly.
 */
@Injectable()
export class AdminEconomyService {
  constructor(
    private prisma: PrismaService,
    private economy: EconomyService,
    private audit: AuditService,
  ) {}

  private s(v: any) { return v === null || v === undefined ? '0' : String(v); }

  async findUsers(q: string) {
    const asUid = Number(q);
    const users = await this.prisma.user.findMany({
      where: Number.isInteger(asUid) && asUid > 0
        ? { OR: [{ uid: asUid }, { nick: { contains: q, mode: 'insensitive' } }] }
        : { nick: { contains: q, mode: 'insensitive' } },
      take: 25,
    });
    const wallets = await this.prisma.wallet.findMany({ where: { uid: { in: users.map(u => u.uid) } } });
    const wb = new Map(wallets.map(w => [w.uid, w]));
    return users.map(u => ({
      uid: u.uid, nick: u.nick, avatar: u.avatar, noble_level: u.noble_level, svip: u.svip, isBanned: u.isBanned,
      coins: this.s(wb.get(u.uid)?.coins), diamonds: this.s(wb.get(u.uid)?.diamonds),
    }));
  }

  async userDetail(uid: number) {
    const [u, w, vip, wealth, txns] = await Promise.all([
      this.prisma.user.findUnique({ where: { uid } }),
      this.prisma.wallet.findUnique({ where: { uid } }),
      this.prisma.userVip.findUnique({ where: { uid } }).catch(() => null),
      this.prisma.wealth.findUnique({ where: { uid } }).catch(() => null),
      this.prisma.walletTransaction.findMany({ where: { uid }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    if (!u) throw new NotFoundException('user_not_found');
    return {
      uid: u.uid, nick: u.nick, avatar: u.avatar, mobile: u.mobile,
      noble_level: u.noble_level, svip: u.svip, isBanned: u.isBanned,
      coins: this.s(w?.coins), diamonds: this.s(w?.diamonds), gold: this.s(w?.gold), beans: this.s(w?.beans),
      vip_level: vip?.vip_level ?? 0,
      wealthLv: wealth?.wealthLv ?? 0, charmLv: wealth?.charmLv ?? 0,
      transactions: txns.map(t => ({
        id: t.id, reason: t.reason, refId: t.refId,
        deltaCoins: this.s(t.deltaCoins), deltaDiamonds: this.s(t.deltaDiamonds),
        time: t.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Adjust a balance by a signed amount. Positive credits, negative debits;
   * a debit that would overdraw is refused, not floored, exactly like a spend.
   */
  async adjust(uid: number, currency: Currency, amount: number, reason: string, admin: AdminIdentity) {
    if (!uid) throw new BadRequestException('uid_required');
    if (!['coins', 'diamonds', 'gold', 'beans'].includes(currency)) throw new BadRequestException('bad_currency');
    if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException('bad_amount');

    await this.prisma.wallet.upsert({ where: { uid }, create: { uid }, update: {} }).catch(() => null);
    const label = `admin:${reason || 'adjust'}`;
    const ok = amount > 0
      ? await this.economy.credit(uid, currency, amount, label, `by:${admin.username}`)
      : await this.economy.debit(uid, currency, -amount, label, `by:${admin.username}`);
    if (!ok) throw new BadRequestException(amount < 0 ? 'insufficient_balance' : 'adjust_failed');

    await this.audit.record(admin, 'balance', 'user', uid, { currency, amount, reason });
    const bal = await this.economy.balance(uid);
    return { uid, currency, amount, balance: { coins: this.s(bal.coins), diamonds: this.s(bal.diamonds), gold: this.s(bal.gold), beans: this.s(bal.beans) } };
  }

  /** Grant or revoke a VIP level for a user (UserVip row). */
  async setVip(uid: number, level: number, admin: AdminIdentity) {
    if (!uid) throw new BadRequestException('uid_required');
    await this.prisma.userVip.upsert({
      where: { uid }, create: { uid, vip_level: level }, update: { vip_level: level },
    });
    await this.audit.record(admin, 'set_vip', 'user', uid, { level });
    return { uid, vip_level: level };
  }

  /** Ban / unban, mirrored onto the User row the client reads. */
  async setBan(uid: number, banned: boolean, admin: AdminIdentity) {
    await this.prisma.user.update({ where: { uid }, data: { isBanned: banned ? 1 : 0 } });
    await this.audit.record(admin, banned ? 'ban' : 'unban', 'user', uid);
    return { uid, isBanned: banned ? 1 : 0 };
  }

  /** Numbers for the dashboard landing page. */
  async dashboard() {
    const [users, rooms, gifts, products, txCount, giftSent, admins, audits] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.room.count({ where: { status: 1 } }),
      this.prisma.gift.count({ where: { active: true } }),
      this.prisma.mallProduct.count({ where: { active: true } }),
      this.prisma.walletTransaction.count(),
      this.prisma.giftRecord.count(),
      this.prisma.adminUser.count(),
      this.prisma.auditLog.count(),
    ]);
    const coinAgg = await this.prisma.wallet.aggregate({ _sum: { coins: true, diamonds: true } }).catch(() => null);
    return {
      users, rooms, activeGifts: gifts, activeProducts: products,
      transactions: txCount, giftsSent: giftSent, admins, auditEntries: audits,
      coinsInCirculation: this.s(coinAgg?._sum.coins), diamondsInCirculation: this.s(coinAgg?._sum.diamonds),
    };
  }
}
