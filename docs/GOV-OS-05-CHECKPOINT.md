# GOV-OS-05 — Checkpoint

**Task:** GOV-OS-05 — Every named follow-up gets a disposition; one-time orphan cleanup
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP. No implementation lane.
**Source:** follow-ups named in plans and checkpoints never reached the registry, so they never surfaced when Keith asked what was next. Keith approved the draft on 2026-11-04 after a read-only Cursor review (grok-4.7-xhigh) and a Fable 5.1 review, and chose the dispositions below on 2026-11-05 ("Use corrected list").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Begin | Registration, GOVERNANCE held, Development OS mutation with both lanes empty | 16730ad06f3d0ae6a35f806d9387ed9166faa99b |
| Close | CLAUDE.md and AGENTS.md rules, board correction, registrations, this checkpoint, mutation ended | this record |

## What changed

- CLAUDE.md Project Governance Loop: every named follow-up gets one disposition (registered NOT_READY, superseded, or dropped by Keith) before the naming task's lifecycle ends; "Not registered" is not a disposition; closing records carry a FOLLOWUPS line; locked documents are not edited; "Do not register X" limits only that task's own write step unless Keith recorded X as PARKED or PROHIBITED.
- CLAUDE.md Next-Work Selection Protocol output: list READY tasks and NOT_READY tasks whose condition is met or is Keith's decision.
- CLAUDE.md Git / Operator Rules and AGENTS.md: implementation workers never commit, push, branch or create worktrees; the control plane commits and pushes only work Keith has authorized, after reading the diff and rerunning the gates.
- CLAUDE.md Model Routing: grok-4.7-high by default, grok-4.7-xhigh for hard work, always passed explicitly.
- TASKS.md: the "Frozen contracts" and "Current blockers" lines no longer state the 2026-08-23 private-beta GO as current (deferred by Keith on 2026-10-31, docs/GOV-HARNESS-RESET-01-DECISION.md); the stale OS-mutation header line is corrected.
- TASKS_BACKLOG_FULL.md: nine NOT_READY tasks registered and a Dropped follow-ups list added. The sidecar has the eight implementation tasks as candidates: status READY, startCondition NOT_READY, saturationClass OPTIONAL, PROVISIONAL with admissionUncertain true and an empty write set until admission.

## Not changed

Lane count, mutexes, the scheduler, admission rules, the validator, PRD.md, ARCHITECTURE.md, and every locked plan and checkpoint.

## Dispositions

FOLLOWUPS: 30 registered / 7 superseded / 2 dropped / 0 undisposed

### Registered (NOT_READY, not admitted)

| # | Follow-up | Named in | Registered as |
|---|---|---|---|
| 1 | Update the collaboration plan with what was built | AGENT-COLLAB-00 plan | GOV-COLLAB-PLAN-01 |
| 2 | Business-agent remainder of AGENT-COLLAB-01 to 04 | AGENT-COLLAB-00 plan | AGENT-COLLAB-BIZ-01 |
| 3 | AGENT-KNOWLEDGE-01 to 04 | AGENT-KNOWLEDGE-00 plan | AGENT-KNOWLEDGE-01 |
| 4 | RPG office | GOV-HARNESS-RESET-01 decision | RPG-OFFICE-01 |
| 5 | Charging and a real per-user limit | HARNESS-QUOTA-01 | ACCESS-READY-01 |
| 6 | Credits by model; every model selectable | HARNESS-PROVIDERS-01 | ACCESS-READY-01 |
| 7 | Global write flag | COLLAB-LIVE-06, COLLAB-LIVE-07 | ACCESS-READY-01 |
| 8 | Socket.IO room authentication | AUTH-OWNER-01 | ACCESS-READY-01 |
| 9 | previous_response_id keeps conversations at OpenAI and xAI | HARNESS-PROVIDERS-01 | ACCESS-READY-01 |
| 10 | npm test skips frontend/lib/ai | HARNESS-PROVIDERS-01 | HARNESS-FIXES-01 |
| 11 | xAI error wording | HARNESS-PROVIDERS-01 | HARNESS-FIXES-01 |
| 12 | 4096 plain output limit | HARNESS-PROVIDERS-01 | HARNESS-FIXES-01 |
| 13 | Unanswered malformed tool call | HARNESS-PROVIDERS-01 | HARNESS-FIXES-01 |
| 14 | Failed search returns no matches | 2026-11-05 check | HARNESS-FIXES-01 |
| 15 | Selector returns to a provider with no key | HARNESS-LIVE-06 | HARNESS-FIXES-01 |
| 16 | Prompt line against offering .env | HARNESS-DELETE-01 | HARNESS-FIXES-01 |
| 17 | Delete approval step | HARNESS-DELETE-01 | HARNESS-FIXES-01 |
| 18 | xAI, OpenAI and DeepSeek proven live | HARNESS-PROVIDERS-01, HARNESS-LIVE-06 | HARNESS-FIXES-01 |
| 19 | Reopening during a run overwrites files | HARNESS-LIVE-06, HARNESS-SAVE-01 | HARNESS-FIXES-01 |
| 20 | Interrupted Build answer wording | HARNESS-LIVE-06 | HARNESS-FIXES-01 |
| 21 | Raw HTTP detail; hardcoded History labels | SAVEPOINT-I18N-01 | BUILDER-POLISH-01 |
| 22 | "Model: ... unknown" hardcoded English | 2026-11-05 check | BUILDER-POLISH-01 |
| 23 | Preview start 400 while starting | CLEAN-BASELINE-DEPLOY-01 | BUILDER-POLISH-01 |
| 24 | Preview polling of a stopped session | CLEAN-BASELINE-DEPLOY-01 | BUILDER-POLISH-01 |
| 25 | Checkpoint history bundle pruning | CLEAN-BASELINE-DEPLOY-01 | BUILDER-POLISH-01 |
| 26 | Preview refresh UX, framework previews, mobile, apex routing | readiness plans | BUILDER-POLISH-01 |
| 27 | Keith's UI list (overlapping buttons) | HARNESS-LIVE-06 | BUILDER-POLISH-01 |
| 28 | execution_duration_ms never written | USAGE-MODEL-01 | USAGE-DATA-01 |
| 29 | Quota and billing readers of SQLite data | CM-QUOTA-DEAD-01 | USAGE-DATA-01 |
| 30 | Frontend platform test coverage | harness reviews | FE-TEST-COVERAGE-01 |

### Superseded

| # | Follow-up | Done by |
|---|---|---|
| 1 | Continuous evals (AGENT-HARNESS-00 part 7; its ID AGENT-HARNESS-07 went to other work) | HARNESS-EVAL-01, HARNESS-EVAL-LIVE-01 |
| 2 | Stream and cancel ownership, chat-messages, guard letter case, public execute | AUTH-GUARD-01, AUTH-OWNER-01 |
| 3 | Empty usage_records.model | USAGE-MODEL-01 |
| 4 | Container-manager quota evaluation failing open | CM-QUOTA-DEAD-01 |
| 5 | Hardcoded Save Point text | SAVEPOINT-I18N-01 |
| 6 | Debug fetch to a local ingest endpoint | DEBUG-INGEST-01 |
| 7 | Reset order steps 2 to 5: run status, collaboration test, approval gates and loop prevention | RUN-STATUS-01, RUN-RECOVER-01, COLLAB-INTERNAL-01, COLLAB-LIVE-01, COLLAB-GATE-01, COLLAB-LIVE-02 |

Each named task is COMPLETE AND LOCKED. The RPG office from step 5 is registered (row 4 above).

### Dropped by Keith (2026-11-05)

| # | Follow-up | Reason |
|---|---|---|
| 1 | BETA-READY-SMOKE, the pre-beta full-stack live smoke left paused as B3 by AGENT-PLATFORM-RPG-03B | PRIVATE-BETA-E2E-LIVE-11 passed a full-stack live run on 2026-08-23 and the private beta is deferred (2026-10-31); a later rollout plans its own smoke |
| 2 | Live checks STAGING-DEPLOY-03 did not exercise: a failed step's reason (RUN-ERROR-01), hand-off recovery after a Gateway restart (COLLAB-HANDOFF-RECOVER-01), a refused deploy (OPS-APPEND-IDS-01) | Unit-tested; the next staging window exercises them |

## Validation

| Check | Result |
|---|---|
| Validator dry run on the proposed files | exit 0, empty stderr |
| Canonical validator at this record | see the proof; exit 0 |
| Code checks against the registered items | on 2026-11-05 none of the 30 registered items was found done in the code |

## Limits

The sweep covered checkpoints from CLEAN-BASELINE onward, the named plans, and Keith-approved items held only in session memory. ID-like labels inside older readiness plans were not checked one by one. A later find is disposed under the new rule when it is named.

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. GOVERNANCE released UNOWNED; saturation suspension ended; both lanes EMPTY.
