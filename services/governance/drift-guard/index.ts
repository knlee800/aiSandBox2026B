/**
 * Governance Drift Guard — Public API
 *
 * Entry point for the governance consistency enforcement module.
 *
 * Usage (programmatic):
 *   import { runDriftGuard } from '@aisandbox/governance-drift-guard';
 *   const report = runDriftGuard('/path/to/repo/root');
 *
 * Usage (CLI):
 *   npx ts-node services/governance/drift-guard/index.ts [repo-root]
 */

import * as path from 'path';
import { buildDriftReport } from './drift-report.builder';
import { DriftDetectionResult } from './drift-state.types';
import { buildSnapshot, defaultRepoPaths, SnapshotPaths } from './task-state-snapshot';

export { buildDriftReport } from './drift-report.builder';
export { checkRoadmapConsistency } from './roadmap-consistency.checker';
export * from './drift-state.types';
export { buildSnapshot, defaultRepoPaths } from './task-state-snapshot';
export { validateLifecycle } from './task-lifecycle.validator';

// ─── High-level convenience function ─────────────────────────────────────────

/**
 * Run the full drift detection pipeline against the three governance files
 * and return a structured DriftDetectionResult.
 *
 * @param repoRoot  Absolute path to the repository root (contains TASKS.md)
 * @param paths     Optional override for the three file paths
 */
export function runDriftGuard(repoRoot: string, paths?: Partial<SnapshotPaths>): DriftDetectionResult {
  const resolvedPaths: SnapshotPaths = {
    ...defaultRepoPaths(repoRoot),
    ...paths,
  };

  const snapshot = buildSnapshot(resolvedPaths);
  return buildDriftReport(snapshot);
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

if (require.main === module) {
  const repoRoot = process.argv[2] ?? path.resolve(__dirname, '../../..');
  const report = runDriftGuard(repoRoot);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');

  if (report.status === 'DRIFT_DETECTED') {
    const errors = report.issues.filter((i) => i.severity === 'ERROR').length;
    if (errors > 0) process.exit(1);
  }
}
