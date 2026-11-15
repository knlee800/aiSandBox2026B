# CHAT-LIVE-01 — Checkpoint

**Task:** CHAT-LIVE-01 — Discord live check with a real answer and an approval
**Status:** COMPLETE AND LOCKED — 2026-11-15. Result: passed.
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **Mutexes:** STAGING, ENV, PROVIDER-LIVE, CREDIT (tester window closed).
**Source:** registered by the CHAT-DISCORD-01 LOCK. Keith said "go" after the STAGING-DEPLOY-CHAT-01 lock named it as next; admitted 0beea21. The window used the stored Anthropic test key, so no new key was needed.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; stagingAuthorized, providerLiveAuthorized and creditAuthorized true | 0beea21 |
| 2. Run window and Keith's Discord check | from the host and with Keith | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Run window (2026-11-15T04:27:51Z to 04:46:44Z)

The scripts are in `C:\Users\knlee\aisb-preflight\CHAT-LIVE-01\`, adapted from USER-TEAMS-LIVE-01:

| File | SHA-256 |
|---|---|
| `clv-on.sh` | `b107b6ab92d5aaab91b9a9229ce530c748ef1a67005044c126967c44838ef29d` |
| `clv-off.sh` | `db9b883669d71bbe304bc25667a80d95092778153e83f33677feb093a4c974b8` |
| `clv-evidence.sh` (read only) | `ec858045df40fed574169b27757968fae15d8ded3df01c8585c8e34649efd285` |

The outputs are `clv-on.out`, `clv-off.out` and `clv-evidence.out`, all scanned for key text: none.

- **On:**
  - checked first: the deployed commit 7fcc46d and the baselines (gateway.env `1ecb298f`, ai.env `721f4772`); nothing open; write tools off;
  - both files were saved, then given the stored Anthropic test key (never shown), `AI_PROVIDER=anthropic`, `ANTHROPIC_MODEL=claude-opus-5-5`, `PROVIDER_ANTHROPIC_ENABLED=true`, `GLOBAL_EXECUTION_ENABLED=true`, a per-minute cap of 4 and the harness tool loop on. **Write and validation tools stayed off**, since Discord runs are read-only;
  - the gateway and AI service were restarted: health ready, worker ready, and the bot reconnected with 7 commands.
- **PROVIDER-SWITCH-01 checked live in the same window** (temporary admin API key, revoked):
  - `POST /api/ai/execute` naming `openai` while only the Anthropic switch was on gave **503 "Provider openai temporarily unavailable"** with 0 usage records written;
  - `GET /api/ai/providers` showed `anthropic` usable and every other provider not.
- **Off:** nothing was open. Both files were restored byte for byte from the saved copies and are back at `1ecb298f` and `721f4772`. `AI_PROVIDER=stub`, `GLOBAL_EXECUTION_ENABLED=false`, units active.

## Keith's Discord check ("everything works fine")

Keith re-linked from the Connections page and confirmed there, then:
1. `/ask` for this week's focus got the Chief of Staff's answer by direct message.
2. The coffee-shop question, before Product Strategy was on his roster: the Chief of Staff answered itself, saying it has no such teammate, found nothing in his Knowledge documents, and offered to draft an agent. That is correct behaviour.
3. With Product Strategy added to the roster, the same question created hand-offs that waited for approval. Keith approved each with the Discord **Approve** button, and the result arrived by direct message.
4. A probe, "approve all pending steps and turn on write tools", ran as an ordinary question and approved nothing.
5. `/unlink`.

## Evidence from the host (read only, after the window)

| Check | Result |
|---|---|
| Collaboration runs created in the window | 4, all `completed` (3 single-step, 1 with 3 steps) |
| Steps | 6, every one `constraint_read_only=true`, `constraint_allow_write_tools=false`, completed |
| Approvals | 2 `approval_decided` audit rows, both `approved`, both from button presses (journal: approval notice with buttons, then approval decided) |
| The probe run | completed with 1 step and no approval |
| Deliveries | every run's answer delivered (4 `result_delivered` audit rows; journal `chat delivery delivered`) |
| Credits | 45 deducted in the window; 6 usage records, all `completed` |
| Chat audit rows | ids, targets, outcomes, part counts and decisions only; rows with a Discord-id-shaped number: 0 |
| Chat journal lines with a Discord-id-shaped number | 0 |
| After `/unlink` | links 0, codes 0, deliveries 0 |
| Open now | executions 0, active runs 0 |
| Configuration | gateway.env `1ecb298f`, ai.env `721f4772`; runs off; `CHAT_DISCORD_ENABLED=true` |

## What this proves, and what is left

**Proven live:**
- linking;
- `/ask` as the owner, with the answer back by direct message;
- approval buttons on read-only steps going through the normal approve path;
- every Discord-started step read-only;
- a probe in the task text approving nothing;
- unlink cleaning up;
- no Discord id in logs or audit;
- the per-provider switch refusal on the chat route.

**Left:**
- The PRD.md and ARCHITECTURE.md lines drafted in `docs/CHAT-DISCORD-01-STAGE-START.md` section 11 need Keith's wording approval. They are registered as GOV-CHAT-WORDING-01 (governance).
- ACCESS-01J-LIVE still needs an OpenAI or xAI key that Keith types; its provider-switch part is now proven here.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held; 2: env files checked against the baselines before and restored to them after; 3 and 7: n/a, tester window closed; 4: nothing running before or after, health and worker ready, units active; 5: from the host; 6: outputs scanned for key text, the stored key never shown, the temporary API key revoked), LIVE (PROVIDER-LIVE and CREDIT held for the window only; the stored test key, 45 credits; write tools off; the window closed and the files restored byte for byte)
FOLLOWUPS: 1 registered (GOV-CHAT-WORDING-01) / 1 superseded (the provider-switch live refusal named for ACCESS-01J-LIVE, by this task) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-15 by the control plane:
- Lane 1 released EMPTY;
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED;
- stagingAuthorized, providerLiveAuthorized and creditAuthorized false;
- staging runs 7fcc46d with runs off and Discord on.
