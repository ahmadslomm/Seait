import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminIdentity } from './admin-auth.service';

/**
 * Writes the audit trail. Every mutation the console performs goes through here,
 * so any change to the catalogue, economy or admin roster can be traced to an
 * operator and a time. Failures are swallowed — an audit write must never take
 * down the operation it is recording — but that is the only place we tolerate a
 * silent failure.
 */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async record(admin: AdminIdentity, action: string, entity = '', entityId: string | number = '', detail?: any) {
    await this.prisma.auditLog.create({
      data: {
        admin_id: admin.id, username: admin.username,
        action, entity, entity_id: String(entityId),
        detail: detail ?? undefined,
      },
    }).catch(() => null);
  }

  async recent(limit = 100) {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(500, limit) });
  }
}
