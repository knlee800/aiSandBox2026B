import { Logger } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  buildAIExecutionRequest,
  buildExecutionPromptParts,
  computeJobPayloadDigest,
  computePayloadDigest,
  DEFAULT_EXECUTION_TIMEOUT_MS,
  HarnessEmptyAdvertisedToolSetError,
  HarnessEntitlementError,
  HarnessRoutingError,
  mergeAdvertisedToolsIntoExecuteOptions,
  parseExecutionTimeoutBaselineMs,
  requireNonEmptyAdvertisedHarnessTools,
  resolveBullMqLockDurationMs,
  resolveHarnessRouting,
  resolveStuckWatchdogThresholdSeconds,
  sortKeysRecursive,
  verifyHarnessEntitlementProof,
  WorkerProcessor,
} from './worker.processor';
import { selectAdvertisedAgentHarnessTools } from '../ai-execution/adapters/adapter-tool-use.mapper';
import * as agentHarnessLoop from '../agent-harness/orchestrator/agent-harness-loop';
import {
  AGENT_HARNESS_TOOL_DEFINITIONS_V1,
  getAgentHarnessToolDefinition,
} from '../agent-harness/tools/tool-registry';
import {
  createAgentHarnessConfigV1,
  DEFAULT_AGENT_HARNESS_CONFIG_V1,
} from '../agent-harness/config/agent-harness.config';
import { InMemoryHarnessAuditRecorder } from '../agent-harness/audit';

type CapturedJobProcessor = (job: {
  id?: string;
  data: Record<string, unknown>;
}) => Promise<unknown>;

const capturedWorker: {
  processor: CapturedJobProcessor | null;
  opts: Record<string, unknown> | null;
} = {
  processor: null,
  opts: null,
};

jest.mock('bullmq', () => ({
  Worker: jest.fn(
    (
      _name: string,
      processor: CapturedJobProcessor,
      opts: Record<string, unknown>,
    ) => {
      capturedWorker.processor = processor;
      capturedWorker.opts = opts;
      return {
        close: jest.fn().mockResolvedValue(undefined),
      };
    },
  ),
  Queue: jest.fn(() => ({
    getJob: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  QueueEvents: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('ioredis', () =>
  jest.fn(() => ({
    quit: jest.fn().mockResolvedValue('OK'),
  })),
);

describe('buildAIExecutionRequest', () => {
  it('passes requested model from job payload to AIExecutionService request', () => {
    const request = buildAIExecutionRequest(
      {
        provider: 'openai',
        executionId: 'exec-1',
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        model: 'gpt-4.1',
      },
      {
        system: 'Execution output contract',
        user: 'User request:\nhello',
      },
    );

    expect(request.model).toBe('gpt-4.1');
    expect(request.provider).toBe('openai');
    expect(request.systemPrompt).toBe('Execution output contract');
    expect(request.prompt).toBe('User request:\nhello');
    expect(request.sessionId).toBe('session-1');
    expect(request.conversationId).toBe('conv-1');
    expect(request.userId).toBe('user-1');
  });

  it('keeps model undefined when no model is provided in job payload', () => {
    const request = buildAIExecutionRequest(
      {
        provider: 'anthropic',
        executionId: 'exec-1',
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
      },
      {
        system: 'Execution output contract',
        user: 'User request:\nhello',
      },
    );

    expect(request.model).toBeUndefined();
  });

  it('forwards the canonical Gateway executionId without transformation', () => {
    const request = buildAIExecutionRequest(
      {
        provider: 'openai',
        executionId: 'canonical-exec-id',
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        model: 'gpt-4.1',
      },
      {
        system: 'Execution output contract',
        user: 'User request:\nhello',
      },
    );

    expect(request.executionId).toBe('canonical-exec-id');
    expect(request.executionId).not.toBe(request.sessionId);
  });

  it('forwards persisted agentId when the job carries one', () => {
    const request = buildAIExecutionRequest(
      {
        provider: 'openai',
        executionId: 'canonical-exec-id',
        agentId: 'persisted-agent-id',
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
      },
      {
        system: 'Execution output contract',
        user: 'User request:\nhello',
      },
    );

    expect(request.agentId).toBe('persisted-agent-id');
    expect(request.executionId).toBe('canonical-exec-id');
  });

  it('leaves agentId undefined for ordinary unbound jobs', () => {
    const request = buildAIExecutionRequest(
      {
        provider: 'openai',
        executionId: 'canonical-exec-id',
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
      },
      {
        system: 'Execution output contract',
        user: 'User request:\nhello',
      },
    );

    expect(request.agentId).toBeUndefined();
    expect(request.executionId).toBe('canonical-exec-id');
    expect(request.sessionId).toBe('session-1');
    expect(request.conversationId).toBe('conv-1');
    expect(request.userId).toBe('user-1');
    expect(request.provider).toBe('openai');
  });
});

describe('resolveHarnessRouting', () => {
  it('selects the existing plain path when Harness was not requested', () => {
    expect(
      resolveHarnessRouting({
        enableToolLoop: false,
      }),
    ).toEqual({ selectedPath: 'plain' });
    expect(
      resolveHarnessRouting({
        harnessVersion: undefined,
        enableToolLoop: true,
        adapterSupportsToolUse: true,
        adapterHasExecuteWithTools: true,
      }),
    ).toEqual({ selectedPath: 'plain' });
  });

  it('fails closed when Harness v1 is requested and the loop gate is false', () => {
    const decision = resolveHarnessRouting({
      harnessVersion: 'v1',
      enableToolLoop: false,
      adapterSupportsToolUse: true,
      adapterHasExecuteWithTools: true,
    });

    expect(decision).toEqual({
      selectedPath: 'fail_closed',
      failReason: 'tool_loop_disabled',
    });
  });

  it('fails closed when Harness v1 is requested and the adapter lacks native tool support', () => {
    const decision = resolveHarnessRouting({
      harnessVersion: 'v1',
      enableToolLoop: true,
      adapterSupportsToolUse: false,
      adapterHasExecuteWithTools: true,
    });

    expect(decision).toEqual({
      selectedPath: 'fail_closed',
      failReason: 'adapter_lacks_tool_use',
    });
  });

  it('fails closed when Harness v1 is requested and the adapter lacks executeWithTools', () => {
    const decision = resolveHarnessRouting({
      harnessVersion: 'v1',
      enableToolLoop: true,
      adapterSupportsToolUse: true,
      adapterHasExecuteWithTools: false,
    });

    expect(decision).toEqual({
      selectedPath: 'fail_closed',
      failReason: 'adapter_lacks_execute_with_tools',
    });
  });

  it('selects the bounded Harness path when v1 is requested, the gate is true, and the adapter supports native tool use', () => {
    const decision = resolveHarnessRouting({
      harnessVersion: 'v1',
      enableToolLoop: true,
      adapterSupportsToolUse: true,
      adapterHasExecuteWithTools: true,
    });

    expect(decision).toEqual({ selectedPath: 'harness' });
  });

  it('never selects the plain path for an unsupported Harness request', () => {
    const disabledGate = resolveHarnessRouting({
      harnessVersion: 'v1',
      enableToolLoop: false,
    });
    const missingToolUse = resolveHarnessRouting({
      harnessVersion: 'v1',
      enableToolLoop: true,
      adapterSupportsToolUse: false,
      adapterHasExecuteWithTools: true,
    });
    const missingExecuteWithTools = resolveHarnessRouting({
      harnessVersion: 'v1',
      enableToolLoop: true,
      adapterSupportsToolUse: true,
      adapterHasExecuteWithTools: false,
    });

    expect(disabledGate.selectedPath).toBe('fail_closed');
    expect(missingToolUse.selectedPath).toBe('fail_closed');
    expect(missingExecuteWithTools.selectedPath).toBe('fail_closed');
  });
});

describe('buildExecutionPromptParts', () => {
  it('places the file-action contract in the system part', () => {
    const promptParts = buildExecutionPromptParts('List files');

    expect(promptParts.system).toContain('Execution output contract:');
    expect(promptParts.system).toContain('`file-actions`');
  });

  it('keeps user request formatting in the user part when workspace context is absent', () => {
    const promptParts = buildExecutionPromptParts('List files');

    expect(promptParts.user).toBe(`User request:
List files`);
  });

  it('includes project/workspace metadata and selected file content in the user part', () => {
    const promptParts = buildExecutionPromptParts('List files', {
      filePaths: ['README.md', 'src/app.ts'],
      projectName: 'Sandbox Project',
      workspaceName: 'Personal',
      selectedFilePath: 'src/app.ts',
      selectedFileContent: 'export const app = true;',
    });

    expect(promptParts.user).toContain(`Current project:
Sandbox Project`);
    expect(promptParts.user).toContain(`Current workspace:
Personal`);
    expect(promptParts.user).toContain(`Current workspace files:
- README.md
- src/app.ts`);
    expect(promptParts.user).toContain(`Selected file content:
export const app = true;`);
  });

  it('passes through truncation markers in the user workspace context block', () => {
    const promptParts = buildExecutionPromptParts('Explain this file', {
      filePaths: ['src/app.ts'],
      selectedFilePath: 'src/app.ts',
      selectedFileContent: 'const x = 1;\n[...truncated at 8000 characters]',
    });

    expect(promptParts.user).toContain(`Selected file content:
const x = 1;
[...truncated at 8000 characters]`);
  });

  it('appends named file content blocks in the user part when provided', () => {
    const promptParts = buildExecutionPromptParts('Explain utils.ts', {
      filePaths: ['src/app.ts', 'src/utils.ts'],
      namedFileContents: [
        {
          path: 'src/utils.ts',
          content: 'export const util = true;',
        },
      ],
    });

    expect(promptParts.user).toContain(`Named file content: src/utils.ts
export const util = true;`);
  });

  it('renders Repo Docs block ahead of regular workspace context in user prompt', () => {
    const promptParts = buildExecutionPromptParts('Summarize docs', {
      filePaths: ['README.md'],
      repoDocContents: [
        { path: 'README.md', content: 'Project introduction' },
        { path: 'docs/ARCHITECTURE.md', content: 'Architecture details' },
      ],
    });

    const repoDocsIndex = promptParts.user.indexOf('Repo Docs:');
    const workspaceIndex = promptParts.user.indexOf('Current workspace files:');
    const userRequestIndex = promptParts.user.indexOf('User request:');

    expect(promptParts.user).toContain(`Repo doc content: README.md
Project introduction`);
    expect(promptParts.user).toContain(`Repo doc content: docs/ARCHITECTURE.md
Architecture details`);
    expect(repoDocsIndex).toBeGreaterThanOrEqual(0);
    expect(workspaceIndex).toBeGreaterThan(repoDocsIndex);
    expect(userRequestIndex).toBeGreaterThan(workspaceIndex);
  });

  it('omits Repo Docs block when repoDocContents is missing or empty', () => {
    const withoutRepoDocs = buildExecutionPromptParts('Summarize docs', {
      filePaths: ['README.md'],
    });
    const withEmptyRepoDocs = buildExecutionPromptParts('Summarize docs', {
      filePaths: ['README.md'],
      repoDocContents: [],
    });

    expect(withoutRepoDocs.user).not.toContain('Repo Docs:');
    expect(withEmptyRepoDocs.user).not.toContain('Repo Docs:');
  });

  it('keeps workspace context non-empty when only repoDocContents is provided', () => {
    const promptParts = buildExecutionPromptParts('Summarize docs', {
      filePaths: [],
      repoDocContents: [{ path: 'README.md', content: 'Only doc context' }],
    });

    expect(promptParts.user).toContain(`Repo Docs:

Repo doc content: README.md
Only doc context`);
    expect(promptParts.user).toContain(`User request:
Summarize docs`);
  });

  it('passes through repo-doc truncation suffix in user prompt', () => {
    const promptParts = buildExecutionPromptParts('Summarize docs', {
      filePaths: [],
      repoDocContents: [
        {
          path: 'README.md',
          content: `Doc excerpt\n[...truncated at 8000 characters]`,
        },
      ],
    });

    expect(promptParts.user).toContain(`Repo doc content: README.md
Doc excerpt
[...truncated at 8000 characters]`);
  });

  it('appends workspace search results in the user part when provided', () => {
    const promptParts = buildExecutionPromptParts('Where is login implemented?', {
      filePaths: ['src/app.ts'],
      searchResults: {
        query: 'login',
        results: [{ path: 'src/app.ts', line: 12, preview: 'const login = true;' }],
        truncated: true,
      },
    });

    expect(promptParts.user).toContain(`Workspace search results for: login
- src/app.ts:12 - const login = true;
[...results truncated]`);
  });

  it('includes trimmed Global AI Instructions in the system part when provided', () => {
    const promptParts = buildExecutionPromptParts(
      'Implement feature',
      {
        filePaths: ['README.md'],
        selectedFilePath: 'README.md',
        selectedFileContent: 'Project docs',
      },
      '  Be concise. Always include tests.  ',
    );

    expect(promptParts.system).toContain(`Global AI Instructions:
Be concise. Always include tests.`);
  });

  it('omits Global AI Instructions in the system part when value is null/empty/whitespace', () => {
    const emptyPrompt = buildExecutionPromptParts(
      'Implement feature',
      {
        filePaths: ['README.md'],
      },
      '   ',
    );
    const nullPrompt = buildExecutionPromptParts(
      'Implement feature',
      {
        filePaths: ['README.md'],
      },
      null,
    );

    expect(emptyPrompt.system).not.toContain('Global AI Instructions:');
    expect(nullPrompt.system).not.toContain('Global AI Instructions:');
  });

  it('includes trimmed Project AI Instructions in the system part when provided', () => {
    const promptParts = buildExecutionPromptParts(
      'Implement feature',
      {
        filePaths: ['README.md'],
      },
      'Respect API boundaries',
      '  For this project only, keep responses short.  ',
    );

    expect(promptParts.system).toContain(`Project AI Instructions:
For this project only, keep responses short.`);
  });

  it('omits Project AI Instructions in the system part when value is null/empty/whitespace', () => {
    const emptyPrompt = buildExecutionPromptParts(
      'Implement feature',
      {
        filePaths: ['README.md'],
      },
      'Respect API boundaries',
      '   ',
    );
    const nullPrompt = buildExecutionPromptParts(
      'Implement feature',
      {
        filePaths: ['README.md'],
      },
      'Respect API boundaries',
      null,
    );

    expect(emptyPrompt.system).not.toContain('Project AI Instructions:');
    expect(nullPrompt.system).not.toContain('Project AI Instructions:');
  });

  it('keeps authority boundaries between system and user parts', () => {
    const promptParts = buildExecutionPromptParts(
      'Implement feature',
      {
        filePaths: ['src/app.ts'],
      },
      'Respect API boundaries',
      'For this project only, prefer minimal changes.',
    );

    const contractIndex = promptParts.system.indexOf('Execution output contract:');
    const globalInstructionsIndex = promptParts.system.indexOf('Global AI Instructions:');
    const projectInstructionsIndex = promptParts.system.indexOf('Project AI Instructions:');
    const workspaceIndex = promptParts.user.indexOf('Current workspace files:');
    const userRequestIndex = promptParts.user.indexOf('User request:');

    expect(contractIndex).toBeGreaterThanOrEqual(0);
    expect(globalInstructionsIndex).toBeGreaterThan(contractIndex);
    expect(projectInstructionsIndex).toBeGreaterThan(globalInstructionsIndex);
    expect(workspaceIndex).toBeGreaterThanOrEqual(0);
    expect(userRequestIndex).toBeGreaterThan(workspaceIndex);
    expect(promptParts.system).not.toContain('User request:');
    expect(promptParts.user).not.toContain('Execution output contract:');
    expect(promptParts.user).not.toContain('Global AI Instructions:');
    expect(promptParts.user).not.toContain('Project AI Instructions:');
  });

  it('keeps system prompt limited to contract and instruction blocks', () => {
    const promptParts = buildExecutionPromptParts(
      'What repo docs did you read?',
      {
        filePaths: [],
        repoDocContents: [{ path: 'README.md', content: 'Repo docs content' }],
      },
      'Global policy',
      'Project policy',
    );

    expect(promptParts.system).toContain('Execution output contract:');
    expect(promptParts.system).toContain(`Global AI Instructions:
Global policy`);
    expect(promptParts.system).toContain(`Project AI Instructions:
Project policy`);
    expect(promptParts.system).not.toContain('Repo Docs:');
    expect(promptParts.system).not.toContain('Repo doc content:');
    expect(promptParts.system).not.toContain('User request:');
  });
});

describe('Agent Harness empty-dispatcher wiring', () => {
  it('WorkerProcessor imports ToolDispatcher from agent-harness tools', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain("import { ToolDispatcher } from '../agent-harness/tools/tool-dispatcher'");
  });

  it('WorkerProcessor constructs ToolDispatcher only inside the double-gated harness branch', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const dispatcherInstantiations = (workerSource.match(/new ToolDispatcher\(\{/g) || []).length;
    expect(dispatcherInstantiations).toBe(1);

    const harnessGateIndex = workerSource.indexOf("harnessVersion === 'v1'");
    const dispatcherIndex = workerSource.indexOf('new ToolDispatcher({');
    expect(harnessGateIndex).toBeGreaterThan(-1);
    expect(dispatcherIndex).toBeGreaterThan(harnessGateIndex);
    expect(workerSource).toContain('toolTimeoutMs: resolvedConfig.toolTimeoutMs');
    expect(workerSource).toContain('maxToolResultBytes: resolvedConfig.maxToolResultBytes');
  });

  it('WorkerProcessor passes dispatcher into executeAgentHarnessLoop', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('dispatcher,');
    expect(workerSource).toContain('dispatcher');
  });

  it('WorkerProcessor passes maxToolResultBytes into executeAgentHarnessLoop config', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('maxToolIterations: resolvedConfig.maxToolIterations');
    expect(workerSource).toContain('maxToolResultBytes: resolvedConfig.maxToolResultBytes');
  });

  it('WorkerProcessor passes configured toolTimeoutMs into executeAgentHarnessLoop options', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain(
      'toolTimeoutMs: resolvedConfig.toolTimeoutMs',
    );
  });
});

describe('Agent Harness double-gate config', () => {
  it('enableToolLoop defaults to false in DEFAULT_AGENT_HARNESS_CONFIG_V1', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
  });

  it('maxToolIterations defaults to a small positive number', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolIterations).toBeGreaterThan(0);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolIterations).toBeLessThanOrEqual(25);
  });

  it('WorkerProcessor does not hardcode tool definitions from the registry', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).not.toContain('AGENT_HARNESS_TOOL_DEFINITIONS_V1');
    expect(workerSource).not.toContain('AGENT_HARNESS_TOOL_DEFINITION_MAP_V1');
  });

  it('WorkerProcessor does not import standalone write/delete tool modules', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).not.toContain('write-file');
    expect(workerSource).not.toContain('delete-file');
  });
});

describe('Agent Harness 03C: enablePreApplyCheckpoint config', () => {
  it('enablePreApplyCheckpoint defaults to true in DEFAULT_AGENT_HARNESS_CONFIG_V1', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enablePreApplyCheckpoint).toBe(true);
  });
});

describe('Agent Harness 03C: checkpoint callback wiring in WorkerProcessor', () => {
  it('WorkerProcessor passes checkpoint callback inside the double-gated harness branch', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const harnessGateIndex = workerSource.indexOf("harnessVersion === 'v1'");
    const checkpointFnIndex = workerSource.indexOf('createCheckpointFn');
    expect(checkpointFnIndex).toBeGreaterThan(harnessGateIndex);
  });

  it('WorkerProcessor does not pass checkpoint callback on the normal single-shot path', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const createCheckpointFnOccurrences = (workerSource.match(/createCheckpointFn/g) || []).length;
    expect(createCheckpointFnOccurrences).toBeGreaterThanOrEqual(1);

    const singleShotPathIndex = workerSource.lastIndexOf('this.aiExecutionService.execute(executionRequest)');
    const afterSingleShot = workerSource.substring(singleShotPathIndex);
    expect(afterSingleShot).not.toContain('createCheckpointFn');
  });

  it('enableToolLoop false still prevents harness path', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
  });

  it('WorkerProcessor records preApplyCheckpointHash in execution metadata', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('harnessPreApplyCheckpointHash');
    expect(workerSource).toContain('preApplyCheckpointHash');
    expect(workerSource).toContain('nextMetadata.preApplyCheckpointHash');
  });

  it('WorkerProcessor passes mutatingToolNames with write_file and delete_file', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain("mutatingToolNames: new Set(['write_file', 'delete_file'])");
  });

  it('checkpoint callback uses createWorkspaceCheckpoint from apiGatewayHttpClient', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('this.apiGatewayHttpClient.createWorkspaceCheckpoint');
  });

  it('checkpoint callback passes loop signal into createWorkspaceCheckpoint', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('createCheckpointFn: (checkpointSignal) =>');
    expect(workerSource).toContain('checkpointSignal');
  });

  it('checkpoint callback is gated by resolvedConfig.enablePreApplyCheckpoint', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('resolvedConfig.enablePreApplyCheckpoint');
    const enablePreApplyIndex = workerSource.indexOf('resolvedConfig.enablePreApplyCheckpoint');
    const createCheckpointFnIndex = workerSource.indexOf('createCheckpointFn', enablePreApplyIndex);
    expect(createCheckpointFnIndex).toBeGreaterThan(enablePreApplyIndex);
  });
});

describe('Agent Harness 05C3A: route observability event', () => {
  function getWorkerSource(): string {
    return require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
  }

  it('emits agent_harness.route_evaluated with harnessVersion v1, enableToolLoop false, selectedPath fail_closed', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("event: 'agent_harness.route_evaluated'");
    expect(workerSource).toContain('enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop');
    expect(workerSource).toContain('selectedPath: routing.selectedPath');

    const decision = resolveHarnessRouting({
      harnessVersion: 'v1',
      enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop,
    });
    const samplePayload = {
      event: 'agent_harness.route_evaluated',
      executionId: 'exec-test-1',
      harnessVersion: 'v1',
      enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop,
      selectedPath: decision.selectedPath,
    };

    expect(samplePayload.executionId).toBe('exec-test-1');
    expect(samplePayload.harnessVersion).toBe('v1');
    expect(samplePayload.enableToolLoop).toBe(false);
    expect(samplePayload.selectedPath).toBe('fail_closed');
  });

  it('emits agent_harness.route_evaluated with null harnessVersion when absent', () => {
    const absentVersion: string | undefined = undefined;
    const decision = resolveHarnessRouting({
      harnessVersion: absentVersion,
      enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop,
    });
    const samplePayload = {
      event: 'agent_harness.route_evaluated',
      executionId: 'exec-test-2',
      harnessVersion: absentVersion ?? null,
      enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop,
      selectedPath: decision.selectedPath,
    };

    expect(samplePayload.harnessVersion).toBeNull();
    expect(samplePayload.enableToolLoop).toBe(false);
    expect(samplePayload.selectedPath).toBe('plain');
  });

  it('route event contains no sensitive fields', () => {
    const workerSource = getWorkerSource();
    const eventStart = workerSource.indexOf("event: 'agent_harness.route_evaluated'");
    expect(eventStart).toBeGreaterThan(-1);

    const eventBlock = workerSource.substring(eventStart, eventStart + 500);

    const forbiddenFields = [
      'prompt',
      'workspaceContext',
      'globalInstructions',
      'projectInstructions',
      'cookie',
      'apiKey',
    ];

    for (const field of forbiddenFields) {
      const fieldAsKey = new RegExp(`\\b${field}\\s*:`);
      expect(eventBlock).not.toMatch(fieldAsKey);
    }
  });

  it('useHarness is derived from fail-closed routing instead of silent fallback', () => {
    const workerSource = getWorkerSource();

    expect(workerSource).toContain('resolveHarnessRouting');
    expect(workerSource).toContain('const useHarness =');
    expect(workerSource).toContain("routing.selectedPath === 'harness'");
    expect(workerSource).toContain('if (useHarness) {');
    expect(workerSource).toContain('HarnessRoutingError');

    const inlineDoubleGateMatches = workerSource.match(
      /if\s*\(\s*job\.data\.harnessVersion === 'v1'\s*&&\s*DEFAULT_AGENT_HARNESS_CONFIG_V1\.enableToolLoop\s*\)/g,
    );
    expect(inlineDoubleGateMatches).toBeNull();
  });

  it('existing harness tool registration tests remain valid', () => {
    const workerSource = getWorkerSource();
    const harnessGateIndex = workerSource.indexOf("harnessVersion === 'v1'");
    const dispatcherIndex = workerSource.indexOf('new ToolDispatcher({');
    expect(harnessGateIndex).toBeGreaterThan(-1);
    expect(dispatcherIndex).toBeGreaterThan(harnessGateIndex);
  });
});

describe('Agent Harness 03A: read_file/list_files handler registration', () => {
  it('WorkerProcessor imports file-tool-handlers', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('file-tool-handlers');
    expect(workerSource).toContain('createReadFileHandler');
    expect(workerSource).toContain('createListFilesHandler');
    expect(workerSource).toContain('createWriteFileHandler');
    expect(workerSource).toContain('createDeleteFileHandler');
  });

  it('WorkerProcessor always registers read_file and list_files in harness path', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const readFileRegistrations = (workerSource.match(/registerHandler\(\s*['"]read_file['"]/g) || []).length;
    const listFilesRegistrations = (workerSource.match(/registerHandler\(\s*['"]list_files['"]/g) || []).length;
    expect(readFileRegistrations).toBe(1);
    expect(listFilesRegistrations).toBe(1);
  });

  it('WorkerProcessor gates write_file and delete_file registration behind resolvedConfig.enableWriteTools', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain(
      'if (resolvedConfig.enableWriteTools)',
    );
    expect(workerSource).toContain("'write_file'");
    expect(workerSource).toContain("'delete_file'");
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableWriteTools).toBe(false);
  });

  it('WorkerProcessor gates run_validation registration behind resolvedConfig.enableValidationTools', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain(
      'if (resolvedConfig.enableValidationTools)',
    );
    expect(workerSource).toContain("'run_validation'");
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableValidationTools).toBe(false);
  });

  it('config enables write_file/delete_file when enableWriteTools=true', () => {
    const config = createAgentHarnessConfigV1({
      AGENT_HARNESS_ENABLE_WRITE_TOOLS: 'true',
    });
    expect(config.enableWriteTools).toBe(true);
  });

  it('config enables run_validation when enableValidationTools=true', () => {
    const config = createAgentHarnessConfigV1({
      AGENT_HARNESS_ENABLE_VALIDATION_TOOLS: 'true',
    });
    expect(config.enableValidationTools).toBe(true);
  });

  it('WorkerProcessor does not register preview or search tools', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).not.toContain("registerHandler('start_preview'");
    expect(workerSource).not.toContain("registerHandler('search_workspace'");
  });

  it('WorkerProcessor registers browser_smoke only when enableBrowserSmoke is true', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const enableBrowserSmokeIndex = workerSource.indexOf('enableBrowserSmoke');
    const browserSmokeRegIndex = workerSource.indexOf("'browser_smoke'");
    expect(enableBrowserSmokeIndex).toBeGreaterThan(-1);
    expect(browserSmokeRegIndex).toBeGreaterThan(enableBrowserSmokeIndex);
  });

  it('WorkerProcessor does not add browser_smoke to mutatingToolNames', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain("mutatingToolNames: new Set(['write_file', 'delete_file'])");
    expect(workerSource).not.toMatch(/mutatingToolNames.*browser_smoke/);
  });

  it('browser_smoke is not registered when enableBrowserSmoke defaults to false', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableBrowserSmoke).toBe(false);
  });

  it('plain path remains unchanged and executeAgentHarnessLoop is only used in harness branch', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const harnessBranchIndex = workerSource.indexOf('if (useHarness) {');
    const executeLoopIndex = workerSource.indexOf('executeAgentHarnessLoop(loopOptions)');
    const plainExecuteIndex = workerSource.lastIndexOf(
      'this.aiExecutionService.execute(executionRequest)',
    );
    const executeOccurrences = (
      workerSource.match(/this\.aiExecutionService\.execute\(executionRequest\)/g) || []
    ).length;
    expect(harnessBranchIndex).toBeGreaterThan(-1);
    expect(executeLoopIndex).toBeGreaterThan(harnessBranchIndex);
    expect(plainExecuteIndex).toBeGreaterThan(executeLoopIndex);
    expect(executeOccurrences).toBe(1);
  });

  it('WorkerProcessor does not add run_validation to mutatingToolNames', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain("mutatingToolNames: new Set(['write_file', 'delete_file'])");
    expect(workerSource).not.toMatch(/mutatingToolNames.*run_validation/);
  });

  it('WorkerProcessor imports createRunValidationHandler', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('createRunValidationHandler');
    expect(workerSource).toContain('validation-tool-handlers');
  });

  it('WorkerProcessor injects ApiGatewayHttpClient via constructor', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('apiGatewayHttpClient');
    expect(workerSource).toContain('ApiGatewayHttpClient');
  });

  it('handler registration occurs inside the double-gated harness branch', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const harnessGateIndex = workerSource.indexOf("harnessVersion === 'v1'");
    const readFileRegIndex = workerSource.indexOf("'read_file'");
    const listFilesRegIndex = workerSource.indexOf("'list_files'");
    const writeFileRegIndex = workerSource.indexOf("'write_file'");
    const deleteFileRegIndex = workerSource.indexOf("'delete_file'");
    expect(readFileRegIndex).toBeGreaterThan(harnessGateIndex);
    expect(listFilesRegIndex).toBeGreaterThan(harnessGateIndex);
    expect(writeFileRegIndex).toBeGreaterThan(harnessGateIndex);
    expect(deleteFileRegIndex).toBeGreaterThan(harnessGateIndex);
  });

  it('WorkerProcessor does not access filesystem directly', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).not.toContain("from 'fs'");
    expect(workerSource).not.toContain("from 'fs/promises'");
    expect(workerSource).not.toContain("require('fs')");
  });

  it('WorkerProcessor uses API Gateway boundary, not container-manager directly', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('ApiGatewayHttpClient');
    expect(workerSource).not.toContain('CONTAINER_MANAGER_URL');
    expect(workerSource).not.toContain('container-manager-http');
  });
});

describe('BILLING-READY-04C: worker accounting notification placement', () => {
  function getWorkerSource(): string {
    return require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
  }

  it('calls notifyExecutionComplete after the post-completion cancel check passes', () => {
    const workerSource = getWorkerSource();

    const postCompletionCancelCheck = workerSource.indexOf(
      "if (statusCheck[0]?.execution_status === 'cancel_requested')",
    );
    expect(postCompletionCancelCheck).toBeGreaterThan(-1);

    const completionSqlWrite = workerSource.indexOf(
      "SET execution_status = 'completed'",
    );
    expect(completionSqlWrite).toBeGreaterThan(-1);

    const notifyCall = workerSource.indexOf('this.apiGatewayHttpClient.notifyExecutionComplete(executionId)');
    expect(notifyCall).toBeGreaterThan(-1);

    expect(notifyCall).toBeGreaterThan(postCompletionCancelCheck);
    expect(notifyCall).toBeGreaterThan(completionSqlWrite);
  });

  it('does not call notifyExecutionComplete in failed execution path', () => {
    const workerSource = getWorkerSource();

    const failedPathStart = workerSource.indexOf("execution_status = 'failed'");
    expect(failedPathStart).toBeGreaterThan(-1);

    const failedSection = workerSource.substring(
      workerSource.lastIndexOf("SET execution_status = 'failed'"),
    );
    const throwIndex = failedSection.indexOf('throw error');
    const failedBlock = failedSection.substring(0, throwIndex + 50);

    expect(failedBlock).not.toContain('notifyExecutionComplete');
  });

  it('does not call notifyExecutionComplete in post-completion cancel-win path', () => {
    const workerSource = getWorkerSource();

    const cancelCheckIndex = workerSource.indexOf(
      "if (statusCheck[0]?.execution_status === 'cancel_requested')",
    );
    expect(cancelCheckIndex).toBeGreaterThan(-1);

    const cancelBlock = workerSource.substring(cancelCheckIndex, cancelCheckIndex + 500);
    const returnIndex = cancelBlock.indexOf('return;');
    const cancelWinBlock = cancelBlock.substring(0, returnIndex + 10);

    expect(cancelWinBlock).not.toContain('notifyExecutionComplete');
  });

  it('wraps notifyExecutionComplete in try/catch for error suppression', () => {
    const workerSource = getWorkerSource();

    const notifyIndex = workerSource.indexOf('notifyExecutionComplete(executionId)');
    expect(notifyIndex).toBeGreaterThan(-1);

    const surroundingCode = workerSource.substring(notifyIndex - 200, notifyIndex + 300);
    expect(surroundingCode).toContain('try {');
    expect(surroundingCode).toContain('} catch (notifyError)');
    expect(surroundingCode).toContain('suppressed');
  });

  it('notifyExecutionComplete is called for both harness and plain execution paths', () => {
    const workerSource = getWorkerSource();
    const notifyOccurrences = (workerSource.match(/notifyExecutionComplete\(executionId\)/g) || []).length;
    expect(notifyOccurrences).toBe(1);

    const completionSqlIndex = workerSource.indexOf("SET execution_status = 'completed'");
    const notifyIndex = workerSource.indexOf('notifyExecutionComplete(executionId)');
    expect(notifyIndex).toBeGreaterThan(completionSqlIndex);
  });

  it('does not call notifyExecutionComplete in timeout path', () => {
    const workerSource = getWorkerSource();
    const timeoutSection = workerSource.substring(
      workerSource.indexOf("SET execution_status = 'timeout'"),
      workerSource.indexOf("SET execution_status = 'timeout'") + 400,
    );
    expect(timeoutSection).not.toContain('notifyExecutionComplete');
  });

  it('does not call notifyExecutionComplete in AbortError cancel path', () => {
    const workerSource = getWorkerSource();
    const abortSection = workerSource.substring(
      workerSource.indexOf("error.name === 'AbortError'"),
    );
    const abortReturnIndex = abortSection.indexOf('return;');
    const abortBlock = abortSection.substring(0, abortReturnIndex + 10);
    expect(abortBlock).not.toContain('notifyExecutionComplete');
  });

  it('does not call notifyExecutionComplete in cancel-before-start path', () => {
    const workerSource = getWorkerSource();
    const cancelBeforeStartIndex = workerSource.indexOf('Execution cancelled before start');
    expect(cancelBeforeStartIndex).toBeGreaterThan(-1);

    const cancelBeforeStartBlock = workerSource.substring(
      cancelBeforeStartIndex - 300,
      cancelBeforeStartIndex + 50,
    );
    expect(cancelBeforeStartBlock).not.toContain('notifyExecutionComplete');
  });

  it('preserves AGENT-PLATFORM-06 identity fields in completion metadata', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('nextMetadata.agentRole');
    expect(workerSource).toContain('nextMetadata.builderProfileId');
    expect(workerSource).toContain('nextMetadata.collaborationRunId');
    expect(workerSource).toContain('nextMetadata.referralTraceId');
  });

  it('preserves AGENT-PLATFORM-07C2 orchestration fields in completion metadata', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('nextMetadata.parentReferralTraceId');
    expect(workerSource).toContain('nextMetadata.referringBuilderProfileId');
    expect(workerSource).toContain('nextMetadata.orchestrationPriority');
    expect(workerSource).toContain('nextMetadata.referralId');
    expect(workerSource).toContain('nextMetadata.isReferralExecution');
  });

  it('does not touch AGENT-HARNESS write canary', () => {
    const workerSource = getWorkerSource();
    const notifySection = workerSource.substring(
      workerSource.indexOf('notifyExecutionComplete'),
      workerSource.indexOf('notifyExecutionComplete') + 500,
    );
    expect(notifySection).not.toContain('AGENT_HARNESS_ENABLE_TOOL_LOOP');
    expect(notifySection).not.toContain('writeCanary');
    expect(notifySection).not.toContain('enableToolLoop');
  });
});

describe('Agent Harness 05C9: structured audit events wiring', () => {
  function getWorkerSource(): string {
    return require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
  }

  it('existing route_evaluated behavior remains fail-closed for requested Harness', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("event: 'agent_harness.route_evaluated'");
    expect(workerSource).toContain('enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop');
    expect(workerSource).toContain('selectedPath: routing.selectedPath');
    expect(workerSource).not.toContain("selectedPath: useHarness ? 'harness' : 'plain'");
  });

  it('plain execution path unchanged — no audit recorder on plain path', () => {
    const workerSource = getWorkerSource();
    const plainPathIndex = workerSource.lastIndexOf('this.aiExecutionService.execute(executionRequest)');
    const afterPlainPath = workerSource.substring(plainPathIndex);
    expect(afterPlainPath).not.toContain('auditRecorder');
    expect(afterPlainPath).not.toContain('InMemoryHarnessAuditRecorder');
  });

  it('enableToolLoop false path unchanged — still prevents harness path', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
  });

  it('auditEventsEnabled defaults to true in DEFAULT_AGENT_HARNESS_CONFIG_V1', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.auditEventsEnabled).toBe(true);
  });

  it('WorkerProcessor imports InMemoryHarnessAuditRecorder from audit barrel', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('InMemoryHarnessAuditRecorder');
    expect(workerSource).toContain("from '../agent-harness/audit'");
  });

  it('WorkerProcessor creates auditRecorder conditionally on resolvedConfig.auditEventsEnabled', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('resolvedConfig.auditEventsEnabled');
    expect(workerSource).toContain('new InMemoryHarnessAuditRecorder()');

    const auditGateIndex = workerSource.indexOf('resolvedConfig.auditEventsEnabled');
    const recorderCreateIndex = workerSource.indexOf('new InMemoryHarnessAuditRecorder()', auditGateIndex);
    expect(recorderCreateIndex).toBeGreaterThan(auditGateIndex);
  });

  it('WorkerProcessor passes recorder into executeAgentHarnessLoop options', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('recorder: auditRecorder');
  });

  it('WorkerProcessor logs audit events after loop completes', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain('if (auditRecorder)');
    expect(workerSource).toContain('auditRecorder.getEvents()');
    expect(workerSource).toContain('JSON.stringify(event)');
  });

  it('audit recorder creation is inside the double-gated harness branch', () => {
    const workerSource = getWorkerSource();
    const harnessGateIndex = workerSource.indexOf("harnessVersion === 'v1'");
    const auditRecorderIndex = workerSource.indexOf('new InMemoryHarnessAuditRecorder()');
    expect(auditRecorderIndex).toBeGreaterThan(harnessGateIndex);
  });

  it('audit event logging does not contain sensitive fields', () => {
    const workerSource = getWorkerSource();
    const auditLogSection = workerSource.substring(
      workerSource.indexOf('if (auditRecorder)'),
      workerSource.indexOf('if (auditRecorder)') + 300,
    );
    expect(auditLogSection).not.toContain('prompt');
    expect(auditLogSection).not.toContain('workspaceContext');
    expect(auditLogSection).not.toContain('apiKey');
  });

  it('InMemoryHarnessAuditRecorder is importable from audit barrel', () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    expect(recorder).toBeDefined();
    expect(recorder.getEvents()).toEqual([]);
  });
});

describe('PRIVATE-BETA-BLOCKER-03C: restored global execution timeout policy', () => {
  const originalTimeoutEnv = process.env.EXECUTION_TIMEOUT_MS;

  afterEach(() => {
    if (originalTimeoutEnv === undefined) {
      delete process.env.EXECUTION_TIMEOUT_MS;
    } else {
      process.env.EXECUTION_TIMEOUT_MS = originalTimeoutEnv;
    }
  });

  it('resolves the default Worker timeout to 20000 ms when EXECUTION_TIMEOUT_MS is unset', () => {
    delete process.env.EXECUTION_TIMEOUT_MS;
    expect(parseExecutionTimeoutBaselineMs()).toBe(DEFAULT_EXECUTION_TIMEOUT_MS);
    expect(parseExecutionTimeoutBaselineMs()).toBe(20000);
  });

  it('does not apply a grok-4.20 60000 ms special case', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).not.toContain('GROK_4_20_EXECUTION_TIMEOUT_MS');
    expect(workerSource).not.toContain('60000');
    expect(parseExecutionTimeoutBaselineMs()).toBe(20000);
  });

  it('falls back to 20000 ms for invalid EXECUTION_TIMEOUT_MS values', () => {
    process.env.EXECUTION_TIMEOUT_MS = 'not-a-number';
    expect(parseExecutionTimeoutBaselineMs()).toBe(DEFAULT_EXECUTION_TIMEOUT_MS);
    process.env.EXECUTION_TIMEOUT_MS = '0';
    expect(parseExecutionTimeoutBaselineMs()).toBe(DEFAULT_EXECUTION_TIMEOUT_MS);
    process.env.EXECUTION_TIMEOUT_MS = '-5';
    expect(parseExecutionTimeoutBaselineMs()).toBe(DEFAULT_EXECUTION_TIMEOUT_MS);
  });

  it('keeps BullMQ lockDuration on the baseline formula', () => {
    delete process.env.EXECUTION_TIMEOUT_MS;
    expect(resolveBullMqLockDurationMs()).toBe(30000);
    expect(resolveBullMqLockDurationMs(DEFAULT_EXECUTION_TIMEOUT_MS)).toBe(
      30000,
    );
  });

  it('restores the stuck watchdog to 40s under the default 20000 ms baseline', () => {
    delete process.env.EXECUTION_TIMEOUT_MS;
    expect(resolveStuckWatchdogThresholdSeconds()).toBe(40);
    expect(resolveStuckWatchdogThresholdSeconds() * 1000).toBe(
      DEFAULT_EXECUTION_TIMEOUT_MS * 2,
    );
  });
});

describe('PRIVATE-BETA-BLOCKER-03C: worker abort timeout behavior', () => {
  const originalTimeoutEnv = process.env.EXECUTION_TIMEOUT_MS;
  const originalRedisUrl = process.env.REDIS_URL;
  const originalStuckScan = process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;

  function createLedgerMock() {
    const status = { value: 'pending' };
    const timeoutUpdates: unknown[][] = [];
    const failedUpdates: unknown[][] = [];
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (
        sql.includes("SET execution_status = 'running'") &&
        sql.includes('RETURNING')
      ) {
        if (status.value === 'pending') {
          status.value = 'running';
          return [{ execution_id: params[0] }];
        }
        return [];
      }
      if (sql.includes("SET execution_status = 'timeout'")) {
        timeoutUpdates.push(params);
        if (status.value === 'running') {
          status.value = 'timeout';
          return [{ execution_id: params[0] }];
        }
        return [];
      }
      if (sql.includes("SET execution_status = 'completed'")) {
        status.value = 'completed';
        return [];
      }
      if (sql.includes("SET execution_status = 'failed'")) {
        failedUpdates.push(params);
        if (sql.includes('RETURNING') && status.value === 'running') {
          status.value = 'failed';
          return [{ execution_id: params[0] }];
        }
        status.value = 'failed';
        return [];
      }
      if (sql.includes("SET execution_status = 'cancelled'")) {
        status.value = 'cancelled';
        return [];
      }
      if (sql.includes('SELECT execution_status, created_at')) {
        return [
          {
            execution_status: status.value,
            created_at: new Date().toISOString(),
          },
        ];
      }
      if (sql.includes('SELECT execution_id, timestamp')) {
        return [];
      }
      if (sql.includes('SELECT metadata')) {
        return [{ metadata: {} }];
      }
      if (sql.includes('SELECT execution_status')) {
        return [{ execution_status: status.value }];
      }
      return [];
    });
    return { query, status, timeoutUpdates, failedUpdates };
  }

  function createSuccessResult(model: string) {
    return {
      output: 'created file',
      tokensUsed: 1251,
      model,
      fileActions: [
        {
          action: 'create' as const,
          path: 'index.html',
          content: '<html></html>',
        },
      ],
      parseMethod: 'structured_json' as const,
      workspaceMutationAttempted: true,
    };
  }

  async function startWorker(deps: {
    query: jest.Mock;
    execute: jest.Mock;
    publisher: {
      publishCompletion: jest.Mock;
      publishToken: jest.Mock;
      publishFileActions: jest.Mock;
    };
    apiGateway: { notifyExecutionComplete: jest.Mock };
  }) {
    const worker = new WorkerProcessor(
      { query: deps.query } as never,
      { execute: deps.execute, getAdapter: jest.fn() } as never,
      deps.publisher as never,
      deps.apiGateway as never,
    );
    await worker.onModuleInit();
    if (!capturedWorker.processor) {
      throw new Error('BullMQ worker processor was not captured');
    }
    return {
      worker,
      processJob: capturedWorker.processor,
      workerOpts: capturedWorker.opts,
    };
  }

  function createJob(model: string, executionId = `exec-${model}`) {
    return {
      id: `job-${executionId}`,
      data: {
        executionId,
        provider: 'xai',
        adapter: 'xai',
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        prompt: 'Create index.html',
        model,
        executionIntent: 'workspace_mutation',
      },
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    delete process.env.EXECUTION_TIMEOUT_MS;
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = '600000';
    capturedWorker.processor = null;
    capturedWorker.opts = null;
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (originalTimeoutEnv === undefined) {
      delete process.env.EXECUTION_TIMEOUT_MS;
    } else {
      process.env.EXECUTION_TIMEOUT_MS = originalTimeoutEnv;
    }
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
    if (originalStuckScan === undefined) {
      delete process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;
    } else {
      process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = originalStuckScan;
    }
  });

  it('does not set skipLockRenewal, so BullMQ default lock renewal remains enabled', async () => {
    const ledger = createLedgerMock();
    const { worker, workerOpts } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: { notifyExecutionComplete: jest.fn() },
    });

    expect(workerOpts?.skipLockRenewal).toBeUndefined();
    expect(workerOpts?.lockDuration).toBe(30000);

    await worker.onModuleDestroy();
  });

  it('aborts supported models at 20s, finalizes timeout once, and does not retry or publish file actions', async () => {
    const ledger = createLedgerMock();
    const execute = jest.fn((request: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        const onAbort = () => {
          const err = new Error('Request was aborted.');
          err.name = 'AbortError';
          reject(err);
        };
        if (request.signal?.aborted) {
          onAbort();
          return;
        }
        request.signal?.addEventListener('abort', onAbort, { once: true });
      });
    });
    const publisher = {
      publishCompletion: jest.fn(),
      publishToken: jest.fn(),
      publishFileActions: jest.fn(),
    };
    const apiGateway = {
      notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
    };
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      publisher,
      apiGateway,
    });

    const jobPromise = processJob(createJob('grok-4.5', 'exec-grok-45-timeout-once'));
    await jest.advanceTimersByTimeAsync(19999);
    expect(execute.mock.calls[0][0].signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await jobPromise;

    expect(execute.mock.calls[0][0].signal).toBeDefined();
    expect(execute.mock.calls[0][0].signal.aborted).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(ledger.timeoutUpdates).toHaveLength(1);
    expect(ledger.status.value).toBe('timeout');
    expect(publisher.publishCompletion).toHaveBeenCalledTimes(1);
    expect(publisher.publishFileActions).not.toHaveBeenCalled();
    expect(apiGateway.notifyExecutionComplete).not.toHaveBeenCalled();

    await worker.onModuleDestroy();
  });

  it('still aborts the default model path at 20s', async () => {
    const ledger = createLedgerMock();
    const execute = jest.fn((request: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        const onAbort = () => {
          const err = new Error('Request was aborted.');
          err.name = 'AbortError';
          reject(err);
        };
        if (request.signal?.aborted) {
          onAbort();
          return;
        }
        request.signal?.addEventListener('abort', onAbort, { once: true });
      });
    });
    const publisher = {
      publishCompletion: jest.fn(),
      publishToken: jest.fn(),
      publishFileActions: jest.fn(),
    };
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      publisher,
      apiGateway: { notifyExecutionComplete: jest.fn() },
    });

    const jobPromise = processJob(createJob('grok-4.5', 'exec-grok-45-timeout'));
    await jest.advanceTimersByTimeAsync(19999);
    expect(execute.mock.calls[0][0].signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await jobPromise;

    expect(execute).toHaveBeenCalledTimes(1);
    expect(ledger.status.value).toBe('timeout');
    expect(publisher.publishFileActions).not.toHaveBeenCalled();

    await worker.onModuleDestroy();
  });

  it('keeps the normal grok-4.5 success path unchanged', async () => {
    const ledger = createLedgerMock();
    const execute = jest
      .fn()
      .mockResolvedValue(createSuccessResult('grok-4.5'));
    const publisher = {
      publishCompletion: jest.fn(),
      publishToken: jest.fn(),
      publishFileActions: jest.fn(),
    };
    const apiGateway = {
      notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
    };
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      publisher,
      apiGateway,
    });

    await processJob(createJob('grok-4.5', 'exec-grok-45-ok'));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].model).toBe('grok-4.5');
    expect(execute.mock.calls[0][0].executionId).toBe('exec-grok-45-ok');
    expect(execute.mock.calls[0][0].agentId).toBeUndefined();
    expect(execute.mock.calls[0][0].sessionId).toBe('session-1');
    expect(execute.mock.calls[0][0].signal).toBeDefined();
    expect(ledger.status.value).toBe('completed');
    expect(ledger.timeoutUpdates).toHaveLength(0);
    expect(publisher.publishFileActions).toHaveBeenCalledTimes(1);
    expect(apiGateway.notifyExecutionComplete).toHaveBeenCalledTimes(1);

    await worker.onModuleDestroy();
  });

  it('fails closed before ordinary execute() when Harness v1 is requested with the loop gate disabled', async () => {
    const previousSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    const testSecret = 'test-hmac-secret-do-not-use-in-production-01c5b';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = testSecret;
    const ledger = createLedgerMock();
    const execute = jest.fn().mockResolvedValue(createSuccessResult('grok-4.5'));
    const publisher = {
      publishCompletion: jest.fn(),
      publishToken: jest.fn(),
      publishFileActions: jest.fn(),
    };
    const apiGateway = {
      notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
    };
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      publisher,
      apiGateway,
    });

    const jobData: Record<string, unknown> = {
      executionId: 'exec-harness-disabled',
      provider: 'xai',
      adapter: 'xai',
      sessionId: 'session-1',
      conversationId: 'conv-1',
      userId: 'user-1',
      apiKeyId: 'apikey-1',
      prompt: 'Create index.html',
      model: 'grok-4.5',
      executionIntent: 'workspace_mutation',
      harnessVersion: 'v1',
    };
    const issuedAt = '2026-09-05T12:00:00.000Z';
    const { payloadDigest } = computeJobPayloadDigest(jobData);
    const claim = `v=1|executionId=${jobData.executionId}|userId=${jobData.userId}|apiKeyId=${jobData.apiKeyId}|harnessVersion=v1|issuedAt=${issuedAt}|payloadDigest=${payloadDigest}`;
    jobData.harnessEntitlementProof = {
      version: 1,
      executionId: jobData.executionId,
      userId: jobData.userId,
      apiKeyId: jobData.apiKeyId,
      harnessVersion: 'v1',
      issuedAt,
      payloadDigest,
      signature: createHmac('sha256', testSecret).update(claim, 'utf8').digest('hex'),
    };
    const job = {
      id: 'job-exec-harness-disabled',
      data: jobData,
    };

    try {
      await expect(processJob(job)).rejects.toBeInstanceOf(HarnessRoutingError);
      expect(execute).not.toHaveBeenCalled();
      expect(ledger.status.value).toBe('failed');
      expect(publisher.publishFileActions).not.toHaveBeenCalled();
      expect(apiGateway.notifyExecutionComplete).not.toHaveBeenCalled();
      expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
    } finally {
      if (previousSecret === undefined) {
        delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
      } else {
        process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = previousSecret;
      }
    }

    await worker.onModuleDestroy();
  });

  it('keeps the stuck watchdog at 2x the global execution timeout', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('resolveStuckWatchdogThresholdSeconds()');
    expect(resolveStuckWatchdogThresholdSeconds()).toBe(40);
    expect(resolveStuckWatchdogThresholdSeconds() * 1000).toBe(
      DEFAULT_EXECUTION_TIMEOUT_MS * 2,
    );
  });
});

describe('AGENT-PLATFORM-EXEC-01C2 fail-closed advertised tool orchestration', () => {
  function getWorkerSource(): string {
    return require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
  }

  it('passes the filtered first-slice definitions on every native tool-use call', async () => {
    const listFiles = getAgentHarnessToolDefinition('list_files')!;
    const readFile = getAgentHarnessToolDefinition('read_file')!;
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: AGENT_HARNESS_TOOL_DEFINITIONS_V1.map(
        (tool) => tool.name,
      ),
      enableWriteTools: true,
      enableValidationTools: true,
      enableBrowserSmoke: true,
    });
    expect(advertised.map((tool) => tool.name)).toEqual([
      'list_files',
      'read_file',
    ]);
    expect(advertised).toEqual([listFiles, readFile]);

    const executeWithTools = jest.fn().mockResolvedValue({
      output: 'ok',
      tokensUsed: 1,
      model: 'stub',
      finishReason: 'completed',
      toolCalls: [],
    });
    const request = {
      provider: 'openai',
      model: 'gpt-4.1',
      prompt: 'list files',
    };
    const turn0 = mergeAdvertisedToolsIntoExecuteOptions(undefined, advertised);
    const turn1 = mergeAdvertisedToolsIntoExecuteOptions(
      {
        toolResults: [
          {
            callId: 'c1',
            toolName: 'list_files',
            success: true,
            content: { files: [] },
          },
        ],
      },
      advertised,
    );

    await executeWithTools(request, turn0);
    await executeWithTools(request, turn1);

    expect(executeWithTools).toHaveBeenCalledTimes(2);
    expect(executeWithTools.mock.calls[0][1].tools).toEqual(advertised);
    expect(executeWithTools.mock.calls[1][1].tools).toEqual(advertised);
    expect(executeWithTools.mock.calls[1][1].toolResults).toHaveLength(1);
  });

  it('fails closed before provider execution when the advertised set is empty', () => {
    const executeWithTools = jest.fn();

    expect(() => requireNonEmptyAdvertisedHarnessTools([])).toThrow(
      HarnessEmptyAdvertisedToolSetError,
    );
    expect(executeWithTools).not.toHaveBeenCalled();
    expect(
      selectAdvertisedAgentHarnessTools({
        registeredHandlerNames: [],
      }),
    ).toEqual([]);
  });

  it('wires filtered tools into executeWithTools and fails closed on an empty set before the loop', () => {
    const workerSource = getWorkerSource();
    const harnessBranchIndex = workerSource.indexOf('if (useHarness) {');
    const loopIndex = workerSource.indexOf('executeAgentHarnessLoop(loopOptions)');
    const executeWithToolsIndex = workerSource.indexOf(
      'adapter.executeWithTools!(req',
    );
    const selectIndex = workerSource.indexOf(
      'selectAdvertisedAgentHarnessTools(',
      harnessBranchIndex,
    );
    const requireIndex = workerSource.indexOf(
      'requireNonEmptyAdvertisedHarnessTools(',
      harnessBranchIndex,
    );
    const mergeIndex = workerSource.indexOf(
      'mergeAdvertisedToolsIntoExecuteOptions(',
      harnessBranchIndex,
    );

    expect(harnessBranchIndex).toBeGreaterThan(-1);
    expect(requireIndex).toBeGreaterThan(harnessBranchIndex);
    expect(selectIndex).toBeGreaterThan(requireIndex);
    expect(requireIndex).toBeGreaterThan(-1);
    expect(requireIndex).toBeLessThan(loopIndex);
    expect(mergeIndex).toBeGreaterThan(selectIndex);
    expect(executeWithToolsIndex).toBeGreaterThan(harnessBranchIndex);
    expect(workerSource).toContain(
      'executeFn: (req, opts) => adapter.executeWithTools!(req, mergeAdvertisedToolsIntoExecuteOptions(opts, advertisedTools))',
    );
    expect(workerSource).not.toContain(
      'executeFn: (req, opts) => adapter.executeWithTools!(req, opts)',
    );
  });

  it('keeps unsupported adapters fail-closed and does not silently fall back to single-shot', () => {
    const unsupported = resolveHarnessRouting({
      harnessVersion: 'v1',
      enableToolLoop: true,
      adapterSupportsToolUse: false,
      adapterHasExecuteWithTools: false,
    });
    expect(unsupported).toEqual({
      selectedPath: 'fail_closed',
      failReason: 'adapter_lacks_tool_use',
    });

    const workerSource = getWorkerSource();
    expect(workerSource).toContain('HarnessRoutingError');
    expect(workerSource).not.toContain("selectedPath: useHarness ? 'harness' : 'plain'");
    expect(workerSource).toContain("routing.selectedPath === 'fail_closed'");
    expect(workerSource).toContain('throw new HarnessRoutingError');
  });

  it('keeps ordinary non-Harness jobs on the current single-shot path', async () => {
    expect(
      resolveHarnessRouting({
        enableToolLoop: false,
      }),
    ).toEqual({ selectedPath: 'plain' });

    const workerSource = getWorkerSource();
    const mergeIndex = workerSource.indexOf(
      'mergeAdvertisedToolsIntoExecuteOptions(',
    );
    const plainExecuteIndex = workerSource.lastIndexOf(
      'this.aiExecutionService.execute(executionRequest)',
    );
    expect(mergeIndex).toBeGreaterThan(-1);
    expect(plainExecuteIndex).toBeGreaterThan(mergeIndex);
    expect(workerSource.substring(plainExecuteIndex)).not.toContain(
      'mergeAdvertisedToolsIntoExecuteOptions',
    );
    expect(workerSource).toContain('} else {');
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
  });

  it('does not let resolved builder configuration advertise mutation tools or bypass the global gate', () => {
    const workerSource = getWorkerSource();
    const routingCallMatch = workerSource.match(
      /const routing = resolveHarnessRouting\(\{[\s\S]*?\}\);/,
    );
    expect(routingCallMatch).not.toBeNull();
    expect(routingCallMatch![0]).toContain(
      'enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop',
    );
    expect(routingCallMatch![0]).not.toContain('resolvedConfig.enableToolLoop');

    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: [
        'list_files',
        'read_file',
        'write_file',
        'delete_file',
        'run_validation',
        'browser_smoke',
      ],
      enableWriteTools: true,
      enableValidationTools: true,
      enableBrowserSmoke: true,
    });
    expect(advertised.map((tool) => tool.name)).toEqual([
      'list_files',
      'read_file',
    ]);
  });
});

describe('AGENT-PLATFORM-EXEC-01C4B: persisted agent identity in worker logs and final metadata', () => {
  const CANONICAL_EXECUTION_ID = 'exec-canonical-01C4B';
  const DISTINCT_SESSION_ID = 'sess-workspace-01C4B';
  const CANONICAL_AGENT_ID = '  persisted-agent-01C4B  ';
  const STALE_AGENT_ID = 'stale-metadata-agent-01C4B';
  const originalRedisUrl = process.env.REDIS_URL;
  const originalStuckScan = process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;

  function parseLoggedJsonEvents(
    logSpy: jest.SpyInstance,
    eventName: string,
  ): Array<Record<string, unknown>> {
    return logSpy.mock.calls
      .map((args) => args[0])
      .filter((message): message is string => typeof message === 'string')
      .map((message) => {
        try {
          return JSON.parse(message) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((payload): payload is Record<string, unknown> => {
        return payload !== null && payload.event === eventName;
      });
  }

  function createLedgerMock(existingMetadata: Record<string, unknown> = {}) {
    const status = { value: 'pending' };
    const completedUpdates: unknown[][] = [];
    const failedUpdates: unknown[][] = [];
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (
        sql.includes("SET execution_status = 'running'") &&
        sql.includes('RETURNING')
      ) {
        if (status.value === 'pending') {
          status.value = 'running';
          return [{ execution_id: params[0] }];
        }
        return [];
      }
      if (sql.includes("SET execution_status = 'completed'")) {
        completedUpdates.push(params);
        status.value = 'completed';
        return [];
      }
      if (sql.includes("SET execution_status = 'failed'")) {
        failedUpdates.push(params);
        if (sql.includes('RETURNING') && status.value === 'running') {
          status.value = 'failed';
          return [{ execution_id: params[0] }];
        }
        status.value = 'failed';
        return [];
      }
      if (sql.includes('SELECT execution_status, created_at')) {
        return [
          {
            execution_status: status.value,
            created_at: new Date().toISOString(),
          },
        ];
      }
      if (sql.includes('SELECT execution_id, timestamp')) {
        return [];
      }
      if (sql.includes('SELECT metadata')) {
        return [{ metadata: existingMetadata }];
      }
      if (sql.includes('SELECT execution_status')) {
        return [{ execution_status: status.value }];
      }
      return [];
    });
    return { query, status, completedUpdates, failedUpdates };
  }

  async function startWorker(deps: {
    query: jest.Mock;
    execute: jest.Mock;
    publisher: {
      publishCompletion: jest.Mock;
      publishToken: jest.Mock;
      publishFileActions: jest.Mock;
    };
    apiGateway: { notifyExecutionComplete: jest.Mock };
  }) {
    const worker = new WorkerProcessor(
      { query: deps.query } as never,
      { execute: deps.execute, getAdapter: jest.fn() } as never,
      deps.publisher as never,
      deps.apiGateway as never,
    );
    await worker.onModuleInit();
    if (!capturedWorker.processor) {
      throw new Error('BullMQ worker processor was not captured');
    }
    return {
      worker,
      processJob: capturedWorker.processor,
    };
  }

  function createPlainJob(overrides?: Record<string, unknown>) {
    return {
      id: `job-${CANONICAL_EXECUTION_ID}`,
      data: {
        executionId: CANONICAL_EXECUTION_ID,
        provider: 'xai',
        adapter: 'xai',
        sessionId: DISTINCT_SESSION_ID,
        conversationId: 'conv-1',
        userId: 'user-1',
        prompt: 'Create index.html',
        model: 'grok-4.5',
        executionIntent: 'conversation',
        ...overrides,
      },
    };
  }

  function parseMetadataParam(params: unknown[] | undefined): Record<string, unknown> {
    expect(params).toBeDefined();
    expect(params!.length).toBeGreaterThanOrEqual(3);
    return JSON.parse(String(params![2])) as Record<string, unknown>;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = '600000';
    capturedWorker.processor = null;
    capturedWorker.opts = null;
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
    if (originalStuckScan === undefined) {
      delete process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;
    } else {
      process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = originalStuckScan;
    }
  });

  it('emits the exact queue agentId on agent_harness.route_evaluated for a bound job', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    const ledger = createLedgerMock();
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockResolvedValue({
        output: 'ok',
        tokensUsed: 3,
        model: 'grok-4.5',
      }),
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: { notifyExecutionComplete: jest.fn().mockResolvedValue(undefined) },
    });

    await processJob(createPlainJob({ agentId: CANONICAL_AGENT_ID }));
    const routeEvents = parseLoggedJsonEvents(logSpy, 'agent_harness.route_evaluated');
    expect(routeEvents).toHaveLength(1);
    expect(routeEvents[0].agentId).toBe(CANONICAL_AGENT_ID);
    expect(routeEvents[0].executionId).toBe(CANONICAL_EXECUTION_ID);
    expect(routeEvents[0].agentId).not.toBe(DISTINCT_SESSION_ID);
    expect(routeEvents[0]).not.toHaveProperty('prompt');
    expect(routeEvents[0]).not.toHaveProperty('agentRole');
    logSpy.mockRestore();
    await worker.onModuleDestroy();
  });

  it('emits null agentId on agent_harness.route_evaluated for an unbound job', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    const ledger = createLedgerMock();
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockResolvedValue({
        output: 'ok',
        tokensUsed: 3,
        model: 'grok-4.5',
      }),
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: { notifyExecutionComplete: jest.fn().mockResolvedValue(undefined) },
    });

    await processJob(createPlainJob());
    const routeEvents = parseLoggedJsonEvents(logSpy, 'agent_harness.route_evaluated');
    expect(routeEvents).toHaveLength(1);
    expect(routeEvents[0]).toHaveProperty('agentId', null);
    expect(routeEvents[0].agentId).not.toBe(CANONICAL_EXECUTION_ID);
    expect(routeEvents[0].agentId).not.toBe(DISTINCT_SESSION_ID);
    logSpy.mockRestore();
    await worker.onModuleDestroy();
  });

  it('records queue identity or null on agent_harness.config_resolved using the same expression as route_evaluated', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const routeStart = workerSource.indexOf("event: 'agent_harness.route_evaluated'");
    const routeBlock = workerSource.substring(routeStart, routeStart + 500);
    const configStart = workerSource.indexOf("event: 'agent_harness.config_resolved'");
    const configBlock = workerSource.substring(configStart, configStart + 500);
    expect(routeBlock).toContain('agentId: job.data.agentId ?? null');
    expect(configBlock).toContain('agentId: job.data.agentId ?? null');
    expect(configBlock).not.toMatch(/\bprompt\s*:/);
    expect(configBlock).not.toMatch(/\bagentRole\s*:/);
    expect(configBlock).not.toMatch(/\bglobalInstructions\s*:/);

    const boundJob = { data: { agentId: CANONICAL_AGENT_ID } };
    const unboundJob = { data: { agentId: undefined as string | undefined } };
    const boundPayload = {
      event: 'agent_harness.config_resolved',
      agentId: boundJob.data.agentId ?? null,
    };
    const unboundPayload = {
      event: 'agent_harness.config_resolved',
      agentId: unboundJob.data.agentId ?? null,
    };
    expect(boundPayload.agentId).toBe(CANONICAL_AGENT_ID);
    expect(unboundPayload.agentId).toBeNull();
  });

  it('writes the exact queue agentId into completed final metadata', async () => {
    const ledger = createLedgerMock({ keepMe: 'unrelated-value' });
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockResolvedValue({
        output: 'ok',
        tokensUsed: 3,
        model: 'grok-4.5',
      }),
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: { notifyExecutionComplete: jest.fn().mockResolvedValue(undefined) },
    });

    await processJob(createPlainJob({ agentId: CANONICAL_AGENT_ID }));
    expect(ledger.status.value).toBe('completed');
    const metadata = parseMetadataParam(ledger.completedUpdates[0]);
    expect(metadata.agentId).toBe(CANONICAL_AGENT_ID);
    expect(metadata.keepMe).toBe('unrelated-value');
    expect(metadata.agentId).not.toBe(DISTINCT_SESSION_ID);
    expect(metadata.agentId).not.toBe(CANONICAL_EXECUTION_ID);
    await worker.onModuleDestroy();
  });

  it('lets queue identity override stale existing metadata agentId', async () => {
    const ledger = createLedgerMock({
      agentId: STALE_AGENT_ID,
      keepMe: 'unrelated-value',
    });
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockResolvedValue({
        output: 'ok',
        tokensUsed: 3,
        model: 'grok-4.5',
      }),
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: { notifyExecutionComplete: jest.fn().mockResolvedValue(undefined) },
    });

    await processJob(createPlainJob({ agentId: CANONICAL_AGENT_ID }));
    const metadata = parseMetadataParam(ledger.completedUpdates[0]);
    expect(metadata.agentId).toBe(CANONICAL_AGENT_ID);
    expect(metadata.agentId).not.toBe(STALE_AGENT_ID);
    expect(metadata.keepMe).toBe('unrelated-value');
    await worker.onModuleDestroy();
  });

  it('preserves the exact queue agentId on contract-failure finalization', async () => {
    const ledger = createLedgerMock({ keepMe: 'unrelated-value' });
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockResolvedValue({
        output: 'ok',
        tokensUsed: 3,
        model: 'grok-4.5',
        fileActions: [],
      }),
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: { notifyExecutionComplete: jest.fn().mockResolvedValue(undefined) },
    });

    await processJob(
      createPlainJob({
        agentId: CANONICAL_AGENT_ID,
        executionIntent: 'workspace_mutation',
      }),
    );
    expect(ledger.status.value).toBe('failed');
    const metadataUpdate = ledger.failedUpdates.find(
      (params) => params.length >= 3 && typeof params[2] === 'string',
    );
    const metadata = parseMetadataParam(metadataUpdate);
    expect(metadata.agentId).toBe(CANONICAL_AGENT_ID);
    expect(metadata.keepMe).toBe('unrelated-value');
    expect(metadata.executionError).toEqual(
      expect.objectContaining({
        code: expect.any(String),
      }),
    );
    await worker.onModuleDestroy();
  });

  it('does not invent an agentId for ordinary unbound completed metadata', async () => {
    const ledger = createLedgerMock({ keepMe: 'unrelated-value' });
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockResolvedValue({
        output: 'ok',
        tokensUsed: 3,
        model: 'grok-4.5',
      }),
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: { notifyExecutionComplete: jest.fn().mockResolvedValue(undefined) },
    });

    await processJob(createPlainJob());
    expect(ledger.status.value).toBe('completed');
    const metadata = parseMetadataParam(ledger.completedUpdates[0]);
    expect(metadata).not.toHaveProperty('agentId');
    expect(metadata.keepMe).toBe('unrelated-value');
    await worker.onModuleDestroy();
  });
});

/**
 * AGENT-PLATFORM-EXEC-01C5B2 Cycle A — queue-contract canonicalization.
 * Expected digest/signature are hardcoded frozen constants, not derived from production
 * or imported from Gateway.
 */
describe('AGENT-PLATFORM-EXEC-01C5B2 Cycle A — canonicalization pipeline', () => {
  const GOLDEN_SECRET = 'test-hmac-secret-do-not-use-in-production-01c5b';
  const GOLDEN_ISSUED_AT = '2026-09-05T12:00:00.000Z';
  const GOLDEN_INSERTION_ORDER_JSON =
    '{"executionId":"exec-golden-01","userId":"user-golden-01","apiKeyId":"apikey-golden-01","sessionId":"session-golden-01","conversationId":"conv-golden-01","provider":"anthropic","adapter":"anthropic","prompt":"Hello, world.","submittedAt":"2026-09-05T12:00:00.000Z","harnessVersion":"v1"}';
  const GOLDEN_CANONICAL_JSON =
    '{"adapter":"anthropic","apiKeyId":"apikey-golden-01","conversationId":"conv-golden-01","executionId":"exec-golden-01","harnessVersion":"v1","prompt":"Hello, world.","provider":"anthropic","sessionId":"session-golden-01","submittedAt":"2026-09-05T12:00:00.000Z","userId":"user-golden-01"}';
  const GOLDEN_PAYLOAD_DIGEST =
    '8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a';
  const GOLDEN_CLAIM_STRING =
    'v=1|executionId=exec-golden-01|userId=user-golden-01|apiKeyId=apikey-golden-01|harnessVersion=v1|issuedAt=2026-09-05T12:00:00.000Z|payloadDigest=8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a';
  const GOLDEN_SIGNATURE =
    'd247e17634be269b0bbef1eb843a65bf299935ea840853900fe5dda3d8ef11b5';

  function makeGoldenPayload(): Record<string, unknown> {
    return {
      executionId: 'exec-golden-01',
      userId: 'user-golden-01',
      apiKeyId: 'apikey-golden-01',
      sessionId: 'session-golden-01',
      conversationId: 'conv-golden-01',
      provider: 'anthropic',
      adapter: 'anthropic',
      prompt: 'Hello, world.',
      submittedAt: GOLDEN_ISSUED_AT,
      harnessVersion: 'v1',
    };
  }

  function makeGoldenProof(): Record<string, unknown> {
    return {
      version: 1,
      executionId: 'exec-golden-01',
      userId: 'user-golden-01',
      apiKeyId: 'apikey-golden-01',
      harnessVersion: 'v1',
      issuedAt: GOLDEN_ISSUED_AT,
      payloadDigest: GOLDEN_PAYLOAD_DIGEST,
      signature: GOLDEN_SIGNATURE,
    };
  }

  function parseOwnKeyObject(json: string): Record<string, unknown> {
    return JSON.parse(json) as Record<string, unknown>;
  }

  function hasOwn(obj: object, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  it('independently recomputes frozen golden digest, claim HMAC, and SHA-256 lowercase hex with Node crypto', () => {
    const independentDigest = createHash('sha256')
      .update(GOLDEN_CANONICAL_JSON, 'utf8')
      .digest('hex');
    expect(independentDigest).toBe(GOLDEN_PAYLOAD_DIGEST);
    expect(independentDigest).toBe(independentDigest.toLowerCase());
    expect(independentDigest).toMatch(/^[0-9a-f]{64}$/);

    const independentHmac = createHmac('sha256', GOLDEN_SECRET)
      .update(GOLDEN_CLAIM_STRING, 'utf8')
      .digest('hex');
    expect(independentHmac).toBe(GOLDEN_SIGNATURE);
    expect(independentHmac).toBe(independentHmac.toLowerCase());
  });

  it('recursively sorts object keys using Object.keys().sort()', () => {
    const sorted = sortKeysRecursive({
      z: { b: 1, a: 2 },
      m: 3,
    });
    expect(JSON.stringify(sorted)).toBe('{"m":3,"z":{"a":2,"b":1}}');
  });

  it('preserves array element order while sorting nested object keys', () => {
    const sorted = sortKeysRecursive({
      items: [
        { b: 1, a: 2 },
        { d: 4, c: 3 },
      ],
    });
    expect(JSON.stringify(sorted)).toBe(
      '{"items":[{"a":2,"b":1},{"c":3,"d":4}]}',
    );
  });

  it('creates every sorted object with a null prototype accumulator', () => {
    const sorted = sortKeysRecursive({
      z: { b: 1, a: 2 },
      m: [{ d: 4, c: 3 }],
    }) as Record<string, unknown>;
    expect(Object.getPrototypeOf(sorted)).toBeNull();
    expect(Object.getPrototypeOf(sorted.z as object)).toBeNull();
    const items = sorted.m as unknown[];
    expect(Object.getPrototypeOf(items[0] as object)).toBeNull();
  });

  it('applies native JSON.stringify then fail-closed then JSON.parse before sorting', () => {
    const payload = {
      b: 2,
      a: 1,
      skip: undefined,
    };
    const jsonStr = JSON.stringify(payload);
    expect(jsonStr).not.toBeUndefined();
    const roundTripped = JSON.parse(jsonStr);
    expect(Object.prototype.hasOwnProperty.call(roundTripped, 'skip')).toBe(
      false,
    );
    const canonicalJson = JSON.stringify(sortKeysRecursive(roundTripped));
    expect(canonicalJson).toBe('{"a":1,"b":2}');
  });

  it('fails closed when JSON.stringify throws on a cyclic payload', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => computePayloadDigest(cyclic)).toThrow();
  });

  it('fails closed when JSON.stringify returns undefined', () => {
    expect(() =>
      computePayloadDigest(undefined as unknown as Record<string, unknown>),
    ).toThrow(/undefined/);
  });

  it('omits undefined object properties from canonical JSON', () => {
    const result = computePayloadDigest({
      a: 1,
      b: undefined,
      c: 2,
    } as Record<string, unknown>);
    expect(result.canonicalJson).toBe('{"a":1,"c":2}');
  });

  it('preserves an own __proto__ object value in canonical JSON', () => {
    const input = parseOwnKeyObject(
      '{"z":1,"__proto__":{"polluted":true},"a":2}',
    );
    expect(hasOwn(input, '__proto__')).toBe(true);

    const sorted = sortKeysRecursive(input) as object;
    expect(hasOwn(sorted, '__proto__')).toBe(true);
    expect(JSON.stringify(sorted)).toBe(
      '{"__proto__":{"polluted":true},"a":2,"z":1}',
    );
    expect(Object.getPrototypeOf(sorted)).toBeNull();

    const result = computePayloadDigest(input);
    expect(result.canonicalJson).toBe(
      '{"__proto__":{"polluted":true},"a":2,"z":1}',
    );
    const parsedCanonical = JSON.parse(result.canonicalJson) as object;
    expect(hasOwn(parsedCanonical, '__proto__')).toBe(true);
  });

  it('preserves own constructor and prototype keys', () => {
    const input = parseOwnKeyObject(
      '{"z":1,"constructor":{"keep":true},"prototype":{"also":true},"a":2}',
    );
    const sorted = sortKeysRecursive(input) as object;
    expect(hasOwn(sorted, 'constructor')).toBe(true);
    expect(hasOwn(sorted, 'prototype')).toBe(true);
    expect(JSON.stringify(sorted)).toBe(
      '{"a":2,"constructor":{"keep":true},"prototype":{"also":true},"z":1}',
    );
    expect(Object.getPrototypeOf(sorted)).toBeNull();
  });

  it('preserves nested own __proto__ properties recursively', () => {
    const input = parseOwnKeyObject(
      '{"z":1,"inner":{"__proto__":{"nested":true},"b":2},"a":3}',
    );
    const sorted = sortKeysRecursive(input) as Record<string, unknown>;
    const inner = sorted.inner as object;
    expect(hasOwn(inner, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(inner)).toBeNull();
    expect(JSON.stringify(sorted)).toBe(
      '{"a":3,"inner":{"__proto__":{"nested":true},"b":2},"z":1}',
    );
  });

  it('does not mutate the input object during canonicalization', () => {
    const input = makeGoldenPayload();
    const snapshot = JSON.stringify(input);
    computePayloadDigest(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(Object.keys(input)).toEqual([
      'executionId',
      'userId',
      'apiKeyId',
      'sessionId',
      'conversationId',
      'provider',
      'adapter',
      'prompt',
      'submittedAt',
      'harnessVersion',
    ]);
  });

  it('changes payloadDigest when any unsigned payload field changes', () => {
    const baseline = computePayloadDigest(makeGoldenPayload());
    expect(baseline.payloadDigest).toBe(GOLDEN_PAYLOAD_DIGEST);

    const promptChanged = computePayloadDigest({
      ...makeGoldenPayload(),
      prompt: 'Malicious prompt',
    });
    expect(promptChanged.payloadDigest).not.toBe(GOLDEN_PAYLOAD_DIGEST);

    const sessionChanged = computePayloadDigest({
      ...makeGoldenPayload(),
      sessionId: 'session-tampered-01',
    });
    expect(sessionChanged.payloadDigest).not.toBe(GOLDEN_PAYLOAD_DIGEST);

    const modelAdded = computePayloadDigest({
      ...makeGoldenPayload(),
      model: 'gpt-4o',
    });
    expect(modelAdded.payloadDigest).not.toBe(GOLDEN_PAYLOAD_DIGEST);
  });

  it('canonicalizes the complete job payload excluding only harnessEntitlementProof', () => {
    const jobWithProof = {
      ...makeGoldenPayload(),
      harnessEntitlementProof: makeGoldenProof(),
    };
    const withProof = computeJobPayloadDigest(jobWithProof);
    const withoutProof = computeJobPayloadDigest(makeGoldenPayload());
    expect(withProof.canonicalJson).toBe(GOLDEN_CANONICAL_JSON);
    expect(withoutProof.canonicalJson).toBe(GOLDEN_CANONICAL_JSON);
    expect(withProof.payloadDigest).toBe(GOLDEN_PAYLOAD_DIGEST);
    expect(withoutProof.payloadDigest).toBe(GOLDEN_PAYLOAD_DIGEST);
    expect(withProof.canonicalJson).not.toContain('harnessEntitlementProof');
    expect(JSON.stringify(jobWithProof)).toContain('harnessEntitlementProof');
  });

  it('matches frozen golden insertion-order JSON, canonical JSON, and SHA-256 digest byte-for-byte', () => {
    const payload = makeGoldenPayload();
    expect(JSON.stringify(payload)).toBe(GOLDEN_INSERTION_ORDER_JSON);
    const result = computePayloadDigest(payload);
    expect(result.canonicalJson).toBe(GOLDEN_CANONICAL_JSON);
    expect(result.payloadDigest).toBe(GOLDEN_PAYLOAD_DIGEST);
  });
});

/**
 * AGENT-PLATFORM-EXEC-01C5B2 Cycle B — pure proof verification.
 * Hardcoded frozen constants only. Do not import Gateway helpers.
 */
describe('AGENT-PLATFORM-EXEC-01C5B2 Cycle B — proof verification', () => {
  const GOLDEN_SECRET = 'test-hmac-secret-do-not-use-in-production-01c5b';
  const GOLDEN_ISSUED_AT = '2026-09-05T12:00:00.000Z';
  const GOLDEN_PAYLOAD_DIGEST =
    '8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a';
  const GOLDEN_CLAIM_STRING =
    'v=1|executionId=exec-golden-01|userId=user-golden-01|apiKeyId=apikey-golden-01|harnessVersion=v1|issuedAt=2026-09-05T12:00:00.000Z|payloadDigest=8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a';
  const GOLDEN_SIGNATURE =
    'd247e17634be269b0bbef1eb843a65bf299935ea840853900fe5dda3d8ef11b5';
  const WRONG_SECRET_SIGNATURE =
    '5d0c4ee5d963d1c38f1351053f601a8ca8e730a82ac9a9352052af5b1bd8baaf';

  const CODES = {
    MISSING: 'HARNESS_ENTITLEMENT_PROOF_MISSING',
    MALFORMED: 'HARNESS_ENTITLEMENT_PROOF_MALFORMED',
    UNSUPPORTED_VERSION: 'HARNESS_ENTITLEMENT_PROOF_UNSUPPORTED_VERSION',
    BINDING_MISMATCH: 'HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH',
    PAYLOAD_INTEGRITY_MISMATCH:
      'HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH',
    INVALID_SIGNATURE: 'HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE',
    SECRET_NOT_CONFIGURED: 'HARNESS_ENTITLEMENT_PROOF_SECRET_NOT_CONFIGURED',
  } as const;

  function makeGoldenPayload(): Record<string, unknown> {
    return {
      executionId: 'exec-golden-01',
      userId: 'user-golden-01',
      apiKeyId: 'apikey-golden-01',
      sessionId: 'session-golden-01',
      conversationId: 'conv-golden-01',
      provider: 'anthropic',
      adapter: 'anthropic',
      prompt: 'Hello, world.',
      submittedAt: GOLDEN_ISSUED_AT,
      harnessVersion: 'v1',
    };
  }

  function makeGoldenProof(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      version: 1,
      executionId: 'exec-golden-01',
      userId: 'user-golden-01',
      apiKeyId: 'apikey-golden-01',
      harnessVersion: 'v1',
      issuedAt: GOLDEN_ISSUED_AT,
      payloadDigest: GOLDEN_PAYLOAD_DIGEST,
      signature: GOLDEN_SIGNATURE,
      ...overrides,
    };
  }

  function makeGoldenJob(
    jobOverrides: Record<string, unknown> = {},
    proofOverrides?: Record<string, unknown> | null,
  ): Record<string, unknown> {
    const job: Record<string, unknown> = {
      ...makeGoldenPayload(),
      ...jobOverrides,
    };
    if (proofOverrides === null) {
      return job;
    }
    if (
      Object.prototype.hasOwnProperty.call(
        jobOverrides,
        'harnessEntitlementProof',
      )
    ) {
      return job;
    }
    job.harnessEntitlementProof = makeGoldenProof(proofOverrides);
    return job;
  }

  function parseOwnKeyObject(json: string): Record<string, unknown> {
    return JSON.parse(json) as Record<string, unknown>;
  }

  function expectEntitlementError(
    job: Record<string, unknown>,
    code: string,
  ): HarnessEntitlementError {
    let caught: unknown;
    try {
      verifyHarnessEntitlementProof(job);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HarnessEntitlementError);
    const typed = caught as HarnessEntitlementError;
    expect(typed.name).toBe('HarnessEntitlementError');
    expect(typed.code).toBe(code);
    expect(typed.isRetryable).toBe(false);
    expect(typed.message).toContain(code);
    expect(typed.message).not.toContain(GOLDEN_SECRET);
    expect(typed.message).not.toContain(GOLDEN_SIGNATURE);
    expect(typed.message).not.toMatch(/Hello, world/);
    expect(typed.message).not.toContain('persona');
    return typed;
  }

  const previousSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;

  beforeEach(() => {
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = GOLDEN_SECRET;
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    } else {
      process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = previousSecret;
    }
  });

  it('accepts the hardcoded frozen golden cross-service vector', () => {
    expect(() => verifyHarnessEntitlementProof(makeGoldenJob())).not.toThrow();
  });

  it('reconstructs the frozen claim string and compares HMAC with timingSafeEqual', () => {
    const timingSafeSpy = jest.spyOn(
      require('crypto') as typeof import('crypto'),
      'timingSafeEqual',
    );
    try {
      verifyHarnessEntitlementProof(makeGoldenJob());
      expect(timingSafeSpy).toHaveBeenCalled();
      const [left, right] = timingSafeSpy.mock.calls[0];
      expect(Buffer.isBuffer(left)).toBe(true);
      expect(Buffer.isBuffer(right)).toBe(true);
      expect((left as Buffer).length).toBe((right as Buffer).length);
      expect(timingSafeEqual(left as Buffer, right as Buffer)).toBe(true);
      const independent = createHmac('sha256', GOLDEN_SECRET)
        .update(GOLDEN_CLAIM_STRING, 'utf8')
        .digest('hex');
      expect(independent).toBe(GOLDEN_SIGNATURE);
    } finally {
      timingSafeSpy.mockRestore();
    }
  });

  it('does not require proof for ordinary jobs without harnessVersion', () => {
    delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    const ordinary = makeGoldenPayload();
    delete ordinary.harnessVersion;
    expect(() => verifyHarnessEntitlementProof(ordinary)).not.toThrow();
  });

  it('rejects missing proof on a v1 job', () => {
    expectEntitlementError(makeGoldenJob({}, null), CODES.MISSING);
  });

  it('rejects a boolean proof as malformed', () => {
    expectEntitlementError(
      makeGoldenJob({ harnessEntitlementProof: true }),
      CODES.MALFORMED,
    );
  });

  it('rejects an array proof as malformed', () => {
    expectEntitlementError(
      makeGoldenJob({ harnessEntitlementProof: [] }),
      CODES.MALFORMED,
    );
  });

  it('rejects an empty proof object as malformed', () => {
    expectEntitlementError(
      makeGoldenJob({ harnessEntitlementProof: {} }),
      CODES.MALFORMED,
    );
  });

  it('rejects a non-numeric version as malformed when all other fields are valid', () => {
    expectEntitlementError(
      makeGoldenJob({}, { version: '1' }),
      CODES.MALFORMED,
    );
  });

  it('rejects proof version 2 as unsupported when all other fields are valid', () => {
    expectEntitlementError(
      makeGoldenJob({}, { version: 2 }),
      CODES.UNSUPPORTED_VERSION,
    );
  });

  it('rejects empty required string fields as malformed', () => {
    expectEntitlementError(
      makeGoldenJob({}, { issuedAt: '' }),
      CODES.MALFORMED,
    );
  });

  it('rejects a proof harnessVersion other than v1 as malformed', () => {
    expectEntitlementError(
      makeGoldenJob({}, { harnessVersion: 'v2' }),
      CODES.MALFORMED,
    );
  });

  it('rejects a non-hex payloadDigest as malformed', () => {
    expectEntitlementError(
      makeGoldenJob({}, { payloadDigest: 'not-a-digest' }),
      CODES.MALFORMED,
    );
  });

  it('rejects uppercase signature as malformed before timingSafeEqual', () => {
    const timingSafeSpy = jest.spyOn(
      require('crypto') as typeof import('crypto'),
      'timingSafeEqual',
    );
    try {
      expectEntitlementError(
        makeGoldenJob({}, { signature: GOLDEN_SIGNATURE.toUpperCase() }),
        CODES.MALFORMED,
      );
      expect(timingSafeSpy).not.toHaveBeenCalled();
    } finally {
      timingSafeSpy.mockRestore();
    }
  });

  it('rejects a wrong-length signature as malformed before timingSafeEqual', () => {
    const timingSafeSpy = jest.spyOn(
      require('crypto') as typeof import('crypto'),
      'timingSafeEqual',
    );
    try {
      expectEntitlementError(
        makeGoldenJob({}, { signature: 'abcd' }),
        CODES.MALFORMED,
      );
      expect(timingSafeSpy).not.toHaveBeenCalled();
    } finally {
      timingSafeSpy.mockRestore();
    }
  });

  it('rejects execution-id substitution with binding mismatch', () => {
    expectEntitlementError(
      makeGoldenJob({ executionId: 'exec-tampered-01' }),
      CODES.BINDING_MISMATCH,
    );
  });

  it('rejects user-id substitution with binding mismatch', () => {
    expectEntitlementError(
      makeGoldenJob({ userId: 'user-tampered-01' }),
      CODES.BINDING_MISMATCH,
    );
  });

  it('rejects api-key-id substitution with binding mismatch', () => {
    expectEntitlementError(
      makeGoldenJob({ apiKeyId: 'apikey-tampered-01' }),
      CODES.BINDING_MISMATCH,
    );
  });

  it('rejects prompt modification with payload integrity mismatch', () => {
    expectEntitlementError(
      makeGoldenJob({ prompt: 'Malicious prompt' }),
      CODES.PAYLOAD_INTEGRITY_MISMATCH,
    );
  });

  it('rejects an added model field with payload integrity mismatch', () => {
    expectEntitlementError(
      makeGoldenJob({ model: 'gpt-4o' }),
      CODES.PAYLOAD_INTEGRITY_MISMATCH,
    );
  });

  it('rejects session-id modification with payload integrity mismatch', () => {
    expectEntitlementError(
      makeGoldenJob({ sessionId: 'session-tampered-01' }),
      CODES.PAYLOAD_INTEGRITY_MISMATCH,
    );
  });

  it('rejects provider modification with payload integrity mismatch', () => {
    expectEntitlementError(
      makeGoldenJob({ provider: 'openai' }),
      CODES.PAYLOAD_INTEGRITY_MISMATCH,
    );
  });

  it('rejects own __proto__ modification with payload integrity mismatch', () => {
    const job = makeGoldenJob();
    const withProto = parseOwnKeyObject(
      '{"executionId":"exec-golden-01","userId":"user-golden-01","apiKeyId":"apikey-golden-01","sessionId":"session-golden-01","conversationId":"conv-golden-01","provider":"anthropic","adapter":"anthropic","prompt":"Hello, world.","submittedAt":"2026-09-05T12:00:00.000Z","harnessVersion":"v1","__proto__":{"polluted":true}}',
    );
    withProto.harnessEntitlementProof = job.harnessEntitlementProof;
    expectEntitlementError(withProto, CODES.PAYLOAD_INTEGRITY_MISMATCH);
  });

  it('rejects nested __proto__ modification with payload integrity mismatch', () => {
    const job = makeGoldenJob();
    const nested = parseOwnKeyObject(
      '{"executionId":"exec-golden-01","userId":"user-golden-01","apiKeyId":"apikey-golden-01","sessionId":"session-golden-01","conversationId":"conv-golden-01","provider":"anthropic","adapter":"anthropic","prompt":"Hello, world.","submittedAt":"2026-09-05T12:00:00.000Z","harnessVersion":"v1","inner":{"__proto__":{"nested":true}}}',
    );
    nested.harnessEntitlementProof = job.harnessEntitlementProof;
    expectEntitlementError(nested, CODES.PAYLOAD_INTEGRITY_MISMATCH);
  });

  it('rejects a well-formed wrong signature as invalid signature', () => {
    expectEntitlementError(
      makeGoldenJob(
        {},
        {
          signature:
            '0000000000000000000000000000000000000000000000000000000000000000',
        },
      ),
      CODES.INVALID_SIGNATURE,
    );
  });

  it('rejects a signature produced with the wrong secret', () => {
    expectEntitlementError(
      makeGoldenJob({}, { signature: WRONG_SECRET_SIGNATURE }),
      CODES.INVALID_SIGNATURE,
    );
  });

  it('fails closed when the worker HMAC secret is missing', () => {
    delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    expectEntitlementError(makeGoldenJob(), CODES.SECRET_NOT_CONFIGURED);
  });

  it('fails closed when the worker HMAC secret is empty', () => {
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = '';
    expectEntitlementError(makeGoldenJob(), CODES.SECRET_NOT_CONFIGURED);
  });

  it('fails closed when the worker HMAC secret is whitespace-only', () => {
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = '   \t  ';
    expectEntitlementError(makeGoldenJob(), CODES.SECRET_NOT_CONFIGURED);
  });

  it('never includes the secret, signature, proof, canonical payload, or prompt in error text', () => {
    const error = expectEntitlementError(
      makeGoldenJob({ prompt: 'Malicious prompt' }),
      CODES.PAYLOAD_INTEGRITY_MISMATCH,
    );
    expect(JSON.stringify(error)).not.toContain(GOLDEN_SECRET);
    expect(JSON.stringify(error)).not.toContain(GOLDEN_SIGNATURE);
    expect(JSON.stringify(error)).not.toContain('Malicious prompt');
    expect(JSON.stringify(error)).not.toContain(GOLDEN_PAYLOAD_DIGEST);
  });

  it('does not inspect expiry or revalidate entitlement after enqueue', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf8',
    );
    const verifyStart = source.indexOf(
      'export function verifyHarnessEntitlementProof',
    );
    const verifyEnd = source.indexOf('export class WorkerProcessor');
    const verifyBody = source.slice(verifyStart, verifyEnd);
    expect(verifyStart).toBeGreaterThan(-1);
    expect(verifyBody).not.toMatch(/expir/i);
    expect(verifyBody).not.toMatch(/harnessEntitled/);
    expect(verifyBody).not.toMatch(/revok/i);
  });

  it('wraps cyclic payload serialization as a typed non-retryable entitlement error', () => {
    const job = makeGoldenJob();
    job.loop = job;
    const error = expectEntitlementError(
      job,
      CODES.PAYLOAD_INTEGRITY_MISMATCH,
    );
    expect(error).not.toBeInstanceOf(TypeError);
  });

  it('wraps HMAC crypto failures as invalid signature instead of leaking raw errors', () => {
    const hmacSpy = jest
      .spyOn(require('crypto') as typeof import('crypto'), 'createHmac')
      .mockImplementation(() => {
        throw new RangeError('hmac boom');
      });
    try {
      const error = expectEntitlementError(
        makeGoldenJob(),
        CODES.INVALID_SIGNATURE,
      );
      expect(error).not.toBeInstanceOf(RangeError);
      expect(error.message).not.toContain('hmac boom');
    } finally {
      hmacSpy.mockRestore();
    }
  });
});

/**
 * AGENT-PLATFORM-EXEC-01C5B2 Cycle C — worker guard placement and side-effect ordering.
 */
describe('AGENT-PLATFORM-EXEC-01C5B2 Cycle C — worker integration', () => {
  const GOLDEN_SECRET = 'test-hmac-secret-do-not-use-in-production-01c5b';
  const GOLDEN_ISSUED_AT = '2026-09-05T12:00:00.000Z';
  const GOLDEN_PAYLOAD_DIGEST =
    '8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a';
  const GOLDEN_SIGNATURE =
    'd247e17634be269b0bbef1eb843a65bf299935ea840853900fe5dda3d8ef11b5';

  const originalRedisUrl = process.env.REDIS_URL;
  const originalStuckScan = process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;
  const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;

  function makeGoldenJobData(
    overrides: Record<string, unknown> = {},
    proofOverrides?: Record<string, unknown> | null,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      executionId: 'exec-golden-01',
      userId: 'user-golden-01',
      apiKeyId: 'apikey-golden-01',
      sessionId: 'session-golden-01',
      conversationId: 'conv-golden-01',
      provider: 'anthropic',
      adapter: 'anthropic',
      prompt: 'Hello, world.',
      submittedAt: GOLDEN_ISSUED_AT,
      harnessVersion: 'v1',
      ...overrides,
    };
    if (proofOverrides === null) {
      return data;
    }
    if (
      Object.prototype.hasOwnProperty.call(overrides, 'harnessEntitlementProof')
    ) {
      return data;
    }
    data.harnessEntitlementProof = {
      version: 1,
      executionId: 'exec-golden-01',
      userId: 'user-golden-01',
      apiKeyId: 'apikey-golden-01',
      harnessVersion: 'v1',
      issuedAt: GOLDEN_ISSUED_AT,
      payloadDigest: GOLDEN_PAYLOAD_DIGEST,
      signature: GOLDEN_SIGNATURE,
      ...proofOverrides,
    };
    return data;
  }

  function createLedgerMock(options?: { cancelAfterClaim?: boolean }) {
    const status = { value: 'pending' };
    const failedUpdates: unknown[][] = [];
    const cancelledUpdates: unknown[][] = [];
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (
        sql.includes("SET execution_status = 'running'") &&
        sql.includes('RETURNING')
      ) {
        if (status.value === 'pending') {
          status.value = 'running';
          return [{ execution_id: params[0] }];
        }
        return [];
      }
      if (sql.includes("SET execution_status = 'failed'")) {
        failedUpdates.push(params);
        status.value = 'failed';
        return [];
      }
      if (sql.includes("SET execution_status = 'cancelled'")) {
        cancelledUpdates.push(params);
        status.value = 'cancelled';
        return [];
      }
      if (sql.includes("SET execution_status = 'completed'")) {
        status.value = 'completed';
        return [];
      }
      if (sql.includes('SELECT execution_status, created_at')) {
        return [
          {
            execution_status: options?.cancelAfterClaim
              ? 'cancel_requested'
              : status.value,
            created_at: new Date().toISOString(),
          },
        ];
      }
      if (sql.includes('SELECT execution_id, timestamp')) {
        return [];
      }
      if (sql.includes('SELECT metadata')) {
        return [{ metadata: {} }];
      }
      if (sql.includes('SELECT execution_status')) {
        return [{ execution_status: status.value }];
      }
      return [];
    });
    return { query, status, failedUpdates, cancelledUpdates };
  }

  async function startWorker(deps: {
    query: jest.Mock;
    execute: jest.Mock;
    getAdapter: jest.Mock;
    publisher: {
      publishCompletion: jest.Mock;
      publishToken: jest.Mock;
      publishFileActions: jest.Mock;
    };
    apiGateway: {
      notifyExecutionComplete: jest.Mock;
      createWorkspaceCheckpoint: jest.Mock;
    };
  }) {
    const worker = new WorkerProcessor(
      { query: deps.query } as never,
      { execute: deps.execute, getAdapter: deps.getAdapter } as never,
      deps.publisher as never,
      deps.apiGateway as never,
    );
    await worker.onModuleInit();
    if (!capturedWorker.processor) {
      throw new Error('BullMQ worker processor was not captured');
    }
    return {
      worker,
      processJob: capturedWorker.processor,
    };
  }

  function parseLoggedJsonEvents(
    spies: jest.SpyInstance[],
    eventName: string,
  ): Array<Record<string, unknown>> {
    return spies
      .flatMap((spy) => spy.mock.calls.map((args) => args[0]))
      .filter((message): message is string => typeof message === 'string')
      .map((message) => {
        try {
          return JSON.parse(message) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((payload): payload is Record<string, unknown> => {
        return payload !== null && payload.event === eventName;
      });
  }

  function allLogText(spies: jest.SpyInstance[]): string {
    return spies
      .flatMap((spy) => spy.mock.calls.map((args) => String(args[0])))
      .join('\n');
  }

  let executeLoopSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = '600000';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = GOLDEN_SECRET;
    capturedWorker.processor = null;
    capturedWorker.opts = null;
    executeLoopSpy = jest
      .spyOn(agentHarnessLoop, 'executeAgentHarnessLoop')
      .mockResolvedValue({
        result: { output: 'loop', tokensUsed: 1, model: 'x' },
      } as never);
    logSpy = jest.spyOn(Logger.prototype, 'log');
    errorSpy = jest.spyOn(Logger.prototype, 'error');
    warnSpy = jest.spyOn(Logger.prototype, 'warn');
  });

  afterEach(async () => {
    executeLoopSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    jest.useRealTimers();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
    if (originalStuckScan === undefined) {
      delete process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;
    } else {
      process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = originalStuckScan;
    }
    if (originalSecret === undefined) {
      delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    } else {
      process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = originalSecret;
    }
  });

  it('places verification after cancel pre-check and before resolveHarnessRouting', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const cancelIndex = workerSource.indexOf(
      'Execution cancelled before start',
    );
    const verifyCallIndex = workerSource.indexOf(
      'verifyHarnessEntitlementProof(job.data)',
    );
    const routingIndex = workerSource.indexOf(
      'const routing = resolveHarnessRouting({',
    );
    expect(cancelIndex).toBeGreaterThan(-1);
    expect(verifyCallIndex).toBeGreaterThan(cancelIndex);
    expect(routingIndex).toBeGreaterThan(verifyCallIndex);
  });

  it('lets a valid proof continue to existing disabled-gate routing', async () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
    const ledger = createLedgerMock();
    const execute = jest.fn();
    const getAdapter = jest.fn();
    const createWorkspaceCheckpoint = jest.fn();
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      getAdapter,
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: {
        notifyExecutionComplete: jest.fn(),
        createWorkspaceCheckpoint,
      },
    });

    await expect(
      processJob({ id: 'job-valid-proof', data: makeGoldenJobData() }),
    ).rejects.toBeInstanceOf(HarnessRoutingError);

    const routeEvents = parseLoggedJsonEvents(
      [logSpy],
      'agent_harness.route_evaluated',
    );
    expect(routeEvents).toHaveLength(1);
    expect(routeEvents[0].selectedPath).toBe('fail_closed');
    expect(routeEvents[0].enableToolLoop).toBe(false);
    expect(
      parseLoggedJsonEvents(
        [logSpy],
        'agent_harness.entitlement_verification_failed',
      ),
    ).toHaveLength(0);
    expect(execute).not.toHaveBeenCalled();
    expect(getAdapter).not.toHaveBeenCalled();
    expect(executeLoopSpy).not.toHaveBeenCalled();
    expect(createWorkspaceCheckpoint).not.toHaveBeenCalled();
    await worker.onModuleDestroy();
  });

  it('verifies even while the global Harness tool-loop flag is false and rejects a missing proof before routing', async () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
    const ledger = createLedgerMock();
    const execute = jest.fn();
    const getAdapter = jest.fn();
    const createWorkspaceCheckpoint = jest.fn();
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      getAdapter,
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: {
        notifyExecutionComplete: jest.fn(),
        createWorkspaceCheckpoint,
      },
    });

    await expect(
      processJob({
        id: 'job-missing-proof',
        data: makeGoldenJobData({}, null),
      }),
    ).rejects.toBeInstanceOf(HarnessEntitlementError);

    expect(ledger.status.value).toBe('failed');
    expect(
      parseLoggedJsonEvents([logSpy], 'agent_harness.route_evaluated'),
    ).toHaveLength(0);
    const failureEvents = parseLoggedJsonEvents(
      [logSpy],
      'agent_harness.entitlement_verification_failed',
    );
    expect(failureEvents).toHaveLength(1);
    expect(failureEvents[0].errorCode).toBe(
      'HARNESS_ENTITLEMENT_PROOF_MISSING',
    );
    expect(execute).not.toHaveBeenCalled();
    expect(getAdapter).not.toHaveBeenCalled();
    expect(executeLoopSpy).not.toHaveBeenCalled();
    expect(createWorkspaceCheckpoint).not.toHaveBeenCalled();
    const logs = allLogText([logSpy, errorSpy, warnSpy]);
    expect(logs).toContain('HARNESS_ENTITLEMENT_PROOF_MISSING');
    expect(logs).not.toContain(GOLDEN_SECRET);
    expect(logs).not.toContain(GOLDEN_SIGNATURE);
    expect(logs).not.toContain(GOLDEN_PAYLOAD_DIGEST);
    expect(logs).not.toContain('Hello, world.');
    expect(logs).not.toContain('persona');
    await worker.onModuleDestroy();
  });

  it('finalizes invalid proof through the existing failed ledger path without retry or provider work', async () => {
    const ledger = createLedgerMock();
    const execute = jest.fn().mockRejectedValue(new Error('timeout 429'));
    const getAdapter = jest.fn();
    const createWorkspaceCheckpoint = jest.fn();
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      getAdapter,
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: {
        notifyExecutionComplete: jest.fn(),
        createWorkspaceCheckpoint,
      },
    });

    let caught: unknown;
    try {
      await processJob({
        id: 'job-bad-sig',
        data: makeGoldenJobData(
          {},
          {
            signature:
              '0000000000000000000000000000000000000000000000000000000000000000',
          },
        ),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HarnessEntitlementError);
    expect((caught as HarnessEntitlementError).isRetryable).toBe(false);
    expect((caught as HarnessEntitlementError).code).toBe(
      'HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE',
    );
    expect(ledger.status.value).toBe('failed');
    expect(ledger.failedUpdates.length).toBeGreaterThan(0);
    expect(execute).not.toHaveBeenCalled();
    expect(executeLoopSpy).not.toHaveBeenCalled();
    expect(getAdapter).not.toHaveBeenCalled();
    expect(createWorkspaceCheckpoint).not.toHaveBeenCalled();
    expect(
      parseLoggedJsonEvents([logSpy], 'agent_harness.route_evaluated'),
    ).toHaveLength(0);
    const completion = parseLoggedJsonEvents([logSpy], 'execution_completed');
    expect(completion.some((event) => event.execution_status === 'failed')).toBe(
      true,
    );
    await worker.onModuleDestroy();
  });

  it('exits cancelled jobs through the existing cancellation path without proof verification', async () => {
    const ledger = createLedgerMock({ cancelAfterClaim: true });
    const execute = jest.fn();
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      getAdapter: jest.fn(),
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: {
        notifyExecutionComplete: jest.fn(),
        createWorkspaceCheckpoint: jest.fn(),
      },
    });

    await processJob({
      id: 'job-cancelled',
      data: makeGoldenJobData({}, null),
    });

    expect(ledger.status.value).toBe('cancelled');
    expect(execute).not.toHaveBeenCalled();
    expect(executeLoopSpy).not.toHaveBeenCalled();
    expect(
      parseLoggedJsonEvents(
        [logSpy],
        'agent_harness.entitlement_verification_failed',
      ),
    ).toHaveLength(0);
    expect(
      parseLoggedJsonEvents([logSpy], 'agent_harness.route_evaluated'),
    ).toHaveLength(0);
    await worker.onModuleDestroy();
  });
});

/**
 * AGENT-PLATFORM-EXEC-01C5B2 Cycle D — ordinary-job and disabled-gate compatibility.
 */
describe('AGENT-PLATFORM-EXEC-01C5B2 Cycle D — compatibility', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalStuckScan = process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;
  const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;

  function createLedgerMock() {
    const status = { value: 'pending' };
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (
        sql.includes("SET execution_status = 'running'") &&
        sql.includes('RETURNING')
      ) {
        if (status.value === 'pending') {
          status.value = 'running';
          return [{ execution_id: params[0] }];
        }
        return [];
      }
      if (sql.includes("SET execution_status = 'completed'")) {
        status.value = 'completed';
        return [];
      }
      if (sql.includes("SET execution_status = 'failed'")) {
        status.value = 'failed';
        return [];
      }
      if (sql.includes('SELECT execution_status, created_at')) {
        return [
          {
            execution_status: status.value,
            created_at: new Date().toISOString(),
          },
        ];
      }
      if (sql.includes('SELECT execution_id, timestamp')) {
        return [];
      }
      if (sql.includes('SELECT metadata')) {
        return [{ metadata: {} }];
      }
      if (sql.includes('SELECT execution_status')) {
        return [{ execution_status: status.value }];
      }
      return [];
    });
    return { query, status };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = '600000';
    delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    capturedWorker.processor = null;
    capturedWorker.opts = null;
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
    if (originalStuckScan === undefined) {
      delete process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;
    } else {
      process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = originalStuckScan;
    }
    if (originalSecret === undefined) {
      delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    } else {
      process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = originalSecret;
    }
  });

  it('runs ordinary jobs without harnessVersion or HMAC secret on the existing single-shot path', async () => {
    expect(process.env.HARNESS_ENTITLEMENT_HMAC_SECRET).toBeUndefined();
    const ledger = createLedgerMock();
    const execute = jest.fn().mockResolvedValue({
      output: 'ok',
      tokensUsed: 3,
      model: 'grok-4.5',
    });
    const worker = new WorkerProcessor(
      { query: ledger.query } as never,
      { execute, getAdapter: jest.fn() } as never,
      {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      } as never,
      { notifyExecutionComplete: jest.fn().mockResolvedValue(undefined) } as never,
    );
    await worker.onModuleInit();
    if (!capturedWorker.processor) {
      throw new Error('BullMQ worker processor was not captured');
    }

    await capturedWorker.processor({
      id: 'job-ordinary',
      data: {
        executionId: 'exec-ordinary-01',
        provider: 'xai',
        adapter: 'xai',
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        apiKeyId: 'apikey-1',
        prompt: 'Hello ordinary job',
        model: 'grok-4.5',
        executionIntent: 'conversation',
      },
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(ledger.status.value).toBe('completed');
    await worker.onModuleDestroy();
  });

  it('does not import Gateway code and leaves non-v1 routing unchanged', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).not.toContain('services/api-gateway');
    expect(workerSource).not.toContain('createHarnessEntitlementProof');
    expect(
      resolveHarnessRouting({
        enableToolLoop: false,
      }),
    ).toEqual({ selectedPath: 'plain' });
    expect(
      resolveHarnessRouting({
        harnessVersion: 'v1',
        enableToolLoop: false,
      }),
    ).toEqual({
      selectedPath: 'fail_closed',
      failReason: 'tool_loop_disabled',
    });
  });
});
