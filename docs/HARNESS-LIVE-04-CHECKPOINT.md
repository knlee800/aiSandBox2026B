# HARNESS-LIVE-04 — Checkpoint

**Task:** HARNESS-LIVE-04 — Deploy search and the authorization fixes, and prove them on ainow-staging-01
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Stage-start:** docs/HARNESS-LIVE-04-STAGE-START.md. **Deployed:** 8fb5b630d6278717f195f6c194e59524905d95ec.
**Who ran it:** the control plane ran the deploy, evidence and flags-off blocks over SSH, on Keith's instruction of 2026-11-02. Keith made the key, typed it at the hidden prompt, and ran the browser snippets.

## Guard on the server, no key

| Request | Result |
|---|---|
| `GET /api/internal/...`, `/API/INTERNAL/...`, `/api/Internal/...` | 401 each |
| `POST /api/chat-messages/add-by-session`, `/API/CHAT-MESSAGES/add-by-session` | 401 each |
| `POST /api/token-usage/record` | 401 |
| `GET /api/runtime/metrics`, `/API/RUNTIME/metrics` | 401 each |

## Runs

| Run | Execution | Task | Model calls | Tool calls | Tokens | Credits | Result |
|---|---|---|---|---|---|---|---|
| 1 | 7c93af8d | Find FALCON_RETRY_LIMIT in nested files, tool not named | 2 | 1, search_workspace | 2,647 | 3 | Correct: src/config/limits.js, line 3, value 7 |
| 2 | dc009ebd | Search for text that does not exist | 2 | 1, search_workspace | 2,408 | 3 | Said not found, and listed what search skips |

## Acceptance criteria

| Criterion | Result |
|---|---|
| Guard refuses with no key on the server, gateway ready | Met: 8 requests 401; health, database and ready 200 |
| A real run finds text across nested files; journal shows the tools | Met by run 1 |
| A search with no match is reported honestly | Met by run 2 |
| Stream viewers over real Redis; unknown ID 404 | Met: the open viewer received the final answer (3 messages) after the other closed; stream and cancel 404 |
| The AI service's own calls still succeed with the key | Met: both runs completed; 0 guard refusals in the gateway journal during the runs |
| Credits and usage correct, model non-empty | Met: 2 usage rows, both claude-opus-5-5; balance 435 to 432 to 429 |
| Spend within the caps | Met by upper bound: 5,055 tokens is at most about $0.10 even if all were output tokens, under the $1 soft cap. Keith gave no cost figure for this key |
| Flags off, key removed, configuration hashes match | Met: flags off at 05:28:30 UTC, saved files restored and hash-checked by the block; Keith confirmed the key deleted |
| Keith reads the transcripts and records his judgement | Met: Keith recorded "judgement ok" on 2026-11-02 |
| Not LOCKED by an implementer | Met: locked by the control plane |

## Findings for the usable-harness work

- The model chose search unprompted and needed one tool call, where earlier lookups listed and read several files.
- The worker publishes the finished answer as one stream message, so viewers see no output until the run ends. The Builder connection and progress work must allow for this.

## Not proven

- A refusal for a real execution owned by another user: it needs a second account, so it has HTTP test proof with mocked services.
- A search script failure still looks like no matches (container manager).
- Other providers, real projects, the run token budget stopping a real run, and the block on tools after the notice.
- Socket.IO rooms and the host firewall were not touched.
- Search and harness writes stay gated and on staging only; this does not make them CURRENT.

## Evidence

In `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-04/`. No key or secret value is recorded.

| File | Bytes | SHA-256 |
|---|---|---|
| `hl06-deploy.out` | 4270 | `2c53e39648690aae09c4597dcd0a2bd2df240cd73bab7c7f5a3f4c4752f4ac15` |
| `hl06-evidence.out` | 11372 | `35d1e143077e8418c9429b0ed18db5be7d93cdc4b72d42e5b6ef4c3aff6f5279` |
| `hl06-flags-off.out` | 555 | `28ba76f1b4893c441dcd3887d63eccae97fa8c7559b0a3f22aa3bf48179986ad` |

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; STAGING, PROVIDER-LIVE, CREDIT and ENV released UNOWNED; stagingAuthorized, providerLiveAuthorized and creditAuthorized false; GOVERNANCE UNOWNED.
