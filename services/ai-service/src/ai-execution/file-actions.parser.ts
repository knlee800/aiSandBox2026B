import { posix as pathPosix } from 'path';
import { FileAction, FileActionType } from './types';

const FILE_ACTION_BLOCK_REGEX = /```file-actions\s*([\s\S]*?)```/gi;
const VALID_ACTIONS = new Set<FileActionType>(['create', 'write', 'update', 'delete']);

function normalizeAndValidatePath(rawPath: unknown): string | null {
  if (typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  if (trimmed.includes('\0')) return null;
  if (/^[a-zA-Z]:/.test(trimmed)) return null;
  if (trimmed.startsWith('~')) return null;

  const unixLike = trimmed.replace(/\\/g, '/');
  if (unixLike.startsWith('/')) return null;

  const normalized = pathPosix.normalize(unixLike);
  if (!normalized || normalized === '.' || normalized.startsWith('../')) {
    return null;
  }

  return normalized;
}

function parseActionCandidate(candidate: unknown): FileAction | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const value = candidate as Record<string, unknown>;

  if (typeof value.action !== 'string') return null;
  const action = value.action.trim() as FileActionType;
  if (!VALID_ACTIONS.has(action)) return null;

  const path = normalizeAndValidatePath(value.path);
  if (!path) return null;

  if (action === 'delete') {
    return {
      action,
      path,
    };
  }

  if (typeof value.content !== 'string') return null;

  return {
    action,
    path,
    content: value.content,
  };
}

function parseBlockPayload(blockPayload: string): FileAction[] {
  const trimmed = blockPayload.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => parseActionCandidate(item))
        .filter((item): item is FileAction => item !== null);
    }

    const single = parseActionCandidate(parsed);
    return single ? [single] : [];
  } catch {
    return [];
  }
}

export interface ParsedFileActionsOutput {
  textOutput: string;
  fileActions: FileAction[];
}

export function extractFileActionsFromOutput(
  rawOutput: string,
): ParsedFileActionsOutput {
  if (!rawOutput) {
    return { textOutput: '', fileActions: [] };
  }

  const collectedActions: FileAction[] = [];
  const textOutput = rawOutput.replace(FILE_ACTION_BLOCK_REGEX, (_, payload) => {
    const actions = parseBlockPayload(String(payload ?? ''));
    if (actions.length > 0) {
      collectedActions.push(...actions);
    }
    return '';
  });

  return {
    textOutput: textOutput.trim(),
    fileActions: collectedActions,
  };
}
