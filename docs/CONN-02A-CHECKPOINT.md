# CONN-02A — Checkpoint

**Task:** CONN-02A — Connector credentials, encryption and connect routes
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Lifecycle record:** registered by GOV-BIZ-AGENT-OPS-PLAN-01 (f00be08); admitted to Lane 1 by Keith (aacfa80); stage-start approved by Keith (fa78c6d, docs/CONN-02A-STAGE-START.md); implementation by Cursor on grok-4.7-xhigh (the MIGRATION checklist's model); this record holds the code and the LOCK (GOV-OS-04, LOCAL-TESTS). Plan: docs/AGENT-OPS-PLAN.md section 0 (item 4, now removed from the list).

## What changed

- services/api-gateway/src/entities/connector-connection.entity.ts: connector_connections (id, user_id FK users ON DELETE CASCADE, kind, preset, username, secret_ciphertext, key_version default 1, created_at, updated_at, last_verified_at); found by the existing entity glob.
- services/api-gateway/src/migrations/1802000000000-CreateConnectorConnectionsTable.ts (after 1801000000000): up creates the table, the FK and the unique index uq_connector_connections_user_id_kind on (user_id, kind); down drops the index and the table. No other table changes. Test: services/api-gateway/src/migrations/__tests__/1802000000000-CreateConnectorConnectionsTable.spec.ts.
- services/api-gateway/src/connectors/: connector-crypto.ts (AES-256-GCM, fresh 12-byte IV, 16-byte tag, AAD connector:v1:<userId>:<kind>, v1.<iv>.<tag>.<ciphertext> base64url; the only reader of CONNECTOR_CREDENTIALS_KEY, at use time; base64 of exactly 32 bytes, canonical); connector-rules.ts and connector-input.ts with dto/connect-connector.dto.ts (input checks with fixed messages); connectors.service.ts (connect or replace, list, delete; the audit row in the same transaction; fixed log text only); connectors.controller.ts (four routes, SessionOrApiKeyAuthGuard then the harness entitlement check); connectors.module.ts; four spec files.
- services/api-gateway/src/app.module.ts imports ConnectorsModule only.
- ops/clean-baseline/env/gateway.env.template: empty CONNECTOR_CREDENTIALS_KEY= under HARNESS_ENTITLEMENT_HMAC_SECRET, commented as a secret of 32 random bytes in base64 typed by Keith at a hidden prompt (STAGING-DEPLOY-CONN-01). Not in ai.env.template.

Routes: POST /api/connectors/imap ({preset, username, appPassword}), POST /api/connectors/ical ({url}), GET /api/connectors, DELETE /api/connectors/:kind. A re-connect of the same kind updates the same row (id and createdAt kept, lastVerifiedAt cleared). Responses carry kind, preset, username and dates only. Missing or invalid key: 503 "connections are not configured" on these routes only; the module loads and the gateway starts without the key. Not deployed; nothing calls these routes yet (CONN-UI-01 and CONN-02B do).

## Stage-start requirements and tests (19 new tests)

| Requirement | Test |
|---|---|
| AES-256-GCM, fresh IV, AAD bound to owner and kind, stored format | encrypts with AES-256-GCM, a fresh 12-byte IV, and AAD connector:v1:<userId>:<kind> |
| Another user, another kind or a tampered tag fails; no plaintext in the error | refuses to decrypt for another user, another kind, or a tampered tag |
| Key read at use time; missing, empty, non-base64, wrong length, non-canonical give the fixed message; 503 on all four routes; module loads without it | rejects a missing or invalid credentials key with a fixed message; returns 503 with a fixed message when the credentials key is missing or invalid; imports and instantiates the connector module without CONNECTOR_CREDENTIALS_KEY |
| Knowledge guard pattern, 403 when not harness-entitled, 401 without auth | uses SessionOrApiKeyAuthGuard and returns 403 when the caller is not harness entitled; returns 401 when credentials are missing |
| One row per owner per kind, replace, owner isolation | connects, lists and deletes only the owner row and replaces the same kind |
| Input checks; 4 KB body limit | the presets, email and app-password test; the iCal url test; refuses connector input that fails the stage-start checks; the two 4 KB tests |
| Secrets never in responses, logs, exceptions or audit rows, on success and failure paths | does not expose the app password or iCal link on success or failure |
| Audit rows on connect, replace and delete with action, kind and preset only | writes an audit row with action, kind and preset on connect, replace and delete |
| Migration order, up and down | the three migration tests |

## Gates (rerun by the control plane under Node 22.14.0)

api-gateway full suite: 209 suites passed, 2 skipped; 2835 passed, 7 skipped, 14 failed, all in src/__tests__/smoke.integration.spec.ts (the known runtime-only smoke suite; 2816 passed at AGENT-WRITE-UI-01, plus 19). The new connector and migration tests: 19 passed. npm run build exit 0.

Cursor ran under Node 24.22.1, where better-sqlite3 does not load: its run showed 24 more failures in four SQLite integration specs and common/sqlite-database-path.spec.ts; under Node 22 they pass. The first Cursor turn ended with a model-provider connection error while writing tests; the control plane resumed the same session, which finished the tests and the gates. grok-4.7-xhigh requested for both turns, resolved Grok 4.7 256K Extra High.

CHECKLIST: EVERY 11/11 (3: grok-4.7-xhigh as the MIGRATION list requires; 8: no runtime or database started; 9: n/a, dist and tsbuildinfo are ignored), BACKEND 6/6 (1: guards, cookies and CSRF unchanged, the Knowledge guard reused; 2: no internal endpoint added; 3: n/a, no generated-app templates; 4: frozen contract untouched; 5: MIGRATION list met; 6: only the known smoke suite fails), MIGRATION 4/4 (1: MIGRATION held, 4-step, xhigh; 2: 1802000000000 follows 1801000000000; 3: up and down written and tested; 4: no existing table or data changed)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed (superseded: the connect-time iCal check accepts the host name localhost, by CONN-02B's scope; the MCP server already refuses loopback at fetch)

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Lane 1 released EMPTY; GATEWAY, MIGRATION and ENV released UNOWNED. CONN-02B's ready condition (CONN-02A LOCKED) is now met; Keith decides its admission.
