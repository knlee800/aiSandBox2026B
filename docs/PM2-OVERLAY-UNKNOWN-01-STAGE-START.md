# PM2-OVERLAY-UNKNOWN-01 — Stage-start / Step 2 freeze / Step 3a addendum / Step 3 record / Step 4a K4 preparation

**Task:** PM2-OVERLAY-UNKNOWN-01 — Fail-closed PM2 overlay outcomes and recovery-material retention
**Nature:** IMPLEMENTATION (4-step, high-risk; operator-bundle safety mechanics)
**Current status:** Step 1 COMPLETE (registration `3a8f14d189d533102af27061052b0debe94c2d09`) — Step 2 COMPLETE (freeze `0373c3e5b13c64b396c433e3ce5e0d6bc938b125`) — Step 3a COMPLETE (import + controlling §10 addendum `820609809276566d5490e1fef2ead439e8b43389`) — Step 3 (K3) IMPLEMENTATION WRITTEN (`ef04eb09815690626d35259c0533d08b79621994`; §11) — Step 4a K4 PREPARED (workflow committed `810428994ad3e2f0130c3ebe4096c44ce8773ae5`; §12) — **Step 4b K4 FIRST REMOTE RUN FAILED (run 35327293618: 127 tests, failures=2 errors=3 skipped=1) → CORRECTIONS WRITTEN / NOT YET REMOTELY VERIFIED** — 2026-09-18 — see §13 (three Linux capture fixtures, T13 classification, T5 late ack, workflow exit capture + result parser; eight-file write set + workflow; 32 read-only files 32/32 identical; complete suite must be rerun on GitHub-hosted Linux after Keith's commit); **K5 checkpoint/lock NOT AUTHORIZED**; task NOT LOCKED; occupancy EMPTY; `admissionUncertain=true`. Previous: **Current status:** Step 1 COMPLETE (registration `3a8f14d189d533102af27061052b0debe94c2d09`) — Step 2 COMPLETE (freeze `0373c3e5b13c64b396c433e3ce5e0d6bc938b125`) — Step 3a COMPLETE (import + controlling §10 addendum `820609809276566d5490e1fef2ead439e8b43389`) — Step 3 (K3) IMPLEMENTATION WRITTEN (`ef04eb09815690626d35259c0533d08b79621994`; §11) — **Step 4a K4 PREPARED: WORKFLOW WRITTEN / NOT EXECUTED** — 2026-09-18 — see §12 (Keith selected a GitHub-hosted ubuntu-24.04 fake-only runner; `.github/workflows/pm2-overlay-unknown-verify.yml` prepared; not committed, not dispatched); **behavioural verification still NOT RUN; K5 checkpoint/lock NOT AUTHORIZED**; task NOT LOCKED; occupancy EMPTY; `admissionUncertain=true`. Previous: **Current status:** Step 1 COMPLETE (registration `3a8f14d189d533102af27061052b0debe94c2d09`) — Step 2 COMPLETE (freeze `0373c3e5b13c64b396c433e3ce5e0d6bc938b125`) — Step 3a COMPLETE (import + controlling §10 addendum `820609809276566d5490e1fef2ead439e8b43389`) — **Step 3 (K3) IMPLEMENTATION WRITTEN — BEHAVIOURAL VERIFICATION NOT RUN — PENDING K4** — 2026-09-18 — see §11; **K4 execution/provisioning and K5 checkpoint/lock NOT AUTHORIZED**; task NOT LOCKED; occupancy EMPTY; `admissionUncertain=true`. Previous: **Current status:** Step 1 COMPLETE (registration `3a8f14d189d533102af27061052b0debe94c2d09`) — Step 2 COMPLETE (freeze `0373c3e5b13c64b396c433e3ce5e0d6bc938b125`) — **Step 3a COMPLETE — BASELINE_IMPORTED_FREEZE_CORRECTED** — 2026-09-18 — K1/K2 approved and executed; **K3 implementation, K4 test execution, K5 checkpoint/lock NOT AUTHORIZED**. Previous: **Current status:** Step 1 COMPLETE (registration `3a8f14d189d533102af27061052b0debe94c2d09`) — **Step 2 COMPLETE — FREEZE WITH ONE UNMET IMPLEMENTATION PREREQUISITE** — 2026-09-18 — Steps 3–4 NOT AUTHORIZED
**Step 2 base HEAD:** `3a8f14d189d533102af27061052b0debe94c2d09` (branch main; working tree clean at window open; Step 1 registration commit)
**Evidence predecessor:** PM2-DAEMON-INVESTIGATION-01 COMPLETE AND LOCKED `a3e327e7ffe70666cb75e90b65cb4d6e336ea784` (PASS_WITH_DISCLOSED_LIMITATIONS; `docs/PM2-DAEMON-INVESTIGATION-01-STAGE-START.md` §12–§13)
**Frozen semantics inherited, not reinterpreted:** F1–F5 and the four CLI/daemon states (`docs/AGENT-PLATFORM-EXEC-01C6A-PM2-FENCE-01-STAGE-START.md` §3, §5.1); P1–P8 host-clean gate (§6.4); HARNESS-RESTART-GOV-01 OUTCOME_A / R1.

**Step 3a verdict (summary; detail in §10):** the byte-faithful ZIP B baseline is imported under `ops/aisb-01c6a-operator-bundle/` (40/40 raw SHA-256; 39/39 manifest entries; scoped `.gitattributes` verified to store exact bytes). The §8.2 prerequisite is **MET**. §10.3 corrects the freeze (F5-compatible result/cleanup rules; journal live-vs-orphan lifecycle and pre-spawn ownership check; durable-write and lost-update rules) and is **controlling**. Sidecar candidate now `writeSetPrecision=EXACT` over the eight-file modification set; `admissionUncertain=true`; no lane admission; nothing implemented or executed.

**Step 2 verdict (summary; detail in §8):** the raw-SHA256-verified **source baseline is established** (§2.2). The **authoritative editable location is NOT yet established**: it requires a Keith decision (structural approval of an in-repo import) and a Step 3a import that has not been performed (§2.4). The exact write set, failure/concurrency semantics, retention rules, and verification plan are frozen (§3–§5). Implementation prerequisites are therefore **NOT all satisfied**; Step 3 may not start until §8.2 is resolved.

---

## 0. Authorization and boundaries of this window

Keith authorized (2026-09-18, Step 2 only): static file inspection, archive-entry inspection, raw SHA-256 hashing, and the documentation / control-plane writes listed in §9. Not authorized and not performed: implementation, any execution of archive contents or bundle scripts, tests, mocks, builds, installs, bundle mutation, SSH, PM2, staging, browser, provider/credit, flags, environment changes, Git mutations, subagents.

No protected recovery value, config secret, or vault payload was read. `config/defaults.env` and `config/xai-observation-addrs.txt` were hashed only; their contents were not read or copied.

This freeze does **not**: select investigation Option A/B; authorize the UNKNOWN_PENDING_OVERLAY policy (P1); establish, implement, or prove a fence (F1–F5); satisfy the fencing/recovery reopen gate (R1); accept residual risk (P7); attest host CLEAN (P4/P5); authorize a canary; reopen EXEC-01C6A or change its `startCondition=NOT_READY`; change the Builder gate or Harness flags; admit a lane.

---

## 1. Authority consulted (read-only)

| Source | Used for |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | boot sequence; worker limits; evidence classes; mutex catalogue semantics |
| `TASKS.md` CURRENT EXECUTION BOARD | this task's fields; occupancy EMPTY; GOVERNANCE UNOWNED; EXEC-01C6A NOT_READY; Builder gate ON |
| `TASKS_BACKLOG_FULL.md` § PM2-OVERLAY-UNKNOWN-01 | canonical scope items 1–7; Step 2 prerequisites |
| `docs/PM2-DAEMON-INVESTIGATION-01-STAGE-START.md` §4, §12.1.5, §12.2–§12.5 | bundle location, frozen audit set, raw-hash deviation, D1–D4, R-D1a/b/c, R-D2, R-D4, R-T, R-M |
| `docs/AGENT-PLATFORM-EXEC-01C6A-PM2-FENCE-01-STAGE-START.md` §3–§6 | four states; rejected proofs; F1–F5; P1–P8; §6.1–§6.2 mandatory classification / retention |
| `docs/HARNESS-RESTART-GOV-01-STAGE-START.md` | OUTCOME_A / R1 direction; this task is not the full R1 successor |
| `docs/control-plane/mutex-catalog.json` | no catalogue mutex covers a non-repository path; HOTFILE rule exists |
| `scripts/validate-lane-capacity.ps1` | evidenceClass enum (`LOCAL-TESTS`, `LOCAL-RUNTIME`, `STAGING-RUNTIME`, `PROVIDER-LIVE`); `STAGING-RUNTIME` requires `runtimeNeeds` STAGING; `LOCAL-RUNTIME` requires the LOCAL-RUNTIME mutex; `writePaths` are repo-relative and need not exist on disk |

---

## 2. Source baseline and provenance

### 2.1 Artifacts located

The repository tracks **no** copy of the operator bundle (`git ls-files` has no bundle file; no `.github/` CI). The only repository references are the investigation stage-start (§4, §12.1.5) and PM2-FENCE-01 §1.2, both pointing at the local review directory. All bundle artifacts are local, under `C:\Users\knlee\AppData\Local\Temp\`:

| Artifact | Identity | Role |
|---|---|---|
| `aisb-01c6a-operator-review.zip` (**ZIP A**) | SHA-256 `602aa60567d612e18f200ee9c52cdc7191bff4a366750e96f6eea9689d51fb08`; 94,517 bytes; 40 entries; written 2026-09-11 14:27:44 | Earlier revision. Its hash is recorded inside ZIP B's `OPERATOR-BUNDLE.md` as "Reviewed ZIP SHA-256 before this coverage correction". Historical evidence; **not** the baseline. |
| `aisb-01c6a-operator-review-coverage-corrected.zip` (**ZIP B**) | SHA-256 `2edb2e2fa716b326ee61b9d41af0db78dbd0864127bed6959ccc882df10aa4b3`; 99,748 bytes; 40 entries (38 LF source/text entries plus the two CRLF manifests; entry timestamps normalized to 2026-09-11 12:00:00); written 2026-09-11 15:45:05 | **Accepted archive. Authoritative source baseline (§2.2).** |
| `aisb-01c6a-operator-review\` (review directory) | 40 files + `__pycache__` (.pyc, cpython-313) + empty `mocks\`; 38 of 40 files rewritten with CRLF (mtime 2026-09-18 09:48:31) | CRLF working copy examined by the investigation. **Not** a raw-verified baseline (§2.3). Not modified in this window. |
| `aisb-01c6a-zip-orig\`, `aisb-01c6a-zip-inspect\`, `aisb-01c6a-zip-extract-check\` | extractions of **ZIP A** (all 40 `zip-orig` files raw-equal ZIP A; 34 also equal ZIP B) | Historical evidence of ZIP A only. Not the baseline. |

ZIP A → ZIP B differences (raw entry hashes): `lib/coverage.py`, `lib/orchestrate.py`, `OPERATOR-BUNDLE.md`, `REVIEW-SHA256.txt`, `tests/test_operator_bundle.py`, `TRANSFER.manifest`. All other 34 entries are byte-identical. This is consistent with ZIP B being the "coverage-corrected" successor of ZIP A described in its own `OPERATOR-BUNDLE.md`.

Method: every entry of ZIP A and ZIP B was streamed into memory from the archive (`System.IO.Compression.ZipFile.OpenRead`) and hashed with SHA-256 over the **raw entry bytes**. Nothing was extracted into the review directory, nothing was executed, no existing file was normalized, and no accepted hash list was regenerated. A separate throw-away read-only extraction of ZIP B (`%TEMP%\aisb_pou_step2_zipB_ro\`, removed at window end) was used only for static reading of source text.

### 2.2 Baseline identity — ESTABLISHED

**Baseline = ZIP B**, SHA-256 `2edb2e2fa716b326ee61b9d41af0db78dbd0864127bed6959ccc882df10aa4b3`.

ZIP B's own accepted lists were parsed from the archive entries: `REVIEW-SHA256.txt` (39 entries; header "SHA-256 of every file in the operator review bundle (excluding ZIP)") and `TRANSFER.manifest` (36 helper entries under `bin/`, `lib/`, `config/`). Union: **39 accepted (path, sha256) pairs**. Result of comparing raw ZIP B entry bytes against those accepted values:

**RAW_MATCH 39 / 39 — RAW_MISMATCH 0 — NOT_IN_ZIP 0.** The only entry not self-listed is `REVIEW-SHA256.txt` itself (expected; raw SHA-256 `a58857137103d5c9fd4606e8ac02e0ab9c11924a493c54efa2a0480077b3d10f`).

This satisfies the raw-match condition the investigation's frozen §4 procedure required and could not meet on the CRLF copies (R-M). Raw SHA-256 of every ZIP B entry (this table is the frozen baseline for Step 3; Step 3 must re-verify against it before any edit):

| Entry | Bytes | Raw SHA-256 |
|---|---|---|
| `OPERATOR-BUNDLE.md` | 8862 | `9d26888c40626cf11d9aa3d9608916a06ba81ff4be7cbd9467d8f60400a954b9` |
| `REVIEW-SHA256.txt` | 3516 | `a58857137103d5c9fd4606e8ac02e0ab9c11924a493c54efa2a0480077b3d10f` |
| `TRANSFER.manifest` | 3250 | `d1534a2d09363f34d00901edb1f40f5400d689b0685e8d49e76ff072bef76c39` |
| `bin/capture-lifecycle.sh` | 2542 | `26a9a20d89be57ac8bee27935a9b8ce821072cd4acae22e8bf7cd19683d29eab` |
| `bin/mock-node.py` | 661 | `23fc10012b9e0dfe2d5da45868eb6a80338b4fa00a81ed399b6827f094af2899` |
| `bin/mock-pm2.py` | 2492 | `75fe7729315ef280d4ea8f9c283f4288e0a72ef865f03f0cc413f3dfc843001d` |
| `bin/mock-sudo.py` | 712 | `28c27f12d0ea8d0dda84740a17765882fde5ab6b2d32925af9c9bc6104acb4b4` |
| `bin/mock-tcpdump.py` | 2646 | `24fd9deec7ecdfcaa8ee050c32d79bf77f82803144a7678009fb8f1ff346cbe8` |
| `bin/orchestrate-canary.sh` | 807 | `4f36f355faded3a399e972e58642860469995852581ab60e26415fbcd5a90e2b` |
| `bin/pcap-validate.sh` | 875 | `3b2c8e841c26b2566f63bc3a021d2a686a94a2627f1922af02fdb643b84f9d8f` |
| `bin/reconcile-readonly.sh` | 742 | `509b121f7eea346ec7049f9755f50e13f616e42295010f93b64150b383e46de3` |
| `bin/restore-overlays.sh` | 1099 | `608011f8ebebaa011a0484d3cb35c1b5cb8cf640933c6ed33eb6810220e771fd` |
| `bin/run-canary-supervised.sh` | 1725 | `15e291203e8339bf7a198cf09dd3972887e5f1cea3360b8a0e0ede6b6e962c5d` |
| `bin/stop-capture-validate.sh` | 465 | `8011c50bed8ebf9b5d35be0d4f645283491770fe0eb9a4d9736e354bc1e3a483` |
| `bin/tcpdump-exec.py` | 1384 | `7edddb29a3a76beac8437bf01764e61616d5509aaab8aad51104b85146e4d379` |
| `bin/verify-transfer.py` | 2559 | `09681e9ab6fbdcccd366b48618667f77139493b6dfa5dba71637baf0538351a6` |
| `bin/verify-transfer.sh` | 203 | `240cddc34e7d756a88f3cce62319b9f1cec0f228534bf0d0d10a63b8e147d8c9` |
| `bin/write-transfer-manifest.py` | 1071 | `b3e2935b77f8b9665da5f92c11d676d10bb5bf9b55eb75adbbd59e3cd91c281b` |
| `config/defaults.env` (hash only; not read) | 647 | `4d5cd198aa1cf4d97f523a0b36ba4a70697cb8f3ad4a248f4aa1d71189be3f1c` |
| `config/xai-observation-addrs.txt` (hash only; not read) | 197 | `55adc433acfb1b6c82a7eaf04888b502318950ff81edbdfe989d4652c1819798` |
| `lib/__init__.py` | 124 | `2ac67e9ad8c8cae3c4c7490266f613243fdcb869897bb00947c8f622c6dc22bd` |
| `lib/accepted_result.py` | 7720 | `15ced7da5bee5d8eded7f0c45954cb178959530f9bb5fc95d269017622768789` |
| `lib/capture.py` | 21617 | `707dd93409a9a42de4352e3de8386b64fae25105aed80d952a73457cdc279fe6` |
| `lib/cleanup_contract.py` | 2291 | `85c3a75e1da8fc8f551b2c2f82a733b49ff91844475d091d706b5ea980b65c82` |
| `lib/clock_util.py` | 665 | `8304fb988ded4eaf303c0f7dbe0a73e18611ed158e63af0aeb1e3512472519ad` |
| `lib/config_deadlines.py` | 2589 | `1be30b6acd1c5b768001da959474059db351427ae6fe570c1558ccae6cbfd280` |
| `lib/coverage.py` | 37230 | `b731dcc1d951553a0792d99aabda29bc520d92aa341cf0ba92acdf9b07ad6a31` |
| `lib/drop_stats.py` | 2357 | `9743571047a5bd3e69cf54a89a2d3b331a4d86cc0d015178eba401b7360f403f` |
| `lib/linux_capture.py` | 17579 | `6916d082551a7b3b3069e95b7f813794562148fb7d55814cf9ba2d8930bf789a` |
| `lib/network_evidence.py` | 3859 | `43e159d75bf1448dcf9d3e851f4ebabd686429656a36ac6ea2cdb35af7f232d5` |
| `lib/orchestrate.py` | 29393 | `561715ebc513879364ba9c671cbbf077192ee7e3e41f9ac8e1431e09e4012442` |
| `lib/overlay_restore.py` | 25688 | `36dfe99f85bbe8b9b456d7dc3e54d9b633f4e1467b53a2ef3b409db0fa893082` |
| `lib/pcap_flows.py` | 9743 | `7af71fe8eb1e53bc299a54f23799f66573be883bdc15106cceb2ecad6e2c6dd9` |
| `lib/pcap_validate.py` | 7063 | `c7d990bfc23103b60a54ca88d9922c2aa4753529f12425522aa0a5a503c818de` |
| `lib/process_alive.py` | 2284 | `cd55c786bc95adf0b786e88cafd42fa2b5a4f7077df4b63e059c78468e5a48b0` |
| `lib/reconcile.py` | 17646 | `d0a903743a3d27a3f3ea42b6eccfc45856b6c5070b1ec296cc544bd472ac6f2e` |
| `lib/secret_io.py` | 5351 | `b61fdebdb923989efca2a0f2e66d055932e049aad11fa88a221605c5655be1a1` |
| `lib/supervise.py` | 23589 | `26813e080e2bc8b70ea105f54edbc7a5725327679d8ce89cb58d9a1b8720520a` |
| `lib/vault.py` | 8068 | `b4c9b4b41d601bf936fc30414c6c871d3ce357e2231f03d49ae9ce3926476102` |
| `tests/test_operator_bundle.py` | 147598 | `dc5c99af23624ba219e50c34e8425a21ee561bc24e4a0e8f17eb0823da938242` |

Line numbers cited in §3–§4 refer to these ZIP B entries; they coincide with the investigation's citations because CRLF conversion does not change line numbering.

### 2.3 The CRLF review directory is not the baseline

Raw hash of each review-directory file versus the ZIP B entry: **RAW_EQUAL 2** (`REVIEW-SHA256.txt`, `TRANSFER.manifest` — both already CRLF inside ZIP B) and **RAW_DIFF 38** (all 38 LF entries were rewritten with CRLF; e.g. `lib/overlay_restore.py` 26,392 bytes / 704 CRLF on disk vs 25,688 bytes in ZIP B). The investigation's finding (1 raw match / 20 raw mismatch over its 21-file audit set) is consistent with this. The review directory was not modified, normalized, or re-hashed into any manifest in this window. It remains historical evidence and a convenient CRLF reading copy; it must **not** be used as the edit base or as a transfer source.

### 2.4 Authoritative source vs. editable location

- **Authoritative source (established):** ZIP B, by its archive hash and its self-consistent accepted manifests (§2.2). ZIP A is retained as history; both archives must be preserved unmodified.
- **Authoritative editable location (NOT established):** none exists. The bundle is not under version control anywhere; the review directory is CRLF-damaged; the archives are immutable evidence.

**Proposed editable location (Keith decision required; not performed):**

| Option | Description | Assessment |
|---|---|---|
| **L1 — in-repository import (recommended)** | Import the 40 ZIP B entries LF-faithfully under a new repository directory `ops/aisb-01c6a-operator-bundle/` (path proposed, not asserted; Keith may choose another root). Changes are reviewed by `git diff`, versioned by commit, and packaged back into a new archive plus regenerated manifests (§3.4). | Reviewable, versioned, revert-isolated. Requires (a) explicit approval as a structural deviation (CLAUDE.md "Current Directory Structure"), (b) LF enforcement for that path because `core.autocrlf=true` would otherwise CRLF-convert the checkout and break raw verification — a path-scoped `.gitattributes` rule (`ops/aisb-01c6a-operator-bundle/** text eol=lf`) is required and is itself a repository write needing scope approval, (c) HOTFILE leases for every file in the write set, since no catalogue mutex covers `ops/` (§3.5). |
| L2 — out-of-repo durable directory with its own git history | e.g. `C:\Users\knlee\aisb-operator-bundle\` | Not reviewable by this repository's control plane; drift and evidence-isolation risk; rejected as the primary location. |
| L3 — archive-only revisioning (no editable tree) | edit a fresh extraction each time; emit ZIP C with a hash chain | Not reviewable as a diff; edits cannot be revert-isolated; rejected. |

**Step 3a (proposed first action of Step 3, requires Keith authorization; not performed now):** after Keith selects the location, import ZIP B entries byte-for-byte (LF preserved), then verify **39/39 raw SHA-256 matches against §2.2 using PowerShell `Get-FileHash`** (no bundle script execution) before any edit. If the imported tree does not raw-match 39/39, Step 3 must stop.

### 2.5 Provenance limitations (disclosed)

- The archives are local files created 2026-09-11 by an earlier correction window; no signature, upstream repository, or remote copy exists. Their integrity rests on (i) the archive hash recorded here, (ii) internal manifest self-consistency (39/39), and (iii) ZIP B's own record of ZIP A's hash, which matches the ZIP A file present.
- `__pycache__` artifacts in the review directory (cpython-313) show the suite was executed locally at some earlier time; they are derived files and are excluded from every baseline and manifest.
- None of this establishes anything about what is deployed on staging; the investigation recorded that the bundle had not been transferred (§12.1.5, R-M).

---

## 3. Frozen exact write set (bundle-relative; §2.4 root pending)

### 3.1 Caller trace performed (static, ZIP B)

`restore_overlays` is called from `orchestrate.restore_always` (`lib/orchestrate.py` l.271) and from the standalone entry `bin/restore-overlays.sh` (l.18). `Pm2Adapter.restart_update_env` / `dump_env` are called from `overlay_restore.py` (l.250 `dump_app_envs`, l.395 `apply_overlay_payloads`, l.656–657 `restore_overlays`); `orchestrate.py` rebinds `pm2.restart_update_env` to `gated_restart` (l.433–440). Vault mutators: `mark_pending_apps` (orchestrate l.429), `clear_pending_app` (overlay_restore l.669), `delete_protected_recovery` (orchestrate l.223 default `delete_vault_fn`; `main` l.782), `refuse_unresolved_vault` (orchestrate l.350), `protected_recovery_present` (orchestrate l.282, l.423). Result consumers: `OrchestrateResult` → `main` payload (l.791–800) → `redact_mapping` (key-name based; tolerates new keys) → `orchestrate-result.json`; `allows_next_canary` (`accepted_result.py` l.177) consumes `restore_ok` / `overlays_restored`. `supervise.py`, `reconcile.py` (`ACK_UNKNOWN` is the canary-job ack class, not the PM2 overlay class), `capture.py`, `coverage.py`, `cleanup_contract.py`, `secret_io.py`, `process_alive.py`, `config_deadlines.py` are not on the overlay/restore fate path and are excluded.

### 3.2 Files IN the write set (exactly these, bundle-relative)

| # | File | Why |
|---|---|---|
| W1 | `lib/overlay_restore.py` | `CliPm2` dispatch/fate classification; `RestoreResult` fields; `restore_overlays` UNKNOWN handling; dual-field `dump_env` / `compare_restore`; `_child_env_for_pm2` (§4.9) |
| W2 | `lib/orchestrate.py` | `restore_gate` owner-token coordination; `gated_restart`; `restore_always` publication/cleanup ordering; `OrchestrateResult` fields; result payload |
| W3 | `lib/vault.py` | command-attempt journal; UNKNOWN marker; `refuse_unresolved_vault` fail-closed extension; retention under UNKNOWN |
| W4 | `tests/test_operator_bundle.py` | fake adapter extensions and the §5 test matrix; corrections to tests that encode D1 |
| W5 | `bin/mock-pm2.py` | mock CLI must model `pm2_env` **and** `pm2_env.env` so `MockPm2CliTests` and dual-field verification are meaningful (§4.8); no live use |
| W6 | `TRANSFER.manifest` | regenerated for the new revision (§3.4) |
| W7 | `REVIEW-SHA256.txt` | regenerated for the new revision (§3.4) |
| W8 | `OPERATOR-BUNDLE.md` | revision record: hash chain ZIP A → ZIP B → new archive; UNKNOWN semantics summary; "not READY for live execution" retained |

### 3.3 Files OUT of the write set (do not touch)

`lib/accepted_result.py` (`allows_next_canary` already returns False when `restore_ok`/`overlays_restored` are False; no change needed), `lib/supervise.py`, `lib/reconcile.py`, `lib/capture.py`, `lib/linux_capture.py`, `lib/coverage.py`, `lib/cleanup_contract.py`, `lib/secret_io.py`, `lib/process_alive.py`, `lib/config_deadlines.py`, `lib/network_evidence.py`, `lib/pcap_*.py`, `lib/drop_stats.py`, `lib/clock_util.py`, `lib/__init__.py`, `bin/*.sh`, `bin/verify-transfer.py`, `bin/write-transfer-manifest.py`, `bin/mock-node.py`, `bin/mock-sudo.py`, `bin/mock-tcpdump.py`, `bin/tcpdump-exec.py`, `config/*`. `bin/restore-overlays.sh` is excluded because its exit code already follows `result.ok`; the UNKNOWN class makes `ok=False` (§4.4), so the script fails closed without modification. Repository application source (`frontend/`, `services/`), the three EXEC-01C6A prepared artifacts, and all predecessor documents are out of scope.

### 3.4 Artifact / manifest / packaging handling (frozen)

1. ZIP A and ZIP B are never modified, re-zipped, or re-hashed into a manifest. Their hashes (§2.1) are the historical chain.
2. After Step 3 edits, `TRANSFER.manifest` (36 helper entries, `bin/ lib/ config/`, sorted, format `sha256  relative-path`, header lines preserved) and `REVIEW-SHA256.txt` (all files except the archive and `REVIEW-SHA256.txt` itself) are regenerated **without executing bundle scripts**: PowerShell `Get-FileHash -Algorithm SHA256` output formatted identically to `bin/write-transfer-manifest.py` (l.21–31). Byte-for-byte equivalence with what `write-transfer-manifest.py` would produce is a Step 4 verification item in the authorized environment (§5).
3. A new archive `aisb-01c6a-operator-review-r3-unknown-latch.zip` (name proposed) is produced from the LF tree; its SHA-256 and the ZIP B hash are recorded in `OPERATOR-BUNDLE.md` ("Reviewed ZIP SHA-256 before this revision: 2edb2e2f…a4b3"). Entry timestamps normalized as in ZIP B.
4. Transfer verification remains `bin/verify-transfer.py` (unchanged; it already excludes `__pycache__` / `.pyc` and requires every `bin/ lib/ config/` file to be listed). Staging transfer is **not** authorized by this task at any step.
5. Line endings: every edited file stays LF; Step 4 checks `CRLF=0` for all 38 LF entries and that the two CRLF manifests remain CRLF only if regenerated by the same tooling convention — otherwise record the change explicitly. No silent normalization of any file outside W1–W8.

### 3.5 Mutex / lease declarations (existing catalogue only; nothing invented)

- **Now (Step 2 end-state):** IMPLEMENTATION candidate `mutexes=[]`, `hotfiles=[]`, `writePaths=[]`, `writeSetPrecision=PROVISIONAL`, `admissionUncertain=true` — unchanged. Reason: no repository path exists yet for the write set; the catalogue has no mutex whose `pathPrefixes` cover any proposed root; declaring HOTFILE leases on paths Keith has not approved would assert paths this task was told not to invent.
- **Conditional (to be applied by the control plane once L1 or an alternative root is approved and Step 3a import is complete):** `writePaths` = the eight W1–W8 paths under the approved root, plus the path-scoped `.gitattributes` rule if placed in a new or existing `.gitattributes`; `hotfiles` = the same eight files (HOTFILE leases are the existing mechanism for paths outside every BROAD mutex); `writeSetPrecision=EXACT` only at that point. `admissionUncertain` may become false only after the execution location (§5.2) is also authorized. GOVERNANCE must not appear on the candidate. STAGING, AI-SERVICE, GATEWAY, CONTAINER-MANAGER, FRONTEND, I18N, MIGRATION, PACKAGE, COMPOSE, ENV, LOCAL-RUNTIME, PROVIDER-LIVE, CREDIT remain undeclared. `mutex-catalog.json` is not edited.

---

## 4. Frozen failure, concurrency, and retention semantics

Vocabulary: a **command attempt** is one `CliPm2` child invocation (`pm2 restart <app> --update-env` or `pm2 jlist`). Overlay **apply** = `apply_overlay_payloads`; **restore** = `restore_overlays`. Frozen PM2-FENCE-01 §3 states are used with their frozen meanings.

### 4.1 Command-attempt journal — persisted before any mutation can be dispatched

> **Step 3a note (2026-09-18):** superseded in part by §10.3 (controlling for implementation). This section is retained unchanged as the Step 2 historical record.

- File: `<vault>/overlay_commands.json` (JSON list, atomic replace via write-temp + `os.replace`; mode 0o600 on POSIX). Written by W3 helpers `journal_intent`, `journal_dispatched`, `journal_terminal`.
- Entry fields (names only, never values): `attempt_id` (uuid4), `op` (`APPLY` | `RESTORE`), `app`, `keys` (sorted key names), `phase`, `mono_ts`, `wall_ts`, `client_pid` (after spawn), `exit_code`, `reason`.
- Phases: `INTENT` (written under the coordination lock **before** `Popen`) → `DISPATCHED` (written immediately after `Popen` returns; child is alive) → terminal `ACKED` | `NOT_DELIVERED` | `UNCERTAIN`.
- Ordering rule: a mutating child may be spawned only after its `INTENT` entry is durably on disk. A journal write failure refuses the dispatch (`JOURNAL_WRITE_FAILED` → treated as apply failure without mutation; no child spawned).

### 4.2 Fate classes (mapped to PM2-FENCE-01 §3)

| Journal terminal | Condition (all observable client-side) | §3 state | Effect |
|---|---|---|---|
| `NOT_DELIVERED` | `Popen` raised before a process existed (`FileNotFoundError`, `PermissionError`, `OSError` from spawn) | CLIENT_NOT_DELIVERED (proven) | no mutation; apply fails closed; not UNKNOWN |
| `ACKED` | child exited **0** within `timeout_sec` | DAEMON_ACKED for **that** command only | may contribute to a restoration claim (§4.5) |
| `UNCERTAIN` | any of: `subprocess.TimeoutExpired` (child killed); non-zero exit; termination by signal; `KeyboardInterrupt` / any exception after `Popen` returned; process interrupted between `DISPATCHED` and terminal | ACK_LOST or DELIVERED_UNACKED — indistinguishable | **latch UNKNOWN** (§4.3) |
| (none: `INTENT` or `DISPATCHED` with no terminal on next read) | crash between persistence and dispatch, or between dispatch and wait | UNKNOWN (fail closed) | treated as `UNCERTAIN` by the next run (§4.7) |

Non-zero exit is classified `UNCERTAIN`, not `NOT_DELIVERED`, because the client cannot distinguish "daemon rejected" from "daemon merged then the client failed"; fail-closed. A `jlist` failure is a read failure (`BASELINE_READ_FAILED`), not an overlay fate; it never clears anything and, during restore, forces `UNCERTAIN` for the snapshot step (§4.5).

### 4.3 UNKNOWN_PENDING_OVERLAY latch

- Marker file: `<vault>/unknown_overlay.json` — `{ "format": 1, "latched_wall_ts", "latched_mono_ts", "attempts": [attempt_id…], "apps": [...], "keys": [...], "reasons": [...] }` (names only). Written atomically **before** the exception or failure propagates out of the dispatch helper, and before any result is published.
- Latched iff: marker exists, **or** the journal contains any entry whose terminal is `UNCERTAIN` or that lacks a terminal, **or** the marker/journal is unreadable or malformed (§4.7). Once latched, no code path in the bundle clears it: there is **no** clearance function, CLI flag, environment variable, or snapshot rule that deletes `unknown_overlay.json` or rewrites `UNCERTAIN`. P6 verification and P7 acceptance are outside this task; "an automatic UNKNOWN-clearance shortcut" is explicitly not designed (§7).
- Apply-side failure: `UNCERTAIN` on any apply attempt → latch (apps/keys of that attempt) → restore is **still attempted** (PM2-FENCE-01 §6.1: "Restore may still be attempted, but the attempt cannot clear UNKNOWN") → final class UNKNOWN regardless of the restore's own outcome.
- Restore-side failure: `UNCERTAIN` on any restore attempt (R-D1b) → latch → `apps_failed` includes the app → class UNKNOWN. Overlay is never retried automatically.

### 4.4 Result classes and flags (three separate claims)

> **Step 3a note (2026-09-18):** superseded in part by §10.3 (controlling for implementation). This section is retained unchanged as the Step 2 historical record.

`RestoreResult` gains: `result_class` ∈ {`RESTORED_ACKED_MATCHED`, `UNKNOWN_PENDING_OVERLAY`, `RESTORE_FAILED`, `PENDING_HMAC`, `UNSUPPORTED_ABSENT_RESTORE`, `RESTORE_INTERRUPTED`}, `unknown_pending_overlay: bool`, `snapshot_matched: bool`, `commands_acked: bool`, `attempts: list[str]`. `OrchestrateResult` and the `orchestrate-result.json` payload gain `result_class` and `unknown_pending_overlay`.

| Claim | Meaning | Source | Sufficient for |
|---|---|---|---|
| **command acknowledgement** (`commands_acked`) | every restore attempt in this run is `ACKED` **and** no apply attempt in this run or in the journal is non-`ACKED`/non-`NOT_DELIVERED` | journal | nothing alone |
| **snapshot verification** (`snapshot_matched`) | dual-field named-key comparison matched for every app (§4.8) | `jlist` after restore | nothing alone (PM2-FENCE-01 §4: point-in-time) |
| **restoration claim** (`ok` / `restore_ok` / `overlays_restored`) | `commands_acked and snapshot_matched and not latched` | conjunction | the bundle's own success bit only |

Invariants: `unknown_pending_overlay=True` ⇒ `ok=False`, `restore_ok=False`, `overlays_restored=False`, `preserved_vault=True`, `result_class=UNKNOWN_PENDING_OVERLAY`, `next_canary_allowed=False`, classification `INCOMPLETE`. `snapshot_matched=True` never raises `ok` while latched. None of these claims asserts F1, F2, F3, or F4-as-fence; `restore_ok=True` under this design still means only "all our restore clients acked, the dual-field snapshot matched, and nothing uncertain was recorded" — a matching snapshot is not daemon fate, and this is recorded in the result payload as `fence_claim: "NONE"`.

### 4.5 Restore owner algorithm (single owner; frozen order)

> **Step 3a note (2026-09-18):** superseded in part by §10.3 (controlling for implementation). This section is retained unchanged as the Step 2 historical record.

1. Acquire ownership under `restore_lock`: set `started=True`, create a fresh `owner_token` object, `in_flight=True`. Losers wait on `done` (existing behaviour) and receive the published result; if the owner publishes nothing within the bound, the loser's synthetic result is `UNKNOWN_PENDING_OVERLAY` (not the current generic failure).
2. Read the journal. For every `APPLY` entry still `DISPATCHED`: wait on that attempt's completion event for at most `remaining apply timeout + 2 s` (bounded by `restore_reserve`). If it resolves `ACKED` **after** ownership was taken, record `ACKED_LATE` in `reason` and treat the run as latched (ordering versus the upcoming restore is unknown). If unresolved → mark `UNCERTAIN` and latch.
3. For each app: journal `INTENT(RESTORE)` → dispatch via `orig_restart` with the owner token (§4.6) → terminal per §4.2 → if `ACKED`, take the dual-field snapshot (§4.8) and compare; if the snapshot read fails → `UNCERTAIN` for that app.
4. Compute `result_class` (§4.4). If latched anywhere → write/refresh the UNKNOWN marker **now**.
5. Persist `<vault>/restore_result.json` (redacted; names only).
6. Cleanup **only if** `result_class == RESTORED_ACKED_MATCHED` **and** `windows.restore_due()` is `None` **and** the marker does not exist **and** the journal has no non-terminal or `UNCERTAIN` entries: then `clear_pending_app` for each app and `delete_vault_fn()`. Otherwise retain everything (§4.9).
7. Publish: `restore_gate["result"]`, then `done.set()`. Any exception in steps 2–6 → latch, persist a `RESTORE_FAILED`/UNKNOWN result, publish, re-raise nothing to the watchdog thread.

`vault_preserved` continues to be read from disk (`protected_recovery_present`, extended to count the UNKNOWN marker and a non-empty journal as recovery material).

### 4.6 Dispatch admission and the late-apply problem

> **Step 3a note (2026-09-18):** superseded in part by §10.3 (controlling for implementation). This section is retained unchanged as the Step 2 historical record.

Current defect (ZIP B `orchestrate.py` l.435–438): `gated_restart` refuses a restart when `started and not in_restore`; while the owner is inside `restore_overlays`, `in_restore` is a **shared** flag, so a late apply arriving from the main thread during that interval is **permitted**. Frozen replacement:

- `gated_restart(app, envmap, *, token=None)`: refuse (`OVERLAY_AFTER_RESTORE`) unless `token is restore_gate["owner_token"]`; the restore owner passes its token; apply never has a token. The shared `in_restore` flag is removed.
- Apply admission is atomic with ownership: under `restore_lock`, apply checks `started`; if `False` it writes the `INTENT` journal entry and marks the attempt `admitted` in memory before releasing the lock; if `True` it refuses without spawning. The owner (step 1) and the apply admission are therefore mutually exclusive: either the apply is refused, or the owner will find its `INTENT`/`DISPATCHED` entry in step 2 and wait/latch. The lock is **not** held across the child process (that would block the watchdog for up to 20 s); the journal is the hand-off.
- `apply_overlay_payloads` keeps its between-app `abort` check and additionally passes each attempt through the admission path, so a restore starting between two apps refuses the second app before spawn.
- A late apply that was already `DISPATCHED` when restore starts cannot be refused (PM2-FENCE-01 §4 row "Operator `restore_gate` refusing later apply… too late"); it is **recorded and latched** (step 2), never treated as absent. This is the mechanism by which watchdog overlap and in-flight apply are covered — not merely the later `TimeoutExpired` exception.

### 4.7 Next-run blocking and corrupt-state behaviour

`refuse_unresolved_vault(vault_dir)` (W3) raises when any of: protected recovery material present (existing); `pending_apps.json` non-empty (existing); `unknown_overlay.json` exists (`UNRESOLVED_UNKNOWN_OVERLAY`); `overlay_commands.json` exists and contains any entry without a terminal or with `UNCERTAIN` (`UNRESOLVED_COMMAND_ATTEMPTS`); marker or journal exists but is unreadable, not valid JSON, or not the expected shape (`UNKNOWN_STATE_CORRUPT`). `orchestrate()` already calls it before coverage assessment (l.350) and returns `INCOMPLETE` with zero mutation; that ordering is retained. `bin/restore-overlays.sh` needs no change: while latched, `restore_overlays` returns `ok=False` and the script exits 1.

### 4.8 Dual-field named-key verification (R-D2; F4 blind spot D2)

- `Pm2Adapter.dump_env_dual(app) -> tuple[dict top, dict nested]` where `top = pm2_env` top-level fields and `nested = pm2_env.env` (empty dict if absent). `CliPm2` implements it from one `jlist` read (same fail-closed missing/duplicate rules). `dump_env` (top-level) is retained for baseline capture so the recorded baseline keeps its existing meaning (environment of the last spawn).
- `compare_restore_dual(metadata, top, nested, hmac_absent_empty_authorized)`: for each named key in the metadata, compute `state_top`, `state_nested` ∈ {SET, EMPTY, ABSENT} with the existing `_state_of` rules, and compare each against the expected state/value (secret SET → exact match via `load_protected`, as today). Match requires **both** fields to match. `state_top != state_nested`, or both SET with different values, is `DIVERGENT` → not matched **and** class UNKNOWN (a value visible only in `pm2_env.env` is a latent merge; a top-only value indicates a spawn the daemon's `.env` does not reflect — both fail closed).
- Named exceptions preserved exactly: HMAC ABSENT→EMPTY (`HMAC_NAMES`, requires `AISB_01C6A_HMAC_ABSENT_EMPTY_RESTORE_AUTHORIZED`) applies identically to both fields; `UNSUPPORTED_ABSENT_RESTORE` unchanged; no new exception is introduced for any other variable.
- Pre-mutation guard: baseline capture also reads `nested`; a top/nested divergence on any named key **before** the first mutation refuses the run (`BASELINE_DIVERGENT`) — a latent pending overlay already exists and the host is not a clean base.
- `bin/mock-pm2.py` (W5) and the test fake (`MemoryPm2` → `FakePm2Dual`, W4) must model `pm2_env` and `pm2_env.env` separately with an explicit "spawn" step that copies nested onto top, so a latent merge is representable.
- A matching dual-field snapshot is **verification input only** (investigation §12.3); it is not a fate proof for any `UNCERTAIN` attempt and never clears the latch.

### 4.9 Recovery-material retention under UNKNOWN

Retained, never deleted or truncated while latched: `protected/*.value` and `apps/<app>/protected/*.value`, `metadata.json` and `apps/<app>/metadata.json`, `pending_apps.json` (no `clear_pending_app`), `unknown_overlay.json`, `overlay_commands.json`, `restore_result.json`. `delete_protected_recovery` is extended to refuse (raise `UNKNOWN_LATCHED`) if called while the marker or unresolved journal entries exist, so even a caller-supplied `delete_vault` cannot bypass the latch. HMAC ABSENT→EMPTY remains a named exception and is not extended.

### 4.10 `_child_env_for_pm2` allowlist assessment (R-D4; filtering exists)

The allowlist (ZIP B `lib/overlay_restore.py` l.88–113) forwards, when present in the operator's environment: `PATH, PATHEXT, SYSTEMROOT, SYSTEMDRIVE, WINDIR, COMSPEC, MOCK_PM2_STATE, PYTHONPATH, PYTHONHOME, PYTHONIOENCODING, TEMP, TMP, HOME, USERPROFILE, LANG, LC_ALL` plus the overlay keys. With `--update-env`, PM2 merges the client's entire `process.env` into the app (`API.js` l.1361–1369), so every forwarded key is merged into the target app's `pm2_env.env` on each apply and restore.

| Key group | Linux-target assessment | Frozen decision |
|---|---|---|
| `PATH`, `HOME` | required for the pm2 client to run and to locate `PM2_HOME` (`~/.pm2`) — forwarding a wrong `HOME` would target a different daemon | keep (necessary) |
| `LANG`, `LC_ALL` | harmless locale; merged into app env | keep (no identified exposure) |
| `TEMP`, `TMP`, and Windows-only `PATHEXT SYSTEMROOT SYSTEMDRIVE WINDIR COMSPEC USERPROFILE` | absent on the Linux target → inert; present only for local Windows mock runs | keep (no live exposure) |
| `PYTHONPATH`, `PYTHONHOME`, `PYTHONIOENCODING` | needed **only** when `pm2_bin` ends with `.py` (mock CLI via `sys.executable`); with the live `pm2` binary they are merged into Node apps' `pm2_env.env` for no reason — identified exposure: operator `PYTHONPATH` (`$PREP/lib`) persists into app env and any later dump | forward only in the `.py` mock branch (`CliPm2._argv` already distinguishes it) |
| `MOCK_PM2_STATE` | test-only state path; if present with the live binary it indicates a contaminated operator environment and would be merged into production app env | forward only in the `.py` mock branch; with a non-`.py` binary and `MOCK_PM2_STATE` set, refuse before mutation (`MOCK_STATE_IN_LIVE_ENV`) |

No other filtering change is frozen. The assessment does not describe filtering as absent.

### 4.11 What §4 does not claim

Nothing above establishes F1 (fate of an `UNCERTAIN` command), F2 (last-mutation), or F3 (completion/quiescence); the design records uncertainty faithfully and refuses to convert it into success. It does not select Option A or B: the same latch, journal, dual-field verification, and owner-token mechanics are prerequisites for either direction. It does not define a P6 procedure, request P7, or attest P4/P5.

---

## 5. Verification plan — no local execution

### 5.1 Prohibition

Keith prohibits local application execution, tests, mocks, builds, and installs on the workstation. This freeze authorizes none. The shared staging PM2 daemon is never a test target for this task.

### 5.2 Verification environment

- **Existing isolated environment: NONE.** The repository has no CI (`.github/` absent); no isolated runner is registered in any control-plane document; staging is excluded by rule.
- **Proposed (requires separate Keith authorization; nothing provisioned or run now):** an ephemeral, disposable Linux environment that is *not* the workstation and *not* staging — e.g. a fresh throw-away Lightsail instance (the pattern used by earlier `AISB-*-LIGHTSAIL-RESULTS` evidence) or a disposable container image with Python 3.11+ — into which the LF tree is copied and `python -m unittest tests.test_operator_bundle -v` is run with the fake adapters only; the instance is destroyed afterwards. Real `pm2`, `node`, `tcpdump`, `sudo` are not required and must not be installed there for this task's tests. If Keith prefers repository CI, adding a workflow is a separate repository write outside this write set and would need its own scope approval.
- **Resource declaration:** none of `LOCAL-RUNTIME`, `STAGING`, `PROVIDER-LIVE`, `CREDIT` describes a disposable off-host test runner; no runtime mutex is declared and `runtimeAuthorization` stays entirely false. If Keith selects an environment that does map to a catalogue resource, the candidate is re-registered before admission.

### 5.3 Test doubles (frozen)

`FakePm2Dual` (W4): per-app `top` and `nested` dicts; `restart_update_env` merges into `nested` and, unless `latent=True`, "spawns" (copies `nested` → `top`); injectable behaviours per call: `raise TimeoutExpired after merge`, `raise TimeoutExpired before merge`, `exit non-zero`, `block until barrier then ack` (late acknowledgement), `raise OSError before spawn` (proven not delivered); records every call. Vault: `tempfile.TemporaryDirectory()` with dummy `*.value` recovery material and `pending_apps.json`. Concurrency: `VirtualClock` (existing) plus `threading.Event`/`Barrier` barriers; no wall-clock sleeps in assertions. `bin/mock-pm2.py` (W5) models the same two fields for `MockPm2CliTests`.

### 5.4 Test matrix (each maps to a Keith-listed case)

> **Step 3a note (2026-09-18):** superseded in part by §10.3 (controlling for implementation). This section is retained unchanged as the Step 2 historical record.

| ID | Case | Must assert |
|---|---|---|
| T1 | apply `TimeoutExpired` **after** simulated delivery (merge happened, latent) | journal `UNCERTAIN`; marker present; restore attempted; `result_class=UNKNOWN_PENDING_OVERLAY`; `restore_ok=False`; `overlays_restored=False`; vault + `pending_apps.json` retained; `next_canary_allowed=False` |
| T2 | apply `TimeoutExpired` **before** simulated delivery (no merge) | identical outcome to T1 (client cannot distinguish; fail closed) |
| T3 | restore `TimeoutExpired` | `apps_failed` contains app; latch; `ok=False`; nothing deleted |
| T4 | matching dual-field snapshot while latched | `snapshot_matched=True` **and** `ok=False`; marker still present; `delete_vault` not called; `clear_pending_app` not called |
| T5 | watchdog restore overlaps in-flight apply (apply blocked on barrier; window expires; watchdog owns restore) | second app's apply refused before spawn (`OVERLAY_AFTER_RESTORE`); in-flight apply recorded `DISPATCHED`; owner waits bounded, then latches; exactly one restore per app; no restart admitted with a non-owner token while the owner is inside `restore_overlays` |
| T6 | attempted late apply via `gated_restart` without token while owner is mid-restore | refused; journal shows no `INTENT` for it |
| T7 | late acknowledgement: apply acks after ownership taken | `ACKED_LATE` reason; latched; `ok=False` |
| T8 | crash/interruption between `INTENT` and `DISPATCHED`, and between `DISPATCHED` and terminal (simulated by raising inside the fake and by re-running with a pre-seeded journal) | next `orchestrate()` returns `INCOMPLETE` with `UNRESOLVED_COMMAND_ATTEMPTS`; zero `Popen`/restart calls; zero capture starts |
| T9 | missing / corrupt marker or journal (truncated JSON, wrong shape, unreadable) | `UNKNOWN_STATE_CORRUPT`; fail closed; no mutation |
| T10 | top-level vs nested divergence after restore; and pre-mutation divergence at baseline | `DIVERGENT` → UNKNOWN; `BASELINE_DIVERGENT` → refused before first mutation |
| T11 | SET / EMPTY / ABSENT on both fields, HMAC ABSENT→EMPTY authorized and unauthorized, `UNSUPPORTED_ABSENT_RESTORE` | states classified per field; named exceptions unchanged; no new exception |
| T12 | allowlist: live binary with `MOCK_PM2_STATE` set → refused; `.py` mock branch forwards `PYTHON*`/`MOCK_PM2_STATE`; live branch does not | `MOCK_STATE_IN_LIVE_ENV`; child env contents as frozen in §4.10 |
| T13 | existing acknowledged-flow regression: full ack, matching dual snapshot, window inside bounds | `RESTORED_ACKED_MATCHED`; `restore_ok=True`; `overlays_restored=True`; cleanup performed; `fence_claim="NONE"`; `allows_next_canary` unchanged for stub |
| T14 | existing suite | every existing test passes unchanged **except** those that encode D1, which are corrected: `test_mark_before_apply_restores_after_exception` (l.1043–1078; must now assert UNKNOWN / `overlays_restored=False` / vault preserved) and `test_cli_pm2_partial_failure_continues` (l.1079) re-asserted against the new class; `test_vault_deleted_only_after_restore_match`, `test_restore_owner_does_not_double_restart`, `test_apply_payloads_stop_after_restore_started`, `test_restore_while_supervise_remains_blocked`, `test_virtual_clock_expiry_during_apply/restore`, `test_unresolved_vault_not_overwritten` must remain green with their existing meaning |

### 5.5 Step 4 evidence (to be produced in the authorized environment only)

Unittest output (all T1–T14 plus the pre-existing suite), `CRLF=0` check over LF entries, 39-entry raw-hash table of the new tree, regenerated manifests' byte equivalence with `write-transfer-manifest.py` output, new archive hash, and `git diff` of W1–W8 against the imported baseline. Evidence is recorded in this document (§ to be added by Step 3/4) and never claims F1–F5, P4–P7, host CLEAN, or reopen readiness.

### 5.6 `evidenceClass` reconciliation

The schema offers `LOCAL-TESTS`, `LOCAL-RUNTIME`, `STAGING-RUNTIME`, `PROVIDER-LIVE`. The proposed evidence is bundle-local unit tests with fakes (no daemon, no staging, no provider, no local Docker/Postgres/Redis runtime). The only existing value describing that evidence *kind* is `LOCAL-TESTS`; the other three each require a resource this task must not touch. `evidenceClass` therefore **stays `LOCAL-TESTS`** with `runtimeNeeds=[]`, and this freeze records that "LOCAL" names the evidence kind, not an execution location: execution on Keith's workstation is prohibited by Keith, execution anywhere requires separate authorization, and `runtimeAuthorization` (`localRuntimeAuthorized`, `stagingAuthorized`, `providerLiveAuthorized`, `creditAuthorized`) remains false. No sidecar field change is justified by this reconciliation.

---

## 6. Non-authorizations restated

This Step 2 does not authorize: Step 3 or 4; the Step 3a import; creating `ops/…` or any repository directory; editing `.gitattributes`; editing any bundle file or archive; regenerating any manifest; executing any test, mock, build, or install anywhere; provisioning or using any verification environment; SSH; staging; PM2; browser; Docker/Postgres/Redis; provider/credit; Harness flags; environment changes; Option A/B selection; P1 authorization; P7 acceptance; P4/P5 attestation; a P6 procedure; host CLEAN; fence claims; EXEC-01C6A reopen or `startCondition` change; canary; lane admission; Git commit/push/branch/worktree; subagents.

---

## 7. Keith decisions required before Step 3

| ID | Decision | Status |
|---|---|---|
| K1 | Approve the authoritative editable location (L1 `ops/aisb-01c6a-operator-bundle/` or an alternative root) as a structural deviation, including the path-scoped LF `.gitattributes` rule | **APPROVED 2026-09-18** (Keith: `ops/aisb-01c6a-operator-bundle/`; scoped `.gitattributes`; executed in Step 3a, §10.1–§10.2) |
| K2 | Authorize Step 3a import (byte-faithful copy of ZIP B entries) and the 39/39 raw re-verification gate | **APPROVED 2026-09-18** (executed: 40/40 raw match; §10.1) |
| K3 | Authorize Step 3 implementation within W1–W8 exactly | **APPROVED 2026-09-18** (bounded source implementation + writing tests only; executed, §11; behavioural verification NOT RUN) |
| K4 | Select and authorize the verification environment (§5.2) and its resource declaration, if any | **SELECTED 2026-09-18** (Keith: standard GitHub-hosted ubuntu-24.04, fake-only, `workflow_dispatch` only; bounded scope extension to `.github/workflows/pm2-overlay-unknown-verify.yml`; no catalogue resource — not LOCAL-RUNTIME / STAGING / PROVIDER-LIVE; `runtimeNeeds=[]`; workflow PREPARED, NOT dispatched; §12). **First remote run 35327293618 FAILED (127 tests; failures=2 errors=3 skipped=1); corrections WRITTEN / NOT YET REMOTELY VERIFIED; rerun of the complete suite required after commit (§13)** |
| K5 | Authorize Step 4 verification / checkpoint / lock | OPEN |
| — | P1 UNKNOWN policy, P6 procedure, P7 acceptance, P4/P5 attestations, Option A/B, EXEC-01C6A reopen, canary | OUTSIDE THIS TASK; not requested |

---

## 8. Step 2 verdict

### 8.1 Frozen (complete)

Source baseline identity and 39/39 raw verification (§2.2); provenance chain and limitations (§2.1, §2.5); exact bundle-relative write set W1–W8 and exclusions (§3.2–§3.3); artifact/manifest/packaging handling (§3.4); conditional lease declarations (§3.5); failure/concurrency/retention semantics (§4.1–§4.10); allowlist assessment (§4.10); verification environment proposal, doubles, matrix T1–T14, evidence, and evidenceClass reconciliation (§5).

### 8.2 Unmet implementation prerequisite (blocking Step 3)

> **Step 3a note (2026-09-18):** this prerequisite is now **MET** — see §10.1–§10.2 and §10.5. The paragraph below is retained as the Step 2 record.

**Authoritative editable bundle location — NOT ESTABLISHED.** Missing artifact: an approved, LF-faithful, raw-verified editable tree of ZIP B under version control. Next action: Keith decision K1 → Step 3a import under K2 → 39/39 raw match against §2.2 via `Get-FileHash` → control plane updates `writePaths`/`hotfiles`/`writeSetPrecision=EXACT` on the sidecar candidate. Until then `writeSetPrecision=PROVISIONAL`, `admissionUncertain=true`, and no lane admission.

Second open item (does not block the freeze, blocks Step 4): no authorized verification environment exists (K4).

### 8.3 What this verdict is not

Not implementation readiness; not admission; not a fence, policy, host-CLEAN, risk-acceptance, or reopen decision. STEP_2_VERDICT=FREEZE_COMPLETE_PREREQUISITE_UNMET.

---

## 9. Activity ledger (Step 2 window, 2026-09-18)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, vendor-source fetch=0, live inspection=0, browser=0, subagents=0, Git mutations=0, application source=0, canary scripts mutated=0, evidence doc mutated=0, predecessor body edits=0, EXEC-01C6A body/candidate edits=0, bundle files mutated=0, archives mutated=0, manifests regenerated=0, review-directory files touched=0, protected values read=0, config contents read=0 (hashed only), bundle scripts executed=0, archive contents executed=0, tests executed=0 except lane-capacity validator, mocks=0, builds=0, installs=0, dependencies=0, migrations=0, PRD.md/ARCHITECTURE.md/CLAUDE.md/AGENTS.md/validator/mutex-catalog edits=0, Lane 1/2 admission=0, Lane 3 enablement=0, Option A/B selected=0, P1/P7 recorded=0, EXEC-01C6A reopened=0, Step 3a import performed=0, `ops/` created=0, `.gitattributes` edited=0.

Read-only actions performed: repository search for bundle references; TEMP directory inventory (names/sizes/mtimes); in-memory raw SHA-256 of all 80 archive entries (ZIP A + ZIP B) and of the review-directory and `zip-orig` files; parse of ZIP B's two manifest entries; throw-away read-only extraction of ZIP B for static source reading (removed at window end); static reads of `OPERATOR-BUNDLE.md`, `lib/overlay_restore.py`, `lib/orchestrate.py`, `lib/vault.py`, `lib/accepted_result.py`, `lib/cleanup_contract.py`, `lib/secret_io.py` (redaction helper only), `bin/*.sh` entry points, `bin/verify-transfer.py`, `bin/write-transfer-manifest.py`, `bin/mock-pm2.py`, and targeted sections of `tests/test_operator_bundle.py`.

Governance writes this window: this document (created); `TASKS.md` current board fields for this task; `TASKS_BACKLOG_FULL.md` PM2-OVERLAY-UNKNOWN-01 body; `docs/control-plane/lane-saturation-state.json` **unchanged** (no scope/resource/evidence field change justified — §3.5, §5.6); `docs/control-plane/SATURATION_PROOF.json` only as validator output. GOVERNANCE acquired transiently then released UNOWNED. Occupancy EMPTY. Lane 3 DISABLED. EXEC-01C6A `startCondition=NOT_READY` unchanged. Builder gate LEFT ON. Harness flags unchanged.

---

## 10. Step 3a addendum — version-controlled baseline and freeze corrections (CONTROLLING) — 2026-09-18

**Window:** Step 3a only (preparation; no implementation-lane admission). Base HEAD `0373c3e5b13c64b396c433e3ce5e0d6bc938b125` (Step 2 freeze commit). Keith approved **K1** (editable location `ops/aisb-01c6a-operator-bundle/`) and **K2** (byte-faithful import of ZIP B, raw-hash verification, scoped `.gitattributes`). **K3 implementation, K4 test execution, and K5 checkpoint/lock remain NOT AUTHORIZED.**

**Precedence:** §10 is controlling for later implementation. Where §10.3 differs from §4.1, §4.4, §4.5, §4.6, §5.4 or §3.4, §10.3 governs; the earlier text is preserved unchanged as the Step 2 historical record. Nothing in §10 has been implemented or tested; §10 describes design and an import, not verified behaviour.

### 10.1 Import record (K1/K2 executed)

| Item | Result |
|---|---|
| Source archive | `%TEMP%\aisb-01c6a-operator-review-coverage-corrected.zip` (ZIP B) |
| Archive SHA-256 (required = observed) | `2edb2e2fa716b326ee61b9d41af0db78dbd0864127bed6959ccc882df10aa4b3` — **ARCHIVE_HASH_OK** |
| Entry safety | 40 file entries; 0 directory-only entries; every path matched the §2.2 table exactly; no backslash, absolute, drive-letter, `.`/`..` segment, control character, or symlink-mode (`S_IFLNK` in external attributes) entry; each entry's decompressed length equalled the header length — **PRE_IMPORT_VERIFY_OK 40/40** (in memory, before any write) |
| Config template check (bounded, non-printing) | `config/defaults.env`: **SAFE** — 16 lines, 10 non-comment `KEY=value` lines; no secret-named key with a non-placeholder value, no token-shaped / high-entropy / credential-URL / PEM value. `config/xai-observation-addrs.txt`: **SAFE** — 4 lines, all comment/blank (0 address lines). No value was printed, copied, or recorded. Result classes reported: SAFE / SAFE (no BLOCKED). |
| Destination | `ops/aisb-01c6a-operator-bundle/` (did not previously exist; created; no overwrite conflict; every target path confirmed inside the destination root) |
| Imported | exactly the 40 ZIP B file entries, byte-for-byte (`File.WriteAllBytes` from the in-memory entry bytes). **Not** copied: the CRLF review directory, `__pycache__`/`.pyc`, `mocks\`, vaults, runtime outputs, or any other `%TEMP%` content |
| Post-import re-verification (`Get-FileHash -Algorithm SHA256` on disk) | **40/40** match §2.2, including `REVIEW-SHA256.txt` against its separately recorded hash `a58857137103d5c9fd4606e8ac02e0ab9c11924a493c54efa2a0480077b3d10f`; 0 unexpected files on disk |
| Manifest-listed entries vs imported manifests | **39/39** (`REVIEW-SHA256.txt` 39 ∪ `TRANSFER.manifest` 36) |
| Line-ending census on disk | 38 LF-only files; 2 CRLF files (`REVIEW-SHA256.txt`, `TRANSFER.manifest`) — identical to ZIP B |
| Manifests regenerated / bundle code modified / anything executed | **NO / NO / NO** |

The imported tree is now the **authoritative editable location**; §8.2's blocking prerequisite is **MET** (see §10.5). ZIP A and ZIP B remain unmodified historical evidence in `%TEMP%`; the CRLF review directory remains untouched and is not a baseline.

### 10.2 Byte preservation through Git (`.gitattributes`, scoped)

No `.gitattributes` existed anywhere in the repository (`git ls-files` had no match), so the new root file contains only this task's rules:

```text
ops/aisb-01c6a-operator-bundle/** text eol=lf
ops/aisb-01c6a-operator-bundle/TRANSFER.manifest -text -eol
ops/aisb-01c6a-operator-bundle/REVIEW-SHA256.txt -text -eol
```

Rationale: `core.autocrlf=true` is set for this checkout; without attributes the 38 LF files would be checked out CRLF (breaking §2.2 raw identity), and a blanket `text eol=lf` would LF-normalise the two CRLF manifests in the index (breaking their accepted hashes and `verify-transfer.py`). The `-text -eol` exceptions keep the manifests' baseline bytes exactly. Global Git configuration was not changed; no unrelated file is renormalised (the rules match only this directory).

Read-only verification performed:

- `git check-attr text eol` over all 40 files: 38 × `text: set / eol: lf`; 2 × `text: unset / eol: unset` (the two manifests). Unrelated paths (`TASKS.md`, `frontend/package.json`) report no attributes.
- Filter simulation without touching the index: for every file, `git hash-object --path=<file>` (applies the attribute filters as `git add` would) equalled `git hash-object --no-filters` — **0 / 40 files would be altered by Git's clean filter**, i.e. the blobs Git would store are the exact §2.2 bytes.
- `.gitattributes` itself is LF, UTF-8, no BOM.

No `git add`, commit, push, branch, or worktree was performed (Keith owns Git).

### 10.3 Design corrections (controlling; design only — NOT implemented)

#### 10.3.A F5 compatibility — restoration success requires proof, not disclaimers

**Defect in §4.4:** it allowed `ok` / `restore_ok` / `overlays_restored = True` from `commands_acked ∧ snapshot_matched ∧ ¬latched` while attaching `fence_claim="NONE"`. PM2-FENCE-01 F5 states that automation must not report `restore_ok=True` unless F1–F4 hold; a disclaimer does not satisfy F5. §4.4's success rule, the cleanup rule in §4.5 step 6, and T13 are **withdrawn** and replaced as follows.

1. **Evidence fields stay separate and are reported as evidence only:** `commands_acked` (every restore attempt in this run `ACKED`; no non-`ACKED`/non-`NOT_DELIVERED` apply attempt in this run or in the journal), `snapshot_matched` (dual-field comparison matched for every app, §4.8), `unknown_pending_overlay` (latched), `attempts` (journal ids). These fields never imply restoration success.
2. **Restoration claim requires an F1–F4 proof input.** `RestoreResult` and `orchestrate()` gain a `fence_proof` input/field whose value is `NONE` or a proof record. `restore_ok = overlays_restored = (fence_proof ≠ NONE) ∧ commands_acked ∧ snapshot_matched ∧ ¬latched`. The bundle has **no** source of a proof record: `CliPm2`, `bin/orchestrate-canary.sh`, `bin/restore-overlays.sh`, and `main()` always supply `fence_proof=NONE`. Consequently, as implemented by this task, `restore_ok` and `overlays_restored` are **always False in production**, which is the F5-correct statement of the bundle's actual capability (PM2-FENCE-01 §5.2: `CliPm2` does not implement F1–F3). The field `fence_claim` is removed from the design; there is no disclaimer path to success.
   **`fence_proof` boundary (correction, 2026-09-18):** `fence_proof` is not a boolean and is not settable from outside the process. No CLI flag, environment variable, configuration value (`defaults.env` or otherwise), file marker, or caller assertion may construct, load, or pass a non-`NONE` value; no production module, entry point, or shell wrapper may accept one; the type check in `orchestrate()` must reject anything other than the `NONE` sentinel that did not originate from the (non-existent) authorized provider. This task has **no authorized production proof provider and no override**. Production restoration-success flags therefore remain False under the current scope, and the only way for them to become True is a separately authorized future task that registers a provider satisfying F1–F4 — not a configuration or flag change. The plumbing exists solely so that F5 gating is a property of the result type rather than a disclaimer.
3. **Result classes (replacing §4.4's list):** `UNKNOWN_PENDING_OVERLAY` (latched), `RESTORE_FAILED`, `PENDING_HMAC`, `UNSUPPORTED_ABSENT_RESTORE`, `RESTORE_INTERRUPTED`, `RESTORE_ATTEMPTED_ACKED_MATCHED_UNPROVEN` (all restore clients acked, dual snapshot matched, not latched, **no proof** — evidence class, not success), and `RESTORED_PROVEN` (the same **plus** `fence_proof ≠ NONE`; unreachable from any shipped entry point). `RESTORE_ATTEMPTED_ACKED_MATCHED_UNPROVEN` yields classification `INCOMPLETE`, `next_canary_allowed=False`.
4. **Cleanup rule (replacing §4.5 step 6):** `clear_pending_app` and `delete_vault_fn()` run **only if** `restore_ok=True` (which requires proof) **and** `windows.restore_due()` is `None` **and** no latch **and** the journal has no non-terminal or `UNCERTAIN` entries. Without proof: recovery material, `pending_apps.json`, the journal, and the result file are all retained; `vault_preserved=True`. `delete_protected_recovery` additionally refuses (`RESTORE_UNPROVEN`) when called without a proof-bearing result, so a caller-supplied `delete_vault` cannot bypass the rule.
5. **Next-canary permission:** `allows_next_canary` is unchanged in code (out of write set) and already requires `restore_ok ∧ overlays_restored`; under this design it therefore returns False in production. No new gate is added; none is weakened.
6. **Operational consequence (disclosed, intended; corrected 2026-09-18):** every production run now ends with recovery material retained, and the following run is refused by `refuse_unresolved_vault` (`UNRESOLVED_VAULT_EXISTS` / §4.7 codes). **This task provides no clearance or unblock mechanism. Recovery material and next-run blocking remain. Any later resolution requires a separately authorized procedure satisfying the applicable frozen requirements; P6 verification alone is insufficient.** P6 is named-key verification within the frozen policy sequence; it does not resolve command fate, establish a fence, clear UNKNOWN, authorize deletion of recovery material, or independently permit another run. This addendum does not select or authorize that later procedure. This is the frozen program's intent (host UNCLEAN until P1–P8; PM2-FENCE-01 §6.3): the bundle must not clear its own state. `bin/restore-overlays.sh` (unchanged) exits 1 whenever `result.ok` is False, i.e. always without proof; its printed `matched=` flag remains an operator evidence field, not a restoration-success claim. This task does **not** define any resolution procedure, accept P7, or alter P1–P8 meanings.
7. **T13 corrected:** full acknowledgement + matching dual snapshot + window inside bounds + `fence_proof=NONE` (the real entry-point condition) → `commands_acked=True`, `snapshot_matched=True`, `result_class=RESTORE_ATTEMPTED_ACKED_MATCHED_UNPROVEN`, `restore_ok=False`, `overlays_restored=False`, cleanup **not** performed, `vault_preserved=True`, `next_canary_allowed=False`, classification `INCOMPLETE`, fake-PM2 state equals baseline on both fields. **T13b (gating logic only; corrected 2026-09-18):** same inputs with an isolated test double injected directly into `orchestrate(... fence_proof=<double>)` from within the test module → `RESTORED_PROVEN`, cleanup performed once, `allows_next_canary` reachable for the double. Constraints: the double is defined only inside `tests/test_operator_bundle.py`; no production module, entry point, shell wrapper, flag, environment variable, or configuration value may construct, import, or reach it; the test must also assert by static inspection that `main()` and both shell entry points pass `fence_proof=NONE` and that no production module constructs a non-`NONE` value. T13b examines gating behaviour only. It is **not** fence evidence, does not imply F1–F4 are or can be satisfied, and must not be described as such; if implementing it would require any production-accessible bypass, T13b is dropped rather than the boundary weakened. No test execution is authorized now (K4/K5 open).
8. **T14 widened:** every existing assertion of `overlays_restored=True`, `restore_ok=True`, vault deletion after a match, or `next_canary_allowed=True` (e.g. `test_vault_deleted_only_after_restore_match` l.1869, `test_mark_before_apply_restores_after_exception` l.1043, and any others found by `grep` in Step 3 — the list is to be established by static inspection, not assumed here) must be re-based onto the evidence fields and observed fake-PM2 state, or moved under a T13b-style stub. Tests asserting fail-closed behaviour (window expiry, interrupt, unresolved vault, double-restart prevention, apply stop after restore start) keep their meaning.

#### 10.3.B Journal lifecycle — live vs orphaned attempts; ownership between INTENT and spawn

**Gap in §4.1/§4.5/§4.6:** they did not distinguish an attempt this process owns from one found on disk, and did not state what happens when the restore owner takes ownership after an apply's `INTENT` is persisted but before its child is spawned.

1. **Entry identity:** every journal entry carries `run_id` (uuid4 generated once per `orchestrate()` / `restore_overlays()` invocation), `pid`, `attempt_id`, `seq` (monotonic within the file), plus the §4.1 fields.
2. **LIVE attempt:** an entry whose `run_id` equals the current run's and for which an in-memory `Attempt` object exists (holding the `settled` event, the admitted state, the `Popen` handle once spawned). Only LIVE attempts can be waited on.
3. **ORPHANED attempt:** any entry without a terminal phase whose `run_id` differs from the current run's (found at next-run start by `refuse_unresolved_vault`), or — within a run — an entry without a terminal for which no `Attempt` object exists (corrupt in-process state). An ORPHANED `INTENT` is classified `UNCERTAIN`, not `NOT_DELIVERED`: the disk record cannot show whether `Popen` ran before the crash (`DISPATCHED` is written only after `Popen` returns). Orphans are therefore latched and block the next run (§4.7 `UNRESOLVED_COMMAND_ATTEMPTS`). No code path adopts or resolves an orphan.
4. **Admission → spawn protocol (replacing §4.6 paragraph 2):**
   - (a) under `restore_lock`: if `restore_gate.started` → refuse (`OVERLAY_AFTER_RESTORE`), nothing written; else create `Attempt(state=ADMITTED_NOT_SPAWNED)`, register it in `restore_gate.attempts`, write `INTENT` (durable per §10.3.C), release the lock;
   - (b) build argv/env; then **re-acquire `restore_lock`** immediately before `Popen`: if `restore_gate.started` is now True → write terminal `NOT_DELIVERED` with `reason=REFUSED_BEFORE_SPAWN` (proven: no process was ever created), set `settled`, release, raise `OVERLAY_AFTER_RESTORE`; else call `Popen` **while still holding the lock** (spawn is fast; the lock is *not* held across `wait`), write `DISPATCHED` (with `client_pid`), release;
   - (c) `communicate/wait` with the timeout outside the lock; write the terminal phase; set `settled`.
   - Because ownership (`started=True`) is taken under the same lock and never reset, once the owner observes `started=True` no LIVE attempt can pass step (b)'s check; **no admitted attempt can spawn after ownership, cleanup, or result publication**. This holds by construction, not by timing.
5. **Owner accounting (replacing §4.5 step 2):** after taking ownership the owner snapshots `restore_gate.attempts`. For each LIVE `APPLY` attempt: if `ADMITTED_NOT_SPAWNED` → wait on `settled` for a short bound (2 s; the pre-spawn check runs promptly) expecting `NOT_DELIVERED/REFUSED_BEFORE_SPAWN` → not latched; if it does not settle within the bound → `UNCERTAIN` (fail closed: an in-memory state the owner cannot account for is uncertainty) → latch. If `DISPATCHED` → wait on `settled` up to the attempt's remaining client timeout + 2 s (bounded by `restore_reserve`); `ACKED` after ownership → `ACKED_LATE` → latched (ordering versus the restore is unknown); non-`ACKED` → `UNCERTAIN` → latched; unsettled → `UNCERTAIN` → latched. Every entry on disk lacking a terminal after this accounting is latched as `UNCERTAIN`. The owner then proceeds with restore attempts (which use the owner token and follow the same INTENT/DISPATCHED/terminal protocol).
6. **Latch monotonicity (unchanged, restated):** once any attempt is `UNCERTAIN`, `ACKED_LATE`, or ORPHANED, or the marker exists, the run and all later runs are latched. Nothing in §10.3.B relaxes §4.3.

#### 10.3.C Durability of atomic writes and lost-update prevention

`os.replace` alone gives atomic *visibility* of a rename, not crash *durability*: the new inode's data and the directory entry may still be in volatile caches. The frozen write procedure for `overlay_commands.json`, `unknown_overlay.json`, `restore_result.json`, and `pending_apps.json` (W3 helper `durable_replace(path, bytes)`):

1. open a temp file in the **same directory** (`tempfile.NamedTemporaryFile(dir=..., delete=False)`; mode 0o600 on POSIX);
2. write all bytes; `flush()`; `os.fsync(tmp_fd)`; close;
3. `os.replace(tmp, path)`;
4. on POSIX: `dfd = os.open(dirname, os.O_RDONLY)`; `os.fsync(dfd)`; `os.close(dfd)` (makes the rename itself durable). On Windows directory fsync is unavailable; the helper records `durability=RENAME_ONLY` in the entry and Windows is documented as not a supported execution target for this state machine (tests run on the Linux runner, §5.2). An `OSError` in steps 1–4 is a `JOURNAL_WRITE_FAILED`: the operation that required the write is refused (no spawn; or, for a terminal/latch write, the exception is re-raised after a best-effort marker write attempt and the process exits non-zero — uncertainty is never dropped silently).

Concurrency (single process, multiple threads — main path, watchdog thread, apply threads):

- all journal mutations go through one `journal_lock` (`threading.Lock`), always acquired **after** `restore_lock` when both are held (fixed order; no path acquires `restore_lock` while holding `journal_lock`) — eliminates lost updates from interleaved read-modify-write;
- each mutation reloads the file under the lock, appends/updates, verifies that the loaded `seq` sequence is contiguous and the last `seq` equals the in-memory expectation (`JOURNAL_SEQ_MISMATCH` → treat as corrupt → latch, fail closed), then writes with `durable_replace`;
- the marker file is written by the same helper under `journal_lock`; marker and journal are two files, so the invariant "latched iff marker exists **or** journal shows any `UNCERTAIN`/non-terminal entry" (§4.3) tolerates a crash between the two writes without losing the latch.

Cross-process: a vault-scoped run lock `<vault>/.run.lock` (`fcntl.flock(LOCK_EX|LOCK_NB)` on POSIX; `msvcrt.locking` fallback) is taken by `orchestrate()` and by `restore_overlays()` (W1, so `bin/restore-overlays.sh` needs no change) for the duration of the run; a second process gets `RUN_LOCK_HELD` and performs no mutation. `refuse_unresolved_vault` runs after the lock is held.

#### 10.3.D Effect on the test matrix

Added: **T13b** (gating behaviour via an isolated test double confined to the test module; not fence evidence; no production-accessible bypass; §10.3.A.7); **T15** ownership between `INTENT` and spawn → `NOT_DELIVERED/REFUSED_BEFORE_SPAWN`, no spawn, no latch from that attempt; **T16** orphaned `INTENT`/`DISPATCHED` from another `run_id` → `UNCERTAIN`, latched, next run blocked; **T17** `durable_replace` call-sequence spy (fsync file → replace → fsync dir) and `JOURNAL_SEQ_MISMATCH` → latch; **T18** second process / second `restore_overlays` on the same vault → `RUN_LOCK_HELD`, no mutation. T13 and T14 replaced per §10.3.A.7–8. T1–T12 unchanged in intent; their expected `restore_ok`/`overlays_restored` values are already False.

### 10.4 Control-plane scope after Step 3a

Two distinct scopes:

| Scope | Files | Status |
|---|---|---|
| **Import scope (Step 3a, done)** | the 40 imported baseline files under `ops/aisb-01c6a-operator-bundle/` (byte-for-byte; no edits permitted), `.gitattributes` (scoped rules above), this document, `TASKS.md` fields, `TASKS_BACKLOG_FULL.md` body, sidecar candidate fields, `SATURATION_PROOF.json` | written this window; untracked import files verified 40/40 |
| **Modification set (Step 3, NOT AUTHORIZED)** | exactly eight files: `ops/aisb-01c6a-operator-bundle/lib/overlay_restore.py`, `…/lib/orchestrate.py`, `…/lib/vault.py`, `…/tests/test_operator_bundle.py`, `…/bin/mock-pm2.py`, `…/TRANSFER.manifest`, `…/REVIEW-SHA256.txt`, `…/OPERATOR-BUNDLE.md` (W1–W8) | frozen; the other 32 imported files and `.gitattributes` are read-only for Step 3 |

Sidecar candidate (`docs/control-plane/lane-saturation-state.json`) updated for this candidate only: `writePaths` = the eight W1–W8 repository paths; `hotfiles` = the same eight (no catalogue mutex covers `ops/`; HOTFILE is the existing mechanism); `writeSetPrecision=EXACT` (paths now exist and are frozen); `mutexes=[]`, `runtimeNeeds=[]`, `evidenceClass=LOCAL-TESTS`, `exclusiveCapacity=false`, `admissionUncertain=true` (execution environment K4 still open; K3 not granted) — unchanged. Occupancy EMPTY; `lockedTaskIds` untouched; runtime authorization false; GOVERNANCE released UNOWNED after this write. `mutex-catalog.json` not edited.

### 10.5 Prerequisite status and remaining decisions

- §8.2 blocking prerequisite (authoritative editable bundle location): **MET** by §10.1–§10.2. STEP_3A_VERDICT=BASELINE_IMPORTED_FREEZE_CORRECTED.
- Remaining before Step 3: **K3** (authorize implementation within the eight-file modification set under §4 as corrected by §10.3). Remaining before Step 4: **K4** (verification environment; nothing exists or is provisioned) and **K5** (verification / checkpoint / lock). P1, P6, P7, P4/P5, Option A/B, EXEC-01C6A reopen, canary: outside this task; not requested.
- Step 3 must begin by re-running `Get-FileHash` over the 40 imported files and confirming 40/40 against §2.2 before the first edit.

> **Step 3 note (2026-09-18):** K3 was approved and executed — see §11. The 40/40 pre-edit gate passed. K4 and K5 remain OPEN.

### 10.6 Activity ledger (Step 3a window, 2026-09-18)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, browser=0, subagents=0, Git add/commit/push/branch/worktree=0, global Git config changes=0, application source=0, bundle code modified=0, manifests regenerated=0, archives mutated=0, review-directory files touched=0, protected values read=0, config values printed or copied=0 (bounded pattern check only), bundle scripts executed=0, archive contents executed=0, tests executed=0 except lane-capacity validator, mocks=0, builds=0, installs=0, dependencies=0, predecessor body edits=0, successor registration=0, EXEC-01C6A changes=0, Lane admission=0, Lane 3 enablement=0, Option A/B selected=0, P1/P7 recorded=0.

**Documentation-only correction (same day, second window):** §10.3.A.2 gained the `fence_proof` boundary paragraph (no boolean / flag / env / config / caller-assertion path to a non-`NONE` value; no authorized production provider or override); §10.3.A.6 no longer states that a P6 procedure resolves the next-run block — this task provides no clearance or unblock mechanism, and P6 verification alone is insufficient; §10.3.A.7 T13b and §10.3.D restated as an isolated test double confined to the test module that is not fence evidence and creates no production-accessible bypass. No imported file, manifest, `.gitattributes`, sidecar, predecessor body, or P1–P8 meaning was changed; inherited baseline whitespace (manifest trailing whitespace; EOF blank lines in `lib/capture.py`, `lib/reconcile.py`) is preserved and disclosed, not cleaned up. Only the validator and static diff/scope checks were run.

Actions performed: archive hash verification; in-memory entry safety and 40/40 pre-import hash check; non-printing config template check (SAFE/SAFE); creation of `ops/aisb-01c6a-operator-bundle/` with 40 byte-faithful files; post-import `Get-FileHash` 40/40 and manifest 39/39; line-ending census (38 LF / 2 CRLF); creation of `.gitattributes`; `git check-attr` and `git hash-object --path` vs `--no-filters` simulation (0/40 altered); this addendum; board / backlog / sidecar / proof mirrors; lane validator; `git diff --check` and scope inspection including untracked files.

---

## 11. Step 3 (K3) implementation record — IMPLEMENTATION WRITTEN / BEHAVIOURAL VERIFICATION NOT RUN — 2026-09-18

**Window:** Step 3 implementation only. Base HEAD `820609809276566d5490e1fef2ead439e8b43389` (Step 3a commit; working tree clean at window open). Keith authorized **K3** (bounded source implementation and writing tests within the eight-file modification set under §4 as corrected by §10.3). **K4 execution/provisioning and K5 checkpoint/lock remain NOT AUTHORIZED.** No application execution, test, mock, build, install, bundle-script execution, SSH, staging, PM2, browser, provider/credit, flag, environment change, provisioning, subagent, or Git add/commit/push occurred. Occupancy EMPTY; `admissionUncertain=true`; no lane admission; no runtime authorization. STEP_3_VERDICT=IMPLEMENTATION_WRITTEN_VERIFICATION_PENDING_K4 — **not** Step 3 acceptance, not PASS.

### 11.1 Pre-edit gate and scope confirmation

- `Get-FileHash -Algorithm SHA256` over the 40 imported files against §2.2 **before the first edit: 40/40 match** (table parse 40 entries; 0 unexpected files on disk). Nothing was normalised or regenerated.
- No conflicting writer: `git status` showed no modification under `ops/aisb-01c6a-operator-bundle/` at window open; the board shows occupancy EMPTY and no HOTFILE lease on any of the eight paths held by another task.
- The 32 read-only files, `.gitattributes`, ZIP A/B, and the CRLF review directory were not opened for writing.

### 11.2 What was implemented (W1–W8; bundle-relative)

| File | Implementation (static description; not verified behaviour) |
|---|---|
| **W3 `lib/vault.py`** | `durable_replace` (§10.3.C steps 1–4; returns `FULL` / `RENAME_ONLY`, the latter recorded per journal entry on Windows). `CommandJournal` (`overlay_commands.json`, `format=1`; entries carry `attempt_id`, `run_id`, `pid`, `seq`, `op`, `app`, `keys` (names only), `phase`, `mono_ts`, `wall_ts`, `client_pid`, `exit_code`, `reason`, `durability`; `intent` → `dispatched` → `terminal`; every mutation reloads under `journal.lock`, validates shape and contiguous `seq`, checks the in-memory last-`seq` expectation (`JOURNAL_SEQ_MISMATCH`), then `durable_replace`s; a terminal is written once and only an upgrade **to** `UNCERTAIN` is accepted afterwards). `latch_unknown` (`unknown_overlay.json`, `format=1`, union-merge of `attempts/apps/keys/reasons`; never removes; serialized through `journal.lock` when a journal is supplied). `unresolved_state_codes` / `unknown_latched` (marker ∨ non-terminal/`UNCERTAIN` entry ∨ unreadable/malformed → `UNKNOWN_STATE_CORRUPT`; fail closed). `orphaned_attempts` (read-only view; never adopts). `write_restore_result` (redacted). `VaultRunLock` (`<vault>/.run.lock`; `fcntl.flock LOCK_EX|LOCK_NB` / `msvcrt.locking` fallback; a second acquire in the same process for the same vault is also `RUN_LOCK_HELD`; the owning run passes its held lock to nested calls). `protected_recovery_present` counts the marker and unresolved journal entries as recovery material. `refuse_unresolved_vault` raises `VaultStateError` carrying all codes (`UNRESOLVED_VAULT_EXISTS`, `UNRESOLVED_UNKNOWN_OVERLAY`, `UNRESOLVED_COMMAND_ATTEMPTS`, `UNKNOWN_STATE_CORRUPT`). `delete_protected_recovery(vault, proven_result=)` refuses `RESTORE_UNPROVEN` unless the passed result object has `restore_proven is True`, and `UNKNOWN_LATCHED` while any unresolved state exists; `clear_pending_app` refuses `UNKNOWN_LATCHED` likewise; `mark_pending_apps` / `clear_pending_app` write via `durable_replace`. No clearance / unlatch / resolve API exists. |
| **W1 `lib/overlay_restore.py`** | `FENCE_PROOF_NONE="NONE"` is the only fence-proof value any code path produces (module constant; `RestoreResult.fence_proof` default; local binding in `finalize`). Result classes per §10.3.A.3 (`RESTORED_PROVEN` listed, unreachable). `RestoreResult` gains `result_class`, `unknown_pending_overlay`, `snapshot_matched`, `commands_acked`, `attempts`, `fence_proof`, `run_id`, `latch_reasons`; `overlays_restored` ≡ `ok`; `restore_proven` ≡ `ok ∧ fence_proof≠NONE ∧ ¬latched`. `Pm2Adapter.dump_env_dual` (default derives `pm2_env.env` from an `env` mapping when present) and `supports_spawn_gate`. `CliPm2`: `dump_env` excludes `env`; `dump_env_dual` reads both fields from one `jlist`; `_refuse_mock_state_in_live_env` (`MOCK_STATE_IN_LIVE_ENV`); `restart_update_env(..., spawn_gate=)` runs `Popen` through the caller's gate and waits outside it (kills on timeout, re-raises `TimeoutExpired`; non-zero → `CalledProcessError`); the direct call without a gate keeps the historical `check_call`. `_child_env_for_pm2(overlay, mock_cli=)`: base allowlist always; `MOCK_PM2_STATE`, `PYTHONPATH`, `PYTHONHOME`, `PYTHONIOENCODING` only for the `.py` mock branch (§4.10). `Attempt` / `DispatchContext` (`restore_lock` → `journal.lock` order; `take_ownership_locked`; `latch` best-effort with in-memory fallback). `dispatch_restart` implements §10.3.B.4 (a)–(c): admission + `INTENT` under `restore_lock`; pre-spawn re-check under `restore_lock` → `NOT_DELIVERED/REFUSED_BEFORE_SPAWN` and `OVERLAY_AFTER_RESTORE`; spawn under the lock; `DISPATCHED`; wait outside; fate classification (`TimeoutExpired`, non-zero exit, `KeyboardInterrupt`, any post-dispatch exception → `UNCERTAIN` + latch; spawn `OSError` / pre-gate failure → `NOT_DELIVERED`); `_settle_acked` decides `ACKED_LATE` under `restore_lock` (APPLY acked after ownership → latch `APPLY_ACKED_LATE`). `_accepts_spawn_gate` inspects the callable actually invoked, so legacy two-argument adapters (`MemoryPm2`, test subclasses) run their whole call as the spawn step under the lock and are never called with `spawn_gate=`. `account_live_attempts` implements §10.3.B.5 (bounded waits: `accounting_wait_sec` 2 s for admitted-not-spawned, remaining timeout + 2 s for dispatched, both capped by the caller's bound = `restore_reserve_sec`; unsettled → `UNCERTAIN`; orphaned on-disk entries → latch `ORPHANED_ATTEMPT`, never adopted; own entry without in-memory attempt → `UNACCOUNTED_ATTEMPT`). `compare_restore_dual` (§4.8; `DIVERGENT` per named key) and `assert_baseline_consistent` (`BASELINE_DIVERGENT` pre-mutation). `restore_overlays(vault, apps, pm2, hmac, delete_vault_on_success=<no effect>, *, ctx=None, run_lock=None, accounting_bound_sec=None)`: standalone (`bin/restore-overlays.sh`) takes the run lock and ownership itself (returns `RUN_LOCK_HELD` with no mutation if held); orchestrated calls pass the owning `ctx` and held `run_lock` (no re-lock; `RESTORE_NOT_OWNER` if the context has no owner). `_restore_owned` accounts live attempts first, dispatches one journaled `RESTORE` per app with the owner token, takes the dual snapshot, compares (secret SET exact on both fields), latches on divergence / snapshot-read failure, then `finalize` computes evidence fields, `fence_proof=NONE`, `ok=False` in every reachable path, `result_class`, writes `restore_result.json`, and never clears pending state (the `if result.ok` branch is structurally unreachable). |
| **W2 `lib/orchestrate.py`** | `OrchestrateResult` gains `result_class`, `unknown_pending_overlay`, `commands_acked`, `snapshot_matched`, `restore_attempts`, `run_id`, `fence_proof` (always `NONE`). `orchestrate()` creates one `DispatchContext` per run, acquires `VaultRunLock` first (a competing run ends `INCOMPLETE` / `RUN_LOCK_HELD` with zero mutation), then `refuse_unresolved_vault` (all codes appended to `reasons`), coverage, baseline dump, `assert_payloads_restorable`, **`assert_baseline_consistent` before the first mutation**, per-app baseline vault write, `mark_pending_apps`, window arming. `driver_apply` dispatches each app through `dispatch_restart(op=APPLY)` and stops silently on `OVERLAY_AFTER_RESTORE`; `gated_restart` (rebinding of `pm2.restart_update_env`) routes every external restart through the same admission (no owner token; the shared `in_restore` flag is gone). `restore_always` takes ownership under `ctx.restore_lock`, publishes exactly one result (losers wait on `done`; a missing publication yields a synthetic `UNKNOWN_PENDING_OVERLAY`), passes the held `run_lock` and `restore_reserve_sec` as the accounting bound, latches on any exception (never propagates to the watchdog), and calls `delete_vault_fn(result)` only when `result.ok` (unreachable). Default `delete_vault_fn` is `delete_protected_recovery(vault_dir, proven_result=result)`; `main()` passes `delete_vault=None` so the vault-side gate applies. `finish` releases the run lock on every exit path, appends `UNKNOWN_PENDING_OVERLAY` to `reasons` when latched, and reports the evidence fields; `main()` prints and persists them (`redact_mapping` applied). `allows_next_canary` (out of write set) still receives `restore_ok`/`overlays_restored`, which are False, so `next_canary_allowed=False` and exit 3 / `INCOMPLETE` for every production run. |
| **W5 `bin/mock-pm2.py`** | Models `pm2_env` (top) and `pm2_env.env` (nested) separately with an explicit spawn step; `jlist` emits `pm2_env.env`; legacy flat state is read as spawned. Failure injection (`latent`, `exit`, `sleep`) comes from an optional `<MOCK_PM2_STATE>.controls.json` sidecar, **not** from environment variables, so the `CliPm2` child-env allowlist is unchanged. `history[].env` keeps its historical meaning (top). Test-only; not used on staging. |
| **W4 `tests/test_operator_bundle.py`** | `FakePm2Dual` (§5.3; behaviours `ack`, `latent_ack`, `timeout_after_merge`, `timeout_before_merge`, `exit_nonzero`, `oserror_before_spawn`, `("block", release, entered)`, `("hold_before_spawn", proceed, entered)`, `interrupt`; runs its spawn step through `spawn_gate`). T14 re-base of the pre-existing tests that encoded D1 or asserted success/deletion (see §11.3). New `UnknownLatchTests` (T1–T12, T13 corrected, T15–T18, retention gate, static F5-boundary test). |
| **W6/W7 `TRANSFER.manifest`, `REVIEW-SHA256.txt`** | Regenerated by static `Get-FileHash` only (no bundle script executed), same header lines, `sha256  relative-path` format, ordinal path order (matches the baseline order), **CRLF preserved** (0 bare LF; both end with CRLF; 3250 / 3516 bytes). 36 helper entries / 39 entries. |
| **W8 `OPERATOR-BUNDLE.md`** | Appended "Revision r3 — PM2-OVERLAY-UNKNOWN-01 (UNTESTED / NOT APPROVED FOR LIVE USE)": ZIP A → ZIP B → r3 provenance chain (no r3 archive produced), the eight changed files, UNKNOWN semantics summary, F5 boundary, retention / next-run refusal, run lock, durability, allowlist, verification state. "Not READY for live execution" retained. |

### 11.3 F5 boundary as implemented (and one disclosed deviation from §10.3.A.2 wording)

- `restore_ok` / `overlays_restored` are `False` on every reachable path; `next_canary_allowed` is `False`; classification `INCOMPLETE`; `result_class` of a fully acknowledged, matching run is `RESTORE_ATTEMPTED_ACKED_MATCHED_UNPROVEN`. `commands_acked` and `snapshot_matched` are reported and persisted as evidence only.
- **No `fence_proof` input exists** on `orchestrate()`, `restore_overlays()`, `CliPm2`, `main()`, or any shell wrapper — §10.3.A.2 described an "input/field" plus a type check rejecting non-`NONE` inputs; per Keith's K3 instruction ("do not introduce a boolean, token, file, configuration, environment, CLI, or caller-assertion override … do not build speculative proof-provider machinery") the **field** was implemented and the **input** was not. There is therefore nothing to type-check: the value is a module constant. This is the stricter reading of the corrected §10.3.A.2 boundary paragraph, and it is disclosed here rather than silently applied.
- **T13b is omitted** (§10.3.A.7 condition): the only way to reach `RESTORED_PROVEN` would be a caller-supplied proof input on a production entry point, i.e. a production-accessible bypass. `test_fence_proof_boundary_static` asserts instead, by signature and source inspection of `lib/*.py`, `bin/orchestrate-canary.sh`, `bin/restore-overlays.sh`, `config/defaults.env`, and `main()`, that no production input, flag, env, config, or caller assertion can produce a non-`NONE` value.
- Cleanup (`clear_pending_app`, `delete_protected_recovery`) is gated in the vault module itself on a proven result **and** no unresolved state; the orchestrator's default deletion path passes the actual result object; a bare `True`, an arbitrary object, or a caller lambda cannot satisfy it. No pending-state clearance, recovery deletion, unlatch, or unblock path exists. P6 verification is not implemented as, and cannot act as, a resolution.
- `bin/restore-overlays.sh` (read-only, unchanged) now always exits 1 (it keys on `result.ok`); its `matched=` print is `snapshot_matched` evidence. Disclosed in W8.

### 11.4 Test coverage — WRITTEN / NOT RUN

Every test below exists in `tests/test_operator_bundle.py` and **has not been executed anywhere** (K4 not authorized; workstation execution prohibited). Static review is not behavioural verification; the suite may contain errors that only execution reveals.

*Historical K3 table (2026-09-18, first window). Execution status is superseded by §13.1 (first remote run 35327293618: 122 `ok`, 3 `ERROR` capture fixtures, 2 `FAIL` T5/T13, 1 allowed skip) and §13.2 (corrections; `test_t7b_ack_after_owner_settled_uncertain_is_evidence_only` added; total 128 tests).*

| ID | Test(s) | Status |
|---|---|---|
| T1 / T2 | `test_t1_apply_timeout_after_delivery_latches_unknown`, `test_t2_apply_timeout_before_delivery_identical_outcome` | WRITTEN / NOT RUN |
| T3 | `test_t3_restore_timeout_latches` | WRITTEN / NOT RUN |
| T4 | `test_t4_matching_snapshot_while_latched_is_not_success` | WRITTEN / NOT RUN |
| T5 | `test_t5_watchdog_restore_overlaps_in_flight_apply` (wall-clock window 0.2 s / sleep 0.5 s, `restore_reserve_sec=0` so owner accounting is bounded to zero; `threading.Event` barriers otherwise) | WRITTEN / NOT RUN |
| T6 | `test_t6_late_apply_without_token_refused_no_intent` (+ in-run assertion inside T5) | WRITTEN / NOT RUN |
| T7 | `test_t7_late_ack_after_ownership_latches` | WRITTEN / NOT RUN |
| T8 | `test_t8_interrupted_run_persists_and_blocks_next_run`, `test_t8_t16_orphaned_intent_and_dispatched_block_next_run` | WRITTEN / NOT RUN |
| T9 | `test_t9_corrupt_marker_or_journal_fails_closed` (truncated / wrong-shape / bad-seq / unknown-format) | WRITTEN / NOT RUN |
| T10 | `test_t10_divergence_after_restore_is_unknown`, `test_t10_pre_mutation_divergence_refuses_before_first_mutation` | WRITTEN / NOT RUN |
| T11 | `test_t11_dual_field_states_and_named_exceptions` | WRITTEN / NOT RUN |
| T12 | `test_t12_child_env_allowlist_per_binary_branch` | WRITTEN / NOT RUN |
| T13 (corrected) | `test_t13_acked_matched_unproven_is_not_restoration_success`; `test_fence_proof_boundary_static` | WRITTEN / NOT RUN |
| T13b | **OMITTED** (§11.3) | — |
| T14 | re-based: `test_ack_unknown_restores_no_tail_no_next`, `test_capture_start_fail_still_restores`, `test_intended_stub_allows_next` (now asserts `next_canary_allowed=False`), `test_mark_before_apply_restores_after_exception` (rewritten on the journaled driver path), `test_cli_pm2_partial_failure_continues`, `test_vault_deleted_only_after_restore_match` (deletion refused `RESTORE_UNPROVEN`), `test_cli_stub_preserves_gateway_execution_false` (exit 3, evidence fields, second run refused), `test_cli_xai_expected_rejection_exits_zero` (exit 3 / `INCOMPLETE`), `test_driver_stub_does_not_enable_gateway_execution`; `test_mock_pm2_restart_update_env` extended and `test_mock_pm2_latent_merge_leaves_top_level_stale` added for W5. Fail-closed tests (window expiry, interrupt, unresolved vault, double-restart prevention, apply stop after restore start) keep their meaning; whether they still pass is a K4 item | WRITTEN / NOT RUN |
| T15 | `test_t15_ownership_between_intent_and_spawn_refuses_before_spawn` | WRITTEN / NOT RUN |
| T16 | `test_t16_standalone_restore_on_orphaned_vault_latches_without_adopting` (+ T8/T16 above) | WRITTEN / NOT RUN |
| T17 | `test_t17_durable_replace_call_sequence_and_seq_mismatch`, `test_t17_journal_uncertain_is_monotonic` | WRITTEN / NOT RUN |
| T18 | `test_t18_second_run_on_same_vault_gets_run_lock_held` | WRITTEN / NOT RUN |
| retention | `test_recovery_deletion_and_pending_clear_refuse_under_unknown` | WRITTEN / NOT RUN |

### 11.5 Static findings and hash results

- **Baseline:** 32 read-only files byte-identical to §2.2 (**32/32**); exactly the eight W1–W8 files differ; 0 files changed outside the write set; 0 unexpected files; `.gitattributes` unchanged; ZIP A/B and the review directory untouched.
- **Manifests (static parse, no bundle script executed):** `TRANSFER.manifest` 36 entries = 36 helpers on disk, 0 missing, 0 hash mismatches; `REVIEW-SHA256.txt` 39 entries, 0 missing (excluding itself), 0 hash mismatches, lists the regenerated `TRANSFER.manifest` hash; 36/36 helper hashes agree between the two manifests. Byte-equivalence with `bin/write-transfer-manifest.py` output is a K4 item (the baseline manifest order is fully ordinal — bin/config/lib — which the regeneration reproduces; the script's own loop order is bin/lib/config, so that check may require the same ordinal sort).
- **Line endings:** 38 LF-only files (including the five edited source files), 2 CRLF-only manifests (0 bare LF; both end CRLF). `git hash-object --path` vs `--no-filters`: **0/8** edited files altered by the clean filter; `git check-attr` unchanged (text/eol=lf; manifests unset).
- **`git diff --check`:** clean except the inherited manifest "trailing whitespace" (CR before LF in the `-text` manifests) — baseline convention, disclosed, not cleaned up. `git status`: exactly the eight bundle files modified; no other path touched.
- **r3 raw SHA-256 (working tree; UNTESTED):** `lib/overlay_restore.py` `e7d5366a77a82264b44673470d45090c0ab36ba12b4f24d745f4c6c3c851b577` (56791 B); `lib/orchestrate.py` `6d06062101d6f1baee14eea77e5d835da89a6d0e8935bcd580c57f5cd9357032` (36034 B); `lib/vault.py` `62470c9f6d5657d97d6200abda53e169939c23ed37dd6abcba6a698cf67e2949` (30789 B); `tests/test_operator_bundle.py` `8b8979dabff72656a402e8ac6ae53bb892c46ad2dadaeef507dc954f5a3b024c` (209686 B); `bin/mock-pm2.py` `9fe5728e179ad0e862704620f94bf14c4d060af3c0f56256b39be3cf6c0849d9` (4802 B); `TRANSFER.manifest` `ba2fe4e6f1b2e079ea3951f4a0e13f12b532cb9253e5f545bbcbf7fb40aaa93d` (3250 B); `REVIEW-SHA256.txt` `211ee9d4647fded45097042cddfa41097e73582498838a54238be9b6f2cd0127` (3516 B); `OPERATOR-BUNDLE.md` `d24c583097f8479e5774a15fdfbefa2d200c8b5a9a77e5184f8a8db666e7cfd8` (14539 B). These are working-tree identities for review, not accepted hashes.
- **Not done (disclosed):** no Python byte-compilation or import check was run (it would be execution); syntax and import correctness rest on static reading only. No r3 archive was produced. Windows `durability=RENAME_ONLY` is recorded, not mitigated (Windows is not a supported execution target). `DispatchContext.latch` degrades to an in-memory latch plus journal state if the marker write itself fails (`JOURNAL_WRITE_FAILED` recorded in `latch_reasons`); the journal's `UNCERTAIN`/non-terminal entries still block the next run.

### 11.6 Remaining verification requirements (K4 / K5; nothing authorized here)

1. **K4 — authorized isolated environment** (§5.2; none exists; nothing provisioned): copy the LF tree; `python -m unittest tests.test_operator_bundle -v` (Python 3.11+; fakes only; no real `pm2`/`node`/`tcpdump`/`sudo`). Record full output, including every pre-existing test.
2. `CRLF=0` census over the 38 LF entries; confirm the two manifests are CRLF-only.
3. Byte-equivalence of the regenerated manifests with `bin/write-transfer-manifest.py` output (or record the ordinal-order difference explicitly); `bin/verify-transfer.py` → `TRANSFER_VERIFY_OK helpers=36`.
4. Produce `aisb-01c6a-operator-review-r3-unknown-latch.zip` from the LF tree (entry timestamps normalised as in ZIP B); record its SHA-256 in `OPERATOR-BUNDLE.md`; ZIP A/B remain untouched.
5. Static F5-boundary test and T13b-omission rationale re-reviewed against the executed suite; any test failure returns the task to implementation (K3 scope) rather than weakening an assertion.
6. **K5 — checkpoint / lock** only after items 1–5 pass in the authorized environment and the control plane integrates the evidence. Until then: task not locked; `PM2_OVERLAY_UNKNOWN_01_LOCKED=NO`; EXEC-01C6A `startCondition=NOT_READY` unchanged; no canary, no staging transfer, no P1/P6/P7, no Option A/B, no fence claim.

### 11.7 Control-plane end state and activity ledger (Step 3 window, 2026-09-18)

Board fields for this task updated (`PM2_OVERLAY_UNKNOWN_01_STEP_3=IMPLEMENTATION WRITTEN / VERIFICATION PENDING K4`, `IMPLEMENTATION_STARTED=YES (K3; Keith-authorized bounded implementation outside lane admission; occupancy EMPTY)`, stage-start pointer §11); canonical body history appended; sidecar **unchanged** (no scope, resource, evidence-class, or status change arose; `writePaths`/`hotfiles` already equal the eight-file set; `admissionUncertain=true`); `SATURATION_PROOF.json` rewritten only by the validator. GOVERNANCE acquired transiently for these mirrors then released UNOWNED. Occupancy EMPTY. Lane 3 DISABLED. EXEC-01C6A `startCondition=NOT_READY` unchanged. Builder gate LEFT ON. Harness flags unchanged. Successor registration=0. All eight files (and this document / board / backlog / proof) are uncommitted working-tree changes pending Keith's Git.

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, browser=0, subagents=0, Git add/commit/push/branch/worktree=0, application source=0, read-only bundle files modified=0 (32/32 identical), `.gitattributes` edited=0, archives mutated=0, review-directory files touched=0, protected values read=0, config contents read=0, bundle scripts executed=0, Python executed=0, tests executed=0 except lane-capacity validator, mocks executed=0, builds=0, installs=0, dependencies=0, predecessor body edits=0, EXEC-01C6A changes=0, Lane admission=0, Lane 3 enablement=0, Option A/B selected=0, P1/P6/P7 recorded=0, r3 archive produced=0.

---

## 12. Step 4a — K4 off-host verification PREPARED (workflow written, NOT executed) — 2026-09-18

**Window:** K4 preparation only. Base HEAD `ef04eb09815690626d35259c0533d08b79621994` (Keith's K3 implementation commit; working tree clean at window open). **Keith's K4 selection:** a standard GitHub-hosted Ubuntu Linux runner for **fake-only** verification, and an explicit bounded **scope extension** of this task to one workflow file. This addendum supersedes §5.2's "no environment exists" statement and §11.6 item 1's "nothing provisioned" wording for the *choice* of environment only; nothing has run. **STEP_4A_VERDICT=WORKFLOW_PREPARED_NOT_EXECUTED.** K5 checkpoint/lock remains NOT AUTHORIZED. No dispatch occurred and none may occur before Keith commits the workflow.

### 12.1 Scope extension (explicit; historical eight-file scope unchanged)

- New write path for this task: `.github/workflows/pm2-overlay-unknown-verify.yml` (repository had no `.github/` directory). The eight-file bundle modification set (§3.2 / §10.4) is **unchanged** and was **not edited** in this window: bundle source, tests, manifests, `.gitattributes`, archives, review directory, predecessors, EXEC-01C6A, and flags are byte-identical to `ef04eb0`.
- Sidecar candidate: `writePaths` and `hotfiles` each gain the workflow path (nine entries); `writeSetPrecision=EXACT` stays truthful; `mutexes=[]` (no catalogue matcher — `PACKAGE`/`COMPOSE`/`ENV` — covers a `.github/workflows/*.yml` basename); `runtimeNeeds=[]`; `evidenceClass=LOCAL-TESTS` (§5.6: names the evidence *kind*; a GitHub-hosted runner is not `LOCAL-RUNTIME`, not `STAGING`, not `PROVIDER-LIVE`); `admissionUncertain=true`; occupancy EMPTY; `runtimeAuthorization` all false. Remote fake-only tests are **not** staging execution and must not be recorded as such.

### 12.2 Isolation findings (static inspection of the complete suite and every subprocess path)

Inspected: `tests/test_operator_bundle.py` (127 `test_*` methods in 19 direct `unittest.TestCase` subclasses; 27 `subprocess.*` call sites), every `lib/*.py` and `bin/*` it reaches, and the three shell wrappers it names.

| Surface | Finding | How the workflow fails closed |
|---|---|---|
| Test-spawned processes | Every `subprocess.run/check_call/check_output` argv[0] is `sys.executable` (targets: `lib/orchestrate.py`, `lib/reconcile.py`, `lib/capture.py`, `bin/mock-pm2.py`, stdin scripts), except `test_bash_stop_wrapper_if_present`, whose argv[0] is a Windows Git-bash path and which `skipTest`s on Linux. The only `Popen` text is inside a string literal executed by a disposable child (`time.sleep(30)`, killed by `supervise`). | AST scan before tests: any spawn whose argv[0] is not `sys.executable`/`str(bash)`, any `os.system/exec*/spawn*/popen`, any `socket.*` other than `gethostname` → `STATIC_ISOLATION_FAIL`, tests do not run. |
| Real `sudo` | Only reachable via `linux_capture.posix_privileged_kill` (default runner `subprocess.run`) or `LinuxCapture.send(privileged=True)` with a non-`.py` sudo. Every test call passes `run=`/`run_cmd=` spies (`CorrectionBoundaryTests`, pid-reuse/prefix/identity tests). The `LinuxCapture` chain used with mocks is `python mock-sudo.py -n python tcpdump-exec.py … → execv mock-tcpdump.py`. | AST scan: `posix_privileged_kill(` without `run=` or `send(privileged=True)` without `run_cmd=` → fail. PATH tripwire shims `sudo`/`pm2`/`tcpdump`/`node` (exit 97 + log) catch any by-name invocation; a non-empty tripwire log fails step E. Absolute `/usr/bin/sudo` appears only in spied calls. |
| Real `pm2` / `node` / `tcpdump` defaults | `orchestrate.main`, `reconcile.main`, `capture.main` call `secret_io.require_explicit_live_authorization` whenever any adapter path `looks_live_capable_bin` (anything not `mock-*`); missing `AISB_01C6A_STAGING_EXECUTION_AUTHORIZED` → `STAGING_NOT_AUTHORIZED`, exit 2, before any spawn. `test_reconcile_cli_requires_auth_for_live_node` deliberately sets `NODE_BIN=/usr/bin/node` and asserts refusal. `tcpdump-exec.py` defaults to `/usr/bin/tcpdump` only if `AISB_TCPDUMP_BIN` is unset; every test that reaches it sets the mock. | Preflight asserts the runner env has no `AISB_01C6A_*`, `PM2_BIN`, `NODE_BIN`, `SUDO_BIN`, `AISB_SUDO_BIN`, `TCPDUMP_BIN`, `AISB_TCPDUMP_BIN`, `MOCK_PM2_STATE`, `MOCK_TCPDUMP_READ_FAIL`, `PREP`, `PYTHON3` (names only recorded); asserts no `pm2` on PATH; asserts the gate call is present in all three CLI entry points and defined in `secret_io.py`. AST scan: any assignment / dict literal setting `AISB_01C6A_STAGING_EXECUTION_AUTHORIZED` in tests → fail. |
| Network | No `socket.socket/create_connection/getaddrinfo`, `urllib`, `http.client`, or `requests` anywhere in `lib/`, `bin/`, or tests; `_dns_query("api.x.ai")` builds bytes for the pcap parser; `socket.gethostname()` is the only socket call. | Preflight grep over `lib/`+`bin/` and the AST socket rule. |
| Recovery data / vault | All vaults, journals, markers, mock state, proc logs live in `tempfile.TemporaryDirectory()`; `TMPDIR` is pointed at `$RUNNER_TEMP/tmp`; nothing under the checkout is written by tests (`PYTHONPYCACHEPREFIX` keeps `.pyc` out too). | Step E: `git status --porcelain --untracked-files=all` over the bundle and `.gitattributes` must be empty; 40/40 raw SHA-256 must equal the pre-test snapshot; no `__pycache__`/`*.pyc` in the tree. Artifact contains only bounded logs/summaries — never `TMPDIR`, env dumps, or the workspace. |
| Provider / canary / DB / Redis / staging | Not referenced by any test path; dummy values only (`AISB_01C6A_DUMMY_XAI_API_KEY=01C6A-NONSECRET-DUMMY-XAI-KEY`, `cli-hmac-secret`, `staging-original-key`). | No secrets, environments, SSH, or cloud configuration in the workflow; `permissions: contents: read`; `persist-credentials: false`. |
| Dependencies | Stdlib only (`fcntl`, `msvcrt` guarded by OS; `ctypes`, `uuid`, `inspect`, `importlib`, `unittest.mock`). No installs. | `actions/setup-python` 3.12 only; no `pip`. |

Coverage-boundary disclosures (recorded, not "fixed" — the frozen test file is out of this window's scope):
- **Durability is SIMULATED.** T17 observes the `fsync(file) → replace → fsync(dir)` ordering through `unittest.mock` spies on a real tmpdir and checks mode `0600`; it is not power-loss / crash-consistency evidence. The workflow labels it so.
- **Run-lock contention is in-process.** T18 takes two `VaultRunLock` handles inside one OS process (`fcntl.flock LOCK_EX|LOCK_NB` on separate descriptors, plus the same-process detection); no test spawns two simultaneous OS processes contending for `.run.lock`. Cross-process exclusion against a genuinely competing run therefore rests on `flock` semantics, not on a two-process test.
- **Interrupts** are `KeyboardInterrupt` injected by `FakePm2Dual` (`interrupt`) plus real `SIGTERM`/`SIGKILL` to disposable Python children in `SuperviseTests`/capture tests.
- **T5** uses a 0.2 s wall-clock window / 0.5 s sleep and may be timing-sensitive on a shared runner; the workflow has no automatic retry — a flaky failure is a real result to be read, not re-rolled.
- Exactly **one** skip is expected on Linux (`test_bash_stop_wrapper_if_present`); any other skip fails the gate.

### 12.3 Workflow as prepared (`.github/workflows/pm2-overlay-unknown-verify.yml`)

- Trigger `workflow_dispatch` only (no `push`/`pull_request`/`schedule`); `permissions: contents: read` at workflow and job level; `runs-on: ubuntu-24.04`; one job; `timeout-minutes: 20`; no matrix, no `continue-on-error`, no retries; no secrets/environments/services; `concurrency` not used.
- Pins (verified 2026-09-18 by read-only `git ls-remote --tags` **and** GitHub REST `git/ref/tags` → `git/commits`; all three are lightweight tags pointing directly at commits): `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (v7.0.1; committed 2026-07-17, released 2026-07-20); `actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97` (v7.0.0; 2026-07-20); `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` (v7.0.1; 2026-04-10). Release notes reviewed: no breaking change to the inputs used (`ref`, `fetch-depth`, `persist-credentials`; `python-version`; `name`, `path`, `if-no-files-found`, `retention-days`).
- Steps: checkout `${{ github.sha }}` with `persist-credentials: false`, `fetch-depth: 1` → Python 3.12 → **identity** (`identity.txt`: workflow, `workflow_ref`, run id/number/attempt, event, dispatch ref/SHA, `git rev-parse HEAD` (must equal dispatch SHA), actor, runner OS/arch/kernel, `os-release`, `sys.version`, `git --version`, UTC) and export of `EVIDENCE`/`TMPDIR`/`PYTHONPYCACHEPREFIX`/`TRIPWIRE_*` under `$RUNNER_TEMP` via `$GITHUB_ENV` → **preflight** (§12.2; `.gitattributes` honoured: `text eol=lf` on sources, `-text` on both manifests) → **A** (`git ls-files | sha256sum` snapshot; strict byte-level parse of both manifests: CRLF-only, exact baseline header lines, `^[0-9a-f]{64}  path$`, no duplicate/unsafe/missing/extra entries versus `git ls-files` (39 = tracked − itself; 36 = `bin/ lib/ config/`), raw SHA-256 of every listed file incl. `tests/test_operator_bundle.py` and `OPERATOR-BUNDLE.md`, helper hashes identical across both, `REVIEW-SHA256.txt`'s `TRANSFER.manifest` entry equals its raw hash; then `python3 bin/verify-transfer.py` with exit code preserved and `TRANSFER_VERIFY_OK helpers=36` required) → **B** (`py_compile` of the five changed `.py` files + `compileall` of `lib/ bin/ tests/`; bytecode under `PYTHONPYCACHEPREFIX`; any `__pycache__`/`.pyc` inside the tree fails) → **C** (`cd ops/aisb-01c6a-operator-bundle && timeout -k 30 900 python3 -m unittest -v tests.test_operator_bundle 2>&1 | tee unittest.log`; `rc=${PIPESTATUS[0]}` written to `unittest.exit` and re-raised as the step result) → **D** (`if: !cancelled() && preflight succeeded`; parses the verbose log incl. docstring second lines; `Ran N` must equal the AST count of `test_*` methods; final line must be `OK…`; `failures=errors=0`; skips ⊆ {`test_bash_stop_wrapper_if_present`}; 15 named Linux-specific lock/durability/interrupt/signal/allowlist/F5 tests must each be `ok`; writes `test-summary.json` with the simulated-vs-real labels) → **manifest writer on a disposable copy** (`cp -a` to `$RUNNER_TEMP/bundle-copy`, run `bin/write-transfer-manifest.py` there, report `RAW_BYTES_IDENTICAL` (expected False: CRLF vs LF), `ENTRY_SET_IDENTICAL` (must be True — the only failing condition), `ENTRY_ORDER_IDENTICAL` (reported only), then `cmp` tracked vs `git show HEAD:` to prove the tracked manifest was not touched) → **E** (clean `git status` over bundle + `.gitattributes`; `sha256-after` identical to `sha256-before`; no bytecode in tree; empty tripwire log → `TRACKED_BYTES_UNCHANGED`) → **summary** (`if: always()`; bounds `unittest.log` to 4 MiB head + 1 MiB tail; `SUMMARY.md` + `$GITHUB_STEP_SUMMARY`) → **artifact** (`if: always()`; `pm2-overlay-unknown-verify-<run_id>-<attempt>`; `retention-days: 7`; contents: `identity.txt`, `preflight.txt`, `manifest-verify.txt`, `sha256-before/after.txt`, `compile.txt`, `unittest.log`, `unittest.exit`, `unittest.timing`, `test-summary.{json,txt}`, `manifest-writer-compare.txt`, `tracked-bytes.txt`, `SUMMARY.md`).
- Not done by the workflow: no r3 archive, no publish/release, no write to the checkout, no `pip`, no `sudo`, no service start, no network client call, no staging/provider/credit/canary/PM2/DB/Redis.

### 12.4 Remaining steps (nothing executed here)

1. **Keith:** review and commit `.github/workflows/pm2-overlay-unknown-verify.yml` plus these governance mirrors; push `main`. The workflow must exist on the dispatched ref.
2. **Keith (or a later authorized window):** dispatch once — `gh workflow run pm2-overlay-unknown-verify.yml --repo knlee800/aiSandBox2026B --ref main`; watch with `gh run list --repo knlee800/aiSandBox2026B --workflow pm2-overlay-unknown-verify.yml --limit 1` / `gh run watch <run-id> --repo knlee800/aiSandBox2026B --exit-status`; download `gh run download <run-id> --repo knlee800/aiSandBox2026B --name pm2-overlay-unknown-verify-<run-id>-1 --dir <outside-repo-dir>`. Confirm `identity.txt: checkout_sha` is the intended commit. If Actions is disabled for the repository, that is the reported blocker; no billing/settings change is authorized here.
3. **Read the result as evidence, not acceptance:** a green run = fake-only LOCAL-TESTS evidence for the K3 implementation on Linux/Python 3.12; a red run returns the task to K3 scope (fix within the eight-file set; re-verify hashes/manifests) — never weaken an assertion or the gate. Neither outcome establishes F1–F5, P1/P4–P7, host CLEAN, EXEC-01C6A reopen readiness, staging transfer, or a canary.
4. **K5** (NOT AUTHORIZED): independent review of the artifact against §4/§10.3/§11; decision on the `fence_proof` no-input deviation (§11.3); r3 archive + hash (§11.6 item 4) only if authorized; checkpoint/lock recording what was and was not established.

### 12.5 Control-plane end state and activity ledger (Step 4a window, 2026-09-18)

Writes: `.github/workflows/pm2-overlay-unknown-verify.yml` (new); this §12 + status/K4 lines; `TASKS.md` this task's fields; canonical body; sidecar candidate `writePaths`/`hotfiles` (+1 path); `SATURATION_PROOF.json` by the validator only. GOVERNANCE acquired transiently then released UNOWNED. Occupancy EMPTY; Lane 3 DISABLED; `admissionUncertain=true`; not in S; task NOT LOCKED; EXEC-01C6A `startCondition=NOT_READY` unchanged; Builder gate LEFT ON; `stagingAuthorized=false`; `STAGING_EXECUTION_AUTHORIZED=NO`. All changes uncommitted pending Keith's Git.

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, browser=0, subagents=0, Git add/commit/push/branch/worktree=0, workflow dispatched=0, Actions settings/billing changed=0, secrets created=0, bundle files edited=0 (40/40 identical to `ef04eb0`), `.gitattributes` edited=0, archives mutated=0, Python executed=0, tests executed=0 except lane-capacity validator, mocks=0, builds=0, installs=0, workflow emulation=0, network reads=read-only `git ls-remote --tags` + GitHub REST tag/commit/release lookups for pin verification only, predecessor body edits=0, EXEC-01C6A changes=0, Lane admission=0, Lane 3 enablement=0, Option A/B selected=0, P1/P6/P7 recorded=0, r3 archive produced=0, successor registration=0.

## 13. Step 4b — K4 first remote run FAILED; corrections WRITTEN / NOT YET REMOTELY VERIFIED — 2026-09-18

Keith committed the K4 workflow as `810428994ad3e2f0130c3ebe4096c44ce8773ae5` and dispatched it once. This window read that run's evidence via `gh` (no bundle code executed locally), preserved it outside the repository, and wrote bounded corrections inside the existing eight-file write set plus the workflow. K5 remains NOT AUTHORIZED. No new task, no scope expansion.

### 13.1 Failed-run evidence (preserved; not acceptance)

- Run `35327293618` (attempt 1, `workflow_dispatch` by `knlee800`, `refs/heads/main`), `checkout_sha = dispatch_sha = 810428994ad3e2f0130c3ebe4096c44ce8773ae5`; runner Linux X64, Ubuntu 24.04.5 LTS, kernel 6.17.0-1022-azure; CPython 3.12.14 (`/opt/hostedtoolcache/Python/3.12.14/x64/bin/python3`); git 2.55.0; started 2026-09-18T09:00:54Z.
- Steps: checkout / Python / identity / **preflight PASS** (`PREFLIGHT_OK`) / **A PASS** (`MANIFEST_VERIFY_OK`, `TRANSFER_VERIFY_OK helpers=36`; 36 + 39 entries, CRLF-only, ordinal order) / **B PASS** (compile; no bytecode in tree) / **C FAIL** / **D FAIL** (`RESULT_GATE_FAIL`) / manifest-writer copy PASS (`ENTRY_SET_IDENTICAL=True`, `MANIFEST_WRITER_ENTRY_CONTENT_MATCH`, `RAW_BYTES_IDENTICAL=False` as expected) / **E PASS** (`TRACKED_BYTES_UNCHANGED`, 40/40 identical, tripwire never invoked) / summary + artifact uploaded.
- Suite: `Ran 127 tests in 10.380s` — `FAILED (failures=2, errors=3, skipped=1)`; skip = `test_bash_stop_wrapper_if_present` (allowed). ERROR ×3: `test_linux_capture_alive_and_stop_with_mocks`, `test_fresh_process_stop_owned_disposable`, `test_linux_capture_signals_recorded_tcpdump_not_fixture_pid` — all `capture.CaptureStartError: TCPDUMP_CMDLINE_NOT_TCPDUMP` at `capture.py:334`. FAIL ×2: `test_t13_acked_matched_unproven_is_not_restoration_success` (`'TERMINAL_NOT_ACCEPTED' != 'INCOMPLETE'`), `test_t5_watchdog_restore_overlaps_in_flight_apply` (`'APPLY_ACKED_LATE' not found in ['APPLY_UNSETTLED_AT_RESTORE']`). Two `ResourceWarning: subprocess N is still running` lines interleaved into the verbose output of `test_orchestrate_interrupt_restores` and `test_restore_owner_does_not_double_restart`.
- Workflow defects visible in the artifact: `unittest.exit` and `unittest.timing` absent (step C's shell exited on the failing pipeline before writing them; the parser recorded `unittest_exit: -1`); the parser recorded the ResourceWarning text as the *status* of `test_orchestrate_interrupt_restores` (which actually reported `ok`) and keyed every gate on bare method names.
- All other 122 tests reported `ok`, including every T1–T4, T6–T12, T15–T18 case, the retention gate, `test_fence_proof_boundary_static`, and the four lock/durability/interrupt required cases.
- Preserved outside the repository at `C:\Users\knlee\aisb-k4-evidence\run-35327293618\` (artifact `pm2-overlay-unknown-verify-35327293618-1`: `identity.txt`, `preflight.txt`, `manifest-verify.txt`, `sha256-before/after.txt`, `compile.txt`, `unittest.log` 23,630 B, `test-summary.{json,txt}`, `manifest-writer-compare.txt`, `tracked-bytes.txt`, `SUMMARY.md`; plus `full-job.log`). Not copied into the repository.

### 13.2 Root causes and corrections (each WRITTEN / NOT YET REMOTELY VERIFIED)

1. **Linux capture fixtures — `TCPDUMP_CMDLINE_NOT_TCPDUMP`.** Trace: `LinuxCapture.start` spawns `[python, bin/mock-sudo.py, -n, python, bin/tcpdump-exec.py, PIDFILE, IFACE, PCAP, FILTER…]`; on POSIX `mock-sudo.py` `os.execv`s the helper and `tcpdump-exec.py` writes its own pid to the pidfile and `os.execv`s `[sys.executable, $AISB_TCPDUMP_BIN (= bin/mock-tcpdump.py), -nn, -i, IFACE, -U, -w, PCAP, FILTER…]` — one pid throughout. `capture.start_capture` → `verify_tcpdump_pid` → `adapter_live_argv` → `LinuxCapture.live_argv` reads the real `/proc/<pid>/cmdline` on POSIX (on Windows it returns the recorded `tcpdump_argv`, which is why the authoring-host reasoning did not see this) → `capture.executable_is_tcpdump` accepts only basename `tcpdump`/`tcpdump.exe` → the interpreter basename fails → `match_tcpdump_argv` → `TCPDUMP_CMDLINE_NOT_TCPDUMP`. Production behaviour is **correct** (a Python process is not tcpdump); the fixtures were wrong to expect the production identity check to accept the mock. **Correction (tests only):** new test-module class `MockTcpdumpIdentityCapture(LinuxCapture)` — performs the same live `/proc` read, and only when the live argv[0:2] is exactly `[this interpreter, this bundle's bin/mock-tcpdump.py]` (compared by `realpath`) presents that two-token prefix as `/usr/bin/tcpdump` for the production matcher; every other live process is returned unchanged and rejected as before; iface (`-i`) and pcap path (`-w`) are still matched by the production matcher against the *live* tokens; start identity (`/proc/<pid>/stat` starttime), pidfile identity, pid-vs-sudo-parent selection, `attach_handle` handle/identity-file cross-checks, and the fresh-process path are untouched. It also waits (≤2 s) for the exec chain to settle when the live cmdline is still `tcpdump-exec.py`/`mock-sudo.py` (never accepted as identity), and reaps its *own exited* child before `alive()` (the mock is a direct child that lingers as a zombie because the mock chain execs in place, unlike real `sudo`, which forks; a zombie still answers `kill(pid,0)`). The three tests now assert the distinction explicitly on Linux: `executable_is_tcpdump(raw_live_argv) is False`, `match_tcpdump_argv(raw, …) → TCPDUMP_CMDLINE_NOT_TCPDUMP`, `raw[1]` is `bin/mock-tcpdump.py`, the simulated view matches `(True, "OK")` and still fails on a wrong iface, `simulated_pids == {tcpdump_pid}`, and `handle.tcpdump_argv == ["/usr/bin/tcpdump", *raw[2:]]`. Production `lib/capture.py` / `lib/linux_capture.py` / `bin/*` unchanged; production identity acceptance not broadened; no test skipped; no real `tcpdump`/`sudo`.
2. **ResourceWarnings.** Cause: the three failed fixtures raised inside `start_capture` after the mock child was already running and their `finally` blocks only removed the temp dir, leaving the disposable mock running and its `Popen` unreaped; the warnings surfaced later, at garbage collection, inside unrelated tests (`test_orchestrate_interrupt_restores`, `test_restore_owner_does_not_double_restart`, which use `FakeProc`/`MemoryPm2` and spawn nothing). **Correction (tests only):** `_reap_capture_children(*caps)` terminates/kills-and-waits every still-running `Popen` a capture fixture owns and closes its log handles; it runs in each `finally`, and the tests assert `leaked == []` on the success path. Warnings are not suppressed; the workflow now reports interleaved warning lines per test (not gated).
3. **T13 classification.** Cause: `orchestrate()` kept the historical branch `elif accepted and not accepted.intended_accepted and decision.execution_terminal: classification = "TERMINAL_NOT_ACCEPTED"`, evaluated before the `INCOMPLETE` fallback; T13 runs `which="xai"` with a stub-format accepted terminal, so the xai parser reports `intended_accepted=False` on a terminal outcome and that branch won. **Correction (`lib/orchestrate.py`):** the terminal rejection is preserved separately as reason `TERMINAL_NOT_ACCEPTED` (appended once), and the classification fallback is `INCOMPLETE` per §10.3.A.3 for every unproven restoration; `restore_ok`, `overlays_restored`, `next_canary_allowed` unchanged (False). CLI exit for such runs therefore becomes 3 (`INCOMPLETE`) instead of 1; no shipped test or wrapper depended on 1. T13 now also asserts `accepted.intended_accepted is False` and `reasons.count("TERMINAL_NOT_ACCEPTED") == 1`. The expected assertion was not changed to the incorrect output.
4. **T5 late acknowledgement.** Cause: `dispatch_restart`'s success branch was `if not attempt.settled.is_set(): _settle_acked(...)`; in T5 the watchdog owner's `account_live_attempts(bound_sec=0)` had already settled the blocked gateway apply `UNCERTAIN/UNSETTLED_AT_RESTORE`, so the later return of the blocked client recorded nothing — no `APPLY_ACKED_LATE`. **Correction (`lib/overlay_restore.py`, `lib/vault.py`):** `_settle_acked` is always called and decides under `restore_lock`; if the attempt is already settled it calls new `_record_late_ack_after_settled`, which (for `APPLY` with fate `UNCERTAIN`) sets `attempt.acked_late`, annotates the journal entry with `late_ack="ACKED_LATE_AFTER_UNCERTAIN"`, `late_ack_exit_code=0`, `late_ack_mono_ts`, and widens the monotonic marker with `APPLY_ACKED_LATE` (attempt id, app, key names). The terminal fate, `reason` (`UNSETTLED_AT_RESTORE`), `exit_code` and `terminal_mono_ts` are never rewritten: `CommandJournal.annotate` now refuses `IMMUTABLE_ENTRY_FIELDS` (`attempt_id, run_id, pid, seq, op, app, keys, phase, reason, exit_code, terminal_mono_ts`) and writes only when something changed; `journal.terminal` was already monotonic (no downgrade from `UNCERTAIN`). No conversion back to `ACKED`; no second restore (the owner published once; a second accounting pass adds nothing). **Deterministic regression:** new `test_t7b_ack_after_owner_settled_uncertain_is_evidence_only` (events only, no window) — ownership → `account_live_attempts(bound_sec=0)` → `UNSETTLED_AT_RESTORE` → release → asserts terminal/reason/`exit_code`/`terminal_mono_ts` preserved, annotation present, marker widened, one PM2 call, and `annotate` immune to `phase/reason/exit_code/terminal_mono_ts`. T5 itself now waits (bounded 10 s) for the owner's `restore_result.json` and asserts `APPLY_UNSETTLED_AT_RESTORE` present and `APPLY_ACKED_LATE` absent *before* releasing the blocked ack, instead of `sleep(0.5)`; both `APPLY_UNSETTLED_AT_RESTORE` and `APPLY_ACKED_LATE` assertions preserved, plus the journal annotation assertions.
5. **Workflow exit capture.** Cause: GitHub invokes `bash -e -o pipefail`; `set -uo pipefail` does not clear the inherited `-e`, so `timeout … python3 -m unittest … | tee` failing made the shell exit before `unittest.exit`/`unittest.timing` were written. **Correction (step C):** `set +e` immediately around the pipeline, `rc=${PIPESTATUS[0]}` and `tee_rc=${PIPESTATUS[1]}` captured, `set -e` restored, `unittest.exit` and a three-line `unittest.timing` (exit, tee exit, start/finish UTC) written unconditionally, then the step fails with the suite's real status (`exit "$rc"`; also fails on a non-zero `tee`). Failure propagation intact; no `continue-on-error`.
6. **Workflow result parsing.** Cause: `HEAD` accepted any text after `...` as a status and `STATUS` accepted any line ending in a status word, so a `ResourceWarning` line became a status and gates keyed on bare method names. **Correction (step D):** a state machine over the verbose body that accepts only exact unittest tokens (`ok`, `FAIL`, `ERROR`, `skipped '<reason>'`, `expected failure`, `unexpected success`) either inline, alone on a line, or after a docstring description (`<desc> ... <token>`); everything else between a header and its status is recorded as interleaved output per test (warning lines surfaced in `SUMMARY.md`, not gated); statuses keyed on the fully qualified id `tests.test_operator_bundle.<Class>.<test>` derived from the AST; `REQUIRED` and `ALLOWED_SKIPS` resolve through that map and fail closed on unknown/ambiguous names. Added self-consistency gates: duplicate/unmatched headers, statuses for undefined tests, module tests without a status, parsed count ≠ `Ran N`, per-token counts ≠ final line, FAIL/ERROR detail heads ≠ per-test statuses. All existing gates preserved (`Ran N` = AST count, final `OK`, `failures=errors=0`, skips ⊆ allowlist, exit 0, required cases `ok`). `REQUIRED` gained `test_fresh_process_stop_owned_disposable` and a `late ack after owner settlement` group (`test_t5_…`, `test_t7_…`, `test_t7b_…`). Isolation preflight unchanged; no allowed skip added.

### 13.3 Changed paths, manifests, hashes

- Bundle (within the eight-file write set): `lib/overlay_restore.py`, `lib/orchestrate.py`, `lib/vault.py`, `tests/test_operator_bundle.py`, `OPERATOR-BUNDLE.md` (status: first remote run failed; corrections written; not yet remotely verified), `TRANSFER.manifest` (3 entries), `REVIEW-SHA256.txt` (6 entries). `bin/mock-pm2.py` unchanged. Manifests regenerated by static hashing (`Get-FileHash`) in place — only the six/three changed entries rewritten; CRLF-only, headers, ordinal order and provenance preserved; cross-check: 36 + 39 entries all match raw SHA-256, no duplicates, `REVIEW-SHA256.txt` covers all 39 tracked files except itself. New raw SHA-256 of `REVIEW-SHA256.txt`: `8ba54efb240b3b2d2c0e559332fa42351ea4e04b3a6a6db93402865ab190062c`.
- Read-only files: 32/32 byte-identical to the §2.2 baseline (30 by table hash; `config/defaults.env` and `config/xai-observation-addrs.txt` by hash only, not read). `.gitattributes`, archives, sidecar, predecessors, flags, EXEC-01C6A unchanged.
- Workflow: `.github/workflows/pm2-overlay-unknown-verify.yml` (steps C, D, summary). Trigger, runner, permissions, pins, preflight, A, B, manifest-writer copy, E, artifact unchanged.
- Governance: this §13 + status header; `TASKS.md` this task's fields; canonical body; `SATURATION_PROOF.json` by the validator only.
- `git diff --check`: only the inherited CRLF-as-trailing-whitespace notes on the two `-text` manifests (same as baseline). All edited sources LF-only.

### 13.4 Remaining limitations

- Every correction is **WRITTEN / NOT YET REMOTELY VERIFIED**. Nothing was executed locally (no Python, tests, mocks, builds, installs). After Keith commits, the complete suite must be rerun on the GitHub-hosted Linux runner (`gh workflow run pm2-overlay-unknown-verify.yml --repo knlee800/aiSandBox2026B --ref main`), and its artifact read as evidence, not acceptance.
- The mock-identity fixture is a **simulation**: it establishes that the production identity/ownership/signal path works end-to-end against a live, owned disposable process whose only difference from tcpdump is its argv[0:2]; it does not verify a real tcpdump executable, `sudo`, or `/usr/bin/tcpdump` presence. Fake-only evidence remains LOCAL-TESTS class.
- A possible residual race (in-memory only) between the owner's lock-free `_settle_uncertain` in `account_live_attempts` and a concurrent `_settle_acked` is bounded by the journal's monotonic terminal (`ACKED` can never overwrite `UNCERTAIN`) and `Attempt.settle`'s uncertainty guard; the end state is `UNCERTAIN` in every interleaving, and both paths latch. Not restructured here (would widen the lock-order change beyond this correction).
- T5 still depends on a real 0.2 s window elapsing (as the pre-existing blocked test does); the ordering that matters for the assertion is now enforced by waiting for the owner's publication, not by a fixed sleep.
- Nothing here establishes F1–F5, P1/P4–P7, host CLEAN, EXEC-01C6A reopen readiness, staging transfer, a canary, or K5 acceptance/lock.

### 13.5 Control-plane end state and activity ledger (Step 4b window, 2026-09-18)

GOVERNANCE acquired transiently then released UNOWNED. Occupancy EMPTY; Lane 3 DISABLED; `admissionUncertain=true`; not in S; task NOT LOCKED; EXEC-01C6A `startCondition=NOT_READY` unchanged; Builder gate LEFT ON; `stagingAuthorized=false`; `STAGING_EXECUTION_AUTHORIZED=NO`. All changes uncommitted pending Keith's Git.

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, browser=0, subagents=0, Git add/commit/push/branch/worktree=0, workflow dispatched=0, Actions settings/billing changed=0, secrets created=0, bundle files edited=7 (within W1–W8; 32 read-only files 32/32 identical), `.gitattributes` edited=0, archives mutated=0, Python executed=0, tests executed=0, mocks=0, builds=0, installs=0, workflow emulation=0, network reads=`gh run view/download` of run 35327293618 only, predecessor body edits=0, EXEC-01C6A changes=0, Lane admission=0, Lane 3 enablement=0, r3 archive produced=0, successor registration=0, K5 acceptance/lock=0.
