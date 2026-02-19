# PHASE 40B-1 CHECKPOINT

**Phase:** 40B  
**Stage:** 40B-1  
**Title:** Runtime Hardening — Container Lifecycle & Cleanup Verification  
**Status:** COMPLETE and LOCKED  
**Date:** 2026-02-19  
**Task ID:** TASK-40B-1  
**Previous Checkpoint:** PHASE-40A-3-CHECKPOINT.md

---

## Purpose

Phase 40B-1 verifies container lifecycle correctness and cleanup guarantees under normal and failure conditions on Windows runtime. This diagnostic phase identified and fixed a critical defect where containers were orphaned during session deletion.

---

## Scope

### In Scope
- ✅ Session → container creation verification
- ✅ Session termination → container cleanup verification  
- ✅ Orphan container detection
- ✅ Minimal fix for confirmed defect
- ✅ Runtime behavior documentation

### Explicitly Out of Scope
- ❌ No background cleanup workers (violates ARCHITECTURE.md Section 11)
- ❌ No scheduled jobs or cron tasks
- ❌ No distributed coordination or clustering
- ❌ No database schema changes
- ❌ No authentication or authorization changes
- ❌ No preview system modifications
- ❌ No billing or quota logic changes
- ❌ No architectural refactors

---

## Critical Defect Found

### Defect: Orphaned Containers on Session Deletion

**Location:** `services/container-manager/src/sessions/sessions.service.ts:231-250`

**Issue:** The `deleteSession()` method did NOT call `removeSessionContainer()`, causing Docker containers to remain running after session deletion.

**Evidence:**
```bash
docker ps -a --filter "name=sandbox-session-"
```

**Result:** 3 orphaned containers detected:
- `sandbox-session-3335c463-a50a-4995-a6f5-2da5ff11b830` (Up 3+ hours)
- `sandbox-session-7e407969-3dd4-4ea8-b820-f275093af1c3` (Up 3+ hours)
- `sandbox-session-437aae2c-dbd7-4530-811f-004374889752` (Up 3+ hours)

**Database Verification:**
```
Session 3335c463...: NOT FOUND
Session 7e407969...: NOT FOUND
Session 437aae2c...: NOT FOUND
```

All 3 containers had NO corresponding database records, confirming they were orphaned by previous session deletions.

---

## Changes Implemented

### File Modified

**`services/container-manager/src/sessions/sessions.service.ts`**

**Change:** Added container removal to `deleteSession()` method

**Before (Lines 231-250):**
```typescript
async deleteSession(sessionId: string) {
  // Delete workspace directory
  const workspacePath = path.join(this.workspacesRoot, sessionId);
  try {
    await fs.rm(workspacePath, { recursive: true, force: true });
  } catch (error) {
    // Ignore if directory doesn't exist
  }

  // Delete from database
  this.db
    .prepare('DELETE FROM sessions WHERE id = ?')
    .run(sessionId);

  // Task 8.3A & 8.3B: Clean up all governance tracking
  this.lastActivity.delete(sessionId);
  this.activeExecs.delete(sessionId);

  return { message: 'Session deleted successfully' };
}
```

**After (Lines 231-260):**
```typescript
async deleteSession(sessionId: string) {
  // Task 40B-1: Remove container BEFORE deleting session data
  // Best-effort container cleanup (log errors but continue with deletion)
  try {
    await this.removeSessionContainer(sessionId);
  } catch (error) {
    console.error(
      `Failed to remove container for session ${sessionId} during deletion:`,
      error.message,
    );
    // Continue with session deletion even if container removal fails
  }

  // Delete workspace directory
  const workspacePath = path.join(this.workspacesRoot, sessionId);
  try {
    await fs.rm(workspacePath, { recursive: true, force: true });
  } catch (error) {
    // Ignore if directory doesn't exist
  }

  // Delete from database
  this.db
    .prepare('DELETE FROM sessions WHERE id = ?')
    .run(sessionId);

  // Task 8.3A & 8.3B: Clean up all governance tracking
  this.lastActivity.delete(sessionId);
  this.activeExecs.delete(sessionId);

  return { message: 'Session deleted successfully' };
}
```

---

## Verification Results

### ✅ Session → Container Creation
**Status:** VERIFIED CORRECT

- Container created during `startSessionContainer()`
- Naming convention: `sandbox-session-{sessionId}`
- Workspace mount: `{workspacesRoot}/{sessionId}:/workspace:rw`
- Resource limits enforced (memory, CPU, PIDs)

### ✅ Session Termination → Container Cleanup
**Status:** VERIFIED CORRECT (with fix)

**Termination Paths Verified:**

1. **Max Lifetime Violation** (Lines 670-679)
   - ✅ Calls `removeSessionContainer()` (best-effort)
   - ✅ Logs errors but continues with termination
   - ✅ Throws HTTP 410 Gone

2. **Idle Timeout Violation** (Lines 738-747)
   - ✅ Calls `removeSessionContainer()` (best-effort)
   - ✅ Logs errors but continues with termination
   - ✅ Throws HTTP 410 Gone

3. **Explicit Session Stop** (Lines 207-229)
   - ⚠️ Does NOT call `removeSessionContainer()`
   - ⚠️ Only updates status to 'stopped'
   - ⚠️ Container remains running (by design - stop ≠ delete)

4. **Explicit Session Delete** (Lines 231-260)
   - ❌ **DEFECT FOUND:** Did NOT call `removeSessionContainer()`
   - ✅ **FIXED:** Now calls `removeSessionContainer()` before deletion

### ✅ Orphan Container Detection
**Status:** DEFECT CONFIRMED AND FIXED

**Before Fix:**
- 3 orphaned containers detected
- All containers had no database records
- Containers running for 3+ hours

**After Fix:**
- `deleteSession()` now removes containers
- Best-effort cleanup (logs errors, continues deletion)
- Preserves idempotent deletion semantics

### ✅ Restart Scenarios
**Status:** VERIFIED CORRECT

- Termination state survives restarts (DB-backed)
- In-memory tracking (`lastActivity`, `activeExecs`) is disposable
- Containers persist across service restarts (by design)
- No automatic cleanup on restart (per ARCHITECTURE.md Section 11)

### ✅ Docker Engine Failure Scenarios
**Status:** VERIFIED CORRECT

- Container stop failures are logged but don't block termination
- Container remove failures are logged but don't block deletion
- HTTP 410 Gone returned even if container cleanup fails
- Fail-fast behavior preserved for container operations

---

## System Behavior After Fix

### Container Lifecycle Flow

**Session Creation:**
```
POST /api/sessions
  → createSession() [container-manager]
  → createContainer() [docker-runtime]
  → startContainer() [docker-runtime]
  → Container running ✓
```

**Session Deletion (FIXED):**
```
DELETE /api/sessions/:id
  → deleteSession() [container-manager]
  → removeSessionContainer() [NEW]
    → findContainerBySessionId()
    → stopContainer() if running
    → removeContainer()
  → Delete workspace directory
  → Delete database record
  → Container removed ✓
```

**Session Termination (Max Lifetime / Idle Timeout):**
```
Any session operation
  → checkAndEnforceMaxLifetime() or checkAndEnforceIdleTimeout()
  → Write termination to DB
  → removeSessionContainer() (best-effort)
  → Throw HTTP 410 Gone
  → Container removed ✓
```

---

## Verification Commands Used

### Check for Orphaned Containers
```bash
docker ps -a --filter "name=sandbox-session-" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
```

### Verify Database Records
```javascript
const Database = require('better-sqlite3');
const db = new Database('./database/aisandbox.db');
const sessions = db.prepare('SELECT id, status, terminated_at FROM sessions WHERE id = ?').all(sessionId);
```

### Initialize Database (if needed)
```bash
node init-db.js  # Applies schema-sqlite.sql
```

---

## Invariants Preserved

### What Did NOT Change

- ✅ Request-driven enforcement only (no background workers)
- ✅ DB-backed termination state
- ✅ HTTP 410 Gone on terminated sessions
- ✅ Single-process enforcement model
- ✅ No WebSocket control plane
- ✅ Idempotent termination writes
- ✅ Best-effort container cleanup (doesn't block termination)
- ✅ Fail-fast container operations
- ✅ Session stop ≠ session delete (stop keeps container running)

### Scope Containment

- ✅ Container-manager ONLY changes
- ✅ No API changes
- ✅ No auth changes
- ✅ No schema changes
- ✅ No preview system changes
- ✅ No billing logic changes
- ✅ Linter passes
- ✅ No regressions introduced

---

## Known Limitations (Documented)

### 1. Stopped Sessions Keep Containers Running

**Behavior:** `stopSession()` does NOT remove containers.

**Rationale:** Stop ≠ Delete. Stopped sessions may be resumed.

**Cleanup:** User must explicitly call `DELETE /api/sessions/:id` to remove container.

### 2. No Background Cleanup

**Behavior:** No automatic cleanup of orphaned containers.

**Rationale:** Per ARCHITECTURE.md Section 11 (Explicit Non-Goals).

**Mitigation:** Request-driven cleanup on session operations.

### 3. Best-Effort Container Cleanup

**Behavior:** Container removal failures don't block session deletion.

**Rationale:** Termination state must be written even if Docker fails.

**Mitigation:** Errors logged for manual intervention.

### 4. No Cluster-Safe Enforcement

**Behavior:** Single-process enforcement model only.

**Rationale:** Per ARCHITECTURE.md Section 11 (Explicit Non-Goals).

**Future Work:** Multi-node coordination out of scope.

---

## Windows-Specific Considerations

### Database Path Resolution
- Uses `path.join(__dirname, '../../../..', 'database', 'aisandbox.db')`
- Works correctly on Windows with backslashes

### Workspace Path Resolution
- Uses `path.join(this.workspacesRoot, sessionId)`
- Docker mount: `${workspacePath}:/workspace:rw`
- Windows paths converted to Docker-compatible format by dockerode

### Docker Desktop for Windows
- Containers run in WSL2 backend
- Container names: `sandbox-session-{sessionId}`
- No special Windows handling required

---

## Diff Summary

**Files Changed:** 1  
**Lines Added:** 11  
**Lines Modified:** 0  
**Lines Deleted:** 0  
**Net Change:** +11 lines

**Changes:**
```diff
services/container-manager/src/sessions/sessions.service.ts
  Line 231-241: Added container removal call before session deletion
  + try {
  +   await this.removeSessionContainer(sessionId);
  + } catch (error) {
  +   console.error(
  +     `Failed to remove container for session ${sessionId} during deletion:`,
  +     error.message,
  +   );
  +   // Continue with session deletion even if container removal fails
  + }
```

---

## Safe Resume Point

### Status

**Phase 40B-1:** COMPLETE and LOCKED

### What Was Achieved

- ✅ Verified container lifecycle correctness
- ✅ Identified critical orphan container defect
- ✅ Applied minimal fix (11 lines added)
- ✅ Verified fix preserves all invariants
- ✅ Documented current behavior and limitations
- ✅ No scope expansion
- ✅ No architectural changes
- ✅ Linter passes

### Post-Phase State

- Containers are now removed during session deletion
- Termination paths already had container cleanup (verified correct)
- Best-effort cleanup semantics preserved
- No orphaned containers after proper session deletion flow
- Manual cleanup required for pre-existing orphans

---

## Manual Cleanup Required

### Pre-Existing Orphaned Containers

The following orphaned containers were detected during verification:
- `sandbox-session-3335c463-a50a-4995-a6f5-2da5ff11b830`
- `sandbox-session-7e407969-3dd4-4ea8-b820-f275093af1c3`
- `sandbox-session-437aae2c-dbd7-4530-811f-004374889752`

**Cleanup Command:**
```bash
docker rm -f sandbox-session-3335c463-a50a-4995-a6f5-2da5ff11b830
docker rm -f sandbox-session-7e407969-3dd4-4ea8-b820-f275093af1c3
docker rm -f sandbox-session-437aae2c-dbd7-4530-811f-004374889752
```

**Note:** These containers were orphaned by the defect before the fix was applied. The fix prevents future orphans.

---

## References

- TASK-40B-1 in TASKS_BACKLOG_FULL.md (Lines 1690-1829)
- ARCHITECTURE.md Section 4 (Session Lifecycle)
- ARCHITECTURE.md Section 9 (Container Isolation)
- ARCHITECTURE.md Section 11 (Explicit Non-Goals)
- PRD.md Section 3.A (Session Management)
- PHASE-8.3-CHECKPOINT.md (Idle Timeout + Max Lifetime)
- PHASE-8.4-CHECKPOINT.md (Session Termination Semantics)

---

## ULTRA-BRIEF SUMMARY

• **DEFECT FOUND:** `deleteSession()` did NOT remove Docker containers, causing orphans (3 detected)
• **FIX APPLIED:** Added `removeSessionContainer()` call to `deleteSession()` (11 lines, best-effort cleanup)
• **VERIFIED:** Termination paths already had cleanup; stop ≠ delete (by design); restart-safe termination state
• **PRESERVED:** All architectural invariants, request-driven enforcement, no background workers
• **Phase 40B-1 COMPLETE and LOCKED** — Container lifecycle hardened, orphan defect fixed, minimal diff applied
