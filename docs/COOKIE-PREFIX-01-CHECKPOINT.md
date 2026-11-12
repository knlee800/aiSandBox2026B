# COOKIE-PREFIX-01 — Checkpoint

**Task:** COOKIE-PREFIX-01 — Harden platform cookies against a sibling host (__Host- prefix)
**Status:** COMPLETE AND LOCKED — 2026-11-12. Not deployed.
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the PREVIEW-ORIGIN-01 LOCK. Keith started it ("Yes, start it") and approved the stage-start ("Yes, all four").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | at the PREVIEW-ORIGIN-01 LOCK | 01587b7 |
| 2. Stage-start | Lane 1, no mutex. `docs/COOKIE-PREFIX-01-STAGE-START.md` by a fable subagent (32cef0f, fast-forwarded). The control plane checked the cookie attributes, the Set-Cookie passthrough and the missing trust proxy against the code. Admission 2a84ca8; record 6472ad7 | 32cef0f |
| 3. Implementation | Keith approved; GATEWAY and FRONTEND acquired with 29 files (9aa087b). The opus subagent stopped as required: one spec outside the write set runs in secure mode. The control plane widened the write set by that test-only spec and amended acceptance criterion 3 (6554e00). The worker resumed and finished as e8cd87d, which was cherry-picked | 1269122 |
| 4. Consolidation and LOCK | this checkpoint, board, backlog, sidecar, plan and ARCHITECTURE.md, canonical validator | this record |

## Risk closed (from the stage-start)

The preview proxy forwarded a generated app's `Set-Cookie` unchanged, and preview pages run script. So the preview host could plant a `Domain=staging.ainow.biz` or `Domain=ainow.biz` cookie. A planted cookie with a longer path is sent first, and cookie-parser keeps the first value. That makes possible:
- locking the user out, or silently signing them into another account;
- breaking logout and the admin PATCH through the double-submit CSRF cookie;
- login CSRF once OAuth is active.

## Keith's decisions (2026-11-12)

1. **Two modes.** `__Host-` names in secure mode, which is an https `APP_BASE_URL` or `NODE_ENV=production`. Local http and Jest keep the old names.
2. **One forced sign-in,** with no window where both names work.
3. **Preview `Set-Cookie`:**
   - dropped on the platform host;
   - limited on the preview host to host-only cookies without `aisandbox_` in the name;
   - `Clear-Site-Data` dropped on both hosts.
4. **The OAuth state cookie is renamed now.** Its trust-proxy problem is a follow-up.

## Change

**`services/api-gateway/src/auth/platform-cookies.ts`** (new) holds:
- the mode rule, `isSecureCookieMode`, which reads the env on each call and has no test-only branch;
- the names and the set and clear options;
- the CSRF cookie middleware and the cookie-session options, both moved from `main.ts`;
- an exact-name check of the Cookie header for either session name.

**Secure mode**
- **Cookies:** `__Host-aisandbox_session` (HttpOnly, 7 days), `__Host-aisandbox_csrf` (readable by the page) and `__Host-aisandbox_oauth_state` (10 minutes). All are Secure, Path=/, no Domain, SameSite=Lax.
- **Readers:** the session guard, the session-or-API-key guard, CsrfGuard, the Socket.IO handshake and logout read only the new names.
- **Sign-in and logout:** sign-in clears the old `aisandbox_session`. Logout clears both names with Secure and Path=/.

**Everywhere**
- `SameOriginWriteGuard` rule 3 matches either session name on the exact name.
- **Local http and tests:** the old names and attributes, exactly as before.
- **Frontend:**
  - one reader, `frontend/lib/csrf-cookie.ts`, tries the new name first, then the old one, on the exact name;
  - the four local readers call it;
  - the confirm-build-apply proxy reads either session name and re-sends it under the name it found.
- **Preview** (`limitPreviewCookieHeaders`, applied in `forwardPreviewRequest`):
  - the platform host drops every upstream `Set-Cookie`;
  - the preview host keeps only host-only cookies without `aisandbox_` in the name;
  - `Clear-Site-Data` is dropped on both;
  - the gateway's own `aisandbox_preview` cookie is unchanged.
- **e2e:** the harness contract literal lists both spellings.

**Unchanged:** session validation and authorization logic, internal routes and the key, the message files, dependencies, migrations, env and ops. `trust proxy` is not set.

**Libraries:** cookie-parser, cookie-session and cookies accept `__Host-` names. A real write-then-read round trip of the OAuth state cookie passes.

**Generated-app templates:** their forbidden-name lists match by substring, so the `__Host-` forms are already covered. Nothing needed to change.

**Tests:** 79 new gateway tests and 9 new frontend tests.
- Edits to existing assertions are limited to the session constants in `same-origin-write.guard.http.spec.ts` (the widened file) and `preview.isolation.spec.ts`. Both now run in secure mode with the new name, and include a case where the old name alone gets 401.
- Every other existing spec passes unedited.

## Control-plane review

I read `platform-cookies.ts` and `limitPreviewCookieHeaders`, and checked:
- the clearing options in secure mode;
- the exact-name match;
- that only the platform-host call site passes `'platform'`;
- that only the entry controller passes `'preview'`.

The worker's raw-header match now trims spaces around the name. That makes it stricter than before, never looser.

## Gates (control-plane rerun on the branch; main has the same files)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 4152 passed (4073 + 79), 7 skipped, plus the 14 known `smoke.integration` failures (they need a database), 245 suites passed |
| gateway `npm run build` | exit 0 |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 1831 of 1831 passed (1822 + 9) |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored |
| e2e contract suite (worker) | 114 passed |
| line endings | all 30 files are LF |

## Records

- **ARCHITECTURE.md:** the auth section now states the two cookie modes and names, and the preview `Set-Cookie` rule. The guard, Socket.IO and template lines name both cookie forms.
- **PREVIEW-ORIGIN-02:** gained the note that only a separate registrable domain removes cookie-jar eviction and `Clear-Site-Data` sign-outs.
- **Plan row 80b is done.** Keith deleted every listed leftover file and folder. The control plane checked that none remains and that no lane branch is left.

## Limits

- **Not deployed.** The deploy is STAGING-DEPLOY-COOKIE-01. Keith is told first that he will be signed out once.
- **The OAuth state cookie probably cannot be set on staging** without trust proxy. That is OAUTH-STATE-PROXY-01, needed before any OAuth sign-in.
- **Still recommended before any other user:** PREVIEW-PICKER-01.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 5: write set widened by the control plane for one test-only spec, recorded; 7: gates rerun by the control plane; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, cherry-picked by the control plane with autocrlf=false), UI 9/9 (1: no visible text; 2: no message file; 3: icons unchanged; 4 to 6: n/a, no UI change; 7: no redesign; 8: test IDs kept; 9: live check in STAGING-DEPLOY-COOKIE-01), BACKEND 6/6 (1: auth changes limited to the approved cookie names, attributes and preview Set-Cookie handling; 2: internal routes unchanged; 3: template lists already cover the __Host- forms; 4: no frozen contract; 5: no schema change; 6: only the known smoke failures)
FOLLOWUPS: 2 registered (STAGING-DEPLOY-COOKIE-01; OAUTH-STATE-PROXY-01) / 1 superseded (the cookie eviction and Clear-Site-Data note, by PREVIEW-ORIGIN-02) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY and FRONTEND released UNOWNED;
- not deployed.
