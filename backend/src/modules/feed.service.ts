import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';

/**
 * The social feed: moments, their comments, topics, and drift bottles.
 *
 * Comments are one table for three things the original app lists separately —
 * comments on a moment, comments on a bottle, and replies to a comment. They
 * differ by `target_type`/`parent_id`, not by shape, so `commentCommentList`
 * and `bottleCommentList` are the same query with a different filter.
 */
@Injectable()
export class FeedModule extends ApiModule {
  constructor(private prisma: PrismaService) { super(); }

  private async authors(uids: number[]) {
    const us = await this.prisma.user.findMany({ where: { uid: { in: [...new Set(uids)] } } });
    return new Map(us.map(u => [u.uid, u]));
  }

  private momentView(m: any, u: any, liked = false) {
    return {
      id: m.id, moment_id: m.id,
      uid: s(m.uid), nick: u?.nick ?? '', avatar: u?.avatar ?? '', avatarFrame: u?.avatarFrame ?? '',
      noble_level: u?.noble_level ?? 0,
      text: m.text, content: m.text,
      images: m.images ?? [],
      songId: m.songId ?? 0, topicId: m.topicId ?? 0,
      likes: s(m.likes), comments: s(m.comments), views: s(m.views),
      isLike: liked ? 1 : 0,
      time: Math.floor(m.createdAt.getTime() / 1000),
    };
  }

  private async listMoments(r: ActionReq, where: any = {}) {
    const uid = this.uidOf(r);
    const { skip, take } = this.page(r, 20);
    const rows = await this.prisma.moment.findMany({
      where: { status: 1, ...where }, orderBy: { createdAt: 'desc' }, skip, take,
    });
    const [by, likes] = await Promise.all([
      this.authors(rows.map(x => x.uid)),
      this.prisma.momentLike.findMany({ where: { uid, moment_id: { in: rows.map(x => x.id) } } }),
    ]);
    const likedIds = new Set(likes.map(l => l.moment_id));
    return { list: rows.map(m => this.momentView(m, by.get(m.uid), likedIds.has(m.id))) };
  }

  private commentView(c: any, u: any) {
    return {
      id: c.id, comment_id: c.id,
      uid: s(c.uid), nick: u?.nick ?? '', avatar: u?.avatar ?? '',
      text: c.text, content: c.text,
      praises: s(c.praises), parent_id: c.parent_id ?? 0,
      time: Math.floor(c.createdAt.getTime() / 1000),
    };
  }

  private async listComments(targetType: string, targetId: number, parentId: number | null, r: ActionReq) {
    const { skip, take } = this.page(r, 20);
    const rows = await this.prisma.comment.findMany({
      where: {
        status: 1,
        ...(parentId ? { parent_id: parentId } : { target_type: targetType, target_id: targetId, parent_id: null }),
      },
      orderBy: { createdAt: 'desc' }, skip, take,
    });
    const by = await this.authors(rows.map(x => x.uid));
    return { list: rows.map(c => this.commentView(c, by.get(c.uid))) };
  }

  private bottleView(b: any, u: any, liked = false) {
    return {
      id: b.id, bottle_id: b.id, song_id: b.id,
      uid: s(b.uid), nick: u?.nick ?? '', avatar: u?.avatar ?? '',
      url: b.url, cover: b.cover, title: b.title, duration: b.duration,
      likes: s(b.likes), plays: s(b.plays),
      censor: b.censor, isLike: liked ? 1 : 0,
      time: Math.floor(b.createdAt.getTime() / 1000),
    };
  }

  readonly handlers: Record<string, Handler> = {
    // ── moments ──
    // recomV3 is the name the current app sends; recomV the older one. Both are
    // the same recommended feed — aliased so the live client reaches real data
    // (it previously hit an empty gateway stub of this name).
    'moment.recomV3': async (r: ActionReq) => this.listMoments(r),
    'moment.recomV': async (r: ActionReq) => this.listMoments(r),
    'moment.history': async (r: ActionReq) => this.listMoments(r, { uid: Number(r.target_uid || this.uidOf(r)) }),
    'moment.hasHistory': async (r: ActionReq) => {
      const n = await this.prisma.moment.count({ where: { uid: Number(r.target_uid || this.uidOf(r)), status: 1 } });
      return { has: n > 0 ? 1 : 0, num: s(n) };
    },
    'moment.follow': async (r: ActionReq) => {
      // The feed filtered to people you follow.
      const uid = this.uidOf(r);
      const f = await this.prisma.friend.findMany({ where: { uid, type: 'follow' } });
      return this.listMoments(r, { uid: { in: f.map(x => x.target_uid) } });
    },
    'moment.topic': async (r: ActionReq) => {
      const topicId = Number(r.topicId || r.topic_id || r.id || 0);
      return topicId ? this.listMoments(r, { topicId }) : this.listMoments(r);
    },
    'moment.song': async (r: ActionReq) => this.listMoments(r, { songId: { not: null } }),
    'moment.browseUsids': async (r: ActionReq) => {
      // Record and report who viewed a moment.
      const uid = this.uidOf(r);
      const id = Number(r.moment_id || r.id || 0);
      if (id && uid) {
        const created = await this.prisma.momentView.upsert({
          where: { moment_id_uid: { moment_id: id, uid } },
          create: { moment_id: id, uid }, update: {},
        }).then(() => true).catch(() => false);
        if (created) await this.prisma.moment.update({
          where: { id }, data: { views: { increment: 1 } },
        }).catch(() => null);
      }
      const views = await this.prisma.momentView.findMany({ where: { moment_id: id }, take: 50 });
      const by = await this.authors(views.map(v => v.uid));
      return {
        list: views.map(v => {
          const u = by.get(v.uid);
          return { uid: s(v.uid), nick: u?.nick ?? '', avatar: u?.avatar ?? '' };
        }),
      };
    },
    'moment.getPublicSongTxt': async () => {
      // Canned phrases the composer offers. Stored as config so they are
      // editable without a release, and empty rather than invented if unset.
      const row = await this.prisma.config.findUnique({ where: { key: 'momentSongTxt' } }).catch(() => null);
      return { list: (row?.value as string[]) ?? [] };
    },

    // ── topics ──
    'feedTopic.recomList': async () => ({
      list: (await this.prisma.feedTopic.findMany({ where: { active: true }, orderBy: [{ hot: 'desc' }, { sort: 'asc' }], take: 20 }))
        .map(t => ({ id: t.id, name: t.name, cover: t.cover, desc: t.desc, hot: s(t.hot) })),
    }),
    'feedTopic.selectList': async (r: ActionReq) => this.handlers['feedTopic.recomList'](r),
    'feedTopic.info': async (r: ActionReq) => {
      const id = Number(r.id || r.topicId || 0);
      const t = await this.prisma.feedTopic.findUnique({ where: { id } });
      if (!t) return {};
      const num = await this.prisma.moment.count({ where: { topicId: id, status: 1 } });
      return { id: t.id, name: t.name, cover: t.cover, desc: t.desc, hot: s(t.hot), moments: s(num) };
    },
    'feedTopic.newUsong': async (r: ActionReq) => {
      const rows = await this.prisma.bottle.findMany({
        where: { status: 1, censor: 1 }, orderBy: { createdAt: 'desc' }, take: 20,
      });
      const by = await this.authors(rows.map(x => x.uid));
      return { list: rows.map(b => this.bottleView(b, by.get(b.uid))) };
    },

    // ── comments ──
    'comment.addComment': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const text = String(r.text ?? r.content ?? '').trim();
      if (!uid || !text) return { code: 1, msg: 'bad_request' };
      const parentId = Number(r.parent_id || r.comment_id || 0) || null;
      const targetType = String(r.target_type ?? (r.bottle_id ? 'bottle' : 'moment'));
      const targetId = Number(r.target_id || r.moment_id || r.bottle_id || 0);
      if (!parentId && !targetId) return { code: 1, msg: 'no_target' };
      const c = await this.prisma.comment.create({
        data: { uid, text, parent_id: parentId, target_type: parentId ? 'comment' : targetType, target_id: targetId },
      });
      if (!parentId && targetType === 'moment' && targetId)
        await this.prisma.moment.update({ where: { id: targetId }, data: { comments: { increment: 1 } } }).catch(() => null);
      const u = await this.prisma.user.findUnique({ where: { uid } });
      return { code: 0, ...this.commentView(c, u) };
    },
    'comment.delMyComment': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const id = Number(r.comment_id || r.id || 0);
      const c = await this.prisma.comment.findUnique({ where: { id } });
      if (!c) return { code: 1, msg: 'not_found' };
      if (c.uid !== uid) return { code: 1, msg: 'not_permitted' };
      await this.prisma.comment.update({ where: { id }, data: { status: 0 } });
      if (c.target_type === 'moment' && c.target_id)
        await this.prisma.moment.update({ where: { id: c.target_id }, data: { comments: { decrement: 1 } } }).catch(() => null);
      return { code: 0 };
    },
    'comment.commentCommentList': async (r: ActionReq) =>
      this.listComments('comment', 0, Number(r.comment_id || r.parent_id || r.id || 0), r),
    'comment.bottleCommentList': async (r: ActionReq) =>
      this.listComments('bottle', Number(r.bottle_id || r.song_id || r.id || 0), null, r),
    'comment.praiseComment': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const id = Number(r.comment_id || r.id || 0);
      try {
        await this.prisma.commentPraise.create({ data: { comment_id: id, uid } });
        await this.prisma.comment.update({ where: { id }, data: { praises: { increment: 1 } } });
      } catch { return { code: 0, already: 1 }; }
      return { code: 0 };
    },
    'comment.unpraiseComment': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const id = Number(r.comment_id || r.id || 0);
      const del = await this.prisma.commentPraise.deleteMany({ where: { comment_id: id, uid } });
      if (del.count) await this.prisma.comment.update({ where: { id }, data: { praises: { decrement: 1 } } }).catch(() => null);
      return { code: 0 };
    },
    'comment.bottleInfoNew': async (r: ActionReq) => {
      const id = Number(r.bottle_id || r.song_id || r.id || 0);
      const b = await this.prisma.bottle.findUnique({ where: { id } });
      if (!b) return {};
      const u = await this.prisma.user.findUnique({ where: { uid: b.uid } });
      const liked = !!await this.prisma.bottleLike.findFirst({ where: { bottle_id: id, uid: this.uidOf(r) } });
      const comments = await this.prisma.comment.count({ where: { target_type: 'bottle', target_id: id, status: 1 } });
      return { ...this.bottleView(b, u, liked), comments: s(comments) };
    },

    // ── bottles ──
    'bottle.uploadSong': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const url = String(r.url ?? r.song ?? '');
      if (!uid || !url) return { code: 1, msg: 'bad_request' };
      const b = await this.prisma.bottle.create({
        data: {
          uid, url, cover: String(r.cover ?? ''), title: String(r.title ?? ''),
          duration: Number(r.duration || 0) || 0,
          censor: 0, // uploads start unreviewed, matching getUserCensorSongs
        },
      });
      return { code: 0, id: b.id, censor: b.censor };
    },
    'bottle.getUserTimelineExNew': async (r: ActionReq) => {
      const uid = Number(r.target_uid || this.uidOf(r));
      const { skip, take } = this.page(r);
      const rows = await this.prisma.bottle.findMany({
        where: { uid, status: 1 }, orderBy: { createdAt: 'desc' }, skip, take,
      });
      const u = await this.prisma.user.findUnique({ where: { uid } });
      return { list: rows.map(b => this.bottleView(b, u)) };
    },
    'bottle.getUserCensorSongs': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const rows = await this.prisma.bottle.findMany({ where: { uid, censor: 0 }, orderBy: { createdAt: 'desc' } });
      const u = await this.prisma.user.findUnique({ where: { uid } });
      return { list: rows.map(b => this.bottleView(b, u)) };
    },
    'bottle.getCensorIngUSongCnt': async (r: ActionReq) => {
      const n = await this.prisma.bottle.count({ where: { uid: this.uidOf(r), censor: 0 } });
      return { num: s(n), count: s(n) };
    },
    'bottle.deleteSong': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const id = Number(r.id || r.song_id || r.bottle_id || 0);
      const b = await this.prisma.bottle.findUnique({ where: { id } });
      if (!b) return { code: 1, msg: 'not_found' };
      if (b.uid !== uid) return { code: 1, msg: 'not_permitted' };
      await this.prisma.bottle.update({ where: { id }, data: { status: 0 } });
      return { code: 0 };
    },
    'bottle.deleteCensorSong': async (r: ActionReq) => this.handlers['bottle.deleteSong'](r),
    'bottle.likeBottle': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const id = Number(r.bottle_id || r.id || r.song_id || 0);
      try {
        await this.prisma.bottleLike.create({ data: { bottle_id: id, uid } });
        await this.prisma.bottle.update({ where: { id }, data: { likes: { increment: 1 } } });
      } catch { return { code: 0, already: 1 }; }
      return { code: 0 };
    },
    'bottle.unlikeBottle': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const id = Number(r.bottle_id || r.id || r.song_id || 0);
      const del = await this.prisma.bottleLike.deleteMany({ where: { bottle_id: id, uid } });
      if (del.count) await this.prisma.bottle.update({ where: { id }, data: { likes: { decrement: 1 } } }).catch(() => null);
      return { code: 0 };
    },
    'bottle.getLikeBottleList': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const likes = await this.prisma.bottleLike.findMany({ where: { uid }, orderBy: { createdAt: 'desc' }, take: 50 });
      const rows = await this.prisma.bottle.findMany({ where: { id: { in: likes.map(l => l.bottle_id) }, status: 1 } });
      const by = await this.authors(rows.map(x => x.uid));
      return { list: rows.map(b => this.bottleView(b, by.get(b.uid), true)) };
    },
    'bottle.playFinish': async (r: ActionReq) => {
      const id = Number(r.bottle_id || r.id || r.song_id || 0);
      if (id) await this.prisma.bottle.update({ where: { id }, data: { plays: { increment: 1 } } }).catch(() => null);
      return { code: 0 };
    },
  };
}
