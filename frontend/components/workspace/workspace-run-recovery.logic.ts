export const RECOVERED_RUN_MODES = ['ask', 'build', 'agent', 'unknown'] as const;

export type RecoveredRunMode = (typeof RECOVERED_RUN_MODES)[number];

export interface PendingRunRecord {
  executionId: string;
  mode: RecoveredRunMode;
  startedAt: string;
}

export interface ActiveRunRow {
  executionId: string;
  mode: RecoveredRunMode;
  startedAt: string | null;
}

export interface RecoverableRun {
  executionId: string;
  mode: RecoveredRunMode;
}

const ACTIVE_RUN_MAX_AGE_MS = 15 * 60 * 1000;
const PENDING_RUN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function pendingRunStorageKey(sessionId: string): string {
  return `workspace_pending_run_${sessionId}`;
}

export function serializePendingRun(run: {
  executionId: string;
  mode: RecoveredRunMode;
  startedAt: string;
}): string {
  return JSON.stringify({
    executionId: run.executionId,
    mode: run.mode,
    startedAt: run.startedAt,
  });
}

export function parsePendingRun(raw: unknown): PendingRunRecord | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  try {
    return parsePendingRunValue(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function parseRunListResponse(raw: unknown): ActiveRunRow[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return [];
  }
  const runs = (raw as { runs?: unknown }).runs;
  if (!Array.isArray(runs)) {
    return [];
  }
  const rows: ActiveRunRow[] = [];
  for (const row of runs) {
    const parsed = parseActiveRunRow(row);
    if (parsed) {
      rows.push(parsed);
    }
  }
  return rows;
}

export function selectRecoverableRun(input: {
  activeRuns: readonly ActiveRunRow[];
  pendingRun: PendingRunRecord | null;
  now: number;
}): RecoverableRun | null {
  let newest: { run: RecoverableRun; startedAtMs: number } | null = null;
  for (const run of input.activeRuns) {
    if (!isRecoveredRunMode(run.mode) || run.executionId.trim().length === 0) {
      continue;
    }
    const startedAtMs = usableTimeMs(run.startedAt);
    if (startedAtMs === null) {
      continue;
    }
    const ageMs = input.now - startedAtMs;
    if (ageMs < 0 || ageMs >= ACTIVE_RUN_MAX_AGE_MS) {
      continue;
    }
    if (!newest || startedAtMs > newest.startedAtMs) {
      newest = {
        run: {
          executionId: run.executionId,
          mode: run.mode,
        },
        startedAtMs,
      };
    }
  }
  if (newest) {
    return newest.run;
  }
  if (!input.pendingRun) {
    return null;
  }
  const pendingStartedAtMs = usableTimeMs(input.pendingRun.startedAt);
  if (pendingStartedAtMs === null) {
    return null;
  }
  if (input.now - pendingStartedAtMs > PENDING_RUN_MAX_AGE_MS) {
    return null;
  }
  return {
    executionId: input.pendingRun.executionId,
    mode: input.pendingRun.mode,
  };
}

export function recoveredRunNeedsNotAppliedNotice(mode: RecoveredRunMode): boolean {
  return mode === 'build' || mode === 'unknown';
}

export function appendRecoveredRunNotice(
  answer: string,
  mode: RecoveredRunMode,
  notice: string,
): string {
  if (!recoveredRunNeedsNotAppliedNotice(mode)) {
    return answer;
  }
  return notice;
}

function parsePendingRunValue(value: unknown): PendingRunRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as {
    executionId?: unknown;
    mode?: unknown;
    startedAt?: unknown;
  };
  if (typeof record.executionId !== 'string' || record.executionId.trim().length === 0) {
    return null;
  }
  if (!isRecoveredRunMode(record.mode)) {
    return null;
  }
  if (typeof record.startedAt !== 'string' || usableTimeMs(record.startedAt) === null) {
    return null;
  }
  return {
    executionId: record.executionId.trim(),
    mode: record.mode,
    startedAt: record.startedAt,
  };
}

function parseActiveRunRow(value: unknown): ActiveRunRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as {
    executionId?: unknown;
    mode?: unknown;
    startedAt?: unknown;
  };
  if (typeof record.executionId !== 'string' || record.executionId.trim().length === 0) {
    return null;
  }
  if (!isRecoveredRunMode(record.mode)) {
    return null;
  }
  if (
    record.startedAt !== undefined &&
    record.startedAt !== null &&
    typeof record.startedAt !== 'string'
  ) {
    return null;
  }
  return {
    executionId: record.executionId.trim(),
    mode: record.mode,
    startedAt: typeof record.startedAt === 'string' ? record.startedAt : null,
  };
}

function isRecoveredRunMode(value: unknown): value is RecoveredRunMode {
  return (
    value === 'ask' || value === 'build' || value === 'agent' || value === 'unknown'
  );
}

function usableTimeMs(value: string | null): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}
