/**
 * AGENT-HARNESS-07B: Worker integration tests for per-builder harness config resolution.
 *
 * Verifies that WorkerProcessor correctly wires resolveBuilderHarnessConfig,
 * preserves global fallback, and flows resolved config values to ToolDispatcher
 * and executeAgentHarnessLoop.
 */

import { DEFAULT_AGENT_HARNESS_CONFIG_V1 } from '../../agent-harness/config/agent-harness.config';
import { resolveBuilderHarnessConfig } from '../../agent-harness/builder-profiles';
import type { AgentHarnessRunRequestV1 } from '../../agent-harness/contracts/agent-harness.contracts';
import type { AiExecutionJob } from '../../queue/job.types';
import * as path from 'path';
import * as fs from 'fs';

function getWorkerSource(): string {
  return fs.readFileSync(
    path.join(__dirname, '..', 'worker.processor.ts'),
    'utf-8',
  );
}

describe('AGENT-HARNESS-07B: AiExecutionJob identity fields', () => {
  it('AiExecutionJob accepts optional agentRole', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
      agentRole: 'builder',
    };
    expect(job.agentRole).toBe('builder');
  });

  it('AiExecutionJob accepts optional builderProfileId', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
      builderProfileId: 'builder-default',
    };
    expect(job.builderProfileId).toBe('builder-default');
  });

  it('AiExecutionJob accepts optional harnessProfileId, modelProfileId, toolPermissionProfileId', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
      harnessProfileId: 'hp1',
      modelProfileId: 'mp1',
      toolPermissionProfileId: 'tp1',
    };
    expect(job.harnessProfileId).toBe('hp1');
    expect(job.modelProfileId).toBe('mp1');
    expect(job.toolPermissionProfileId).toBe('tp1');
  });

  it('AiExecutionJob compiles without identity fields (backward compatible)', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
    };
    expect(job.agentRole).toBeUndefined();
    expect(job.builderProfileId).toBeUndefined();
    expect(job.harnessProfileId).toBeUndefined();
    expect(job.modelProfileId).toBeUndefined();
    expect(job.toolPermissionProfileId).toBeUndefined();
  });
});

describe('AGENT-PLATFORM-06: AiExecutionJob collaboration identity fields', () => {
  it('AiExecutionJob accepts optional collaborationRunId', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
      collaborationRunId: 'collab-run-001',
    };
    expect(job.collaborationRunId).toBe('collab-run-001');
  });

  it('AiExecutionJob accepts optional referralTraceId', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
      referralTraceId: 'ref-trace-001',
    };
    expect(job.referralTraceId).toBe('ref-trace-001');
  });

  it('AiExecutionJob compiles without collaboration fields (backward compatible)', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
    };
    expect(job.collaborationRunId).toBeUndefined();
    expect(job.referralTraceId).toBeUndefined();
  });
});

describe('AGENT-PLATFORM-06: WorkerProcessor identity field preservation in ledger finalization', () => {
  it('WorkerProcessor writes agentRole to nextMetadata during finalization', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("if (job.data.agentRole !== undefined) nextMetadata.agentRole = job.data.agentRole");
  });

  it('WorkerProcessor writes builderProfileId to nextMetadata during finalization', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("if (job.data.builderProfileId !== undefined) nextMetadata.builderProfileId = job.data.builderProfileId");
  });

  it('WorkerProcessor writes collaborationRunId to nextMetadata during finalization', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("if (job.data.collaborationRunId !== undefined) nextMetadata.collaborationRunId = job.data.collaborationRunId");
  });

  it('WorkerProcessor writes referralTraceId to nextMetadata during finalization', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("if (job.data.referralTraceId !== undefined) nextMetadata.referralTraceId = job.data.referralTraceId");
  });

  it('Identity preservation block appears after nextMetadata construction and before preApplyCheckpointHash', () => {
    const workerSource = getWorkerSource();
    const nextMetadataIndex = workerSource.indexOf('const nextMetadata: Record<string, unknown>');
    const identityBlockIndex = workerSource.indexOf('AGENT-PLATFORM-06: Preserve upstream identity');
    const checkpointHashIndex = workerSource.indexOf('if (harnessPreApplyCheckpointHash)');
    expect(identityBlockIndex).toBeGreaterThan(nextMetadataIndex);
    expect(identityBlockIndex).toBeLessThan(checkpointHashIndex);
  });
});

describe('AGENT-PLATFORM-07C2: AiExecutionJob orchestration referral fields', () => {
  it('AiExecutionJob accepts optional parentReferralTraceId', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
      parentReferralTraceId: 'parent-trace-001',
    };
    expect(job.parentReferralTraceId).toBe('parent-trace-001');
  });

  it('AiExecutionJob accepts optional referringBuilderProfileId', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
      referringBuilderProfileId: 'builder-a',
    };
    expect(job.referringBuilderProfileId).toBe('builder-a');
  });

  it('AiExecutionJob accepts optional orchestrationPriority', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
      orchestrationPriority: 5,
    };
    expect(job.orchestrationPriority).toBe(5);
  });

  it('AiExecutionJob accepts optional referralId', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
      referralId: 'ref-001',
    };
    expect(job.referralId).toBe('ref-001');
  });

  it('AiExecutionJob accepts optional isReferralExecution', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
      isReferralExecution: true,
    };
    expect(job.isReferralExecution).toBe(true);
  });

  it('AiExecutionJob compiles without orchestration referral fields (backward compatible)', () => {
    const job: AiExecutionJob = {
      executionId: 'e1',
      userId: 'u1',
      apiKeyId: 'k1',
      sessionId: 's1',
      conversationId: 'c1',
      provider: 'stub',
      adapter: 'stub',
      prompt: 'test',
      submittedAt: new Date().toISOString(),
    };
    expect(job.parentReferralTraceId).toBeUndefined();
    expect(job.referringBuilderProfileId).toBeUndefined();
    expect(job.orchestrationPriority).toBeUndefined();
    expect(job.referralId).toBeUndefined();
    expect(job.isReferralExecution).toBeUndefined();
  });
});

describe('AGENT-PLATFORM-07C2: WorkerProcessor orchestration referral field preservation', () => {
  it('WorkerProcessor writes parentReferralTraceId to nextMetadata during finalization', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("if (job.data.parentReferralTraceId !== undefined) nextMetadata.parentReferralTraceId = job.data.parentReferralTraceId");
  });

  it('WorkerProcessor writes referringBuilderProfileId to nextMetadata during finalization', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("if (job.data.referringBuilderProfileId !== undefined) nextMetadata.referringBuilderProfileId = job.data.referringBuilderProfileId");
  });

  it('WorkerProcessor writes orchestrationPriority to nextMetadata during finalization', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("if (job.data.orchestrationPriority !== undefined) nextMetadata.orchestrationPriority = job.data.orchestrationPriority");
  });

  it('WorkerProcessor writes referralId to nextMetadata during finalization', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("if (job.data.referralId !== undefined) nextMetadata.referralId = job.data.referralId");
  });

  it('WorkerProcessor writes isReferralExecution to nextMetadata during finalization', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("if (job.data.isReferralExecution !== undefined) nextMetadata.isReferralExecution = job.data.isReferralExecution");
  });

  it('Orchestration referral preservation block appears after AGENT-PLATFORM-06 block and before preApplyCheckpointHash', () => {
    const workerSource = getWorkerSource();
    const platform06Index = workerSource.indexOf('AGENT-PLATFORM-06: Preserve upstream identity');
    const platform07C2Index = workerSource.indexOf('AGENT-PLATFORM-07C2: Preserve orchestration referral');
    const checkpointHashIndex = workerSource.indexOf('if (harnessPreApplyCheckpointHash)');
    expect(platform07C2Index).toBeGreaterThan(platform06Index);
    expect(platform07C2Index).toBeLessThan(checkpointHashIndex);
  });
});

describe('AGENT-HARNESS-07B: AgentHarnessRunRequestV1 identity fields', () => {
  it('AgentHarnessRunRequestV1 accepts optional identity fields', () => {
    const request: AgentHarnessRunRequestV1 = {
      contractVersion: 'v1',
      runId: 'r1',
      sessionId: 's1',
      conversationId: 'c1',
      userId: 'u1',
      mode: 'execute',
      prompt: 'test',
      agentRole: 'builder',
      builderProfileId: 'builder-default',
      harnessProfileId: 'hp1',
      modelProfileId: 'mp1',
      toolPermissionProfileId: 'tp1',
    };
    expect(request.agentRole).toBe('builder');
    expect(request.builderProfileId).toBe('builder-default');
    expect(request.harnessProfileId).toBe('hp1');
    expect(request.modelProfileId).toBe('mp1');
    expect(request.toolPermissionProfileId).toBe('tp1');
  });

  it('AgentHarnessRunRequestV1 compiles without identity fields (backward compatible)', () => {
    const request: AgentHarnessRunRequestV1 = {
      contractVersion: 'v1',
      runId: 'r1',
      sessionId: 's1',
      conversationId: 'c1',
      userId: 'u1',
      mode: 'execute',
      prompt: 'test',
    };
    expect(request.agentRole).toBeUndefined();
    expect(request.builderProfileId).toBeUndefined();
  });
});

describe('AGENT-HARNESS-07B: resolvedConfig fallback behavior', () => {
  it('no identity fields => resolves to global default config', () => {
    const { config, metadata } = resolveBuilderHarnessConfig(
      {},
      DEFAULT_AGENT_HARNESS_CONFIG_V1,
    );
    expect(config).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1);
    expect(metadata.source).toBe('global-default-missing-profile');
    expect(metadata.warnings).toEqual([]);
  });

  it('builder-default profile => resolves to global default config', () => {
    const { config, metadata } = resolveBuilderHarnessConfig(
      { builderProfileId: 'builder-default', agentRole: 'builder' },
      DEFAULT_AGENT_HARNESS_CONFIG_V1,
    );
    expect(config.maxToolIterations).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolIterations);
    expect(config.toolTimeoutMs).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1.toolTimeoutMs);
    expect(config.maxToolResultBytes).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolResultBytes);
    expect(config.maxFileReadBytes).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxFileReadBytes);
    expect(config.enableWriteTools).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableWriteTools);
    expect(config.enableValidationTools).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableValidationTools);
    expect(config.enableBrowserSmoke).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableBrowserSmoke);
    expect(config.auditEventsEnabled).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1.auditEventsEnabled);
    expect(config.enablePreApplyCheckpoint).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1.enablePreApplyCheckpoint);
    expect(metadata.source).toBe('builder-profile');
    expect(metadata.builderProfileId).toBe('builder-default');
  });

  it('unknown builderProfileId => falls back to global default without crash', () => {
    const { config, metadata } = resolveBuilderHarnessConfig(
      { builderProfileId: 'nonexistent-profile', agentRole: 'builder' },
      DEFAULT_AGENT_HARNESS_CONFIG_V1,
    );
    expect(config).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1);
    expect(metadata.source).toBe('global-default-unknown-profile');
    expect(metadata.warnings.length).toBeGreaterThan(0);
    expect(metadata.warnings[0]).toContain('nonexistent-profile');
  });

  it('non-builder agentRole => falls back to global default', () => {
    const { config, metadata } = resolveBuilderHarnessConfig(
      { builderProfileId: 'builder-default', agentRole: 'reviewer' },
      DEFAULT_AGENT_HARNESS_CONFIG_V1,
    );
    expect(config).toBe(DEFAULT_AGENT_HARNESS_CONFIG_V1);
    expect(metadata.source).toBe('global-default-non-builder-role');
  });
});

describe('AGENT-HARNESS-07B: WorkerProcessor resolvedConfig wiring', () => {
  it('WorkerProcessor imports resolveBuilderHarnessConfig from builder-profiles', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("import { resolveBuilderHarnessConfig } from '../agent-harness/builder-profiles'");
  });

  it('WorkerProcessor calls resolveBuilderHarnessConfig inside the harness branch', () => {
    const workerSource = getWorkerSource();
    const harnessGateIndex = workerSource.indexOf("harnessVersion === 'v1'");
    const resolveCallIndex = workerSource.indexOf('resolveBuilderHarnessConfig(');
    expect(harnessGateIndex).toBeGreaterThan(-1);
    expect(resolveCallIndex).toBeGreaterThan(harnessGateIndex);
  });

  it('resolveBuilderHarnessConfig receives agentRole and builderProfileId from job.data', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('agentRole: job.data.agentRole');
    expect(workerSource).toContain('builderProfileId: job.data.builderProfileId');
  });

  it('resolveBuilderHarnessConfig receives DEFAULT_AGENT_HARNESS_CONFIG_V1 as global default', () => {
    const workerSource = getWorkerSource();
    const resolveCallIndex = workerSource.indexOf('resolveBuilderHarnessConfig(');
    const afterResolveCall = workerSource.substring(resolveCallIndex, resolveCallIndex + 400);
    expect(afterResolveCall).toContain('DEFAULT_AGENT_HARNESS_CONFIG_V1');
  });

  it('ToolDispatcher uses resolvedConfig.toolTimeoutMs and resolvedConfig.maxToolResultBytes', () => {
    const workerSource = getWorkerSource();
    const dispatcherIndex = workerSource.indexOf('new ToolDispatcher({');
    const nextBrace = workerSource.indexOf('})', dispatcherIndex);
    const dispatcherBlock = workerSource.substring(dispatcherIndex, nextBrace + 2);
    expect(dispatcherBlock).toContain('toolTimeoutMs: resolvedConfig.toolTimeoutMs');
    expect(dispatcherBlock).toContain('maxToolResultBytes: resolvedConfig.maxToolResultBytes');
  });

  it('read_file handler uses resolvedConfig.maxFileReadBytes', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('maxFileReadBytes: resolvedConfig.maxFileReadBytes');
  });

  it('write_file handler uses resolvedConfig.maxFileWriteBytes', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('maxFileWriteBytes: resolvedConfig.maxFileWriteBytes');
  });

  it('run_validation handler uses resolvedConfig validation config values', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('allowedValidationCommands: resolvedConfig.allowedValidationCommands');
    expect(workerSource).toContain('validationTimeoutMs: resolvedConfig.validationTimeoutMs');
    expect(workerSource).toContain('maxValidationOutputBytes: resolvedConfig.maxValidationOutputBytes');
  });

  it('browser_smoke handler uses resolvedConfig.browserSmokeTimeoutMs', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('browserSmokeTimeoutMs: resolvedConfig.browserSmokeTimeoutMs');
  });

  it('executeAgentHarnessLoop config uses resolvedConfig values', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('maxToolIterations: resolvedConfig.maxToolIterations');
    expect(workerSource).toContain('maxToolResultBytes: resolvedConfig.maxToolResultBytes');
    expect(workerSource).toContain('toolTimeoutMs: resolvedConfig.toolTimeoutMs');
  });

  it('auditRecorder gated by resolvedConfig.auditEventsEnabled', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('resolvedConfig.auditEventsEnabled');
  });

  it('enablePreApplyCheckpoint gated by resolvedConfig.enablePreApplyCheckpoint', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('resolvedConfig.enablePreApplyCheckpoint');
  });

  it('enableWriteTools gated by resolvedConfig.enableWriteTools', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('if (resolvedConfig.enableWriteTools)');
  });

  it('enableValidationTools gated by resolvedConfig.enableValidationTools', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('if (resolvedConfig.enableValidationTools)');
  });

  it('enableBrowserSmoke gated by resolvedConfig.enableBrowserSmoke', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('if (resolvedConfig.enableBrowserSmoke)');
  });
});

describe('AGENT-HARNESS-07B: global enableToolLoop gate preserved', () => {
  it('useHarness still checks DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop as master gate', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop');
    expect(workerSource).toContain("job.data.harnessVersion === 'v1' &&");
    expect(workerSource).toContain('if (useHarness) {');
  });

  it('route_evaluated log still uses DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop');
  });

  it('enableToolLoop defaults to false — harness path is not activated', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
  });

  it('resolvedConfig does not bypass the global enableToolLoop gate', () => {
    const workerSource = getWorkerSource();
    const useHarnessIndex = workerSource.indexOf('const useHarness =');
    const useHarnessLine = workerSource.substring(useHarnessIndex, workerSource.indexOf(';', useHarnessIndex) + 1);
    expect(useHarnessLine).toContain('DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop');
    expect(useHarnessLine).not.toContain('resolvedConfig');
  });
});

describe('AGENT-HARNESS-07B: config_resolved observability event', () => {
  it('WorkerProcessor emits agent_harness.config_resolved log inside harness branch', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("event: 'agent_harness.config_resolved'");
    const harnessGateIndex = workerSource.indexOf("harnessVersion === 'v1'");
    const configResolvedIndex = workerSource.indexOf("'agent_harness.config_resolved'");
    expect(configResolvedIndex).toBeGreaterThan(harnessGateIndex);
  });

  it('config_resolved event contains resolution source and builderProfileId', () => {
    const workerSource = getWorkerSource();
    const eventStart = workerSource.indexOf("event: 'agent_harness.config_resolved'");
    const eventBlock = workerSource.substring(eventStart, eventStart + 500);
    expect(eventBlock).toContain('source: configResolutionMetadata.source');
    expect(eventBlock).toContain('builderProfileId: configResolutionMetadata.builderProfileId');
  });

  it('config_resolved event does not contain sensitive fields', () => {
    const workerSource = getWorkerSource();
    const eventStart = workerSource.indexOf("event: 'agent_harness.config_resolved'");
    const eventBlock = workerSource.substring(eventStart, eventStart + 500);
    const forbiddenFields = ['prompt', 'workspaceContext', 'apiKey', 'cookie'];
    for (const field of forbiddenFields) {
      const fieldAsKey = new RegExp(`\\b${field}\\s*:`);
      expect(eventBlock).not.toMatch(fieldAsKey);
    }
  });
});

describe('AGENT-HARNESS-07B: plain execution path unchanged', () => {
  it('plain path still calls this.aiExecutionService.execute(executionRequest)', () => {
    const workerSource = getWorkerSource();
    const plainPathIndex = workerSource.lastIndexOf('this.aiExecutionService.execute(executionRequest)');
    expect(plainPathIndex).toBeGreaterThan(-1);
  });

  it('plain path does not use resolvedConfig', () => {
    const workerSource = getWorkerSource();
    const plainPathMatch = workerSource.lastIndexOf('this.aiExecutionService.execute(executionRequest)');
    const afterPlainPath = workerSource.substring(plainPathMatch);
    expect(afterPlainPath).not.toContain('resolvedConfig');
  });

  it('resolveBuilderHarnessConfig is not called outside the harness branch', () => {
    const workerSource = getWorkerSource();
    const resolveCallCount = (workerSource.match(/resolveBuilderHarnessConfig\(/g) || []).length;
    expect(resolveCallCount).toBe(1);
  });
});
