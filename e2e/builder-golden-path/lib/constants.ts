export const FROZEN_ARTIFACT_PATH = 'index.html';

export const FROZEN_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>E2E Auto</title></head>
<body><h1>PRIVATE-BETA-E2E-AUTO</h1><p>Automated Builder golden-path validation succeeded.</p></body>
</html>`;

export const PREVIEW_HEADING = 'PRIVATE-BETA-E2E-AUTO';
export const PREVIEW_PARAGRAPH =
  'Automated Builder golden-path validation succeeded.';

export const BUILDER_PROMPT = `Create a single file named \`${FROZEN_ARTIFACT_PATH}\` in this workspace. Its complete contents must be exactly:

${FROZEN_HTML}

Do not create or modify any other file.`;

export const PROVIDER = 'xai';
export const MODEL = 'grok-4.5';
export const LOCALE = 'en';
export const DEFAULT_BASE_URL = 'https://staging.ainow.biz';

export const DEFAULT_IDLE_TIMEOUT_MS = 1_800_000;
export const SAFE_MINIMUM_HEADROOM_MS = 600_000;
export const PREVIEW_TIMEOUT_MS = 15_000;
export const AUTO_APPLY_TIMEOUT_MS = 180_000;
export const BUILD_TIMEOUT_MS = 180_000;
export const SESSION_CREATE_TIMEOUT_MS = 30_000;
export const PROJECT_CREATE_OBSERVATION_TIMEOUT_MS = 30_000;
export const PROJECT_CREATE_BODY_TIMEOUT_MS = 30_000;
export const PROJECT_CARD_CLICK_TIMEOUT_MS = 10_000;
export const BUILD_EXECUTION_RESPONSE_TIMEOUT_MS = 30_000;
export const BUILD_EXECUTION_BODY_TIMEOUT_MS = 30_000;

// Playwright resolves an absent actionTimeout/navigationTimeout to 0 = no timeout,
// so the LIVE config must state finite per-operation defaults explicitly.
export const LIVE_ACTION_TIMEOUT_MS = 30_000;
export const LIVE_NAVIGATION_TIMEOUT_MS = 60_000;
export const SSH_EXECUTION_TIMEOUT_MS = 30_000;

export const SELECTORS = {
  email: '#email',
  password: '#password',
  loginSubmit: 'form button[type="submit"]',
  sidebarProjects: '[data-testid="workspace-sidebar-nav-projects"]',
  newProjectButton: '[data-testid="workspace-projects-new-project-button"]',
  newProjectInput: '[data-testid="workspace-projects-new-project-input"]',
  createProjectConfirm: '[data-testid="workspace-projects-create-confirm-button"]',
  intentBuild: '[data-testid="workspace-chat-intent-build"]',
  promptInput: '[data-testid="workspace-chat-prompt-input"]',
  chatSubmit: '[data-testid="workspace-chat-submit"]',
  providerSelector: '[data-testid="workspace-chat-provider-selector"]',
  modelSelector: '[data-testid="workspace-chat-model-selector"]',
  fileTree: '[data-testid="workspace-file-tree"]',
  autoFileNode: `[data-testid="workspace-file-node-${FROZEN_ARTIFACT_PATH}"]`,
  awaitingConfirmation:
    '[data-testid="workspace-chat-file-actions-awaiting-confirmation"]',
  previewStart: '[data-testid="workspace-preview-start"]',
  previewIframe: '[data-testid="workspace-preview-iframe"]',
  previewPanel: '[data-testid="workspace-preview-panel"]',
  stopSession: '[data-testid="workspace-advanced-stop-session"]',
} as const;

export function projectCardSelector(projectId: string): string {
  return `[data-testid="workspace-project-card-${projectId}"]`;
}

export function disposableProjectName(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `E2E-AUTO-Disposable-${stamp}`;
}
