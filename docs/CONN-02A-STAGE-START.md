# CONN-02A — Stage-start

**Task:** CONN-02A — Connector credentials, encryption and connect routes (plan docs/AGENT-OPS-PLAN.md section 0 item 4, section 3.1 "Broker", CONN-02A part).
**Lane:** 1, admitted 2026-11-09 (aacfa80), with GATEWAY, MIGRATION and ENV (the env template only; no host env file).
**Lifecycle:** 4-STEP. This is step 2. **Evidence class:** LOCAL-TESTS. **Approved by Keith:** 2026-11-09.
**Implementation model:** grok-4.7-xhigh (MIGRATION checklist item 1).

## 1. Table

New entity services/api-gateway/src/entities/connector-connection.entity.ts, table `connector_connections`, following the knowledge_documents entity conventions:

| Column | Type | Notes |
|---|---|---|
| id | uuid, generated | |
| user_id | uuid, FK users.id, ON DELETE CASCADE | |
| kind | varchar(16) | `imap` or `ical` (later `google`) |
| preset | varchar(16), null | `gmail`, `yahoo`, `icloud` for imap; null for ical |
| username | varchar(254), null | imap only |
| secret_ciphertext | text | `v1.<iv>.<tag>.<ciphertext>`, base64url parts |
| key_version | smallint | 1 |
| created_at, updated_at | timestamptz | |
| last_verified_at | timestamptz, null | set by CONN-02B's Verify |

Unique index on (user_id, kind): one connection per owner per kind. Connecting again for the same kind replaces the row.

## 2. Encryption

AES-256-GCM through Node crypto. A fresh 12-byte random IV per save; 16-byte tag. Additional authenticated data `connector:v1:<userId>:<kind>`, so a ciphertext copied to another row or account fails to decrypt. The key is `CONNECTOR_CREDENTIALS_KEY`: base64 of exactly 32 bytes, read and validated when a route needs it (never at boot). Missing or invalid key: the connector routes answer 503 with a fixed "connections are not configured" message; the gateway starts and every other route works. The secret is the IMAP app password (spaces removed) or the whole iCal link.

A decrypt helper exists for CONN-02B and is unit-tested here; no route in this slice returns a decrypted value.

## 3. Routes (services/api-gateway/src/connectors/)

Same guard and entitlement pattern as the Knowledge routes (`SessionOrApiKeyAuthGuard`, then harnessEntitled true, else 403), with whatever CSRF handling those routes already get from the guard stack.

| Route | Body / result |
|---|---|
| POST /api/connectors/imap | `{ preset, username, appPassword }` → `{ kind, preset, username, createdAt, updatedAt, lastVerifiedAt }` |
| POST /api/connectors/ical | `{ url }` → `{ kind, createdAt, updatedAt, lastVerifiedAt }` |
| GET /api/connectors | `{ connections: [...] }`, the same fields, never a secret |
| DELETE /api/connectors/:kind | 204; deletes the owner's row of that kind; 404 if none |

Input checks: preset one of the three; username an email address of at most 254 characters; app password 8 to 64 characters after removing spaces; iCal url `https:`, at most 2048 characters, no user or password part, a host name. The full address check happens in the MCP server at fetch time (CONN-01). Requests over 4 KB are refused.

## 4. Never exposed

The app password and the iCal link never appear in a response, a log line, an exception message or an audit row. Tests assert this for each route and for failing paths (bad key, bad input, database error).

## 5. Audit

One audit_events row per connect, replace and delete, through the existing audit writer pattern: action, kind, preset; no username, no secret, no URL.

## 6. Migration

`services/api-gateway/src/migrations/<timestamp>-CreateConnectorConnectionsTable.ts`, with a timestamp after the newest existing migration (1801000000000-CreateUserEntitlementsTable). Up creates the table, the FK and the unique index; down drops them. A migration test covers up and down statements, as the existing migration tests do. No existing table changes; nothing is deleted.

## 7. Env template

ops/clean-baseline/env/gateway.env.template gains, next to HARNESS_ENTITLEMENT_HMAC_SECRET, an empty `CONNECTOR_CREDENTIALS_KEY=` with a comment: secret, 32 random bytes base64, typed by Keith at a hidden prompt (STAGING-DEPLOY-CONN-01). Never in ai.env.template.

## 8. Out of scope

Verify and the MCP client (CONN-02B), the Connections page (CONN-UI-01), grants (CONN-GRANT-01), any host change.

## 9. Gates

api-gateway: full test suite (compare with 2816 passed and the 14 known smoke-suite failures at AGENT-WRITE-UI-01) and npm run build.

CHECKLIST (stage-start): EVERY 1, 2, 3 met (admitted; 4-STEP; grok-4.7-xhigh named); MIGRATION 1 and 2 met (mutex held, 4-step, xhigh; timestamp order stated); the rest are reported at LOCK.
