# AUTH-MODULE-01E Checkpoint

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-01E |
| Title | AI Prompt Recognition & UX Polish |
| Parent | AUTH-MODULE-01 — Reusable App-Auth Module for aiSandBox-Created Apps |
| Family | AUTH |
| Status | COMPLETE and LOCKED |
| Priority | Medium |
| Risk | Medium |
| Model | GPT-5.3 Codex |
| Depends on | AUTH-MODULE-01D (COMPLETE and LOCKED — `docs/AUTH-MODULE-01D-CHECKPOINT.md`) |
| Completed | 2026-05-19 |

---

## Objective

Detect when a user's chat prompt expresses auth module intent ("add authentication", "add login", "add signup", etc.) and route it to the `handleInstallAuthModule` flow instead of raw AI generation. Add chat-thread messaging for install progress and completion.

---

## Files Created

| File | Purpose |
|---|---|
| `frontend/lib/auth-module/auth-module-intent.ts` | `detectAuthModuleIntent(prompt: string): boolean` — two-phase intent recognition |
| `frontend/lib/auth-module/auth-module-intent.test.ts` | Unit tests for intent detection: positive prompts and false-positive guardrails |

---

## Files Changed

| File | Change summary |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Added auth-module intercept in `handleSubmitChatPrompt`; refined `handleInstallAuthModule` completion summary |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added test coverage for auth-module prompt routing |

---

## Intent Recognition Summary

**Function:** `detectAuthModuleIntent(prompt: string): boolean`

**Logic — strict two-phase:**

1. **Negative blocklist (evaluated first):** Rejects prompts containing terms that indicate the user is working on the platform itself rather than their generated app (e.g., `platform`, `aisandbox`, `sandbox auth`, `session cookie`, `csrf`, `api key`, `jwt guard`, `oauth provider`). Any blocklist match returns `false` immediately.

2. **Positive match (evaluated second):** Requires both:
   - An action verb present: `add`, `install`, `set up`, `setup`, `integrate`, `implement`, `enable`, `configure`
   - An auth subject present: `auth`, `authentication`, `login`, `log in`, `sign in`, `signin`, `signup`, `sign up`, `register`, `registration`, `user account`, `user management`

Both conditions must be satisfied for the function to return `true`.

**Design intent:** Strict two-phase logic prioritizes a low false-positive rate. The intent detector will not intercept ambiguous or unrelated prompts.

---

## Chat Routing Summary

**Location:** `handleSubmitChatPrompt` in `frontend/app/[locale]/app/page.tsx`

**Intercept placement:**
- After `trimmedPrompt` empty guard
- Before `setChatRequestState('submitting')`
- Before all orchestrated and non-orchestrated AI paths

**Intercept behavior when `detectAuthModuleIntent` returns `true`:**
- Appends the user message to the chat thread
- Does not append a normal empty assistant placeholder
- Calls `await handleInstallAuthModule()`
- Returns immediately — AI generation paths are not reached

---

## UX Messaging Summary

**Immediate assistant status message (on intercept):**
```
Installing auth module — preparing your workspace...
```

**Refined completion summary surfaced in chat thread (on success):**
```
Auth module installed. Run the following to finish setup:

  npm install
  # Copy .env.example to .env and fill in your database URL and AUTH_SECRET
  npx prisma migrate dev --name init

Then start your dev server and see SETUP-AUTH.md for full instructions.
```

**Pre-flight failure behavior:** Preserved from AUTH-MODULE-01D. If eligibility check fails, the existing failure messaging is displayed.

---

## UX/UI Advisory Note

Impeccable and Emil Kowalski design principles were applied lightly and only to chat-message clarity and restraint. The trigger is quiet:

1. User message appears in the chat thread
2. Clear assistant status message appears immediately
3. Existing `handleInstallAuthModule` confirmation flow continues

No new interaction model was introduced. No banners, modals, toasts, animations, or layout changes were made.

---

## Tests Added

**File:** `frontend/lib/auth-module/auth-module-intent.test.ts`

**Coverage:**
- Supported positive prompts: `add authentication`, `add login`, `add signup`, `install auth`, `set up authentication`, `add user accounts`, `enable login`, `implement sign in`, `add registration`, `add user management`
- False-positive guardrails: platform-auth prompts, unrelated prompts (styling, dark mode, API endpoints, database queries, performance, tests), short/empty inputs

**File:** `frontend/components/workspace/workspace-shell.test.tsx`

**Coverage:** Auth-module prompt routing — verifies intercept fires for matched prompts and that AI generation paths are not reached.

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` (from `frontend/`) | PASS |
| `npm test` (from `frontend/`) | PASS — 437 tests, 437 passed, 0 failed, 38 suites |
| `npm run build` (from `frontend/`) | PASS |
| `ReadLints` on all touched files | PASS — 0 linter errors |
| Post-build git status | Only intended implementation files modified |

**Post-build git status (confirmed):**
```
M  frontend/app/[locale]/app/page.tsx
M  frontend/components/workspace/workspace-shell.test.tsx
?? frontend/lib/auth-module/auth-module-intent.test.ts
?? frontend/lib/auth-module/auth-module-intent.ts
```

---

## Non-Goals Confirmed

- No AUTH-MODULE-01Z implementation
- No backend or API changes
- No platform authentication changes
- No generated app template changes
- No dependency installation
- No migration execution
- No broad chat UI redesign
- No route or platform auth changes
- No i18n file changes

---

## Invariants Preserved

- `handleInstallAuthModule` pre-flight failure behavior unchanged
- Existing orchestrated and non-orchestrated AI paths not modified
- No aiSandBox platform auth references introduced in generated content
- No new dependencies added
- No architectural boundaries crossed
- All prior AUTH-MODULE-01A through AUTH-MODULE-01D checkpoints remain valid

---

## Carry-Forwards

None. All acceptance checks for AUTH-MODULE-01E satisfied.

---

## Next Task

**AUTH-MODULE-01Z — Validation & Consolidation (ACTIVE)**

Run the full validation pass across all child slices (01A–01E), execute the manual smoke checklist, create `docs/AUTH-MODULE-01Z-CHECKPOINT.md` and `docs/AUTH-MODULE-01-CHECKPOINT.md`, and close AUTH-MODULE-01 as COMPLETE and LOCKED.
