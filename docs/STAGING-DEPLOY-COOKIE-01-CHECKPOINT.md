# STAGING-DEPLOY-COOKIE-01 — Checkpoint

**Task:** STAGING-DEPLOY-COOKIE-01 — Deploy COOKIE-PREFIX-01 (Keith signs in once)
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**, including Keith's sign-in pass.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the COOKIE-PREFIX-01 LOCK. Keith approved after being told he would be signed out once ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 9555d3c |
| 2. Deploy, host checks and Keith's pass | `cookie1-deploy.sh` from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (cookie1-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T12:49:16Z UTC)

d9c0911 → 9555d3c. It carries COOKIE-PREFIX-01.

**Before:**
- HEAD and DEPLOYED were at d9c0911.
- The configuration was at the baselines `gateway.env` e0767286 and `Caddyfile` 205770cf.
- Flags were stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at 9555d3c.
- No migration ran; the hash is unchanged at 9cfde25f.
- The configuration and flags are unchanged, and all units are active.

**Cookie checks.** Only names and attributes were printed, never values.

| Request | Result |
|---|---|
| `GET /api/health`, no cookie | `__Host-aisandbox_csrf=<value>; Path=/; Secure; SameSite=Lax`: no Domain, no HttpOnly, no `aisandbox_csrf` line |
| `GET /api/health`, only the old `aisandbox_csrf` cookie | the new cookie is issued (1) |
| `GET /api/health`, the new `__Host-aisandbox_csrf` cookie | no CSRF Set-Cookie (0) |
| `POST /api/auth/logout`, only old-name cookies, app Origin, matching token | 401 |
| `GET /api/auth/me`, only the old session cookie | 401 |
| `POST /api/sessions`, `__Host-aisandbox_session` cookie, no Origin | 403 (the same-origin guard matches the new name) |
| `GET /api/auth/google` | Set-Cookie names: `__Host-aisandbox_csrf` only; no OAuth state cookie, as expected (OAUTH-STATE-PROXY-01) |

- `platform-cookies.js` is in the gateway build.
- The preview-host and same-origin guard checks give the same results as in STAGING-DEPLOY-CSRF-01.
- The standard and security checks pass. There is no key text in the journals, and no runs were open.

## Keith's sign-in pass (2026-11-12)

All six steps worked:
1. He was signed out once.
2. He signed in.
3. He was still signed in after a reload, which proves the `__Host-` session cookie.
4. A project and its preview opened.
5. Logout worked, which proves the `__Host-` CSRF cookie through the shared frontend reader.
6. He signed in again.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-COOKIE-01/`. The output was checked for key text, and none was found.

| File | SHA-256 |
|---|---|
| `cookie1-deploy.sh` | `5b9293c68c2949991a30686b8af719c49d8611844130ec66d00781d1a13e339d` |
| `cookie1-deploy.out` | `00a9ae081f8235f15e465b82a91eec7f2504ad021d1cee42a0d8f45e73fe08d9` |

## Limits

- **The OAuth state cookie is not set behind Caddy.** This is OAUTH-STATE-PROXY-01, needed before any OAuth sign-in.
- **Still recommended before any other user:** PREVIEW-PICKER-01.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health, guard and cookie checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text, cookie values never printed)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 9555d3c with migration hash 9cfde25f, and runs are off.
