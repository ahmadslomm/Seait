import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ApiController } from './gateway/api.controller';
import { AssetsController } from './gateway/assets.controller';
import { LegacyController } from './gateway/legacy.controller';
import { ActionRouter } from './gateway/action-router';
import { RoomGateway } from './gateway/room.gateway';
import { RtcService } from './rtc/rtc.service';
import { UnknownActionLogger } from './fallback/logger';
import { API_PROVIDERS } from './modules';
@Module({ imports:[PrismaModule], controllers:[ApiController, AssetsController, LegacyController], providers:[ActionRouter, RoomGateway, UnknownActionLogger, RtcService, ...API_PROVIDERS] })
export class AppModule {}
