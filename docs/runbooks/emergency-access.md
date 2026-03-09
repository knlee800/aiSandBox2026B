# Runbook: Emergency Access

## Title

Emergency Access

## Trigger

Platform down or critical failure and normal operator access is unavailable. Use only when documented emergency procedure is required.

## Severity

P1 (Critical) — Platform unavailable.

## Prerequisites

- Documented emergency access procedure (this runbook)
- No backdoors; no undocumented credentials; all access auditable

## Procedure

1. **Verify emergency** — Platform down; normal access unavailable.
2. **Use documented procedure only** — No ad-hoc credentials; no undocumented paths.
3. **Log all actions** — Every step; timestamp; operator identity.
4. **Post-incident review required** — Emergency access use triggers mandatory review.

## Constraints

- All access must be auditable
- No backdoors
- No undocumented credentials
- Post-use: full review and sign-off

## Post-use

- Document: when, why, what actions, outcome.
- Platform owner review and sign-off.
- Update runbook if procedure gaps found.

**Reference:** PHASE-63A-DESIGN.md Section 5.3
