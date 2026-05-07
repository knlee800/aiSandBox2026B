'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import WorkspaceShell from '@/components/workspace/workspace-shell';
import { PROJECT_FIRST_UX } from '@/lib/feature-flags';
import { openProjectInFreshSession } from '@/lib/open-project-in-fresh-session';
import { attemptProjectAutosave } from '@/lib/project-autosave';
import { attemptNamedProjectSave } from '@/lib/project-named-save';
import { recoveryCopy } from '@/lib/recovery-copy';
import type {
  WorkspaceCheckpoint,
  WorkspaceQuotaSummary,
  WorkspaceShellSession,
  WorkspaceUsageSummary,
  WorkspaceUserSummary,
} from '@/components/workspace/workspace-shell.logic';
import {
  executeSessionCommand,
  type WorkspaceExecState,
} from '@/components/workspace/workspace-exec.logic';
import { refreshPostExecSurfaces } from '@/components/workspace/workspace-post-exec.logic';
import { areCheckpointListsEqual, isUsableSession } from '@/components/workspace/workspace-shell.logic';
import {
  createWorkspaceCheckpoint,
  type WorkspaceCheckpointCreateState,
  type WorkspaceCheckpointCreateResult,
} from '@/components/workspace/workspace-checkpoint-create.logic';
import {
  revertWorkspaceCheckpoint,
  type WorkspaceCheckpointRevertState,
} from '@/components/workspace/workspace-checkpoint-revert.logic';
import {
  loadWorkspaceCheckpointDiff,
  type WorkspaceCheckpointDiffState,
  type WorkspaceCheckpointDiffResponse,
} from '@/components/workspace/workspace-checkpoint-diff.logic';
import {
  buildPreviewProxyUrl,
  isPreviewRunning,
  type WorkspacePreviewStatusResponse,
  type WorkspacePreviewState,
} from '@/components/workspace/workspace-preview.logic';
import {
  deleteWorkspaceFile,
  findFirstFilePath,
  loadWorkspaceFileTree,
  readWorkspaceFile,
  searchWorkspaceFiles,
  writeWorkspaceFile,
  type WorkspaceFileNode,
  type WorkspaceFileSaveState,
  type WorkspaceSearchResults,
  type WorkspaceFileSurfaceState,
} from '@/components/workspace/workspace-file-navigation.logic';
import {
  acquireExecutionApplyGuard,
  applySequentialFileActions,
  isRiskyFileActionBatch,
  isWorkspaceFileAction,
  type WorkspaceExecutionFileActionState,
  type WorkspaceFileAction,
} from '@/components/workspace/workspace-ai-file-actions.logic';
import {
  acquireExecutionCoherenceGuard,
  runAiActionCoherence,
} from '@/components/workspace/workspace-ai-coherence.logic';
import {
  parseStoredChatThreadMessages,
  type WorkspaceChatThreadMessage,
} from '@/components/workspace/workspace-chat-thread.logic';
import {
  buildWorkspaceChatOrchestrationPlan,
  CHAT_ORCHESTRATION_MAX_STEPS,
  formatWorkspaceChatOrchestrationProgress,
  type WorkspaceChatOrchestrationStepProgress,
} from '@/components/workspace/workspace-chat-orchestration.logic';
import {
  loadSessionChatMessagesFromBackend,
  persistSessionChatMessageToBackend,
} from '@/components/workspace/workspace-chat-persistence.logic';
import {
  shouldRefreshDashboardForChatStatus,
  toQuotaRateLimitGuidance,
} from '@/components/workspace/workspace-quota-usage.logic';
import {
  buildProjectScopedSnapshotLabel,
  exportWorkspaceArchive,
  importWorkspaceArchive,
  loadWorkspaceSnapshots,
  resolveProjectScopedLatestSnapshotId,
  restoreWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshotSummary,
} from '@/components/workspace/workspace-snapshots.logic';
import {
  associateWorkspaceProjectSession,
  createWorkspaceProject,
  forkPublicWorkspaceProject,
  loadPublicWorkspaceProjectDetail,
  loadPublicWorkspaceProjects,
  loadWorkspaceProjects,
  moveWorkspaceProject,
  openWorkspaceProject,
  updateWorkspaceProjectVisibility,
  type WorkspacePublicProjectDetail,
  type WorkspacePublicProjectSummary,
  type WorkspaceProjectSummary,
} from '@/components/workspace/workspace-projects.logic';
import {
  createWorkspace,
  deleteWorkspace,
  loadWorkspaces,
  updateWorkspace,
  type Workspace,
} from '@/components/workspace/workspace-workspaces.logic';
import {
  detectBuildToolchainUnavailable,
  resolveWorkspaceBuildCommand,
  WORKSPACE_BUILD_TARGET_OPTIONS,
  type WorkspaceBuildTarget,
} from '@/components/workspace/workspace-build-targets.logic';

function getCsrfTokenFromCookie(): string | null {
  const csrfCookie = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('aisandbox_csrf='));

  return csrfCookie?.slice('aisandbox_csrf='.length) || null;
}

const projectFirstUxAnchors = {
  enabled: PROJECT_FIRST_UX,
  copy: recoveryCopy,
};
void projectFirstUxAnchors;

const HIDDEN_UNUSABLE_SESSIONS_STORAGE_KEY = 'workspace_hidden_unusable_sessions';
const CHAT_THREAD_STORAGE_KEY_PREFIX = 'workspace_chat_thread';
const TAB_SELECTED_SESSION_STORAGE_KEY = 'workspace_tab_selected_session_id';
const TAB_SELECTED_PROJECT_STORAGE_KEY = 'workspace_tab_selected_project_id';
const TAB_SELECTED_WORKSPACE_STORAGE_KEY = 'workspace_tab_selected_workspace_id';
const TAB_EDITOR_DRAFT_STORAGE_KEY = 'workspace_tab_editor_draft';
const CHAT_EXECUTION_POLL_INTERVAL_MS = 3000;
const PROJECT_OPEN_FILE_REFRESH_RETRY_DELAY_MS = 250;
const PROJECT_OPEN_FILE_REFRESH_MAX_ATTEMPTS = 6;
const AI_AUTO_CHECKPOINT_DESCRIPTION = 'AI: applied workspace file actions';
const DEFAULT_CHAT_MODEL_OPTION = 'xai:grok-3';
const WORKSPACE_CONTEXT_MAX_FILE_PATHS = 200;
const WORKSPACE_CONTEXT_MAX_SELECTED_FILE_CHARS = 8000;
const WORKSPACE_CONTEXT_MAX_NAMED_FILES = 3;
const WORKSPACE_CONTEXT_MAX_SEARCH_QUERY_CHARS = 120;
const CHAT_MODEL_OPTIONS = [
  { value: 'xai:grok-3', provider: 'xai', model: 'grok-3', label: 'xAI - grok-3' },
  {
    value: 'anthropic:claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    label: 'Anthropic - claude-3-5-sonnet-20241022',
  },
  { value: 'openai:gpt-4o', provider: 'openai', model: 'gpt-4o', label: 'OpenAI - gpt-4o' },
  {
    value: 'groq:mixtral-8x7b-32768',
    provider: 'groq',
    model: 'mixtral-8x7b-32768',
    label: 'Groq - mixtral-8x7b-32768',
  },
  {
    value: 'deepseek:deepseek-chat',
    provider: 'deepseek',
    model: 'deepseek-chat',
    label: 'DeepSeek - deepseek-chat',
  },
] as const;

interface WorkspacePromptNamedFileContent {
  path: string;
  content: string;
}

interface WorkspacePromptContext {
  filePaths: string[];
  selectedFilePath?: string;
  selectedFileContent?: string;
  namedFileContents?: WorkspacePromptNamedFileContent[];
  searchResults?: WorkspaceSearchResults;
  projectName?: string;
  workspaceName?: string;
}

function isSensitiveFilePath(path: string): boolean {
  const normalizedPath = path.trim().toLowerCase();
  if (!normalizedPath) {
    return false;
  }

  const pathSegments = normalizedPath.split('/');
  const fileName = pathSegments[pathSegments.length - 1] ?? normalizedPath;

  if (
    fileName === '.env' ||
    fileName.startsWith('.env.') ||
    fileName.endsWith('.env') ||
    fileName.includes('.env.') ||
    fileName.endsWith('.key') ||
    fileName.endsWith('.pem') ||
    fileName.endsWith('.cert') ||
    fileName.endsWith('.secret') ||
    fileName.endsWith('.credentials') ||
    fileName === 'package-lock.json' ||
    fileName === 'yarn.lock' ||
    fileName === 'pnpm-lock.yaml' ||
    fileName.endsWith('.lock') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.gif') ||
    fileName.endsWith('.ico') ||
    fileName.endsWith('.webp') ||
    fileName.endsWith('.svg') ||
    fileName.endsWith('.woff') ||
    fileName.endsWith('.woff2') ||
    fileName.endsWith('.ttf') ||
    fileName.endsWith('.eot') ||
    fileName.endsWith('.mp4') ||
    fileName.endsWith('.mp3') ||
    fileName.endsWith('.zip') ||
    fileName.endsWith('.gz') ||
    fileName.endsWith('.tar') ||
    fileName.endsWith('.bin') ||
    fileName.endsWith('.exe') ||
    fileName.endsWith('.dll') ||
    fileName.endsWith('.so') ||
    fileName.endsWith('.min.js') ||
    fileName.endsWith('.min.css') ||
    fileName.endsWith('.map')
  ) {
    return true;
  }

  return (
    normalizedPath.includes('/dist/') ||
    normalizedPath.includes('/build/') ||
    normalizedPath.includes('/coverage/')
  );
}

function collectWorkspacePromptFilePaths(
  nodes: WorkspaceFileNode[],
  filePathSet: Set<string>,
): void {
  for (const node of nodes) {
    if (node.type === 'file') {
      const normalizedPath = node.path.trim();
      if (normalizedPath) {
        filePathSet.add(normalizedPath);
      }
      continue;
    }

    if (node.children.length > 0) {
      collectWorkspacePromptFilePaths(node.children, filePathSet);
    }
  }
}

function normalizeWorkspacePromptFileContent(
  content: string | null | undefined,
): string | undefined {
  if (typeof content !== 'string') {
    return undefined;
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return undefined;
  }

  return trimmedContent.length > WORKSPACE_CONTEXT_MAX_SELECTED_FILE_CHARS
    ? `${trimmedContent.slice(0, WORKSPACE_CONTEXT_MAX_SELECTED_FILE_CHARS)}\n[...truncated at 8000 characters]`
    : trimmedContent;
}

function normalizeWorkspaceSearchQueryCandidate(
  candidate: string | null | undefined,
): string | undefined {
  if (typeof candidate !== 'string' || /[\u0000\r\n]/.test(candidate)) {
    return undefined;
  }

  const normalizedCandidate = candidate
    .trim()
    .replace(/^["`]+|["`]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[?!.,;:]+$/g, '')
    .trim();

  if (!normalizedCandidate || normalizedCandidate.length > WORKSPACE_CONTEXT_MAX_SEARCH_QUERY_CHARS) {
    return undefined;
  }

  if (normalizedCandidate.split(/\s+/).length > 8) {
    return undefined;
  }

  const normalizedLowerCandidate = normalizedCandidate.toLowerCase();
  if (
    normalizedLowerCandidate === 'it' ||
    normalizedLowerCandidate === 'this' ||
    normalizedLowerCandidate === 'that' ||
    normalizedLowerCandidate === 'something'
  ) {
    return undefined;
  }

  return normalizedCandidate;
}

function extractQuotedWorkspaceSearchCandidate(prompt: string): string | undefined {
  const doubleQuotedMatch = prompt.match(/"([^"\r\n]{2,120})"/);
  if (doubleQuotedMatch?.[1]) {
    return normalizeWorkspaceSearchQueryCandidate(doubleQuotedMatch[1]);
  }

  const backtickMatch = prompt.match(/`([^`\r\n]{2,120})`/);
  if (backtickMatch?.[1]) {
    return normalizeWorkspaceSearchQueryCandidate(backtickMatch[1]);
  }

  return undefined;
}

function stripWorkspaceSearchSuffixes(candidate: string): string {
  return candidate
    .replace(
      /\s+(?:implemented|defined|declared|used|referenced|mentioned|found)\s*(?:in|across)?\s*(?:this|the)?\s*(?:workspace|project|repo|repository)?$/i,
      '',
    )
    .replace(
      /\s+(?:in|across)\s+(?:this|the)?\s*(?:workspace|project|repo|repository).*$/i,
      '',
    )
    .replace(/\s+(?:please|for me)$/i, '')
    .trim();
}

function findExplicitPromptSearchQuery(prompt: string): string | undefined {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    return undefined;
  }

  const lowerPrompt = normalizedPrompt.toLowerCase();
  const hasExplicitSearchIntent =
    /\bsearch\b/.test(lowerPrompt) ||
    /\bfind\b/.test(lowerPrompt) ||
    /\blocate\b/.test(lowerPrompt) ||
    /\bwhere\s+(?:is|are)\b/.test(lowerPrompt) ||
    /\bwhich\s+files?\s+(?:mention|mentions|contain|contains)\b/.test(lowerPrompt);

  if (!hasExplicitSearchIntent) {
    return undefined;
  }

  const quotedCandidate = extractQuotedWorkspaceSearchCandidate(normalizedPrompt);
  if (quotedCandidate) {
    return quotedCandidate;
  }

  const searchPatterns = [
    /\bwhich\s+files?\s+(?:mention|mentions|contain|contains)\s+(.+?)(?:\?|$)/i,
    /\bwhich\s+file\s+contains\s+(.+?)(?:\?|$)/i,
    /\bsearch\s+for\s+(.+?)(?:\?|$)/i,
    /\bfind\s+(.+?)(?:\?|$)/i,
    /\blocate\s+(.+?)(?:\?|$)/i,
    /\bwhere\s+(?:is|are)\s+(.+?)(?:\?|$)/i,
  ];

  for (const pattern of searchPatterns) {
    const matched = normalizedPrompt.match(pattern);
    const rawCandidate = matched?.[1];
    if (!rawCandidate) {
      continue;
    }

    const normalizedCandidate = normalizeWorkspaceSearchQueryCandidate(
      stripWorkspaceSearchSuffixes(rawCandidate),
    );
    if (normalizedCandidate) {
      return normalizedCandidate;
    }
  }

  return undefined;
}

function getWorkspacePromptReferenceMatchIndex(prompt: string, reference: string): number {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const normalizedReference = reference.trim().toLowerCase();
  if (!normalizedPrompt || !normalizedReference) {
    return -1;
  }

  const candidates = new Set<string>([
    normalizedReference,
    `"${normalizedReference}"`,
    `'${normalizedReference}'`,
    `\`${normalizedReference}\``,
  ]);

  if (normalizedReference.includes('/')) {
    const windowsReference = normalizedReference.replaceAll('/', '\\');
    candidates.add(windowsReference);
    candidates.add(`"${windowsReference}"`);
    candidates.add(`'${windowsReference}'`);
    candidates.add(`\`${windowsReference}\``);
  }

  let bestIndex = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const candidateIndex = normalizedPrompt.indexOf(candidate);
    if (candidateIndex >= 0 && candidateIndex < bestIndex) {
      bestIndex = candidateIndex;
    }
  }

  return Number.isFinite(bestIndex) ? bestIndex : -1;
}

function findExplicitPromptNamedWorkspaceFilePaths(
  prompt: string,
  workspaceFilePaths: string[],
): string[] {
  const normalizedWorkspaceFilePaths = Array.from(
    new Set(
      workspaceFilePaths
        .filter((path): path is string => typeof path === 'string')
        .map((path) => path.trim())
        .filter((path) => path.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const basenameToPaths = new Map<string, string[]>();
  for (const filePath of normalizedWorkspaceFilePaths) {
    const basename = getWorkspacePathBasename(filePath)?.toLowerCase() ?? null;
    if (!basename) {
      continue;
    }
    const existingPaths = basenameToPaths.get(basename) ?? [];
    basenameToPaths.set(basename, [...existingPaths, filePath]);
  }

  const matches: Array<{ path: string; index: number; rank: number }> = [];
  const matchedPaths = new Set<string>();

  for (const filePath of normalizedWorkspaceFilePaths) {
    const matchIndex = getWorkspacePromptReferenceMatchIndex(prompt, filePath);
    if (matchIndex < 0) {
      continue;
    }
    matches.push({ path: filePath, index: matchIndex, rank: 0 });
    matchedPaths.add(filePath);
  }

  for (const filePath of normalizedWorkspaceFilePaths) {
    if (matchedPaths.has(filePath)) {
      continue;
    }

    const basename = getWorkspacePathBasename(filePath)?.trim() ?? '';
    if (!basename) {
      continue;
    }

    const basenameMatches = basenameToPaths.get(basename.toLowerCase()) ?? [];
    if (basenameMatches.length !== 1) {
      continue;
    }

    const matchIndex = getWorkspacePromptReferenceMatchIndex(prompt, basename);
    if (matchIndex < 0) {
      continue;
    }

    matches.push({ path: filePath, index: matchIndex, rank: 1 });
    matchedPaths.add(filePath);
  }

  return matches
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      if (left.index !== right.index) {
        return left.index - right.index;
      }
      return left.path.localeCompare(right.path);
    })
    .map((match) => match.path);
}

async function loadNamedWorkspacePromptFileContents(args: {
  prompt: string;
  sessionId: string | null;
  workspaceFilePaths: string[];
}): Promise<WorkspacePromptNamedFileContent[]> {
  if (!args.sessionId) {
    return [];
  }

  const matchedPaths = findExplicitPromptNamedWorkspaceFilePaths(
    args.prompt,
    args.workspaceFilePaths,
  )
    .filter((path) => !isSensitiveFilePath(path))
    .slice(0, WORKSPACE_CONTEXT_MAX_NAMED_FILES);

  if (matchedPaths.length === 0) {
    return [];
  }

  const readResults = await Promise.all(
    matchedPaths.map(async (matchedPath) => {
      try {
        const fileResponse = await readWorkspaceFile({
          sessionId: args.sessionId as string,
          filePath: matchedPath,
        });
        const normalizedPath = fileResponse.path.trim();
        if (!normalizedPath || isSensitiveFilePath(normalizedPath)) {
          return null;
        }

        const normalizedContent = normalizeWorkspacePromptFileContent(fileResponse.content);
        if (!normalizedContent) {
          return null;
        }

        return {
          path: normalizedPath,
          content: normalizedContent,
        } satisfies WorkspacePromptNamedFileContent;
      } catch (error) {
        console.warn('Skipping unreadable named workspace file for AI context:', matchedPath, error);
        return null;
      }
    }),
  );

  return readResults.filter(
    (result): result is WorkspacePromptNamedFileContent => result !== null,
  );
}

async function loadWorkspacePromptSearchResults(args: {
  prompt: string;
  sessionId: string | null;
}): Promise<WorkspaceSearchResults | undefined> {
  if (!args.sessionId) {
    return undefined;
  }

  const searchQuery = findExplicitPromptSearchQuery(args.prompt);
  if (!searchQuery) {
    return undefined;
  }

  try {
    return await searchWorkspaceFiles({
      sessionId: args.sessionId,
      query: searchQuery,
    });
  } catch (error) {
    console.warn('Skipping workspace content search for AI context:', searchQuery, error);
    return undefined;
  }
}

async function buildWorkspacePromptContext(args: {
  prompt: string;
  sessionId: string | null;
  workspaceFileTree: WorkspaceFileNode[];
  selectedFilePath: string | null;
  selectedFileContent?: string;
  projectName?: string | null;
  workspaceName?: string | null;
}): Promise<WorkspacePromptContext | undefined> {
  const filePathSet = new Set<string>();
  collectWorkspacePromptFilePaths(args.workspaceFileTree, filePathSet);
  const allWorkspaceFilePaths = Array.from(filePathSet).sort((left, right) =>
    left.localeCompare(right),
  );

  const filePaths = allWorkspaceFilePaths.slice(0, WORKSPACE_CONTEXT_MAX_FILE_PATHS);

  const normalizedSelectedFilePath =
    typeof args.selectedFilePath === 'string' && args.selectedFilePath.trim().length > 0
      ? args.selectedFilePath.trim()
      : undefined;
  const normalizedSelectedFileContent =
    normalizedSelectedFilePath &&
    typeof args.selectedFileContent === 'string' &&
    args.selectedFileContent.trim().length > 0 &&
    !isSensitiveFilePath(normalizedSelectedFilePath)
      ? normalizeWorkspacePromptFileContent(args.selectedFileContent)
      : undefined;
  const namedFileContents = await loadNamedWorkspacePromptFileContents({
    prompt: args.prompt,
    sessionId: args.sessionId,
    workspaceFilePaths: allWorkspaceFilePaths,
  });
  const searchResults = await loadWorkspacePromptSearchResults({
    prompt: args.prompt,
    sessionId: args.sessionId,
  });
  const normalizedProjectName =
    typeof args.projectName === 'string' && args.projectName.trim().length > 0
      ? args.projectName.trim()
      : undefined;
  const normalizedWorkspaceName =
    typeof args.workspaceName === 'string' && args.workspaceName.trim().length > 0
      ? args.workspaceName.trim()
      : undefined;

  if (
    filePaths.length === 0 &&
    !normalizedSelectedFilePath &&
    !normalizedSelectedFileContent &&
    namedFileContents.length === 0 &&
    !searchResults &&
    !normalizedProjectName &&
    !normalizedWorkspaceName
  ) {
    return undefined;
  }

  return {
    filePaths,
    ...(normalizedProjectName ? { projectName: normalizedProjectName } : {}),
    ...(normalizedWorkspaceName ? { workspaceName: normalizedWorkspaceName } : {}),
    ...(normalizedSelectedFilePath
      ? { selectedFilePath: normalizedSelectedFilePath }
      : {}),
    ...(normalizedSelectedFileContent
      ? { selectedFileContent: normalizedSelectedFileContent }
      : {}),
    ...(namedFileContents.length > 0 ? { namedFileContents } : {}),
    ...(searchResults ? { searchResults } : {}),
  };
}

interface WorkspaceChatExecutionResponse {
  executionId?: string;
  status?: string;
  output?: string;
  provider?: string;
  model?: string;
  fileActions?: WorkspaceFileAction[];
}

const DRIVER_API_KEY_STORAGE_KEY = 'driver_api_key';

function parseSelectedChatModelOption(value: string): {
  provider: string;
  model: string;
  optionValue: string;
} {
  const matched = CHAT_MODEL_OPTIONS.find((option) => option.value === value);
  if (matched) {
    return {
      provider: matched.provider,
      model: matched.model,
      optionValue: matched.value,
    };
  }

  const fallback = CHAT_MODEL_OPTIONS[0];
  return {
    provider: fallback.provider,
    model: fallback.model,
    optionValue: fallback.value,
  };
}

function resolveSelectedWorkspaceId(args: {
  workspaces: Workspace[];
  currentSelectedWorkspaceId: string | null;
  seededWorkspaceId: string | null;
}): string | null {
  const normalizedCurrentSelectedWorkspaceId =
    typeof args.currentSelectedWorkspaceId === 'string' && args.currentSelectedWorkspaceId.trim()
      ? args.currentSelectedWorkspaceId.trim()
      : null;
  if (
    normalizedCurrentSelectedWorkspaceId &&
    args.workspaces.some((workspace) => workspace.id === normalizedCurrentSelectedWorkspaceId)
  ) {
    return normalizedCurrentSelectedWorkspaceId;
  }

  const normalizedSeededWorkspaceId =
    typeof args.seededWorkspaceId === 'string' && args.seededWorkspaceId.trim()
      ? args.seededWorkspaceId.trim()
      : null;
  if (
    normalizedSeededWorkspaceId &&
    args.workspaces.some((workspace) => workspace.id === normalizedSeededWorkspaceId)
  ) {
    return normalizedSeededWorkspaceId;
  }

  return args.workspaces.find((workspace) => workspace.isDefault)?.id ?? args.workspaces[0]?.id ?? null;
}

function normalizeWorkspaceFileActions(rawActions: unknown): WorkspaceFileAction[] {
  if (!Array.isArray(rawActions)) {
    return [];
  }
  return rawActions.filter((item): item is WorkspaceFileAction => isWorkspaceFileAction(item));
}

function getWorkspacePathBasename(filePath: string | null | undefined): string | null {
  if (typeof filePath !== 'string') {
    return null;
  }

  const normalizedPath = filePath.trim();
  if (!normalizedPath) {
    return null;
  }

  const pathSegments = normalizedPath.split(/[\\/]/).filter(Boolean);
  const basename = pathSegments.at(-1)?.trim() ?? normalizedPath;
  return basename ? basename : normalizedPath;
}

function buildAutosaveHintFromFileActions(actions: WorkspaceFileAction[]): string | null {
  const uniquePaths: string[] = [];
  for (const action of actions) {
    const normalizedPath = action.path.trim();
    if (!normalizedPath || uniquePaths.includes(normalizedPath)) {
      continue;
    }
    uniquePaths.push(normalizedPath);
  }

  const firstBasename = getWorkspacePathBasename(uniquePaths[0] ?? null);
  if (!firstBasename) {
    return null;
  }

  if (uniquePaths.length === 1) {
    return firstBasename;
  }

  return `${firstBasename} +${uniquePaths.length - 1}`;
}

function toChatAssistantFailureMessage(input: {
  rawMessage?: string;
  fallbackMessage: string;
  statusCode?: number;
  retryAfterHeader?: string | null;
}): string {
  return toQuotaRateLimitGuidance(input);
}

async function readResponseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as
      | { message?: string; error?: string; detail?: string }
      | null;
    if (payload && typeof payload === 'object') {
      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim();
      }
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error.trim();
      }
      if (typeof payload.detail === 'string' && payload.detail.trim()) {
        return payload.detail.trim();
      }
    }
  } catch {
    // Ignore parse errors and fallback to empty detail.
  }
  return '';
}

function parseHiddenSessionIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function getChatThreadStorageKey(sessionId: string): string {
  return `${CHAT_THREAD_STORAGE_KEY_PREFIX}_${sessionId}`;
}

export default function AppPage() {
  type WorkspaceCheckpointCompareState =
    | 'idle'
    | 'selecting'
    | 'loading'
    | 'ready'
    | 'compare-error';
  type WorkspaceCheckpointSnapshotState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'empty'
    | 'snapshot-error';
  type WorkspaceCheckpointLiveOpenState =
    | 'idle'
    | 'opening'
    | 'opened'
    | 'missing'
    | 'open-error';

  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WorkspaceShellSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionCreateError, setSessionCreateError] = useState<string | null>(null);
  const [hiddenSessionIds, setHiddenSessionIds] = useState<string[]>([]);
  const [stoppingSessionId, setStoppingSessionId] = useState<string | null>(null);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<WorkspaceCheckpoint[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [checkpointCreateState, setCheckpointCreateState] =
    useState<WorkspaceCheckpointCreateState>('idle');
  const [checkpointCreateError, setCheckpointCreateError] = useState<string | null>(null);
  const [checkpointDescriptionInput, setCheckpointDescriptionInput] = useState('');
  const [checkpointRevertState, setCheckpointRevertState] =
    useState<WorkspaceCheckpointRevertState>('idle');
  const [checkpointRevertError, setCheckpointRevertError] = useState<string | null>(null);
  const [checkpointRevertTargetId, setCheckpointRevertTargetId] = useState<string | null>(null);
  const [checkpointDiffState, setCheckpointDiffState] = useState<WorkspaceCheckpointDiffState>('idle');
  const [checkpointDiffError, setCheckpointDiffError] = useState<string | null>(null);
  const [checkpointDiffTargetId, setCheckpointDiffTargetId] = useState<string | null>(null);
  const [checkpointDiffResponse, setCheckpointDiffResponse] =
    useState<WorkspaceCheckpointDiffResponse | null>(null);
  const [checkpointCompareState, setCheckpointCompareState] =
    useState<WorkspaceCheckpointCompareState>('idle');
  const [checkpointCompareError, setCheckpointCompareError] = useState<string | null>(null);
  const [checkpointCompareBaseId, setCheckpointCompareBaseId] = useState<string | null>(null);
  const [checkpointCompareTargetId, setCheckpointCompareTargetId] = useState<string | null>(null);
  const [checkpointCompareResponse, setCheckpointCompareResponse] =
    useState<WorkspaceCheckpointDiffResponse | null>(null);
  const [checkpointSnapshotState, setCheckpointSnapshotState] =
    useState<WorkspaceCheckpointSnapshotState>('idle');
  const [checkpointSnapshotError, setCheckpointSnapshotError] = useState<string | null>(null);
  const [checkpointSnapshotTargetId, setCheckpointSnapshotTargetId] = useState<string | null>(null);
  const [checkpointSnapshotResponse, setCheckpointSnapshotResponse] =
    useState<WorkspaceCheckpointDiffResponse | null>(null);
  const [checkpointLiveOpenState, setCheckpointLiveOpenState] =
    useState<WorkspaceCheckpointLiveOpenState>('idle');
  const [checkpointLiveOpenError, setCheckpointLiveOpenError] = useState<string | null>(null);
  const [checkpointLiveOpenTargetPath, setCheckpointLiveOpenTargetPath] = useState<string | null>(null);
  const [checkpointPinnedReferenceId, setCheckpointPinnedReferenceId] = useState<string | null>(null);
  const [workspaceSnapshots, setWorkspaceSnapshots] = useState<WorkspaceSnapshotSummary[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [snapshotListState, setSnapshotListState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [snapshotActionState, setSnapshotActionState] = useState<
    'idle' | 'saving' | 'restoring' | 'exporting' | 'importing' | 'success' | 'error'
  >('idle');
  const [snapshotActionMessage, setSnapshotActionMessage] = useState<string | null>(null);
  const [snapshotActionError, setSnapshotActionError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaceCreateNameInput, setWorkspaceCreateNameInput] = useState('');
  const [workspaceRenameNameInput, setWorkspaceRenameNameInput] = useState('');
  const [workspaceActionState, setWorkspaceActionState] = useState<
    'idle' | 'creating' | 'renaming' | 'deleting'
  >('idle');
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);
  const [workspaceProjects, setWorkspaceProjects] = useState<WorkspaceProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectVisibility, setSelectedProjectVisibility] = useState<'private' | 'public'>(
    'private',
  );
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectMoveTargetWorkspaceId, setProjectMoveTargetWorkspaceId] = useState<string | null>(
    null,
  );
  const [projectListState, setProjectListState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [projectActionState, setProjectActionState] = useState<
    'idle' | 'creating' | 'opening' | 'moving' | 'success' | 'error'
  >('idle');
  const [projectActionMessage, setProjectActionMessage] = useState<string | null>(null);
  const [projectActionError, setProjectActionError] = useState<string | null>(null);
  const [publicWorkspaceProjects, setPublicWorkspaceProjects] = useState<WorkspacePublicProjectSummary[]>([]);
  const [selectedPublicProjectId, setSelectedPublicProjectId] = useState<string | null>(null);
  const [selectedPublicProjectDetail, setSelectedPublicProjectDetail] =
    useState<WorkspacePublicProjectDetail | null>(null);
  const [publicProjectListState, setPublicProjectListState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [publicProjectActionState, setPublicProjectActionState] = useState<
    'idle' | 'viewing' | 'forking' | 'success' | 'error'
  >('idle');
  const [publicProjectActionMessage, setPublicProjectActionMessage] = useState<string | null>(null);
  const [publicProjectActionError, setPublicProjectActionError] = useState<string | null>(null);
  const [userSummary, setUserSummary] = useState<WorkspaceUserSummary | null>(null);
  const [usageSummary, setUsageSummary] = useState<WorkspaceUsageSummary | null>(null);
  const [quotaSummary, setQuotaSummary] = useState<WorkspaceQuotaSummary | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [selectedBuildTarget, setSelectedBuildTarget] = useState<WorkspaceBuildTarget>('mobile');
  const [buildRequestState, setBuildRequestState] = useState<
    'idle' | 'submitting' | 'completed' | 'failed'
  >('idle');
  const [buildStatusMessage, setBuildStatusMessage] = useState<string | null>(null);
  const [buildOutput, setBuildOutput] = useState('');
  const [buildError, setBuildError] = useState<string | null>(null);
  const [chatPromptInput, setChatPromptInput] = useState('');
  const [chatResponseText, setChatResponseText] = useState('');
  const [chatRequestState, setChatRequestState] = useState<
    'idle' | 'submitting' | 'queued' | 'running' | 'completed' | 'failed'
  >('idle');
  const [chatExecutionId, setChatExecutionId] = useState<string | null>(null);
  const [chatStatusMessage, setChatStatusMessage] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [selectedChatModelOption, setSelectedChatModelOption] = useState<string>(
    DEFAULT_CHAT_MODEL_OPTION,
  );
  const [isChatOrchestrationEnabled, setIsChatOrchestrationEnabled] = useState(false);
  const [chatThreadMessages, setChatThreadMessages] = useState<WorkspaceChatThreadMessage[]>([]);
  const [chatExecutionFileActionStates, setChatExecutionFileActionStates] = useState<
    Record<string, WorkspaceExecutionFileActionState>
  >({});
  const chatStreamRef = useRef<EventSource | null>(null);
  const chatResponseTextRef = useRef('');
  const skipNextChatThreadPersistRef = useRef(false);
  const pendingAssistantMessageIdRef = useRef<string | null>(null);
  const selectedSessionIdRef = useRef<string | null>(null);
  const selectedFilePathRef = useRef<string | null>(null);
  const skipNextSessionEffectFileReloadRef = useRef(false);
  const projectOpenInProgressRef = useRef(false);
  const coldMountSeededSessionIdRef = useRef<string | null>(null);
  const coldMountSeededProjectIdRef = useRef<string | null>(null);
  const coldMountSeededWorkspaceIdRef = useRef<string | null>(null);
  const coldMountEditorDraftRef = useRef<{
    projectId: string;
    sessionId: string;
    filePath: string;
    content: string;
  } | null>(null);
  const lastProjectAutosaveAtRef = useRef<number | null>(null);
  const sessionsRef = useRef<WorkspaceShellSession[]>([]);
  const executionSessionIdByExecutionIdRef = useRef<Record<string, string>>({});
  const executionAssistantMessageIdByExecutionIdRef = useRef<Record<string, string>>({});

  const applyAssistantAttributionToExecutionMessage = (
    executionId: string,
    attribution: { provider?: string; model?: string },
  ) => {
    if (!attribution.provider && !attribution.model) {
      return;
    }
    const assistantMessageId =
      executionAssistantMessageIdByExecutionIdRef.current[executionId];
    if (!assistantMessageId) {
      return;
    }
    setChatThreadMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === assistantMessageId && message.role === 'assistant'
          ? {
              ...message,
              provider: attribution.provider ?? message.provider,
              model: attribution.model ?? message.model,
            }
          : message,
      ),
    );
  };
  const executionFileActionsByExecutionIdRef = useRef<Record<string, WorkspaceFileAction[]>>({});
  const appliedFileActionsExecutionIdsRef = useRef<Set<string>>(new Set());
  const pendingConfirmationExecutionIdsRef = useRef<Set<string>>(new Set());
  const cancelledFileActionsExecutionIdsRef = useRef<Set<string>>(new Set());
  const coheredExecutionIdsRef = useRef<Set<string>>(new Set());
  const [execState, setExecState] = useState<WorkspaceExecState>({
    status: 'idle',
    result: null,
  });
  const [previewState, setPreviewState] = useState<WorkspacePreviewState>('unavailable');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRequestIdRef = useRef(0);
  const [fileSurfaceState, setFileSurfaceState] = useState<WorkspaceFileSurfaceState>('empty');
  const [workspaceFileTree, setWorkspaceFileTree] = useState<WorkspaceFileNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState('');
  const [savedFileContent, setSavedFileContent] = useState('');
  const [fileSaveState, setFileSaveState] = useState<WorkspaceFileSaveState>('clean');
  const [fileSaveError, setFileSaveError] = useState<string | null>(null);
  const [fileSurfaceError, setFileSurfaceError] = useState<string | null>(null);
  const fileNavigationRequestIdRef = useRef(0);
  const fileContentRequestIdRef = useRef(0);
  const fileSaveRequestIdRef = useRef(0);
  const checkpointCreateRequestIdRef = useRef(0);
  const checkpointRevertRequestIdRef = useRef(0);
  const checkpointDiffRequestIdRef = useRef(0);
  const checkpointCompareRequestIdRef = useRef(0);
  const checkpointSnapshotRequestIdRef = useRef(0);
  const checkpointLiveOpenRequestIdRef = useRef(0);

  function handleWorkspaceUnauthorizedAccess(): void {
    setAuthLoading(true);
    setUserId(null);
    setWorkspaces([]);
    setSelectedWorkspaceId(null);
    setWorkspaceCreateNameInput('');
    setWorkspaceRenameNameInput('');
    setWorkspaceActionState('idle');
    setWorkspaceActionError(null);
    setProjectMoveTargetWorkspaceId(null);
    setSessions([]);
    setSelectedSessionId(null);
    setSessionError(null);
    setDashboardError(null);
    router.push(`/${locale}/login`);
  }

  async function handleLogout(): Promise<void> {
    const csrfToken = getCsrfTokenFromCookie();

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      });
    } catch {
      // still redirect and clear local UI state
    }

    handleWorkspaceUnauthorizedAccess();
  }

  useEffect(() => {
    const storedHiddenSessionIds = parseHiddenSessionIds(
      localStorage.getItem(HIDDEN_UNUSABLE_SESSIONS_STORAGE_KEY),
    );
    setHiddenSessionIds(storedHiddenSessionIds);
    if (PROJECT_FIRST_UX) {
      coldMountSeededSessionIdRef.current =
        sessionStorage.getItem(TAB_SELECTED_SESSION_STORAGE_KEY) || null;
      coldMountSeededProjectIdRef.current =
        sessionStorage.getItem(TAB_SELECTED_PROJECT_STORAGE_KEY) || null;
      coldMountSeededWorkspaceIdRef.current =
        sessionStorage.getItem(TAB_SELECTED_WORKSPACE_STORAGE_KEY) || null;
      const storedEditorDraft = sessionStorage.getItem(TAB_EDITOR_DRAFT_STORAGE_KEY);
      if (!storedEditorDraft) {
        coldMountEditorDraftRef.current = null;
      } else {
        try {
          const parsedDraft: unknown = JSON.parse(storedEditorDraft);
          const candidateDraft =
            parsedDraft && typeof parsedDraft === 'object'
              ? (parsedDraft as Record<string, unknown>)
              : null;
          if (
            candidateDraft &&
            typeof candidateDraft.projectId === 'string' &&
            typeof candidateDraft.sessionId === 'string' &&
            typeof candidateDraft.filePath === 'string' &&
            typeof candidateDraft.content === 'string'
          ) {
            coldMountEditorDraftRef.current = {
              projectId: candidateDraft.projectId,
              sessionId: candidateDraft.sessionId,
              filePath: candidateDraft.filePath,
              content: candidateDraft.content,
            };
          } else {
            coldMountEditorDraftRef.current = null;
          }
        } catch {
          coldMountEditorDraftRef.current = null;
        }
      }
    } else {
      coldMountSeededSessionIdRef.current = null;
      coldMountSeededProjectIdRef.current = null;
      coldMountSeededWorkspaceIdRef.current = null;
      coldMountEditorDraftRef.current = null;
    }

    void (async () => {
      try {
        const meResponse = await fetch('/api/auth/me');
        if (!meResponse.ok) {
          router.push(`/${locale}/login`);
          return;
        }
        const me = (await meResponse.json()) as { id?: unknown };
        if (typeof me.id !== 'string' || !me.id.trim()) {
          router.push(`/${locale}/login`);
          return;
        }
        setUserId(me.id);
        setAuthLoading(false);
        void loadSessions();
        void loadDashboardSlice();
        if (PROJECT_FIRST_UX) {
          void loadWorkspacesForUser();
          void loadPublicWorkspaceProjectsList();
        }
      } catch {
        router.push(`/${locale}/login`);
      }
    })();
  }, [locale, router]);

  useEffect(() => {
    if (!PROJECT_FIRST_UX) {
      return;
    }

    if (!userId) {
      return;
    }

    if (!selectedProjectId) {
      return;
    }

    if (projectOpenInProgressRef.current) {
      return;
    }

    const selectedSessionIdAtExpiryWarning = selectedSessionIdRef.current ?? selectedSessionId;
    if (!selectedSessionIdAtExpiryWarning) {
      return;
    }

    const selectedSessionAtExpiryWarning = sessions.find(
      (session) => session.id === selectedSessionIdAtExpiryWarning,
    );
    if (!selectedSessionAtExpiryWarning?.terminatedAt) {
      return;
    }

    void (async () => {
      const autosaveAttemptedAt = Date.now();
      const autosaveResult = await attemptProjectAutosave({
        sessionId: selectedSessionIdAtExpiryWarning,
        projectId: selectedProjectId,
        source: 'expiry',
        now: autosaveAttemptedAt,
        lastAutosaveAt: lastProjectAutosaveAtRef.current,
      });
      if (autosaveResult.status === 'saved') {
        lastProjectAutosaveAtRef.current = autosaveAttemptedAt;
        void loadWorkspaceSnapshotsForUser();
      }
    })();
  }, [selectedProjectId, selectedSessionId, sessions, userId]);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    selectedFilePathRef.current = selectedFilePath;
  }, [selectedFilePath]);

  useEffect(() => {
    if (!PROJECT_FIRST_UX) {
      return;
    }

    if (selectedSessionId) {
      sessionStorage.setItem(TAB_SELECTED_SESSION_STORAGE_KEY, selectedSessionId);
      return;
    }

    sessionStorage.removeItem(TAB_SELECTED_SESSION_STORAGE_KEY);
  }, [selectedSessionId]);

  useEffect(() => {
    if (!PROJECT_FIRST_UX) {
      return;
    }

    if (selectedWorkspaceId) {
      sessionStorage.setItem(TAB_SELECTED_WORKSPACE_STORAGE_KEY, selectedWorkspaceId);
      return;
    }

    sessionStorage.removeItem(TAB_SELECTED_WORKSPACE_STORAGE_KEY);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    const selectedWorkspace =
      workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;
    setWorkspaceRenameNameInput(selectedWorkspace?.name ?? '');
  }, [workspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (!PROJECT_FIRST_UX) {
      return;
    }

    if (selectedProjectId) {
      sessionStorage.setItem(TAB_SELECTED_PROJECT_STORAGE_KEY, selectedProjectId);
      return;
    }

    sessionStorage.removeItem(TAB_SELECTED_PROJECT_STORAGE_KEY);
  }, [selectedProjectId]);

  useEffect(() => {
    setProjectMoveTargetWorkspaceId(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!PROJECT_FIRST_UX) {
      return;
    }

    if (
      selectedProjectId &&
      selectedSessionId &&
      selectedFilePath &&
      selectedFileContent !== savedFileContent
    ) {
      sessionStorage.setItem(
        TAB_EDITOR_DRAFT_STORAGE_KEY,
        JSON.stringify({
          projectId: selectedProjectId,
          sessionId: selectedSessionId,
          filePath: selectedFilePath,
          content: selectedFileContent,
        }),
      );
      return;
    }

    sessionStorage.removeItem(TAB_EDITOR_DRAFT_STORAGE_KEY);
  }, [
    selectedFileContent,
    savedFileContent,
    selectedFilePath,
    selectedProjectId,
    selectedSessionId,
  ]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    if (projectOpenInProgressRef.current) {
      return;
    }
    if (!userId) {
      return;
    }

    checkpointCreateRequestIdRef.current += 1;
    setCheckpointCreateState('idle');
    setCheckpointCreateError(null);
    setCheckpointDescriptionInput('');
    checkpointRevertRequestIdRef.current += 1;
    setCheckpointRevertState('idle');
    setCheckpointRevertError(null);
    setCheckpointRevertTargetId(null);
    checkpointDiffRequestIdRef.current += 1;
    setCheckpointDiffState('idle');
    setCheckpointDiffError(null);
    setCheckpointDiffTargetId(null);
    setCheckpointDiffResponse(null);
    checkpointCompareRequestIdRef.current += 1;
    setCheckpointCompareState('idle');
    setCheckpointCompareError(null);
    setCheckpointCompareBaseId(null);
    setCheckpointCompareTargetId(null);
    setCheckpointCompareResponse(null);
    checkpointSnapshotRequestIdRef.current += 1;
    setCheckpointSnapshotState('idle');
    setCheckpointSnapshotError(null);
    setCheckpointSnapshotTargetId(null);
    setCheckpointSnapshotResponse(null);
    checkpointLiveOpenRequestIdRef.current += 1;
    setCheckpointLiveOpenState('idle');
    setCheckpointLiveOpenError(null);
    setCheckpointLiveOpenTargetPath(null);
    setCheckpointPinnedReferenceId(null);
    setWorkspaceSnapshots([]);
    setSelectedSnapshotId(null);
    setSnapshotListState('idle');
    setSnapshotActionState('idle');
    setSnapshotActionMessage(null);
    setSnapshotActionError(null);
    setWorkspaceProjects([]);
    setSelectedProjectId(null);
    setSelectedProjectVisibility('private');
    setProjectNameInput('');
    setProjectListState('idle');
    setProjectActionState('idle');
    setProjectActionMessage(null);
    setProjectActionError(null);

    if (!selectedSessionId) {
      setCheckpoints([]);
      setHistoryError(null);
      setIsLoadingHistory(false);
      return;
    }

    void loadCheckpoints(selectedSessionId);
    void loadWorkspaceSnapshotsForUser();
    void loadPublicWorkspaceProjectsList();
    void loadDashboardSlice();
  }, [selectedSessionId, userId]);

  useEffect(() => {
    if (!PROJECT_FIRST_UX) {
      return;
    }

    if (projectOpenInProgressRef.current) {
      return;
    }

    if (!userId) {
      return;
    }

    void loadWorkspaceProjectsForUser(selectedWorkspaceId);
  }, [selectedSessionId, selectedWorkspaceId, userId]);

  useEffect(() => {
    if (!chatExecutionId || (chatRequestState !== 'queued' && chatRequestState !== 'running')) {
      return;
    }

    const pollTimer = setInterval(() => {
      void refreshChatExecutionStatus(chatExecutionId);
    }, CHAT_EXECUTION_POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollTimer);
    };
  }, [chatExecutionId, chatRequestState]);

  useEffect(() => {
    return () => {
      chatStreamRef.current?.close();
      chatStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!checkpointPinnedReferenceId) {
      return;
    }

    const isPinnedCheckpointPresent = checkpoints.some(
      (checkpoint) => checkpoint.id === checkpointPinnedReferenceId,
    );
    if (!isPinnedCheckpointPresent) {
      setCheckpointPinnedReferenceId(null);
    }
  }, [checkpoints, checkpointPinnedReferenceId]);

  useEffect(() => {
    setCommandInput('');
    setExecState({
      status: 'idle',
      result: null,
    });
    setBuildRequestState('idle');
    setBuildStatusMessage(null);
    setBuildOutput('');
    setBuildError(null);
  }, [selectedSessionId]);

  useEffect(() => {
    setChatPromptInput('');
    chatStreamRef.current?.close();
    chatStreamRef.current = null;
    pendingAssistantMessageIdRef.current = null;
    chatResponseTextRef.current = '';
    setChatResponseText('');
    setChatExecutionId(null);
    setChatStatusMessage(null);
    setChatError(null);
    setChatRequestState('idle');
    setChatExecutionFileActionStates({});
    executionSessionIdByExecutionIdRef.current = {};
    executionAssistantMessageIdByExecutionIdRef.current = {};
    executionFileActionsByExecutionIdRef.current = {};
    appliedFileActionsExecutionIdsRef.current = new Set<string>();
    pendingConfirmationExecutionIdsRef.current = new Set<string>();
    cancelledFileActionsExecutionIdsRef.current = new Set<string>();
    coheredExecutionIdsRef.current = new Set<string>();
    skipNextChatThreadPersistRef.current = true;

    if (!selectedSessionId) {
      setChatThreadMessages([]);
      return;
    }
    const restoredMessages = parseStoredChatThreadMessages(
      localStorage.getItem(getChatThreadStorageKey(selectedSessionId)),
    );
    setChatThreadMessages(restoredMessages);
    if (!userId) {
      return;
    }
    void (async () => {
      try {
        const backendMessages = await loadSessionChatMessagesFromBackend({
          sessionId: selectedSessionId,
        });
        if (selectedSessionIdRef.current !== selectedSessionId) {
          return;
        }
        if (backendMessages.length > 0 || restoredMessages.length === 0) {
          setChatThreadMessages(backendMessages);
        }
      } catch {
        // Keep localStorage-backed thread as fallback when backend load fails.
      }
    })();
  }, [selectedSessionId, userId]);

  useEffect(() => {
    if (!selectedSessionId) {
      return;
    }
    if (skipNextChatThreadPersistRef.current) {
      skipNextChatThreadPersistRef.current = false;
      return;
    }
    localStorage.setItem(
      getChatThreadStorageKey(selectedSessionId),
      JSON.stringify(chatThreadMessages),
    );
  }, [selectedSessionId, chatThreadMessages]);

  useEffect(() => {
    setChatThreadMessages((currentMessages) => {
      let didUpdate = false;
      const nextMessages = currentMessages.map((message) => {
        if (message.role !== 'assistant' || !message.executionId) {
          return message;
        }
        const nextFileActionState = chatExecutionFileActionStates[message.executionId];
        if (!nextFileActionState || message.fileActionState === nextFileActionState) {
          return message;
        }
        didUpdate = true;
        return {
          ...message,
          fileActionState: nextFileActionState,
        };
      });
      return didUpdate ? nextMessages : currentMessages;
    });
  }, [chatExecutionFileActionStates]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    if (!selectedSessionId) {
      setPreviewState('unavailable');
      setPreviewUrl(null);
      return;
    }

    void refreshPreviewForSession(selectedSessionId);
  }, [selectedSessionId, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    if (!selectedSessionId) {
      resetWorkspaceFileSurface();
      return;
    }

    if (projectOpenInProgressRef.current) {
      return;
    }

    if (skipNextSessionEffectFileReloadRef.current) {
      skipNextSessionEffectFileReloadRef.current = false;
      return;
    }

    void loadWorkspaceFilesForSession(selectedSessionId);
  }, [selectedSessionId, userId]);

  async function loadSessions(): Promise<WorkspaceShellSession[]> {
    setIsLoadingSessions(true);
    setSessionError(null);

    let data: WorkspaceShellSession[];
    try {
      let response: Response;
      try {
        response = await fetch('/api/sessions?includeTerminated=true', {
          method: 'GET',
        });
      } catch (fetchError) {
        const detail = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error('[WORKSPACE_BOOTSTRAP_FAIL_SESSIONS_FETCH]', detail);
        setSessionError(`[FETCH] ${detail}`);
        setSessions([]);
        setSelectedSessionId(null);
        setIsLoadingSessions(false);
        return [];
      }

      if (!response.ok) {
        if (response.status === 401) {
          handleWorkspaceUnauthorizedAccess();
          setIsLoadingSessions(false);
          return [];
        }
        console.error('[WORKSPACE_BOOTSTRAP_FAIL_SESSIONS_HTTP]', response.status, response.statusText);
        setSessionError(`[HTTP_${response.status}] ${response.statusText}`);
        setSessions([]);
        setSelectedSessionId(null);
        setIsLoadingSessions(false);
        return [];
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (parseError) {
        const detail = parseError instanceof Error ? parseError.message : String(parseError);
        console.error('[WORKSPACE_BOOTSTRAP_FAIL_SESSIONS_PARSE]', detail);
        setSessionError(`[PARSE] ${detail}`);
        setSessions([]);
        setSelectedSessionId(null);
        setIsLoadingSessions(false);
        return [];
      }

      data = Array.isArray(payload)
        ? (payload as WorkspaceShellSession[])
        : Array.isArray((payload as { value?: unknown } | null)?.value)
          ? ((payload as { value: WorkspaceShellSession[] }).value ?? [])
          : [];
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[WORKSPACE_BOOTSTRAP_FAIL_SESSIONS_UNEXPECTED]', detail);
      setSessionError(`[UNEXPECTED] ${detail}`);
      setSessions([]);
      setSelectedSessionId(null);
      setIsLoadingSessions(false);
      return [];
    }

    setSessions(data);
    setHiddenSessionIds((currentHiddenSessionIds) => {
      const nextHiddenSessionIds = currentHiddenSessionIds.filter((sessionId) =>
        data.some((session) => session.id === sessionId && !isUsableSession(session)),
      );
      localStorage.setItem(
        HIDDEN_UNUSABLE_SESSIONS_STORAGE_KEY,
        JSON.stringify(nextHiddenSessionIds),
      );
      return nextHiddenSessionIds;
    });
    setSelectedSessionId((currentSelection) => {
      if (currentSelection) {
        const currentSession = data.find((session) => session.id === currentSelection);
        if (currentSession && isUsableSession(currentSession)) {
          return currentSelection;
        }
      }

      const seededSessionId = PROJECT_FIRST_UX ? coldMountSeededSessionIdRef.current : null;
      coldMountSeededSessionIdRef.current = null;
      if (seededSessionId) {
        const seededSession = data.find((session) => session.id === seededSessionId);
        if (seededSession && isUsableSession(seededSession)) {
          return seededSessionId;
        }
      }

      const fallbackSession = data.find((session) => isUsableSession(session));
      return fallbackSession ? fallbackSession.id : null;
    });
    setIsLoadingSessions(false);
    return data;
  }

  function applyLoadedWorkspaces(
    loadedWorkspaces: Workspace[],
    preferredSelectedWorkspaceId?: string | null,
  ): void {
    setWorkspaces(loadedWorkspaces);
    setSelectedWorkspaceId((currentSelectedWorkspaceId) => {
      const seededWorkspaceId =
        preferredSelectedWorkspaceId === undefined && PROJECT_FIRST_UX
          ? coldMountSeededWorkspaceIdRef.current
          : null;
      coldMountSeededWorkspaceIdRef.current = null;
      return resolveSelectedWorkspaceId({
        workspaces: loadedWorkspaces,
        currentSelectedWorkspaceId:
          preferredSelectedWorkspaceId === undefined
            ? currentSelectedWorkspaceId
            : preferredSelectedWorkspaceId,
        seededWorkspaceId,
      });
    });
  }

  async function loadWorkspacesForUser(
    preferredSelectedWorkspaceId?: string | null,
  ): Promise<void> {
    setProjectActionError(null);
    try {
      const loadedWorkspaces = await loadWorkspaces({});
      applyLoadedWorkspaces(loadedWorkspaces, preferredSelectedWorkspaceId);
    } catch (error) {
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
      setWorkspaceRenameNameInput('');
      setWorkspaceProjects([]);
      setSelectedProjectId(null);
      setSelectedProjectVisibility('private');
      setProjectListState('error');
      setProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to load workspaces.',
      );
    }
  }

  async function handleCreateSession(): Promise<void> {
    if (!userId) {
      return;
    }

    setIsCreatingSession(true);
    setSessionCreateError(null);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
      });

      if (!response.ok) {
        if (response.status === 403) {
          setSessionCreateError('Session creation blocked by quota limits (403).');
          return;
        }
        throw new Error(`Session create failed (${response.status})`);
      }

      const createdSession = (await response.json()) as WorkspaceShellSession;
      await loadSessions();
      setSelectedSessionId(createdSession.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[WORKSPACE_BOOTSTRAP_FAIL_CREATE_SESSION]', detail);
      setSessionCreateError(detail);
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function handleStopSession(sessionId: string): Promise<void> {
    if (!userId) {
      return;
    }

    const targetSession = sessions.find((session) => session.id === sessionId);
    if (!targetSession || !isUsableSession(targetSession)) {
      return;
    }

    setSessionActionError(null);
    setStoppingSessionId(sessionId);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/stop`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Session stop failed (${response.status})`);
      }
      await loadSessions();
      await loadDashboardSlice();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setSessionActionError(detail);
    } finally {
      setStoppingSessionId((currentStoppingSessionId) =>
        currentStoppingSessionId === sessionId ? null : currentStoppingSessionId,
      );
    }
  }

  function handleRemoveSession(sessionId: string): void {
    const targetSession = sessions.find((session) => session.id === sessionId);
    if (!targetSession || isUsableSession(targetSession)) {
      return;
    }

    setSessionActionError(null);
    const nextHiddenSessionIds = hiddenSessionIds.includes(sessionId)
      ? hiddenSessionIds
      : [...hiddenSessionIds, sessionId];
    setHiddenSessionIds(nextHiddenSessionIds);
    localStorage.setItem(
      HIDDEN_UNUSABLE_SESSIONS_STORAGE_KEY,
      JSON.stringify(nextHiddenSessionIds),
    );
    setSelectedSessionId((currentSelection) => {
      if (currentSelection !== sessionId) {
        return currentSelection;
      }
      const fallbackSession = sessions.find(
        (session) =>
          session.id !== sessionId &&
          !nextHiddenSessionIds.includes(session.id) &&
          isUsableSession(session),
      );
      return fallbackSession ? fallbackSession.id : null;
    });
  }

  async function loadCheckpoints(sessionId: string): Promise<void> {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Checkpoint load failed (${response.status})`);
      }

      const data = (await response.json()) as WorkspaceCheckpoint[];
      setCheckpoints((currentCheckpoints) =>
        areCheckpointListsEqual(currentCheckpoints, data) ? currentCheckpoints : data,
      );
    } catch (error) {
      console.error('Failed to load checkpoints:', error);
      setHistoryError('Failed to load checkpoints.');
      setCheckpoints([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function loadWorkspaceSnapshotsForUser(): Promise<void> {
    setSnapshotListState('loading');
    setSnapshotActionError(null);
    try {
      const snapshots = await loadWorkspaceSnapshots({});
      setWorkspaceSnapshots(snapshots);
      setSelectedSnapshotId((currentSelectedSnapshotId) => {
        if (currentSelectedSnapshotId && snapshots.some((snapshot) => snapshot.id === currentSelectedSnapshotId)) {
          return currentSelectedSnapshotId;
        }
        return null;
      });
      setSnapshotListState('ready');
    } catch (error) {
      setWorkspaceSnapshots([]);
      setSelectedSnapshotId(null);
      setSnapshotListState('error');
      setSnapshotActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : PROJECT_FIRST_UX
            ? 'Failed to load project history.'
            : 'Failed to load workspace snapshots.',
      );
    }
  }

  async function loadWorkspaceProjectsForUser(
    workspaceId: string | null = selectedWorkspaceId,
    preserveSelectedProjectIdWhenMissing = false,
  ): Promise<void> {
    const normalizedWorkspaceId = workspaceId?.trim() ? workspaceId.trim() : null;
    if (!normalizedWorkspaceId) {
      setWorkspaceProjects([]);
      setSelectedProjectId(null);
      setSelectedProjectVisibility('private');
      setProjectListState('ready');
      return;
    }

    setProjectListState('loading');
    setProjectActionError(null);
    try {
      const projects = await loadWorkspaceProjects({ workspaceId: normalizedWorkspaceId });
      setWorkspaceProjects(projects);
      setSelectedProjectId((currentSelectedProjectId) => {
        if (currentSelectedProjectId && projects.some((project) => project.id === currentSelectedProjectId)) {
          return currentSelectedProjectId;
        }

        const seededProjectId = PROJECT_FIRST_UX ? coldMountSeededProjectIdRef.current : null;
        coldMountSeededProjectIdRef.current = null;
        if (seededProjectId && projects.some((project) => project.id === seededProjectId)) {
          return seededProjectId;
        }

        if (preserveSelectedProjectIdWhenMissing && currentSelectedProjectId) {
          return currentSelectedProjectId;
        }

        return projects.length > 0 ? projects[0].id : null;
      });
      setProjectListState('ready');
    } catch (error) {
      setWorkspaceProjects([]);
      setSelectedProjectId(null);
      setProjectListState('error');
      setProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to load projects.',
      );
    }
  }

  function handleProjectNameInputChange(value: string): void {
    setProjectNameInput(value);
    setProjectActionError(null);
    setProjectActionState('idle');
  }

  function handleProjectMoveTargetWorkspaceSelection(workspaceId: string): void {
    const normalizedWorkspaceId = workspaceId.trim() ? workspaceId.trim() : null;
    setProjectMoveTargetWorkspaceId(normalizedWorkspaceId);
    setProjectActionMessage(null);
    setProjectActionError(null);
    setProjectActionState('idle');
  }

  function handleWorkspaceCreateNameInputChange(value: string): void {
    setWorkspaceCreateNameInput(value);
    setWorkspaceActionError(null);
    setWorkspaceActionState('idle');
  }

  function handleWorkspaceRenameNameInputChange(value: string): void {
    setWorkspaceRenameNameInput(value);
    setWorkspaceActionError(null);
    setWorkspaceActionState('idle');
  }

  function handleProjectSelection(projectId: string): void {
    const normalizedProjectId = projectId.trim() ? projectId : null;
    setSelectedProjectId(normalizedProjectId);
    setProjectMoveTargetWorkspaceId(null);
    if (!normalizedProjectId) {
      setSelectedProjectVisibility('private');
      return;
    }
    const selected = workspaceProjects.find((project) => project.id === normalizedProjectId);
    setSelectedProjectVisibility(selected?.visibility === 'public' ? 'public' : 'private');
  }

  function handleProjectVisibilitySelection(visibility: 'private' | 'public'): void {
    setSelectedProjectVisibility(visibility);
  }

  function handleWorkspaceSelection(workspaceId: string): void {
    const normalizedWorkspaceId = workspaceId.trim() ? workspaceId.trim() : null;
    setSelectedWorkspaceId(normalizedWorkspaceId);
    setWorkspaceActionError(null);
    setWorkspaceActionState('idle');
    setProjectMoveTargetWorkspaceId(null);
    setSelectedProjectId(null);
    setSelectedProjectVisibility('private');
    setProjectActionState('idle');
    setProjectActionMessage(null);
    setProjectActionError(null);
  }

  async function handleCreateWorkspace(name: string): Promise<void> {
    if (!userId) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setWorkspaceActionError('Workspace name is required.');
      setWorkspaceActionState('idle');
      return;
    }

    setWorkspaceActionState('creating');
    setWorkspaceActionError(null);
    try {
      const createdWorkspace = await createWorkspace({
        name: trimmedName,
      });
      const loadedWorkspaces = await loadWorkspaces({});
      applyLoadedWorkspaces(loadedWorkspaces, createdWorkspace.id);
      setWorkspaceCreateNameInput('');
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to create workspace.',
      );
    } finally {
      setWorkspaceActionState('idle');
    }
  }

  async function handleRenameWorkspace(
    workspaceId: string | null,
    name: string,
  ): Promise<void> {
    if (!userId) {
      return;
    }

    const normalizedWorkspaceId =
      typeof workspaceId === 'string' && workspaceId.trim() ? workspaceId.trim() : null;
    if (!normalizedWorkspaceId) {
      setWorkspaceActionError('Select a workspace to rename.');
      setWorkspaceActionState('idle');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setWorkspaceActionError('Workspace name is required.');
      setWorkspaceActionState('idle');
      return;
    }

    setWorkspaceActionState('renaming');
    setWorkspaceActionError(null);
    try {
      await updateWorkspace({
        workspaceId: normalizedWorkspaceId,
        name: trimmedName,
      });
      const loadedWorkspaces = await loadWorkspaces({});
      applyLoadedWorkspaces(loadedWorkspaces, normalizedWorkspaceId);
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to rename workspace.',
      );
    } finally {
      setWorkspaceActionState('idle');
    }
  }

  async function handleDeleteWorkspace(workspaceId: string | null): Promise<void> {
    if (!userId) {
      return;
    }

    const normalizedWorkspaceId =
      typeof workspaceId === 'string' && workspaceId.trim() ? workspaceId.trim() : null;
    if (!normalizedWorkspaceId) {
      setWorkspaceActionError('Select a workspace to delete.');
      setWorkspaceActionState('idle');
      return;
    }

    const selectedWorkspace =
      workspaces.find((workspace) => workspace.id === normalizedWorkspaceId) ?? null;
    if (!selectedWorkspace) {
      setWorkspaceActionError('Selected workspace no longer exists.');
      setWorkspaceActionState('idle');
      return;
    }

    if (selectedWorkspace.isDefault) {
      setWorkspaceActionError('Default workspace cannot be deleted.');
      setWorkspaceActionState('idle');
      return;
    }

    setWorkspaceActionState('deleting');
    setWorkspaceActionError(null);
    try {
      await deleteWorkspace({
        workspaceId: normalizedWorkspaceId,
      });
      const loadedWorkspaces = await loadWorkspaces({});
      applyLoadedWorkspaces(loadedWorkspaces, null);
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to delete workspace.',
      );
    } finally {
      setWorkspaceActionState('idle');
    }
  }

  async function handleMoveWorkspaceProject(
    projectId: string | null,
    targetWorkspaceId: string | null,
  ): Promise<void> {
    if (!userId) {
      return;
    }

    const normalizedProjectId =
      typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null;
    if (!normalizedProjectId) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError('Select a project to move.');
      return;
    }

    const normalizedTargetWorkspaceId =
      typeof targetWorkspaceId === 'string' && targetWorkspaceId.trim()
        ? targetWorkspaceId.trim()
        : null;
    if (!normalizedTargetWorkspaceId) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError('Select a target workspace.');
      return;
    }

    const activeSession =
      sessionsRef.current.find((session) => session.id === selectedSessionIdRef.current) ?? null;
    const shouldPreserveSelectedProjectId = activeSession?.projectId === normalizedProjectId;

    setProjectActionState('moving');
    setProjectActionMessage(null);
    setProjectActionError(null);
    try {
      const movedProject = await moveWorkspaceProject({
        projectId: normalizedProjectId,
        targetWorkspaceId: normalizedTargetWorkspaceId,
      });
      await loadWorkspaceProjectsForUser(
        selectedWorkspaceId,
        shouldPreserveSelectedProjectId,
      );
      if (shouldPreserveSelectedProjectId) {
        setSelectedProjectId(normalizedProjectId);
        setSelectedProjectVisibility(movedProject.visibility === 'public' ? 'public' : 'private');
      }
      setProjectMoveTargetWorkspaceId(null);
      setProjectActionState('success');
      setProjectActionMessage('Project moved.');
      setProjectActionError(null);
    } catch (error) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to move project.',
      );
    }
  }

  async function handleCreateWorkspaceProject(): Promise<void> {
    if (!userId) {
      return;
    }
    const trimmedName = projectNameInput.trim();
    if (!trimmedName) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError('Project name is required.');
      return;
    }

    setProjectActionState('creating');
    setProjectActionMessage(null);
    setProjectActionError(null);
    try {
      const createdProject = await createWorkspaceProject({
        name: trimmedName,
        workspaceId: selectedWorkspaceId ?? undefined,
      });
      if (PROJECT_FIRST_UX) {
        setSelectedProjectId(createdProject.id);
        setSelectedProjectVisibility(createdProject.visibility === 'public' ? 'public' : 'private');
        projectOpenInProgressRef.current = true;
        try {
          const openResult = await openProjectInFreshSession({
            projectId: createdProject.id,
          });
          const openSessionId = openResult.sessionId;
          const expectsRestoredFiles = Boolean(openResult.restoredSnapshotId);

          skipNextSessionEffectFileReloadRef.current =
            openSessionId !== selectedSessionIdRef.current;
          setSelectedSessionId(openSessionId);

          await hydrateWorkspaceForProjectOpen(openSessionId, expectsRestoredFiles);

          await refreshPreviewForSession(openSessionId);
          await loadCheckpoints(openSessionId);
          await loadSessions();
          setSelectedSessionId((current) => current ?? openSessionId);

          await loadWorkspaceSnapshotsForUser();
          await loadWorkspaceProjectsForUser(
            createdProject.workspaceId ?? selectedWorkspaceId,
          );
          await loadPublicWorkspaceProjectsList();
          await loadDashboardSlice();

          setSelectedProjectId(createdProject.id);
          setSelectedProjectVisibility(createdProject.visibility === 'public' ? 'public' : 'private');
          setProjectNameInput('');
          setProjectActionState('success');
          setProjectActionMessage('Project created.');
          setProjectActionError(null);
          return;
        } finally {
          projectOpenInProgressRef.current = false;
          skipNextSessionEffectFileReloadRef.current = false;
        }
      }
      let createdInitialProjectSnapshot = false;
      if (selectedSessionId) {
        try {
          const currentWorkspaceTree = await loadWorkspaceFileTree({
            sessionId: selectedSessionId,
          });
          const firstWorkspaceFilePath = findFirstFilePath(currentWorkspaceTree);
          if (firstWorkspaceFilePath) {
            const initialProjectSnapshot = await saveWorkspaceSnapshot({
              sessionId: selectedSessionId,
              label: buildProjectScopedSnapshotLabel(createdProject.id, 'initial'),
            });
            createdInitialProjectSnapshot = true;
            await loadWorkspaceSnapshotsForUser();
            setSelectedSnapshotId(initialProjectSnapshot.id);
          }
        } catch (error) {
          // Project creation must stay successful even if initial snapshot automation fails.
          console.error('Failed to auto-save initial project snapshot:', error);
        }
      }
      await loadWorkspaceProjectsForUser(
        createdProject.workspaceId ?? selectedWorkspaceId,
      );
      setSelectedProjectId(createdProject.id);
      setSelectedProjectVisibility(createdProject.visibility === 'public' ? 'public' : 'private');
      setProjectNameInput('');
      setProjectActionState('success');
      setProjectActionMessage(
        createdInitialProjectSnapshot
          ? 'Project created with initial snapshot.'
          : 'Project created.',
      );
      setProjectActionError(null);
    } catch (error) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to create project.',
      );
    }
  }

  async function hydrateWorkspaceForProjectOpen(
    openSessionId: string,
    expectFiles: boolean,
  ): Promise<boolean> {
    let loaded = await loadWorkspaceFilesForSession(openSessionId);
    if (!loaded && expectFiles) {
      for (let attempt = 0; attempt < PROJECT_OPEN_FILE_REFRESH_MAX_ATTEMPTS; attempt += 1) {
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), PROJECT_OPEN_FILE_REFRESH_RETRY_DELAY_MS);
        });
        loaded = await loadWorkspaceFilesForSession(openSessionId);
        if (loaded) {
          break;
        }
      }
    }
    return loaded;
  }

  async function handleOpenWorkspaceProject(): Promise<void> {
    if (!userId) {
      return;
    }
    if (PROJECT_FIRST_UX) {
      if (!selectedProjectId) {
        setProjectActionState('error');
        setProjectActionMessage(null);
        setProjectActionError('Select a project to open.');
        return;
      }
    } else if (!selectedSessionId || !selectedProjectId) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError('Select both an active session and a project.');
      return;
    }

    setProjectActionState('opening');
    setProjectActionMessage(null);
    setProjectActionError(null);
    projectOpenInProgressRef.current = true;
    try {
      const selectedSnapshotIdToOpen = selectedSnapshotId?.trim() || undefined;
      if (PROJECT_FIRST_UX) {
        const refreshedSessions = await loadSessions();
        const openResult = await openProjectInFreshSession({
          projectId: selectedProjectId,
          existingSessions: refreshedSessions,
          snapshotId: selectedSnapshotIdToOpen,
        });
        const openSessionId = openResult.sessionId;
        const expectsRestoredFiles = Boolean(openResult.restoredSnapshotId);

        skipNextSessionEffectFileReloadRef.current =
          openSessionId !== selectedSessionIdRef.current;
        setSelectedSessionId(openSessionId);

        await hydrateWorkspaceForProjectOpen(openSessionId, expectsRestoredFiles);

        await refreshPreviewForSession(openSessionId);
        await loadCheckpoints(openSessionId);
        await loadSessions();
        setSelectedSessionId((current) => current ?? openSessionId);

        await loadWorkspaceSnapshotsForUser();
        await loadWorkspaceProjectsForUser();
        await loadPublicWorkspaceProjectsList();
        await loadDashboardSlice();

        setProjectActionState('success');
        setProjectActionMessage('Project opened.');
        setProjectActionError(null);
        return;
      }

      let snapshotIdToOpen: string | undefined = selectedSnapshotIdToOpen;
      if (!snapshotIdToOpen) {
        const freshSnapshots = await loadWorkspaceSnapshots({});
        setWorkspaceSnapshots(freshSnapshots);
        snapshotIdToOpen =
          resolveProjectScopedLatestSnapshotId({ snapshots: freshSnapshots, projectId: selectedProjectId }) ?? undefined;
      }

      let openResult: { projectId: string; sessionId: string; restoredSnapshotId: string | null };
      if (snapshotIdToOpen) {
        openResult = await openWorkspaceProject({
          projectId: selectedProjectId,
          sessionId: selectedSessionId!,
          snapshotId: snapshotIdToOpen,
        });
      } else {
        await associateWorkspaceProjectSession({
          projectId: selectedProjectId,
          sessionId: selectedSessionId!,
        });
        openResult = {
          projectId: selectedProjectId,
          sessionId: selectedSessionId!,
          restoredSnapshotId: null,
        };
      }

      const openSessionId = openResult.sessionId;
      const expectsRestoredFiles = Boolean(openResult.restoredSnapshotId);

      skipNextSessionEffectFileReloadRef.current =
        openSessionId !== selectedSessionIdRef.current;
      setSelectedSessionId(openSessionId);

      await hydrateWorkspaceForProjectOpen(openSessionId, expectsRestoredFiles);

      await refreshPreviewForSession(openSessionId);
      await loadCheckpoints(openSessionId);
      await loadSessions();
      setSelectedSessionId((current) => current ?? openSessionId);

      await loadWorkspaceSnapshotsForUser();
      await loadWorkspaceProjectsForUser();
      await loadPublicWorkspaceProjectsList();
      await loadDashboardSlice();

      setProjectActionState('success');
      setProjectActionMessage('Project opened in selected session.');
      setProjectActionError(null);
    } catch (error) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to open project.',
      );
    } finally {
      projectOpenInProgressRef.current = false;
      skipNextSessionEffectFileReloadRef.current = false;
    }
  }

  async function handleResumeWorkspaceProjectById(projectId: string): Promise<void> {
    if (!PROJECT_FIRST_UX) {
      return;
    }

    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return;
    }

    if (!userId) {
      return;
    }

    setProjectActionState('opening');
    setProjectActionMessage(null);
    setProjectActionError(null);
    projectOpenInProgressRef.current = true;
    try {
      const refreshedSessions = await loadSessions();
      const openResult = await openProjectInFreshSession({
        projectId: normalizedProjectId,
        existingSessions: refreshedSessions,
      });
      const openSessionId = openResult.sessionId;
      const expectsRestoredFiles = Boolean(openResult.restoredSnapshotId);

      skipNextSessionEffectFileReloadRef.current =
        openSessionId !== selectedSessionIdRef.current;
      setSelectedSessionId(openSessionId);

      await hydrateWorkspaceForProjectOpen(openSessionId, expectsRestoredFiles);

      await refreshPreviewForSession(openSessionId);
      await loadCheckpoints(openSessionId);
      await loadSessions();
      setSelectedSessionId((current) => current ?? openSessionId);

      await loadWorkspaceSnapshotsForUser();
      await loadWorkspaceProjectsForUser();
      await loadPublicWorkspaceProjectsList();
      await loadDashboardSlice();

      setProjectActionState('success');
      setProjectActionMessage('Project opened.');
      setProjectActionError(null);
    } catch (error) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to open project.',
      );
    } finally {
      projectOpenInProgressRef.current = false;
      skipNextSessionEffectFileReloadRef.current = false;
    }
  }

  async function handleRestoreWorkspaceProjectFromSnapshotById(
    projectId: string,
    snapshotId: string,
  ): Promise<void> {
    if (!PROJECT_FIRST_UX) {
      return;
    }

    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return;
    }

    const normalizedSnapshotId = snapshotId.trim();
    if (!normalizedSnapshotId) {
      return;
    }

    if (!userId) {
      return;
    }

    setProjectActionState('opening');
    setProjectActionMessage(null);
    setProjectActionError(null);
    projectOpenInProgressRef.current = true;
    try {
      const openResult = await openProjectInFreshSession({
        projectId: normalizedProjectId,
        snapshotId: normalizedSnapshotId,
      });
      const openSessionId = openResult.sessionId;
      const expectsRestoredFiles = Boolean(openResult.restoredSnapshotId);

      skipNextSessionEffectFileReloadRef.current =
        openSessionId !== selectedSessionIdRef.current;
      setSelectedSessionId(openSessionId);

      await hydrateWorkspaceForProjectOpen(openSessionId, expectsRestoredFiles);

      await refreshPreviewForSession(openSessionId);
      await loadCheckpoints(openSessionId);
      await loadSessions();
      setSelectedSessionId((current) => current ?? openSessionId);

      await loadWorkspaceSnapshotsForUser();
      await loadWorkspaceProjectsForUser();
      await loadPublicWorkspaceProjectsList();
      await loadDashboardSlice();

      setProjectActionState('success');
      setProjectActionMessage('Project opened.');
      setProjectActionError(null);
    } catch (error) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to open project.',
      );
    } finally {
      projectOpenInProgressRef.current = false;
      skipNextSessionEffectFileReloadRef.current = false;
    }
  }

  async function handleSaveNamedProjectSnapshot(name: string): Promise<void> {
    if (!PROJECT_FIRST_UX) {
      return;
    }

    if (!userId) {
      return;
    }

    if (!selectedProjectId) {
      return;
    }

    if (!selectedSessionId) {
      return;
    }

    if (projectOpenInProgressRef.current) {
      return;
    }

    const saveResult = await attemptNamedProjectSave({
      sessionId: selectedSessionId,
      projectId: selectedProjectId,
      name,
    });
    if (saveResult.status === 'failed') {
      console.error('Failed to save named project snapshot.');
      return;
    }

    void loadWorkspaceSnapshotsForUser();
  }

  async function handleUpdateWorkspaceProjectVisibility(): Promise<void> {
    if (!userId) {
      return;
    }
    if (!selectedProjectId) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError('Select a project.');
      return;
    }
    setProjectActionState('opening');
    setProjectActionMessage(null);
    setProjectActionError(null);
    try {
      const updatedProject = await updateWorkspaceProjectVisibility({
        projectId: selectedProjectId,
        visibility: selectedProjectVisibility,
      });
      setSelectedProjectVisibility(updatedProject.visibility === 'public' ? 'public' : 'private');
      await loadWorkspaceProjectsForUser();
      await loadPublicWorkspaceProjectsList();
      setProjectActionState('success');
      setProjectActionMessage(`Project visibility set to ${updatedProject.visibility}.`);
    } catch (error) {
      setProjectActionState('error');
      setProjectActionMessage(null);
      setProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to update project visibility.',
      );
    }
  }

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProjectVisibility('private');
      return;
    }
    const selectedProject = workspaceProjects.find((project) => project.id === selectedProjectId);
    if (selectedProject) {
      setSelectedProjectVisibility(
        selectedProject.visibility === 'public' ? 'public' : 'private',
      );
    }
  }, [selectedProjectId, workspaceProjects]);

  async function loadPublicWorkspaceProjectsList(): Promise<void> {
    setPublicProjectListState('loading');
    setPublicProjectActionError(null);
    try {
      const projects = await loadPublicWorkspaceProjects();
      setPublicWorkspaceProjects(projects);
      setSelectedPublicProjectId((current) => {
        if (current && projects.some((project) => project.id === current)) {
          return current;
        }
        return projects.length > 0 ? projects[0].id : null;
      });
      setPublicProjectListState('ready');
    } catch (error) {
      setPublicWorkspaceProjects([]);
      setSelectedPublicProjectId(null);
      setPublicProjectListState('error');
      setPublicProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to load public projects.',
      );
    }
  }

  function handleSelectPublicProject(projectId: string): void {
    setSelectedPublicProjectId(projectId.trim() ? projectId : null);
  }

  async function handleViewPublicWorkspaceProject(): Promise<void> {
    if (!selectedPublicProjectId) {
      setPublicProjectActionState('error');
      setPublicProjectActionMessage(null);
      setPublicProjectActionError('Select a public project.');
      return;
    }
    setPublicProjectActionState('viewing');
    setPublicProjectActionMessage(null);
    setPublicProjectActionError(null);
    try {
      const detail = await loadPublicWorkspaceProjectDetail({
        projectId: selectedPublicProjectId,
      });
      setSelectedPublicProjectDetail(detail);
      setPublicProjectActionState('success');
      setPublicProjectActionMessage('Loaded read-only public project view.');
    } catch (error) {
      setPublicProjectActionState('error');
      setPublicProjectActionMessage(null);
      setPublicProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to load public project.',
      );
    }
  }

  async function handleForkPublicWorkspaceProject(): Promise<void> {
    if (!userId) {
      return;
    }
    if (!selectedPublicProjectId) {
      setPublicProjectActionState('error');
      setPublicProjectActionMessage(null);
      setPublicProjectActionError('Select a public project.');
      return;
    }
    setPublicProjectActionState('forking');
    setPublicProjectActionMessage(null);
    setPublicProjectActionError(null);
    try {
      const forked = await forkPublicWorkspaceProject({
        projectId: selectedPublicProjectId,
      });
      await loadWorkspaceProjectsForUser();
      setSelectedProjectId(forked.id);
      setSelectedProjectVisibility('private');
      setPublicProjectActionState('success');
      setPublicProjectActionMessage('Project forked to your private project list.');
      setPublicProjectActionError(null);
    } catch (error) {
      setPublicProjectActionState('error');
      setPublicProjectActionMessage(null);
      setPublicProjectActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to fork project.',
      );
    }
  }

  function handleCheckpointDescriptionChange(value: string): void {
    setCheckpointDescriptionInput(value);
    setCheckpointCreateError(null);
    setCheckpointCreateState('idle');
  }

  async function handleCreateManualCheckpoint(): Promise<void> {
    if (!userId) {
      return;
    }

    if (!selectedSessionId || !userId) {
      setCheckpointCreateState('create-error');
      setCheckpointCreateError('Cannot create a save point without an active session.');
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointCreateState('create-error');
      setCheckpointCreateError('Cannot create a save point for a terminated session.');
      return;
    }

    const requestId = checkpointCreateRequestIdRef.current + 1;
    checkpointCreateRequestIdRef.current = requestId;
    setCheckpointCreateState('creating');
    setCheckpointCreateError(null);

    try {
      const createResult: WorkspaceCheckpointCreateResult = await createWorkspaceCheckpoint({
        sessionId: selectedSessionId,
        userId,
        description: checkpointDescriptionInput,
      });

      if (checkpointCreateRequestIdRef.current !== requestId) {
        return;
      }

      if (!createResult.commitHash) {
        setCheckpointCreateState('create-error');
        setCheckpointCreateError('No file changes detected. Save point was not created.');
        return;
      }
      const createdCommitHash = createResult.commitHash;

      setCheckpointCreateState('created');
      await loadCheckpoints(selectedSessionId);
      setCheckpoints((prev) => {
        if (prev.some((cp) => cp.commitHash === createdCommitHash)) {
          return prev;
        }
        return [
          {
            id: createdCommitHash,
            commitHash: createdCommitHash,
            messageNumber: 0,
            description: checkpointDescriptionInput.trim() || null,
            filesChanged: createResult.filesChanged ?? 0,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });
    } catch (error) {
      console.error('Failed to create manual checkpoint:', error);
      // #region agent log
      fetch('http://127.0.0.1:7870/ingest/eba94f28-6765-4a01-9905-123e592de80f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8262b1'},body:JSON.stringify({sessionId:'8262b1',runId:'save-point-pre-fix',hypothesisId:'SP4',location:'frontend/app/[locale]/app/page.tsx:handleCreateManualCheckpoint',message:'manual checkpoint catch path hit',data:{errorMessage:error instanceof Error ? error.message : String(error),selectedSessionId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (checkpointCreateRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointCreateState('create-error');
      setCheckpointCreateError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to create save point.',
      );
    }
  }

  function handleSnapshotSelection(snapshotId: string): void {
    setSelectedSnapshotId(snapshotId.trim() ? snapshotId : null);
  }

  async function handleSaveWorkspaceSnapshot(): Promise<void> {
    if (!userId) {
      return;
    }
    if (!selectedSessionId) {
      setSnapshotActionState('error');
      setSnapshotActionMessage(null);
      setSnapshotActionError('Cannot save snapshot without an active session.');
      return;
    }

    setSnapshotActionState('saving');
    setSnapshotActionMessage(null);
    setSnapshotActionError(null);
    try {
      const savedSnapshot = await saveWorkspaceSnapshot({
        sessionId: selectedSessionId,
        label: selectedProjectId ? buildProjectScopedSnapshotLabel(selectedProjectId) : undefined,
      });
      await loadWorkspaceSnapshotsForUser();
      setSelectedSnapshotId(savedSnapshot.id);
      setSnapshotActionState('success');
      setSnapshotActionMessage('Workspace snapshot saved.');
      setSnapshotActionError(null);
    } catch (error) {
      setSnapshotActionState('error');
      setSnapshotActionMessage(null);
      setSnapshotActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to save workspace snapshot.',
      );
    }
  }

  async function handleRestoreWorkspaceSnapshot(): Promise<void> {
    if (!userId) {
      return;
    }
    if (!selectedSessionId || !selectedSnapshotId) {
      setSnapshotActionState('error');
      setSnapshotActionMessage(null);
      setSnapshotActionError('Select a snapshot to restore.');
      return;
    }

    setSnapshotActionState('restoring');
    setSnapshotActionMessage(null);
    setSnapshotActionError(null);
    try {
      await restoreWorkspaceSnapshot({
        sessionId: selectedSessionId,
        snapshotId: selectedSnapshotId,
      });
      await loadWorkspaceFilesForSession(selectedSessionId);
      await refreshPreviewForSession(selectedSessionId);
      await loadCheckpoints(selectedSessionId);
      await loadWorkspaceSnapshotsForUser();
      setSnapshotActionState('success');
      setSnapshotActionMessage('Workspace snapshot restored.');
      setSnapshotActionError(null);
    } catch (error) {
      setSnapshotActionState('error');
      setSnapshotActionMessage(null);
      setSnapshotActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to restore workspace snapshot.',
      );
    }
  }

  async function handleExportWorkspaceArchive(): Promise<void> {
    if (!userId) {
      return;
    }
    if (!selectedSessionId) {
      setSnapshotActionState('error');
      setSnapshotActionMessage(null);
      setSnapshotActionError('Cannot export without an active session.');
      return;
    }

    setSnapshotActionState('exporting');
    setSnapshotActionMessage(null);
    setSnapshotActionError(null);
    try {
      const blob = await exportWorkspaceArchive({
        sessionId: selectedSessionId,
      });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `session-${selectedSessionId}-workspace.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setSnapshotActionState('success');
      setSnapshotActionMessage('Workspace archive downloaded.');
      setSnapshotActionError(null);
    } catch (error) {
      setSnapshotActionState('error');
      setSnapshotActionMessage(null);
      setSnapshotActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to export workspace archive.',
      );
    }
  }

  async function handleImportWorkspaceArchive(file: File): Promise<void> {
    if (!userId) {
      return;
    }
    if (!selectedSessionId) {
      setSnapshotActionState('error');
      setSnapshotActionMessage(null);
      setSnapshotActionError('Cannot import without an active session.');
      return;
    }

    setSnapshotActionState('importing');
    setSnapshotActionMessage(null);
    setSnapshotActionError(null);
    try {
      await importWorkspaceArchive({
        sessionId: selectedSessionId,
        archiveFile: file,
      });
      await loadWorkspaceFilesForSession(selectedSessionId);
      await refreshPreviewForSession(selectedSessionId);
      await loadCheckpoints(selectedSessionId);
      setSnapshotActionState('success');
      setSnapshotActionMessage('Workspace archive imported.');
      setSnapshotActionError(null);
    } catch (error) {
      setSnapshotActionState('error');
      setSnapshotActionMessage(null);
      setSnapshotActionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to import workspace archive.',
      );
    }
  }

  function handleInitiateCheckpointRevert(checkpointId: string): void {
    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSessionId || !selectedSession || selectedSession.terminatedAt) {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Cannot revert without an active session.');
      setCheckpointRevertTargetId(null);
      return;
    }

    if (!checkpoints.some((checkpoint) => checkpoint.id === checkpointId)) {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Selected checkpoint is no longer available.');
      setCheckpointRevertTargetId(null);
      return;
    }

    setCheckpointRevertTargetId(checkpointId);
    setCheckpointRevertError(null);
    setCheckpointRevertState('previewing');
  }

  function handleAdvanceCheckpointRevertPreview(): void {
    if (checkpointRevertState !== 'previewing' || !checkpointRevertTargetId) {
      return;
    }
    setCheckpointRevertError(null);
    setCheckpointRevertState('confirming');
  }

  function handleCancelCheckpointRevert(): void {
    if (checkpointRevertState === 'reverting') {
      return;
    }
    setCheckpointRevertTargetId(null);
    setCheckpointRevertError(null);
    setCheckpointRevertState('idle');
  }

  async function handleConfirmCheckpointRevert(): Promise<void> {
    if (!userId) {
      return;
    }

    if (!selectedSessionId || !userId || !checkpointRevertTargetId) {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Cannot revert without an active session and selected checkpoint.');
      return;
    }
    if (checkpointRevertState !== 'confirming') {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Revert confirmation step is required before submission.');
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Cannot revert a terminated session.');
      return;
    }

    const targetCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === checkpointRevertTargetId);
    if (!targetCheckpoint) {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Selected checkpoint is no longer available.');
      setCheckpointRevertTargetId(null);
      return;
    }

    const requestId = checkpointRevertRequestIdRef.current + 1;
    checkpointRevertRequestIdRef.current = requestId;
    const sessionId = selectedSessionId;
    setCheckpointRevertState('reverting');
    setCheckpointRevertError(null);

    try {
      await revertWorkspaceCheckpoint({
        sessionId,
        userId,
        commitHash: targetCheckpoint.commitHash,
      });

      if (checkpointRevertRequestIdRef.current !== requestId) {
        return;
      }

      await loadCheckpoints(sessionId);
      if (checkpointRevertRequestIdRef.current !== requestId) {
        return;
      }

      await loadWorkspaceFilesForSession(sessionId);
      if (checkpointRevertRequestIdRef.current !== requestId) {
        return;
      }

      await refreshPreviewForSession(sessionId);
      if (checkpointRevertRequestIdRef.current !== requestId) {
        return;
      }

      setCheckpointRevertState('reverted');
      setCheckpointRevertError(null);
      setCheckpointRevertTargetId(null);
    } catch (error) {
      console.error('Failed to revert checkpoint:', error);
      if (checkpointRevertRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Failed to revert workspace to selected checkpoint.');
    }
  }

  async function handleViewCheckpointDiff(checkpointId: string): Promise<void> {
    if (!userId) {
      return;
    }

    if (!selectedSessionId) {
      setCheckpointDiffState('diff-error');
      setCheckpointDiffError('Cannot load diff without an active session.');
      setCheckpointDiffTargetId(null);
      setCheckpointDiffResponse(null);
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointDiffState('diff-error');
      setCheckpointDiffError('Cannot load diff for a terminated session.');
      setCheckpointDiffTargetId(null);
      setCheckpointDiffResponse(null);
      return;
    }

    const targetCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
    if (!targetCheckpoint) {
      setCheckpointDiffState('diff-error');
      setCheckpointDiffError('Selected checkpoint is no longer available.');
      setCheckpointDiffTargetId(null);
      setCheckpointDiffResponse(null);
      return;
    }

    const requestId = checkpointDiffRequestIdRef.current + 1;
    checkpointDiffRequestIdRef.current = requestId;
    const sessionId = selectedSessionId;
    setCheckpointDiffState('loading');
    setCheckpointDiffError(null);
    setCheckpointDiffTargetId(checkpointId);
    setCheckpointDiffResponse(null);

    try {
      const response = await loadWorkspaceCheckpointDiff({
        sessionId,
        commitHash: targetCheckpoint.commitHash,
      });

      if (checkpointDiffRequestIdRef.current !== requestId) {
        return;
      }

      if (!response.files.length) {
        setCheckpointDiffState('empty');
        setCheckpointDiffError(null);
        setCheckpointDiffResponse(response);
        return;
      }

      setCheckpointDiffState('ready');
      setCheckpointDiffError(null);
      setCheckpointDiffResponse(response);
    } catch (error) {
      console.error('Failed to load checkpoint diff:', error);
      if (checkpointDiffRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointDiffState('diff-error');
      setCheckpointDiffError('Failed to load checkpoint diff.');
      setCheckpointDiffResponse(null);
    }
  }

  async function handleViewCheckpointSnapshot(checkpointId: string): Promise<void> {
    if (!userId) {
      return;
    }

    if (!selectedSessionId) {
      setCheckpointSnapshotState('snapshot-error');
      setCheckpointSnapshotError('Cannot load snapshot without an active session.');
      setCheckpointSnapshotTargetId(null);
      setCheckpointSnapshotResponse(null);
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointSnapshotState('snapshot-error');
      setCheckpointSnapshotError('Cannot load snapshot for a terminated session.');
      setCheckpointSnapshotTargetId(null);
      setCheckpointSnapshotResponse(null);
      return;
    }

    const targetCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
    if (!targetCheckpoint) {
      setCheckpointSnapshotState('snapshot-error');
      setCheckpointSnapshotError('Selected checkpoint is no longer available.');
      setCheckpointSnapshotTargetId(null);
      setCheckpointSnapshotResponse(null);
      return;
    }

    const requestId = checkpointSnapshotRequestIdRef.current + 1;
    checkpointSnapshotRequestIdRef.current = requestId;
    const sessionId = selectedSessionId;
    setCheckpointSnapshotState('loading');
    setCheckpointSnapshotError(null);
    setCheckpointSnapshotTargetId(checkpointId);
    setCheckpointSnapshotResponse(null);

    try {
      const response = await loadWorkspaceCheckpointDiff({
        sessionId,
        commitHash: targetCheckpoint.commitHash,
      });

      if (checkpointSnapshotRequestIdRef.current !== requestId) {
        return;
      }

      if (!response.files.length) {
        setCheckpointSnapshotState('empty');
        setCheckpointSnapshotError(null);
        setCheckpointSnapshotResponse(response);
        return;
      }

      setCheckpointSnapshotState('ready');
      setCheckpointSnapshotError(null);
      setCheckpointSnapshotResponse(response);
    } catch (error) {
      console.error('Failed to load checkpoint snapshot:', error);
      if (checkpointSnapshotRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointSnapshotState('snapshot-error');
      setCheckpointSnapshotError('Failed to load checkpoint snapshot.');
      setCheckpointSnapshotResponse(null);
    }
  }

  function workspaceTreeContainsFilePath(nodes: WorkspaceFileNode[], filePath: string): boolean {
    for (const node of nodes) {
      if (node.type === 'file' && node.path === filePath) {
        return true;
      }
      if (node.children.length && workspaceTreeContainsFilePath(node.children, filePath)) {
        return true;
      }
    }
    return false;
  }

  function canOpenCheckpointFileInLiveWorkspace(filePath: string): boolean {
    const normalizedPath = filePath.trim();
    if (!normalizedPath || !selectedSessionId || fileSurfaceState !== 'ready') {
      return false;
    }
    return workspaceTreeContainsFilePath(workspaceFileTree, normalizedPath);
  }

  async function handleOpenCheckpointFileInLiveWorkspace(filePath: string): Promise<void> {
    if (!userId) {
      return;
    }

    const normalizedPath = filePath.trim();
    if (!normalizedPath) {
      setCheckpointLiveOpenState('open-error');
      setCheckpointLiveOpenError('Cannot open an empty file path.');
      setCheckpointLiveOpenTargetPath(null);
      return;
    }

    if (!selectedSessionId) {
      setCheckpointLiveOpenState('open-error');
      setCheckpointLiveOpenError('Cannot open live workspace file without an active session.');
      setCheckpointLiveOpenTargetPath(normalizedPath);
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointLiveOpenState('open-error');
      setCheckpointLiveOpenError('Cannot open live workspace file for a terminated session.');
      setCheckpointLiveOpenTargetPath(normalizedPath);
      return;
    }

    if (fileSurfaceState !== 'ready') {
      setCheckpointLiveOpenState('open-error');
      setCheckpointLiveOpenError('Live workspace file tree is not ready.');
      setCheckpointLiveOpenTargetPath(normalizedPath);
      return;
    }

    if (!workspaceTreeContainsFilePath(workspaceFileTree, normalizedPath)) {
      setCheckpointLiveOpenState('missing');
      setCheckpointLiveOpenError(null);
      setCheckpointLiveOpenTargetPath(normalizedPath);
      return;
    }

    const requestId = checkpointLiveOpenRequestIdRef.current + 1;
    checkpointLiveOpenRequestIdRef.current = requestId;
    const sessionId = selectedSessionId;
    setCheckpointLiveOpenState('opening');
    setCheckpointLiveOpenError(null);
    setCheckpointLiveOpenTargetPath(normalizedPath);

    try {
      const opened = await loadWorkspaceFileContent(sessionId, normalizedPath);

      if (checkpointLiveOpenRequestIdRef.current !== requestId) {
        return;
      }

      if (!opened) {
        setCheckpointLiveOpenState('open-error');
        setCheckpointLiveOpenError('Failed to open selected file in live workspace.');
        setCheckpointLiveOpenTargetPath(normalizedPath);
        return;
      }

      setCheckpointLiveOpenState('opened');
      setCheckpointLiveOpenError(null);
      setCheckpointLiveOpenTargetPath(normalizedPath);
    } catch (error) {
      console.error('Failed to open history file in live workspace:', error);
      if (checkpointLiveOpenRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointLiveOpenState('open-error');
      setCheckpointLiveOpenError('Failed to open selected file in live workspace.');
      setCheckpointLiveOpenTargetPath(normalizedPath);
    }
  }

  function handleStartCheckpointCompare(): void {
    if (!selectedSessionId) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Select an active session to compare checkpoints.');
      setCheckpointCompareBaseId(null);
      setCheckpointCompareTargetId(null);
      setCheckpointCompareResponse(null);
      return;
    }

    setCheckpointCompareState('selecting');
    setCheckpointCompareError(null);
    setCheckpointCompareBaseId(null);
    setCheckpointCompareTargetId(null);
    setCheckpointCompareResponse(null);
  }

  function handleCancelCheckpointCompare(): void {
    if (checkpointCompareState === 'loading') {
      return;
    }

    setCheckpointCompareState('idle');
    setCheckpointCompareError(null);
    setCheckpointCompareBaseId(null);
    setCheckpointCompareTargetId(null);
    setCheckpointCompareResponse(null);
  }

  function handleSelectCheckpointCompareBase(checkpointId: string): void {
    if (checkpointCompareState === 'loading') {
      return;
    }
    setCheckpointCompareState('selecting');
    setCheckpointCompareError(null);
    setCheckpointCompareResponse(null);
    setCheckpointCompareBaseId(checkpointId);
  }

  function handleSelectCheckpointCompareTarget(checkpointId: string): void {
    if (checkpointCompareState === 'loading') {
      return;
    }
    setCheckpointCompareState('selecting');
    setCheckpointCompareError(null);
    setCheckpointCompareResponse(null);
    setCheckpointCompareTargetId(checkpointId);
  }

  async function handleRunCheckpointCompare(): Promise<void> {
    if (!userId) {
      return;
    }

    if (!selectedSessionId) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Cannot compare checkpoints without an active session.');
      setCheckpointCompareResponse(null);
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Cannot compare checkpoints for a terminated session.');
      setCheckpointCompareResponse(null);
      return;
    }

    if (!checkpointCompareBaseId || !checkpointCompareTargetId) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Select both base and target checkpoints to compare.');
      setCheckpointCompareResponse(null);
      return;
    }

    if (checkpointCompareBaseId === checkpointCompareTargetId) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Base and target checkpoints must be different.');
      setCheckpointCompareResponse(null);
      return;
    }

    const baseCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === checkpointCompareBaseId);
    const targetCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === checkpointCompareTargetId);
    if (!baseCheckpoint || !targetCheckpoint) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Selected checkpoint pair is no longer available.');
      setCheckpointCompareResponse(null);
      return;
    }

    const requestId = checkpointCompareRequestIdRef.current + 1;
    checkpointCompareRequestIdRef.current = requestId;
    const sessionId = selectedSessionId;
    setCheckpointCompareState('loading');
    setCheckpointCompareError(null);
    setCheckpointCompareResponse(null);

    try {
      const response = await loadWorkspaceCheckpointDiff({
        sessionId,
        commitHash: targetCheckpoint.commitHash,
      });

      if (checkpointCompareRequestIdRef.current !== requestId) {
        return;
      }

      if (response.parentHash !== baseCheckpoint.commitHash) {
        setCheckpointCompareState('compare-error');
        setCheckpointCompareError(
          'Selected pair is not directly comparable. Choose a target checkpoint whose parent matches the selected base checkpoint.',
        );
        setCheckpointCompareResponse(null);
        return;
      }

      setCheckpointCompareState('ready');
      setCheckpointCompareError(null);
      setCheckpointCompareResponse(response);
    } catch (error) {
      console.error('Failed to compare checkpoints:', error);
      if (checkpointCompareRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Failed to compare selected checkpoints.');
      setCheckpointCompareResponse(null);
    }
  }

  function handlePinCheckpointCompareReference(checkpointId: string): void {
    if (!selectedSessionId) {
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      return;
    }

    if (!checkpoints.some((checkpoint) => checkpoint.id === checkpointId)) {
      return;
    }

    setCheckpointPinnedReferenceId(checkpointId);
  }

  function handleClearPinnedCheckpointCompareReference(): void {
    setCheckpointPinnedReferenceId(null);
  }

  async function loadDashboardSlice(): Promise<void> {
    setIsLoadingDashboard(true);
    setDashboardError(null);

    try {
      const [userResponse, usageResponse, quotasResponse] = await Promise.all([
        fetch('/api/users/me', {
          method: 'GET',
        }),
        fetch('/api/users/me/usage', {
          method: 'GET',
        }),
        fetch('/api/users/me/quotas', {
          method: 'GET',
        }),
      ]);

      if (!userResponse.ok || !usageResponse.ok || !quotasResponse.ok) {
        if (
          userResponse.status === 401 ||
          usageResponse.status === 401 ||
          quotasResponse.status === 401
        ) {
          handleWorkspaceUnauthorizedAccess();
          return;
        }
        throw new Error(
          `Dashboard load failed (${userResponse.status}/${usageResponse.status}/${quotasResponse.status})`,
        );
      }

      const [userData, usageData, quotaData] = (await Promise.all([
        userResponse.json(),
        usageResponse.json(),
        quotasResponse.json(),
      ])) as [WorkspaceUserSummary, WorkspaceUsageSummary, WorkspaceQuotaSummary];

      setUserSummary(userData);
      setUsageSummary(usageData);
      setQuotaSummary(quotaData);
    } catch (error) {
      console.error('Failed to load dashboard slice data:', error);
      setDashboardError('Failed to load dashboard summary.');
      setUserSummary(null);
      setUsageSummary(null);
      setQuotaSummary(null);
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function handleExecuteCommand(): Promise<void> {
    if (!userId) {
      return;
    }

    const trimmedCommand = commandInput.trim();
    if (!trimmedCommand) {
      setExecState({
        status: 'http-400',
        result: null,
      });
      return;
    }

    if (!selectedSessionId) {
      setExecState({
        status: 'http-404',
        result: null,
      });
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession) {
      setExecState({
        status: 'http-404',
        result: null,
      });
      return;
    }

    if (selectedSession.terminatedAt) {
      setExecState({
        status: 'http-410',
        result: null,
      });
      return;
    }

    const sessionId = selectedSessionId;

    setExecState({
      status: 'sending',
      result: null,
    });

    const nextState = await executeSessionCommand({
      sessionId,
      command: trimmedCommand,
    });

    setExecState(nextState);

    await refreshPostExecSurfaces({
      execState: nextState,
      refreshCheckpoints: async () => {
        await loadCheckpoints(sessionId);
      },
      refreshSessions: async () => {
        await loadSessions();
      },
      refreshDashboard: async () => {
        await loadDashboardSlice();
      },
    });

    if (nextState.status === 'result') {
      await loadWorkspaceFilesForSession(sessionId);
    }
  }

  async function handleRunBuildTarget(): Promise<void> {
    if (!userId) {
      return;
    }

    if (!selectedSessionId) {
      setBuildRequestState('failed');
      setBuildStatusMessage(null);
      setBuildError('Select an active session to run a build target.');
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession) {
      setBuildRequestState('failed');
      setBuildStatusMessage(null);
      setBuildError('Selected session is unavailable.');
      return;
    }

    if (selectedSession.terminatedAt || selectedSession.status === 'terminated') {
      setBuildRequestState('failed');
      setBuildStatusMessage(null);
      setBuildError('Cannot run build for a terminated session.');
      return;
    }

    const resolved = resolveWorkspaceBuildCommand(selectedBuildTarget);
    setSelectedBuildTarget(resolved.target);
    setBuildRequestState('submitting');
    setBuildStatusMessage(`Running ${resolved.target} build via existing session exec path...`);
    setBuildError(null);
    setBuildOutput('');

    const nextState = await executeSessionCommand({
      sessionId: selectedSessionId,
      command: resolved.command,
    });
    setExecState(nextState);

    if (nextState.status !== 'result' || !nextState.result) {
      setBuildRequestState('failed');
      setBuildStatusMessage(null);
      setBuildError(nextState.errorMessage ?? 'Build request failed before execution completed.');
      await loadDashboardSlice();
      return;
    }

    const mergedOutput = [nextState.result.stdout, nextState.result.stderr]
      .filter((value) => value.trim().length > 0)
      .join('\n')
      .trim();
    setBuildOutput(mergedOutput);

    if (nextState.result.exitCode === 0) {
      setBuildRequestState('completed');
      setBuildStatusMessage(`${resolved.target} build completed successfully.`);
      setBuildError(null);
      await loadWorkspaceFilesForSession(selectedSessionId);
      await loadDashboardSlice();
      return;
    }

    setBuildRequestState('failed');
    setBuildStatusMessage(null);
    if (
      detectBuildToolchainUnavailable({
        exitCode: nextState.result.exitCode,
        stdout: nextState.result.stdout,
        stderr: nextState.result.stderr,
      })
    ) {
      setBuildError(
        `${resolved.target} build toolchain is unavailable in this runtime. Use a compatible build agent/session.`,
      );
    } else {
      setBuildError(
        `${resolved.target} build failed (exit ${nextState.result.exitCode}). Review build output for details.`,
      );
    }
    await loadDashboardSlice();
  }

  async function refreshChatExecutionStatus(executionId: string): Promise<void> {
    if (!userId) {
      return;
    }
    const apiKey = localStorage.getItem(DRIVER_API_KEY_STORAGE_KEY)?.trim() ?? '';
    if (!apiKey) {
      setChatRequestState('failed');
      setChatStatusMessage(null);
      setChatError('Missing API key. Add one in /en/driver, then retry.');
      return;
    }

    try {
      const response = await fetch(`/api/ai/executions/${encodeURIComponent(executionId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const failureMessage = toChatAssistantFailureMessage({
          rawMessage: await readResponseErrorMessage(response),
          fallbackMessage: `Chat status check failed (${response.status}).`,
          statusCode: response.status,
          retryAfterHeader: response.headers.get('Retry-After'),
        });
        throw new Error(failureMessage);
      }

      const data = (await response.json()) as WorkspaceChatExecutionResponse;
      const nextStatus = typeof data.status === 'string' ? data.status : 'queued';
      const nextOutput = typeof data.output === 'string' ? data.output.trim() : '';
      const nextProvider =
        typeof data.provider === 'string' && data.provider.trim().length > 0
          ? data.provider.trim()
          : undefined;
      const nextModel =
        typeof data.model === 'string' && data.model.trim().length > 0
          ? data.model.trim()
          : undefined;
      const nextFileActions = normalizeWorkspaceFileActions(data.fileActions);
      applyAssistantAttributionToExecutionMessage(executionId, {
        provider: nextProvider,
        model: nextModel,
      });

      if (nextStatus === 'completed') {
        consumeExecutionFileActions(executionId, 'status', nextFileActions);
        chatStreamRef.current?.close();
        chatStreamRef.current = null;
        setChatRequestState('completed');
        const resolvedResponse =
          chatResponseTextRef.current.trim().length > 0
            ? chatResponseTextRef.current
            : nextOutput || 'Execution completed with no response text.';
        chatResponseTextRef.current = resolvedResponse;
        setChatResponseText(resolvedResponse);
        const pendingAssistantId = pendingAssistantMessageIdRef.current;
        if (pendingAssistantId) {
          setChatThreadMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === pendingAssistantId
                ? {
                    ...message,
                    content: resolvedResponse,
                    provider: nextProvider ?? message.provider,
                    model: nextModel ?? message.model,
                  }
                : message,
            ),
          );
          const executionSessionId = executionSessionIdByExecutionIdRef.current[executionId] ?? null;
          if (executionSessionId) {
            void persistSessionChatMessageToBackend({
              sessionId: executionSessionId,
              role: 'assistant',
              content: resolvedResponse,
            }).catch(() => {
              // Keep local thread persistence as compatibility fallback.
            });
          }
          pendingAssistantMessageIdRef.current = null;
        }
        setChatStatusMessage('Assistant response received.');
        setChatError(null);
        if (shouldRefreshDashboardForChatStatus(nextStatus)) {
          await loadDashboardSlice();
        }
        return;
      }

      if (nextStatus === 'failed' || nextStatus === 'cancelled' || nextStatus === 'timeout') {
        chatStreamRef.current?.close();
        chatStreamRef.current = null;
        setChatRequestState('failed');
        setChatStatusMessage(null);
        const failureMessage = toChatAssistantFailureMessage(
          {
            rawMessage: nextOutput,
            fallbackMessage: `Execution ended with status: ${nextStatus}.`,
          },
        );
        setChatError(failureMessage);
        const pendingAssistantId = pendingAssistantMessageIdRef.current;
        if (pendingAssistantId) {
          setChatThreadMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === pendingAssistantId
                ? message.content === failureMessage
                  ? message
                  : {
                      ...message,
                      content: failureMessage,
                      provider: nextProvider ?? message.provider,
                      model: nextModel ?? message.model,
                    }
                : message,
            ),
          );
          const executionSessionId = executionSessionIdByExecutionIdRef.current[executionId] ?? null;
          if (executionSessionId) {
            void persistSessionChatMessageToBackend({
              sessionId: executionSessionId,
              role: 'assistant',
              content: failureMessage,
            }).catch(() => {
              // Keep local thread persistence as compatibility fallback.
            });
          }
          pendingAssistantMessageIdRef.current = null;
        }
        if (shouldRefreshDashboardForChatStatus(nextStatus)) {
          await loadDashboardSlice();
        }
        return;
      }

      if (nextStatus === 'running' || nextStatus === 'queued') {
        setChatRequestState(nextStatus);
        setChatStatusMessage(
          nextStatus === 'queued'
            ? 'Request accepted and queued.'
            : 'Request is running.',
        );
        setChatError(null);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const failureMessage = toChatAssistantFailureMessage({
        rawMessage: detail,
        fallbackMessage: 'Chat status check failed.',
      });
      setChatRequestState('failed');
      setChatStatusMessage(null);
      setChatError(failureMessage);
      await loadDashboardSlice();
    }
  }

  async function sleepMs(durationMs: number): Promise<void> {
    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), durationMs);
    });
  }

  function updateAssistantMessageContent(assistantMessageId: string, content: string): void {
    setChatThreadMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === assistantMessageId && message.role === 'assistant'
          ? {
              ...message,
              content,
            }
          : message,
      ),
    );
  }

  async function submitOrchestratedChatPrompt(input: {
    apiKey: string;
    prompt: string;
    selectedSessionId: string | null;
    chosenModel: { provider: string; model: string };
    assistantMessageId: string;
  }): Promise<void> {
    const orchestrationPlan = buildWorkspaceChatOrchestrationPlan(
      input.prompt,
      CHAT_ORCHESTRATION_MAX_STEPS,
    );
    const progress: WorkspaceChatOrchestrationStepProgress[] = orchestrationPlan.map((step) => ({
      id: step.id,
      status: 'pending',
    }));
    const executionSessionId = input.selectedSessionId;
    let combinedStepOutput = '';
    const selectedProject =
      selectedProjectId
        ? workspaceProjects.find((project) => project.id === selectedProjectId) ?? null
        : null;
    const selectedWorkspace =
      selectedWorkspaceId
        ? workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
        : null;
    const workspaceContext = await buildWorkspacePromptContext({
      prompt: input.prompt,
      sessionId: executionSessionId,
      workspaceFileTree,
      selectedFilePath,
      selectedFileContent,
      projectName: selectedProject?.name,
      workspaceName: selectedWorkspace?.name,
    });

    updateAssistantMessageContent(
      input.assistantMessageId,
      formatWorkspaceChatOrchestrationProgress({
        steps: orchestrationPlan,
        progress,
      }),
    );

    for (let index = 0; index < orchestrationPlan.length; index += 1) {
      const step = orchestrationPlan[index];
      progress[index] = { ...progress[index], status: 'running' };
      setChatStatusMessage(`Running orchestration step ${index + 1}/${orchestrationPlan.length}...`);
      updateAssistantMessageContent(
        input.assistantMessageId,
        formatWorkspaceChatOrchestrationProgress({
          steps: orchestrationPlan,
          progress,
        }),
      );

      const stepPrompt =
        index === 0
          ? step.instruction
          : [
              `Continue the same user request with this step only: ${step.instruction}`,
              '',
              'Prior completed step outputs:',
              combinedStepOutput.trim().length > 0 ? combinedStepOutput : '(none)',
              '',
              `Original user request: ${input.prompt}`,
            ].join('\n');

      const executeResponse = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          prompt: stepPrompt,
          provider: input.chosenModel.provider,
          model: input.chosenModel.model,
          sessionId: executionSessionId ?? crypto.randomUUID(),
          conversationId: executionSessionId ?? crypto.randomUUID(),
          ...(workspaceContext ? { workspaceContext } : {}),
        }),
      });

      if (!executeResponse.ok) {
        const failureMessage = toChatAssistantFailureMessage({
          rawMessage: await readResponseErrorMessage(executeResponse),
          fallbackMessage: `Orchestration step ${index + 1} failed (${executeResponse.status}).`,
          statusCode: executeResponse.status,
          retryAfterHeader: executeResponse.headers.get('Retry-After'),
        });
        progress[index] = { ...progress[index], status: 'failed', summary: failureMessage };
        const finalFailureContent = formatWorkspaceChatOrchestrationProgress({
          steps: orchestrationPlan,
          progress,
        });
        setChatRequestState('failed');
        setChatStatusMessage(null);
        setChatError(failureMessage);
        updateAssistantMessageContent(input.assistantMessageId, finalFailureContent);
        if (executionSessionId) {
          void persistSessionChatMessageToBackend({
            sessionId: executionSessionId,
            role: 'assistant',
            content: finalFailureContent,
          }).catch(() => {
            // Keep local thread persistence as compatibility fallback.
          });
        }
        return;
      }

      const queuedPayload = (await executeResponse.json()) as WorkspaceChatExecutionResponse;
      const executionId = typeof queuedPayload.executionId === 'string' ? queuedPayload.executionId : null;
      if (!executionId) {
        const failureMessage = `Orchestration step ${index + 1} did not return an execution id.`;
        progress[index] = { ...progress[index], status: 'failed', summary: failureMessage };
        const finalFailureContent = formatWorkspaceChatOrchestrationProgress({
          steps: orchestrationPlan,
          progress,
        });
        setChatRequestState('failed');
        setChatStatusMessage(null);
        setChatError(failureMessage);
        updateAssistantMessageContent(input.assistantMessageId, finalFailureContent);
        if (executionSessionId) {
          void persistSessionChatMessageToBackend({
            sessionId: executionSessionId,
            role: 'assistant',
            content: finalFailureContent,
          }).catch(() => {
            // Keep local thread persistence as compatibility fallback.
          });
        }
        return;
      }

      if (executionSessionId) {
        executionSessionIdByExecutionIdRef.current[executionId] = executionSessionId;
      }
      executionAssistantMessageIdByExecutionIdRef.current[executionId] = input.assistantMessageId;

      let terminalPayload = queuedPayload;
      let terminalStatus = typeof terminalPayload.status === 'string' ? terminalPayload.status : 'queued';
      while (terminalStatus === 'queued' || terminalStatus === 'running') {
        await sleepMs(CHAT_EXECUTION_POLL_INTERVAL_MS);
        const statusResponse = await fetch(`/api/ai/executions/${encodeURIComponent(executionId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${input.apiKey}`,
          },
        });
        if (!statusResponse.ok) {
          const failureMessage = toChatAssistantFailureMessage({
            rawMessage: await readResponseErrorMessage(statusResponse),
            fallbackMessage: `Orchestration step ${index + 1} status check failed (${statusResponse.status}).`,
            statusCode: statusResponse.status,
            retryAfterHeader: statusResponse.headers.get('Retry-After'),
          });
          progress[index] = { ...progress[index], status: 'failed', summary: failureMessage };
          const finalFailureContent = formatWorkspaceChatOrchestrationProgress({
            steps: orchestrationPlan,
            progress,
          });
          setChatRequestState('failed');
          setChatStatusMessage(null);
          setChatError(failureMessage);
          updateAssistantMessageContent(input.assistantMessageId, finalFailureContent);
          if (executionSessionId) {
            void persistSessionChatMessageToBackend({
              sessionId: executionSessionId,
              role: 'assistant',
              content: finalFailureContent,
            }).catch(() => {
              // Keep local thread persistence as compatibility fallback.
            });
          }
          return;
        }
        terminalPayload = (await statusResponse.json()) as WorkspaceChatExecutionResponse;
        terminalStatus =
          typeof terminalPayload.status === 'string' ? terminalPayload.status : 'queued';
      }

      const terminalOutput =
        typeof terminalPayload.output === 'string' && terminalPayload.output.trim().length > 0
          ? terminalPayload.output.trim()
          : '';
      const terminalProvider =
        typeof terminalPayload.provider === 'string' && terminalPayload.provider.trim().length > 0
          ? terminalPayload.provider.trim()
          : input.chosenModel.provider;
      const terminalModel =
        typeof terminalPayload.model === 'string' && terminalPayload.model.trim().length > 0
          ? terminalPayload.model.trim()
          : input.chosenModel.model;
      const terminalFileActions = normalizeWorkspaceFileActions(terminalPayload.fileActions);

      applyAssistantAttributionToExecutionMessage(executionId, {
        provider: terminalProvider,
        model: terminalModel,
      });
      consumeExecutionFileActions(executionId, 'status', terminalFileActions);

      if (terminalStatus !== 'completed') {
        const failureMessage = toChatAssistantFailureMessage({
          rawMessage: terminalOutput,
          fallbackMessage: `Orchestration step ${index + 1} ended with status: ${terminalStatus}.`,
        });
        progress[index] = { ...progress[index], status: 'failed', summary: failureMessage };
        const finalFailureContent = formatWorkspaceChatOrchestrationProgress({
          steps: orchestrationPlan,
          progress,
        });
        setChatRequestState('failed');
        setChatStatusMessage(null);
        setChatError(failureMessage);
        updateAssistantMessageContent(input.assistantMessageId, finalFailureContent);
        if (executionSessionId) {
          void persistSessionChatMessageToBackend({
            sessionId: executionSessionId,
            role: 'assistant',
            content: finalFailureContent,
          }).catch(() => {
            // Keep local thread persistence as compatibility fallback.
          });
        }
        return;
      }

      const summary = terminalOutput.length > 0 ? 'execution complete' : 'completed with no text output';
      progress[index] = {
        ...progress[index],
        status: 'completed',
        summary,
      };
      combinedStepOutput += `\n[Step ${index + 1}] ${terminalOutput || '(no output text)'}`;
      updateAssistantMessageContent(
        input.assistantMessageId,
        formatWorkspaceChatOrchestrationProgress({
          steps: orchestrationPlan,
          progress,
        }),
      );
    }

    const finalContent = [
      formatWorkspaceChatOrchestrationProgress({
        steps: orchestrationPlan,
        progress,
      }),
      '',
      'Final combined output:',
      combinedStepOutput.trim().length > 0 ? combinedStepOutput.trim() : '(no output text)',
    ].join('\n');

    setChatRequestState('completed');
    setChatStatusMessage('Orchestration completed.');
    setChatError(null);
    setChatResponseText(combinedStepOutput.trim());
    chatResponseTextRef.current = combinedStepOutput.trim();
    updateAssistantMessageContent(input.assistantMessageId, finalContent);

    if (executionSessionId) {
      void persistSessionChatMessageToBackend({
        sessionId: executionSessionId,
        role: 'assistant',
        content: finalContent,
      }).catch(() => {
        // Keep local thread persistence as compatibility fallback.
      });
    }
    await loadDashboardSlice();
  }

  async function handleSubmitChatPrompt(): Promise<void> {
    if (!userId) {
      return;
    }
    const apiKey = localStorage.getItem(DRIVER_API_KEY_STORAGE_KEY)?.trim() ?? '';
    if (!apiKey) {
      setChatRequestState('failed');
      setChatStatusMessage(null);
      setChatError('Missing API key. Add one in /en/driver, then retry.');
      return;
    }

    const trimmedPrompt = chatPromptInput.trim();
    if (!trimmedPrompt) {
      setChatRequestState('failed');
      setChatStatusMessage(null);
      setChatError('Enter a prompt before sending.');
      return;
    }

    setChatRequestState('submitting');
    chatStreamRef.current?.close();
    chatStreamRef.current = null;
    chatResponseTextRef.current = '';
    setChatResponseText('');
    setChatExecutionId(null);
    setChatStatusMessage('Submitting prompt...');
    setChatError(null);
    const chosenModel = parseSelectedChatModelOption(selectedChatModelOption);
    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    pendingAssistantMessageIdRef.current = isChatOrchestrationEnabled ? null : assistantMessageId;
    setChatThreadMessages((currentMessages) => [
      ...currentMessages,
      {
        id: userMessageId,
        role: 'user',
        content: trimmedPrompt,
      },
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        provider: chosenModel.provider,
        model: chosenModel.model,
      },
    ]);
    if (selectedSessionId) {
      void persistSessionChatMessageToBackend({
        sessionId: selectedSessionId,
        role: 'user',
        content: trimmedPrompt,
      }).catch(() => {
        // Keep local thread persistence as compatibility fallback.
      });
    }

    if (isChatOrchestrationEnabled) {
      await submitOrchestratedChatPrompt({
        apiKey,
        prompt: trimmedPrompt,
        selectedSessionId,
        chosenModel,
        assistantMessageId,
      });
      return;
    }

    try {
      const selectedProject =
        selectedProjectId
          ? workspaceProjects.find((project) => project.id === selectedProjectId) ?? null
          : null;
      const selectedWorkspace =
        selectedWorkspaceId
          ? workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
          : null;
      const workspaceContext = await buildWorkspacePromptContext({
        prompt: trimmedPrompt,
        sessionId: selectedSessionId,
        workspaceFileTree,
        selectedFilePath,
        selectedFileContent,
        projectName: selectedProject?.name,
        workspaceName: selectedWorkspace?.name,
      });
      const response = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          provider: chosenModel.provider,
          model: chosenModel.model,
          sessionId: selectedSessionId ?? crypto.randomUUID(),
          conversationId: selectedSessionId ?? crypto.randomUUID(),
          ...(workspaceContext ? { workspaceContext } : {}),
        }),
      });

      if (!response.ok) {
        const failureMessage = toChatAssistantFailureMessage({
          rawMessage: await readResponseErrorMessage(response),
          fallbackMessage: `Chat execution failed (${response.status}).`,
          statusCode: response.status,
          retryAfterHeader: response.headers.get('Retry-After'),
        });
        throw new Error(failureMessage);
      }

      const data = (await response.json()) as WorkspaceChatExecutionResponse;
      const nextExecutionId = typeof data.executionId === 'string' ? data.executionId : null;
      const nextStatus = typeof data.status === 'string' ? data.status : null;
      const nextOutput = typeof data.output === 'string' ? data.output.trim() : '';
      const nextProvider =
        typeof data.provider === 'string' && data.provider.trim().length > 0
          ? data.provider.trim()
          : chosenModel.provider;
      const nextModel =
        typeof data.model === 'string' && data.model.trim().length > 0
          ? data.model.trim()
          : chosenModel.model;
      const nextFileActions = normalizeWorkspaceFileActions(data.fileActions);
      const executionSessionId = selectedSessionId;

      setChatExecutionId(nextExecutionId);
      if (nextExecutionId && executionSessionId) {
        executionSessionIdByExecutionIdRef.current[nextExecutionId] = executionSessionId;
        executionAssistantMessageIdByExecutionIdRef.current[nextExecutionId] = assistantMessageId;
        setChatThreadMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  executionId: nextExecutionId,
                  provider: nextProvider,
                  model: nextModel,
                }
              : message,
          ),
        );
      }
      if (nextExecutionId) {
        const stream = new EventSource(
          `/api/ai/executions/${encodeURIComponent(nextExecutionId)}/stream`,
        );
        chatStreamRef.current = stream;
        stream.onmessage = (event) => {
          const rawData = typeof event.data === 'string' ? event.data : '';
          if (!rawData) {
            return;
          }
          try {
            const parsed = JSON.parse(rawData) as {
              type?: string;
              content?: string;
              actions?: unknown;
            };
            if (parsed.type === 'token' && typeof parsed.content === 'string') {
              if (chatResponseTextRef.current === parsed.content) {
                return;
              }
              chatResponseTextRef.current = parsed.content;
              setChatResponseText(parsed.content);
              const pendingAssistantId = pendingAssistantMessageIdRef.current;
              if (pendingAssistantId) {
                setChatThreadMessages((currentMessages) =>
                  currentMessages.map((message) =>
                    message.id === pendingAssistantId
                      ? message.content === parsed.content
                        ? message
                        : { ...message, content: parsed.content ?? '' }
                      : message,
                  ),
                );
              }
              return;
            }
            if (parsed.type === 'file_actions') {
              const streamFileActions = normalizeWorkspaceFileActions(parsed.actions);
              consumeExecutionFileActions(nextExecutionId, 'stream', streamFileActions);
              return;
            }
            if (parsed.type === 'complete') {
              chatStreamRef.current?.close();
              chatStreamRef.current = null;
            }
          } catch {
            if (chatResponseTextRef.current === rawData) {
              return;
            }
            chatResponseTextRef.current = rawData;
            setChatResponseText(rawData);
          }
        };
        stream.onerror = () => {
          chatStreamRef.current?.close();
          chatStreamRef.current = null;
        };
      }

      if (nextStatus === 'completed') {
        if (nextExecutionId) {
          consumeExecutionFileActions(nextExecutionId, 'status', nextFileActions);
        }
        setChatRequestState('completed');
        const completedResponse =
          chatResponseTextRef.current.trim().length > 0
            ? chatResponseTextRef.current
            : nextOutput || 'Execution completed with no response text.';
        chatResponseTextRef.current = completedResponse;
        setChatResponseText(completedResponse);
        const pendingAssistantId = pendingAssistantMessageIdRef.current;
        if (pendingAssistantId) {
          setChatThreadMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === pendingAssistantId
                ? {
                    ...message,
                    content: completedResponse,
                    provider: nextProvider ?? message.provider,
                    model: nextModel ?? message.model,
                  }
                : message,
            ),
          );
          if (executionSessionId) {
            void persistSessionChatMessageToBackend({
              sessionId: executionSessionId,
              role: 'assistant',
              content: completedResponse,
            }).catch(() => {
              // Keep local thread persistence as compatibility fallback.
            });
          }
          pendingAssistantMessageIdRef.current = null;
        }
        setChatStatusMessage('Assistant response received.');
        if (shouldRefreshDashboardForChatStatus(nextStatus)) {
          await loadDashboardSlice();
        }
        return;
      }

      if (nextStatus === 'failed' || nextStatus === 'cancelled' || nextStatus === 'timeout') {
        setChatRequestState('failed');
        setChatStatusMessage(null);
        const failureMessage = toChatAssistantFailureMessage({
          rawMessage: nextOutput,
          fallbackMessage: `Execution ended with status: ${nextStatus}.`,
        });
        setChatError(failureMessage);
        const pendingAssistantId = pendingAssistantMessageIdRef.current;
        if (pendingAssistantId) {
          setChatThreadMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === pendingAssistantId
                ? message.content === failureMessage
                  ? message
                  : {
                      ...message,
                      content: failureMessage,
                      provider: nextProvider ?? message.provider,
                      model: nextModel ?? message.model,
                    }
                : message,
            ),
          );
          if (executionSessionId) {
            void persistSessionChatMessageToBackend({
              sessionId: executionSessionId,
              role: 'assistant',
              content: failureMessage,
            }).catch(() => {
              // Keep local thread persistence as compatibility fallback.
            });
          }
          pendingAssistantMessageIdRef.current = null;
        }
        if (shouldRefreshDashboardForChatStatus(nextStatus)) {
          await loadDashboardSlice();
        }
        return;
      }

      if (nextStatus === 'running' || nextStatus === 'queued') {
        setChatRequestState(nextStatus);
        setChatStatusMessage(
          nextStatus === 'queued'
            ? 'Request accepted and queued.'
            : 'Request is running.',
        );
        if (nextExecutionId) {
          await refreshChatExecutionStatus(nextExecutionId);
        }
        return;
      }

      setChatRequestState('failed');
      setChatStatusMessage(null);
      setChatError('Execution response did not include a recognized status.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const failureMessage = toChatAssistantFailureMessage({
        rawMessage: detail,
        fallbackMessage: 'Chat execution failed.',
      });
      setChatRequestState('failed');
      setChatStatusMessage(null);
      setChatError(failureMessage);
      const pendingAssistantId = pendingAssistantMessageIdRef.current;
      if (pendingAssistantId) {
        setChatThreadMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === pendingAssistantId
              ? message.content === failureMessage
                ? message
                : { ...message, content: failureMessage }
              : message,
          ),
        );
        if (selectedSessionId) {
          void persistSessionChatMessageToBackend({
            sessionId: selectedSessionId,
            role: 'assistant',
            content: failureMessage,
          }).catch(() => {
            // Keep local thread persistence as compatibility fallback.
          });
        }
        pendingAssistantMessageIdRef.current = null;
      }
      await loadDashboardSlice();
    }
  }

  function getSessionByIdForFileActions(sessionId: string): WorkspaceShellSession | null {
    return sessionsRef.current.find((session) => session.id === sessionId) ?? null;
  }

  async function refreshWorkspaceFileTreeAfterDelete(
    sessionId: string,
    deletedPath: string,
  ): Promise<void> {
    if (selectedSessionIdRef.current !== sessionId) {
      return;
    }

    const tree = await loadWorkspaceFileTree({
      sessionId,
    });

    if (selectedSessionIdRef.current !== sessionId) {
      return;
    }

    const hasFiles = findFirstFilePath(tree) !== null;
    setWorkspaceFileTree(tree);
    setFileSurfaceError(null);

    if (!hasFiles) {
      setSelectedFilePath(null);
      setSelectedFileContent('');
      setSavedFileContent('');
      setFileSaveState('clean');
      setFileSaveError(null);
      setFileSurfaceState('empty');
      return;
    }

    if (selectedFilePathRef.current === deletedPath) {
      fileContentRequestIdRef.current += 1;
      fileSaveRequestIdRef.current += 1;
      setSelectedFilePath(null);
      setSelectedFileContent('');
      setSavedFileContent('');
      setFileSaveState('clean');
      setFileSaveError(null);
    }

    setFileSurfaceState('ready');
  }

  async function maybeRunExecutionCoherence(executionId: string): Promise<void> {
    const fileActionState = chatExecutionFileActionStates[executionId];
    if (!fileActionState || fileActionState.applyStatus !== 'applied') {
      return;
    }
    if (!fileActionState.results.some((result) => result.status === 'success')) {
      return;
    }
    if (!acquireExecutionCoherenceGuard(executionId, coheredExecutionIdsRef.current)) {
      return;
    }

    const executionSessionId = executionSessionIdByExecutionIdRef.current[executionId] ?? null;
    if (!userId || !executionSessionId) {
      return;
    }

    const executionSession = getSessionByIdForFileActions(executionSessionId);
    const isExecutionSessionUsable =
      Boolean(executionSession) &&
      Boolean(executionSession && isUsableSession(executionSession)) &&
      !executionSession?.terminatedAt &&
      executionSession?.status !== 'terminated';
    const selectedFilePathAtTrigger = selectedFilePath;

    const coherenceResult = await runAiActionCoherence({
      executionId,
      fileActionState,
      selectedSessionId: selectedSessionIdRef.current,
      executionSessionId,
      isExecutionSessionUsable,
      selectedFilePath: selectedFilePathAtTrigger,
      checkpointDescription: AI_AUTO_CHECKPOINT_DESCRIPTION,
      refreshFileTree: async () => {
        await loadWorkspaceFilesForSession(executionSessionId);
      },
      reloadEditorFile: async (filePath) => {
        await loadWorkspaceFileContent(executionSessionId, filePath);
      },
      refreshPreview: async () => {
        await refreshPreviewForSession(executionSessionId);
      },
      createCheckpoint: async (description) => {
        const checkpointResult: WorkspaceCheckpointCreateResult = await createWorkspaceCheckpoint({
          sessionId: executionSessionId,
          userId,
          description,
        });
        return { commitHash: checkpointResult.commitHash };
      },
      refreshCheckpoints: async () => {
        await loadCheckpoints(executionSessionId);
      },
    });

    if (!coherenceResult.ran) {
      return;
    }

    const selectedSessionIdAtAutosave = selectedSessionIdRef.current;
    if (
      !PROJECT_FIRST_UX ||
      !selectedProjectId ||
      !selectedSessionIdAtAutosave ||
      projectOpenInProgressRef.current
    ) {
      return;
    }

    const autosaveAttemptedAt = Date.now();
    const autosaveResult = await attemptProjectAutosave({
      sessionId: selectedSessionIdAtAutosave,
      projectId: selectedProjectId,
      source: 'ai',
      hint:
        buildAutosaveHintFromFileActions(
          executionFileActionsByExecutionIdRef.current[executionId] ?? [],
        ) ?? undefined,
      now: autosaveAttemptedAt,
      lastAutosaveAt: lastProjectAutosaveAtRef.current,
    });
    if (autosaveResult.status === 'saved') {
      lastProjectAutosaveAtRef.current = autosaveAttemptedAt;
      void loadWorkspaceSnapshotsForUser();
    }
  }

  function attachExecutionFileActionStateToAssistantMessage(
    executionId: string,
    nextState: WorkspaceExecutionFileActionState,
  ): void {
    const assistantMessageId = executionAssistantMessageIdByExecutionIdRef.current[executionId];
    if (!assistantMessageId) {
      return;
    }
    setChatThreadMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === assistantMessageId && message.role === 'assistant'
          ? {
              ...message,
              executionId,
              fileActionState: nextState,
            }
          : message,
      ),
    );
  }

  function setExecutionFileActionState(
    executionId: string,
    nextState: WorkspaceExecutionFileActionState,
  ): void {
    setChatExecutionFileActionStates((currentStates) => ({
      ...currentStates,
      [executionId]: nextState,
    }));
    attachExecutionFileActionStateToAssistantMessage(executionId, nextState);
  }

  async function applyExecutionFileActions(
    executionId: string,
    source: 'stream' | 'status',
    executionSessionId: string,
    actions: WorkspaceFileAction[],
  ): Promise<void> {
    if (!acquireExecutionApplyGuard(executionId, appliedFileActionsExecutionIdsRef.current)) {
      return;
    }

    const applyResult = await applySequentialFileActions({
      sessionId: executionSessionId,
      actions,
      getSelectedSessionId: () => selectedSessionIdRef.current,
      getSessionById: getSessionByIdForFileActions,
      writeFile: async (action) => {
        if (action.action === 'delete') {
          await deleteWorkspaceFile({
            sessionId: executionSessionId,
            filePath: action.path,
          });
          await refreshWorkspaceFileTreeAfterDelete(executionSessionId, action.path);
          return;
        }

        await writeWorkspaceFile({
          sessionId: executionSessionId,
          filePath: action.path,
          content: action.content,
        });
      },
    });

    setExecutionFileActionState(executionId, {
      executionId,
      source,
      fileActions: actions,
      applyStatus: applyResult.applyStatus,
      confirmationRequired: false,
      skipReason: applyResult.skipReason,
      results: applyResult.results,
    });
  }

  async function maybeApplyExecutionFileActions(
    executionId: string,
    source: 'stream' | 'status',
  ): Promise<void> {
    if (cancelledFileActionsExecutionIdsRef.current.has(executionId)) {
      return;
    }

    const actions = executionFileActionsByExecutionIdRef.current[executionId] ?? [];
    const executionSessionId = executionSessionIdByExecutionIdRef.current[executionId] ?? null;

    if (!executionSessionId) {
      setExecutionFileActionState(executionId, {
        executionId,
        source,
        fileActions: actions,
        applyStatus: 'skipped',
        confirmationRequired: false,
        skipReason: 'missing-execution-session',
        results: [],
      });
      return;
    }

    if (!userId) {
      setExecutionFileActionState(executionId, {
        executionId,
        source,
        fileActions: actions,
        applyStatus: 'skipped',
        confirmationRequired: false,
        skipReason: 'missing-auth-session',
        results: [],
      });
      return;
    }

    if (pendingConfirmationExecutionIdsRef.current.has(executionId)) {
      setExecutionFileActionState(executionId, {
        executionId,
        source,
        fileActions: actions,
        applyStatus: 'awaiting-confirmation',
        confirmationRequired: true,
        skipReason: null,
        results: [],
      });
      return;
    }

    if (isRiskyFileActionBatch(actions)) {
      pendingConfirmationExecutionIdsRef.current.add(executionId);
      setExecutionFileActionState(executionId, {
        executionId,
        source,
        fileActions: actions,
        applyStatus: 'awaiting-confirmation',
        confirmationRequired: true,
        skipReason: null,
        results: [],
      });
      return;
    }

    await applyExecutionFileActions(executionId, source, executionSessionId, actions);
  }

  async function handleConfirmExecutionFileActions(executionId: string): Promise<void> {
    if (!pendingConfirmationExecutionIdsRef.current.has(executionId)) {
      return;
    }

    const fileActionState = chatExecutionFileActionStates[executionId];
    const actions = executionFileActionsByExecutionIdRef.current[executionId] ?? [];
    const executionSessionId = executionSessionIdByExecutionIdRef.current[executionId] ?? null;
    pendingConfirmationExecutionIdsRef.current.delete(executionId);

    if (!executionSessionId) {
      setExecutionFileActionState(executionId, {
        executionId,
        source: fileActionState?.source ?? 'status',
        fileActions: actions,
        applyStatus: 'skipped',
        confirmationRequired: false,
        skipReason: 'missing-execution-session',
        results: [],
      });
      return;
    }

    if (!userId) {
      setExecutionFileActionState(executionId, {
        executionId,
        source: fileActionState?.source ?? 'status',
        fileActions: actions,
        applyStatus: 'skipped',
        confirmationRequired: false,
        skipReason: 'missing-auth-session',
        results: [],
      });
      return;
    }

    await applyExecutionFileActions(
      executionId,
      fileActionState?.source ?? 'status',
      executionSessionId,
      actions,
    );
  }

  function handleCancelExecutionFileActions(executionId: string): void {
    if (!pendingConfirmationExecutionIdsRef.current.has(executionId)) {
      return;
    }

    pendingConfirmationExecutionIdsRef.current.delete(executionId);
    cancelledFileActionsExecutionIdsRef.current.add(executionId);
    const fileActionState = chatExecutionFileActionStates[executionId];
    const actions = executionFileActionsByExecutionIdRef.current[executionId] ?? [];
    setExecutionFileActionState(executionId, {
      executionId,
      source: fileActionState?.source ?? 'status',
      fileActions: actions,
      applyStatus: 'skipped',
      confirmationRequired: false,
      skipReason: 'user-cancelled',
      results: [],
    });
  }

  function consumeExecutionFileActions(
    executionId: string,
    source: 'stream' | 'status',
    fileActions: WorkspaceFileAction[],
  ): void {
    executionFileActionsByExecutionIdRef.current[executionId] = fileActions;
    if (appliedFileActionsExecutionIdsRef.current.has(executionId)) {
      return;
    }
    if (cancelledFileActionsExecutionIdsRef.current.has(executionId)) {
      setExecutionFileActionState(executionId, {
        executionId,
        source,
        fileActions,
        applyStatus: 'skipped',
        confirmationRequired: false,
        skipReason: 'user-cancelled',
        results: [],
      });
      return;
    }
    if (pendingConfirmationExecutionIdsRef.current.has(executionId)) {
      setExecutionFileActionState(executionId, {
        executionId,
        source,
        fileActions,
        applyStatus: 'awaiting-confirmation',
        confirmationRequired: true,
        skipReason: null,
        results: [],
      });
      return;
    }
    setExecutionFileActionState(executionId, {
      executionId,
      source,
      fileActions,
      applyStatus: 'pending',
      confirmationRequired: false,
      skipReason: null,
      results: [],
    });
    void maybeApplyExecutionFileActions(executionId, source);
  }

  useEffect(() => {
    if (projectOpenInProgressRef.current) {
      return;
    }
    const executionIds = Object.keys(chatExecutionFileActionStates);
    if (executionIds.length === 0) {
      return;
    }
    void (async () => {
      for (const executionId of executionIds) {
        await maybeRunExecutionCoherence(executionId);
      }
    })();
  }, [chatExecutionFileActionStates, selectedFilePath, userId]);

  function resetWorkspaceFileSurface(): void {
    fileNavigationRequestIdRef.current += 1;
    fileContentRequestIdRef.current += 1;
    fileSaveRequestIdRef.current += 1;
    setFileSurfaceState('empty');
    setWorkspaceFileTree([]);
    setSelectedFilePath(null);
    setSelectedFileContent('');
    setSavedFileContent('');
    setFileSaveState('clean');
    setFileSaveError(null);
    setFileSurfaceError(null);
  }

  async function loadWorkspaceFilesForSession(sessionId: string): Promise<boolean> {
    const requestId = fileNavigationRequestIdRef.current + 1;
    fileNavigationRequestIdRef.current = requestId;
    fileContentRequestIdRef.current += 1;
    fileSaveRequestIdRef.current += 1;

    setFileSurfaceState('loading');
    setWorkspaceFileTree([]);
    setSelectedFilePath(null);
    setSelectedFileContent('');
    setSavedFileContent('');
    setFileSaveState('clean');
    setFileSaveError(null);
    setFileSurfaceError(null);

    try {
      const tree = await loadWorkspaceFileTree({
        sessionId,
      });

      if (fileNavigationRequestIdRef.current !== requestId) {
        return false;
      }

      const firstFilePath = findFirstFilePath(tree);
      if (!firstFilePath) {
        setWorkspaceFileTree(tree);
        setSelectedFilePath(null);
        setSelectedFileContent('');
        setSavedFileContent('');
        setFileSaveState('clean');
        setFileSaveError(null);
        setFileSurfaceState('empty');
        return false;
      }

      setWorkspaceFileTree(tree);
      return await loadWorkspaceFileContent(sessionId, firstFilePath);
    } catch (error) {
      console.error('Failed to load workspace files:', error);
      if (fileNavigationRequestIdRef.current !== requestId) {
        return false;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('(410)')) {
        setSelectedSessionId((currentSelection) => {
          if (currentSelection !== sessionId) {
            return currentSelection;
          }
          const fallbackSession = sessions.find((session) => {
            if (session.id === sessionId || !isUsableSession(session)) {
              return false;
            }
            return true;
          });
          return fallbackSession ? fallbackSession.id : null;
        });
        resetWorkspaceFileSurface();
        return false;
      }
      setWorkspaceFileTree([]);
      setSelectedFilePath(null);
      setSelectedFileContent('');
      setSavedFileContent('');
      setFileSaveState('clean');
      setFileSaveError(null);
      setFileSurfaceState('error');
      setFileSurfaceError('Failed to load workspace files.');
      return false;
    }
  }

  async function loadWorkspaceFileContent(sessionId: string, filePath: string): Promise<boolean> {
    const requestId = fileContentRequestIdRef.current + 1;
    fileContentRequestIdRef.current = requestId;
    fileSaveRequestIdRef.current += 1;

    setFileSurfaceState('loading');
    setFileSurfaceError(null);
    setSelectedFilePath(filePath);
    setFileSaveState('clean');
    setFileSaveError(null);

    try {
      const fileResponse = await readWorkspaceFile({
        sessionId,
        filePath,
      });

      if (fileContentRequestIdRef.current !== requestId) {
        return false;
      }

      const coldMountEditorDraft = PROJECT_FIRST_UX ? coldMountEditorDraftRef.current : null;
      const coldMountRestoreProjectId =
        selectedProjectId ?? sessionStorage.getItem(TAB_SELECTED_PROJECT_STORAGE_KEY);
      const shouldRestoreEditorDraft =
        !!coldMountEditorDraft &&
        coldMountEditorDraft.projectId === coldMountRestoreProjectId &&
        coldMountEditorDraft.sessionId === sessionId &&
        coldMountEditorDraft.filePath === fileResponse.path;
      if (shouldRestoreEditorDraft) {
        coldMountEditorDraftRef.current = null;
      }
      const restoredFileContent = shouldRestoreEditorDraft
        ? coldMountEditorDraft.content
        : fileResponse.content;

      setSelectedFilePath(fileResponse.path);
      setSelectedFileContent(restoredFileContent);
      setSavedFileContent(fileResponse.content);
      setFileSaveState(restoredFileContent === fileResponse.content ? 'clean' : 'dirty');
      setFileSaveError(null);
      setFileSurfaceState('ready');
      return true;
    } catch (error) {
      console.error('Failed to load workspace file content:', error);
      if (fileContentRequestIdRef.current !== requestId) {
        return false;
      }
      setSelectedFileContent('');
      setSavedFileContent('');
      setFileSaveState('clean');
      setFileSaveError(null);
      setFileSurfaceState('error');
      setFileSurfaceError('Failed to load selected file content.');
      return false;
    }
  }

  function handleWorkspaceEditorContentChange(nextContent: string): void {
    setSelectedFileContent(nextContent);
    setFileSaveError(null);
    setFileSaveState(nextContent === savedFileContent ? 'clean' : 'dirty');
  }

  async function handleSaveWorkspaceFile(): Promise<void> {
    if (!userId) {
      return;
    }

    if (!selectedSessionId || !selectedFilePath || fileSurfaceState !== 'ready') {
      setFileSaveState('save-error');
      setFileSaveError('Cannot save without an active session and selected file.');
      return;
    }

    const requestId = fileSaveRequestIdRef.current + 1;
    fileSaveRequestIdRef.current = requestId;
    setFileSaveState('saving');
    setFileSaveError(null);

    try {
      await writeWorkspaceFile({
        sessionId: selectedSessionId,
        filePath: selectedFilePath,
        content: selectedFileContent,
      });

      if (fileSaveRequestIdRef.current !== requestId) {
        return;
      }

      setSavedFileContent(selectedFileContent);
      setFileSaveState('saved');
      setFileSaveError(null);
      if (PROJECT_FIRST_UX) {
        sessionStorage.removeItem(TAB_EDITOR_DRAFT_STORAGE_KEY);
      }

      if (PROJECT_FIRST_UX && selectedProjectId && !projectOpenInProgressRef.current) {
        const autosaveAttemptedAt = Date.now();
        const autosaveResult = await attemptProjectAutosave({
          sessionId: selectedSessionId,
          projectId: selectedProjectId,
          source: 'file-save',
          hint: getWorkspacePathBasename(selectedFilePath) ?? undefined,
          now: autosaveAttemptedAt,
          lastAutosaveAt: lastProjectAutosaveAtRef.current,
        });
        if (autosaveResult.status === 'saved') {
          lastProjectAutosaveAtRef.current = autosaveAttemptedAt;
          void loadWorkspaceSnapshotsForUser();
        }
      }
    } catch (error) {
      console.error('Failed to save workspace file:', error);
      if (fileSaveRequestIdRef.current !== requestId) {
        return;
      }
      setFileSaveState('save-error');
      setFileSaveError('Failed to save file changes.');
    }
  }

  async function handleSelectWorkspaceFile(filePath: string): Promise<void> {
    if (!userId) {
      return;
    }

    if (!selectedSessionId) {
      setFileSurfaceState('empty');
      setSelectedFilePath(null);
      setSelectedFileContent('');
      setSavedFileContent('');
      setFileSaveState('clean');
      setFileSaveError(null);
      setFileSurfaceError(null);
      return;
    }

    await loadWorkspaceFileContent(selectedSessionId, filePath);
  }

  async function refreshPreviewForSession(sessionId: string): Promise<void> {
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setPreviewState('loading');
    setPreviewUrl(null);

    try {
      const statusResponse = await fetch(`/api/preview/${sessionId}/status`, {
        method: 'GET',
      });

      if (!statusResponse.ok) {
        throw new Error(`Preview status failed (${statusResponse.status})`);
      }

      const statusData = (await statusResponse.json()) as WorkspacePreviewStatusResponse;

      if (previewRequestIdRef.current !== requestId) {
        return;
      }

      if (!isPreviewRunning(statusData)) {
        setPreviewState('unavailable');
        setPreviewUrl(null);
        return;
      }

      setPreviewUrl(buildPreviewProxyUrl(sessionId, Date.now()));
    } catch (error) {
      console.error('Failed to load preview state:', error);
      if (previewRequestIdRef.current !== requestId) {
        return;
      }
      setPreviewState('error');
      setPreviewUrl(null);
    }
  }

  async function handleRefreshPreview(): Promise<void> {
    if (!userId) {
      return;
    }

    if (!selectedSessionId) {
      setPreviewState('unavailable');
      setPreviewUrl(null);
      return;
    }

    await refreshPreviewForSession(selectedSessionId);
  }

  async function handleStartPreview(): Promise<void> {
    if (!userId) {
      return;
    }

    if (!selectedSessionId) {
      setPreviewState('unavailable');
      setPreviewUrl(null);
      return;
    }

    setPreviewState('loading');
    setPreviewUrl(null);

    try {
      const startResponse = await fetch(`/api/preview/${selectedSessionId}/start`, {
        method: 'POST',
      });

      if (!startResponse.ok) {
        const detail = await readResponseErrorMessage(startResponse);
        throw new Error(
          detail
            ? `Preview start failed (${startResponse.status}): ${detail}`
            : `Preview start failed (${startResponse.status})`,
        );
      }

      await refreshPreviewForSession(selectedSessionId);

      if (
        PROJECT_FIRST_UX &&
        selectedProjectId &&
        selectedSessionId &&
        !projectOpenInProgressRef.current
      ) {
        const autosaveAttemptedAt = Date.now();
        const autosaveResult = await attemptProjectAutosave({
          sessionId: selectedSessionId,
          projectId: selectedProjectId,
          source: 'preview',
          hint: getWorkspacePathBasename(selectedFilePath) ?? undefined,
          now: autosaveAttemptedAt,
          lastAutosaveAt: lastProjectAutosaveAtRef.current,
        });
        if (autosaveResult.status === 'saved') {
          lastProjectAutosaveAtRef.current = autosaveAttemptedAt;
          void loadWorkspaceSnapshotsForUser();
        }
      }
    } catch (error) {
      console.error('Failed to start preview:', error);
      setPreviewState('error');
      setPreviewUrl(null);
    }
  }

  function handlePreviewLoad(): void {
    setPreviewState((currentState) => {
      if (currentState !== 'loading') {
        return currentState;
      }
      return 'ready';
    });
  }

  function handlePreviewError(): void {
    setPreviewState('error');
  }

  const visibleSessions = sessions.filter((session) => !hiddenSessionIds.includes(session.id));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600">Loading workspace...</p>
      </div>
    );
  }

  return (
    <WorkspaceShell
      locale={locale}
      onLogout={handleLogout}
      sessions={visibleSessions}
      selectedSessionId={selectedSessionId}
      isLoadingSessions={isLoadingSessions}
      sessionError={sessionError}
      sessionCreateError={sessionCreateError}
      sessionActionError={sessionActionError}
      onSelectSession={setSelectedSessionId}
      onCreateSession={handleCreateSession}
      onStopSession={handleStopSession}
      onRemoveSession={handleRemoveSession}
      isCreatingSession={isCreatingSession}
      stoppingSessionId={stoppingSessionId}
      userId={userId}
      checkpoints={checkpoints}
      isLoadingHistory={isLoadingHistory}
      historyError={historyError}
      checkpointCreateState={checkpointCreateState}
      checkpointCreateError={checkpointCreateError}
      checkpointDescriptionInput={checkpointDescriptionInput}
      onCheckpointDescriptionChange={handleCheckpointDescriptionChange}
      onCreateManualCheckpoint={handleCreateManualCheckpoint}
      snapshotListState={snapshotListState}
      snapshotActionState={snapshotActionState}
      snapshotActionMessage={snapshotActionMessage}
      snapshotActionError={snapshotActionError}
      projectListState={projectListState}
      projectActionState={projectActionState}
      projectActionMessage={projectActionMessage}
      projectActionError={projectActionError}
      workspaces={workspaces}
      selectedWorkspaceId={selectedWorkspaceId}
      workspaceActionState={workspaceActionState}
      workspaceActionError={workspaceActionError}
      workspaceCreateNameInput={workspaceCreateNameInput}
      workspaceRenameNameInput={workspaceRenameNameInput}
      onSelectWorkspaceId={handleWorkspaceSelection}
      onWorkspaceCreateNameInputChange={handleWorkspaceCreateNameInputChange}
      onWorkspaceRenameNameInputChange={handleWorkspaceRenameNameInputChange}
      onCreateWorkspace={() => handleCreateWorkspace(workspaceCreateNameInput)}
      onRenameWorkspace={() => handleRenameWorkspace(selectedWorkspaceId, workspaceRenameNameInput)}
      onDeleteWorkspace={() => handleDeleteWorkspace(selectedWorkspaceId)}
      workspaceProjects={workspaceProjects}
      selectedProjectId={selectedProjectId}
      projectMoveTargetWorkspaceId={projectMoveTargetWorkspaceId}
      selectedProjectVisibility={selectedProjectVisibility}
      projectNameInput={projectNameInput}
      onProjectNameInputChange={handleProjectNameInputChange}
      onProjectMoveTargetWorkspaceIdChange={handleProjectMoveTargetWorkspaceSelection}
      onSelectProjectId={handleProjectSelection}
      onMoveWorkspaceProject={() =>
        handleMoveWorkspaceProject(selectedProjectId, projectMoveTargetWorkspaceId)
      }
      onCreateWorkspaceProject={handleCreateWorkspaceProject}
      onOpenWorkspaceProject={handleOpenWorkspaceProject}
      onResumeWorkspaceProjectById={handleResumeWorkspaceProjectById}
      onRestoreWorkspaceProjectFromSnapshotById={
        handleRestoreWorkspaceProjectFromSnapshotById
      }
      onSaveNamedProjectSnapshot={handleSaveNamedProjectSnapshot}
      onSelectedProjectVisibilityChange={handleProjectVisibilitySelection}
      onUpdateWorkspaceProjectVisibility={handleUpdateWorkspaceProjectVisibility}
      publicProjectListState={publicProjectListState}
      publicProjectActionState={publicProjectActionState}
      publicProjectActionMessage={publicProjectActionMessage}
      publicProjectActionError={publicProjectActionError}
      publicWorkspaceProjects={publicWorkspaceProjects}
      selectedPublicProjectId={selectedPublicProjectId}
      selectedPublicProjectDetail={selectedPublicProjectDetail}
      onSelectPublicProjectId={handleSelectPublicProject}
      onViewPublicWorkspaceProject={handleViewPublicWorkspaceProject}
      onForkPublicWorkspaceProject={handleForkPublicWorkspaceProject}
      workspaceSnapshots={workspaceSnapshots}
      selectedSnapshotId={selectedSnapshotId}
      onSelectSnapshotId={handleSnapshotSelection}
      onSaveWorkspaceSnapshot={handleSaveWorkspaceSnapshot}
      onRestoreWorkspaceSnapshot={handleRestoreWorkspaceSnapshot}
      onExportWorkspaceArchive={handleExportWorkspaceArchive}
      onImportWorkspaceArchive={handleImportWorkspaceArchive}
      checkpointRevertState={checkpointRevertState}
      checkpointRevertError={checkpointRevertError}
      checkpointRevertTargetId={checkpointRevertTargetId}
      onInitiateCheckpointRevert={handleInitiateCheckpointRevert}
      onAdvanceCheckpointRevertPreview={handleAdvanceCheckpointRevertPreview}
      onCancelCheckpointRevert={handleCancelCheckpointRevert}
      onConfirmCheckpointRevert={handleConfirmCheckpointRevert}
      checkpointDiffState={checkpointDiffState}
      checkpointDiffError={checkpointDiffError}
      checkpointDiffTargetId={checkpointDiffTargetId}
      checkpointDiffResponse={checkpointDiffResponse}
      onViewCheckpointDiff={handleViewCheckpointDiff}
      checkpointCompareState={checkpointCompareState}
      checkpointCompareError={checkpointCompareError}
      checkpointCompareBaseId={checkpointCompareBaseId}
      checkpointCompareTargetId={checkpointCompareTargetId}
      checkpointCompareResponse={checkpointCompareResponse}
      onStartCheckpointCompare={handleStartCheckpointCompare}
      onCancelCheckpointCompare={handleCancelCheckpointCompare}
      onSelectCheckpointCompareBase={handleSelectCheckpointCompareBase}
      onSelectCheckpointCompareTarget={handleSelectCheckpointCompareTarget}
      onRunCheckpointCompare={handleRunCheckpointCompare}
      pinnedCompareReferenceCheckpointId={checkpointPinnedReferenceId}
      onPinCheckpointCompareReference={handlePinCheckpointCompareReference}
      onClearPinnedCheckpointCompareReference={handleClearPinnedCheckpointCompareReference}
      checkpointSnapshotState={checkpointSnapshotState}
      checkpointSnapshotError={checkpointSnapshotError}
      checkpointSnapshotTargetId={checkpointSnapshotTargetId}
      checkpointSnapshotResponse={checkpointSnapshotResponse}
      onViewCheckpointSnapshot={handleViewCheckpointSnapshot}
      checkpointLiveOpenState={checkpointLiveOpenState}
      checkpointLiveOpenError={checkpointLiveOpenError}
      checkpointLiveOpenTargetPath={checkpointLiveOpenTargetPath}
      canOpenCheckpointFileInLiveWorkspace={canOpenCheckpointFileInLiveWorkspace}
      onOpenCheckpointFileInLiveWorkspace={handleOpenCheckpointFileInLiveWorkspace}
      userSummary={userSummary}
      usageSummary={usageSummary}
      quotaSummary={quotaSummary}
      isLoadingDashboard={isLoadingDashboard}
      dashboardError={dashboardError}
      chatPromptInput={chatPromptInput}
      onChatPromptInputChange={setChatPromptInput}
      selectedModelOption={selectedChatModelOption}
      onSelectedModelOptionChange={setSelectedChatModelOption}
      orchestrationEnabled={isChatOrchestrationEnabled}
      onOrchestrationEnabledChange={setIsChatOrchestrationEnabled}
      availableModelOptions={CHAT_MODEL_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
      onSubmitChatPrompt={handleSubmitChatPrompt}
      onConfirmExecutionFileActions={(executionId) => {
        void handleConfirmExecutionFileActions(executionId);
      }}
      onCancelExecutionFileActions={handleCancelExecutionFileActions}
      chatRequestState={chatRequestState}
      chatExecutionId={chatExecutionId}
      chatStatusMessage={chatStatusMessage}
      chatResponseText={chatResponseText}
      chatError={chatError}
      chatThreadMessages={chatThreadMessages}
      commandInput={commandInput}
      onCommandInputChange={setCommandInput}
      onExecuteCommand={handleExecuteCommand}
      execState={execState}
      selectedBuildTarget={selectedBuildTarget}
      onSelectedBuildTargetChange={(value) => {
        const resolved = resolveWorkspaceBuildCommand(value);
        setSelectedBuildTarget(resolved.target);
      }}
      availableBuildTargets={WORKSPACE_BUILD_TARGET_OPTIONS.map((target) => ({
        value: target.value,
        label: target.label,
      }))}
      onRunBuildTarget={handleRunBuildTarget}
      buildRequestState={buildRequestState}
      buildStatusMessage={buildStatusMessage}
      buildOutput={buildOutput}
      buildError={buildError}
      previewState={previewState}
      previewUrl={previewUrl}
      onStartPreview={handleStartPreview}
      onRefreshPreview={handleRefreshPreview}
      onPreviewLoad={handlePreviewLoad}
      onPreviewError={handlePreviewError}
      fileSurfaceState={fileSurfaceState}
      workspaceFileTree={workspaceFileTree}
      selectedFilePath={selectedFilePath}
      selectedFileContent={selectedFileContent}
      fileSaveState={fileSaveState}
      fileSaveError={fileSaveError}
      fileSurfaceError={fileSurfaceError}
      onSelectWorkspaceFile={handleSelectWorkspaceFile}
      onEditorContentChange={handleWorkspaceEditorContentChange}
      onSaveWorkspaceFile={handleSaveWorkspaceFile}
    />
  );
}
