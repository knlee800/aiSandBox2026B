# PRIVACY-INVENTORY-01 — Checkpoint

**Task:** PRIVACY-INVENTORY-01 — Privacy data inventory (read-only)
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** CORE. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** plan row 46. Keith chose the data inventory first on 2026-11-12 ("4 inventory first").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and activation | Lane 1, no mutex (a new document only); one record | d830f84 |
| 2. Implementation | fable subagent in worktree lane/PRIVACY-INVENTORY-01, fast-forwarded. Fable was chosen for a planning document read across every service; the worker reported its environment as Fable 5.2, while the routing table names Fable 5.1 | 8ac1ddd |
| 3. Consolidation and LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Result

`docs/PRIVACY-DATA-INVENTORY.md`, 323 lines, LF. Every row cites a file and line. It covers:
- what is stored and where;
- who can read it;
- what leaves our servers;
- retention today;
- 22 gaps;
- 27 open questions for the host or Keith.

No code changed.

**Main findings**
- **User content is stored as plain text:** chats, knowledge, agent and workflow definitions, hand-off prompts with diffs, workspaces and snapshots. Only passwords, sign-in tokens and API keys are hashed, and connector secrets use AES-256-GCM.
- **Nothing is deleted over time.**
  - There is no account, chat or project deletion, and no retention timer.
  - Deleting a session keeps the workspace, its git history and the snapshots.
  - Knowledge and workflow deletes are soft deletes.
- **The usage ledger keeps AI answer text** in `usage_records.metadata`, although the entity comment says it stores no content.
- **Failed AI jobs stay in Redis** with the prompt, files and the connector grant token, with no expiry.
- **Five AI providers can receive user data.** OpenAI and xAI Agent runs use `store: true` and `previous_response_id`. All runs are off unless `GLOBAL_EXECUTION_ENABLED` is true.
- **Email, sign-in providers and payments are off or gated.** No analytics or error tracking was found.
- **Staff, database and internal-key reads leave no audit record.**
- **Backups hold everything.** The encrypted off-host bundles are never pruned by the script.
- **Generated-app previews run on the platform origin, with no sandbox.** See the security note below.

## Control-plane checks (the self-report was not accepted)

| Claim | Checked against | Result |
|---|---|---|
| The ledger stores AI answer text | `services/ai-service/src/worker/worker.processor.ts:2274-2284`; entity comment `services/api-gateway/src/entities/usage-record.entity.ts:24` | matches |
| Failed jobs are kept | `services/api-gateway/src/queue/queue.service.ts:42-43` (`removeOnComplete: true`, `removeOnFail: false`) | matches |
| OpenAI keeps the conversation | `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts:220, 237-238` (`store: true`, `previous_response_id`) | matches |
| The preview iframe has no sandbox | `frontend/components/workspace/workspace-shell.tsx:5186-5193` | matches |
| The proxy adds no CSP sandbox header | `services/api-gateway/src/preview/preview-response-headers.ts` | matches: only hop-by-hop and re-encoded headers are filtered |
| `/driver` keeps an API key in localStorage | `frontend/app/[locale]/driver/page.tsx` | the file uses localStorage, as the document cites |
| No secret values in the document | pattern search for key, private-key and password text | 0 |

**Security note.** The preview loads `/api/preview/<session>/proxy` from the platform's own origin, with no sandbox. So script in a generated app runs as the platform origin. It can:
- call platform APIs with the user's session cookie;
- read the non-httpOnly `aisandbox_csrf` cookie;
- read localStorage.

Generated code is written by AI and can carry injected instructions. This is registered as PREVIEW-ORIGIN-01, a 4-step security task. It is recommended before any user other than Keith.

## Limits

- **The running staging host was not checked.** The host questions are PRIVACY-HOST-CHECK-01.
- **Not checked:** provider terms and the law (Keith, and a lawyer later), a full log audit, tests, `e2e/`, `monitoring/` and legacy root files.

CHECKLIST: EVERY 11/11 (3: fable named with the reason, the worker's reported version recorded; 4: self-contained brief, no further subagents; 5: one new document, the write set; 6 and 7: n/a, no behavior change and no code gates; 8: no runtime; 9: n/a, no build; 10: worker committed only on its branch, fast-forwarded by the control plane with autocrlf=false; 11: follow-ups disposed below)
FOLLOWUPS: 2 registered (PREVIEW-ORIGIN-01; PRIVACY-HOST-CHECK-01) / 6 superseded (the usage-ledger record correction, failed jobs in Redis, unpruned encrypted backups, deletion blockers in foreign keys, the old ai-service SQLite conversation store, and the differing backup-policy document, all by ACCESS-READY-01 data retention) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- no mutex was held;
- no code change and no deploy.
