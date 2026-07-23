import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Admin roles, most to least privileged. */
export type AdminRole = 'super' | 'admin' | 'editor';
const RANK: Record<AdminRole, number> = { super: 3, admin: 2, editor: 1 };

export interface AdminIdentity {
  id: number;
  username: string;
  role: AdminRole;
}

/**
 * Admin authentication.
 *
 * Passwords are scrypt-hashed with a per-user salt — Node's built-in KDF, so no
 * crypto dependency is added. Sessions are opaque random bearer tokens stored
 * server-side (AdminSession); nothing about the admin is encoded in the token,
 * so revoking is a row delete.
 *
 * Deliberately separate from the app's user auth and the api.php gateway: the
 * console is a different trust domain and must not share a code path with the
 * client-facing surface.
 */
@Injectable()
export class AdminAuthService {
  constructor(private prisma: PrismaService) {}

  private static readonly SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

  /** scrypt(password, salt) as hex. */
  private hash(password: string, salt: string): string {
    return scryptSync(password, salt, 64).toString('hex');
  }

  /** Constant-time compare so a wrong password cannot be timed out char by char. */
  private verifyHash(password: string, salt: string, expected: string): boolean {
    const got = Buffer.from(this.hash(password, salt), 'hex');
    const want = Buffer.from(expected, 'hex');
    return got.length === want.length && timingSafeEqual(got, want);
  }

  async createAdmin(username: string, password: string, role: AdminRole = 'admin') {
    const salt = randomBytes(16).toString('hex');
    return this.prisma.adminUser.create({
      data: { username, salt, passwordHash: this.hash(password, salt), role },
    });
  }

  async setPassword(id: number, password: string) {
    const salt = randomBytes(16).toString('hex');
    await this.prisma.adminUser.update({
      where: { id }, data: { salt, passwordHash: this.hash(password, salt) },
    });
  }

  /** Returns a bearer token on success, or null on bad credentials. */
  async login(username: string, password: string): Promise<{ token: string; admin: AdminIdentity } | null> {
    const u = await this.prisma.adminUser.findUnique({ where: { username } });
    if (!u || !u.active) return null;
    if (!this.verifyHash(password, u.salt, u.passwordHash)) return null;

    const token = randomBytes(32).toString('hex');
    await this.prisma.adminSession.create({
      data: { token, admin_id: u.id, expiresAt: new Date(Date.now() + AdminAuthService.SESSION_TTL_MS) },
    });
    await this.prisma.adminUser.update({ where: { id: u.id }, data: { lastLoginAt: new Date() } });
    return { token, admin: { id: u.id, username: u.username, role: u.role as AdminRole } };
  }

  /** Resolve a bearer token to the admin, or null if missing/expired. */
  async resolve(token: string | undefined): Promise<AdminIdentity | null> {
    if (!token) return null;
    const s = await this.prisma.adminSession.findUnique({ where: { token }, include: { admin: true } });
    if (!s || s.expiresAt < new Date() || !s.admin.active) return null;
    return { id: s.admin.id, username: s.admin.username, role: s.admin.role as AdminRole };
  }

  async logout(token: string | undefined) {
    if (token) await this.prisma.adminSession.deleteMany({ where: { token } });
  }

  /** True when `have` meets or exceeds `need` in the role ranking. */
  static atLeast(have: AdminRole, need: AdminRole): boolean {
    return RANK[have] >= RANK[need];
  }

  /** Housekeeping: drop expired sessions. Called opportunistically on login pages. */
  async pruneExpired() {
    await this.prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => null);
  }
}
