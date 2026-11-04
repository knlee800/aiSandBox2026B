# RUN-ERROR-01 — Checkpoint

**Task:** RUN-ERROR-01 — Show the real reason when a worker step fails
**Status:** COMPLETE AND LOCKED — 2026-11-04
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-04. Registered in 8e2e733085bfa661b6140e61f240344c9d3006d8, admitted in 6314586b9d23fbdaf7465b774d6a8a00d861e3f0. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

services/ai-service/src/worker/worker.processor.ts. The general failure branch of the job handler now stores metadata.executionError = { code, message } in the same failed update, merged into the existing metadata (read-merge-write, as persistStoredExecutionFailure already does; if the read fails, the old update runs without a reason). code is the error code when it is a short identifier, otherwise execution_failed. message is the known harness sentence when it matches; otherwise the first line, whitespace collapsed, cut at 300 characters; a message that looks like a stack, a numbered file path, a credential word or value, code or a slice of the prompt is replaced by a fixed sentence ("This step failed." or the known harness sentence). The queue failed event, the stuck-running watchdog and the stalled-claim path also store a reason, still only when the row is running. Timeout status, cancellation, success, the contract-failure path, accounting and the rethrow are unchanged. The Gateway reader (collaboration-failure-reason.ts) already shows the stored reason.

## Implementer

Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High. Touched only worker.processor.ts and worker.processor.spec.ts.

## Control-plane review

Read the diff. Reran: ai-service npm test 39 suites, 1039 passed, 1 skipped; npm run build exit 0. Cursor saw 4 better-sqlite3 ABI failures in messages.service.spec.ts in its own environment; they did not occur in the control-plane rerun.

## useTranslations report (no fix)

One translator function in a dependency list: frontend/components/admin/admin-user-detail-client.tsx line 381, a useCallback for a click handler, which does not refetch or loop. collaboration-page.tsx line 295 lists t on a useMemo. No useEffect lists the translator.

## Limits

Mock-tested only; not deployed. The filter is conservative: a reason containing words such as key or token is replaced by the fixed sentence. The timeout path still stores no reason.
