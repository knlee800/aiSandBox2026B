# pm2-recovery-verify — offline dual-field PM2 environment comparison verifier

**Task:** PM2-RECOVERY-VERIFY-01 (bounded comparison-only verifier; IMPLEMENTATION).
**Contract:** `docs/PM2-RECOVERY-VERIFY-01-STAGE-START.md` (frozen; this file summarises, it does not override).
**Status:** **NOT APPROVED FOR LIVE USE** until the task is LOCKED **and** a P6 procedure is separately
authorized. Step 3 wrote this tool; its behaviour has not been verified until the Step 4 fake-only run is green.

## 1. Purpose

`compare_dual_env.py` compares, for every app and key named in an explicitly supplied **reference**
document, the two PM2 fields `pm2_env[k]` and `pm2_env.env[k]` of an explicitly supplied **observation**,
preserving the distinction between `SET`, `EMPTY` (`""`) and `ABSENT` (member missing), and reporting
cross-field **divergence** (`pm2_env[k] ≠ pm2_env.env[k]`, the latent-overlay indication).

It is a **comparison core only**:

- no PM2 client, no `subprocess`, no socket, no network, no `argparse`, stdlib only (Python ≥ 3.8 syntax);
- reads exactly its input files (`O_RDONLY|O_NOFOLLOW`, plus `O_NONBLOCK` where defined so a FIFO cannot
  block the open; regular files only — anything else is `INPUT_UNREADABLE`; read once, ≤ 16 MiB each) and writes only the
  two optional output files requested on the command line, created exclusively (`O_CREAT|O_EXCL|O_NOFOLLOW`,
  mode `0600`) **before any input is read**, refusing to overwrite (`OUTPUT_EXISTS`), and removed on a
  later failure **only if this invocation created them**;
- never reads a vault, journal, marker, `dump.pm2`, `/opt/aisandbox/.env`, or any PM2 home file.

## 2. Non-claims (constant in every outcome, including `INTERNAL_ERROR`)

```json
{ "restoration_success": false, "command_fate_known": false, "fence_proof": "NONE", "host_clean": false,
  "policy_satisfied": false, "permission_to_run": false, "reference_authority_verified": false,
  "acquisition_side_effect_free": false, "observation_authenticated": false,
  "note": "A MATCH is comparison evidence only." }
```

A `MATCH` is evidence only. The tool never states that restoration succeeded, that a command's fate is
known, that a fence exists, that the host is CLEAN, that a policy is satisfied, that a run is permitted,
that the reference is authoritative or approved (A1 / A2 remain OPEN; `reference.authority` is always
`"NOT_EVALUATED_BY_VERIFIER"`), that acquisition was side-effect-free, or that the host / daemon / operator /
capture time were authenticated. No input member, flag, or environment variable can change this.

## 3. Modes

| Mode | Invocation | Observation source | `jlist_sha256` |
|---|---|---|---|
| **A** | `--reference R --observation-meta M --jlist J [--report P] [--emit-observation N] [--max-age-seconds S]` | raw `pm2 jlist` JSON file, normalized in-process | **verified**: the SHA-256 of the exact bytes read and parsed must equal `M.jlist_sha256` (`JLIST_HASH_MISMATCH` otherwise); report `observation.jlist_hash_verified=true`, `source="RAW_JLIST"` |
| **B** | `--reference R --observation N [--report P] [--max-age-seconds S]` | normalized observation (schema `aisb.pm2-dual-env-observation.v1`, e.g. emitted earlier by Mode A) | **declared only** — no raw bytes are present, so the hash cannot be verified; report `jlist_hash_verified=false`, `source="NORMALIZED"` |

Neither mode authenticates the host, daemon, operator, or capture time: identity and freshness checks
compare **declared** strings and integers. `--help` prints fixed usage text and exits 2 without reading
any input. Any other flag combination, repeated flag, missing value, or non-integer / negative
`--max-age-seconds` is `USAGE` (exit 2); the supplied argument text is never repeated.

Mode B re-applies every check (strict schema, protected-name rule, field shape, `reference_id` / key set /
protected-flag equality with the reference, `captured_at ≤ normalized_at + 300 s` (the same
future-skew allowance Mode A applies to `captured_at`, so a Mode A run that accepted a slightly
future-skewed capture round-trips into Mode B), identity, freshness). A
normalized record edited after emission cannot be detected.

## 4. Schemas (summary; exact rules in the stage-start §4)

- **Reference** `aisb.pm2-dual-env-reference.v1`: `reference_id`, `host`, optional `pm2_home` / `daemon_pid` /
  `valid_from` / `valid_until`, `provenance` (`declared_by`, `source_kind` ∈ `INTENT_DECLARATION |
  OBSERVATION_ADOPTED_BY_DECISION | OTHER`, `source`, `declared_at`, `authorization_record`), and `apps.<app>.keys.<KEY>`
  = `{ protected, pm2_env: {state, value|token}, "pm2_env.env": {state, value|token} }`. `protected` is required.
  `SET` + non-protected → exactly a non-empty `value`; `SET` + protected → exactly a `token` (`sha256:<64 hex>`);
  `EMPTY` / `ABSENT` → no payload. Both field expectations of a key must be identical
  (`REFERENCE_FIELDS_INCONSISTENT`). Key names in the always-protected set or matching a protected fragment
  cannot be declared `protected=false`. The key name `env` is reserved.
- **Observation meta** `aisb.pm2-dual-env-observation-meta.v1` (Mode A): `observation_id`, `host`, optional
  `pm2_home` / `daemon_pid`, `captured_at`, `captured_by`, `acquisition_record`, `jlist_sha256`.
- **Raw `pm2 jlist`** (Mode A; PM2-owned shape, no `UNKNOWN_FIELD` check): a JSON array of objects, each with a
  string `name`; selected apps must carry an object `pm2_env` whose member `env` is an object. Unrelated processes
  and unrelated environment members are not read, classified, tokenized, or reported. An element without a
  string `name` is rejected (`JLIST_ITEM_NAME_MISSING`).
- **Normalized observation** `aisb.pm2-dual-env-observation.v1` (Mode A `--emit-observation` output; Mode B input):
  the meta members plus `normalized_at`, `reference_id`, and an `apps` block in the reference shape holding
  states, non-protected values, and **tokens** for protected keys. This is a **RESTRICTED** record (see §6).
- **Report** `aisb.pm2-dual-env-comparison-report.v1` (stdout; optional `--report` file): `tool`
  (`self_sha256` of the running module), `evaluated_at`, `result`, `exit_code`, `mode`, `reference` /
  `observation` identifier blocks (a member is `null` unless it was read **and** passed validation),
  `identity` / `freshness` check flags, `apps` (per key: `protected`, `result`, `divergent`, both fields with
  `expected_state`, `observed_state`, `field_result`, and — for non-protected `SET` fields only —
  `expected_value` / `observed_value`, display-truncated at 256 characters with `observed_value_truncated`),
  `counts`, `errors[]` (`code`, JSON-pointer `path`, fixed `detail`), `non_claims`.

Timestamps are exactly `YYYY-MM-DDTHH:MM:SSZ`. Strict UTF-8 without BOM; duplicate object member names are refused
at any depth; unknown members in verifier-owned schemas are refused (an `"approved": true` member is an error,
not an authorization).

## 5. Results and exit codes

| `result` | Exit | Meaning (and only this meaning) |
|---|---|---|
| `MATCH` | 0 | every named key in every named app matched the reference on both fields at the declared capture time — evidence only |
| `MISMATCH` | 3 | at least one key differs from the reference; no key is divergent |
| `DIVERGENT` | 4 | at least one key differs between `pm2_env[k]` and `pm2_env.env[k]` (latent overlay indication; never "close enough") |
| `INVALID_INPUT` | 2 | invocation, read / decode, schema, identity, freshness, observation-shape, or output-placement failure; nothing is compared; `apps` is `{}` |
| `INTERNAL_ERROR` | 1 | unexpected exception; minimal JSON report with `error_type` (class name only) plus one stderr line |

Per field: `MATCH` iff states are equal and, for `SET`, the value (non-protected) or token (protected) is equal.
Per key: `DIVERGENT` if the two observed fields differ in state or value / token (reported even if one field
matches the reference); else `MATCH` only if both fields match; else `MISMATCH`. Precedence at app and
aggregate level: `DIVERGENT` > `MISMATCH` > `MATCH`. Exit 0 composes with `set -e`; it is not a success claim.

Identity / freshness (both modes): `HOST_MISMATCH`; `pm2_home` / `daemon_pid` declared by the reference must be
present and equal in the observation (`*_MISSING_IN_OBSERVATION`, `*_MISMATCH`); `captured_at` inside
`[valid_from, valid_until]` when declared; `captured_at` more than 300 s after `evaluated_at` →
`OBSERVATION_IN_FUTURE` (always applied); `--max-age-seconds N` → `OBSERVATION_STALE` when older.

Stderr summary line:
`PM2_DUAL_ENV_COMPARE result=<R> exit=<n> mode=<A|B|-> apps=<a> keys=<k> match=<m> mismatch=<x> divergent=<d> reference=<id|-> observation=<id|-> evidence_only=true`.

## 6. Redaction and output classes

The report, the stderr line, every error record, and the `INTERNAL_ERROR` output reproduce **only**: validated
identifier fields (`reference_id`, `observation_id`, `host`, `daemon_pid`, timestamps, `jlist_sha256`,
`provenance.source_kind`, reference-declared app / key names), non-protected `SET` values of reference-declared
keys, and fixed diagnostic text. They never contain: protected values or tokens, free-text metadata
(`declared_by`, `source`, `authorization_record`, `captured_by`, `acquisition_record`), `pm2_home`, unknown
member names (replaced by `<unknown-member>` / `<invalid-identifier>` in JSON pointers), filesystem paths,
CLI argument text, raw document text, or OS / decoder / exception messages.

| Class | Artifacts | Handling |
|---|---|---|
| **A — publishable report** | stdout report, `--report` file, stderr line | may be attached to a P6 record after human review |
| **B — RESTRICTED normalized observation** | `--emit-observation` file | contains **tokens**; `0600`; operator ledger only; never uploaded, committed, pasted, or included in workflow artifacts |
| **C — input records** | reference, observation meta, raw jlist, normalized observation used as input | full provenance and raw environment; read-only to the tool; reviewed separately |

**Tokens** are `sha256:` + hex(SHA-256(UTF-8 value)). They are equality oracles: anyone holding a token can
confirm a guessed value, and low-entropy values are reversible by enumeration. They are unsalted by design
(comparison across independently authored records) and are therefore RESTRICTED material.

## 7. Acquisition prerequisite (not part of this tool; not authorized here)

Producing the raw `pm2 jlist` file is a **PM2 client invocation**: it connects to `rpc.sock`, may
auto-reconnect, has no request timeout in the PM2 client, and may auto-launch a daemon from the client's
environment if none answers. It is not side-effect-free and must be a separately authorized procedure carrying
its own P4 / P5 attestations, E1 / E2 ledger entries, and STAGING / PM2 authorizations. This tool verifies
only that the meta's `jlist_sha256` matches the bytes it read (Mode A); it cannot verify that `captured_at`,
`daemon_pid`, `pm2_home`, `captured_by`, or `host` are truthful, or that the daemon did not restart between
the read and the evaluation.

## 8. Files and transfer verification

```
ops/pm2-recovery-verify/
  compare_dual_env.py              the verifier (single stdlib-only file; the delivered artifact)
  tests/test_compare_dual_env.py   fake-only unittest suite (T1–T12)
  README.md                        this file
  SHA256SUMS                       sha256sum-format manifest of the four files above and .gitattributes
  .gitattributes                   * text eol=lf
.github/workflows/pm2-recovery-verify.yml   fake-only verification workflow (workflow_dispatch only)
```

Verify a copy with `cd ops/pm2-recovery-verify && sha256sum -c --strict SHA256SUMS`. The hash of
`compare_dual_env.py` is also recorded outside this directory in the task's governance records once Step 4
has run. Every file is LF; the manifest does not list itself.

## 9. Tests (fake-only; not run locally in Step 3)

`python3 -m unittest -v tests.test_compare_dual_env` from `ops/pm2-recovery-verify/` on the GitHub-hosted
runner (Python 3.12) via `.github/workflows/pm2-recovery-verify.yml`. The suite spawns only
`sys.executable`, uses synthetic `SENTINEL-NOT-A-SECRET-…` strings in every echo-prone position, and checks
static parity of the protected-name constants with the r3 bundle by AST inspection (no import of r3).
Green predecessor tests of PM2-OVERLAY-UNKNOWN-01 do not verify this tool.
