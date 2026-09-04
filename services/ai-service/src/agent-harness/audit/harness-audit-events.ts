/**
 * Structured audit event types for Agent Harness v1.
 *
 * Privacy: events intentionally exclude prompt text, model output text,
 * file content, tool arguments, and full tool results.
 */

export interface HarnessAuditEventBase {
  readonly eventType: string;
  readonly timestamp: number;
  readonly executionId: string;
  readonly sessionId: string;
  readonly harnessVersion: string;
  readonly agentId?: string;
}

export interface HarnessRouteEvaluatedEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.route_evaluated';
  readonly selectedPath: 'harness' | 'plain';
  readonly enableToolLoop: boolean;
}

export interface HarnessLoopStartedEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.loop_started';
  readonly maxToolIterations: number;
  readonly maxToolResultBytes: number;
  readonly toolTimeoutMs: number;
}

export interface HarnessModelInvocationStartedEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.model_invocation_started';
  readonly iteration: number;
}

export interface HarnessModelInvocationCompletedEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.model_invocation_completed';
  readonly iteration: number;
  readonly provider?: string;
  readonly model: string;
  readonly finishReason: string;
  readonly toolCallCount: number;
  readonly tokensUsed: number;
  readonly cumulativeTokensUsed: number;
  readonly durationMs: number;
}

export interface HarnessModelInvocationFailedEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.model_invocation_failed';
  readonly iteration: number;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly durationMs: number;
}

export interface HarnessToolDispatchStartedEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.tool_dispatch_started';
  readonly iteration: number;
  readonly callId: string;
  readonly toolName: string;
}

export interface HarnessToolDispatchCompletedEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.tool_dispatch_completed';
  readonly iteration: number;
  readonly callId: string;
  readonly toolName: string;
  readonly durationMs: number;
  readonly resultBytes: number;
}

export interface HarnessToolDispatchFailedEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.tool_dispatch_failed';
  readonly iteration: number;
  readonly callId: string;
  readonly toolName: string;
  readonly durationMs: number;
  readonly errorCode?: string;
  readonly errorMessage: string;
}

export interface HarnessToolResultBudgetExceededEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.tool_result_budget_exceeded';
  readonly iteration: number;
  readonly callId: string;
  readonly toolName: string;
  readonly candidateBytes: number;
  readonly cumulativeBytes: number;
  readonly maxBytes: number;
}

export interface HarnessLoopCompletedEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.loop_completed';
  readonly iteration: number;
  readonly totalToolCalls: number;
  readonly cumulativeTokensUsed: number;
  readonly terminationReason: 'completed';
  readonly durationMs: number;
}

export interface HarnessLoopMaxTurnsEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.loop_max_turns';
  readonly iteration: number;
  readonly maxToolIterations: number;
  readonly totalToolCalls: number;
  readonly cumulativeTokensUsed: number;
  readonly terminationReason: 'max_iterations';
  readonly durationMs: number;
}

export interface HarnessLoopAbortedEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.loop_aborted';
  readonly iteration: number;
  readonly totalToolCalls: number;
  readonly cumulativeTokensUsed: number;
  readonly terminationReason: 'aborted';
  readonly durationMs: number;
}

export interface HarnessLoopNoDispatcherEvent extends HarnessAuditEventBase {
  readonly eventType: 'harness.loop_no_dispatcher';
  readonly iteration: number;
  readonly totalToolCalls: number;
  readonly cumulativeTokensUsed: number;
  readonly terminationReason: 'no_dispatcher';
  readonly durationMs: number;
}

export type HarnessAuditEvent =
  | HarnessRouteEvaluatedEvent
  | HarnessLoopStartedEvent
  | HarnessModelInvocationStartedEvent
  | HarnessModelInvocationCompletedEvent
  | HarnessModelInvocationFailedEvent
  | HarnessToolDispatchStartedEvent
  | HarnessToolDispatchCompletedEvent
  | HarnessToolDispatchFailedEvent
  | HarnessToolResultBudgetExceededEvent
  | HarnessLoopCompletedEvent
  | HarnessLoopMaxTurnsEvent
  | HarnessLoopAbortedEvent
  | HarnessLoopNoDispatcherEvent;
