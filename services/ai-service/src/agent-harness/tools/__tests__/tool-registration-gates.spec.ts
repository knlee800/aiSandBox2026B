/**
 * AGENT-HARNESS-WRITE-CANARY-A: Behavioral tests for enableWriteTools registration gating.
 *
 * Verifies that the conditional tool registration logic (as implemented in
 * worker.processor.ts) correctly includes or excludes write/delete handlers
 * based on the resolved config's enableWriteTools flag.
 *
 * These tests replicate the dispatcher setup pattern from the worker without
 * requiring BullMQ, Redis, or any runtime infrastructure.
 */

import { ToolDispatcher } from '../tool-dispatcher';
import {
  createReadFileHandler,
  createListFilesHandler,
  createWriteFileHandler,
  createDeleteFileHandler,
} from '../handlers/file-tool-handlers';

function createMockClient() {
  return {
    readWorkspaceFile: jest.fn(),
    listWorkspaceDirectory: jest.fn(),
    writeWorkspaceFile: jest.fn(),
    deleteWorkspaceFile: jest.fn(),
    createWorkspaceCheckpoint: jest.fn(),
  } as any;
}

function registerToolsWithConfig(
  dispatcher: ToolDispatcher,
  config: { enableWriteTools: boolean },
) {
  const client = createMockClient();
  const sessionId = 'test-session';

  dispatcher.registerHandler(
    'read_file',
    createReadFileHandler({ client, sessionId, maxFileReadBytes: 262_144 }),
  );
  dispatcher.registerHandler(
    'list_files',
    createListFilesHandler({ client, sessionId }),
  );

  if (config.enableWriteTools) {
    dispatcher.registerHandler(
      'write_file',
      createWriteFileHandler({ client, sessionId, maxFileWriteBytes: 131_072 }),
    );
    dispatcher.registerHandler(
      'delete_file',
      createDeleteFileHandler({ client, sessionId }),
    );
  }
}

describe('enableWriteTools=false excludes write/delete from dispatcher', () => {
  it('registers only read_file and list_files (2 handlers)', () => {
    const dispatcher = new ToolDispatcher();
    registerToolsWithConfig(dispatcher, { enableWriteTools: false });

    expect(dispatcher.registeredToolCount).toBe(2);
    expect(dispatcher.hasHandler('read_file')).toBe(true);
    expect(dispatcher.hasHandler('list_files')).toBe(true);
    expect(dispatcher.hasHandler('write_file')).toBe(false);
    expect(dispatcher.hasHandler('delete_file')).toBe(false);
  });

  it('write_file dispatch returns TOOL_NOT_FOUND', async () => {
    const dispatcher = new ToolDispatcher();
    registerToolsWithConfig(dispatcher, { enableWriteTools: false });

    const result = await dispatcher.dispatch({
      callId: 'test-call',
      toolName: 'write_file',
      arguments: { path: 'file.ts', content: 'data' },
      providerKind: 'stub',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TOOL_NOT_FOUND');
  });

  it('delete_file dispatch returns TOOL_NOT_FOUND', async () => {
    const dispatcher = new ToolDispatcher();
    registerToolsWithConfig(dispatcher, { enableWriteTools: false });

    const result = await dispatcher.dispatch({
      callId: 'test-call',
      toolName: 'delete_file',
      arguments: { path: 'file.ts' },
      providerKind: 'stub',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TOOL_NOT_FOUND');
  });
});

describe('enableWriteTools=true includes write/delete in dispatcher', () => {
  it('registers read_file, list_files, write_file, and delete_file (4 handlers)', () => {
    const dispatcher = new ToolDispatcher();
    registerToolsWithConfig(dispatcher, { enableWriteTools: true });

    expect(dispatcher.registeredToolCount).toBe(4);
    expect(dispatcher.hasHandler('read_file')).toBe(true);
    expect(dispatcher.hasHandler('list_files')).toBe(true);
    expect(dispatcher.hasHandler('write_file')).toBe(true);
    expect(dispatcher.hasHandler('delete_file')).toBe(true);
  });

  it('write_file dispatch calls handler (not TOOL_NOT_FOUND)', async () => {
    const dispatcher = new ToolDispatcher();
    const client = createMockClient();
    client.writeWorkspaceFile.mockResolvedValue(undefined);

    dispatcher.registerHandler(
      'read_file',
      createReadFileHandler({ client, sessionId: 's1', maxFileReadBytes: 262_144 }),
    );
    dispatcher.registerHandler(
      'list_files',
      createListFilesHandler({ client, sessionId: 's1' }),
    );
    dispatcher.registerHandler(
      'write_file',
      createWriteFileHandler({ client, sessionId: 's1', maxFileWriteBytes: 131_072 }),
    );
    dispatcher.registerHandler(
      'delete_file',
      createDeleteFileHandler({ client, sessionId: 's1' }),
    );

    const result = await dispatcher.dispatch({
      callId: 'test-call',
      toolName: 'write_file',
      arguments: { path: 'new-file.ts', content: 'const x = 1;' },
      providerKind: 'stub',
    });

    expect(result.success).toBe(true);
    expect(result.errorCode).toBeUndefined();
    expect(client.writeWorkspaceFile).toHaveBeenCalledWith(
      's1',
      'new-file.ts',
      'const x = 1;',
      expect.any(AbortSignal),
    );
  });

  it('delete_file dispatch calls handler (not TOOL_NOT_FOUND)', async () => {
    const dispatcher = new ToolDispatcher();
    const client = createMockClient();
    client.deleteWorkspaceFile.mockResolvedValue(undefined);

    dispatcher.registerHandler(
      'read_file',
      createReadFileHandler({ client, sessionId: 's1', maxFileReadBytes: 262_144 }),
    );
    dispatcher.registerHandler(
      'list_files',
      createListFilesHandler({ client, sessionId: 's1' }),
    );
    dispatcher.registerHandler(
      'write_file',
      createWriteFileHandler({ client, sessionId: 's1', maxFileWriteBytes: 131_072 }),
    );
    dispatcher.registerHandler(
      'delete_file',
      createDeleteFileHandler({ client, sessionId: 's1' }),
    );

    const result = await dispatcher.dispatch({
      callId: 'test-call',
      toolName: 'delete_file',
      arguments: { path: 'old-file.ts' },
      providerKind: 'stub',
    });

    expect(result.success).toBe(true);
    expect(result.errorCode).toBeUndefined();
    expect(client.deleteWorkspaceFile).toHaveBeenCalledWith(
      's1',
      'old-file.ts',
      expect.any(AbortSignal),
    );
  });
});

describe('enableWriteTools gate does not affect read-only tools', () => {
  it('read_file works regardless of enableWriteTools value', async () => {
    const dispatcherOff = new ToolDispatcher();
    registerToolsWithConfig(dispatcherOff, { enableWriteTools: false });

    const dispatcherOn = new ToolDispatcher();
    registerToolsWithConfig(dispatcherOn, { enableWriteTools: true });

    expect(dispatcherOff.hasHandler('read_file')).toBe(true);
    expect(dispatcherOn.hasHandler('read_file')).toBe(true);
  });

  it('list_files works regardless of enableWriteTools value', async () => {
    const dispatcherOff = new ToolDispatcher();
    registerToolsWithConfig(dispatcherOff, { enableWriteTools: false });

    const dispatcherOn = new ToolDispatcher();
    registerToolsWithConfig(dispatcherOn, { enableWriteTools: true });

    expect(dispatcherOff.hasHandler('list_files')).toBe(true);
    expect(dispatcherOn.hasHandler('list_files')).toBe(true);
  });
});

describe('enableToolLoop=false prevents harness activation', () => {
  it('DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop defaults to false', () => {
    const { DEFAULT_AGENT_HARNESS_CONFIG_V1 } = require('../../config/agent-harness.config');
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
  });

  it('DEFAULT_AGENT_HARNESS_CONFIG_V1.enableWriteTools defaults to false', () => {
    const { DEFAULT_AGENT_HARNESS_CONFIG_V1 } = require('../../config/agent-harness.config');
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableWriteTools).toBe(false);
  });

  it('createAgentHarnessConfigV1 with no env vars produces enableToolLoop=false', () => {
    const { createAgentHarnessConfigV1 } = require('../../config/agent-harness.config');
    const config = createAgentHarnessConfigV1({});
    expect(config.enableToolLoop).toBe(false);
    expect(config.enableWriteTools).toBe(false);
  });

  it('createAgentHarnessConfigV1 with AGENT_HARNESS_ENABLE_WRITE_TOOLS=true produces enableWriteTools=true', () => {
    const { createAgentHarnessConfigV1 } = require('../../config/agent-harness.config');
    const config = createAgentHarnessConfigV1({
      AGENT_HARNESS_ENABLE_TOOL_LOOP: 'true',
      AGENT_HARNESS_ENABLE_WRITE_TOOLS: 'true',
    });
    expect(config.enableToolLoop).toBe(true);
    expect(config.enableWriteTools).toBe(true);
  });

  it('createAgentHarnessConfigV1 with AGENT_HARNESS_ENABLE_WRITE_TOOLS=false produces enableWriteTools=false', () => {
    const { createAgentHarnessConfigV1 } = require('../../config/agent-harness.config');
    const config = createAgentHarnessConfigV1({
      AGENT_HARNESS_ENABLE_TOOL_LOOP: 'true',
      AGENT_HARNESS_ENABLE_WRITE_TOOLS: 'false',
    });
    expect(config.enableToolLoop).toBe(true);
    expect(config.enableWriteTools).toBe(false);
  });
});

describe('no real filesystem write occurs during tool handler tests', () => {
  it('write_file handler calls mocked client, not real filesystem', async () => {
    const client = createMockClient();
    client.writeWorkspaceFile.mockResolvedValue(undefined);

    const handler = createWriteFileHandler({
      client,
      sessionId: 'safe-session',
      maxFileWriteBytes: 131_072,
    });

    await handler({ path: 'canary.md', content: '# Test' });

    expect(client.writeWorkspaceFile).toHaveBeenCalledTimes(1);
    expect(client.writeWorkspaceFile).toHaveBeenCalledWith(
      'safe-session',
      'canary.md',
      '# Test',
      undefined,
    );
  });

  it('delete_file handler calls mocked client, not real filesystem', async () => {
    const client = createMockClient();
    client.deleteWorkspaceFile.mockResolvedValue(undefined);

    const handler = createDeleteFileHandler({
      client,
      sessionId: 'safe-session',
    });

    await handler({ path: 'old.txt' });

    expect(client.deleteWorkspaceFile).toHaveBeenCalledTimes(1);
    expect(client.deleteWorkspaceFile).toHaveBeenCalledWith(
      'safe-session',
      'old.txt',
      undefined,
    );
  });
});
