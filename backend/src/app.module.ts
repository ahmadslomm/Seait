import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ApiController } from './gateway/api.controller';
import { ActionRouter } from './gateway/action-router';
import { RoomGateway } from './gateway/room.gateway';
import { RtcService } from './rtc/rtc.service';
import { UnknownActionLogger } from './fallback/logger';
@Module({ imports:[PrismaModule], controllers:[ApiController], providers:[ActionRouter, RoomGateway, UnknownActionLogger, RtcService] })
export class AppModule {}
