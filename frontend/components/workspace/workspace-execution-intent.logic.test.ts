import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildExecutionIntentRequestPayload,
  DEFAULT_WORKSPACE_EXECUTION_INTENT,
  normalizeWorkspaceExecutionIntent,
  resolveExecutionIntentForRequest,
  resolveExecutionIntentSelection,
  shouldApplyFileActionsForExecutionIntent,
  WORKSPACE_EXECUTION_INTENTS,
} from './workspace-execution-intent.logic';

describe('workspace execution intent logic', () => {
  test('default intent is workspace_mutation', () => {
    assert.equal(DEFAULT_WORKSPACE_EXECUTION_INTENT, 'workspace_mutation');
  });

  test('conversation intent is preserved', () => {
    assert.equal(normalizeWorkspaceExecutionIntent('conversation'), 'conversation');
  });

  test('workspace_mutation intent is preserved', () => {
    assert.equal(
      normalizeWorkspaceExecutionIntent('workspace_mutation'),
      'workspace_mutation',
    );
  });

  test('invalid or missing intent normalizes to workspace_mutation', () => {
    assert.equal(normalizeWorkspaceExecutionIntent(undefined), 'workspace_mutation');
    assert.equal(normalizeWorkspaceExecutionIntent(null), 'workspace_mutation');
    assert.equal(normalizeWorkspaceExecutionIntent('invalid-intent'), 'workspace_mutation');
  });

  test('Ask mode request payload carries conversation intent', () => {
    assert.deepEqual(buildExecutionIntentRequestPayload('conversation'), {
      executionIntent: 'conversation',
    });
  });

  test('Build mode request payload carries workspace_mutation intent', () => {
    assert.deepEqual(buildExecutionIntentRequestPayload('workspace_mutation'), {
      executionIntent: 'workspace_mutation',
    });
  });

  test('Ask mode does not apply file actions', () => {
    assert.equal(shouldApplyFileActionsForExecutionIntent('conversation'), false);
  });

  test('Build mode allows file actions to apply', () => {
    assert.equal(
      shouldApplyFileActionsForExecutionIntent('workspace_mutation'),
      true,
    );
  });

  test('state switch helper resolves next bounded intent', () => {
    assert.equal(
      resolveExecutionIntentSelection({
        currentIntent: 'workspace_mutation',
        nextIntent: 'conversation',
      }),
      'conversation',
    );
    assert.equal(
      resolveExecutionIntentSelection({
        currentIntent: 'conversation',
        nextIntent: 'workspace_mutation',
      }),
      'workspace_mutation',
    );
  });

  test('legacy request with missing intent defaults to workspace_mutation', () => {
    assert.equal(
      resolveExecutionIntentForRequest({
        executionIntent: undefined,
      }),
      'workspace_mutation',
    );
  });

  test('provider advisory field cannot override application intent', () => {
    assert.equal(
      resolveExecutionIntentForRequest({
        executionIntent: 'workspace_mutation',
        providerWorkspaceMutationAttempted: false,
      }),
      'workspace_mutation',
    );
    assert.equal(
      resolveExecutionIntentForRequest({
        executionIntent: 'conversation',
        providerWorkspaceMutationAttempted: true,
      }),
      'conversation',
    );
  });

  test('intent values remain bounded to Ask and Build modes', () => {
    assert.deepEqual(WORKSPACE_EXECUTION_INTENTS, [
      'conversation',
      'workspace_mutation',
    ]);
  });
});
