# AGENT-HARNESS-05C3A — Worker Harness Route Observability — CHECKPOINT

**Task ID:** AGENT-HARNESS-05C3A
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-27
**Family:** AGENT-HARNESS
**Phase:** 5C
**Nature:** BACKEND OBSERVABILITY / WORKER ROUTING / NO BEHAVIOR CHANGE

---

## 1. Context from AGENT-HARNESS-05C3

AGENT-HARNESS-05C3 (Harness Version Runtime Validation) is the parent task. It requires runtime proof that `harnessVersion: 'v1'` reached `WorkerProcessor` and that the correct execution route was selected.

During the AGENT-HARNESS-05C3 observability review, **Decision B** was selected: existing runtime logs did not include `harnessVersion`, `enableToolLoop`, or the selected execution path. This prevented direct runtime proof.

`WorkerProcessor` already evaluated:

```typescript
job.data.harnessVersion === 'v1'
&& DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop
```

However, no structured log was emitted capturing those values or the routing decision. Without that log, AGENT-HARNESS-05C3 runtime validation could not proceed.

**05C3A was registered to resolve this observability gap before 05C3 runtime validation could continue.**

**Current safety configuration (unchanged by 05C3A):**
- `enableToolLoop: false`
- `enableBrowserSmoke: false`
- `enablePreApplyCheckpoint: true`

---

## 2. Observability Gap Resolved

| Field | Before 05C3A | After 05C3A |
|-------|-------------|-------------|
| `harnessVersion` in logs | Not logged | Logged at route evaluation |
| `enableToolLoop` in logs | Not logged | Logged at route evaluation |
| Selected route in logs | Not logged | Logged (`'harness'` or `'plain'`) |

---

## 3. Files Changed

| File | Change |
|------|--------|
| `services/ai-service/src/worker/worker.processor.ts` | Added `useHarness` boolean; added `agent_harness.route_evaluated` structured event; replaced inline double gate with `if (useHarness)` |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Added five tests under `describe('Agent Harness 05C3A: route observability event')` |

**Files explicitly unchanged:**
- `services/api-gateway/` — no changes
- `services/ai-service/src/agent-harness/config/agent-harness.config.ts` — no changes
- All frontend, database, Docker, `.env`, and package files — no changes

---

## 4. Implementation Summary

### `useHarness` boolean

Replaces the inline double gate with a named boolean computed once before route selection:

```typescript
const useHarness =
  job.data.harnessVersion === 'v1'
  && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop;
```

This preserves the exact original double gate semantics:
- `job.data.harnessVersion === 'v1'`
- `&&`
- `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop`

No gate logic has changed. No configuration values have changed.

### Structured event

Immediately before route selection, one structured log event is emitted:

```typescript
this.logger.log({
  event: 'agent_harness.route_evaluated',
  executionId,
  harnessVersion: job.data.harnessVersion ?? null,
  enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop,
  selectedPath: useHarness ? 'harness' : 'plain',
});
```

**Event location:** Emitted immediately before the `if (useHarness)` branch — i.e., after job data is available and after `useHarness` is computed, before any execution route is entered.

**Exactly one event per execution.** No event is emitted inside branches.

### Route selection

The inline condition was replaced:

```typescript
// Before
if (job.data.harnessVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop) { ... }

// After
if (useHarness) { ... }
```

Routing semantics are identical.

---

## 5. Event Schema

| Field | Type | Value (with current config) |
|-------|------|-----------------------------|
| `event` | `string` | `'agent_harness.route_evaluated'` |
| `executionId` | `string` | UUID of the current execution |
| `harnessVersion` | `string \| null` | `'v1'` if present; `null` if absent |
| `enableToolLoop` | `boolean` | `false` (current config — unchanged) |
| `selectedPath` | `'harness' \| 'plain'` | `'plain'` (because `enableToolLoop` is `false`) |

---

## 6. Routing Semantics Unchanged Confirmation

The routing behavior is unchanged:

- `harnessVersion: 'v1'` + `enableToolLoop: false` → `selectedPath: 'plain'` → plain execution
- `harnessVersion: 'v1'` + `enableToolLoop: true` → `selectedPath: 'harness'` → harness execution (unreachable with current config)
- `harnessVersion` absent → `selectedPath: 'plain'` → plain execution

With current config (`enableToolLoop: false`), all requests execute the plain path. This is identical to pre-05C3A behavior. The log is the only addition.

---

## 7. Security Review of Logged Fields

| Field | Sensitive? | Rationale |
|-------|-----------|-----------|
| `event` | No | Static string literal |
| `executionId` | No | Already logged elsewhere in WorkerProcessor |
| `harnessVersion` | No | Non-sensitive routing metadata |
| `enableToolLoop` | No | Non-sensitive configuration flag |
| `selectedPath` | No | Routing outcome string (`'harness'` or `'plain'`) |

**Explicitly not logged:**
- Prompt / user instructions
- Provider API keys
- Session cookies or tokens
- Workspace content or file paths
- Internal service credentials

---

## 8. Tests Added

**Describe block:** `Agent Harness 05C3A: route observability event`
**File:** `services/ai-service/src/worker/worker.processor.spec.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | `harnessVersion: 'v1'` with `enableToolLoop: false` | Logs `selectedPath: 'plain'` |
| 2 | Missing `harnessVersion` | Logs `harnessVersion: null` and `selectedPath: 'plain'` |
| 3 | Sensitive field exclusion | Event log excludes prompt, cookies, API keys, workspace content |
| 4 | `useHarness` replaces inline double gate | `useHarness` is `false` when `enableToolLoop: false`; log reflects this |
| 5 | `ToolDispatcher` behind harness gate | `ToolDispatcher` is not called when `useHarness` is `false` |

---

## 9. Validation Results

### Focused WorkerProcessor tests

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"
npx jest --testPathPatterns="worker.processor.spec" --verbose
```

**Result:** 51 passed, 0 failed.

### Build

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"
npm run build
```

**Result:** PASS — exit code 0, clean compilation.

### Full ai-service test suite

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"
npm test
```

**Result:**
- 28 suites passed, 1 failed
- 476 tests passed, 3 failed, 1 skipped

**Pre-existing failures (unrelated to 05C3A):**

| Suite | Cause |
|-------|-------|
| `services/ai-service/src/__tests__/app.module.spec.ts` | Missing `REDIS_URL` environment variable — present since before 05C3A; environmental, not code failure |

All 3 failures are in `app.module.spec.ts` and are caused by a missing `REDIS_URL` in the local test environment. These failures are unrelated to the 05C3A changes and were present before implementation.

**Final verdict:** PASS — focused tests: 51/51. Build: clean. Three pre-existing REDIS_URL failures are a known environmental baseline.

---

## 10. Confirmations / Non-Goals

| Item | Status |
|------|--------|
| `enableToolLoop` remains `false` | Confirmed |
| `enableBrowserSmoke` remains `false` | Confirmed |
| Routing behavior unchanged | Confirmed |
| No new endpoint added | Confirmed |
| No API or queue payload changes | Confirmed |
| No database or metadata changes | Confirmed |
| No package dependency additions | Confirmed |
| No frontend changes | Confirmed |
| No Docker changes | Confirmed |
| `.env` not read or modified | Confirmed |
| No live provider/model execution run | Confirmed |
| No `browser_smoke` run | Confirmed |
| No git commit/push during consolidation | Confirmed |
| No configuration values changed | Confirmed |
| Sensitive fields excluded from log | Confirmed |
| Exactly one routing event per execution | Confirmed |

---

## 11. Locked Invariants

The following invariants are locked from this checkpoint forward:

- The `agent_harness.route_evaluated` event is emitted exactly once per execution, immediately before route selection.
- The event contains only: `event`, `executionId`, `harnessVersion`, `enableToolLoop`, `selectedPath`.
- No sensitive content (prompts, keys, cookies, workspace content) is ever included in this event.
- `useHarness` preserves the exact double gate: `harnessVersion === 'v1' && enableToolLoop`.
- `enableToolLoop` must remain `false` until an explicit approved task enables it.
- `enableBrowserSmoke` must remain `false` until an explicit approved task enables it.
- Routing semantics are identical to pre-05C3A behavior.
- Pre-existing 3 `app.module.spec.ts` REDIS_URL failures are a known environmental baseline — do not treat as regressions.

---

## 12. Next Step

**Resume AGENT-HARNESS-05C3 runtime validation** after explicit Keith approval and deployment of the updated ai-service image.

The `agent_harness.route_evaluated` event now provides the structured runtime proof required:
- `harnessVersion` received by the worker
- `enableToolLoop` value used at route evaluation
- `selectedPath` selected (`'plain'` or `'harness'`)

Required before resuming 05C3:
1. Revised runtime command review presented to Keith.
2. Explicit Keith approval for ai-service image rebuild/restart and xAI execution.
3. Minimal ai-service image rebuild/restart to deploy the new observability event.

---

> LOCKED — do not modify this checkpoint.
