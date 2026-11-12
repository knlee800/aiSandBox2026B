# STAGING-DEPLOY-I18N-01 — Checkpoint

**Task:** STAGING-DEPLOY-I18N-01 — Deploy the translated chat lines, auth-module messages and network fallback
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the PAGE-CHAT-I18N-01 LOCK. Keith approved ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | f3de35a |
| 2. Deploy and host checks | i18n1-deploy.sh from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (i18n1-deploy.sh; aisandbox-deploy rc 0 at 2026-11-12T04:36:15Z UTC)

01df4a7 → f3de35a. It carries two tasks:
- PAGE-CHAT-I18N-01: the auth-module chat lines and session errors in en, zh-TW and zh-CN;
- AUTHMOD-I18N-01: the auth-module reasons and errors, and a translated network fallback.

**Before:**
- HEAD and DEPLOYED were at 01df4a7.
- The configuration files were at the baseline. Flags: stub, stub, false. Nothing was running.

**After:**
- HEAD and DEPLOYED are at f3de35a.
- No migration was expected and none ran; the hash is unchanged at 9cfde25f.
- The configuration files and flags are unchanged.
- The standard checks pass, and so do the earlier security checks.
- **Body limits, on the file write route:**

| Request | Result |
|---|---|
| 1 MB with the key | 404 |
| 1 MB with a wrong key | 413 |
| 1 MB without the key | 413 |
| A small body without the key | 403 |

- **New text in the frontend build:**
  - zh-TW 驗證模組安裝失敗 (5 files);
  - zh-CN 网络错误，请检查连接后重试 (5 files);
  - the PAGE-STATUS-I18N-01 strings are still present.
- There is no key text in the journals, and no runs were open.

No Keith step was required. The new text appears when the auth module is installed, or when a session create or stop fails.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-I18N-01/`:

| File | SHA-256 |
|---|---|
| `i18n1-deploy.sh` | `f085d52c194dd649e86a040f31652c36c87bb327ef5646b83027d3331895a4d6` |
| `i18n1-deploy.out` | `cb923eaca87500250134b9e76a7399f812c86728fd3956e28495ee619dc7ae9b` |

The output was checked for key text, and none was found.

## Limits

- **Still registered, not ready:** SNAPSHOT-LABEL-02 and NETWORK-ERROR-I18N-01.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and an unchanged hash, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs f3de35a with migration hash 9cfde25f, and runs are off.
