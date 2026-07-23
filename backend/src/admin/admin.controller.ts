import {
  Controller, Post, Get, Put, Delete, Body, Param, Query, Req, Res,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard, adminOf } from './admin-auth.guard';
import { AdminCrudService } from './admin-crud.service';
import { AdminEconomyService } from './admin-economy.service';
import { AuditService } from './audit.service';
import { Currency } from '../modules/economy.service';

/** Public: login only. Everything else needs a token (AdminApiController). */
@Controller('admin/api')
export class AdminPublicController {
  constructor(private auth: AdminAuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    await this.auth.pruneExpired();
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    if (!username || !password) throw new BadRequestException('username_and_password_required');
    const r = await this.auth.login(username, password);
    if (!r) return { ok: false, error: 'invalid_credentials' };
    return { ok: true, token: r.token, admin: r.admin };
  }
}

/**
 * The guarded admin API. Every route requires a valid bearer token; the guard
 * attaches the operator identity, which the audit log and role checks use.
 */
@Controller('admin/api')
@UseGuards(AdminAuthGuard)
export class AdminApiController {
  /** Where uploaded art is written; served back through /assets. */
  private static readonly UPLOAD_ROOT = (() => {
    let dir = __dirname;
    for (let i = 0; i < 6; i++) {
      const a = path.join(dir, 'assets');
      if (fs.existsSync(a) && fs.statSync(a).isDirectory()) return path.join(a, 'uploads');
      dir = path.dirname(dir);
    }
    return path.resolve(__dirname, '../../../assets/uploads');
  })();

  constructor(
    private auth: AdminAuthService,
    private crud: AdminCrudService,
    private econ: AdminEconomyService,
    private audit: AuditService,
    private prisma: PrismaService,
  ) {}

  // ── session ─────────────────────────────────────────────────────────
  @Get('me')
  me(@Req() req: any) { return { admin: adminOf(req) }; }

  @Post('logout')
  async logout(@Req() req: any) { await this.auth.logout(req.adminToken); return { ok: true }; }

  @Get('menu')
  menu() { return this.crud.menu(); }

  @Get('dashboard')
  dashboard() { return this.econ.dashboard(); }

  // ── generic entity CRUD ─────────────────────────────────────────────
  @Get('entity/:key')
  list(@Param('key') key: string, @Query() q: any) {
    return this.crud.list(key, {
      q: q.q, activeOnly: q.active === '1',
      skip: Number(q.skip) || 0, take: Math.min(200, Number(q.take) || 100),
    });
  }

  @Get('entity/:key/:id')
  getOne(@Param('key') key: string, @Param('id') id: string) { return this.crud.getOne(key, id); }

  @Post('entity/:key')
  create(@Param('key') key: string, @Body() body: any, @Req() req: any) {
    return this.crud.create(key, body ?? {}, adminOf(req));
  }

  @Put('entity/:key/:id')
  update(@Param('key') key: string, @Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.crud.update(key, id, body ?? {}, adminOf(req));
  }

  @Delete('entity/:key/:id')
  remove(@Param('key') key: string, @Param('id') id: string, @Req() req: any) {
    return this.crud.remove(key, id, adminOf(req));
  }

  @Post('entity/:key/:id/toggle')
  toggle(@Param('key') key: string, @Param('id') id: string, @Req() req: any) {
    return this.crud.toggle(key, id, adminOf(req));
  }

  // ── economy ─────────────────────────────────────────────────────────
  @Get('users')
  users(@Query('q') q: string) { return this.econ.findUsers(String(q ?? '').trim()); }

  @Get('users/:uid')
  user(@Param('uid') uid: string) { return this.econ.userDetail(Number(uid)); }

  @Post('users/:uid/balance')
  adjust(@Param('uid') uid: string, @Body() body: any, @Req() req: any) {
    return this.econ.adjust(Number(uid), (body?.currency ?? 'coins') as Currency,
      Number(body?.amount), String(body?.reason ?? ''), adminOf(req));
  }

  @Post('users/:uid/vip')
  vip(@Param('uid') uid: string, @Body() body: any, @Req() req: any) {
    return this.econ.setVip(Number(uid), Number(body?.level) || 0, adminOf(req));
  }

  @Post('users/:uid/ban')
  ban(@Param('uid') uid: string, @Body() body: any, @Req() req: any) {
    return this.econ.setBan(Number(uid), body?.banned === true || body?.banned === 1, adminOf(req));
  }

  // ── asset library ───────────────────────────────────────────────────
  @Get('assets')
  async assets(@Query('kind') kind: string) {
    const where = kind ? { kind } : {};
    const rows = await this.prisma.assetFile.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
    return { list: rows.map(a => ({ id: a.id, path: a.path, kind: a.kind, name: a.name, size: a.size })) };
  }

  @Post('assets/upload')
  async upload(@Req() req: any) {
    if (!req.isMultipart || !req.isMultipart()) throw new BadRequestException('expected_multipart');
    const file = await req.file();
    if (!file) throw new BadRequestException('no_file');

    const orig = String(file.filename || 'file');
    const ext = (path.extname(orig) || '').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
    const kind = ({ '.svga': 'svga', '.pag': 'pag', '.mp4': 'mp4' } as any)[ext]
      ?? (['.png', '.webp', '.jpg', '.jpeg', '.gif'].includes(ext) ? 'image' : 'other');
    // Sub-folder by kind keeps the uploads directory browsable.
    const dir = path.join(AdminApiController.UPLOAD_ROOT, kind);
    fs.mkdirSync(dir, { recursive: true });
    const base = `${Date.now()}_${randomBytes(4).toString('hex')}${ext}`;
    const abs = path.join(dir, base);

    const buf = await file.toBuffer(); // bounded by the 25MB parser limit
    fs.writeFileSync(abs, buf);

    const rel = path.relative(path.dirname(AdminApiController.UPLOAD_ROOT), abs); // uploads/<kind>/<base>
    const admin = adminOf(req);
    const row = await this.prisma.assetFile.create({
      data: { path: rel, kind, name: orig, size: buf.length, uploadedBy: admin.id },
    });
    await this.audit.record(admin, 'upload', 'asset', row.id, { path: rel, size: buf.length });
    return { ok: true, id: row.id, path: rel, kind, size: buf.length };
  }

  // ── audit ───────────────────────────────────────────────────────────
  @Get('audit')
  async auditLog(@Query('limit') limit: string) {
    const rows = await this.audit.recent(Number(limit) || 100);
    return { list: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  }

  // ── admin roster (super only) ───────────────────────────────────────
  @Get('admins')
  async admins(@Req() req: any) {
    if (adminOf(req).role !== 'super') throw new BadRequestException('super_only');
    const rows = await this.prisma.adminUser.findMany({ orderBy: { id: 'asc' } });
    return { list: rows.map(a => ({ id: a.id, username: a.username, role: a.role, active: a.active, lastLoginAt: a.lastLoginAt })) };
  }

  @Post('admins')
  async addAdmin(@Body() body: any, @Req() req: any) {
    if (adminOf(req).role !== 'super') throw new BadRequestException('super_only');
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    if (!username || password.length < 6) throw new BadRequestException('username_and_6char_password_required');
    const role = ['super', 'admin', 'editor'].includes(body?.role) ? body.role : 'admin';
    const a = await this.auth.createAdmin(username, password, role);
    await this.audit.record(adminOf(req), 'create', 'admin', a.id, { username, role });
    return { ok: true, id: a.id };
  }
}
