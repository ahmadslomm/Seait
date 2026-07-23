import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ok, err, ActionReq } from '../common/envelope';
import catalog from '../actions.catalog.json';
import { RtcService } from '../rtc/rtc.service';
import { UnknownActionLogger } from '../fallback/logger';
import { RoomGateway } from './room.gateway';
import { ApiModule } from '../modules/module.base';
import { UserModule, RoomModule, WalletModule, MallModule, TaskModule, NoticeModule,
         ActivityModule, SearchModule, MedalModule, AgencyModule, ThemeModule } from '../modules';

/** Routes an api.php `action` to its handler. Implemented handlers return real data;
 *  everything else is logged (fallback) so missing APIs surface at runtime. */
@Injectable()
export class ActionRouter {
  private log = new Logger('ActionRouter');
  constructor(
    private prisma: PrismaService, private unknown: UnknownActionLogger,
    private rtc: RtcService, private roomGw: RoomGateway,
    user: UserModule, room: RoomModule, wallet: WalletModule, mall: MallModule,
    task: TaskModule, notice: NoticeModule, activity: ActivityModule,
    search: SearchModule, medal: MedalModule, agency: AgencyModule, theme: ThemeModule,
  ) {
    // Domain modules own their actions; the router only dispatches. Merged once
    // at construction so lookup stays a single map read per request.
    //
    // The gateway's own `handlers` win on a clash: a domain module must not be
    // able to silently take over an action the gateway already answers. A clash
    // is a mistake worth seeing, so it is logged rather than resolved quietly.
    const mods: ApiModule[] = [user, room, wallet, mall, task, notice, activity, search, medal, agency, theme];
    for (const m of mods) {
      for (const [action, fn] of Object.entries(m.handlers)) {
        if (this.moduleHandlers[action])
          this.log.warn(`duplicate handler for ${action} in ${m.constructor.name}`);
        // The gateway wins the dispatch, so a module action with the same name
        // never runs. That is almost always an old gateway stub left behind
        // after the real implementation moved into a module — silence here cost
        // one debugging round already, so it is loud.
        if ((this.handlers as any)[action])
          this.log.warn(`${m.constructor.name}.${action} is SHADOWED by a gateway handler and will never run`);
        this.moduleHandlers[action] = fn;
      }
    }
    this.log.log(`${Object.keys(this.moduleHandlers).length} module actions + ${Object.keys(this.handlers).length} gateway actions`);
  }

  /** Actions contributed by the domain modules. */
  private moduleHandlers: Record<string, (r: ActionReq) => Promise<any>> = {};

  /** Every action this backend answers — used by tests and the coverage report. */
  get implementedActions(): string[] {
    return [...new Set([...Object.keys(this.handlers), ...Object.keys(this.moduleHandlers)])].sort();
  }
  readonly total = (catalog as any)._total;

  async route(req: ActionReq): Promise<any> {
    const a = req.action || '';
    const h = (this.handlers as any)[a];
    if (h) return h.call(this, req);
    const m = this.moduleHandlers[a];
    // Module handlers return response_data directly; wrap it in the envelope
    // here so no domain module has to know the envelope shape.
    if (m) return ok(await m(req));
    // known-but-unimplemented vs truly-unknown
    const known = !!(catalog as any).actions[a];
    this.unknown.record(a, req, known);
    return ok(known ? {} : null); // don't break the client; empty response_data
  }

  handlers: Record<string, (r: ActionReq)=>Promise<any>> = {
    'preArea.getServer': async () => ok([await this.cfg('server')]),
    'app.getConfigV2':   async () => ok({ value: 0 }),
    // assetBase is merged in rather than stored per-row: every catalogue path in
    // the DB is relative, and this is what the client joins them to. Keeping it
    // here means switching to a CDN is one Config row, not a data migration.
    'app.getConfig':     async () => ok({
      ...((await this.cfg('appConfig')) as object ?? {}),
      assetBase: (await this.cfg('assetBase')) ?? '/assets/',
    }),
    'app.commonConfig':  async () => ok(await this.cfg('common') ?? {}),
    'report.getReportConfig': async () => ok({ http_reportFeq:300, http_reportCnt:10, notReportFiles:[], ping_domain:[], roomImReportTimeout:5000,
        http_reportAction:['user.getUserinfo','user.batchGetUserinfoV2','room.getRecommendRoomV2','moment.recomV3'] }),
    'user.getUserinfo': async (r) => { const uid = Number(r.uid || r._login_uid || 1278472); return ok(await this.userInfo(uid)); },
    'user.batchGetUserinfoV2': async (r) => ok([await this.userInfo(Number(r._login_uid||1278472))]),
    'room.getRecommendRoomV2': async () => ok({ list: await this.rooms() }),
    'room.batchGetRoomInfos':  async () => ok(await this.rooms()),
    'gift.getGiftList':        async () => ok(await this.prisma.gift.findMany({ where:{ active:true } })),
    // RTC credentials. `publisher` is decided by the CALLER's seat state on the
    // server side, so a listener can never be handed a publisher token.
    'rtc.getToken':            async (p:any) => {
      const rid = Number(p?.rid || 0);
      const uid = Number(p?.uid || p?._login_uid || 0);
      if (!rid || !uid) return ok({ error:'rid_and_uid_required' });
      // Seats live in the room gateway's memory, not the DB — a user who sits
      // down over the socket never appears in prisma.seat. Asking the DB alone
      // meant every non-owner got a subscriber token and could never speak, no
      // matter which seat they took. The DB is still consulted as a fallback
      // for seats seeded outside the socket path.
      const room = await this.prisma.room.findUnique({ where:{ rid } }).catch(()=>null);
      const seated = this.roomGw.isSeated(rid, uid)
        || !!(await this.prisma.seat.findFirst({ where:{ rid, uid } }).catch(()=>null));
      const publisher = seated || room?.owner_uid === uid;
      return ok(this.rtc.issue(rid, uid, publisher));
    },
    'gift.getCommonGift':      async () => ok(await this.prisma.gift.findMany({ where:{ active:true }, take:8 })),
    // Moments have no table yet, so the feed is genuinely empty rather than
    // stubbed. Left here deliberately: removing it would send the action to the
    // unknown-action logger and make a working-but-empty screen look broken.
    // Tracked as remaining work in docs/API_INVENTORY.md.
    'moment.recomV3':          async () => ok({ list:[] }),
    'gift.songGiftRank':       async () => ok(await this.rank('gift')),
    'couple.cpRank':           async () => ok(await this.rank('cp')),
  };

  private async cfg(key:string){ const c = await this.prisma.config.findUnique({ where:{ key } }); return c?.value; }
  private async userInfo(uid:number){
    const u = await this.prisma.user.findUnique({ where:{ uid }, include:{ profile:true, wallet:true, vip:true } });
    if (!u) return {};
    const p = u.profile; const w:any = u.wallet; const cp = await this.prisma.cp.findFirst({ where:{ uid } });
    // BUGFIX: guild membership was seeded and modelled but never surfaced, so the
    // Guild screen always rendered "No guild" despite the user being in one.
    const gm = await this.prisma.guildMember.findFirst({ where:{ uid }, include:{ guild:true } });
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
      guild_info: gm?.guild ? {
        guild_id: gm.guild.guild_id, name: gm.guild.name, avatar: gm.guild.avatar,
        owner_uid: gm.guild.owner_uid, anchorNum: gm.guild.anchorNum,
        income: String(gm.income), joinedAt: gm.joinedAt,
      } : {},
    };
  }
  private async rooms(){ const rs = await this.prisma.room.findMany({ where:{ status:1 }, take:20 });
    return rs.map(r=>({ rid:r.rid, roomName:r.name, roomType:r.roomType, cover:r.cover, onlineNum:r.onlineNum, seatCount:r.seatCount, owner_uid:r.owner_uid, roomLevel:r.roomLevel })); }
  private async rank(t:string){ const rk = await this.prisma.ranking.findMany({ where:{ rank_type:t, period:'total' }, orderBy:{ rank:'asc' }, take:50 }); return rk.map(x=>({ uid:x.uid, score:Number(x.score), rank:x.rank })); }
}
