# PREVIEW-PICKER-01 — Checkpoint

**Task:** PREVIEW-PICKER-01 — Rebuild Select Element over postMessage for the isolated preview
**Status:** COMPLETE AND LOCKED — 2026-11-12. Not deployed.
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. It was changed from 3-step at admission, because the injection design was open. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the PREVIEW-ORIGIN-01 LOCK. Keith started it ("Yes, start it") and approved the design ("Yes, approve both").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | at the PREVIEW-ORIGIN-01 LOCK | 01587b7 |
| 2. Stage-start | Lane 1, no mutex. `docs/PREVIEW-PICKER-01-STAGE-START.md` by a fable subagent (ed0142f, fast-forwarded). The control plane checked the picker, injection and origin facts against the code. Admission b5670f3; record c6ef629 | ed0142f |
| 3. Implementation | Keith approved. FRONTEND, GATEWAY and CONTAINER-MANAGER were acquired with 15 files (e9b9194). The opus subagent stopped as required, because two specs outside the write set asserted the old exact output. The control plane widened the write set by those two test-only specs (ab4d5ec). The worker resumed and finished as c3da5d5, which was cherry-picked | 2653fe9 |
| 4. Consolidation and LOCK | this checkpoint, board, backlog, sidecar, plan and ARCHITECTURE.md, canonical validator | this record |

## Keith's decisions (2026-11-12)

1. Static previews only in this slice. Dev-server previews are deferred to PREVIEW-PICKER-02.
2. Where the picker cannot work, the toggle is not shown. There is no new text.

## Change

**Gateway**
- **The bridge route:** on the preview host, `GET /api/preview/:sessionId/proxy/__aisb/bridge.js` sits behind the unchanged `PreviewAccessGuard`, so it is 403 without the preview cookie.
  - It answers 200 `text/javascript` with no-store, nosniff and no-referrer.
  - The platform origin is written in from `APP_BASE_URL`; the route answers 404 when that is unusable.
- **The reserved prefix:** `proxy/__aisb` and anything under it are reserved on both hosts. The match is decoded and case-insensitive. A reserved path is never forwarded; any reserved path other than the bridge is 404.
- **The platform host** answers 404 for the reserved prefix after its unchanged guards, before any redirect, ticket or container-manager call.
- **The status answer** gains `previewOrigin` (the `PREVIEW_BASE_URL` origin, or null). This is additive only.

**Bridge script** (`preview-bridge-script.ts`)
- An ES5 script that runs once per document and holds no secrets.
- It has no cookie, storage or network access.
- It acts only on messages from the platform origin whose source is its parent window, posts only to that origin, and does nothing when unframed.
- Payloads are cut to the limits, and the whole message is capped at 8192 characters.
- One pick or Escape turns the picker off.

**Container-manager:** adds one `<script src="/api/preview/<sid>/proxy/__aisb/bridge.js" async data-aisb-preview-bridge>` right after the base tag in static HTML. It is added never twice, and only to HTML.

**Frontend**
- **Protocol:** a versioned envelope, `{ aisb: 'preview-bridge', v: 1, type }`, with commands `hello`, `activate-picker` and `deactivate-picker`, and replies `ready`, `picker-state` and `element-selected`.
- **What the page sends and accepts:** the page posts only to `previewOrigin`. Every message must come from `previewOrigin` and from `iframe.contentWindow` before it is parsed. A full validator then checks the envelope and every field limit, and drops anything else silently.
- **Selections:** one is accepted only while the picker is on, and the bridge can never turn the picker on.
- **States:**
  - the toggle shows only after the current document's bridge answers `ready`;
  - with no `ready` within 3 s the picker turns off;
  - a new address resets it;
  - with no preview origin there is no toggle.
- **Visual Edit:** the selection feeds the existing Visual Edit prompt path unchanged.
- **Removed:** the old `contentDocument` injection and the `'*'` targets.

**Unchanged:** guards, cookies, tickets, the route filter, the Set-Cookie limits, `PREVIEW_IFRAME_SANDBOX`, message files and dependencies. No visible text was added; the existing picker keys are reused.

**Tests:**
- 84 new gateway tests, including 50 in `preview.bridge.spec.ts`;
- 9 new container-manager tests;
- 18 new frontend tests, with the states covered in en, zh-TW and zh-CN.

The widened specs changed one assertion each: the expected HTML now includes the bridge tag, and the expected status now includes `previewOrigin: null`.

## Control-plane review

**The bridge script** (`preview-bridge-script.ts`):
- the only value written in is the platform origin;
- a search for cookie, storage, fetch and XHR use found none;
- the origin and source check is at line 315, and its only post targets `PLATFORM_ORIGIN`.

**The page** (`workspace-shell.tsx`):
- it posts with an explicit target origin (line 1443);
- the origin-and-source check comes before parsing (line 1504);
- there is no `contentDocument` and no `'*'`.

## Gates (control-plane rerun on the branch; main has the same files)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 4236 passed (4152 + 84), 7 skipped, plus the 14 known `smoke.integration` failures (they need a database), 246 suites passed |
| gateway `npm run build` | exit 0 |
| container-manager `npm test` | 22 suites, 983 passed (974 + 9), 3 skipped |
| container-manager `npm run build` | exit 0 |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 1849 of 1849 passed (1831 + 18) |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored |
| line endings | all 17 files are LF |

## Records

**ARCHITECTURE.md section 6** now describes the bridge, the reserved prefix, `previewOrigin` and the protocol, in place of "hidden until rebuilt".

## Limits

- **Not deployed.** The deploy is STAGING-DEPLOY-PICKER-01, with Keith's picker check in a static project.
- **Dev-server previews have no picker yet.** That is PREVIEW-PICKER-02, optional.
- **An AI edit made from the selection** needs runs on, so it is not part of the deploy check.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 5: write set widened by the control plane for two test-only specs, recorded; 7: gates rerun by the control plane in three areas; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, cherry-picked by the control plane with autocrlf=false), UI 9/9 (1 and 2: no visible text, existing keys reused, no message file; 3: icons unchanged; 4: impeccable applied as restraint, emil-design-eng as no transition on the pointer highlight and no flicker on first load; 5: DESIGN.md followed; 6: off, on, picked and unavailable states tested in three languages; 7: no redesign; 8: test IDs kept; 9: live check in STAGING-DEPLOY-PICKER-01), BACKEND 6/6 (1: guards, cookies and tickets unchanged; 2: internal routes unchanged; 3: no template; 4: previewOrigin additive, no frozen contract; 5: no schema change; 6: only the known smoke failures), FLOWS 4/4 (1: checkpoints unchanged; 2: n/a, no checkpoint change; 3: the file-action and Visual Edit prompt path unchanged; 4: no DOM rollback or auto-apply)
FOLLOWUPS: 2 registered (STAGING-DEPLOY-PICKER-01; PREVIEW-PICKER-02) / 1 superseded (the ARCHITECTURE.md picker line, by this LOCK's ARCHITECTURE.md edit) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND, GATEWAY and CONTAINER-MANAGER released UNOWNED;
- not deployed.
