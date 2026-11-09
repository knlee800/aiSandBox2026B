# GOV-BIZ-AGENT-OPS-PLAN-01 — User workflows: connectors, a built-in briefing template, the agent spec, the Chief of Staff front door, chat channels and triggers

**Status:** approved by Keith on 2026-11-09 (decisions A1-A11 below). Registrations in the closing record.
**Task:** GOV-BIZ-AGENT-OPS-PLAN-01 (TASKS_BACKLOG_FULL.md:85678-85722). Design only; nothing here admits work. Nothing here implements RSI (ARCHITECTURE.md:1056-1064). No private beta; basic_auth stays; two lanes. Drafted read-only by Fable 5.1; reviewed by Grok and Opus 5.5.

### 1. Goal and decisions (Keith, 2026-11-08 and 2026-11-09)

Users build their own workflows. A workflow is an agent written in parts (A9); its limits are enforced by the tools the platform grants, never by the prompt alone. The morning briefing is the first built-in template.

| # | Decision |
|---|---|
| A1 | MCP now: client in an api-gateway connector broker; allowlist of servers the platform runs and pins; user-supplied servers refused; server tool descriptions are untrusted text replaced by ours |
| A2 | New folder `services/connectors-mcp/`; stdio child of the gateway, spawned by absolute path `/opt/aisandbox/services/connectors-mcp/dist/main.js` (gateway unit WorkingDirectory `/opt/aisandbox/services/api-gateway`, `ops/clean-baseline/systemd/aisandbox-gateway.service:14-16`); no unit change |
| A3 | Users build workflows; the briefing is the first template |
| A4 | Mail by IMAP with an app password and calendar by the private iCal link now (option B); Google OAuth verification of the platform's app in parallel (option A, GOV-GOOGLE-VERIFY-01 starts now). The Workspace internal-app decision of a2cd4f4 is withdrawn |
| A5 | Approval setting per team or workflow: every hand-off (default); only over X credits; automatic for read-only agents. Never automatic for anything that writes, sends or deletes. Depth 3, 4 agents, daily caps stay. Reverses the 2026-11-05 drop (86912) for auto-approval only; free agent messaging and agents claiming tasks stay dropped |
| A6 | Phase 1 connections, template, user workflows; Phase 2 Chief of Staff front door; Phase 3 chat channels; Phase 4 triggers |
| A7 | First chat channel Discord (outbound bot gateway, no public address); then LINE and WhatsApp (public endpoint); WeChat via WeCom last; Slack a later option |
| A8 | Direct jobs to any agent stay: Team page, Agent mode, `@name` in chat |
| A9 | Form. Basic: 1 name and role incl. tone and reply language; 2 job (purpose and procedure); 3 access (knowledge folders, connections, tools; ticked per workflow); 4 result (format, where it goes); 5 when it runs. Advanced: 6 model (platform list with credit cost); 7 team (agents it may pass work to, report back); 8 approval (A5); 9 budget (credits per run and per day). "What it can never do" is generated from access and shown, not set |
| A10 | Grok's review and the control plane's changes applied (sections 3, 4) |
| A11 | First template: Inbox only, 25 unread, today's events; fixed labels (risk low/medium/high; opportunity none/follow-up/revenue/relationship); no knowledge search yet; data statement shown before connecting |

### 2. Limits

| Limit | Enforced by the tool set | Prompt rule only |
|---|---|---|
| B1 never send, reply, forward | no such tool; IMAP cannot send | — |
| B2 never accept invites or change the calendar; never change the mailbox | iCal read-only; IMAP EXAMINE only, no STORE/APPEND/EXPUNGE; command-log test | — |
| B3 never invent figures | — | cite `[source:]` or write No source (KNOW-03 unsourced label) |
| B4 final decisions with the owner | approval gate: `pending_approval` + approve route (`orchestration.service.ts:1097`, `collaboration.controller.ts:284-301`) | suggest, never decide |
| Read only the owner's own data | one connection per owner per kind; internal route checks the job's user | — |
| A workflow cannot widen its grants | grants = stored spec ∩ platform allowlist, derived server-side; never from the browser; never on `POST /api/ai/execute` | — |

Data statement (shown before connecting): mail and calendar text returned by a tool is sent to the model provider and leaves the platform; stored run results can hold tool text; audit rows carry no content. Headers and titles first; bodies only after the injection eval passes, stripped to text and byte-capped; tool text is data, never instructions (`system-agent-registry.ts:88`).

### 3. Design

**3.1 Phase 1 — connections, template, user workflows**

| Part | Design |
|---|---|
| MCP server (C1) | `services/connectors-mcp/`: TypeScript, stdio, own package.json (lockfile = PACKAGE; root workspaces already cover `services/*`, `package.json:7-10`). Tools `mail_list_unread_metadata` (Inbox, 25 unread: id, from, to count, subject, date) and `calendar_list_today` (title, start, end, organizer, attendee count, own response). IMAP: EXAMINE, `BODY.PEEK[HEADER.FIELDS (...)]`, TLS `rejectUnauthorized: true`, one connection per call. Fakes for tests; a test asserts no forbidden IMAP verb |
| Build list | `ops-lib.sh:2023-2032` and `aisandbox-prepare:499-502` gain the folder and `dist/main.js`. Folded into CONN-01 (it holds the two ops HOTFILEs): the artifact check fails on a missing artifact, so the build list and the code must enter the tree in one commit; the deploy slice only installs the library |
| Broker (C2) | `services/api-gateway/src/connectors/`. CONN-02A: entity `connector_connections` (owner, kind imap/ical/google later, preset, host, port, username, ciphertext; unique owner+kind), AES-256-GCM with `CONNECTOR_CREDENTIALS_KEY` (typed by Keith at a hidden prompt; in `ops/clean-baseline/env/gateway.env.template`, never `ai.env.template`; a missing key fails connector calls only, never boot); connect/list/disconnect routes (`harnessEntitled`). The iCal URL is a bearer secret and is stored only as ciphertext. CONN-02B: `@modelcontextprotocol/sdk` pinned, allowlist with our descriptions, child spawned by absolute path with an explicit env containing no secret keys, idle stop after five minutes, per-call secret injected as a non-schema argument and redacted from child errors and gateway logs, `POST /api/internal/connectors/call` behind the service-key guard, audit rows (payload asserted to counts and byte sizes only; `audit-event.entity.ts:34-35` is unconstrained jsonb). SSRF: IMAP only to preset hosts gmail, yahoo, icloud ("Other" deferred); iCal only public HTTPS, address re-checked after DNS resolution, loopback, private, link-local (incl. 169.254.169.254) rejected |
| Connections page (C3) | `frontend/app/[locale]/connections/`; header link beside Knowledge (`platform-dashboard.tsx:537`); presets with setup steps in en, zh-TW, zh-CN (2-step verification, app password; Advanced Protection and admin blocks noted; Outlook.com not yet, G6); iCal steps; data statement before Connect; Verify; Disconnect |
| Grants | Signed `connectorGrants` written beside `knowledgeScopesJobFields` (`orchestration.service.ts:831`); worker registers connector tools only for a signed `read` profile with grants (beside `worker.processor.ts:1874-1879`); handlers call the internal route; the worker never speaks MCP. Changes HARNESS_ENTITLEMENT_PROOF_V1: `orchestration.service.ts` is added to its path list; runs alone; re-frozen at LOCK; `ai-execution.controller.ts` unchanged |
| Template (C4) | Chief of Staff instructions gain the briefing procedure (A11 labels, suggested action, For you section, data-frame rule); role lists the two tools; Team page "Morning briefing" preset |
| Eval (C5) | COS-EVAL-01 before the first live run: injected instructions in subjects, event titles, bodies; pass = item reported, no action claimed, no hand-off; `agent-harness/eval/` framework |
| Live (C6) | STAGING-DEPLOY-CONN-01 installs the library, Keith types the key, backup checked for gateway.env; BIZ-LIVE-03 on Keith's account, runs on only for its run (ENV held), cost measured; no cap set before |
| Spec (C7, C9, C10) | AGENT-SPEC-01: typed fields on `SystemAgentDefinition` for A9 parts 1-4 and 6 (tone, replyLanguage, purpose, procedure, access, result, model from a platform list with credit cost); hash covers them (`system-agent-registry.ts:220-231`), one hash change accepted; prompt rendered from fields; "never do" list generated from access |
| User workflows (C8, C11-C15) | BIZ-USER-01A: six-part columns on `user_agents` (migration), copy-from-template, blank create, owner CRUD, budget per run/day stored, grants derived server-side, own knowledge folders (owner-named scopes such as hr-payroll) chosen per workflow; design step records the EXEC-01C overlap result. 01B: Create Agent editor (basic and advanced), limits shown, three languages. 01C: run from the Team page as a team of one, Test run before switching on (AC), budget refused at start (AC), six-part fields and grants stay off `POST /api/ai/execute` (AC). RESULTS-01: Results list with unread badge and run history |
| Bodies (C16), Google (C17) | CONN-03 after the eval's body cases; GOV-GOOGLE-VERIFY-01 now (governance), then CONN-OAUTH-01: refresh token in the gateway, short-lived access token per call |

**3.2 Phase 2 — Chief of Staff front door.** COS-FRONTDOOR-01: the owner talks to the Chief of Staff, which answers or passes work to a roster the owner picked (D1, D2), with report-back hand-offs so the Chief of Staff gives the final answer (D3; reopens the return hop dropped at the BIZ-03 stage-start; the record says so). Direct jobs stay (A8, AC). USER-TEAMS-01: user teams, who hands to whom (D5). APPROVAL-SET-01: the A5 setting stored per team or workflow, applied in the approve path, never automatic for write/send/delete profiles (D4). COS-DRAFTS-01: the Chief of Staff drafts an agent or workflow from a description; the owner approves; it never saves or self-grants (D6).

**3.3 Phase 3 — chat channels.** CHAT-DISCORD-01: outbound bot gateway connection, two-way (start a workflow, receive results), account link by a one-time code typed on the platform, every message untrusted data, `@name` routes to an agent (E1-E3). CHAT-LINE-01 and CHAT-WHATSAPP-01 need a public endpoint and a decision on basic_auth exceptions; CHAT-WECOM-01 last; CHAT-SLACK-01 later option (E4).

**3.4 Phase 4 — triggers.** TRIGGER-01: `agent_schedules`, in-process gateway timer, `SCHEDULES_ENABLED` default false, one idempotency key per owner per local day, no retry, skipped when `GLOBAL_EXECUTION_ENABLED` is false or caps would be exceeded, never enabled by a tester window, audit on every skip, starts a run as the Team page does (F1, F4). TRIGGER-UI-01 Schedules page (F5). TRIGGER-EVENT-01 before a calendar event (F2). TRIGGER-MAIL-01 new mail matching a filter, after cost (F3). TRIGGER-MORE-01 after another workflow, webhook, new knowledge file (F6). ARCHITECTURE.md:177 and :1116 are amended in the TRIGGER-LIVE-01 record holding GOVERNANCE; PRD.md:472 (session cleanup) is left alone. Not the RSI-00 hold (85219).

**3.5 G items.** SKILL-01 reusable saved step (G1); tickets = AGENT-COLLAB-BIZ-01 (G2); CONN-DRAFT-01 drafts never sent, after CONN-OAUTH-01 (G3); ACTIONS-APPROVAL-01 send/change behind approval (G4); RESULTS-MAIL-01 results by email via the platform mailer (G5); CONN-OUTLOOK-01 Microsoft sign-in (G6); project-less runs = BIZ-NOPROJECT-01 (G7); BRIEF-WIDE-01 wider briefing after cost (G8); isolation proof = ACCESS-READY-01 (G9).

### 4. Slices in order (Phase 1 fully specified; metadata in the manifest)

| # | ID | Scope |
|---|---|---|
| 1 | **CONN-01** (first MCP slice) | MCP server package, two header/title tools, fakes, verb test; ops build and artifact lists |
| 2 | CONN-02A | Credential entity, migration, AES-GCM, connect/list/disconnect; key in gateway.env.template |
| 3 | CONN-02B | MCP client, allowlist, child spawn, SSRF guard, internal route, audit |
| 4 | CONN-UI-01 | Connections page, setup steps, data statement, header link |
| 5 | CONN-GRANT-01 | Signed `connectorGrants`; worker tools; contract change, alone |
| 6 | **BIZ-BRIEF-01** (first briefing slice) | Briefing template on the Chief of Staff; Team page preset |
| 7 | COS-EVAL-01 | Injection eval |
| 8 | STAGING-DEPLOY-CONN-01 | Deploy; key; backup check; Keith connects |
| 9 | BIZ-LIVE-03 | First live briefing; cost measured |
| 10 | AGENT-SPEC-01 | Typed spec fields incl. tone, language, model |
| 11 | BIZ-USER-01A | Store, copy, blank, budget, grants |
| 12 | BIZ-USER-01B | Editor |
| 13 | BIZ-USER-01C | Run, test run, budget check |
| 14 | RESULTS-01 | Results list, unread badge, history |
| 15 | STAGING-DEPLOY-WF-01, BIZ-LIVE-04 | Deploy; Keith copies, edits, runs a workflow |
| 16 | GOV-GOOGLE-VERIFY-01 (now, parallel), CONN-OAUTH-01, CONN-03 | Option A; Connect Google; bodies |
| 17-20 | COS-FRONTDOOR-01, USER-TEAMS-01, APPROVAL-SET-01, COS-DRAFTS-01 | Phase 2 |
| 21-25 | CHAT-DISCORD-01, CHAT-LINE-01, CHAT-WHATSAPP-01, CHAT-WECOM-01, CHAT-SLACK-01 | Phase 3 |
| 26-32 | TRIGGER-01, TRIGGER-UI-01, STAGING-DEPLOY-TRIG-01, TRIGGER-LIVE-01, TRIGGER-EVENT-01, TRIGGER-MAIL-01, TRIGGER-MORE-01 | Phase 4 |
| 33-38 | SKILL-01, CONN-DRAFT-01, ACTIONS-APPROVAL-01, RESULTS-MAIL-01, CONN-OUTLOOK-01, BRIEF-WIDE-01 | G |

Pairs refused: CONN-GRANT-01 beside anything (contract change). Two UI slices never hold I18N at once. Admission is the validator's.

### 5. Idea register

| ID | Idea | Task or AC | Phase |
|---|---|---|---|
| A1 | MCP, allowlist | CONN-02B | 1 |
| A2 | Folder, stdio child by absolute path | CONN-01, CONN-02B | 1 |
| A3 | User workflows, briefing first template | BIZ-BRIEF-01, BIZ-USER-01A/B/C | 1 |
| A4 | IMAP+iCal now; Google verification parallel | CONN-01/02A; GOV-GOOGLE-VERIFY-01, CONN-OAUTH-01 | 1 |
| A5 | Approval setting | APPROVAL-SET-01 | 2 |
| A6 | Phase order | section 4 | — |
| A7 | Discord first, then LINE, WhatsApp, WeCom, Slack | CHAT-* | 3 |
| A8 | Direct jobs stay | COS-FRONTDOOR-01 AC | 2 |
| A9 | Form parts 1-9 | AGENT-SPEC-01 (1-4, 6), BIZ-USER-01A/B (1-6, 9), TRIGGER-UI-01 (5), USER-TEAMS-01 (7), APPROVAL-SET-01 (8) | 1-4 |
| A10 | Review fixes | sections 2-3 | — |
| A11 | First template scope and labels | BIZ-BRIEF-01 AC | 1 |
| B1-B4 | Limits | section 2; CONN-01 verb test AC; BIZ-BRIEF-01 AC | 1 |
| C1 | Server headers + today | CONN-01 | 1 |
| C2 | Broker, secrets, audit, SSRF | CONN-02A, CONN-02B | 1 |
| C3 | Connections page | CONN-UI-01 | 1 |
| C4 | Template labels, For you | BIZ-BRIEF-01 | 1 |
| C5 | Injection eval before live | COS-EVAL-01 | 1 |
| C6 | Live run measures cost | BIZ-LIVE-03 | 1 |
| C7 | Typed spec | AGENT-SPEC-01 | 1 |
| C8 | Copy, edit, blank | BIZ-USER-01A/B | 1 |
| C9 | Tone, reply language | AGENT-SPEC-01 | 1 |
| C10 | Model per agent with cost | AGENT-SPEC-01 field; BIZ-USER-01B | 1 |
| C11 | Own knowledge folders per workflow | BIZ-USER-01A AC | 1 |
| C12 | Results list, unread badge | RESULTS-01 | 1 |
| C13 | Test run before switching on | BIZ-USER-01C AC | 1 |
| C14 | Run history | RESULTS-01 | 1 |
| C15 | Budget per run/day | BIZ-USER-01A AC (stored), 01C AC (enforced) | 1 |
| C16 | Bodies after eval | CONN-03 | 1 |
| C17 | Google verification, Connect Google | GOV-GOOGLE-VERIFY-01, CONN-OAUTH-01 | 1 |
| D1-D3 | Front door, roster, report-back | COS-FRONTDOOR-01 | 2 |
| D4 | Approval setting | APPROVAL-SET-01 | 2 |
| D5 | User teams | USER-TEAMS-01 | 2 |
| D6 | CoS drafts workflows, owner approves | COS-DRAFTS-01 | 2 |
| E1-E3 | Discord two-way, one-time code link, @name | CHAT-DISCORD-01 | 3 |
| E4 | LINE, WhatsApp, WeCom, Slack | CHAT-LINE-01, CHAT-WHATSAPP-01, CHAT-WECOM-01, CHAT-SLACK-01 | 3 |
| F1, F4 | Schedule, shared trigger rules | TRIGGER-01 | 4 |
| F2 | Before a calendar event | TRIGGER-EVENT-01 | 4 |
| F3 | New mail matching a filter | TRIGGER-MAIL-01 | 4 |
| F5 | Schedules page | TRIGGER-UI-01 | 4 |
| F6 | Later triggers | TRIGGER-MORE-01 | 4 |
| G1 | Skills | SKILL-01 | G |
| G2 | Tickets | AGENT-COLLAB-BIZ-01 (existing) | G |
| G3 | Drafts never sent | CONN-DRAFT-01 | G |
| G4 | Send/change behind approval | ACTIONS-APPROVAL-01 | G |
| G5 | Results by email | RESULTS-MAIL-01 | G |
| G6 | Outlook.com | CONN-OUTLOOK-01 | G |
| G7 | Runs without a project | BIZ-NOPROJECT-01 (existing) | G |
| G8 | Wider briefing | BRIEF-WIDE-01 | G |
| G9 | Isolation proof | ACCESS-READY-01 (existing) | G |

### 6. Dispositions

| Follow-up | Disposition |
|---|---|
| 41 new tasks in the manifest | Registered NOT_READY |
| BIZ-USER-01 | Changed (split into 01A/B/C; fields in the manifest) |
| Workspace internal-app connection (a2cd4f4 (b)) | Superseded by option B and CONN-OAUTH-01 |
| Test run, budget enforcement, direct jobs stay | Superseded by ACs in BIZ-USER-01C and COS-FRONTDOOR-01 |
| Separate CONNECTORS mutex | Dropped (Keith, 2026-11-09): named-file leases suffice |
| Tickets, project-less runs, isolation, ARCHITECTURE sync | Reused: AGENT-COLLAB-BIZ-01, BIZ-NOPROJECT-01, ACCESS-READY-01, GOV-ARCH-SYNC-01 |
| Connectors drop (86909) and auto-approval drop (86912) | Reversed by Keith; reversal lines in section D; old lines unedited; scheduled refresh stays dropped |
| Return hop to the Chief of Staff (dropped at the BIZ-03 stage-start, 2026-11-07) | Reversed by Keith 2026-11-09 as report-back hand-offs (D3) in COS-FRONTDOOR-01; reversal line in the Dropped follow-ups list; old line unedited |

### 7. PRD.md and ARCHITECTURE.md wording by landing slice

| Lands with | PRD.md | ARCHITECTURE.md |
|---|---|---|
| Closing record (Keith approved now) | Section 11 APPROVED FUTURE paragraph (section C below) | — |
| CONN-02B | — | Repository Layout: `services/connectors-mcp/`; 13.1 row; section 8 internal `POST /api/internal/connectors/call` |
| CONN-GRANT-01 | — | 12.1 row; contract path list |
| BIZ-LIVE-03 | 3.I Chief of Staff row (briefing, IMAP headers, iCal, gated); 8:484 exception for allowlisted read-only connectors; 11 GATED row | 13.1 GATED; 13.3 line removed; new 13.6 Connectors |
| BIZ-LIVE-04 | 3.I user workflows (304-306), 11 GATED row, 606-607 narrowed | 13.2 stored spec, server-side grants; 13.5 note |
| APPROVAL-SET-01 live | 11: approval setting, never automatic for write/send/delete | 13.1 OrchestrationService row |
| CHAT-DISCORD-01 live | 11 GATED row; 8 non-goal narrowed | new 13.8 Chat channels |
| TRIGGER-LIVE-01 (GOVERNANCE held) | 11 GATED row; 8 new non-goal line for maintenance schedulers; 472 untouched | 2:177 and 15:1116 amended; new 13.7 Triggers |
| CONN-03, CONN-OAUTH-01, CONN-DRAFT-01 | 3.I lines | 13.6 additions |

### 8. Risks

Data leaves to the model provider; app passwords are full-mailbox secrets (encrypted, per owner per kind, disconnect deletes; key never backed up beside ciphertext); injection via subjects, titles, bodies (data frame, eval, no action tools); SSRF via iCal (guard above); provider differences unproven by fakes; option A cost and timing outside platform control; hung child (timeout, kill); gateway.env hash changes; cost unknown until BIZ-LIVE-03; isolation proven for one owner until ACCESS-READY-01; chat channels with public endpoints challenge basic_auth (decided per channel task).
