# AUTH-MODULE-03B Checkpoint — Friendly Unsupported Message for Missing package.json

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-03B |
| Title | Friendly Unsupported Message for Missing package.json |
| Parent | AUTH-MODULE-03 — Auth Module Final Live Smoke Fixes |
| Family | AUTH |
| Status | COMPLETE and LOCKED |
| Nature | Frontend only |
| Date | 2026-05-22 |
| Depends on | AUTH-MODULE-03A (COMPLETE and LOCKED — `docs/AUTH-MODULE-03A-CHECKPOINT.md`) |
| Checkpoint | `docs/AUTH-MODULE-03B-CHECKPOINT.md` |

---

## Objective

Fix live smoke item 14: a blank or non-Next.js workspace produced a raw backend error string in the chat instead of a clear, actionable eligibility message. The fix routes the `package.json` read failure through the existing eligibility detection system and shows a user-friendly unsupported-project message.

---

## Root Cause

In `handleInstallAuthModule` (`frontend/app/[locale]/app/page.tsx`), the `package.json` read failure was handled as a terminal technical error:

```typescript
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  appendAssistantMessage(`Auth module installation failed: unable to read package.json (${detail}).`);
  return;
}
```

`readWorkspaceFile` throws `Error("File read failed (500)")` for any non-OK API response. A missing file on the container-manager returns HTTP 500 (not 404), so the catch block received `"File read failed (500)"` and surfaced it directly as a chat message.

This bypassed `detectAuthModuleEligibility`, which already accepts `packageJsonContent: string | null | undefined` and handles the `MISSING_PACKAGE_JSON` code with `eligible: false`. The detection machinery was in place; the call site was not using it correctly.

---

## Files Changed

| File | Nature | Change |
|---|---|---|
| `frontend/app/[locale]/app/page.tsx` | Source | 4 targeted edits (see below) |
| `frontend/components/workspace/workspace-shell.test.tsx` | Tests | 5 new assertions + 1 updated assertion |

No backend, API, template, or governance files were changed.

---

## package.json Read Failure Handling Summary

**Before:**

- `let packageJsonContent: string;`
- On read failure: appended raw error message and returned early
- `detectAuthModuleEligibility` never called for missing files

**After:**

- `let packageJsonContent: string | null = null;`
- On read failure: `packageJsonContent = null;` — no error surfaced
- Flow continues into `detectAuthModuleEligibility({ packageJsonContent: null, ... })`
- Returns `{ eligible: false, code: 'MISSING_PACKAGE_JSON' }`
- Ineligibility branch dispatches friendly message by code

This makes `package.json` read failure consistent with how `prisma/schema.prisma` and `.env.example` failures were already handled (catch → null → continue).

---

## Friendly Message Summary

Code-aware dispatch added to the `if (!eligibility.eligible)` branch:

```typescript
const unsupportedReasonMessage =
  eligibility.code === 'MISSING_PACKAGE_JSON' || eligibility.code === 'MALFORMED_PACKAGE_JSON'
    ? "This workspace doesn't look like a Next.js project yet. Create or open a Next.js project first, then try adding authentication again."
    : `Auth module installation is not available: ${eligibility.reason}`;
appendAssistantMessage(unsupportedReasonMessage);
```

| Code | Message shown |
|---|---|
| `MISSING_PACKAGE_JSON` | "This workspace doesn't look like a Next.js project yet. Create or open a Next.js project first, then try adding authentication again." |
| `MALFORMED_PACKAGE_JSON` | Same friendly message |
| `UNSUPPORTED_FRAMEWORK` | `Auth module installation is not available: Auth module installation currently supports Next.js projects only.` (unchanged) |

The `generateAuthModuleFileActions` call uses `packageJsonContent!` with a comment explaining the invariant — `eligible === true` is only returned by `detectAuthModuleEligibility` when `package.json` parsed successfully, guaranteeing non-null content at that point.

---

## UX/UI Advisory Note

Impeccable and Emil Kowalski principles were applied lightly for message clarity only:

- Message is concise (two sentences)
- No technical jargon — no mention of `package.json`, HTTP status codes, or "500"
- Actionable: tells the user what to do next
- No banners, modals, toasts, animations, or layout changes
- No i18n changes

---

## Tests Added / Updated

All in `frontend/components/workspace/workspace-shell.test.tsx` (source-code static analysis pattern):

| Test | Type |
|---|---|
| `handleInstallAuthModule does not surface raw package.json read failure text` | New — asserts old error string absent |
| `handleInstallAuthModule uses friendly unsupported-project message for missing package.json` | New — asserts friendly message present |
| `handleInstallAuthModule checks MISSING_PACKAGE_JSON eligibility code` | New — asserts code dispatch present |
| `handleInstallAuthModule checks MALFORMED_PACKAGE_JSON eligibility code` | New — asserts code dispatch present |
| `handleInstallAuthModule generates auth module file actions` | Updated — updated regex to match `packageJsonContent: packageJsonContent!` |

---

## Validation Results

| Check | Result |
|---|---|
| `frontend npx tsc --noEmit` | **PASS** |
| `frontend npm test` | **PASS — 443 tests, 443 passed, 0 failed** |
| `ReadLints` on touched files | **PASS — 0 new errors** |
| `frontend/tsconfig.tsbuildinfo` | Restored with `git restore` after tsc run — not committed |

---

## Live Verification PASS Evidence — Item 14

**Workspace:** Blank session with no `package.json` (files: `first-page.html`, `hello-ai-test.txt`, `index.html`, `new22.txt`, `page2.html`, `second-page.html`, `style.css`)

**Prompt typed:** "add authentication to my app"

| Check | Result | Evidence |
|---|---|---|
| Friendly message appeared | **PASS** | "This workspace doesn't look like a Next.js project yet. Create or open a Next.js project first, then try adding authentication again." |
| Raw error absent | **PASS** | "Auth module installation failed: unable to read package.json" not present in chat |
| No auth files created | **PASS** | File tree unchanged |
| No checkpoint created | **PASS** | Checkpoint panel unchanged |
| Source change needed | **No** | Implementation correct as shipped |

---

## Known Console Noise

Three `POST .../files/read 500 (Internal Server Error)` entries appear in the browser DevTools console after sending the auth intent prompt. These correspond to:

1. `package.json` read → 500 → caught, `packageJsonContent = null`
2. `prisma/schema.prisma` read → 500 → caught, `prismaSchemaContent = null`
3. `.env.example` read → 500 → caught, `dotEnvExampleContent = null`

All three are caught silently at the frontend layer. None surface as user-visible chat messages. This is pre-existing behavior for missing files in a blank workspace and is expected noise, not a regression.

---

## Non-Goals Confirmed

- No file-read API changes (no backend 404 vs 500 distinction introduced)
- No auth template changes
- No checkpoint redesign
- No new undo system
- No broad workspace history refactor
- No UI redesign (no banners, modals, toasts, animations)
- No i18n changes
- No AUTH-MODULE-03A changes

---

## Invariants Preserved

- `detectAuthModuleEligibility` logic and return types — unchanged
- `UNSUPPORTED_FRAMEWORK` ineligibility message — unchanged
- Dirty workspace package.json read path — unchanged (only the catch path was modified)
- `generateAuthModuleFileActions` signature — unchanged (non-null assertion at call site only)
- All existing checkpoint, revert, and file-action flows — unchanged
- No breaking changes to any API response shapes

---

## Reference

- `TASKS.md` → AUTH-MODULE-03B
- `TASKS_BACKLOG_FULL.md` → AUTH-MODULE-03B
- Parent: `docs/AUTH-MODULE-03-CHECKPOINT.md`
- Sibling: `docs/AUTH-MODULE-03A-CHECKPOINT.md`
