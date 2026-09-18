# PM2-OVERLAY-UNKNOWN-01 — Stage-start / Step 2 freeze

**Task:** PM2-OVERLAY-UNKNOWN-01 — Fail-closed PM2 overlay outcomes and recovery-material retention
**Nature:** IMPLEMENTATION (4-step, high-risk; operator-bundle safety mechanics)
**Current status:** Step 1 COMPLETE (registration `3a8f14d189d533102af27061052b0debe94c2d09`) — **Step 2 COMPLETE — FREEZE WITH ONE UNMET IMPLEMENTATION PREREQUISITE** — 2026-09-18 — Steps 3–4 NOT AUTHORIZED
**Step 2 base HEAD:** `3a8f14d189d533102af27061052b0debe94c2d09` (branch main; working tree clean at window open; Step 1 registration commit)
**Evidence predecessor:** PM2-DAEMON-INVESTIGATION-01 COMPLETE AND LOCKED `a3e327e7ffe70666cb75e90b65cb4d6e336ea784` (PASS_WITH_DISCLOSED_LIMITATIONS; `docs/PM2-DAEMON-INVESTIGATION-01-STAGE-START.md` §12–§13)
**Frozen semantics inherited, not reinterpreted:** F1–F5 and the four CLI/daemon states (`docs/AGENT-PLATFORM-EXEC-01C6A-PM2-FENCE-01-STAGE-START.md` §3, §5.1); P1–P8 host-clean gate (§6.4); HARNESS-RESTART-GOV-01 OUTCOME_A / R1.

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

`RestoreResult` gains: `result_class` ∈ {`RESTORED_ACKED_MATCHED`, `UNKNOWN_PENDING_OVERLAY`, `RESTORE_FAILED`, `PENDING_HMAC`, `UNSUPPORTED_ABSENT_RESTORE`, `RESTORE_INTERRUPTED`}, `unknown_pending_overlay: bool`, `snapshot_matched: bool`, `commands_acked: bool`, `attempts: list[str]`. `OrchestrateResult` and the `orchestrate-result.json` payload gain `result_class` and `unknown_pending_overlay`.

| Claim | Meaning | Source | Sufficient for |
|---|---|---|---|
| **command acknowledgement** (`commands_acked`) | every restore attempt in this run is `ACKED` **and** no apply attempt in this run or in the journal is non-`ACKED`/non-`NOT_DELIVERED` | journal | nothing alone |
| **snapshot verification** (`snapshot_matched`) | dual-field named-key comparison matched for every app (§4.8) | `jlist` after restore | nothing alone (PM2-FENCE-01 §4: point-in-time) |
| **restoration claim** (`ok` / `restore_ok` / `overlays_restored`) | `commands_acked and snapshot_matched and not latched` | conjunction | the bundle's own success bit only |

Invariants: `unknown_pending_overlay=True` ⇒ `ok=False`, `restore_ok=False`, `overlays_restored=False`, `preserved_vault=True`, `result_class=UNKNOWN_PENDING_OVERLAY`, `next_canary_allowed=False`, classification `INCOMPLETE`. `snapshot_matched=True` never raises `ok` while latched. None of these claims asserts F1, F2, F3, or F4-as-fence; `restore_ok=True` under this design still means only "all our restore clients acked, the dual-field snapshot matched, and nothing uncertain was recorded" — a matching snapshot is not daemon fate, and this is recorded in the result payload as `fence_claim: "NONE"`.

### 4.5 Restore owner algorithm (single owner; frozen order)

1. Acquire ownership under `restore_lock`: set `started=True`, create a fresh `owner_token` object, `in_flight=True`. Losers wait on `done` (existing behaviour) and receive the published result; if the owner publishes nothing within the bound, the loser's synthetic result is `UNKNOWN_PENDING_OVERLAY` (not the current generic failure).
2. Read the journal. For every `APPLY` entry still `DISPATCHED`: wait on that attempt's completion event for at most `remaining apply timeout + 2 s` (bounded by `restore_reserve`). If it resolves `ACKED` **after** ownership was taken, record `ACKED_LATE` in `reason` and treat the run as latched (ordering versus the upcoming restore is unknown). If unresolved → mark `UNCERTAIN` and latch.
3. For each app: journal `INTENT(RESTORE)` → dispatch via `orig_restart` with the owner token (§4.6) → terminal per §4.2 → if `ACKED`, take the dual-field snapshot (§4.8) and compare; if the snapshot read fails → `UNCERTAIN` for that app.
4. Compute `result_class` (§4.4). If latched anywhere → write/refresh the UNKNOWN marker **now**.
5. Persist `<vault>/restore_result.json` (redacted; names only).
6. Cleanup **only if** `result_class == RESTORED_ACKED_MATCHED` **and** `windows.restore_due()` is `None` **and** the marker does not exist **and** the journal has no non-terminal or `UNCERTAIN` entries: then `clear_pending_app` for each app and `delete_vault_fn()`. Otherwise retain everything (§4.9).
7. Publish: `restore_gate["result"]`, then `done.set()`. Any exception in steps 2–6 → latch, persist a `RESTORE_FAILED`/UNKNOWN result, publish, re-raise nothing to the watchdog thread.

`vault_preserved` continues to be read from disk (`protected_recovery_present`, extended to count the UNKNOWN marker and a non-empty journal as recovery material).

### 4.6 Dispatch admission and the late-apply problem

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
| K1 | Approve the authoritative editable location (L1 `ops/aisb-01c6a-operator-bundle/` or an alternative root) as a structural deviation, including the path-scoped LF `.gitattributes` rule | OPEN |
| K2 | Authorize Step 3a import (byte-faithful copy of ZIP B entries) and the 39/39 raw re-verification gate | OPEN |
| K3 | Authorize Step 3 implementation within W1–W8 exactly | OPEN |
| K4 | Select and authorize the verification environment (§5.2) and its resource declaration, if any | OPEN |
| K5 | Authorize Step 4 verification / checkpoint / lock | OPEN |
| — | P1 UNKNOWN policy, P6 procedure, P7 acceptance, P4/P5 attestations, Option A/B, EXEC-01C6A reopen, canary | OUTSIDE THIS TASK; not requested |

---

## 8. Step 2 verdict

### 8.1 Frozen (complete)

Source baseline identity and 39/39 raw verification (§2.2); provenance chain and limitations (§2.1, §2.5); exact bundle-relative write set W1–W8 and exclusions (§3.2–§3.3); artifact/manifest/packaging handling (§3.4); conditional lease declarations (§3.5); failure/concurrency/retention semantics (§4.1–§4.10); allowlist assessment (§4.10); verification environment proposal, doubles, matrix T1–T14, evidence, and evidenceClass reconciliation (§5).

### 8.2 Unmet implementation prerequisite (blocking Step 3)

**Authoritative editable bundle location — NOT ESTABLISHED.** Missing artifact: an approved, LF-faithful, raw-verified editable tree of ZIP B under version control. Next action: Keith decision K1 → Step 3a import under K2 → 39/39 raw match against §2.2 via `Get-FileHash` → control plane updates `writePaths`/`hotfiles`/`writeSetPrecision=EXACT` on the sidecar candidate. Until then `writeSetPrecision=PROVISIONAL`, `admissionUncertain=true`, and no lane admission.

Second open item (does not block the freeze, blocks Step 4): no authorized verification environment exists (K4).

### 8.3 What this verdict is not

Not implementation readiness; not admission; not a fence, policy, host-CLEAN, risk-acceptance, or reopen decision. STEP_2_VERDICT=FREEZE_COMPLETE_PREREQUISITE_UNMET.

---

## 9. Activity ledger (Step 2 window, 2026-09-18)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, vendor-source fetch=0, live inspection=0, browser=0, subagents=0, Git mutations=0, application source=0, canary scripts mutated=0, evidence doc mutated=0, predecessor body edits=0, EXEC-01C6A body/candidate edits=0, bundle files mutated=0, archives mutated=0, manifests regenerated=0, review-directory files touched=0, protected values read=0, config contents read=0 (hashed only), bundle scripts executed=0, archive contents executed=0, tests executed=0 except lane-capacity validator, mocks=0, builds=0, installs=0, dependencies=0, migrations=0, PRD.md/ARCHITECTURE.md/CLAUDE.md/AGENTS.md/validator/mutex-catalog edits=0, Lane 1/2 admission=0, Lane 3 enablement=0, Option A/B selected=0, P1/P7 recorded=0, EXEC-01C6A reopened=0, Step 3a import performed=0, `ops/` created=0, `.gitattributes` edited=0.

Read-only actions performed: repository search for bundle references; TEMP directory inventory (names/sizes/mtimes); in-memory raw SHA-256 of all 80 archive entries (ZIP A + ZIP B) and of the review-directory and `zip-orig` files; parse of ZIP B's two manifest entries; throw-away read-only extraction of ZIP B for static source reading (removed at window end); static reads of `OPERATOR-BUNDLE.md`, `lib/overlay_restore.py`, `lib/orchestrate.py`, `lib/vault.py`, `lib/accepted_result.py`, `lib/cleanup_contract.py`, `lib/secret_io.py` (redaction helper only), `bin/*.sh` entry points, `bin/verify-transfer.py`, `bin/write-transfer-manifest.py`, `bin/mock-pm2.py`, and targeted sections of `tests/test_operator_bundle.py`.

Governance writes this window: this document (created); `TASKS.md` current board fields for this task; `TASKS_BACKLOG_FULL.md` PM2-OVERLAY-UNKNOWN-01 body; `docs/control-plane/lane-saturation-state.json` **unchanged** (no scope/resource/evidence field change justified — §3.5, §5.6); `docs/control-plane/SATURATION_PROOF.json` only as validator output. GOVERNANCE acquired transiently then released UNOWNED. Occupancy EMPTY. Lane 3 DISABLED. EXEC-01C6A `startCondition=NOT_READY` unchanged. Builder gate LEFT ON. Harness flags unchanged.
