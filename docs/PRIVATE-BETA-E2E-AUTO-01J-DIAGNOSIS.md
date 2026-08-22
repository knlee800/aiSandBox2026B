# PRIVATE-BETA-E2E-AUTO-01J — Step 1 Diagnosis

**Task ID:** PRIVATE-BETA-E2E-AUTO-01J
**Title:** Automatic Checkpoint Observation Contract — Root Cause and Bounded Adapter Contract
**Classification:** AUTOMATION_TOOLING_INVESTIGATION
**Owning fix (this diagnosis):** AUTOMATION_ADAPTER_FIX
**Workstream:** RELIABILITY
**Lifecycle:** 3-step bounded task (Step 1 registration + investigation; Step 2 smallest proven TDD adapter correction; Step 3 consolidation/checkpoint/lock)
**Step:** 1 — COMPLETE
**Date:** 2026-08-22
**Lane:** Lane 1
**Parent runner:** PRIVATE-BETA-E2E-AUTO-01 (COMPLETE AND LOCKED — PASS)
**Triggering evidence:** PRIVATE-BETA-E2E-LIVE-09 (COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — CHECKPOINT — 2026-08-22)

LIVE-09 historical classification remains AUTOMATION_ADAPTER_FAILURE. This document does not rewrite LIVE-09.

```
STEP_1_IMPLEMENTATION_PERFORMED=NO
PRODUCT_SOURCE_MODIFIED=NO
AUTOMATION_IMPLEMENTATION_MODIFIED=NO
LIVE_RUNS=0
SSH_CONNECTIONS=0
STAGING_ACCESS=0
PROVIDER_CALLS=0
CREDITS_MUTATED=0
GATE_MUTATION=0
PROJECT_SESSION_CONTAINER=0
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
PHASE_ORDER_CHANGED=NO
PUBLIC_CONFIRM_DEPENDENCY=NO
BOUNDED_POLLING_REQUIRED=YES
PRODUCT_CHANGE_REQUIRED=NO
ROOT_CAUSE_PROVEN=YES
```

Local tree at Step 1 (read-only before governance writes):

- branch = `main`
- `git rev-parse HEAD` = `ea4c314aca7df88e0a5046764714f53169899db8`
- `git status --short` = empty (CLEAN)

This SHA is recorded as an observation only. It is **not** frozen as a required Step 2 SHA.

---

## 1. Identifier verification

`PRIVATE-BETA-E2E-AUTO-01J` was **unused as a registered task** before this registration.

Repo-wide search found exactly one occurrence, all historical recommendation prose:

| Location | Nature |
|---|---|
| `docs/PRIVATE-BETA-E2E-LIVE-09-CHECKPOINT.md:545` | “Likely identifier if later registered: **PRIVATE-BETA-E2E-AUTO-01J** … repo search at this lock found **zero** occurrences.” |

`TASKS.md` CURRENT EXECUTION BOARD also contained LIVE-09 lock prose “Do not register PRIVATE-BETA-E2E-AUTO-01J here” and a recommended-next line. `TASKS_BACKLOG_FULL.md` contained **zero** `### PRIVATE-BETA-E2E-AUTO-01J` registry entries. Historical recommendation prose does not count as prior registration.

Rejected alternatives: reopening LIVE-09 / LIVE-08 / AUTO-01G / AUTO-01H / AUTO-01I / 03L; registering PRIVATE-BETA-INVITE-01; a product checkpoint-creation change; a phase reorder.

---

## 2. Admission / state

Admitted to **Lane 1** as ACTIVE at Step 1. Lane 2 EMPTY. Lane 3 DISABLED.

Admission checks: lane capacity available (0/2 used at admission); Start condition READY; dependencies satisfied (LIVE-09 locked FAIL/BLOCKED at CHECKPOINT; AUTO-01G/H/I and 03L locked PASS); no dependency on unfinished lane output; write scope is governance/diagnosis only in Step 1; GOVERNANCE acquired for this board/registry/diagnosis write then released; STAGING / PROVIDER-LIVE / CREDIT / ENV not acquired; selected CHECKPOINT-observation HOTFILE leases held for Step 2; evidence class LOCAL-TESTS for Step 2; revert isolation acceptable.

No runtime, staging, provider, credit, or gate authority is granted.

---

## 3. Frozen LIVE-09 symptom (not rewritten)

```
FAILED_PHASE=CHECKPOINT
LAST_SUCCESSFUL_PHASE=PREVIEW
error=No automatic checkpoint was returned.
projectId=f76bfec0-5b81-46cf-9d9c-4858391f0a45
sessionId=9a6a6f67-3ec2-40f9-9d1f-b0ba609bc118
executionId=4f7dffc4-b29c-4e9e-afeb-bee6ba96ed40
Provider=xAI / grok-4.5
calls=1
retries=0
tokens_used=1159
PREVIEW=PASS
AUTO-01I / AUTO-01H / AUTO-01G / 03L=HELD
```

Runner CHECKPOINT:

- one `GET /api/sessions/:sessionId/checkpoints`
- returned empty list
- immediately failed `No automatic checkpoint was returned.`

Product later had automatic checkpoint:

- id `7f38c86a3cf2427bc40c0e563d9ccd2854ccc63a`
- timestamp `13:19:53` (`2026-08-22 13:19:53.161442`)
- description `AI: applied workspace file actions`
- `files_changed=1`

Product `confirm_build_apply.deduction_triggered` = `13:19:47`. Exact runner checkpoint GET timestamp = **UNKNOWN**. Do not infer race solely from those two timestamps. The root cause below is from **encoded product/runner source**, with LIVE-09 as the observed failure mode.

---

## 4. Exact runner CHECKPOINT implementation

Orchestration — `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\runner.ts` `runGoldenPath()`:

```146:148:e2e/builder-golden-path/lib/runner.ts
    mark('CHECKPOINT');
    const checkpoint = await input.adapters.verifyCheckpoint();
    checkpointHash = checkpoint.commitHash;
```

Phase order (`lib/phases.ts`): PREVIEW immediately before CHECKPOINT; CHECKPOINT is a `SLOW_EVIDENCE` phase after PREVIEW; PUBLIC_CONFIRM follows CHECKPOINT. Frozen order is structurally valid (see §12).

LIVE adapter — `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\live-adapters.ts` `createLiveAdapters()` → `verifyCheckpoint()`:

```375:384:e2e/builder-golden-path/lib/live-adapters.ts
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
```

Selection — `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\evidence.ts` `pickAutomaticCheckpoint()` / `validateCheckpoint()`:

1. Find first row whose `description` (lowercased) includes `applied workspace file actions`.
2. Else take `checkpoints[0]`.
3. If none, throw `EvidenceError('No automatic checkpoint was returned.')`.
4. Else require non-empty `commitHash` and `filesChanged >= 1`.

CONTRACT stub (`lib/runner.ts` `createContractAdapters().verifyCheckpoint`) returns `{ commitHash: 'abc123def456', filesChanged: 1 }` immediately with **no HTTP**.

### Answers from this implementation

| Question | Answer |
|---|---|
| Exactly one HTTP GET? | **YES** |
| Retry / polling today? | **NO** |
| Finite observation timeout? | **NO dedicated checkpoint observation timeout.** One GET; Playwright `page.request.get()` has no per-call timeout in this function. LIVE `actionTimeout=30000` does not bound `APIRequestContext.json()` body reads (AUTO-01E proven `kNoTimeout` for Playwright body reads). |
| Require newest checkpoint? | **NO.** Prefers description match; otherwise first array element. Gateway list is newest-first after `.reverse()`, so `[0]` is newest only if no description match is used. |
| Correlate description? | **YES, as preference only.** Fallback to `[0]` ignores description. |
| Correlate `filesChanged`? | **After selection**, via `validateCheckpoint` (`>= 1`). |
| Correlate `executionId`? | **NO.** Schema has no `executionId`. |
| Correlate time? | **NO.** |
| Accidental stale accept? | **YES, latent.** Fallback to `[0]` would accept `Initial commit` or any other session row. LIVE-09 did not hit this: empty list threw before selection. |

`sessionId` supplied: the LIVE adapter closure written by `createSession()` (`live-adapters.ts:290-294`) from `POST /api/sessions` capture. LIVE-09 fail summary and product row used the same `sessionId=9a6a6f67-3ec2-40f9-9d1f-b0ba609bc118`.

Auth: `page.request.get` on the authenticated Playwright context (session cookie). Non-OK would throw `Checkpoint list HTTP ${status}`. LIVE-09 threw the empty-list `EvidenceError`, so the GET was HTTP OK with empty/non-array payload. `Array.isArray` false is coerced to `[]` (hides schema mismatch as empty).

---

## 5. Checkpoint API (GET list)

Public route:

`GET /api/sessions/:id/checkpoints`

Layers (absolute Windows paths):

1. Browser / Playwright → `https://staging.ainow.biz/api/sessions/:sessionId/checkpoints`
2. Frontend Next rewrite fallback `frontend/next.config.js` `/api/:path*` → API gateway
3. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\checkpoints\checkpoints.controller.ts` `listCheckpoints()` — `@UseGuards(SessionCookieGuard)`; 401 unauthenticated; 404 if session missing or not owned
4. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\checkpoints\checkpoints.service.ts` `listCheckpoints()`
5. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\git-checkpoints\git-checkpoint.service.ts` `getSessionTimeline()`
6. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\repositories\git-checkpoint.repository.ts` `getCheckpointsBySession()`

**Storage owner:** PostgreSQL table `git_checkpoints` (TypeORM entity `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\entities\git-checkpoint.entity.ts`). Container-manager also has a local SQLite `checkpoints` table for backward compatibility; the **public list does not read it**.

**Query:** synchronous TypeORM `find({ where: { sessionId }, order: { createdAt: 'ASC' } })` then `.reverse()` for newest-first. No pagination query params. No description/execution filter. Empty `[]` is a valid response when no rows exist.

**Visibility after commit:** `recordCheckpoint()` `repository.save()` is awaited on the create path before the create HTTP response returns. A committed row is immediately visible to a subsequent list GET on the same gateway/database. There is no eventual-consistency queue on the list path.

**Stale rows:** the endpoint returns **all** session rows, including `Initial commit` if that ledger row exists. It can therefore return older checkpoints from prior actions in the same session. A brand-new disposable session can also return `[]` until the first ledger insert.

Response DTO (`checkpoint-response.dto.ts` / frontend `WorkspaceCheckpoint`):

```
id, commitHash, messageNumber, description, filesChanged, createdAt
```

CamelCase matches runner `CheckpointEvidence` for `commitHash` / `filesChanged` / `description`. H4 (parse mismatch) is **not** the LIVE-09 empty-list failure. Coercing non-array to `[]` remains a latent fail-open-as-empty defect for Step 2 to close.

Container-manager `GET /api/git/:sessionId/checkpoints` (`git.controller.ts`) is a **different** internal/CM route. The runner does not call it. Gateway public list is the correct product surface.

---

## 6. Exact automatic checkpoint creation path

LIVE-09 description `AI: applied workspace file actions` is the frontend constant:

`C:\Users\knlee\aiSandBox2026B\frontend\app\[locale]\app\page.tsx`

```
const AI_AUTO_CHECKPOINT_DESCRIPTION = 'AI: applied workspace file actions';
```

Creation is **not** a backend side-effect of file write, execution completion, or confirm-build-apply.

Encoded path:

1. File actions applied — `applyExecutionFileActions()` (`page.tsx`) awaits `applySequentialFileActions()` (workspace writes, including `POST /api/sessions/:sessionId/files/write`).
2. React state set to `applyStatus: 'applied'` via `setExecutionFileActionState`.
3. **Then** `await confirmBuildApplyIfQualifying()` → `POST /api/ai/executions/:executionId/confirm-build-apply` → gateway `triggerBuildApplyDeduction` (LIVE-09 `deduction_triggered` 13:19:47).
4. A `useEffect` on `chatExecutionFileActionStates` (`page.tsx` ~5245) asynchronously calls `maybeRunExecutionCoherence(executionId)`.
5. `maybeRunExecutionCoherence` requires `applyStatus === 'applied'` and a successful write result, then awaits `runAiActionCoherence()`.
6. `C:\Users\knlee\aiSandBox2026B\frontend\components\workspace\workspace-ai-coherence.logic.ts` `runAiActionCoherence()` **in order, all awaited**:
   - `refreshFileTree()`
   - optional `reloadEditorFile()`
   - `refreshPreview()` → `refreshPreviewForSession(sessionId, true)` (status GET; may `POST /api/preview/:id/start`; may poll up to 5 × 800ms)
   - **then** `createCheckpoint(description)`
7. `createWorkspaceCheckpoint()` (`workspace-checkpoint-create.logic.ts`) `POST /api/sessions/:sessionId/checkpoints` with `{ userId, messageNumber: 0, description }`.
8. Gateway `CheckpointsController.createManualCheckpoint` → `CheckpointsService.createManualCheckpoint` → container-manager `POST /api/git/:sessionId/commit`.
9. CM `GitService.commit()`: `ensureGitInitializedInContainer` (git init **without** ledger Initial commit if the repo was missing), `git add -A`, `git commit`, then `createCheckpoint()` which **awaits** `apiGatewayClient.recordGitCheckpoint()` into PostgreSQL `git_checkpoints`.

**Synchronous vs asynchronous:** the git commit + DB insert are synchronous **inside the create POST**. The **trigger** is asynchronous relative to AUTO_APPLY and relative to runner PREVIEW: React `useEffect` after apply state, and coherence **deliberately awaits preview refresh before create**.

It is **not** fire-and-forget at the create POST itself (`await createCheckpoint`). It **is** decoupled from the file-write request lifecycle and from confirm-build-apply. Confirm and coherence are sibling branches after `applyStatus='applied'` (confirm is awaited in `applyExecutionFileActions`; coherence is a later effect). Checkpoint does **not** wait for confirm. Confirm does **not** wait for checkpoint.

`ensureGitInitializedInContainer` does not record `Initial commit` into `git_checkpoints`. LIVE-09 “exactly one row” is consistent: the automatic AI checkpoint can be the first ledger row. Empty `[]` **before that POST completes** is a valid product response.

There is **no product-encoded maximum latency** for coherence.

---

## 7. Event graph (code-grounded)

Shared prefix (single awaited chain in the page):

```
BUILD POST /api/ai/execute 202 (executionId)
  → provider result / file-action stream
  → applySequentialFileActions
       → workspace file write(s)   [AUTO_APPLY signal: files/write 204]
  → setExecutionFileActionState(applyStatus='applied')
```

Then two branches:

**Branch A — confirm / deduction (awaited in applyExecutionFileActions):**

```
confirmBuildApplyIfQualifying
  → POST /api/ai/executions/:executionId/confirm-build-apply
  → triggerBuildApplyDeduction
  → LIVE-09 deduction_triggered 13:19:47
```

**Branch B — coherence / checkpoint (React useEffect, not on Branch A):**

```
useEffect(chatExecutionFileActionStates)
  → maybeRunExecutionCoherence
  → runAiActionCoherence
       → refreshFileTree
       → refreshPreview (autoStart=true)     [may overlap runner PREVIEW]
       → POST /api/sessions/:id/checkpoints
       → CM git commit + recordGitCheckpoint
       → LIVE-09 row 13:19:53
```

**Runner (observer, not product causal chain):**

```
WAIT_FOR_AUTO_APPLY  (files/write 204)     ← after write, BEFORE Branch A and B
PREVIEW              (click Start Preview, wait iframe h1 ≤ 15s)
CHECKPOINT           (ONE list GET, fail if [])
PUBLIC_CONFIRM       (NOT REACHED; listener already armed; product Branch A already fired)
```

Confirm/deduction at 13:19:47 and checkpoint at 13:19:53 are **not** a causal confirm→checkpoint wait. They share the earlier apply. The ~6s gap is explained by Branch B work (effect + file tree + preview refresh + git commit), not by deduction.

---

## 8. PREVIEW timing coupling

- Checkpoint **creation is not started before Preview as a product invariant.** Coherence may start around the same time the runner enters PREVIEW, and it **awaits its own preview refresh before create**.
- Runner PREVIEW (`startAndAssertPreview`, `PREVIEW_TIMEOUT_MS=15000`) only needs the iframe `h1`. That can succeed as soon as static preview is serving `index.html`, which AUTO_APPLY already persisted.
- Coherence `refreshPreviewForSession` and runner `handleStartPreview` share `previewRequestIdRef`; a later start **aborts** an earlier refresh by request-id, but `runAiActionCoherence` still proceeds to `createCheckpoint` after `refreshPreview` returns (including early stale returns).
- Preview duration **must not** be treated as a checkpoint-ready bound. There is no formal maximum. LIVE-09 PREVIEW PASS then immediate empty GET is the accidental coupling: the adapter currently depends on Preview taking “long enough” for Branch B to finish. It does not always.

Recorded as a **timing coupling**, not as a reason to reorder phases.

---

## 9. Correlation fields and stale risk

`git_checkpoints` columns: `id`, `sessionId`, `commitHash`, `messageNumber`, `description`, `filesChanged`, `createdAt`.

**No `executionId`.** Do not invent one.

| Candidate | Usable? |
|---|---|
| `sessionId` | YES — already in the GET URL. Fresh disposable session. |
| `projectId` | Not on the checkpoint row. |
| `executionId` | NOT on schema. Cannot link directly. |
| `description` | YES — strongest semantic marker: contains `applied workspace file actions`. |
| `filesChanged` | YES — require `>= 1` (rejects typical Initial commit `0`). |
| `commitHash` / id | YES — require non-empty hash after match. |
| `createdAt` | Present; no runner “after BUILD start” comparison today. Weak without a captured BUILD timestamp contract. |
| workspace path | Not on the list DTO. |

**Strongest stable correlation available (no invented fields):**

same `sessionId` AND description includes `applied workspace file actions` AND non-empty `commitHash` AND `filesChanged >= 1`.

- “First non-empty checkpoint” is **unsafe** (Initial commit / unrelated row).
- “Latest checkpoint after BUILD start” is **not encoded** (no execution link; time-only is weak if another checkpoint appears). Prefer description match on this session.
- Direct `executionId` link: **NO**.

If multiple matching rows appear, take the first description match on the newest-first list (newest matching automatic checkpoint). For the golden-path disposable session that is the expected row.

---

## 10. Local fixture fidelity

`C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\local-fixture.ts`

- `createLocalFixtureServer()`: **no** `GET /api/sessions/:id/checkpoints` route (falls through to 404).
- `createAutoApplyFixtureServer()`: **no** checkpoints route.

CONTRACT golden path uses `createContractAdapters().verifyCheckpoint()` which **returns a checkpoint immediately with no GET**.

`tests/live-adapters.spec.ts` has **zero** `verifyCheckpoint` behavioral tests. `tests/evidence.spec.ts` only unit-tests `pickAutomaticCheckpoint` against an already-populated array.

**Fixture fidelity verdict:** the CONTRACT suite **does not model LIVE-09**. It is optimistic: first observation is treated as already populated (in-process stub) or the HTTP surface is missing.

Faithful RED regression (do not implement in Step 1):

```
GET #1  → HTTP 200 []
later GET (≥1) after a bounded interval → HTTP 200 [
  { commitHash, filesChanged: 1, description: 'AI: applied workspace file actions' }
]
current adapter fails immediately on GET #1 with:
  No automatic checkpoint was returned.
```

Also required negatives: HTTP error fail-closed; non-array body fail-closed (not coerced to `[]`); stale `Initial commit` / other description ignored; timeout with never-appearing match fails closed.

---

## 11. Working comparison examples

| Example | Trigger | Observation | Timeout | Correlation | First response may be empty? |
|---|---|---|---|---|---|
| AUTO-01G WAIT_FOR_AUTO_APPLY | product `POST .../files/write` | capture-style listener armed before BUILD; wait for matching 204 | `AUTO_APPLY_TIMEOUT_MS=180000` | sessionId + frozen path | YES (wait, do not sample once) |
| AUTO-01H BUILD executionId | product `POST /api/ai/execute` | waitForResponse + bounded body read | 30s + 30s | JSON `executionId` | N/A (the creating response) |
| AUTO-01D/E CREATE_SESSION | product `POST /api/sessions` | listener + bounded project response | 30s | session `id` | YES until observed |
| PUBLIC_CONFIRM adapter | product confirm POST | `waitForFirst(30_000)` | 30s | public confirm URL + 200 + triggered | YES until observed |
| CONTRACT checkpoint stub | none | immediate in-memory object | none | none | NO — unrealistic |
| Product `loadCheckpoints` | UI | one GET, treats failure as `[]` | none | sessionId | YES |
| Product preview start poll | preview start fail | 5 × 800ms status GET | ~4s extra | running status | YES |

Closest pattern for CHECKPOINT: AUTO-01G/D/H **bounded wait for an eventual product fact**, not a single sample. The LIVE-09 failure surface is the **list GET**, so Step 2 should observe that same GET until the correlated row appears (not switch to an unrelated channel). A POST-create listener would also see creation, but would not be the frozen LIVE-09 GET symptom and is out of this smallest fix unless GET polling is proven insufficient later.

---

## 12. PUBLIC_CONFIRM and phase order

Checkpoint creation **does not depend** on the runner PUBLIC_CONFIRM phase.

Product confirm already ran on Branch A during apply, **before or concurrent with** Branch B, and LIVE-09 recorded deduction at 13:19:47 while the runner never entered PUBLIC_CONFIRM. Coherence keys off `applyStatus === 'applied'`, not off confirm HTTP success.

**Phase order change: NO.** Keep PREVIEW → CHECKPOINT → PUBLIC_CONFIRM.

CHECKPOINT must mean: **the automatic checkpoint becomes observable on `GET /api/sessions/:sessionId/checkpoints` within a finite bounded window**, not “already exists on the first GET immediately after Preview.”

---

## 13. Hypotheses

### H1 — Creation is legitimately async; one immediate GET is insufficient

**Support:** useEffect + awaited preview refresh + git commit before ledger insert; empty `[]` is a valid list response; LIVE-09 one GET empty then later row; no runner poll.
**Contradict:** none in source.
**Verdict:** **CONFIRMED**

### H2 — Correct endpoint, wrong lifecycle boundary

**Support:** GET is the correct list API; CHECKPOINT runs immediately after runner PREVIEW, which does not wait for Branch B.
**Contradict:** the **phase** after PREVIEW is the right golden-path place; the defect is observation method, not “should be after PUBLIC_CONFIRM.”
**Verdict:** **PARTIAL** — wrong *observation* at a valid phase; not a phase-order bug.

### H3 — Wrong session/project

**Support:** none. LIVE-09 runner `sessionId` equals product checkpoint session.
**Contradict:** same IDs; HTTP OK empty list (wrong session would 404 for foreign UUID under ownership, or list another session’s rows).
**Verdict:** **REFUTED**

### H4 — Response parsing/schema mismatch

**Support:** non-array coerced to `[]` could throw the same error.
**Contradict:** gateway and frontend types are camelCase arrays; a present row with missing `commitHash` would throw hash/`filesChanged` errors, not the empty-list error. LIVE-09 later listed the expected row from the same table.
**Verdict:** **REFUTED** for LIVE-09. Latent coerce-to-`[]` remains a Step 2 fail-closed item.

### H5 — Row existed but filter/order discarded it

**Support:** fallback/filter exist.
**Contradict:** empty-list throw happens **before** filter. LIVE-09 GET was empty.
**Verdict:** **REFUTED** for LIVE-09. Filter fallback remains a stale-accept risk for Step 2.

### H6 — Product creates too late; product should change

**Support:** checkpoint is after preview refresh by design.
**Contradict:** product later created the exact expected row; golden-path intent is automatic post-apply checkpoint, not “exists before Preview returns.” LIVE-09 classified AUTOMATION_ADAPTER_FAILURE. Changing product to create earlier would be a product-spec change, not required to make observation correct.
**Verdict:** **REFUTED** as the owning fix.

### H7 — CONTRACT/local fixture hides the timing problem

**Support:** stub returns immediately; HTTP fixtures have no checkpoints route; no live-adapter CHECKPOINT tests.
**Contradict:** none.
**Verdict:** **CONFIRMED**

### H8 — Observation needs stronger correlation than non-empty list

**Support:** `pickAutomaticCheckpoint` fallback to `[0]`; Initial commit / other rows possible; no executionId.
**Contradict:** LIVE-09 failed on empty, not on stale accept.
**Verdict:** **CONFIRMED** as a required contract for the adapter fix (same issue: CHECKPOINT observation), even though it was not the LIVE-09 throw.

### H9 — Other

React `useEffect` scheduling is an extra async hop; covered under H1. CM SQLite vs Postgres list owner could confuse diagnosis; public GET uses Postgres only. **No additional independent root cause.**

---

## 14. Precise root cause

The LIVE CHECKPOINT adapter performs **one immediate** `GET /api/sessions/:sessionId/checkpoints` and treats `[]` as terminal failure.

The product automatic checkpoint is created **later**, on a **separate async branch**, after file persist and after `runAiActionCoherence` finishes file-tree + preview refresh, via `POST /api/sessions/:sessionId/checkpoints` that then git-commits and inserts `git_checkpoints`.

Empty `[]` on the first GET is a **normal** product response before that insert. The adapter does not wait. CONTRACT never simulates empty-first. Preview duration is an accidental, unenforced delay.

**Owning fix:** AUTOMATION_ADAPTER_FIX  
**LIVE-09 lock class (unchanged):** AUTOMATION_ADAPTER_FAILURE

---

## 15. Bounded observation contract (proven; not implemented)

Bounded GET polling **is required**. Not a sleep-only delay. Same endpoint as today.

1. **Success:** within the bound, a GET 200 JSON **array** contains a row matching §9 correlation.
2. **Correlation:** `sessionId` (URL) + description includes `applied workspace file actions` + non-empty `commitHash` + `filesChanged >= 1`. Do not use `[0]` fallback.
3. **Reject stale:** `Initial commit`, empty hash, `filesChanged < 1`, other descriptions. Keep polling if only stale rows exist.
4. **Timeout:** `CHECKPOINT_OBSERVATION_TIMEOUT_MS = 30_000`. Rationale: existing 30s family (`SESSION_CREATE`, `BUILD_EXECUTION_*`, `verifyPublicConfirm(30_000)`, `LIVE_ACTION_TIMEOUT_MS`); LIVE-09 Branch B was ~6s confirm→row; product has no max; 30s is 5× that observation with headroom for git/preview poll (5×800ms) without approaching the 180s AUTO_APPLY bound.
5. **Cadence:** `CHECKPOINT_POLL_INTERVAL_MS = 250`. Rationale: faster than product preview 800ms so the adapter notices the row promptly; slower than AUTO-01E 50ms UI settle to avoid hammering; max attempts `floor(30000/250)+1` = **121** including GET #1 (first GET is immediate, not a sleep).
6. **Per-attempt HTTP/body timeout:** remaining observation time, capped at `CHECKPOINT_REQUEST_TIMEOUT_MS = 10_000`, with a **runner-owned body-read race** (AUTO-01E/H: Playwright `json()` is not reliably bounded by `actionTimeout`).
7. **Max requests:** ≤ 121 in the 30s/250ms envelope; fewer if success or fail-closed earlier.
8. **HTTP error (non-OK):** fail closed immediately (`Checkpoint list HTTP ${status}`). Do not treat as empty or retry.
9. **Malformed (non-array JSON, body timeout, parse throw):** fail closed immediately. Do **not** coerce to `[]`.
10. **Never appears:** fail closed with `No automatic checkpoint was returned.` (preserve LIVE-09 error for empty-until-timeout).
11. **Multiple matching:** first description match on newest-first list.
12. **First empty list:** **normal.** Continue polling.
13. **Old checkpoint already present:** ignore unless it matches §9. Do not accept first non-empty.

No arbitrary `sleep(n)` as the success mechanism. Interval waits only between GETs while the bound remains.

---

## 16. Smallest Step 2 (not authorized by this document)

TDD only. No LIVE. No product files. No phase reorder.

**RED:** fixture GET #1 = `[]`; later GET = expected automatic checkpoint; current `verifyCheckpoint()` throws `No automatic checkpoint was returned.` (inject a short bound so RED is fast). Also RED: stale-only list must not pass; non-array must not pass as empty.

**GREEN:** minimal bounded GET loop implementing §15. Tighten selection to require description match (stop `[0]` fallback for the LIVE adapter path). Constants in `lib/constants.ts`. Optional typed observation error in `lib/network.ts` if that matches AUTO-01G/H style.

Then focused tests + full CONTRACT + `npx tsc --noEmit --project e2e/builder-golden-path/tsconfig.json`.

Likely implementation files:

- `e2e/builder-golden-path/lib/live-adapters.ts`
- `e2e/builder-golden-path/lib/constants.ts`
- `e2e/builder-golden-path/lib/network.ts` (only if a typed error / body-timeout helper is required)
- `e2e/builder-golden-path/lib/evidence.ts` (correlation: no stale `[0]` fallback)

Likely test/fixture files:

- `e2e/builder-golden-path/lib/local-fixture.ts`
- `e2e/builder-golden-path/tests/live-adapters.spec.ts`
- `e2e/builder-golden-path/tests/evidence.spec.ts`

**Product changes: NO.**

---

## 17. Residual uncertainty

- Exact LIVE-09 GET wall-clock remains UNKNOWN. Source still proves one-shot GET vs async create; timestamps are not required to prove the contract defect.
- Whether LIVE-09 GET occurred a few hundred milliseconds before or after `13:19:53` is unknown. If it were after persist, H4/H3 would be in play; both are refuted by HTTP-OK empty-list semantics plus same sessionId and camelCase array API. Cleanup/screenshot between fail and `13:19:59` runner end is consistent with GET **before** persist.
- CM `Initial commit` ledger row may or may not exist on some sessions; correlation must still reject it.

---

## 18. Step 1 activity ledger

```
LIVE runs = 0
SSH connections = 0
staging mutations = 0
provider calls = 0
credit mutations = 0
gate mutations = 0
project/session/container creation = 0
runner implementation modifications = 0
product modifications = 0
dependency changes = 0
Git mutations = 0
```

Local read-only source inspection only. No Docker/Postgres/Redis. No CONTRACT run required for Step 1 (diagnosis). No `npm run e2e:builder:live`.

---

## 19. Blocker before Step 2

Explicit Keith authorization for AUTO-01J Step 2 — one smallest TDD adapter correction of the CHECKPOINT observation contract. No LIVE. No SSH. No staging. No provider. No credits. No product source. No phase reorder. Keith owns Git.

**PRIVATE-BETA-E2E-AUTO-01J STEP 1 COMPLETE — AUTOMATIC CHECKPOINT OBSERVATION ROOT CAUSE AND SAFE BOUNDED ADAPTER CONTRACT PROVEN — READY FOR ONE TDD ADAPTER FIX**
