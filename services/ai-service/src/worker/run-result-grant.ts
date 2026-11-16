/**
 * RESULT-TOOL-01: whether to register read_run_result for a job whose
 * entitlement proof has already verified (the worker calls this only after
 * verifyHarnessEntitlementProof, as it does resolveConnectorGrants). True only
 * for harness v1, the signed read profile and runResultRead exactly true.
 * Anything else registers nothing and adds no error: false, "true", 1, a
 * missing field and the review, write and agent-write profiles all give false.
 */
export function resolveRunResultGrant(
  job: {
    readonly harnessVersion?: unknown;
    readonly runResultRead?: unknown;
  },
  profile: string | null,
): boolean {
  return job.harnessVersion === 'v1' && profile === 'read' && job.runResultRead === true;
}
