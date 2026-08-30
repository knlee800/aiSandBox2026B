# GOV-OS-03R1 — Candidate-Index Completeness Repair — CHECKPOINT

**Task:** GOV-OS-03R1
**Parent:** GOV-OS-03 (remains ACTIVE; NOT LOCKED)
**Lifecycle:** 3-step GOVERNANCE child repair
**Final state:** COMPLETE AND LOCKED — PASS

---

## Root cause

Candidate completeness was derived only from candidate objects already present in `docs/control-plane/lane-saturation-state.json`. There was no independent machine-readable source from which the validator could derive the set of newly registered implementation tasks that MUST have candidate objects. A canonically registered post-epoch IMPLEMENTATION task with an entirely omitted sidecar candidate would silently pass as `NO_FORCING_CANDIDATES` idle.

## Step 1 — Root-cause reproduction + repair contract freeze

- **Status:** COMPLETE — 2026-08-29
- **Contract:** `docs/GOV-OS-03R1-CANDIDATE-COMPLETENESS.md`
- **Reproduction:** Confirmed — isolated non-repo copy of fixture 01 with a post-epoch `NEW-IMPLEMENTATION-01` stanza (`nature=IMPLEMENTATION`) and empty sidecar `candidates=[]` returned PASS idle `NO_FORCING_CANDIDATES` from the GOV-OS-03 Step 3 validator
- **Production validator changed:** NO
- **Design decisions remaining:** 0

## Step 2 — TDD implementation + regression

- **Status:** COMPLETE — 2026-08-29
- **Implementation commit SHA:** `a1a7edaae7de1f7cfb546f79fe53cdf18529777d`
- **Commit message:** `enforce GOV-OS-03R1 post-epoch implementation-candidate completeness`
- **Write set:** 38 files (validator, test runner, 8 new fixtures, grandfather backlog, CLAUDE.md saturation subsection, TASKS.md lifecycle, TASKS_BACKLOG_FULL.md epoch + lifecycle)
- **Unauthorized writes:** NONE (AGENTS.md, PRD.md, ARCHITECTURE.md, stage-start, sidecar, mutex-catalog, SATURATION_PROOF.json — all unchanged)
- **Fixture results:** 70/70 PASS, 0 FAIL
- **Real-tree validator:** exit 0, PASS, `idleCode=OS_MUTATION_QUIESCENCE`

## Step 3 — Independent adversarial verification

- **Status:** COMPLETE — 2026-08-30
- **Reviewer model:** Claude Opus 4.6 (independent of Grok 4.6 XHigh implementation)
- **Verification SHA:** `a1a7edaae7de1f7cfb546f79fe53cdf18529777d` (HEAD == origin/main; clean tree)

### Independent source review

- Validator `scripts/validate-lane-capacity.ps1`: `-BacklogPath` parameter added; epoch parse, heading parse, machine stanza parse, completeness check implemented at correct algorithm position (after schema, before capacity/hash/OS-mutation/saturation)
- Test runner `scripts/validate-lane-capacity.tests.ps1`: `-BacklogPath` wiring added; grandfather-only backlog fallback for fixtures without custom backlogs
- `_grandfather-only-backlog.md`: epoch marker only, no post-epoch headings, required IMPLEMENTATION set empty
- Fixtures 63–70: each exercises the specific completeness scenario from the frozen contract
- CLAUDE.md: only the fail-closed lane saturation subsection changed; adds epoch/stanza/completeness language and two new validator trigger points

### AUDIT A — Missing entire candidate (not suspended)

Independent reproduction with temporary fixture outside repo:
- Post-epoch `NEW-IMPLEMENTATION-A`, `nature=IMPLEMENTATION`, sidecar `candidates=[]`, lanes EMPTY, `saturationSuspended=false`
- **Result:** exit 1 `MISSING_CANDIDATE_RECORD` — PASS

### AUDIT B — OS-mutation short-circuit ordering

Same missing-candidate state with `saturationSuspended=true`, 0 occupied lanes:
- **Result:** exit 1 `MISSING_CANDIDATE_RECORD` (NOT `OS_MUTATION_QUIESCENCE`) — PASS
- Source confirms: completeness check (line 1685) runs before OS-mutation suspension (line 1731)

### AUDIT C — Missing registration stanza

Post-epoch heading exists, no `AISB_MACHINE_REG_V1` block:
- **Result:** exit 1 `MISSING_MACHINE_REGISTRATION` — PASS

### AUDIT D — Dual omission

Post-epoch heading exists, both stanza and candidate omitted:
- **Result:** exit 1 `MISSING_MACHINE_REGISTRATION` — PASS
- Validator does not need the candidate to know registration requires machine metadata

### AUDIT E — Canonical source independence

Required implementation IDs are derived from `TASKS_BACKLOG_FULL.md` post-epoch headings + machine stanzas (`Parse-PostEpochRegistrations`). NOT derived from sidecar candidates, TASKS lane occupancy, chat, model memory, `SAFE_TWO_LANE_PAIR`, or `IDLE_REASON` prose.
- **Verdict:** Independent derivation confirmed — PASS

### AUDIT F — Epoch boundary

- Exactly 1 `<!-- AISB_GOV_OS_03_ENFORCEMENT_EPOCH_V1 -->` in real backlog — PASS
- Line matches marker exactly with no whitespace: TRUE
- GOV-OS-03 canonical heading is pre-epoch (offset 3996925 < epoch offset 4026679) — grandfathered
- GOV-OS-03R1 canonical heading is post-epoch (offset 4026725 > epoch offset 4026679) — first post-epoch task
- No historical mass migration
- Missing epoch → `MISSING_ENFORCEMENT_EPOCH` (fixture 68)
- Duplicate epoch → `DUPLICATE_ENFORCEMENT_EPOCH` (parser code confirmed)

### AUDIT G — Canonical heading parser security

- `####` subsections rejected: confirmed (line 1412, executable test)
- Lowercase headings like `### Task 1.1:` and `### Required UX/UI...` ignored: confirmed (case-sensitive `-cmatch` regex, executable test)
- Regex `^### (?<id>[A-Z][A-Z0-9-]{1,126}[A-Z0-9])(?:[ \t].*)?$` — only uppercase + digits + hyphens
- `taskId` mismatch between stanza and heading → `MALFORMED` (executable test)
- Lowercase nature `implementation` → `MALFORMED` (executable test, case-sensitive `-cne`)
- Duplicate machine blocks → `MALFORMED` (begins.Count != 1)
- Unknown machine keys → `MALFORMED` (line 1456)
- Orphan begin/end between epoch and first heading → `MALFORMED` (lines 1492-1497)
- **Verdict:** No bypasses found — PASS

### AUDIT H — Candidate nature correspondence

Post-epoch `nature=IMPLEMENTATION` whose sidecar candidate has `nature=GOVERNANCE` → `CANDIDATE_NATURE_MISMATCH` (fixture 70, source lines 1526-1528). Duplicate candidate IDs → `DUPLICATE_ID` (line 1659).
- **Verdict:** PASS

### AUDIT I — Governance behavior

Post-epoch `nature=GOVERNANCE` with no sidecar candidate → PASS (no completeness error; fixture 65). Governance candidates never enter `S` (`GOVERNANCE_NATURE` reject, line 1084).
- **Verdict:** PASS

### AUDIT J — Candidate saturation classification

Missing `saturationClass` on existing candidate → exit 1 `MALFORMED` (fixture 42, line 1285). R1 repair does not weaken this.
- **Verdict:** PASS

### AUDIT K — Extra candidate / no second scheduler

Completeness is one-way: required IMPLEMENTATION IDs ⊆ sidecar candidate IDs. Extra sidecar candidates are allowed. Validator does not rank, select, admit, or invent tasks. TASKS.md remains sole scheduler.
- **Verdict:** PASS

### AUDIT L — Duplicate canonical registration

Duplicate post-epoch heading TaskId → `DUPLICATE_CANONICAL_ID` (fixture 67, lines 1482-1487). Does not merely accept first/last.
- **Verdict:** PASS

### AUDIT M — Grandfathering

Pre-epoch headings (offset ≤ epoch) are skipped entirely (line 1472: `if ([int]$ln['start'] -le $EpochStart) { continue }`). No stanza required, not in required set, no mass migration. Fixtures 01–62 use `_grandfather-only-backlog.md` (epoch only, no post-epoch headings).
- **Verdict:** PASS

### AUDIT N — Fixture isolation

- Fixtures 01–62: no custom `TASKS_BACKLOG_FULL.md` → receive `_grandfather-only-backlog.md`
- Fixtures 63–70: have custom `TASKS_BACKLOG_FULL.md` with specific test content
- Proof paths: temp files in `$env:TEMP` (not production proof)
- Tests do not read or write production SATURATION_PROOF.json, sidecar, or backlog
- **Verdict:** PASS

### AUDIT O — Proof/sidecar preservation

- `docs/control-plane/lane-saturation-state.json`: NOT in R1 Step 2 diff — unchanged
- `docs/control-plane/mutex-catalog.json`: NOT in R1 Step 2 diff — unchanged
- `docs/control-plane/SATURATION_PROOF.json`: NOT in R1 Step 2 diff — unchanged
- Sidecar `candidates: []` — still empty
- Occupancy hash: `1d66e7a2cfdfd05c661d3e05181694384138c77413b26e318946f82d88dca3a0` — unchanged
- **Verdict:** PASS

### AUDIT P — Parent GOV-OS-03 regression

Fresh test suite run: FIXTURES_TOTAL=70, FIXTURES_PASS=70, FIXTURES_FAIL=0. All legacy fixtures 01–62 passing. No regression in pairwise, hash, mutex, evidence, shared contracts, dependencies, runtime, hotfile, I18N, path normalization, exclusive capacity, admission uncertainty, PARKED/PROHIBITED, PRIVATE-BETA prohibition, Lane 3 prohibition, historical prose irrelevance, SAFE_TWO_LANE_PAIR irrelevance, or any other parent GOV-OS-03 behavior.

### AUDIT Q — Real-tree validation

```
exit 0
result=PASS
idleCode=OS_MUTATION_QUIESCENCE
admissibleForcingCandidates=[]
rejectedCandidates=[]
headSha=a1a7edaae7de1f7cfb546f79fe53cdf18529777d
workingTreeDirty=false
```

Correct: GOV-OS-03R1 is post-epoch GOVERNANCE, requires no candidate. Lanes EMPTY, saturationSuspended=true → OS_MUTATION_QUIESCENCE.

### AUDIT R — CLAUDE.md behavior

Only the fail-closed lane saturation subsection was changed:
1. Replaced "After GOV-OS-03 LOCK" with epoch-based post-epoch canonical machine-registration duty
2. Added missing-entire-candidate fails closed (`MISSING_CANDIDATE_RECORD`)
3. Added missing-machine-stanza fails closed (`MISSING_MACHINE_REGISTRATION`)
4. Added GOVERNANCE no implementation candidate
5. Added completeness ordering: before OS-mutation suspension short-circuit and before idle derivation
6. Added grandfathering rule
7. Added two new validator trigger points: canonical post-epoch machine-registration metadata change, enforcement-epoch marker change
8. CLAUDE.md remains prose/rules authority; validator is the mechanical enforcement

### AUDIT S — No second scheduler

Validator does NOT: rank candidates, select candidates, admit candidates, invent tasks, promote FUTURE, fill lanes. TASKS.md remains sole scheduler. TASKS_BACKLOG_FULL.md supplies registration identity/completeness only. Sidecar is not a scheduler.

---

## Final validation summary

```
GOV_OS_03R1_STEP3_PASS=YES
MISSING_ENTIRE_CANDIDATE_ENFORCEMENT_VERIFIED=YES
OS_MUTATION_CANNOT_HIDE_MISSING_CANDIDATE=YES
CANONICAL_REGISTRATION_COMPLETENESS_VERIFIED=YES

FIXTURES_TOTAL=70
FIXTURES_PASS=70
FIXTURES_FAIL=0
LEGACY_FIXTURES_01_62_PASS=YES

REAL_TREE_VALIDATOR_EXIT=0
REAL_TREE_IDLE_CODE=OS_MUTATION_QUIESCENCE

GOV_OS_03R1_COMPLETE_AND_LOCKED=YES

GOV_OS_03_ACTIVE=YES
GOV_OS_03_LOCKED=NO
GOVERNANCE_OWNED_BY_GOV_OS_03=YES
SATURATION_SUSPENDED=YES

LANE1_EMPTY=YES
LANE2_EMPTY=YES
LANE3_DISABLED=YES

APPLICATION_SOURCE_CHANGES=0
RUNTIME_ACTIVITY=0
STAGING_ACTIVITY=0
PROVIDER_LIVE_CALLS=0

VALIDATOR_UNCHANGED_DURING_REVIEW=YES
CLAUDE_MD_UNCHANGED_DURING_REVIEW=YES
SIDECAR_UNCHANGED=YES
PRODUCTION_PROOF_UNCHANGED=YES
OCCUPANCY_HASH_UNCHANGED=YES
GIT_DIFF_CHECK=PASS
INVITATION_INVARIANT_UNCHANGED=YES
```
