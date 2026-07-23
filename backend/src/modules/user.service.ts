import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';

/**
 * Profiles, following and the social lists.
 *
 * Follow state lives in Friend rows with type 'follow' (uid follows
 * target_uid). Fans are the same rows read in the other direction, which is
 * why subcribe/unsubcribe/getFansList/getSubcribeList all touch one table
 * rather than keeping two counters that can disagree.
 *
 * Note the original app's spelling — `subcribe`, not `subscribe`. It is kept
 * verbatim because the client sends it; correcting it would break the call.
 */
@Injectable()
export class UserModule extends ApiModule {
  constructor(private prisma: PrismaService) { super(); }

  private brief(u: any) {
    return {
      uid: s(u.uid), nick: u.nick, avatar: u.avatar, avatarFrame: u.avatarFrame,
      sex: s(u.sex), age: s(u.age), sign: u.sign, country: u.country ?? '',
      noble_level: u.noble_level, svip: u.svip, isAnchor: u.isAnchor,
    };
  }

  private async counts(uid: number) {
    const [fans, subs] = await Promise.all([
      this.prisma.friend.count({ where: { target_uid: uid, type: 'follow' } }),
      this.prisma.friend.count({ where: { uid, type: 'follow' } }),
    ]);
    return { fans, subs };
  }

  private async listUsers(uids: number[]) {
    const us = await this.prisma.user.findMany({ where: { uid: { in: uids } } });
    const by = new Map(us.map(u => [u.uid, u]));
    return uids.map(id => by.get(id)).filter(Boolean).map(u => this.brief(u));
  }

  readonly handlers: Record<string, Handler> = {
    'user.getUinfoV2': async (r: ActionReq) => {
      const uid = Number(r.target_uid || r.uid || this.uidOf(r));
      const u = await this.prisma.user.findUnique({ where: { uid }, include: { profile: true } });
      if (!u) return {};
      const c = await this.counts(uid);
      return { ...this.brief(u), fans: s(c.fans), subs: s(c.subs), gifts: s(u.profile?.gifts ?? 0) };
    },

    // ── following ──
    'user.subcribe': async (r: ActionReq) => {
      const uid = this.uidOf(r), t = Number(r.target_uid || r.tuid || 0);
      if (!uid || !t || uid === t) return { code: 1, msg: 'bad_request' };
      await this.prisma.friend.upsert({
        where: { uid_target_uid_type: { uid, target_uid: t, type: 'follow' } },
        create: { uid, target_uid: t, type: 'follow' }, update: {},
      });
      await this.prisma.notice.create({
        data: { uid: t, type: 'follow', title: 'new_follower', body: String(uid) },
      }).catch(() => null);
      // Denormalised counters exist on Profile; keep them true rather than stale.
      await this.syncCounters(uid, t);
      return { code: 0, isSubscribe: 1 };
    },
    'user.unsubcribe': async (r: ActionReq) => {
      const uid = this.uidOf(r), t = Number(r.target_uid || r.tuid || 0);
      await this.prisma.friend.deleteMany({ where: { uid, target_uid: t, type: 'follow' } });
      await this.syncCounters(uid, t);
      return { code: 0, isSubscribe: 0 };
    },
    'user.getIsSubscribe': async (r: ActionReq) => {
      const uid = this.uidOf(r), t = Number(r.target_uid || r.tuid || 0);
      const f = await this.prisma.friend.findFirst({ where: { uid, target_uid: t, type: 'follow' } });
      return { isSubscribe: f ? 1 : 0 };
    },
    'user.bashGetIsSubscribe': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const targets = String(r.uids || r.target_uids || '').split(',').map(Number).filter(Boolean);
      const rows = await this.prisma.friend.findMany({
        where: { uid, type: 'follow', target_uid: { in: targets } },
      });
      const set = new Set(rows.map(x => x.target_uid));
      return { list: targets.map(t => ({ uid: s(t), isSubscribe: set.has(t) ? 1 : 0 })) };
    },

    'user.getSubcribeList': async (r: ActionReq) => {
      const uid = Number(r.target_uid || this.uidOf(r));
      const { skip, take } = this.page(r);
      const rows = await this.prisma.friend.findMany({
        where: { uid, type: 'follow' }, orderBy: { createdAt: 'desc' }, skip, take,
      });
      return { list: await this.listUsers(rows.map(x => x.target_uid)) };
    },
    'user.getFansList': async (r: ActionReq) => {
      const uid = Number(r.target_uid || this.uidOf(r));
      const { skip, take } = this.page(r);
      const rows = await this.prisma.friend.findMany({
        where: { target_uid: uid, type: 'follow' }, orderBy: { createdAt: 'desc' }, skip, take,
      });
      return { list: await this.listUsers(rows.map(x => x.uid)) };
    },
    'user.getFriendList': async (r: ActionReq) => {
      // Mutual follows only — that is what the app calls a friend.
      const uid = this.uidOf(r);
      const mine = await this.prisma.friend.findMany({ where: { uid, type: 'follow' } });
      const back = await this.prisma.friend.findMany({
        where: { target_uid: uid, type: 'follow', uid: { in: mine.map(m => m.target_uid) } },
      });
      return { list: await this.listUsers(back.map(b => b.uid)) };
    },

    // ── discovery ──
    'user.getRecommendUser': async (r: ActionReq) => this.recommend(r),
    'user.recommendUser': async (r: ActionReq) => this.recommend(r),
    'user.onlineUser': async (r: ActionReq) => this.recommend(r),

    'user.visitors': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const rows = await this.prisma.friend.findMany({
        where: { target_uid: uid, type: 'visit' }, orderBy: { createdAt: 'desc' }, take: 50,
      });
      return { list: await this.listUsers(rows.map(x => x.uid)) };
    },
    'user.supporter': async (r: ActionReq) => {
      // Top gifters to this user, all-time.
      const uid = Number(r.target_uid || this.uidOf(r));
      const rows = await this.prisma.giftRecord.groupBy({
        by: ['from_uid'], where: { to_uid: uid }, _sum: { coin_total: true },
      }).catch(() => [] as any[]);
      const top = (rows as any[])
        .map(x => ({ uid: x.from_uid, score: Number(x._sum.coin_total ?? 0) }))
        .sort((a, b) => b.score - a.score).slice(0, 20);
      const users = await this.listUsers(top.map(t => t.uid));
      return { list: users.map((u, i) => ({ ...u, score: s(top[i]?.score ?? 0), rank: i + 1 })) };
    },

    // ── mutations ──
    'user.updateUInfo': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const data: any = {};
      for (const [k, col] of [['nick', 'nick'], ['sign', 'sign'], ['avatar', 'avatar'],
                              ['birthday', 'birthday'], ['country', 'country'], ['region', 'region']] as const)
        if (r[k] !== undefined) data[col] = String(r[k]);
      if (r.sex !== undefined) data.sex = Number(r.sex) || 0;
      if (!Object.keys(data).length) return { code: 1, msg: 'nothing_to_update' };
      const u = await this.prisma.user.update({ where: { uid }, data });
      return { code: 0, ...this.brief(u) };
    },
    'user.updateAlias': async (r: ActionReq) => this.handlers['user.updateUInfo'](r),
    'user.uploadAvatar': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const avatar = String(r.avatar || r.url || '');
      if (!avatar) return { code: 1, msg: 'no_avatar' };
      // audit_avatar mirrors the original moderation flag; 0 = pending review.
      await this.prisma.user.update({ where: { uid }, data: { avatar, audit_avatar: 0 } });
      return { code: 0, avatar };
    },
    'user.setCountry': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const country = String(r.country || '');
      await this.prisma.user.update({ where: { uid }, data: { country } });
      return { code: 0, country };
    },
    'user.updateCountry': async (r: ActionReq) => this.handlers['user.setCountry'](r),
    'user.updateLang': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      await this.prisma.user.update({ where: { uid }, data: { lang: String(r.lang || '') } });
      return { code: 0 };
    },

    'user.getUserIdentity': async (r: ActionReq) => {
      const uid = Number(r.target_uid || this.uidOf(r));
      const u = await this.prisma.user.findUnique({ where: { uid }, include: { vip: true } });
      return {
        uid: s(uid), isAnchor: u?.isAnchor ? 1 : 0, isPresident: u?.isPresident ? 1 : 0,
        noble_level: u?.vip?.noble_level ?? u?.noble_level ?? 0,
        vip_level: u?.vip?.vip_level ?? 0, svip: u?.svip ?? 0,
      };
    },
    'user.getUserImSendStatus': async () => ({ canSend: 1, limit: 0 }),
    'user.getWhiteList': async () => ({ list: [] }),
    'user.getSensitivePath': async () => ({ list: [] }),
    'user.getNewUserPrizes': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const days = await this.prisma.userSignIn.count({ where: { uid } });
      return { isNew: days <= 1 ? 1 : 0, list: [] };
    },
  };

  private async recommend(r: ActionReq) {
    const uid = this.uidOf(r);
    const { skip, take } = this.page(r);
    const us = await this.prisma.user.findMany({
      where: { uid: { not: uid }, isBanned: 0 },
      orderBy: [{ isAnchor: 'desc' }, { noble_level: 'desc' }], skip, take,
    });
    return { list: us.map(u => this.brief(u)) };
  }

  /** Keep Profile.fans/subs in step with the Friend rows they summarise. */
  private async syncCounters(uid: number, target: number) {
    for (const id of [uid, target]) {
      const c = await this.counts(id);
      await this.prisma.profile.update({
        where: { uid: id }, data: { fans: c.fans, subs: c.subs },
      }).catch(() => null);
    }
  }
}
