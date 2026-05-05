# AI-WS-06-hotfix3 CHECKPOINT — Force Grep Filename Prefix In Container Search

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AI-WS-06-hotfix3 |
| Family | AI-WS (AI Workspace Capability) |
| Status | COMPLETE and LOCKED |
| Nature | CONTAINER-MANAGER SEARCH SCRIPT ONE-LINE FIX — add `-H` flag to `grep` call inside `searchFilesInContainer` shell script so output always includes the filename prefix, making results parseable by the existing TypeScript parser |
| Date completed | 2026-05-04 |
| Source | Inspection session (May 2026) — after AI-WS-06-hotfix2, search still returns no matches; live `node:20-alpine` container test confirmed: `grep -Fni` omits filename when searching a single file (output: `1:SPECIAL_TEST_KEYWORD`), but the parser expects `path:line:preview` (e.g. `/workspace/key.txt:1:SPECIAL_TEST_KEYWORD`); lines without a second colon are silently skipped by `parseWorkspaceSearchOutput`; `grep -FnHi` forces filename inclusion always; BusyBox grep used by `node:20-alpine` supports `-H` |
| Depends on | AI-WS-06-hotfix2 (COMPLETE and LOCKED) |

---

## Objective

Add `-H` to the grep call in the container search shell script so that grep output always includes the filename, enabling the existing unchanged parser to produce non-empty results.

---

## Files Changed

### Updated

| File | Change |
|---|---|
| `services/container-manager/src/docker/docker-runtime.service.ts` | Changed `grep -Fni -e "$QUERY" "$file"` to `grep -FnHi -e "$QUERY" "$file"` in the `searchFilesInContainer` shell script |
| `services/container-manager/src/docker/docker-runtime.service.spec.ts` | Updated generated-script assertion to require `grep -FnHi -e "$QUERY" "$file"` |

### Not Changed

| File | Reason |
|---|---|
| All API gateway files | Out of scope — container-manager-only slice |
| All frontend files | Out of scope |
| All AI service files | Out of scope |
| `parseWorkspaceSearchOutput` | Parser unchanged — already expects `path:line:preview` format |
| `sessions.service.ts` | Out of scope |
| `internal-sessions.controller.ts` | Out of scope |
| Schema/migration | Out of scope |
| Semantic/vector search | Out of scope |
| File-action behavior | Out of scope |
| Delete behavior | Out of scope |

---

## Implementation Summary

### Root cause (confirmed by live container test)

`grep` omits the filename prefix when searching a single file. The search script calls grep once per file, so every invocation searched exactly one file. Output was:

```
1:SPECIAL_TEST_KEYWORD
```

The parser `parseWorkspaceSearchOutput` looks for two colons to split `path:line:preview`. A line with only one colon has `secondColonIndex = -1`, which fails the guard `secondColonIndex <= firstColonIndex + 1` → line silently skipped. Every match was found by grep but discarded by the parser.

### Fix

Changed grep flags from `grep -Fni` to `grep -FnHi`. The `-H` flag forces grep to always include the filename prefix regardless of how many files are being searched. Output becomes:

```
/workspace/key.txt:1:SPECIAL_TEST_KEYWORD
```

This is fully parseable by the existing unchanged `parseWorkspaceSearchOutput`:
- `path` = `key.txt` (after `/workspace/` prefix is stripped)
- `line` = `1`
- `preview` = `SPECIAL_TEST_KEYWORD`

### Unchanged

- TypeScript parser `parseWorkspaceSearchOutput` — no changes
- Query validation and normalization — no changes
- Safety caps: max files scanned 200, max results 20, preview cap 240, total response cap 8000, file size cap 262144 bytes
- All file/directory exclusions — no changes
- Response shape `{ query, results, truncated }` — no changes
- Fixed-string grep mode — `grep -F` still present
- Query env-var passing — `QUERY` still passed as exec env var, not shell-interpolated
- All other shell script structure — no changes beyond the one flag

---

## Test Update

| Assertion | Before | After |
|---|---|---|
| Generated script grep flags | `expect.stringContaining('grep -Fni -e "$QUERY" "$file"')` | `expect.stringContaining('grep -FnHi -e "$QUERY" "$file"')` |

All pre-existing tests still passing: `parses grep output into bounded structured results`, `parses .txt file grep output into structured results`, `returns empty results when grep finds no matches`, `logs a warning when search exits non-zero with empty stdout and stderr`, `rejects empty query before exec`, `rejects too-long query before exec`, all `deleteFileFromContainer` tests.

---

## Validation

Docker/PostgreSQL not required for compile/unit validations.

From `C:\Users\knlee\aiSandBox2026B\services\container-manager`:

| Check | Result |
|---|---|
| `npm run build` | Passed — clean TypeScript build |
| `npx jest "src/docker/docker-runtime.service.spec.ts" --runInBand` | Passed — 9/9 tests |

`ReadLints` on both touched files: no linter errors.

---

## Scope Confirmation

| Area | Changed? |
|---|---|
| Container-manager search script grep flags | Yes — `grep -Fni` → `grep -FnHi` |
| Container-manager Docker runtime test assertion | Yes — updated to match new flags |
| API gateway | No |
| Frontend | No |
| AI service prompt/context | No |
| Routes | No |
| Parser response shape | No |
| Semantic/vector search | No |
| File-action behavior | No |
| Delete behavior | No |
| Unrelated code | No |

---

## Preserved Invariants

- Query never shell-interpolated — `QUERY` env var unchanged
- Fixed-string grep mode — `-F` flag preserved
- Case-insensitive grep mode — `-i` flag preserved
- Line number output — `-n` flag preserved
- All file/directory exclusions unchanged
- All safety caps unchanged
- Response shape unchanged
- `parseWorkspaceSearchOutput`, `shouldSkipSearchResultPath`, `normalizeSearchPreview` unchanged
- `SessionsService.searchFilesInContainer` unchanged
- `InternalSessionsController POST :id/files/search` unchanged
- `ContainerManagerHttpClient.searchSessionFiles` unchanged
- Public API gateway search route unchanged
- Frontend `searchWorkspaceFiles(...)` unchanged
- AI service prompt formatting unchanged
