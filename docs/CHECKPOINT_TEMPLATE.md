# PHASE-{X}-STAGE-{Y}-TASK-{Z}-CHECKPOINT

---

## Metadata

- Project: AI Sandbox Platform
- Phase: {X}
- Stage: {Y}
- Task ID: {Z}
- Source Backlog: TASKS_BACKLOG_FULL.md → {Module}.{Task}
- Related PRD Section: {Section}
- Related Architecture Section: {Section}
- Status: COMPLETE / LOCKED
- Date: YYYY-MM-DD
- Author: Keith

---

## 1. Scope of This Stage

### Objective

Describe precisely what this stage was intended to deliver.

Example:

Implement OpenAI adapter with deterministic error handling and token accounting.

---

### In-Scope

- Feature A
- Feature B
- File C

---

### Out-of-Scope (Explicit)

- Feature X
- Refactor Y
- Optimization Z

---

## 2. Preconditions

All required conditions before starting this stage.

- [ ] Previous checkpoint approved
- [ ] Dependencies satisfied
- [ ] Architecture unchanged
- [ ] Tests passing at start

---

## 3. Work Completed

### Files Created

| Path | Purpose |
|------|----------|
| services/... | Description |

---

### Files Modified

| Path | Change |
|------|--------|
| services/... | Description |

---

### Files Deleted (If Any)

| Path | Reason |
|------|--------|
| — | — |

---

## 4. Implementation Summary

Explain what was built and how.

Include:

- Major design choices
- Trade-offs
- Rejected alternatives
- Constraints followed

---

## 5. Governance & Invariants

### Preserved Invariants

Confirm the following remain true:

- HTTP-only internal communication
- Request-driven enforcement
- No background workers
- No unauthorized refactors
- No secrets in repo

---

### New Invariants (If Any)

List any new rules introduced.

If none, write:

```
None
```

---

## 6. Testing & Verification

### Automated Tests

| Type | Location | Status |
|------|----------|--------|
| Unit | services/... | PASS |
| Integration | services/... | PASS |

---

### Manual Verification

Steps executed manually.

1. Step
2. Step
3. Result

---

### Evidence

Attach logs, screenshots, hashes if applicable.

---

## 7. Token / Usage / Cost Impact (If Applicable)

### Token Accounting

Describe:

- New usage paths
- Counting logic
- Verification

---

### Resource Impact

- CPU:
- Memory:
- Storage:

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk A | Medium | Action |

---

## 9. Rollback Plan

Describe how to revert this stage.

Example:

1. git revert <commit>
2. Restore config
3. Restart services

---

## 10. Safe Resume Point

If work pauses here, next developer/AI should:

1. Read this checkpoint
2. Review related tasks
3. Continue from: {location}

---

## 11. Open Issues (If Any)

List unresolved items.

If none:

```
None
```

---

## 12. Formal Declaration

### Completion Statement

This stage satisfies all defined scope and acceptance criteria.

No known regressions exist.

All governance rules have been followed.

---

### Lock Declaration

This checkpoint is hereby declared:

☐ COMPLETE  
☐ COMPLETE AND LOCKED

Once locked, no changes are permitted without explicit approval.

---

### Sign-off

Author: Keith  
Date: YYYY-MM-DD  
Signature: ______________________

---

END OF CHECKPOINT
