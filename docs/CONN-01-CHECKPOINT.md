# CONN-01 — Checkpoint

**Task:** CONN-01 — Platform MCP server for mail headers and today's calendar
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Lifecycle record:** registered by GOV-BIZ-AGENT-OPS-PLAN-01 (f00be08); admitted to Lane 1 by Keith (fac9275); stage-start approved by Keith (8fc1842, docs/CONN-01-STAGE-START.md); implementation by Cursor; this record holds the code and the LOCK (GOV-OS-04, LOCAL-TESTS). Plan: docs/AGENT-OPS-PLAN.md section 0 (item 1, now removed from the list), sections 3.1 to 3.3.

## What changed

- services/connectors-mcp/ (new workspace @aisandbox/connectors-mcp): package.json, tsconfig.json, jest.config.js; src/main.ts (stdio entry); src/server.ts (our two tool names, descriptions and input schemas); src/limits.ts; src/net/public-https.ts; src/clients/imap-client.ts; src/clients/ical-feed.ts; src/tools/mail-list-unread.ts; src/tools/calendar-today.ts; four test files under src/__tests__.
- Dependencies (approved by Keith at the stage-start, exact pins): @modelcontextprotocol/sdk 1.32.2, imapflow 2.9.1, node-ical 0.27.3. Dev tooling with ai-service's ranges, already in the tree. No root package.json change.
- package-lock.json: adds this workspace's tree. The install also raised three shared packages by a patch version, which Keith accepted on 2026-11-09: proxy-addr 2.0.7 to 2.0.8, side-channel 1.1.0 to 1.1.1, side-channel-list 1.0.0 to 1.0.1 (all within the ranges their existing dependants declare). Cursor compared every lockfile entry before and after each install; nothing else changed.
- ops/clean-baseline/lib/ops-lib.sh checkout_and_build builds services/connectors-mcp and checks services/connectors-mcp/dist/main.js; ops/clean-baseline/bin/aisandbox-prepare adds it to the ARTIFACTS hashes; new static test ops/clean-baseline/tests/static/t-connectors-mcp-artifact.sh. The staging host keeps its installed library until STAGING-DEPLOY-CONN-01.

Nothing uses the server yet: the gateway broker that starts it is CONN-02B. Not deployed.

## Safety rules (stage-start section 4) and their tests

| Rule | Proof |
|---|---|
| 1. Preset hosts only (imap.gmail.com, imap.mail.yahoo.com, imap.mail.me.com), port 993, TLS, certificate checks | imap-verbs.spec.ts: preset options; an unknown preset opens no socket |
| 2. Read-only mailbox: EXAMINE, no SELECT, STORE, APPEND, EXPUNGE, COPY, MOVE, DELETE or CREATE, no fetch item that can set \Seen | imap-verbs.spec.ts against a scripted IMAP server inside the test process on 127.0.0.1: the command log has EXAMINE, UNSEEN and ENVELOPE and none of the forbidden verbs or items |
| 3. Calendar over HTTPS to public addresses only, connect to the checked address with SNI and certificate checks, no redirects, 2 MB cap | public-https.spec.ts: loopback, private, link-local incl. 169.254.169.254, unique-local, multicast, unspecified, 100.64.0.0/10, 192.0.0.0/24, documentation ranges, 198.18.0.0/15, NAT64, 6to4, IPv4-mapped forms; pinned connect; redirect; oversize body |
| 4. Mail 20 s, calendar 10 s | option and timeout tests |
| 5. Subjects, sender names and addresses, and titles cut at 300 characters with control characters removed; result capped | imap-verbs.spec.ts, calendar-today.spec.ts, server.spec.ts |
| 6. Secrets per call, never logged, stored or put in an error; imapflow logging off | two-call IMAP test; calendar URL error test |
| 7. Our descriptions and schemas only; tool text is data | server.spec.ts: an instruction-like subject stays inside the result; the tool list is unchanged |

## Review findings fixed before LOCK

1. The first version parsed raw headers, so encoded subjects and names (for example Chinese in RFC 2047 encoded words) came through undecoded. It now reads imapflow's decoded envelope; tests decode a Base64 UTF-8 subject (會議) and a Q-encoded name (王小明).
2. The first address block list missed 100.64.0.0/10, 192.0.0.0/24, 198.18.0.0/15, the documentation ranges, and the NAT64 and 6to4 prefixes. All are refused now (NAT64, 6to4 and 2001:db8::/32 refused outright).

## Gates (rerun by the control plane under Node 22.14.0)

- services/connectors-mcp: 4 suites, 52 passed, 0 failed; npm run build exit 0, dist/main.js present (dist/ is ignored by git).
- ops static tests: t-connectors-mcp-artifact.sh passed=3 failed=0; t-target-membership.sh passed=61 failed=0 (systemd-analyze is not on this PC; the script records it as unavailable and still passes).
- After the lockfile change: ai-service 52 suites, 1157 passed, 1 skipped (unchanged); api-gateway 204 suites passed, 2813 passed, 7 skipped, 14 failed, all in src/__tests__/smoke.integration.spec.ts, the known runtime-only smoke suite that needs a running server; builds of api-gateway and ai-service exit 0 (Cursor).

Cursor: grok-4.7-high requested for all four runs, resolved Grok 4.7 256K High.

CHECKLIST: EVERY 11/11 (5: only the approved dependencies, PACKAGE held, three shared patch bumps accepted by Keith; 8: no runtime started; 9: n/a, no tracked artifact changed), BACKEND 6/6 (1, 2 and 4: auth, internal endpoints and the frozen contract untouched; 3: n/a, no generated-app templates; 5: n/a, no entity or migration; 6: gateway failures are the known smoke suite only), DEPLOY 7/7 (1 to 4 and 7: n/a, no host step in this task; 5: no tests against servers from Keith's PC and no real mail or calendar server contacted; 6: no secret printed)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Lane 1 released EMPTY; PACKAGE and HOTFILE leases on ops/clean-baseline/lib/ops-lib.sh, ops/clean-baseline/bin/aisandbox-prepare, services/connectors-mcp/package.json and services/connectors-mcp/src/server.ts released UNOWNED. CONN-02A's ready condition (CONN-01 LOCKED) is now met; Keith decides its admission.
