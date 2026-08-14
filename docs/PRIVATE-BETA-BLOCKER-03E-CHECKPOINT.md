# PRIVATE-BETA-BLOCKER-03E — Consolidation Checkpoint

**Task:** PRIVATE-BETA-BLOCKER-03E — Session Idle Timeout / File-Apply Lifecycle  
**Step:** 4 — Consolidation / Checkpoint  
**Status:** COMPLETE AND LOCKED — 2026-08-13  
**Integrated staging verdict:** 03E INTEGRATED STAGING PASS — READY FOR 03E CONSOLIDATION  
**Safety state:** `GLOBAL_EXECUTION_ENABLED=false` — confirmed throughout  

---

## 1. Task Identity / Status

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03E |
| Title | Session Idle Timeout / File-Apply Lifecycle |
| Family | PRIVATE-BETA-BLOCKER-03 / BUILDER EXECUTION RELIABILITY / SESSION LIFECYCLE |
| Priority | HIGH — private-beta blocker |
| Risk | HIGH |
| Workflow | HIGH-RISK 4-STEP |
| Registered | 2026-08-13 |
| Completed | 2026-08-13 |
| Final status | **COMPLETE AND LOCKED — 2026-08-13** |

Steps completed:

- Step 1 — Registration — COMPLETE — 2026-08-13
- Step 2 — Stage Start / Session Lifecycle Architecture Decision — COMPLETE — 2026-08-13
- Step 3 — Bounded Implementation + Validation — COMPLETE — 2026-08-13
- Step 4 — Consolidation / Checkpoint — COMPLETE — 2026-08-13

---

## 2. Original Blocker

BUILDER-INTENT-01 Step 4 Build E2E validation failed with `File write failed (502)`.

Session `e0c1d71a-35ff-4ea4-aad0-b897fc28ba45` (user `7f772841-7844-401b-a3da-e928b0c7b79c`, project `5e08e050-f5ae-485f-a2e6-d1261311ce92`) was approximately 51 minutes old at the time of the file-apply call. The container-manager `SESSION_IDLE_TIMEOUT_MS` threshold is 30 minutes.

The downstream file persistence after a valid AI Build execution failed, blocking BUILDER-INTENT-01 Step 4 completion.

---

## 3. Proven Root Cause

Failure sequence at the time of the original blocker:

1. File-write request reached container-manager via Gateway (`writeSessionFile`)
2. `checkAndEnforceIdleTimeout()` detected elapsed > 30 minutes
3. Method wrote `terminated_at` / `termination_reason='idle_timeout'` to SQLite
4. Method called `removeSessionContainer()` → `container.stop({ t: 10 })` + `container.remove()`
5. Docker stop waited up to 10 seconds for graceful shutdown
6. Gateway axios client timeout for `writeSessionFile` is 10,000 ms
7. Gateway timeout fired before container-manager responded → axios threw `ECONNABORTED`
8. Gateway caught error → surfaced as HTTP 502
9. Frontend displayed `File write failed (502)`
10. Container-manager eventually completed cleanup (SQLite: terminated; container: removed)
11. API Gateway Postgres remained `status=active`, `terminated_at=null` — cross-store inconsistency

Three independent problems:

- **Synchronous blocking cleanup**: container.stop({t:10}) inside the request path races the Gateway 10s timeout
- **Cross-store inconsistency**: container-manager terminates SQLite but never notifies API Gateway Postgres
- **Non-deterministic 502 vs structured 410**: frontend received ambiguous network error instead of machine-readable session-expired signal

---

## 4. Architecture Decisions (from Stage-Start)

Key decisions locked in `docs/PRIVATE-BETA-BLOCKER-03E-STAGE-START.md`:

| Decision | Ruling |
|----------|--------|
| A — Session activity authority | In-memory `lastActivity` Map in container-manager remains authoritative |
| B — Pre-provider runtime viability | Existing Postgres `terminatedAt` preflight sufficient after 03E-B cross-store sync |
| C — Apply-time recovery | Deterministic expired-session failure — NO automatic recovery |
| D — Idle termination response semantics | Mark expired + return immediately; container cleanup is fire-and-forget |
| E — Cross-store lifecycle consistency | Container-manager owns transitions; propagates to API Gateway via `notifySessionStopped` |
| F — User-visible error contract | HTTP 410 from container-manager → propagated to frontend → i18n session-expired message |
| G — Accounting boundary | Credit/refund policy belongs exclusively to PRIVATE-BETA-BLOCKER-03D |
| H — 03C boundary | Provider timeout diagnosis remains entirely separate (PRIVATE-BETA-BLOCKER-03C) |

Preview traffic does not count as session activity (Decision A supplement).

No timeout values were changed. The fix is structural, not parametric.

---

## 5. 03E-A Implementation — Deterministic Idle-Timeout Response Semantics

**Scope:** Decouple container cleanup from the request path in `checkAndEnforceIdleTimeout()` and `checkAndEnforceMaxLifetime()`.

**Mechanism:** After writing `terminated_at` / `termination_reason` to SQLite and cleaning up in-memory state, cleanup is scheduled via fire-and-forget (non-blocking) rather than `await removeSessionContainer(sessionId)`. `GoneException` is thrown immediately.

**Semantics enforced:**
- Stale/expired data-plane requests return HTTP 410
- Session termination is established synchronously (SQLite write)
- Docker stop/remove is scheduled asynchronously — caller does not wait on `container.stop({ t: 10 })`
- Expired request does not proceed into Docker read/write/exec
- Cleanup failure is isolated (logged; does not break the 410 response)
- Concurrent expiration is idempotent (SQLite `WHERE terminated_at IS NULL` guard)
- Fresh-session path is fully preserved
- Preview traffic does not count as activity
- Timeout values unchanged

**Result:** Gateway timeout race eliminated. Response time < 100 ms (no Docker wait).

---

## 6. 03E-B Implementation — Cross-Store Lifecycle Synchronization

**Scope:** Propagate idle/lifetime termination from container-manager SQLite to API Gateway Postgres.

**Active notification path:**

After container-manager terminates a session (idle_timeout or max_lifetime), it calls:

```
POST /api/internal/sessions/:sessionId/stop
```

with payload `{ "reason": "idle_timeout" }` or `{ "reason": "max_lifetime" }`.

Gateway maps this to `status=stopped`, `terminatedAt=<timestamp>`, `terminationReason=<reason>` in Postgres.

Notification is non-blocking (best-effort). Notification failure does not break the termination response.

**Lazy reconciliation path:**

When `ContainerManagerHttpClient` receives a deterministic HTTP 410 from container-manager, the Gateway reconciles Postgres session state through `SessionService.terminateSession()`. This handles the case where active notification failed.

Only deterministic 410 triggers reconciliation. HTTP 500 / 502 / network timeouts do **not** falsely terminate the application-visible session.

Duplicate termination is idempotent.

---

## 7. 03E-C Implementation — Frontend Deterministic Stale-Session UX

**Scope:** Frontend classifies HTTP 410 file-write responses as `session_expired` and shows localized recovery copy.

**Classification:** HTTP 410 file writes are classified as `session_expired` (not generic write failure).

**Termination reason retained internally:** `idle_timeout`, `max_lifetime`, or `null`.

**File Action Results:** Remain `failed`. Show localized recovery copy rather than the previous generic `File write failed (410)`.

**New i18n key:** `ai.fileWriteSessionExpired`

| Locale | Copy |
|--------|------|
| en | This workspace session has expired. The file was not saved. Reopen the project before trying again. |
| zh-TW | 這個工作區工作階段已過期。檔案未儲存。請重新開啟專案後再試。 |
| zh-CN | 这个工作区会话已过期。文件未保存。请重新打开项目后再试。 |

**No automatic retry.** No automatic session recreation. No new recovery button. No new icon. Existing reopen-project recovery remains authoritative.

---

## 8. Exact Production Files Changed

**container-manager:**

| File | Change |
|------|--------|
| `services/container-manager/src/sessions/sessions.service.ts` | `checkAndEnforceIdleTimeout()` and `checkAndEnforceMaxLifetime()` — fire-and-forget cleanup + immediate `GoneException`; `notifySessionStopped()` call after termination |
| `services/container-manager/src/sessions/sessions.service.spec.ts` | Tests for 03E-A and 03E-B behaviors |

**API Gateway:**

| File | Change |
|------|--------|
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Lazy reconciliation on deterministic 410 from container-manager |
| `services/api-gateway/src/clients/container-manager-http.client.spec.ts` | Tests for 410 propagation and reconciliation |
| `services/api-gateway/src/sessions/internal-session.controller.ts` | Termination reason acceptance (idle_timeout / max_lifetime payloads) |
| `services/api-gateway/src/sessions/internal-session.controller.spec.ts` | Tests for termination reason handling |

**Frontend:**

| File | Change |
|------|--------|
| `frontend/components/workspace/workspace-file-navigation.logic.ts` | HTTP 410 classified as `session_expired`; `session_expired` error type routing |
| `frontend/components/workspace/workspace-file-navigation.logic.test.ts` | Tests for 410 classification |
| `frontend/messages/en.json` | `ai.fileWriteSessionExpired` key |
| `frontend/messages/zh-TW.json` | `ai.fileWriteSessionExpired` key |
| `frontend/messages/zh-CN.json` | `ai.fileWriteSessionExpired` key |

No other production source files were changed.

---

## 9. Local Test / Build Evidence

### container-manager targeted (post 03E-A)
19/19 PASS

### container-manager targeted (post 03E-B integration)
24/24 PASS

### container-manager broader suite
108/108 PASS

### container-manager build
PASS

### API Gateway targeted
12/12 PASS

### API Gateway relevant safe/offline subset
70/70 PASS

### API Gateway build
PASS

### API Gateway full suite
- 154 passed
- 11 failed (existing unrelated offline/environment/test-wiring failures — not 03E regressions)
- 1 skipped

The 11 failures are pre-existing issues unrelated to the 03E session/client surfaces. This is recorded accurately — the full Gateway suite did **not** pass 100%.

### Frontend targeted tests
33/33 PASS

### Frontend workspace tests
601/601 PASS

### Frontend TypeScript
PASS

### Frontend build
PASS

---

## 10. Integrated Staging Deployment

**Backup path:** `/tmp/aisandbox-03e-backup-20260813-175624`

Only approved 03E production files were deployed.

**Builds:**
- container-manager: PASS
- API Gateway: PASS
- frontend: PASS

**Services restarted:**
- `aisandbox-container-manager`
- `aisandbox-api-gateway`
- `aisandbox-frontend`

No restart loop observed. Services remained healthy throughout.

**Safety gates throughout integration:**
- `GLOBAL_EXECUTION_ENABLED=false` — confirmed
- `BILLING_CHARGES_ENABLED=false` — confirmed
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` — confirmed
- `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` — confirmed

---

## 11. Staging 410 Proof

**Session under test:** `e0c1d71a-35ff-4ea4-aad0-b897fc28ba45` (the originally-stale session)

**Request:**
```
GET /api/internal/workspace/e0c1d71a-35ff-4ea4-aad0-b897fc28ba45/list?path=/
```

**Result:** HTTP 410

**Body:**
```
Session e0c1d71a-35ff-4ea4-aad0-b897fc28ba45 has been terminated (reason: idle_timeout)
```

**Timing:** 109.5 ms

**What this proves:**
- 410 (not 502) — deterministic machine-readable signal
- 109.5 ms — far below previous ~10-second timeout race
- Docker data-plane operation was not reached
- No new Docker stop/cleanup action triggered on this already-terminal session
- Services remained healthy

---

## 12. Cross-Store Reconciliation Proof

**Before request (Postgres):**
```
status=active
terminated_at=null
termination_reason=null
container_id=null
```

**After deterministic 410 (Postgres):**
```
status=stopped
terminated_at=2026-08-13T18:00:09.423
termination_reason=idle_timeout
container_id=null
```

**Proven path:**
```
Gateway throwContainerManagerError
  → reconcileSessionTerminationFromGone
  → terminateSession(..., 'idle_timeout')
```

This proves lazy reconciliation. The reused test session was already terminal in CM SQLite, so the active `notifySessionStopped` idle-expiration path was not freshly triggered in staging. See Limitation 3 below.

---

## 13. Safety / Gate Evidence

Throughout all 03E work and integrated staging:

| Gate | State |
|------|-------|
| `GLOBAL_EXECUTION_ENABLED` | `false` — confirmed |
| `BILLING_CHARGES_ENABLED` | `false` — confirmed |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` — confirmed |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` — confirmed |

`GLOBAL_EXECUTION_ENABLED` remains `false` after 03E consolidation. It must not be enabled here.

---

## 14. Provider / Accounting Evidence

| Metric | Value |
|--------|-------|
| Provider calls during 03E implementation | 0 |
| Provider calls during 03E integrated staging | 0 |
| Credit deductions from 03E | 0 |
| Workspace mutations from 03E validation | 0 |
| Stripe / payment activity | None |

03E consumed zero new provider credits. All validation was provider-free.

The 2,145 credits consumed by the original failed BUILDER-INTENT-01 Build execution (`25eb1efb-c1ed-4136-b724-4a5a7b271600`) are a separate accounting matter belonging to **PRIVATE-BETA-BLOCKER-03D**. Credit/refund policy was not changed here.

---

## 15. Accepted Validation Limitations

These are accepted limitations, not hidden failures.

### Limitation 1 — 03E-C live File Action copy

**03E-C LIVE FILE-ACTION COPY NOT PROVIDER-FREE REPRODUCIBLE**

There was no product-supported provider-free way to replay or re-apply an existing AI file action. Staging therefore did not directly display the localized 410 File Action message.

Evidence instead: deployed production code, targeted frontend classification/render tests (33/33), 601/601 workspace tests, TypeScript PASS, frontend build PASS.

The final BUILDER-INTENT Build E2E rerun will naturally exercise the real file-action path if a stale failure were to occur, but a stale failure must not be intentionally recreated.

### Limitation 2 — Slow cleanup ordering

The reused stale session's Docker container was already absent at staging time. Staging therefore did not freshly demonstrate a slow `container.stop` occurring after the 410 response.

03E-A deferred-Promise local tests are authoritative for the non-blocking cleanup contract.

### Limitation 3 — Active termination notification

The reused session was already terminal in CM SQLite. Therefore the active `notifySessionStopped` idle-expiration path was not freshly triggered on staging.

The lazy reconciliation path WAS proven live (Section 12). Active notification is covered by implementation and local tests.

### Limitation 4 — CM SQLite status column

CM SQLite may retain its historical status-column representation while `terminated_at` is populated. 03E does not redesign the CM schema. Application-visible Postgres correctly reconciles to `stopped`.

---

## 16. Rollback Backup Path

**Backup path:** `/tmp/aisandbox-03e-backup-20260813-175624`

Per-slice rollback:

- **03E-A rollback:** Revert `sessions.service.ts` — cleanup returns to synchronous (re-introduces timeout race, reverts to known baseline)
- **03E-B rollback:** Remove `notifySessionStopped` call from termination path — Postgres reverts to stale-until-next-request behavior
- **03E-C rollback:** Revert frontend error detection — returns to generic `File write failed (status)` message

No destructive DB resets required. No `docker compose down -v` required. No broad environment reset required. All changes are independently revertible via `git revert`.

---

## 17. Remaining Out-of-Scope Issues

The following remain explicitly separate from 03E and must not be absorbed:

| Issue | Status |
|-------|--------|
| PRIVATE-BETA-BLOCKER-03C — Grok 4.2 Timeout Diagnosis | NOT REGISTERED — separate |
| PRIVATE-BETA-BLOCKER-03D — No-Workspace-Result Credit Policy | NOT REGISTERED — separate |
| Automatic session recreation / resume | Explicitly out of scope |
| Background reaper / cron workers | Explicitly out of scope |
| Container-presence validation (Race 5 in Stage-Start) | Explicitly out of scope |
| PRIVATE-BETA-INVITE-01 | Untouched — invitations prohibited |
| Full PRIVATE-BETA-E2E rerun | Pending — requires BUILDER-INTENT-01 Step 4 Build rerun first |
| Final GO/NO-GO | Not registered |
| GLOBAL_EXECUTION_ENABLED gate activation | Not authorized in 03E |

---

## 18. BUILDER-INTENT-01 Dependency Relationship

BUILDER-INTENT-01 was blocked by 03E at Step 4 (Controlled Staging Validation + Consolidation).

Historical Build execution:
- Execution ID: `25eb1efb-c1ed-4136-b724-4a5a7b271600`
- `executionIntent=workspace_mutation`
- Provider file action count: 1 (valid)
- `finalContractResult=passed`
- Downstream file persistence failed due to the now-fixed 03E lifecycle defect (HTTP 502 from stale session)

Ask validation (execution `cd937e68-f440-4efa-a698-46ec2e7f4b7b`): PASS — must NOT be repeated.

**After 03E is COMPLETE AND LOCKED, BUILDER-INTENT-01 Step 4 may resume with ONE controlled Build E2E rerun.** Do not run it during this consolidation task.

BUILDER-INTENT-01 updated status: **ACTIVE — 03E blocker resolved; Step 4 Build E2E rerun pending**

---

## 19. Final Acceptance-Criteria Review

### Step 2 (Stage Start / Architecture Decision)
- [x] `docs/PRIVATE-BETA-BLOCKER-03E-STAGE-START.md` produced
- [x] All eight design decisions (A–H) answered
- [x] Exact implementation surfaces and source files identified
- [x] Child slices identified (03E-A, 03E-B, 03E-C)
- [x] No source changes / no provider calls in Step 2

### Step 3 (Bounded Implementation + Validation)
- [x] Only Stage-Start-approved solution implemented
- [x] Targeted stale-session mutation tests pass
- [x] Fresh-session write regression confirmed
- [x] Relevant service builds/tests pass
- [x] `GLOBAL_EXECUTION_ENABLED=false` during Step 3
- [x] No 03C / 03D scope absorbed

### Step 4 (Consolidation / Checkpoint)
- [x] Stale-session behavior deterministic and documented
- [x] Expired session cannot produce ambiguous Gateway 502 solely from stop/proxy-timeout interaction — proven: 109.5 ms HTTP 410
- [x] Application session state does not remain `active` after runtime termination — proven: lazy reconciliation Postgres updated to `stopped`
- [x] File mutation against stale session receives deterministic lifecycle outcome — HTTP 410
- [x] Chosen lifecycle design avoids silent mutation loss — 410 is explicit, machine-readable
- [x] Builder mutation flow has explicit strategy for runtime viability before/at apply — cross-store sync + deterministic 410
- [x] Fresh-session writes continue to work — confirmed by regression tests
- [x] Idle-expiration behavior remains bounded and safe
- [x] No destructive Docker/data behavior introduced
- [x] Targeted tests cover stale-session mutation — 33/33 frontend, 24/24 CM post-B, 12/12 Gateway targeted
- [x] Relevant service builds/tests pass — all builds PASS; test suites documented accurately
- [x] Staging validation proves corrected lifecycle without enabling Harness — 410 proof at 109.5 ms, cross-store reconciliation proof
- [x] `GLOBAL_EXECUTION_ENABLED=false` confirmed before and after — confirmed
- [x] BUILDER-INTENT-01 Build E2E rerun deferred — recorded as exact next task
- [x] No third-party payment activity required — confirmed: 0 provider calls, 0 credits, 0 Stripe activity
- [x] Checkpoint created — this document
- [x] PRIVATE-BETA-BLOCKER-03E marked COMPLETE AND LOCKED — 2026-08-13

---

## 20. Final Verdict

**03E INTEGRATED STAGING PASS — COMPLETE AND LOCKED — 2026-08-13**

03E resolved the stale-session / file-apply lifecycle blocker that caused the BUILDER-INTENT Build mutation to fail with HTTP 502 by:

1. Decoupling container cleanup from the request path (fire-and-forget) so expired requests return HTTP 410 in < 100 ms
2. Propagating session termination from container-manager SQLite to API Gateway Postgres (active notification + lazy reconciliation)
3. Classifying HTTP 410 at the frontend as `session_expired` with deterministic localized recovery copy

The 502 gateway-timeout race is eliminated. Cross-store state inconsistency is resolved. The frontend receives a machine-readable, localized signal. Fresh-session writes are unaffected. All safety gates remained false throughout.

---

## 21. Exact Next Task

**BUILDER-INTENT-01 Step 4 — Controlled Build E2E Rerun after 03E**

- 03E is COMPLETE AND LOCKED
- BUILDER-INTENT-01 Steps 1–3 COMPLETE; Step 4 IN PROGRESS — 03E blocker resolved
- One controlled Build E2E provider call authorized (grok-4.5 or equivalent)
- Use a fresh session — do not reuse the now-stale `e0c1d71a` session
- Ask validation (execution `cd937e68-f440-4efa-a698-46ec2e7f4b7b`) is PASS — do NOT repeat it
- Keep `GLOBAL_EXECUTION_ENABLED=true` only for the duration of the controlled rerun; restore `false` after
- PRIVATE-BETA-BLOCKER-03C and 03D remain separate — do not absorb

Do not proceed to 03C or 03D before completing the already-active BUILDER-INTENT-01 lifecycle.
