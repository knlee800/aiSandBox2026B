# AUTH-MODULE-02A Checkpoint — Support Next.js Bracket Route File Paths

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-02A |
| Title | Support Next.js Bracket Route File Paths |
| Parent | AUTH-MODULE-02 — Auth Module Live Smoke Blockers |
| Family | AUTH |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND ONLY — all changes under `services/container-manager/`; no frontend, api-gateway, or infrastructure changes |
| Date | 2026-05-21 |
| Depends on | AUTH-MODULE-02 registration (DONE) |
| Checkpoint | `docs/AUTH-MODULE-02A-CHECKPOINT.md` |

---

## Objective

Fix the file write API rejection of valid Next.js App Router bracket/catch-all route paths such as `app/api/auth/[...nextauth]/route.ts`. The fix must allow safe Next.js route segment syntax while preserving all existing path traversal protections.

---

## Root Cause

`validateWorkspacePath` in `docker-runtime.service.ts` used a substring-based traversal check:

```ts
filePath.includes('..')
```

This caused false positives: the `...` in Next.js catch-all route segments (e.g., `[...nextauth]`, `[[...slug]]`) contains `..` as a substring, so valid paths were incorrectly rejected with a 400 error.

---

## Fix Summary

Replaced the substring-based `..` check with a segment-based check:

**Before:**
```ts
filePath.includes('..')
```

**After:**
```ts
filePath.split('/').some((segment) => segment === '..')
```

This change allows path segments that contain `..` as part of a valid name (such as `[...nextauth]` and `[[...slug]]`) while still rejecting any path segment that *is* exactly `..` (i.e., actual directory traversal).

All other checks in `validateWorkspacePath` — absolute path rejection, drive letter rejection, null byte rejection, unsafe separator rejection — were preserved and unchanged.

---

## Files Changed

### Modified Files

| File | Change |
|---|---|
| `services/container-manager/src/docker/docker-runtime.service.ts` | Segment-based `..` traversal check in `validateWorkspacePath` |
| `services/container-manager/src/docker/docker-runtime.service.spec.ts` | New allowed-path tests (5) and new rejected-path tests (6) |

### Files Not Changed

- No frontend files changed
- No api-gateway files changed
- No other container-manager files changed (controller, session service, DTOs, git service)
- No auth module files changed
- No governance or task docs changed during implementation

---

## Path Validation Fix Detail

### `validateWorkspacePath` — segment-based traversal check

Location: `services/container-manager/src/docker/docker-runtime.service.ts`

The change is confined to the traversal-detection line. All surrounding checks are preserved:

- Null/empty path → rejected
- Absolute path (starts with `/`) → rejected
- Drive letter path (e.g., `C:\`) → rejected
- Null byte presence → rejected
- Backslash separator → rejected
- Segment exactly equal to `..` → rejected (the fixed check)
- Valid relative path with bracket segments → allowed

---

## Allowed-Path Tests Added

| Path | Reason |
|---|---|
| `app/api/auth/[...nextauth]/route.ts` | Next.js catch-all API route |
| `app/[id]/page.tsx` | Next.js dynamic segment |
| `app/[[...slug]]/page.tsx` | Next.js optional catch-all segment |
| `app/....dotfile/page.tsx` | Directory name starting with dots (not traversal) |
| `src/components/auth/login.tsx` | Ordinary relative path |

---

## Rejected-Path Tests Added

| Path | Reason |
|---|---|
| `../secret.txt` | Traversal at root |
| `foo/../bar` | Traversal in middle |
| `a/../../etc/passwd` | Multi-level traversal |
| `/etc/passwd` | Absolute path |
| `/workspace/foo.ts` | Absolute path |
| `` (empty string) | Empty path |

---

## Validation Results

All commands executed from `C:\Users\knlee\aiSandBox2026B\services\container-manager`.

| Command | Result |
|---|---|
| `npm test -- --testPathPattern="docker-runtime.service.spec"` | **PASS — Test Suites: 4 passed, 4 total; Tests: 32 passed, 32 total** |
| `npm test` | **PASS — Test Suites: 4 passed, 4 total; Tests: 32 passed, 32 total** |
| `npm run build` | **PASS — TypeScript compile succeeded, 0 errors** |
| `ReadLints` on touched files | **PASS — 0 linter errors** |

No separate `tsc --noEmit` script exists in this service; `npm run build` serves as TypeScript compile/type validation.

---

## Scope Confirmation

Changes during implementation were strictly limited to:

- `services/container-manager/src/docker/docker-runtime.service.ts`
- `services/container-manager/src/docker/docker-runtime.service.spec.ts`

Not changed:
- Frontend auth templates
- Frontend file write helpers
- `api-gateway/` files
- Container-manager controller, session service, or DTOs
- Any auth module frontend files
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, or checkpoint docs (changed only during this consolidation)

---

## Non-Goals Confirmed

- No auth template redesign
- No broad file API refactor
- No bypass of path safety
- No generated-app runtime changes beyond allowing safe path names
- No frontend changes
- No api-gateway changes
- No new backend endpoints

---

## Invariants Preserved

- All 32 container-manager tests pass
- `npm run build` (TypeScript) passes with 0 errors
- All existing path rejection checks preserved: absolute paths, drive letters, null bytes, backslash separators
- Actual `..` traversal segments are still rejected
- No changes to controller, session service, git service, or DTOs

---

## Carry-Forwards / Known Limitations

1. **Manual smoke re-test not executed** — live app/session not available in this environment. Bracket route paths should be manually verified end-to-end against a running stack before AUTH-MODULE-02 is closed as production-ready.
2. **Frontend and api-gateway path validation not audited** — only the container-manager `validateWorkspacePath` was traced and fixed. If the frontend or api-gateway also validate file paths, those paths should be audited for similar bracket-path rejection before production deployment.

---

## Next Task

**AUTH-MODULE-02B — Checkpoint Revert Has No Effect**

Parent: AUTH-MODULE-02 — Auth Module Live Smoke Blockers

Bug: Reverting to "Auth Module: pre-install snapshot" was confirmed by user, but workspace files did not revert. Expected: auth files removed and `package.json` reverted. Observed: file tree and `package.json` unchanged. Checkpoint revert safety net is non-functional.

---

## Reference

- `TASKS.md` → AUTH-MODULE-02A
- `TASKS_BACKLOG_FULL.md` → AUTH-MODULE-02A
- Parent: `docs/AUTH-MODULE-02-CHECKPOINT.md` (to be created at AUTH-MODULE-02 close)
- Sibling: `docs/AUTH-MODULE-02B-CHECKPOINT.md` (to be created at AUTH-MODULE-02B close)
