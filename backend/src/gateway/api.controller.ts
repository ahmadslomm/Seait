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
