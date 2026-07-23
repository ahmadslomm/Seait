import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EconomyService } from '../modules/economy.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AuditService } from './audit.service';
import { AdminCrudService } from './admin-crud.service';
import { AdminEconomyService } from './admin-economy.service';
import { AdminPublicController, AdminApiController } from './admin.controller';
import { AdminConsoleController } from './admin-console.controller';

/**
 * The operator console — a self-contained slice, added alongside the app's
 * api.php surface without touching it. EconomyService is re-provided here (it is
 * stateless, just wrapping Prisma) so balance adjustments go through the exact
 * same credit/debit path as the client, keeping one ledger.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AdminPublicController, AdminApiController, AdminConsoleController],
  providers: [AdminAuthService, AdminAuthGuard, AuditService, AdminCrudService, AdminEconomyService, EconomyService],
})
export class AdminModule {}
