# AGENT-PLATFORM-CREATE-01B — Implementation Document

**Task ID:** AGENT-PLATFORM-CREATE-01B
**Step:** 3 — Implementation / Create Agent MVP UI + Validation
**Status:** COMPLETE
**Date:** 2026-07-20
**Nature:** Frontend-only implementation — no backend, migration, entity, schema, runtime, Docker, or DB work

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-CREATE-01B |
| Title | Create Agent MVP UI |
| Family | AGENT PLATFORM / AGENT CREATION / FRONTEND UX + API INTEGRATION |
| Priority | CRITICAL |
| Nature | HIGH-RISK FRONTEND UX/UI + API INTEGRATION — 4-step workflow |
| Risk | HIGH |
| Step | 3 — Implementation |
| Keith Approval | "go" — 2026-07-20 |
| Predecessor | AGENT-PLATFORM-CREATE-01A — COMPLETE and LOCKED — 2026-07-20 |

---

## 2. Implementation Summary

Implemented the Create Agent MVP UI on `/[locale]/platform` as a frontend-only slice. The implementation adds:

- A "Your Agents" section within the existing station grid area, visually separated from the 4 static system agents.
- A "Create Agent" CTA button that opens an inline form in the detail panel area.
- A 3-field create form (name, role, description) with frontend validation matching backend constraints.
- Mocked frontend API integration via `useUserAgents` hook (`GET /api/agents`, `POST /api/agents`) with `credentials: 'include'`.
- Loading, empty, success, validation error, and API error states.
- User-created agents displayed in their own grid below static agents with distinct status badges.
- User-created agent detail in the existing detail panel with `isUserCreated` flag distinguishing them from static and coming-soon agents.
- 28 new translation keys across all 3 locale files (`platform.agentCreate.*` namespace).
- Heroicons v2 Outline only (`PlusIcon`, `UserGroupIcon`, `CheckCircleIcon`, `ExclamationTriangleIcon`, `XMarkIcon`).
- 26 new tests across 2 test files (16 platform-dashboard + 10 hook tests).

---

## 3. Files Inspected

| # | Path | Method |
|---|------|--------|
| 1 | `TASKS.md` | Read — section 4 extracted |
| 2 | `TASKS_BACKLOG_FULL.md` | Read — sections extracted |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Read — full |
| 4 | `docs/AGENT-PLATFORM-CREATE-01B-STAGE-START.md` | Read — full |
| 5 | `docs/AGENT-PLATFORM-CREATE-01A-CHECKPOINT.md` | Read — full |
| 6 | `docs/AGENT-PLATFORM-RPG-03B-CHECKPOINT.md` | Read — full |
| 7 | `docs/AGENT-PLATFORM-RPG-03A-CHECKPOINT.md` | Read — full |
| 8 | `frontend/components/platform/platform-dashboard.tsx` | Read — full |
| 9 | `frontend/components/platform/agent-detail-panel.tsx` | Read — full |
| 10 | `frontend/components/platform/agent-station-card.tsx` | Read — full |
| 11 | `frontend/components/platform/platform-dashboard.test.ts` | Read — full |
| 12 | `frontend/hooks/useBillingData.ts` | Read — full (Pattern B reference) |
| 13 | `frontend/lib/agent-platform/agent-registry.ts` | Read — full |
| 14 | `frontend/messages/en.json` | Read — platform section |
| 15 | `frontend/messages/zh-TW.json` | Read — platform section |
| 16 | `frontend/messages/zh-CN.json` | Read — platform section |

---

## 4. Files Created

| # | Path | Purpose |
|---|------|---------|
| 1 | `frontend/hooks/useUserAgents.ts` | Custom hook for `GET /api/agents` and `POST /api/agents` with `credentials: 'include'` |
| 2 | `frontend/hooks/useUserAgents.test.ts` | Hook API contract tests with mocked fetch (10 tests) |
| 3 | `frontend/components/platform/create-agent-form.tsx` | Create Agent inline form component with validation |
| 4 | `docs/AGENT-PLATFORM-CREATE-01B-IMPLEMENTATION.md` | This implementation document |

---

## 5. Files Modified

| # | Path | Change |
|---|------|--------|
| 5 | `frontend/components/platform/platform-dashboard.tsx` | Added "Your Agents" section, Create Agent CTA, form toggle state, user agent fetch via `useUserAgents`, user agent station cards, user agent detail panel rendering, Create Agent form integration, AUTH_EXPIRED redirect |
| 6 | `frontend/components/platform/agent-detail-panel.tsx` | Added `isUserCreated` optional flag to `AgentDetailViewModel`; added user-created agent status badge (indigo); added user-created agent bottom section (distinct from Builder CTA and Coming Soon) |
| 7 | `frontend/components/platform/platform-dashboard.test.ts` | Added 16 new tests: translation key resolution (2), API contract (4), static agents preservation (2), user agent display (2), validation rules (6) |
| 8 | `frontend/messages/en.json` | Added `platform.agentCreate.*` keys (28 keys) |
| 9 | `frontend/messages/zh-TW.json` | Added `platform.agentCreate.*` keys (28 keys) |
| 10 | `frontend/messages/zh-CN.json` | Added `platform.agentCreate.*` keys (28 keys) |

Total: 4 files created + 6 files modified = 10 files (within safe slice boundary).

---

## 6. Create Agent UX Implementation

- **Entry point:** "Create Agent" CTA button in the "Your Agents" subsection of the stations grid area. Also available in the empty state.
- **Form location:** Inline in the detail panel area (right side on desktop, below on mobile). Replaces the agent detail panel when the form is open.
- **Form fields:** name (text, max 100), role (text, max 200), description (textarea, max 2000).
- **Form behavior:** Submit calls `POST /api/agents` with only `{ name, role, description }`. On success, shows green success banner, closes after 1.2s, refetches user agents list. On error, shows inline error.
- **RPG command-center style preserved:** Form uses `slate-900/950` dark theme, `indigo` accent colors, same heading pattern as existing detail panel.
- **Selection handling:** Static agent selection, user agent selection, and create form are mutually exclusive — opening one clears the others.

---

## 7. Form Validation

| Field | Required | Max Length | Frontend Validation |
|-------|----------|-----------|---------------------|
| `name` | YES | 100 | Non-empty check + max-length check |
| `role` | YES | 200 | Non-empty check + max-length check |
| `description` | YES | 2000 | Non-empty check + max-length check |

Validation errors display inline below each field with `role="alert"` for accessibility. Backend 400 errors shown as general form error. Backend 401 triggers redirect to login.

Fields NOT exposed: `userId`, `status`, `initials`, `id`, `createdAt`, `updatedAt`, `deletedAt`, tool permissions, knowledge scopes, skills, referral rules, approval rules.

---

## 8. API Integration

### `useUserAgents` hook (Pattern B — following `useBillingData` convention)

- **`GET /api/agents`:** Called on mount with `credentials: 'include'`. Returns `{ agents, loading, error, refetch }`.
- **`POST /api/agents`:** Via `createAgent(dto)` function. Sends only `{ name, role, description }`. Uses `credentials: 'include'`, `Content-Type: application/json`.
- **Auth handling:** 401 responses set `AUTH_EXPIRED` error; dashboard effect redirects to `/${locale}/login`.
- **Error handling:** Network/500 errors set `FETCH_FAILED`; 400 errors parse backend `message` array.
- **Refetch:** After successful create, automatically refetches the agent list.

---

## 9. User-Created Agents Display

- User-created agents appear in a "Your Agents" subsection below the static system agents grid.
- Each user agent renders using the existing `AgentStationCard` component.
- Status badges: Active (green, same as Builder), Draft (gray), Disabled (gray) — NOT "Coming Soon" (amber).
- User agents are selectable — clicking opens the detail panel with their data.
- Detail panel for user agents: shows name, role, description, status in an indigo-themed badge. No "Start Building" CTA. No "Coming Soon" messaging.
- `UserGroupIcon` from Heroicons v2 Outline as section icon.

---

## 10. Static System Agents Preservation

- `agent-registry.ts` is NOT modified.
- `listAgents()` continues to return exactly 4 static agents: builder, chief-of-staff, product-strategy, technology-advisor.
- Builder Agent retains "Start Building" CTA and active status.
- Coming-soon agents retain coming-soon detail messaging.
- Static agents rendered using existing `nameKey`/`roleKey`/`descriptionKey` translation keys — unchanged.
- Static agent selection and user agent selection are mutually exclusive.

---

## 11. Loading / Empty / Success / Error States

| State | Implementation |
|-------|---------------|
| Auth loading | Existing full-page loading state (`"common.loading"`) — unchanged |
| User agents loading | "Your Agents" section shows compact loading block with `loadingLabel` text |
| User agents empty | Empty-state card with `UserGroupIcon`, translated empty title/body, "Create Agent" CTA |
| User agents error | Error card with `ExclamationTriangleIcon`, translated error message, "Retry" button |
| Auth expired (list) | Redirect to `/${locale}/login` |
| Create submitting | Submit button shows disabled state with "Creating..." text; inputs disabled |
| Create success | Green success banner with `CheckCircleIcon`; auto-close after 1.2s; list refetches |
| Create validation error | Inline field-level errors below each field with `role="alert"` |
| Create API error | Red error banner with `ExclamationTriangleIcon` and translated error message |
| Auth expired (create) | Redirect to `/${locale}/login` |

---

## 12. Multilingual / i18n Changes

Added 28 keys per locale under `platform.agentCreate.*`:

- Section: `sectionTitle`, `sectionSubtitle`
- CTA: `createButton`
- Form: `formTitle`, `nameLabel`, `namePlaceholder`, `roleLabel`, `rolePlaceholder`, `descriptionLabel`, `descriptionPlaceholder`, `submitButton`, `cancelButton`, `submitting`
- Validation: `nameRequired`, `nameTooLong`, `roleRequired`, `roleTooLong`, `descriptionRequired`, `descriptionTooLong`
- Status: `createError`, `loadError`, `retry`, `createSuccess`
- Empty state: `emptyTitle`, `emptyBody`
- Agent status labels: `agentStatusActive`, `agentStatusDraft`, `agentStatusDisabled`

All 3 locale files updated:
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

No hardcoded English UI copy.

---

## 13. Heroicons Usage

All new icon usage is Heroicons v2 Outline only (`@heroicons/react/24/outline`):

| Icon | Usage |
|------|-------|
| `PlusIcon` | Create Agent CTA buttons |
| `UserGroupIcon` | "Your Agents" section icon and empty state |
| `CheckCircleIcon` | Success state indicator in form |
| `ExclamationTriangleIcon` | Error state indicators (form and list) |
| `XMarkIcon` | Cancel/close form button |

No Lucide, Font Awesome, Material Icons, or emoji icons.

---

## 14. Accessibility / Responsive Notes

- Form fields have associated `<label>` with `htmlFor` matching input `id`.
- Required fields have `required` and `aria-required="true"` attributes.
- Validation errors associated via `aria-describedby` on inputs.
- Submit and cancel buttons are keyboard-focusable with visible focus rings.
- Success and error banners use `role="alert"` for screen reader announcement.
- Station cards for user agents use same `<button>` pattern with `aria-pressed` as static agents.
- Existing responsive grid handles layout at desktop and ~390px mobile — no layout changes needed.
- Form inputs are full-width; textarea has 4-row default height.

---

## 15. Tests Added / Updated

### `frontend/components/platform/platform-dashboard.test.ts` — 16 new tests (11 existing → 27 total)

| # | Category | Test |
|---|----------|------|
| 1 | Translation | All `platform.agentCreate.*` keys resolve in all 3 locales |
| 2 | Translation | No agentCreate keys are empty strings |
| 3 | API contract | GET /api/agents list response shape matches expected interface |
| 4 | API contract | POST /api/agents request body contains only name, role, description |
| 5 | API contract | POST /api/agents response shape matches expected interface |
| 6 | API contract | Empty agent list returns `{ agents: [] }` |
| 7 | Static preservation | `listAgents()` still returns exactly 4 static agents |
| 8 | Static preservation | Builder agent is still active and enabled |
| 9 | User agent display | User agent status is in allowed values |
| 10 | User agent display | User agent does not expose userId field |
| 11 | Validation | Empty name triggers validation error |
| 12 | Validation | Name > 100 chars triggers validation error |
| 13 | Validation | Empty role triggers validation error |
| 14 | Validation | Role > 200 chars triggers validation error |
| 15 | Validation | Empty description triggers validation error |
| 16 | Validation | Description > 2000 chars triggers validation error |

### `frontend/hooks/useUserAgents.test.ts` — 10 new tests

| # | Category | Test |
|---|----------|------|
| 1 | GET | `GET /api/agents` is called with `credentials: 'include'` |
| 2 | GET | Returns agents array on success |
| 3 | GET | Returns empty array when no user agents |
| 4 | GET | Error state on fetch failure |
| 5 | POST | Sends only name, role, description |
| 6 | POST | Uses `credentials: 'include'` |
| 7 | POST | Returns created agent on success |
| 8 | POST | Returns error on 400 validation failure |
| 9 | POST | Handles 401 correctly |
| 10 | POST | No userId/ownerId/deletedAt in request body |

Total: 26 new tests.

---

## 16. Validation Commands

```powershell
# 1. TypeScript type check
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit

# 2. Platform-dashboard tests
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsx --test components/platform/platform-dashboard.test.ts

# 3. useUserAgents hook tests
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsx --test hooks/useUserAgents.test.ts

# 4. Full frontend test suite (regression)
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npm test -- platform

# 5. Build check
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build

# 6. Restore build artifact
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo

# 7. ReadLints on all touched files
```

---

## 17. Validation Results

| # | Command | Exit Code | Result |
|---|---------|-----------|--------|
| 1 | `npx tsc --noEmit` | 0 | No TypeScript errors |
| 2 | `npx tsx --test components/platform/platform-dashboard.test.ts` | 0 | 7 suites, 27 tests, 27 pass, 0 fail |
| 3 | `npx tsx --test hooks/useUserAgents.test.ts` | 0 | 1 suite, 10 tests, 10 pass, 0 fail |
| 4 | `npm test -- platform` | 0 | 53 suites, 641 tests, 641 pass, 0 fail (full existing suite — no regressions) |
| 5 | `npm run build` | 0 | Compiled successfully — non-blocking Browserslist staleness warning only |
| 6 | `git restore -- frontend/tsconfig.tsbuildinfo` | 0 | Build artifact restored |
| 7 | ReadLints on 9 touched files | — | 0 linter errors |

---

## 18. Deferred Live Migration / Runtime Smoke Note

- CREATE-01A migration exists but has NOT been executed: `services/api-gateway/src/migrations/1772500000000-CreateUserAgentsTable.ts`
- CREATE-01B did NOT execute this migration.
- The `user_agents` table does not exist in any database.
- Full live Create Agent smoke (authenticated `GET /api/agents`, `POST /api/agents`, round-trip display, cross-user isolation) remains deferred until Docker/PostgreSQL/migration execution and backend runtime are available.
- This implementation uses mocked frontend tests only. No live API or browser smoke was performed.
- Do not claim live DB-backed Create Agent flow is verified.

---

## 19. Non-Goals Preserved

| # | Non-Goal |
|---|----------|
| 1 | Backend Create Agent changes |
| 2 | New migrations |
| 3 | Migration execution |
| 4 | DB schema changes |
| 5 | Update/delete agent endpoints |
| 6 | Advanced Create Agent config |
| 7 | Tool permission config |
| 8 | Knowledge scope config |
| 9 | Skills config |
| 10 | Referral rules config |
| 11 | Approval rules config |
| 12 | Agent execution |
| 13 | AI provider calls |
| 14 | Billing/payment/provider/customer portal/webhook work |
| 15 | Stripe work |
| 16 | B3 full-stack smoke |
| 17 | Production deployment |
| 18 | Public beta launch |
| 19 | Walking character / pixel-art / sprite / game engine |
| 20 | Avatar upload |
| 21 | Broad platform dashboard redesign |
| 22 | Broad navigation redesign |
| 23 | Broad auth/session redesign |
| 24 | Package/dependency upgrades |
| 25 | Static registry mutation |
| 26 | `GET /api/agents/:id` usage |

---

## 20. Safety Confirmations

- [x] No backend/API Gateway files were modified.
- [x] No migration/entity/schema files were modified.
- [x] No ai-service/container-manager/billing/payment/provider/Stripe/webhook files were modified.
- [x] No package/dependency/environment/Docker files were changed.
- [x] No runtime, Docker, DB, browser, live API call, provider, payment, Stripe CLI, webhook, git commit, or git push occurred.
- [x] No secret-bearing environment file was opened.
- [x] No subagents were used.
- [x] `agent-registry.ts` was NOT modified — static agents unchanged.
- [x] Auth guard behavior from RPG-03B preserved exactly.
- [x] Builder CTA and coming-soon behavior preserved exactly.
- [x] All locked tasks remain locked and unmodified.
- [x] TASKS.md was NOT modified.
- [x] TASKS_BACKLOG_FULL.md was NOT modified.
- [x] docs/AINOW-EXECUTION-ROADMAP.md was NOT modified.
- [x] B3 was NOT registered.

---

## 21. Exact Next Action

**AGENT-PLATFORM-CREATE-01B Step 4 — Consolidation / Checkpoint.**

Step 4 should:
1. Create `docs/AGENT-PLATFORM-CREATE-01B-CHECKPOINT.md`
2. Update `TASKS.md` — AGENT-PLATFORM-CREATE-01B COMPLETE and LOCKED
3. Update `TASKS_BACKLOG_FULL.md` — mirrored
4. Update `docs/AINOW-EXECUTION-ROADMAP.md` — entry updated
5. Not modify any source, test, translation, package, migration, or environment files
6. Not register B3 or any new task without Keith explicit approval
