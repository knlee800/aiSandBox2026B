import { AGENT_HARNESS_CONTRACT_VERSION_V1 } from '../index';
import type {
  AgentHarnessAuditEventV1,
  AgentHarnessBrowserSmokeResultV1,
  AgentHarnessConfigV1,
  AgentHarnessModelProfileReferenceV1,
  AgentHarnessModeV1,
  AgentHarnessPolicyV1,
  AgentHarnessRunRequestV1,
  AgentHarnessRunStateV1,
  AgentHarnessToolCallV1,
  AgentHarnessToolDefinitionV1,
  AgentHarnessToolErrorV1,
  AgentHarnessToolInputSchemaV1,
  AgentHarnessToolResultV1,
  AgentHarnessValidationResultV1,
} from '../index';

describe('Agent Harness v1 contract exports', () => {
  it('exports v1 contract version constant from stable index', () => {
    expect(AGENT_HARNESS_CONTRACT_VERSION_V1).toBe('v1');
  });

  it('supports importing and constructing v1 contract shapes from stable index', () => {
    const mode: AgentHarnessModeV1 = 'execute';

    const modelProfile: AgentHarnessModelProfileReferenceV1 = {
      profileId: 'default',
      providerHint: 'provider-placeholder',
      modelHint: 'model-placeholder',
    };

    const inputSchema: AgentHarnessToolInputSchemaV1 = {
      schemaType: 'json-schema',
      schema: { type: 'object' },
    };

    const toolDefinition: AgentHarnessToolDefinitionV1 = {
      id: 'validation.run',
      name: 'Run validation',
      description: 'Runs configured validation command',
      inputSchema,
      requiresApproval: false,
      tags: ['validation'],
    };

    const toolCall: AgentHarnessToolCallV1 = {
      callId: 'call-1',
      toolId: toolDefinition.id,
      arguments: { command: 'npm test' },
      requestedAtIso: new Date().toISOString(),
    };

    const toolResult: AgentHarnessToolResultV1 = {
      callId: toolCall.callId,
      toolId: toolCall.toolId,
      success: true,
      content: { ok: true },
      completedAtIso: new Date().toISOString(),
    };

    const toolError: AgentHarnessToolErrorV1 = {
      callId: toolCall.callId,
      toolId: toolCall.toolId,
      success: false,
      errorCode: 'ERR_TIMEOUT',
      message: 'Timed out',
      isRetriable: true,
      failedAtIso: new Date().toISOString(),
    };

    const policy: AgentHarnessPolicyV1 = {
      allowArbitraryShell: false,
      allowedValidationCommands: ['npm test'],
      requireApprovalForDelete: true,
      requireApprovalForPackageInstall: true,
      requireApprovalForEnvFileWrite: true,
      requireApprovalForLargeWrite: true,
    };

    const config: AgentHarnessConfigV1 = {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      ...policy,
      maxToolIterations: 1,
      maxFileReadBytes: 1024,
      maxFileWriteBytes: 1024,
      maxToolResultBytes: 1024,
      maxValidationOutputBytes: 1024,
      toolTimeoutMs: 1000,
      validationTimeoutMs: 1000,
      browserSmokeTimeoutMs: 1000,
      enableBrowserSmoke: false,
      enableSemanticSearch: false,
      enableToolLoop: false,
      enablePreApplyCheckpoint: true,
      auditEventsEnabled: false,
    };

    const runRequest: AgentHarnessRunRequestV1 = {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      runId: 'run-1',
      sessionId: 'session-1',
      conversationId: 'conversation-1',
      userId: 'user-1',
      mode,
      prompt: 'Build a plan',
      systemPrompt: 'Be concise',
      modelProfile,
      metadata: { requestSource: 'test' },
    };

    const runState: AgentHarnessRunStateV1 = {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      runId: runRequest.runId,
      status: 'running',
      mode: runRequest.mode,
      toolIterationsUsed: 1,
      startedAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
      lastToolCall: toolCall,
      lastToolResult: toolResult,
    };

    const validationResult: AgentHarnessValidationResultV1 = {
      command: 'npm test',
      success: true,
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      timedOut: false,
      durationMs: 99,
    };

    const browserSmokeResult: AgentHarnessBrowserSmokeResultV1 = {
      success: true,
      scenario: 'open-preview',
      summary: 'Smoke passed',
      durationMs: 1200,
      timedOut: false,
      details: { screenshots: 1 },
    };

    const auditEvent: AgentHarnessAuditEventV1 = {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      eventId: 'evt-1',
      runId: runRequest.runId,
      eventType: 'tool-completed',
      occurredAtIso: new Date().toISOString(),
      payload: {
        toolResult,
        toolError,
        validationResult,
        browserSmokeResult,
        config,
        runState,
      },
    };

    expect(mode).toBe('execute');
    expect(toolDefinition.inputSchema.schemaType).toBe('json-schema');
    expect(toolCall.toolId).toBe(toolDefinition.id);
    expect(toolResult.success).toBe(true);
    expect(toolError.success).toBe(false);
    expect(policy.allowArbitraryShell).toBe(false);
    expect(config.contractVersion).toBe('v1');
    expect(runRequest.contractVersion).toBe('v1');
    expect(runState.status).toBe('running');
    expect(validationResult.success).toBe(true);
    expect(browserSmokeResult.success).toBe(true);
    expect(auditEvent.eventType).toBe('tool-completed');
  });
});
