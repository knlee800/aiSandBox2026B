import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { AIExecutionModule } from './ai-execution/ai-execution.module';
import { QueueModule } from './queue/queue.module';
import { WorkerModule } from './worker/worker.module';

/**
 * AppModule
 *
 * Root module for AI Service.
 *
 * Stage C2-K: ConfigModule integrated for provider configuration wiring.
 * Phase 19A: AI_PROVIDER environment variable support for xAI integration.
 * Phase 27: ClaudeModule removed - all AI providers routed through AIExecutionModule adapters.
 * Phase 26-28: Deterministic startup - dotenv loaded in main.ts before module import.
 * Phase 28: Per-request provider selection - AI_PROVIDER_CONFIG removed (no longer needed).
 *
 * ClaudeModule is no longer directly imported. All AI execution (including Anthropic)
 * is handled via AIExecutionModule's adapter pattern with per-request provider selection.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,  // dotenv already loaded in main.ts
    }),
    HttpModule,
    ConversationsModule,
    MessagesModule,
    AIExecutionModule,
    QueueModule,
    WorkerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
