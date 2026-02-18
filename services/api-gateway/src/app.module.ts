import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StartupModule } from './startup/startup.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { WebSocketModule } from './websocket/websocket.module';
import { PreviewModule } from './preview/preview.module';
import { SessionModule } from './sessions/session.module';
import { ConversationModule } from './conversations/conversation.module';
import { ChatMessageModule } from './chat-messages/chat-message.module';
import { TokenUsageModule } from './token-usage/token-usage.module';
import { GitCheckpointModule } from './git-checkpoints/git-checkpoint.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { AIModule } from './ai/ai.module';
import { BillingModule } from './billing/billing.module';
import { BillingVisibilityModule } from './billing-visibility/billing-visibility.module';
import { InvoiceModule } from './invoice/invoice.module';
import { databaseConfig } from './config/database.config';
import { InternalServiceAuthGuard } from './guards/internal-service-auth.guard';

@Module({
  imports: [
    // Phase 38: Environment bootstrap (MUST be first)
    // Loads .env variables before any module, guard, or service executes
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Phase 27B: Startup guard (MUST be second)
    // Performs all mandatory startup checks before serving traffic
    StartupModule,

    // TypeORM configuration for PostgreSQL
    // Reads configuration from environment variables
    // Auto-loads entities matching pattern: src/**/*.entity{.ts,.js}
    TypeOrmModule.forRoot(databaseConfig()),

    AuthModule,
    HealthModule,
    WebSocketModule,
    PreviewModule,
    SessionModule,
    ConversationModule,
    ChatMessageModule,
    TokenUsageModule,
    GitCheckpointModule,
    InvoicesModule,
    PaymentsModule, // Task 10B2: Payment provider abstraction
    AdminModule, // Task 11A: Admin visibility endpoints
    AIModule, // Phase 18A: AI execution controller
    BillingModule, // Phase 23B-4: Billing snapshot writer
    BillingVisibilityModule, // Phase 24B: Billing visibility (read-only)
    InvoiceModule, // Phase 25B-1: Invoice persistence infrastructure
  ],
  controllers: [],
  providers: [
    // Global guard for internal service authentication
    // Protects all /api/internal/* routes with X-Internal-Service-Key header
    // Task 5.2A: Internal Service Authentication
    {
      provide: APP_GUARD,
      useClass: InternalServiceAuthGuard,
    },
  ],
})
export class AppModule {}
