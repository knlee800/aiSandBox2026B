# STAGING-DEPLOY-02 — Checkpoint

**Task:** STAGING-DEPLOY-02 — Deploy the four locked follow-up tasks to ainow-staging-01
**Status:** COMPLETE AND LOCKED — 2026-10-31
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered on Keith's approval, then admitted to Lane 1 with STAGING | 324f9542ed2e94645a16823bf9a5aa1b48fd2531, ebed96b5522e9a06a5d88d61441b9973be2378e8 |
| 2. Deploy and checks | one deploy block, Keith's browser check, one read-only block; Cursor desktop, VPN off | host only |
| 3. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What was deployed

ainow-staging-01 (machine id ec2494e33db4dcf7b6be5fc3b3d9a22b) moved from 7317749c5b05a633bafa34552ebea90c3e07cb67 to 1b5892e7e9306c522b68e5e80b08673888ef98a4 with aisandbox-deploy on 2026-10-31, 07:41:51Z to 07:46:33Z. This carries DEBUG-INGEST-01, CM-QUOTA-DEAD-01, USAGE-MODEL-01 and SAVEPOINT-I18N-01. No migration, package, compose, environment or ops file changed. Cursor stopped the deploy window with an agent-looping warning after the block had finished and wrote no report, so the reviewer read the saved evidence; there was no retry.

## Results

| Check | Result |
|---|---|
| HEAD and DEPLOYED before | 7317749c5b05a633bafa34552ebea90c3e07cb67 |
| HEAD and DEPLOYED after | 1b5892e7e9306c522b68e5e80b08673888ef98a4 |
| aisandbox-deploy | exit 0, one run |
| Migration hash | unchanged, a9fc22c7ba5a92b080eea0cb9b88d3f7631127a5b1fefa20618ca05c7a1bfe49 |
| Configuration files and flags | unchanged: execution off, AI and email providers stub, xAI off, basic_auth on |
| Units | 8 of 8 after the deploy; 9 of 9 with the backup timer at the read-only check |
| No-login probes | 401 on all 4 |
| Gateway health and frontend /en | 200 |
| Keith's browser check, before the read-only block | opened project C1 repeat and file ACCEPT.md; read the Save Point panel in zh-TW and zh-CN and accepted the wording |
| no such table and Task 9.5A in the container-manager log since the deploy | 0 and 0 (8 log lines in total) |
| 127.0.0.1:7870 and checkAndEnforceQuota in built code | 0 files in the three services and frontend/.next, excluding its cache |
| resolveLedgerModel in the built worker | present |

Evidence in `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-02\` (the out and err files of the deploy are UTF-16, from PowerShell 5 redirection):

| File | Bytes | SHA-256 |
|---|---|---|
| `sd02-deploy.out` | 7584 | `811c8c106d1ecd5691ac13e4ca3c420bf78611dd17b43b32d0b677e2d767b3c6` |
| `sd02-deploy.err` | 4096 | `304cc520bb27dc6faf242b9a983e060b674ca9282b485555539fb0bf2ce70a03` |
| `sd02-deploy.rc` | 3 | `13bf7b3039c63bf5a50491fa3cfd8eb4e699d1ba1436315aef9cbe5711530354` |
| `sd02-check.out` | 2224 | `535e30cf7f2f9abaf03715603e5f31e0d7ff01a96da86f75bf888c634edc7bfe` |
| `sd02-check.err` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `sd02-check.rc` | 3 | `13bf7b3039c63bf5a50491fa3cfd8eb4e699d1ba1436315aef9cbe5711530354` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| HEAD and DEPLOYED at the target, clean tree, no maintenance marker, migration hash unchanged | met |
| Configuration hashes and flags unchanged | met |
| Units active, no-login probes 401, health probes 200 | met |
| After workspace use, no no such table lines since the deploy | met |
| No reference to 127.0.0.1:7870 in built code | met |
| Keith reads the Save Point panel in zh-TW and zh-CN and accepts or corrects the wording | met (accepted) |
| Not LOCKED by an implementer | met (locked by the control plane) |

## Deploy-time items of the deployed tasks

Locked task bodies are not edited; this record carries the result.

| Task | Item | Result |
|---|---|---|
| DEBUG-INGEST-01 | debug calls gone from the deployed build | closed |
| CM-QUOTA-DEAD-01 | no no such table lines after the next authorized deploy | closed |
| SAVEPOINT-I18N-01 | Chinese wording not yet seen in a browser | closed |
| USAGE-MODEL-01 | next real provider execution has a non-empty usage_records.model | open; no provider execution was authorized |

## Open items

- The USAGE-MODEL-01 criterion stays open until a real provider run.
- Unchanged: Keith's weekly backup copy, first due about 2026-11-05; D (AUTH-9) review 2026-11-20 and decision 2026-11-25.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-31 by the control plane. Lane 1 released EMPTY; STAGING released UNOWNED; stagingAuthorized=false; GOVERNANCE UNOWNED.
