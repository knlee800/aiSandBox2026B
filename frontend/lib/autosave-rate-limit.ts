export const AUTOSAVE_MIN_INTERVAL_MS = 60_000;

export function shouldAllowAutosaveNow(args: {
  now: number;
  lastSnapshotAt: number | null;
  minIntervalMs?: number;
}): boolean {
  if (args.lastSnapshotAt === null) {
    return true;
  }

  return args.now - args.lastSnapshotAt >= (args.minIntervalMs ?? AUTOSAVE_MIN_INTERVAL_MS);
}
