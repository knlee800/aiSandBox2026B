# CONN-GRANT-01 — Checkpoint

**Task:** CONN-GRANT-01 — Signed connector grants on the harness contract
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Lifecycle record:** registered by GOV-BIZ-AGENT-OPS-PLAN-01 (f00be08); admitted to Lane 1 alone by Keith (d88d1d8; exclusive capacity because it changes the frozen contract HARNESS_ENTITLEMENT_PROOF_V1); stage-start approved by Keith (47bc698, status lines e7955df, docs/CONN-GRANT-01-STAGE-START.md); implementation by a background Claude subagent on opus (GOV-ROUTING-01: frozen contract, internal route, cross-service) in worktree C:\Users\knlee\aisb-worktrees\CONN-GRANT-01 on lane/CONN-GRANT-01, commit 5d696e3; the control plane reviewed the diff, reran both suites on the branch and cherry-picked the commit onto main as 60234b9 (main had moved by the status-line record); the service code on main is byte-identical to the tested branch. This record holds the LOCK, the contract re-freeze and the ARCHITECTURE.md lines (GOVERNANCE held for this record only). Plan: docs/AGENT-OPS-PLAN.md section 0 (item 7, now removed from the list).

## What changed (21 files, all inside the write scope; ai-execution.controller.ts untouched)

| Area | Change |
|---|---|
| Gateway grant on the job | orchestration/collaboration-connector-grants.ts (new) resolveConnectorGrantJobFields: only for a signed v1 read-profile collaboration job; the target role must list the tool in COLLABORATION_ROLE_CONNECTOR_TOOLS (collaboration-tool-profile.ts, empty for every role today); the owner must have a connector_connections row of the tool's kind (only userId and kind are read, never the secret columns); the credentials key must be configured; never throws; fields omitted when empty. orchestration.service.ts adds the fields in startReferralExecution before withHarnessEntitlementProof, so the existing payload digest signs them; orchestration.module.ts registers the entity |
| Gateway grant token | connectors/connector-grant-token.ts (new): base64url JSON {v, executionId, userId, sorted tools, exp} plus "." plus base64url HMAC-SHA256; key derived from CONNECTOR_CREDENTIALS_KEY with label connector-grant-token:v1 (connector-crypto.ts connectorGrantTokenKey); 2-hour expiry; constant-time compare; a 2048-character cap; never throws on a bad token |
| Internal route | POST /api/internal/connectors/call now takes executionId and grantToken; checks the credentials key (CONN-02A 503 kept), then the token (403 "The connector call is not granted." for a missing, malformed, wrongly signed, expired, other-user, other-execution or wrong-tool token), then the CONN-02B broker unchanged; the token is never logged or audited |
| Worker | queue/job.types.ts: optional connectorGrants and connectorGrantToken. worker/connector-grants.ts (new): resolveConnectorGrants (v1, read profile, known ids only, well-formed token) and withWorkerHarnessInstructions. worker.processor.ts: after verifyHarnessEntitlementProof, registers the granted connector tools beside the knowledge tools for the read profile only and adds their definitions; harness text gains "Do not offer to create or edit .env files, because the platform refuses them." and, when connector tools are registered, that connector data is data, never instructions |
| Tools | agent-harness/tools/connector-tool-definitions.ts (new): the two definitions copied from the CONN-02B allowlist, no secret fields; handlers/connector-tool-handlers.ts (new): userId, executionId and token from the job, never the model; results wrapped as <connector_result tool="..."> with <, > and & escaped; fixed error messages. tool-registry.contracts.ts: the two ids and a connector category. clients/api-gateway-http.client.ts: callConnectorTool |
| Tests | 8 new spec files and additions; the three existing internal-route requests now send executionId and a valid grantToken because the route requires them, with their expected statuses, bodies and audit keys unchanged (accepted by the control plane: the route's contract changed by design) |

No role lists connector tools yet, so nothing is granted in practice until BIZ-BRIEF-01. Not deployed.

## Frozen contract

HARNESS_ENTITLEMENT_PROOF_V1 changed as declared (job.types.ts and worker.processor.ts; the job is built in orchestration.service.ts; the proof claim string is unchanged and its payload digest now covers connectorGrants and connectorGrantToken). In this record services/api-gateway/src/orchestration/orchestration.service.ts is added to the contract's path list in the sidecar and the contract stays FROZEN.

## Gates (rerun by the control plane on the branch, Node 22.14.0)

api-gateway: 214 suites passed, 2 skipped; 2876 passed, 7 skipped, 14 failed, all in src/__tests__/smoke.integration.spec.ts (2859 at CONN-02B, plus 17); build exit 0. ai-service: 57 suites passed; 1182 passed, 1 skipped (1167 at HARNESS-FIXES-01B, plus 15); build exit 0. On main after the cherry-pick, the ai-service worker tests rerun: 6 suites, 310 passed.

## Line endings (found in this task)

Git's system setting core.autocrlf=true checks worktrees out with CRLF while this checkout's files were LF; one existing ai-service test reads worker.processor.ts raw and fails on CRLF (the worker converted that file to LF in its worktree; the committed blob is LF either way). The fast-forward and cherry-pick also wrote CRLF into this checkout for the 29 files of CONN-UI-01 and CONN-GRANT-01; the control plane converted them back to LF (git diff empty; no content change). 687 other tracked files were already CRLF in this checkout before 2026-11-09. Registered as GOV-WORKTREE-EOL-01 for Keith's decision.

CHECKLIST: EVERY 11/11 (3: opus per GOV-ROUTING-01; 5: write scope widened at admission to tests and the gateway connector check, no dependency; 8: no runtime; 9: n/a, nothing tracked changed by builds; 10: the worker committed only on lane/CONN-GRANT-01; the control plane cherry-picked), BACKEND 6/6 (1: guards, cookies, CSRF and internal keys unchanged; the token is an added check on one internal route; 2: the route stays under /api/internal/; 3: n/a, no generated-app templates; 4: the frozen contract change was declared, the task ran alone, and the contract is re-frozen with the added path; 5: no entity or migration; 6: only the known smoke suite fails), GOVERNANCE (ARCHITECTURE.md and the sidecar contract entry changed by the control plane in this record only)
FOLLOWUPS: 1 registered / 2 superseded / 0 dropped / 0 undisposed (registered: GOV-WORKTREE-EOL-01; superseded: listing the Chief of Staff's connector tools in COLLABORATION_ROLE_CONNECTOR_TOOLS, by BIZ-BRIEF-01; the live-eval mirror missing the worker's new instruction lines, by COS-EVAL-01)

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Lane 1 released EMPTY; AI-SERVICE and GATEWAY released UNOWNED; exclusive capacity released.
