# PROVIDER-LIMIT-MSG-01 — Checkpoint

**Task:** PROVIDER-LIMIT-MSG-01 — Say so when the AI provider's account limit refuses a run
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT per PRD.md.
**Source:** registered by BIZ-LIVE-01 on 2026-11-07 (the first three Chief of Staff runs failed on the Anthropic spend limit and showed Invalid request to Anthropic API); Keith approved the scope and wording and admitted it the same day.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with AI-SERVICE, FRONTEND and I18N; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High); validator PASS. The first dry run refused frontend/app/[locale]/app/page.tsx (the validator does not accept brackets in a path) and nothing was applied; the sidecar lists frontend/app/ as earlier tasks do and the body limits it to one entry in page.tsx | da87a33ca725ae1c0577ec6bad8f33599b133715 |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 75b94067-9471-4238-849a-2cb05ca212a1 | this commit |
| 3. Consolidation and LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- ai-service adapter: before the generic 400 branch, an Anthropic.APIError with status 400 whose structured body (APIError.error.error, SDK 0.32.1) has type invalid_request_error and a message containing usage limit (case-insensitive) throws BadRequestException with the exported fixed sentence AI provider usage limit reached. The exception and the adapter log carry only that sentence: no provider text, reset date, limit value or key. Every other 400 keeps Invalid request to Anthropic API; the 401, 429, 5xx and timeout branches are unchanged.
- frontend workspace chat: toQuotaRateLimitGuidance returns the new providerUsageLimit copy when the stored message is exactly that sentence, before the quota and rate-limit text checks (which would otherwise catch the word limit); page.tsx gains one entry in quotaRateLimitCopies and nothing else.
- frontend Team page: collaborationFailureReason maps only that exact sentence in the hand-off failure line; any other reason is shown unchanged; data-testid values unchanged.
- Messages: ai.providerUsageLimit and collaboration.providerUsageLimit in en, zh-TW and zh-CN. en: The AI provider's usage limit has been reached, so runs can't start. They start again once an admin raises the limit. zh-TW: AI 供應商的用量上限已達到，所以無法開始執行。管理員提高上限後，執行就會再次開始。 zh-CN: AI 供应商的用量上限已达到，所以无法开始运行。管理员提高上限后，运行就会再次开始。
- Accepted departure: the Team page labels are built in collaboration-page.tsx, outside the write set, so the view picks the locale from its back link (/en, /zh-TW, /zh-CN) and reads the copy from the message files that lib/collaboration/logic.ts imports. Importing the message files directly follows the existing pattern (lib/recovery-copy.ts, workspace-shell.tsx, page.tsx). The fixed sentence is declared in the adapter and again in the frontend logic, with a comment tying them together.
- Observation, no change: the adapter log for this one error no longer carries the provider's reset date; the fixed sentence is enough to identify the cause, and the date is shown in the provider console.
- Not changed: the worker, the gateway, guards, entities, migrations, packages.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service npm test | 47 suites passed; 1123 passed, 1 skipped (baseline KNOW-02: 47 suites, 1120 passed, 1 skipped) |
| ai-service npm run build | exit 0 |
| frontend npx tsc --noEmit | exit 0 |
| frontend npm test | 876 passed, 0 failed (baseline BIZ-01: 871) |
| frontend npm run build | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Diff review | 11 modified files, all in the write set; adapter tests check that no provider text, date or key appears in the exception or the log; real Chinese translations |

Evidence in `C:/Users/knlee/aisb-preflight/PROVIDER-LIMIT-MSG-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2381 | `88c6c89682b6d962752897faf5963ff5b0e7c742cf6ee877dc34afb90a1c3d8f` |
| `brief-impl.txt` | 11199 | `67b7b98f1c7c3c62840a545e60797147f14af6612574a29c615acd85ff5cebef` |
| `cursor-admit-result.json` | 3361 | `6f4f10b12f1fb4432232633f7dd0a4c0f5313b1a9fe506a11c8d7aae8012d9ed` |
| `cursor-impl-result.json` | 7937 | `ff7c20fdedfdb384fcbb71cd16656d7b273b236f08d4bf746e8630f710035260` |
| `reviewer-gates.out` | 393 | `b6c7eb55481914c94db38c39fec41f50523e064172f7c652b8280702631b2598` |

## Acceptance criteria

All six met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: tsconfig.tsbuildinfo restored), UI 9/9 (3: no icons; 4: Impeccable, Emil Kowalski and DESIGN.md read, nothing applied because the copy lands in existing message slots with no visual change; 5: DESIGN.md followed, no visual change; 6: the only new state is this failure text, translated and tested; 7: the ai-service change is the admitted scope; 9: no live check, the message appears only when the provider refuses, covered by tests), BACKEND 6/6 (1 and 2: no guard, auth or internal route change; 3: no generated-app template touched; 4: no frozen contract changed, the fixed sentence is a new contract between ai-service and the frontend; 5: n/a, no entity or schema change; 6: gates compared with KNOW-02 and BIZ-01 above)

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered: STAGING-DEPLOY-12, deploy during the tester window, OPTIONAL as the control-plane default; Keith may change it)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; AI-SERVICE, FRONTEND and I18N released UNOWNED. Not deployed; staging runs e5cc286.
