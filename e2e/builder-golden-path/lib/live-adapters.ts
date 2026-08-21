import type { Browser, BrowserContext, Page } from '@playwright/test';
import {
  AUTO_APPLY_TIMEOUT_MS,
  BUILDER_PROMPT,
  DEFAULT_BASE_URL,
  LOCALE,
  MODEL,
  PREVIEW_TIMEOUT_MS,
  PROVIDER,
  SELECTORS,
  SESSION_CREATE_TIMEOUT_MS,
  disposableProjectName,
  projectCardSelector,
} from './constants';
import {
  assertLiveCredentials,
  createFreshBrowserContext,
  loginThroughApplication,
} from './auth';
import {
  armConfirmBuildApplyListener,
  armSessionCreateListener,
  SessionObservationError,
  validateLiveConfirmResponse,
  type ConfirmListener,
} from './network';
import { startAndAssertPreview } from './preview';
import {
  countDeductionRowsForExecution,
  pickAutomaticCheckpoint,
  validateBalanceArithmetic,
  validateDeduction,
  type CheckpointEvidence,
} from './evidence';
import {
  ExecutionGateTracker,
  assertSafeHeadroomBeforeProvider,
  type ProviderCallGuard,
} from './safety-gates';
import {
  StagingHelper,
  SshExecutorMissingError,
  buildSessionStopPath,
  createSshExecutor,
  readAuthorizedLocalHead,
} from './staging';
import type { GoldenPathAdapters } from './runner';
import type { EnvMap } from './modes';

export interface LiveAdapterContext {
  browser: Browser;
  env?: EnvMap;
  locale?: string;
  gateTracker?: ExecutionGateTracker;
  staging?: StagingHelper;
  execute?: (argv: string[]) => Promise<string>;
  readLocalHead?: () => Promise<string>;
}

export function createLiveStagingHelper(options: {
  env?: EnvMap;
  gateTracker?: ExecutionGateTracker;
  execute?: (argv: string[]) => Promise<string>;
  staging?: StagingHelper;
}): StagingHelper {
  if (options.staging) {
    return options.staging;
  }
  const execute = options.execute ?? createSshExecutor();
  if (typeof execute !== 'function') {
    throw new SshExecutorMissingError();
  }
  return new StagingHelper({
    env: options.env,
    gateTracker: options.gateTracker,
    execute,
  });
}

export function assertLiveStagingExecutorBound(staging: StagingHelper): void {
  if (!staging.hasExecutor()) {
    throw new SshExecutorMissingError();
  }
}

export interface ObservedSessionCreate {
  projectId: string;
  sessionId: string;
  sessionCreatedAt: number;
  clickedProjectCard: boolean;
}

export async function createProjectAndObserveSession(
  page: Page,
  options?: { timeoutMs?: number },
): Promise<ObservedSessionCreate> {
  const timeoutMs = options?.timeoutMs ?? SESSION_CREATE_TIMEOUT_MS;
  const startedAt = Date.now();
  const sessionListener = await armSessionCreateListener(page);
  try {
    const projectResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/projects\/?$/.test(new URL(response.url()).pathname) &&
        response.ok(),
    );
    await page.locator(SELECTORS.createProjectConfirm).click();
    const projectResponse = await projectResponsePromise;
    const projectPayload = (await projectResponse.json()) as { id?: string };
    if (!projectPayload.id) {
      throw new SessionObservationError('Project create response did not include id.');
    }

    let clickedProjectCard = false;
    if (!sessionListener.hasObserved()) {
      const card = page.locator(projectCardSelector(projectPayload.id));
      const settleMs = Math.max(0, Math.min(1_000, timeoutMs - (Date.now() - startedAt)));
      const settleDeadline = Date.now() + settleMs;
      while (!sessionListener.hasObserved() && Date.now() < settleDeadline) {
        if ((await card.count()) > 0) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (!sessionListener.hasObserved() && (await card.count()) > 0) {
        await card.click();
        clickedProjectCard = true;
      }
    }

    const remaining = timeoutMs - (Date.now() - startedAt);
    const waitMs = sessionListener.hasObserved()
      ? Math.max(2_000, remaining)
      : Math.max(0, remaining);
    const sessionCapture = await sessionListener.waitForFirst(waitMs);
    const sessionId = sessionCapture.sessionId;
    if (!sessionId) {
      throw new SessionObservationError('Session create response did not include id.');
    }
    return {
      projectId: projectPayload.id,
      sessionId,
      sessionCreatedAt: Date.now(),
      clickedProjectCard,
    };
  } finally {
    await sessionListener.dispose();
  }
}

export async function createLiveAdapters(
  input: LiveAdapterContext,
): Promise<{
  adapters: GoldenPathAdapters;
  context: BrowserContext;
  page: Page;
  gateTracker: ExecutionGateTracker;
  staging: StagingHelper;
}> {
  const env = input.env ?? process.env;
  const locale = input.locale ?? LOCALE;
  const gateTracker = input.gateTracker ?? new ExecutionGateTracker();
  const staging = createLiveStagingHelper({
    env,
    gateTracker,
    execute: input.execute,
    staging: input.staging,
  });
  assertLiveStagingExecutorBound(staging);
  const readLocalHead = input.readLocalHead ?? (() => readAuthorizedLocalHead());
  const credentials = assertLiveCredentials(env);
  const baseURL = String(env.E2E_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');

  const context = await createFreshBrowserContext(input.browser);
  const page = await context.newPage();
  let confirmListener: ConfirmListener | undefined;
  let sessionCreatedAt = 0;
  let projectId = '';
  let sessionId = '';

  const adapters: GoldenPathAdapters = {
    async prepareBrowser() {
      await page.goto(`${baseURL}/${locale}/login`, { waitUntil: 'domcontentloaded' });
    },

    async authenticate() {
      await loginThroughApplication(page, credentials, {
        locale,
        loginPath: `${baseURL}/${locale}/login`,
      });
    },

    async runSafetyChecks() {
      const expectedHead = await readLocalHead();
      await staging.inspectParity(expectedHead);
      const gates = await staging.inspectGates();
      if (/GLOBAL_EXECUTION_ENABLED=true/.test(gates)) {
        gateTracker.recordAuthorityWithoutChange();
        return;
      }
      await staging.enableExecutionGate();
    },

    async captureStartingBalance() {
      const apiResponse = await page.request.get(`${baseURL}/api/billing/balance`);
      if (!apiResponse.ok()) {
        throw new Error(`Authoritative balance API HTTP ${apiResponse.status()}`);
      }
      const payload = (await apiResponse.json()) as { balance?: number };
      if (typeof payload.balance !== 'number') {
        throw new Error('Authoritative balance API did not return a numeric balance.');
      }
      await page.goto(`${baseURL}/${locale}/billing`, { waitUntil: 'domcontentloaded' });
      await page.waitForResponse(
        (response) =>
          response.url().includes('/api/billing/balance') && response.request().method() === 'GET',
        { timeout: 15_000 },
      );
      return payload.balance;
    },

    async armListeners() {
      confirmListener = await armConfirmBuildApplyListener(page);
    },

    async createSession() {
      await page.goto(`${baseURL}/${locale}/app`, { waitUntil: 'domcontentloaded' });
      await page.locator(SELECTORS.sidebarProjects).click();
      const projectName = disposableProjectName();
      await page.locator(SELECTORS.newProjectButton).click();
      await page.locator(SELECTORS.newProjectInput).fill(projectName);
      const created = await createProjectAndObserveSession(page, {
        timeoutMs: SESSION_CREATE_TIMEOUT_MS,
      });
      projectId = created.projectId;
      sessionId = created.sessionId;
      sessionCreatedAt = created.sessionCreatedAt;
      await page.locator(SELECTORS.promptInput).waitFor({ timeout: 60_000 });
      return { projectId, sessionId, sessionCreatedAt };
    },

    async submitBuild({ providerGuard, sessionCreatedAt: createdAt }) {
      assertSafeHeadroomBeforeProvider({
        sessionCreatedAt: createdAt,
        now: Date.now(),
      });
      providerGuard.authorizeCall();
      const providerSelect = page.locator(SELECTORS.providerSelector);
      if (await providerSelect.count()) {
        await providerSelect.selectOption({ value: PROVIDER }).catch(async () => {
          await providerSelect.selectOption({ label: 'xAI' });
        });
      }
      const modelSelect = page.locator(SELECTORS.modelSelector);
      if (await modelSelect.count()) {
        await modelSelect.selectOption({ value: `${PROVIDER}:${MODEL}` }).catch(async () => {
          await modelSelect.selectOption({ value: MODEL }).catch(async () => {
            await modelSelect.selectOption({ label: MODEL });
          });
        });
      }
      await page.locator(SELECTORS.intentBuild).click();
      await page.locator(SELECTORS.promptInput).fill(BUILDER_PROMPT);
      const executionResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/api\/ai\/executions\/?$/.test(new URL(response.url()).pathname),
        { timeout: BUILD_TIMEOUT_SAFE },
      );
      await page.locator(SELECTORS.chatSubmit).click();
      const buildSubmittedAt = Date.now();
      let executionId: string | undefined;
      try {
        const executionResponse = await executionResponsePromise;
        const payload = (await executionResponse.json().catch(() => null)) as
          | { id?: string; executionId?: string }
          | null;
        executionId = payload?.id ?? payload?.executionId;
      } catch {
        executionId = undefined;
      }
      return { executionId, buildSubmittedAt };
    },

    async waitForAutoApply() {
      await page.locator(SELECTORS.autoFileNode).waitFor({ timeout: AUTO_APPLY_TIMEOUT_MS });
      if (await page.locator(SELECTORS.awaitingConfirmation).count()) {
        throw new Error(
          'AUTO_APPLY expected for the one-file golden path, but awaiting-confirmation UI appeared. Do not click a manual Apply button.',
        );
      }
      return { autoApplyAt: Date.now(), fileApplied: true };
    },

    async verifyPreview() {
      await startAndAssertPreview(page, { timeoutMs: PREVIEW_TIMEOUT_MS });
      return { preview: 'PASS' };
    },

    async verifyCheckpoint() {
      const response = await page.request.get(
        `${baseURL}/api/sessions/${encodeURIComponent(sessionId)}/checkpoints`,
      );
      if (!response.ok()) {
        throw new Error(`Checkpoint list HTTP ${response.status()}`);
      }
      const payload = (await response.json()) as CheckpointEvidence[];
      return pickAutomaticCheckpoint(Array.isArray(payload) ? payload : []);
    },

    async verifyPublicConfirm() {
      if (!confirmListener) {
        throw new Error('Confirm listener was not armed before Build.');
      }
      const capture = await confirmListener.waitForFirst(30_000);
      validateLiveConfirmResponse(capture);
      return capture;
    },

    async verifyDeduction(executionId) {
      if (!executionId) {
        throw new Error('Cannot verify deduction without executionId.');
      }
      const executionResponse = await page.request.get(
        `${baseURL}/api/ai/executions/${encodeURIComponent(executionId)}`,
      );
      const execution = (await executionResponse.json().catch(() => ({}))) as {
        tokens_used?: number;
        tokensUsed?: number;
      };
      const tokensUsed = execution.tokens_used ?? execution.tokensUsed;
      if (typeof tokensUsed !== 'number') {
        throw new Error('Execution status did not include actual tokens_used.');
      }
      const deductionRaw = await staging.queryDeduction(executionId);
      const deductionCount = countDeductionRowsForExecution(deductionRaw, executionId);
      const evidence = {
        deductionCount,
        tokensUsed,
        creditsDeducted: tokensUsed,
      };
      validateDeduction(evidence);
      return evidence;
    },

    async verifyBalance({ balanceBefore, appliedCredits }) {
      const apiResponse = await page.request.get(`${baseURL}/api/billing/balance`);
      const payload = (await apiResponse.json()) as { balance?: number };
      if (typeof payload.balance !== 'number') {
        throw new Error('Authoritative balance API did not return a numeric balance after deduction.');
      }
      await page.goto(`${baseURL}/${locale}/billing`, { waitUntil: 'domcontentloaded' });
      await page.waitForResponse(
        (response) =>
          response.url().includes('/api/billing/balance') && response.request().method() === 'GET',
        { timeout: 15_000 },
      );
      validateBalanceArithmetic({
        balanceBefore,
        appliedCredits,
        balanceAfter: payload.balance,
      });
      return { balanceAfter: payload.balance };
    },

    async cleanup({ ids }) {
      await confirmListener?.dispose();
      let cleanup = 'session-stop-not-attempted';
      if (ids.sessionId) {
        try {
          const stop = await page.request.post(
            `${baseURL}${buildSessionStopPath(ids.sessionId)}`,
          );
          cleanup = stop.ok() ? 'session-stopped' : `session-stop-http-${stop.status()}`;
        } catch (error) {
          cleanup = `session-stop-failed:${error instanceof Error ? error.message : String(error)}`;
        }
      }
      const executionGateFinal = await staging.restoreExecutionGateIfChanged();
      await context.close().catch(() => undefined);
      return { cleanup, executionGateFinal };
    },
  };

  return { adapters, context, page, gateTracker, staging };
}

const BUILD_TIMEOUT_SAFE = 120_000;
