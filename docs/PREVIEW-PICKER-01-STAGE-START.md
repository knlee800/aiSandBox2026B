# PREVIEW-PICKER-01 — Stage-start (Step 2 of 4): Select Element over postMessage

**Task:** PREVIEW-PICKER-01 (Lane 1, admitted 2026-11-12 for this document only).
**Status of this file:** DRAFT for Keith's approval. No code changed, nothing run.
**Author:** fable subagent (design stage-start for a cross-origin bridge), worktree `lane/PREVIEW-PICKER-01`, cut from main at b5670f3.
**Short names:** FE = `frontend`, GW = `services/api-gateway/src`, CM = `services/container-manager/src`.

## Summary

- Select Element lets the user click an element in the preview; the next chat prompt then names that element as the target ("Visual Edit"). It has been hidden since PREVIEW-ORIGIN-01, because the preview now runs on another origin and the workspace page can no longer reach into the iframe.
- Recommended: a small **bridge script** that the **gateway serves on the preview host** (with the platform origin written into it), loaded by **one script tag that container-manager adds to static HTML** next to the base tag it already adds. The workspace page and the bridge talk over `postMessage`, each checking the other's origin.
- The workspace page learns the preview origin from a new field on the existing preview **status** answer, added by the gateway.
- This slice covers **static previews**. Dev-server (Vite) previews keep working as today but have no picker; the toggle is not shown there. A follow-up covers them.
- No new visible text, no change to the three message files, no I18N lease. Sandbox tokens, guards, cookies and the route filter are unchanged.
- Mutexes for Step 3: FRONTEND, GATEWAY, CONTAINER-MANAGER. Model: opus. Evidence class: LOCAL-TESTS; the live check belongs to a later deploy task.

## 1. Today's picker

### 1.1 What it does

| Step | What happens | Reference |
|---|---|---|
| Toggle | A violet toolbar button after Refresh, `data-testid="workspace-preview-picker-toggle"`, label `selectElement` when off and `deselectElement` when on, enabled only when a session is selected, a preview URL exists and the state is `ready`. Rendered only if `PREVIEW_PICKER_TOGGLE_VISIBLE`, which is `false` | FE/components/workspace/workspace-shell.tsx:187, 5081-5086, 5159-5170 |
| Turn on | `handlePickerToggle` clears the selection and calls `injectPickerScript` | workspace-shell.tsx:1456-1468 |
| Inject | Reads `iframe.contentDocument`, creates a `<script>` whose text is `generatePickerScriptSource()` and appends it to the preview's body. Any error is swallowed | workspace-shell.tsx:1411-1431 |
| In the preview | The script adds a full-page overlay with a violet highlight box, follows the mouse, and on the first click (captured, default prevented) builds the payload, posts it to the parent with target `'*'`, then removes itself | FE/components/workspace/workspace-preview.logic.ts:213-321 (post at 298) |
| Payload | `tagName`, `selector` (tag, classes, `:nth-of-type`, stops at the first id), `textContent` (cut to 200 characters), `classList`, `boundingBox {x,y,width,height}`, `id` | workspace-preview.logic.ts:14-21, 254-272, 289-296 |
| Receive | The parent accepts `visual-edit:element-selected` only when `event.origin === window.location.origin` and `event.source === iframe.contentWindow`. It checks field types only, not sizes | workspace-shell.tsx:1479-1506; workspace-preview.logic.ts:97-109, 169-195 |
| Turn off | Posts `visual-edit:deactivate-picker` with target `'*'` and removes the script, marker and overlay through `contentDocument` | workspace-shell.tsx:1433-1454 |
| Reload | On iframe load, if the picker is on, it injects again. If the preview stops being ready, picker and selection are cleared | workspace-shell.tsx:1470-1477, 1507-1512 |
| Banners | "Picker active" (violet) while on; "Element selected: <tag> selector" (emerald) after a pick | workspace-shell.tsx:5185-5202 |

### 1.2 How the selection is used

- The shell reports the selection to the page through `onPreviewElementSelected`; the page keeps it in state (FE/app/[locale]/app/page.tsx:1166-1167, 6487-6489, 6708).
- On the next chat send, `buildPromptWithSelectedPreviewElement` puts a `[Selected preview element]` block (tag, selector, text, classes, bounds) and a `[Visual Edit Mode Contract]` block in front of the user's request (workspace-preview.logic.ts:111-138; page.tsx:4923-4926). The selection is also passed in the workspace prompt context (page.tsx:763, 780, 4584, 5008).
- `isVisualEditPrompt` is true for that send (page.tsx:4930, 4985); the visual-edit diff preview, checkpoint label and undo affordance hang off it (tests at workspace-shell.test.tsx:7643, 9397, 9679). The selection is cleared after the send (page.tsx:4987, 5080).
- File changes still go through the normal file-action flow. The picker only adds text to the prompt.
- No backend reads the selection: a search for `selectedPreviewElement` under `services/` has no match.

### 1.3 Tests today

| Test | Reference |
|---|---|
| Toggle hidden; Start, Stop and Refresh remain; the four message keys exist in en, zh-TW and zh-CN | FE/components/workspace/workspace-shell.test.tsx:5377-5415, 5467-5540 |
| Source check: flag is false, the toggle markup and the three picker callbacks still exist | FE/components/workspace/preview-isolation.source.test.ts:39-48 |
| Picker script source contains its ids, message types and text limit | workspace-shell.test.tsx:7117-7155 |
| Message shape and origin/source helpers | workspace-shell.test.tsx:7158-7247 |
| Prompt wiring with a selected element | workspace-shell.test.tsx:7540 onward |

### 1.4 What is dead or hidden now

- Hidden: the toggle (flag false). Because nothing can turn the picker on, the two banners never show.
- Dead on the preview host: `injectPickerScript` and the DOM clean-up in `removePickerScript` (`contentDocument` is null across origins), and the origin check (it expects the platform origin; the preview now has another).
- Unused types: `visual-edit:picker-ready` and `visual-edit:activate-picker` are declared but never sent or handled (workspace-preview.logic.ts:28-34).
- Still live and reused: the payload type, the prompt builder, the page state, the banners and the four message keys (FE/messages/en.json:260-263, same lines in zh-TW.json and zh-CN.json).

## 2. Getting a bridge script into the preview

### 2.1 Facts that shape the choice

| Fact | Reference |
|---|---|
| The iframe `src` is the relative `/api/preview/<sid>/proxy?refresh=N`; the platform host answers 302 to the preview host, so the page never sees the preview origin | workspace-preview.logic.ts:64-66; GW/preview/preview.controller.ts:250-273, 301-303 |
| On the preview host only `enter` and proxy GET/HEAD shapes pass the route filter; everything else is 404 before any guard | GW/preview/preview-access.guard.ts:124-140 |
| `/api/preview/<sid>/proxy/<rest>` is an allowed shape and needs the `aisandbox_preview` cookie, whose path is `/api/preview/<sid>/` | GW/preview/preview-host.ts:154-214; GW/preview/preview-entry.controller.ts:112-118, 125-162 |
| The gateway streams proxy bodies (`responseType: 'stream'`, `pipe`) and never looks inside them | preview.controller.ts:116-153 |
| Static previews: container-manager reads the file, and for HTML only decodes it, adds `<base href="/api/preview/<sid>/proxy/">` after `<head>` and re-encodes | CM/preview/preview.controller.ts:124-139; CM/preview/preview.service.ts:343-368, 612-623 |
| Dev-server previews: container-manager passes the request to the app's server through `http-proxy-middleware` without touching the body | CM/preview/preview.controller.ts:26-44, 141-144 |
| The gateway already knows both origins: `PREVIEW_BASE_URL` and `APP_BASE_URL` | preview-host.ts:61-68 |
| Container-manager knows neither origin (no match for `APP_BASE_URL` or `PREVIEW_BASE_URL` under `services/container-manager`) | search |
| The frontend has no public config for origins; its only `NEXT_PUBLIC_` value is a dev-tools switch | FE/components/SystemReadiness.tsx:55 |
| Off the preview host a proxy answer carries a CSP sandbox without `allow-same-origin`, so the document's origin is opaque and `event.origin` would be `"null"` | GW/preview/preview-response-headers.ts:54-64; preview.controller.ts:292-294 |
| Browser smoke does not read previews through `readStaticPreviewContent` (the controller is its only caller), so an added tag does not reach smoke | CM/preview/preview.service.ts:403-442; search |

### 2.2 Options

| Option | Static | Dev server | Risks | Effort | Files |
|---|---|---|---|---|---|
| (a) Gateway injects a `<script src>` into HTML answers on the preview host | Yes | Yes | The proxy must stop streaming HTML: buffer it, handle compressed bodies, fix `Content-Length`, cap the size. That is new logic in the most security-sensitive file of the preview path, and a buffering bug breaks every preview | Medium to high | preview.controller.ts, a new rewrite helper, specs |
| (b) Container-manager injects into static HTML, where it already rewrites it | Yes | No (separate or deferred) | Small. But container-manager does not know the platform origin, so the bridge would have to trust any parent, or the origin would have to be passed down from the gateway | Low | CM/preview/preview.service.ts and spec |
| (c) The preview host serves the bridge as a fixed asset; only a tiny tag is injected | Yes, with a tag injector | Yes, once something injects the tag | The asset path must be a proxy shape, or the route filter answers 404. `/api/preview/<sid>/__aisb/picker.js` as written in the brief would need a filter change; `/api/preview/<sid>/proxy/__aisb/bridge.js` does not. The name `__aisb` becomes reserved | Low | GW/preview/preview-entry.controller.ts, a new script file, specs |
| (d) No injection: a query parameter turns picker mode on and the page cooperates | No | No | Not possible. Generated apps are arbitrary files that the user or the AI writes; nothing in them listens for a parameter unless a script is put there, which is injection again. Asking the AI to add a snippet to every app would put platform code in user workspaces and commits, and any app could drop it | — | — |

### 2.3 Chosen: (c) for the script, (b) for the tag

- **Gateway serves the bridge** at `GET /api/preview/<sid>/proxy/__aisb/bridge.js`, on the preview host only, inside the existing preview-host proxy handler and behind the unchanged `PreviewAccessGuard`. The script text is fixed except for one value: the platform origin, taken from `APP_BASE_URL` and written in as a JSON string. If `APP_BASE_URL` is missing or not an http(s) URL the answer is 404 and the picker stays off.
- **Container-manager adds one tag** to static HTML, next to the base tag: `<script src="/api/preview/<sid>/proxy/__aisb/bridge.js" async data-aisb-preview-bridge></script>`. It is added whether or not the app has its own `<base>` (the path is absolute), and not twice.
- **`__aisb` never reaches container-manager.** The gateway answers every `proxy/__aisb/...` path itself on both hosts: the bridge on the preview host, 404 otherwise (including on the platform host, before any redirect or ticket). A folder of that name in a workspace is therefore not served. Uncertain but unlikely: an existing app that has such a folder.
- **Why split it this way:** the origin the bridge must trust lives only in the gateway; the HTML rewrite already lives only in container-manager. Each service gets a few lines in a place that already does that kind of work, and the gateway's streaming stays untouched.

### 2.4 Security model

| Rule | How it holds |
|---|---|
| The bridge never gets platform cookies or tokens | It is served from, and runs in, the preview origin. The gateway writes exactly one value into it, the platform origin, which is public. It makes no network requests and reads no cookies or storage |
| The parent accepts a message only from the preview | `event.origin === previewOrigin` and `event.source === iframe.contentWindow`, using the existing helper (workspace-preview.logic.ts:97-109) with the preview origin in place of `window.location.origin`. If the preview origin is unknown, every message is refused |
| The bridge accepts a command only from the platform | `event.origin === PLATFORM_ORIGIN`, `event.source === window.parent`, and `window.parent !== window`. Opened in its own tab the bridge does nothing |
| No `'*'` targets | Parent to bridge: `postMessage(msg, previewOrigin)`. Bridge to parent: `postMessage(msg, PLATFORM_ORIGIN)` |
| The payload is untrusted | The generated app runs in the same origin as the bridge and can post a forged message that passes the origin and source checks. So the parent validates every field and its size (section 3.3), accepts a selection only while the picker is on, and treats it as text only. This is no new exposure: the same text reaches the prompt today from the user's own workspace files |
| Sandbox tokens unchanged | `PREVIEW_IFRAME_SANDBOX` stays exactly as is, without `allow-top-navigation` (workspace-shell.tsx:179-180; source test preview-isolation.source.test.ts:29-37 stays) |
| Guards, cookies, tickets, route filter unchanged | The bridge path is already an allowed proxy shape under the existing guard and cookie path. No new route, no filter change, no change to `SessionCookieGuard`, `PreviewOwnershipGuard`, `PreviewAccessGuard`, the same-origin write guard or the Set-Cookie limits |
| Fail-safe mode has no picker | Without `PREVIEW_BASE_URL` the preview's origin is opaque, so origins cannot be checked. The status field is null, the toggle is not shown, and the bridge path is 404. Local development without a preview host therefore has no picker, as now |

### 2.5 How the frontend learns the preview origin

| Way | For | Against |
|---|---|---|
| **A field on the status answer (chosen)** | One source of truth, the gateway's `PREVIEW_BASE_URL`, read at run time; arrives exactly when the page needs it (status is always fetched before the preview URL is set: page.tsx:6269-6297); behind the session and ownership guards | The gateway adds a field to a JSON answer it otherwise passes through |
| Public build-time value (`NEXT_PUBLIC_...`) | No gateway change | A second copy of the value, fixed at build time; the deploy tooling and env baselines would need a new step; it can drift from the gateway's value, and a drift means a silent failure |
| Derive it (for example from the first message's `event.origin`) | No config | Not a check at all: if the app navigates its own frame to another site, that site's origin would be "learned" and trusted |

Detail: on the platform host, for `GET /api/preview/<sid>/status` with a 200 JSON object answer, the gateway adds `previewOrigin`: the `PREVIEW_BASE_URL` origin, or `null` when the preview host is not configured. Start, stop and proxy answers are unchanged. The page keeps the last value it saw; the shell uses it only if it is an http(s) origin that parses back to itself and differs from `window.location.origin`.

## 3. Message protocol

### 3.1 Envelope

Every message is a plain object: `{ aisb: 'preview-bridge', v: 1, type: <string>, ... }`. Anything without `aisb === 'preview-bridge'` is not ours and is ignored without a reply (apps post their own messages).

### 3.2 Messages

| Direction | `type` | Fields | Meaning |
|---|---|---|---|
| bridge to parent | `ready` | — | The bridge has loaded in this document. Sent once on load, and again in answer to `hello` |
| parent to bridge | `hello` | — | "Are you there?" Sent on every iframe `load` event |
| parent to bridge | `activate-picker` | — | Turn picker mode on: overlay, hover highlight, capture the next click |
| parent to bridge | `deactivate-picker` | — | Turn picker mode off and remove the overlay |
| bridge to parent | `picker-state` | `active: boolean` | The bridge's real state after a command, or after the user pressed Escape in the preview |
| bridge to parent | `element-selected` | `payload` (3.3) | One element was clicked. The bridge then turns picker mode off (single shot, as today) |

### 3.3 Payload and limits

| Field | Limit (the bridge cuts to it; the parent refuses the whole message if it is exceeded) |
|---|---|
| `tagName` | string, 1-64 characters, lower-case letters, digits and `-` |
| `selector` | string, at most 1024 characters |
| `textContent` | string, at most 203 characters (200 plus `...`, as today) |
| `classList` | array of at most 32 strings, each at most 128 characters |
| `id` | string of at most 128 characters, or null |
| `boundingBox` | `x`, `y`, `width`, `height`: finite numbers |
| Whole message | `JSON.stringify` length at most 8192 |

The payload shape is today's `SelectedPreviewElement`, so the prompt builder, page state and banners need no change. The bridge escapes ids and classes in the selector (today's script does not: workspace-preview.logic.ts:260, 268).

### 3.4 Versioning and unknown messages

- `v` is an integer. Both sides accept only `v === 1`. New optional fields may be added under version 1 and are ignored by a side that does not know them. A change that breaks a field means version 2.
- Unknown `type`, wrong `v`, wrong origin, wrong source, a failed validation or an oversized message: dropped silently. No reply, no error, no state change, no console output that includes the message.
- Both sides ship in one deploy. The bridge is answered with `Cache-Control: no-store`, so a stale bridge cannot outlive a deploy.

### 3.5 Turning picker mode on and off

1. The iframe fires `load`. The parent marks the bridge "not ready" and posts `hello` to the preview origin.
2. The bridge answers `ready`. A `ready` that arrived just before `load` is simply repeated. Only now is the toggle shown.
3. The user clicks the toggle. The parent clears any selection, posts `activate-picker` and shows the "Picker active" banner. The bridge answers `picker-state {active: true}`.
4. The user clicks an element. The bridge posts `element-selected` and turns itself off. The parent, only if the picker is on, stores the selection, shows the "Element selected" banner and turns the toggle off.
5. To cancel: the user clicks the toggle again (`deactivate-picker`), or presses Escape inside the preview (the bridge turns off and posts `picker-state {active: false}`; the parent follows).
6. The preview reloads or navigates while the picker is on: the new document's bridge reports `ready`, and the parent posts `activate-picker` again (today's behaviour, workspace-shell.tsx:1507-1512). If no `ready` comes, the toggle disappears and the picker turns off.
7. The preview stops being ready or the session changes: picker off, selection cleared (unchanged, workspace-shell.tsx:1470-1477).

## 4. Recommendation for this slice

Bring the picker back for **static previews** on a deployment with a preview host. Dev-server previews are deferred: adding the tag there means rewriting HTML that container-manager currently passes through untouched, which is its own risk and its own decision (see Follow-ups).

### 4.1 What changes

| Where | Change |
|---|---|
| Gateway | New `preview-bridge-script.ts`: the bridge source as a builder that takes the platform origin. `preview-host.ts`: a reader for the platform origin from `APP_BASE_URL` and a test for the reserved `proxy/__aisb/` prefix. `preview-entry.controller.ts`: on the preview host, answer `proxy/__aisb/bridge.js` with the script (`text/javascript; charset=utf-8`, `no-store`, `X-Content-Type-Options: nosniff`) and any other `__aisb` path with 404, before forwarding. `preview.controller.ts`: on the platform host, 404 for the reserved prefix before the redirect; add `previewOrigin` to the status answer |
| Container-manager | `preview.service.ts`: add the bridge tag to static HTML beside the base tag |
| Frontend | `workspace-preview.logic.ts`: remove the script generator and its ids; add the envelope, message builders, the validator with limits and a preview-origin reader. `workspace-shell.tsx`: replace `contentDocument` injection and removal with `postMessage`, track bridge readiness, check the preview origin, show the toggle only when the bridge is ready (the `PREVIEW_PICKER_TOGGLE_VISIBLE` constant goes). `page.tsx`: keep `previewOrigin` from the status answer and pass it to the shell |

### 4.2 Write set (exact)

- `services/api-gateway/src/preview/preview-bridge-script.ts` (new)
- `services/api-gateway/src/preview/preview-host.ts`
- `services/api-gateway/src/preview/preview-entry.controller.ts`
- `services/api-gateway/src/preview/preview.controller.ts`
- `services/api-gateway/src/preview/__tests__/preview.bridge.spec.ts` (new)
- `services/api-gateway/src/preview/__tests__/preview.entry.spec.ts`
- `services/api-gateway/src/preview/__tests__/preview.isolation.spec.ts`
- `services/api-gateway/src/preview/__tests__/preview.endpoint-contract.spec.ts`
- `services/container-manager/src/preview/preview.service.ts`
- `services/container-manager/src/preview/preview.service.spec.ts`
- `frontend/components/workspace/workspace-preview.logic.ts`
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/components/workspace/preview-isolation.source.test.ts`
- `frontend/app/[locale]/app/page.tsx`

Not in the write set: the three message files, `preview-access.guard.ts`, `preview-response-headers.ts`, `preview-ticket.ts`, any guard, `CM/preview/preview.controller.ts`, package files, env files, Caddy.

### 4.3 Mutexes, model, skills

- **Mutexes:** FRONTEND, GATEWAY, CONTAINER-MANAGER. No I18N (no message file changes), no PACKAGE, no ENV, no MIGRATION. Shared contracts: none frozen; the status answer gains one optional field.
- **Model: opus.** The slice touches the gateway's preview-host route and the redirect path, and it spans three services (Model Routing: cross-service changes and anything touching guards or the proxy go to opus).
- **Skills:** the brief names `.agents/skills/impeccable` and `.agents/skills/emil-design-eng`; the worker reads both before touching the toolbar, and the checkpoint says what was applied. The UI change is small: one existing button that now appears when the bridge is ready, with its existing style, labels and test id. `DESIGN.md` is followed where it exists.
- **Checklists for the brief:** EVERY, UI, BACKEND, and FLOWS (the selection feeds the AI prompt; the file-action flow itself is not changed and that list should confirm it).

### 4.4 Tests

| Area | Tests |
|---|---|
| Gateway bridge | Built with a given origin, the source contains that origin as a JSON string and no other configuration; run in `node:vm` with stub `window` and `document`: a command from another origin or another source is ignored; a command from the platform origin turns picker mode on; `postMessage` is always called with the platform origin as target, never `'*'`; the payload is cut to the limits; nothing happens when `parent === window` |
| Gateway routes | Preview host with a valid preview cookie: `proxy/__aisb/bridge.js` is 200 JavaScript with `no-store` and `nosniff`, and container-manager is not called; without the cookie 403; `APP_BASE_URL` unset 404; other `__aisb` paths 404. Platform host: the reserved prefix is 404 with no ticket issued and no call to container-manager. Status: `previewOrigin` equals the configured origin, is null when unset, and start, stop and proxy answers are unchanged |
| Container-manager | The tag is added after the base tag; added when the app has its own `<base>`; added when there is no `<head>`; not added twice; the session id is URL-encoded; non-HTML bytes are unchanged |
| Frontend logic | The validator accepts a valid message and refuses a wrong envelope, wrong version, unknown type, each oversized field and an oversized whole message; the preview-origin reader refuses a non-origin, a non-http(s) value and the page's own origin; the existing origin/source helper tests stay |
| Frontend shell | No toggle without a ready bridge; toggle shown with one; Start, Stop and Refresh unchanged; no `contentDocument` anywhere in the shell; no `'*'` target; the sandbox constant test is unchanged; the four message keys still exist in the three files; the prompt-wiring tests are unchanged |

### 4.5 Gates

- Frontend: `npx tsc --noEmit`, `npm test`, `npm run build`, then restore `frontend/tsconfig.tsbuildinfo`.
- Gateway: `npm test` (compare with the 14 known `smoke.integration` failures recorded in the COOKIE-PREFIX-01 checkpoint), `npm run build`.
- Container-manager: `npm test`, `npm run build`.
- The control plane reruns all of them on the branch and reads the diff before LOCK.

### 4.6 Stop conditions for the worker

- Any need to change a guard, the route filter, a cookie, the ticket, the sandbox tokens, the Set-Cookie limits or `preview-response-headers.ts`.
- Any need to buffer or rewrite a streamed proxy body, or to change `CM/preview/preview.controller.ts`.
- Any new visible text or a change to a message file.
- Any new dependency, or a file outside the write set.
- A gate failure that is not one of the known failures.

## 5. Acceptance criteria

1. On the preview host, with a valid preview cookie, `GET /api/preview/<sid>/proxy/__aisb/bridge.js` returns the bridge as JavaScript with `Cache-Control: no-store`; without the cookie it is refused as any proxy path is; with `APP_BASE_URL` unusable it is 404.
2. No `proxy/__aisb/...` request is ever forwarded to container-manager, on either host, and on the platform host none issues a ticket.
3. The bridge contains the platform origin and no secret; it acts only on messages whose origin is the platform origin and whose source is its parent window; it posts only to the platform origin; it does nothing when it is not framed.
4. Static HTML served by container-manager carries exactly one bridge tag with the URL-encoded session id, with or without an app `<base>`; other file types are byte for byte as before.
5. `GET /api/preview/<sid>/status` on the platform host carries `previewOrigin` (the configured origin or null); no other preview answer changes.
6. The workspace page accepts a bridge message only when `event.origin` equals the preview origin from the status answer and `event.source` is the preview iframe's window; with no preview origin it accepts none.
7. The parent refuses messages with the wrong envelope or version, an unknown type, or any field or total size over the limits in 3.3, silently, and accepts a selection only while the picker is on.
8. The toggle is rendered only when the bridge of the current preview document has reported ready; it keeps its test id, labels and style. Turning it on shows the "Picker active" banner; a pick shows the "Element selected" banner and turns the toggle off; the selection reaches the next prompt exactly as before.
9. No code path reads `iframe.contentDocument`; no `postMessage` uses `'*'`; `PREVIEW_IFRAME_SANDBOX` is unchanged.
10. No visible text is added or changed; `en.json`, `zh-TW.json` and `zh-CN.json` are unchanged and still hold `selectElement`, `deselectElement`, `pickerActive` and `elementSelected`.
11. Guards, the route filter, cookies, tickets and Set-Cookie limits are unchanged; no new dependency.
12. All gates in 4.5 pass, with only the known gateway failures.
13. The checkpoint carries the CHECKLIST line (EVERY, UI, BACKEND, FLOWS), says what was applied from the two design skills, records the model, and lists the follow-ups.

## 6. Live check (for a later deploy task)

**From the host (curl, no browser):**

| Check | Expected |
|---|---|
| Platform host, signed in: `GET /api/preview/<sid>/status` | JSON with `previewOrigin` equal to the preview host origin |
| Preview host, with a preview cookie obtained through the ticketed `enter`: `GET .../proxy/__aisb/bridge.js` | 200, JavaScript, `no-store`; the body contains the platform origin and no cookie name, key or token |
| Same without the preview cookie | 403 |
| Preview host: `GET .../proxy/__aisb/other.js` | 404 |
| Platform host: `GET .../proxy/__aisb/bridge.js` | 404, no redirect |
| Preview host: `GET .../proxy/` of a static project | HTML with the base tag and one bridge tag |
| The 12 preview-host checks from PREVIEW-ORIGIN-DEPLOY-01 | Still pass |

The host cannot check the click itself: that needs a browser.

**Keith, in the browser (about two minutes), static project with a running preview:**

1. Select Element appears in the preview toolbar, after Refresh.
2. Click it: the violet "Picker active" line shows, and moving the mouse over the preview highlights elements.
3. Click an element: the emerald "Element selected" line shows the tag and selector, and the toggle is off again.
4. Send a short request such as "make this text red": the change is proposed for that element through the normal file-action flow.
5. Turn Select Element on and off again without clicking: the highlight goes away. Press Escape inside the preview while it is on: it turns off.
6. Refresh the preview: the toggle comes back and still works.

## 7. Open questions for Keith

1. **Dev-server previews.** Recommended: defer them; this slice restores the picker for static previews only, and the toggle does not appear on a dev-server preview. Alternative: include them now, which adds HTML rewriting to container-manager's pass-through proxy (it would have to buffer HTML answers from the app's server) and makes the slice roughly twice as large.
2. **When the picker is not available** (dev-server preview, no preview host, or an app whose own content policy blocks the script). Recommended: do not show the toggle, which needs no new text. Alternative: show it disabled with a short translated explanation, which needs new keys in the three message files and the I18N lease.

## 8. Follow-ups named here (for the control plane to dispose)

1. **Deploy task** for this slice, with the live check in section 6 (staging; STAGING and ENV; no migration, no env change expected).
2. **Picker for dev-server previews:** inject the bridge tag into HTML that container-manager proxies from the app's server. Open design point: buffering HTML answers in `http-proxy-middleware` (version 3 in `services/container-manager/package.json`; its response-interceptor mode is **uncertain** here, not read). Ready when: this slice is locked and Keith decides.
3. **ARCHITECTURE.md section 6, line 536** ("The Select Element picker is hidden until it is rebuilt over postMessage") needs a short update at LOCK: the bridge path, the reserved `__aisb` name, the status field and the origin checks. A governance write by the control plane, not the worker.

## 9. Checklist (Step 2)

CHECKLIST: EVERY 11/11 — 1 met (admitted on the board, Lane 1, write set this file: TASKS.md occupancy block and the PREVIEW-PICKER-01 entry); 2 met (4-step, this is Step 2); 3 met (Fable, named in the brief with the reason); 4 met (self-contained brief, boot sequence followed, no subagent started); 5 met (one file, no dependency); 6 n/a (a document, no behaviour change); 7 n/a (no code, no gates); 8 met (nothing started; read-only commands only); 9 met (no build ran); 10 met (one commit on the lane branch only; no push, merge or branch change); 11 met (three follow-ups listed in section 8).
