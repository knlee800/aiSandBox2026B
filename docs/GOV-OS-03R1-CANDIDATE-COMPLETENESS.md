# GOV-OS-03R1 — Candidate-Index Completeness Repair Contract

**Task:** GOV-OS-03R1
**Parent:** GOV-OS-03 (remains ACTIVE; MUST NOT LOCK until this repair locks and GOV-OS-03 Step 4 is resumed)
**Step:** 1 COMPLETE — 2026-08-29 — root-cause reproduction + exact repair contract freeze
**Step 2:** PENDING (TDD implementation + adversarial fixtures + full regression)
**Step 3:** NOT AUTHORIZED
**UNRESOLVED_DESIGN_DECISIONS:** 0

This document is the authoritative freeze for the candidate-index completeness repair.
It supersedes one limitation recorded in `docs/GOV-OS-03-STAGE-START.md` Freeze Decision 25:

> v1 validator cannot grep the backlog for “implementation tasks without records” (that would be NLP). Enforcement is: control-plane workflow + CLAUDE.md duty + Step 4 process.

That limitation is now a **known defect**. It is not a permitted standing behavior.
Do not edit `docs/GOV-OS-03-STAGE-START.md` in this repair. This contract is the living repair authority.

Do not implement the validator in Step 1. Do not create fixtures in Step 1. Do not modify the sidecar in Step 1. Do not modify `CLAUDE.md` in Step 1.

---

## 1. Why this repair exists

GOV-OS-03 Step 3 is committed at:

```
139a23e8ef93afe1430071f7fdc1beac10295617
```

The product/governance requirement is explicit:

**MISSING ENTIRE MACHINE CANDIDATE RECORD FOR A NEWLY REGISTERED IMPLEMENTATION TASK MUST FAIL CLOSED.**

The Step 3 validator does not enforce that requirement.

---

## 2. Reproduction (Step 1)

```
MISSING_ENTIRE_CANDIDATE_REPRODUCED=YES
PRODUCTION_VALIDATOR_CHANGED=NO
PRODUCTION_FIXTURES_CREATED=NO
```

Isolated (non-repo) copy of fixture `01-zero-of-two-no-forcing`:

- Canonical registry file contained post-epoch `### NEW-IMPLEMENTATION-01` with machine nature `IMPLEMENTATION`
- Sidecar `candidates` was `[]` (no object for `NEW-IMPLEMENTATION-01`)
- Lane 1 EMPTY, Lane 2 EMPTY, Lane 3 DISABLED
- `saturationSuspended=false`
- No `IDLE_REASON` / `SAFE_TWO_LANE_PAIR` prose was used as proof
- No candidate object existed that could be classified as missing `saturationClass`

Current validator invoked:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.ps1" -TasksPath <isolated>\TASKS.md -StatePath <isolated>\lane-saturation-state.json -CatalogPath "C:\Users\knlee\aiSandBox2026B\docs\control-plane\mutex-catalog.json" -ProofPath <isolated>\SATURATION_PROOF.json
```

**Actual incorrect result:**

```text
exitCode=0
result=PASS
idleCode=NO_FORCING_CANDIDATES
admissibleForcingCandidates=[]
```

The isolated backlog was present on disk and was **not read**. `scripts/validate-lane-capacity.ps1` has no `-BacklogPath` parameter and contains zero references to `TASKS_BACKLOG_FULL.md`.

Contrast (already covered; different gap):

| Case | Current behavior |
|---|---|
| Candidate object exists, `saturationClass` omitted (fixture 42) | FAIL exit 1 `MALFORMED` |
| Occupied lane `taskId` with no candidate (fixture 37) | FAIL exit 1 `UNREGISTERED` |
| Canonical implementation task registered, candidate object **entirely omitted**, lanes EMPTY | **PASS idle `NO_FORCING_CANDIDATES`** ← this repair |

Temp reproduction directory (not a repo write):

```
C:\Users\knlee\AppData\Local\Temp\aisb-gov-os-03r1-repro-87fffff6294a49d8ac571185eb0f459a
```

---

## 3. Root cause

**CONFIRMED.**

Candidate completeness is derived only from candidate objects that already exist in `docs/control-plane/lane-saturation-state.json`.

There is no independent machine-readable source from which the validator can derive the set of newly registered implementation tasks that MUST have candidate objects.

Supporting source facts:

1. `Admissible` and `Derive-Idle` iterate only `state['candidates']`.
2. Empty `candidates` + free implementation capacity + not suspended ⇒ `idleCode=NO_FORCING_CANDIDATES` exit 0.
3. Occupied-without-candidate is detected (`UNREGISTERED`), so a forgotten candidate is invisible **until** the task occupies a lane. That requires memory to place the task on a lane. That is the memory-dependence GOV-OS-03 exists to eliminate.
4. Freeze Decision 7 forbids grepping the backlog for **dependency LOCK proof**. That rule remains. This repair does not grep lifecycle prose, LOCKED text, or `**Status:**`. It parses only the newly frozen machine-registration syntax after a deterministic epoch marker.
5. Freeze Decision 25 explicitly deferred missing-entire-record detection to workflow/memory. That is the defect.

Rejected as root cause: hash mismatch, occupancy parse, suspension short-circuit, missing `saturationClass` on an existing object, or fixture-42 coverage.

---

## 4. Chosen repair architecture

**Option A — deterministic post-GOV-OS-03 registration metadata in the canonical backlog.**

`TASKS_BACKLOG_FULL.md` remains the canonical task registry. After a deterministic enforcement epoch, every newly registered canonical task must carry a strict machine-registration stanza. The validator parses only that stanza (plus `### <TaskId>` headings after the epoch). It does not parse arbitrary lifecycle prose.

```
REQUIRED_IMPLEMENTATION_REGISTRATION_IDS
  = post-epoch canonical TaskIds whose machine nature is IMPLEMENTATION

SIDECAR_CANDIDATE_IDS
  = candidates[].taskId in the sidecar

REQUIRED_IMPLEMENTATION_REGISTRATION_IDS minus SIDECAR_CANDIDATE_IDS
  MUST equal EMPTY
```

If not empty: **FAIL CLOSED**.

Additionally, each matching sidecar object for a required IMPLEMENTATION id MUST have `nature=IMPLEMENTATION`. A GOVERNANCE-shaped candidate cannot satisfy an IMPLEMENTATION registration.

### 4.1 Why Option A is independently derivable

The independent source is the canonical registry heading that already constitutes registration:

```text
### <TaskId>
```

Control plane cannot register a canonical task without writing that heading (existing registry convention; GOV-OS-03 itself uses it). The required-ID set is derived from those post-epoch headings plus the mandatory machine stanza, not from a second sidecar list.

### 4.2 Why omitting both metadata and candidate cannot silently pass

| What is forgotten | Detection |
|---|---|
| Candidate object only | Heading + `nature=IMPLEMENTATION` stanza exist ⇒ `MISSING_CANDIDATE_RECORD` |
| Machine stanza only | Post-epoch `### <TaskId>` heading exists ⇒ `MISSING_MACHINE_REGISTRATION` |
| Stanza and candidate | Heading still exists ⇒ `MISSING_MACHINE_REGISTRATION` |
| Heading, stanza, and candidate | The task is not canonically registered. Out of scope for this repair. Admission without canonical registration is already forbidden by the registry authority notice. Occupied-without-candidate remains `UNREGISTERED`. |

Forgetting a parallel sidecar “required IDs” list is rejected (fake fix). That list can be omitted with the candidate object.

### 4.3 Option B rejected

Validator-derived git diff of newly added TaskIds is not durable: after commit, the omission disappears from the diff unless a second durable completeness store exists. That store is the same forgettable class as the candidate array. Do not use git history as the required-ID source.

### 4.4 Option C rejected

No smaller mechanism detects complete omission from an independently authoritative source. Option A is that mechanism.

---

## 5. Enforcement epoch

```
GOV_OS_03_ENFORCEMENT_EPOCH
```

### 5.1 Representation

Exactly one line in `TASKS_BACKLOG_FULL.md`, after trim identical to:

```text
<!-- AISB_GOV_OS_03_ENFORCEMENT_EPOCH_V1 -->
```

No other text on that line. Leading/trailing whitespace on the line is forbidden. Surrounding blank lines are permitted.

### 5.2 Parse

Ordinal search (same style as occupancy begin/end markers):

- 0 occurrences ⇒ exit 1 `MISSING_ENFORCEMENT_EPOCH`
- >1 occurrence ⇒ exit 1 `DUPLICATE_ENFORCEMENT_EPOCH`
- 1 occurrence ⇒ epoch offset = index of that marker

### 5.3 Grandfather rule

A canonical `### <TaskId>` heading is **post-epoch** iff the heading line starts at a file offset **greater than** the epoch marker start index.

Headings before the epoch are grandfathered:

- no machine stanza required
- not members of `REQUIRED_IMPLEMENTATION_REGISTRATION_IDS`
- not mass-migrated

Bringing a historical task forward is an explicit later control-plane act: place a post-epoch `### <TaskId>` heading and a valid machine stanza. This repair does not do that.

### 5.4 Step 2 placement (frozen)

Step 2 inserts the epoch marker into `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` as its own line immediately after the GOV-OS-03 canonical body and immediately before `### GOV-OS-03R1`.

Consequence: `GOV-OS-03R1` is the first post-epoch canonical task. It is `nature=GOVERNANCE` and does not require a sidecar candidate. Step 1 already includes its machine stanza so Step 2 insertion does not create a `MISSING_MACHINE_REGISTRATION` failure.

GOV-OS-03 itself remains pre-epoch (grandfathered GOVERNANCE parent).

The epoch marker MUST be installed in the same Step 2 change that first requires `-BacklogPath`. Until then, the current validator does not read the backlog.

---

## 6. Canonical machine-registration syntax

### 6.1 Post-epoch task heading

A post-epoch canonical task heading is a line matching all of:

1. Does not start with `####`
2. Matches:

```text
^### (?<id>[A-Z][A-Z0-9-]{1,126}[A-Z0-9])(?:[ \t].*)?$
```

3. Captured `id` satisfies the existing validator `Test-TaskId` rule (same regex; length 3–128)

Examples that **are** headings:

```text
### NEW-IMPLEMENTATION-01
### NEW-IMPLEMENTATION-01 — Title
### GOV-OS-03R1 — Candidate-Index Completeness Repair
```

Examples that **are not** headings (ignored):

```text
#### subsection
### Task 1.1: Initialize Project Structure
### Required UX/UI Acceptance Check Template
## GOVERNANCE — ...
**Task ID:** NEW-IMPLEMENTATION-01
**Nature:** IMPLEMENTATION
```

Do not parse `**Task ID:**`, `**Nature:**`, `**Status:**`, `**Lifecycle:**`, `Previous:`, `ACTIVE`, `READY`, `LOCKED`, flags fences, or any TASKS.md prose (including below LEGACY / FROZEN).

### 6.2 Machine stanza (required for every post-epoch heading)

Exactly one bounded block between this heading and the next post-epoch heading or EOF:

```text
<!-- AISB_MACHINE_REG_V1_BEGIN -->
taskId=<TaskId>
nature=IMPLEMENTATION|GOVERNANCE
<!-- AISB_MACHINE_REG_V1_END -->
```

Closed keys, exactly, in any order:

| Key | Value |
|---|---|
| `taskId` | must equal the heading TaskId (ordinal) |
| `nature` | `IMPLEMENTATION` or `GOVERNANCE` only |

Parse rules (fail closed):

- Begin/end markers must be whole lines after trim, matching occupancy-block strictness: no tabs, no surrounding spaces on `key=value` lines, no empty lines inside the block, no spaces around `=`
- Unknown key ⇒ `MALFORMED`
- Missing required key ⇒ `MISSING_MACHINE_REGISTRATION`
- Duplicate key ⇒ `MALFORMED`
- `nature` any other string, including lowercase ⇒ `MALFORMED`
- `taskId` ≠ heading id ⇒ `MALFORMED`
- 0 begin or 0 end in the span ⇒ `MISSING_MACHINE_REGISTRATION`
- begin/end count mismatch, nested markers, or more than one pair in the span ⇒ `MALFORMED`
- Orphan begin/end after the epoch that is not inside a heading span ⇒ `MALFORMED`
- Extra JSON/YAML/prose inside the block ⇒ `MALFORMED`
- Pre-epoch machine stanzas: ignored (not required, not parsed into the required set)

### 6.3 Duplicate canonical IDs

Duplicate post-epoch heading TaskIds ⇒ exit 1 `DUPLICATE_CANONICAL_ID`.

This is distinct from sidecar `DUPLICATE_ID` (fixture 38; unchanged).

### 6.4 Implementation vs governance

| Machine nature | Candidate object | Ordinary saturation |
|---|---|---|
| `IMPLEMENTATION` | REQUIRED. Sidecar must contain that `taskId` with `nature=IMPLEMENTATION` and explicit `saturationClass` `FORCING` or `OPTIONAL` (existing candidate schema). | After completeness, ordinary `Admissible` / `S` / idle rules apply unchanged. |
| `GOVERNANCE` | NOT required. Extra sidecar row allowed but unused for completeness. | If present in sidecar, existing `GOVERNANCE_NATURE` reject applies; never enters `S`. |

Governance tasks remain identifiable as GOVERNANCE via the machine stanza. They do not occupy implementation lanes by this repair. They do not force occupancy.

### 6.5 Extra sidecar candidates

Allowed. Completeness is one-way:

```
required IMPLEMENTATION IDs ⊆ sidecar candidate IDs
```

The converse is false. Fixture synthetic IDs and optional sidecar rows that are not post-epoch IMPLEMENTATION headings are not completeness failures. Historical tasks are not mass-migrated into the sidecar.

### 6.6 Nature mismatch

Post-epoch `nature=IMPLEMENTATION` whose sidecar object exists with `nature=GOVERNANCE` (or any non-IMPLEMENTATION) ⇒ exit 1 `CANDIDATE_NATURE_MISMATCH`.

A GOVERNANCE candidate cannot hide an IMPLEMENTATION registration from saturation.

---

## 7. Validator input change

Step 2 MUST add `-BacklogPath`.

Frozen `param` block:

```powershell
param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$TasksPath = (Join-Path $RepoRoot 'TASKS.md'),
    [string]$StatePath = (Join-Path $RepoRoot 'docs\control-plane\lane-saturation-state.json'),
    [string]$CatalogPath = (Join-Path $RepoRoot 'docs\control-plane\mutex-catalog.json'),
    [string]$ProofPath = (Join-Path $RepoRoot 'docs\control-plane\SATURATION_PROOF.json'),
    [string]$BacklogPath = (Join-Path $RepoRoot 'TASKS_BACKLOG_FULL.md')
)
```

Exact default when `$RepoRoot` is the repository root:

```
C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md
```

Missing backlog file ⇒ exit 1 `IO` (existing IO class).

Fixture override: tests pass `-BacklogPath` to the fixture’s `TASKS_BACKLOG_FULL.md` when present; otherwise to the shared grandfather file in §9.

No `--force`. No `--ignore`. No `--ignore-saturation`. No `--ignore-completeness`.

Backlog parse scope: epoch marker + post-epoch `### <TaskId>` headings + `AISB_MACHINE_REG_V1` blocks only.

Do not parse the backlog for dependency LOCK proof. `sidecar.lockedTaskIds` remains Freeze Decision 7.

---

## 8. Fail codes / exit codes

Existing exit-code table is unchanged:

| Exit | Meaning |
|---|---|
| 0 | PASS |
| 1 | malformed / schema / IO / **index completeness** |
| 2 | saturation / pairwise |
| 3 | board ↔ state hash |
| 4 | capacity / Lane 3 |
| 5 | OS mutation occupancy violation |

New exit-1 `errorCode` values (closed additions):

| errorCode | When |
|---|---|
| `MISSING_CANDIDATE_RECORD` | post-epoch IMPLEMENTATION TaskId has no sidecar candidate |
| `MISSING_MACHINE_REGISTRATION` | post-epoch heading lacks a valid machine stanza |
| `MISSING_ENFORCEMENT_EPOCH` | zero epoch markers |
| `DUPLICATE_ENFORCEMENT_EPOCH` | more than one epoch marker |
| `DUPLICATE_CANONICAL_ID` | duplicate post-epoch heading TaskId |
| `CANDIDATE_NATURE_MISMATCH` | required IMPLEMENTATION id exists in sidecar with non-IMPLEMENTATION nature |

Completeness failures use the existing exit-1 JSON object (`result=FAIL`, `exitCode=1`, `errorCode=...`). They do **not** persist `SATURATION_PROOF.json` (same as current `Fail-Exit1`). Proof schema is otherwise unchanged. Do not add `backlogSha256` in this repair.

Unknown completeness codes are not permitted. Other malformed stanza/heading/marker issues use existing `MALFORMED`.

### 8.1 Algorithm order (frozen)

Completeness is an index/schema check. It MUST run after occupancy/sidecar/catalog schema parse succeeds (so sidecar candidate IDs exist) and **before** capacity (4), hash (3), OS-mutation short-circuit (5), and saturation (2).

Therefore:

- OS mutation + missing entire candidate ⇒ `MISSING_CANDIDATE_RECORD`, **not** `OS_MUTATION_QUIESCENCE`
- Free capacity + omitted candidate + not suspended ⇒ `MISSING_CANDIDATE_RECORD`, **not** `NO_FORCING_CANDIDATES`

This is required. Suspension must not hide index incompleteness.

---

## 9. Fixtures (frozen; do not create in Step 1)

Existing 01–62 remain. They MUST keep passing.

Shared grandfather backlog for fixtures that do not ship their own backlog:

```
C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\_grandfather-only-backlog.md
```

Contents (exact semantic): the epoch marker line and no post-epoch `### <TaskId>` heading. Required implementation set is empty. Extra sidecar candidates remain valid.

Test runner: if `docs/control-plane/fixtures/<NN-slug>/TASKS_BACKLOG_FULL.md` exists, pass it as `-BacklogPath`; else pass `_grandfather-only-backlog.md`.

Required new fixtures:

| NN | Slug | Assert |
|---|---|---|
| 63 | `63-missing-entire-candidate-record` | Post-epoch `NEW-IMPLEMENTATION-01` stanza `nature=IMPLEMENTATION`. Sidecar has no candidate for that id. Lanes EMPTY. `saturationSuspended=false`. Free implementation capacity. FAIL exit 1 `MISSING_CANDIDATE_RECORD`. Not PASS idle. |
| 64 | `64-post-epoch-task-missing-machine-registration-metadata` | Post-epoch `### NEW-IMPLEMENTATION-01` heading exists; required machine stanza absent. FAIL exit 1 `MISSING_MACHINE_REGISTRATION`. |
| 65 | `65-post-epoch-governance-no-candidate` | Post-epoch `NEW-GOVERNANCE-01` stanza `nature=GOVERNANCE`. Sidecar `candidates=[]`. 0/2 not suspended. PASS `NO_FORCING_CANDIDATES` exit 0. |
| 66 | `66-post-epoch-implementation-with-candidate` | Post-epoch `NEW-IMPLEMENTATION-01` + complete sidecar candidate `nature=IMPLEMENTATION` `saturationClass=OPTIONAL` READY. 0/2 not suspended. Completeness PASS. Ordinary saturation PASS `NO_FORCING_CANDIDATES`; rejected `NOT_FORCING`. |
| 67 | `67-duplicate-canonical-registration-id` | Two post-epoch headings with the same TaskId. FAIL exit 1 `DUPLICATE_CANONICAL_ID`. |
| 68 | `68-missing-enforcement-epoch` | Backlog has a `### NEW-IMPLEMENTATION-01` heading and no epoch marker. FAIL exit 1 `MISSING_ENFORCEMENT_EPOCH`. |
| 69 | `69-os-mutation-missing-entire-candidate` | Same omission as 63, but `saturationSuspended=true` and 0 occupied lanes. FAIL exit 1 `MISSING_CANDIDATE_RECORD`. Must not return `OS_MUTATION_QUIESCENCE`. |
| 70 | `70-post-epoch-implementation-candidate-wrong-nature` | Post-epoch IMPLEMENTATION heading/stanza. Sidecar has that `taskId` with `nature=GOVERNANCE`. FAIL exit 1 `CANDIDATE_NATURE_MISMATCH`. |

PRIVATE-BETA: no new invite fixture. Fixture `56-private-beta-invite-01-never-s` remains authoritative. Completeness does not admit `PRIVATE-BETA-INVITE-01` into `S`. `NEVER_CANDIDATE_IDS` unchanged. Do not register PRIVATE-BETA-INVITE-01.

If a later control plane hypothetically registered that id post-epoch as IMPLEMENTATION, completeness would still require a candidate object and `S` would still exclude it as `PROHIBITED`. That hypothetical is not registered here.

Fixture count after Step 2: **70**.

---

## 10. Registration workflow after repair

When registering a **new** canonical task after the epoch:

1. Write the canonical task body in `TASKS_BACKLOG_FULL.md` under `### <TaskId>` **after** `<!-- AISB_GOV_OS_03_ENFORCEMENT_EPOCH_V1 -->`
2. Include a valid `AISB_MACHINE_REG_V1` stanza (`taskId`, `nature`)
3. If `nature=IMPLEMENTATION`, create the sidecar candidate object for that `taskId` with `nature=IMPLEMENTATION`
4. Set `saturationClass` to `FORCING` or `OPTIONAL` (no default). Existing candidate schema otherwise unchanged
5. Run `scripts/validate-lane-capacity.ps1` against the proposed end state (including `-BacklogPath` defaulting to the canonical backlog)
6. Missing entire candidate ⇒ nonzero exit (`MISSING_CANDIDATE_RECORD`). Missing stanza ⇒ `MISSING_MACHINE_REGISTRATION`
7. The control-plane transition **cannot validly complete**

Governance task: machine-identifiable as `GOVERNANCE`; candidate object not required; still must have the stanza after the epoch.

Do not auto-admit. Do not auto-select. Do not invent work. Completeness failure is not a reason to invent a FORCING successor. GOV-OS-02 remains the selector for genuinely new product/architecture work when no safely admissible FORCING candidate exists.

Add to Freeze Decision 24 mandatory triggers (Step 2 CLAUDE.md / validator comments only; do not rewrite the whole stage-start):

- canonical post-epoch machine-registration metadata change
- enforcement-epoch marker change

---

## 11. Historical-task behavior

- Pre-epoch tasks: grandfathered. No stanza. No required candidate.
- No historical mass migration.
- `INITIAL_FORCING_CANDIDATES=NONE` unchanged by this repair.
- Scanning historical `ACTIVE` / `READY` / `Previous:` prose is forbidden.

---

## 12. Authority invariants (unchanged)

```
TASKS.md CURRENT EXECUTION BOARD = only scheduler
TASKS_BACKLOG_FULL.md = canonical task registry
sidecar = not a scheduler
validator = proof checker, not a scheduler
```

The validator still does not admit, rank, select, or invent tasks. Parsing the backlog for machine registration does not make the backlog a scheduler and does not make the sidecar a scheduler.

```
NO REGISTERED FORCING CANDIDATE SAFELY ADMISSIBLE
=> GOV-OS-03 PERMITS IDLE
=> GOV-OS-02 CONTROLS GENUINELY NEW PRODUCT/ARCHITECTURE SELECTION
=> GOV-OS-03 NEVER INVENTS SUCCESSORS
```

Lane 3 remains DISABLED. Max implementation lanes remains 2.
PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.
Do not reopen unrelated GOV-OS-03 architecture (pairwise, hash, mutex catalog, evidence matrix, Git hooks).

---

## 13. Step 2 exact write set

MUST write:

1. `C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.ps1` (`-BacklogPath`, epoch/stanza parse, completeness check, new error codes, algorithm order)
2. `C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.tests.ps1` (`-BacklogPath` wiring; grandfather default)
3. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\_grandfather-only-backlog.md`
4. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\63-missing-entire-candidate-record\`
5. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\64-post-epoch-task-missing-machine-registration-metadata\`
6. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\65-post-epoch-governance-no-candidate\`
7. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\66-post-epoch-implementation-with-candidate\`
8. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\67-duplicate-canonical-registration-id\`
9. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\68-missing-enforcement-epoch\`
10. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\69-os-mutation-missing-entire-candidate\`
11. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\70-post-epoch-implementation-candidate-wrong-nature\`
12. `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` (epoch marker insertion only, immediately before `### GOV-OS-03R1`; plus GOV-OS-03R1 / GOV-OS-03 lifecycle fields as needed)
13. `C:\Users\knlee\aiSandBox2026B\TASKS.md` (GOV-OS-03R1 Step 2 lifecycle only; occupancy facts/hash unchanged unless occupancy actually changes — it must not)
14. `C:\Users\knlee\aiSandBox2026B\CLAUDE.md` (fail-closed lane saturation subsection only: missing entire candidate record fails closed via this contract; do not rewrite unrelated OS rules)
15. `C:\Users\knlee\aiSandBox2026B\docs\GOV-OS-03R1-CANDIDATE-COMPLETENESS.md` (Step 2 completion note only if required to record implementation evidence pointers; no design reopen)

MUST NOT write:

- `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`
- `docs/GOV-OS-03-STAGE-START.md`
- application source, tests, configs, migrations, compose, env
- Git hooks
- sidecar candidate seeding / FORCING inventory
- occupancy-block fact changes (lanes stay EMPTY; `saturationSuspended=true` until GOV-OS-03 LOCK)

MAY rewrite `docs/control-plane/SATURATION_PROOF.json` only if a real-tree validator run updates derived proof. Not required to change proof schema.

Step 2 validation: new fixtures + full 01–70 regression via `scripts/validate-lane-capacity.tests.ps1`. Real-tree validator must still exit 0 `idleCode=OS_MUTATION_QUIESCENCE` after epoch insertion (GOV-OS-03R1 is GOVERNANCE; required IMPLEMENTATION set empty; lanes empty; suspended).

Step 3 of GOV-OS-03R1: independent verification, then resume GOV-OS-03 final Step 4. GOV-OS-03 remains ACTIVE until that resumed Step 4 locks it. GOVERNANCE remains owned by GOV-OS-03. Implementation lanes remain EMPTY. OS mutation remains suspended.

---

## 14. Rejected fake fixes (explicit)

Do not:

- add another sidecar required-ID list
- add CLAUDE.md prose only
- trust `IDLE_REASON` / `SAFE_TWO_LANE_PAIR` / operator memory
- scan arbitrary historical ACTIVE/READY prose
- mass-migrate old tasks
- introduce a second scheduler
- require product tasks to occupy a lane before detection
- use git diff as the sole completeness source
- skip completeness while `saturationSuspended=true`

---

## 15. Unresolved design decisions

```
UNRESOLVED_DESIGN_DECISIONS=0
```

No TBD. No Step 2 choice remaining on this issue.
