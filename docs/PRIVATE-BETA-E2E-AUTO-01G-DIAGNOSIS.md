# PRIVATE-BETA-E2E-AUTO-01G — Step 1 Diagnosis

**Task ID:** PRIVATE-BETA-E2E-AUTO-01G
**Title:** WAIT_FOR_AUTO_APPLY Observation Architecture — Root Cause and Correct Semantic Signal
**Classification:** AUTOMATION_TOOLING_INVESTIGATION
**Workstream:** RELIABILITY
**Lifecycle:** 3-step bounded task (Step 1 registration + investigation; Step 2 smallest proven fix + TDD/CONTRACT; Step 3 consolidation/checkpoint/lock)
**Step:** 1 — COMPLETE
**Date:** 2026-08-21
**Lane:** Lane 1
**Parent:** PRIVATE-BETA-E2E-AUTO-01 (COMPLETE AND LOCKED — PASS)
**Triggering evidence:** PRIVATE-BETA-E2E-LIVE-06 (COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — WAIT_FOR_AUTO_APPLY — 2026-08-21)

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
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
PHASE_ORDER_CHANGED=NO
ROOT_CAUSE_PROVEN=YES
CORRECT_SEMANTIC_SIGNAL_PROVEN=YES
PRODUCT_CHANGE_REQUIRED_FOR_STEP_2=NO
```

Local tree at Step 1 (read-only):

- `git rev-parse HEAD` = `d4e379a5a26eecf0c1a69ed90988af269fb60859`
- `git status --short` = empty (CLEAN)

This SHA is recorded as an observation only. It is **not** frozen as a required Step 2 SHA.

---

## 1. Identifier verification

`PRIVATE-BETA-E2E-AUTO-01G` was **unused as a registered task** before this registration.

Repo-wide occurrences before registration (all historical prose, none a registration):

| Location | Nature |
|---|---|
| `TASKS.md` next-gate recommendation line, then line 173 (2 occurrences), since replaced by this registration | "Next recommended lifecycle (**NOT REGISTERED AND NOT AUTHORIZED HERE**): likely identifier `PRIVATE-BETA-E2E-AUTO-01G`… Do not register it here." |
| `docs/PRIVATE-BETA-E2E-LIVE-06-CHECKPOINT.md:410` | `**AUTO-01G registered in Step 3:** NO` |
| `docs/PRIVATE-BETA-E2E-LIVE-06-CHECKPOINT.md:414` | "Likely identifier if later registered… repo search at this lock found **zero** occurrences." |
| `docs/PRIVATE-BETA-E2E-LIVE-06-CHECKPOINT.md:477` | "NEXT: BOUNDED AUTO-01G ROOT-CAUSE INVESTIGATION" |
| `TASKS_BACKLOG_FULL.md:67241` | `**AUTO-01G registered:** NO` |

`TASKS_BACKLOG_FULL.md` contained **zero** `### PRIVATE-BETA-E2E-AUTO-01G` registry entries. Historical prose recommending AUTO-01G does not count as prior registration.

Rejected alternatives: `PRIVATE-BETA-E2E-AUTO-02` (implies another runner build), `PRIVATE-BETA-E2E-LIVE-07` (implies LIVE execution — this task is CONTRACT-only), reopening AUTO-01/01A/01B/01C/01D/01E/01F (all LOCKED), reopening LIVE-06 (LOCKED).

---

## 2. Admission / state

Admitted to **Lane 1** as ACTIVE at Step 1. Lane 2 EMPTY. Lane 3 DISABLED.

Admission checks: lane capacity available (0/2 used at admission); Start condition READY; dependencies satisfied (AUTO-01/01A/01B/01C/01D/01E/01F locked PASS; LIVE-06 locked with the triggering evidence); no dependency on unfinished lane output; write scope is automation-only and non-overlapping; GOVERNANCE acquired for this board/registry write then released; evidence class LOCAL-TESTS for Step 2; revert isolation acceptable (runner-only, reversible).

No runtime, staging, provider, credit, or gate authority is granted.

---

## 3. Exact current WAIT_FOR_AUTO_APPLY implementation

The only real implementation is the LIVE adapter. Repo-wide, `waitForAutoApply` appears at exactly four sites: `lib/runner.ts:46` (interface), `lib/runner.ts:139` (call), `lib/runner.ts:292` (CONTRACT stub), `lib/live-adapters.ts:317` (real).

```317:325:e2e/builder-golden-path/lib/live-adapters.ts
    async waitForAutoApply() {
      await page.locator(SELECTORS.autoFileNode).waitFor({ timeout: AUTO_APPLY_TIMEOUT_MS });
      if (await page.locator(SELECTORS.awaitingConfirmation).count()) {
        throw new Error(
          'AUTO_APPLY expected for the one-file golden path, but awaiting-confirmation UI appeared. Do not click a manual Apply button.',
        );
      }
      return { autoApplyAt: Date.now(), fileApplied: true };
    },
```

Invoked by the runner between BUILD and PREVIEW:

```138:140:e2e/builder-golden-path/lib/runner.ts
    mark('WAIT_FOR_AUTO_APPLY');
    const applied = await input.adapters.waitForAutoApply();
    autoApplyAt = applied.autoApplyAt;
```

---

## 4. Semantic responsibility it is intended to prove

The frozen AUTO-01 runner contract places WAIT_FOR_AUTO_APPLY immediately after BUILD and immediately before PREVIEW, with the frozen rule "AUTO_APPLY only / no manual Apply / Preview immediately after AUTO_APPLY". The phase name, the adapter return type `{ autoApplyAt: number; fileApplied: true }` (`runner.ts:46`), and the negative `awaitingConfirmation` guard together define one responsibility:

> **Contract B — the AI-produced file action was applied and persisted to workspace storage automatically, without a manual Apply.**

Mapping of the candidate contracts to the current phase model:

| Contract | Meaning | Owner in the frozen phase model |
|---|---|---|
| A | provider execution completed | implied by BUILD; not the AUTO_APPLY assertion |
| **B** | **file action persisted/applied to workspace storage** | **WAIT_FOR_AUTO_APPLY — the intended authoritative condition** |
| C | workspace state/API knows about the new file | downstream consequence of B; not a distinct phase |
| D | file-tree UI refreshed and visibly contains the file | presentation only; **not** a phase in the frozen order |
| E | chat surfaced a successful apply result | presentation of B; useful corroboration, not the gate |
| F | automatic checkpoint created | **CHECKPOINT** phase |
| G | public confirm / deduction trigger happened | **PUBLIC_CONFIRM** phase |

The current implementation asserts **D**. Its declared responsibility is **B**. `fileApplied: true` is a persistence claim, not a rendering claim. That is the defect.

The `awaitingConfirmation` guard is correct and must be preserved: it is what distinguishes AUTO_APPLY from a risky-batch confirmation path, and it reads an always-mounted chat surface.

---

## 5. Exact selector / wait / timeout

| Item | Value | Source |
|---|---|---|
| Selector | `[data-testid="workspace-file-node-e2e-auto.html"]` | `lib/constants.ts:54` (`autoFileNode`), interpolating `FROZEN_ARTIFACT_PATH = 'e2e-auto.html'` at `lib/constants.ts:1` |
| Wait | `locator.waitFor()` with the default state `visible` | `lib/live-adapters.ts:318` |
| Timeout | `AUTO_APPLY_TIMEOUT_MS = 180_000` | `lib/constants.ts:27` |
| Negative guard | `[data-testid="workspace-chat-file-actions-awaiting-confirmation"]` | `lib/constants.ts:55-56`, used at `lib/live-adapters.ts:319` |

LIVE-06 observed exactly this: `error=locator.waitFor: Timeout 180000ms exceeded.` / `waiting for locator('[data-testid="workspace-file-node-e2e-auto.html"]') to be visible`.

---

## 6. Exact DOM / tab dependency

Three independent conditions must hold simultaneously for the selector to exist:

1. **Tab must be Code & Files.** The file tree lives in `WorkspaceEditorPanel`, and the only live render of that component is inside a conditional tab branch:

```2470:2490:frontend/components/workspace/workspace-shell.tsx
                    {activeTabId === 'codeFiles' ? (
                      <div
                        className="flex flex-col flex-1 md:min-h-0 md:overflow-hidden"
                        data-testid="editor-panel-shell"
                      >
                        <WorkspaceEditorPanel
                          projectUxEnabled={projectUxEnabled}
                          state={props.fileSurfaceState}
                          fileTree={props.workspaceFileTree}
                          // ...
                        />
                      </div>
                    ) : null}
```

2. **File surface must be `ready`.** Inside the panel the tree is gated again:

```4887:4901:frontend/components/workspace/workspace-shell.tsx
      {props.state === 'ready' ? (
        <div className={layoutClassName}>
          <div className={treePaneClassName}>
            <p className="text-[11px] font-semibold text-gray-700">Files</p>
            <ul className="mt-2 space-y-1" data-testid="workspace-file-tree">
              {props.fileTree.map((node) => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedFilePath={props.selectedFilePath}
                  onSelectFile={props.onSelectFile}
                />
              ))}
            </ul>
          </div>
```

3. **The refreshed tree must contain the path.** The node test id is produced per node:

```5013:5013:frontend/components/workspace/workspace-shell.tsx
          data-testid={`workspace-file-node-${props.node.path}`}
```

The second reference to `WorkspaceEditorPanel` at `workspace-shell.tsx:1727` belongs to `projectEditorSection` (`:1724`), which is referenced only by `projectWorkspaceContent` (`:1768`). `projectWorkspaceContent` has exactly one occurrence in the file — its own declaration — so it is never rendered. The tabbed layout at `:2429-2525` is the only live layout, and `activeTabId === 'codeFiles'` is the only path to a `workspace-file-node-*` element.

**Which tab owns the DOM:** `codeFiles` only. The Preview branch renders a disjoint subtree (`data-testid="preview-panel-shell"` → `WorkspacePreviewPanel`, `:2443-2469`).

---

## 7. Why Preview is default/active in LIVE (source-proven, not screenshot-inferred)

```25:25:frontend/components/workspace/workspace-tab-registry.ts
export const DEFAULT_ACTIVE_TAB_ID = 'preview';
```

```801:801:frontend/components/workspace/workspace-shell.tsx
  const [activeTabId, setActiveTabId] = React.useState(DEFAULT_ACTIVE_TAB_ID);
```

- **Default tab does not depend on workspace/session state.** The initial value is a module constant. Contrast the adjacent line 803, `React.useState(readStoredAiPanelCollapsed)`, which *does* read persisted state — the tab default deliberately does not.
- **`preview` is the first registered, default-visible tab:** `workspace-tab-registry.ts:9` (`order: 0`, `defaultVisible: true`). This is intended product UX, not a defect.
- **Only a tab click can change it.** `setActiveTabId` has exactly two occurrences repo-wide: its declaration (`:801`) and `onTabChange={setActiveTabId}` (`:2439`), consumed by `WorkspaceTabBar` buttons `data-testid={`workspace-tab-${tab.id}`}` (`workspace-tab-bar.tsx:77`).
- **BUILD does not change tab state.** `submitBuild()` (`live-adapters.ts:274-315`) touches provider/model selects, `intentBuild`, `promptInput`, `chatSubmit` only.
- **Auto-apply does not change tab state.** The apply/coherence path (`page.tsx:4981-5032`, `4850-4947`) mutates file/checkpoint/preview *data*; it never calls `setActiveTabId`.
- **The runner never selected Preview.** No runner code clicks any `workspace-tab-*` element. Preview was the initial React state and was never left.

Artifact corroboration (`e2e/builder-golden-path/test-results/live-LIVE-Builder-golden-path-live-only-live/test-failed-1.png`, retained): Preview tab active, right panel "Live Preview / Preview unavailable", and the chat panel showing `Created 'e2e-auto.html'…` plus a **File Action Results** card containing `create e2e-auto.html`.

---

## 8. Was the file tree hidden or unmounted?

**UNMOUNTED.** `{activeTabId === 'codeFiles' ? (…) : null}` renders `null`; there is no CSS `hidden`, `display:none`, or off-screen retention of the editor panel. Consequences:

- No `waitFor` state can rescue the current wait — not `visible`, and not even `attached`.
- The Preview surface can **never** expose `workspace-file-node-*`; the two branches are disjoint subtrees.
- A `.count()`-style probe would also return 0.

The underlying *data* was nevertheless present: `props.workspaceFileTree` is page-level state refreshed by the tab-independent coherence effect (`page.tsx:5243-5258` → `maybeRunExecutionCoherence` → `refreshFileTree`). Only the rendering was absent.

---

## 9. Timing: the apply finished before the phase was entered

This is decisive for the Step 2 design and is stronger than the tab finding alone.

| Fact | Time | Source |
|---|---|---|
| Gate enabled (`pm2 restart`) | ~20:20:38 | LIVE-06 execution evidence |
| Provider apply + public confirm + deduction trigger (`persistedFileActionCount=1`) | **20:21:18** | gateway log, LIVE-06 evidence |
| `e2e-auto.html` present on host (191 bytes) | 20:21 | LIVE-06 evidence |
| WAIT_FOR_AUTO_APPLY entered | ≈**20:23:25** | derived: 180000ms before the artifact timestamp |
| 180s locator timeout expired / screenshot written | 20:26:25 | artifact mtime |
| Gate restored | ~20:26:29 | LIVE-06 evidence |

The apply completed roughly **2 minutes 7 seconds before the WAIT_FOR_AUTO_APPLY phase began**.

Cause of that gap, proven in source: `submitBuild` arms

```296:301:e2e/builder-golden-path/lib/live-adapters.ts
      const executionResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/api\/ai\/executions\/?$/.test(new URL(response.url()).pathname),
        { timeout: BUILD_TIMEOUT_SAFE },
      );
```

but the product creates executions with `POST /api/ai/execute` (`frontend/app/[locale]/app/page.tsx:4024` and `:4350`). There is no `POST /api/ai/executions` route. The predicate therefore never matches, the wait burns its full `BUILD_TIMEOUT_SAFE = 120_000` (`live-adapters.ts:420`), and the `catch` at `:311-313` swallows the timeout and returns `executionId: undefined` — exactly the LIVE-06 `executionId=null` while the DB held `1a995035-6b1c-431b-acc2-8dd1e51a53da`.

**Design consequence:** any network-based AUTO_APPLY observation that is *armed inside* `waitForAutoApply()` would arrive ~2 minutes too late and fail identically. The observation **must be armed before BUILD**, capture-style, exactly like the locked AUTO-01D session observer and the existing confirm listener.

---

## 10. Exact mismatch between CONTRACT and LIVE

| Dimension | CONTRACT | LIVE |
|---|---|---|
| `waitForAutoApply` exercised | **Never.** Only the stub at `runner.ts:292-295`, which unconditionally returns `{ autoApplyAt, fileApplied: true }` | Real adapter `live-adapters.ts:317` |
| Tab model | **None.** The fixture app page has no tabs at all (`lib/local-fixture.ts:40-65`) | 14-tab registry, default `preview` |
| Default surface | File tree, preview start button, and iframe all mounted simultaneously and unconditionally | Exactly one tab branch mounted; others `null` |
| File node | **Never rendered.** The fixture emits `<ul data-testid="workspace-file-tree"></ul>` — an empty list with no `workspace-file-node-*` child | Rendered only under `codeFiles` + `state === 'ready'` |
| Unmounted panels | Not modelled | Core behaviour |
| Apply/network ordering | Not modelled; the fixture has no `files/write` route and no auto-apply sequence | writes → chat results → confirm → coherence (list/preview/checkpoint) |
| Apply timing vs phase entry | Not modelled | Apply completed ~127s before the phase started |

---

## 11. Why the existing 75 CONTRACT tests missed it

1. **The adapter under test is never called.** `waitForAutoApply` is stubbed by `createRecordingAdapters` in every runner-level CONTRACT test, so WAIT_FOR_AUTO_APPLY is only ever exercised as a synthetic pass/`failAt` injection.
2. **The suite's live-adapter coverage stops at CREATE_SESSION.** `tests/live-adapters.spec.ts` covers AUTO-01A parity, AUTO-01B parser, AUTO-01C ready-wait, AUTO-01D/01E project/session observation, and AUTO-01F SSH bounding. No test exercises `submitBuild`, `waitForAutoApply`, or `verifyPreview` from `createLiveAdapters`.
3. **The fixture cannot reproduce the failure.** `local-fixture.ts` `APP_PAGE` renders an empty file tree plus preview controls with no tab state, so both the "file node exists" and "panel is unmounted" conditions are outside the fixture's expressive range.
4. **Phase-order tests are structural, not behavioural.** `golden-path.spec.ts:17-19` and several tests in `live-adapters.spec.ts` assert only `GOLDEN_PATH_PHASES.indexOf('PREVIEW') === indexOf('WAIT_FOR_AUTO_APPLY') + 1` — array-index facts that hold regardless of what the adapter observes.
5. **The one fixture browser test that touches the same area** (`golden-path.spec.ts:34-68`) exercises login → confirm listener → preview assertion and deliberately skips the file surface.

**Exact missing regression scenario:** *the product auto-applied and persisted `e2e-auto.html`, the chat shows the successful file action, the workspace state contains the file — and the Code & Files panel is not mounted because Preview is the default tab, therefore the current `waitForAutoApply` locator can never resolve and the phase fails.* Nothing in the suite asserts what AUTO_APPLY must prove, only that some locator eventually appears.

---

## 12. Available non-tab-dependent signals

| # | Signal | Source | Timing vs BUILD completion | Armable before BUILD | Carries path | Proves persistence | Consumed elsewhere | Needs product change |
|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/sessions/:sessionId/files/write` → 204 | `workspace-file-navigation.logic.ts:177-212`; gateway `session.controller.ts:257-285` | **first** apply step; ~immediately after the provider response is parsed | YES (page-level `response` listener) | YES — request body `{path, content}` | YES — 204 is returned only after `await containerManagerHttpClient.writeSessionFile(...)` | NO | NO |
| 2 | Chat `workspace-chat-file-actions` / `-list` DOM | `workspace-shell.tsx:4461`, `:4527`; always-mounted aside `:2422-2427` | right after the writes | n/a (DOM) | text only, no per-path test id | indirectly (renders `result.status`) | NO | NO |
| 3 | `GET /api/sessions/:id/files/list?path=/` | `workspace-file-navigation.logic.ts:138-156`; coherence `refreshFileTree` (`page.tsx:4889`) | after confirm (coherence effect) | YES | YES (response entries) | proves C, implies B | NO | NO |
| 4 | `POST /api/ai/executions/:id/confirm-build-apply` | `workspace-ai-file-actions.logic.ts:379`; listener `network.ts:91-150`, armed at `live-adapters.ts:255` | after the writes | already armed at ARM_LISTENERS | no | no | **YES — PUBLIC_CONFIRM** | NO |
| 5 | Automatic checkpoint creation / `GET …/checkpoints` | coherence `:101`; adapter `live-adapters.ts:332-341` | last in coherence | YES | no | no | **YES — CHECKPOINT** | NO |
| 6 | Absence of `workspace-chat-file-actions-awaiting-confirmation` | `workspace-shell.tsx:4474` | with the chat results | n/a | no | no | NO (already used as a negative guard) | NO |

Proven ordering of the product apply path — `page.tsx:4991-5031` then the coherence effect `page.tsx:5243-5258` → `workspace-ai-coherence.logic.ts:89-105`:

```
POST /api/sessions/:id/files/write  (per action, sequential)   ← #1
→ setExecutionFileActionState(applied) → chat File Action Results  ← #2
→ POST /api/ai/executions/:id/confirm-build-apply                 ← #4  (PUBLIC_CONFIRM)
→ [effect] GET /api/sessions/:id/files/list                       ← #3
→ refreshPreview
→ createCheckpoint → refreshCheckpoints                           ← #5  (CHECKPOINT)
```

Signal #1 is strictly the earliest and is owned by no other phase.

---

## 13. Best candidate observation signal

**`POST /api/sessions/:sessionId/files/write` with request-body `path === 'e2e-auto.html'` and an ok (204) response**, captured by a listener armed during the existing ARM_LISTENERS phase.

Why it is correct:

- It proves exactly contract **B**. The gateway returns 204 only after awaiting the container-manager write (`session.controller.ts:284`), which is the same write that produced `/opt/aisandbox/workspaces/<sessionId>/e2e-auto.html` in LIVE-06.
- **Tab-independent** — a network response, not DOM.
- **Does not mutate product state** — passive observation.
- **Cannot race**, provided it is armed before BUILD; LIVE-06 proves the write lands during BUILD.
- **Carries the filename** in `response.request().postDataJSON().path`, so the frozen artifact name is validated rather than assumed.
- **Not consumed by any later phase** (see §12) and therefore collapses neither PUBLIC_CONFIRM nor CHECKPOINT nor DEDUCTION.
- **No product change**, no new endpoint, no new dependency.
- In the golden path there are exactly two possible callers of this endpoint (`page.tsx:5006` AI apply, `page.tsx:5427` manual editor save). The runner never performs a manual save, and path validation plus a keep-all-captures listener removes any ambiguity.

Retain as **optional diagnostics only** (never a gate): the file-tree node, the chat `workspace-chat-file-actions-list` text, and the `GET …/files/list` response.

Response-body note for Step 2: the write returns **204 No Content**. Validation must use the *request* payload plus `response.ok()`; no body read may be attempted.

---

## 14. Does the candidate duplicate a later phase?

**NO.**

| Later phase | Its evidence | Overlap with `files/write` |
|---|---|---|
| PREVIEW | preview start click + iframe content (`lib/preview.ts:38-66`) | none |
| CHECKPOINT | `GET /api/sessions/:id/checkpoints` + `pickAutomaticCheckpoint` | none — the checkpoint is created later in coherence |
| PUBLIC_CONFIRM | captured `POST /api/ai/executions/:id/confirm-build-apply` (200 / `triggered=true` / `reason="completed"`) | none — different route, and confirm fires *after* the writes |
| DEDUCTION | execution `tokens_used` + DB deduction rows | none |
| BALANCE | `/api/billing/balance` + arithmetic | none |

Using checkpoint, confirm, or deduction as AUTO_APPLY proof *would* collapse later semantics; the chosen signal precedes all of them.

---

## 15. UI-tab-switch hypothesis verdict

**Rejected as the Step 2 design.**

A `workspace-tab-codeFiles` click is available and deterministic (`workspace-tab-bar.tsx:77`), and it very likely *would* have turned LIVE-06 green, because the underlying `workspaceFileTree` state had already been refreshed by the tab-independent coherence effect. But it is the wrong contract and it is strictly more fragile:

- It keeps a persistence assertion coupled to presentation state — the exact coupling that produced this failure class.
- It adds a second hidden precondition, `fileSurfaceState === 'ready'` (`workspace-shell.tsx:4887`), which the runner does not control.
- It adds a real race: the tree only contains the file after coherence's `refreshFileTree`, which the product runs *after* `confirm-build-apply`. A tab click plus node wait would be gated on evidence that is chronologically later than PUBLIC_CONFIRM's trigger.
- It mutates UI view state inside the phase whose next step is PREVIEW, so PREVIEW would have to switch back — extra clicks, extra failure surface, no semantic gain.
- It is presentation churn that would break again on any future default-tab or tab-registry change.

For completeness, the feasibility facts requested were confirmed: the tab selector exists; a click is bounded by the AUTO-01E `actionTimeout=30000`; it creates no session or request; it does not mutate workspace contents; and `workspace-tab-preview` could switch back. Feasible — but not the correct contract, so not recommended.

---

## 16. Non-UI-signal hypothesis verdict

**Accepted.** An existing, automation-visible, tab-independent product signal already proves AUTO_APPLY precisely: `POST /api/sessions/:sessionId/files/write` → 204 with `path === 'e2e-auto.html'`. No new product endpoint is required. No product source change is required.

---

## 17. Is the phase model internally consistent?

**YES.** The frozen order

```
BUILD → WAIT_FOR_AUTO_APPLY → PREVIEW → CHECKPOINT → PUBLIC_CONFIRM → DEDUCTION → BALANCE
```

is satisfiable: contract B is observable strictly before F (checkpoint) and G (confirm), so WAIT_FOR_AUTO_APPLY can be proven without borrowing any later phase's evidence. `assertPhaseOrder` (`lib/phases.ts:77-114`) additionally requires the exact 14-phase list, PREVIEW immediately after WAIT_FOR_AUTO_APPLY, and PREVIEW before the slow evidence phases — all preserved by the recommended design.

One ordering nuance, recorded and *not* a phase-model defect: the product fires `confirm-build-apply` (PUBLIC_CONFIRM's evidence) before the coherence checkpoint (CHECKPOINT's evidence), i.e. wall-clock production order is the reverse of the runner's verification order. This is already handled by the existing capture-style confirm listener armed at ARM_LISTENERS (`live-adapters.ts:255`), so verification order remains valid. Hypothesis H5 is refuted.

---

## 18. Proven root cause

**WAIT_FOR_AUTO_APPLY asserts contract D (file-tree UI rendering) while its declared responsibility is contract B (workspace persistence).** Specifically:

1. The adapter waits for `[data-testid="workspace-file-node-e2e-auto.html"]` to be *visible* (`live-adapters.ts:318`).
2. That element exists only inside the `codeFiles` tab branch (`workspace-shell.tsx:2470`) and only when `fileSurfaceState === 'ready'` (`:4887`).
3. The workspace default tab is the constant `preview` (`workspace-tab-registry.ts:25`, `workspace-shell.tsx:801`), it does not depend on session/workspace state, and the only mutator is a tab-bar click (`:2439`). Neither BUILD nor auto-apply changes it, and the runner never clicked a tab.
4. Non-active tab panels are **unmounted**, not hidden, so no wait state could ever resolve.
5. Independently, the true apply signal had already occurred ~127 seconds before the phase was even entered, because `submitBuild` waits on a non-existent `POST /api/ai/executions` route and burns 120s.

Therefore the product AUTO_APPLY succeeded and the runner's observation was architecturally incapable of seeing it. **PRODUCT_FAILURE=NO.**

Hypothesis verdicts: **H1 REFUTED** (a Code & Files click is not the root cause and not the right fix), **H2 CONFIRMED**, **H3 CONFIRMED**, **H4 CONFIRMED**, **H5 REFUTED**.

---

## 19. Smallest deterministic RED regression (Step 2, TDD — not implemented in Step 1)

Add one fixture mode plus a small AUTO-01G describe block. The fixture must reproduce the real LIVE state:

**New fixture (`lib/local-fixture.ts`), e.g. `createAutoApplyFixtureServer(mode)`:**

- App page with a minimal but faithful tab model: buttons `workspace-tab-preview` and `workspace-tab-codeFiles`, an active-tab variable defaulting to **preview**, and a panel region that renders the file tree with `workspace-file-node-e2e-auto.html` **only** while `codeFiles` is active (removed from the DOM otherwise — mirroring the unmounted product behaviour). Plus `workspace-chat-intent-build`, `workspace-chat-prompt-input`, `workspace-chat-submit`, and a chat results region.
- On submit: `POST /api/ai/execute` → then `POST /api/sessions/<id>/files/write` with `{path:'e2e-auto.html', content:…}` answered **204** → then render the chat File Action Results → then fire `POST /api/ai/executions/<id>/confirm-build-apply`.
- Modes to include: `auto-apply-on-preview-tab` (the LIVE reproduction), `no-write` (never writes → must fail closed), `awaiting-confirmation` (renders the awaiting-confirmation block → existing guard must still throw), and a write for a **different** path (must not satisfy the observation).

**RED assertions before implementation:**

1. With `auto-apply-on-preview-tab` and a short injected bound, the current `waitForAutoApply` **fails/times out** even though the `files/write` 204 already occurred and the chat shows the successful action — reproducing LIVE-06 without staging.
2. The write is observed to complete **before** the AUTO_APPLY phase is entered, proving that arming inside `waitForAutoApply()` is insufficient and that arming must happen in ARM_LISTENERS.
3. `workspace-file-node-e2e-auto.html` is provably absent from the DOM while Preview is active (count 0), so the failure is not a visibility/timing artifact.

**GREEN after Step 2:** the same fixture passes through the new observation, with the path validated; `no-write` and wrong-path modes fail closed with a typed error inside `runGoldenPath` (so CLEANUP and gate restore still run and `providerGuard` accounting is unchanged); the awaiting-confirmation mode still throws the existing AUTO_APPLY guard error.

**Regressions to preserve:** all AUTO-01A/01B/01C/01D/01E/01F tests unchanged, the 14-phase `assertPhaseOrder` invariants, PREVIEW immediately after WAIT_FOR_AUTO_APPLY, `retries: 0`, `ProviderCallGuard(1)`, and no duplicate `POST /api/sessions`.

---

## 20. Smallest safe Step 2 design (not implemented in Step 1)

Automation-only, mirroring the locked AUTO-01D/01E listener pattern:

1. **`lib/network.ts`** — add `armFileWriteListener(page)`: a capture-style page `response` listener that keeps **all** ok `POST /api/sessions/:id/files/write` responses, records `response.request().postDataJSON().path`, and exposes `hasPath(path)` / `waitForPath(path, timeoutMs)` / `dispose()`. Add a typed `AutoApplyObservationError`. No body read (204). Path matching via a `SESSION_FILE_WRITE_PATH_PATTERN` alongside the existing patterns.
2. **`lib/live-adapters.ts`** — arm the listener inside the existing `armListeners()` adapter (ARM_LISTENERS phase, before CREATE_SESSION and BUILD); change `waitForAutoApply()` to await `fileWriteListener.waitForPath(FROZEN_ARTIFACT_PATH, AUTO_APPLY_TIMEOUT_MS)`; keep the `awaitingConfirmation` negative guard exactly as-is; keep returning `{ autoApplyAt, fileApplied: true }`; dispose the listener in `cleanup()` next to `confirmListener?.dispose()`.
3. **Diagnostics only, never a gate** — optionally record whether `SELECTORS.autoFileNode` is present, without waiting on it. `SELECTORS.autoFileNode` stays in `constants.ts` so no test ids change.
4. **Bounds** — reuse `AUTO_APPLY_TIMEOUT_MS = 180_000`; CONTRACT injects a small timeout, exactly as AUTO-01E/01F do.
5. **Failure mode** — typed error raised inside `runGoldenPath`, so the FAIL summary reports `phase=WAIT_FOR_AUTO_APPLY`, CLEANUP runs last, and the gate is restored.

Explicitly out of scope for Step 2: no tab click, no product source, no phase reordering, no new dependency, no `page.goto()` / `selectOption` / `trace` work, no `submitBuild` executionId change, no LIVE run.

---

## 21. Expected Step 2 files

| File | Change |
|---|---|
| `e2e/builder-golden-path/lib/network.ts` | `armFileWriteListener`, `AutoApplyObservationError`, write-path pattern/helpers |
| `e2e/builder-golden-path/lib/live-adapters.ts` | arm in `armListeners()`; rewrite `waitForAutoApply()`; dispose in `cleanup()` |
| `e2e/builder-golden-path/lib/local-fixture.ts` | new auto-apply fixture with a real tab model and a `files/write` route |
| `e2e/builder-golden-path/tests/live-adapters.spec.ts` | new `AUTO-01G` describe (RED → GREEN) |
| `e2e/builder-golden-path/lib/constants.ts` | only if a new pattern/bound constant is required |

Planned Step 2 HOTFILE leases: `lib/network.ts`, `lib/live-adapters.ts`, `lib/local-fixture.ts`, `lib/constants.ts`, `tests/live-adapters.spec.ts`. Not claimed in Step 1.

---

## 22–23. Product-source and phase-order changes

```
PRODUCT_SOURCE_CHANGES_REQUIRED=NO
PHASE_ORDER_CHANGE_REQUIRED=NO
NEW_DEPENDENCY_REQUIRED=NO
NEW_PRODUCT_ENDPOINT_REQUIRED=NO
EXTRA_PROVIDER_CALLS_REQUIRED=NO
```

---

## 24. Residual uncertainty

1. **`submitBuild` executionId capture is separately broken** (`live-adapters.ts:296-301` waits for `POST /api/ai/executions`; the product posts `POST /api/ai/execute` at `page.tsx:4024`/`:4350`). Even with AUTO-01G green, `verifyDeduction` would throw `Cannot verify deduction without executionId` (`live-adapters.ts:352-355`) on the next LIVE run, and BUILD would still burn 120s. This is a **DEDUCTION-phase** surface, is not required to prove AUTO_APPLY, and is **not** fixed or registered here. It must be addressed in a separate later lifecycle before the next LIVE attempt is expected to complete the full golden path.
2. **CONTRACT-only confidence.** Step 2 will be validated against a fixture, not staging. `LIVE_STAGING_VALIDATED` remains NO; only a later authorized LIVE task can validate it.
3. **Fixture fidelity.** The new fixture approximates the product's tab mounting and apply ordering; it is not the real Next.js shell.
4. **Route shape assumption.** `POST /api/sessions/:id/files/write` returning 204 is proven from gateway source at this HEAD. If a future task changes that route or status, the observation must be revisited.
5. **`aiPanelCollapsed` is storage-backed** (`workspace-shell.tsx:803`), so chat-DOM evidence is not guaranteed in a persisted-collapsed profile. This is one reason the chat surface is diagnostics-only rather than the gate; the chosen network signal is unaffected.
6. **Residual AUTO-01E/01F out-of-scope surfaces remain unfixed** and must not be claimed as fixed: unrelated `page.goto()`, `submitBuild()` `selectOption` fallbacks, `trace: 'off'`.

---

## 25. Staging / provider / credit activity

```
LIVE_RUNS=0
REAL_SSH=0
STAGING_ACCESS=0
PROVIDER_CALLS=0
CREDITS=0
GATE_MUTATION=0
PRODUCT_MUTATION=0
AUTOMATION_IMPLEMENTATION_MUTATION=0
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
```

Read-only commands executed: `git rev-parse HEAD`, `git status --short`, a repository file listing, and file/grep reads. Retained LIVE-06 Playwright artifacts under `e2e/builder-golden-path/test-results/` were read only (gitignored; unmodified).

---

## 26. Exact files changed in Step 1

1. `docs/PRIVATE-BETA-E2E-AUTO-01G-DIAGNOSIS.md` (new — this document)
2. `TASKS_BACKLOG_FULL.md` (AUTO-01G registration + Step 1 diagnosis entry)
3. `TASKS.md` (CURRENT EXECUTION BOARD above the LEGACY / FROZEN boundary)

No implementation files. No product source. No test files. No `package.json` / lockfile. No `CLAUDE.md` / `AGENTS.md` / `PRD.md` / `ARCHITECTURE.md`.

---

## 27. Step 1 terminal state

```
AUTO_01G_REGISTERED=YES
AUTO_01G_ADMITTED_LANE=1
AUTO_01G_STEP_1=COMPLETE
AUTO_01G_STEP_2=PENDING
AUTO_01G_STEP_3=PENDING
ROOT_CAUSE_PROVEN=YES
CORRECT_SEMANTIC_SIGNAL_PROVEN=YES
H1_REFUTED=YES
H2_CONFIRMED=YES
H3_CONFIRMED=YES
H4_CONFIRMED=YES
H5_REFUTED=YES
PHASE_MODEL_INTERNALLY_CONSISTENT=YES
LIVE_06_UNCHANGED=YES
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED
```

## 28. Lane / resource state

Lane 1: **ACTIVE — PRIVATE-BETA-E2E-AUTO-01G — Step 1 COMPLETE.** Lane 2 EMPTY. Lane 3 DISABLED.

GOVERNANCE acquired for this Step 1 board/registry/diagnosis write, then released. STAGING / PROVIDER-LIVE / CREDIT / ENV / PACKAGE / LOCAL-RUNTIME / FRONTEND / GATEWAY / AI-SERVICE / CONTAINER-MANAGER remain UNOWNED. All HOTFILE leases remain UNOWNED (Step 2 leases planned, not claimed).

## 29. Blocker before Step 2

Explicit Keith authorization to begin Step 2 (bounded automation-only implementation + CONTRACT/TDD validation). No further investigation is required. No runtime, staging, provider, credit, or gate authority is requested for Step 2 — it is CONTRACT-only.

---

*Diagnosis created 2026-08-21 — PRIVATE-BETA-E2E-AUTO-01G Step 1 — registration + root-cause / observation-architecture investigation only — no implementation — no LIVE / SSH / staging / provider / credit / gate / product / automation-implementation mutation — no Git mutation.*
