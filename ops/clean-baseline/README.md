# Clean-baseline operations

Replacement staging operations for a host built from a known Git commit. These files do not change application source. They do not claim the old host is clean, and they do not retire it.

Locked runtime selection from CLEAN-BASELINE-RUNTIME-01: **Node 24**. The workspace image is **`node:24-alpine`**. Node 22 is not the selected result. `aisandbox-prepare` refuses any other Node major.

## U1

Code preparation and static checks are the only work authorized with this task's empty `mutexes` and `runtimeNeeds`. A later operational run needs its own authorization. That control-plane update must add `LOCAL-RUNTIME` to both `mutexes` and `runtimeNeeds` before any runtime test; leaving `mutexes=[]` while setting `runtimeNeeds` is not a valid record. The current admission stays static-only. `localRuntimeAuthorized=true` is not capability evidence and is not execution permission. Runtime tests that share `LOCAL-RUNTIME` run sequentially. Establish local capability inside a disposable OS namespace before proposing a cloud test. A path prefix does not isolate systemd, PostgreSQL, Redis, or Docker. A cloud test needs its own authorization, a stated spending limit, and a cleanup scope. Static checks do not satisfy the focused operational tests and do not justify LOCK.

## U2

A stale `usage_records` row in `pending`, `running`, or `cancel_requested`, or a non-terminal collaboration row (`collaboration_runs.status=active`, or a referral in `pending_approval`, `approved`, or `in_progress`), blocks maintenance. Keith approves that one record from evidence. There is no automatic override, replay, age threshold, or mutation. Setting a terminal status does not establish that the work has stopped.

The canary submit scripts under `services/ai-service/scripts/` are not run on the replacement. The final quiescence sample detects an out-of-band enqueue.

## Phase vocabulary

One closed list is written by the scripts. A recovery path names only phases from this list.

| Phase | Written by |
|---|---|
| `preparing` | prepare, after the empty-target check and before packages |
| `prepare-failed` | prepare, on package or build failure |
| `prepared` | prepare, after post-build assertions |
| `first-start-pre` | first-start, before the marker is removed |
| `first-start-failed` | first-start, pre-start failure |
| `restore-pre` | restore, before the marker is removed |
| `restore-failed` | restore, pre-start failure |
| `quiescing` | backup or deploy, while writers are stopping |
| `quiesced` | backup or deploy, after the final zero sample |
| `prepared-for-backup` | backup, before the set is written |
| `work-detected` | backup or deploy, when the final sample is not zero |
| `mutating` / `mutating-failed` | deploy |
| `migrating` / `migrating-failed` | deploy |
| `starting` / `starting-failed` | deploy, while the marker is still present |

`aisandbox-maint exit` may name only `quiescing`, `quiesced`, `prepared-for-backup`, and `work-detected`, and only when HEAD and the migration hash are unchanged. On `work-detected`, exit takes a fresh quiescence sample under the operations lock before it removes the marker or starts a writer. `ZERO` continues through the unchanged-tree and restart checks. `ACTIVE` exits 11. `UNKNOWN`, malformed output, or a sampling failure exits 12. A refusal keeps the marker and leaves writers stopped. Work details are IDs only. Manual U2 resolution stays separately authorized. `aisandbox-deploy --from-maintenance` may name only `mutating`, `mutating-failed`, `migrating`, `migrating-failed`, `starting`, and `starting-failed`, and only while the failure class is pre-start.

## Pre-start failure

Pre-start failure means the marker is still present and no writer start is in the journal for this operation. The marker stays. Enabled units do not start at boot while the marker exists, because each writer unit asserts that the marker is absent. Recovery follows the rollback table. The pre-start summary says that no writer start is in the journal. It is not used after a start has been recorded.

## Post-start failure

Post-start failure means the marker has been removed, or a writer start is already in the journal, including a start that then crashed. After that point the record does not say that the writers never started. With the marker absent, enabled writer units can start at boot. That boot start is expected.

Post-start recovery:

1. Do not restore onto this host and do not overwrite the primary. Do not invent `DEPLOYED` from `aisandbox-maint status`.
2. Read health, and compare HEAD with the recorded `target_sha` and the applied migrations with that target.
3. If health passes and HEAD equals the recorded `target_sha` and the applied migrations match that target, leave that observation in the operation record. The later authorized recovery is a normal `aisandbox-deploy <target_sha>` with every existing deploy guard.
4. Do not use `aisandbox-deploy --from-maintenance` when the marker is absent.
5. If health fails, or the tree or schema evidence differs or is unavailable, keep this host as evidence. Use a separately authorized fresh recovery target at the recorded `pre_sha` and restore the pre-migration bundle there.

## Restart order

Any authorized writer restart removes the maintenance marker first, then starts the unit. Addendum Q3 is corrected: confirm the tree and schema are unchanged, remove the marker, then start `aisandbox-gateway` and `aisandbox-frontend`. `aisandbox-migrate` is the exception that starts while the marker exists. It has no install section and no marker assertion.

## Restore

Restore reproduces the backed-up persistent file set. After extract, on a target that passed the empty-target checks, it removes tracked files under `workspaces/`, `database/`, and `projects/` that the prepared checkout contains and the backup does not. A tracked file deleted on the source stays absent. Ownership, ACLs, and extended attributes remain exact-diff requirements. There is no overwrite mode. A populated primary (`DEPLOYED` present, or any empty-target check failing) is refused before data is written.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 10 | Refused. Lock held, empty-target failure, or a recovery path that does not apply. Nothing further is written when this happens before the operation starts. |
| 11 | Work active |
| 12 | Work unknown |
| 20 | Backup set failed. The backup owner restarts the previous writers when the tree and schema are unchanged. |
| 21 | Health failed after the marker was removed |
| 30 | Prepare, deploy, or restore failure before a clean finish |
| 31 | Prepare post-build assertion failed. Discard the target. Do not clean it in place. |
| 40 | Restore metadata or git-status diff. Writers are not started. Discard and re-prepare. |

## Install order

1. Stage this directory on the host as root. `aisandbox-prepare` copies it to `/usr/local/lib/aisandbox/clean-baseline` and the entry points to `/usr/local/sbin`.
2. Put the Git remote in `/etc/aisandbox/source-url` and the age recipient in `/etc/aisandbox/age-recipient.txt`.
3. `aisandbox-prepare <sha> --site public|localhost` builds a fresh target and does not run a health check. There is no default site.
4. Exactly one of `aisandbox-first-start` or `aisandbox-restore <bundle> <age-key>`.
5. Enable `aisandbox-backup.timer` only after backup and restore acceptance. The watchdog unit stays disabled unless AUTH-W is recorded. AUTH-W is not granted. Stop and restart around quiescence are deferred, so current testing requires the watchdog to stay disabled and inactive.

Package install adds `acl` and `attr` to the consolidated package list. PM2 is not installed.

## Caddy installation

`aisandbox-prepare <sha> --site public|localhost` installs pinned Caddy 2.11.7 from the recorded GitHub package only. The site argument is required. A missing, invalid, duplicate, or unexpected argument exits 10 before the operations lock and before any mutation. `--site public` installs `caddy/Caddyfile`. `--site localhost` installs `caddy/Caddyfile.drill`. Both files are copied unchanged to `/etc/caddy/Caddyfile`. Before `dpkg`, it masks `caddy.service` and `caddy-api.service` with persistent `systemctl mask` and checks those masks. It does not create or modify `/usr/sbin/policy-rc.d`.

`caddy/Caddyfile.drill` has no `basic_auth` block. A later authorized localhost activation check must not expect an unauthenticated 401. It verifies the existing routing: `/` redirects to `/en` with 307, and `/en` and the selected application health endpoint return their required successful responses once the application is ready. Those checks establish neither public-site authentication nor public TLS acceptance. No activation check has passed. `caddy/Caddyfile` keeps `basic_auth`. Its unauthenticated 401 and authenticated application checks remain required in the separately authorized deployment acceptance. Choosing a site does not unmask or start Caddy, change DNS, or authorize public access. The SSH-only firewall stays.

Three states may continue. Fresh: the package is absent, `not-installed`, or `config-files`, `caddy` is not on `PATH`, and both units are `not-found`. Retry-before-dpkg: the package is still absent or `not-installed`, and both units are already masked, inactive, and linked to `/dev/null`. Retry-after-dpkg: the package is `installed 2.11.7`, `caddy` is on `PATH`, and both units are already in that masked state; prepare does not download or install again. Any other result, including a probe whose exit code does not match its output, exits 30 before download.

After `dpkg` returns 0, and again before `PREPARED` is written, both units must be masked and inactive, with no `multi-user.target.wants` link and no helper-owned mask record. `PREPARED` then contains `caddy=masked`. Enabling or starting Caddy remains a separately authorized step. `caddy-api.service` stays masked. The regression mocks package and service commands. A real Ubuntu 24.04 install and reboot are not yet verified.

## Application group

`aisandbox.target` is the application group. It is an operator handle, not a readiness signal. `aisandbox-gateway`, `aisandbox-ai`, `aisandbox-cm`, `aisandbox-frontend`, and `aisandbox-watchdog` are members through `PartOf=aisandbox.target` and `WantedBy=aisandbox.target`. `PartOf=` does not start a member. `aisandbox-prepare` installs the target and leaves the target and those members disabled. `aisandbox-first-start` and `aisandbox-restore` enable the target and the four writers, then remove the marker and start each writer, then run the existing health check. They do not enable the watchdog. The watchdog stays disabled unless AUTH-W is recorded. AUTH-W is not granted, and target membership is not support for an active watchdog. Stop-before-quiescence and restart-after-health are not implemented. Caddy, `aisandbox-migrate`, `aisandbox-backup.service`, and `aisandbox-backup.timer` are not members. No entry point stops the target or treats the target as ready.

## ACTIVATION

Before `aisandbox-first-start` or `aisandbox-restore`, the operator writes `/etc/aisandbox/ACTIVATION` by hand. It is a root-owned regular file, not a symlink, mode 0600, with one nonempty line naming the recorded authorization for that host. A missing, malformed, unreadable, or incorrectly owned or protected file exits 10 before the operations lock, operation admission, or any marker, data, or service change. Scripts do not create this file. A missing `ops-test-mode` is not authorization. The line attests to a recorded authorization. It does not grant cloud or deployment permission, and it is not the Caddy unmask step.

## AI readiness

`health_wait` still requires gateway ready, container-manager health, and frontend `/en` within 120 seconds, and it still returns 21 on timeout. A result at or after that deadline is not success. Each probe and the retry sleep use only the time remaining. AI readiness is no longer the `Worker connected to ai-execution queue` journal line. It requires `aisandbox-ai` to be active with a nonzero MainPID, a Redis client whose name is exactly `bull:YWktZXhlY3V0aW9u`, an established socket whose local endpoint is that client's `127.0.0.1` port, whose peer is `127.0.0.1:6379`, and whose PID is that MainPID, and a positive TTL on `bull:ai-execution:stalled-check`. A MainPID change during that observation is retried. Redis credentials and raw client output are not logged. This host has not verified a live worker.

## Operator commands

- `aisandbox-prepare <sha> --site public|localhost`
- `aisandbox-first-start`
- `aisandbox-restore <bundle.tar.age> <age-key-file>`
- `aisandbox-deploy <sha>`
- `aisandbox-deploy <sha> --from-maintenance`
- `aisandbox-deploy <sha> --from-maintenance --allow-schema-ahead` only with `/etc/aisandbox/schema-ahead-approval`
- `aisandbox-backup`
- `aisandbox-maint status`
- `aisandbox-maint exit`

`--initial` and `--no-migrate` are refused.

## Rollback

| Failure | Action |
|---|---|
| Before `mutating`, tree and schema unchanged | The deploy owner restarts the previously active writers after the unchanged check. Exit 30. |
| During `mutating`, schema untouched | `aisandbox-deploy <pre_sha> --from-maintenance` |
| During or after `migrating`, fix-forward possible | `aisandbox-deploy <fixed_sha> --from-maintenance` |
| Additive schema and recorded approval | `aisandbox-deploy <pre_sha> --from-maintenance --allow-schema-ahead` |
| Otherwise | Fresh recovery target: prepare at `pre_sha`, restore the pre-migration bundle, then move the address under the existing deploy authorization. Do not restore onto the failed primary. |

`migration:revert` is not a path. Rollback does not use the old host, its snapshots, or PM2.

## What must never be done

- Do not start a writer while the maintenance marker exists.
- Do not overwrite a populated primary.
- Do not `chown`, `chmod -R`, or `setfacl -R` persistent paths. Identity is the pinned `groupadd --gid 7300` and `useradd --uid 7300 --gid 7300`, plus tar `--same-owner`.
- Do not enable the watchdog without AUTH-W. Do not treat the deferred stop/restart work, or a disabled inactive watchdog, as a passed activation requirement.
- Do not put secret values in this repository. Templates leave secret assignments empty.
- Do not treat `/metrics` 200 or a static check as acceptance.
- Do not describe the old host as clean.

## C2 deltas

C2 temporarily sets a real provider, one `PROVIDER_<X>_ENABLED=true`, `GLOBAL_EXECUTION_ENABLED=true`, and the spend caps in the gateway and AI env files on the host. Those values are not in the templates. They are reverted after C2. This task does not perform C2.

## Tests

Static, and run in this preparation step: `tests/static/t2.6-backup-callgraph.sh`, `tests/static/t4.4-ownership.sh`, `tests/static/t-target-membership.sh`, `tests/static/t-caddy-site.sh`, plus the phase-order and post-start wording checks. `t-caddy-site.sh` checks both site selections, rejected arguments, and sourcing compatibility. It does not run an activation check, and none is marked passed here. `tests/regression/t1-prepared-repeat.sh` checks the prepared Caddy, target, and watchdog assertions and the t1.6-repeat refusal with temporary files. It does not run first-start or an operational case. `bash -n` covers the shell files. `tests/regression/activation-gate.sh` checks the ACTIVATION file rules with temporary files and does not run first-start or restore. `tests/regression/ai-worker-ready.sh` checks worker readiness with mocked commands and does not start Redis or a service. `tests/regression/maint-exit-s9.sh` checks the work-detected exit rule with mocked commands and does not start a service.

Prepared and not run here: `tests/operational/t1-prepare.sh`, `t2-lock-and-fault.sh`, `t3-quiesce.sh`, `t4-metadata.sh`, `t4c-deleted-tracked.sh`, and `tb-post-start-reboot.sh`. They refuse unless `AISB_OPS_OPERATIONAL_TEST=1` and `ops-test-mode` exists. Acceptance on a real host asserts that `ops-test-mode` is absent.

T1.1 still fails when prepare's exit is nonzero, and it still requires the prepared-idle assertions. Its log check flags an application health probe: `/api/health`, a curl to `127.0.0.1` or `localhost` on port 3002, 4000, 4001, or 4002, or any other line containing `health`. The prepare notice `no health check is required` is not a probe. Neither is a curl that only downloads the PostgreSQL, Docker, Caddy, or NodeSource installer.

T3.7 remains an AI-SERVICE gap. The worker claim-miss branches are in `services/ai-service/src/worker/worker.processor.ts`: a failed pending claim marks a `running` row `failed` and returns, or logs a duplicate skip and returns. The AI-service specs that execute the worker call it once from a pending ledger. Timeout, harness-routing failure, and the stuck-watchdog threshold tests cover other paths. They do not demonstrate those two claim-miss branches. No application test is added here, and RUNTIME-01 is not reopened.

Nightly backup retention keeps seven non-pre-migration sets and pre-migration sets for 30 days. The backup set includes `quiescence.json`, the migration list, image digest, unit and configuration copies, and env names with file hashes. Secret values stay in the root secret store and are not part of this repository.

Operational tests under `tests/operational/` are executable and unexecuted. They require `AISB_OPS_OPERATIONAL_TEST=1` and a root-owned mode 0600 or 0400 `ops-test-mode` containing `DISPOSABLE_NAMESPACE=1`. That file is an operator assertion. It does not create or prove a disposable OS namespace, and it is not authority to run the operational cases. The later isolation preflight and the `LOCAL-RUNTIME` resource transition stay mandatory. `tests/regression/` exercises library functions with temporary files and mocked OS commands; it does not run an entry point or the fixture builder.

Each operational case is one invocation on a disposable host. T1–T3, T4, the Q3-order case, the post-start reboot case, the deleted-tracked-file case, and the fixture builder share one failure record. Recording is armed only after the disposable gate accepts the context. The case-state path is resolved, including parent symlinks, before the destination check or any directory creation. An unresolved path is rejected, and a resolved path under `/`, `/etc`, `/usr`, `/opt`, `/var`, or exactly `/var/lib` is rejected. A rejected fixture root does not create that record on a real host path. A nonzero exit writes `case-contaminated` and that disposable host is discarded before another case. Intentional reboot leaves the evidence file in place and does not record contamination when reboot succeeds. A failed reboot still writes the failure record and keeps the evidence. The no-ACL case unmounts its loop image on the way out. A failed unmount is retained while the remaining unmounts are still attempted. The original case status is preserved, and a cleanup failure is printed and included in the record. T4.2 snapshots include the planted file bytes or Redis value. The untracked file, sqlite file, ignored file, and both snapshot-store files are selected with `AISB_SNAPSHOT_FILES` for that comparison and cleared afterward. Git commands for `/opt/aisandbox` go through the repository owner. These preparations are not operational acceptance.
