# CONN-01 — Stage-start

**Task:** CONN-01 — Platform MCP server for mail headers and today's calendar (plan docs/AGENT-OPS-PLAN.md section 0 item 1, sections 3.1 to 3.3).
**Lane:** 1, admitted 2026-11-09 (fac9275), with PACKAGE and HOTFILE leases on ops/clean-baseline/lib/ops-lib.sh, ops/clean-baseline/bin/aisandbox-prepare, services/connectors-mcp/package.json and services/connectors-mcp/src/server.ts.
**Lifecycle:** 4-STEP. This is step 2. **Evidence class:** LOCAL-TESTS. **Approved by Keith:** 2026-11-09.

## 1. Dependencies (approved by Keith 2026-11-09; exact pins, each released at least two weeks before this date)

| Package | Version | Licence | Use |
|---|---|---|---|
| @modelcontextprotocol/sdk | 1.32.2 (2026-10-23) | MIT | MCP server over stdio only. Its own dependencies (express 5, hono and others) are installed but not used |
| imapflow | 2.9.1 (2026-10-22) | MIT | IMAP client: read-only mailbox open and header fetch |
| node-ical | 0.27.3 (2026-10-03) | Apache-2.0 | Calendar text parser with recurrence expansion; its own fetch helper is not used |

Dev tooling (typescript, jest, ts-jest, @types/node, @types/jest) reuses the versions the other services declare. No root package.json change: workspaces already cover services/* (package.json:7-10). The root package-lock.json changes.

## 2. Files

services/connectors-mcp/: package.json (name @aisandbox/connectors-mcp, private, scripts build = tsc, test = jest, start = node dist/main.js), tsconfig.json, jest.config.js, src/main.ts (stdio entry), src/server.ts (registers our two tools with our own descriptions and input schemas), src/tools/mail-list-unread.ts, src/tools/calendar-today.ts, src/clients/imap-client.ts (MailboxClient interface and the imapflow implementation), src/clients/ical-feed.ts (CalendarFeed interface: fetch and parse), src/net/public-https.ts (guarded fetch), src/limits.ts, src/__tests__/*.

## 3. Tools

| Tool | Input (from the gateway broker, not the model) | Returns |
|---|---|---|
| mail_list_unread_metadata | preset (gmail, yahoo, icloud), username, appPassword, limit (1-25, default 25) | up to 25 unread Inbox messages: id, from name and address, to count, subject, date |
| calendar_list_today | icalUrl, timeZone (IANA), ownerEmail (optional), now (optional, for tests) | today's events in that time zone, recurrences expanded: title, start, end, organizer, attendee count, the owner's response status |

## 4. Safety rules (acceptance criteria)

1. Mail servers only from presets: imap.gmail.com, imap.mail.yahoo.com, imap.mail.me.com, port 993, TLS with certificate verification on. No other host or port is accepted.
2. The mailbox opens read-only (EXAMINE). Headers are fetched with BODY.PEEK. No SELECT, STORE, APPEND, EXPUNGE, COPY, MOVE, DELETE, CREATE or flag change is ever sent. A test runs a scripted IMAP server inside the test process (no Docker, no real server) and asserts the recorded command log contains none of them and that EXAMINE is used.
3. The calendar link must be https. The host is resolved and every resolved address is checked; loopback, private, link-local (169.254.0.0/16 including 169.254.169.254), unique-local, multicast and unspecified addresses for IPv4 and IPv6 are refused. The request connects to the checked address (no second lookup), keeps the host name for TLS, follows no redirects, verifies the certificate, and stops at 2 MB. Tests cover each refused range, a redirect and an oversize body.
4. Timeouts: 20 s per mail call, 10 s per calendar call.
5. Text limits: subjects and titles cut at 300 characters; control characters removed; result size capped.
6. Secrets: the app password and calendar link arrive with each call, are never logged, never written to disk and never kept between calls; imapflow logging is off. Error messages never contain them (a test checks).
7. Our own tool descriptions and schemas only; nothing the server receives becomes an instruction.

## 5. Deploy build list (folded in, plan section 3.1)

- ops/clean-baseline/lib/ops-lib.sh checkout_and_build: add `npm --prefix "$AISB_ROOT/services/connectors-mcp" run build` after the container-manager build, and `services/connectors-mcp/dist/main.js` to the artifact loop.
- ops/clean-baseline/bin/aisandbox-prepare: add `services/connectors-mcp/dist/main.js` to the ARTIFACTS sha256sum line (aisandbox-first-start checks that file with sha256sum -c, so it follows).
- A static test under ops/clean-baseline/tests/static/ asserts both lists name the new artifact.
- The staging host keeps its installed library until STAGING-DEPLOY-CONN-01 installs this one. No unit, port or Caddy change.

## 6. Gates

services/connectors-mcp: npm test and npm run build. The existing ops static tests, plus the new one. Gateway, ai-service and frontend gates are unaffected (no source change there), but the control plane reruns the gateway and ai-service test suites once after the lockfile change.

## 7. Out of scope

The gateway broker, credentials storage, routes, UI and grants (CONN-02A, CONN-02B, CONN-UI-01, CONN-GRANT-01). Message bodies (CONN-03). Google sign-in (CONN-OAUTH-01).

CHECKLIST (stage-start): EVERY items 1, 2, 3 and 5 met at this step (admitted; 4-STEP named; model grok-4.7-high named; dependencies approved by Keith with PACKAGE held); the rest are reported at LOCK.
