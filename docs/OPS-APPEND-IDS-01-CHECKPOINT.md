# OPS-APPEND-IDS-01 — Checkpoint

**Task:** OPS-APPEND-IDS-01 — A refused deploy lists what is still open
**Status:** COMPLETE AND LOCKED — 2026-11-04
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-04. Registered in 8e2e733085bfa661b6140e61f240344c9d3006d8, admitted in 8c18e0c95fd0736191fa420a8e558d44f3ba258a. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

append_ids_only in ops/clean-baseline/lib/ops-lib.sh now selects usage_records.execution_id (cast to text), collaboration_runs.collaboration_run_id and collaboration_referrals.referral_id instead of a missing id column. The WHERE conditions, run_bounded, runuser, the psql flags and || true are unchanged. New mocked regression test ops/clean-baseline/tests/regression/append-ids-only.sh (13 checks) touches no database.

## Implementer

Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High.

## Control-plane review

Read the diff. Reran in Git Bash: append-ids-only.sh passed=13 failed=0; maint-exit-s9.sh passed=9 failed=0; bash -n ops-lib.sh exit 0.

## Limits

The host still runs the old ops-lib.sh until STAGING-DEPLOY-03 installs this one with a hash check.
