import type { AIExecutionRequest } from '../../ai-execution/types';
import { selectAdvertisedAgentHarnessTools } from '../../ai-execution/adapters/adapter-tool-use.mapper';
import {
  CONNECTOR_TOOL_IDS,
  getConnectorToolDefinition,
} from '../tools/connector-tool-definitions';
import type { AgentHarnessToolRegistryDefinitionV1 } from '../tools/tool-registry.contracts';
import { READ_RUN_RESULT_TOOL_ID } from '../tools/handlers/run-result-tool-handlers';
import { withWorkerHarnessInstructions } from '../../worker/connector-grants';
import {
  buildAIExecutionRequest,
  buildExecutionPromptParts,
  requireNonEmptyAdvertisedHarnessTools,
  resolveWorkerExecutionIntent,
} from '../../worker/worker.processor';
import {
  briefingTaskOwnerRequest,
  chiefOfStaffProjectInstructions,
} from './briefing-instructions';
import type { BriefingTask } from './briefing-types';

/**
 * COS-EVAL-01: the model request the worker builds for a granted Chief of
 * Staff job started from the Team page Morning briefing preset.
 *
 * Gateway side (orchestration.service.ts startReferralExecution): the job
 * carries prompt = the preset text, no workspace context, no global
 * instructions, projectInstructions = the collaboration brief for
 * chief-of-staff, executionIntent 'conversation', harness v1 with the read
 * profile and Knowledge scopes, and both connector grants.
 *
 * Worker side (worker.processor.ts, the harness branch):
 *   buildExecutionPromptParts(prompt, workspaceContext, globalInstructions,
 *     projectInstructions, { useHarness, executionIntent })
 *   withWorkerHarnessInstructions(parts, { connectorTools: true })
 *   buildAIExecutionRequest(job, parts, signal)
 * This module calls those same exported functions with those values.
 *
 * COS-MAIL-BODY-RULE-01: a case may carry a trigger's request instead of the
 * preset (briefingTaskOwnerRequest), and a chain-trigger case models
 * RUN_RESULT_TOOL_ENABLED on: the worker then also gets runResultTool: true
 * and registers read_run_result.
 */
export const BRIEFING_EXECUTION_INTENT = resolveWorkerExecutionIntent('conversation');

/**
 * Handler names the worker registers for a signed read-profile job with
 * Knowledge scopes and both connector grants, in registration order:
 * read_file, list_files, search_workspace, then search_knowledge and
 * read_knowledge (read profile with scopes), then each granted connector
 * tool. Read-only jobs get no write, delete, validation or browser tools.
 */
export const BRIEFING_WORKER_REGISTERED_TOOL_IDS: readonly string[] = [
  'read_file',
  'list_files',
  'search_workspace',
  'search_knowledge',
  'read_knowledge',
  ...CONNECTOR_TOOL_IDS,
];

/** The case fields that change the job: its request and the run-result tool. */
export type BriefingJobShape = Pick<BriefingTask, 'timeZone' | 'request' | 'runResult'>;

/**
 * COS-MAIL-BODY-RULE-01: true when the case models RUN_RESULT_TOOL_ENABLED on
 * (a chain-trigger case with a runResult fixture). The gateway then signs
 * runResultRead on the job and the worker registers read_run_result.
 */
export function briefingRunResultToolOn(task?: Pick<BriefingTask, 'runResult'>): boolean {
  return task?.runResult !== undefined;
}

/**
 * Handler names the worker registers for the case's job: the list above, then
 * read_run_result when the run-result tool is on (the worker registers it
 * after the connector tools).
 */
export function briefingRegisteredToolIds(task?: Pick<BriefingTask, 'runResult'>): readonly string[] {
  return briefingRunResultToolOn(task)
    ? [...BRIEFING_WORKER_REGISTERED_TOOL_IDS, READ_RUN_RESULT_TOOL_ID]
    : BRIEFING_WORKER_REGISTERED_TOOL_IDS;
}

/**
 * The worker's advertised list for that job: selectAdvertisedAgentHarnessTools
 * with write, validation and browser smoke off (read profile), then the
 * connector definitions. With the run-result tool on, read_run_result comes
 * from the tool registry in its registry place, as in the worker.
 */
export function advertisedBriefingTools(
  task?: Pick<BriefingTask, 'runResult'>,
): readonly AgentHarnessToolRegistryDefinitionV1[] {
  return requireNonEmptyAdvertisedHarnessTools([
    ...selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: briefingRegisteredToolIds(task),
      enableWriteTools: false,
      enableValidationTools: false,
      enableBrowserSmoke: false,
    }),
    ...CONNECTOR_TOOL_IDS.map((id) => getConnectorToolDefinition(id)),
  ]);
}

/**
 * System and user text exactly as the worker builds them for the case's job.
 * The prompt is the case's owner request (the Morning briefing preset, or a
 * trigger's request); with the run-result tool on, the worker adds its
 * run-result data line (runResultTool: true).
 */
export function buildBriefingPromptParts(task: BriefingJobShape): {
  system: string;
  user: string;
} {
  const base = buildExecutionPromptParts(
    briefingTaskOwnerRequest(task),
    undefined,
    undefined,
    chiefOfStaffProjectInstructions(),
    { useHarness: true, executionIntent: BRIEFING_EXECUTION_INTENT },
  );
  return withWorkerHarnessInstructions(
    base,
    briefingRunResultToolOn(task)
      ? { connectorTools: true, runResultTool: true }
      : { connectorTools: true },
  );
}

export interface BriefingRequestIds {
  readonly provider: AIExecutionRequest['provider'];
  readonly executionId: string;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly userId: string;
  readonly model: string;
}

export function buildBriefingExecutionRequest(
  task: BriefingJobShape,
  ids: BriefingRequestIds,
  signal?: AbortSignal,
): AIExecutionRequest {
  return buildAIExecutionRequest(
    {
      provider: ids.provider,
      executionId: ids.executionId,
      sessionId: ids.sessionId,
      conversationId: ids.conversationId,
      userId: ids.userId,
      model: ids.model,
    },
    buildBriefingPromptParts(task),
    signal,
  );
}
