# PRIVATE-BETA-E2E-AUTO-01G — Final Checkpoint

**Task ID:** PRIVATE-BETA-E2E-AUTO-01G  
**Title:** Correct the WAIT_FOR_AUTO_APPLY Observation Signal (Presentation-Coupled Locator → Existing Persistence Signal)  
**Final Status:** COMPLETE AND LOCKED — PASS — 2026-08-21  
**Checkpoint Date:** 2026-08-21  
**Lifecycle:** 3-step bounded task (AUTOMATION_TOOLING_INVESTIGATION + bounded AUTOMATION_TOOLING_FIX)  
**Workstream:** RELIABILITY  
**Evidence class:** LOCAL-TESTS  
**Lane:** Lane 1 (now released EMPTY)  
**Parent:** PRIVATE-BETA-E2E-AUTO-01 (COMPLETE AND LOCKED — PASS)  
**Triggering evidence:** PRIVATE-BETA-E2E-LIVE-06 (COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — WAIT_FOR_AUTO_APPLY — 2026-08-21)

Do not treat this checkpoint as a scheduler. Do not modify AUTO-01G implementation. Do not reopen AUTO-01/01A/01B/01C/01D/01E/01F. Do not rerun LIVE-06. Do not convert LIVE-06 to PASS. Do not register PRIVATE-BETA-INVITE-01. Do not perform another LIVE run before the executionId defect is fixed.

---

## Final verdict

```
FINAL_VERDICT=COMPLETE AND LOCKED — PASS — 2026-08-21
PRODUCT_FAILURE=NO
PRODUCT_SOURCE_MODIFIED=NO
AUTOMATION_IMPLEMENTATION_MODIFIED=YES (runner-only; no product source)
LIVE_RUNS=0
SSH_CONNECTIONS=0
STAGING_ACCESS=0
PROVIDER_CALLS=0
CREDITS_MUTATED=0
GATE_MUTATION=0
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
PHASE_ORDER_CHANGED=NO
ROOT_CAUSE_PROVEN=YES
CORRECT_SEMANTIC_SIGNAL_PROVEN=YES
TYPESCRIPT_PASS=YES
CONTRACT_TESTS=88
CONTRACT_PASS=88
CONTRACT_FAIL=0
GIT_DIFF_CHECK=PASS
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

---

## Step 1 — Semantic / root-cause proof (COMPLETE — 2026-08-21)

### WAIT_FOR_AUTO_APPLY intended contract

The frozen AUTO-01 runner contract places WAIT_FOR_AUTO_APPLY immediately after BUILD and immediately before PREVIEW. The adapter return type `{ autoApplyAt: number; fileApplied: true }` and the `awaitingConfirmation` negative guard together define exactly one responsibility:

> **Contract B — the AI-produced file action was applied and persisted to workspace storage automatically, without a manual Apply.**

### Previous implementation

`lib/live-adapters.ts:317-325` (before AUTO-01G Step 2) asserted **Contract D** — file-tree UI rendering:

```typescript
async waitForAutoApply() {
  await page.locator(SELECTORS.autoFileNode).waitFor({ timeout: AUTO_APPLY_TIMEOUT_MS });
  if (await page.locator(SELECTORS.awaitingConfirmation).count()) {
    throw new Error(
      'AUTO_APPLY expected for the one-file golden path, but awaiting-confirmation UI appeared.',
    );
  }
  return { autoApplyAt: Date.now(), fileApplied: true };
},
```

`SELECTORS.autoFileNode` = `[data-testid="workspace-file-node-e2e-auto.html"]`

### Why Contract D was architecturally incapable of resolving

Three simultaneous conditions are required for that selector to exist in the DOM:

1. **Active tab must be Code & Files.** The file tree lives inside a conditional `{activeTabId === 'codeFiles' ? (…) : null}` branch in `workspace-shell.tsx:2470-2490`. Non-active branches render `null` — they are **UNMOUNTED, not hidden.** No `waitFor` state including `attached` could ever resolve from the Preview branch.
2. **File surface state must be `ready`.** Even under `codeFiles`, the tree is gated at `workspace-shell.tsx:4887`.
3. **Tree must contain the path.** `workspace-file-node-e2e-auto.html` per `:5013`.

### Why Preview was always active

`DEFAULT_ACTIVE_TAB_ID = 'preview'` (`workspace-tab-registry.ts:25`) is consumed by `React.useState(DEFAULT_ACTIVE_TAB_ID)` (`workspace-shell.tsx:801`). It is a **module constant** — it does not depend on workspace or session state. `setActiveTabId` has exactly two occurrences repo-wide: declaration (`:801`) and `onTabChange={setActiveTabId}` (`:2439`). Only a `workspace-tab-*` click can change it. BUILD does not change it. Auto-apply does not change it. The runner never clicked a tab. **RUNNER_CAUSED_PREVIEW_SELECTION=NO.**

### LIVE-06 linkage

LIVE-06 proved simultaneously:
- `PRODUCT_AUTO_APPLY=YES` — product wrote `e2e-auto.html` (191 bytes), checkpoint `b85c33915aea6af4dd8052dba096d1c996260c92`, execution `1a995035-6b1c-431b-acc2-8dd1e51a53da`, deduction 1180 credits.
- `RUNNER_AUTO_APPLY_OBSERVATION=FAIL` — `locator.waitFor: Timeout 180000ms exceeded` waiting for `[data-testid="workspace-file-node-e2e-auto.html"]`.

**PRODUCT_FAILURE=NO.** Root cause: presentation-coupled automation observation.

Additionally, the product apply completed approximately **2 minutes 7 seconds before WAIT_FOR_AUTO_APPLY was entered**, because `submitBuild` observed `POST /api/ai/executions` (`live-adapters.ts:296-301`) while the product posts `POST /api/ai/execute` (`frontend/app/[locale]/app/page.tsx:4024`, `:4350`), burning `BUILD_TIMEOUT_SAFE = 120_000` before the catch returned `executionId: undefined`.

---

## Step 2 — Correct persistence signal

### The authoritative signal

`POST /api/sessions/:sessionId/files/write` with request-body `path === 'e2e-auto.html'` and response status exactly **204**.

**Why this is the correct signal:**

- **Proves Contract B exactly.** The gateway (`services/api-gateway/src/sessions/session.controller.ts:257-285`) returns 204 only after `await containerManagerHttpClient.writeSessionFile(...)` completes — the same write that produced `/opt/aisandbox/workspaces/<sessionId>/e2e-auto.html` in LIVE-06.
- **Tab-independent.** A network response, not DOM.
- **Non-mutating.** Passive observation only.
- **Path-carrying.** The request body `{path, content}` is inspected; the frozen artifact path is validated, not assumed.
- **No body read.** 204 No Content — validation uses the request payload plus `response.status()`.
- **Earliest in the product apply path.** `files/write` → chat results → `confirm-build-apply` (PUBLIC_CONFIRM) → `files/list` → preview refresh → checkpoint create (CHECKPOINT). This signal precedes PUBLIC_CONFIRM, CHECKPOINT, DEDUCTION, and BALANCE — consuming it collapses no later phase semantics.
- **No product change required.** No new endpoint, no new dependency.

### Early ARM_LISTENERS capture requirement

Because the apply completed ~127s before WAIT_FOR_AUTO_APPLY was entered, any network observation **armed inside** `waitForAutoApply()` would arrive too late and fail identically. The listener **must be armed during ARM_LISTENERS** (before CREATE_SESSION and BUILD), capture-style, exactly as the locked AUTO-01D session observer and confirm listener are armed.

Candidate write evidence may therefore be captured before the runner knows the final sessionId. Later consumption validates the captured URL sessionId against the actual CREATE_SESSION sessionId. A write from the wrong session cannot satisfy the condition.

---

## Step 2 — Implementation (COMPLETE — 2026-08-21)

### Changed files

| File | Change |
|---|---|
| `e2e/builder-golden-path/lib/network.ts` | `armFileWriteListener`, `AutoApplyObservationError`, `SESSION_FILE_WRITE_PATH_PATTERN`, `FileWriteCapture`, `FileWriteListener`, `FileWriteWaitInput`, extraction / inspection helpers |
| `e2e/builder-golden-path/lib/live-adapters.ts` | `fileWriteListener` armed in `armListeners()`; `waitForAutoApply()` awaits `waitForMatchingWrite({sessionId, path, timeoutMs})`; `awaitingConfirmation` guard preserved; `fileWriteListener.dispose()` added to `cleanup()` |
| `e2e/builder-golden-path/lib/local-fixture.ts` | New `auto-apply-on-preview-tab` fixture mode — faithful tab model (default preview, Code & Files file node rendered only when `codeFiles` active / unmounted otherwise), `POST /api/sessions/<id>/files/write` → 204 route, chat File Action Results, `confirm-build-apply` trigger; plus `no-write`, `awaiting-confirmation`, wrong-path modes |
| `e2e/builder-golden-path/tests/live-adapters.spec.ts` | 13 new tests in `AUTO-01G WAIT_FOR_AUTO_APPLY file-write observation` describe block |

No constants change. No product source. No `package.json` / lockfile.

### Listener contract

**`armFileWriteListener(page)`** returns a `FileWriteListener` with:

- `captures: FileWriteCapture[]` — all observed POST `/api/sessions/:id/files/write` responses (regardless of session or path), retained from arm time
- `waitForMatchingWrite({ sessionId, path, timeoutMs })` — waits for a capture matching exact sessionId (from URL), exact path (from request body), and status === 204; rejects immediately on failed-write or malformed; rejects on timeout with `AutoApplyObservationError`
- `dispose()` — removes the page listener and rejects any pending waiters

### Listener semantics

- Armed during **ARM_LISTENERS**, before CREATE_SESSION / BUILD
- POST-only matching; route matcher: `/api/sessions/:sessionId/files/write`
- sessionId captured from URL
- request JSON safely parsed via `inspectFileWriteRequestBody`; malformed body → `malformed: true`; path field present and string → `path: <value>`
- required response status: exactly **204**; no response-body read
- early successful writes retained; later `waitForMatchingWrite` filters against actual CREATE_SESSION sessionId
- wrong session cannot satisfy
- wrong path cannot satisfy
- malformed body cannot satisfy
- failed write (non-204) cannot satisfy
- listener disposed during cleanup, next to `confirmListener.dispose()`
- disposed state prevents new captures and rejects pending waiters immediately

### `waitForAutoApply` final contract

**Final mandatory success condition:** matching successful persisted file write observed (POST `/api/sessions/:sessionId/files/write` with `path === 'e2e-auto.html'` and status 204).

**Not required:** Code & Files file-tree node rendered. **Not performed:** tab switching. Preview may remain default.

`awaitingConfirmation` negative guard is preserved exactly.

Return value unchanged: `{ autoApplyAt: <observedAt timestamp>, fileApplied: true }`.

`SELECTORS.autoFileNode` is retained in `constants.ts` — no test-id churn.

**Phase order unchanged:** PREVIEW is immediately after WAIT_FOR_AUTO_APPLY in all assertions.

---

## TDD RED evidence

The faithful fixture represented:

- Preview active / default tab
- Code & Files panel unmounted (file node rendered only under `codeFiles`)
- successful `POST /api/sessions/<id>/files/write` → 204
- `e2e-auto.html` persisted
- visible chat File Action Results
- file-node count = 0 while Preview is active

**Before the fix**, the real adapter failed with:

```
TimeoutError: locator.waitFor: Timeout 400ms exceeded.
waiting for [data-testid="workspace-file-node-e2e-auto.html"]
```

The underlying write had already succeeded at that point. This directly reproduced the LIVE-06 observation defect without staging, SSH, provider, or credits.

---

## Regression coverage — 13 new AUTO-01G tests

Test numbers 46–88 in the 88-test suite; all new tests in the `AUTO-01G WAIT_FOR_AUTO_APPLY file-write observation` describe block.

Proven cases:

| Test | Verdict |
|---|---|
| Matches `POST /api/sessions/:sessionId/files/write` only; inspects path fail-closed | PASS |
| LIVE-06 reproduction: Preview-default successful write observed without Code & Files | PASS |
| Retains a matching `files/write` that arrives before `waitForAutoApply` | PASS |
| Pre-sessionId capture still matches after CREATE_SESSION resolves the same session | PASS |
| A matching path from the wrong session does not satisfy AUTO_APPLY | PASS |
| A write to the wrong path does not satisfy AUTO_APPLY | PASS |
| Missing write fails closed with a bounded `AutoApplyObservationError` | PASS |
| A matching non-204 write does not report persistence PASS | PASS |
| Malformed write JSON fails closed and does not satisfy AUTO_APPLY | PASS |
| `awaiting-confirmation` remains a negative AUTO_APPLY guard | PASS |
| `dispose()` stops capturing further file writes | PASS |
| A single matching write is not reported as duplicate success | PASS |
| Runner ARM_LISTENERS → BUILD write → WAIT_FOR_AUTO_APPLY PASS → PREVIEW next | PASS |

**AUTO-01D / AUTO-01E / AUTO-01F regressions:** all pre-existing 75 tests remain passing.

---

## Step 3 — Fresh verification (COMPLETE — 2026-08-21)

All three verifications run fresh in Step 3 (not carried from Step 2 claims):

```
HEAD=b9cba2480ea4e9c814d17342c0e6aed2b469ef69
git status --short=EMPTY (CLEAN)
```

### TypeScript

```
npx tsc --noEmit --project e2e/builder-golden-path/tsconfig.json
EXIT=0
RESULT=PASS
```

### CONTRACT

```
npm run e2e:builder:contract
88 passed
0 failed
RESULT=PASS
```

### git diff --check

```
git diff --check
EXIT=0
RESULT=PASS
```

---

## Activity log

```
LIVE_RUNS=0
REAL_SSH=0
STAGING_ACCESS=0
PROVIDER_CALLS=0
CREDITS=0
GATE_MUTATION=0
PRODUCT_MUTATION=0
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
```

---

## executionId defect — explicitly separate / unfixed

`submitBuild` currently observes the wrong execution-creation route:

- Runner expects: `POST /api/ai/executions`
- Real product uses: `POST /api/ai/execute`

LIVE-06 evidence: `executionId=null` in runner while DB held `1a995035-6b1c-431b-acc2-8dd1e51a53da`.

Additional consequence: `submitBuild` burned approximately `BUILD_TIMEOUT_SAFE = 120_000` ms waiting for a request that never occurs.

The missing executionId would later block deduction verification: `Cannot verify deduction without executionId`.

**This issue is SEPARATE from AUTO-01G. AUTO-01G did not fix it and does not register it.**

It is a known blocker before spending another LIVE / provider run.

---

## Builder readiness

```
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
LIVE_STAGING_VALIDATED=NO
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

AUTO-01G is CONTRACT-only. Do NOT recommend another LIVE run immediately. The executionId defect must be fixed in a separate bounded lifecycle first.

---

## Next recommended lifecycle

After AUTO-01G is locked, the next recommended bounded automation lifecycle addresses the proven executionId observation defect.

**Likely identifier:** `PRIVATE-BETA-E2E-AUTO-01H` (verify unused at future registration).

**Do NOT register it here.**

Scope should be limited to:

- Why `submitBuild` observes `POST /api/ai/executions` while the real product uses `POST /api/ai/execute`
- Capture the real executionId from the actual route
- Eliminate the unnecessary 120s dead wait
- Preserve one-provider-call semantics
- Enable later DEDUCTION verification to use the actual executionId

Do not combine other residual automation hardening into it.

After that bounded lifecycle passes and locks, a fresh LIVE E2E becomes the next gate.

---

## Lane and resource state

```
Lane 1: EMPTY (released at lock)
Lane 2: EMPTY
Lane 3: DISABLED
GOVERNANCE: UNOWNED (acquired for this Step 3 checkpoint/board/registry write, then released)
STAGING: UNOWNED
PROVIDER-LIVE: UNOWNED
CREDIT: UNOWNED
ENV: UNOWNED
PACKAGE: UNOWNED
LOCAL-RUNTIME: UNOWNED
FRONTEND: UNOWNED
GATEWAY: UNOWNED
AI-SERVICE: UNOWNED
CONTAINER-MANAGER: UNOWNED
All HOTFILE leases: UNOWNED (AUTO-01G Step 2 leases released)
```

---

*Checkpoint created 2026-08-21 — PRIVATE-BETA-E2E-AUTO-01G Step 3 — GOVERNANCE / CONSOLIDATION ONLY — no staging, Playwright LIVE, provider, credits, gate mutation, runner fix, product source, package, or Git mutation — TypeScript PASS — 88 CONTRACT tests PASS — git diff --check PASS — COMPLETE AND LOCKED — PASS — AUTO_APPLY PERSISTENCE NOW OBSERVED FROM EARLY-CAPTURED SESSION FILE-WRITE 204 INSTEAD OF TAB-DEPENDENT UI*
