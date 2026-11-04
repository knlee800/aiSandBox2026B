import { Logger } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  buildAIExecutionRequest,
  buildExecutionPromptParts,
  computeJobPayloadDigest,
  computePayloadDigest,
  DEFAULT_EXECUTION_TIMEOUT_MS,
  FILE_ACTION_CONTRACT_FAILURE_CODE,
  FILE_ACTION_CONTRACT_FAILURE_MESSAGE,
  HARNESS_ENTITLEMENT_PROOF_MALFORMED,
  HARNESS_ENTITLEMENT_PROOF_MISSING,
  HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH,
  HARNESS_TOOL_PROFILE_CONFLICT,
  HARNESS_TOOL_PROFILE_CONFLICT_MESSAGE,
  HARNESS_VALIDATION_TOOLS_DISABLED,
  HARNESS_VALIDATION_TOOLS_DISABLED_MESSAGE,
  HARNESS_WRITE_TOOLS_DISABLED,
  HARNESS_WRITE_TOOLS_DISABLED_MESSAGE,
  resolveHarnessToolProfile,
  HarnessEmptyAdvertisedToolSetError,
  HarnessEntitlementError,
  HarnessRoutingError,
  mergeAdvertisedToolsIntoExecuteOptions,
  parseExecutionTimeoutBaselineMs,
  requireNonEmptyAdvertisedHarnessTools,
  resolveBullMqLockDurationMs,
  resolveHarnessRouting,
  resolveLedgerModel,
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

  it('uses the harness tool contract and omits the file-action contract when useHarness is true', () => {
    const promptParts = buildExecutionPromptParts(
      'Create hello.txt',
      undefined,
      'Be concise',
      undefined,
      { useHarness: true },
    );

    expect(promptParts.system).toBe(`Execution output contract:
- You work through the tools you are given. Files change only when a write tool call succeeds.
- Do not emit \`file-actions\` blocks; they are not applied here.
- Do not claim that a file was created, changed or deleted, or that a command ran, unless the matching tool call succeeded.
- If the request needs a tool you do not have, say so plainly and do not claim the result.
- If a tool result carries a harnessNotice, follow it.
- When the work is done, answer in plain text.

Global AI Instructions:
Be concise`);
    expect(promptParts.system).not.toContain(
      'you MUST emit a fenced code block tagged `file-actions`',
    );
    expect(promptParts.system).not.toContain(
      'The `file-actions` block content MUST be valid JSON containing an array of actions.',
    );
    expect(promptParts.user).toBe(`User request:
Create hello.txt`);
  });

  it('keeps the file-action contract when no harness option is passed', () => {
    const promptParts = buildExecutionPromptParts('List files');

    expect(promptParts.system).toBe(`Execution output contract:
- If the user request requires creating, modifying, or deleting files, you MUST emit a fenced code block tagged \`file-actions\`.
- The \`file-actions\` block content MUST be valid JSON containing an array of actions.
- Each action MUST use action value "create", "write", "update", or "delete".
- "create", "write", and "update" actions MUST include string fields: "path" and "content".
- "delete" actions MUST include string field "path" and MUST NOT include or require "content".
- Do not claim that files were created, changed, or deleted unless matching \`file-actions\` entries are present.
- If the user request does not require file creation, modification, or deletion, respond normally in plain conversational text and do not emit \`file-actions\` blocks.`);
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

  it('defaults maxToolIterations to 8 and maxRunTokens to 60000', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolIterations).toBe(8);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxRunTokens).toBe(60_000);
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

  it('WorkerProcessor registers search_workspace beside list_files and does not register start_preview', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const searchRegistrations = (
      workerSource.match(/registerHandler\(\s*['"]search_workspace['"]/g) || []
    ).length;
    const listFilesRegIndex = workerSource.indexOf("'list_files'");
    const searchRegIndex = workerSource.indexOf("'search_workspace'");
    const writeGateIndex = workerSource.indexOf(
      'if (resolvedConfig.enableWriteTools)',
    );
    expect(searchRegistrations).toBe(1);
    expect(workerSource).toContain('createSearchWorkspaceHandler');
    expect(workerSource).toContain("registeredHandlerNames.push('search_workspace')");
    expect(searchRegIndex).toBeGreaterThan(listFilesRegIndex);
    expect(writeGateIndex).toBeGreaterThan(searchRegIndex);
    expect(workerSource).not.toContain("registerHandler('start_preview'");

    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ['list_files', 'read_file', 'search_workspace'],
      enableWriteTools: false,
      enableValidationTools: false,
    });
    expect(advertised.map((tool) => tool.name)).toEqual([
      'list_files',
      'read_file',
      'search_workspace',
    ]);
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

  it('passes the filtered advertised definitions on every native tool-use call', async () => {
    const listFiles = getAgentHarnessToolDefinition('list_files')!;
    const readFile = getAgentHarnessToolDefinition('read_file')!;
    const writeFile = getAgentHarnessToolDefinition('write_file')!;
    const deleteFile = getAgentHarnessToolDefinition('delete_file')!;
    const runValidation = getAgentHarnessToolDefinition('run_validation')!;
    const searchWorkspace = getAgentHarnessToolDefinition('search_workspace')!;
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
      'write_file',
      'delete_file',
      'run_validation',
      'search_workspace',
    ]);
    expect(advertised).toEqual([
      listFiles,
      readFile,
      writeFile,
      deleteFile,
      runValidation,
      searchWorkspace,
    ]);

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

  it('does not let resolved builder configuration bypass the global gate or advertise browser_smoke', () => {
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
      'write_file',
      'delete_file',
      'run_validation',
    ]);
    expect(advertised.map((tool) => tool.name)).toContain('delete_file');
    expect(advertised.map((tool) => tool.name)).not.toContain('browser_smoke');
  });
});

describe('resolveLedgerModel', () => {
  it('prefers a non-blank result model over the job model', () => {
    expect(resolveLedgerModel('grok-4.5', 'grok-test-job-model')).toBe('grok-4.5');
    expect(resolveLedgerModel('  grok-4.5  ', 'grok-test-job-model')).toBe('grok-4.5');
  });

  it('uses the job model when the result model is undefined, empty, or whitespace', () => {
    expect(resolveLedgerModel(undefined, 'grok-test-job-model')).toBe(
      'grok-test-job-model',
    );
    expect(resolveLedgerModel('', '  grok-test-job-model  ')).toBe(
      'grok-test-job-model',
    );
    expect(resolveLedgerModel('   ', 'grok-test-job-model')).toBe(
      'grok-test-job-model',
    );
  });

  it('returns null when neither model is usable', () => {
    expect(resolveLedgerModel(undefined, undefined)).toBeNull();
    expect(resolveLedgerModel('', '   ')).toBeNull();
    expect(resolveLedgerModel(null, null)).toBeNull();
  });

  it('cuts a value longer than 100 characters to its first 100 characters', () => {
    expect(resolveLedgerModel('m'.repeat(150), 'job-model')).toBe('m'.repeat(100));
    expect(resolveLedgerModel('', `  ${'n'.repeat(150)}`)).toBe('n'.repeat(100));
  });

  it('ignores non-string values', () => {
    expect(resolveLedgerModel(42, 'grok-test-job-model')).toBe('grok-test-job-model');
    expect(resolveLedgerModel({ model: 'grok-4.5' }, 7)).toBeNull();
    expect(resolveLedgerModel(true, false)).toBeNull();
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

  it('writes the AI result model on completed finalization', async () => {
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
    expect(ledger.status.value).toBe('completed');
    const params = ledger.completedUpdates[0];
    expect(params[0]).toBe(CANONICAL_EXECUTION_ID);
    expect(params[1]).toBe(3);
    const metadata = parseMetadataParam(params);
    expect(metadata.aiExecutionResult).toEqual(
      expect.objectContaining({ model: 'grok-4.5' }),
    );
    expect(params[3]).toBe('grok-4.5');
    await worker.onModuleDestroy();
  });

  it('writes the job model on completed finalization when the AI result has no model', async () => {
    for (const resultModel of [undefined, ''] as const) {
      const ledger = createLedgerMock();
      const { worker, processJob } = await startWorker({
        query: ledger.query,
        execute: jest.fn().mockResolvedValue({
          output: 'ok',
          tokensUsed: 3,
          model: resultModel,
        }),
        publisher: {
          publishCompletion: jest.fn(),
          publishToken: jest.fn(),
          publishFileActions: jest.fn(),
        },
        apiGateway: { notifyExecutionComplete: jest.fn().mockResolvedValue(undefined) },
      });

      await processJob(createPlainJob({ model: 'grok-test-job-model' }));
      expect(ledger.status.value).toBe('completed');
      const params = ledger.completedUpdates[0];
      expect(params[0]).toBe(CANONICAL_EXECUTION_ID);
      expect(params[1]).toBe(3);
      expect(typeof params[2]).toBe('string');
      expect(params[3]).toBe('grok-test-job-model');
      await worker.onModuleDestroy();
    }
  });

  it('writes null model on completed finalization when neither result nor job has a model', async () => {
    const ledger = createLedgerMock();
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockResolvedValue({
        output: 'ok',
        tokensUsed: 3,
      }),
      publisher: {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      },
      apiGateway: { notifyExecutionComplete: jest.fn().mockResolvedValue(undefined) },
    });

    await processJob(createPlainJob({ model: undefined }));
    expect(ledger.status.value).toBe('completed');
    const params = ledger.completedUpdates[0];
    expect(params[0]).toBe(CANONICAL_EXECUTION_ID);
    expect(params[1]).toBe(3);
    expect(typeof params[2]).toBe('string');
    expect(params[3]).toBeNull();
    await worker.onModuleDestroy();
  });

  it('writes the resolved model on the contract-failure finalization that carries metadata', async () => {
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
        executionIntent: 'workspace_mutation',
      }),
    );
    expect(ledger.status.value).toBe('failed');
    const metadataUpdate = ledger.failedUpdates.find(
      (params) => params.length >= 3 && typeof params[2] === 'string',
    );
    expect(metadataUpdate?.[0]).toBe(CANONICAL_EXECUTION_ID);
    expect(metadataUpdate?.[1]).toBe(3);
    const metadata = parseMetadataParam(metadataUpdate);
    expect(metadata.executionError).toEqual(
      expect.objectContaining({
        code: expect.any(String),
      }),
    );
    expect(metadataUpdate?.[3]).toBe('grok-4.5');
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

describe('HARNESS-FAIL-RECORD-01: failed harness run keeps audit events, tokens, and model', () => {
  const HARNESS_SECRET = 'test-hmac-secret-harness-fail-record-01';
  const JOB_MODEL = 'grok-fail-record-job';
  const originalRedisUrl = process.env.REDIS_URL;
  const originalStuckScan = process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;
  const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
  const harnessConfigModule = require('../agent-harness/config/agent-harness.config') as {
    DEFAULT_AGENT_HARNESS_CONFIG_V1: typeof DEFAULT_AGENT_HARNESS_CONFIG_V1;
  };
  const originalHarnessConfig = harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1;

  function withHarnessProof(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const payloadDigest = computeJobPayloadDigest(data).payloadDigest;
    const issuedAt = '2026-11-01T08:00:00.000Z';
    const executionId = String(data.executionId);
    const userId = String(data.userId);
    const apiKeyId = String(data.apiKeyId);
    const claim = `v=1|executionId=${executionId}|userId=${userId}|apiKeyId=${apiKeyId}|harnessVersion=v1|issuedAt=${issuedAt}|payloadDigest=${payloadDigest}`;
    const signature = createHmac('sha256', HARNESS_SECRET)
      .update(claim, 'utf8')
      .digest('hex');
    return {
      ...data,
      harnessEntitlementProof: {
        version: 1,
        executionId,
        userId,
        apiKeyId,
        harnessVersion: 'v1',
        issuedAt,
        payloadDigest,
        signature,
      },
    };
  }

  function createLedgerMock() {
    const status = { value: 'pending' };
    const completedUpdates: Array<{ sql: string; params: unknown[] }> = [];
    const failedUpdates: Array<{ sql: string; params: unknown[] }> = [];
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
        completedUpdates.push({ sql, params });
        status.value = 'completed';
        return [];
      }
      if (sql.includes("SET execution_status = 'failed'")) {
        failedUpdates.push({ sql, params });
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
    return { query, status, completedUpdates, failedUpdates };
  }

  function parseLoggedPayloads(
    logSpy: jest.SpyInstance,
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
      .filter((payload): payload is Record<string, unknown> => payload !== null);
  }

  function countEventType(logSpy: jest.SpyInstance, eventType: string): number {
    return parseLoggedPayloads(logSpy).filter(
      (payload) => payload.eventType === eventType,
    ).length;
  }

  async function startWorker(deps: {
    query: jest.Mock;
    execute: jest.Mock;
    getAdapter: jest.Mock;
    notifyExecutionComplete: jest.Mock;
  }) {
    const worker = new WorkerProcessor(
      { query: deps.query } as never,
      { execute: deps.execute, getAdapter: deps.getAdapter } as never,
      {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      } as never,
      {
        notifyExecutionComplete: deps.notifyExecutionComplete,
        createWorkspaceCheckpoint: jest.fn(),
      } as never,
    );
    await worker.onModuleInit();
    if (!capturedWorker.processor) {
      throw new Error('BullMQ worker processor was not captured');
    }
    return { worker, processJob: capturedWorker.processor };
  }

  function harnessJob(executionId: string): Record<string, unknown> {
    return withHarnessProof({
      executionId,
      userId: 'user-fail-record',
      apiKeyId: 'apikey-fail-record',
      sessionId: 'session-fail-record',
      conversationId: 'conv-fail-record',
      provider: 'openai',
      adapter: 'openai',
      prompt: 'Use a tool until the step limit.',
      model: JOB_MODEL,
      harnessVersion: 'v1',
      executionIntent: 'conversation',
      submittedAt: '2026-11-01T08:00:00.000Z',
    });
  }

  function toolCallAdapter(executeWithTools: jest.Mock) {
    return {
      supportsToolUse: true,
      executeWithTools,
    };
  }

  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = '600000';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
    capturedWorker.processor = null;
    capturedWorker.opts = null;
    harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1 = {
      ...originalHarnessConfig,
      enableToolLoop: true,
    };
    logSpy = jest.spyOn(Logger.prototype, 'log');
  });

  afterEach(() => {
    harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1 = originalHarnessConfig;
    logSpy.mockRestore();
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

  it('logs recorded audit events, including harness.loop_max_turns, exactly once when the step limit fails', async () => {
    const ledger = createLedgerMock();
    const executeWithTools = jest.fn().mockResolvedValue({
      output: 'calling a tool',
      tokensUsed: 7,
      model: 'provider-model-ignored',
      finishReason: 'tool_calls',
      toolCalls: [
        {
          callId: 'call-1',
          toolName: 'start_preview',
          arguments: { query: 'notes' },
          providerKind: 'stub',
        },
      ],
    });
    const notifyExecutionComplete = jest.fn().mockResolvedValue(undefined);
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      getAdapter: jest.fn().mockReturnValue(toolCallAdapter(executeWithTools)),
      notifyExecutionComplete,
    });

    await expect(
      processJob({
        id: 'job-step-limit-audit',
        data: harnessJob('exec-step-limit-audit'),
      }),
    ).rejects.toBeInstanceOf(agentHarnessLoop.HarnessMaxIterationsError);

    expect(countEventType(logSpy, 'harness.loop_started')).toBe(1);
    expect(countEventType(logSpy, 'harness.loop_max_turns')).toBe(1);
    expect(countEventType(logSpy, 'harness.model_invocation_started')).toBe(
      originalHarnessConfig.maxToolIterations,
    );
    expect(notifyExecutionComplete).not.toHaveBeenCalled();
    await worker.onModuleDestroy();
  });

  it('writes tokens_used from a step-limit error and a non-empty model without an accounting notification', async () => {
    const ledger = createLedgerMock();
    const executeWithTools = jest.fn().mockResolvedValue({
      output: 'calling a tool',
      tokensUsed: 7,
      model: 'provider-model-ignored',
      finishReason: 'tool_calls',
      toolCalls: [
        {
          callId: 'call-1',
          toolName: 'start_preview',
          arguments: { query: 'notes' },
          providerKind: 'stub',
        },
      ],
    });
    const notifyExecutionComplete = jest.fn().mockResolvedValue(undefined);
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      getAdapter: jest.fn().mockReturnValue(toolCallAdapter(executeWithTools)),
      notifyExecutionComplete,
    });

    let caught: unknown;
    try {
      await processJob({
        id: 'job-step-limit-ledger',
        data: harnessJob('exec-step-limit-ledger'),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(agentHarnessLoop.HarnessMaxIterationsError);
    const tokensUsed = (caught as agentHarnessLoop.HarnessMaxIterationsError)
      .tokensUsed;
    expect(tokensUsed).toBeGreaterThan(0);
    const failed = ledger.failedUpdates.find(
      (update) => !update.sql.includes('RETURNING'),
    );
    expect(failed?.sql).toContain("SET execution_status = 'failed'");
    expect(failed?.params[1]).toBe(JOB_MODEL);
    expect(String(failed?.params[1]).length).toBeGreaterThan(0);
    expect(failed?.params[2]).toBe(tokensUsed);
    const completion = parseLoggedPayloads(logSpy).filter(
      (payload) => payload.event === 'execution_completed',
    );
    expect(completion).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          execution_status: 'failed',
          tokens: tokensUsed,
        }),
      ]),
    );
    expect(notifyExecutionComplete).not.toHaveBeenCalled();
    await worker.onModuleDestroy();
  });

  it('writes a non-empty model and does not set a token value when another failure occurs', async () => {
    const ledger = createLedgerMock();
    const notifyExecutionComplete = jest.fn().mockResolvedValue(undefined);
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest
        .fn()
        .mockRejectedValue(new Error('provider rejected the request')),
      getAdapter: jest.fn(),
      notifyExecutionComplete,
    });

    await expect(
      processJob({
        id: 'job-other-failure',
        data: {
          executionId: 'exec-other-failure',
          provider: 'xai',
          adapter: 'xai',
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          apiKeyId: 'apikey-1',
          prompt: 'Hello ordinary failure',
          model: JOB_MODEL,
          executionIntent: 'conversation',
        },
      }),
    ).rejects.toThrow('provider rejected the request');

    const failed = ledger.failedUpdates.find(
      (update) => !update.sql.includes('RETURNING'),
    );
    expect(failed?.sql).toContain("SET execution_status = 'failed'");
    expect(failed?.sql).toContain('COALESCE($3, tokens_used)');
    expect(failed?.params[1]).toBe(JOB_MODEL);
    expect(String(failed?.params[1]).length).toBeGreaterThan(0);
    expect(failed?.params[2]).toBeNull();
    expect(failed?.params.some((param) => typeof param === 'number')).toBe(
      false,
    );
    const completion = parseLoggedPayloads(logSpy).filter(
      (payload) => payload.event === 'execution_completed',
    );
    expect(completion).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          execution_status: 'failed',
          tokens: 0,
        }),
      ]),
    );
    expect(notifyExecutionComplete).not.toHaveBeenCalled();
    await worker.onModuleDestroy();
  });

  it('logs audit events once and writes the usual ledger row when the harness succeeds', async () => {
    const ledger = createLedgerMock();
    const resultModel = 'stub-success-model';
    const executeWithTools = jest.fn().mockResolvedValue({
      output: 'finished',
      tokensUsed: 42,
      model: resultModel,
      finishReason: 'completed',
      toolCalls: [],
    });
    const notifyExecutionComplete = jest.fn().mockResolvedValue(undefined);
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      getAdapter: jest.fn().mockReturnValue(toolCallAdapter(executeWithTools)),
      notifyExecutionComplete,
    });

    await processJob({
      id: 'job-harness-success',
      data: harnessJob('exec-harness-success'),
    });

    expect(countEventType(logSpy, 'harness.loop_started')).toBe(1);
    expect(countEventType(logSpy, 'harness.loop_completed')).toBe(1);
    expect(countEventType(logSpy, 'harness.model_invocation_completed')).toBe(1);
    expect(countEventType(logSpy, 'harness.loop_max_turns')).toBe(0);
    expect(ledger.completedUpdates).toHaveLength(1);
    expect(ledger.completedUpdates[0].sql).toContain(
      "SET execution_status = 'completed'",
    );
    expect(ledger.completedUpdates[0].params[0]).toBe('exec-harness-success');
    expect(ledger.completedUpdates[0].params[1]).toBe(42);
    expect(ledger.completedUpdates[0].params[3]).toBe(resultModel);
    expect(ledger.failedUpdates).toHaveLength(0);
    expect(notifyExecutionComplete).toHaveBeenCalledTimes(1);
    await worker.onModuleDestroy();
  });
});

describe('HARNESS-PROGRESS-01: harness tool progress on the execution stream', () => {
  const HARNESS_SECRET = 'test-hmac-secret-harness-progress-01';
  const originalRedisUrl = process.env.REDIS_URL;
  const originalStuckScan = process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;
  const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
  const harnessConfigModule = require('../agent-harness/config/agent-harness.config') as {
    DEFAULT_AGENT_HARNESS_CONFIG_V1: typeof DEFAULT_AGENT_HARNESS_CONFIG_V1;
  };
  const originalHarnessConfig = harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1;

  function withHarnessProof(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const payloadDigest = computeJobPayloadDigest(data).payloadDigest;
    const issuedAt = '2026-11-02T00:00:00.000Z';
    const executionId = String(data.executionId);
    const userId = String(data.userId);
    const apiKeyId = String(data.apiKeyId);
    const claim = `v=1|executionId=${executionId}|userId=${userId}|apiKeyId=${apiKeyId}|harnessVersion=v1|issuedAt=${issuedAt}|payloadDigest=${payloadDigest}`;
    const signature = createHmac('sha256', HARNESS_SECRET)
      .update(claim, 'utf8')
      .digest('hex');
    return {
      ...data,
      harnessEntitlementProof: {
        version: 1,
        executionId,
        userId,
        apiKeyId,
        harnessVersion: 'v1',
        issuedAt,
        payloadDigest,
        signature,
      },
    };
  }

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

  function harnessJob(executionId: string): Record<string, unknown> {
    return withHarnessProof({
      executionId,
      userId: 'user-progress',
      apiKeyId: 'apikey-progress',
      sessionId: 'session-progress',
      conversationId: 'conv-progress',
      provider: 'openai',
      adapter: 'openai',
      prompt: 'List the workspace.',
      model: 'stub-progress-model',
      harnessVersion: 'v1',
      executionIntent: 'conversation',
      submittedAt: '2026-11-02T00:00:00.000Z',
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = '600000';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
    capturedWorker.processor = null;
    capturedWorker.opts = null;
    harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1 = {
      ...originalHarnessConfig,
      enableToolLoop: true,
    };
  });

  afterEach(() => {
    harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1 = originalHarnessConfig;
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

  it('publishes harness progress before the tool handler runs', async () => {
    const order: string[] = [];
    const publishHarnessProgress = jest.fn(() => {
      order.push('publish');
      return Promise.resolve(1);
    });
    const listWorkspaceDirectory = jest.fn(async () => {
      order.push('handler');
      return {
        path: 'src',
        entries: [
          {
            name: 'app.ts',
            type: 'file' as const,
            size: 1,
            modifiedAt: '2026-11-02T00:00:00.000Z',
          },
        ],
      };
    });
    const executeWithTools = jest
      .fn()
      .mockResolvedValueOnce({
        output: 'listing',
        tokensUsed: 3,
        model: 'stub-progress-model',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            callId: 'call-list-1',
            toolName: 'list_files',
            arguments: { path: 'src' },
            providerKind: 'stub',
          },
        ],
      })
      .mockResolvedValueOnce({
        output: 'done',
        tokensUsed: 2,
        model: 'stub-progress-model',
        finishReason: 'completed',
        toolCalls: [],
      });
    const worker = new WorkerProcessor(
      { query: createLedgerMock().query } as never,
      {
        execute: jest.fn(),
        getAdapter: jest.fn().mockReturnValue({
          supportsToolUse: true,
          executeWithTools,
        }),
      } as never,
      {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
        publishHarnessProgress,
      } as never,
      {
        notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
        createWorkspaceCheckpoint: jest.fn(),
        listWorkspaceDirectory,
      } as never,
    );
    await worker.onModuleInit();
    if (!capturedWorker.processor) {
      throw new Error('BullMQ worker processor was not captured');
    }

    await capturedWorker.processor({
      id: 'job-harness-progress',
      data: harnessJob('exec-harness-progress'),
    });

    expect(order).toEqual(['publish', 'handler']);
    expect(publishHarnessProgress).toHaveBeenCalledTimes(1);
    expect(publishHarnessProgress).toHaveBeenCalledWith('exec-harness-progress', {
      step: 1,
      tool: 'list_files',
      target: 'src',
    });
    expect(listWorkspaceDirectory).toHaveBeenCalledTimes(1);
    await worker.onModuleDestroy();
  });

  it('publishes no harness progress on the single-shot path', async () => {
    const publishHarnessProgress = jest.fn();
    const execute = jest.fn().mockResolvedValue({
      output: 'ok',
      tokensUsed: 3,
      model: 'grok-4.5',
    });
    const worker = new WorkerProcessor(
      { query: createLedgerMock().query } as never,
      { execute, getAdapter: jest.fn() } as never,
      {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
        publishHarnessProgress,
      } as never,
      {
        notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    await worker.onModuleInit();
    if (!capturedWorker.processor) {
      throw new Error('BullMQ worker processor was not captured');
    }

    await capturedWorker.processor({
      id: 'job-single-shot-progress',
      data: {
        executionId: 'exec-single-shot-progress',
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
    expect(publishHarnessProgress).not.toHaveBeenCalled();
    await worker.onModuleDestroy();
  });
});

describe('HARNESS-SAVE-01: save a project snapshot when a harness run writes or deletes', () => {
  const HARNESS_SECRET = 'test-hmac-secret-harness-save-01';
  const FILE_BODY = 'slug-js-body-not-for-logs';
  const originalRedisUrl = process.env.REDIS_URL;
  const originalStuckScan = process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;
  const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
  const harnessConfigModule = require('../agent-harness/config/agent-harness.config') as {
    DEFAULT_AGENT_HARNESS_CONFIG_V1: typeof DEFAULT_AGENT_HARNESS_CONFIG_V1;
  };
  const originalHarnessConfig = harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1;

  function withHarnessProof(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const payloadDigest = computeJobPayloadDigest(data).payloadDigest;
    const issuedAt = '2026-11-02T09:00:00.000Z';
    const executionId = String(data.executionId);
    const userId = String(data.userId);
    const apiKeyId = String(data.apiKeyId);
    const claim = `v=1|executionId=${executionId}|userId=${userId}|apiKeyId=${apiKeyId}|harnessVersion=v1|issuedAt=${issuedAt}|payloadDigest=${payloadDigest}`;
    const signature = createHmac('sha256', HARNESS_SECRET)
      .update(claim, 'utf8')
      .digest('hex');
    return {
      ...data,
      harnessEntitlementProof: {
        version: 1,
        executionId,
        userId,
        apiKeyId,
        harnessVersion: 'v1',
        issuedAt,
        payloadDigest,
        signature,
      },
    };
  }

  function harnessJob(
    executionId: string,
    sessionId: string,
  ): Record<string, unknown> {
    return withHarnessProof({
      executionId,
      userId: 'user-save',
      apiKeyId: 'apikey-save',
      sessionId,
      conversationId: 'conv-save',
      provider: 'openai',
      adapter: 'openai',
      prompt: 'Update the workspace.',
      model: 'stub-save-model',
      harnessVersion: 'v1',
      executionIntent: 'conversation',
      submittedAt: '2026-11-02T09:00:00.000Z',
    });
  }

  function createLedgerMock() {
    const status = { value: 'pending' };
    const order: string[] = [];
    const completedUpdates: Array<{ sql: string; params: unknown[] }> = [];
    const failedUpdates: Array<{ sql: string; params: unknown[] }> = [];
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
        order.push('finalize');
        completedUpdates.push({ sql, params });
        status.value = 'completed';
        return [];
      }
      if (
        sql.includes("SET execution_status = 'failed'") &&
        !sql.includes('RETURNING')
      ) {
        order.push('finalize');
        failedUpdates.push({ sql, params });
        status.value = 'failed';
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
    return { query, status, order, completedUpdates, failedUpdates };
  }

  function writeThenFinish(output: string) {
    return jest
      .fn()
      .mockResolvedValueOnce({
        output: 'writing',
        tokensUsed: 4,
        model: 'stub-save-model',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            callId: 'call-write-1',
            toolName: 'write_file',
            arguments: { path: 'slug.js', content: FILE_BODY },
            providerKind: 'stub',
          },
        ],
      })
      .mockResolvedValueOnce({
        output,
        tokensUsed: 6,
        model: 'stub-save-model',
        finishReason: 'completed',
        toolCalls: [],
      });
  }

  async function startWorker(deps: {
    query: jest.Mock;
    execute: jest.Mock;
    getAdapter: jest.Mock;
    apiGateway: Record<string, jest.Mock>;
  }) {
    const worker = new WorkerProcessor(
      { query: deps.query } as never,
      { execute: deps.execute, getAdapter: deps.getAdapter } as never,
      {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
        publishHarnessProgress: jest.fn(),
      } as never,
      deps.apiGateway as never,
    );
    await worker.onModuleInit();
    if (!capturedWorker.processor) {
      throw new Error('BullMQ worker processor was not captured');
    }
    return { worker, processJob: capturedWorker.processor };
  }

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = '600000';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
    capturedWorker.processor = null;
    capturedWorker.opts = null;
    harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1 = {
      ...originalHarnessConfig,
      enableToolLoop: true,
      enableWriteTools: true,
    };
    warnSpy = jest.spyOn(Logger.prototype, 'warn');
  });

  afterEach(() => {
    harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1 = originalHarnessConfig;
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

  it('saves a project snapshot after a harness run that called write_file', async () => {
    const ledger = createLedgerMock();
    const saveProjectSnapshot = jest.fn(async () => {
      ledger.order.push('save');
      return { saved: true, snapshotId: 'snap-write' };
    });
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools: writeThenFinish('wrote slug.js'),
      }),
      apiGateway: {
        notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
        createWorkspaceCheckpoint: jest
          .fn()
          .mockResolvedValue({ commitHash: 'abc', filesChanged: 1 }),
        writeWorkspaceFile: jest.fn().mockResolvedValue(undefined),
        saveProjectSnapshot,
      },
    });

    await processJob({
      id: 'job-save-write',
      data: harnessJob('exec-save-write', 'session-save-write'),
    });

    expect(saveProjectSnapshot).toHaveBeenCalledTimes(1);
    expect(saveProjectSnapshot.mock.calls[0]).toEqual(['session-save-write']);
    await worker.onModuleDestroy();
  });

  it('saves a project snapshot after a failing harness run that called write_file', async () => {
    const ledger = createLedgerMock();
    const saveProjectSnapshot = jest.fn(async () => {
      ledger.order.push('save');
      return { saved: true, snapshotId: 'snap-fail' };
    });
    const executeWithTools = jest
      .fn()
      .mockResolvedValueOnce({
        output: 'writing',
        tokensUsed: 4,
        model: 'stub-save-model',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            callId: 'call-write-fail',
            toolName: 'write_file',
            arguments: { path: 'slug.js', content: FILE_BODY },
            providerKind: 'stub',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('provider rejected the request'));
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools,
      }),
      apiGateway: {
        notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
        createWorkspaceCheckpoint: jest
          .fn()
          .mockResolvedValue({ commitHash: 'abc', filesChanged: 1 }),
        writeWorkspaceFile: jest.fn().mockResolvedValue(undefined),
        saveProjectSnapshot,
      },
    });

    await expect(
      processJob({
        id: 'job-save-fail',
        data: harnessJob('exec-save-fail', 'session-save-fail'),
      }),
    ).rejects.toThrow('provider rejected the request');

    expect(saveProjectSnapshot).toHaveBeenCalledTimes(1);
    expect(saveProjectSnapshot.mock.calls[0]).toEqual(['session-save-fail']);
    expect(ledger.failedUpdates).toHaveLength(1);
    expect(ledger.failedUpdates[0].sql).toContain(
      "SET execution_status = 'failed'",
    );
    expect(ledger.order).toEqual(['save', 'finalize']);
    await worker.onModuleDestroy();
  });

  it('does not save a project snapshot after a read-only harness run', async () => {
    const ledger = createLedgerMock();
    const saveProjectSnapshot = jest.fn().mockResolvedValue({
      saved: true,
      snapshotId: 'snap-read',
    });
    const executeWithTools = jest
      .fn()
      .mockResolvedValueOnce({
        output: 'reading',
        tokensUsed: 2,
        model: 'stub-save-model',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            callId: 'call-read-1',
            toolName: 'read_file',
            arguments: { path: 'slug.js' },
            providerKind: 'stub',
          },
        ],
      })
      .mockResolvedValueOnce({
        output: 'read only',
        tokensUsed: 1,
        model: 'stub-save-model',
        finishReason: 'completed',
        toolCalls: [],
      });
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools,
      }),
      apiGateway: {
        notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
        createWorkspaceCheckpoint: jest.fn(),
        readWorkspaceFile: jest.fn().mockResolvedValue({
          path: 'slug.js',
          content: 'existing',
        }),
        saveProjectSnapshot,
      },
    });

    await processJob({
      id: 'job-save-read',
      data: harnessJob('exec-save-read', 'session-save-read'),
    });

    expect(saveProjectSnapshot).not.toHaveBeenCalled();
    expect(ledger.completedUpdates).toHaveLength(1);
    await worker.onModuleDestroy();
  });

  it('does not save a project snapshot on the single-shot path', async () => {
    const ledger = createLedgerMock();
    const saveProjectSnapshot = jest.fn().mockResolvedValue({
      saved: true,
      snapshotId: 'snap-single',
    });
    const execute = jest.fn().mockResolvedValue({
      output: 'plain answer',
      tokensUsed: 3,
      model: 'grok-4.5',
    });
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      getAdapter: jest.fn(),
      apiGateway: {
        notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
        saveProjectSnapshot,
      },
    });

    await processJob({
      id: 'job-save-single',
      data: {
        executionId: 'exec-save-single',
        provider: 'xai',
        adapter: 'xai',
        sessionId: 'session-save-single',
        conversationId: 'conv-save-single',
        userId: 'user-save',
        apiKeyId: 'apikey-save',
        prompt: 'Hello ordinary job',
        model: 'grok-4.5',
        executionIntent: 'conversation',
      },
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(saveProjectSnapshot).not.toHaveBeenCalled();
    expect(ledger.completedUpdates).toHaveLength(1);
    await worker.onModuleDestroy();
  });

  it('leaves the run result unchanged when the project snapshot save is rejected', async () => {
    const ledger = createLedgerMock();
    const saveProjectSnapshot = jest.fn(async () => {
      ledger.order.push('save');
      throw new Error('snapshot store unavailable');
    });
    const notifyExecutionComplete = jest.fn().mockResolvedValue(undefined);
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools: writeThenFinish('wrote slug.js'),
      }),
      apiGateway: {
        notifyExecutionComplete,
        createWorkspaceCheckpoint: jest
          .fn()
          .mockResolvedValue({ commitHash: 'abc', filesChanged: 1 }),
        writeWorkspaceFile: jest.fn().mockResolvedValue(undefined),
        saveProjectSnapshot,
      },
    });

    await processJob({
      id: 'job-save-rejected',
      data: harnessJob('exec-save-rejected', 'session-save-rejected'),
    });

    expect(ledger.status.value).toBe('completed');
    expect(ledger.failedUpdates).toHaveLength(0);
    expect(ledger.completedUpdates).toHaveLength(1);
    expect(ledger.completedUpdates[0].params[0]).toBe('exec-save-rejected');
    expect(ledger.completedUpdates[0].params[1]).toBe(10);
    expect(String(ledger.completedUpdates[0].params[2])).toContain(
      'wrote slug.js',
    );
    expect(ledger.completedUpdates[0].params[3]).toBe('stub-save-model');
    expect(notifyExecutionComplete).toHaveBeenCalledTimes(1);
    const saveWarnings = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((message) => message.includes('exec-save-rejected'));
    expect(saveWarnings).toEqual([
      'Project snapshot save failed executionId=exec-save-rejected: snapshot store unavailable',
    ]);
    expect(saveWarnings.join('\n')).not.toContain(FILE_BODY);
    await worker.onModuleDestroy();
  });

  it('saves the project snapshot before the run is finalized', async () => {
    const ledger = createLedgerMock();
    const saveProjectSnapshot = jest.fn(async () => {
      ledger.order.push('save');
      return { saved: true, snapshotId: 'snap-order' };
    });
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools: writeThenFinish('wrote slug.js'),
      }),
      apiGateway: {
        notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
        createWorkspaceCheckpoint: jest
          .fn()
          .mockResolvedValue({ commitHash: 'abc', filesChanged: 1 }),
        writeWorkspaceFile: jest.fn().mockResolvedValue(undefined),
        saveProjectSnapshot,
      },
    });

    await processJob({
      id: 'job-save-order',
      data: harnessJob('exec-save-order', 'session-save-order'),
    });

    expect(ledger.order).toEqual(['save', 'finalize']);
    expect(ledger.completedUpdates).toHaveLength(1);
    await worker.onModuleDestroy();
  });
});

describe('COLLAB-FILES-01 read-only harness jobs', () => {
  const HARNESS_SECRET = 'test-hmac-secret-collab-files-01';
  const originalRedisUrl = process.env.REDIS_URL;
  const originalStuckScan = process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;
  const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
  const harnessConfigModule = require('../agent-harness/config/agent-harness.config') as {
    DEFAULT_AGENT_HARNESS_CONFIG_V1: typeof DEFAULT_AGENT_HARNESS_CONFIG_V1;
  };
  const originalHarnessConfig = harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1;

  function withHarnessProof(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const payloadDigest = computeJobPayloadDigest(data).payloadDigest;
    const issuedAt = '2026-11-02T12:00:00.000Z';
    const executionId = String(data.executionId);
    const userId = String(data.userId);
    const apiKeyId = String(data.apiKeyId);
    const claim = `v=1|executionId=${executionId}|userId=${userId}|apiKeyId=${apiKeyId}|harnessVersion=v1|issuedAt=${issuedAt}|payloadDigest=${payloadDigest}`;
    const signature = createHmac('sha256', HARNESS_SECRET)
      .update(claim, 'utf8')
      .digest('hex');
    return {
      ...data,
      harnessEntitlementProof: {
        version: 1,
        executionId,
        userId,
        apiKeyId,
        harnessVersion: 'v1',
        issuedAt,
        payloadDigest,
        signature,
      },
    };
  }

  function baseJob(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      executionId: 'exec-collab-files',
      userId: 'user-collab-files',
      apiKeyId: 'apikey-collab-files',
      sessionId: 'session-collab-files',
      conversationId: 'conv-collab-files',
      provider: 'openai',
      adapter: 'openai',
      prompt: 'Read the project.',
      model: 'gpt-test',
      harnessVersion: 'v1',
      executionIntent: 'conversation',
      submittedAt: '2026-11-02T12:00:00.000Z',
      ...overrides,
    };
  }

  function createLedgerMock() {
    const status = { value: 'pending' };
    const completedUpdates: Array<{ sql: string; params: unknown[] }> = [];
    const failedUpdates: Array<{ sql: string; params: unknown[] }> = [];
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
        completedUpdates.push({ sql, params });
        status.value = 'completed';
        return [];
      }
      if (sql.includes("SET execution_status = 'failed'")) {
        failedUpdates.push({ sql, params });
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
    return { query, status, completedUpdates, failedUpdates };
  }

  function toolCall(
    callId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) {
    return {
      callId,
      toolName,
      arguments: args,
      providerKind: 'stub',
    };
  }

  async function startWorker(deps: {
    query: jest.Mock;
    execute: jest.Mock;
    getAdapter: jest.Mock;
    apiGateway: object;
    publisher?: Record<string, jest.Mock>;
  }) {
    const publisher = {
      publishCompletion: jest.fn(),
      publishToken: jest.fn(),
      publishFileActions: jest.fn(),
      publishHarnessProgress: jest.fn(),
      ...deps.publisher,
    };
    const worker = new WorkerProcessor(
      { query: deps.query } as never,
      { execute: deps.execute, getAdapter: deps.getAdapter } as never,
      publisher as never,
      deps.apiGateway as never,
    );
    await worker.onModuleInit();
    if (!capturedWorker.processor) {
      throw new Error('BullMQ worker processor was not captured');
    }
    return { worker, processJob: capturedWorker.processor, publisher };
  }

  function enableAllToolFlags(enableToolLoop: boolean): void {
    harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1 = {
      ...originalHarnessConfig,
      enableToolLoop,
      enableWriteTools: true,
      enableValidationTools: true,
      enableBrowserSmoke: true,
      enablePreApplyCheckpoint: true,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = '600000';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
    capturedWorker.processor = null;
    capturedWorker.opts = null;
    enableAllToolFlags(true);
  });

  afterEach(() => {
    harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1 = originalHarnessConfig;
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

  it('registers only read tools and advertises the same set when write flags are on', async () => {
    const ledger = createLedgerMock();
    const finalText =
      'Checked slug.js.\n\n<handoff to="writer">Look at the bug.</handoff>';
    const executeWithTools = jest
      .fn()
      .mockResolvedValueOnce({
        output: 'reading',
        tokensUsed: 2,
        model: 'stub-read-model',
        finishReason: 'tool_calls',
        toolCalls: [
          toolCall('call-read', 'read_file', { path: 'slug.js' }),
          toolCall('call-write', 'write_file', { path: 'slug.js', content: 'nope' }),
          toolCall('call-delete', 'delete_file', { path: 'slug.js' }),
          toolCall('call-validate', 'run_validation', { command: 'npm test' }),
          toolCall('call-browser', 'browser_smoke', { url: '/' }),
        ],
      })
      .mockResolvedValueOnce({
        output: finalText,
        tokensUsed: 3,
        model: 'stub-read-model',
        finishReason: 'completed',
        toolCalls: [],
        fileActions: [{ action: 'write', path: 'slug.js', content: 'nope' }],
      });
    const execute = jest.fn();
    const readWorkspaceFile = jest.fn().mockResolvedValue({
      path: 'slug.js',
      content: 'existing',
    });
    const writeWorkspaceFile = jest.fn().mockResolvedValue(undefined);
    const deleteWorkspaceFile = jest.fn().mockResolvedValue(undefined);
    const runWorkspaceValidation = jest.fn().mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });
    const runBrowserSmoke = jest.fn().mockResolvedValue({ ok: true });
    const createWorkspaceCheckpoint = jest.fn().mockResolvedValue({
      commitHash: 'abc',
      filesChanged: 1,
    });
    const saveProjectSnapshot = jest.fn().mockResolvedValue({ saved: true });
    const notifyExecutionComplete = jest.fn().mockResolvedValue(undefined);
    const { worker, processJob, publisher } = await startWorker({
      query: ledger.query,
      execute,
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools,
      }),
      apiGateway: {
        notifyExecutionComplete,
        readWorkspaceFile,
        writeWorkspaceFile,
        deleteWorkspaceFile,
        runWorkspaceValidation,
        runBrowserSmoke,
        createWorkspaceCheckpoint,
        saveProjectSnapshot,
        listWorkspaceDirectory: jest.fn(),
        searchWorkspace: jest.fn(),
      },
    });

    await processJob({
      id: 'job-read-only-tools',
      data: withHarnessProof(baseJob({
        executionId: 'exec-read-only-tools',
        harnessReadOnly: true,
      })),
    });

    const advertised = executeWithTools.mock.calls[0][1].tools.map(
      (tool: { name: string }) => tool.name,
    );
    expect(advertised).toEqual(['list_files', 'read_file', 'search_workspace']);
    expect(executeWithTools.mock.calls[1][1].tools.map(
      (tool: { name: string }) => tool.name,
    )).toEqual(advertised);
    expect(readWorkspaceFile).toHaveBeenCalledTimes(1);
    expect(writeWorkspaceFile).not.toHaveBeenCalled();
    expect(deleteWorkspaceFile).not.toHaveBeenCalled();
    expect(runWorkspaceValidation).not.toHaveBeenCalled();
    expect(runBrowserSmoke).not.toHaveBeenCalled();
    expect(createWorkspaceCheckpoint).not.toHaveBeenCalled();
    expect(saveProjectSnapshot).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(notifyExecutionComplete).toHaveBeenCalledTimes(1);
    expect(publisher.publishFileActions).toHaveBeenCalledWith(
      'exec-read-only-tools',
      [],
    );
    const metadata = JSON.parse(String(ledger.completedUpdates[0].params[2])) as {
      aiExecutionResult: { output: string; executionIntent: string; fileActions: unknown[] };
    };
    expect(metadata.aiExecutionResult.output).toBe(finalText);
    expect(metadata.aiExecutionResult.executionIntent).toBe('conversation');
    expect(metadata.aiExecutionResult.fileActions).toEqual([]);
    await worker.onModuleDestroy();
  });

  it('keeps write tools on an ordinary harness job and still verifies its proof', async () => {
    const ledger = createLedgerMock();
    const executeWithTools = jest
      .fn()
      .mockResolvedValueOnce({
        output: 'writing',
        tokensUsed: 2,
        model: 'stub-write-model',
        finishReason: 'tool_calls',
        toolCalls: [
          toolCall('call-write', 'write_file', { path: 'slug.js', content: 'ok' }),
          toolCall('call-browser', 'browser_smoke', { url: '/' }),
        ],
      })
      .mockResolvedValueOnce({
        output: 'Wrote it.',
        tokensUsed: 2,
        model: 'stub-write-model',
        finishReason: 'completed',
        toolCalls: [],
      });
    const writeWorkspaceFile = jest.fn().mockResolvedValue(undefined);
    const runBrowserSmoke = jest.fn().mockResolvedValue({ ok: true });
    const saveProjectSnapshot = jest.fn().mockResolvedValue({ saved: true });
    const job = withHarnessProof(baseJob({
      executionId: 'exec-ordinary-agent',
    }));
    expect(() => verifyHarnessEntitlementProof(job)).not.toThrow();

    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools,
      }),
      apiGateway: {
        notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
        writeWorkspaceFile,
        runBrowserSmoke,
        createWorkspaceCheckpoint: jest.fn().mockResolvedValue({
          commitHash: 'abc',
          filesChanged: 1,
        }),
        saveProjectSnapshot,
      },
    });

    await processJob({ id: 'job-ordinary-agent', data: job });

    expect(executeWithTools.mock.calls[0][1].tools.map(
      (tool: { name: string }) => tool.name,
    )).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'delete_file',
      'run_validation',
      'search_workspace',
    ]);
    expect(writeWorkspaceFile).toHaveBeenCalledTimes(1);
    expect(runBrowserSmoke).toHaveBeenCalledTimes(1);
    expect(saveProjectSnapshot).toHaveBeenCalledTimes(1);
    expect(ledger.status.value).toBe('completed');
    await worker.onModuleDestroy();
  });

  it('fails the proof when harnessReadOnly is added or removed', () => {
    const signedReadOnly = withHarnessProof(baseJob({
      executionId: 'exec-tamper-remove',
      harnessReadOnly: true,
    }));
    expect(() => verifyHarnessEntitlementProof(signedReadOnly)).not.toThrow();
    const removed = { ...signedReadOnly, harnessReadOnly: false };
    expect(() => verifyHarnessEntitlementProof(removed)).toThrow(HarnessEntitlementError);
    try {
      verifyHarnessEntitlementProof(removed);
    } catch (error) {
      expect(error).toBeInstanceOf(HarnessEntitlementError);
      expect((error as HarnessEntitlementError).code).toBe(
        HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH,
      );
    }

    const signedOrdinary = withHarnessProof(baseJob({
      executionId: 'exec-tamper-add',
    }));
    const added = { ...signedOrdinary, harnessReadOnly: true };
    expect(() => verifyHarnessEntitlementProof(added)).toThrow(HarnessEntitlementError);
    try {
      verifyHarnessEntitlementProof(added);
    } catch (error) {
      expect((error as HarnessEntitlementError).code).toBe(
        HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH,
      );
    }
  });

  it('fails closed with no plain fallback when the proof is missing or the tool loop is off', async () => {
    const ledger = createLedgerMock();
    const execute = jest.fn().mockResolvedValue({
      output: 'plain fallback',
      tokensUsed: 1,
      model: 'should-not-run',
    });
    const executeWithTools = jest.fn();
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools,
      }),
      apiGateway: {
        notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
      },
    });

    const missingProof = baseJob({
      executionId: 'exec-missing-proof',
      harnessReadOnly: true,
    });
    await expect(processJob({
      id: 'job-missing-proof',
      data: missingProof,
    })).rejects.toMatchObject({ code: HARNESS_ENTITLEMENT_PROOF_MISSING });
    ledger.status.value = 'pending';

    const notHarness = baseJob({
      executionId: 'exec-not-harness',
      harnessReadOnly: true,
      harnessVersion: undefined,
    });
    delete notHarness.harnessVersion;
    await expect(processJob({
      id: 'job-not-harness',
      data: notHarness,
    })).rejects.toMatchObject({ code: HARNESS_ENTITLEMENT_PROOF_MISSING });
    ledger.status.value = 'pending';

    const malformed = baseJob({
      executionId: 'exec-malformed-readonly',
      harnessReadOnly: true,
      harnessVersion: undefined,
      harnessEntitlementProof: { version: 1 },
    });
    delete malformed.harnessVersion;
    await expect(processJob({
      id: 'job-malformed-readonly',
      data: malformed,
    })).rejects.toMatchObject({ code: HARNESS_ENTITLEMENT_PROOF_MALFORMED });

    expect(execute).not.toHaveBeenCalled();
    expect(executeWithTools).not.toHaveBeenCalled();
    expect(ledger.status.value).toBe('failed');
    await worker.onModuleDestroy();

    enableAllToolFlags(false);
    const loopOffLedger = createLedgerMock();
    const loopOffExecute = jest.fn().mockResolvedValue({
      output: 'plain fallback',
      tokensUsed: 1,
      model: 'should-not-run',
    });
    const loopOffTools = jest.fn();
    const loopOff = await startWorker({
      query: loopOffLedger.query,
      execute: loopOffExecute,
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools: loopOffTools,
      }),
      apiGateway: {
        notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
      },
    });
    await expect(loopOff.processJob({
      id: 'job-loop-off',
      data: withHarnessProof(baseJob({
        executionId: 'exec-loop-off',
        harnessReadOnly: true,
      })),
    })).rejects.toMatchObject({ reason: 'tool_loop_disabled' });
    expect(loopOffExecute).not.toHaveBeenCalled();
    expect(loopOffTools).not.toHaveBeenCalled();
    expect(loopOffLedger.status.value).toBe('failed');
    await loopOff.worker.onModuleDestroy();
  });

  function profileGateway(overrides: Record<string, jest.Mock> = {}) {
    return {
      notifyExecutionComplete: jest.fn().mockResolvedValue(undefined),
      readWorkspaceFile: jest.fn().mockResolvedValue({
        path: 'slug.js',
        content: 'existing',
      }),
      listWorkspaceDirectory: jest.fn().mockResolvedValue({ entries: [] }),
      searchWorkspace: jest.fn().mockResolvedValue({
        query: 'slug',
        results: [],
        truncated: false,
      }),
      writeWorkspaceFile: jest.fn().mockResolvedValue(undefined),
      deleteWorkspaceFile: jest.fn().mockResolvedValue(undefined),
      runWorkspaceValidation: jest.fn(async (_sessionId: string, command: string) => ({
        exitCode: command === 'npm run build' ? 1 : 0,
        stdout: '',
        stderr: '',
      })),
      runBrowserSmoke: jest.fn().mockResolvedValue({ ok: true }),
      createWorkspaceCheckpoint: jest.fn().mockResolvedValue({
        commitHash: 'abc123save',
        filesChanged: 1,
      }),
      saveProjectSnapshot: jest.fn().mockResolvedValue({ saved: true }),
      ...overrides,
    };
  }

  function advertisedNames(executeWithTools: jest.Mock): string[] {
    return executeWithTools.mock.calls[0][1].tools.map(
      (tool: { name: string }) => tool.name,
    );
  }

  function toolResult(
    executeWithTools: jest.Mock,
    toolName: string,
  ): { success: boolean; errorMessage?: string } | undefined {
    const results = executeWithTools.mock.calls[1][1].toolResults as Array<{
      toolName: string;
      success: boolean;
      errorMessage?: string;
    }>;
    return results.find((result) => result.toolName === toolName);
  }

  function completedMetadata(ledger: {
    completedUpdates: Array<{ params: unknown[] }>;
  }): Record<string, unknown> {
    return JSON.parse(String(ledger.completedUpdates[0].params[2])) as Record<
      string,
      unknown
    >;
  }

  function storedFailure(ledger: {
    failedUpdates: Array<{ params: unknown[] }>;
  }): { code: string; message: string } {
    const update = ledger.failedUpdates.find((entry) =>
      String(entry.params[1] ?? '').includes('executionError'),
    );
    expect(update).toBeDefined();
    const metadata = JSON.parse(String(update?.params[1])) as {
      executionError: { code: string; message: string };
    };
    return metadata.executionError;
  }

  async function runProfile(input: {
    executionId: string;
    profile: 'read' | 'review' | 'write';
    harnessReadOnly?: boolean;
    toolCalls: ReturnType<typeof toolCall>[];
    gateway?: ReturnType<typeof profileGateway>;
  }) {
    const ledger = createLedgerMock();
    const execute = jest.fn();
    const executeWithTools = jest
      .fn()
      .mockResolvedValueOnce({
        output: 'using tools',
        tokensUsed: 2,
        model: 'stub-profile',
        finishReason: 'tool_calls',
        toolCalls: input.toolCalls,
      })
      .mockResolvedValueOnce({
        output: 'Finished the step.',
        tokensUsed: 1,
        model: 'stub-profile',
        finishReason: 'completed',
        toolCalls: [],
      });
    const gateway = input.gateway ?? profileGateway();
    const job = withHarnessProof(baseJob({
      executionId: input.executionId,
      harnessToolProfile: input.profile,
      ...(input.harnessReadOnly === undefined
        ? {}
        : { harnessReadOnly: input.harnessReadOnly }),
    }));
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute,
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools,
      }),
      apiGateway: gateway,
    });
    await processJob({ id: `job-${input.executionId}`, data: job });
    return { ledger, execute, executeWithTools, gateway, worker };
  }

  it('COLLAB-WRITE-01 gives each profile exactly its tools and never delete', async () => {
    const readTools = [
      toolCall('call-read', 'read_file', { path: 'slug.js' }),
      toolCall('call-list', 'list_files', { path: 'src' }),
      toolCall('call-search', 'search_workspace', { query: 'slug' }),
      toolCall('call-write', 'write_file', { path: 'slug.js', content: 'nope' }),
      toolCall('call-delete', 'delete_file', { path: 'slug.js' }),
      toolCall('call-validate', 'run_validation', { command: 'npm test' }),
      toolCall('call-browser', 'browser_smoke', { url: '/' }),
    ];
    const read = await runProfile({
      executionId: 'exec-profile-read',
      profile: 'read',
      harnessReadOnly: true,
      toolCalls: readTools,
    });
    expect(advertisedNames(read.executeWithTools)).toEqual([
      'list_files',
      'read_file',
      'search_workspace',
    ]);
    expect(read.gateway.readWorkspaceFile).toHaveBeenCalledTimes(1);
    expect(read.gateway.listWorkspaceDirectory).toHaveBeenCalledTimes(1);
    expect(read.gateway.searchWorkspace).toHaveBeenCalledTimes(1);
    expect(read.gateway.writeWorkspaceFile).not.toHaveBeenCalled();
    expect(read.gateway.deleteWorkspaceFile).not.toHaveBeenCalled();
    expect(read.gateway.runWorkspaceValidation).not.toHaveBeenCalled();
    expect(read.gateway.runBrowserSmoke).not.toHaveBeenCalled();
    expect(read.gateway.createWorkspaceCheckpoint).not.toHaveBeenCalled();
    expect(read.gateway.saveProjectSnapshot).not.toHaveBeenCalled();
    expect(toolResult(read.executeWithTools, 'write_file')?.errorMessage).toBe(
      'No handler registered for tool: write_file',
    );
    expect(toolResult(read.executeWithTools, 'delete_file')?.errorMessage).toBe(
      'No handler registered for tool: delete_file',
    );
    expect(read.execute).not.toHaveBeenCalled();
    const readMetadata = completedMetadata(read.ledger);
    expect(readMetadata.harnessChangedPaths).toEqual([]);
    expect(readMetadata.harnessValidationRuns).toEqual([]);
    expect(readMetadata.preApplyCheckpointHash).toBeUndefined();
    await read.worker.onModuleDestroy();

    const review = await runProfile({
      executionId: 'exec-profile-review',
      profile: 'review',
      toolCalls: [
        toolCall('call-read', 'read_file', { path: 'slug.js' }),
        toolCall('call-validate', 'run_validation', { command: 'npm test' }),
        toolCall('call-validate-fail', 'run_validation', { command: 'npm run build' }),
        toolCall('call-write', 'write_file', { path: 'slug.js', content: 'nope' }),
        toolCall('call-delete', 'delete_file', { path: 'slug.js' }),
      ],
    });
    expect(advertisedNames(review.executeWithTools)).toEqual([
      'list_files',
      'read_file',
      'run_validation',
      'search_workspace',
    ]);
    expect(review.gateway.runWorkspaceValidation).toHaveBeenCalledTimes(2);
    expect(review.gateway.writeWorkspaceFile).not.toHaveBeenCalled();
    expect(review.gateway.deleteWorkspaceFile).not.toHaveBeenCalled();
    expect(review.gateway.createWorkspaceCheckpoint).not.toHaveBeenCalled();
    expect(review.gateway.saveProjectSnapshot).not.toHaveBeenCalled();
    expect(toolResult(review.executeWithTools, 'write_file')?.errorMessage).toBe(
      'No handler registered for tool: write_file',
    );
    expect(toolResult(review.executeWithTools, 'delete_file')?.success).toBe(false);
    const reviewMetadata = completedMetadata(review.ledger);
    expect(reviewMetadata.harnessChangedPaths).toEqual([]);
    expect(reviewMetadata.harnessValidationRuns).toEqual([
      { command: 'npm test', passed: true },
      { command: 'npm run build', passed: false },
    ]);
    expect(reviewMetadata.preApplyCheckpointHash).toBeUndefined();
    await review.worker.onModuleDestroy();

    const order: string[] = [];
    const writeGateway = profileGateway({
      createWorkspaceCheckpoint: jest.fn(async () => {
        order.push('checkpoint');
        return { commitHash: 'abc123save', filesChanged: 1 };
      }),
      writeWorkspaceFile: jest.fn(async () => {
        order.push('write');
      }),
      saveProjectSnapshot: jest.fn(async () => {
        order.push('save');
        return { saved: true };
      }),
    });
    const write = await runProfile({
      executionId: 'exec-profile-write',
      profile: 'write',
      gateway: writeGateway,
      toolCalls: [
        toolCall('call-write', 'write_file', { path: 'slug.js', content: 'ok' }),
        toolCall('call-validate', 'run_validation', { command: 'npm test' }),
        toolCall('call-delete', 'delete_file', { path: 'slug.js' }),
        toolCall('call-browser', 'browser_smoke', { url: '/' }),
      ],
    });
    expect(advertisedNames(write.executeWithTools)).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'run_validation',
      'search_workspace',
    ]);
    expect(advertisedNames(write.executeWithTools)).not.toContain('delete_file');
    expect(writeGateway.deleteWorkspaceFile).not.toHaveBeenCalled();
    expect(writeGateway.runBrowserSmoke).not.toHaveBeenCalled();
    expect(toolResult(write.executeWithTools, 'delete_file')?.errorMessage).toBe(
      'No handler registered for tool: delete_file',
    );
    expect(order).toEqual(['checkpoint', 'write', 'save']);
    expect(writeGateway.createWorkspaceCheckpoint).toHaveBeenCalledTimes(1);
    expect(writeGateway.createWorkspaceCheckpoint.mock.invocationCallOrder[0]).toBeLessThan(
      writeGateway.writeWorkspaceFile.mock.invocationCallOrder[0],
    );
    const writeMetadata = completedMetadata(write.ledger);
    expect(writeMetadata.harnessChangedPaths).toEqual(['slug.js']);
    expect(writeMetadata.preApplyCheckpointHash).toBe('abc123save');
    expect(writeMetadata.harnessValidationRuns).toEqual([
      { command: 'npm test', passed: true },
    ]);
    await write.worker.onModuleDestroy();
  });

  it('COLLAB-WRITE-01 fails the proof when the profile is changed and fails closed when read-only disagrees', async () => {
    const signed = withHarnessProof(baseJob({
      executionId: 'exec-profile-tamper',
      harnessToolProfile: 'review',
    }));
    expect(() => verifyHarnessEntitlementProof(signed)).not.toThrow();
    const tampered = { ...signed, harnessToolProfile: 'write' };
    expect(() => verifyHarnessEntitlementProof(tampered)).toThrow(HarnessEntitlementError);
    try {
      verifyHarnessEntitlementProof(tampered);
    } catch (error) {
      expect((error as HarnessEntitlementError).code).toBe(
        HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH,
      );
    }
    expect(resolveHarnessToolProfile({
      harnessVersion: 'v1',
      harnessReadOnly: true,
      harnessToolProfile: 'write',
    })).toEqual({
      ok: false,
      profile: null,
      code: HARNESS_TOOL_PROFILE_CONFLICT,
      message: HARNESS_TOOL_PROFILE_CONFLICT_MESSAGE,
    });

    const tamperLedger = createLedgerMock();
    const tamperExecute = jest.fn();
    const tamperTools = jest.fn();
    const tamperRun = await startWorker({
      query: tamperLedger.query,
      execute: tamperExecute,
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools: tamperTools,
      }),
      apiGateway: profileGateway(),
    });
    await expect(tamperRun.processJob({
      id: 'job-profile-tamper',
      data: tampered,
    })).rejects.toMatchObject({
      code: HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH,
    });
    expect(tamperExecute).not.toHaveBeenCalled();
    expect(tamperTools).not.toHaveBeenCalled();
    await tamperRun.worker.onModuleDestroy();

    const disagree = withHarnessProof(baseJob({
      executionId: 'exec-profile-disagree',
      harnessReadOnly: true,
      harnessToolProfile: 'write',
    }));
    expect(() => verifyHarnessEntitlementProof(disagree)).not.toThrow();
    const disagreeLedger = createLedgerMock();
    const disagreeExecute = jest.fn();
    const disagreeTools = jest.fn();
    const disagreeRun = await startWorker({
      query: disagreeLedger.query,
      execute: disagreeExecute,
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools: disagreeTools,
      }),
      apiGateway: profileGateway(),
    });
    await disagreeRun.processJob({ id: 'job-profile-disagree', data: disagree });
    expect(disagreeExecute).not.toHaveBeenCalled();
    expect(disagreeTools).not.toHaveBeenCalled();
    expect(storedFailure(disagreeLedger)).toEqual({
      code: HARNESS_TOOL_PROFILE_CONFLICT,
      message: HARNESS_TOOL_PROFILE_CONFLICT_MESSAGE,
    });
    expect(disagreeLedger.status.value).toBe('failed');
    await disagreeRun.worker.onModuleDestroy();
  });

  it('COLLAB-WRITE-01 fails a profile job with a readable reason when its gate is off', async () => {
    async function expectGate(input: {
      executionId: string;
      profile: 'review' | 'write';
      writeTools: boolean;
      validationTools: boolean;
      code: string;
      message: string;
    }) {
      harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1 = {
        ...harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1,
        enableToolLoop: true,
        enableWriteTools: input.writeTools,
        enableValidationTools: input.validationTools,
        enablePreApplyCheckpoint: true,
      };
      const ledger = createLedgerMock();
      const execute = jest.fn();
      const executeWithTools = jest.fn();
      const gateway = profileGateway();
      const { worker, processJob } = await startWorker({
        query: ledger.query,
        execute,
        getAdapter: jest.fn().mockReturnValue({
          supportsToolUse: true,
          executeWithTools,
        }),
        apiGateway: gateway,
      });
      await processJob({
        id: `job-${input.executionId}`,
        data: withHarnessProof(baseJob({
          executionId: input.executionId,
          harnessToolProfile: input.profile,
        })),
      });
      expect(execute).not.toHaveBeenCalled();
      expect(executeWithTools).not.toHaveBeenCalled();
      expect(gateway.writeWorkspaceFile).not.toHaveBeenCalled();
      expect(gateway.runWorkspaceValidation).not.toHaveBeenCalled();
      expect(gateway.createWorkspaceCheckpoint).not.toHaveBeenCalled();
      expect(gateway.saveProjectSnapshot).not.toHaveBeenCalled();
      expect(storedFailure(ledger)).toEqual({
        code: input.code,
        message: input.message,
      });
      await worker.onModuleDestroy();
    }

    await expectGate({
      executionId: 'exec-write-gate',
      profile: 'write',
      writeTools: false,
      validationTools: true,
      code: HARNESS_WRITE_TOOLS_DISABLED,
      message: HARNESS_WRITE_TOOLS_DISABLED_MESSAGE,
    });
    await expectGate({
      executionId: 'exec-review-validation-gate',
      profile: 'review',
      writeTools: true,
      validationTools: false,
      code: HARNESS_VALIDATION_TOOLS_DISABLED,
      message: HARNESS_VALIDATION_TOOLS_DISABLED_MESSAGE,
    });
    await expectGate({
      executionId: 'exec-write-validation-gate',
      profile: 'write',
      writeTools: true,
      validationTools: false,
      code: HARNESS_VALIDATION_TOOLS_DISABLED,
      message: HARNESS_VALIDATION_TOOLS_DISABLED_MESSAGE,
    });

    harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1 = {
      ...harnessConfigModule.DEFAULT_AGENT_HARNESS_CONFIG_V1,
      enableToolLoop: true,
      enableWriteTools: false,
      enableValidationTools: false,
      enableBrowserSmoke: false,
      enablePreApplyCheckpoint: true,
    };
    const read = await runProfile({
      executionId: 'exec-read-flags-off',
      profile: 'read',
      harnessReadOnly: true,
      toolCalls: [toolCall('call-read', 'read_file', { path: 'slug.js' })],
    });
    expect(advertisedNames(read.executeWithTools)).toEqual([
      'list_files',
      'read_file',
      'search_workspace',
    ]);
    expect(read.ledger.status.value).toBe('completed');
    expect(read.gateway.createWorkspaceCheckpoint).not.toHaveBeenCalled();
    expect(read.gateway.saveProjectSnapshot).not.toHaveBeenCalled();
    await read.worker.onModuleDestroy();
  });

  it('COLLAB-WRITE-01 keeps delete, browser smoke and the proof on an agent-mode job', async () => {
    const ledger = createLedgerMock();
    const executeWithTools = jest
      .fn()
      .mockResolvedValueOnce({
        output: 'deleting',
        tokensUsed: 2,
        model: 'stub-agent',
        finishReason: 'tool_calls',
        toolCalls: [
          toolCall('call-delete', 'delete_file', { path: 'slug.js' }),
          toolCall('call-browser', 'browser_smoke', { url: '/' }),
        ],
      })
      .mockResolvedValueOnce({
        output: 'Agent finished.',
        tokensUsed: 1,
        model: 'stub-agent',
        finishReason: 'completed',
        toolCalls: [],
      });
    const gateway = profileGateway();
    const job = withHarnessProof(baseJob({
      executionId: 'exec-agent-tools',
    }));
    expect(job).not.toHaveProperty('harnessToolProfile');
    expect(() => verifyHarnessEntitlementProof(job)).not.toThrow();
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn(),
      getAdapter: jest.fn().mockReturnValue({
        supportsToolUse: true,
        executeWithTools,
      }),
      apiGateway: gateway,
    });
    await processJob({ id: 'job-agent-tools', data: job });
    expect(advertisedNames(executeWithTools)).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'delete_file',
      'run_validation',
      'search_workspace',
    ]);
    expect(gateway.deleteWorkspaceFile).toHaveBeenCalledTimes(1);
    expect(gateway.runBrowserSmoke).toHaveBeenCalledTimes(1);
    expect(gateway.createWorkspaceCheckpoint).toHaveBeenCalledTimes(1);
    expect(gateway.saveProjectSnapshot).toHaveBeenCalledTimes(1);
    const metadata = completedMetadata(ledger);
    expect(metadata).not.toHaveProperty('harnessChangedPaths');
    expect(metadata).not.toHaveProperty('harnessValidationRuns');
    expect(ledger.status.value).toBe('completed');
    await worker.onModuleDestroy();
  });
});

describe('RUN-ERROR-01: stored execution failure reason', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalStuckScan = process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS;

  function createLedgerMock(existingMetadata: Record<string, unknown> = {}) {
    const status = { value: 'pending' };
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
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
        return [{ metadata: existingMetadata }];
      }
      if (sql.includes('SELECT execution_status')) {
        return [{ execution_status: status.value }];
      }
      return [];
    });
    return { query, status, queries };
  }

  async function startWorker(deps: {
    query: jest.Mock;
    execute: jest.Mock;
    notifyExecutionComplete?: jest.Mock;
  }) {
    const worker = new WorkerProcessor(
      { query: deps.query } as never,
      { execute: deps.execute, getAdapter: jest.fn() } as never,
      {
        publishCompletion: jest.fn(),
        publishToken: jest.fn(),
        publishFileActions: jest.fn(),
      } as never,
      {
        notifyExecutionComplete:
          deps.notifyExecutionComplete ?? jest.fn().mockResolvedValue(undefined),
        createWorkspaceCheckpoint: jest.fn(),
      } as never,
    );
    await worker.onModuleInit();
    if (!capturedWorker.processor) {
      throw new Error('BullMQ worker processor was not captured');
    }
    return { worker, processJob: capturedWorker.processor };
  }

  function plainJob(
    executionId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: `job-${executionId}`,
      data: {
        executionId,
        provider: 'xai',
        adapter: 'xai',
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        prompt: 'Hello',
        model: 'grok-4.5',
        executionIntent: 'conversation',
        ...overrides,
      },
    };
  }

  function generalFailure(queries: Array<{ sql: string; params: unknown[] }>) {
    return queries.find(
      (entry) =>
        entry.sql.includes("SET execution_status = 'failed'") &&
        entry.sql.includes('COALESCE($3, tokens_used)'),
    );
  }

  function storedError(update: { params: unknown[] } | undefined): {
    code: string;
    message: string;
    metadata: Record<string, unknown>;
  } {
    expect(update).toBeDefined();
    expect(typeof update?.params[3]).toBe('string');
    const metadata = JSON.parse(String(update?.params[3])) as Record<string, unknown>;
    const executionError = metadata.executionError as { code: string; message: string };
    return { ...executionError, metadata };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS = '600000';
    capturedWorker.processor = null;
    capturedWorker.opts = null;
  });

  afterEach(() => {
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

  it('stores a thrown error code and a capped message, and keeps existing metadata', async () => {
    const ledger = createLedgerMock({
      keepMe: 'unrelated-value',
      agentId: 'agent-kept',
    });
    const error = new Error(`${'Provider declined the request. '.repeat(20)}\nsecond line`);
    (error as Error & { code: string }).code = 'provider_unavailable';
    const notifyExecutionComplete = jest.fn().mockResolvedValue(undefined);
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockRejectedValue(error),
      notifyExecutionComplete,
    });

    await expect(
      processJob(plainJob('exec-coded-failure')),
    ).rejects.toBe(error);

    const update = generalFailure(ledger.queries);
    const stored = storedError(update);
    expect(update?.sql).toContain('metadata = $4::jsonb');
    expect(update?.params[0]).toBe('exec-coded-failure');
    expect(update?.params[1]).toBe('grok-4.5');
    expect(update?.params[2]).toBeNull();
    expect(stored.code).toBe('provider_unavailable');
    expect(stored.message.length).toBe(300);
    expect(stored.message.startsWith('Provider declined the request.')).toBe(true);
    expect(stored.message).not.toContain('\n');
    expect(stored.message).not.toContain('second line');
    expect(stored.metadata.keepMe).toBe('unrelated-value');
    expect(stored.metadata.agentId).toBe('agent-kept');
    expect(notifyExecutionComplete).not.toHaveBeenCalled();
    expect(ledger.status.value).toBe('failed');
    await worker.onModuleDestroy();
  });

  it('stores execution_failed when the thrown error has no short code', async () => {
    const ledger = createLedgerMock({ keepMe: 'unrelated-value' });
    const error = new Error('The   provider\trejected the request');
    (error as Error & { code: string }).code = 'not a code';
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockRejectedValue(error),
    });

    await expect(processJob(plainJob('exec-plain-failure'))).rejects.toBe(error);

    const stored = storedError(generalFailure(ledger.queries));
    expect(stored.code).toBe('execution_failed');
    expect(stored.message).toBe('The provider rejected the request');
    expect(stored.metadata.keepMe).toBe('unrelated-value');
    await worker.onModuleDestroy();
  });

  it('replaces a stack, a key, prompt text, or file content with a fixed sentence', async () => {
    const cases: Array<{ id: string; message: string; prompt?: string; banned: string }> = [
      {
        id: 'exec-stack',
        message:
          'The provider declined the request\n    at Worker.process (worker.processor.ts:2100:15)',
        banned: 'worker.processor.ts',
      },
      {
        id: 'exec-key',
        message: 'provider failed api_key=sk-abcdefghijklmnopqrstuvwxyz',
        banned: 'sk-',
      },
      {
        id: 'exec-prompt',
        prompt: 'Please build a landing page with a green header and a footer.',
        message: 'provider echoed Please build a landing page with a green header and a footer.',
        banned: 'landing page',
      },
      {
        id: 'exec-file',
        message: 'wrote the file\n```\nconst secret = 1;\n```',
        banned: 'const secret',
      },
    ];

    for (const entry of cases) {
      const ledger = createLedgerMock();
      const { worker, processJob } = await startWorker({
        query: ledger.query,
        execute: jest.fn().mockRejectedValue(new Error(entry.message)),
      });
      await expect(
        processJob(
          plainJob(entry.id, entry.prompt ? { prompt: entry.prompt } : {}),
        ),
      ).rejects.toThrow(entry.message);
      const stored = storedError(generalFailure(ledger.queries));
      expect(stored.code).toBe('execution_failed');
      expect(stored.message).toBe('This step failed.');
      expect(JSON.stringify(stored.metadata)).not.toContain(entry.banned);
      await worker.onModuleDestroy();
    }
  });

  it('keeps the existing harness message when that error is thrown', async () => {
    const ledger = createLedgerMock({ keepMe: 'unrelated-value' });
    const error = new HarnessRoutingError('tool_loop_disabled');
    error.message = `${error.message}\n    at Worker.process (worker.processor.ts:10:5)`;
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockRejectedValue(error),
    });

    await expect(processJob(plainJob('exec-harness-message'))).rejects.toBe(error);

    const stored = storedError(generalFailure(ledger.queries));
    expect(stored.code).toBe('harness_tool_loop_disabled');
    expect(stored.message).toBe(
      'Requested Harness execution cannot proceed (tool_loop_disabled)',
    );
    expect(stored.message).not.toContain('worker.processor.ts');
    expect(stored.metadata.keepMe).toBe('unrelated-value');
    await worker.onModuleDestroy();
  });

  it('leaves a successful conversation job without an executionError', async () => {
    const ledger = createLedgerMock({ keepMe: 'unrelated-value' });
    const notifyExecutionComplete = jest.fn().mockResolvedValue(undefined);
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockResolvedValue({
        output: 'ok',
        tokensUsed: 3,
        model: 'grok-4.5',
      }),
      notifyExecutionComplete,
    });

    await processJob(plainJob('exec-success'));

    expect(ledger.status.value).toBe('completed');
    const completed = ledger.queries.find((entry) =>
      entry.sql.includes("SET execution_status = 'completed'"),
    );
    const metadata = JSON.parse(String(completed?.params[2])) as Record<string, unknown>;
    expect(metadata.keepMe).toBe('unrelated-value');
    expect(metadata.executionError).toBeUndefined();
    expect(generalFailure(ledger.queries)).toBeUndefined();
    expect(notifyExecutionComplete).toHaveBeenCalledWith('exec-success');
    await worker.onModuleDestroy();
  });

  it('leaves the file-action contract failure path unchanged', async () => {
    const ledger = createLedgerMock({ keepMe: 'unrelated-value' });
    const notifyExecutionComplete = jest.fn().mockResolvedValue(undefined);
    const { worker, processJob } = await startWorker({
      query: ledger.query,
      execute: jest.fn().mockResolvedValue({
        output: 'ok',
        tokensUsed: 3,
        model: 'grok-4.5',
        fileActions: [],
      }),
      notifyExecutionComplete,
    });

    await processJob(
      plainJob('exec-contract', { executionIntent: 'workspace_mutation' }),
    );

    expect(ledger.status.value).toBe('failed');
    expect(generalFailure(ledger.queries)).toBeUndefined();
    const contractUpdate = ledger.queries.find(
      (entry) =>
        entry.sql.includes("SET execution_status = 'failed'") &&
        entry.sql.includes('tokens_used = $2'),
    );
    expect(contractUpdate).toBeDefined();
    expect(contractUpdate?.sql).not.toContain('COALESCE($3, tokens_used)');
    const metadata = JSON.parse(String(contractUpdate?.params[2])) as {
      keepMe?: string;
      executionError?: { code: string; message: string };
    };
    expect(metadata.keepMe).toBe('unrelated-value');
    expect(metadata.executionError).toEqual({
      code: FILE_ACTION_CONTRACT_FAILURE_CODE,
      message: FILE_ACTION_CONTRACT_FAILURE_MESSAGE,
    });
    expect(notifyExecutionComplete).not.toHaveBeenCalled();
    await worker.onModuleDestroy();
  });
});
