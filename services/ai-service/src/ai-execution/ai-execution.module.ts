import { Module } from '@nestjs/common';
import { AIExecutionService } from './ai-execution.service';
import { AIExecutionController } from './ai-execution.controller';

/**
 * AIExecutionModule
 *
 * Stage C2-B: Service skeleton registered
 * Stage C2-D: Adapter interface + stub adapter wired
 * Stage C2-G: Configuration-driven adapter selection
 * Stage C2-H: Anthropic adapter integration
 * Stage C2-K: Provider configuration wiring
 * Stage C2-I: OpenAI adapter integration
 * Stage C2-J: Groq adapter integration
 * Phase 19A: xAI and DeepSeek adapter integration
 * Phase 28: Per-request provider selection (caller-owned)
 *
 * Providers:
 * - AIExecutionService (orchestration with per-request adapter selection)
 *
 * Phase 28 Architecture:
 * - Adapters are instantiated per-request based on request.provider field
 * - No DI-bound AI_ADAPTER token (removed in Phase 28)
 * - Provider selection is caller-owned (api-gateway specifies provider)
 * - ai-service MUST NOT guess or infer provider from environment
 *
 * This module establishes the module boundary for AI execution orchestration.
 */
@Module({
  controllers: [AIExecutionController],
  providers: [AIExecutionService],
  exports: [AIExecutionService],
})
export class AIExecutionModule {}
