# STAGING-DEPLOY-CONN-01 — Checkpoint

**Task:** STAGING-DEPLOY-CONN-01 — Deploy the connector library
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (no tester window open; AI runs off throughout). **saturationClass:** OPTIONAL (Keith).
**Source:** registered by GOV-BIZ-AGENT-OPS-PLAN-01; ready condition reworded by Keith 2026-11-09 (e655e67); admitted by Keith (13b2322); Keith approved host steps 1 to 3, then asked that the key be done without him and that the screen checks move to BIZ-LIVE-03.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true; validator PASS | 13b2322d2dfec980acfeea8084b66308c1964932 |
| 2. Deploy, key and host checks | host blocks run by the control plane over ssh | no repository change |
| 3. LOCK | this checkpoint, board, backlog, sidecar, plan | this record |

## Pre-check (sdc-pre.sh, read-only)

Staging at 2a07443 (HEAD and DEPLOYED), migration hash cbd04277..., last migration 1801000000000; 0 active runs, 0 open hand-offs, 0 running executions; all eleven configuration files at the baseline; AI_PROVIDER stub, EMAIL_PROVIDER stub, GLOBAL_EXECUTION_ENABLED false, NODE_ENV production; no CONNECTOR_CREDENTIALS_KEY line; ops-lib.sh 70872c63 (both copies), aisandbox-prepare ca01f9ef (both copies), aisandbox-deploy a97249f3; Node v24.22.1; 147G free; all units active. The nightly backup (20261109T033005Z) holds env-names.txt and env-sha256.txt and no env file: backups keep setting names and hashes, never values.

## Deploy (sdc-deploy.sh, 2026-11-09T14:30:48Z to 14:33:23Z)

The script repeated the guards, then installed the target's ops library (both copies 70872c63 to 3f380d7c, root:root 644) and aisandbox-prepare (both copies ca01f9ef to 0c482f12, root:root 755), copied from the repository at 13b2322 and hash-checked. The old library would not build services/connectors-mcp (CONN-01 added it to the build and artifact lists). aisandbox-deploy then took staging from 2a07443 to 13b2322, rc 0: the added migration made it take and check a database backup first (20261109T143113Z), and the build included @aisandbox/connectors-mcp.

## After-checks (sdc-check.sh)

HEAD and DEPLOYED 13b2322; migration hash cbd04277... to ece5f19bf7c46fba4d36635ce73768f72995af8dd4f196606341aa6da31cacaf, equal to the live schema; last migration CreateConnectorConnectionsTable1802000000000; connector_connections empty; tracked tree clean; no maintenance marker; all configuration files unchanged; flags stub and off; 8 units active; Caddy 401 without login on 5 paths; gateway health, db and ready 200; frontend 200 on 9 pages (/en, office, knowledge, the Team page and the Connections page in en, zh-TW and zh-CN); 25 of 25 guard checks 401 without a key (8 new connector routes, including the internal call route in three spellings); the static test key 403; CORS unchanged; connectors-mcp/dist/main.js built (aisandbox:aisandbox) and, started as the service user with only PATH and NODE_ENV, it answered MCP tools/list with mail_list_unread_metadata and calendar_list_today; the briefing eval runner built with 9 cases; the Morning briefing preset in the frontend build (4 files); the Chief of Staff tool list in the gateway build (sdc-grant.out). The first run of this script stopped on my own check (it hashed the migration list with a trailing newline, the deploy tool without); the one line was fixed and the read-only script rerun (sdc-check-1-stopped.out kept).

## Key (sdc-keygen.sh, sdc-keyfinish.sh)

Keith asked that this not need him. CONNECTOR_CREDENTIALS_KEY is 32 random bytes made on the host (`openssl rand -base64 32`) and written straight to /etc/aisandbox/gateway.env; nobody saw it. An age-encrypted copy to Keith's recipient age1eprthezeaxvpzscspqyacgftf2wd8ywcwhkn9u3d0hkxp3tkhawqz5r8l7 is at /root/aisb-sdc/connector-credentials-key.age (271 bytes, root 600): backups keep only setting names and hashes, so this copy and the host are the only places the key exists. The first script stopped after writing the line (a diff exit code under set -e) and before the restart; the second checked that gateway.env is the baseline bytes plus exactly one line, that the only new name is CONNECTOR_CREDENTIALS_KEY, that the value is 44 characters decoding to 32 bytes, then restarted the gateway (ready 200). New gateway.env baseline: 568af7100b1d708586ac08aa6168771de497d57d7d8c4e54d2507e5563b938ff (root:root 600); the pre-key file is kept at /root/aisb-sdc/gateway.env.before. sdc-key.sh (Keith's hidden-prompt version) was not run and was removed from the host.

## Host-driven connector checks (sdc-live.sh)

Two temporary API keys for Keith's account (admin, harness on), made on the host and never shown: A with ai:harness, B without. B: GET /api/connectors 403. A: list 200 empty; IMAP connect (gmail preset, a random address, a fake app password) 200 and stored, with no row holding the password text; Verify 502 "could not reach the mail server", and the gateway log shows Gmail itself answered AUTHENTICATIONFAILED Invalid credentials, so the stored secret was decrypted with the new key and the connector server reached imap.gmail.com over TLS; disconnect 204; an http iCal link and an IP-address iCal link (169.254.169.254) refused at connect with 400; list empty again and no connections left on the host; 3 connector audit rows (connect, verify with outcome error and counts only, delete), none holding the password or the address; no gateway log line holding either. Both keys revoked and refused (403) afterwards. Message files on the host carry presetMorningBriefing and 19 connections keys in en, zh-TW and zh-CN. No key text in any output.

## Screen checks

Moved to BIZ-LIVE-03 by Keith (2026-11-09), where he is in the app for his first briefing and connects his own mail: the OFFICE-06 desk panel, the OFFICE-05 desks and waiting badge, the AGENT-WRITE-UI-01 notice, the CONN-UI-01 page states and the Morning briefing button. The CONN-UI-01 behaviour checkable without his eyes is above.

## Evidence

In `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-CONN-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `aisb-sdc-aisandbox-prepare` | 18415 | `0c482f12f81dbdd71a7a8da3d728096b14e99e95082c55a079487b9fa4f4c29a` |
| `aisb-sdc-ops-lib.sh` | 71000 | `3f380d7ca7028daeaf4531ba51ac3de99baf41cc08256a9ee274efcf0531227b` |
| `sdc-pre.sh` | 3831 | `8b34304d23662a4a8ba36b9da195ee29ca7eca608a2089b51b5f82e2f6f355a0` |
| `sdc-pre.out` | 3448 | `c3f8d9e60136340027ee6d944a2e8c2f55a12e55b4e66cc96838bcba08abe59b` |
| `sdc-deploy.sh` | 5522 | `312114b7376e84f42b5bf2205b92312deba562f220362833b1d91e5d370066c8` |
| `sdc-deploy.out` | 7006 | `2829434fa2354029324794525c6783529e218185bfbb648f7d5b98e33d557c26` |
| `sdc-check-1-stopped.out` | 423 | `bab3f9f861e34de0b56b08112c5cb42fb26717a2f05ed21ef5596fc0551f69e1` |
| `sdc-check.sh` | 8436 | `d7603d44af8e46dd438f02482bc2a43a3022c5361f531440773c1ee098b189d7` |
| `sdc-check.out` | 2968 | `0989edebb84b281f9a7bc8bf54f1f6c907591efeb2b55c5e4fba38dbd0463098` |
| `sdc-grant.out` | 116 | `1eebee9b7a88ef0f22c6a76249af452d80da0ae5e3ae04970c108077c3739701` |
| `sdc-key.sh` (not run) | 2210 | `ab5da83b1b0b84ecc61e2cf1783c4c9b88cee1f50663cc1976f1e8c0cbacd26b` |
| `sdc-keygen.sh` | 2792 | `86050007e337d63c95b93d319c50f59697403735f7e364cc6d372cd6685435c6` |
| `sdc-keygen.out` | 160 | `3d52283d406e7fc6ed2cf5cf1da022eb09236c59b0df48c2acad4073d611d8a2` |
| `sdc-keyfinish.sh` | 1817 | `25e8d941da55dedc7b32226f094ab15de23931869d54e9aacb29c7cd94a38e29` |
| `sdc-keyfinish.out` | 293 | `4a6fa67b7d4720c248f84b1bad4c24298915cf66da96010d1a3c228c36459e08` |
| `sdc-live.sh` | 6226 | `98919f052acc8181646e7120eb517a7ef052e8bc81ff4aa022ca08187240c9a6` |
| `sdc-live.out` | 1236 | `ab610e60405cc5d1a3e34be6508f904c05d08f932b1012414b7c59561d0822f6` |
| `sdc-verify-detail.out` | 3281 | `be833bf0070944f3d59c587b79fb06959712559524e6df91d1c38892adbeabef` |

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code change, no repository build), DEPLOY 7/7 (1: STAGING held; 2: baseline hashes before and after the deploy, the new gateway.env baseline recorded after the key, no tester window; 3 and 7: n/a, window closed; 4: nothing running, deployed commit and migration hash as expected, health, guard and CORS checks pass, configuration unchanged by the deploy, gateway.env changed only by the key step; 5: all from the host; 6: the key never printed or recorded, outputs checked for key text)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed
- The screen checks this task carried (OFFICE-05, OFFICE-06, AGENT-WRITE-UI-01, CONN-UI-01, the Morning briefing button): superseded by BIZ-LIVE-03 (Keith, 2026-11-09), whose scope now lists them.

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false. Staging runs 13b2322 with AI runs off. COS-EVAL-LIVE-01's ready condition now waits only for Keith's approval of the run.
