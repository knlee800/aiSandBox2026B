import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  appendHarnessProgress,
  buildAgentModeRequestFields,
  harnessProgressShowsWrite,
  parseAgentWriteEnabled,
  parseHarnessEntitled,
  parseHarnessProgressMessage,
  toolLabelKey,
  type HarnessProgressItem,
} from './workspace-agent-mode.logic';

describe('workspace agent mode logic', () => {
  test('parseHarnessProgressMessage returns step, tool, and target for a valid message', () => {
    assert.deepEqual(
      parseHarnessProgressMessage({
        type: 'harness_progress',
        step: 2,
        tool: 'read_file',
        target: 'src/app.ts',
      }),
      {
        step: 2,
        tool: 'read_file',
        target: 'src/app.ts',
      },
    );
  });

  test('parseHarnessProgressMessage omits a missing or empty target', () => {
    const missing = parseHarnessProgressMessage({
      type: 'harness_progress',
      step: 1,
      tool: 'list_files',
    });
    assert.deepEqual(missing, { step: 1, tool: 'list_files' });
    assert.equal(missing !== null && 'target' in missing, false);

    const empty = parseHarnessProgressMessage({
      type: 'harness_progress',
      step: 1,
      tool: 'list_files',
      target: '',
    });
    assert.deepEqual(empty, { step: 1, tool: 'list_files' });
  });

  test('parseHarnessProgressMessage returns null for an invalid message', () => {
    assert.equal(parseHarnessProgressMessage(null), null);
    assert.equal(parseHarnessProgressMessage('harness_progress'), null);
    assert.equal(parseHarnessProgressMessage([]), null);
    assert.equal(parseHarnessProgressMessage({ type: 'token', content: 'hi' }), null);
    assert.equal(
      parseHarnessProgressMessage({ type: 'harness_progress', tool: 'read_file' }),
      null,
    );
    assert.equal(
      parseHarnessProgressMessage({ type: 'harness_progress', step: 1.5, tool: 'read_file' }),
      null,
    );
    assert.equal(
      parseHarnessProgressMessage({ type: 'harness_progress', step: 0, tool: 'read_file' }),
      null,
    );
    assert.equal(
      parseHarnessProgressMessage({ type: 'harness_progress', step: '1', tool: 'read_file' }),
      null,
    );
    assert.equal(
      parseHarnessProgressMessage({ type: 'harness_progress', step: 1, tool: '   ' }),
      null,
    );
    assert.equal(
      parseHarnessProgressMessage({
        type: 'harness_progress',
        step: 1,
        tool: 'read_file',
        target: 4,
      }),
      null,
    );
  });

  test('appendHarnessProgress adds steps in arrival order', () => {
    const first: HarnessProgressItem = { step: 1, tool: 'list_files', target: 'src' };
    const second: HarnessProgressItem = { step: 3, tool: 'read_file', target: 'src/app.ts' };
    const original = [first];
    const next = appendHarnessProgress(original, second);

    assert.deepEqual(next, [first, second]);
    assert.notEqual(next, original);
    assert.deepEqual(original, [first]);
  });

  test('appendHarnessProgress ignores a repeated step number', () => {
    const list: HarnessProgressItem[] = [
      { step: 1, tool: 'list_files' },
      { step: 2, tool: 'read_file', target: 'src/app.ts' },
    ];
    const next = appendHarnessProgress(list, { step: 2, tool: 'read_file', target: 'other.ts' });

    assert.deepEqual(next, list);
    assert.notEqual(next, list);
    assert.equal(list.length, 2);
  });

  test('appendHarnessProgress restarts from a lower step after a provider retry', () => {
    const list: HarnessProgressItem[] = [
      { step: 1, tool: 'list_files' },
      { step: 2, tool: 'read_file' },
      { step: 3, tool: 'write_file', target: 'src/app.ts' },
    ];
    const restarted = appendHarnessProgress(list, { step: 1, tool: 'list_files', target: 'src' });

    assert.deepEqual(restarted, [{ step: 1, tool: 'list_files', target: 'src' }]);
    assert.deepEqual(
      appendHarnessProgress(restarted, { step: 2, tool: 'read_file', target: 'src/app.ts' }),
      [
        { step: 1, tool: 'list_files', target: 'src' },
        { step: 2, tool: 'read_file', target: 'src/app.ts' },
      ],
    );
  });

  test('harnessProgressShowsWrite is true only for write_file or delete_file', () => {
    assert.equal(harnessProgressShowsWrite([]), false);
    assert.equal(
      harnessProgressShowsWrite([
        { step: 1, tool: 'read_file' },
        { step: 2, tool: 'search_workspace' },
      ]),
      false,
    );
    assert.equal(
      harnessProgressShowsWrite([
        { step: 1, tool: 'read_file' },
        { step: 2, tool: 'write_file', target: 'src/app.ts' },
      ]),
      true,
    );
    assert.equal(
      harnessProgressShowsWrite([{ step: 1, tool: 'delete_file', target: 'src/old.ts' }]),
      true,
    );
    assert.equal(harnessProgressShowsWrite([{ step: 1, tool: 'write_file_extra' }]), false);
  });

  test('buildAgentModeRequestFields sends conversation intent and harness version v1', () => {
    assert.deepEqual(buildAgentModeRequestFields(), {
      executionIntent: 'conversation',
      harnessVersion: 'v1',
    });
    assert.equal('agentId' in buildAgentModeRequestFields(), false);
  });

  test('parseHarnessEntitled is true only for a boolean true field', () => {
    assert.equal(parseHarnessEntitled({ harnessEntitled: true }), true);
    assert.equal(parseHarnessEntitled({ harnessEntitled: false }), false);
    assert.equal(parseHarnessEntitled({ harnessEntitled: 'true' }), false);
    assert.equal(parseHarnessEntitled({ harnessEntitled: 1 }), false);
    assert.equal(parseHarnessEntitled({}), false);
    assert.equal(parseHarnessEntitled(null), false);
    assert.equal(parseHarnessEntitled(undefined), false);
    assert.equal(parseHarnessEntitled('true'), false);
  });

  test('parseAgentWriteEnabled is true only for a boolean true field', () => {
    assert.equal(parseAgentWriteEnabled({ agentWriteEnabled: true }), true);
    assert.equal(parseAgentWriteEnabled({ agentWriteEnabled: false }), false);
    assert.equal(parseAgentWriteEnabled({ agentWriteEnabled: 'true' }), false);
    assert.equal(parseAgentWriteEnabled({ agentWriteEnabled: 1 }), false);
    assert.equal(parseAgentWriteEnabled({}), false);
    assert.equal(parseAgentWriteEnabled(null), false);
    assert.equal(parseAgentWriteEnabled(undefined), false);
    assert.equal(parseAgentWriteEnabled('true'), false);
  });

  test('toolLabelKey maps each harness tool and uses a generic key otherwise', () => {
    assert.equal(toolLabelKey('list_files'), 'harnessToolListFiles');
    assert.equal(toolLabelKey('read_file'), 'harnessToolReadFile');
    assert.equal(toolLabelKey('search_workspace'), 'harnessToolSearchWorkspace');
    assert.equal(toolLabelKey('write_file'), 'harnessToolWriteFile');
    assert.equal(toolLabelKey('delete_file'), 'harnessToolDeleteFile');
    assert.equal(toolLabelKey('run_validation'), 'harnessToolRunValidation');
    assert.equal(toolLabelKey('browser_smoke'), 'harnessToolBrowserSmoke');
    assert.equal(toolLabelKey('custom_tool'), 'harnessToolGeneric');
    assert.equal(toolLabelKey(''), 'harnessToolGeneric');
  });
});
