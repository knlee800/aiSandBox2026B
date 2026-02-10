/**
 * AIExecutionModule Dogfood Tests
 *
 * Phase 28: OBSOLETE
 *
 * NOTE: Phase 28 removed DI-based adapter selection (AI_ADAPTER token).
 * DOGFOOD_PROVIDER is no longer used. Provider selection is now per-request
 * via the request.provider field (caller-owned).
 *
 * This test file is retained for historical reference but contains no active tests.
 */
describe('AIExecutionModule - Dogfood Override (Phase 28 - OBSOLETE)', () => {
  it('should skip - DOGFOOD_PROVIDER removed in Phase 28', () => {
    // Phase 28: Provider selection moved to per-request basis
    // DOGFOOD_PROVIDER environment variable is no longer used
    expect(true).toBe(true);
  });
});
