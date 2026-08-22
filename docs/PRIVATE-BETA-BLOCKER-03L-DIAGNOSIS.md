# PRIVATE-BETA-BLOCKER-03L — Step 1 Diagnosis

**Task ID:** PRIVATE-BETA-BLOCKER-03L  
**Title:** Builder Static Preview Entrypoint Contract Root-Cause Investigation  
**Step:** 1 — Registration + product-contract / root-cause diagnosis only  
**Date:** 2026-08-22  
**Classification:** RUNNER_FIXTURE_FIX  
**Evidence class:** LOCAL-TESTS (static / source / locked-checkpoint proof; no runtime)  
**Nature:** DIAGNOSIS ONLY — no product implementation, no runner implementation, no LIVE, no Git mutation

Do not treat this document as a scheduler. Do not rewrite LIVE-08. Do not convert LIVE-08 to PASS. Do not rerun LIVE-08. Do not reopen AUTO-01G / AUTO-01H / AUTO-01I. Do not change `e2e-auto.html` to `index.html` in this Step 1. Do not register PRIVATE-BETA-INVITE-01.

Triggering locked evidence:

- `docs/PRIVATE-BETA-E2E-LIVE-08-CHECKPOINT.md`
- `docs/PRIVATE-BETA-E2E-LIVE-08-EXECUTION.md`

Authoritative domains:

- `PRD.md` = PRODUCT WHAT
- `ARCHITECTURE.md` = TECHNICAL HOW (high-level; does not specify static HTML entrypoint)
- Locked preview HOW evidence: `docs/PREV-02-02-CHECKPOINT.md`, `docs/PREVIEW-STRATEGY-01A-CHECKPOINT.md`
- `CLAUDE.md` = DEVELOPMENT OS / RULES

Step 1 local observation (informational; not frozen for Step 2):

- branch = `main`
- HEAD = `90b6dfb75f814a2bf326a876e655c9b8a4b2f2ca`
- `git status --short` = empty (CLEAN) before Step 1 writes

---

## 1. Identifier verification

Repo-wide search for `PRIVATE-BETA-BLOCKER-03L` before this registration found **zero** `### PRIVATE-BETA-BLOCKER-03L` registry entries.

The only occurrence was historical recommendation prose:

- `docs/PRIVATE-BETA-E2E-LIVE-08-CHECKPOINT.md` (“Likely identifier if later registered”; “Do not register the follow-up product task here”)
- `TASKS.md` CURRENT EXECUTION BOARD next-gate / LIVE-08 frozen contract (“Do not register PRIVATE-BETA-BLOCKER-03L here”)
- `TASKS_BACKLOG_FULL.md` LIVE-08 lock “Exact next (NOT REGISTERED HERE)”

Historical recommendation prose does not count as prior registration.

Existing sibling IDs remain locked and unused as this identifier: PRIVATE-BETA-BLOCKER-03A..03K.

---

## 2. Frozen LIVE-08 symptom (not rewritten)

LIVE-08 remains:

```
COMPLETE AND LOCKED — FAIL/BLOCKED — PRODUCT_FAILURE — PREVIEW — 2026-08-22
```

Frozen facts used as evidence, not as the fix:

| Field | Frozen value |
|---|---|
| AUTHORIZED_LOCAL_HEAD | `f9efc0f6d2803adbc91689ce75670434a6e89cb5` |
| AUTO-01I / AUTO-01H / AUTO-01G | HELD in LIVE |
| BUILD executionId | `145e789a-7aa8-4f7a-80c6-d7a0a6156878` |
| Provider | xAI / grok-4.5 |
| Provider calls / retries | 1 / 0 |
| tokens_used | 1177 |
| AUTO_APPLY | PASS |
| Persisted write | `POST /api/sessions/25d80ee1-ca1f-4b8e-9e5f-42156c1341c0/files/write` path=`e2e-auto.html` HTTP 204 |
| Generated file | `/opt/aisandbox/workspaces/25d80ee1-ca1f-4b8e-9e5f-42156c1341c0/e2e-auto.html` (191 bytes) |
| Marker | `<h1>PRIVATE-BETA-E2E-AUTO</h1>` |
| PREVIEW | Start Preview clicked; UI remained “Preview unavailable”; iframe never mounted; container-manager had no “Starting preview” for that session |
| Current static-preview prerequisite | `index.html` |

LIVE-08’s historical classification remains PRODUCT_FAILURE regardless of this diagnosis. This document does not convert LIVE-08.

---

## 3. Complete Preview call / data-flow

Concrete chain from UI click to static-server startup. No HTML entrypoint is present at any boundary.

### 1. Start Preview button / action

- File: `C:\Users\knlee\aiSandBox2026B\frontend\components\workspace\workspace-shell.tsx`
- Function: `WorkspacePreviewPanel`
- Control: `data-testid="workspace-preview-start"`
- Enabled only when `selectedSessionId` is set and `previewState === 'unavailable'`
- Click: `onClick={() => void props.onStartPreview()}`
- Input: none (no selected-file, no path, no command)
- Output: calls page handler

### 2. Frontend preview state

- File: `C:\Users\knlee\aiSandBox2026B\frontend\app\[locale]\app\page.tsx`
- Function: `handleStartPreview`
- Sets `previewState='loading'`, `previewUrl=null`
- State type: `WorkspacePreviewState = 'loading' | 'ready' | 'unavailable' | 'error'` in `workspace-preview.logic.ts`

### 3. Frontend request payload

```ts
await fetch(`/api/preview/${selectedSessionId}/start`, { method: 'POST' });
```

- No JSON body
- No `command`
- No `entrypoint`
- No `path`
- No `selectedFilePath`
- `selectedFilePath` exists for the editor and is used only as an autosave `hint` **after** a successful start

### 4. API Gateway route

- File: `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\preview\preview.controller.ts`
- Controller: `@Controller('preview')` `@All('*')` `proxyToContainerManager`
- Guards: `SessionCookieGuard`, `PreviewOwnershipGuard`
- Input: browser `POST /api/preview/:sessionId/start` (+ empty body)
- Output: forwards method, path, `req.body`, query, sanitized headers to container-manager

### 5. Gateway forwarding

- URL: `${CONTAINER_MANAGER_URL}${req.path}` typically `http://container-manager:4010/api/preview/:sessionId/start` (or local `:4002`)
- Body: empty / no `command`
- Error: 502 only if container-manager is unreachable; HTTP 400 from CM is forwarded as-is (`validateStatus: () => true`)

### 6. Container-manager preview endpoint

- File: `C:\Users\knlee\aiSandBox2026B\services\container-manager\src\preview\preview.controller.ts`
- Method: `POST :sessionId/start` → `PreviewService.startPreview(sessionId, command?)`
- `@Body('command') command?: string` — LIVE-08 / current UI send **undefined**

### 7. Project / workspace-type detection

- File: `C:\Users\knlee\aiSandBox2026B\services\container-manager\src\preview\preview-strategy.resolver.ts`
- Method: `PreviewStrategyResolver.resolve(sessionId, providedCommand?)`
- Order:
  1. provided command → `node-dev-server`
  2. `/workspace/package.json` → framework / npm scripts
  3. `/workspace/index.html` → `static-html`, `appRoot='/workspace'`
  4. `/workspace/*/index.html` (immediate subdirectory) → `static-html`, `appRoot='/workspace/<subdir>'`
  5. any `/workspace/*.html` without `index.html` → `unknown`, framework `'Static HTML (missing-index)'`
  6. nothing → `unknown`, “No package.json or start command found”

LIVE-08 workspace: no `package.json`, no `index.html`, one root HTML (`e2e-auto.html`) → step 5.

### 8–10. Static HTML detection / entrypoint / index.html check

See §4 below. Entrypoint is **not a request field**. It is inferred solely as `index.html` at workspace root or one immediate subdirectory.

### 11. Preview process / server startup

- File: `preview.service.ts` `startPreview`
- For `static-html`: records in-memory `activePreviews` as `status:'running'` and **does not** spawn `npx serve`. Serving is later **direct-read** via `readStaticPreviewContent`.
- The log `Starting preview for session ${sessionId}` is emitted **only after** unknown-strategy throws. LIVE-08 had no such log because start threw first.

### 12. Returned preview URL / status

- Success 200: `{ success:true, port, status, framework, previewUrl:'/api/preview/:sessionId/proxy' }`
- LIVE-08 path: HTTP **400** `{ message:'Static HTML preview requires /workspace/index.html at the workspace root.', error:'Bad Request', statusCode:400 }`
- Subsequent `GET /api/preview/:sessionId/status` → `{ running:false, message:'No active preview for this session' }` because nothing was stored in `activePreviews`

### 13. Frontend iframe mount condition

- File: `workspace-shell.tsx` `WorkspacePreviewPanel`
- `{props.previewUrl ? <iframe data-testid="workspace-preview-iframe" src={props.previewUrl} /> : null}`
- `previewUrl` is set only when `startResponse.ok` or status poll `running===true`
- LIVE-08: `previewUrl` stayed null → iframe never mounted

### 14. “Preview unavailable” condition

- After non-ok start and failed poll, `handleStartPreview` sets `previewState='unavailable'`
- `PreviewStateMessage` for `unavailable` always renders hardcoded heading `"Preview unavailable"` and i18n body `recoveryCopy.workspace.previewUnavailable` (“No preview is running for this workspace yet.”)
- This is the **idle / not-running** empty state, not an error presentation of the 400 message

---

## 4. Exact index.html enforcement location

| Item | Value |
|---|---|
| Absolute path | `C:\Users\knlee\aiSandBox2026B\services\container-manager\src\preview\preview-strategy.resolver.ts` |
| Method | `PreviewStrategyResolver.resolve` |
| Condition | `fileExists(sessionId, '/workspace/index.html')` is false **and** `findSubdirWithIndexHtml` is null **and** `hasAnyHtmlAtRoot` is true (`ls /workspace/*.html`) |
| Result of resolver | `{ type:'unknown', framework:'Static HTML (missing-index)', diagnosticMessage:'Static HTML preview requires index.html at the workspace root or in an immediate subdirectory.' }` |
| Caller | `PreviewService.startPreview` in `C:\Users\knlee\aiSandBox2026B\services\container-manager\src\preview\preview.service.ts` |
| Resulting behavior | `if (strategy.framework === 'Static HTML (missing-index)') throw new BadRequestException('Static HTML preview requires /workspace/index.html at the workspace root.')` **before** port allocation and **before** `console.log('Starting preview…')` |
| Explicit entrypoint/path passable today? | **No HTML entrypoint field exists.** Optional `command` is a **shell start-command override** that forces `node-dev-server`, not static HTML selection. Frontend does not send it. |
| Static-only or frameworks too? | **Static-only.** Framework projects are selected by `package.json` / scripts and never require `index.html` for start. Root `/` for **already-started** static serving still maps to `index.html` via `sanitizeStaticPath`. |

Owning layer: **container-manager preview strategy resolver + preview service**. Not frontend, not gateway, not a workspace classifier, not a project-model property.

Locked origin of this rule: `docs/PREV-02-02-CHECKPOINT.md` (fail-closed at start instead of start-success + proxy 500 for `hello.html`-only workspaces). Extended but preserved by `docs/PREVIEW-STRATEGY-01A-CHECKPOINT.md` (subdirectory `/workspace/*/index.html`).

---

## 5. Contracts by layer

### Frontend request contract

- `POST /api/preview/:sessionId/start` with **no body**
- Success: any ok HTTP → set `previewUrl` to `/api/preview/:sessionId/proxy?refresh=<token>`
- Failure: ignore response JSON; poll status; if not running, `previewState='unavailable'`
- Does **not** parse `message` / `statusCode` 400
- Does **not** send selected file

### Gateway contract

- Opaque proxy of `/api/preview/*` to container-manager
- No schema for entrypoint
- Forwards `req.body` if present; current UI sends none

### Container-manager contract

- `startPreview(sessionId, command?: string)`
- `command` = optional process command, not HTML path
- Static eligibility = `index.html` at `/workspace` or `/workspace/<immediate-subdir>/`
- Missing-index HTML → HTTP 400, `running` remains false

### Static server contract

- After a successful static start, `GET /api/preview/:sessionId/proxy` / `proxy/` maps `''` or `'/'` to **`index.html`** (`sanitizeStaticPath`)
- Files are read from `appRoot` (`/workspace` or subdirectory)
- This mapping is why PREV-02-02 refused to start when `index.html` is absent: start-success + `/` → missing `index.html` previously produced HTTP 500

---

## 6. Authoritative product-contract evidence

### PRD WHAT (`PRD.md`)

PRD requires:

- AI workspace change pipeline: request → file-actions → apply → **preview** → checkpoint
- After apply, file tree, editor, and preview “reflect the changes”
- Integrated preview of running applications via HTTP/WebSocket proxying

PRD does **not** say:

- `index.html` is mandatory
- Preview targets the currently selected file
- Arbitrary `*.html` files are valid static-preview entrypoints
- Builder must always emit `index.html`

### ARCHITECTURE HOW (`ARCHITECTURE.md`)

High-level preview proxying only. No static entrypoint field. No `index.html` rule.

### Locked preview HOW (implementation contract with tests)

- **PREV-02-02** explicitly changed product start behavior so a workspace with HTML other than `index.html` **must not start** and must fail early with HTTP 400 rather than later 500.
- Runtime validation in that lock: `hello.html`-only → start HTTP 400 with message requiring `/workspace/index.html`.
- **PREVIEW-STRATEGY-01A** preserved that missing-index path and added subdirectory `index.html` support.
- Unit test: `preview-strategy.resolver.spec.ts` “returns unknown with missing-index when HTML exists but no index.html”.

### Disagreement

PRD is **silent** on the static entrypoint. Locked preview HOW is **explicit**: static Preview is a **project-root** `index.html` site, not a selected-file viewer.

That is not a PRD contradiction. It is a specified HOW for an unspecified WHAT detail. PREV-02-02 is the most specific locked product behavior for this boundary.

Intended customer behavior supported by that locked HOW:

1. **Refuse Start Preview unless the static project has `index.html`** (root or immediate subdirectory).
2. Start Preview previews the **project**, not the currently selected editor file.
3. Builder may create arbitrary filenames; those files are valid workspace files; they are **not** sufficient to start static Preview.

The about.html / landing.html UX question is therefore **answered by PREV-02-02**, not a new product-spec gap for Start Preview behavior. A later task could still decide to *change* that contract (selected-file preview, auto-pick sole HTML, Builder-forced `index.html`). That would be a new product decision and a Preview redesign. It is **not** required to explain LIVE-08, and it is **not** 03L Step 2.

---

## 7. Is index.html explicitly mandated?

| Question | Answer |
|---|---|
| Documented in PRD as mandatory? | **No** |
| Documented in ARCHITECTURE.md as mandatory? | **No** |
| Locked preview implementation / tests? | **Yes — static HTML start requires `index.html`** |
| New generic/static project seeded with `index.html`? | **No.** Project create makes an empty directory / empty workspace; no template `index.html` |
| Builder required to create `index.html` for first HTML? | **No.** File-action contract requires `path` + `content` only; path is whatever the model emits |
| AI allowed to create arbitrary `*.html` as a valid first result? | **Yes**, as a workspace file. AUTO_APPLY writes that path exactly. Preview start then depends on whether `index.html` exists |
| Preview designed around project root or selected file? | **Project root** (or one immediate subdirectory root that contains `index.html`) |
| Entrypoint property in project / session / preview request / workspace metadata / frontend state? | **None.** `Project` and `Session` entities have no entrypoint field. Preview request has optional `command` only. Frontend `selectedFilePath` is editor state |
| UI to choose an HTML file to preview? | **No.** Visual-edit picker selects DOM elements **inside an already running preview** |
| Start Preview = entire project vs selected file? | **Entire project / detected appRoot** |

---

## 8. Builder filename contract

Trace:

1. User/build prompt (golden path: `BUILDER_PROMPT` in `e2e/builder-golden-path/lib/constants.ts`) asks for a **named** file.
2. AI system contract (`FILE_ACTION_OUTPUT_CONTRACT` in `services/ai-service/src/worker/worker.processor.ts`) requires a `file-actions` JSON array with `path` and `content`. It does **not** mention `index.html`.
3. Parser accepts the model’s `path` as-is (`file-actions.parser`).
4. Frontend `applySequentialFileActions` calls `writeFile(action)` with `action.path` unchanged (`workspace-ai-file-actions.logic.ts`).
5. `writeWorkspaceFile` POSTs `{ path: args.filePath, content }` (`workspace-file-navigation.logic.ts`).
6. Gateway `POST /api/sessions/:sessionId/files/write` → container-manager write of that path.

Findings:

- Builder does **not** normalize a first HTML file to `index.html`.
- System prompt does **not** tell the model to use `index.html`.
- The model may freely choose `page.html` / `about.html` / `e2e-auto.html` if the user (or prompt) asks, or by unenforced convention.
- AUTO_APPLY preserves paths exactly. LIVE-08 write `path=e2e-auto.html` HTTP 204 proves this.
- No post-processing establishes an entrypoint.
- `e2e-auto.html` is special **only** because the golden-path prompt names it and forbids other files.
- A normal user asking “build me a simple page” would **often** yield `index.html` by model convention (historical E2E-01/02/03 prompts asked for `index.html`; 03A diagnosis shows the model talking about `index.html`). That is **convention, not an enforced product contract**. Do not call it guaranteed.

---

## 9. Golden-path artifact contract

Source of the frozen filename:

- `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\constants.ts`
- `FROZEN_ARTIFACT_PATH = 'e2e-auto.html'`
- `BUILDER_PROMPT` = create a single file named that path with exact `FROZEN_HTML`, “Do not create or modify any other file.”
- Present from the first AUTO-01 runner commit (`7b42fef implement automated Builder golden-path runner`). Not later drift.

Why that name historically:

- Manual E2E-04 used `e2e-04.html`; E2E-05 used `e2e-05.html` — unique disposable artifacts for apply observation.
- AUTO-01 continued that unique-name pattern as `e2e-auto.html`.
- Unique **content** (`<h1>PRIVATE-BETA-E2E-AUTO</h1>`) is what Preview actually asserts (`PREVIEW_HEADING` / iframe `h1`), not the filename.

What the test is intended to prove:

- Full Builder golden path including **immediate Preview of the generated page** (AUTO-01 purpose: preview immediately after AUTO_APPLY).
- AUTO_APPLY persistence of the requested path (AUTO-01G observes `files/write` 204 for `FROZEN_ARTIFACT_PATH`).

Does PREVIEW require a non-index filename? **No.** Unique heading/paragraph already identify the page. E2E-02 used the same prompt shape with `index.html` and recorded **Preview PASS**.

Would changing the fixture to `index.html` reduce coverage or merely align it?

- It would **align** the fixture with the locked static-preview contract and with E2E-02.
- It would stop this E2E from exercising the missing-index refusal path. That path is already unit-tested in container-manager (`missing-index` resolver case + PREV-02-02). The golden path is not the right place to keep proving a locked refusal.

---

## 10. Working Preview comparisons

| Example | Project type | Relevant files | index.html? | Entrypoint requested? | How preview started | Preview result |
|---|---|---|---|---|---|---|
| PREV-01 | static HTML | `index.html` written via files/write | yes | none (project root) | `POST …/start` then proxy | PASS — proxy 200 of `index.html` |
| PREV-02-02 preserved path | static HTML | `/workspace/index.html` | yes | none | start + proxy | PASS |
| PREV-02-02 hello-only | static HTML | `hello.html` only | **no** | none | start | HTTP 400; running false — **intended** |
| PREVIEW-STRATEGY-01A subdirectory | static HTML | `/workspace/WorkspaceA/index.html` | yes in subdir | inferred appRoot | start | intended PASS |
| PRIVATE-BETA-E2E-02 | Builder generated static | `index.html` from prompt | yes | none | Start Preview in workspace | **PASS** (heading + paragraph) |
| PRIVATE-BETA-E2E-05 | Builder generated static | `e2e-05.html` | no | none | attempted after idle timeout | Preview not proven (session stopped); **UNKNOWN** as preview-subsystem evidence |
| LIVE-06 | Builder generated static | `e2e-auto.html` | no | none | runner never reached PREVIEW | N/A |
| LIVE-08 | Builder generated static | `e2e-auto.html` | no | none | Start Preview clicked | FAIL — unavailable / no iframe / no CM start |

Smallest meaningful difference from LIVE-08 vs E2E-02: **filename `e2e-auto.html` instead of `index.html`**, with the prompt forbidding any other file. Everything else (one-file HTML, AUTO_APPLY, Start Preview, default Preview tab) matches the intended golden path.

Framework apps: start via `package.json` scripts; `index.html` not required for start. Not the LIVE-08 class.

Blank/new project: empty workspace; Start Preview → unknown / “No package.json or start command found” (no HTML at all), distinct from missing-index.

---

## 11. Earlier LIVE / Preview filename evidence

| Evidence | Filename recorded? | Preview |
|---|---|---|
| E2E-02 | `index.html` | PASS |
| E2E-03 | `index.html` | file PASS; Preview not claimed as the LIVE-08-class proof here |
| E2E-05 | `e2e-05.html` | Preview attempted after idle_timeout; **not** a proven Preview-subsystem defect |
| LIVE-01..LIVE-07 | PREVIEW not reached except LIVE-06 never entered PREVIEW | N/A |
| LIVE-08 | `e2e-auto.html` | FAIL as frozen |
| PREV-01 | `index.html` | PASS |

Do not infer from a generic “Preview PASS” without a filename. Where filenames are recorded, successful static Preview used **`index.html`**.

---

## 12. Failure-signal quality (secondary)

Container-manager **does** produce a meaningful reason:

`Static HTML preview requires /workspace/index.html at the workspace root.`

Frontend **discards** it:

- `handleStartPreview` / `refreshPreviewForSession` only check `startResponse.ok`
- no `response.json().message`
- maps all non-ok starts to the generic unavailable empty state

LIVE-08 UI text:

> Preview unavailable. No preview is running for this workspace yet.

That is accurate as “no preview is running” and **inaccurate as an explanation**. Heading `"Preview unavailable"` is hardcoded English in `workspace-shell.tsx`; body is i18n.

**Do not expand 03L Step 2 into copy/error UX.** Not necessary for the proven root fix (runner fixture alignment). A later UX task, if selected, must be multilingual-first.

---

## 13. Hypotheses

### H1 — Container-manager intentionally defines static web root as index.html; LIVE-08 fixture violated that contract

- Support: PREV-02-02 lock; PREVIEW-STRATEGY-01A; resolver + `startPreview` 400; E2E-02 Preview PASS with `index.html`; AUTO-01 prompt forbids creating `index.html`.
- Contradict: none material.
- **Verdict: CONFIRMED** as the owning static-preview contract. The LIVE-08 generated file was valid **as a workspace file** and invalid **as a static-preview root**.

### H2 — Container-manager unnecessarily hardcodes index.html even though Builder workspaces validly support arbitrary HTML entrypoints

- Support: Builder file-actions allow arbitrary paths; PRD is silent.
- Contradict: PREV-02-02 was a deliberate fail-closed fix after `hello.html` start-success + proxy 500 because `/` always maps to `index.html`. Static serving still maps `/` → `index.html`. No entrypoint API exists.
- **Verdict: REFUTED** as “unnecessary.” The hardcoded name is the static site root contract, not an accidental leftover.

### H3 — Frontend has selected-file information but fails to pass it into Preview

- Support: `selectedFilePath` exists; autosave hint after start uses basename.
- Contradict: start fetch has no place to put it; CM would ignore an HTML path in `command` (would treat it as a shell command). After AUTO_APPLY the default tab is Preview, so the generated file is often not even selected.
- **Verdict: TRUE as a fact, NOT causal.** Passing the selected file would require a new API and would reverse PREV-02-02. Out of Step 2 scope.

### H4 — Gateway/API supports entrypoint but frontend omits it

- Support: gateway forwards body.
- Contradict: no entrypoint field; only optional `command` (process override). Frontend omits body because the contract has no HTML entrypoint.
- **Verdict: REFUTED.**

### H5 — Builder contract requires index.html but the golden-path prompt incorrectly forces e2e-auto.html

- Support: golden-path prompt forces `e2e-auto.html` and forbids other files.
- Contradict: Builder **does not** require `index.html`. Requiring Builder to emit `index.html` against an explicit user path would violate file-action path fidelity.
- **Verdict: PARTIAL.** The prompt is the fixture error. There is no Builder-enforced `index.html` contract to restore.

### H6 — Builder should ensure a project entrypoint independent of filename, and that step is missing

- Support: none in PRD / file-action contract / post-apply pipeline.
- Contradict: AUTO_APPLY is path-preserving by design; no post-processing entrypoint step exists or is specified.
- **Verdict: REFUTED.**

### H7 — Error-message discard / another cause

- Support: 400 message discarded; generic unavailable UI.
- Contradict: even with perfect copy, start would still refuse; iframe would still not mount; CM would still not start. LIVE-08 failure is start-refusal, not mis-copy.
- **Verdict: CONFIRMED as secondary UX. NOT the root cause.**

---

## 14. Precise root cause

Two independently correct contracts were never aligned in AUTO-01:

1. **Static Preview (locked HOW):** Start Preview starts a **project-root static site**. Eligibility and `/` serving require `index.html`.
2. **Builder apply (locked HOW):** persist the model’s `path` exactly. The golden-path prompt names `e2e-auto.html` and forbids creating any other file, so `index.html` cannot appear.

LIVE-08 therefore:

- correctly persisted `e2e-auto.html`
- correctly refused to start static Preview
- correctly left the UI in “Preview unavailable” with no iframe

The golden path’s PREVIEW phase is intended to render the generated page, as E2E-02 already did with `index.html`. AUTO-01 changed only the disposable filename (unique-artifact lineage from `e2e-04.html` / `e2e-05.html`) and thereby made the generated workspace **preview-incompatible** under the existing static contract.

This is **not** a Preview implementation regression vs PREV-02-02.  
This is **not** a Builder apply bug.  
This is **not** an AUTO-01G/H/I observation bug.

---

## 15. Classification

```
RUNNER_FIXTURE_FIX
```

Why not the others:

- **PRODUCT_IMPLEMENTATION_FIX** — would reverse PREV-02-02 / change static serving of `/`. That is a Preview redesign, not the smallest LIVE-08 correction.
- **BUILDER_CONTRACT_FIX** — would make Builder rewrite a user-requested path to `index.html`, breaking file-action path fidelity. The LIVE-08 path was what the prompt asked for.
- **PRODUCT_SPEC_DECISION_REQUIRED** — Start Preview behavior for static sites is already decided by PREV-02-02. PRD silence does not reopen that lock for this golden-path failure.
- **OTHER** — not needed.

LIVE-08 remains PRODUCT_FAILURE historically: the **product as exercised by that fixture** did not preview the generated page. 03L explains *why* that product outcome is the locked static-preview contract plus a preview-incompatible fixture, not a new Preview code defect.

---

## 16. Would renaming e2e-auto.html → index.html hide a real product issue?

**No for the golden-path / LIVE-08 class. Yes only if this E2E were being used as the about.html selected-file test — which it is not.**

- Real users **can** generate `about.html` / `landing.html`. Start Preview **will refuse** unless `index.html` also exists. That is the **locked intended limitation** from PREV-02-02, already covered by container-manager tests.
- Real users asking for “a simple page” without a filename are **not guaranteed** `index.html`, but historical Builder prompts and E2E-02 show `index.html` as the preview-compatible convention.
- The LIVE-08 prompt **forces** a non-index name and **forbids** `index.html`. That is not a typical customer first-page request; it is a fixture choice.
- Unique page identity is the heading `PRIVATE-BETA-E2E-AUTO`, not the filename.
- Changing the frozen path to `index.html` makes the golden path conform to the legitimate static-preview contract (and to E2E-02). It does not paper over a Preview bug that customers hit when they follow the same “create this exact HTML page as the site root” intent.

Do **not** use 03L Step 2 to add selected-file preview so that `e2e-auto.html` becomes previewable. That would hide the fixture error by expanding product scope.

---

## 17. Intended customer behavior (evidence-supported)

For a user who asks Builder to create standalone `about.html` / `landing.html`:

**Start Preview should refuse** until a static root `index.html` exists (or a framework `package.json` start path exists). That is PREV-02-02.

Builder should still create the named file. Preview is not a selected-file opener.

For the golden-path customer equivalent (“create this exact simple page and preview it”), the file must be the static root: **`index.html`**.

---

## 18. Smallest Step 2 proposal (do not implement in Step 1)

**One runner fixture correction:** set `FROZEN_ARTIFACT_PATH` to `index.html` so the prompt, AUTO_APPLY observer, file-tree testid, and CONTRACT fixtures request/observe the static-preview root. Keep unique `FROZEN_HTML` / `PREVIEW_HEADING` / `PREVIEW_PARAGRAPH`.

No product Preview change. No Builder prompt/system-contract change. No LIVE. No dependency add.

TDD:

**RED:** add a focused CONTRACT assertion that the frozen golden-path artifact path **is** the static-preview entrypoint `index.html` (so current `e2e-auto.html` fails for the LIVE-08 mismatch reason).

**GREEN:** change `FROZEN_ARTIFACT_PATH` to `index.html`; update prompt interpolation (automatic), AUTO_APPLY path expectations, and any hard-coded `e2e-auto.html` fixtures/selectors that derive from the constant.

Then run the existing builder-golden-path CONTRACT suite and TypeScript check.

Do not edit product Preview to accept `e2e-auto.html`. Do not add a second change (error-copy UX) in the same slice.

### Likely implementation files

- `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\constants.ts`

### Likely test / fixture files (update with the constant; no product tests that reverse PREV-02-02)

- `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\tests\live-adapters.spec.ts`
- `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\local-fixture.ts` (if it inlines the path)
- any other `e2e/builder-golden-path/**` files that hard-code `e2e-auto.html` instead of `FROZEN_ARTIFACT_PATH`

### Frontend UX/copy

**Not needed** for Step 2.

### Backend / service change

**Not needed** for Step 2.

---

## 19. Residual uncertainty

- Whether a later product task should surface the CM 400 message instead of generic “Preview unavailable” (UX; multilingual-first if selected).
- Whether a later product task should add selected-file / sole-HTML preview (would reverse PREV-02-02; not 03L).
- Whether unprompted “build me a page” commonly yields `index.html` in production (convention only; not proven statistically here).
- E2E-03 Preview outcome beyond file existence: not used as LIVE-08 comparison.

None of these block Step 2 of the runner fixture alignment.

---

## 20. Step 1 activity ledger

```
LIVE runs = 0
SSH = 0
staging = 0
provider = 0
credits = 0
gate mutation = 0
project/session/container = 0
product implementation changes = 0
runner implementation changes = 0
dependencies = 0
Git mutations = 0
Docker/Postgres/Redis start = 0
```

Local read-only inspection only, plus this diagnosis document and control-plane registration writes.

---

## 21. Step 1 terminal state

```
03L_REGISTERED=YES
03L_ADMITTED_LANE=1
03L_STEP_1=COMPLETE
03L_STEP_2=NOT STARTED
03L_STEP_3=NOT STARTED
ROOT_CAUSE_PROVEN=YES
OWNING_CONTRACT=PREV-02-02 static preview requires index.html
CLASSIFICATION=RUNNER_FIXTURE_FIX
RENAMING_WOULD_HIDE_PRODUCT_BUG=NO
PRODUCT_IMPLEMENTATION_NEEDED_IN_03L=NO
BUILDER_CONTRACT_CHANGE_NEEDED_IN_03L=NO
FRONTEND_UX_NEEDED_IN_03L=NO
BACKEND_CHANGE_NEEDED_IN_03L=NO
LIVE_08_UNCHANGED=COMPLETE AND LOCKED — FAIL/BLOCKED — PRODUCT_FAILURE — PREVIEW
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
LIVE_STAGING_VALIDATED=NO
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

Blocker before Step 2: Keith commit of these Step 1 governance writes; open a fresh window for Step 2; acquire only the runner HOTFILE / write scope required for the fixture change; do not reserve STAGING / PROVIDER-LIVE / CREDIT / ENV; no LIVE in 03L.
