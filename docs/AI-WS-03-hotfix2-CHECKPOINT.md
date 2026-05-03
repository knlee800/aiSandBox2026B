# AI-WS-03-hotfix2 CHECKPOINT — Accept Raw JSON File-Actions Fallback

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AI-WS-03-hotfix2 |
| Family | AI-WS (AI Workspace Capability) |
| Status | COMPLETE and LOCKED |
| Nature | AI SERVICE PARSER HOTFIX — add a safe fallback extraction path for bare `{"file-actions":[...]}` model output so delete/create/write/update actions survive the known contract-violation output shape without changing the primary fenced block contract |
| Date completed | 2026-05-03 |
| Source | Inspection session (May 2026) — model sometimes emits raw JSON `{"file-actions":[...]}` instead of a fenced ```file-actions block; the current parser only reads fenced blocks, so no file actions are extracted and no confirmation appears |
| Depends on | AI-WS-03 (COMPLETE and LOCKED); AI-WS-03-hotfix (COMPLETE and LOCKED) |

---

## Objective

Make the ai-service file-action parser tolerate the known malformed-but-clear model output shape `{"file-actions":[...]}` so delete/create/write/update actions inside that raw JSON can still enter the existing frontend apply/confirmation pipeline, without changing fenced block extraction, frontend behavior, or backend file handling.

---

## Files Changed

### Updated

| File | Change |
|---|---|
| `services/ai-service/src/ai-execution/file-actions.parser.ts` | Added private `parseTopLevelFileActionsObjectPayload` fallback function; extended `extractFileActionsFromOutput` to call it when fenced block pass produces zero actions |
| `services/ai-service/src/ai-execution/__tests__/file-actions.parser.spec.ts` | Added 7 focused tests covering the fallback path; all 5 pre-existing tests preserved and still passing |

### Not Changed

| File | Reason |
|---|---|
| `services/ai-service/src/worker/worker.processor.ts` | No prompt wording clarification required; fenced block contract wording already sufficient |
| All frontend files | Out of scope — frontend-only slice was not needed |
| All api-gateway files | Out of scope |
| All container-manager files | Out of scope |

---

## Implementation Summary

### `file-actions.parser.ts`

Added one private helper function `parseTopLevelFileActionsObjectPayload(rawOutput: string): FileAction[]`:

- Trims the raw output and attempts `JSON.parse`.
- Accepts only a top-level non-null object that is not an array.
- Requires a top-level `"file-actions"` key whose value is an array.
- Maps each element through the existing `parseActionCandidate(...)` function — no new validation logic added.
- Any failure (JSON parse error, wrong type, missing key) returns `[]` and does not crash.

Extended `extractFileActionsFromOutput(...)`:

- Existing fenced block regex pass (`FILE_ACTION_BLOCK_REGEX`) is unchanged and remains the primary path.
- After fenced processing, if `collectedActions.length === 0`, calls `parseTopLevelFileActionsObjectPayload(rawOutput)` and appends any results.
- Fallback does not run when fenced blocks were already found (even if they produced no valid actions — fail closed in that case).
- `textOutput` behavior is minimal and unchanged: fallback JSON is not stripped from the text output.

### Validation behavior (unchanged)

- `delete` actions still parse with `path` only, no `content` required.
- Non-delete actions (`create`, `write`, `update`) still require `content`; missing content is silently rejected.
- All unsafe paths (path traversal, absolute paths, Windows drive paths, null bytes, tilde paths) are still rejected by the existing `normalizeAndValidatePath` function.
- Malformed JSON returns `[]` with no crash.

### `file-actions.parser.spec.ts`

Added 7 focused tests for the fallback path:

1. Raw JSON `{"file-actions":[{"action":"delete","path":"foo.html"}]}` extracts a delete action.
2. Raw JSON with valid `write` action and `content` extracts correctly.
3. Raw JSON non-delete action missing `content` is rejected (no action extracted).
4. Malformed raw JSON (truncated) does not crash and extracts no actions.
5. Raw JSON with unsafe path `../escape.ts` extracts no action.
6. Raw JSON object without `"file-actions"` key extracts no action.
7. When a fenced block is present alongside raw JSON in the same output, fenced block wins and fallback does not run.

All 5 pre-existing tests pass unchanged.

---

## Validation

From `C:\Users\knlee\aiSandBox2026B\services\ai-service`:

| Check | Result |
|---|---|
| `npm run build` | Passed — clean TypeScript build |
| `npx jest "src/ai-execution/__tests__/file-actions.parser.spec.ts" --runInBand` | Passed — 13/13 tests |
| `ReadLints` on both touched files | No linter errors |
| `git status -- services/ai-service` | Only `file-actions.parser.ts` and `file-actions.parser.spec.ts` modified |

---

## Scope Confirmation

| Area | Changed? |
|---|---|
| Frontend | No |
| Backend / API gateway | No |
| Container-manager | No |
| File-action apply logic | No |
| Confirmation UI | No |
| Preview routing | No |
| Named file read / search | No |
| Broader AI / tooling behavior | No |
| `worker.processor.ts` prompt wording | No |

---

## Preserved Invariants

- Fenced `` ```file-actions `` block contract remains the primary expected model format.
- Fallback does not parse arbitrary prose as actions — it requires the entire trimmed output to be valid JSON with a specific shape.
- Path safety is fully delegated to the existing `normalizeAndValidatePath` function — not loosened.
- Delete remains risky/confirmation-gated downstream as established by AI-WS-02.
- Frontend apply and confirmation semantics are unchanged.
- No new action types introduced beyond the existing `create`, `write`, `update`, `delete` set from AI-WS-03.
