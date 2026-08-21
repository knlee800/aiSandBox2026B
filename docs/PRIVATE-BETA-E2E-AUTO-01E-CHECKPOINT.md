# PRIVATE-BETA-E2E-AUTO-01E — Final Checkpoint

**Task ID:** PRIVATE-BETA-E2E-AUTO-01E  
**Title:** LIVE-05 CREATE_SESSION 600s Timeout Root-Cause Investigation and Bounded Adapter Fix  
**Parent:** PRIVATE-BETA-E2E-AUTO-01 — COMPLETE AND LOCKED — PASS — 2026-08-20  
**Predecessor:** PRIVATE-BETA-E2E-LIVE-05 — COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — CREATE_SESSION — 2026-08-21  
**Final Status:** COMPLETE AND LOCKED — PASS — 2026-08-21  
**Checkpoint Date:** 2026-08-21  
**Lifecycle:** 3-step  
**Workstream:** RELIABILITY  
**Evidence class:** LOCAL-TESTS  
**Classification:** AUTOMATION_TOOLING_INVESTIGATION + bounded AUTOMATION_TOOLING_FIX  
**Product defect:** NOT PROVEN — no evidence  
**Production source modification:** NO  
**Nature of Step 3:** GOVERNANCE / CONSOLIDATION ONLY — no implementation, LIVE, staging, SSH, provider, credit, env, gate, package, or Git mutation

```
ROOT_CAUSE_PROVEN=YES
AUTOMATION_TOOLING_FIX=YES
PRODUCT_DEFECT=NOT PROVEN / NO EVIDENCE
PRODUCTION_SOURCE_MODIFICATION=NO
CREATE_SESSION_PROJECT_OBSERVATION_BOUNDED=YES
FAIL_CLOSED_INSIDE_runGoldenPath=YES
CONTRACT_TESTS=64 passed (56 pre-existing + 8 new)
TYPESCRIPT=PASS
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
LIVE-05_RERUN=NO
LIVE-04_RERUN=NO
AUTO-01D_REOPENED=NO
PROVIDER_CALL_USED=0
CREDITS_DEDUCTED=0
```

Step 2 implementation is already on HEAD `c3c65d3289d089b4970e6551552775f9e540f1e0` (`bound automated E2E project observation`). Keith owns Git. This consolidation does not commit.

Do not treat this checkpoint as a scheduler. Do not freeze a staging deployment SHA here. Do not rerun LIVE-05 or LIVE-04. Do not retry LIVE-03/02/01. Do not reopen AUTO-01D. Do not register the next LIVE lifecycle here.

---

## 1. Lifecycle

1. Registration + root-cause investigation (diagnostic only) — COMPLETE — 2026-08-21 — `docs/PRIVATE-BETA-E2E-AUTO-01E-DIAGNOSIS.md`
2. Bounded implementation + CONTRACT validation — COMPLETE — 2026-08-21 — HEAD `c3c65d3`
3. Consolidation / checkpoint / lock — COMPLETE — 2026-08-21 — this document

Lane 1 only throughout. Lane 2 EMPTY throughout. Lane 3 DISABLED throughout.

---

## 2. Step 1 root-cause proof — the blocker was UPSTREAM of the AUTO-01D observer

AUTO-01E proved that the operative LIVE-05 blocker sat **upstream** of the bounded session observer AUTO-01D added.

Proven mechanism:

- `e2e/builder-golden-path/playwright.live.config.ts` declared a global test `timeout` of `600000ms`.
- That config declared **no `actionTimeout` and no `navigationTimeout`**. In `@playwright/test` 1.62.1 an absent value does not fall back to 30s — the auto fixture `_setupContextOptions` resolves it to `0`, and `Browser._setupBrowserContext()` applies `setDefaultTimeout(0)` to every `browser.newContext()`, including the manual context from `lib/auth.ts:46`. Zero means **no timeout**.
- The project-create `page.waitForResponse(POST /api/projects && ok)` carried **no explicit `{ timeout }`**.
- `await projectResponse.json()` used an **unbounded body-read path**. `Response.json()` is issued with `kNoTimeout` and is therefore immune even to a config-level `actionTimeout`.
- Control therefore **never reached** AUTO-01D's `SESSION_CREATE_TIMEOUT_MS=30000` wait.
- Consequently the outer Playwright test timeout aborted **outside** `runGoldenPath`.
- The runner `finally` / cleanup was **skipped**: no CLEANUP, no gate restoration, no formatted verdict.

The pre-registered high-priority hypothesis — that the fallback project-card click auto-waited to 600s — was **disproven**. Its guard requires `!hasObserved() && card.count() > 0` simultaneously, and the frontend only renders the new project card after `POST /api/sessions` has resolved, at which point `hasObserved()` is already true.

Full analysis: `docs/PRIVATE-BETA-E2E-AUTO-01E-DIAGNOSIS.md`.

Failure class remains **AUTOMATION_ADAPTER_FAILURE**. The platform created the project, the session and the container correctly and rendered the workspace normally.

---

## 3. AUTO-01D historical interpretation — unchanged and not rewritten

PRIVATE-BETA-E2E-AUTO-01D remains historically:

**COMPLETE AND LOCKED — PASS — CONTRACT**

It remains a valid latent race fix. Its bounded wait simply sits downstream of the statement that actually hung, so it was never entered and was never the LIVE blocker.

AUTO-01D is **not** reopened, **not** converted to FAIL, and **not** edited. `LIVE_VALIDATION_OF_AUTO_01D_SUFFICIENCY` remains `FAIL`.

PRIVATE-BETA-E2E-LIVE-05 remains **COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — CREATE_SESSION**, is not converted to PASS, and is not rerun. Historical AUTO-01D and LIVE-05 evidence is not rewritten by this lock.

---

## 4. Step 2 implementation

Files changed (exactly six, all inside the declared Step 2 write scope):

- `e2e/builder-golden-path/playwright.live.config.ts`
- `e2e/builder-golden-path/lib/constants.ts`
- `e2e/builder-golden-path/lib/network.ts`
- `e2e/builder-golden-path/lib/live-adapters.ts`
- `e2e/builder-golden-path/lib/local-fixture.ts`
- `e2e/builder-golden-path/tests/live-adapters.spec.ts`

No production frontend/backend source. No package/lockfile change. No dependency added.

### 4.1 LIVE config defaults

| Setting | Value |
|---|---|
| `use.actionTimeout` | **30000** (new) |
| `use.navigationTimeout` | **60000** (new) |
| `timeout` (global test) | **600000** — unchanged |
| `use.trace` | **'off'** — unchanged |
| `retries` | 0 — unchanged |

Both new defaults are declared as named constants (`LIVE_ACTION_TIMEOUT_MS`, `LIVE_NAVIGATION_TIMEOUT_MS`) so the "absent means zero means no timeout" default can never silently return. Existing explicit per-call timeouts (`AUTO_APPLY_TIMEOUT_MS`, `BUILD_TIMEOUT_MS`, `PREVIEW_TIMEOUT_MS`, the 60s prompt wait) continue to win over the defaults, so legitimate long waits are unaffected.

`trace` was deliberately left `'off'` and is asserted as `'off'` by CONTRACT. The Step 1 recommendation to switch to `'retain-on-failure'` was **not** adopted and is recorded below as residual, out-of-scope work.

### 4.2 Bounded project CREATE_SESSION observation

| Bound | Constant | Value |
|---|---|---|
| project-create `waitForResponse` | `PROJECT_CREATE_OBSERVATION_TIMEOUT_MS` | **30000** |
| project-create response body read | `PROJECT_CREATE_BODY_TIMEOUT_MS` | **30000** |
| fallback project-card click | `PROJECT_CARD_CLICK_TIMEOUT_MS` | **10000** |

- The project `waitForResponse` is explicitly bounded at 30000ms via `{ timeout: projectResponseTimeoutMs }`.
- The project response body read is explicitly bounded at 30000ms by `readProjectCreateBody()`, which owns its own timer race because Playwright issues body reads with no timeout at all and neither the config `actionTimeout` nor a per-call option can reach them.
- The fallback project-card click is explicitly bounded at 10000ms via `card.click({ timeout: cardClickTimeoutMs })`.
- All three bounds are overridable per call for test purposes and default to the constants above in LIVE.

### 4.3 Typed fail-closed path

- All three failures raise **`ProjectCreateObservationError`** (new, exported from `lib/network.ts`).
- The error is raised **inside `runGoldenPath`**.
- The runner `catch` / `finally` therefore remains **reachable**: CLEANUP runs, the execution gate is restored, and a formatted FAIL verdict is emitted.
- An adapter miss at CREATE_SESSION can no longer require the outer 600-second Playwright timeout to regain cleanup control.

### 4.4 AUTO-01D semantics preserved

- The session listener is still armed **before** project confirmation.
- Early session observation is retained.
- An observed session still suppresses the card fallback.
- No duplicate `POST /api/sessions` is triggered.
- `SESSION_CREATE_TIMEOUT_MS` is unchanged at 30000.
- `SessionObservationError` is unchanged.

The AUTO-01D frozen contract is bounded upstream only; it is not weakened.

---

## 5. Regression coverage

Four new local-fixture modes:

- `project-response-stalls` — `POST /api/projects` accepted server-side, but the page never observes a matching complete ok response.
- `project-body-stalls` — headers arrive so Playwright reports an ok response, but the body never completes.
- `card-not-actionable` — the project card renders disabled so a click can never become actionable.
- `auto-open-removes-card` — the session POST is delayed past the settle window, then the card renders and is removed, modelling real project auto-navigation.

Eight new CONTRACT tests. Proven behaviour:

- a stalled project-create response fails bounded, with a typed `ProjectCreateObservationError`, well inside the outer LIVE timeout;
- a stalled project-create response **body** fails bounded, with a typed error naming the response body;
- both failures return verdict **FAIL** at phase **CREATE_SESSION**;
- **CLEANUP** is reached and is the last recorded phase;
- the execution gate is restored to `false` (`executionGateFinal = 'restored-false'`);
- **BUILD** is never reached;
- `providerGuard.usedCount = 0` and `providerGuard.remaining = 1`;
- the non-actionable card path cannot hang indefinitely, and attempts zero card clicks;
- the auto-open / card-removal path creates exactly one session POST — no duplicate — and clicks no card;
- the LIVE config guard asserts every bound is finite, non-zero and less than the outer test timeout, with `timeout` still 600000, `trace` still `'off'` and `retries` still 0;
- a source-shape guard asserts the explicit bounds exist and that the old unbounded `await projectResponse.json()` and `await card.click();` statements are gone;
- all pre-existing AUTO-01D regressions remain passing.

---

## 6. Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit --project e2e/builder-golden-path/tsconfig.json` | **PASS** |
| `npm run e2e:builder:contract` | **64 passed** (56 pre-existing + 8 new) — PASS |
| `git diff --check` | **PASS** — clean tree, no output; informational line-ending warnings only when present |

Not performed in AUTO-01E (any step):

- `npm run e2e:builder:live`
- PRIVATE-BETA-E2E-LIVE-05 rerun
- PRIVATE-BETA-E2E-LIVE-04 rerun
- PRIVATE-BETA-E2E-LIVE-03/02/01 retry
- SSH / staging deployment / staging mutation
- provider call
- credit mutation
- execution-gate mutation
- dependency / lockfile change
- product source modification
- Git mutation
- browser live smoke

```
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
PROVIDER_CALL_USED=0
CREDITS_DEDUCTED=0
STAGING_ACTIVITY=NONE
GATE_MUTATION=NONE
```

---

## 7. Residual / explicitly out-of-scope timeout surfaces

AUTO-01E **identified** these secondary unbounded surfaces and **did not modify them**. They are **not** fixed and must not be claimed as fixed:

- unrelated `page.goto()` in `lib/live-adapters.ts` (now covered by the new `navigationTimeout` default, but not individually bounded);
- `submitBuild()`'s provider/model `selectOption` fallbacks — their `.catch()` branches were dead code under a zero timeout;
- `createSshExecutor()` in `lib/staging.ts` — spawns `ssh` with no timeout and is used by SAFETY and by `cleanup()`'s gate restoration, so a stalled SSH in cleanup could still hang the runner;
- `playwright.live.config.ts` `trace: 'off'` — a future LIVE failure still produces no `trace.zip`.

These are separate possible hardening work. They are **not** blockers to locking AUTO-01E's bounded CREATE_SESSION fix.

---

## 8. Readiness consequence

AUTO-01E PASS means the LIVE-05 CREATE_SESSION project-observation hang is bounded and fail-closed **in CONTRACT**. A CREATE_SESSION adapter miss now terminates inside `runGoldenPath` with CLEANUP, gate restoration and a formatted verdict.

It does **not** prove LIVE staging golden-path validation. AUTO-01E is CONTRACT-only.

```
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED
```

A new fresh automated LIVE E2E must validate the corrected automation against staging before any private-beta readiness claim.

**Next recommended lifecycle (NOT REGISTERED HERE):** a fresh automated LIVE Builder E2E using the AUTO-01E runner. Likely identifier **PRIVATE-BETA-E2E-LIVE-06** — repo-wide search found zero occurrences at this lock, but the identifier **must be re-verified unused at registration**.

That future LIVE lifecycle must:

- deploy / verify the current clean authorized HEAD;
- run the automated golden path exactly once;
- consume one xAI / grok-4.5 provider-call budget;
- perform zero retries;
- allow an intentional qualifying credit deduction only if the golden path reaches it;
- preserve every hard safety gate;
- verify cleanup regardless of verdict.

It is **not** registered or authorized by this lock. Do not rerun LIVE-05. Do not rerun LIVE-04. Do not retry LIVE-03/02/01. Do not reopen AUTO-01D. Do not return to manual browser testing.

---

## 9. Step 3 consolidation writes

- `docs/PRIVATE-BETA-E2E-AUTO-01E-CHECKPOINT.md` — this document
- `TASKS.md` CURRENT EXECUTION BOARD only — AUTO-01E LOCKED; Lane 1 EMPTY; Lane 2 EMPTY; Lane 3 DISABLED; HOTFILE / GOVERNANCE released
- `TASKS_BACKLOG_FULL.md` — AUTO-01E final status / current recommendation only

No implementation change, and no locked-body rewrite, in Step 3.

Preserved and not modified in this consolidation:

- `docs/PRIVATE-BETA-E2E-AUTO-01E-DIAGNOSIS.md`
- `docs/PRIVATE-BETA-E2E-LIVE-05-CHECKPOINT.md`
- `docs/PRIVATE-BETA-E2E-LIVE-05-EXECUTION.md`
- `docs/PRIVATE-BETA-E2E-AUTO-01D-CHECKPOINT.md`

---

**PRIVATE-BETA-E2E-AUTO-01E — COMPLETE AND LOCKED — PASS — 2026-08-21**
