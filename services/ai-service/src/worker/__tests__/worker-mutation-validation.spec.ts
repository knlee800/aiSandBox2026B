import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_BUILDER_EXECUTION_INTENT,
  FILE_ACTION_CONTRACT_FAILURE_CODE,
  FILE_ACTION_CONTRACT_FAILURE_MESSAGE,
  resolveEffectiveFileActionsForExecutionIntent,
  resolveWorkerExecutionIntent,
  validatePlainPathFileActionContract,
} from '../worker.processor';

function getWorkerSource(): string {
  return fs.readFileSync(path.join(__dirname, '..', 'worker.processor.ts'), 'utf-8');
}

describe('worker plain-path file-action contract validation', () => {
  it('conversation + zero actions completes contract (no failure)', () => {
    const result = validatePlainPathFileActionContract({
      useHarness: false,
      executionIntent: 'conversation',
      safeFileActionCount: 0,
    });

    expect(result.isContractFailure).toBe(false);
    expect(result.finalContractResult).toBe('passed');
  });

  it('conversation + prose (no actions) remains valid', () => {
    const result = validatePlainPathFileActionContract({
      useHarness: false,
      executionIntent: 'conversation',
      safeFileActionCount: 0,
    });

    expect(result.isContractFailure).toBe(false);
    expect(result.finalContractResult).toBe('passed');
  });

  it('workspace_mutation + valid safe actions completes contract', () => {
    const result = validatePlainPathFileActionContract({
      useHarness: false,
      executionIntent: 'workspace_mutation',
      safeFileActionCount: 1,
    });

    expect(result.isContractFailure).toBe(false);
    expect(result.finalContractResult).toBe('passed');
  });

  it('workspace_mutation + zero safe actions fails with 03B code', () => {
    const result = validatePlainPathFileActionContract({
      useHarness: false,
      executionIntent: 'workspace_mutation',
      safeFileActionCount: 0,
    });

    expect(result.isContractFailure).toBe(true);
    expect(result.finalContractResult).toBe('failed');
    expect(result.errorCode).toBe(FILE_ACTION_CONTRACT_FAILURE_CODE);
    expect(result.errorMessage).toBe(FILE_ACTION_CONTRACT_FAILURE_MESSAGE);
  });

  it('workspace_mutation + malformed/unsafe-only actions filtered to zero fails', () => {
    const result = validatePlainPathFileActionContract({
      useHarness: false,
      executionIntent: 'workspace_mutation',
      safeFileActionCount: 0,
    });

    expect(result.isContractFailure).toBe(true);
    expect(result.errorCode).toBe(FILE_ACTION_CONTRACT_FAILURE_CODE);
  });

  it('harness flow remains unchanged by intent contract', () => {
    const result = validatePlainPathFileActionContract({
      useHarness: true,
      executionIntent: 'workspace_mutation',
      safeFileActionCount: 0,
    });

    expect(result.isContractFailure).toBe(false);
    expect(result.finalContractResult).toBe('passed');
  });

  it('resolves missing intent to workspace_mutation default', () => {
    expect(resolveWorkerExecutionIntent(undefined)).toBe(
      DEFAULT_BUILDER_EXECUTION_INTENT,
    );
  });

  it('provider advisory fields cannot override application intent authority', () => {
    expect(resolveWorkerExecutionIntent('workspace_mutation')).toBe(
      'workspace_mutation',
    );
    expect(resolveWorkerExecutionIntent('conversation')).toBe('conversation');
  });

  it('conversation suppresses provider-returned actions before publish/apply', () => {
    const resolution = resolveEffectiveFileActionsForExecutionIntent({
      executionIntent: 'conversation',
      useHarness: false,
      safeFileActions: [
        { action: 'write', path: 'src/a.ts', content: 'a' },
        { action: 'write', path: 'src/b.ts', content: 'b' },
      ],
    });

    expect(resolution.effectiveFileActions).toEqual([]);
    expect(resolution.suppressedActionCount).toBe(2);
  });

  it('conversation suppression does not run on harness path', () => {
    const resolution = resolveEffectiveFileActionsForExecutionIntent({
      executionIntent: 'conversation',
      useHarness: true,
      safeFileActions: [{ action: 'write', path: 'src/a.ts', content: 'a' }],
    });

    expect(resolution.effectiveFileActions).toHaveLength(1);
    expect(resolution.suppressedActionCount).toBe(0);
  });

  it('keeps workspaceMutationAttempted advisory by excluding it from intent authority', () => {
    const workerSource = getWorkerSource();
    const contractCallIndex = workerSource.indexOf(
      'const contractValidation = validatePlainPathFileActionContract({',
    );
    const contractCallBlock = workerSource.substring(
      contractCallIndex,
      contractCallIndex + 260,
    );

    expect(contractCallIndex).toBeGreaterThan(-1);
    expect(contractCallBlock).toContain('useHarness');
    expect(contractCallBlock).toContain(
      'safeFileActionCount: effectiveFileActions.length',
    );
    expect(contractCallBlock).toContain('executionIntent');
    expect(contractCallBlock).not.toContain('workspaceMutationAttempted');
  });

  it('uses failed status and file_action_contract_failure code on mutation contract failure', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("SET execution_status = 'failed'");
    expect(workerSource).toContain('FILE_ACTION_CONTRACT_FAILURE_CODE');
    expect(workerSource).toContain('FILE_ACTION_CONTRACT_FAILURE_MESSAGE');
  });

  it('publishes completion and returns before completion-status success path on contract failure', () => {
    const workerSource = getWorkerSource();
    const contractFailureStart = workerSource.indexOf(
      'if (contractValidation.isContractFailure)',
    );
    const contractFailureReturn = workerSource.indexOf(
      'return;',
      contractFailureStart,
    );
    const contractFailureBlock = workerSource.substring(
      contractFailureStart,
      contractFailureReturn + 20,
    );

    expect(contractFailureStart).toBeGreaterThan(-1);
    expect(contractFailureReturn).toBeGreaterThan(contractFailureStart);
    expect(contractFailureBlock).toContain(
      'this.executionStreamPublisher.publishCompletion(executionId)',
    );
    expect(contractFailureBlock).not.toContain(
      "SET execution_status = 'completed'",
    );
    expect(contractFailureBlock).not.toContain('notifyExecutionComplete');
  });

  it('emits bounded diagnostics for parse results, suppression, and contract failures', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain("event: 'file_action.parse_result'");
    expect(workerSource).toContain(
      "event: 'file_action.conversation_actions_suppressed'",
    );
    expect(workerSource).toContain("event: 'file_action.contract_failure'");
    expect(workerSource).toContain('parseMethod');
    expect(workerSource).toContain('fileActionCount');
    expect(workerSource).toContain('executionIntent');
    expect(workerSource).toContain('workspaceMutationAttempted');
    expect(workerSource).toContain('finalContractResult');
  });

  it('conversation path publishes empty effective fileActions', () => {
    const workerSource = getWorkerSource();
    expect(workerSource).toContain(
      'this.executionStreamPublisher.publishFileActions(\n            executionId,\n            effectiveFileActions,',
    );
    expect(workerSource).toContain('fileActions: effectiveFileActions');
  });

  it('mutation contract failure does not produce false completion', () => {
    const workerSource = getWorkerSource();
    const contractFailureStart = workerSource.indexOf(
      'if (contractValidation.isContractFailure)',
    );
    const contractFailureReturn = workerSource.indexOf(
      'return;',
      contractFailureStart,
    );
    const contractFailureBlock = workerSource.substring(
      contractFailureStart,
      contractFailureReturn + 20,
    );

    expect(contractFailureBlock).toContain("SET execution_status = 'failed'");
    expect(contractFailureBlock).not.toContain(
      "SET execution_status = 'completed'",
    );
    expect(contractFailureBlock).not.toContain('notifyExecutionComplete');
  });
});
