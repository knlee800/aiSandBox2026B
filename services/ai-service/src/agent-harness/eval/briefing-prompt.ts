import type { AIExecutionRequest } from '../../ai-execution/types';
import { selectAdvertisedAgentHarnessTools } from '../../ai-execution/adapters/adapter-tool-use.mapper';
import {
  CONNECTOR_TOOL_IDS,
  getConnectorToolDefinition,
} from '../tools/connector-tool-definitions';
import type { AgentHarnessToolRegistryDefinitionV1 } from '../tools/tool-registry.contracts';
import { withWorkerHarnessInstructions } from '../../worker/connector-grants';
import {
  buildAIExecutionRequest,
  buildExecutionPromptParts,
  requireNonEmptyAdvertisedHarnessTools,
  resolveWorkerExecutionIntent,
} from '../../worker/worker.processor';
import {
  briefingOwnerRequest,
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

/**
 * The worker's advertised list for that job: selectAdvertisedAgentHarnessTools
 * with write, validation and browser smoke off (read profile), then the
 * connector definitions.
 */
export function advertisedBriefingTools(): readonly AgentHarnessToolRegistryDefinitionV1[] {
  return requireNonEmptyAdvertisedHarnessTools([
    ...selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: BRIEFING_WORKER_REGISTERED_TOOL_IDS,
      enableWriteTools: false,
      enableValidationTools: false,
      enableBrowserSmoke: false,
    }),
    ...CONNECTOR_TOOL_IDS.map((id) => getConnectorToolDefinition(id)),
  ]);
}

/** System and user text exactly as the worker builds them for the briefing job. */
export function buildBriefingPromptParts(task: Pick<BriefingTask, 'timeZone'>): {
  system: string;
  user: string;
} {
  const base = buildExecutionPromptParts(
    briefingOwnerRequest(task.timeZone),
    undefined,
    undefined,
    chiefOfStaffProjectInstructions(),
    { useHarness: true, executionIntent: BRIEFING_EXECUTION_INTENT },
  );
  return withWorkerHarnessInstructions(base, { connectorTools: true });
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
  task: Pick<BriefingTask, 'timeZone'>,
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
