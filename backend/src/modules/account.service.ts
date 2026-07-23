import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';

/**
 * Account, settings, moderation, reference data and the remaining odds and ends.
 *
 * Grouped rather than split into a file per two-action module: these are small
 * surfaces that share the User/Settings tables, and eleven more files would
 * obscure rather than clarify.
 */
@Injectable()
export class AccountModule extends ApiModule {
  constructor(private prisma: PrismaService) { super(); }

  private async brief(uids: number[]) {
    const us = await this.prisma.user.findMany({ where: { uid: { in: uids } } });
    const by = new Map(us.map(u => [u.uid, u]));
    return uids.map(id => by.get(id)).filter(Boolean).map((u: any) => ({
      uid: s(u.uid), nick: u.nick, avatar: u.avatar, avatarFrame: u.avatarFrame,
      sex: s(u.sex), noble_level: u.noble_level,
    }));
  }

  private async settings(uid: number) {
    return this.prisma.settings.upsert({ where: { uid }, create: { uid }, update: {} }).catch(() => null);
  }

  readonly handlers: Record<string, Handler> = {
    // ── app bootstrap ──
    'app.initApp': async (r: ActionReq) => {
      const [cfg, assetBase, banners] = await Promise.all([
        this.prisma.config.findUnique({ where: { key: 'appConfig' } }).catch(() => null),
        this.prisma.config.findUnique({ where: { key: 'assetBase' } }).catch(() => null),
        this.prisma.banner.count({ where: { active: true } }),
      ]);
      return {
        ...((cfg?.value as object) ?? {}),
        assetBase: assetBase?.value ?? '/assets/',
        serverTime: Math.floor(Date.now() / 1000),
        banners,
      };
    },
    'app.getConfigV': async (r: ActionReq) => this.handlers['app.initApp'](r),
    'app.checkAppVersion': async (r: ActionReq) => {
      const platform = String(r.platform ?? 'android');
      const latest = await this.prisma.appVersion.findFirst({
        where: { platform }, orderBy: { build: 'desc' },
      });
      const build = Number(r.build ?? r.versionCode ?? 0) || 0;
      if (!latest) return { hasUpdate: 0 };
      return {
        hasUpdate: latest.build > build ? 1 : 0,
        version: latest.version, build: latest.build,
        url: latest.url, notes: latest.notes,
        force: latest.force ? 1 : 0,
      };
    },
    'app.uploadPing': async () => ({ code: 0, ts: Math.floor(Date.now() / 1000) }),

    // ── login / registration ──
    'login.checkMobile': async (r: ActionReq) => {
      const mobile = String(r.mobile ?? '').trim();
      if (!mobile) return { code: 1, msg: 'no_mobile' };
      const u = await this.prisma.user.findFirst({ where: { mobile } });
      return { code: 0, exists: u ? 1 : 0, uid: u ? s(u.uid) : '' };
    },
    'login.call': async (r: ActionReq) => {
      // Voice-call login step. No SMS provider is wired, so this reports that
      // honestly instead of pretending a code was sent — a fake success here
      // would strand the user on a code screen forever.
      return { code: 1, msg: 'sms_provider_not_configured', mobile: String(r.mobile ?? '') };
    },
    'user.registerFinish': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      if (!uid) return { code: 1, msg: 'bad_request' };
      const data: any = {};
      if (r.nick) data.nick = String(r.nick);
      if (r.sex !== undefined) data.sex = Number(r.sex) || 0;
      if (r.birthday) data.birthday = String(r.birthday);
      if (r.country) data.country = String(r.country);
      await this.prisma.user.update({ where: { uid }, data }).catch(() => null);
      await this.prisma.wallet.upsert({ where: { uid }, create: { uid }, update: {} }).catch(() => null);
      await this.prisma.profile.upsert({ where: { uid }, create: { uid }, update: {} }).catch(() => null);
      return { code: 0, uid: s(uid) };
    },
    'user.unbind': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const kind = String(r.type ?? r.platform ?? '');
      // Only third-party links can be unbound; the mobile number is the account
      // recovery path, so removing it would lock the user out.
      if (kind === 'mobile') return { code: 1, msg: 'cannot_unbind_mobile' };
      return { code: 0, unbound: kind };
    },

    // ── user extras ──
    'user.batchGetUserinfoV': async (r: ActionReq) => {
      const uids = String(r.uids || r._login_uid || '').split(',').map(Number).filter(Boolean);
      return { list: await this.brief(uids.length ? uids : [this.uidOf(r)]) };
    },
    'user.getGiftWallList': async (r: ActionReq) => {
      // Every gift, flagged with whether this user has received it — the
      // "wall" is the full catalogue, not just what they own.
      const uid = Number(r.target_uid || this.uidOf(r));
      const [gifts, got] = await Promise.all([
        this.prisma.gift.findMany({ where: { active: true } }),
        this.prisma.giftRecord.groupBy({ by: ['gift_id'], where: { to_uid: uid }, _sum: { num: true } }).catch(() => [] as any[]),
      ]);
      const by = new Map((got as any[]).map(x => [x.gift_id, Number(x._sum.num ?? 0)]));
      return {
        list: gifts.map(g => ({
          gift_id: g.gift_id, name: g.name, icon: g.icon, price: s(g.price),
          num: s(by.get(g.gift_id) ?? 0), lighted: by.has(g.gift_id) ? 1 : 0,
        })),
      };
    },
    'user.getCountryList': async () => ({
      list: (await this.prisma.countryZone.findMany({ orderBy: { sort: 'asc' } }))
        .map(c => ({ code: c.code, name: c.name, zone: c.zone, flag: c.flag })),
    }),
    'user.getCountryConfig': async (r: ActionReq) => {
      const code = String(r.country ?? '').toUpperCase();
      const c = code ? await this.prisma.countryZone.findUnique({ where: { code } }) : null;
      return c ? { code: c.code, name: c.name, zone: c.zone, flag: c.flag } : {};
    },
    'countryZone.getZonelist': async () => ({
      list: (await this.prisma.countryZone.findMany({ orderBy: { sort: 'asc' } }))
        .map(c => ({ code: c.code, name: c.name, zone: c.zone, flag: c.flag })),
    }),

    // ── photos ──
    'backPhoto.updatePhoto': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const url = String(r.url ?? r.photo ?? '');
      if (!uid || !url) return { code: 1, msg: 'bad_request' };
      const p = await this.prisma.photo.create({ data: { uid, url, sort: Number(r.sort ?? 0) || 0 } });
      await this.prisma.profile.update({ where: { uid }, data: { photos: { increment: 1 } } }).catch(() => null);
      return { code: 0, id: p.id, url };
    },
    'backPhoto.updateDefultPhoto': async (r: ActionReq) => {
      // Original spelling ("Defult") retained — the client sends it.
      const uid = this.uidOf(r);
      const id = Number(r.id || r.photo_id || 0);
      await this.prisma.photo.updateMany({ where: { uid }, data: { isDefault: false } });
      if (id) await this.prisma.photo.update({ where: { id }, data: { isDefault: true } }).catch(() => null);
      return { code: 0 };
    },

    // ── privacy / hidden settings ──
    'Action/HiddenSettings.getHiddenSettings': async (r: ActionReq) => {
      const st = await this.settings(this.uidOf(r));
      return {
        hidden_online: st?.hidden_online ?? 0,
        hidden_ranking: st?.hidden_ranking ?? 0,
        hidden_act_ranking: st?.hidden_act_ranking ?? 0,
        refuse_accost: st?.refuse_accost ?? 0,
      };
    },
    'Action/HiddenSettings.updateHiddenSettings': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const data: any = {};
      for (const k of ['hidden_online', 'hidden_ranking', 'hidden_act_ranking', 'refuse_accost'])
        if (r[k] !== undefined) data[k] = Number(r[k]) ? 1 : 0;
      await this.prisma.settings.upsert({ where: { uid }, create: { uid, ...data }, update: data });
      return { code: 0, ...data };
    },

    // ── blocking / reporting ──
    'report.addBlackList': async (r: ActionReq) => {
      const uid = this.uidOf(r), target = Number(r.target_uid || r.tuid || 0);
      if (!uid || !target || uid === target) return { code: 1, msg: 'bad_request' };
      await this.prisma.userBlock.upsert({
        where: { uid_target_uid: { uid, target_uid: target } },
        create: { uid, target_uid: target }, update: {},
      });
      // Blocking implies unfollowing in both directions, otherwise the blocked
      // user keeps showing up in lists built from the follow graph.
      await this.prisma.friend.deleteMany({
        where: { OR: [{ uid, target_uid: target }, { uid: target, target_uid: uid }], type: 'follow' },
      });
      return { code: 0 };
    },
    'report.delBlackList': async (r: ActionReq) => {
      const uid = this.uidOf(r), target = Number(r.target_uid || r.tuid || 0);
      await this.prisma.userBlock.deleteMany({ where: { uid, target_uid: target } });
      return { code: 0 };
    },
    'report.getBlackList': async (r: ActionReq) => {
      const rows = await this.prisma.userBlock.findMany({ where: { uid: this.uidOf(r) } });
      return { list: await this.brief(rows.map(x => x.target_uid)) };
    },
    'report.checkInBlackList': async (r: ActionReq) => {
      const uid = this.uidOf(r), target = Number(r.target_uid || r.tuid || 0);
      const [mine, theirs] = await Promise.all([
        this.prisma.userBlock.findFirst({ where: { uid, target_uid: target } }),
        this.prisma.userBlock.findFirst({ where: { uid: target, target_uid: uid } }),
      ]);
      // Both directions matter: the client needs to know it is blocked, not
      // only that it has blocked.
      return { inBlackList: mine ? 1 : 0, blockedByThem: theirs ? 1 : 0 };
    },
    'report.reportUser': async (r: ActionReq) => {
      const row = await this.prisma.report.create({
        data: {
          uid: this.uidOf(r),
          target_uid: Number(r.target_uid || 0) || null,
          rid: Number(r.rid || 0) || null,
          kind: String(r.type ?? 'user'),
          reason: String(r.reason ?? ''),
          detail: String(r.detail ?? r.content ?? ''),
        },
      });
      return { code: 0, id: row.id };
    },
    'feedback.report': async (r: ActionReq) => {
      const row = await this.prisma.report.create({
        data: { uid: this.uidOf(r), kind: 'feedback', reason: String(r.type ?? ''), detail: String(r.content ?? r.detail ?? '') },
      });
      return { code: 0, id: row.id };
    },

    // ── noble ──
    'Action/Noble.getBirthdayInfo': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const u = await this.prisma.user.findUnique({ where: { uid } });
      const bd = u?.birthday ?? '';
      const today = new Date().toISOString().slice(5, 10);
      const isBirthday = !!bd && bd.slice(-5) === today;
      const claimed = await this.prisma.walletTransaction.count({
        where: { uid, reason: 'birthday', refId: new Date().getFullYear().toString() },
      });
      return { birthday: bd, isBirthday: isBirthday ? 1 : 0, canReceive: isBirthday && !claimed ? 1 : 0 };
    },
    'Action/Noble.receiveBirthdayPresent': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const info: any = await this.handlers['Action/Noble.getBirthdayInfo'](r);
      if (!info.canReceive) return { code: 1, msg: 'not_available' };
      const vip = await this.prisma.userVip.findUnique({ where: { uid } }).catch(() => null);
      const prize = 1000 * Math.max(1, vip?.noble_level ?? 1);
      await this.prisma.wallet.update({ where: { uid }, data: { coins: { increment: BigInt(prize) } } }).catch(() => null);
      await this.prisma.walletTransaction.create({
        data: { uid, reason: 'birthday', refId: new Date().getFullYear().toString(), deltaCoins: BigInt(prize) },
      }).catch(() => null);
      return { code: 0, prize: s(prize) };
    },
    'Action/Noble.sendHorn': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const text = String(r.text ?? r.content ?? '').trim();
      if (!text) return { code: 1, msg: 'empty' };
      const vip = await this.prisma.userVip.findUnique({ where: { uid } }).catch(() => null);
      // The horn is a noble privilege; without it the message would silently
      // go nowhere, so refuse rather than accept and drop.
      if ((vip?.noble_level ?? 0) < 1) return { code: 1, msg: 'noble_required' };
      const h = await this.prisma.horn.create({
        data: { uid, rid: Number(r.rid || 0) || null, text },
      });
      return { code: 0, id: h.id };
    },
    'Action/Noble.shareMoment': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const m = await this.prisma.moment.create({
        data: { uid, text: String(r.text ?? r.content ?? '') },
      });
      return { code: 0, id: m.id };
    },

    // ── guild / agency invitations ──
    'Action/Anchor.inviteJoinGuildRes': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const inv = await this.prisma.agencyInvite.findFirst({ where: { uid, status: 0 }, orderBy: { createdAt: 'desc' } });
      return inv
        ? { hasInvite: 1, invite_id: inv.id, agency_id: inv.agency_id, invitedBy: s(inv.invitedBy) }
        : { hasInvite: 0 };
    },
    'Action/BDCenter.inviteGuildRes': async (r: ActionReq) => this.handlers['Action/Anchor.inviteJoinGuildRes'](r),
    'Action/bestFriend.handleInvitation': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const target = Number(r.target_uid || 0);
      const accept = Number(r.status ?? r.accept ?? 1) !== 0;
      if (!uid || !target) return { code: 1, msg: 'bad_request' };
      if (accept) {
        // Best friends are mutual by construction, so write both directions.
        for (const [a, b] of [[uid, target], [target, uid]])
          await this.prisma.friend.upsert({
            where: { uid_target_uid_type: { uid: a, target_uid: b, type: 'best' } },
            create: { uid: a, target_uid: b, type: 'best' }, update: {},
          });
      } else {
        await this.prisma.friend.deleteMany({
          where: { OR: [{ uid, target_uid: target }, { uid: target, target_uid: uid }], type: 'best' },
        });
      }
      return { code: 0, accepted: accept ? 1 : 0 };
    },
    'couple.onAnswerCouple': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const target = Number(r.target_uid || 0);
      const accept = Number(r.status ?? r.answer ?? 1) !== 0;
      if (!uid || !target) return { code: 1, msg: 'bad_request' };
      if (!accept) return { code: 0, accepted: 0 };
      for (const [a, b] of [[uid, target], [target, uid]])
        await this.prisma.cp.upsert({
          where: { uid_target_uid: { uid: a, target_uid: b } },
          create: { uid: a, target_uid: b, hasCp: 1 }, update: { hasCp: 1 },
        });
      return { code: 0, accepted: 1 };
    },

    // ── IM helpers ──
    'Action/UsersRoamMsg.getIMNum': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const n = await this.prisma.message.count({ where: { to_uid: uid } });
      return { num: s(n) };
    },
    'Action/UsersRoamMsg.getRelationIMNum': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const follows = await this.prisma.friend.findMany({ where: { uid, type: 'follow' } });
      const n = await this.prisma.message.count({
        where: { to_uid: uid, from_uid: { in: follows.map(f => f.target_uid) } },
      });
      return { num: s(n) };
    },
    'Action/IMSvc.getQuickChatMsg': async () => {
      const row = await this.prisma.config.findUnique({ where: { key: 'quickChat' } }).catch(() => null);
      return { list: (row?.value as string[]) ?? [] };
    },

    // ── super management ──
    // Gated on a config allowlist rather than a role column: these actions can
    // ban users and wipe rooms, and no user-facing field should be able to
    // grant that by accident.
    'Action/SuperManage.ban': async (r: ActionReq) => this.superAct(r, async target => {
      await this.prisma.user.update({ where: { uid: target }, data: { isBanned: 1 } });
      return { banned: 1 };
    }),
    'Action/SuperManage.behaviorBan': async (r: ActionReq) => this.superAct(r, async target => {
      await this.prisma.report.create({
        data: { uid: this.uidOf(r), target_uid: target, kind: 'behavior_ban', reason: String(r.reason ?? ''), status: 1 },
      });
      return { banned: 1 };
    }),
    'Action/SuperManage.getUserBehaviorBanInfo': async (r: ActionReq) => {
      const target = Number(r.target_uid || r.uid || 0);
      const rows = await this.prisma.report.findMany({
        where: { target_uid: target, kind: 'behavior_ban' }, orderBy: { createdAt: 'desc' }, take: 20,
      });
      const u = await this.prisma.user.findUnique({ where: { uid: target } });
      return {
        uid: s(target), isBanned: u?.isBanned ?? 0,
        list: rows.map(x => ({ id: x.id, reason: x.reason, time: Math.floor(x.createdAt.getTime() / 1000) })),
      };
    },
    'Action/SuperManage.resetUser': async (r: ActionReq) => this.superAct(r, async target => {
      await this.prisma.user.update({ where: { uid: target }, data: { isBanned: 0 } });
      return { reset: 1 };
    }),
    'Action/SuperManage.deleteSong': async (r: ActionReq) => this.superAct(r, async () => {
      const id = Number(r.id || r.song_id || 0);
      await this.prisma.bottle.update({ where: { id }, data: { status: 0, censor: 2 } }).catch(() => null);
      return { deleted: 1 };
    }),
    'Action/SuperManage.resetRoom': async (r: ActionReq) => this.superAct(r, async () => {
      const rid = Number(r.rid || 0);
      await this.prisma.room.update({ where: { rid }, data: { notice: '', onlineNum: 0 } }).catch(() => null);
      await this.prisma.roomBan.deleteMany({ where: { rid } });
      return { reset: 1 };
    }),
    'Action/SuperManage.resetLiveRoom': async (r: ActionReq) => this.handlers['Action/SuperManage.resetRoom'](r),

    'Action/Api.GetUserSig': async (r: ActionReq) => {
      // IM signature in the original (Tencent IM). Our IM runs on the room
      // socket, so there is no third-party signature to mint; say so rather
      // than returning a plausible-looking string the client would then fail on.
      return { code: 1, msg: 'im_provider_not_configured', uid: s(this.uidOf(r)) };
    },
    'sq.config': async () => {
      const row = await this.prisma.config.findUnique({ where: { key: 'sq' } }).catch(() => null);
      return (row?.value as object) ?? {};
    },
  };

  /** Runs a privileged action if the caller is on the super-admin allowlist. */
  private async superAct(r: ActionReq, fn: (target: number) => Promise<any>) {
    const uid = this.uidOf(r);
    const row = await this.prisma.config.findUnique({ where: { key: 'superAdmins' } }).catch(() => null);
    const admins = (row?.value as number[]) ?? [];
    if (!admins.includes(uid)) return { code: 1, msg: 'not_permitted' };
    const target = Number(r.target_uid || r.uid || 0);
    return { code: 0, ...(await fn(target)) };
  }
}
