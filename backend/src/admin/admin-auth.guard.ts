import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminAuthService, AdminIdentity } from './admin-auth.service';

/**
 * Gate on every /admin/api route except login.
 *
 * Reads the bearer token, resolves it to an admin, and attaches the identity to
 * the request as `req.admin` for controllers and the audit log to use. A missing
 * or expired token is a 401 — the console then bounces back to the login screen.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private auth: AdminAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = AdminAuthGuard.tokenOf(req);
    const admin = await this.auth.resolve(token);
    if (!admin) throw new UnauthorizedException('admin_auth_required');
    req.admin = admin;
    req.adminToken = token;
    return true;
  }

  static tokenOf(req: any): string | undefined {
    const h = req.headers?.authorization || '';
    if (h.startsWith('Bearer ')) return h.slice(7).trim();
    // Also accept ?token= so the browser can open asset URLs directly.
    return req.query?.token || undefined;
  }
}

/** Convenience accessor for the identity the guard attached. */
export function adminOf(req: any): AdminIdentity {
  return req.admin as AdminIdentity;
}
