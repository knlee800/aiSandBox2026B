# CONN-02B — Stage-start

**Task:** CONN-02B — Connector broker, allowlist, SSRF guard and audit (plan docs/AGENT-OPS-PLAN.md section 0 item 5, section 3.1 "Broker", CONN-02B part).
**Lane:** 1, admitted 2026-11-09 (2c4d0c8), with GATEWAY and PACKAGE.
**Lifecycle:** 4-STEP. This is step 2. **Evidence class:** LOCAL-TESTS. **Approved by Keith:** 2026-11-09.
**Implementation model:** grok-4.7-xhigh (child processes and secrets: high-risk work under Model Routing).

## 1. Dependency

`@modelcontextprotocol/sdk` 1.32.2 (exact pin) added to services/api-gateway/package.json. The same version is already in the root lockfile through services/connectors-mcp (CONN-01), so the lockfile should only gain the gateway's dependency entry; any other lockfile change stops the task.

## 2. Server start

- One shared stdio child, started on first use: `node /opt/aisandbox/services/connectors-mcp/dist/main.js` (absolute path; the gateway unit's WorkingDirectory is /opt/aisandbox/services/api-gateway). The path is a constant; tests inject a fake transport or path.
- Explicit child environment: PATH and NODE_ENV only. None of the gateway's environment (CONNECTOR_CREDENTIALS_KEY, the harness HMAC secret, database or other keys) reaches the child. A test asserts the spawn environment.
- Stopped after 5 idle minutes; restarted on the next call. If it exits or fails to start, the call fails with a fixed message and the next call starts a new child.
- At most 4 calls in flight; more wait or fail with a fixed busy message. Each call has a 25-second limit; on timeout the child is killed.

## 3. Allowlist (services/api-gateway/src/connectors/connector-servers.ts)

One server, `connectors-mcp`, with two tools: `mail_list_unread_metadata` (kind imap) and `calendar_list_today` (kind ical). For each tool the allowlist holds our own description and the model-facing input schema (what CONN-GRANT-01 will show a model: limit for mail; timeZone for calendar; never a secret). On start the broker reads the server's tool list only to check both tools exist; it never passes the server's descriptions on. Tools not on the allowlist are ignored and logged once with their name only. No other server can be configured; user-supplied servers are refused.

## 4. One call

`callConnectorTool(userId, toolId, args)`: tool must be on the allowlist; the user must have a connection of the tool's kind (CONN-02A table); the secret is decrypted for this call only (decryptConnectorSecret) and added as tool arguments (mail: preset, username, appPassword; calendar: icalUrl) that are not part of the model-facing schema; the child's result is checked to be JSON and capped (64 KB) before it is returned. The decrypted secret never appears in a log line, an exception message, an audit row or the returned result; child error text is scrubbed of it.

## 5. Routes

- `POST /api/internal/connectors/call` with `{ userId, toolId, arguments }`, behind the existing InternalServiceAuthGuard used by the other /api/internal routes. Checks as in section 4. The per-job signed grant check is added by CONN-GRANT-01.
- `POST /api/connectors/:kind/verify` (owner route, same guard pattern as CONN-02A): runs one read call for the owner's connection of that kind (mail with limit 1; calendar for today in UTC), sets last_verified_at on success, and returns `{ ok: true, lastVerifiedAt }` or a fixed failure message (`could not reach the mail server`, `the calendar link could not be read`, `connections are not configured`) with no provider text.

## 6. Audit

One audit_events row per call and per verify: action (connector_call or connector_verify), toolId, userId, itemCount, resultBytes, durationMs, outcome (ok, error, timeout). Never subjects, senders, titles, the link or the username. Tests assert the payload keys.

## 7. Connect-time calendar check (carried from CONN-02A)

Also refuse the host names localhost and names ending in .localhost, .local or .internal at POST /api/connectors/ical.

## 8. ARCHITECTURE.md (control plane, in the LOCK record, holding GOVERNANCE)

Repository Layout gains services/connectors-mcp/; section 13.1 a row "Connector broker and platform-written MCP server — IMPLEMENTED, not deployed"; section 8 Internal APIs gains POST /api/internal/connectors/call.

## 9. Out of scope

The Connections page (CONN-UI-01), signed grants and agent tools (CONN-GRANT-01), any deploy or host change. No real mail or calendar server is contacted in tests: they use a fake MCP transport or a fake child.

## 10. Gates

api-gateway full suite (compare with 2835 passed and the 14 known smoke-suite failures at CONN-02A) and npm run build.

CHECKLIST (stage-start): EVERY 1, 2, 3 and 5 met (admitted; 4-STEP; grok-4.7-xhigh; the one dependency approved by Keith with PACKAGE held); the rest are reported at LOCK.
