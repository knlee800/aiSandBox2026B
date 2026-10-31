# GOV-HARNESS-RESET-01 — Harness Reset Decision Record

**Status of this record:** Keith's decisions of 2026-10-31. Governance only. No code, host, provider or credit action.
**Base commit:** 7772f8174d5b86539c68b29b4ba8ced7f71d1a6a.
**Authority:** this record decides direction. Product wording stays in `PRD.md` and technical constraints in `ARCHITECTURE.md`. It does not admit any task and authorizes no staging, provider or credit action.

## Why

Keith decided there will be no private beta for now, because the single-shot Builder without Harness is not useful enough to work with. The harness engine exists but is gated off. `ARCHITECTURE.md` section 12 records the real-provider loop as unproven: its end-to-end canaries used a test stub.

## Decisions

1. **ACTIVE DEVELOPMENT level.** `PRD.md` section 11 gains this level. Agent Harness goes in it now. Other planned features stay planned, in the order below. A feature moves to CURRENT only when proven on staging. Future features are not relabelled CURRENT.
2. **Private beta deferred.** Deferred by Keith on 2026-10-31, possibly until the planned features are done. Basic_auth stays on staging. `PRD.md` section 10 stays as reference for a later rollout.
3. **Harness target.** Harness stays implemented but gated, and is now active development. Target providers are xAI, OpenAI, Anthropic and DeepSeek, on current models.
4. **Direct writes.** Keith explicitly approves harness direct writes with a pre-apply save point, on staging only for now. This is the explicit approval the `CLAUDE.md` AI Workspace File-Action Rules require for this path. It does not change the single-shot Builder flow.
5. **Charging.** Harness writes keep token-based charging for now. To be settled in the usable-harness slices.
6. **Old restart path stays closed.** AGENT-PLATFORM-EXEC-01C6A stays `startCondition=NOT_READY` and is not reopened. The PM2 host it depended on is retired, so no PM2 fencing successor is built. The locked HARNESS-RESTART-GOV-01 and PM2-FENCE-01 records are not edited; this record states that the systemd host on ainow-staging-01 replaces that path. AGENT-PLATFORM-EXEC-01C and AGENT-PLATFORM-EXEC-01C6 stay registered and are not admitted; their frozen assumptions, including xAI failing by design, no longer describe the target. The harness continues under the new tasks below.
7. **GOV-RPG-UI-COMPAT-01** is closed and locked by this record (commit 7772f8174d5b86539c68b29b4ba8ced7f71d1a6a).

## Order of work

| Step | Task | State after this record |
|---|---|---|
| 1 | HARNESS-LIVE-01: stub then real read-only runs on staging, Anthropic first | registered, not admitted, `NOT_READY` until Keith authorizes it |
| 2 | HARNESS-PROVIDERS-01: catalogues, xAI and DeepSeek tool support, OpenAI API question | named, not registered |
| 3 | HARNESS-LIVE-02: real writes and validation | named, not registered |
| 4 | Usable-harness slices: step limit, search, Builder connection and progress, and a check of the reported authorization concerns before the UI connection | named, not registered |
| 5 | Then shared run status, collaboration internal test, approval gates and loop prevention, RPG office | planned; order may change on results |

Keith reads the transcripts from steps 1 and 3 and judges quality before later steps go ahead.

## Limits

No model quality claim is made here. Provider and model facts were read from provider documentation on 2026-10-31 and are confirmed again at each stage-start. Each staging, provider, credit and environment action needs its own authorization.
