# STAGING-DEPLOY-PICKER-01 — Checkpoint

**Task:** STAGING-DEPLOY-PICKER-01 — Deploy PREVIEW-PICKER-01 (Keith checks the picker)
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**, including Keith's picker check.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the PREVIEW-PICKER-01 LOCK. Keith approved ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | aa0b32a |
| 2. Deploy, host checks and Keith's check | `picker1-deploy.sh` from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (picker1-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T14:11:15Z UTC)

9555d3c → aa0b32a. It carries PREVIEW-PICKER-01.

**Before:**
- HEAD and DEPLOYED were at 9555d3c.
- The configuration was at the baselines `gateway.env` e0767286 and `Caddyfile` 205770cf.
- Flags were stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at aa0b32a.
- No migration ran; the hash is unchanged at 9cfde25f.
- The configuration and flags are unchanged, and all units are active.

**Picker checks (curl from the host):**

| Request | Result |
|---|---|
| preview host `GET /api/preview/<id>/proxy/__aisb/bridge.js`, no preview cookie | 403 |
| preview host `GET .../proxy/__aisb/other.js`, no preview cookie | 403 |
| platform host `GET .../proxy/__aisb/bridge.js`, no session | 401 |

**The built bridge script** was checked with node against the deployed module:
- it is 7992 bytes and carries `"https://staging.ainow.biz"`;
- it has no `aisandbox_` text, `document.cookie`, storage, XHR, `fetch(` or key name;
- it never posts to `'*'`;
- it returns null for a bad origin.

The control plane tested the same check locally against the transpiled source before the run.

**Other build and host checks:**
- the container-manager build carries the `data-aisb-preview-bridge` tag;
- the preview-host, same-origin guard and cookie checks give the same results as before;
- there is no key text in the journals, and no runs were open.

## Keith's picker check (2026-11-12, a static project)

All five steps worked:
1. After the preview's Refresh, the Select Element button appeared.
2. With the picker on, hovering highlighted elements and the active line showed.
3. Clicking "Hello" showed it as selected, and the picker turned itself off.
4. Escape turned the picker off.
5. After a refresh, the button came back.

An AI edit from the selection needs runs on, so it was not part of this check.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-PICKER-01/`. The output was checked for key text, and none was found.

| File | SHA-256 |
|---|---|
| `picker1-deploy.sh` | `6d9de1e1245335c92840b03ddb941bb0154b1e91a540785c8d771dfb1f2efa8f` |
| `picker1-deploy.out` | `b1bd7ab61f98fa25e29ed738170bdf4280977c900e7b144e19436abd7595958d` |

## Limits

- **Not run on staging:** a Visual Edit run from a selection, because runs are off.
- **Dev-server previews have no picker yet.** That is PREVIEW-PICKER-02, optional.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health, guard, cookie and picker checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs aa0b32a with migration hash 9cfde25f, and runs are off.
