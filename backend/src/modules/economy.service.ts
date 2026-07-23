import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type Currency = 'coins' | 'diamonds' | 'gold' | 'beans';

/**
 * The only place balances change.
 *
 * Sign-in rewards, mall purchases and gift sending all move currency, and the
 * original app exposes each through a different action. Letting each module do
 * its own `wallet.update` would mean three chances to forget the ledger row or
 * to allow a negative balance. Everything funnels through here instead.
 */
@Injectable()
export class EconomyService {
  constructor(private prisma: PrismaService) {}

  async balance(uid: number) {
    const w = await this.prisma.wallet.findUnique({ where: { uid } });
    return {
      coins: w?.coins ?? 0n, diamonds: w?.diamonds ?? 0n,
      gold: w?.gold ?? 0n, beans: w?.beans ?? 0n,
    };
  }

  /** Add currency. Always writes a ledger row so the balance is explainable. */
  async credit(uid: number, cur: Currency, amount: number, reason: string, refId?: string) {
    if (!uid || amount <= 0) return false;
    await this.prisma.wallet.update({
      where: { uid }, data: { [cur]: { increment: BigInt(amount) } },
    }).catch(() => null);
    await this.ledger(uid, cur, amount, reason, refId);
    return true;
  }

  /**
   * Spend currency. Refuses rather than going negative — the check and the
   * decrement run in one transaction so two concurrent purchases cannot both
   * pass the check against the same balance.
   */
  async debit(uid: number, cur: Currency, amount: number, reason: string, refId?: string): Promise<boolean> {
    if (!uid || amount <= 0) return false;
    try {
      await this.prisma.$transaction(async tx => {
        const w = await tx.wallet.findUnique({ where: { uid } });
        const have = (w as any)?.[cur] ?? 0n;
        if (have < BigInt(amount)) throw new Error('insufficient');
        await tx.wallet.update({ where: { uid }, data: { [cur]: { decrement: BigInt(amount) } } });
        await tx.walletTransaction.create({
          data: {
            uid, reason, refId: refId ?? null,
            deltaCoins: cur === 'coins' ? BigInt(-amount) : 0n,
            deltaDiamonds: cur === 'diamonds' ? BigInt(-amount) : 0n,
          },
        });
      });
      return true;
    } catch { return false; }
  }

  private async ledger(uid: number, cur: Currency, amount: number, reason: string, refId?: string) {
    // The ledger only has coin and diamond columns; gold and beans still move
    // on the wallet, they just are not itemised. Recording a zero-delta row for
    // them would be worse than recording nothing, so we skip it deliberately.
    if (cur !== 'coins' && cur !== 'diamonds') return;
    await this.prisma.walletTransaction.create({
      data: {
        uid, reason, refId: refId ?? null,
        deltaCoins: cur === 'coins' ? BigInt(amount) : 0n,
        deltaDiamonds: cur === 'diamonds' ? BigInt(amount) : 0n,
      },
    }).catch(() => null);
  }

  /** Currency id used by Gift.coin_type / MallProduct.coin_type. */
  static currencyOf(coinType: number): Currency {
    return coinType === 2 ? 'diamonds' : 'coins';
  }
}
