export const WORKSPACE_BUILD_TARGET_OPTIONS = [
  {
    value: 'mobile',
    label: 'Mobile (generic)',
    command:
      'if command -v npm >/dev/null 2>&1; then npm run --silent build:mobile || echo "No build:mobile script configured."; else echo "npm toolchain unavailable on this session runtime."; exit 127; fi',
  },
  {
    value: 'mac',
    label: 'Mac (xcodebuild)',
    command:
      'if command -v xcodebuild >/dev/null 2>&1; then xcodebuild -version; else echo "xcodebuild toolchain unavailable on this session runtime."; exit 127; fi',
  },
  {
    value: 'ios',
    label: 'iOS (xcodebuild)',
    command:
      'if command -v xcodebuild >/dev/null 2>&1; then xcodebuild -version; else echo "xcodebuild toolchain unavailable on this session runtime."; exit 127; fi',
  },
] as const;

export type WorkspaceBuildTarget = (typeof WORKSPACE_BUILD_TARGET_OPTIONS)[number]['value'];

export function resolveWorkspaceBuildCommand(target: string): {
  target: WorkspaceBuildTarget;
  command: string;
} {
  const matched =
    WORKSPACE_BUILD_TARGET_OPTIONS.find((option) => option.value === target) ??
    WORKSPACE_BUILD_TARGET_OPTIONS[0];
  return {
    target: matched.value,
    command: matched.command,
  };
}

export function detectBuildToolchainUnavailable(input: {
  exitCode: number;
  stdout: string;
  stderr: string;
}): boolean {
  if (input.exitCode === 0) {
    return false;
  }
  const merged = `${input.stdout}\n${input.stderr}`.toLowerCase();
  return (
    merged.includes('toolchain unavailable') ||
    merged.includes('command not found') ||
    merged.includes('xcodebuild toolchain unavailable') ||
    merged.includes('xcodebuild: not found')
  );
}
