import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';
import { EconomyService } from './economy.service';

/**
 * Mini-games and PK battles.
 *
 * The games themselves are third-party web views: the app asks us for a
 * short-lived token, then hands it to the provider's SDK. Four actions
 * (`getUidAndToken`, `...V2`, `...ByAmg`, `...ByYomi`) differ only in which
 * provider they name, so they share one issuer and pass the provider through.
 *
 * Tokens are stored with an expiry rather than being stateless, so a leaked one
 * can be revoked (`tokenDestroy`) — which is the only reason that action exists.
 */
@Injectable()
export class GameModule extends ApiModule {
  constructor(private prisma: PrismaService, private economy: EconomyService) { super(); }

  private static readonly TOKEN_TTL_MS = 30 * 60 * 1000;

  private async issueToken(uid: number, provider: string) {
    if (!uid) return { code: 1, msg: 'bad_request' };
    const token = randomBytes(24).toString('hex');
    const expireAt = new Date(Date.now() + GameModule.TOKEN_TTL_MS);
    // Replace any live token for this provider: two valid tokens for one user
    // means revoking one still leaves a way in.
    await this.prisma.gameToken.deleteMany({ where: { uid, provider } });
    await this.prisma.gameToken.create({ data: { uid, provider, token, expireAt } });
    return {
      code: 0, uid: s(uid), token, provider,
      expireAt: Math.floor(expireAt.getTime() / 1000),
      expiresIn: Math.floor(GameModule.TOKEN_TTL_MS / 1000),
    };
  }

  private async brief(uids: number[]) {
    const us = await this.prisma.user.findMany({ where: { uid: { in: uids } } });
    const by = new Map(us.map(u => [u.uid, u]));
    return uids.map(id => by.get(id)).filter(Boolean).map((u: any) => ({
      uid: s(u.uid), nick: u.nick, avatar: u.avatar, avatarFrame: u.avatarFrame,
    }));
  }

  private gameView(g: any) {
    return { game_id: g.game_id, id: g.game_id, name: g.name, icon: g.icon, url: g.url, provider: g.provider, hot: g.hot };
  }

  readonly handlers: Record<string, Handler> = {
    // ── third-party session tokens ──
    'Action/MiniGame.getUidAndToken': async (r: ActionReq) => this.issueToken(this.uidOf(r), String(r.provider ?? 'minigame')),
    'Action/MiniGame.getUidAndTokenV2': async (r: ActionReq) => this.issueToken(this.uidOf(r), String(r.provider ?? 'minigame')),
    'Action/MiniGame.getUidAndTokenByAmg': async (r: ActionReq) => this.issueToken(this.uidOf(r), 'amg'),
    'Action/MiniGame.getUidAndTokenByYomi': async (r: ActionReq) => this.issueToken(this.uidOf(r), 'yomi'),
    'Action/JoyPlay.getUidAndToken': async (r: ActionReq) => this.issueToken(this.uidOf(r), 'joyplay'),
    'Action/MiniGame.tokenDestroy': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const token = String(r.token ?? '');
      // Revoke one token if named, otherwise every token this user holds —
      // logging out should not leave a provider session alive.
      await this.prisma.gameToken.deleteMany({ where: token ? { token } : { uid } });
      return { code: 0 };
    },

    // ── catalogue ──
    'Action/Game.hotGames': async () => ({
      list: (await this.prisma.game.findMany({ where: { active: true }, orderBy: [{ hot: 'desc' }, { sort: 'asc' }] }))
        .map(g => this.gameView(g)),
    }),
    'Action/Game.hotGamesHourly': async (r: ActionReq) => this.handlers['Action/Game.hotGames'](r),

    // ── rooms / sessions ──
    'Action/Game.createGameRoom': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const gameId = Number(r.game_id || r.gameId || 0);
      if (!uid || !gameId) return { code: 1, msg: 'bad_request' };
      const roomCode = randomBytes(4).toString('hex');
      const row = await this.prisma.gameRoom.create({
        data: { game_id: gameId, owner_uid: uid, roomCode, rid: Number(r.rid || 0) || null },
      });
      return { code: 0, id: row.id, roomCode, game_id: gameId };
    },
    'Action/Game.getGameRoomId': async (r: ActionReq) => {
      const rid = Number(r.rid || 0);
      const gameId = Number(r.game_id || r.gameId || 0);
      const row = await this.prisma.gameRoom.findFirst({
        where: { status: 1, ...(rid ? { rid } : {}), ...(gameId ? { game_id: gameId } : {}) },
        orderBy: { createdAt: 'desc' },
      });
      return row ? { code: 0, id: row.id, roomCode: row.roomCode, game_id: row.game_id } : { code: 0, id: 0, roomCode: '' };
    },
    'Action/Game.getOnlinePlayers': async (r: ActionReq) => {
      const gameId = Number(r.game_id || r.gameId || 0);
      const rows = await this.prisma.gamePlayer.findMany({
        where: gameId ? { game_id: gameId } : {}, orderBy: { lastPlayedAt: 'desc' }, take: 50,
      });
      return { list: await this.brief(rows.map(x => x.uid)) };
    },
    'Action/Game.getGamerInfo': async (r: ActionReq) => {
      const uid = Number(r.target_uid || this.uidOf(r));
      const rows = await this.prisma.gamePlayer.findMany({ where: { uid } });
      const total = rows.reduce((a, b) => a + Number(b.score), 0);
      return {
        uid: s(uid), score: s(total),
        plays: rows.reduce((a, b) => a + b.plays, 0),
        wins: rows.reduce((a, b) => a + b.wins, 0),
        games: rows.map(x => ({ game_id: x.game_id, score: s(x.score), wins: x.wins, plays: x.plays })),
      };
    },
    'Action/Game.getGameRoomRank': async (r: ActionReq) => {
      const gameId = Number(r.game_id || r.gameId || 0);
      const rows = await this.prisma.gamePlayer.findMany({
        where: gameId ? { game_id: gameId } : {}, orderBy: { score: 'desc' }, take: 50,
      });
      const users = await this.brief(rows.map(x => x.uid));
      return { list: users.map((u, i) => ({ ...u, rank: i + 1, score: s(rows[i]?.score ?? 0) })) };
    },
    'Action/Game.rankingOverview': async () => {
      const rows = await this.prisma.gamePlayer.findMany({ orderBy: { score: 'desc' }, take: 10 });
      const users = await this.brief(rows.map(x => x.uid));
      return { list: users.map((u, i) => ({ ...u, rank: i + 1, score: s(rows[i]?.score ?? 0) })) };
    },

    // ── game sign-in (separate board from the app's daily sign-in) ──
    'Action/Game.getSignInTable': async (r: ActionReq) => {
      const rewards = await this.prisma.signInReward.findMany({ orderBy: { day: 'asc' } });
      return { list: rewards.map(x => ({ day: x.day, reward_type: x.reward_type, reward_num: s(x.reward_num), icon: x.icon })) };
    },
    'Action/Game.signIn': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const gameId = Number(r.game_id || r.gameId || 0) || 0;
      // Records a play and grants a small coin reward, capped once per day by
      // the same ymd uniqueness the app sign-in uses.
      const ymd = new Date().toISOString().slice(0, 10);
      const already = await this.prisma.userSignIn.findFirst({ where: { uid, ymd } });
      if (gameId) await this.prisma.gamePlayer.upsert({
        where: { game_id_uid: { game_id: gameId, uid } },
        create: { game_id: gameId, uid, plays: 1, lastPlayedAt: new Date() },
        update: { plays: { increment: 1 }, lastPlayedAt: new Date() },
      });
      if (already) return { code: 1, msg: 'already_signed' };
      await this.economy.credit(uid, 'coins', 50, 'game_signin', ymd);
      return { code: 0, reward: 50 };
    },

    // ── GameMall ──
    'Action/GameMall.getMallProduct': async () => ({
      list: (await this.prisma.mallProduct.findMany({ where: { active: true, type: 'game' } }))
        .map(p => ({ product_id: p.product_id, name: p.name, icon: p.icon, price: s(p.price), coin_type: p.coin_type })),
    }),
    'Action/GameMall.exchangeProduct': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const pid = Number(r.product_id || r.id || 0);
      const p = await this.prisma.mallProduct.findUnique({ where: { product_id: pid } });
      if (!p || !p.active) return { code: 1, msg: 'product_not_found' };
      const cur = EconomyService.currencyOf(p.coin_type);
      if (p.price > 0 && !await this.economy.debit(uid, cur, p.price, 'game_exchange', String(pid)))
        return { code: 1, msg: 'insufficient_balance' };
      await this.prisma.userProduct.upsert({
        where: { uid_product_id: { uid, product_id: pid } },
        create: { uid, product_id: pid, source: 'buy' }, update: {},
      });
      return { code: 0, product_id: pid };
    },

    'Action/LuckyDraw.drawPrizesPreview': async () => ({
      // What can be won, shown before spending. Prize pool is the catalogue
      // flagged as drawable, so it is editable from the admin panel.
      list: (await this.prisma.mallProduct.findMany({ where: { active: true, category: 9 } }))
        .map(p => ({ product_id: p.product_id, name: p.name, icon: p.icon, price: s(p.price) })),
    }),

    'Action/RadioRoomPk.rank': async (r: ActionReq) => {
      const rows = await this.prisma.pkMatch.findMany({
        where: { status: 2 }, orderBy: { endedAt: 'desc' }, take: 50,
      });
      return {
        list: rows.map(m => ({
          pk_id: m.id, rid_a: m.rid_a, rid_b: m.rid_b ?? 0,
          score_a: s(m.score_a), score_b: s(m.score_b),
          winner: Number(m.score_a) >= Number(m.score_b) ? m.rid_a : m.rid_b ?? 0,
        })),
      };
    },
  };
}

/**
 * Live PK — one room challenging another.
 *
 * A match row carries both sides and both scores; scores are the sum of gifts
 * received by each room during the window, so they are derived from GiftRecord
 * rather than being an independent counter that could disagree with the gift
 * history.
 */
@Injectable()
export class PkModule extends ApiModule {
  constructor(private prisma: PrismaService) { super(); }

  private rid(r: ActionReq) { return Number(r.rid || r.roomId || 0); }

  private async score(rid: number, from: Date | null, to: Date | null) {
    if (!from) return 0;
    const agg = await this.prisma.giftRecord.aggregate({
      where: { rid, createdAt: { gte: from, ...(to ? { lte: to } : {}) } },
      _sum: { coin_total: true },
    }).catch(() => null);
    return Number(agg?._sum.coin_total ?? 0);
  }

  private async view(m: any) {
    const [a, b] = await Promise.all([
      this.score(m.rid_a, m.startedAt, m.endedAt),
      m.rid_b ? this.score(m.rid_b, m.startedAt, m.endedAt) : Promise.resolve(0),
    ]);
    const elapsed = m.startedAt ? Math.floor((Date.now() - m.startedAt.getTime()) / 1000) : 0;
    return {
      pk_id: m.id, id: m.id, status: m.status,
      rid_a: m.rid_a, rid_b: m.rid_b ?? 0,
      score_a: s(a), score_b: s(b),
      duration: m.duration,
      remain: m.status === 1 ? Math.max(0, m.duration - elapsed) : 0,
      startedAt: m.startedAt ? Math.floor(m.startedAt.getTime() / 1000) : 0,
    };
  }

  readonly handlers: Record<string, Handler> = {
    'Action/LivePk.invitePk': async (r: ActionReq) => {
      const rid = this.rid(r);
      const target = Number(r.target_rid || r.toRid || 0);
      if (!rid || !target) return { code: 1, msg: 'bad_request' };
      if (rid === target) return { code: 1, msg: 'cannot_pk_self' };
      const m = await this.prisma.pkMatch.create({
        data: { rid_a: rid, rid_b: target, status: 0, duration: Number(r.duration || 300) || 300 },
      });
      const room = await this.prisma.room.findUnique({ where: { rid: target } });
      if (room) await this.prisma.notice.create({
        data: { uid: room.owner_uid, type: 'system', title: 'pk_invite', body: String(m.id) },
      }).catch(() => null);
      return { code: 0, ...(await this.view(m)) };
    },
    'Action/LivePk.acceptPk': async (r: ActionReq) => {
      const id = Number(r.pk_id || r.id || 0);
      const m = await this.prisma.pkMatch.findUnique({ where: { id } });
      if (!m || m.status !== 0) return { code: 1, msg: 'pk_not_pending' };
      const started = await this.prisma.pkMatch.update({
        where: { id }, data: { status: 1, startedAt: new Date() },
      });
      return { code: 0, ...(await this.view(started)) };
    },
    'Action/LivePk.refusePk': async (r: ActionReq) => {
      const id = Number(r.pk_id || r.id || 0);
      await this.prisma.pkMatch.updateMany({ where: { id, status: 0 }, data: { status: 3 } });
      return { code: 0 };
    },
    'Action/LivePk.breakOffPk': async (r: ActionReq) => {
      const id = Number(r.pk_id || r.id || 0);
      const rid = this.rid(r);
      await this.prisma.pkMatch.updateMany({
        where: id ? { id } : { rid_a: rid, status: 1 },
        data: { status: 2, endedAt: new Date() },
      });
      return { code: 0 };
    },
    'Action/LivePk.cancelPkMatch': async (r: ActionReq) => {
      const rid = this.rid(r);
      await this.prisma.pkMatch.updateMany({ where: { rid_a: rid, status: 0 }, data: { status: 4 } });
      return { code: 0 };
    },
    'Action/LivePk.startLivePk': async (r: ActionReq) => {
      const rid = this.rid(r);
      const m = await this.prisma.pkMatch.create({
        data: { rid_a: rid, status: 1, startedAt: new Date(), duration: Number(r.duration || 300) || 300 },
      });
      return { code: 0, ...(await this.view(m)) };
    },
    'Action/LivePk.matchLivePk': async (r: ActionReq) => {
      // Find someone already waiting; otherwise wait to be found.
      const rid = this.rid(r);
      const waiting = await this.prisma.pkMatch.findFirst({
        where: { status: 0, rid_b: null, rid_a: { not: rid } }, orderBy: { createdAt: 'asc' },
      });
      if (waiting) {
        const m = await this.prisma.pkMatch.update({
          where: { id: waiting.id }, data: { rid_b: rid, status: 1, startedAt: new Date() },
        });
        return { code: 0, matched: 1, ...(await this.view(m)) };
      }
      const m = await this.prisma.pkMatch.create({ data: { rid_a: rid, status: 0 } });
      return { code: 0, matched: 0, ...(await this.view(m)) };
    },
    'Action/LivePk.getPkInfo': async (r: ActionReq) => {
      const id = Number(r.pk_id || r.id || 0);
      const rid = this.rid(r);
      const m = id
        ? await this.prisma.pkMatch.findUnique({ where: { id } })
        : await this.prisma.pkMatch.findFirst({
            where: { OR: [{ rid_a: rid }, { rid_b: rid }], status: { in: [0, 1] } },
            orderBy: { createdAt: 'desc' },
          });
      return m ? await this.view(m) : { pk_id: 0, status: -1 };
    },
    'Action/LivePk.recently': async (r: ActionReq) => {
      const rid = this.rid(r);
      const rows = await this.prisma.pkMatch.findMany({
        where: { OR: [{ rid_a: rid }, { rid_b: rid }], status: 2 },
        orderBy: { endedAt: 'desc' }, take: 20,
      });
      return { list: await Promise.all(rows.map(m => this.view(m))) };
    },
    'Action/LivePk.friendList': async (r: ActionReq) => {
      // Rooms you can challenge: hosts you follow who have a live room.
      const uid = this.uidOf(r);
      const follows = await this.prisma.friend.findMany({ where: { uid, type: 'follow' } });
      const rooms = await this.prisma.room.findMany({
        where: { status: 1, owner_uid: { in: follows.map(f => f.target_uid) } },
      });
      const owners = await this.prisma.user.findMany({ where: { uid: { in: rooms.map(x => x.owner_uid) } } });
      const by = new Map(owners.map(o => [o.uid, o]));
      return {
        list: rooms.map(x => ({
          rid: x.rid, roomName: x.name, cover: x.cover, onlineNum: x.onlineNum,
          owner_uid: s(x.owner_uid), owner_nick: by.get(x.owner_uid)?.nick ?? '',
        })),
      };
    },
  };
}
