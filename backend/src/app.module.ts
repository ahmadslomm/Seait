import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ApiController } from './gateway/api.controller';
import { ActionRouter } from './gateway/action-router';
import { RoomGateway } from './gateway/room.gateway';
import { UnknownActionLogger } from './fallback/logger';
@Module({ imports:[PrismaModule], controllers:[ApiController], providers:[ActionRouter, RoomGateway, UnknownActionLogger] })
export class AppModule {}
