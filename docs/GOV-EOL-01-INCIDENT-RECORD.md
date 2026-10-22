# GOV-EOL-01 — Cursor line-ending replay incident — RECORD

**Task:** GOV-EOL-01 (registered in commit e92fe7b, 2026-10-22)
**Nature:** GOVERNANCE / EVIDENCE (no implementation lane)
**Lifecycle:** 4-step governance; this record is Step 3
**Authority:** Keith approved GOV-EOL-01 and its four steps on 2026-10-22. The post-lock notes this step appends are an explicitly approved documentation correction. No lock, status line, criterion, stage-start document, evidence file, package or result of any affected task changes.

---

## 1. Scope

GOV-EOL-01 was registered for four locked tasks: PM2-RECOVERY-P5-INVENTORY-01, PM2-RECOVERY-MECH-EXP-01, PM2-RECOVERY-MECH-EXP-02 and PM2-RECOVERY-MECH-EXP-03.

Scope finding, Step 3 review, 2026-10-22: a fifth locked task, PM2-RECOVERY-P5-J2-SEARCH-01, had a recorded hash contradicted in the same way (its stage-start line 656 cites the LF hash of `section-14.md`). Keith decided on 2026-10-22 that it gets a post-lock note too.

Two further locked tasks own affected files that no record cites by hash: PM2-RECOVERY-VERIFY-01 (three `STEP4-VERDICT.txt` files) and PM2-OVERLAY-UNKNOWN-01 (`build-r3-archive.ps1`, `verify-r3-archive.ps1`). Two scripts in `C:\Users\knlee\aisb-k4-evidence` (`check-readonly-32.ps1`, `regen-manifests.ps1`) and the repository's `.env.production.example` and `.env.staging.example` belong to no task record. None of these contradicts a record, so they get no note; they are listed in section 5.

## 2. Cause

Verified by a read-only side investigation on 2026-10-22, and by Keith's removal test:

- Leftover Cursor inline-diff records, `cursorDiskKV` keys `inlineDiff:<workspace>:<id>` in `D:\CursorData\User\globalStorage\state.vscdb`, made Cursor re-save each referenced existing file at every window start, with its stored CRLF content.
- Deleting a Cursor conversation does not remove these records. Deleting a file's record stops the rewrite of that file: Keith's four-record test, then the full removal, followed by Cursor restarts that rewrote none of the files.
- On 2026-10-22 at 09:10:21 +0800 Cursor rewrote 120 files this way in one second: 99 under `C:\Users\knlee\aisb-preflight`, 10 in this repository and 11 in `C:\Users\knlee\aisb-k4-evidence`. The bytes were the same CRLF bytes written at earlier starts.
- A separate Cursor profile (`D:\CursorData-EXP03`, since deleted) rewrote 10 EXP-03 step4-closure files on 2026-10-14 at 17:47:52 in the same way.

Not explained: the 2026-10-02 18:02 rewrite, recorded in the EXP-03 stage-start section 18.5, has no Cursor history entry.

## 3. Timeline: no accepted run used CRLF bytes

Times are +0800. "First recorded CRLF" comes from Cursor's local history and from the EXP-03 stage-start record; Cursor's history missed at least one write.

| Task | Evidence produced and locked | First recorded CRLF | Accepted result |
|---|---|---|---|
| PM2-RECOVERY-P5-INVENTORY-01 | runs 2026-09-28; locked 2026-09-28 21:44 (`cf50b20`) | 2026-09-29 08:58 | unaffected: conversion after lock |
| PM2-RECOVERY-P5-J2-SEARCH-01 | run 2026-09-29; locked 2026-09-29 21:23 (`680387c`); its Step 4 lock review (stage-start section 15.2) verified `section-14.md` as LF | 2026-10-01 10:08 (`section-14.md`); 2026-10-13 23:55 (the other two) | unaffected: conversion after lock |
| PM2-RECOVERY-MECH-EXP-01 | all 22 `SHA256SUMS` entries verified LF 2026-10-02 00:23; locked 2026-10-02 11:46 (`d642517`) | 2026-10-02 09:56 | unaffected: 8 CRLF files already recorded at lock, cause unknown then |
| PM2-RECOVERY-MECH-EXP-02 | locked 2026-10-02 14:59 (`946050c`) | 2026-10-02 18:02 | unaffected: conversion after lock |
| PM2-RECOVERY-MECH-EXP-03 | C-1 ran 2026-10-02 18:43; locked 2026-10-04 12:29 (`1abd3b6`) | 2026-10-02 18:02, before C-1 | unaffected: Keith restored two of C-1's five sources to LF at 18:34, and all five source hashes equalled `SHA256SUMS` at the run (stage-start section 18.3); the lock recorded the remaining CRLF files |

The 2026-10-02 three-file restore recorded in the EXP-03 stage-start section 18.5 was undone for `Assert-C1.ps1` by the replay from 2026-10-13 until 2026-10-22.

## 4. Cleanup and restore, 2026-10-22, before this record

These actions preceded this record. The record-first rule was not followed for them.

- Keith removed the 152 inline-diff records that pointed at existing files: 4 in a test, 116 active and 32 inactive, each batch with a verified backup.
- Keith restored 78 files to their recorded LF hashes, each batch with a verified CRLF backup. A Cursor restart then rewrote none of them.
- The six repository files that differed from HEAD only by line endings were returned with `git checkout` to their normal autocrlf CRLF working-tree form. HEAD was never affected.
- Keith deleted the Cursor profiles `D:\CursorData-EXP03` and three `Cursor-EXP03-clean-*` profiles, and kept one renamed copy, `D:\CursorBackup\EXP03-beaca904-DO-NOT-OPEN-IN-CURSOR`.

## 5. Files

Evidence (GOV-EOL-01 Step 2, verified by the reviewer):

- `C:\Users\knlee\aisb-preflight\GOV-EOL-01\evidence\side-session-notes\`: byte copy of the investigation's 110 files (report, per-file table, probes, removal and restore scripts, inline-diff backups and CRLF backups). Manifest `C:\Users\knlee\aisb-preflight\GOV-EOL-01\evidence\SOURCE-MANIFEST.sha256`, SHA-256 `0feed40f3b32b487744bc25cd7b1349a0b8cc78bc0f34dcbf692a77a3d334993`.
- `C:\Users\knlee\aisb-preflight\GOV-EOL-01\FILE-STATE-2026-10-22.tsv`, SHA-256 `16ffbfc108b84595a1b22709a40aba7ab54f7bae0a55ad21cc4aeff547cc8425`: class, path, current SHA-256 and size of the 78 restored and the 32 unreferenced files.

Restored to their recorded LF hash (78). The reviewer verified every one against its reference: 48 against the folders' own SHA-256 manifests, and 30 against the exact entries of the review and run packages named in the investigation's table and restore scripts.

| Owner | Restored | No reference |
|---|---|---|
| PM2-RECOVERY-P5-INVENTORY-01 | 19 | 14 |
| PM2-RECOVERY-P5-J2-SEARCH-01 | 3 | 0 |
| PM2-RECOVERY-MECH-EXP-01 | 23 | 0 |
| PM2-RECOVERY-MECH-EXP-02 | 12 | 0 |
| PM2-RECOVERY-MECH-EXP-03 | 21 | 9 |
| PM2-RECOVERY-VERIFY-01 | 0 | 3 |
| PM2-OVERLAY-UNKNOWN-01 | 0 | 2 |
| no task record | 0 | 4 |
| **Total** | **78** | **32** |

No reference (32): no manifest, package entry or record anywhere cites a hash for these files, in CRLF, LF or LF-without-final-newline form (case-insensitive search of `TASKS.md`, `TASKS_BACKLOG_FULL.md` and every file under `docs/`). They stay CRLF and cannot be proven byte-exact. Their content differs from an LF form only by line endings.

- `C:\Users\knlee\aiSandBox2026B\.env.production.example`, `C:\Users\knlee\aiSandBox2026B\.env.staging.example`
- `INVENTORY-01\evidence\`: `Apply-Correction1-Records.ps1`, `Apply-Correction1-StageStart.ps1`, `Apply-DocReconciliation-1.ps1`, `stage-start-section-14.md`
- `INVENTORY-01\runs\run4-2026-09-28-PROVENANCE\`: `Apply-Run4-Records.ps1`, `Apply-Run4-StageStart.ps1`, `evidence\stage-start-section-16.md`
- `INVENTORY-01\runs\run5-2026-09-28-PROVENANCE-RECONCILIATION\`: `Apply-Run5-Records.ps1`, `Apply-Run5-StageStart.ps1`, `evidence\stage-start-section-17.md`
- `INVENTORY-01\runs\run6-2026-09-28-SSH-INVENTORY\`: `Apply-Run6-Correction1.ps1`, `Apply-Run6-PhaseB.ps1`, `evidence\stage-start-section-18.md`
- `INVENTORY-01\runs\run7-2026-09-28-STEP4-REVIEW\Apply-Step4-Records.ps1`
- `PM2-RECOVERY-MECH-EXP-03\stage-a\evidence\step3\Record-Step3.ps1`
- `PM2-RECOVERY-MECH-EXP-03\stage-a\evidence\step4-closure\`: `Export-Step4Package.ps1`, and `texts\` `backlog-item4-new.txt`, `backlog-paragraph.txt`, `backlog-status-new.txt`, `gov-new.txt`, `header-new.txt`, `lane-new.txt`, `step4-new.txt`
- `C:\Users\knlee\aisb-k4-evidence\`: `check-readonly-32.ps1`, `regen-manifests.ps1`, `pm2-overlay-unknown-r3\build-r3-archive.ps1`, `pm2-overlay-unknown-r3\verify-r3-archive.ps1`, and `pm2-recovery-verify\` `run-35427018420\STEP4-VERDICT.txt`, `run-35428399072\STEP4-VERDICT.txt`, `run-35429687692\STEP4-VERDICT.txt`

The `INVENTORY-01` and `PM2-RECOVERY-MECH-EXP-03` paths above are under `C:\Users\knlee\aisb-preflight\`.

## 6. Validation

- Step 1 registration: the unchanged `scripts/validate-lane-capacity.ps1`, run by the reviewer on the registered files with its proof written outside the repository, returned exit 0, PASS, `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE`, no admissible candidates, occupancy hash `d2f1a029d868239bea7118ca5873aa7b91ad03b0b3ce238cef0f993e227584c1`. The repository's `SATURATION_PROOF.json` was not changed.
- Step 2: the copy is byte-identical to the source folder, `sha256sum -c` passes on every copied file, and all 110 affected files match `FILE-STATE-2026-10-22.tsv`.

## 7. Open items and cautions

- `D:\CursorBackup\EXP03-beaca904-DO-NOT-OPEN-IN-CURSOR` still holds replay records for 10 EXP-03 step4-closure files. Opening it in Cursor would rewrite them.
- According to the investigation, 525 inline-diff records remain in `D:\CursorData\User\globalStorage\state.vscdb`. All point to files that no longer exist, so none is replayed.
- A file that a Cursor agent creates and keeps can gain a new inline-diff record and join a future replay. Files a Cursor agent creates and then deletes are not replayed.
- Encryption-key values for seven local Cursor conversations were printed into the side investigation's chat on 2026-10-22. No record names a value.
- Working-tree copies of other repository files are CRLF under `core.autocrlf=true`. That is the normal checkout form; the committed bytes are LF.

## 8. Non-effects

This record changes no lock, status line, criterion, stage-start document, evidence file, package or result of any affected task. It authorizes no restore of the 32 unreferenced files, no run, guest or runtime action, and no change to CLEAN-BASELINE-OPS-01, which stays ACTIVE.
