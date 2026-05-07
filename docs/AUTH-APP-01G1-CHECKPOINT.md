# AUTH-APP-01G1 Checkpoint — Auth UX Inventory + Scope

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01G1 |
| Title | Auth UX Inventory + Scope |
| Family | AUTH |
| Parent | AUTH-APP-01G (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | DOCUMENTATION / SPEC ONLY — no production source files changed |
| Date | 2026-05-07 |
| Depends on | AUTH-APP-01F4 (COMPLETE and LOCKED) |
| Spec document | `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` |

---

## Objective

Produce an inventory and implementation scope for auth UX integration now that password login, Google OAuth, Apple OAuth, cookie sessions, and protected routes are all in place. Decide the precise boundaries for AUTH-APP-01G2 and AUTH-APP-01G3 before any UX code is written.

---

## Files Changed

| File | Change |
|---|---|
| `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` | Created — 14-section auth UX scope and inventory spec |
| `docs/AUTH-APP-01G1-CHECKPOINT.md` | Created — this document |
| `TASKS.md` | Updated — AUTH-APP-01G1 marked COMPLETE and LOCKED; AUTH-APP-01G2 registered as next |
| `TASKS_BACKLOG_FULL.md` | Updated — AUTH-APP-01G1 marked COMPLETE and LOCKED |

**No production source files were changed. No frontend or backend behavior was altered.**

---

## Spec Document

**Path:** `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md`

### Sections

| Section | Content |
|---|---|
| 1. Purpose | Inventory-only; G2/G3/G4 child slice assignments stated |
| 2. Prerequisite state | 9 locked prerequisites tabulated with checkpoint references |
| 3. Login page inventory | Password flow, OAuth links, states, i18n coverage, token consistency, OAuth error gap |
| 4. Register page inventory | Password flow, success-stays-on-page behavior, OAuth links, states, i18n, tokens |
| 5. OAuth error gap | Backend emits `?error=oauth_failed`/`?error=account_conflict`; frontend does not consume; provider-agnostic copy required; Suspense constraint noted |
| 6. Logout gap | Complete absence confirmed; backend `POST /api/auth/logout` ready; `handleWorkspaceUnauthorizedAccess` reuse pattern noted |
| 7. Account surface state | `PROJECT_FIRST_UX` flag behavior; keys page token gap deferred; G3 minimum scope defined |
| 8. UX-IA-02 token/design gaps | Per-surface table; keys page deferred; scope protection rule |
| 9. UX/UI advisory skill usage | Permitted usage table; hard constraints enumerated |
| 10. G2 bounded scope | File list; 4 changes; non-goals |
| 11. G3 bounded scope | File list; 3 changes; pre-implementation inspection requirement; split rule |
| 12. G4 validation scope | Automated checks; 3 targeted test cases; 10-item manual smoke checklist |
| 13. Risks and open questions | 9 risks tabulated |
| 14. Non-goals | 14 explicit exclusions |

---

## Key Findings

### OAuth error gap (critical)
The backend `auth.controller.ts` redirects failed OAuth attempts to `/${locale}/login?error=oauth_failed` or `?error=account_conflict`. The login page does not read the `?error` query param. The `errors.oauthFailed` and `errors.accountConflict` i18n keys are translated in all three locales but are never rendered. Users receive no visual feedback after an OAuth failure.

### Logout complete absence
No frontend component calls `POST /api/auth/logout`. The backend endpoint is fully implemented. Two orphaned i18n keys (`account.logout`, `sandbox.logout`) exist in all three locales but are never rendered. Users cannot manually log out.

### Account surface
`/account` is effectively a redirect to `/keys` (or an alias when `PROJECT_FIRST_UX=true`). No profile, email, or auth-provider section exists.

### `errors.oauthFailed` is Google-specific
Current text: "Sign in with Google failed. Please try again." Apple OAuth failures also use `oauth_failed`. Must be made provider-agnostic in G2.

### Keys page has zero design tokens
`frontend/app/[locale]/keys/page.tsx` uses raw Tailwind classes throughout — predates UX-IA-02. Deferred; out of G2/G3 scope.

---

## G2/G3/G4 Boundaries (Locked)

### AUTH-APP-01G2 — Login/Register OAuth Error + Button Polish

**Files in scope:**
- `frontend/app/[locale]/login/page.tsx`
- `frontend/app/[locale]/register/page.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

**Changes:**
1. Consume `?error=oauth_failed` and `?error=account_conflict` query params on login page
2. Render in existing error div pattern using `errors.*` i18n keys
3. Make `errors.oauthFailed` provider-agnostic in all three locales
4. Minimal OAuth button polish (advisory-driven, bounded)
5. Decide register success behavior at G2 stage-start

**Non-goals:** no backend changes, no account surface, no logout, no full redesign

### AUTH-APP-01G3 — Logout + Basic Account Surface

**Files likely in scope:**
- `frontend/app/[locale]/app/page.tsx`
- `frontend/app/[locale]/account/page.tsx`
- `frontend/components/auth/logout-button.tsx` (possibly new)
- `frontend/messages/*.json` (if new keys needed)

**Changes:**
1. Logout button calls `POST /api/auth/logout`; redirects to `/${locale}/login`
2. Reuse `handleWorkspaceUnauthorizedAccess()` pattern for state clearing
3. Minimal account/auth info if achievable without restructuring

**Pre-implementation requirement:** Inspect `app/page.tsx` at stage-start to locate account/user menu before implementation. Split to G3a/G3b if logout + account surface is too large.

### AUTH-APP-01G4 — Validation + Checkpoint

- `npx tsc --noEmit`, `npm run build`, `npm test`
- Targeted tests for OAuth error display
- 10-item manual smoke checklist (see spec Section 12)
- Create `docs/AUTH-APP-01G-CHECKPOINT.md`
- Update `TASKS.md` and `TASKS_BACKLOG_FULL.md`

---

## UX/UI Advisory Skill Constraints (Locked)

- Impeccable and Emil Kowalski skills are **advisory-only** in G2 and G3
- Skills return bounded observations; each must be explicitly accepted or rejected before implementation
- Skills **cannot edit files**
- Skills **cannot override** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, registered scope, architecture, or tests
- Any skill observation outside G2/G3 scope is recorded for a future task, not absorbed

---

## Risks and Open Questions

| Risk | Target |
|---|---|
| `useSearchParams` Suspense requirement in Next.js App Router | G2 stage-start |
| Provider-agnostic `errors.oauthFailed` wording decision | G2 |
| Google callback hardcodes `oauth_failed` regardless of error type (backend note, no change) | G2 documentation only |
| Register success behavior — auto-redirect vs. stay-on-page decision | G2 stage-start |
| Logout placement in large `app/page.tsx` — inspect before committing | G3 stage-start |
| `PROJECT_FIRST_UX` flag — `/account` behavior differs; G3 must handle both paths | G3 |
| Keys page raw Tailwind classes — pre-existing, out of G2/G3 scope | Deferred |
| `login.testCredentials` dead key — orphaned in all three locales | Deferred |
| `register.name` dead key — orphaned in all three locales | Deferred |

---

## Validation Performed

| Check | Result |
|---|---|
| Production source files changed | None — confirmed by `git status` |
| Frontend behavior changed | No |
| Backend behavior changed | No |
| Tests run | None — docs-only work; no source change |
| `git status` result | `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` new untracked; `TASKS.md` modified (registration); `TASKS_BACKLOG_FULL.md` modified (registration) |

---

## Non-Goals Confirmed

No OAuth backend changes · no email verification · no password reset · no transactional email · no route/API protection work · no workspace redesign · no Visual Edit Mode · no AUTH-MODULE-01 · no new dependencies · no keys page token migration · no full account redesign · no provider management UI

---

## Next Recommended Task

**AUTH-APP-01G2 — Login/Register OAuth Error + Button Polish**

Stage-start should:
1. Read this checkpoint and `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Sections 5 and 10
2. Optionally invoke Impeccable advisory-only for login/register audit
3. Decide: `useSearchParams` Suspense pattern
4. Decide: provider-agnostic `errors.oauthFailed` wording
5. Decide: register success behavior (auto-redirect vs. stay-on-page)
6. Implement bounded changes only

---

## Reference

- `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` — governing scope document for AUTH-APP-01G
- `docs/AUTH-APP-01-SPEC.md` — auth architecture decisions
- `docs/AUTH-APP-01F-CHECKPOINT.md` — route/API protection family summary
- `docs/UX-IA-02-CHECKPOINT.md` — design token definitions
- `docs/UX-IA-03-CHECKPOINT.md` — login/register polish prior state
- `TASKS.md` → AUTH-APP-01G1
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01G1
