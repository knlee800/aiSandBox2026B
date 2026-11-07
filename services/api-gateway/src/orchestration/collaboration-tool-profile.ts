import { systemAgentById } from '../system-agents/system-agent-registry';

export { knowledgeScopesJobFields } from '../knowledge/knowledge-scopes';

/**
 * Signed job field. The gateway sets it from the target role.
 * Lead and any other target stay read. The browser cannot set it.
 */
export type CollaborationHarnessToolProfile = 'read' | 'review' | 'write';

export interface CollaborationHandoffTest {
  readonly command: string;
  readonly passed: boolean;
}

export interface CollaborationHandoffWork {
  readonly changedPaths: readonly string[];
  readonly savePoint: string | null;
  readonly tests: readonly CollaborationHandoffTest[];
}

export interface CollaborationHandoffFact extends CollaborationHandoffWork {
  readonly canChangeFiles: boolean;
  readonly diff: string | null;
  readonly diffUnavailable: boolean;
}

/** Execution metadata key. The worker writes the paths a profile job wrote. */
export const HARNESS_CHANGED_PATHS_METADATA_KEY = 'harnessChangedPaths';

/** Execution metadata key. The worker writes validation commands and pass or fail. */
export const HARNESS_VALIDATION_RUNS_METADATA_KEY = 'harnessValidationRuns';

/** Existing pre-apply checkpoint hash. This is the save point on the page. */
export const HARNESS_SAVE_POINT_METADATA_KEY = 'preApplyCheckpointHash';

const EMPTY_WORK: CollaborationHandoffWork = {
  changedPaths: [],
  savePoint: null,
  tests: [],
};

export function collaborationHarnessToolProfile(
  targetProfileId: string,
): CollaborationHarnessToolProfile {
  const toolProfile = systemAgentById(targetProfileId)?.toolProfile;
  if (toolProfile === 'read' || toolProfile === 'review' || toolProfile === 'write') {
    return toolProfile;
  }
  return 'read';
}

export function collaborationHarnessJobFields(targetProfileId: string): {
  harnessVersion: 'v1';
  harnessToolProfile: CollaborationHarnessToolProfile;
  harnessReadOnly?: true;
} {
  const harnessToolProfile = collaborationHarnessToolProfile(targetProfileId);
  if (harnessToolProfile === 'read') {
    return {
      harnessVersion: 'v1',
      harnessReadOnly: true,
      harnessToolProfile,
    };
  }
  return {
    harnessVersion: 'v1',
    harnessToolProfile,
  };
}

export function targetStepCanChangeFiles(
  targetProfileId: string,
  fileAccess: boolean,
): boolean {
  return fileAccess && collaborationHarnessToolProfile(targetProfileId) === 'write';
}

export function readCollaborationHandoffWork(metadata: unknown): CollaborationHandoffWork {
  if (!isRecord(metadata)) {
    return EMPTY_WORK;
  }
  return {
    changedPaths: readChangedPaths(metadata[HARNESS_CHANGED_PATHS_METADATA_KEY]),
    savePoint: readSavePoint(metadata[HARNESS_SAVE_POINT_METADATA_KEY]),
    tests: readValidationRuns(metadata[HARNESS_VALIDATION_RUNS_METADATA_KEY]),
  };
}

function readChangedPaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const paths: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) {
      paths.push(entry);
    }
  }
  return paths;
}

function readSavePoint(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readValidationRuns(value: unknown): CollaborationHandoffTest[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const tests: CollaborationHandoffTest[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    const command = entry.command;
    const passed = entry.passed;
    if (typeof command !== 'string' || command.length === 0 || typeof passed !== 'boolean') {
      continue;
    }
    tests.push({ command, passed });
  }
  return tests;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
