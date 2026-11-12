# PREVIEW-ORIGIN-DEPLOY-01 — Checkpoint

**Task:** PREVIEW-ORIGIN-DEPLOY-01 — Deploy the preview host and PREVIEW-ORIGIN-01
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**, including Keith's browser check.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the PREVIEW-ORIGIN-01 LOCK. Keith added the DNS record and asked for the deploy ("DNS record added").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true. The control plane added the preview site to `ops/clean-baseline/caddy/Caddyfile` in the same record; the ops static tests t-caddy-site (22) and t-target-membership (61) pass | 91c0c33 |
| 2. Inspection, deploy and host checks | `pod-inspect.sh` (read-only), `pod1-deploy.sh` (deploy), `pod-logs.sh`, `pod-session.sh` and `pod-logs2.sh` (read-only, during Keith's check) | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar, plan and ARCHITECTURE.md section 6, canonical validator | this record |

## Before (pod-inspect.sh, read-only)

- `preview.staging.ainow.biz` and `staging.ainow.biz` both resolve to 18.136.141.186.
- `/etc/caddy/Caddyfile` was byte-identical to the repository template (2b77968c…).
- Caddy reads `AISB_OPERATOR_USER` and `AISB_OPERATOR_HASH` from `/etc/caddy/aisandbox-operator.env`. Only the names were read.
- Ports 80 and 443 are open.
- `gateway.env` (568af710…) had no `PREVIEW_BASE_URL`, and `APP_BASE_URL` is `https://staging.ainow.biz`.

## Deploy (pod1-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T09:20:03Z UTC)

7a5bf0c → 91c0c33. It carries PREVIEW-ORIGIN-01 and the template.

The script first checked the before-state:
- the expected commit;
- configuration at the old baselines and flags stub, stub, false;
- nothing running;
- `caddy validate` with the operator env file passes on the current Caddyfile;
- the Caddy unit has a reload command.

Then it ran these steps:
1. Back up `gateway.env` and the Caddyfile in the root-only run folder.
2. Add exactly one line to `gateway.env`, `PREVIEW_BASE_URL=https://preview.staging.ainow.biz`, keeping mode 600 root:root. The new hash is `e07672862e84e00493d1864cb9c18f05a2f1b9129557c7412b3ad9590bd0944a`.
3. Deploy. On failure the env file would have been restored.
4. Install the deployed template as `/etc/caddy/Caddyfile`, with the new hash `205770cfa1043312d749dbf9e0b31ebc94d2c8b5a0ed6c703c18639042342ba8`. Validate it and reload Caddy. On failure the old file would have been restored.
5. Check every configuration file against the new baseline. Only those two files changed.

**After**
- No migration ran; the hash is unchanged at 9cfde25f.
- Flags are stub, stub, false.
- All units are active, and the staging site still asks for the login.
- Caddy obtained a Let's Encrypt certificate for the preview host (HTTP-01 challenge).

**Preview host checks (12, all passed)**

| Check | Result |
|---|---|
| Preview host over TLS, without a login | 401 |
| Preview host `/en`, without a login | 401 |
| Preview host `GET /api/health` | 404 |
| Preview host `GET /api/keys` | 404 |
| Preview host proxy without the preview cookie | 403 |
| Preview host proxy with only a session cookie | 403 |
| Preview host `enter` with a bad ticket | 403 |
| Preview host `POST start` | 404 |
| Platform host `enter` | 404 |
| Platform host proxy without a session | 401 |
| Spoofed X-Forwarded-Host only | 401: it counts as the platform |
| Platform `GET /api/health` | 200 |

- The platform proxy response carries `Content-Security-Policy: sandbox allow-scripts allow-forms allow-modals allow-popups`.
- `preview-entry.controller.js` is in the gateway build.
- The standard, guard, CORS, connector-server and security checks pass. There is no key text in the journals, and no runs were open.

## Keith's browser check (2026-11-12)

- **First attempt, in the project "C1 repeat": "Preview unavailable".** The logs showed that Start preview was refused before any preview request was made. That project has a `package.json` with no start script, so the resolver picks a Node app and finds no command. This predates PREVIEW-ORIGIN-01. Keith's two commands had also not landed: `index.html` was unchanged and `style.css` was missing.
- **Second attempt, in a new project with only the two files (created from the command input): passed.**
  - "Hello" is red, so the CSS loaded.
  - "JS ok 1" appears, so the script ran and localStorage works inside the preview.
  - The Select Element button is gone.
  - Keith could not see the frame's address. The gateway log confirms it instead: Start succeeded; the platform answered the frame twice with a redirect to the preview host; one ticket was used; then the page and `style.css` were fetched through the preview host. The platform no longer fetches preview content itself.
- **The basic_auth prompt on the preview host:** Keith reported no problem.

Evidence in `C:/Users/knlee/aisb-preflight/PREVIEW-ORIGIN-DEPLOY-01/`. All outputs were checked for key and password-hash text, and none was found.

| File | SHA-256 |
|---|---|
| `pod1-deploy.sh` | `c5dee592dfcee1a73262d0189d650d30be7b5b2deb18372297758c6ae3449274` |
| `pod1-deploy.out` | `7d1cad50f634d4cdd513f46f59a6bacca7990e43a9148a078fd7ce35b790ae95` |
| `pod-inspect.sh` / `.out` | read-only; the 2b77968c… and 568af710… baselines and DNS |
| `pod-logs.sh`, `pod-session.sh`, `pod-logs2.sh` / `.out` | read-only views during Keith's check; tickets and cookies redacted |

## Records

- **ARCHITECTURE.md section 6, Preview Proxy Path:** updated with the platform host → ticket → preview host path and the isolation rules. This was named in this task's scope, and the control plane holds GOVERNANCE for the record.
- **New configuration baselines,** which later deploy scripts must use:
  - `gateway.env` e0767286…
  - `Caddyfile` 205770cf…

## Limits

- **Registered for later:**
  - recommended before any user other than Keith: PREVIEW-PICKER-01, CSRF-AUDIT-01 and COOKIE-PREFIX-01;
  - optional: PREVIEW-ORIGIN-02 and DRIVER-PAGE-01.
- **New follow-up:** "Preview unavailable" gives no reason when Start preview is refused. It is registered as PREVIEW-REASON-01, optional.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker; 5: records, the Caddy template in the admitted write set, ARCHITECTURE.md as named in scope; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, gateway.env and Caddyfile changed as admitted, backed up with restore on failure; 2: old baselines checked before, new baselines recorded after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 1 registered (PREVIEW-REASON-01, the refusal reason for Start preview) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 91c0c33 with migration hash 9cfde25f; runs are off;
- the preview host is live.
