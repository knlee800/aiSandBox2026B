import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../sessions/session.module';
import { EventsGateway } from './websocket.gateway';
import { EventsController } from './events.controller';

@Module({
  imports: [AuthModule, SessionModule],
  controllers: [EventsController],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class WebSocketModule {}
