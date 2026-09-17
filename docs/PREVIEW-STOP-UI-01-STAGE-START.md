# PREVIEW-STOP-UI-01 — Stage-start / exact-scope freeze

**Task ID:** PREVIEW-STOP-UI-01
**Title:** Stop Preview button / frontend stop caller
**Date:** 2026-09-17
**Nature:** IMPLEMENTATION — high-risk; user-visible preview lifecycle control / i18n / frontend caller of already-CURRENT public POST `/api/preview/:sessionId/stop`
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 4 COMPLETE AND LOCKED — independent verification / checkpoint / lock
**Step status:** Step 1 COMPLETE — 2026-09-17 (registration / control-plane only; registered at `61040fd821625af0ddb48c6487a06ae82ea9b32b` `docs: register preview stop ui`) — Step 2 COMPLETE — 2026-09-17 (committed `4880983451108ac3bd19d3cb9471d329aeb9df58` `docs: freeze preview stop ui`) — Step 3 COMPLETE — 2026-09-17 (Keith-authorized frozen five-file frontend+i18n write set; committed `e165ede0b611210b98894066d516dc02f6071bc8` `feat: add preview stop control`; LOCAL-TESTS 466/466; `npx tsc --noEmit` PASS) — Step 4 COMPLETE AND LOCKED — 2026-09-17
**This document:** Authoritative Step 2 freeze, Step 3 completion record, and Step 4 checkpoint / lock for PREVIEW-STOP-UI-01. It does **not** authorize admission, runtime, staging/browser proof, Gateway/container-manager rewrite, Harness, orchestration, Stripe, apex cutover, invitations, EXEC-01C6A reopen, APPLY-01 lock, or follow-on registration.

**Parents:** PREVIEW-STOP-01 COMPLETE AND LOCKED — Checkpoint: `docs/PREVIEW-STOP-01-STAGE-START.md` — implementation HEAD `79510ca` (`fix: make preview stop reliable`). PREVIEW-STOP-PUBLIC-ROUTE-01 COMPLETE AND LOCKED — Checkpoint: `docs/PREVIEW-STOP-PUBLIC-ROUTE-01-STAGE-START.md` — committed `0af3a17` (`fix: return json for preview stop route`). PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 COMPLETE AND LOCKED — Checkpoint: `docs/PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01-STAGE-START.md` — evidence `3c67e2d`.
**Observed gap (must not rewrite):** Workspace UX still has Start Preview and Refresh with no Stop Preview button. Public POST `/api/preview/:sessionId/stop` is already CURRENT (CM + Gateway JSON 200 + staging public-origin proof). PREVIEW-STOP-STAGING-APPLY-01 remains REGISTERED / READY / NOT ADMITTED / not locked / partial pass and is **not** machine `dependsOn`. This freeze does **not** alter APPLY-01.
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP2_AUTHORIZED=YES
STEP3_AUTHORIZED=YES
STEP3_COMPLETE=YES
STEP4_AUTHORIZED=YES
LOCKED=YES
IMPLEMENTATION_STARTED=YES
ADMITTED=NO
WRITE_SET_PRECISION=EXACT
CANDIDATE_STATUS=LOCKED
ADMISSION_UNCERTAIN=false
TEST_ADMISSIBLE=NOT_READY
MUTEXES_DECLARED=FRONTEND,I18N
MUTEXES_ACQUIRED=NO
GATEWAY_DECLARED=NO
CONTAINER_MANAGER_DECLARED=NO
FRONTEND_I18N=YES (declared, not acquired)
PUBLIC_STOP_VERB=POST
PUBLIC_STOP_BODY=NONE
PUBLIC_STOP_ROUTE=POST /api/preview/:sessionId/stop
DELETE_STOP_ALIAS=NOT_CALLED_BY_UI
ADVANCED_SESSION_STOP=DISTINCT_HARD_CLEANUP
EVIDENCE_CLASS=LOCAL-TESTS
STAGING_BROWSER_PROOF=NOT_IN_STEP_3
HARNESS_ENABLEMENT=NO
ORCHESTRATION=NO
STRIPE=NO
APEX_ROUTING=NO
EXEC_01C6A_REOPENED=NO
EXEC_01C6A_START_CONDITION=NOT_READY
BUILDER_LIVE_GATE_01=COMPLETE AND LOCKED / LEFT_ON
PREVIEW_STOP_STAGING_APPLY_01=UNCHANGED
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE=UNOWNED (end-state)
PRIVATE_BETA_INVITE_01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
FOLLOW_ON_REGISTERED=NO
RUNTIME=NO
BROWSER=NO
GIT_COMMIT=NO
```

Keith authorized this Step 4 checkpoint / lock after Step 3 PASS (committed `e165ede` `feat: add preview stop control`). Occupancy remains EMPTY. Sidecar candidate is `status=LOCKED` / `writeSetPrecision=EXACT` / exact frontend+i18n `writePaths` / `admissionUncertain=false` so the candidate is **not** in S (`Test-Admissible` = NOT_READY). Do **not** admit Lane 1 or Lane 2. Do **not** register follow-on tasks. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A. Do **not** lock or modify PREVIEW-STOP-STAGING-APPLY-01. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. PREVIEW-STOP-STAGING-APPLY-01 remains unchanged. Step 3 verdict = **PASS**. Step 4 verdict = **COMPLETE AND LOCKED**.

---

## 1. Inherited product / architecture facts (must not reopen)

- `PRD.md` CURRENT includes integrated workspace preview, HTTP/WebSocket (HMR/dev servers), and predictable lifecycle behavior for sessions, workspaces, and previews.
- `ARCHITECTURE.md` §6 records preview strategy resolution, Gateway preview proxy to container-manager, and `node-dev-server` as CURRENT HOW.
- Locked PREVIEW-STOP-01 productized already-CURRENT CM stop (`PreviewService.stopPreview`; public POST `/api/preview/:sessionId/stop` with DELETE alias) with LOCAL-TESTS. Freeze recorded **no Stop Preview button**.
- Locked PREVIEW-STOP-PUBLIC-ROUTE-01 added the dedicated Gateway `POST :sessionId/stop` Nest JSON 200 handler (committed `0af3a17`). Freeze recorded **no UI Stop Preview button**.
- Locked PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 proved public-origin POST `/stop` HTTP 200 JSON on staging. Freeze recorded **no UI Stop Preview button**; public stop remained operator DevTools POST.
- Locked PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 proved Vite start. Static Preview remains the baseline that must not regress. This UI slice must keep both static and Vite paths supported by remaining strategy-agnostic.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.
- Working single-shot Builder Ask/Build remains the product to complete, not to replace.
- Product-visible Harness / orchestration / Stripe / apex production routing remain FUTURE/gated.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened.
- PREVIEW-STOP-STAGING-APPLY-01 remains REGISTERED / READY / NOT ADMITTED / Step 3 COMPLETE / Step 4 EVALUATED NOT LOCKED / not locked / partial pass. This freeze does not rewrite APPLY-01.

This freeze does not rewrite `PRD.md` or `ARCHITECTURE.md`.

---

## 2. Source-grounded diagnosis (Step 2)

### 2.1 Where Start Preview is rendered

Single control in `WorkspacePreviewPanel` inside `frontend/components/workspace/workspace-shell.tsx`:

- `data-testid="workspace-preview-start"`
- label `props.previewMessages.startPreview` (`preview.startPreview`)
- enabled only when `selectedSessionId` is set **and** `previewState === 'unavailable'`
- `onClick` → `props.onStartPreview()`

That panel is mounted in **two** shell surfaces (same component, both inherit the new Stop control):

1. Project-first preview section (`data-testid="preview-panel-shell"`)
2. Project tab `activeTabId === 'preview'` (`fillHeight`)

There is no second Start Preview implementation in `page.tsx`.

### 2.2 Where Refresh Preview is rendered

Same `WorkspacePreviewPanel` toolbar:

- `data-testid="workspace-preview-refresh"`
- label `common.refresh` / `common.refreshing` when `previewState === 'loading'`
- enabled when `selectedSessionId` is set **and** `previewState !== 'loading'`
- `onClick` → `props.onRefreshPreview()`

### 2.3 Where preview status / sessionId state is managed

All preview lifecycle state lives in `frontend/app/[locale]/app/page.tsx`:

| State | Location |
|---|---|
| `selectedSessionId` | existing workspace session selection |
| `previewState` | `useState<WorkspacePreviewState>('unavailable')` — `'loading' \| 'ready' \| 'unavailable' \| 'error'` from `workspace-preview.logic.ts` |
| `previewUrl` | `useState<string \| null>(null)` — `/api/preview/:sessionId/proxy?refresh=…` |
| `previewRequestIdRef` | in-flight request generation |
| `previewErrorRetryCountRef` / timeout | first-load iframe retry |

`WorkspacePreviewPanel` is presentational. It does not fetch.

### 2.4 Where preview API calls currently live

All in `page.tsx` (empty POST, no body, same-origin `fetch`; no CSRF header — preview has no `CsrfGuard`):

| Action | Call |
|---|---|
| Start | `POST /api/preview/${selectedSessionId}/start` in `handleStartPreview` (and auto-start inside `refreshPreviewForSession`) |
| Status | `GET /api/preview/${sessionId}/status` in `pollPreviewStatusUntilRunning` / `refreshPreviewForSession` |
| Proxy URL | `buildPreviewProxyUrl` in `workspace-preview.logic.ts` → iframe `src` |
| Refresh | `handleRefreshPreview` → `refreshPreviewForSession(sessionId, false)` (GET status only; no start unless autoStart) |

**No** `handleStopPreview` / `onStopPreview` / `POST /api/preview/:sessionId/stop` exists in frontend.

The only frontend `/stop` found is Advanced session Stop: `POST /api/sessions/${sessionId}/stop` in `page.tsx`. That is **hard cleanup**, not Preview stop. `data-testid="workspace-advanced-stop-session"` must remain distinct.

### 2.5 Layer table

| Layer | Finding | In Step 3 write set? |
|---|---|---|
| `page.tsx` | Start/refresh/status/proxy callers; preview state; no stop caller | **No** (frozen-read; see §6.2 machine-path constraint) |
| `workspace-shell.tsx` | Start + Refresh toolbar; no Stop Preview button; two `WorkspacePreviewPanel` call sites; already has `selectedSessionId` + `onRefreshPreview` | **Yes** |
| `workspace-shell.test.tsx` | Start/Refresh UI + `page.tsx` source-regex tests + I18N-SHELL-03 preview keys | **Yes** |
| `frontend/messages/{en,zh-TW,zh-CN}.json` | `preview.livePreview` / `preview.startPreview` only | **Yes** |
| `workspace-preview.logic.ts` | `WorkspacePreviewState`, `buildPreviewProxyUrl`, `isPreviewRunning`. No stop helper required; do **not** add a fifth preview state | **No** (frozen-read) |
| Gateway / CM / Next rewrite / Caddy | Already CURRENT public POST `/stop` JSON 200 | **No** |
| Advanced session Stop | Distinct `POST /api/sessions/:id/stop` | **No** |

### 2.6 GATEWAY / CONTAINER-MANAGER write-set decision

**Undeclared.** Public POST `/api/preview/:sessionId/stop` already returns HTTP 200 JSON. This child is the workspace caller only.

---

## 3. Answers to the mandatory Step 2 questions

1. **Exact frontend files.** `workspace-shell.tsx` only for the Stop button **and** the POST `/stop` caller (inside `WorkspacePreviewPanel`, which already has `selectedSessionId` and `onRefreshPreview`). `page.tsx` is the current Start/status/proxy owner and remains frozen-read. Machine `writePaths` **must not** contain `frontend/app/[locale]/app/page.tsx` because GOV-OS-03 v1 treats `[` / `]` as glob characters (`MALFORMED`). Do not add a new file to dodge that. Do not edit the validator.
2. **Exact i18n keys.** `preview.stopPreview` and `preview.stopFailed` in `en.json` / `zh-TW.json` / `zh-CN.json`. Frozen copy in §5. No extra `stoppingPreview` key (in-flight keeps the Stop Preview label, disabled).
3. **When Stop is shown vs Start/Refresh.** Show Stop only when a selected session has stoppable preview state: `previewState === 'loading'` (starting) or `'ready'` (running / iframe up), or while a stop request is in flight. Hidden for `'unavailable'` and `'error'` (and no session). Do **not** change `canStartPreview` / `canRefresh`. Start stays enabled only when unavailable. Refresh stays disabled only while loading.
4. **Advanced session Stop.** Remains distinct hard cleanup (`POST /api/sessions/:id/stop` / `workspace-advanced-stop-session`). Do not reuse it. Do not require it for Start → Stop → Start again.
5. **Tests.** LOCAL-TESTS only, in existing `workspace-shell.test.tsx` (UI render + `page.tsx` source regex + locale keys). No new test file. No Playwright/browser. No staging in Step 3.
6. **GATEWAY / CONTAINER-MANAGER.** Remain undeclared. No Gateway or container-manager files in `writePaths`.

---

## 4. Frozen UI behavior (Step 3)

### 4.1 Control

Add one toolbar button in `WorkspacePreviewPanel`, after Start and before Refresh (or immediately after Start; do not redesign the picker):

- `type="button"`
- `data-testid="workspace-preview-stop"`
- label `props.previewMessages.stopPreview`
- **Render only when stoppable** (do not show a permanently disabled Stop on the empty/unavailable toolbar):
  - `Boolean(selectedSessionId)` AND (`previewState === 'loading'` OR `previewState === 'ready'` OR `previewStopInFlight`)
- **Disabled** when `previewStopInFlight` is true
- `onClick` → `props.onStopPreview()`

Do not add a third preview panel. Both existing `WorkspacePreviewPanel` mounts inherit the button.

### 4.2 Caller

Implement the stop caller **inside** `WorkspacePreviewPanel` in `workspace-shell.tsx` (both mounts inherit). Do **not** add `handleStopPreview` / `onStopPreview` to `page.tsx`. The panel already receives `selectedSessionId` and `onRefreshPreview`.

```
POST /api/preview/${selectedSessionId}/stop
```

Frozen fetch contract (match Start, not DevTools `credentials: 'include'` extras):

- `method: 'POST'`
- **no body**
- no `Content-Type`
- no JSON payload
- no CSRF header
- no `DELETE`
- same-origin `fetch` like Start

Keep `previewStopInFlight` / `previewStopFailed` as **local panel state** (`useState`). Do not add a fifth `WorkspacePreviewState` value.

### 4.3 Success (HTTP 200 JSON / `response.ok`)

Treat `response.ok` as success. Do **not** require a specific `message` string. Both locked CM/Gateway bodies are success:

- `{ "success": true, "message": "Preview stopped successfully" }`
- `{ "success": true, "message": "No active preview for this session" }` (idempotent empty-map)

Then clear client preview enough that Start Preview can run again **by awaiting the existing** `onRefreshPreview()` (page `handleRefreshPreview` → `refreshPreviewForSession(sessionId, false)`). That path already:

- bumps `previewRequestIdRef` (invalidates in-flight start/status polls)
- GET `/status` without auto-start
- sets `previewState` `'unavailable'` and `previewUrl` `null` when not running

Also:

- clear local `previewStopFailed`
- `previewStopInFlight = false` in `finally`

Do **not** call session Stop. Do **not** change `selectedSessionId`. Do **not** invent a new page.tsx state writer. A brief Refresh loading flash after a successful stop is accepted (reuses the proven clearer).

### 4.4 In-flight

- Set local `previewStopInFlight` true before fetch; false in `finally`
- Keep current page `previewState` / `previewUrl` until the success refresh completes (so Stop stays visible and disabled; Start stays disabled because state is still loading/ready)
- Do **not** reuse page `previewState === 'loading'` as the stop-in-flight signal before the POST returns (that would relabel Refresh as Refreshing and is not Stop)

### 4.5 Failure

On non-OK HTTP or throw:

- Keep `previewState` and `previewUrl` (user can retry Stop; Start/Refresh unchanged)
- `console.error('Failed to stop preview:', error)` (neighbor of start's console.error)
- Show frozen small error text `preview.stopFailed` at `data-testid="workspace-preview-stop-error"` in the preview panel (toolbar-adjacent). Do **not** switch to `previewState === 'error'` (that is the iframe-load StateMessage / Ask-AI-to-fix path and is the wrong product for a failed POST `/stop`)
- Clear the stop-error on the next successful stop, a new Start, or a new Refresh

### 4.6 Preserve Start / Refresh / static / Vite

- Do not change `handleStartPreview`, `handleRefreshPreview`, `refreshPreviewForSession`, `pollPreviewStatusUntilRunning`, proxy URL builder, iframe load/error retry, or picker
- Do not branch the Stop caller on framework / static vs Vite. One sessionId POST `/stop` serves both. Static and Vite remain supported because this slice does not touch strategy resolution, start, or proxy
- Start Preview and Refresh buttons remain visible with existing enablement

### 4.7 What stop is not

- Not Advanced session Stop
- Not a Gateway or CM rewrite
- Not DELETE `/stop`
- Not Ask/Build
- Not staging/browser proof in Step 3

---

## 5. Frozen i18n keys / copy

Add only these keys under existing `"preview"` in all three locale files. Do not add hardcoded English in the shell.

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `preview.stopPreview` | Stop Preview | 停止預覽 | 停止预览 |
| `preview.stopFailed` | Failed to stop preview. | 無法停止預覽。 | 无法停止预览。 |

`WorkspacePreviewPanel.previewMessages` Pick expands from `'livePreview' \| 'startPreview'` to include `'stopPreview' \| 'stopFailed'`. `getPreviewMessages` already returns the full `preview` object; no new getter.

---

## 6. Exact write set

`writeSetPrecision=EXACT`. Paths are repo-relative POSIX.

### 6.1 Step 2 this window (governance only)

1. `docs/PREVIEW-STOP-UI-01-STAGE-START.md`
2. `TASKS.md` CURRENT EXECUTION BOARD fields
3. `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-UI-01 body
4. `docs/control-plane/lane-saturation-state.json` candidate `writeSetPrecision=EXACT`, exact `writePaths` below, occupancy EMPTY, `admissionUncertain=true`
5. `docs/control-plane/SATURATION_PROOF.json` only as validator output

### 6.2 Step 3 (COMPLETE this window)

**Modify (machine `writePaths`):**

1. `frontend/components/workspace/workspace-shell.tsx`
2. `frontend/components/workspace/workspace-shell.test.tsx`
3. `frontend/messages/en.json`
4. `frontend/messages/zh-TW.json`
5. `frontend/messages/zh-CN.json`

Sidecar `writePaths` is exactly those five paths, in that order.

**Create:** none.
**Gateway / container-manager / `page.tsx` / `workspace-preview.logic.ts`:** none.

GOV-OS-03 v1: characters `*`, `?`, `[`, `]` in a machine write path are MALFORMED. The Next.js file `frontend/app/[locale]/app/page.tsx` therefore **cannot** appear in sidecar `writePaths`. Step 3 must not edit it. Stop fetch + in-flight/error live in `WorkspacePreviewPanel`. Success clear reuses existing `onRefreshPreview`.

### 6.3 Frozen-read (must not be written)

- `frontend/app/[locale]/app/page.tsx` (Start/refresh/status/proxy remain here; no new stop handler)
- `frontend/components/workspace/workspace-preview.logic.ts` and `workspace-preview.logic.test.ts`
- `frontend/next.config.js`
- `services/api-gateway/src/preview/**`
- `services/container-manager/src/preview/**` and `src/previews/**`
- `PRD.md` / `ARCHITECTURE.md` / `CLAUDE.md` / `AGENTS.md`
- Harness / EXEC-01C6A / orchestration / apex / invite files
- session Stop callers (`POST /api/sessions/:id/stop`)
- PREVIEW-STOP-STAGING-APPLY-01 board/registry/stage-start body (do not rewrite)

### 6.4 Explicitly excluded unless the control plane expands scope

- Gateway / container-manager source or tests
- New frontend files / new test files
- New `WorkspacePreviewState` values
- `page.tsx` stop handler / `onStopPreview` prop (machine-illegal `[locale]` path; reuse `onRefreshPreview` instead)
- Staging/SSH/AWS/PM2/env/browser proof in Step 3
- Docker/compose/package.json/lockfiles
- Ask/Build execute path
- Next.js / CRA / Vue / Express preview productization
- Preview refresh UX redesign
- APPLY-01 Step 4 lock
- Advanced session Stop changes

Anything outside the frozen write set is forbidden by default.

---

## 7. Tests and verification plan

Evidence class: **LOCAL-TESTS**. No Docker/Postgres/Redis. No browser. No provider-live. No staging in Step 3.

### 7.1 Required tests (Step 3, later) — add to `workspace-shell.test.tsx`

**UI / visible-hidden (render):**

1. **Hidden when unavailable.** Session selected, `previewState: 'unavailable'`, `previewUrl: null` → no `workspace-preview-stop`. Start remains present.
2. **Hidden when error.** `previewState: 'error'`, `previewUrl: null` → no Stop button.
3. **Hidden when no session.** `selectedSessionId: null` even if `previewState: 'ready'` → no Stop button.
4. **Visible when loading (starting).** `previewState: 'loading'` + session → Stop present, not disabled (unless `previewStopInFlight`).
5. **Visible when ready (running).** `previewState: 'ready'` + `previewUrl` → Stop present.
6. **Disabled while in flight.** Local panel `previewStopInFlight: true` (and stoppable state) → `workspace-preview-stop` present **and** `disabled`.
7. **Stop error text.** Local `previewStopFailed: true` → `workspace-preview-stop-error` contains Stop Failed copy / `preview.stopFailed` wiring. Absent by default.
8. **Start/Refresh regressions.** Existing Start + Refresh testids remain on loading/ready/unavailable. Picker toggle unchanged. Ready iframe still renders.

**Caller / `workspace-shell.tsx` source regex:**

9. **POST URL/method/no body.** Panel stop handler fetches `` `/api/preview/${...}/stop` `` with `method: 'POST'` and **no** `body:` / JSON.stringify / `Content-Type`.
10. **Success clears state and allows Start again.** After ok response the handler **awaits** `props.onRefreshPreview()` (existing no-autostart clearer).
11. **Failure keeps state and shows small error.** Non-ok/throw path does **not** call `onRefreshPreview`; sets local stop-failed; `console.error('Failed to stop preview:'`.
12. **Does not call session Stop.** Stop handler must **not** fetch `/api/sessions/${…}/stop`.
13. **Start/Refresh source regressions.** Existing `handleStartPreview` / `refreshPreviewForSession` / `pollPreviewStatusUntilRunning` assertions in the same file (page source regex) remain green. Do not weaken them.

**i18n:**

14. Extend I18N-SHELL-03 `requiredPreviewKeys` to `['livePreview', 'startPreview', 'stopPreview', 'stopFailed']`.
15. Shell source uses `{props.previewMessages.stopPreview}` and does **not** hardcode `Stop Preview`.

**i18n:**

14. Extend I18N-SHELL-03 `requiredPreviewKeys` to `['livePreview', 'startPreview', 'stopPreview', 'stopFailed']`.
15. Shell source uses `{props.previewMessages.stopPreview}` and does **not** hardcode `Stop Preview`.

Do not add Playwright. Do not add Gateway or container-manager tests. Do not add a new test file.

### 7.2 Step 3 verification commands (COMPLETE this window)

When Step 3 is later authorized:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

If `npm test` is the established equivalent and stays inside `workspace-shell.test.tsx` plus already-green neighbors, it may be used. Do not start Docker/dev servers. Do not run browser/staging proof.

### 7.3 Step 2 this window

```powershell
powershell -NoProfile -File "C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.ps1"
git -C "C:\Users\knlee\aiSandBox2026B" diff --check
```

No frontend tests. No tsc. No runtime. No browser.

---

## 8. Mutexes / runtime needs (declared, not acquired now)

| Item | Step 2 (this window) | Step 3 (later authorization) |
|---|---|---|
| GOVERNANCE | Held for this doc/board/registry/sidecar write, then released UNOWNED | Held only if later admission/lock requires board writes |
| FRONTEND | Declared, **not acquired** | Acquire only if Step 3 is admitted |
| I18N | Declared, **not acquired** (atomic 3-file locale lease) | Acquire only if Step 3 is admitted |
| GATEWAY | **Undeclared** | Still undeclared |
| CONTAINER-MANAGER | **Undeclared** | Still undeclared |
| LOCAL-RUNTIME | Undeclared | Still undeclared |
| STAGING | Undeclared | Still undeclared |
| PROVIDER-LIVE | Undeclared | Still undeclared |
| CREDIT | Undeclared | Still undeclared |
| HOTFILE | none | none |

`stagingAuthorized=false`. `STAGING_EXECUTION_AUTHORIZED=NO`. `PROVIDER_LIVE_AUTHORIZED=NO`. `CREDIT_MUTATION_AUTHORIZED=NO`. `LOCAL_RUNTIME_AUTHORIZED=NO`.

Admission remains **not** performed. `admissionUncertain=true` is intentional (keeps the candidate out of S). It is **not** an admission.

---

## 9. Shared contracts

- `sharedContractIds=[]`. `mutatesSharedContractIds=[]`.
- `HARNESS_ENTITLEMENT_PROOF_V1` remains FROZEN and is not consumed or mutated.
- Public preview stop verb POST + JSON 200 is a product HTTP convention, not a catalog shared-contract ID.

---

## 10. Rollback / revert isolation

Step 2 revert = discard this stage-start and restore PREVIEW-STOP-UI-01 board/registry/sidecar fields to Step 1 (`writeSetPrecision=PROVISIONAL`, empty `writePaths`, mutexes `FRONTEND` + `I18N`, `admissionUncertain=true`). Occupancy is already EMPTY / GOVERNANCE UNOWNED.

Must not mutate EXEC-01C6A prepared artifacts. Cannot invalidate locked PREVIEW-STOP-01 / PREVIEW-STOP-PUBLIC-ROUTE-01 / PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 / BUILDER-CREDIT-UX-01 / PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 / BUILDER-LIVE-GATE-01 evidence. Cannot silently rewrite PREVIEW-STOP-STAGING-APPLY-01 Step 3 partial-pass evidence or Step 4 EVALUATED NOT LOCKED.

---

## 11. Keith-decision boundary after this freeze

```
KEITH_DECISION_REQUIRED_BEFORE_STAGE_START=NO (Step 2 authorized and COMPLETE this window)
KEITH_DECISION_REQUIRED_BEFORE_ADMISSION=YES
KEITH_DECISION_REQUIRED_BEFORE_IMPLEMENTATION=NO (Step 3 authorized and COMPLETE this window)
KEITH_DECISION_REQUIRED_BEFORE_CHECKPOINT_LOCK=NO (Step 4 authorized by Keith and COMPLETE AND LOCKED 2026-09-17)
KEITH_DECISION_REQUIRED_BEFORE_STAGING_OR_BROWSER_PROOF=YES
KEITH_DECISION_REQUIRED_BEFORE_REOPENING_EXEC_01C6A=YES
KEITH_DECISION_REQUIRED_BEFORE_HARNESS_ENABLEMENT=YES
KEITH_DECISION_REQUIRED_BEFORE_STRIPE_OR_TOP_UP=YES
KEITH_DECISION_REQUIRED_BEFORE_APEX_PRODUCTION_ROUTING=YES
KEITH_DECISION_REQUIRED_BEFORE_REGISTERING_NAMED_CHILDREN=YES
```

This freeze does **not** reopen EXEC-01C6A. It does **not** change BUILDER-LIVE-GATE-01. Gate remains ON. Named later children remain unregistered (APPLY-01 Step 4 lock, preview refresh UX, Next/CRA/Vue/Express, mobile polish, apex routing, staging/browser proof child). PREVIEW-STOP-STAGING-APPLY-01 remains unchanged.

---

## 12. Step 2 acceptance

- [x] Start Preview entry point frozen: `workspace-preview-start` in `WorkspacePreviewPanel` (two mounts); caller `handleStartPreview` in `page.tsx`
- [x] Refresh Preview entry point frozen: `workspace-preview-refresh`; caller `handleRefreshPreview` → `refreshPreviewForSession`
- [x] Preview state frozen: `previewState` / `previewUrl` / `selectedSessionId` / `previewRequestIdRef` in `page.tsx`
- [x] Existing API calls frozen: POST `/start`, GET `/status`, proxy URL builder; no current POST `/preview/.../stop`
- [x] Exact Step 3 write set frozen: five frontend/i18n files; Gateway/CM/`page.tsx`/`workspace-preview.logic.ts` out (`[locale]` is machine-illegal in sidecar writePaths)
- [x] Stop visible only for loading/ready (or in-flight); hidden for unavailable/error/no-session
- [x] POST `/api/preview/:sessionId/stop` no body; 200 JSON then existing `onRefreshPreview` so Start can run again
- [x] Stop disabled while in flight; Start/Refresh formulas unchanged
- [x] Static and Vite remain supported (strategy-agnostic caller)
- [x] i18n keys frozen: `preview.stopPreview` / `preview.stopFailed` in en / zh-TW / zh-CN
- [x] Tests frozen: visible/hidden, POST URL/method/no body, success clears, failure small error, Start/Refresh regressions, locale keys
- [x] Advanced session Stop remains distinct
- [x] No staging/browser in Step 3; LOCAL-TESTS only
- [x] Sidecar `writeSetPrecision=EXACT`; exact `writePaths`; `admissionUncertain=true`; occupancy EMPTY
- [x] FRONTEND + I18N declared not acquired; GATEWAY/CONTAINER-MANAGER undeclared
- [x] PREVIEW-STOP-STAGING-APPLY-01 unchanged
- [x] No implementation source edits this window
- [x] No runtime / browser / Git commit

---

## 13. Step 2 activity ledger

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0 except lane-capacity validator, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0, follow-on registration=0.

Governance writes: `docs/PREVIEW-STOP-UI-01-STAGE-START.md`; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-UI-01 body; sidecar candidate `writeSetPrecision=EXACT` / exact `writePaths` / mutexes `FRONTEND` + `I18N` / occupancy EMPTY / GOVERNANCE UNOWNED / `admissionUncertain=true`; `SATURATION_PROOF.json` only as validator output.

---

## 14. Authorization state (end of Step 2)

```
IMPLEMENTATION_AUTHORIZED=NO
ADMISSION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
TESTS_EXECUTED=NO (lane-capacity validator + git diff --check only)
APPLICATION_SOURCE_CHANGED=NO
LANE_1=EMPTY
LANE_2=EMPTY
FRONTEND_DECLARED=YES
FRONTEND_ACQUIRED=NO
I18N_DECLARED=YES
I18N_ACQUIRED=NO
GATEWAY_DECLARED=NO
CONTAINER_MANAGER_DECLARED=NO
STEP3_AUTHORIZED=NO
STEP4_AUTHORIZED=NO
LOCKED=NO
FOLLOW_ON_REGISTERED=NO
EXEC_01C6A_REOPENED=NO
CANDIDATE_STATUS=READY
ADMISSION_UNCERTAIN=true
WRITE_SET_PRECISION=EXACT
PREVIEW_STOP_STAGING_APPLY_01=UNCHANGED
BUILDER_LIVE_GATE_01=COMPLETE AND LOCKED / LEFT_ON
```

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Activation effect:** NONE
**Rollback boundary:** discard this document plus this window’s board/registry/sidecar write-set field updates. Ordinary Builder Ask/Build/static Preview path, locked PREVIEW-STOP-01 LOCAL-TESTS evidence, locked PUBLIC-ROUTE-01 / STAGING-01 public stop evidence, locked Vite start path, APPLY-01 Step 3 staging apply/proof, live gate, and credit UX are untouched.

---

## 15. Step 3 acceptance

- [x] Keith authorized Step 3 this window
- [x] Stop Preview button at `workspace-preview-stop` in `WorkspacePreviewPanel` (both mounts inherit)
- [x] Visible only when a session exists and `previewState` is `loading` or `ready`, or while stop is in flight
- [x] Hidden for `unavailable`, `error`, or no session
- [x] POST `/api/preview/${sessionId}/stop` with no body; no CSRF; no DELETE; no session Stop
- [x] Stop disabled while `previewStopInFlight`
- [x] On `response.ok`, awaits existing `onRefreshPreview()`
- [x] On failure, `workspace-preview-stop-error` uses `preview.stopFailed`; previewState/url kept
- [x] Start Preview and Refresh preserved
- [x] Static and Vite remain strategy-agnostic
- [x] i18n keys `preview.stopPreview` / `preview.stopFailed` in en / zh-TW / zh-CN
- [x] Tests in `workspace-shell.test.tsx` only; 466/466 pass; `npx tsc --noEmit` pass
- [x] `page.tsx` / Gateway / container-manager / sidecar candidate untouched
- [x] occupancy EMPTY; not admitted; not LOCKED; `admissionUncertain=true`
- [x] EXEC-01C6A `startCondition=NOT_READY` UNCHANGED
- [x] BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON
- [x] Step 4 NOT AUTHORIZED
- [x] No Git commit/push

---

## 16. Step 3 activity ledger

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=1 (frozen write set only), application source=1, frontend=1, i18n=1, tests executed=1 (`workspace-shell.test.tsx` 466/466; `npx tsc --noEmit`; lane-capacity validator), dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0, follow-on registration=0.

Application writes: `frontend/components/workspace/workspace-shell.tsx`; `frontend/components/workspace/workspace-shell.test.tsx`; `frontend/messages/en.json`; `frontend/messages/zh-TW.json`; `frontend/messages/zh-CN.json`.
Governance writes: `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-UI-01 Step 3 fields; this document Step 3 end-state; `SATURATION_PROOF.json` only as validator output.

---

## 17. Authorization state (end of Step 3)

```
IMPLEMENTATION_AUTHORIZED=YES (Step 3 COMPLETE; Step 4 not authorized)
ADMISSION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
TESTS_EXECUTED=YES (workspace-shell.test.tsx 466/466; npx tsc --noEmit; lane-capacity validator + git diff --check)
APPLICATION_SOURCE_CHANGED=YES (frozen five-file write set only)
LANE_1=EMPTY
LANE_2=EMPTY
FRONTEND_DECLARED=YES
FRONTEND_ACQUIRED=NO
I18N_DECLARED=YES
I18N_ACQUIRED=NO
GATEWAY_DECLARED=NO
CONTAINER_MANAGER_DECLARED=NO
STEP3_AUTHORIZED=YES
STEP3_COMPLETE=YES
STEP4_AUTHORIZED=NO
LOCKED=NO
FOLLOW_ON_REGISTERED=NO
EXEC_01C6A_REOPENED=NO
CANDIDATE_STATUS=READY
ADMISSION_UNCERTAIN=true
WRITE_SET_PRECISION=EXACT
PREVIEW_STOP_STAGING_APPLY_01=UNCHANGED
BUILDER_LIVE_GATE_01=COMPLETE AND LOCKED / LEFT_ON
```

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Activation effect:** NONE
**Rollback boundary:** restore the five frozen frontend/i18n files plus this window’s board/registry/stage-start Step 3 fields. Ordinary Builder Ask/Build/static Preview path, locked PREVIEW-STOP-01 LOCAL-TESTS evidence, locked PUBLIC-ROUTE-01 / STAGING-01 public stop evidence, locked Vite start path, APPLY-01 Step 3 staging apply/proof, live gate, and credit UX are untouched.

---

## 18. Step 4 checkpoint / lock (COMPLETE AND LOCKED — 2026-09-17)

**Verdict:** **COMPLETE AND LOCKED — PASS.** Independent verification of committed Step 3 source `e165ede0b611210b98894066d516dc02f6071bc8` (`feat: add preview stop control`) against the frozen five-file write set and LOCAL-TESTS evidence. Occupancy EMPTY. No application source this window. No runtime / SSH / browser / PM2 / Docker / Postgres / Redis / provider / credit. No Git commit/push by this worker.

### 18.1 Independent verification

- Frozen five-file frontend+i18n write set confirmed in commit `e165ede` (plus Step 3 control-plane fields in the same commit):
  1. `frontend/components/workspace/workspace-shell.tsx`
  2. `frontend/components/workspace/workspace-shell.test.tsx`
  3. `frontend/messages/en.json`
  4. `frontend/messages/zh-TW.json`
  5. `frontend/messages/zh-CN.json`
- `page.tsx` / Gateway / container-manager / `workspace-preview.logic.ts` absent from the commit and still have no preview-stop caller.
- Stop Preview button lives in `WorkspacePreviewPanel` at `data-testid="workspace-preview-stop"` after Start and before Refresh. Both existing mounts inherit it.
- Visible only when a session exists and `previewState` is `loading` or `ready`, or while `previewStopInFlight`. Hidden for `unavailable`, `error`, or no session.
- POST `/api/preview/${selectedSessionId}/stop` with `method: 'POST'`, no body, no CSRF, no DELETE, no session Stop.
- On `response.ok`, awaits existing `onRefreshPreview()`. On failure, local `preview.stopFailed` at `workspace-preview-stop-error`; previewState/url kept.
- i18n keys match freeze: `preview.stopPreview` / `preview.stopFailed` in en / zh-TW / zh-CN.
- LOCAL-TESTS preserved from Step 3: `node --import tsx --test components/workspace/workspace-shell.test.tsx` PASS 466/466; `npx tsc --noEmit` PASS. Not re-run this lock window.
- Evidence class LOCAL-TESTS. Staging/browser proof was not in this slice and is not required to lock.

### 18.2 APPLY-01 remains unlocked

PREVIEW-STOP-STAGING-APPLY-01 remains REGISTERED / READY / NOT ADMITTED / Step 3 COMPLETE / Step 4 EVALUATED NOT LOCKED / not locked / partial pass. This lock does not rewrite APPLY-01.

### 18.3 Step 4 acceptance

- [x] Keith authorized Step 4 this window
- [x] Independent verification against freeze + committed HEAD `e165ede0b611210b98894066d516dc02f6071bc8` (`feat: add preview stop control`)
- [x] Frozen write set confirmed: exactly the five frontend/i18n files; no `page.tsx` / Gateway / container-manager
- [x] LOCAL-TESTS preserved from Step 3: workspace-shell.test.tsx 466/466; `npx tsc --noEmit` PASS
- [x] PREVIEW-STOP-STAGING-APPLY-01 not locked / not modified
- [x] no runtime/browser/staging/SSH/AWS/PM2/Docker/Postgres/Redis/provider/credit this lock window
- [x] EXEC-01C6A `startCondition=NOT_READY` UNCHANGED
- [x] BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON
- [x] sidecar `status=LOCKED` / `admissionUncertain=false`; `lockedTaskIds` includes PREVIEW-STOP-UI-01
- [x] Occupancy EMPTY; no lane admitted; GOVERNANCE released UNOWNED; no follow-on registered
- [x] Validator PASS this lock window
- [x] `git diff --check` PASS
- [x] No Git commit/push by the worker

### 18.4 Authorization state (end of Step 4 lock)

```
IMPLEMENTATION_AUTHORIZED=YES (Step 3 source COMPLETE AND LOCKED; frozen five-file frontend+i18n write set only)
ADMISSION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
TESTS_EXECUTED=YES (workspace-shell.test.tsx 466/466; npx tsc --noEmit; recorded from Step 3; not re-run this lock window)
APPLICATION_SOURCE_CHANGED=YES (frozen write set only; committed at e165ede; this lock does not behavior-change those files)
LANE_1=EMPTY
LANE_2=EMPTY
FRONTEND_DECLARED=YES
FRONTEND_ACQUIRED=NO
I18N_DECLARED=YES
I18N_ACQUIRED=NO
GATEWAY_DECLARED=NO
CONTAINER_MANAGER_DECLARED=NO
STEP4_AUTHORIZED=YES
STEP4_COMPLETE=YES
LOCKED=YES
FOLLOW_ON_REGISTERED=NO
EXEC_01C6A_REOPENED=NO
CANDIDATE_STATUS=LOCKED
ADMISSION_UNCERTAIN=false
WRITE_SET_PRECISION=EXACT
PREVIEW_STOP_STAGING_APPLY_01=UNCHANGED
BUILDER_LIVE_GATE_01=COMPLETE AND LOCKED / LEFT_ON
```

**Step 4 lock ledger (this window):** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0 except lane-capacity validator, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0, follow-on registration=0. Governance writes: this stage-start Step 4 checkpoint; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-UI-01 body; sidecar candidate `status=LOCKED` / `admissionUncertain=false` + `lockedTaskIds`; `SATURATION_PROOF.json` only as validator output. Occupancy facts unchanged (EMPTY / GOVERNANCE UNOWNED).

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Activation effect:** NONE (source already committed at `e165ede`; this window records evidence only).
**Rollback boundary:** this lock = discard this window's board/registry/stage-start/sidecar lock field updates. Step 3 source = revert `e165ede` (five frozen frontend/i18n files plus Step 3 control-plane fields; not performed). Ordinary Builder Ask/Build/static Preview path, locked PREVIEW-STOP-01 LOCAL-TESTS evidence, locked PUBLIC-ROUTE-01 / STAGING-01 public stop evidence, locked Vite start path, APPLY-01 Step 3 staging apply/proof, live gate, and credit UX are otherwise untouched.

### Verdict

**PREVIEW-STOP-UI-01 is COMPLETE AND LOCKED.**

**Committed implementation HEAD:** `e165ede0b611210b98894066d516dc02f6071bc8` (`feat: add preview stop control`)

**Frozen write set (implemented):**

1. `frontend/components/workspace/workspace-shell.tsx`
2. `frontend/components/workspace/workspace-shell.test.tsx`
3. `frontend/messages/en.json`
4. `frontend/messages/zh-TW.json`
5. `frontend/messages/zh-CN.json`

**Invariants:** EXEC-01C6A `startCondition=NOT_READY` UNCHANGED / not reopened. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED. Lane 3 remains DISABLED. No follow-on task registered. PREVIEW-STOP-STAGING-APPLY-01 remains unchanged / not locked. Occupancy EMPTY. GOVERNANCE released UNOWNED.
