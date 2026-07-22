import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ok, err, ActionReq } from '../common/envelope';
import catalog from '../actions.catalog.json';
import { UnknownActionLogger } from '../fallback/logger';

/** Routes an api.php `action` to its handler. Implemented handlers return real data;
 *  everything else is logged (fallback) so missing APIs surface at runtime. */
@Injectable()
export class ActionRouter {
  private log = new Logger('ActionRouter');
  constructor(private prisma: PrismaService, private unknown: UnknownActionLogger) {}
  readonly total = (catalog as any)._total;

  async route(req: ActionReq): Promise<any> {
    const a = req.action || '';
    const h = (this.handlers as any)[a];
    if (h) return h.call(this, req);
    // known-but-unimplemented vs truly-unknown
    const known = !!(catalog as any).actions[a];
    this.unknown.record(a, req, known);
    return ok(known ? {} : null); // don't break the client; empty response_data
  }

  handlers: Record<string, (r: ActionReq)=>Promise<any>> = {
    'preArea.getServer': async () => ok([await this.cfg('server')]),
    'app.getConfigV2':   async () => ok({ value: 0 }),
    'app.getConfig':     async () => ok(await this.cfg('appConfig') ?? {}),
    'app.commonConfig':  async () => ok(await this.cfg('common') ?? {}),
    'report.getReportConfig': async () => ok({ http_reportFeq:300, http_reportCnt:10, notReportFiles:[], ping_domain:[], roomImReportTimeout:5000,
        http_reportAction:['user.getUserinfo','user.batchGetUserinfoV2','room.getRecommendRoomV2','moment.recomV3'] }),
    'user.getUserinfo': async (r) => { const uid = Number(r.uid || r._login_uid || 1278472); return ok(await this.userInfo(uid)); },
    'user.batchGetUserinfoV2': async (r) => ok([await this.userInfo(Number(r._login_uid||1278472))]),
    'room.getRecommendRoomV2': async () => ok({ list: await this.rooms() }),
    'room.batchGetRoomInfos':  async () => ok(await this.rooms()),
    'gift.getGiftList':        async () => ok(await this.prisma.gift.findMany({ where:{ active:true } })),
    'gift.getCommonGift':      async () => ok(await this.prisma.gift.findMany({ where:{ active:true }, take:8 })),
    'mall.getMallProductV2':   async () => ok([]),
    'moment.recomV3':          async () => ok({ list:[] }),
    'gift.songGiftRank':       async () => ok(await this.rank('gift')),
    'couple.cpRank':           async () => ok(await this.rank('cp')),
  };

  private async cfg(key:string){ const c = await this.prisma.config.findUnique({ where:{ key } }); return c?.value; }
  private async userInfo(uid:number){
    const u = await this.prisma.user.findUnique({ where:{ uid }, include:{ profile:true, wallet:true, vip:true } });
    if (!u) return {};
    const p = u.profile; const w:any = u.wallet; const cp = await this.prisma.cp.findFirst({ where:{ uid } });
    const wealth = await this.prisma.wealth.findUnique({ where:{ uid } });
    return {
      uid: String(u.uid), mobile: u.mobile, nick: u.nick, sex: String(u.sex), sign: u.sign, avatar: u.avatar,
      birthday: u.birthday, country: u.country, region: u.region, lang: u.lang, age: String(u.age),
      avatarFrame: u.avatarFrame, carFrame: u.carFrame, chatBubble: u.chatBubble, infoBgImg: u.infoBgImg,
      constellation: u.constellation, isAnchor: u.isAnchor, isPresident: u.isPresident, noble_level: u.noble_level,
      active_level: u.active_level, gameLv: u.gameLv, svip: u.svip, isBanned: u.isBanned, nationalFlag: p?.nationalFlag,
      coins: String(w?.coins ?? 0), diamonds: String(w?.diamonds ?? 0), gold: String(w?.gold ?? 0),
      fans: String(p?.fans ?? 0), subs: String(p?.subs ?? 0), gifts: String(p?.gifts ?? 0), beans: String(w?.beans ?? 0),
      photos: String(p?.photos ?? 0), songs: String(p?.songs ?? 0), days: String(p?.days ?? 0), cost: String(p?.cost ?? 0),
      levelName: p?.levelName, medal: p?.medals ?? [], user_label: p?.user_label ?? [], actTitles: p?.actTitles ?? [],
      supporters: p?.supporters ?? [], supporters_num: p?.supporters_num ?? 0,
      wealthLv: wealth?.wealthLv ?? 0, wealthExp: Number(wealth?.wealthExp ?? 0), charmLv: wealth?.charmLv ?? 0, charm: String(wealth?.charm ?? 0),
      cp_info: cp ? { hasCp: cp.hasCp, sweet_value: String(cp.sweet_value), days: cp.days, cp_lv: cp.cp_lv, target_uinfo:{ uid: cp.target_uid } } : { hasCp:0 },
    };
  }
  private async rooms(){ const rs = await this.prisma.room.findMany({ where:{ status:1 }, take:20 });
    return rs.map(r=>({ rid:r.rid, roomName:r.name, roomType:r.roomType, cover:r.cover, onlineNum:r.onlineNum, seatCount:r.seatCount, owner_uid:r.owner_uid, roomLevel:r.roomLevel })); }
  private async rank(t:string){ const rk = await this.prisma.ranking.findMany({ where:{ rank_type:t, period:'total' }, orderBy:{ rank:'asc' }, take:50 }); return rk.map(x=>({ uid:x.uid, score:Number(x.score), rank:x.rank })); }
}
