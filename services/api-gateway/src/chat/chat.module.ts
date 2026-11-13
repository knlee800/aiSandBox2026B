import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatLinkCode } from '../entities/chat-link-code.entity';
import { ChatLinkController } from './chat-link.controller';
import { ChatLinkService } from './chat-link.service';

/**
 * CHAT-DISCORD-01: chat channels. Slice A1 holds the account link only
 * (tables, codes, routes, audit). No Discord connection yet.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ChatLink, ChatLinkCode, AuditEventEntity]), AuthModule],
  controllers: [ChatLinkController],
  providers: [ChatLinkService],
  exports: [ChatLinkService],
})
export class ChatModule {}
