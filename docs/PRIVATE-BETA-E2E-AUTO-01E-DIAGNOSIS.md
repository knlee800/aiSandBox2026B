# PRIVATE-BETA-E2E-AUTO-01E — Step 1 Diagnosis

**Task ID:** PRIVATE-BETA-E2E-AUTO-01E
**Title:** LIVE-05 CREATE_SESSION 600s Timeout Root-Cause Investigation
**Step:** 1 — Registration + root-cause investigation ONLY
**Date:** 2026-08-21
**Classification:** AUTOMATION_TOOLING_INVESTIGATION
**Product defect:** NO — not proven, and no evidence found
**Production source modification:** NO
**Evidence class:** LOCAL-TESTS (static source + installed-dependency + existing-artifact analysis only)

Diagnostic only. No implementation. No Playwright LIVE. No staging/SSH. No provider. No credit. No gate change. No dependency change. No LIVE-05 rerun. No AUTO-01D reopen. No Git mutation.

```
ROOT_CAUSE_PROVEN=YES
IMPLEMENTATION_PERFORMED=NO
LIVE_RERUN=NO
PROVIDER_CALL_USED=0
CREDITS_DEDUCTED=0
STAGING_ACTIVITY=NONE
```

---

## 0. Source-identity proof

The source analysed in this diagnosis is byte-identical to the source that executed in LIVE-05.

```
LIVE-05 AUTHORIZED_LOCAL_HEAD / STAGING_HEAD = 3ee27663a97acdc0dbc75678007bcaa60ee0f7b9
Current local HEAD                            = 4283dd494658fc8f8480d8c34bb5db05c78f5fd5
git diff --stat 3ee2766 HEAD -- e2e/          = (empty)
git status --short                            = (clean)
```

Commits `f6122a4` and `4283dd4` after `3ee2766` are LIVE-05 evidence/lock documents only; `e2e/` is unchanged. Every line number below refers to the tree that ran.

Installed runner: `@playwright/test` / `playwright` / `playwright-core` **1.62.1**.

---

## 1. The mechanism: the LIVE runner has no per-operation timeout at all

`e2e/builder-golden-path/playwright.live.config.ts` sets `timeout: 10 * 60 * 1000` and `expect.timeout`, but its `use` block sets **no `actionTimeout` and no `navigationTimeout`**.

In Playwright 1.62.1 that is not "fall back to 30s". It resolves to **zero, which means no timeout**:

`node_modules/playwright/lib/index.js`

```
259:  actionTimeout: [0, { option: true, box: true }],
260:  navigationTimeout: [0, { option: true, box: true }],
341:  _setupContextOptions: [async ({ playwright, actionTimeout, navigationTimeout, ... }) => {
349:    playwright._defaultContextTimeout = actionTimeout || 0;
350:    playwright._defaultContextNavigationTimeout = navigationTimeout || 0;
354:  }, { auto: "all-hooks-included", title: "context configuration", box: true }],
```

`_setupContextOptions` is an **auto fixture**, so it applies to every test — including `live.spec.ts`, which does not use the `context`/`page` fixtures.

`node_modules/playwright-core/lib/coreBundle.js`

```
62298:  _setupBrowserContext(context2) {
62303:    context2.setDefaultTimeout(this._browserType._playwright._defaultContextTimeout);
62304:    context2.setDefaultNavigationTimeout(this._browserType._playwright._defaultContextNavigationTimeout);
```

`_setupBrowserContext()` runs for **every** `browser.newContext()`, therefore also for the manually created context in `e2e/builder-golden-path/lib/auth.ts:46` (`createFreshBrowserContext`). And:

```
57160:  _timeout(options) {
57161:    if (typeof options.timeout === "number") return options.timeout;
57165:    if (this._defaultTimeout !== void 0) return this._defaultTimeout;   // => 0
```

**Consequence:** in the LIVE run, every Playwright call that does not pass an explicit `{ timeout }` has **no timeout of its own** and can only be terminated by the outer `600000ms` test timeout.

Response-body reads are worse still — they ignore even the context default:

```
59640:  async body() { return (await this._channel.body({}, kNoTimeout)).binary; }
59647:  async json() { const content = await this.text(); return JSON.parse(content); }
13544:  internalBody() { ... this._contentPromise = this._finishedPromise.then(async () => { ... }) }
```

`kNoTimeout = { signal: undefined, timeout: 0 }`. `Response.json()` is unconditionally unbounded and additionally gated on the browser's request-finished event.

This single fact explains the **LIVE-04 and LIVE-05 shared signature**: an adapter miss cannot self-terminate; it always burns the full 600 s and aborts *outside* `runGoldenPath`, which is why the runner `finally` never runs, the execution gate is never restored, and no formatted verdict is printed.

---

## 2. Localisation of the pending operation

`e2e/builder-golden-path/lib/live-adapters.ts`, `createSession()` (226-240) and `createProjectAndObserveSession()` (93-149).

| # | Line | Statement | Bounded? |
|---|---|---|---|
| 1 | 227 | `page.goto(/en/app, domcontentloaded)` | NO (navigationTimeout 0) |
| 2 | 228 | `locator(sidebarProjects).click()` | NO |
| 3 | 229 | `disposableProjectName()` | sync |
| 4 | 230 | `locator(newProjectButton).click()` | NO |
| 5 | 231 | `locator(newProjectInput).fill(name)` | NO |
| 6 | 99 | `armSessionCreateListener(page)` | n/a |
| 7 | 101 / 108 | `page.waitForResponse(POST /api/projects && ok)` — **no `{timeout}` argument** | **NO** |
| 8 | 107 | `locator(createProjectConfirm).click()` | NO |
| 9 | 109 | `await projectResponse.json()` | **NO — `kNoTimeout`** |
| 10 | 117-124 | settle loop (`card.count()` + 50 ms sleeps) | YES — ≤1000 ms |
| 11 | 126 | `await card.click()` (fallback) | **NO** |
| 12 | 131-135 | `sessionListener.waitForFirst(waitMs)` | YES — plain `setTimeout`, `waitMs ≤ 30000 − elapsed` |
| 13 | 147 | `sessionListener.dispose()` | YES |
| 14 | 238 | `promptInput.waitFor({ timeout: 60_000 })` | YES |

### 2.1 Rows 1-5 and 8 completed — PROVEN

The disposable project `E2E-AUTO-Disposable-2026-08-21T08-49-52-397Z` (`3802c452-852a-4b2d-87d7-f48007cac887`) exists on staging with the generated name. The name is produced at line 229 and only reaches the server through line 231 `fill()` + line 107 `click()`. A `locator.click()` that delivered its input event has, by definition, passed its actionability retry loop and returned. Rows 1-5 and 8 therefore completed.

### 2.2 Row 11 (the fallback project-card click) was NEVER EXECUTED — PROVEN

This refutes the pre-registered high-priority hypothesis.

The guard at line 125 is `if (!sessionListener.hasObserved() && (await card.count()) > 0)`. Both conditions must hold simultaneously. They cannot.

`frontend/app/[locale]/app/page.tsx` `handleCreateWorkspaceProject()` (2316-2386):

```
2332  createWorkspaceProject()                  -> POST /api/projects
2340  openProjectInFreshSession()               -> GET /api/users/me/snapshots
                                                -> POST /api/sessions      <= hasObserved() becomes true here
                                                -> POST /api/projects/:id/open | /sessions/:sid
2348  setSelectedSessionId(openSessionId)
2350-2357  hydrate / preview / checkpoints / sessions / snapshots
2358  loadWorkspaceProjectsForUser(...)          <= the new project's card can first render here
2364  setWorkspaceView('project')                <= the card is unmounted again
```

The card is rendered from the `workspaceProjects` array (`workspace-project-card.tsx:65`, `data-testid="workspace-project-card-${project.id}"`). The only refresh paths are the explicit `loadWorkspaceProjectsForUser()` calls and the effect at `page.tsx:1566-1567`, whose deps are `[selectedSessionId, selectedWorkspaceId, userId]` — **not** `selectedProjectId`. Both fire only *after* `openProjectInFreshSession()` has returned, i.e. after `POST /api/sessions` resolved.

`POST /api/sessions` returned 2xx (session `d9c0cffd-3a87-432a-bf9c-078e647ac075` and its container were created, and `open-project-in-fresh-session.ts:46-56` throws on a non-ok response), so `armSessionCreateListener`'s handler (`network.ts:200-210`) set `observed = true` at that moment.

Therefore at every instant at which `card.count() > 0` could be true, `hasObserved()` was already true. The `!hasObserved()` guard was false. **No card click occurred, and `clickedProjectCard` never became true.**

### 2.3 Rows 10, 12, 13, 14 cannot consume 600 s — PROVEN

The settle loop is capped at 1000 ms. `waitForFirst()` (`network.ts:240-263`) is a plain JavaScript `setTimeout` bounded by `waitMs`, which is at most `30000 − elapsed`. `promptInput.waitFor()` carries an explicit 60 s and would have succeeded anyway (the prompt textbox is present and enabled in the failure snapshot).

**Corollary:** had control ever reached line 114, `createProjectAndObserveSession()` would have returned or thrown `SessionObservationError` within ~30 s of `startedAt`; `runGoldenPath` would have caught it, run `finally` → `cleanup()`, and `live.spec.ts:16` would have printed a formatted FAIL summary. Total runtime would have been about one minute. LIVE-05 instead ran the full 10.0 m with no verdict.

### 2.4 BUILD was never entered — PROVEN

The failure snapshot shows an **empty** prompt (`textbox "AI Prompt"`, placeholder only) and `button "Send" [disabled]`. In `submitBuild()` every statement preceding `promptInput.fill(BUILDER_PROMPT)` (line 263) is satisfiable:

- `providerSelector` option values are provider ids, so `selectOption({ value: 'xai' })` matches;
- `modelSelector` option values are composite `optionValue`s — `frontend/lib/ai/provider-model.catalogue.ts` gives `FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION.optionValue === 'xai:grok-4.5'`, exactly what line 256 asks for;
- `intentBuild` is enabled.

If BUILD had started, the prompt would contain `BUILDER_PROMPT`. It is empty. The snapshot's `Build [pressed]`, `xAI` and `grok-4.5` are **defaults** (`DEFAULT_WORKSPACE_EXECUTION_INTENT = 'workspace_mutation'`, `FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION`) and are not evidence that BUILD ran. The LIVE-05 phase attribution `CREATE_SESSION` is therefore confirmed, not merely assumed.

### 2.5 Conclusion of the elimination

The 600 s was consumed by **row 7 or row 9** — the un-timed project-create response observation pair:

```109:109:e2e/builder-golden-path/lib/live-adapters.ts
    const projectPayload = (await projectResponse.json()) as { id?: string };
```

```101:109:e2e/builder-golden-path/lib/live-adapters.ts
    const projectResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/projects\/?$/.test(new URL(response.url()).pathname) &&
        response.ok(),
    );
    await page.locator(SELECTORS.createProjectConfirm).click();
    const projectResponse = await projectResponsePromise;
    const projectPayload = (await projectResponse.json()) as { id?: string };
```

Between row 7 and row 9 the LIVE-05 artifacts cannot discriminate, and this is itself a defect of the runner configuration rather than a gap in the investigation:

- `playwright.live.config.ts` sets `trace: 'off'`, so **no `trace.zip` exists** — the artifact directory contains only `error-context.md` and `test-failed-1.png`.
- Playwright 1.62.1 builds the test-timeout error in `workerProcessEntry.js:456-470` as the bare string `Test timeout of 600000ms exceeded.` with no pending-call log, and there is no "Pending operations" section in this version. `errorContext.js:44-98` writes **every** entry of `testInfo.errors`; `error-context.md` contains exactly one, confirming no second error and no call log was ever recorded.
- Because `live.spec.ts` creates its own context from the `browser` fixture, the `context`-fixture close path (`index.js:390`) that would otherwise reject the pending action with a reason string never ran.

Both statements must be bounded in Step 2, so the residual ambiguity does not block the fix.

### 2.6 Why `SESSION_CREATE_TIMEOUT_MS=30000` never threw

Not because the listener failed, and not because the 30 s wait expired silently. `SESSION_CREATE_TIMEOUT_MS` is only consumed at line 135 (`waitForFirst`) and, partially, in the settle-window arithmetic at line 117. **Control never reached line 114.** The bounded wait AUTO-01D added sits *downstream* of the statement that actually hung, so it could not be entered, armed, or exceeded.

### 2.7 What LIVE-05 proves about LIVE-04's attribution

LIVE-04 ran the pre-AUTO-01D code, which after parsing the project response armed `page.waitForResponse` for `POST /api/sessions` and then clicked the project card **unconditionally** — both un-timed. AUTO-01D attributed the LIVE-04 hang to that session-response race.

LIVE-05 refutes that attribution as the operative cause:

- if the LIVE-04 hang had been the session-response race, LIVE-05's bounded `waitForFirst` would have thrown `SessionObservationError` within 30 s;
- if it had been the unconditional card click, LIVE-05's conditional card click is unreachable (2.2) and CREATE_SESSION would have completed.

Neither happened. The same upstream statement hung in both runs. AUTO-01D remains a correct and locked CONTRACT fix of a real latent race — it simply was never the LIVE blocker. **Do not reopen or convert AUTO-01D.**

---

## 3. Proven root cause

**The LIVE Builder runner performs the CREATE_SESSION project-create observation with Playwright operations that carry no timeout, under a configuration (`playwright.live.config.ts`, no `actionTimeout`/`navigationTimeout`) in which Playwright's default is "no timeout". The project-create response wait/parse at `lib/live-adapters.ts:101-109` therefore has no fail-closed bound and can only be ended by the outer 600000ms Playwright test timeout, which aborts outside `runGoldenPath` and skips the runner `finally`, cleanup, gate restoration and verdict. AUTO-01D bounded only the session-observation step at line 135, which is downstream of the hang and was never reached.**

Failure class remains **AUTOMATION_ADAPTER_FAILURE**. Not a product defect: the platform created the project, the session and the container correctly and the workspace rendered normally.

### Secondary unbounded surfaces found (same defect class, record for scope decisions)

- `lib/live-adapters.ts:126` fallback `card.click()` — unreachable today but still unbounded.
- `lib/live-adapters.ts:227` `page.goto()`, and `submitBuild()`'s `selectOption(...)` chains at 250-260 — the `.catch()` fallbacks there are dead code under a zero timeout, because a non-matching option never rejects.
- `lib/staging.ts:387-401` `createSshExecutor()` spawns `ssh` with no timeout; it is used by SAFETY and by `cleanup()`'s `restoreExecutionGateIfChanged()`, so a stalled SSH in cleanup would also hang the runner.

---

## 4. Why 56 passing AUTO-01D CONTRACT tests did not detect this

`tests/live-adapters.spec.ts` (755-881) drives `createProjectAndObserveSession()` against `createSessionRaceFixtureServer()` in `lib/local-fixture.ts`.

1. **Every fixture response completes instantly.** `local-fixture.ts:67-70` writes the whole JSON body and calls `res.end()` in one tick on `127.0.0.1`. `page.waitForResponse` and `response.json()` therefore always resolve in single-digit milliseconds. **No CONTRACT test has ever exercised a project-create response wait or body read that does not complete** — the exact statement that hung is never placed under stress.
2. **The unbounded-by-config behaviour is invisible.** The suite runs under `playwright.config.ts` with `timeout: 30_000` — twenty times shorter than LIVE — and it likewise sets no `actionTimeout`. A hang would surface within 30 s locally, but no fixture ever produces one. No test asserts anything about `liveConfig.use.actionTimeout`; the closest checks (743-753) assert only that `network.ts` *contains* `armSessionCreateListener` and that `SESSION_CREATE_TIMEOUT_MS` is between 30 s and 60 s — source shape, not enforced bounding.
3. **The fixture cannot model project auto-navigation or card disappearance.** In `auto-on-create` mode (`local-fixture.ts:140-146`) the card is created by `showCard()` and then stays in the DOM forever; there is no workspace view that replaces the projects panel. A card click can never become non-actionable, so the real "card renders, then is unmounted by `setWorkspaceView('project')`" sequence is untested.
4. **The fixture inverts the real ordering.** Because localhost latency is ~0, the fixture's `POST /api/sessions` resolves before the settle window even starts, so the tests always take the "already observed" branch. On staging the session POST includes container creation and takes seconds. The `on-card-click` test (793-810) proves the fallback works *when the card is permanently present*, which is not the production shape.
5. **Every test supplies an explicit `timeoutMs` (5000 or 400)** to `createProjectAndObserveSession`. That parameter bounds only the internal 30 s budget arithmetic; it does not bound any Playwright call. The `'never'` test (812-824) proves `SessionObservationError` fires fast, but only along a path where the project response already resolved.
6. **The runGoldenPath cleanup test (826-856) injects the error directly** (`recording.adapters.createSession = async () => { throw new SessionObservationError(...) }`). It proves the catch/finally/gate-restore chain given a thrown error; it cannot prove that a real adapter *produces* a thrown error rather than hanging.

In short: AUTO-01D's CONTRACT proves the fix it wrote, under a fixture whose timing and DOM lifecycle differ from staging in precisely the dimensions that matter.

---

## 5. Missing regression scenario for Step 2

At minimum, one negative fixture mode plus one configuration assertion:

1. **`project-response-stalls` fixture mode** — the fixture accepts `POST /api/projects` (so the click succeeds and the server-side project "exists") but never emits a matching, complete, ok response to the page. Assert `createProjectAndObserveSession()` rejects with a bounded adapter error in well under the configured test timeout, and that it never depends on the outer Playwright timeout.
2. **`auto-open-removes-card` fixture mode** — after the session POST the fixture removes the project card and replaces the panel, and the session POST is delayed past the settle window. Assert no card click is attempted, no duplicate `POST /api/sessions`, and a bounded outcome.
3. **Configuration guard test** — assert `liveConfig.use.actionTimeout` and `navigationTimeout` are finite, non-zero, and less than `liveConfig.timeout`, so the "no timeout" default can never silently return.
4. **Whole-phase bound test** — assert that a CREATE_SESSION adapter miss returns through `runGoldenPath` with `CLEANUP` executed and the gate restored, measured end-to-end against a stalling fixture rather than an injected throw.

---

## 6. Smallest safe Step 2 fix (recommended; NOT implemented in Step 1)

1. `e2e/builder-golden-path/playwright.live.config.ts` — add `actionTimeout` and `navigationTimeout` to `use` (a finite bound well under `timeout`), and set `trace: 'retain-on-failure'` so the next LIVE failure is diagnosable per statement. Explicit per-call timeouts already in the adapter (`AUTO_APPLY_TIMEOUT_MS`, `BUILD_TIMEOUT_SAFE`, `PREVIEW_TIMEOUT_MS`, the 60 s prompt wait) continue to win over the default, so long legitimate waits are unaffected.
2. `e2e/builder-golden-path/lib/live-adapters.ts:101` — pass an explicit `{ timeout: SESSION_CREATE_TIMEOUT_MS }` to the project-create `page.waitForResponse`.
3. `e2e/builder-golden-path/lib/live-adapters.ts:109` — bound the body read. `Response.json()` uses `kNoTimeout` and is immune to `actionTimeout`, so it must be wrapped in an explicit race with a timer that rejects with a typed adapter error. **This is the one place a config-level timeout cannot save.**
4. `e2e/builder-golden-path/lib/live-adapters.ts:126` — give the fallback card click an explicit remaining-budget timeout.
5. Add the regression fixtures/tests from section 5.

Deliberately out of scope for the smallest fix: the SSH executor timeout (section 3), `submitBuild`'s dead `.catch()` fallbacks, any product source, any LIVE rerun.

**Files expected to change in Step 2:** `e2e/builder-golden-path/playwright.live.config.ts`, `e2e/builder-golden-path/lib/live-adapters.ts`, `e2e/builder-golden-path/lib/local-fixture.ts`, `e2e/builder-golden-path/tests/live-adapters.spec.ts`, and only if a new typed error is required, `e2e/builder-golden-path/lib/network.ts` and `e2e/builder-golden-path/lib/constants.ts`. No product source. No package/lockfile change.

Step 2 validation is CONTRACT only: `npx tsc --noEmit --project e2e/builder-golden-path/tsconfig.json` and `npm run e2e:builder:contract`. No LIVE, staging, provider or credit activity.

---

## 7. Answers to the Step 1 investigation questions

| Question | Answer |
|---|---|
| A. `waitForFirst()` failed to enforce 30 s | **NO** — never entered; control never reached line 135 |
| B. fallback card click auto-waited to 600 s | **NO** — provably unreachable (section 2.2) |
| C. project response parsing blocked | **CANDIDATE (line 109)** — unbounded `kNoTimeout` body read |
| D. session response callback/body parsing blocked | **NO** — that path is bounded by `waitForFirst` |
| E. navigation/context replacement interfered with the listener | **NO** — the listener is armed at line 99 before any create action and is never disposed early; the app performs client-side view switching, not context replacement |
| F. session POST invisible to the page listener | **NO** — page-level response observation demonstrably works in this environment (STARTING_BALANCE's `page.waitForResponse` on `/api/billing/balance` succeeded), and the session POST is an ordinary page `fetch` |
| G. another cause | **YES — the operative one:** un-timed project-create response observation at lines 101-109 under a zero-default-timeout config (section 3) |

---

## 8. Control-plane state at end of Step 1

```
STEP_1=COMPLETE
STEP_2=PENDING (bounded implementation + CONTRACT validation)
STEP_3=PENDING (consolidation / checkpoint / lock)
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED
```

LIVE-01 / LIVE-02 / LIVE-03 / LIVE-04 / LIVE-05 and AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D remain COMPLETE AND LOCKED and unedited. No LIVE rerun is authorized by this diagnosis.
