# GOV-ACCESS-PLAN-01 — Checkpoint

**Task:** GOV-ACCESS-PLAN-01 — Plan ACCESS-READY-01: ready for users other than Keith
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP. No implementation lane.
**Source:** Keith asked on 2026-11-05 to plan ACCESS-READY-01 and approved the plan on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Registration | planning task registered | 7df742a70598c068ee366e592bc4eaf817b6ad00 |
| Close | the plan document, this checkpoint, the registrations below | this record |

## How the plan was made

Fable 5.1 drafted docs/ACCESS-READY-01-PLAN.md through Cursor in read-only mode (requested claude-fable-5-1-thinking-high, resolved "Claude Fable 5.1 300K High"). The control plane checked its claims against the code and found them correct; it resolved one assumption (POST /api/events/* is covered by the global internal-service guard), added one correction (ACCESS-01C and KNOW-02 change the same frozen contract and must not overlap), and recorded that the daily spend cap has never counted, so the spend caps written into earlier live windows protected nothing. Keith approved the plan with the recommended decisions D1 to D7: per-model credit multipliers; per-plan limits with per-user overrides; disclosure of provider storage now and stateless continuation before a paid launch; Keith as the only admin; the free plan plus a credit grant for a second user; authenticated Socket.IO; daily caps in credits.

## Registered by this record

| Task | Slice | Second-user checklist |
|---|---|---|
| ACCESS-01A | S1 Socket.IO auth (first) | yes |
| ACCESS-01B | S2 entitlements table | yes |
| ACCESS-01C | S3 signed Agent profile | yes |
| ACCESS-01D | S4 per-plan limit and balance check | yes |
| ACCESS-01E | S5 credits by model | paid launch |
| ACCESS-01F | S6 daily caps from the ledger | yes |
| ACCESS-01G | S7 settings table | paid launch |
| ACCESS-01H | S8 Limits page | paid launch |
| ACCESS-01I | S9 knowledge entitlements | paid launch |
| ACCESS-01J | S10 stateless continuation | paid launch |
| ACCESS-LIVE-01 | S11 second-user check on staging | yes |
| LIMITS-PER-USER-01 | per-user numeric overrides | later |

All READY with startCondition NOT_READY, saturationClass OPTIONAL, productClass CURRENT; ACCESS-01A has its write set, the others are PROVISIONAL. Nothing admitted. COLLAB-AUDIT-01 is on the second-user checklist (its own readiness condition).

## Dispositions

| Follow-up named in the plan or review | Disposition |
|---|---|
| The eleven slices and LIMITS-PER-USER-01 | registered (12) |
| recordExecutionCost has no production caller | superseded by ACCESS-01F |
| TokenQuotaGuard has no admin bypass | superseded by ACCESS-01D |
| usage_records.model empty for provider runs | superseded by USAGE-MODEL-01 (locked) |
| COLLAB-LIMITS-ENV-01 | superseded by ACCESS-01G (its four limits become settings keys) |
| Port 4000 reachability | superseded by ACCESS-LIVE-01 |
| Admin assignment procedure | superseded by ACCESS-01G's design step |
| frontend/components/Timeline.tsx dead socket prop | dropped by Keith: unused component; ACCESS-01A makes a stray socket harmless |

FOLLOWUPS: 12 registered / 6 superseded / 1 dropped / 0 undisposed

## Not changed

PRD.md and ARCHITECTURE.md (changes proposed in the plan, made with the slices). basic_auth stays on; no private-beta decision.

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. GOVERNANCE UNOWNED.
