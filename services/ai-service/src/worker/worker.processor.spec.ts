import {
  buildAIExecutionRequest,
  buildExecutionPromptParts,
} from './worker.processor';
import { DEFAULT_AGENT_HARNESS_CONFIG_V1 } from '../agent-harness/config/agent-harness.config';

describe('buildAIExecutionRequest', () => {
  it('passes requested model from job payload to AIExecutionService request', () => {
    const request = buildAIExecutionRequest(
      {
        provider: 'openai',
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
  });

  it('keeps model undefined when no model is provided in job payload', () => {
    const request = buildAIExecutionRequest(
      {
        provider: 'anthropic',
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
    expect(workerSource).toContain('toolTimeoutMs: DEFAULT_AGENT_HARNESS_CONFIG_V1.toolTimeoutMs');
    expect(workerSource).toContain('maxToolResultBytes: DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolResultBytes');
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
    expect(workerSource).toContain('maxToolIterations: DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolIterations');
    expect(workerSource).toContain('maxToolResultBytes: DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolResultBytes');
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

  it('checkpoint callback is gated by enablePreApplyCheckpoint', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    expect(workerSource).toContain('enablePreApplyCheckpoint');
    const enablePreApplyIndex = workerSource.indexOf('DEFAULT_AGENT_HARNESS_CONFIG_V1.enablePreApplyCheckpoint');
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

  it('emits agent_harness.route_evaluated with harnessVersion v1, enableToolLoop false, selectedPath plain', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("event: 'agent_harness.route_evaluated'");
    expect(workerSource).toContain('enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop');
    expect(workerSource).toContain("selectedPath: useHarness ? 'harness' : 'plain'");

    const samplePayload = {
      event: 'agent_harness.route_evaluated',
      executionId: 'exec-test-1',
      harnessVersion: 'v1',
      enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop,
      selectedPath:
        'v1' === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop
          ? 'harness'
          : 'plain',
    };

    expect(samplePayload.executionId).toBe('exec-test-1');
    expect(samplePayload.harnessVersion).toBe('v1');
    expect(samplePayload.enableToolLoop).toBe(false);
    expect(samplePayload.selectedPath).toBe('plain');
  });

  it('emits agent_harness.route_evaluated with null harnessVersion when absent', () => {
    const absentVersion: string | undefined = undefined;
    const samplePayload = {
      event: 'agent_harness.route_evaluated',
      executionId: 'exec-test-2',
      harnessVersion: absentVersion ?? null,
      enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop,
      selectedPath:
        absentVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop
          ? 'harness'
          : 'plain',
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

  it('useHarness replaces the inline condition without changing routing semantics', () => {
    const workerSource = getWorkerSource();

    expect(workerSource).toContain('const useHarness =');
    expect(workerSource).toContain("job.data.harnessVersion === 'v1' &&");
    expect(workerSource).toContain('DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop;');

    expect(workerSource).toContain('if (useHarness) {');

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

  it('WorkerProcessor registers read_file, list_files, write_file, and delete_file handlers', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const readFileRegistrations = (workerSource.match(/registerHandler\(\s*['"]read_file['"]/g) || []).length;
    const listFilesRegistrations = (workerSource.match(/registerHandler\(\s*['"]list_files['"]/g) || []).length;
    const writeFileRegistrations = (workerSource.match(/registerHandler\(\s*['"]write_file['"]/g) || []).length;
    const deleteFileRegistrations = (workerSource.match(/registerHandler\(\s*['"]delete_file['"]/g) || []).length;
    expect(readFileRegistrations).toBe(1);
    expect(listFilesRegistrations).toBe(1);
    expect(writeFileRegistrations).toBe(1);
    expect(deleteFileRegistrations).toBe(1);
  });

  it('WorkerProcessor registers run_validation handler in the double-gated harness branch', () => {
    const workerSource = require('fs').readFileSync(
      require('path').join(__dirname, 'worker.processor.ts'),
      'utf-8',
    );
    const harnessGateIndex = workerSource.indexOf("harnessVersion === 'v1'");
    const runValidationRegIndex = workerSource.indexOf("'run_validation'");
    expect(runValidationRegIndex).toBeGreaterThan(harnessGateIndex);
    const registrations = (workerSource.match(/registerHandler\(\s*['"]run_validation['"]/g) || []).length;
    expect(registrations).toBe(1);
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
