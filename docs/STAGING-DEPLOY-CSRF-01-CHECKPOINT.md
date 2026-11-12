# STAGING-DEPLOY-CSRF-01 — Checkpoint

**Task:** STAGING-DEPLOY-CSRF-01 — Deploy CSRF-AUDIT-01
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**, including Keith's browser pass.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the CSRF-AUDIT-01 LOCK. Keith approved ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | d9c0911 |
| 2. Deploy, host checks and Keith's pass | `csrf1-deploy.sh` from the staging host; `csrf-logs.sh` (read-only) during Keith's pass | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (csrf1-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T11:32:03Z UTC)

91c0c33 → d9c0911. It carries CSRF-AUDIT-01.

**Before:**
- HEAD and DEPLOYED were at 91c0c33.
- The configuration was at the new baselines: `gateway.env` e0767286 and `Caddyfile` 205770cf.
- Flags were stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at d9c0911.
- No migration ran; the hash is unchanged at 9cfde25f.
- The configuration and flags are unchanged, and all units are active.

**Same-origin guard checks (curl from the host to the gateway):**

| Request | Result |
|---|---|
| `POST /api/sessions`, `Origin: https://preview.staging.ainow.biz` | 403 |
| form `POST /api/sessions/<id>/exec`, same foreign Origin | 403 |
| form `POST /api/auth/login`, same foreign Origin | 403 |
| `POST /api/sessions`, `Origin: null` | 403 |
| `POST /api/sessions`, `Origin: https://staging.ainow.biz`, no session | 401 |
| `POST /api/sessions`, no Origin, no cookie | 401 |
| `POST /api/sessions`, dummy `aisandbox_session` cookie, no Origin | 403 |
| `GET /api/health`, foreign Origin | 200 |
| `POST /api/internal/collaboration/runs`, no key, no Origin | 401 |
| refusal body | `{"message":"Cross-origin request refused","error":"Forbidden","statusCode":403}` |

- `same-origin-write.guard.js` is in the gateway build.
- The preview-host checks and all earlier guard, CORS and security checks pass.
- There is no key text in the journals, and no runs were open.

## Keith's browser pass (2026-11-12)

- **Worked:** file save, preview start and stop, and the Team, Knowledge and Connections pages.
- **Chat:** the message could not get an AI answer. It showed "AI execution temporarily disabled for maintenance", which is expected with runs off. A read-only database check showed that the chat message and its reply row were saved in that window, so the write passed the guard. No execution was created.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-CSRF-01/`. All outputs were checked for key text, and none was found.

| File | SHA-256 |
|---|---|
| `csrf1-deploy.sh` | `490933ed683174d92bf3b5d43988908023582abba6af323617965e955fa93268` |
| `csrf1-deploy.out` | `50565252e14cce3d3e67170122e22806e795e321c39598865ff0ee2459707d29` |
| `csrf-logs.sh` / `.out` | read-only, during Keith's pass; counts only |

## Limits

- **A full AI chat** with the guard was not exercised, because runs are off. The chat write itself passed.
- **Still recommended before any other user:** COOKIE-PREFIX-01 and PREVIEW-PICKER-01.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs d9c0911 with migration hash 9cfde25f, and runs are off.
