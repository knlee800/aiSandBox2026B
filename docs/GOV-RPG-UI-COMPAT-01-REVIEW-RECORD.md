# GOV-RPG-UI-COMPAT-01 — Future Office UI Compatibility Review Record

**Status of this record:** summary of a separate external review, recorded on 2026-10-31. It is not a fresh audit. Nothing here was re-inspected or re-run for this record.
**Reviewed by:** a separate Claude Opus 5.5 review and its follow-up.
**Reviewed commit:** `main` at `ebed96b5522e9a06a5d88d61441b9973be2378e8`. This is historical evidence, not a statement about any later HEAD.
**Limits:** findings come from source inspection only. They were not runtime-tested. No source line references are recorded because the summary supplied to this record has none.
**Authority:** evidence only. Product scope stays in `PRD.md` and technical constraints in `ARCHITECTURE.md`. This record does not change the MVP scope, start RPG implementation, schedule any task or authorize any fix.

## Visual preference

Keith's preferred graphics and UI reference for the future office is https://github.com/W17ant/Claude-Office. We will build our own interface. The preference does not select that project's code, assets, architecture or renderer.

## Compatibility findings (as reported)

- No fundamental architectural obstacle to the proposed visual UI was found.
- The existing frontend can accommodate a client-side 2D office.
- Persistent agent identities and server-retained execution results provide a usable foundation.
- No architectural rewrite or additional service was demonstrated to be necessary.
- Live office integration is not implemented or production-verified.

## Integration questions for the UI planning stage

- Owner-scoped active and recent run retrieval, with agent and session attribution.
- Refresh, reconnect and navigation recovery.
- Distinguishing execution completion, saved output, pending approval, application in progress and application outcome.
- What selecting an agent's character opens.
- Preserving authorization checks for all UI actions.
- Keeping decorative animation separate from authoritative work status.

## Corrections made by the follow-up

- Execution results are retained on the server; the UI currently lacks a complete route back to them after refresh.
- The earlier claim that `/api/events/*` lacked protection was withdrawn.
- The claim that no server-side assistant-message writer exists was too broad; the reviewed Builder path still depends on browser-driven chat persistence.
- No current duplicate-application-on-refresh defect was established. Idempotency is a requirement for future recovery.
- Discarding pending approval on restore was reported as deliberate behaviour under the locked AI-WS-02-hotfix (`docs/AI-WS-02-hotfix-CHECKPOINT.md`). This record does not reverse it.

## Proposals, not decisions

A new agent ID column, an appearance table and a particular graphics renderer were proposals. None is adopted. Workspace and recovery behaviours for the office remain unresolved product questions.

## Separate existing-app concerns (deferred tracking only)

These are not RPG prerequisites. They are reported by the review from source inspection. They are not runtime-reproduced, not evidence of a breach, not fixed, and not investigated for this record. Follow-up candidates, not registered, not scheduled and not activated.

**Reported as source-level defects**

| Concern | Existing entry |
|---|---|
| Authorization of execution streaming | none found in a backlog search |
| Authorization of execution cancellation | none found in a backlog search |
| Authorization of `/api/chat-messages/add-by-session` | related earlier record: `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md`, route table; current state not checked here |
| Unguarded Socket.IO room access; deployed exposure unverified | none found in a backlog search |

**Additional concerns**

- Stream subscription cleanup. No existing entry found.
- Frontend platform test coverage. No existing entry found.

**Unverified hypotheses, requiring verification**

- Guard case-matching. No existing entry found.
- Public v1 execute ownership. No existing entry found.
