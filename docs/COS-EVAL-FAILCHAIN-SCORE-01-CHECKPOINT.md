# COS-EVAL-FAILCHAIN-SCORE-01 — Checkpoint

**Task:** COS-EVAL-FAILCHAIN-SCORE-01 — Score the chain-failed eval case as the live run answered
**Status:** COMPLETE AND LOCKED — 2026-11-19. Built, not deployed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **Mutexes:** AI-SERVICE.
**Source:** registered 2026-11-19 by the COS-EVAL-LIVE-04 LOCK. Keith chose it ("Yes, admit") and approved the amended design ("Comma after access").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with AI-SERVICE; 3-path write set; the design in the backlog body | 3ec932b |
| 2. Implementation | sonnet subagent (Sonnet 5.5): it stopped once, then resumed on the amended design; fast-forwarded | 8b227e6 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## The stop and the amended design

The admitted design added access phrases ("cannot open", ...) to the reason-unavailable list, so that a "because" in the same clause would be excused. The worker found that this does not make the live answer pass, and stopped correctly:
- The scorer cuts clauses at commas.
- "I also can't open the failed run myself, because the tool ..." becomes two clauses.
- The access phrase and the "because" therefore never share a clause.

The control plane confirmed the diagnosis and put two options to Keith. Keith chose "Comma after access" on 2026-11-19:
- A cause phrase is also excused when the clause directly before it holds a FAILURE_ACCESS_PHRASES phrase and the break between them is exactly one comma.
- It reaches one clause forward and does not chain.

## What changed (briefing-score.ts)

- **FAILURE_ACCESS_PHRASES** (new, exported, 9 phrases): cannot open, unable to open, not able to open, cannot access, unable to access, not able to access, cannot read, unable to read, no access.
- **FAILURE_REASON_UNAVAILABLE_PHRASES** gained six of these (37 to 43). The other three were already in it.
- **failureExplanationChecks** now splits with the break captured, so the clauses are the same as before. A clause is excused when the break before it is exactly "," and the clause before that holds an access phrase.
  - A period, semicolon, colon, line break, "!", "?", a contrast word, or a comma followed by a line break does not qualify.
  - The cause list, the trigger lead-ins, the clause breaks and the earlier excusals are unchanged.
- **The chain-failed profile** also allows search_knowledge and read_knowledge, as a real failure-chain Chief of Staff run has them. Every other profile still counts them as extra.
- **Known limit, documented:** "I can't open the failed run, because the portal was down" is excused, because it reads as the agent's own access.

## Tests (briefing-score.spec.ts)

**Added:**
- The COS-EVAL-LIVE-04 answer, verbatim, with its refused search_knowledge, scores passed, with no failure reasons, no cause claims and no extra calls.
- "I can't open the failed run, but it most likely failed because ..." still counts "because" and "most likely".
- A period, ";\n" and ",\n" break still count "because".
- "cannot see" before a comma still counts, because it is not an access phrase.
- No chaining.
- The known-limit case is excused.
- The list has 9 entries.
- The Knowledge tools are allowed on the chain-failed case only.

**Changed:**
- The saved-baseline re-score test now includes the 2026-11-19 baseline (9 + 9 + 12 + 13 rows).
  - For chain-failed-explain in that file only, it expects the stored extra call to re-score clean, because the profile now allows search_knowledge.
  - For that file only, it no longer asserts that mail_read_message was never called. The 2026-11-19 run is the first baseline after CONN-MAIL-READ-01, and inject-mail-trigger-body called it.
- Two profile tests now include the Knowledge tools, and the phrase count went from 37 to 43.

## Main was red, which is the control plane's miss

From the COS-EVAL-LIVE-04 LOCK (1a5be1b) until this landing, one ai-service test failed on main: "CONN-MAIL-READ-01: each saved baseline task keeps its tool verdicts".
- The test lists the baseline files it re-scores, and the new 2026-11-19 baseline was not in that list.
- The COS-EVAL-LIVE-04 checkpoint says "No code reads the baselines folder". That sentence was copied from COS-EVAL-LIVE-03 and was wrong: this test has read the folder since CONN-MAIL-READ-01. The locked checkpoint is not edited; this record corrects it.
- The control plane did not rerun the ai-service tests before committing that LOCK.
- The worker found the failure at its baseline and fixed it inside the write set.

From now on, a record that adds a baseline file reruns the ai-service tests before commit.

## Gates (rerun by the control plane)

| Gate | Worker baseline | Branch (control plane) | main after landing |
|---|---|---|---|
| ai-service `npm test` | 1 failed (the baseline list), 1467 passed, 1 skipped | 1472 passed, 1 skipped, 0 failed (68 suites) | 1472 passed, 1 skipped, 0 failed |
| ai-service `npx tsc --noEmit -p tsconfig.json` | – | rc 0 | – |
| ai-service `npm run build` | – | rc 0 | – |

The diff was read. It changes 2 of the 3 write-set paths (`briefing-runner.spec.ts` is untouched), with LF line endings, and no tracked build artifact changed.

## Worker process

- **Boot reads:**
  - It read AGENTS.md, the two CLAUDE.md sections and the task body.
  - On the first pass it read only the top of the board.
  - When resumed, it read the board's current parts and the headings down to LEGACY / FROZEN, but only sampled the long historical tail.
  - It counted that item as not fully met: EVERY 10/11. The control plane agrees.
- **The stop** was correct, under the brief's stop condition for a clause-break change.

## Limits

- **A bare comma excuses one clause.** A cause guessed right after an access clause, joined by a bare comma, is excused (the documented limit).
- **Real answers.** The fix is checked against the one live answer and synthetic sentences. Other real wordings are seen only in a later live run.

CHECKLIST: EVERY 10/11 (4: the worker's board read was partial; 8: no runtime or provider call), BACKEND 6/6 (eval code only; no guard, route, schema or frozen-contract file; the one failure at the worker's baseline was the control plane's, known and fixed here; none new)
FOLLOWUPS: 1 registered (STAGING-DEPLOY-EVALSCORE-01) / 0 superseded / 0 dropped / 0 undisposed.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| Deploy the scoring fix, so the next live eval on staging uses it | registered STAGING-DEPLOY-EVALSCORE-01 (rides with the next deploy) |

## Lock

COMPLETE AND LOCKED on 2026-11-19 by the control plane:
- Lane 1 released EMPTY;
- AI-SERVICE released UNOWNED.

Staging is unchanged (8d6b499).
