# STAGING-DEPLOY-PKEY-01 — Checkpoint

**Task:** STAGING-DEPLOY-PKEY-01 — Deploy PROVIDER-KEY-01 and ACCESS-01J and check the provider picker
**Status:** COMPLETE AND LOCKED — 2026-11-13. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING, ENV (held, not changed).
**Source:** registered by the PROVIDER-KEY-01 LOCK (bd68114). Keith approved the deploy ("Yes, deploy"); admitted 6f6b8e8.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 6f6b8e8 |
| 2. Deploy and checks | from the host; Keith's browser check | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (2026-11-13T07:26:03Z)

Script `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-PKEY-01\pkey1-deploy.sh` (SHA-256 `c9bf606783d95b5455b1a71e38584dcdb42ce373b230f56c1736bc2e90d675c7`, 52,066 bytes, no blank lines). It is the STAGING-DEPLOY-PICKER-01 script with:
- the new target, previous commit and run folder;
- the ops library hash installed by STAGING-DEPLOY-BACKUP-01 (`d9eada27`);
- a provider block added before the end, so every earlier check still reports.

The script was checked with `bash -n`, and the comparison step was tested locally with five mock answers. It ran once on ainow-staging-01 after a hash check. Output: `pkey1-deploy.out` (SHA-256 `0340e9a80b8a94f434c6f6f7d3a775bc4f3011627ed129fa0d398c87111e781e`), scanned for key, password-hash and internal-key text: none.

- **Before:** HEAD and DEPLOYED aa0b32a; the internal key matches across gateway, ai and cm; configuration files at the baselines; `AI_PROVIDER=stub`, `EMAIL_PROVIDER=stub`, `GLOBAL_EXECUTION_ENABLED=false`; no open executions or runs; both ops-lib copies `d9eada27`.
- **Deploy:** `aisandbox-deploy 6f6b8e86a4848dec7f1808fc88133c8a8d7abc9b`, rc 0. No migration: the hash is unchanged at `9cfde25f`.
- **After:**
  - configuration unchanged (gateway.env `e0767286`, Caddyfile `205770cf`, the other env and unit files at their hashes); the flags are unchanged;
  - all eight units active; ports 4000, 4001 and 4002 listen on 127.0.0.1 only;
  - every earlier check passed: Caddy login wall, preview host, same-origin write guard, `__Host-` cookies, picker bridge, health, frontend pages, guards without a key, static test key refused, CORS, connector server, AI service and container-manager key checks, the build markers of earlier tasks;
  - no key text in the journals.

## Provider checks (PROVIDER-KEY-01 stage-start section 7)

| Check | Result |
|---|---|
| `GET /api/ai/providers` without credentials | 401 |
| AI service `GET /api/internal/provider-availability`: no key / wrong key / right key | 401 / 401 / 200 |
| C3 answer | `{"providers":{"xai":false,"groq":false,"deepseek":false,"openai":false,"anthropic":false}}` |
| `GET /api/ai/providers` with a temporary API key for the admin account (created on the host, value never shown) | 200 |
| C4 answer | five entries in the fixed order xai, groq, deepseek, openai, anthropic, all `usable: false` |
| Temporary key | revoked (1 of 1) |
| The aisandbox-ai unit's env files | `/etc/aisandbox/ai.env` only |
| Key presence counts in that file (counts only) | all five 0 |
| C3, C4 and the counts | agree: no provider is usable |
| Key-like text in the saved answers | 0 |
| Build | `provider-key-missing.error.js`, `execution-error.js`, `provider-availability.js` present; the frontend carries "No provider available" in en, zh-TW and zh-CN |
| ACCESS-01J build | the OpenAI and xAI adapters say `store: true` 0 times and `store: false` twice; `reasoning.encrypted_content` present |

## Keith's browser check (2026-11-13, "Yes, it does")

In a project on staging:
- the provider dropdown shows only "No provider available", and both dropdowns are disabled;
- Send is disabled;
- the hint line reads "No AI provider is set up yet, so runs can't start. Ask an admin to add a provider key.";
- 繁體中文 and 简体中文 show the translated text.

**Not checked live:** the translated `provider_key_missing` sentence after a real keyless run. It needs runs on; tests cover it.

## State after

- Staging runs 6f6b8e8, with every provider switch off and runs off.
- The AI service has no provider key, so the workspace chat shows the "no provider" state until a key is added to `/etc/aisandbox/ai.env`.
- ACCESS-01J is deployed; ACCESS-01J-LIVE now holds only its live check.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes checked before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and the hash unchanged, health, guard, provider and earlier checks pass, configuration unchanged; 5: from the host; 6: output checked for key text, the temporary key value never shown and revoked)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-13 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false.
