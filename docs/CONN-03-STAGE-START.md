# CONN-03 — Stage-start

**Task:** CONN-03 — Mail body reads after the injection eval
**Status:** STAGE-START — APPROVED by Keith on 2026-11-10 ("Yes, both").
**Lane:** 1. **Mutexes:** GATEWAY, AI-SERVICE; HOTFILE leases on four connectors-mcp files: `clients/imap-client.ts`, `server.ts`, `limits.ts` and `tools/mail-list-unread.ts`.
**Lifecycle:** 4-STEP (registration, stage-start, implementation, consolidation). **Evidence class:** LOCAL-TESTS.
**Admitted:** 3c4d1f3, with the record corrected before admission. Keith approved it ("yes", 2026-11-10).
**Implementer:** a Claude subagent on **opus** (Opus 5.5), in worktree `C:\Users\knlee\aisb-worktrees\CONN-03` on branch `lane/CONN-03`. Opus because the task spans three services and a child-process server, and full mail content will reach the model.

## 1. Goal

The Chief of Staff's mail tool also returns a short, plain-text body for each unread message. Nothing is marked read and nothing in the mailbox changes. The body is data for the model, never instructions.

## 2. What is true today

- **The tool.** `services/connectors-mcp` serves `mail_list_unread_metadata`. It opens INBOX read-only (EXAMINE, `getMailboxLock('INBOX', { readOnly: true })`) and fetches only the envelope.
- **What a message carries.** `UnreadMessage` is `{ id, from: { name, address }, toCount, subject, date }`. Text fields are stripped of control characters and cut at 300 characters (`MAX_TEXT_CHARS`).
- **Result limits.** The MCP result is capped at 32,000 characters (`MAX_RESULT_CHARS`). When it is over, `capJsonItems` drops messages from the end. The gateway caps the result at 64 KB (`CONNECTOR_MAX_RESULT_BYTES`).
- **Forbidden IMAP verbs.** `FORBIDDEN_IMAP_VERBS` lists SELECT, STORE, APPEND, EXPUNGE, COPY, MOVE, DELETE and CREATE. `__tests__/imap-verbs.spec.ts` runs a scripted IMAP server and checks the commands sent.
- **The description.** The tool description says "Does not return bodies" in three places:
  - `services/connectors-mcp/src/server.ts`
  - `services/api-gateway/src/connectors/connector-servers.ts`
  - `services/ai-service/src/agent-harness/tools/connector-tool-definitions.ts`
- **The eval.**
  - The briefing eval already models a body as `bodyText` on each message (`eval/briefing-loader.ts`, allowed only on a `bodyCase: "CONN-03"` case).
  - The planted-body case `inject-mail-body` passed on claude-opus-5-5 (COS-EVAL-LIVE-02, 9 of 9).
- **Unchanged pieces.** The Chief of Staff instructions say nothing about headers, so their text and version hash (`d34f3eb4...`) stay as they are. Grants are per tool id, which also stays.
- **Cost today.** A briefing on Keith's account cost 10,372 tokens (BIZ-LIVE-03).
- **The Connections page now says:**
  - "Only mail headers (sender, subject, date) and calendar event titles and times are read. Message bodies are not read yet."
  - "Agents can list your unread mail headers."
  - Both become false once bodies are deployed (see section 6).

## 3. Design

| # | Decision |
|---|---|
| D1 | Add `bodyText: string` and `bodyTruncated: boolean` to `UnreadMessage`. Keep the tool id `mail_list_unread_metadata`, so grants, the tool profile and the Chief of Staff hash do not change. Add no new tool and no new argument. |
| D2 | The mailbox stays read-only: INBOX with EXAMINE as today. Body fetches use `BODY.PEEK[...]` only, never `BODY[...]` and never RFC822. No new verb is added, and the forbidden list stays. |
| D3 | Fetch `bodyStructure` with the envelope. Choose the first `text/plain` part that is not an attachment, else the first `text/html` part, else no part (`bodyText` is empty). Ignore attachments, images and nested messages. |
| D4 | Fetch at most 16 KB of the chosen part with a partial fetch (`BODY.PEEK[<part>]<0.16384>`), in one FETCH for all chosen messages. Never download whole messages. |
| D5 | Decode in code without a new dependency: quoted-printable and base64 by hand, then the charset with Node's `TextDecoder` (UTF-8 if the charset is unknown). Bytes that fail to decode become U+FFFD; the message is not dropped. |
| D6 | HTML becomes text. Remove `<script>`, `<style>` and `<head>` blocks and HTML comments, turn `<br>`, `</p>`, `</div>` and `</li>` into line breaks, drop all other tags, and decode the common named and numeric entities. Then strip control characters except line breaks, collapse runs of whitespace, and drop quoted reply lines that start with `>`. |
| D7 | Cap each body at 800 characters, cut at a code point boundary. Set `bodyTruncated` when cut. 25 messages × (about 450 characters of headers + 800 of body) is about 31,000, under the 32,000 cap. If the JSON is still over, shorten every body to 400, then 200, then 0, before any message is dropped. Messages are dropped only as the last step, as today. |
| D8 | Failures. If the body fetch fails for one message, that message keeps its headers with `bodyText` empty. If the body fetch as a whole fails, every message keeps its headers with empty bodies and the tool still succeeds. A header-fetch failure fails the tool as today. Errors keep the existing redaction, so the app password and username are never shown. |
| D9 | The three tool descriptions change together, to the same new text: "List unread Inbox messages for the connected mailbox: message id, sender, recipient count, subject, date, and a short plain-text excerpt of the body (at most 800 characters). At most 25 messages. Does not mark messages read and does not change the mailbox." Any test that pins the description is updated. |
| D10 | The eval. The live tool now always returns `bodyText`, so eval fixtures without `bodyText` must stay valid, and the scorer and loader keep working. Change eval code only if a test fails because of the new field shape. Planted-body cases still need `bodyCase: "CONN-03"`. |
| D11 | Tool text is data. The ai-service connector handler already escapes tool output as JSON inside the data frame, and that stays. Add a test that a body containing a fake closing tag or an instruction comes through escaped inside the frame. |

## 4. Files

| File | Change |
|---|---|
| `services/connectors-mcp/src/clients/imap-client.ts` | bodyStructure and part choice, the partial `BODY.PEEK` fetch, decoding, the new fields |
| `services/connectors-mcp/src/limits.ts` | `MAX_BODY_CHARS = 800`, `MAX_BODY_FETCH_BYTES = 16384`, text helpers (HTML to text, decoders), body-first shrinking in the result cap |
| `services/connectors-mcp/src/tools/mail-list-unread.ts` | uses the body-first cap |
| `services/connectors-mcp/src/server.ts` | the tool description |
| `services/connectors-mcp/src/__tests__/` | scripted-server cases: plain part, HTML only, multipart with an attachment, quoted-printable, base64, Big5 or GB2312, an oversized body, a failed body fetch, every command PEEK, no forbidden verb, the cap order |
| `services/api-gateway/src/connectors/connector-servers.ts` (and its tests) | the description |
| `services/ai-service/src/agent-harness/tools/connector-tool-definitions.ts` (and its tests, the handler test) | the description; the escaping test |
| `services/ai-service/src/agent-harness/eval/` | only if D10 needs it |

Out of scope:
- the frontend (held by HARNESS-FIXES-01C);
- the Chief of Staff instructions, grants, the tool profile, migrations, packages, the deploy, ARCHITECTURE.md (the control plane updates it at LOCK) and any record.

## 5. Gates

- **connectors-mcp:** `npm test` and `npm run build`. Compare with the CONN-01 checkpoint, 52 tests.
- **api-gateway:** `npm test` and `npm run build`. Compare with 2879 passed, where only the 14 known `smoke.integration.spec.ts` failures may fail.
- **ai-service:** `npx jest --runInBand` and `npm run build`. Compare with 1229 passed.
- **Checklists** on the checkpoint: EVERY and BACKEND. UI does not apply: no frontend change.

## 6. Follow-ups (named here, disposed at LOCK)

1. **Connections page copy.** The two lines quoted in section 2 must say that a short excerpt of each unread message's body is read, in en, zh-TW and zh-CN. This needs FRONTEND and I18N, which HARNESS-FIXES-01C holds now. Registered at LOCK, ready when HARNESS-FIXES-01C is LOCKED.
2. **Deploy and live check.** A staging deploy of CONN-03 together with the copy change, then one live briefing on Keith's account. It checks that bodies arrive and that the briefing still flags planted text. Keith's unread mail must still be unread afterwards, checked from the host by unread count before and after. It also measures the token cost against 10,372. Registered at LOCK, ready when CONN-03 and the copy task are LOCKED. Bodies are not deployed before the copy change.

## 7. Stop conditions for the implementer

STOP and report if:
- any command other than EXAMINE, SEARCH, FETCH with `BODY.PEEK` or the envelope, LOGIN, CAPABILITY, NOOP or LOGOUT would be sent;
- a new dependency seems needed;
- a file outside section 4 needs a change;
- the Chief of Staff hash or a grant would change;
- a gate fails outside the known failures.
