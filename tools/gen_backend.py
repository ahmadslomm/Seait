import os
R="/root/Seait/backend"
def w(p,c):
    f=os.path.join(R,p); os.makedirs(os.path.dirname(f),exist_ok=True); open(f,"w").write(c.lstrip("\n"))

w("package.json","""
{
  "name": "seait-backend",
  "version": "0.1.0",
  "description": "Protocol-compatible backend for Seait (== com.waig.nalo / ZaffaLive).",
  "scripts": {
    "build": "nest build", "start": "nest start", "start:dev": "nest start --watch",
    "prisma:generate": "prisma generate", "prisma:migrate": "prisma migrate dev",
    "seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0", "@nestjs/core": "^10.3.0", "@nestjs/platform-fastify": "^10.3.0",
    "@nestjs/platform-socket.io": "^10.3.0", "@nestjs/websockets": "^10.3.0",
    "@prisma/client": "^5.14.0", "socket.io": "^4.7.5", "rxjs": "^7.8.1"
  },
  "devDependencies": { "@nestjs/cli": "^10.3.0", "prisma": "^5.14.0", "ts-node": "^10.9.2", "typescript": "^5.4.0", "@types/node": "^20.12.0" }
}
""")
w("tsconfig.json",'{ "compilerOptions": { "module":"commonjs","target":"ES2021","experimentalDecorators":true,"emitDecoratorMetadata":true,"outDir":"./dist","esModuleInterop":true,"resolveJsonModule":true,"strict":false } }\n')
w("nest-cli.json",'{ "collection":"@nestjs/schematics","sourceRoot":"src","compilerOptions":{"deleteOutDir":true} }\n')
w(".env.example","DATABASE_URL=postgresql://seait:seait@localhost:5432/seait?schema=public\nPORT=8080\nPACKAGE_NAME=com.waig.nalo\nAGORA_APP_ID=ae32cc1b085e4b27b08d3d664103b3c8\nTENCENT_IM_APPID=1721002742\n")

# ---- crypto (recovered cipher) ----
w("src/common/crypto.ts","""
import { createHash } from 'crypto';
const PKG = process.env.PACKAGE_NAME || 'com.waig.nalo';
const API_KEY = Buffer.from(createHash('md5').update(PKG).digest('hex')); // md5(pkg) as 32 ascii hex bytes
function xor(d: Buffer, k: Buffer): Buffer { const o = Buffer.allocUnsafe(d.length); for (let i=0;i<d.length;i++) o[i]=d[i]^k[i%k.length]; return o; }
export function encryptBody(json: string): string { return xor(Buffer.from(json,'utf8'), API_KEY).toString('base64'); }
export function decryptBody(b: string): string { let s=decodeURIComponent(b).replace(/_/g,'/'); while(s.length%4) s+='='; return xor(Buffer.from(s,'base64'), API_KEY).toString('utf8'); }
export const PACKAGE_NAME = PKG;
""")
# ---- envelope + sign ----
w("src/common/envelope.ts","""
export const ok  = (data:any) => ({ response_status:{ error:'' }, response_data:data });
export const err = (m:string, code=1) => ({ response_status:{ error:m, code }, response_data:false });
export interface ActionReq { action:string; token?:string; uid?:string|number; _login_uid?:number; lang?:string; ua?:string; deviceid?:string; sign?:string; timestamp?:number; [k:string]:any; }
""")
w("src/common/sign.ts","""
import { createHash } from 'crypto';
// Request signature recovered from RE (memory: md5 with key 'awgwd^1ad87'). Kept identical so the
// original client's signed requests validate and our client signs the same way.
const SIGN_KEY = 'awgwd^1ad87';
export function makeSign(params: Record<string,any>): string {
  const keys = Object.keys(params).filter(k=>k!=='sign').sort();
  const base = keys.map(k=>`${k}=${params[k]}`).join('&') + SIGN_KEY;
  return createHash('md5').update(base).digest('hex');
}
export function verifySign(params: Record<string,any>): boolean {
  if (!params.sign) return true; // tolerate during dev
  return makeSign(params) === params.sign;
}
""")
# ---- prisma provider ----
w("src/prisma/prisma.service.ts","""
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
@Injectable() export class PrismaService extends PrismaClient implements OnModuleInit { async onModuleInit(){ await this.$connect(); } }
""")
w("src/prisma/prisma.module.ts","""
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
@Global() @Module({ providers:[PrismaService], exports:[PrismaService] }) export class PrismaModule {}
""")

# ---- action router + handlers ----
w("src/gateway/action-router.ts","""
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
""")
w("src/fallback/logger.ts","""
import { Injectable, Logger } from '@nestjs/common';
import { appendFileSync } from 'fs';
/** Records any action without a native handler (known-but-TODO or truly unknown) so missing
 *  APIs surface while the app runs. Writes JSONL to unknown-apis.log. */
@Injectable()
export class UnknownActionLogger {
  private log = new Logger('UnknownAPI');
  record(action: string, req: any, known: boolean) {
    const entry = { ts: new Date().toISOString(), action, known, uid: req.uid ?? req._login_uid, keys: Object.keys(req) };
    this.log.warn(`${known?'TODO':'UNKNOWN'} action=${action} keys=${entry.keys.join(',')}`);
    try { appendFileSync('unknown-apis.log', JSON.stringify(entry)+'\\n'); } catch {}
  }
}
""")
# ---- api.php gateway controller ----
w("src/gateway/api.controller.ts","""
import { Controller, Post, Get, Req, Res } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { decryptBody, encryptBody, PACKAGE_NAME } from '../common/crypto';
import { ActionRouter } from './action-router';

/** THE api.php gateway — identical protocol to com.waig.nalo:
 *  POST /api.php  form: app_id=<pkg>&http_body=base64(XOR(json,md5(pkg)))
 *  -> decrypt -> route by action -> encrypt {response_status,response_data} back. */
@Controller()
export class ApiController {
  constructor(private router: ActionRouter) {}

  @Post('api.php') async apiPost(@Req() req: FastifyRequest, @Res() res: FastifyReply) { return this.handle(req, res, 'POST'); }
  @Get('api.php')  async apiGet (@Req() req: FastifyRequest, @Res() res: FastifyReply) { return this.handle(req, res, 'GET'); }

  // plaintext helper endpoints (match original)
  @Post('index.php') async index(@Req() req: any, @Res() res: FastifyReply) {
    const b = req.body || {}; const action = (req.query?.action) || b.action;
    if (action === 'login.checkMobile') return res.send({ response_status:{error:''}, response_data:{ exist:true, time: Math.floor(Date.now()/1000) } });
    return res.send({ response_status:{error:''}, response_data:{} });
  }

  private async handle(req: any, res: FastifyReply, method: string) {
    let httpBody: string | undefined;
    if (method === 'POST') { const raw = typeof req.body==='string'?req.body:''; for (const kv of raw.split('&')) { if (kv.startsWith('http_body=')||kv.startsWith('ver_token=')) httpBody = kv.split('=').slice(1).join('='); } if(!httpBody && req.body?.http_body) httpBody = req.body.http_body; }
    else { httpBody = (req.query?.http_body) || (req.query?.ver_token); }
    let payload: any = {};
    if (httpBody) { try { payload = JSON.parse(decryptBody(httpBody)); } catch { payload = {}; } }
    const result = await this.router.route(payload);
    const enc = encryptBody(JSON.stringify(result));
    res.header('Content-Type','text/plain').send(enc); // client base64/XOR-decodes (QxZ…)
  }
}
""")
# ---- room engine (websocket) ----
w("src/gateway/room.gateway.ts","""
import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
const LAYOUTS=[5,10,15,21,30];
type Seat={seatNo:number;uid:number|null;micState:number;speaking?:boolean;charm?:number};
@WebSocketGateway({ cors:true, namespace:'/room' })
export class RoomGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private rooms=new Map<number,{seatCount:number;seats:Seat[];members:Set<number>}>();
  private ensure(rid:number,n=10){ if(!LAYOUTS.includes(n)) n=10; let r=this.rooms.get(rid); if(!r){ r={seatCount:n,seats:Array.from({length:n},(_,i)=>({seatNo:i,uid:null,micState:0})),members:new Set()}; this.rooms.set(rid,r);} return r; }
  @SubscribeMessage('room_join') onJoin(@MessageBody() d:any,@ConnectedSocket() c:Socket){ const rm=`room_${d.rid}`; c.join(rm); (c.data as any)={rid:d.rid,uid:d.uid}; const r=this.ensure(d.rid,d.seatCount); r.members.add(d.uid); c.emit('room_state',r); this.server.to(rm).emit('user_enter',{uid:d.uid,effect:'join'}); }
  @SubscribeMessage('seat_update') onSeat(@MessageBody() d:any){ const r=this.ensure(d.rid); const s=r.seats[d.seatNo]; if(s&&!s.uid){ r.seats.forEach(x=>{if(x.uid===d.uid)x.uid=null;}); s.uid=d.uid; this.server.to(`room_${d.rid}`).emit('seat_update',s);} }
  @SubscribeMessage('mic_status') onMic(@MessageBody() d:any){ const s=this.rooms.get(d.rid)?.seats[d.seatNo]; if(s){ s.micState=d.micState; this.server.to(`room_${d.rid}`).emit('mic_status',s);} }
  @SubscribeMessage('speaking') onSpeak(@MessageBody() d:any){ this.server.to(`room_${d.rid}`).emit('speaking',d); }
  @SubscribeMessage('send_gift') onGift(@MessageBody() d:any){ this.server.to(`room_${d.rid}`).emit('gift_received',{...d,fullscreen:(d.price||0)>=5000}); }
  @SubscribeMessage('chat') onChat(@MessageBody() d:any){ this.server.to(`room_${d.rid}`).emit('chat',d); }
  handleDisconnect(c:Socket){ const {rid,uid}=(c.data as any)||{}; if(rid){ const r=this.rooms.get(rid); r?.members.delete(uid); r?.seats.forEach(s=>{if(s.uid===uid)s.uid=null;}); this.server.to(`room_${rid}`).emit('user_leave',{uid}); } }
}
""")
# ---- app module + main ----
w("src/app.module.ts","""
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ApiController } from './gateway/api.controller';
import { ActionRouter } from './gateway/action-router';
import { RoomGateway } from './gateway/room.gateway';
import { UnknownActionLogger } from './fallback/logger';
@Module({ imports:[PrismaModule], controllers:[ApiController], providers:[ActionRouter, RoomGateway, UnknownActionLogger] })
export class AppModule {}
""")
w("src/main.ts","""
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
async function bootstrap(){
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  // accept x-www-form-urlencoded + text bodies raw
  const inst:any = app.getHttpAdapter().getInstance();
  inst.addContentTypeParser('application/x-www-form-urlencoded', { parseAs:'string' }, (_r:any,b:any,d:any)=>d(null,b));
  inst.addContentTypeParser('text/plain', { parseAs:'string' }, (_r:any,b:any,d:any)=>d(null,b));
  await app.listen(process.env.PORT||8080,'0.0.0.0');
  console.log('Seait backend (api.php gateway, '+require('./actions.catalog.json')._total+' actions) on :'+(process.env.PORT||8080));
}
bootstrap();
""")
print("backend generated")
