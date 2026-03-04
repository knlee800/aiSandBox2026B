TASK-43C-2: Orphan Cleanup + Reconciliation Worker



Status: COMPLETE

Nature: IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)

Checkpoint: docs/PHASE-43C-2-CHECKPOINT.md



Objective



Implement deterministic background reconciliation of orphaned AI execution records.



Transition pending execution records older than a configured threshold to timeout, enabling safe retry while preserving strict idempotency guarantees.



Scope



Add findOrphanedPending() to UsageLedgerService



Add batchTransitionOrphansToTimeout() to UsageLedgerService



Implement OrphanReconciliationWorker



Register worker in UsageLedgerModule



Configurable via environment variables:



ORPHAN\_RECONCILIATION\_ENABLED



ORPHAN\_RECONCILIATION\_INTERVAL\_MS



ORPHAN\_THRESHOLD\_MS



ORPHAN\_BATCH\_SIZE



Structured JSON logging for reconciliation events



Unit tests only



Invariants (LOCKED)



No database schema changes



No new dependencies



No architectural refactors



No retry logic added to controller



Idempotency semantics unchanged:



completed → deterministic replay



pending < threshold → 409 conflict



pending > threshold → transition to timeout + retry allowed



timeout/failed retry reuses existing row (UPDATE only)



No provider selection changes



No quota logic changes



Tests



Unit tests for new ledger methods



Unit tests for worker scheduling + batch transition behavior



Integration tests intentionally excluded



Rollback



Disable via environment variable:



ORPHAN\_RECONCILIATION\_ENABLED=false



No data migration required.

