# TESTER-SETUP-01 — Checkpoint

**Task:** TESTER-SETUP-01 — Staging access for a named tester
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered by GOV-OS-06. Keith named the tester (his own second account, user ff99eb72-e344-447a-b36c-4138fcaf6478, which he signed up himself), approved the draft and admitted it on 2026-11-06.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and CREDIT | 12c98aba9117a6c62fe825c31632468c4b3a4655 |
| 2. Host script | run by the control plane from the host | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Host script

ts1-host.sh (SHA-256 6657d188…, checked on the host before the run) confirmed the host, the deployed commit 951ee83, the account by id and email and its role user, and that it had no access row. Before: email not verified, 0 access rows, 0 entitlement audit rows, balance 500. It marked the email verified (1 row), inserted the access row (harness on, Agent write on, daily token limit 500000, updated by Keith) and one entitlement audit row in one transaction (audit 1c260412-20c2-48c6-aefe-048d6167ead0, reason stating the control plane applied it from the host as Keith approved). After: verified, row true|true|500000, 1 audit row, balance 500. The other access rows hash the same before and after. AI_PROVIDER stub, GLOBAL_EXECUTION_ENABLED false; gateway.env and ai.env at their baseline hashes. No key text in the output.

Evidence in `C:/Users/knlee/aisb-preflight/TESTER-SETUP-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `ts1-host.sh` | 4764 | `6657d188aba6865a3113e4ed28aee0688653f7cfff5fb24deb3c93f77b8b996f` |
| `ts1-host.out` | 628 | `fb28e8a6ace77f295b6b79cfefb934a07401b9f6188862d9a868c31e34d73152` |

## Acceptance criteria

All four met. Not LOCKED by an implementer: locked by the control plane.

## Limits

- AI runs stay off on staging until TESTER-WINDOW-01 opens the window; until then the account sees Agent mode and the team page but runs are refused.
- Credits: the account keeps the free-plan balance of 500; no credit rows were written. A top-up is a separate step if it runs low.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. Lane 1 released EMPTY; STAGING and CREDIT released UNOWNED; stagingAuthorized and creditAuthorized false.
