# GOV-OS-03-STAGE-START.md

## GOV-OS-03 Step 2 — Exact Machine Contract / Schema / Validator / Fixture Freeze

**Task ID:** GOV-OS-03
**Title:** Fail-Closed Lane Saturation Enforcement
**Step:** 2 — Exact scheduler-machine contract / source-path / schema / validator / fixture freeze
**Step status:** COMPLETE — 2026-08-28
**Nature:** GOVERNANCE / DEVELOPMENT-OS — does NOT consume Lane 1 or Lane 2
**Risk:** HIGH
**Lifecycle:** 4-step (Step 1 registration + approved architecture recording — Step 2 this freeze — Step 3 bounded Development OS implementation + deterministic automated validation — Step 4 independent verification / checkpoint / final lock)
**Predecessor locks:** GOV-OS-01 COMPLETE AND LOCKED; GOV-OS-02 COMPLETE AND LOCKED; GOV-PARALLEL-01 COMPLETE AND LOCKED; PILOT-2LANE-01 COMPLETE AND LOCKED; GOV-AUTH-02 COMPLETE AND LOCKED
**This document:** Authoritative frozen implementation contract for GOV-OS-03 Step 3
**Exact next step after this freeze:** GOV-OS-03 Step 3 — NOT AUTHORIZED until Keith commits this Step 2 state
**Step 2 base HEAD:** `8cb83d91029ede96de25c40a1936418f7b398d41` (branch `main`; HEAD == origin/main; clean tree verified at Step 2 open)

---

## 0. Step 2 statement

This document freezes the complete, implementable, internally consistent **v1 lane-saturation machine contract**.

After this freeze there are **zero** material design decisions left for Step 3.

Step 3 must be mechanical implementation + TDD against this contract.

This step:

- created this freeze artifact
- updated GOV-OS-03 lifecycle status in `TASKS.md` and `TASKS_BACKLOG_FULL.md`
- did **not** create JSON sidecar, mutex catalog, proof file, validator, tests, or fixtures
- did **not** install the TASKS.md occupancy block (syntax frozen here; installation is Step 3)
- did **not** modify `CLAUDE.md`, `AGENTS.md`, `PRD.md`, or `ARCHITECTURE.md`
- did **not** modify application source
- did **not** start implementation
- did **not** seed FORCING candidates
- did **not** select a product task
- did **not** enable Lane 3
- did **not** invent work

```
STEP2_COMPLETE=YES
STEP3_AUTHORIZED=NO
UNRESOLVED_DESIGN_DECISIONS=0
IMPLEMENTATION_STARTED=NO
TASKS_MD_SOLE_SCHEDULER=YES
SIDECAR_IS_SCHEDULER=NO
MAX_IMPLEMENTATION_LANES=2
LANE3_DISABLED=YES
INITIAL_FORCING_CANDIDATES=NONE
GIT_HOOK_IN_V1=NO
```

---

## 0.1 Authority (unchanged)

- `TASKS.md` CURRENT EXECUTION BOARD is the **only** scheduler. It admits work. It cannot violate this contract once installed in `CLAUDE.md`.
- `TASKS_BACKLOG_FULL.md` is the canonical human task registry.
- `docs/control-plane/lane-saturation-state.json` is a **machine-readable control-plane state artifact**. It is **not** a scheduler. It cannot admit, rank, select, or invent tasks.
- `docs/control-plane/SATURATION_PROOF.json` is derived output. It has **zero** scheduler authority. Stale proof cannot satisfy lock.
- The validator is a **proof checker** over proposed END occupancy. It does **not** select tasks. It does **not** admit tasks. It does **not** invent work.
- GOV-OS-02 Next-Work Selection Protocol remains the selector for genuinely new product/architecture work.
- Agent-written `IDLE_REASON`, `SAFE_TWO_LANE_PAIR`, `NOT_NEEDED`, `UNRESOLVED`, historical `Previous:` chains, historical `ACTIVE` text, roadmap, chat memory, and model memory are **not** validation authority.
- Safety outranks saturation.
- Maximum implementation lanes remains **2**. Lane 3 remains **DISABLED**.

---

## 0.2 Core invariant (mandatory postcondition)

Let `S` be the set of registered FORCING implementation candidates that `Admissible(candidate, endOccupancy)` accepts.

```
FREE IMPLEMENTATION LANE
AND
S IS NONEMPTY
=
PROPOSED CONTROL-PLANE END STATE IS INVALID
```

If `S` is empty: idle implementation capacity is valid. The validator must derive why `S` is empty using closed idle codes. Agent prose is ignored.

Always evaluate candidates against **proposed END occupancy**, never only against the pre-transition board.

Example: A safe against empty; B safe against empty; A and B conflict.

- End `Lane1=A, Lane2=EMPTY`: if B is unsafe against A, idle Lane 2 is valid.
- End `Lane1=A, Lane2=EMPTY`: if B remains safely admissible against A, idle Lane 2 is invalid.
- End `Lane1=EMPTY, Lane2=EMPTY` with A and/or B admissible against empty: idle is invalid (at least one lane must be filled).
- End `Lane1=A, Lane2=B` when A and B are co-admissible: pass (`CAPACITY_FULL`).

If 0/2 and A+B are co-admissible: proposed 0/2 must fail; proposed A/2 must fail if B remains in `S`; proposed A+B must pass.

If 0/2 and A+B conflict: proposed 0/2 must still fail (S nonempty against empty); proposed A/2 may pass if B is no longer admissible against A.

---

## 0.3 OS-mutation suspension (mandatory)

During an active Development OS mutation:

- `saturationSuspended=true`
- `suspensionReason=OS_MUTATION`
- implementation lanes must be zero (`EMPTY`/`EMPTY`)
- idle is **required**
- saturation postcondition is **suspended**
- PASS idle code = `OS_MUTATION_QUIESCENCE`

Occupied implementation lane while suspended = FAIL exit 5.

When suspension ends (`saturationSuspended=false`, `suspensionReason=NONE`): the normal saturation postcondition applies immediately.

GOV-OS-03 itself is an OS mutation. Quiescence remains active through Step 4 lock. Step 3 real-tree seed therefore PASSes with `OS_MUTATION_QUIESCENCE` until lock clears suspension.

---

## Freeze Decision 1 — Exact file paths

YAGNI. No separate scheduler. No JSON Schema file. No Git hook. No Pester. No extra catalog copies.

### 1.1 Step 3 MUST create / install

| Path | Role |
|---|---|
| `C:\Users\knlee\aiSandBox2026B\docs\control-plane\lane-saturation-state.json` | Machine sidecar (NOT a scheduler) |
| `C:\Users\knlee\aiSandBox2026B\docs\control-plane\mutex-catalog.json` | Standing mutex/resource catalog (external, not embedded) |
| `C:\Users\knlee\aiSandBox2026B\docs\control-plane\SATURATION_PROOF.json` | Derived proof output (zero scheduler authority) |
| `C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.ps1` | Validator |
| `C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.tests.ps1` | Dependency-free fixture runner |
| `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\<NN-slug>\` | One directory per fixture |

Plus Step 3 edits of:

| Path | Role |
|---|---|
| `C:\Users\knlee\aiSandBox2026B\TASKS.md` | Install occupancy block + lifecycle |
| `C:\Users\knlee\aiSandBox2026B\CLAUDE.md` | Insert frozen saturation section + lean-metadata bullets |
| `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` | Lifecycle / AC only |

### 1.2 Step 3 MUST NOT create / modify

- `AGENTS.md` (see Freeze Decision 30)
- `PRD.md`
- `ARCHITECTURE.md`
- application source / tests / config / env / schema / migrations / compose
- `.git/hooks/*`
- any second scheduler document
- `docs/control-plane/*.schema.json`

### 1.3 Mutex for Step 3 writes

`GOVERNANCE` is sufficient. No HOTFILE lease for machine-state files. Implementation workers must not write these paths.

### 1.4 Why mutex catalog is external

Occupancy/candidate state changes frequently. Mutex expansion/aliases/matchers are standing OS definitions. Embedding the catalog in the sidecar would churn occupancy-adjacent JSON and mix standing rules with current state. The catalog is hashed separately as `mutexCatalogSha256`.

---

## Freeze Decision 2 — Structured TASKS.md occupancy block

### 2.1 Placement

Exactly one block in `TASKS.md`, **before** the `LEGACY / FROZEN TASK HISTORY` boundary.

Insert **immediately after** line 1:

```text
# TASKS.md — CURRENT EXECUTION BOARD
```

Human header lines after the block may duplicate current facts for operators. The validator **does not parse** human header, Lane 1/2 prose, flags fences, or `Previous:` chains. Only this block plus the sidecar/catalog/proof paths are machine inputs from `TASKS.md`.

### 2.2 Exact markers

```text
<!-- AISB_OCCUPANCY_V1_BEGIN -->
<!-- AISB_OCCUPANCY_V1_END -->
```

Zero or more than one marker pair = exit 1. Markers inside the inner body = exit 1. Block after the LEGACY / FROZEN boundary = exit 1.

### 2.3 Exact inner syntax

Line-oriented `KEY=VALUE`. No JSON. No YAML parser.

Rules:

- UTF-8; BOM stripped if present
- Split lines on `\r?\n`
- No empty lines inside the block
- No comments inside the block
- No spaces around `=`
- No leading/trailing whitespace on a line
- No tabs
- Duplicate keys = MALFORMED
- Unknown key = MALFORMED
- Missing required key = MALFORMED
- Parser accepts any key order; Step 3 **writes** the canonical order below

Canonical write order and required keys:

```text
<!-- AISB_OCCUPANCY_V1_BEGIN -->
schemaVersion=1
maxImplementationLanes=2
lane3=DISABLED
lane1.state=EMPTY
lane1.taskId=NONE
lane2.state=EMPTY
lane2.taskId=NONE
governance.owner=GOV-OS-03
governance.state=ACTIVE
saturationSuspended=true
suspensionReason=OS_MUTATION
occupancyHash=sha256:1d66e7a2cfdfd05c661d3e05181694384138c77413b26e318946f82d88dca3a0
<!-- AISB_OCCUPANCY_V1_END -->
```

The hash value above is the frozen SHA256 of the occupancy-subset CanonicalJson string in the Step 3 real-tree seed (Freeze Decision 21 + seed section). Step 3 must emit that exact CanonicalJson for that object and therefore that exact hex. The algorithm, the seed string, and this hex are one frozen triple.

### 2.4 Closed values

| Key | Allowed values |
|---|---|
| `schemaVersion` | `1` only |
| `maxImplementationLanes` | `2` only (any other = exit 4) |
| `lane3` | `DISABLED` only (any other = exit 4) |
| `lane1.state` / `lane2.state` | `EMPTY` \| `ACTIVE` \| `LANE-DONE` |
| `lane1.taskId` / `lane2.taskId` | `NONE` or a TaskId |
| `governance.owner` | `NONE` or a TaskId |
| `governance.state` | `UNOWNED` \| `ACTIVE` |
| `saturationSuspended` | `true` \| `false` (lowercase only) |
| `suspensionReason` | `NONE` \| `OS_MUTATION` |
| `occupancyHash` | `sha256:` + 64 lowercase hex |

Booleans: `true` / `false` only. `True` / `TRUE` / `yes` / `1` = MALFORMED.

### 2.5 Cross-field rules (board block)

- `laneN.state=EMPTY` ⇒ `laneN.taskId=NONE`
- `laneN.state=ACTIVE` or `LANE-DONE` ⇒ `laneN.taskId` is a TaskId, not `NONE`
- `lane1.taskId` and `lane2.taskId` must not be the same TaskId unless both `NONE`
- `governance.state=UNOWNED` ⇔ `governance.owner=NONE`
- `governance.state=ACTIVE` ⇔ `governance.owner` is a TaskId
- `saturationSuspended=true` ⇔ `suspensionReason=OS_MUTATION`
- `saturationSuspended=false` ⇔ `suspensionReason=NONE`

No `Previous:` history inside the block. No mutex lists inside the block. No candidate lists inside the block. Occupied-lane mutexes/writePaths live only in the sidecar.

### 2.6 TaskId pattern

```
^[A-Z][A-Z0-9-]{1,126}[A-Z0-9]$
```

Length 3–128. `NONE` is a sentinel, not a TaskId. `PRIVATE-BETA-INVITE-01` matches the pattern and is still never in `S`.

---

## Freeze Decision 3 — Sidecar schema

File: `C:\Users\knlee\aiSandBox2026B\docs\control-plane\lane-saturation-state.json`

- `schemaVersion` = integer `1`
- Closed enums
- **Unknown property anywhere (any object): FAIL CLOSED exit 1**
- Missing required property: FAIL CLOSED exit 1
- JSON `null` forbidden
- JSONC / comments forbidden
- Empty file / invalid JSON: exit 1
- Additional root keys forbidden
- No arbitrary prose fields
- Fields named `idleReason`, `IDLE_REASON`, `safeTwoLanePair`, `SAFE_TWO_LANE_PAIR`, `notNeeded`, `unresolved` are unknown properties if present → exit 1. Prose of those names in `TASKS.md` **outside** the occupancy block is ignored.

### 3.1 Root object — required properties exactly

```text
schemaVersion                 integer 1
maxImplementationLanes        integer 2
lane3                         "DISABLED"
saturationSuspended           boolean
suspensionReason              "NONE" | "OS_MUTATION"
governance                    object
occupancy                     object
candidates                    array of candidate objects
lockedTaskIds                 array of TaskId strings
sharedContracts               array of contract objects
runtimeAuthorization          object
```

No `occupancy.lane3`. No `lane3Occupancy`. Presence of those keys = exit 4 if they would represent an enabled third lane; as unknown properties they also fail schema. Freeze: treat `occupancy.lane3` as capacity invariant exit 4.

`maxImplementationLanes != 2` = exit 4.
`lane3 != "DISABLED"` = exit 4.

### 3.2 `governance` required properties exactly

```text
owner    "NONE" | TaskId
state    "UNOWNED" | "ACTIVE"
```

Same cross-field rules as the board block. Must equal the board block.

### 3.3 `runtimeAuthorization` required properties exactly

```text
localRuntimeAuthorized    boolean
stagingAuthorized         boolean
providerLiveAuthorized    boolean
creditAuthorized          boolean
```

Validator never sets these true. No automatic gate enabling. Step 3 real-tree seed: all `false`.

### 3.4 `lockedTaskIds`

Array of unique TaskId strings, sorted lexicographically (ordinal). Duplicates = MALFORMED. Unsorted is allowed at parse; CanonicalJson for `sidecarSha256` preserves array order as stored. Control plane **must write sorted unique** arrays. Unsorted is not a schema failure (avoid brittle operator friction) but Step 3 seed writes sorted empty `[]`.

This array is the **sole** dependency LOCK proof. See Freeze Decision 7.

### 3.5 `sharedContracts[]` required properties exactly

```text
id       string matching ^[A-Z][A-Z0-9_-]{1,126}[A-Z0-9]$
state    "FROZEN" | "UNFROZEN"
paths    array of write-path strings (may be empty)
```

Duplicate contract `id` = MALFORMED.

### 3.6 Hardcoded never-candidate set (not a sidecar field)

The validator **always** applies:

```
NEVER_CANDIDATE_IDS = ["PRIVATE-BETA-INVITE-01"]
```

Sidecar cannot remove this. A candidate with that `taskId` never enters `S` (`PROHIBITED`).

### 3.7 Sidecar is not a scheduler

The sidecar cannot:

- admit a task onto a lane
- rank candidates
- select next work
- invent successors
- promote FUTURE work
- enable Lane 3
- change `maxImplementationLanes`

Those remain `TASKS.md` / `CLAUDE.md` / GOV-OS-02 / GOV-PARALLEL-01 duties.

---

## Freeze Decision 4 — Occupancy schema

`occupancy` required properties exactly: `lane1`, `lane2`.

No Lane 3 occupancy object. Lane 3 is the root string `DISABLED` only.

### 4.1 Lane object — required properties exactly

```text
state                 "EMPTY" | "ACTIVE" | "LANE-DONE"
taskId                "NONE" | TaskId
mutexes               array of mutex id strings
writePaths            array of write-path strings
hotfiles              array of write-path strings
i18n                  boolean
evidenceClass         "NONE" | "LOCAL-TESTS" | "LOCAL-RUNTIME" | "STAGING-RUNTIME" | "PROVIDER-LIVE"
exclusiveCapacity     boolean
sharedContractIds     array of contract id strings
mutatesSharedContractIds  array of contract id strings
runtimeNeeds          array of "LOCAL-RUNTIME" | "STAGING" | "PROVIDER-LIVE" | "CREDIT"
```

No `id` field (lane identity is the property name `lane1` / `lane2`). YAGNI.

Valid implementation-lane occupancy states: `EMPTY`, `ACTIVE`, `LANE-DONE` only.

`LOCKED`, `REJECTED`, `RETURN-TO-READY` are **not** lane occupancy states. Those control-plane outcomes produce `EMPTY`.

`LANE-DONE` **occupies** the lane. It does not free capacity. Mutexes remain held until lane release / LOCK.

### 4.2 EMPTY constraints

If `state=EMPTY`:

- `taskId=NONE`
- `mutexes=[]`
- `writePaths=[]`
- `hotfiles=[]`
- `i18n=false`
- `evidenceClass=NONE`
- `exclusiveCapacity=false`
- `sharedContractIds=[]`
- `mutatesSharedContractIds=[]`
- `runtimeNeeds=[]`

Any deviation = MALFORMED.

### 4.3 Occupied constraints (`ACTIVE` or `LANE-DONE`)

- `taskId` is a TaskId
- A candidate with that `taskId` **must** exist
- `candidate.status` must be `ADMITTED` if lane `ACTIVE`, or `LANE-DONE` if lane `LANE-DONE`
- Occupied lane fields `mutexes`, `writePaths`, `hotfiles`, `i18n`, `evidenceClass`, `exclusiveCapacity`, `sharedContractIds`, `mutatesSharedContractIds`, `runtimeNeeds` must deep-equal the candidate record (after mutex alias normalization)
- At least one of: `writePaths.length>0`, `mutexes.length>0`, `exclusiveCapacity=true`. Else MALFORMED
- `evidenceClass` must not be `NONE`

### 4.4 Occupied-vs-candidate mismatch

Mismatch = exit 1 `MALFORMED`. Occupied `taskId` with no candidate = exit 1 `UNREGISTERED`.

---

## Freeze Decision 5 — Candidate schema

Every **newly registered implementation task after GOV-OS-03 LOCK** must have exactly one machine candidate record.

Historical tasks are **not** mass-migrated. Unregistered ideas are not candidates. Governance tasks do **not** enter the candidate array as a requirement; if present with `nature=GOVERNANCE` they never enter `S`.

No implicit/default `saturationClass`. Missing `saturationClass` = MALFORMED.

### 5.1 Candidate object — required properties exactly

```text
taskId                    TaskId
nature                    "IMPLEMENTATION" | "GOVERNANCE"
lifecycle                 "2-STEP" | "3-STEP" | "4-STEP"
status                    "READY" | "ADMITTED" | "LANE-DONE" | "LOCKED" | "REJECTED" | "RETURN-TO-READY" | "PARKED" | "PROHIBITED"
startCondition            "READY" | "NOT_READY"
saturationClass           "FORCING" | "OPTIONAL"
productClass              "CURRENT" | "LIMITED_PRIVATE_BETA" | "APPROVED_FUTURE" | "PARKED" | "PROHIBITED"
futureAuthorization       "NONE" | "AUTHORIZED"
dependsOn                 array of TaskId
mutexes                   array of mutex id / alias strings
writePaths                array of write-path strings
hotfiles                  array of write-path strings
i18n                      boolean
sharedContractIds         array of contract id (DEPENDS ON)
mutatesSharedContractIds  array of contract id (MUTATES)
evidenceClass             "LOCAL-TESTS" | "LOCAL-RUNTIME" | "STAGING-RUNTIME" | "PROVIDER-LIVE"
exclusiveCapacity         boolean
runtimeNeeds              array of "LOCAL-RUNTIME" | "STAGING" | "PROVIDER-LIVE" | "CREDIT"
admissionUncertain        boolean
writeSetPrecision         "PROVISIONAL" | "EXACT"
```

### 5.2 FORCING / OPTIONAL policy

**FORCING:** Real registered near-frontier implementation work that the control plane intends to execute when safely admissible. A FORCING candidate that `Admissible` accepts makes a free implementation lane invalid.

**OPTIONAL:** Registered implementation work that may be useful but does **not** force occupancy. OPTIONAL work may still be manually admitted through normal scheduler governance.

Missing classification: FAIL CLOSED (`MALFORMED`).
No default. No inference from workstream, title, or prose.

### 5.3 Duplicate / identity

- Duplicate `candidates[].taskId` = exit 1 `DUPLICATE_ID`
- Occupied lane TaskId not in `candidates` = `UNREGISTERED`
- Candidate `taskId` in `NEVER_CANDIDATE_IDS` never enters `S`

### 5.4 writeSetPrecision vs admissionUncertain

- `writeSetPrecision=PROVISIONAL` ⇒ `admissionUncertain` MUST be `true`. Else MALFORMED.
- `writeSetPrecision=EXACT` ⇒ `admissionUncertain` MAY be `true` or `false`.
- Registration before stage-start typically uses `PROVISIONAL` + `admissionUncertain=true`.
- Stage-start sets `EXACT` and may set `admissionUncertain=false` only if remaining uncertainty is gone.

### 5.5 Intra-candidate consistency (MALFORMED if violated)

See Freeze Decisions 10, 14, 16. Summary:

- I18N flag / mutex / locale-path agreement
- `runtimeNeeds` ⊆ `mutexes` after alias normalization (resource ids)
- `evidenceClass=STAGING-RUNTIME` ⇒ `STAGING ∈ runtimeNeeds`
- `evidenceClass=PROVIDER-LIVE` ⇒ `PROVIDER-LIVE ∈ runtimeNeeds`
- `evidenceClass=LOCAL-RUNTIME` ⇒ `LOCAL-RUNTIME ∈ mutexes`
- `evidenceClass=LOCAL-TESTS` ⇒ `STAGING ∉ runtimeNeeds` and `PROVIDER-LIVE ∉ runtimeNeeds`
- `productClass=APPROVED_FUTURE` may have `futureAuthorization=AUTHORIZED` or `NONE`
- `productClass` in `{CURRENT, LIMITED_PRIVATE_BETA, PARKED, PROHIBITED}` ⇒ `futureAuthorization=NONE`
- `nature=IMPLEMENTATION` ⇒ `GOVERNANCE ∉ mutexes`
- `mutexes` entries must be catalog ids or aliases
- `writePaths` / `hotfiles` must satisfy Freeze Decision 9
- `dependsOn` unique TaskIds; must not contain own `taskId`

---

## Freeze Decision 6 — Product eligibility

The validator does **not** decide product value. Keith/control-plane authorization must already exist in structured fields.

A candidate is product-eligible iff:

```
productClass ∈ {CURRENT, LIMITED_PRIVATE_BETA}
OR
(productClass = APPROVED_FUTURE AND futureAuthorization = AUTHORIZED)
```

Never in `S`:

| Condition | Code |
|---|---|
| `productClass=PARKED` or `status=PARKED` | `PARKED` |
| `productClass=PROHIBITED` or `status=PROHIBITED` or `taskId ∈ NEVER_CANDIDATE_IDS` | `PROHIBITED` |
| unregistered occupied id / occupancy without candidate | `UNREGISTERED` |
| `APPROVED_FUTURE` and `futureAuthorization=NONE` | `FUTURE_NOT_AUTHORIZED` |
| unregistered idea (no candidate record) | not a candidate; ignored |

`LIMITED_PRIVATE_BETA` is eligible like `CURRENT` unless PARKED/PROHIBITED.

Unauthorized FUTURE cannot become FORCING-admissible. Control plane must set `futureAuthorization=AUTHORIZED` **before** such work can enter `S`. Validator never flips that field.

---

## Freeze Decision 7 — Dependency proof

Do **not** grep `TASKS_BACKLOG_FULL.md`. Do **not** treat checkpoint file existence as LOCK proof (stale checkpoints exist).

**v1 mechanism = Option A only:** `sidecar.lockedTaskIds`.

Semantics:

- Control plane appends a TaskId to `lockedTaskIds` when it records COMPLETE AND LOCKED.
- Control plane never infers LOCK from markdown.
- Candidate `dependsOn` is satisfied iff every id is present in `lockedTaskIds`.
- Empty `dependsOn` ⇒ satisfied.
- Any missing id ⇒ `DEPS_UNSATISFIED`.
- Missing `lockedTaskIds` property ⇒ exit 1 (required field). Empty array is valid and is the Step 3 seed.

`CHECKPOINT_MISSING` is **not** a v1 reject code (no checkpoint I/O in the validator). Fixture 23 uses missing/unsatisfied `lockedTaskIds` proof.

---

## Freeze Decision 8 — Mutex / resource catalog

File: `C:\Users\knlee\aiSandBox2026B\docs\control-plane\mutex-catalog.json`

Unknown catalog property = exit 1. Unknown mutex id/alias on a record = MALFORMED.

### 8.1 Catalog root

```text
schemaVersion    integer 1
mutexes          array of mutex spec objects
```

### 8.2 Mutex spec — required properties exactly

```text
id            canonical mutex id
aliases       array of strings (may be empty)
kind          "BROAD" | "ATOMIC" | "RESOURCE" | "MATCHER" | "HOTFILE_RULE"
exclusive     boolean
pathPrefixes  array of directory prefixes (trailing slash after normalize)
files         array of exact file paths
matchKind     "NONE" | "FILENAME" | "BASENAME_PREFIX"
matchNames    array of strings (used when matchKind != NONE)
```

Every spec must include all keys. Unused arrays are `[]`. Unused `matchKind` is `"NONE"` with `matchNames=[]`.

`HOTFILE` is not a single mutex id in records. Records use `hotfiles: []`. The catalog contains one `HOTFILE_RULE` spec with `id=HOTFILE` documenting matching rules; records must **not** list `HOTFILE` or `HOTFILE:<path>` in `mutexes` (that form is CLAUDE prose). `HOTFILE` or `HOTFILE:*` in `mutexes` = MALFORMED.

### 8.3 Canonical mutex ids (v1 closed set)

`GOVERNANCE`, `GATEWAY`, `AI-SERVICE`, `CONTAINER-MANAGER`, `FRONTEND`, `I18N`, `MIGRATION`, `PACKAGE`, `COMPOSE`, `ENV`, `LOCAL-RUNTIME`, `STAGING`, `PROVIDER-LIVE`, `CREDIT`, `HOTFILE` (rule only).

### 8.4 Aliases (case-sensitive exact)

| Alias | Canonical |
|---|---|
| `API-GATEWAY` | `GATEWAY` |
| `AI_SERVICE` | `AI-SERVICE` |
| `CONTAINER_MANAGER` | `CONTAINER-MANAGER` |
| `LOCAL_RUNTIME` | `LOCAL-RUNTIME` |
| `PROVIDER_LIVE` | `PROVIDER-LIVE` |

After alias expansion, duplicate canonical ids in one record = MALFORMED.

Lowercase `gateway` is **not** an alias. Unknown → MALFORMED. String equality of raw user strings is insufficient; always expand then compare canonical ids.

### 8.5 Frozen specs

**GOVERNANCE** — `BROAD`, exclusive, files: `CLAUDE.md`, `AGENTS.md`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `PRD.md`, `ARCHITECTURE.md`; pathPrefixes: `docs/control-plane/`. Implementation candidates listing `GOVERNANCE` = MALFORMED.

**GATEWAY** — `BROAD`, exclusive, pathPrefixes: `services/api-gateway/`

**AI-SERVICE** — `BROAD`, exclusive, pathPrefixes: `services/ai-service/`

**CONTAINER-MANAGER** — `BROAD`, exclusive, pathPrefixes: `services/container-manager/`

**FRONTEND** — `BROAD`, exclusive, pathPrefixes: `frontend/` (v1 conservative: entire frontend tree, including locale files)

**I18N** — `ATOMIC`, exclusive, files: the three locale files in Freeze Decision 10

**MIGRATION** — `BROAD`, exclusive, pathPrefixes: `services/api-gateway/src/migrations/`, `services/api-gateway/migrations/`

**PACKAGE** — `MATCHER`, exclusive, matchKind=`FILENAME`, matchNames: `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`

**COMPOSE** — `MATCHER`, exclusive, matchKind=`BASENAME_PREFIX`, matchNames: `docker-compose` (matches `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.local-testing.yml`, `.yaml` equivalents)

**ENV** — `MATCHER`, exclusive, matchKind=`BASENAME_PREFIX`, matchNames: `.env`

**LOCAL-RUNTIME**, **STAGING**, **PROVIDER-LIVE**, **CREDIT** — `RESOURCE`, exclusive, no paths

**HOTFILE** — `HOTFILE_RULE`, exclusive, no paths; matching is equality of normalized hotfile paths plus overlap against the other record's effective path set

### 8.6 Expansion algorithm

```
Effective(record):
  mutexSet = {}
  pathSet  = {}   # each entry tagged FILE or DIR
  hotSet   = {}
  resSet   = {}

  for raw in record.mutexes:
    spec = Lookup(raw)  # id or alias; else MALFORMED
    mutexSet.add(spec.id)
    add spec.pathPrefixes as DIR
    add spec.files as FILE
    if spec.kind == RESOURCE: resSet.add(spec.id)
    if spec.id == I18N: add three locale files as FILE

  for p in record.writePaths:
    add Normalize(p)
    apply catalog MATCHER specs: if p matches PACKAGE/COMPOSE/ENV matcher,
      mutexSet.add(that id)   # matcher mutex is implied by path
      AND the record must already list that mutex
      (path matches PACKAGE but PACKAGE not in mutexes = MALFORMED)

  for h in record.hotfiles:
    nh = Normalize(h) as FILE
    hotSet.add(nh)
    pathSet.add(nh)

  if record.i18n:
    mutexSet.add(I18N)
    add three locale files as FILE

  for r in record.runtimeNeeds:
    resSet.add(r)
    mutexSet.add(r)

  return {mutexSet, pathSet, hotSet, resSet}
```

Matcher implication: a writePath whose normalized basename is `package.json` requires `PACKAGE` in `mutexes`. Same for compose/env matchers. This prevents “frontend stuff” and silent package edits.

### 8.7 Broad mutex vs HOTFILE vs child paths

- Same canonical mutex id on two records → mutex conflict (specific code per Freeze Decision 20 order).
- Broad prefix `services/api-gateway/` overlaps any path under it, including HOTFILEs under it.
- Two HOTFILEs conflict iff normalized paths overlap per Freeze Decision 9.
- Case-insensitive Windows comparison after normalize.
- Avoid redundant HOTFILE when a broad mutex already covers the file (control-plane rule; validator still accepts both if listed, and they overlap).

### 8.8 Exact catalog JSON Step 3 must install

Step 3 must install a catalog whose `mutexes[].id` set, aliases, kinds, prefixes, files, and matchers are semantically identical to §8.5. Property order in the file is not occupancy-hashed; CanonicalJson for `mutexCatalogSha256` sorts object keys.

---

## Freeze Decision 9 — Write-path normalization

v1: **no globs** in `writePaths` or `hotfiles`. Characters `*`, `?`, `[`, `]` in a path = MALFORMED.

Vague scopes (`frontend stuff`, `gateway relevant source`) cannot appear; only path strings.

### 9.1 Normalize(path) → {kind, value}

Repo root for absolute-prefix strip (case-insensitive):

```
C:\Users\knlee\aiSandBox2026B
```

also accept `C:/Users/knlee/aiSandBox2026B`.

Steps:

1. Reject empty / whitespace-only = MALFORMED
2. Trim (no internal requirement to trim if occupancy syntax forbids spaces; JSON strings: trim trailing/leading space = MALFORMED, do not silent-trim)
3. If path contains `*` `?` `[` `]` = MALFORMED
4. Replace `\` with `/`
5. Collapse duplicate `/`
6. Remove leading `./`
7. If any segment is `..` = MALFORMED
8. If absolute:
   - if under repo root (case-insensitive prefix), strip repo root and any following `/`
   - else MALFORMED (outside repo)
9. Reject remaining Windows drive prefix
10. If result is empty = MALFORMED
11. Comparison key = invariant-culture lowercase
12. Kind: if original (after slash normalize, before lowercase) ends with `/` → DIR; else FILE
13. Store comparison `value` as lowercase without changing DIR trailing slash (`frontend/` → `frontend/`)

### 9.2 Overlap(a, b)

Using comparison keys:

- FILE/FILE: equal
- DIR/DIR: equal, or one is prefix of the other
- DIR/FILE: file equals the dir without slash, **or** file starts with the dir prefix (`frontend/` overlaps `frontend/app/page.tsx`; `frontend/` overlaps `frontend` as file name only if file key is `frontend`)

Parent/child overlap is a conflict.

`frontend/components` (FILE) does **not** overlap `frontend/components/foo.tsx` (FILE). To claim a directory, the path **must** end with `/`.

### 9.3 Repo-relative vs absolute

Both allowed in input. After Normalize they are repo-relative comparison keys. Step 3 seed and fixtures should write repo-relative forward-slash paths.

---

## Freeze Decision 10 — I18N atomic rule

Exact files:

```
C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json
C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json
C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json
```

Normalized comparison keys:

```
frontend/messages/en.json
frontend/messages/zh-tw.json
frontend/messages/zh-cn.json
```

### 10.1 Agreement (mismatch = MALFORMED)

Let `touchesLocale` = any writePath or hotfile overlapping any of the three files.

- `touchesLocale` ⇒ `i18n=true` AND `I18N ∈ mutexes`
- `i18n=true` ⇒ `I18N ∈ mutexes`
- `I18N ∈ mutexes` ⇒ `i18n=true`
- `i18n=false` AND `I18N ∈ mutexes` = MALFORMED
- `i18n=true` AND `I18N ∉ mutexes` = MALFORMED
- `touchesLocale` AND `i18n=false` = MALFORMED (fixture 20)

Touching only `zh-CN.json` still requires the full I18N lease. I18N mutex expands to **all three** files for conflict detection. Fixture 19: occupied I18N vs candidate that correctly declares I18N because it touches only `zh-CN.json` → `I18N_CONFLICT`.

A record may hold I18N without listing all three files in `writePaths` (lease claimed; expansion still includes all three).

FRONTEND (`frontend/`) always path-overlaps I18N files. Two different records, one FRONTEND and one I18N, conflict via write-scope if mutex ids differ; if both also hold I18N, `I18N_CONFLICT` wins. Same record holding FRONTEND+I18N is valid.

---

## Freeze Decision 11 — Shared-contract freeze

No NLP. Structured ids only.

Sidecar `sharedContracts[]` is the contract registry.

Candidate/lane:

- `sharedContractIds` = contracts this record **depends on**
- `mutatesSharedContractIds` = contracts this record **mutates**

Rules:

- Depend on id not in registry → `SHARED_CONTRACT_UNFROZEN`
- Depend on `state=UNFROZEN` → `SHARED_CONTRACT_UNFROZEN`
- Depend on `state=FROZEN` → OK (supports parallel admission)
- Mutate an id that another occupant/candidate-in-occupancy depends on or mutates → `SHARED_CONTRACT_UNFROZEN`
- Mutate `UNFROZEN` while no other occupant references it → OK for single-lane work (unfrozen mutation is how a contract changes; parallel still forbidden)
- Intersection of one record's `sharedContractIds` and its own `mutatesSharedContractIds` = MALFORMED
- Only FROZEN contracts may support **parallel** admission (two occupied/proposed records both depending on the same FROZEN id is allowed; neither may mutate it)

`paths` on the contract are informational expansion: they are added to the mutating record's effective path set when `id ∈ mutatesSharedContractIds`. Depend-only does not add write ownership of those paths.

---

## Freeze Decision 12 — Revert isolation

Do not trust a boolean `revertIsolation=yes`. That field is **not in the schema** (unknown property if added).

v1 derived revert isolation = ALL of:

1. disjoint effective write paths (after mutex/I18N/HOTFILE expansion)
2. compatible shared-contract state (Freeze Decision 11)
3. compatible evidence class (Freeze Decision 13)
4. no exclusive-capacity block (Freeze Decision 15)

If a residual non-mechanical uncertainty remains, control plane sets `admissionUncertain=true` and the candidate is excluded from `S`.

Safety first. Utilization pressure must not resolve uncertainty.

---

## Freeze Decision 13 — Evidence compatibility matrix

Symmetric. Empty lane `evidenceClass=NONE` is compatible with all.

| | LOCAL-TESTS | LOCAL-RUNTIME | STAGING-RUNTIME | PROVIDER-LIVE |
|---|---|---|---|---|
| **LOCAL-TESTS** | ALLOW | ALLOW | DENY | DENY |
| **LOCAL-RUNTIME** | ALLOW | DENY | DENY | DENY |
| **STAGING-RUNTIME** | DENY | DENY | DENY | DENY |
| **PROVIDER-LIVE** | DENY | DENY | DENY | DENY |

Notes:

- LOCAL-TESTS + LOCAL-TESTS allowed if other constraints pass (fixture 11 / 27).
- LOCAL-TESTS + LOCAL-RUNTIME allowed **at the evidence layer**. LOCAL-RUNTIME mutex/resource exclusivity is a separate check (a LOCAL-TESTS record must not also hold `LOCAL-RUNTIME` if the other record holds it).
- LOCAL-RUNTIME + LOCAL-RUNTIME DENY (`EVIDENCE_INCOMPATIBLE` and/or `RUNTIME_INCOMPATIBLE`; first-fail order yields `RUNTIME_INCOMPATIBLE` if both hold the mutex, which they must when `evidenceClass=LOCAL-RUNTIME`).
- STAGING-RUNTIME + anything DENY.
- PROVIDER-LIVE + anything DENY.
- Do not expand concurrency beyond this matrix in v1.

DENY → `EVIDENCE_INCOMPATIBLE` unless an earlier code already fired.

---

## Freeze Decision 14 — Runtime-sensitive resources

Resources: `LOCAL-RUNTIME`, `STAGING`, `PROVIDER-LIVE`, `CREDIT`.

- Exclusive per resource id. Two holders → resource conflict code.
- Resource conflicts override optimistic evidence labels.
- `runtimeNeeds` must be ⊆ mutexes (canonical). Else MALFORMED.
- Authorization flags in sidecar:
  - `LOCAL-RUNTIME ∈ runtimeNeeds` AND `localRuntimeAuthorized=false` → `RUNTIME_INCOMPATIBLE`
  - `STAGING ∈ runtimeNeeds` AND `stagingAuthorized=false` → `STAGING_CONFLICT`
  - `PROVIDER-LIVE ∈ runtimeNeeds` AND `providerLiveAuthorized=false` → `PROVIDER_LIVE_CONFLICT`
  - `CREDIT ∈ runtimeNeeds` AND `creditAuthorized=false` → `CREDIT_CONFLICT`
- Validator never writes authorization true.
- No automatic gate enabling.

Fixture 32 (LOCAL-RUNTIME conflict) and fixture 28 (LOCAL-RUNTIME evidence pair) both fail closed. Fixture 31 CREDIT. Fixture 29 STAGING vs other. Fixture 30 PROVIDER-LIVE vs other.

---

## Freeze Decision 15 — Exclusive capacity

`exclusiveCapacity=true` is machine-readable on both occupancy lanes and candidates.

- If **any occupied** lane (ACTIVE or LANE-DONE) has `exclusiveCapacity=true`, no second implementation lane may be non-EMPTY. Proposed 2/2 = FAIL (`EXCLUSIVE_CAPACITY`). A remaining EMPTY lane is valid if `S` is empty (expected, because candidates are not admissible against exclusive occupancy). Idle code `EXCLUSIVE_CAPACITY_HELD` when free lane exists and `S` empty for this reason.
- If a **candidate** has `exclusiveCapacity=true`, it is admissible only if the other implementation lane in `endOccupancy` is EMPTY (and no occupied exclusive). Else `EXCLUSIVE_CAPACITY` and not in `S`.
- 0/2 with a single exclusive FORCING candidate: `S` nonempty → FAIL (must occupy one lane). Proposed that candidate + EMPTY: PASS `EXCLUSIVE_CAPACITY_HELD` if no other admissible FORCING remains.

---

## Freeze Decision 16 — Admission uncertainty

`admissionUncertain=true` ⇒ candidate is **not** in `S`. Code `ADMISSION_UNCERTAIN`.

Do not resolve uncertainty because a lane is idle.

Stage-start must re-evaluate:

- `writePaths`, `hotfiles`, `mutexes`, `sharedContractIds`, `mutatesSharedContractIds`
- set `writeSetPrecision=EXACT`
- set `admissionUncertain=false` **only** after the exact write-set is frozen **and** no residual non-mechanical uncertainty remains

If exact write-set is frozen but uncertainty remains, keep `true`.

PROVISIONAL without `admissionUncertain=true` = MALFORMED (fixture 60).

---

## Freeze Decision 17 — `Admissible(candidate, endOccupancy)`

Deterministic. No NLP. No agent safety judgment. Inputs = structured sidecar + catalog + occupancy + filesystem/hash facts in this contract.

Occupied candidate TaskIds (already on a lane in `endOccupancy`) are **skipped** (not in `S`; not listed as rejected). They are not free-lane candidates.

### 17.1 Global validation before `Admissible` (exit 1 if fail)

Parse JSON; reject unknown properties; reject missing required; reject unknown enums; reject path globs; reject duplicate candidate ids; reject occupancy/candidate mismatch; reject I18N/runtime/product intra-record mismatches; reject GOVERNANCE mutex on IMPLEMENTATION; reject `HOTFILE` token in `mutexes`.

### 17.2 Ordered `Admissible` checks (first failure wins)

```
function Admissible(c, endOcc) -> OK | CODE

if c.taskId in occupiedTaskIds(endOcc): SKIP

1. if c.taskId in NEVER_CANDIDATE_IDS:           PROHIBITED
2. if c.nature != IMPLEMENTATION:                GOVERNANCE_NATURE
3. if c.productClass == PARKED
   or c.status == PARKED:                        PARKED
4. if c.productClass == PROHIBITED
   or c.status == PROHIBITED:                    PROHIBITED
5. if c.productClass == APPROVED_FUTURE
   and c.futureAuthorization != AUTHORIZED:      FUTURE_NOT_AUTHORIZED
6. if c.productClass not in
   {CURRENT, LIMITED_PRIVATE_BETA}
   and not (APPROVED_FUTURE and AUTHORIZED):     PROHIBITED
   (unreachable if enums closed and 3–5 applied)
7. if c.status != READY:                         NOT_READY
8. if c.startCondition != READY:                 NOT_READY
9. if c.saturationClass != FORCING:              NOT_FORCING
10. if c.admissionUncertain:                     ADMISSION_UNCERTAIN
11. if any dependsOn id not in lockedTaskIds:    DEPS_UNSATISFIED
12. ExclusiveCapacity(c, endOcc):
    if c.exclusiveCapacity and otherLane occupied: EXCLUSIVE_CAPACITY
    if any occupied lane exclusiveCapacity:        EXCLUSIVE_CAPACITY
13. for each occupied lane L in endOcc:
      code = Conflict(c, L)
      if code != OK: return code
14. RuntimeAuthorization(c):
    as Freeze Decision 14
15. Shared-contract depend/mutate vs registry and vs occupied lanes
    (if not already caught in Conflict)

return OK
```

### 17.3 `Conflict(a, b)` first-fail order

Using `Effective(a)` and `Effective(b)`:

```
1. mutexSet intersection:
   if contains STAGING:          STAGING_CONFLICT
   else if PROVIDER-LIVE:        PROVIDER_LIVE_CONFLICT
   else if CREDIT:               CREDIT_CONFLICT
   else if LOCAL-RUNTIME:        RUNTIME_INCOMPATIBLE
   else if I18N:                 I18N_CONFLICT
   else if nonempty:             MUTEX_CONFLICT
2. hotSet overlap OR a.hotfile overlaps b.pathSet
   OR b.hotfile overlaps a.pathSet: HOTFILE_CONFLICT
3. pathSet overlap:              WRITE_SCOPE_CONFLICT
4. shared-contract mutate vs other depend/mutate:
                                 SHARED_CONTRACT_UNFROZEN
5. evidence matrix DENY:         EVIDENCE_INCOMPATIBLE
6. else OK
```

Runtime authorization (unoccupied resource still unauthorized) is step 14 of `Admissible`, not `Conflict`.

### 17.4 Pairwise occupied occupancy

If both lanes non-EMPTY: `Conflict(lane1, lane2)` plus exclusive-capacity 2/2 rule. Failure → result FAIL, exit 2, `idleCode=NONE`. Do not accept idle because `S` is empty when the occupancy itself is illegal.

---

## Freeze Decision 18 — Set `S` and saturation postcondition

```
function Validate(endState):

  parse + schema                                          → exit 1
  maxImplementationLanes==2 and lane3==DISABLED
    and no occupancy.lane3                                → else exit 4
  board occupancy facts == sidecar occupancy subset
    and occupancyHash matches both                        → else exit 3

  if endState.saturationSuspended:
    if occupiedImplementationCount != 0:                  → exit 5
    else PASS idleCode=OS_MUTATION_QUIESCENCE             → exit 0
      # do not apply S-fail while suspended, even if FORCING exist

  occupied pairwise legal                                 → else exit 2

  S = []
  rejected = []
  for c in candidates:
    r = Admissible(c, endOccupancy)
    if r == SKIP: continue
    if r == OK: S.add(c.taskId)
    else rejected.add({taskId: c.taskId, code: r})
  S.sort()

  free = count of EMPTY implementation lanes

  if free == 0:
    PASS idleCode=CAPACITY_FULL                           → exit 0

  if S nonempty:
    FAIL  (free lane + S nonempty)                        → exit 2

  # S empty and free > 0
  PASS idleCode = DeriveIdle(endOccupancy, candidates, rejected)
                                                          → exit 0
```

`DeriveIdle` priority:

```
1. if any occupied lane exclusiveCapacity:  EXCLUSIVE_CAPACITY_HELD
2. if no candidate has saturationClass FORCING
   (including empty candidates array):      NO_FORCING_CANDIDATES
3. else:                                    NO_PAIRWISE_ADMISSIBLE_CANDIDATE
```

OPTIONAL-only READY candidates produce `NO_FORCING_CANDIDATES` (they are `NOT_FORCING`, not members of `S`).

Two free lanes: the same rule applies. If `S` nonempty, 0/2 fails. There is **no** extra pair-search. Pairwise end-state is already in `Admissible(..., endOccupancy)`.

Refinement check (must hold):

- 0/2, A+B co-admissible: `S={A,B}` → FAIL
- A/2, B still admissible vs A: `S={B}` → FAIL
- A+B / 2: `free=0` → PASS `CAPACITY_FULL`
- 0/2, A+B conflict: `S={A,B}` (both vs empty) → FAIL
- A/2, B unsafe vs A: `S=[]` → PASS `NO_PAIRWISE_ADMISSIBLE_CANDIDATE` (or `EXCLUSIVE_CAPACITY_HELD` if that was the reason)

---

## Freeze Decision 19 — Derived idle codes

Closed set. No agent `IDLE_REASON` input. If such a field appears in JSON → unknown property exit 1. If it appears in TASKS prose outside the occupancy block → ignored.

| Code | When |
|---|---|
| `CAPACITY_FULL` | PASS and 0 free implementation lanes |
| `NO_FORCING_CANDIDATES` | PASS, free>0, no FORCING candidates exist |
| `NO_PAIRWISE_ADMISSIBLE_CANDIDATE` | PASS, free>0, FORCING exist, none in `S` |
| `EXCLUSIVE_CAPACITY_HELD` | PASS, free>0, occupied exclusiveCapacity |
| `OS_MUTATION_QUIESCENCE` | PASS because saturationSuspended and 0 occupied lanes |
| `NONE` | FAIL paths (not an idle success) |

`SATURATION_SUSPENDED` is **not** an idle code. Suspension is a state field. Success under suspension uses `OS_MUTATION_QUIESCENCE` only.

On FAIL, proof `idleCode=NONE`.

---

## Freeze Decision 20 — Reject codes

Closed set. First-fail from Freeze Decision 17.

```
MALFORMED
DUPLICATE_ID
UNREGISTERED
GOVERNANCE_NATURE
PARKED
PROHIBITED
FUTURE_NOT_AUTHORIZED
NOT_READY
NOT_FORCING
ADMISSION_UNCERTAIN
DEPS_UNSATISFIED
EXCLUSIVE_CAPACITY
STAGING_CONFLICT
PROVIDER_LIVE_CONFLICT
CREDIT_CONFLICT
RUNTIME_INCOMPATIBLE
I18N_CONFLICT
MUTEX_CONFLICT
HOTFILE_CONFLICT
WRITE_SCOPE_CONFLICT
SHARED_CONTRACT_UNFROZEN
EVIDENCE_INCOMPATIBLE
```

Removed as redundant / unused in v1:

- `CHECKPOINT_MISSING` (no checkpoint I/O)
- `SATURATION_SUSPENDED` as a reject/idle hybrid
- fabricated `IDLE_REASON` as a code (ignored or schema-fail)

Unknown enum / unknown property / missing field use `MALFORMED` with exit 1 (not a per-candidate reject when the whole document is invalid).

---

## Freeze Decision 21 — Board ↔ sidecar hash contract

### 21.1 Occupancy subset object

Exact object (key names, types):

```json
{
  "governance": { "owner": "<NONE|TaskId>", "state": "<UNOWNED|ACTIVE>" },
  "lane3": "DISABLED",
  "maxImplementationLanes": 2,
  "occupancy": {
    "lane1": { "state": "<EMPTY|ACTIVE|LANE-DONE>", "taskId": "<NONE|TaskId>" },
    "lane2": { "state": "<EMPTY|ACTIVE|LANE-DONE>", "taskId": "<NONE|TaskId>" }
  },
  "saturationSuspended": true,
  "schemaVersion": 1,
  "suspensionReason": "<NONE|OS_MUTATION>"
}
```

Board block facts are parsed into this object. Sidecar contributes the same fields. Detailed mutexes/writePaths are **not** in this subset.

### 21.2 CanonicalJson (PowerShell 5.x must implement; do **not** use `ConvertTo-Json` for hashing)

```
CanonicalJson(value):
  null                         forbidden
  boolean                      "true" | "false"
  integer                      InvariantCulture decimal digits, no exponent
  string                       JSON string per RFC 8259:
                                 escape ", \, and control chars U+0000–U+001F as \u00XX
                                 do NOT escape /
                                 non-control Unicode as UTF-8 in the string body
  array                        "[" + join(",", CanonicalJson(el) in stored order) + "]"
  object                       keys sorted lexicographically (ordinal, case-sensitive)
                               "{" + join(",", '"' key '":' CanonicalJson(val)) + "}"
```

UTF-8, no BOM, no insignificant whitespace, no trailing commas.

`occupancyHash` = lowercase hex SHA256 of UTF-8 bytes of `CanonicalJson(occupancySubset)`.

Board field format: `occupancyHash=sha256:<64hex>`.

**Commit SHA is never the occupancy hash.**

### 21.3 Three-way compare

```
H_board_field   = parse occupancyHash from TASKS block
H_board_facts   = SHA256(CanonicalJson(subset from TASKS block))
H_sidecar_facts = SHA256(CanonicalJson(subset from sidecar))

if H_board_field != H_board_facts:     exit 3   (fixture 46)
if H_board_facts != H_sidecar_facts:   exit 3   (fixture 47)
```

TASKS changed / sidecar not, or sidecar changed / TASKS not → exit 3.

### 21.4 Dirty working tree

Validator reads **working-tree files**, not `git show HEAD:...`.

```
headSha           = git rev-parse HEAD  (if git fails: "UNKNOWN")
workingTreeDirty  = git status --porcelain nonempty (if git fails: true)
```

Dirty tree does **not** fail validation by itself. Governance writes are initially dirty before Keith commits. The validator must work on dirty trees. Do not require a clean HEAD. Do not hash commit SHA as occupancy.

Read-only git inspection only.

### 21.5 sidecarSha256 / mutexCatalogSha256

Parse JSON, emit CanonicalJson of the full object (object keys sorted; arrays preserved), SHA256 hex. Used in the proof `inputHashes` only.

---

## Freeze Decision 22 — Proof artifact

**Persist** `C:\Users\knlee\aiSandBox2026B\docs\control-plane\SATURATION_PROOF.json`.

Proof is derived output. Zero scheduler authority. Stale proof cannot satisfy lock. Validator must **recompute** from state; it must not accept a stored PASS as authority.

### 22.1 Proof schema — required properties exactly

```text
schemaVersion                    integer 1
result                           "PASS" | "FAIL"
exitCode                         integer 0|1|2|3|4|5
idleCode                         idle enum or "NONE"
admissibleForcingCandidates      array of TaskId (sorted)
rejectedCandidates               array of {taskId, code} sorted by taskId
inputHashes                      object
headSha                          40-hex or "UNKNOWN"
workingTreeDirty                 boolean
```

`inputHashes` required properties exactly:

```text
occupancyHash         64 lowercase hex (no sha256: prefix)
sidecarSha256         64 lowercase hex
mutexCatalogSha256    64 lowercase hex
```

No `timestamp`. No prose reason field.

Unknown proof property: ignore the existing file (it is output). Do not use it as input.

### 22.2 Write policy

- Exit 1 (schema/io): do **not** overwrite the proof file; stdout is an error object with `result=FAIL`, `exitCode=1`, `errorCode=MALFORMED` (or `IO`).
- Exit 0/2/3/4/5: overwrite proof with the freshly derived object; stdout is that same JSON.

### 22.3 Stale proof (fixture 48)

A pre-existing proof with non-matching `inputHashes` and `result=PASS` must **not** cause a PASS if current state violates saturation. Validator recomputes. Current 0/2 + admissible FORCING → exit 2 even if stale proof said PASS.

Lock evidence = freshly derived proof whose `inputHashes` match the current working-tree inputs **and** validator exit 0.

---

## Freeze Decision 23 — Validator interface

Windows PowerShell 5.x only. No PowerShell 7-only syntax. No Pester. No YAML module. No `??`. No `?.`.

### 23.1 User command

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.ps1"
```

### 23.2 Parameters (all optional)

```powershell
param(
  [string]$RepoRoot    = (Split-Path -Parent $PSScriptRoot),
  [string]$TasksPath   = (Join-Path $RepoRoot "TASKS.md"),
  [string]$StatePath   = (Join-Path $RepoRoot "docs\control-plane\lane-saturation-state.json"),
  [string]$CatalogPath = (Join-Path $RepoRoot "docs\control-plane\mutex-catalog.json"),
  [string]$ProofPath   = (Join-Path $RepoRoot "docs\control-plane\SATURATION_PROOF.json")
)
```

Fixture tests pass these paths into a fixture directory.

No `--force`. No `--ignore`. No `--ignore-saturation`. Presence of such a parameter = must not be implemented. Unknown bound parameters are not accepted.

### 23.3 Runtime preferences

```powershell
$ErrorActionPreference = 'Stop'
$WarningPreference     = 'Stop'
```

A warning is a fail, not a pass.

### 23.4 Exit codes

| Code | Meaning |
|---|---|
| 0 | SATURATED / IDLE_VALID (PASS) |
| 1 | malformed / schema / IO |
| 2 | saturation / pairwise invariant violation |
| 3 | board ↔ state / hash contradiction |
| 4 | capacity / Lane 3 invariant violation |
| 5 | OS mutation suspension violation |

Multiple would apply: first in algorithm order (schema 1 → capacity 4 → hash 3 → suspension 5 → pairwise/saturation 2). Hash after capacity so an enabled Lane 3 still reports 4 even if hashes also mismatch.

### 23.5 Stdout / stderr

- stdout: JSON proof or JSON error object only
- stderr: optional human one-liner; tests must not require stderr text

### 23.6 Test runner command

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.tests.ps1"
```

Optional `-RepoRoot`. Discovers `docs/control-plane/fixtures/<NN-*>/` directories. Exit 0 iff every fixture matches `expected.json`. No Pester.

---

## Freeze Decision 24 — Validation trigger points

The validator is a control-plane **POSTCONDITION** over proposed end state. It does not run workers. It does not admit.

### 24.1 Mandatory (machine-relevant)

Run against the **proposed resulting** sidecar + occupancy block **before** the control-plane write is treated as valid, for:

1. Newly registered implementation task (candidate record added)
2. Candidate field change: `saturationClass`, `status`, `startCondition`, `productClass`, `futureAuthorization`, `dependsOn`, `mutexes`, `writePaths`, `hotfiles`, `i18n`, `sharedContractIds`, `mutatesSharedContractIds`, `evidenceClass`, `exclusiveCapacity`, `runtimeNeeds`, `admissionUncertain`, `writeSetPrecision`, `nature`
3. Implementation admission (lane becomes ACTIVE)
4. Stage-start / exact write-set freeze
5. Mutex/resource acquire or release
6. Dependency readiness (`lockedTaskIds` change)
7. Shared-contract freeze or unfreeze
8. `LANE-DONE` (occupancy state change; lane still occupied)
9. Lane release (lane becomes EMPTY)
10. LOCK (lane EMPTY + `lockedTaskIds` add)
11. REJECTED
12. RETURN-TO-READY
13. Beginning OS mutation (`saturationSuspended=true`)
14. Ending OS mutation (`saturationSuspended=false`)

### 24.2 LANE-DONE

`LANE-DONE` is occupied. Capacity is not freed. `S` is evaluated against that occupied end state. If the other lane is EMPTY and a FORCING candidate remains admissible, idle is invalid.

### 24.3 Not mandatory

Pure `Previous:` prose appends that do not change the occupancy block or sidecar. Historical flags-fence snapshots. Chat. Roadmap.

If occupancy block, sidecar, catalog, or proof-input hashes cannot have changed, ceremony validation is not required. When unsure whether machine state changed: run the validator.

Workers must not update machine state and must not self-satisfy saturation by editing sidecar.

---

## Freeze Decision 25 — Registration workflow after GOV-OS-03 LOCK

When registering a **new implementation** task:

1. Register the canonical task body in `TASKS_BACKLOG_FULL.md`
2. Create/update the candidate record in `lane-saturation-state.json`
3. Explicitly set `saturationClass` to `FORCING` or `OPTIONAL` (no default)
4. Set `writeSetPrecision` `PROVISIONAL` or `EXACT`; if provisional, `admissionUncertain=true`
5. Set product/future/mutex/path fields structurally
6. Run the validator against the proposed resulting state (occupancy block hash updated if occupancy facts changed; candidate-only changes do not change occupancyHash)
7. The control-plane write **cannot validly complete** if the validator fails

Do **not** auto-admit. Do **not** auto-select. Do **not** invent work.

Governance tasks: no candidate record required.

Missing candidate record for a newly registered implementation task after GOV-OS-03 LOCK is a control-plane failure (cannot be represented as `S` membership; the registration workflow itself is invalid). v1 validator cannot grep the backlog for “implementation tasks without records” (that would be NLP). Enforcement is: control-plane workflow + CLAUDE.md duty + Step 4 process. After lock, any implementation task the control plane **does** place on a lane must have a candidate (occupied-without-candidate = `UNREGISTERED`).

---

## Freeze Decision 26 — Stage-start revalidation

Stage-start may refine `writePaths`, `hotfiles`, `mutexes`, `sharedContractIds`, `mutatesSharedContractIds`, `admissionUncertain`, and must set `writeSetPrecision=EXACT`.

Stage-start **must** re-run the validator against proposed end occupancy.

- If the exact write-set makes a formerly admissible Lane 2 candidate unsafe: idle may become valid.
- If the exact write-set makes another FORCING candidate safely admissible: leaving capacity idle becomes invalid.

---

## Freeze Decision 27 — GOV-OS-02 boundary

```
NO REGISTERED FORCING CANDIDATE SAFELY ADMISSIBLE
=> GOV-OS-03 PERMITS IDLE
=> GOV-OS-03 DOES NOT SEARCH ROADMAP / CHAT / FUTURE / MEMORY
=> IF GENUINELY NEW PRODUCT/ARCHITECTURE WORK MUST BE SELECTED
   THEN GOV-OS-02 NEXT-WORK SELECTION PROTOCOL APPLIES
```

No second scheduler. GOV-OS-03 never invents successors. Empty `S` is valid. Filling a lane merely to reach 2/2 is forbidden.

---

## Freeze Decision 28 — Current installation seed

Step 3 real-tree install:

```
candidates = []
lockedTaskIds = []
sharedContracts = []
runtimeAuthorization all false
lanes EMPTY/EMPTY
lane3 DISABLED
maxImplementationLanes 2
saturationSuspended true
suspensionReason OS_MUTATION
governance owner GOV-OS-03 / ACTIVE
```

Do **not** seed: Delete UI, invitation work, historical “next recommended”, chat ideas, roadmap tasks, SAFE_TWO_LANE_PAIR ideas, PRIVATE-BETA-INVITE-01.

`INITIAL_FORCING_CANDIDATES=NONE`.

First real-tree proof while GOV-OS-03 is still mutating the OS:

```
result=PASS
idleCode=OS_MUTATION_QUIESCENCE
admissibleForcingCandidates=[]
exitCode=0
```

That is correct. After GOV-OS-03 LOCK clears suspension with candidates still empty:

```
idleCode=NO_FORCING_CANDIDATES
```

That is also correct.

---

## Freeze Decision 29 — CLAUDE.md exact Step 3 change

Step 3 may edit `CLAUDE.md` **only** as specified here. No unrelated rewrite.

### 29.1 Insert point A

Immediately **after** the `### Admission rules` section (after the sentence `If uncertain whether two tasks are independent: **DO NOT ADMIT THEM CONCURRENTLY.**`) and **before** `### Shared-contract freeze / change protocol`, insert the following section **verbatim**:

```markdown
### Fail-closed lane saturation (GOV-OS-03)

`TASKS.md` remains the only scheduler. The machine sidecar `docs/control-plane/lane-saturation-state.json` is not a scheduler and cannot admit, rank, select, or invent tasks.

After GOV-OS-03 LOCK, every newly registered implementation task must have a machine candidate record with an explicit `saturationClass` of `FORCING` or `OPTIONAL`. There is no default. Missing classification fails closed. Historical tasks are not mass-migrated. Governance tasks are not implementation candidates.

The validator `scripts/validate-lane-capacity.ps1` is a proof checker over proposed END occupancy. It derives admissibility and idle result. It does not select tasks. Agent-written `IDLE_REASON`, `SAFE_TWO_LANE_PAIR`, `NOT_NEEDED`, and `UNRESOLVED` prose is not authoritative. Historical `Previous:` / `ACTIVE` text is not occupancy.

Mandatory postcondition (when saturation is not suspended):

FREE IMPLEMENTATION LANE AND nonempty set S of safely admissible FORCING candidates = proposed control-plane end state is invalid.

If S is empty, idle implementation capacity is valid. Safety outranks saturation. Maximum implementation lanes remains 2. Lane 3 remains DISABLED.

Always evaluate pairwise safety against proposed END occupancy, not only against an empty board.

The validator is mandatory at machine-relevant control-plane transitions (implementation registration, candidate classification/status/write-set changes, admission, stage-start, mutex acquire/release, dependency LOCK proof changes, shared-contract freeze/unfreeze, LANE-DONE, lane release, LOCK, REJECTED, RETURN-TO-READY, begin/end OS mutation). It is a postcondition over proposed end state. Workers cannot update machine state, occupancy block, sidecar, catalog, or proof.

During an active Development OS mutation, saturation is suspended, implementation lanes must be zero, and idle is required (`OS_MUTATION_QUIESCENCE`). When suspension ends, the normal saturation postcondition applies immediately.

If no registered FORCING candidate is safely admissible, GOV-OS-03 permits idle and does not search roadmap, chat, or FUTURE. Genuinely new product/architecture selection remains GOV-OS-02 Next-Work Selection Protocol. GOV-OS-03 never invents work.
```

### 29.2 Insert point B

In `### Lean future registration metadata`, after the bullet list that ends with `Revert isolation`, insert these bullets:

```markdown
- saturationClass (`FORCING` or `OPTIONAL`; mandatory for newly registered implementation tasks after GOV-OS-03 LOCK; no default)
- machine candidate record in `docs/control-plane/lane-saturation-state.json` (implementation tasks only; not a scheduler)
```

Also after `Do not mass-migrate historical tasks onto this template.` keep that sentence unchanged and do not add a historical backfill requirement.

No other `CLAUDE.md` edits in Step 3.

---

## Freeze Decision 30 — AGENTS.md

**No Step 3 change to `AGENTS.md`.**

`AGENTS.md` already directs agents to `CLAUDE.md`, the TASKS board, and the backlog, and already forbids workers from modifying scheduler/governance files. Duplicating saturation rules would create a second rulebook. YAGNI.

---

## Freeze Decision 31 — Test architecture

No Pester. Dependency-free Windows PowerShell 5.x runner: `scripts/validate-lane-capacity.tests.ps1`.

### 31.1 Fixture directory

```
C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\<NN-slug>\
```

Discovery: child directories whose names match `^[0-9]{2}-`. Sorted by directory name. No `_`-prefixed fixture dirs required.

### 31.2 Files per fixture

Required:

- `expected.json`
- `lane-saturation-state.json`
- `TASKS.md` (minimal stub containing the occupancy block and the LEGACY / FROZEN line)

Optional:

- `mutex-catalog.json` (else use repo `docs/control-plane/mutex-catalog.json`)
- `SATURATION_PROOF.json` (pre-existing proof for stale-proof tests)

### 31.3 `expected.json` required

```text
exitCode     integer
result       "PASS" | "FAIL"
```

Optional:

```text
idleCode                        string
admissibleForcingCandidates     array of TaskId
rejectedByTaskId                object map TaskId -> reject code
errorCode                       string (exit 1)
```

Runner compares exit code, result, idleCode if present, set equality of `admissibleForcingCandidates` if present, and listed `rejectedByTaskId` codes if present. Do not require exact stdout `message` text. Do not require `headSha` equality.

### 31.4 Runner behavior

For each fixture, invoke `validate-lane-capacity.ps1` with `-RepoRoot` unused for path override; pass `-TasksPath`, `-StatePath`, `-CatalogPath`, `-ProofPath` pointing at the fixture (ProofPath may be a temp copy so the repo proof is not clobbered). `$LASTEXITCODE` vs expected.

Print one line per fixture: `PASS NN-slug` or `FAIL NN-slug expected=X actual=Y`. Final exit 0 only if all pass.

---

## Mandatory fixture matrix (frozen)

Step 3 must implement **all** of these. Do not drop coverage.

| NN | Slug | Assert |
|---|---|---|
| 01 | `01-zero-of-two-no-forcing` | 0/2, candidates `[]` (or OPTIONAL-none), not suspended → PASS `NO_FORCING_CANDIDATES` exit 0 |
| 02 | `02-zero-of-two-one-forcing` | 0/2, one admissible FORCING → FAIL exit 2; `S` contains that id |
| 03 | `03-one-of-two-s-empty` | 1/2 occupied ADMITTED LOCAL-TESTS; no other FORCING candidates → PASS `NO_FORCING_CANDIDATES` exit 0 |
| 04 | `04-one-of-two-s-nonempty` | 1/2, S nonempty → FAIL exit 2 |
| 05 | `05-two-of-two-capacity-full` | 2/2 disjoint co-admissible → PASS `CAPACITY_FULL` exit 0 |
| 06 | `06-lane3-enabled` | `lane3` not `DISABLED` → FAIL exit 4 |
| 07 | `07-max-lanes-not-2` | `maxImplementationLanes=3` → FAIL exit 4 |
| 08 | `08-pairwise-conflict-a-occupied-idle-valid` | A and B each safe vs empty, conflict together; end A/EMPTY → PASS; B not in S |
| 09 | `09-pairwise-co-admissible-a-occupied-fail` | A and B co-admissible; end A/EMPTY → FAIL exit 2; S contains B |
| 10 | `10-occupied-a-makes-b-unsafe` | Occupied A mutex/path makes B unsafe; 1/2 PASS |
| 11 | `11-two-disjoint-local-tests` | Two disjoint LOCAL-TESTS occupy both lanes → PASS `CAPACITY_FULL` |
| 12 | `12-gateway-vs-gateway` | GATEWAY vs GATEWAY → not co-admissible; 1/2 with second FORCING GATEWAY → PASS (B rejected `MUTEX_CONFLICT`) |
| 13 | `13-frontend-overlap` | FRONTEND path overlap → `WRITE_SCOPE_CONFLICT` or `MUTEX_CONFLICT` |
| 14 | `14-parent-child-write-path` | `frontend/` vs `frontend/app/page.tsx` → `WRITE_SCOPE_CONFLICT` |
| 15 | `15-hotfile-collision` | Same hotfile → `HOTFILE_CONFLICT` |
| 16 | `16-windows-case-insensitive-path` | `Frontend/App/Page.tsx` vs `frontend/app/page.tsx` → conflict |
| 17 | `17-slash-normalization` | `frontend\\app\\page.tsx` vs `frontend/app/page.tsx` → conflict |
| 18 | `18-i18n-vs-i18n` | I18N vs I18N → `I18N_CONFLICT` |
| 19 | `19-i18n-vs-zh-cn-only` | I18N vs candidate touching only zh-CN.json with valid I18N metadata → `I18N_CONFLICT` |
| 20 | `20-locale-without-i18n-metadata` | touches locale file but `i18n=false` / I18N mutex omitted → exit 1 `MALFORMED` |
| 21 | `21-dependency-locked` | `dependsOn` id ∈ `lockedTaskIds`; 0/2 one FORCING → FAIL (eligible) |
| 22 | `22-dependency-not-locked` | dependsOn missing from lockedTaskIds → not in S `DEPS_UNSATISFIED`; 0/2 with only that FORCING → PASS `NO_PAIRWISE_ADMISSIBLE_CANDIDATE` |
| 23 | `23-missing-dependency-proof` | omit `lockedTaskIds` property → exit 1 |
| 24 | `24-shared-contract-frozen` | both depend on FROZEN contract, disjoint paths LOCAL-TESTS → co-admissible 2/2 PASS |
| 25 | `25-shared-contract-unfrozen` | depend on UNFROZEN → `SHARED_CONTRACT_UNFROZEN`; not in S |
| 26 | `26-active-depends-candidate-mutates` | occupied depends on contract; candidate mutates it → reject `SHARED_CONTRACT_UNFROZEN` |
| 27 | `27-local-tests-plus-local-tests` | compatible; 2/2 PASS |
| 28 | `28-local-runtime-plus-local-runtime` | incompatible → not 2/2; 1/2 with second LOCAL-RUNTIME FORCING PASS (rejected) |
| 29 | `29-staging-runtime-plus-other` | STAGING-RUNTIME + LOCAL-TESTS → reject other; 1/2 PASS |
| 30 | `30-provider-live-plus-other` | PROVIDER-LIVE + other → reject other; 1/2 PASS |
| 31 | `31-credit-conflict` | CREDIT vs CREDIT → `CREDIT_CONFLICT` |
| 32 | `32-local-runtime-conflict` | LOCAL-RUNTIME mutex vs LOCAL-RUNTIME → `RUNTIME_INCOMPATIBLE` |
| 33 | `33-exclusive-capacity-occupied` | occupied exclusiveCapacity; second FORCING otherwise safe → not in S; 1/2 PASS `EXCLUSIVE_CAPACITY_HELD` |
| 34 | `34-optional-ready-does-not-force` | OPTIONAL READY admissible-except-class; 0/2 PASS `NO_FORCING_CANDIDATES`; rejected `NOT_FORCING` |
| 35 | `35-parked-not-admissible` | PARKED FORCING; 0/2 PASS; `PARKED` |
| 36 | `36-prohibited-not-admissible` | PROHIBITED FORCING; 0/2 PASS; `PROHIBITED` |
| 37 | `37-unregistered-id` | occupied taskId with no candidate → exit 1 `UNREGISTERED` |
| 38 | `38-duplicate-candidate-id` | two candidates same taskId → exit 1 `DUPLICATE_ID` |
| 39 | `39-unauthorized-future` | APPROVED_FUTURE + futureAuthorization NONE + FORCING READY; 0/2 PASS; `FUTURE_NOT_AUTHORIZED` |
| 40 | `40-governance-nature` | nature GOVERNANCE in candidates; 0/2 PASS; `GOVERNANCE_NATURE` |
| 41 | `41-admission-uncertain` | FORCING READY but admissionUncertain true; 0/2 PASS; `ADMISSION_UNCERTAIN` |
| 42 | `42-missing-saturation-class` | omit saturationClass → exit 1 `MALFORMED` |
| 43 | `43-missing-required-json-field` | omit a required sidecar field → exit 1 |
| 44 | `44-unknown-enum` | e.g. evidenceClass `FOO` → exit 1 |
| 45 | `45-unknown-property` | extra JSON property → exit 1 |
| 46 | `46-tasks-occupancy-hash-mismatch` | occupancyHash field ≠ hash(board facts) → exit 3 |
| 47 | `47-sidecar-occupancy-mismatch` | board subset ≠ sidecar subset → exit 3 |
| 48 | `48-stale-proof-not-authority` | stale proof PASS + current 0/2 one FORCING → FAIL exit 2 (proof ignored) |
| 49 | `49-fabricated-idle-reason-prose` | TASKS prose `IDLE_REASON=...` outside block; 0/2 one FORCING → FAIL exit 2 |
| 50 | `50-safe-two-lane-pair-zero-effect` | prose `SAFE_TWO_LANE_PAIR=YES` and `=NO`; neither changes S; 1/2 S nonempty still FAIL; 0/2 no FORCING still PASS |
| 51 | `51-historical-previous-active-zero-effect` | `Previous: ACTIVE` in board prose; occupancy EMPTY; no FORCING → PASS |
| 52 | `52-historical-backlog-active-zero-effect` | `ACTIVE` text below LEGACY / FROZEN; occupancy EMPTY; no FORCING → PASS |
| 53 | `53-os-mutation-zero-lanes-pass` | saturationSuspended true + 0 occupied → PASS `OS_MUTATION_QUIESCENCE` (even if FORCING would otherwise fill) |
| 54 | `54-os-mutation-occupied-lane-fail` | saturationSuspended true + occupied lane → FAIL exit 5 |
| 55 | `55-clearing-suspension-forcing-free-lane-fail` | saturationSuspended false, 0/2, one admissible FORCING → FAIL exit 2 |
| 56 | `56-private-beta-invite-01-never-s` | candidate `PRIVATE-BETA-INVITE-01` FORCING READY CURRENT; 0/2 PASS; `PROHIBITED`; not in S |

### Additional adversarial fixtures (required, do not drop)

| NN | Slug | Assert |
|---|---|---|
| 57 | `57-glob-writepath-malformed` | writePaths contains `frontend/**` → exit 1 |
| 58 | `58-lane-done-occupies-capacity` | Lane1 LANE-DONE + FORCING admissible vs that occupancy for Lane2 → FAIL exit 2 |
| 59 | `59-zero-of-two-conflicting-pair-still-fail` | A and B conflict together but each safe vs empty; 0/2 → FAIL exit 2 |
| 60 | `60-provisional-without-uncertain` | writeSetPrecision PROVISIONAL and admissionUncertain false → exit 1 |
| 61 | `61-exclusive-candidate-other-occupied` | Lane1 occupied non-exclusive; candidate exclusiveCapacity true → not in S; 1/2 PASS `EXCLUSIVE_CAPACITY_HELD` or `NO_PAIRWISE_ADMISSIBLE_CANDIDATE` per DeriveIdle (occupied exclusiveCapacity is false → `NO_PAIRWISE_ADMISSIBLE_CANDIDATE`) |
| 62 | `62-unknown-mutex-id` | mutexes contains `WIDGET` → exit 1 |

Fixture 50 may be implemented as two expected files in one directory (runner supports `expected.json` only). Freeze: one directory is sufficient if it encodes `SAFE_TWO_LANE_PAIR=YES` in prose with 1/2 S nonempty → FAIL. The `=NO` zero-effect on valid idle is covered by 01 plus prose. Document in fixture README is not required (YAGNI). Fixture 50 TASKS stub includes both YES and NO strings.

**Fixture count: 62.** All 56 mandatory user rows plus 6 adversarial.

---

## Step 3 real-tree sidecar seed (exact)

Step 3 must install this semantic content (CanonicalJson key order will sort):

```json
{
  "schemaVersion": 1,
  "maxImplementationLanes": 2,
  "lane3": "DISABLED",
  "saturationSuspended": true,
  "suspensionReason": "OS_MUTATION",
  "governance": {
    "owner": "GOV-OS-03",
    "state": "ACTIVE"
  },
  "occupancy": {
    "lane1": {
      "state": "EMPTY",
      "taskId": "NONE",
      "mutexes": [],
      "writePaths": [],
      "hotfiles": [],
      "i18n": false,
      "evidenceClass": "NONE",
      "exclusiveCapacity": false,
      "sharedContractIds": [],
      "mutatesSharedContractIds": [],
      "runtimeNeeds": []
    },
    "lane2": {
      "state": "EMPTY",
      "taskId": "NONE",
      "mutexes": [],
      "writePaths": [],
      "hotfiles": [],
      "i18n": false,
      "evidenceClass": "NONE",
      "exclusiveCapacity": false,
      "sharedContractIds": [],
      "mutatesSharedContractIds": [],
      "runtimeNeeds": []
    }
  },
  "candidates": [],
  "lockedTaskIds": [],
  "sharedContracts": [],
  "runtimeAuthorization": {
    "localRuntimeAuthorized": false,
    "stagingAuthorized": false,
    "providerLiveAuthorized": false,
    "creditAuthorized": false
  }
}
```

Occupancy subset CanonicalJson (authoritative string for hash):

```text
{"governance":{"owner":"GOV-OS-03","state":"ACTIVE"},"lane3":"DISABLED","maxImplementationLanes":2,"occupancy":{"lane1":{"state":"EMPTY","taskId":"NONE"},"lane2":{"state":"EMPTY","taskId":"NONE"}},"saturationSuspended":true,"schemaVersion":1,"suspensionReason":"OS_MUTATION"}
```

SHA256 hex:

```text
1d66e7a2cfdfd05c661d3e05181694384138c77413b26e318946f82d88dca3a0
```

Board `occupancyHash=sha256:1d66e7a2cfdfd05c661d3e05181694384138c77413b26e318946f82d88dca3a0`

---

## Step 3 mutex-catalog seed (semantic)

Install `mutexes` covering every id in Freeze Decision 8 with the prefixes/files/matchers listed there. `schemaVersion=1`. No extra ids.

---

## Step 3 exact write set (frozen)

MAY/MUST write:

1. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\lane-saturation-state.json`
2. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\mutex-catalog.json`
3. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\SATURATION_PROOF.json`
4. `C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.ps1`
5. `C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.tests.ps1`
6. `C:\Users\knlee\aiSandBox2026B\docs\control-plane\fixtures\**` (62 fixture directories + their files)
7. `C:\Users\knlee\aiSandBox2026B\TASKS.md` (occupancy block install + GOV-OS-03 lifecycle)
8. `C:\Users\knlee\aiSandBox2026B\CLAUDE.md` (Freeze Decision 29 only)
9. `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` (GOV-OS-03 lifecycle / AC only)

MUST NOT write: `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, application source, Git hooks, Git commits.

---

## Step 3 authorization gate

```
STEP3_AUTHORIZED=NO until Keith commits this Step 2 freeze
```

Step 3 worker must refuse to start if this document is not in the committed tree the worker was launched against.

---

## Invitation / Lane 3 / capacity invariants (unchanged)

- `PRIVATE-BETA-INVITE-01` remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
- `INVITATION_EXECUTION_PERMITTED=NO`
- Lane 3 remains DISABLED
- `MAX_IMPLEMENTATION_LANES=2`
- GOV-PARALLEL-01 `LANE3_DECISION=KEEP_DISABLED_UNTIL_FUTURE_MATERIAL_NEED` unchanged
- No Git hook in v1
- No subagents required or authorized for Step 3 by this freeze
- No Docker / PostgreSQL / Redis / staging / provider / browser / migrations / dependency changes

---

## Unresolved design decisions

```
UNRESOLVED_DESIGN_DECISIONS=0
```

All 31 freeze decisions are resolved. No TBD. No TODO. No “Step 3 may choose”.

---

## Step 2 non-implementation confirmation

This freeze document is markdown only. After Step 2:

- occupancy block not installed in `TASKS.md`
- `docs/control-plane/` directory not created
- validator not created
- fixtures not created
- `CLAUDE.md` / `AGENTS.md` unchanged
