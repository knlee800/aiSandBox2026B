# CONN-MAIL-READ-01 — Checkpoint

**Task:** CONN-MAIL-READ-01 — An agent mail tool that reads one message by its number
**Status:** COMPLETE AND LOCKED — 2026-11-18. Built; not deployed (next STAGING-DEPLOY-MREAD-01, then MAIL-READ-LIVE-01, which Keith approves).
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **Mutexes:** GATEWAY, AI-SERVICE; HOTFILE leases on five connectors-mcp files.
**Source:** registered 2026-11-16 by the TRIGGER-MAIL-01 LOCK (stage-start D7, F2). Keith asked the control plane to pick ("You pick one") on 2026-11-18 and chose the grant model ("With the mail grant").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with GATEWAY, AI-SERVICE and five HOTFILE leases; exact write set of 31 paths; design D1 to D4 | da23255 |
| 1b. Widening | collaboration-workflow.spec.ts added (32 paths): two tests pin a workflow job's connectorGrants; expected values only | 676c032 |
| 2. Implementation | opus subagent (Opus 5.5: three services, the connector child process and the grant token) in worktree lane/CONN-MAIL-READ-01; one stop for the widening; cherry-picked to main | 2f3c32f (branch 280d63e) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Why

A mail-triggered run is told "In your mail tool the message has id N", but the agent's mail tool lists only the 25 newest unread messages. If the owner opens the message, or 25 newer unread arrive first, the run cannot find it.

## What changed

**connectors-mcp:** a fifth tool, `mail_read_message`, takes `messageId` (the decimal UID the unread tool returns) and the gateway-added mailbox fields.
- It opens the Inbox read-only (EXAMINE) and sends one `UID FETCH <uid> (UID BODYSTRUCTURE ENVELOPE)`, then the same partial `BODY.PEEK` of the same text part as the unread tool. No SEARCH is sent, so a read message is found; nothing changes flags.
- It answers `{ message }` with exactly the unread tool's fields (id, from, toCount, subject, date, bodyText of at most 800 characters, bodyTruncated), under the same cap, with the password and username redacted from errors.
- An unknown UID answers the fixed `No Inbox message has that id.`; a malformed id is refused before any socket opens.
- The four existing tools are unchanged.

**Gateway (connectors):** `MAIL_READ_TOOL` (kind imap, readOnly) is a companion tool.
- A private map `CONNECTOR_COMPANION_TOOLS` (mail_list_unread_metadata → mail_read_message) with `findCompanionTool`, `companionParentToolId`, `findGrantableTool` and `withCompanionToolIds`.
- `findAllowlistedTool`, `connectorToolCatalog`, `CONNECTOR_SERVERS` and `toolForKind` are unchanged, so the picker, saved workflows (`allowlistedConnectorToolIds`, `userWorkflowGrants`), `connectorToolIdsAreReadOnly` and the system agents never see the tool. No file outside the write set changed for this.
- `resolveConnectorGrantJobFields` passes the role's allowlisted, connected tools through `withCompanionToolIds`: a job granted the unread tool also gets `mail_read_message` in `connectorGrants` and in the signed token; a companion in a role list is ignored.
- The grant token keeps the companion only beside its parent and refuses a signed token that lists it alone.
- The broker takes exactly `{ messageId }` matching `^[1-9][0-9]{0,9}$` and at most 4294967295 (else the fixed 400). The tool is not required from the child at start-up (an older child keeps mail and calendar working); a call to a child that does not list it gets the fixed 503. Only the child's exact not-found text becomes a 404 with that text; every other child error keeps the fixed 502. Audit rows name the tool and carry counts only.
- The internal route's guard and grant check are unchanged (a comment only).

**AI service:** a definition "Read one mail message" after the unread tool in `CONNECTOR_TOOL_IDS`, the id in the `AgentHarnessToolIdV1` union, and the handler passing on only the exact 404 not-found text for this tool. `worker/connector-grants.ts` and `worker.processor.ts` needed no change (they loop over the granted ids).

**Briefing eval:** the runner answers `mail_read_message` from the case's mail fixture by id (unknown id: the not-found text; malformed: the fixed failure). On the mail-trigger profile only, the tool is allowed and satisfies the mail requirement (`requiredToolAlternatives`, approved by the control plane at the stop); every other profile is unchanged. The proof that existing cases are unaffected: for all 30 saved baseline tasks in the three baseline files the tool verdicts rescore the same (none called the new tool), and each of the 12 cases keeps its profile apart from the approved mail-trigger addition. A full text rescore of saved baselines is not possible because their `finalAnswer` is stored cut at 1000 characters.

**Unchanged:** the mail trigger's task text, the Chief of Staff's instructions and version hash, the eval baselines, the frontend and message files, migrations, and the frozen contract HARNESS_ENTITLEMENT_PROOF_V1 and its files.

## Control-plane review and gates

**What the control plane read:** the full diffs of connector-servers.ts, connector-grant-token.ts, collaboration-connector-grants.ts, connector-broker.ts, internal-connectors.controller.ts, collaboration-workflow.spec.ts (two expected lists and one loop row), limits.ts, tools/mail-read.ts, the imap-client.ts addition, connector-tool-handlers.ts, briefing-score.ts, briefing-prompt.ts and briefing-runner.ts; the 30 changed paths against the 32-path write set (none outside); every committed blob and file (no CR).

| Gate (on the branch, by the control plane) | Baseline (worker, on da23255) | Result |
|---|---|---|
| connectors-mcp jest | 103 of 103 | 145 of 145 |
| connectors-mcp build | rc 0 | rc 0 |
| gateway `tsc --noEmit` | rc 0 | rc 0 |
| gateway tests (`--maxWorkers=2`) | 6559 passed, 7 skipped, 14 known failures | 6590 passed, 7 skipped, 14 failed, all in `smoke.integration.spec.ts` (they need a database) |
| gateway build | rc 0 | rc 0 |
| ai-service tests | 1429 passed, 1 skipped | 1441 passed, 1 skipped |
| ai-service build | rc 0 | rc 0 |

**After the merge:** main had moved by one records commit (676c032), so the branch commit was cherry-picked (2f3c32f). The services tree on main is identical to the gated branch tree; only records differ.

**Reported:**
- **One stop.** The worker stopped on collaboration-workflow.spec.ts, outside the write set, rather than work around it. The control plane widened the write set (676c032) for those expected values only, and answered the open points: the listed-tools choice, the 404 mapping, string-only ids, and the mail-trigger scoring rule.
- **One scripted edit.** An early test edit was made with a Python script instead of the Edit tool; the diff was checked.
- **No permission was denied** to the worker.

**Live only (what tests cannot prove):** a real IMAP server (Gmail, Yahoo or iCloud) answering EXAMINE, UID FETCH and BODY.PEEK for an already-read message and leaving it read; a real mail-triggered run where the model calls `mail_read_message` with the trigger's id through a grant minted on staging; whether the model sends `messageId` as text (the gateway refuses a number).

## Follow-ups

| Follow-up | Disposition |
|---|---|
| Deploy (no migration, no env change) | registered STAGING-DEPLOY-MREAD-01 |
| Live check of the read path and a mail-triggered run | registered MAIL-READ-LIVE-01 |
| Worker: the model may send messageId as a number, which the gateway refuses | superseded by MAIL-READ-LIVE-01 (its check records the argument form the model sends; a refusal is a finding) |
| Worker: the mail trigger's text still says "your mail tool" | superseded by MAIL-READ-LIVE-01 (its check records which tool the run uses; a text change is registered only if the run fails to read the message) |

CHECKLIST: EVERY 11/11 (1: admitted da23255, widened 676c032; 2: 3-step, the design follows CONN-03's read path and Keith made the one product choice; 3: opus named with its reason before dispatch; 4: self-contained brief, no further subagents; 5: 30 of the 32 approved paths, no dependency; 6: tests for AC1 to AC3; 7: gates rerun by the control plane on the branch; 8: no runtime started; 9: no tracked build artifact changed; 10: worktree, junctions, cherry-pick and branch removal by the control plane; 11: FOLLOWUPS line), BACKEND 6/6 (1: auth, cookies, CSRF, internal keys and guards unchanged, the internal route keeps its guard and grant check; 2: internal endpoints unchanged and unreachable from the frontend; 3: no generated-app template touched; 4: HARNESS_ENTITLEMENT_PROOF_V1 and its files unchanged; 5: no entity or schema change; 6: gateway failures are only the 14 known smoke.integration ones)
FOLLOWUPS: 2 registered (STAGING-DEPLOY-MREAD-01, MAIL-READ-LIVE-01) / 2 superseded (the numeric messageId and the trigger text, by MAIL-READ-LIVE-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY, AI-SERVICE and the five HOTFILE leases released UNOWNED;
- both lanes are now empty;
- nothing deployed: staging runs e759b9c.
