import type { WorkspaceExecutionFileActionState } from './workspace-ai-file-actions.logic';

export interface RunAiActionCoherenceArgs {
  executionId: string;
  fileActionState: WorkspaceExecutionFileActionState;
  selectedSessionId: string | null;
  executionSessionId: string | null;
  isExecutionSessionUsable: boolean;
  selectedFilePath: string | null;
  checkpointDescription: string;
  refreshFileTree: () => Promise<void>;
  reloadEditorFile: (filePath: string) => Promise<void>;
  refreshPreview: () => Promise<void>;
  createCheckpoint: (description: string) => Promise<{ commitHash: string | null }>;
  refreshCheckpoints: () => Promise<void>;
}

export interface RunAiActionCoherenceResult {
  ran: boolean;
  successfulPaths: string[];
  activeFileReloaded: boolean;
  checkpointCreated: boolean;
  skippedReason: string | null;
}

export function acquireExecutionCoherenceGuard(
  executionId: string,
  coheredExecutionIds: Set<string>,
): boolean {
  if (coheredExecutionIds.has(executionId)) {
    return false;
  }
  coheredExecutionIds.add(executionId);
  return true;
}

function getSuccessfulPaths(fileActionState: WorkspaceExecutionFileActionState): string[] {
  const successfulPaths = new Set<string>();
  for (const result of fileActionState.results) {
    if (result.status === 'success') {
      successfulPaths.add(result.path);
    }
  }
  return [...successfulPaths];
}

export async function runAiActionCoherence(
  args: RunAiActionCoherenceArgs,
): Promise<RunAiActionCoherenceResult> {
  if (args.fileActionState.applyStatus !== 'applied') {
    return {
      ran: false,
      successfulPaths: [],
      activeFileReloaded: false,
      checkpointCreated: false,
      skippedReason: 'not-applied',
    };
  }
  if (!args.selectedSessionId || !args.executionSessionId || args.selectedSessionId !== args.executionSessionId) {
    return {
      ran: false,
      successfulPaths: [],
      activeFileReloaded: false,
      checkpointCreated: false,
      skippedReason: 'stale-session',
    };
  }
  if (!args.isExecutionSessionUsable) {
    return {
      ran: false,
      successfulPaths: [],
      activeFileReloaded: false,
      checkpointCreated: false,
      skippedReason: 'inactive-session',
    };
  }

  const successfulPaths = getSuccessfulPaths(args.fileActionState);
  if (successfulPaths.length === 0) {
    return {
      ran: false,
      successfulPaths,
      activeFileReloaded: false,
      checkpointCreated: false,
      skippedReason: 'no-successful-writes',
    };
  }

  await args.refreshFileTree();

  const shouldReloadActiveFile =
    Boolean(args.selectedFilePath) && successfulPaths.includes(args.selectedFilePath ?? '');
  if (shouldReloadActiveFile && args.selectedFilePath) {
    await args.reloadEditorFile(args.selectedFilePath);
  }

  await args.refreshPreview();

  let checkpointCreated = false;
  try {
    const checkpointResult = await args.createCheckpoint(args.checkpointDescription);
    if (checkpointResult.commitHash) {
      checkpointCreated = true;
      await args.refreshCheckpoints();
    }
  } catch {
    checkpointCreated = false;
  }

  return {
    ran: true,
    successfulPaths,
    activeFileReloaded: shouldReloadActiveFile,
    checkpointCreated,
    skippedReason: null,
  };
}
