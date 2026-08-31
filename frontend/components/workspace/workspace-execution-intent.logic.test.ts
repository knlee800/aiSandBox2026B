import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildExecutionIntentRequestPayload,
  buildPersistedUserAgentAskRequestFields,
  DEFAULT_WORKSPACE_EXECUTION_INTENT,
  normalizeWorkspaceExecutionIntent,
  parseUserAgentIdQueryParam,
  resolveExecutionIntentForRequest,
  resolveExecutionIntentSelection,
  resolvePersistedUserAgentAskExecuteError,
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

describe('persisted user-agent request fields — AGENT-PLATFORM-EXEC-01B', () => {
  const boundAgentId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  test('conversation + valid bound id returns agentId only', () => {
    assert.deepEqual(
      buildPersistedUserAgentAskRequestFields({
        agentId: boundAgentId,
        executionIntent: 'conversation',
      }),
      { agentId: boundAgentId },
    );
  });

  test('Build / workspace_mutation emits bound agentId', () => {
    assert.deepEqual(
      buildPersistedUserAgentAskRequestFields({
        agentId: boundAgentId,
        executionIntent: 'workspace_mutation',
      }),
      { agentId: boundAgentId },
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        buildPersistedUserAgentAskRequestFields({
          agentId: boundAgentId,
          executionIntent: 'workspace_mutation',
        }),
        'agentId',
      ),
      true,
    );
  });

  test('missing or blank agent id returns empty object', () => {
    assert.deepEqual(
      buildPersistedUserAgentAskRequestFields({
        agentId: null,
        executionIntent: 'conversation',
      }),
      {},
    );
    assert.deepEqual(
      buildPersistedUserAgentAskRequestFields({
        agentId: '',
        executionIntent: 'conversation',
      }),
      {},
    );
    assert.deepEqual(
      buildPersistedUserAgentAskRequestFields({
        agentId: '   ',
        executionIntent: 'conversation',
      }),
      {},
    );
    assert.deepEqual(
      buildPersistedUserAgentAskRequestFields({
        executionIntent: 'conversation',
      }),
      {},
    );
  });

  test('helper output never includes harnessVersion', () => {
    const conversationFields = buildPersistedUserAgentAskRequestFields({
      agentId: boundAgentId,
      executionIntent: 'conversation',
    });
    const buildFields = buildPersistedUserAgentAskRequestFields({
      agentId: boundAgentId,
      executionIntent: 'workspace_mutation',
    });
    assert.equal('harnessVersion' in conversationFields, false);
    assert.equal('harnessVersion' in buildFields, false);
    assert.doesNotMatch(JSON.stringify(conversationFields), /harnessVersion/);
    assert.doesNotMatch(JSON.stringify(buildFields), /harnessVersion/);
  });

  test('ordinary Builder Ask without bound id remains empty from helper', () => {
    assert.deepEqual(
      buildPersistedUserAgentAskRequestFields({
        agentId: null,
        executionIntent: 'conversation',
      }),
      {},
    );
  });

  test('ordinary Builder Build without bound id remains empty from helper', () => {
    assert.deepEqual(
      buildPersistedUserAgentAskRequestFields({
        agentId: null,
        executionIntent: 'workspace_mutation',
      }),
      {},
    );
  });

  test('parseUserAgentIdQueryParam accepts UUID-shaped userAgentId', () => {
    assert.equal(
      parseUserAgentIdQueryParam(`?userAgentId=${boundAgentId}`),
      boundAgentId,
    );
    assert.equal(
      parseUserAgentIdQueryParam(`userAgentId=${boundAgentId}&other=1`),
      boundAgentId,
    );
  });

  test('parseUserAgentIdQueryParam rejects empty and garbage values', () => {
    assert.equal(parseUserAgentIdQueryParam(''), null);
    assert.equal(parseUserAgentIdQueryParam('?userAgentId='), null);
    assert.equal(parseUserAgentIdQueryParam('?userAgentId=not-a-uuid'), null);
    assert.equal(parseUserAgentIdQueryParam('?userAgentId=builder'), null);
    assert.equal(parseUserAgentIdQueryParam('?other=1'), null);
  });
});

describe('persisted user-agent Ask execute errors — AGENT-PLATFORM-CREATE-01E', () => {
  const boundAgentId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  test('agent 404 Not Found maps to localized not-found copy when bound', () => {
    assert.equal(
      resolvePersistedUserAgentAskExecuteError({
        boundUserAgentId: boundAgentId,
        statusCode: 404,
        rawMessage: 'Not Found',
        notFoundMessage: 'agent-missing',
        sessionNotFoundMessage: 'session-missing',
      }),
      'agent-missing',
    );
  });

  test('session 404 maps to localized session-not-found copy when bound', () => {
    assert.equal(
      resolvePersistedUserAgentAskExecuteError({
        boundUserAgentId: boundAgentId,
        statusCode: 404,
        rawMessage: 'Session with ID 12345678-aaaa-4bbb-8ccc-dddddddddddd not found',
        notFoundMessage: 'agent-missing',
        sessionNotFoundMessage: 'session-missing',
      }),
      'session-missing',
    );
  });

  test('generic and unbound failures stay on the existing error path', () => {
    assert.equal(
      resolvePersistedUserAgentAskExecuteError({
        boundUserAgentId: boundAgentId,
        statusCode: 500,
        rawMessage: 'Internal Server Error',
        notFoundMessage: 'agent-missing',
        sessionNotFoundMessage: 'session-missing',
      }),
      null,
    );
    assert.equal(
      resolvePersistedUserAgentAskExecuteError({
        boundUserAgentId: null,
        statusCode: 404,
        rawMessage: 'Not Found',
        notFoundMessage: 'agent-missing',
        sessionNotFoundMessage: 'session-missing',
      }),
      null,
    );
  });
});
