# Office controls, voice and privacy: discussion and decision record

**Date:** 2026-11-12.
**Source:** Keith's chat with the review window, 2026-11-10 to 2026-11-12, and the review window's draft note `C:\Users\knlee\aisb-notes\2026-11-12-office-controls-voice-privacy.md` (outside the repository, not committed).
**Recorded by:** the control plane. It rechecked the code facts below itself.
**Nature:** a control-plane record of decisions and recommendations. It admits nothing. TASKS.md stays the only scheduler, and docs/AGENT-OPS-PLAN.md section 0 the only plan. PRD.md is not edited here.

This record keeps three things apart:
- **Decided** means Keith decided it in that chat.
- **Recommended** means the review window or the control plane proposed it, and Keith has not decided.
- **Open** means it waits for Keith.

## 1. The office (decided; OFFICE-SCENE-01, registered in 78f23d2)

Keith decided:

| Topic | Decision |
|---|---|
| Style | Isometric 16-bit, in a bright daytime mood, in our own art. The reference picture is mood only, and no outside assets are used. |
| Room | One fixed room with 12 desks: 4 system agents and 8 user agents. Extra agents appear in a side list that opens the same panel as a desk. |
| Sizes | Floor tiles are 32x16 pixels, and characters about 32 pixels tall, shown enlarged. One desk is also tested at 64x32 before the kit is committed. |
| Movement | A working agent sits and types at its desk only while a real run is going. Idle agents wander and come back. Movement is decoration only, because status comes from the server. Reduced motion turns wandering off. |
| Art | Keith draws every final piece himself; AI makes concepts only. Palette v1 (32 colours) is approved. The starter kit is in `C:\Users\knlee\office-art` (palette, templates, README, `ai-log.csv`, `pieces.csv`), and the provenance of every piece is logged. |
| Later | A user-built office (OFFICE-BUILD-01) and selling unique pieces (OFFICE-SHOP-01). Selling needs its own ownership storage, because `user_entitlements` cannot hold owned items, and art licences must allow resale. |

PRD.md line 483 says a walking-town or moving-character simulation is "not the current or next committed product". Earlier records cite it as line 482. OFFICE-SCENE-01 waits for GOV-PRD-SYNC-01 to reword that line in Keith's words.

## 2. Controls (decided)

- **First release:** click or tap and keyboard access. They are always available, including on phones and for people who cannot steer a character.
- **Later:** a character the user walks themselves, with arrow keys, a thumb stick on phones, collision with furniture, and walking up to an agent to talk. The player character's art waits until the agent characters are done.
- **Registered:** OFFICE-PLAYER-01. It is ready when the fixed office has shipped and Keith decides.

## 3. Voice (decided as a future feature; three points open)

**Decided:**
- **Push to talk only.** The user holds a button or key while speaking to the selected or nearby agent, and the microphone listens only while it is held.
- Microphone permission is asked only when voice is first used.
- Speech-to-text in English, Traditional Chinese and Simplified Chinese.
- Spoken replies are optional and come later.
- Text input is always available.

**Recommended default** (not decided): audio is never stored, the microphone opens only while the button is held, and a clear notice appears before first use. Hands-free listening is a possible later addition and is not decided.

**Open for Keith:**
- the speech provider;
- the cost per minute;
- what audio, if any, is stored.

**Evidence, rechecked by the control plane on 2026-11-12:**
- Frontend and service sources have no speech recognition, `getUserMedia`, `MediaRecorder` or speech synthesis code.
- PRD.md does not mention voice, speech or a microphone.

**Registered:** OFFICE-VOICE-01. It is ready when Keith decides the provider, the cost and the audio handling.

## 4. Privacy of the whole app (discussion; nothing approved)

Keith raised privacy as a sensitive issue. The question is how users can be confident that privacy is not a problem. This section is a discussion with a recommended order. **No privacy task is registered** until Keith says which ones.

### 4.1 What the code shows today

This comes from a limited search. The control plane rechecked each line on 2026-11-12, and the data inventory is what would confirm it.

| Fact | Where |
|---|---|
| Chat messages are stored as text, per conversation | `chat_messages.content`, a text column; `services/api-gateway/src/entities/chat-message.entity.ts` lines 18 and 59-60 |
| Prompts go to outside AI providers. The gateway supports five: Anthropic, OpenAI, Groq, xAI and DeepSeek | `services/api-gateway/src/ai/provider-model.catalogue.ts` lines 3-7 |
| The usage ledger stores no prompt or response content | `services/api-gateway/src/entities/usage-record.entity.ts` line 24 |
| There is no privacy or terms page under the app routes, and no privacy text in `frontend/messages/en.json` | `frontend/app/[locale]/` |
| There is no account deletion or data export in the user and auth code; the only delete is for an API key | `services/api-gateway/src/auth/api-key.controller.ts` line 81 |
| PRD.md has no privacy or retention section; it only mentions session cookies with CSRF protection | PRD.md line 330 |

**Not checked:**
- encryption at rest;
- how long backups and workspace snapshots are kept;
- what staff can read;
- what each provider's own terms say about training on or keeping data.

Already recorded elsewhere: ACCESS-READY-01 item 5 asks for a decision on `previous_response_id`, which keeps conversations stored at OpenAI and xAI.

### 4.2 The usual practice (background, not legal advice)

1. Say plainly what is collected, where it goes and how long it is kept, in a privacy policy and terms in all three languages, reviewed by a lawyer. The rules differ by where users live: Taiwan, mainland China and the EU.
2. Publish the list of outside processors, including the AI providers.
3. Do not train on or sell user data, and make that true by checking each provider's commercial API terms.
4. Give users control: delete a chat, a project or the whole account, and export their data. Backups need a stated retention period that matches.
5. Collect as little as possible, with retention periods and scheduled deletion.
6. Security that can be described: encryption in transit and at rest, limited staff access to user content with an audit log, and secrets kept out of logs.
7. Notices at the moment they matter, such as before the first voice use and wherever a prompt leaves our servers.
8. Proof later: a data-processing agreement for business customers, and eventually SOC 2 or ISO 27001.

### 4.3 Recommended order (a recommendation, not a decision)

1. A read-only **data inventory**: everything stored, where it is kept, who can read it, and what leaves our servers.
2. **Keith's privacy principles** in his own words, for example: no training on user data, no selling, and audio never stored.
3. **Delete and export** for users, plus retention periods.
4. A **privacy policy and terms**, drafted from the inventory and reviewed by a lawyer.
5. A **staff-access rule** with an audit log for user content.
6. A public **"privacy at a glance"** page that lists the outside processors.

These six are added as conditions to the gate for the first outside user, ACCESS-READY-01 ("Ready for users other than Keith"), and to plan section 0, row 46. They stay unregistered until Keith decides. No private beta is planned, and basic_auth stays on.

## 5. Open for Keith

| Item | Waits for |
|---|---|
| Which privacy tasks to register, and whether to start with the read-only data inventory | Keith |
| Keith's privacy principles in his own words | Keith |
| OFFICE-VOICE-01: provider, cost per minute, audio storage (recommended: never stored) | Keith |
| saturationClass OPTIONAL for OFFICE-PLAYER-01 and OFFICE-VOICE-01 | Keith to confirm |
| PRD.md wording for the office, controls and voice (GOV-PRD-SYNC-01) | Keith's words |
| The first test art set (a floor tile, a desk with its screen off and on, one standing character) | Keith draws it in `C:\Users\knlee\office-art` |
| An optional checker for PNG size, palette and transparency | Offered by the review window; not built, not registered |

## 6. Dispositions of the follow-ups named in this discussion

| Follow-up | Disposition |
|---|---|
| The office decisions | Written into OFFICE-SCENE-01; its provisional points are now decided |
| A user-walked character | Registered: OFFICE-PLAYER-01 |
| Voice | Registered: OFFICE-VOICE-01 |
| PRD wording for controls and voice | Superseded by GOV-PRD-SYNC-01, which now holds it |
| The six privacy conditions | Superseded by ACCESS-READY-01 (gate conditions) and plan row 46, waiting for Keith's choice. Not registered, at Keith's instruction |
| The optional PNG checker | Superseded by OFFICE-SCENE-01. An offer only; Keith asks for it, or it is dropped at that task's stage-start |

FOLLOWUPS: 2 registered (OFFICE-PLAYER-01, OFFICE-VOICE-01) / 4 superseded (office decisions into OFFICE-SCENE-01; controls and voice wording into GOV-PRD-SYNC-01; privacy conditions into ACCESS-READY-01 and plan row 46; PNG checker into OFFICE-SCENE-01) / 0 dropped / 0 undisposed.

## 7. Not verified

- **Not run:** this record comes from reading source and from the chat. Nothing was run.
- **Not reviewed:** no legal review has happened.
- **To be checked:** statements about providers' terms, and about the rules in Taiwan, mainland China and the EU, are general practice and must be checked by the people responsible.
