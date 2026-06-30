# AGENT-HARNESS-05C6 — Environment-Backed Feature Gate — CHECKPOINT

**Task ID:** AGENT-HARNESS-05C6
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-30
**Family:** AGENT-HARNESS
**Phase:** 5C
**Nature:** Backend Configuration / Secure Feature Gate / Rollback Readiness / No Activation

---

## 1. 05C4 Context

AGENT-HARNESS-05C4 (Controlled Harness Loop Activation Readiness Review) identified `enableToolLoop` as a **HIGH** severity finding:

> **Finding:** `enableToolLoop` is a compile-time constant in `harness-config.ts`.
> **Severity:** HIGH — activation is not controllable at deployment time without a code change; rollback is slow.
> **Required fix (05C6):** Back `enableToolLoop` and `enableBrowserSmoke` with environment variables, read at service startup, with safe `false` defaults.

05C6 resolves the **deployment-gate part only** of that HIGH finding — the tool-loop gate is now environment-backed with a secure `false` default and strict parsing. Identity entitlement (05C7) and execution-bound hardening remain outstanding prerequisites for any future controlled activation.

---

## 2. Objective

Implement a bounded slice that makes the tool-loop gate environment-backed with:
- Secure default of `false`.
- Strict parsing (no broad Boolean/string truthiness).
- Test coverage for all edge cases.
- Documented recreation-based rollback.

The deployed/runtime value must remain `false`. This task implements gate infrastructure only. It does not activate the harness.

---

## 3. Exact Files Changed During Implementation

| File | Change Type |
|------|-------------|
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | New file — parser, factory, and config export |
| `services/ai-service/src/agent-harness/config/agent-harness.config.spec.ts` | New file — 23 focused tests |
| `docker-compose.prod.yml` | Modified — added `AGENT_HARNESS_ENABLE_TOOL_LOOP` to ai-service environment block |
| `.env.example` | Modified — documented `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` |

No other source, test, package, Docker, frontend, database, or environment files were modified.
`services/ai-service/src/worker/worker.processor.ts` required no changes.

---

## 4. Parser and Factory Implementation Summary

### `parseStrictBooleanEnv(variableName, raw, defaultValue)`

A deterministic strict boolean parser that:
- Accepts the variable name (for error identification), raw string value (from environment), and a boolean default.
- Returns the resolved boolean.
- Trims whitespace before evaluation.
- Is case-insensitive for the two accepted values only.

### `createAgentHarnessConfigV1(env)`

A factory function receiving an environment object (`NodeJS.ProcessEnv` or equivalent):
- Calls `parseStrictBooleanEnv` for `AGENT_HARNESS_ENABLE_TOOL_LOOP` with default `false`.
- Returns a complete `AgentHarnessConfigV1` object.
- Config is resolved once at module import via `process.env`; not re-evaluated per job.

### `DEFAULT_AGENT_HARNESS_CONFIG_V1`

- Export shape preserved — all existing consumers (WorkerProcessor) continue to work without changes.
- Value is now produced by `createAgentHarnessConfigV1(process.env)` instead of a static object literal.
- `enableBrowserSmoke` remains `false` (hardcoded, not environment-backed by 05C6).

---

## 5. Parser Truth Table

| Input | Resolved Value | Notes |
|-------|---------------|-------|
| `undefined` | `defaultValue` (`false`) | Variable not set |
| `null` | `defaultValue` (`false`) | Treated as absent |
| `""` (empty string) | `defaultValue` (`false`) | Blank variable |
| `"   "` (whitespace only) | `defaultValue` (`false`) | Blank after trim |
| `"true"` | `true` | Exact match after trim |
| `"TRUE"` | `true` | Case-insensitive |
| `"True"` | `true` | Case-insensitive |
| `" true "` | `true` | Trimmed then matched |
| `"false"` | `false` | Exact match after trim |
| `"FALSE"` | `false` | Case-insensitive |
| `"False"` | `false` | Case-insensitive |
| `" false "` | `false` | Trimmed then matched |
| `"1"` | **throws** | Not an accepted value |
| `"0"` | **throws** | Not an accepted value |
| `"yes"` | **throws** | Not an accepted value |
| `"no"` | **throws** | Not an accepted value |
| `"on"` | **throws** | Not an accepted value |
| `"off"` | **throws** | Not an accepted value |
| Any other non-empty string | **throws** | Not an accepted value |

---

## 6. Invalid-Value Fail-Closed Behavior

When the parser receives a non-empty string that is not `"true"` or `"false"` (after trim and case normalization):

- Throws a structured `Error`.
- The error message identifies: the variable name and the set of accepted values (`"true"`, `"false"`).
- The error message does **not** include the invalid raw value (prevents accidental secret/token leakage in logs).
- This causes ai-service startup to fail on misconfiguration rather than silently enabling or disabling the gate.

---

## 7. `DEFAULT_AGENT_HARNESS_CONFIG_V1` Compatibility Summary

- Public export name unchanged.
- `AgentHarnessConfigV1` interface shape unchanged.
- All fields present: `enableToolLoop`, `enableBrowserSmoke`, `enablePreApplyCheckpoint`, `maxToolIterations`, `harnessVersion`.
- WorkerProcessor import path and usage unchanged.
- `route_evaluated` log line continues to report the resolved `enableToolLoop` value.

---

## 8. WorkerProcessor Compatibility Summary

- No code changes were made to `worker.processor.ts`.
- WorkerProcessor continues to import and use `DEFAULT_AGENT_HARNESS_CONFIG_V1`.
- The resolved value is `false` in all runtime and test contexts (environment absent).
- All 51 existing WorkerProcessor tests pass without modification.

---

## 9. `docker-compose.prod.yml` Change Summary

Added the following line to the ai-service `environment` block:

```yaml
AGENT_HARNESS_ENABLE_TOOL_LOOP: ${AGENT_HARNESS_ENABLE_TOOL_LOOP:-false}
```

Behavior:
- If `AGENT_HARNESS_ENABLE_TOOL_LOOP` is set in the host environment or `.env`, that value is forwarded.
- If the variable is absent, Docker Compose substitutes `false` (the secure default).
- A missing variable cannot accidentally activate the gate.
- `docker compose restart` does not apply changed environment values; container recreation is required.

---

## 10. `.env.example` Change Summary

Added the following documented entry:

```
AGENT_HARNESS_ENABLE_TOOL_LOOP=false
```

- Documents the variable and its safe default for new environment setup.
- Real root `.env` was not read or modified.

---

## 11. Test and Build Validation Results

| Validation | Command | Result |
|------------|---------|--------|
| Config spec | `npx jest --runTestsByPath src/agent-harness/config/agent-harness.config.spec.ts --verbose` | **23 passed, 0 failed** |
| WorkerProcessor spec | `npx jest --runTestsByPath src/worker/worker.processor.spec.ts --verbose` | **51 passed, 0 failed** |
| ai-service build | `npm run build` | **exit code 0, clean** |

---

## 12. No-Activation Confirmation

- `enableToolLoop` default is `false` by source, environment, and documentation.
- `AGENT_HARNESS_ENABLE_TOOL_LOOP` is not set to `true` anywhere in compose files, example files, or implementation.
- `enableBrowserSmoke` remains `false` and is not environment-backed by this task.
- No harness tool was invoked.
- No ai-service container was rebuilt or recreated during implementation.
- No provider execution occurred.
- No live true-gate test was run.

---

## 13. Safety Confirmations and Non-Goals

### Safety Confirmations

- Real `.env` was not read or modified.
- No Docker, compose runtime, API, queue, provider, database, or browser_smoke commands ran.
- `enableToolLoop` default remains `false` by source, config, and compose evidence.
- `enableBrowserSmoke` remains `false`.
- `docker-compose.prod.yml` defaults `AGENT_HARNESS_ENABLE_TOOL_LOOP` to `false`.
- No TASKS.md changes were made during implementation.
- No checkpoint was created during implementation.
- No git commit or push occurred.
- Session ownership enforcement from 05C5/05C5A is unchanged.

### Non-Goals (Confirmed Not Implemented)

- No harness identity entitlement.
- No tool registration changes.
- No xAI tool-use implementation.
- No execution-bound hardening.
- No audit implementation.
- No approval workflow.
- No read-only canary.
- No mutating tools.
- No browser-smoke activation.
- No production deployment or runtime activation.
- No `.env` modification.
- No git operations.

---

## 14. Deployment-Pending Note

Production ai-service has **not** been rebuilt or recreated for 05C6 during implementation.

The `AGENT_HARNESS_ENABLE_TOOL_LOOP` variable and compose mapping are source-validated and test-validated only. Full deployment verification — rebuilding the ai-service image, recreating the container, and confirming `route_evaluated` reports `enableToolLoop: false` in production logs — remains pending as a separate task (AGENT-HARNESS-05C6A).

---

## 15. Locked Invariants

The following invariants must not change without an explicit approved task:

- `enableToolLoop` resolves `false` when `AGENT_HARNESS_ENABLE_TOOL_LOOP` is absent or set to `false`.
- `enableBrowserSmoke` remains `false` (hardcoded, not environment-backed).
- `DEFAULT_AGENT_HARNESS_CONFIG_V1` export name and `AgentHarnessConfigV1` shape are preserved.
- WorkerProcessor does not require changes when the gate is `false`.
- Invalid `AGENT_HARNESS_ENABLE_TOOL_LOOP` values throw at startup (fail closed).
- Error messages for invalid values do not include the raw value.
- Setting `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` in production is forbidden until AGENT-HARNESS-05C7 identity entitlement is complete and locked, execution-bound hardening is complete, and Keith explicitly approves.

---

## 16. Next Recommended Task

**Register AGENT-HARNESS-05C6A — Environment Gate Runtime Validation**

Scope (registration only; implementation requires separate approval):
- Rebuild the ai-service Docker image to include 05C6 source changes.
- Recreate the ai-service container (`docker compose up -d --no-deps --force-recreate ai-service`).
- Confirm the compiled config resolves `enableToolLoop: false`.
- Confirm `route_evaluated` log reports `false` / `plain` path.
- Must **not** set `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` during validation.
- No harness activation; no provider execution; no browser_smoke.

---

*COMPLETE and LOCKED — 2026-06-30. Do not modify this checkpoint.*
