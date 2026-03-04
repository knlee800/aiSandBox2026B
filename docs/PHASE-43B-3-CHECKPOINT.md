# PHASE-43B-3 CHECKPOINT — Deterministic Replay Body Persistence

---

## Status: COMPLETE

**Phase:** 43B-3
**Nature:** Implementation + Integration Verification
**Date:** 2026-03-04

---

## Objective

Guarantee that when a request is replayed with the same Idempotency-Key, the API returns the **exact original response body** — not a placeholder or regenerated output.

This is critical for:

- Financial correctness
- API reliability
- Deterministic behavior for clients

---

## Implementation Summary

### 1. First Execution — Store Full AI Result

The first execution stores the full AI result in the UsageRecord metadata:

```
metadata.aiExecutionResult = {
  output: string
  tokensUsed: number
  model: string
}
```

### 2. Replay — Return Stored Result

When a request with the same Idempotency-Key is received:

- IdempotencyGuard detects the duplicate
- The system fetches the existing UsageRecord
- The stored aiExecutionResult is returned
- No new AI execution occurs
- No new ledger entry is created

### 3. Backward Compatibility

If `metadata.aiExecutionResult` does not exist (records created before this phase):

Return placeholder output:

```
"[Duplicate request - original response not stored]"
```

But still return:

- `tokensUsed`
- `model`

---

## Invariants (LOCKED)

The following system guarantees are now locked:

| Invariant | Description |
|---|---|
| Deterministic Replay | Replay responses must match the original response body exactly |
| Single Ledger Record | Duplicate requests must not create additional usage records |
| Financial Safety | Replays must not consume additional quota or tokens |
| Metadata Persistence | AI execution result must be stored inside `UsageRecord.metadata.aiExecutionResult` |
| Backward Compatibility | Older records without `aiExecutionResult` must return the placeholder output |

---

## Test Verification

### Integration Test File

```
services/api-gateway/src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts
```

### Verified Behaviors

1. Exact output equality on replay
2. Metadata storage of aiExecutionResult
3. Multiple replays return identical response
4. Ledger record count remains 1
5. Long outputs handled correctly
6. Special characters preserved
7. Backward compatibility placeholder

### Test Results

```
Test Suites: 1 passed
Tests:       7 passed
Execution Time: ~8 seconds
```

---

## Production Code Changes

No production code modifications were required in this checkpoint phase.

Only test infrastructure adjustments were made:

- Guard overrides using `.overrideGuard()`
- dotenv environment loading for Jest
- `Repository.clear()` used instead of `delete({})` for TypeORM 0.3+

---

## Architectural Significance

This phase establishes deterministic API behavior required for:

- Idempotent billing
- Safe retries
- Reliable client integrations
- Distributed request replay protection

This mechanism is a foundational reliability guarantee for the aiSandBox platform.

---

## Governance Trace

- **PRD:** Section 3E (AI Integration), Section 5 (Governance Model)
- **Architecture:** Section 2 (Idempotency, Determinism), Section 4 (Session Lifecycle)
- **Task:** TASKS/ai_execution.md → PHASE-43B-3
- **Checkpoint:** This document

---

PHASE-43B-3 COMPLETE
Deterministic replay behavior verified and locked.
