# AGENT-WRITE-UI-01 — Checkpoint

**Task:** AGENT-WRITE-UI-01 — Agent mode says when file changes are off for this account
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by ACCESS-01C (docs/ACCESS-01C-STAGE-START.md section 10); admitted by Keith to Lane 2 in 9811c9b5adbab0457d7271b86432e7cf42dba047. Code and LOCK in one record (GOV-OS-04, LOCAL-TESTS). Plan: docs/AGENT-OPS-PLAN.md section 0 (item 14, now removed from the list).

## What changed

- services/api-gateway/src/auth/auth.controller.ts: GET /api/auth/me also returns agentWriteEnabled, true only when EntitlementService.resolveAgentWriteEnabled(userId) is true (the same call the Agent signer uses at services/api-gateway/src/ai/ai-execution.controller.ts:765-773); a false result or a thrown lookup gives false and the profile is still returned. SessionCookieGuard unchanged.
- services/api-gateway/src/auth/auth.controller.spec.ts: true, false and a failing lookup; existing cases expect the new field.
- frontend/app/[locale]/app/page.tsx reads the field (missing or non-boolean is false) and passes it to the shell; frontend/components/workspace/workspace-agent-mode.logic.ts adds parseAgentWriteEnabled; frontend/components/workspace/workspace-shell.tsx shows the notice under the Ask / Build / Agent control.
- Tests: workspace-agent-mode.logic.test.ts (parser cases) and workspace-shell.test.tsx (shown; hidden when writes are on, when not entitled and when Agent is off; the key in all three message files).
- frontend/messages: ai.agentWriteOffNotice. en: "File changes are off for this account, so Agent can read and answer but will not change files." zh-TW: 此帳戶的檔案變更已關閉，代理人可以讀取並回答，但不會變更檔案。 zh-CN: 此账户的文件更改已关闭，智能体可以读取并回答，但不会更改文件。

The frozen HARNESS_ENTITLEMENT_PROOF_V1 files and the entitlement service are untouched. Not deployed.

## Gates (rerun by the control plane under Node 22.14.0)

- api-gateway src/auth: 18 suites passed, 1 skipped; 191 passed, 1 skipped. Full api-gateway suite: 204 suites passed, 2 skipped; 2816 passed, 7 skipped, 14 failed, all in src/__tests__/smoke.integration.spec.ts (the known runtime-only smoke suite; 2813 passed at CONN-01, plus 3). npm run build exit 0.
- frontend: npx tsc --noEmit exit 0; npm test 900 passed, 0 failed (898 plus 2); npm run build exit 0; frontend/tsconfig.tsbuildinfo restored.

Cursor: grok-4.7-high requested, resolved Grok 4.7 256K High; its gates matched (Node 24.22.1; its smoke-suite failures were the same 14, there from a better-sqlite3 Node version mismatch).

## Design

Impeccable and Emil Kowalski skills read by the worker. Applied: DESIGN.md's restrained amber warning (full border, no side stripe, gradient or glass), Heroicons v2 Outline information icon aligned to the first line so wrapped Chinese keeps it in place, no transition because the notice is a persistent mode status, role="alert".

## Live check

Owed at the next staging deploy, written into STAGING-DEPLOY-CONN-01's scope: an account with harness access and Agent write off sees the notice in its locale when Agent is selected; Keith's account (write on) sees none.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: tsconfig.tsbuildinfo restored), UI 9/9 (9: live check owed at the next deploy, recorded in STAGING-DEPLOY-CONN-01), BACKEND 6/6 (1: auth, cookies, CSRF and guards unchanged, one field added to an already guarded route; 2: no internal endpoint touched; 3: n/a, no generated-app templates; 4: frozen contract untouched; 5: n/a, no entity or migration; 6: gateway failures are the known smoke suite only)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed (superseded: the live check, by STAGING-DEPLOY-CONN-01)

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Lane 2 released EMPTY; GATEWAY, FRONTEND and I18N released UNOWNED.
