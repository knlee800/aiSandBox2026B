# GOV-CHAT-WORDING-01 and GOV-ARCH-PKEY-01 — Checkpoint

**Tasks:**
- GOV-CHAT-WORDING-01: PRD.md and ARCHITECTURE.md lines for the Discord chat channel;
- GOV-ARCH-PKEY-01: an ARCHITECTURE.md note for the provider availability routes and the run error field.

**Status:** both COMPLETE AND LOCKED — 2026-11-15.
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP. GOVERNANCE was held for this record only.
**Source:**
- GOV-CHAT-WORDING-01 was registered by the CHAT-LIVE-01 LOCK, from CHAT-DISCORD-01 stage-start section 11;
- GOV-ARCH-PKEY-01 was registered by the PROVIDER-KEY-01 LOCK, and widened by PROVIDER-SWITCH-01.

Keith saw the six items, updated to what was built and proven, and approved them on 2026-11-15 ("approved").

## What changed (exactly the approved text)

**PRD.md** (5 lines):
1. A section 11 GATED row: the Discord chat channel, gated per account (harness access) and behind `CHAT_DISCORD_ENABLED` (default off), proven on staging 2026-11-15 (CHAT-LIVE-01), not in the private-beta promise.
2. Section 8, "Broad external integrations", narrowed: the GATED exceptions are the allowlisted, platform-run, read-only mail and calendar connectors and the Discord chat channel; the other chat channels and integrations remain approved FUTURE.
3. Section 11, one sentence in the front-door paragraph: the Discord chat channel is now GATED; the other channels and triggers come later.

**ARCHITECTURE.md** (17 lines):
- **Discord (GOV-CHAT-WORDING-01):**
  - **New section 13.6 Chat channels (GATED):** the gateway module, the outbound connection with no intents, the switch, linking, read-only runs through the start code, delivery, approval buttons, untrusted message text, and no chat text or Discord id in logs or audit.
  - **Section 3:** the gateway list gains the chat channels.
  - **Section 7:** a data-model row for `chat_links`, `chat_link_codes` and `chat_run_deliveries`.
  - **Section 8:** the five `/api/chat-links` routes.
  - **Section 13.1:** a status row, STAGING and gated.
  - **Section 14:** API Gateway → Discord, outbound WebSocket and HTTPS.
- **Provider routes (GOV-ARCH-PKEY-01), section 8:**
  - `GET /api/ai/providers` (booleans; usable means key and switch) and the internal `GET /api/internal/provider-availability`;
  - the allow-listed `error` field on `GET /api/ai/executions/:id`;
  - `ExecutionSafetyGuard` checking the chosen provider's switch.

No other line changed: the PRD.md diff is 3 lines changed and 1 added; the ARCHITECTURE.md diff is 17 lines added.

CHECKLIST: EVERY 11/11 (1: registered tasks, recorded here as governance; 2: 2-step; 3, 4, 6, 7, 9: n/a, no worker and no code; 5: only PRD.md, ARCHITECTURE.md and the records; 8: no runtime; 10: the control plane's own record; 11: FOLLOWUPS line), GOVERNANCE (Keith approved the exact text; GOVERNANCE held for the record and released)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

Both tasks COMPLETE AND LOCKED on 2026-11-15 by the control plane; GOVERNANCE released UNOWNED.
