# Manual Quota Adjustment Procedure

**Phase:** 65B  
**Reference:** PHASE-65A-DESIGN.md Section 5

---

## Purpose

Handle manual quota adjustments per Phase 65A design. Operator-driven procedure; no quota adjustment API in platform. Actions are out-of-band (config changes, manual DB updates). Use when user legitimately needs higher limit or temporary override.

## Scope

**In scope:**
- Temporary quota override (e.g. higher session limit, token limit)
- Time-bound adjustments
- Legitimate business need (e.g. pilot, enterprise trial)

**Excluded:**
- Quota adjustment API (deferred)
- Automated quota scaling
- Permanent default changes (those are product/config, not admin override)

## Prerequisites

- Platform owner or delegate approval required
- Access to quota configuration or database (per deployment)
- Understanding of quota model: max active sessions, rolling 24h sessions, rolling 24h tokens
- User ops summary access: `GET /api/internal/admin/users/:userId/summary`

## Intake / Trigger Conditions

| Trigger | Source | Action |
|---------|--------|--------|
| **User request** | Support ticket, sales, account manager | Log; verify; obtain approval |
| **Pilot/trial** | Business decision | Platform owner approval |
| **Compensation** | Service issue; goodwill | Platform owner approval |

## Review / Verification Steps

1. **Identity verification** — Confirm user_id; no cross-user action
2. **Legitimacy check** — Verify business need; not abuse accommodation
3. **Current state** — Check user ops summary for current quota, usage
4. **Approval** — Platform owner or delegate sign-off
5. **Time-bound** — Define expiry if temporary
6. **Reversibility** — Document rollback steps

## Action Steps

1. Obtain platform owner or delegate approval
2. Document: user_id, old limit, new limit, reason, operator, expiry (if any)
3. **Execute adjustment** — Per deployment: config change, DB update, or feature flag
4. Log completion: user_id, old/new limit, reason, operator, date, expiry
5. Notify user via support channel (if applicable)
6. **Calendar reminder** — If time-bound, set reminder to revert at expiry

## Exception / Escalation Handling

| Condition | Action |
|-----------|--------|
| **Identity unverified** | Do not proceed; escalate to platform owner |
| **Abuse accommodation** | Do not grant; follow abuse procedure instead |
| **No config path** | Document limitation; escalate for platform change |
| **Incorrect adjustment** | Per rollback procedure below |

## Rollback / Correction Handling

| Scenario | Procedure |
|----------|-----------|
| **Incorrect quota** | Revert to default or previous value; log correction |
| **Expiry reached** | Revert to default; log; notify user if needed |
| **Abuse detected** | Revoke override immediately; follow abuse procedure |

## Evidence to Retain

- Ticket; user_id; old/new limit; reason; operator; date; expiry
- Approval record (platform owner or delegate sign-off)
- Completion confirmation
- Revert/correction record if applicable

**Retention:** 12 months minimum per PHASE-65A Section 7.1

## Signoff / Approval Requirements

| Action | Approval | Signoff |
|--------|----------|---------|
| **Manual quota adjustment** | Platform owner or delegate | Platform owner or delegate sign-off |

**Monthly review:** Quota adjustments reviewed per admin action audit (PHASE-65A Section 7.2).

---

**Reference:** PHASE-65A-DESIGN.md Section 5
