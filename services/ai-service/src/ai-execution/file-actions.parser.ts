import { posix as pathPosix } from 'path';
import { FileAction, FileActionParseMethod, FileActionType } from './types';

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

function parseTopLevelFileActionsObjectPayload(rawOutput: string): FileAction[] {
  const trimmed = rawOutput.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }

    const candidateActions = (parsed as Record<string, unknown>)['file-actions'];
    if (!Array.isArray(candidateActions)) {
      return [];
    }

    return candidateActions
      .map((item) => parseActionCandidate(item))
      .filter((item): item is FileAction => item !== null);
  } catch {
    return [];
  }
}

function parseStructuredJsonPayload(
  rawOutput: string,
): ParsedFileActionsOutput | null {
  const trimmed = rawOutput.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const parsedObject = parsed as Record<string, unknown>;
    if (
      typeof parsedObject.assistantText !== 'string' ||
      !Array.isArray(parsedObject.fileActions)
    ) {
      return null;
    }

    const fileActions = parsedObject.fileActions
      .map((item) => parseActionCandidate(item))
      .filter((item): item is FileAction => item !== null);

    const workspaceMutationAttempted =
      typeof parsedObject.workspaceMutationAttempted === 'boolean'
        ? parsedObject.workspaceMutationAttempted
        : undefined;

    return {
      textOutput: parsedObject.assistantText.trim(),
      fileActions,
      parseMethod: 'structured_json',
      workspaceMutationAttempted,
    };
  } catch {
    return null;
  }
}

export interface ParsedFileActionsOutput {
  textOutput: string;
  fileActions: FileAction[];
  parseMethod: FileActionParseMethod;
  workspaceMutationAttempted?: boolean;
}

export function extractFileActionsFromOutput(
  rawOutput: string,
): ParsedFileActionsOutput {
  if (!rawOutput) {
    return { textOutput: '', fileActions: [], parseMethod: 'none' };
  }

  const structuredJsonParsed = parseStructuredJsonPayload(rawOutput);
  if (structuredJsonParsed) {
    return structuredJsonParsed;
  }

  const blockMatches = [...rawOutput.matchAll(FILE_ACTION_BLOCK_REGEX)];
  const collectedActions: FileAction[] = [];
  let textOutput = rawOutput;
  if (blockMatches.length > 0) {
    for (const blockMatch of blockMatches) {
      const actions = parseBlockPayload(String(blockMatch[1] ?? ''));
      if (actions.length > 0) {
        collectedActions.push(...actions);
      }
    }
    textOutput = rawOutput.replace(FILE_ACTION_BLOCK_REGEX, '').trim();
    return {
      textOutput,
      fileActions: collectedActions,
      parseMethod: 'fenced_block',
    };
  }

  const fallbackActions = parseTopLevelFileActionsObjectPayload(rawOutput);
  if (fallbackActions.length > 0) {
    return {
      textOutput: rawOutput.trim(),
      fileActions: fallbackActions,
      parseMethod: 'fallback_json',
    };
  }

  return {
    textOutput: rawOutput.trim(),
    fileActions: [],
    parseMethod: 'none',
  };
}
