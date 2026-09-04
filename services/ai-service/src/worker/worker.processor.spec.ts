import { Logger } from '@nestjs/common';
import {
  buildAIExecutionRequest,
  buildExecutionPromptParts,
  DEFAULT_EXECUTION_TIMEOUT_MS,
  HarnessEmptyAdvertisedToolSetError,
  HarnessRoutingError,
  mergeAdvertisedToolsIntoExecuteOptions,
  parseExecutionTimeoutBaselineMs,
  requireNonEmptyAdvertisedHarnessTools,
  resolveBullMqLockDurationMs,
  resolveHarnessRouting,
  resolveStuckWatchdogThresholdSeconds,
  WorkerProcessor,
} from './worker.processor';
import { selectAdvertisedAgentHarnessTools } from '../ai-execution/adapters/adapter-tool-use.mapper';
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

    const job = {
      id: 'job-exec-harness-disabled',
      data: {
        executionId: 'exec-harness-disabled',
        provider: 'xai',
        adapter: 'xai',
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        prompt: 'Create index.html',
        model: 'grok-4.5',
        executionIntent: 'workspace_mutation',
        harnessVersion: 'v1',
      },
    };

    await expect(processJob(job)).rejects.toBeInstanceOf(HarnessRoutingError);
    expect(execute).not.toHaveBeenCalled();
    expect(ledger.status.value).toBe('failed');
    expect(publisher.publishFileActions).not.toHaveBeenCalled();
    expect(apiGateway.notifyExecutionComplete).not.toHaveBeenCalled();
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);

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
