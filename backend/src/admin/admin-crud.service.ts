import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { AdminAuthService, AdminIdentity } from './admin-auth.service';
import { ENTITY_BY_KEY, EntityDef, FieldDef } from './admin.registry';

/**
 * One generic implementation of list/get/create/update/delete/toggle for every
 * registered entity. Safety comes from the registry: only declared fields are
 * writable, each is coerced to its declared type, and a fixed-type view (e.g.
 * "VIP Frames" = MallProduct type=frame) always injects and filters on its type
 * so one section can never read or write another's rows.
 */
@Injectable()
export class AdminCrudService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private entity(key: string): EntityDef {
    const e = ENTITY_BY_KEY[key];
    if (!e) throw new NotFoundException('unknown_entity');
    return e;
  }

  private delegate(e: EntityDef): any {
    const d = (this.prisma as any)[e.model];
    if (!d) throw new BadRequestException('bad_model');
    return d;
  }

  /** Serialise a row for JSON: BigInt -> string, Date -> ISO. */
  private out(row: any): any {
    if (row === null || row === undefined) return row;
    if (typeof row === 'bigint') return row.toString();
    if (row instanceof Date) return row.toISOString();
    if (Array.isArray(row)) return row.map(r => this.out(r));
    if (typeof row === 'object') {
      const o: any = {};
      for (const [k, v] of Object.entries(row)) o[k] = this.out(v);
      return o;
    }
    return row;
  }

  /** Coerce one incoming value to its declared type, or throw on a bad value. */
  private coerce(f: FieldDef, v: any): any {
    if (v === undefined) return undefined;
    if (v === null || v === '') {
      if (f.required) throw new BadRequestException(`${f.name}_required`);
      // empty string for text fields is legitimate; null for the rest
      return f.type === 'string' || f.type === 'text' || f.type === 'asset' ? '' : null;
    }
    switch (f.type) {
      case 'string': case 'text': case 'asset': return String(v);
      case 'int': {
        const n = parseInt(String(v), 10);
        if (Number.isNaN(n)) throw new BadRequestException(`${f.name}_must_be_int`);
        return n;
      }
      case 'bigint': {
        try { return BigInt(String(v)); } catch { throw new BadRequestException(`${f.name}_must_be_int`); }
      }
      case 'bool': return v === true || v === 1 || v === '1' || v === 'true';
      case 'enum': {
        const opts = (f.options ?? []).map(o => o.value);
        // Numeric enums arrive as strings from JSON forms; compare loosely.
        const match = opts.find(o => String(o) === String(v));
        if (match === undefined) throw new BadRequestException(`${f.name}_invalid`);
        return match;
      }
      case 'json': {
        if (typeof v === 'object') return v;
        try { return JSON.parse(String(v)); } catch { throw new BadRequestException(`${f.name}_bad_json`); }
      }
      case 'date': return new Date(v);
      case 'readonly': return undefined;
    }
  }

  /** Build a write payload from the whitelist, applying defaults on create. */
  private payload(e: EntityDef, body: any, forCreate: boolean): any {
    const data: any = {};
    for (const f of e.fields) {
      if (f.type === 'readonly') continue;
      let v = this.coerce(f, body[f.name]);
      if (v === undefined && forCreate && f.default !== undefined) v = this.coerce(f, f.default);
      // A required field that is still absent on create is a client error (400),
      // not something to hand to Prisma to fail on with a 500. `coerce` only
      // guards null/empty; a wholly-omitted field arrives here as undefined.
      if (v === undefined && forCreate && f.required) throw new BadRequestException(`${f.name}_required`);
      if (v !== undefined) data[f.name] = v;
    }
    if (forCreate && e.fixed) Object.assign(data, e.fixed);
    return data;
  }

  private assertRole(e: EntityDef, admin: AdminIdentity) {
    const need = e.writeRole ?? 'admin';
    if (!AdminAuthService.atLeast(admin.role, need)) throw new ForbiddenException('insufficient_role');
  }

  private idWhere(e: EntityDef, id: string | number) {
    // Ids are ints in every registered entity except none currently; coerce.
    const n = parseInt(String(id), 10);
    return { [e.id]: Number.isNaN(n) ? id : n };
  }

  async list(key: string, opts: { q?: string; activeOnly?: boolean; skip?: number; take?: number }) {
    const e = this.entity(key);
    const where: any = { ...(e.fixed ?? {}), ...(e.listWhere ?? {}) };
    if (opts.activeOnly) where.active = true;
    if (opts.q) {
      // Search the string-ish fields.
      const strFields = e.fields.filter(f => ['string', 'text'].includes(f.type)).map(f => f.name);
      if (strFields.length) where.OR = strFields.map(f => ({ [f]: { contains: opts.q, mode: 'insensitive' } }));
    }
    const [rows, total] = await Promise.all([
      this.delegate(e).findMany({ where, orderBy: e.orderBy ?? undefined, skip: opts.skip ?? 0, take: opts.take ?? 100 }),
      this.delegate(e).count({ where }),
    ]);
    return { list: this.out(rows), total, entity: this.describe(e) };
  }

  async getOne(key: string, id: string) {
    const e = this.entity(key);
    const row = await this.delegate(e).findFirst({ where: { ...this.idWhere(e, id), ...(e.fixed ?? {}) } });
    if (!row) throw new NotFoundException('not_found');
    return this.out(row);
  }

  async create(key: string, body: any, admin: AdminIdentity) {
    const e = this.entity(key);
    this.assertRole(e, admin);
    if (e.noCreate) throw new ForbiddenException('create_disabled');
    const data = this.payload(e, body, true);
    const row = await this.delegate(e).create({ data });
    await this.audit.record(admin, 'create', e.key, row[e.id], data);
    return this.out(row);
  }

  async update(key: string, id: string, body: any, admin: AdminIdentity) {
    const e = this.entity(key);
    this.assertRole(e, admin);
    // Confirm the row belongs to this view before writing (fixed-type guard).
    await this.getOne(key, id);
    const data = this.payload(e, body, false);
    const row = await this.delegate(e).update({ where: this.idWhere(e, id), data });
    await this.audit.record(admin, 'update', e.key, id, data);
    return this.out(row);
  }

  async remove(key: string, id: string, admin: AdminIdentity) {
    const e = this.entity(key);
    this.assertRole(e, admin);
    if (e.noDelete) throw new ForbiddenException('delete_disabled');
    await this.getOne(key, id);
    await this.delegate(e).delete({ where: this.idWhere(e, id) });
    await this.audit.record(admin, 'delete', e.key, id);
    return { ok: true };
  }

  /** Flip `active` (or return an error for tables that have no such column). */
  async toggle(key: string, id: string, admin: AdminIdentity) {
    const e = this.entity(key);
    this.assertRole(e, admin);
    if (!e.fields.some(f => f.name === 'active')) throw new BadRequestException('no_active_flag');
    const cur = await this.getOne(key, id);
    const row = await this.delegate(e).update({ where: this.idWhere(e, id), data: { active: !cur.active } });
    await this.audit.record(admin, 'toggle', e.key, id, { active: !cur.active });
    return this.out(row);
  }

  /** Registry description the console renders forms from. */
  describe(e: EntityDef) {
    return {
      key: e.key, label: e.label, group: e.group, icon: e.icon, id: e.id,
      columns: e.columns ?? e.fields.slice(0, 5).map(f => f.name),
      fields: e.fields, noCreate: !!e.noCreate, noDelete: !!e.noDelete,
    };
  }

  /** The sidebar: every entity grouped, for the console shell. */
  menu() {
    const groups: Record<string, any[]> = { assets: [], economy: [], system: [] };
    for (const e of Object.values(ENTITY_BY_KEY)) {
      if (!groups[e.group]) groups[e.group] = [];
      groups[e.group].push({ key: e.key, label: e.label, icon: e.icon });
    }
    return groups;
  }
}
