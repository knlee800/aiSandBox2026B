# AI-WS-06-hotfix2 CHECKPOINT — Simplify Container Search Script And Log Failures

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AI-WS-06-hotfix2 |
| Family | AI-WS (AI Workspace Capability) |
| Status | COMPLETE and LOCKED |
| Nature | CONTAINER-MANAGER DOCKER RUNTIME HOTFIX — simplify the multi-line shell search script to eliminate `mktemp`/temp-file dependency that may silently fail in minimal container images; add diagnostic stderr logging when exec exits non-zero with empty stdout so failures are no longer invisible |
| Date completed | 2026-05-04 |
| Source | Inspection session (May 2026) — after AI-WS-06-hotfix, search routes correctly through Docker exec but still returns empty results; named-file read confirms keyword exists in `key.txt`; inspection shows the entire route chain and prompt/context flow are correct; likely failure is inside the search shell script itself: `mktemp` may not be available in the minimal sandbox image, causing script to exit non-zero with empty stdout, which is silently swallowed and returned as `{ results: [] }` — indistinguishable from a genuine no-match |
| Depends on | AI-WS-06-hotfix (COMPLETE and LOCKED) |

---

## Objective

Remove `mktemp`/temp-file dependency from `DockerRuntimeService.searchFilesInContainer` and add diagnostic stderr logging on silent non-zero exits, so script failures become diagnosable instead of indistinguishable from genuine no-match results.

---

## Files Changed

### Updated

| File | Change |
|---|---|
| `services/container-manager/src/docker/docker-runtime.service.ts` | Replaced `mktemp`/temp-file/`trap` search script with `find` command substitution + `printf '%s\n' "$files" | while` pipeline; added `console.warn(...)` on non-zero empty-stdout exit when stderr is present |
| `services/container-manager/src/docker/docker-runtime.service.spec.ts` | Added 3 focused tests: script no longer contains `mktemp`; `.txt` file match parses correctly; non-zero + empty stdout + stderr logs warning and returns empty results |

### Not Changed

| File | Reason |
|---|---|
| All API gateway files | Out of scope — container-manager-only slice |
| All frontend files | Out of scope |
| All AI service files | Out of scope |
| `sessions.service.ts` | No change needed — delegates unchanged |
| `internal-sessions.controller.ts` | No change needed — route unchanged |
| Schema/migration | Out of scope |
| Semantic/vector search | Out of scope |
| File-action behavior | Out of scope |
| Delete behavior | Out of scope |

---

## Implementation Summary

### Script change — `mktemp` removed

**Before** (AI-WS-06-hotfix): used `mktemp` to write file paths to a temp file, then read them back:

```sh
tmp_file_list="$(mktemp)"
cleanup() { rm -f "$tmp_file_list"; }
trap cleanup EXIT
find /workspace ... > "$tmp_file_list"
files_scanned=0; truncated=0
while IFS= read -r file; do
  ...grep...
done < "$tmp_file_list"
if [ "$truncated" -eq 1 ]; then echo '__AI_WS_SEARCH_TRUNCATED__'; fi
```

**After** (AI-WS-06-hotfix2): uses `find` command substitution, eliminates `mktemp`, `trap`, and temp file entirely:

```sh
files="$(
  find /workspace \
    \( -type d \( ... \) -prune \) -o \
    \( -type f -size -...c ! -name ... -print \)
)" || exit $?

files_scanned=0
printf '%s\n' "$files" | while IFS= read -r file; do
  [ -n "$file" ] || continue
  files_scanned=$((files_scanned + 1))
  if [ "$files_scanned" -gt MAX_FILES_SCANNED ]; then
    echo '__AI_WS_SEARCH_TRUNCATED__'
    break
  fi
  grep -Fni -e "$QUERY" "$file" 2>/dev/null || true
done
```

Key improvements:
- `mktemp` removed — no temp file created or cleaned up
- `trap` removed — no EXIT handler needed
- Truncation sentinel emitted directly inside the loop before `break`, avoiding subshell variable scope issue with piped `while`
- `|| exit $?` on `find` command substitution propagates `find` failures as non-zero exit, making them visible via stderr logging

All existing behavior unchanged:
- Query passed via env var `QUERY` — not shell-interpolated
- Fixed-string grep: `grep -Fni -e "$QUERY"`
- All file/directory exclusions preserved exactly
- All safety caps unchanged (`WORKSPACE_SEARCH_MAX_FILES_SCANNED = 200`)
- Response shape `{ query, results, truncated }` unchanged
- TypeScript-side result caps and parsing unchanged

### Diagnostic stderr logging

When exec returns non-zero with empty stdout (silent failure path):

```typescript
if (result.exitCode !== 0 && `${result.stdout ?? ''}`.trim().length === 0) {
  const stderr = `${result.stderr ?? ''}`.trim();
  if (stderr.length > 0) {
    console.warn(
      `[AI-WS-06-hotfix2] Search script failed for session ${sessionId}: exitCode=${result.exitCode}, stderr=${stderr}`,
    );
  }
  return { query: normalizedQuery, results: [], truncated: false };
}
```

This makes future command-not-found, permission-denied, or other shell failures visible in container-manager logs without changing the response behavior.

---

## Tests Added

| Test | Assertion |
|---|---|
| `parses grep output into bounded structured results` — extended | Script no longer contains `mktemp` (new `expect(...).not.toContain('mktemp')` assertion added to existing test) |
| `parses .txt file grep output into structured results` | `/workspace/key.txt:1:SPECIAL_TEST_KEYWORD` → `{ path: 'key.txt', line: 1, preview: 'SPECIAL_TEST_KEYWORD' }` |
| `logs a warning when search exits non-zero with empty stdout and stderr` | exitCode=127, stderr=`find: not found` → `console.warn(...)` called with expected message; returns `{ results: [], truncated: false }` |

Pre-existing tests still passing: `parses grep output into bounded structured results`, `returns empty results when grep finds no matches`, `rejects empty query before exec`, `rejects too-long query before exec`, all `deleteFileFromContainer` tests.

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
| Container-manager Docker runtime search script | Yes |
| Container-manager Docker runtime test | Yes |
| API gateway | No |
| Frontend | No |
| AI service prompt/context | No |
| Routes | No |
| Schema/migration | No |
| Semantic/vector search | No |
| File-action behavior | No |
| Delete behavior | No |
| Unrelated code | No |

---

## Preserved Invariants

- Query validation unchanged — `normalizeWorkspaceSearchQuery()` still enforces required/non-empty/no-control-chars/≤120-chars before exec
- Query never shell-interpolated — `QUERY` env var passed to exec, referenced only as `$QUERY` inside script
- Fixed-string grep mode — `grep -Fni` unchanged
- All file/directory exclusions unchanged
- All safety caps unchanged
- Response shape `{ query, results, truncated }` unchanged
- TypeScript-side `parseWorkspaceSearchOutput`, `shouldSkipSearchResultPath`, `normalizeSearchPreview` unchanged
- `SessionsService.searchFilesInContainer` governance checks unchanged
- `InternalSessionsController POST :id/files/search` route unchanged
- `ContainerManagerHttpClient.searchSessionFiles` URL and headers unchanged
- Public API gateway search route unchanged
- Frontend `searchWorkspaceFiles(...)` unchanged
- AI service prompt formatting unchanged
