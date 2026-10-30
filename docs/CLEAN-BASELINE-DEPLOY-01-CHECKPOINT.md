# CLEAN-BASELINE-DEPLOY-01 — Checkpoint

**Task:** CLEAN-BASELINE-DEPLOY-01 — Preserve the old staging host, build and deploy the replacement, and accept it (slices A, B, C1 to C4)
**Status:** COMPLETE AND LOCKED — 2026-10-30 (C4 final acceptance)
**Lifecycle:** 4-STEP, run as authorized slices. **Evidence class at lock:** STAGING-RUNTIME (C2 PROVIDER-LIVE). **Decision record:** docs/CLEAN-BASELINE-GOV-01-DECISION.md.

## What acceptance means

ainow-staging-01 runs the recorded build and configuration, boots without PM2, serves the Builder journey and is restorable from an encrypted backup. Acceptance grants no invitations, no harness activation and no public launch, and it does not describe the old host as clean.

## Lifecycle record (main records)

| Slice | Result | Repository commits |
|---|---|---|
| A (AUTH-2, AUTH-3) | archival snapshot; old instance aisandbox-staging stopped 2026-10-26; its dedicated xAI key revoked; every A3 credential row resolved | afbc47213778dd5e61b642db1e3919d9496606d0 |
| B (AUTH-4, AUTH-4a) | ainow-staging-01 built from the frozen OPS-01 tooling; static IP moved; staging.ainow.biz behind basic_auth; redirect fix to the Caddyfile and its static check | b9cba67aa08156450b6fd144f93dc705c367fe04, ecbac4eaf14cedc3887a51374e137e5f1903c46d, 7ac97762c09917d1a52293bcc62d91a50fb8c9c7 |
| C1 (AUTH-5 to AUTH-5c) | core checks 1 to 10, one verification email, reboot #1; defects D1 (stale session after reboot) and D2 (revert lost on reopen) fixed by SESSION-STALE-01 and CHECKPOINT-PERSIST-03 | 9ee3aceb3c964c57b618a248edebacb7537303f2, 896cadf7df78edb77036936b7364c861e6759e2e |
| C2 (AUTH-6, AUTH-6b) | one Ask and one Build on xAI with caps, credits, checkpoint and revert; defect D3 (credits charged per token) fixed by CREDIT-UNIT-01 | 4847029aeae923d681a433e556e55f518efff00e, 5c599dfec6c11ebc40c0b91ffe058a6da40138ed |
| C3 (AUTH-7) | reboot #2 and persistence, one encrypted backup, restore drill R1 to R10 on a temporary instance, drill deleted, backup timer on | 8b658514fc1e8130acbd579df4c8a08b774c6f2a, 71760f477f889e6a2223bc1beb24292d796098bc |
| C4 (AUTH-8) | read-only final-state check after the first scheduled backup; this lock | cf4c20ae87d9679924391525a158c41ffb53f666, a557521cc55ab19341db4ff11d1aa427c840c5f7, ab9ae979d76b1b8c288a444630f88ba120d839d2, this record |

Fix tasks LOCKED during acceptance: SESSION-STALE-01, CHECKPOINT-PERSIST-01, CHECKPOINT-PERSIST-02, CHECKPOINT-PERSIST-03, CREDIT-UNIT-01 (each with its own checkpoint).

## Code changed by this task

Only its write scope: `ops/clean-baseline/caddy/Caddyfile` and `ops/clean-baseline/tests/static/t-caddy-site.sh` (redirect fix, ecbac4eaf14cedc3887a51374e137e5f1903c46d). Application changes came from the fix tasks above.

## Final state (2026-10-30T03:34:10Z)

| Item | Value |
|---|---|
| Host | ainow-staging-01 (machine id ec2494e33db4dcf7b6be5fc3b3d9a22b), static IP 18.136.141.186, Ubuntu 24.04, 8 GB / 2 vCPU |
| Build | DEPLOYED and HEAD 7317749c5b05a633bafa34552ebea90c3e07cb67; node v24.22.1; node:24-alpine sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 |
| Units | postgresql@15-main, redis-server, docker, caddy, aisandbox-gateway, aisandbox-ai, aisandbox-cm, aisandbox-frontend, aisandbox.target, aisandbox-backup.timer enabled and active; aisandbox-watchdog disabled; no PM2 |
| Configuration | gateway.env bf6864f9, ai.env 721f4772, cm.env 27780793, frontend.env b57c2b85, watchdog.env b155f864, Caddyfile 2b77968c; full hashes in the evidence |
| Flags | execution off; AI and email providers stub; xAI disabled; harness flags false; browser allowlist empty; external keys placeholder or empty; basic_auth on |
| Data | PostgreSQL 15 and Redis local on 127.0.0.1; balance of the test account 497 |
| Backups | timer nightly 03:30 UTC; scheduled set 20261030T033005Z COMPLETE (bundle 97eac9d9d320f142ce435f49a73ee1fcaa5a67af26f4549752ddb3e0bae30676); C3 acceptance set 20261029T040824Z (bundle 27abcdee5394860559babeb791fd2b26deec5639bc0b1fee9345abb3193e936b) also on Keith's PC; encrypted to Keith's age recipient age1eprthezeaxvpzscspqyacgftf2wd8ywcwhkn9u3d0hkxp3tkhawqz5r8l7 |
| Restore | drill aisb-c3-drill-01 passed R1 to R10 (restore about 1 minute 43 seconds) and was deleted 2026-10-29 |

## Evidence

- Slices A and B: C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-EVIDENCE-20261026\
- C1: C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-EVIDENCE-20261026\C1\ and C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-EVIDENCE-20261027\
- C2: C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-EVIDENCE-20261028\C2\ and C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-EVIDENCE-20261028\C2R\
- C3: C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-EVIDENCE-20261029\C3\
- C4: C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-EVIDENCE-20261030\C4\c4-final-state.out

## Acceptance criteria

| Criterion | Result |
|---|---|
| No slice starts without its own authorization | met (AUTH-2 to AUTH-8, each recorded before its slice) |
| AUTH-2 is not treated as authorization to stop the host; AUTH-3 remains separate | met (the stop ran under AUTH-3) |
| Slice B waits for the RUNTIME-01 and OPS-01 LOCK evidence | met (2026-10-26) |
| Slice A admission is not used as permission for later slices | met |
| C2 has its own PROVIDER-LIVE and CREDIT authorization | met (AUTH-6, AUTH-6b) |
| Final acceptance is C4, not C1 + C2 | met (this record) |
| The old host is not described as clean and is not retired by registration | met (stopped and unproven; D is separate) |
| Not LOCKED by an implementer | met (locked by the control plane) |

## Open items

- D: the old instance aisandbox-staging stays stopped and billed; day 25 review 2026-11-20, day 30 decision 2026-11-25 (AUTH-9 deletion or a cost-approved extension).
- Before real-user invitations (plan section 9 tier 2, with owners in the decision record): sign-up control, graceful worker shutdown, workspace isolation and disk quota, alerting (AUTH-W), daily off-host backups, and removal of the debug ingest calls to 127.0.0.1:7870.
- Keith copies the newest backup off-host weekly; the off-host file is root-only, so each copy uses the read-only-copy step until fixed.
- Follow-up candidates, not registered: preview start returning 400 while starting; empty usage_records.model; container-manager quota evaluation failing open; hardcoded Save Point text; checkpoint history bundle pruning; preview polling of a stopped session.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-30 by the control plane. Lane 1 released EMPTY; STAGING released UNOWNED; GOVERNANCE UNOWNED. ARCHITECTURE.md now records ainow-staging-01 (Caddy + systemd) as the CURRENT staging topology and the PM2 host as HISTORICAL.
