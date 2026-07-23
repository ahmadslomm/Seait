import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';
import { EconomyService } from './economy.service';

/** Daily sign-in and task rewards. */
@Injectable()
export class TaskModule extends ApiModule {
  constructor(private prisma: PrismaService, private economy: EconomyService) { super(); }

  private ymd(d = new Date()) { return d.toISOString().slice(0, 10); }

  /**
   * The seven-day board the client renders.
   *
   * `day` is the user's position in the cycle, not the day of the week: it
   * advances on each claim and wraps at 7. Rewards themselves are rows in
   * SignInReward so they can be retuned from the admin panel without a deploy.
   */
  private async board(uid: number) {
    const rewards = await this.prisma.signInReward.findMany({ orderBy: { day: 'asc' } });
    const mine = await this.prisma.userSignIn.findMany({ where: { uid }, orderBy: { signedAt: 'desc' }, take: 30 });
    const today = this.ymd();
    const signedToday = mine.some(m => m.ymd === today);
    // Consecutive run ending today or yesterday; anything older resets the cycle.
    let streak = 0;
    const seen = new Set(mine.map(m => m.ymd));
    for (let i = signedToday ? 0 : 1; i < 30; i++) {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
      if (seen.has(this.ymd(d))) streak++; else break;
    }
    const cycleDay = ((streak % 7) || (streak ? 7 : 0));
    return { rewards, signedToday, streak, cycleDay };
  }

  private view(rewards: any[], cycleDay: number, signedToday: boolean) {
    return rewards.map(r => ({
      day: r.day,
      reward_type: r.reward_type,
      reward_num: s(r.reward_num),
      product_id: r.product_id ?? 0,
      icon: r.icon,
      // claimed: earlier in the current cycle; today counts only once claimed.
      status: r.day < cycleDay || (r.day === cycleDay && signedToday) ? 1 : 0,
      isToday: r.day === (signedToday ? cycleDay : cycleDay + 1) ? 1 : 0,
    }));
  }

  private async signIn(uid: number) {
    const { rewards, signedToday, cycleDay } = await this.board(uid);
    if (signedToday) return { code: 1, msg: 'already_signed', list: this.view(rewards, cycleDay, true) };

    const next = (cycleDay % 7) + 1;
    const reward = rewards.find(r => r.day === next);
    const today = this.ymd();

    await this.prisma.userSignIn.create({ data: { uid, day: next, ymd: today } }).catch(() => null);

    // Credit the reward for real — the wallet is the same one every other
    // screen reads, so a sign-in that did not move the balance would be a lie.
    if (reward && reward.reward_num > 0) {
      await this.economy.credit(
        uid, reward.reward_type === 'diamond' ? 'diamonds' : 'coins',
        reward.reward_num, 'signin', today);
    }
    if (reward?.product_id) {
      await this.prisma.userProduct.upsert({
        where: { uid_product_id: { uid, product_id: reward.product_id } },
        create: { uid, product_id: reward.product_id, source: 'grant' },
        update: {},
      }).catch(() => null);
    }

    const after = await this.board(uid);
    return { code: 0, day: next, reward_num: s(reward?.reward_num ?? 0),
             reward_type: reward?.reward_type ?? 'coin',
             list: this.view(after.rewards, after.cycleDay, true) };
  }

  readonly handlers: Record<string, Handler> = {
    'task.getSignInListV3': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const { rewards, signedToday, cycleDay, streak } = await this.board(uid);
      return {
        list: this.view(rewards, cycleDay, signedToday),
        signed: signedToday ? 1 : 0,
        continuous: s(streak),
        today: cycleDay,
      };
    },
    // V1 predates the seven-day board but the client accepts the same shape.
    'task.getSignInListV': async (r: ActionReq) => this.handlers['task.getSignInListV3'](r),
    'task.signInV3': async (r: ActionReq) => this.signIn(this.uidOf(r)),
    'task.signInV': async (r: ActionReq) => this.signIn(this.uidOf(r)),

    'task.giveBeans': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const num = Math.max(0, Number(r.num || 0) || 0);
      if (!uid || !num) return { code: 1, msg: 'bad_request' };
      await this.economy.credit(uid, 'beans', num, 'give_beans');
      return { code: 0, beans: s(num) };
    },
  };
}
