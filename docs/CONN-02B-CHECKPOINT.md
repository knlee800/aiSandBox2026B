# CONN-02B — Checkpoint

**Task:** CONN-02B — Connector broker, allowlist, SSRF guard and audit
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Lifecycle record:** registered by GOV-BIZ-AGENT-OPS-PLAN-01 (f00be08); admitted to Lane 1 by Keith (2c4d0c8); stage-start approved by Keith (c291a61, docs/CONN-02B-STAGE-START.md); implementation by Cursor on grok-4.7-xhigh; this record holds the code, the ARCHITECTURE.md lines (GOVERNANCE held for this record only) and the LOCK (GOV-OS-04, LOCAL-TESTS). Plan: docs/AGENT-OPS-PLAN.md section 0 (item 5, now removed from the list).

## What changed

| File | Change |
|---|---|
| services/api-gateway/src/connectors/connector-servers.ts (new) | Allowlist of one server (connectors-mcp) and two tools with the platform's own descriptions and model-facing schemas (no secret fields); limits; fixed messages; secret scrub |
| connector-child.ts (new) | Spawns `node /opt/aisandbox/services/connectors-mcp/dist/main.js` with `shell: false` and an environment of exactly PATH and NODE_ENV; the child's stderr is discarded; the SDK Client speaks MCP over that child's stdio |
| connector-broker.ts (new) | One call: allowlisted tool, the owner's connection of its kind, the secret decrypted for that call only and added as arguments, 4 in flight, 25 s limit with the child killed, 5-minute idle stop, restart after exit, JSON result of at most 64 KB, scrubbing, audit |
| internal-connectors.controller.ts (new) | `POST /api/internal/connectors/call`, protected by the global InternalServiceAuthGuard (app.module.ts APP_GUARD on every /api/internal/ path; unchanged) |
| connectors.controller.ts, connectors.service.ts, connectors.module.ts | `POST /api/connectors/:kind/verify` on the owner guard pattern (sets last_verified_at; fixed failure messages; 503 without the key); module wiring |
| connector-rules.ts | The connect-time iCal check also refuses localhost and names ending in .localhost, .local or .internal (the CONN-02A follow-up); its existing localhost expectation now reads false |
| Tests | connector-broker.spec.ts, connector-child.spec.ts (spawn options and a real SDK handshake over a fake child), internal-connectors.controller.spec.ts, and additions to connectors.controller.spec.ts and connector-rules.spec.ts: 24 new tests |
| services/api-gateway/package.json, package-lock.json | `@modelcontextprotocol/sdk` 1.32.2 exact; the lockfile diff is that one dependency line (Cursor compared all 1286 entries before and after) |
| ARCHITECTURE.md | Repository Layout lists services/connectors-mcp/ with a note that it runs as a stdio child; Internal APIs lists POST /api/internal/connectors/call; section 13.1 gains the connector broker row, IMPLEMENTED, not deployed |

**Deviation from the stage-start, accepted:** the stage-start named the SDK's stdio transport. In 1.32.2 its launcher always merges a default environment over the one given, so the child would inherit user and temp variables. The broker spawns the child itself with exactly PATH and NODE_ENV and still uses the SDK Client for the protocol; a test asserts the spawn options.

No agent can use connectors yet (signed grants are CONN-GRANT-01). Not deployed.

## Gates (rerun by the control plane under Node 22.14.0)

api-gateway full suite: 212 suites passed, 2 skipped; 2859 passed, 7 skipped, 14 failed, all in src/__tests__/smoke.integration.spec.ts (the known runtime-only smoke suite; 2835 at CONN-02A, plus 24). npm run build exit 0. Cursor's run under Node 24.22.1 showed the same 24 better-sqlite3 failures as at CONN-02A (environmental).

Cursor: grok-4.7-xhigh requested for both turns (the first was cut off by an orchestrator restart before any file was written and resumed), resolved Grok 4.7 256K Extra High.

CHECKLIST: EVERY 11/11 (5: the one approved dependency, PACKAGE held; 8: no runtime started; no real mail or calendar contacted; 9: n/a, no tracked artifact changed), BACKEND 6/6 (1: guards, cookies and CSRF unchanged; the global internal guard reused; 2: the new internal route sits under /api/internal/ and is not reachable from the frontend; 3: n/a, no generated-app templates; 4: frozen contract untouched; 5: n/a, no entity or migration; 6: only the known smoke suite fails), GOVERNANCE (ARCHITECTURE.md edited by the control plane in this record only, GOVERNANCE released after)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Lane 1 released EMPTY; GATEWAY and PACKAGE released UNOWNED. Both implementation lanes are now empty, which is GOV-OS-08's start condition.
