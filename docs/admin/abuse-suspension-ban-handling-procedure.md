# Abuse / Suspension / Ban Handling Procedure

**Phase:** 65B  
**Reference:** PHASE-65A-DESIGN.md Section 4

---

## Purpose

Handle abuse reports, user restrictions, account suspensions, and bans per Phase 65A design. Operator-driven procedure; no ban/suspension API in platform. Actions are operational (support channel, config, manual intervention).

## Scope

**In scope:**
- Rate limit abuse (sustained 429; IP or user exceeding limits)
- Quota abuse (repeated EXCEEDED status; overage requests)
- Prohibited use (Terms violation; prohibited content; malicious behavior)
- Resource exhaustion (many sessions; high token usage; container abuse)

**Excluded:**
- Automated abuse detection (deferred)
- Ban/suspension API endpoints (deferred)
- Real-time blocking (platform has no such capability)

## Prerequisites

- Operator access to admin endpoints (INTERNAL_SERVICE_KEY)
- Access to user ops summary: `GET /api/internal/admin/users/:userId/summary`
- Access to logs/metrics for abuse indicators
- Platform owner or delegate for suspension/ban decisions
- Designated support channel for user communication

## Intake / Trigger Conditions

| Trigger | Source | Action |
|---------|--------|--------|
| **Support ticket** | User report, internal observation | Log; triage |
| **Metrics anomaly** | High 429 rate; elevated session/token volume | Investigate; correlate with user_id |
| **Quota EXCEEDED pattern** | User ops summary; repeated status | Review; decide |
| **Terms violation report** | User report, content review | Escalate to platform owner |

## Review / Verification Steps

1. **Gather evidence** — user_id, IP (if available), timestamps, endpoint, rate/volume
2. **Check user ops summary** — `GET /api/internal/admin/users/:userId/summary` for quota status, usage
3. **Review logs** — Rate limit hits, session creation pattern, termination reasons
4. **Classify abuse category** — Rate limit, quota, prohibited use, resource exhaustion
5. **Assess severity** — First offense vs repeated; minor vs serious

## Action Steps

### Warning (Operator)

1. Document abuse indicators in ticket
2. Notify user via support channel (e.g. "You have exceeded rate limits; please reduce request frequency")
3. Log decision: action=warning, user_id, reason, operator, date
4. No platform change; monitor for recurrence

### Temporary Restriction (Platform Owner or Delegate)

1. Obtain platform owner or delegate approval
2. Document: ticket, abuse evidence, decision log
3. **Restriction options** (out-of-band):
   - Revoke quota override if one was granted
   - Communicate restriction to user (e.g. reduced limits for N days)
   - Adjust config if platform supports per-user limits (future)
4. Set expiry if time-bound
5. Log: action=restriction, user_id, reason, operator, expiry, date

### Account Suspension (Platform Owner)

1. Platform owner approval required
2. Document: ticket, evidence, Terms reference, sign-off
3. **Suspension options** (out-of-band):
   - Prevent login via auth system (if supported)
   - Manual intervention; support channel to inform user
4. Log: action=suspension, user_id, reason, Terms reference, operator, date
5. Define suspension duration or "until appeal"

### Ban (Platform Owner)

1. Platform owner approval required; legal/compliance input if needed
2. Document: ticket, evidence, legal/compliance note if applicable, sign-off
3. **Ban options** (out-of-band):
   - Same as suspension; permanent; no appeal path unless policy allows
4. Log: action=ban, user_id, reason, operator, date
5. Retain evidence 12 months minimum

## Exception / Escalation Handling

| Condition | Action |
|-----------|--------|
| **Identity unclear** | Escalate to platform owner before acting |
| **Legal/compliance question** | Escalate to legal/compliance; do not act until resolved |
| **Disputed abuse** | Document both sides; platform owner decides |
| **Repeat offender** | Escalate from warning → restriction → suspension → ban |
| **Fraud suspected** | Escalate immediately; platform owner + legal if needed |

## Evidence to Retain

- Abuse indicators: user_id, IP, timestamps, endpoint, rate/volume
- Decision log: action taken, reason, evidence reference, operator, date
- Ticket reference
- User notification record (if sent)

**Retention:** 12 months minimum per PHASE-65A Section 7.1

## Signoff / Approval Requirements

| Action | Approval | Signoff |
|--------|----------|---------|
| **Warning** | Operator | Operator sign-off |
| **Temporary restriction** | Platform owner or delegate | Platform owner or delegate sign-off |
| **Account suspension** | Platform owner | Platform owner sign-off |
| **Ban** | Platform owner; legal if needed | Platform owner sign-off |

**Quarterly review:** Abuse decisions reviewed per PHASE-63 access control review.

---

**Reference:** PHASE-65A-DESIGN.md Section 4
