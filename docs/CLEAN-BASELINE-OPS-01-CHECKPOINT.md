# CLEAN-BASELINE-OPS-01 — Checkpoint

**Date:** 2026-10-26
**Status:** COMPLETE AND LOCKED (LANE-DONE and LOCK recorded together in Step 3 consolidation)
**Basis:** repository commit `101627f402b3c518001fea6de267bf3e17431a85`, the T2 window closure. Lock record: `docs/CLEAN-BASELINE-GOV-01-DECISION.md`, section "OPS-01 Step 3 consolidation, LANE-DONE and LOCK — 2026-10-26".
**Application target:** `36f9a213b7e16c0cb12587a2d74cd0f679fdc54c`.
**Lane:** Lane 1 released EMPTY. Lane 2 EMPTY. Lane 3 DISABLED.
**Mutexes:** STAGING released UNOWNED (`stagingAuthorized=false`). GOVERNANCE UNOWNED.

## What this lock records

The replacement operations files under `ops/clean-baseline/` (prepare, first-start, deploy, backup, restore, maint, their library, units and focused tests) are accepted against Addendum 01 and governing corrections a to c, by focused operational tests on disposable Lightsail guests in account 002559670476, ap-southeast-1, Ubuntu 24.04 LTS, medium_3_0. Production files under `ops/clean-baseline/` last changed in repository commit `af8fe24f9da16036a9cb15e6b48afa0673290d2d`; tests last changed in `11fd9ecb907e109069cd96e0a12e9c10f2215a8b`.

## Acceptance evidence

All archives are under `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-OPS-01-work\`. On 2026-10-26 each was verified by size and SHA-256, and every capture manifest inside by hashing file bytes: 19 archives, 107 captures, 1637 files, none holding an env file, ACTIVATION, case-evidence, bundle or key.

| Test | Evidence |
|---|---|
| T1.1, T1.6, t1.6-repeat refusal | base-05 |
| T1.2 | base-06 |
| T1.3, T1.4 | base-08 |
| T1.5 | base-27 (t1.5-unprepared, t1.5-sha, t1.5-redis), base-29 (t1.5) |
| T2.1, T3.2, ten T3.1 conditions | base-09 |
| T2.2, T2.5, t2.4-deploy | base-30, base-31 |
| T2.3 | base-13 (mutating point through the reboot), base-14 (mutating point with `--from-maintenance` rollback; migrating point), base-15 (starting point) |
| T2.4 standalone, T3.5, T3.6 | base-12 |
| T2.6, T4.4 | static checks `tests/static/t2.6-backup-callgraph.sh`, `tests/static/t4.4-ownership.sh`, as Addendum 01 defines them |
| T3.1 four UNKNOWN conditions, T3.4, correction a | base-11 |
| T3.3 | base-10 |
| T4.1, correction c populated-target refusal | base-20, base-21 |
| correction c deleted tracked file | base-24 |
| T4.3 | base-25 |
| T4.2 | base-27 (eight refusals), base-29 (t4.2-redis); t4.2-noacl under the exception below |
| correction b | base-15 |

| Archive | Bytes | SHA-256 |
|---|---:|---|
| `base05\ops01-t16-captures.tar.gz` | 40098 | `1c47d623df55f1fdf504712458f88181d0c098c7b980a9f0f908e8526e0f9113` |
| `base06\ops01-t12-captures.tar.gz` | 24174 | `a0e4afdb28b3cf5555f6e0dadaaf79b5e7f5f863dedd0ae458344a75325ce54d` |
| `base08\resume\ops01-t134-captures.tar.gz` | 19015 | `256d296a5af22199ea969ddcda8a772a2104915b3e42befcf7cf31f9737f6955` |
| `base09\ops01-base09-captures.tar.gz` | 50256 | `e478a8d281113a8233bb0d8867acb7bc8ebb8e2c0f4f0e0000b136f8a4ec9b9a` |
| `base10\ops01-base10-captures.tar.gz` | 42226 | `8f20b56c7cde0cffbcfd65e969e7447dd5c19298d6736faeab5f220b7d469c60` |
| `base11\ops01-base11-captures.tar.gz` | 45953 | `b98c4ecb5075f0accb97b5cf8f4072c242221b3461e53d5deac69c27c4cb69f3` |
| `base12\ops01-base12-captures.tar.gz` | 70742 | `31e902ebafbd405e66ba5ea0b8320c7fa3a8094cfac231b958b79d9bdae4b3b5` |
| `base13\ops01-base13-captures.tar.gz` | 51270 | `17f4bda2f399312fb11fe64d8f0127a8d50774dbc1bfd06fa16661dafdcaeaba` |
| `base14\ops01-base14-captures.tar.gz` | 68696 | `5f24f5dde75a641f4a6b962080d839921be3d47bf0b6dcdf16c8325e162050a7` |
| `base15\ops01-base15-captures.tar.gz` | 60799 | `53e54eb12ebf141eab14e84344148a64a9a4ad8697304ca5d8e462382e7c1d6e` |
| `base20\ops01-base20-captures.tar.gz` | 48654 | `c72ba599869563a63d0e1720392eac3307acba9728533ef1c50e0b356e18dac6` |
| `base21\ops01-base21-captures.tar.gz` | 32591 | `6c0b95af2d47dd882446de5e66dfe0f8d89d3d1dd1c0b1e160c49f75e45ec2b1` |
| `base24\ops01-base24-captures.tar.gz` | 25986 | `95dd0d8b2e3756b74343b7b4d0e036a04974c44a7a6e2de9b7470d2391fe8448` |
| `base25\ops01-base25-captures.tar.gz` | 17833 | `1f3d0cd34f04337be23150b177df7dee737269852b5db9d19223e4e91ffc06fa` |
| `base27\ops01-base27-captures.tar.gz` | 30382 | `8c343110625f12b86e72713855404d5083ab9fa47e1d8862ba05e9861134d77e` |
| `base28\ops01-base28-captures.tar.gz` | 47696 | `598a239684c8bc49445df341aa03eb1851053d8c51bf4977ae67b1e7f45ea6b3` |
| `base29\ops01-base29-captures.tar.gz` | 30299 | `8c54aed259f24bea882ef77ec2dacec10aac3c2a6670e0283b503ae889709047` |
| `base30\ops01-base30-captures.tar.gz` | 52355 | `bae2b1ea8fd3c381a517beb065713cd72ddb3f9af4343e56fc20e89341c90d19` |
| `base31\ops01-base31-captures.tar.gz` | 52014 | `8883d85b75ca35947123f82aa87ee415303e19dd6d43580712c3d0ebbc5afe9c` |

base-28 is setup and the source backup for base-29; base-22 and base-26 were likewise setup and backup sources, and the base-03 prepare-only evidence is not cited for a test. Failed or stopped runs (base-04, base-07, base-16 to base-19, base-23) and the failed steps named in the records of other runs are not evidence.

## Documented exception: t4.2-noacl

Keith decided on 2026-10-26 to accept T4.2 with t4.2-noacl recorded as FIXTURE_UNSUPPORTED on this kernel. The Ubuntu 24.04 LTS guest kernel rejects the ext4 mount option `noacl`, so the fixture cannot be built, as observed on base-27, where the case before the amendment exited 32. Under the 2026-10-25 amendment the case first probes, then records FIXTURE_UNSUPPORTED and exits 77 without calling `aisandbox-restore`; `tests/static/t-redis-noacl.sh` checks this statically, and the probe version has not run on a guest. The restore refusal for a target without ACL support is unchanged and has not run on a guest. The exception covers t4.2-noacl only and is not evidence.

## Outside OPS-01

T3.7 (stalled redelivery and duplicate delivery in the AI worker) stays a gap for a later AI-SERVICE task, as recorded on 2026-10-08.

## Integrated validation

On the tree at `101627f402b3c518001fea6de267bf3e17431a85`: all 14 static scripts and all 12 regression scripts under `ops/clean-baseline/tests/` exited 0, and `bash -n` passed on all 43 shell files. Evidence carry-over for runs made before later production corrections is recorded with each correction (`eafab11`, `28aa667`, `64b49a0`); every restore case ran after `af8fe24`.

## What this lock does not record

DEPLOY-01 stays READY / NOT_READY and unadmitted. No deployment, host access, DNS change, invitation, live provider call, spending or Git mutation is accepted or authorized. `HOST_CLEAN=NO`. `P7_ACCEPTED=NO`. `EXEC-01C6A=NOT_READY`. The ARCHITECTURE replacement row stays PLANNED. The T2.5 row-count comparison matched empty tables, the clean-baseline state. `localRuntimeAuthorized` stays true; `providerLiveAuthorized` and `creditAuthorized` stay false.

## Closure records

- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/control-plane/lane-saturation-state.json`
- `docs/CLEAN-BASELINE-GOV-01-DECISION.md`
- `docs/CLEAN-BASELINE-OPS-01-CHECKPOINT.md`

No file under `ops/clean-baseline/` changes in this closure. `docs/control-plane/SATURATION_PROOF.json` is the validator output for this end state.

## Validator

The unchanged `scripts/validate-lane-capacity.ps1` is run with its default proof path after GOVERNANCE is released. Bound inputs for this end state:

- occupancyHash: `942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`
- sidecar file SHA-256: `6c1ec04f6aee4662454d14101bc8bd7287f41f649d29a6c68bec22842aa00ac5`
- validator sidecarSha256 (canonical JSON): `450dd3be1aaa347d6b3fa8744e10265730522a04cf5bd407763202bb8639daa9`
- mutexCatalogSha256: `64232fa4b478f75a4b5542342d1bfa868398338a7b60cd86233552dd64c8d4df` (catalog unchanged)

A pre-run of the unchanged validator on these files, with its proof written outside the repository, returned PASS, exit 0, idleCode `NO_PAIRWISE_ADMISSIBLE_CANDIDATE` and no admissible FORCING candidate; AGENT-PLATFORM-EXEC-01C, AGENT-PLATFORM-EXEC-01C6 and PREVIEW-STOP-STAGING-APPLY-01 stay `ADMISSION_UNCERTAIN`.

Pre-lock proof, preserved before that run: `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-OPS-01-work\SATURATION_PROOF-before-ops-01-lock.json`, SHA-256 `730f4194825ffe07462d4a57f2b14e7589ee8ca2f3b17bcd3e3950befbb268c1`.
