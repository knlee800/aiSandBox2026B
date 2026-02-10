import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { QuotaModule } from '../quota/quota.module';
import { ApiGatewayHttpClient } from '../clients/api-gateway-http.client';
import { AIExecutionModule } from '../ai-execution/ai-execution.module';

@Module({
  imports: [
    HttpModule,
    AIExecutionModule,
    ConversationsModule,
    QuotaModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, ApiGatewayHttpClient],
  exports: [MessagesService],
})
export class MessagesModule {}
