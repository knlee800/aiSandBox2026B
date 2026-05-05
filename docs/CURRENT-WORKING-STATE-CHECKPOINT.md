# CURRENT WORKING STATE CHECKPOINT

## Date

2026-04-09

## Purpose

Handoff/state record for today's work. Not a task registration. No implementation should start from this document.

---

## 1. Stable and Fixed Areas

### Project Snapshot Persistence (PROJ-01-20, PROJ-01-21)

- Root cause isolated: `/snapshot-store/` inside api-gateway container was on the ephemeral writable layer, not a persistent Docker volume.
- Fix: added named volume `api_gateway_snapshot_store_data` mounted to `/snapshot-store/` in `docker-compose.prod.yml`.
- Result: project snapshot files survive `docker compose down` without `-v`. Saved projects restore correctly after stack restart.
- Files: `docker-compose.prod.yml`

### Project Open — Snapshot Race (PROJ-01-17)

- Root cause: `handleOpenWorkspaceProject` read `workspaceSnapshots` from stale React closure. After a session switch, the snapshot list clears before the reload completes. Handler saw empty snapshots and took the associate-only path (no restore).
- Fix: handler now fetches fresh snapshots from API at open time instead of reading closure.
- Files: `frontend/app/[locale]/app/page.tsx`

### Project Open — AI Coherence Race (PROJ-01-18, PROJ-01-19)

- Root cause: `useEffect([chatExecutionFileActionStates, selectedFilePath, userId])` fired during `loadWorkspaceFileContent`'s yield. Triggered coherence which incremented `fileContentRequestIdRef`, failing the staleness guard. Editor stayed in `'loading'`.
- Fix: `projectOpenInProgressRef` ref (set `true` at handler start, `false` at handler end). Coherence effect checks ref and returns early when `true`.
- Files: `frontend/app/[locale]/app/page.tsx`

### Project Open — Session-Change Effect Race (PROJ-01-22, PROJ-01-23)

- Root cause: in the cross-session open path, `setSelectedSessionId(openSessionId)` at L1097 triggered `useEffect([selectedSessionId])` at L463, which cleared project state and launched five concurrent async operations racing with the handler.
- Fix: extended `projectOpenInProgressRef` to also gate the L463 session-change effect. Added deferred reloads (snapshots, projects, public projects, dashboard) to handler success path to cover the skipped effect work.
- Files: `frontend/app/[locale]/app/page.tsx`

### Preview 500 for non-index.html Sessions (PREV-02-01, PREV-02-02)

- Root cause: Static HTML framework detection matched any `*.html` file, but the proxy always served `index.html` for root requests. Sessions with `hello.html` but no `index.html` would start preview successfully then 500 on proxy.
- Fix: tightened detection to require `index.html` at workspace root. Sessions without `index.html` now receive `BadRequestException` at start time instead of a misleading 500.
- Files: `services/container-manager/src/preview/preview.service.ts`

### Stop Session 500 Response (OPS-01-04)

- Root cause: `ContainerManagerHttpClient.stopSession()` used axios default 10s timeout. On Windows, session stop/remove takes longer. Cleanup completed but api-gateway timed out and returned 500.
- Fix: added `timeout: 30000` to the stop session request in the HTTP client.
- Files: `services/api-gateway/src/clients/container-manager-http.client.ts`

---

## 2. Remaining Known Issue: Project Open File Load in Real UI

### Symptom

After clicking "Open Project" in the real browser UI, files and editor content do not reliably appear automatically. A browser refresh causes files to appear correctly.

### Backend status

Confirmed working:
- Snapshot restore is synchronous and complete before the API response returns.
- File tree is immediately available via API after project open.
- File content reads correctly via API after project open.

### Frontend status

Multiple races have been fixed (PROJ-01-17, PROJ-01-19, PROJ-01-23). Each fix addressed a specific race condition. After PROJ-01-23, the known interference from the session-change effect is suppressed.

However, the project-open UI flow remains fragile:

- `handleOpenWorkspaceProject` is a long async chain (~80 lines, 5+ awaited steps, fire-and-forget tails).
- Multiple refs and skip flags coordinate across 6+ `useEffect` hooks.
- Each added guard interacts with effects that fire for unrelated reasons.
- The same `projectOpenInProgressRef` now gates two different effects (coherence, session-change), which means its semantics have expanded across fixes.
- Further individual micro-fixes risk creating new interference patterns.

### Why browser refresh works

On browser refresh, React mounts fresh. Bootstrap loads sessions → sets `selectedSessionId` → `useEffect([selectedSessionId])` fires → `loadWorkspaceFilesForSession` runs cleanly with no concurrent handler. Files appear.

### Current recommendation

Do not add more micro-fixes to the existing handler chain. The structure has accumulated enough guards that another targeted fix is likely to mask one race while introducing another.

---

## 3. Recommended Next Task (Not Registered)

**Suggested Task ID:** PROJ-02-01

**Title:** Refactor Project Open Into Deterministic Workspace Hydration Flow

**Nature:** FRONTEND ARCHITECTURE FIX / STATE FLOW CLEANUP

**Purpose:**

Replace the fragile `handleOpenWorkspaceProject` handler + multi-effect chain with a single deterministic workspace hydration sequence:

1. Complete backend open/restore (await)
2. Reload project/session data as needed (await)
3. Reload file tree for target session (await)
4. Select first file path
5. Load editor content for first file (await)
6. Set final `fileSurfaceState` to `'ready'`
7. Prevent all unrelated effects from touching file/project state during the sequence

Key constraints:
- This must not depend on React effects firing at the right time.
- The hydration sequence should be self-contained and produce a deterministic final state.
- Normal session switching outside project open must remain unaffected.

**Do not start PROJ-02-01 from this consolidation checkpoint.**

---

## 4. Task File Status

All completed tasks are already marked COMPLETE and LOCKED in `TASKS.md` and `TASKS_BACKLOG_FULL.md`. No status changes are required as part of this consolidation.

Current active stage in PROJ-01 family: `PROJ-01-23 (COMPLETE and LOCKED)` — no active work.

---

## 5. Files Changed Today (Session Summary)

| File | Task | Change |
|------|------|--------|
| `docker-compose.prod.yml` | PROJ-01-21 | Added persistent volume for `/snapshot-store/` |
| `services/container-manager/src/preview/preview.service.ts` | PREV-02-02 | Strict `index.html` detection; `BadRequestException` for missing-index sessions |
| `services/api-gateway/src/clients/container-manager-http.client.ts` | OPS-01-04 | Added 30s timeout to `stopSession()` |
| `frontend/app/[locale]/app/page.tsx` | PROJ-01-17, PROJ-01-19, PROJ-01-23 | Fresh snapshot fetch; coherence guard; session-change effect guard + deferred reloads |

---

## 6. Invariants Preserved

- No backend session/project schema changes.
- No snapshot service logic changes.
- No auth or billing changes.
- No scope expansion beyond approved tasks.
- All prior checkpoint invariants remain intact.

---

## 7. AI-WS Stabilization Pass — Completed 2026-05-05

### Summary

The full AI-WS capability stabilization pass completed successfully. All AI-WS tasks and hotfixes are COMPLETE and LOCKED.

### Manual Validation Passed (user-confirmed)

| Capability | Result |
|---|---|
| Selected file content context injected into AI prompt | Passed |
| Project/workspace metadata context injected into AI prompt | Passed |
| Named file read (AI asks to show content of a specific file) | Passed |
| Workspace search for `SPECIAL_TEST_KEYWORD` in `key.txt` | Passed |
| Safe file create — auto-applied without confirmation | Passed |
| Delete confirmation appears and stays stable (no ghost Apply after restore) | Passed |
| Confirmed delete removes existing file from active container `/workspace` | Passed |
| Cancelled delete preserves file | Passed |
| Missing-file delete surfaces useful "File not found" message | Passed |
| Restored stale `awaiting-confirmation` Apply button sanitized to `skipped` | Passed |
| Static HTML preview relative links resolve correctly via `<base>` tag injection | Passed |

### Stable AI Workspace Capabilities (as of 2026-05-05)

- File list context in AI prompt
- Selected file content read
- Named file read (AI-WS-05)
- Workspace content search (AI-WS-06) — routed through active container exec with `grep -FnHi`
- File create / write / update (auto-applied)
- File delete with explicit user confirmation
- File delete routed through active container `/workspace` (not host filesystem)
- Static HTML preview relative-link navigation

### Hotfix Chain (all COMPLETE and LOCKED)

| Task | Fix |
|---|---|
| AI-WS-03-hotfix | Corrected misleading 403 error wording in frontend |
| AI-WS-03-hotfix2 | Added raw JSON file-action fallback parser in AI service |
| PREVIEW-hotfix | Injected `<base>` tag for static HTML preview relative links |
| AI-WS-03-hotfix3 | Surfaced backend delete error message in frontend |
| AI-WS-02-hotfix | Sanitized restored stale `awaiting-confirmation` states on session load |
| AI-WS-03-hotfix4 | Preserved `delete` file actions through API gateway execution results |
| AI-WS-03-hotfix5 | Routed file delete through container exec (aligned with read/write/list) |
| AI-WS-06-hotfix | Routed workspace search through internal sessions route and container exec |
| AI-WS-06-hotfix2 | Simplified container search script — removed `mktemp`/temp-file; added stderr diagnostic logging |
| AI-WS-06-hotfix3 | Added `-H` flag to grep so filename prefix is always included in search output |

### No New Work Started

No new feature tasks were registered or started as part of this stabilization closure.
