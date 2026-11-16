import { systemAgentById } from '../system-agents/system-agent-registry';

/**
 * RESULT-TOOL-01 (stage-start section 4): who may read the owner's own
 * completed run results with `read_run_result`.
 *
 * The gateway signs `runResultRead: true` on a hand-off job, or leaves the
 * field out (never `false`). The browser, the task text and the model cannot
 * set it. The field is covered by HARNESS_ENTITLEMENT_PROOF_V1 like every
 * other job field (the proof digests the whole job).
 *
 * Granted only when all hold:
 * - RUN_RESULT_TOOL_ENABLED is exactly 'true' (read live, never cached);
 * - the job is a signed harness v1, read-only, `read`-profile job;
 * - the step is a user workflow's own step, or a system-agent step whose
 *   target is the Chief of Staff.
 *
 * Never granted to the coding roles (builder, lead, writer, reviewer), the
 * advisors team, or a non-`read` profile. Agent mode, Ask and Build do not
 * build hand-off jobs, so they never reach this rule. Triggered starts
 * (schedule, event, mail, knowledge) go through the same start, approval and
 * job build, so their steps are granted like any other.
 *
 * This is a fourth kind of access beside the registry's tool profile,
 * knowledge folders and connector tool ids, kept here on purpose: it is not
 * in any version hash, so turning it on changes no agent or workflow version
 * (stage-start P2, F2).
 */

/**
 * The switch. Only the exact string 'true' is on; unset, empty, 'TRUE', '1',
 * ' true' and anything else is off (the rule of the other gateway switches).
 * It never turns runs on: GLOBAL_EXECUTION_ENABLED, the provider switches,
 * credits and caps still apply. A tester window never sets it.
 */
export const RUN_RESULT_TOOL_ENABLED_ENV = 'RUN_RESULT_TOOL_ENABLED';

/** The one system agent granted the tool. */
export const RUN_RESULT_READ_SYSTEM_AGENT_ID = 'chief-of-staff';

export interface RunResultGrantJobFields {
  runResultRead?: true;
}

export function isRunResultToolEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[RUN_RESULT_TOOL_ENABLED_ENV] === 'true';
}

/**
 * `{ runResultRead: true }` when the job qualifies, `{}` otherwise, so the
 * field is absent. `workflowStep` is true only for a workflow's own hand-off
 * (the snapshot's id is the target); a workflow step whose target is a
 * system-agent id is refused, so no coding or advisor role can be reached
 * through a snapshot. Pure apart from reading the switch.
 */
export function runResultGrantJobFields(
  job: {
    readonly builderProfileId: string;
    readonly harnessVersion?: unknown;
    readonly harnessToolProfile?: unknown;
    readonly harnessReadOnly?: unknown;
  },
  workflowStep: boolean,
  env: NodeJS.ProcessEnv = process.env,
): RunResultGrantJobFields {
  if (!isRunResultToolEnabled(env)) {
    return {};
  }
  if (
    job.harnessVersion !== 'v1' ||
    job.harnessToolProfile !== 'read' ||
    job.harnessReadOnly !== true
  ) {
    return {};
  }
  const target = job.builderProfileId;
  const granted = workflowStep
    ? systemAgentById(target) === undefined
    : target === RUN_RESULT_READ_SYSTEM_AGENT_ID;
  return granted ? { runResultRead: true } : {};
}
