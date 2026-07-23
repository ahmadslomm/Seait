import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionReq } from '../common/envelope';
import { ApiModule, Handler, s } from './module.base';

/**
 * Notices — the red dots on the Message tab.
 *
 * `notice.checkNotice` is the single most-called action in the capture after
 * the room list (9,364 calls in one session): the client polls it constantly,
 * which is why an empty response was so visible. It returns UNREAD COUNTS per
 * category, not the notices themselves.
 */
@Injectable()
export class NoticeModule extends ApiModule {
  constructor(private prisma: PrismaService) { super(); }

  private async counts(uid: number) {
    const rows = await this.prisma.notice.groupBy({
      by: ['type'], where: { uid, read: false }, _count: { _all: true },
    }).catch(() => [] as any[]);
    const by: Record<string, number> = {};
    for (const r of rows as any[]) by[r.type] = r._count._all;
    return by;
  }

  readonly handlers: Record<string, Handler> = {
    'notice.checkNotice': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const by = await this.counts(uid);
      const total = Object.values(by).reduce((a, b) => a + b, 0);
      // The client reads each counter independently and shows a dot when > 0.
      return {
        total: s(total),
        sysNum: s(by.system ?? 0),
        giftNum: s(by.gift ?? 0),
        fansNum: s(by.follow ?? 0),
        guildNum: s(by.guild ?? 0),
        actNum: s(by.activity ?? 0),
        imNum: s(0), // IM lives on the socket, not here
        hasNew: total > 0 ? 1 : 0,
      };
    },

    'notice.clearNoticeAndImCount': async (r: ActionReq) => {
      const uid = this.uidOf(r);
      const type = r.type ? String(r.type) : null;
      await this.prisma.notice.updateMany({
        where: { uid, read: false, ...(type ? { type } : {}) },
        data: { read: true },
      }).catch(() => null);
      return { ...(await this.counts(uid)), cleared: 1 };
    },
  };
}
