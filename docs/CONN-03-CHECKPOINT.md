# CONN-03 — Checkpoint

**Task:** CONN-03 — Mail body reads after the injection eval
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; **not deployed**.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan item C16). The record was corrected and admitted on 2026-11-10 ("yes"), and the stage-start was approved the same day ("Yes, both").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration, corrected at admission | Lane 1 with GATEWAY, AI-SERVICE and four HOTFILE leases | 3c4d1f3 |
| 2. Stage-start | docs/CONN-03-STAGE-START.md, approved by Keith | b8402a0 |
| 3. Implementation | opus subagent in worktree lane/CONN-03 (d3479b8, a8302ee), cherry-picked onto main | 89d6fff, 5453aa3 |
| 4. LOCK | this checkpoint, board, backlog, sidecar, plan, ARCHITECTURE.md, canonical validator | this record |

## What changed (10 files)

| Design | How it was met |
|---|---|
| D1 | `UnreadMessage` gains `bodyText` and `bodyTruncated`. The tool id, arguments and input schema are unchanged, and no tool was added. The gateway's system-agent tests pass, so the Chief of Staff hash d34f3eb4... is unchanged. |
| D2 | INBOX is still opened read-only (EXAMINE). Bodies are fetched only in `fillBodies()`, through imapflow `bodyParts` with `start`/`maxLength`, which imapflow sends as `BODY.PEEK[part]<0.16384>`. The forbidden verb list is unchanged. |
| D3 | `chooseBodyPart()` picks the first text/plain part that is not an attachment, else text/html. It skips attachments and `message/rfc822`, and a message that is not multipart uses section 1. |
| D4 | At most 16 KB per part, also cut again when the fetched bytes are read. **Accepted deviation:** one FETCH per distinct section rather than one FETCH in all, because a FETCH names the same section for every message in it. The main test sent 3 FETCHes for 4 messages, and no whole message is ever downloaded. |
| D5 | Quoted-printable and base64 are decoded by hand, and charsets with `TextDecoder` (falling back to UTF-8, with U+FFFD for bad bytes). No dependency was added. |
| D6 | `htmlToText()` and `cleanBodyText()`, plus table cells and headings as line breaks and the removal of invisible format characters. Lines starting with `>` are dropped. |
| D7 | The 800-character cap is cut at a code point boundary. `capJsonItemsBodyFirst()` shortens bodies to 400, then 200, then 0 before any message is dropped. **Accepted addition:** the result is also capped at 60 KB of UTF-8, because 25 Chinese messages at 800 characters would exceed the gateway's 64 KB limit and fail the whole call. |
| D8 | A failed body fetch, a missing part or a decode error leaves an empty body and keeps the headers. A header failure fails the tool as before. Redaction is unchanged, and body errors are never logged. |
| D9 | The new description is identical in the connectors-mcp server, the gateway catalogue and the ai-service tool definitions, and a test checks it. The MCP server's instructions now also name "message bodies" (a8302ee). The gateway does not pass those instructions to the model. |
| D10 | No eval change was needed. |
| D11 | New handler test: a body containing `</connector_result>`, a fake `<system>` instruction, `&` and quotes comes through as `<`, `>` and `&` escapes inside one data frame, and it parses back to the original. |

The IMAP commands the scripted server saw in the main case:
- CAPABILITY, LOGIN, CAPABILITY
- LIST, LIST, LSUB
- EXAMINE INBOX
- UID SEARCH UNSEEN
- UID FETCH (UID BODYSTRUCTURE ENVELOPE)
- three UID FETCH (UID BODY.PEEK[n]<0.16384>)
- LOGOUT

**LIST and LSUB are accepted on record.** The stage-start's verb list did not name them. imapflow sends them before EXAMINE to look up the folder, and the scripted server has answered them since CONN-01. They read nothing and change nothing, and CONN-03 adds no verb.

## Gates (control-plane rerun on the branch)

The worker's first gateway run failed because the control plane created a broken `services/api-gateway/node_modules` junction (a literal `$s` in the path). The control plane fixed the junction and reran every gate:

| Service | Tests | Build | Baseline |
|---|---|---|---|
| connectors-mcp | 5 suites, 74 passed (74 again after a8302ee) | exit 0 | 52 at CONN-01 |
| api-gateway | 2879 passed, 7 skipped, 14 failed, all in `smoke.integration.spec.ts` | exit 0 | 2879 passed, the same 14 known smoke failures |
| ai-service | 1230 passed, 1 skipped | exit 0 | 1229 (+1, the D11 test) |

After the cherry-pick:
- `services/` on main is identical to the gated branch;
- the changed files are LF;
- no tracked build artifact changed.

## Limits

- Not deployed. Staging still runs 8e0bc55, where the tool returns headers only.
- The Connections page still says bodies are not read. That copy changes in CONN-COPY-01, and bodies are not deployed before it (BODIES-LIVE-01).
- A slow body fetch counts against the mail call's 20-second limit and would fail the whole call. BODIES-LIVE-01 measures that time.
- Tested against a scripted IMAP server, not a real mailbox.

CHECKLIST: EVERY 11/11 (3: opus, passed explicitly; 4: self-contained brief; 7: gates rerun by the control plane after its junction fix; 9: no tracked artifacts), BACKEND 5/6 (5: n/a, no entity, schema or migration change; 6: compared with the latest baselines, no new failure)
FOLLOWUPS: 2 registered / 1 superseded / 0 dropped / 0 undisposed:
- registered: CONN-COPY-01 (Connections page copy) and BODIES-LIVE-01 (deploy, then one live briefing that checks nothing is marked read, that bodies arrive, the token cost and the mail call time);
- superseded: the worker's body-phase time limit, by BODIES-LIVE-01's rule to register one if the mail call takes more than 10 of its 20 seconds;
- not follow-ups: the worker's LIST and LSUB note, accepted on record above, and its junction note, fixed.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane:
- Lane 1 released EMPTY.
- GATEWAY, AI-SERVICE and the four connectors-mcp HOTFILE leases released UNOWNED.
- ARCHITECTURE.md now says the connector server returns short body excerpts (not deployed).
