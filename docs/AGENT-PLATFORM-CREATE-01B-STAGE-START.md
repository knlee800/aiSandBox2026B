# AGENT-PLATFORM-CREATE-01B — Stage-Start / Frontend UX + API Integration Plan

**Task ID:** AGENT-PLATFORM-CREATE-01B
**Step:** 2 — Stage-Start / Frontend UX + API Integration Plan
**Status:** COMPLETE (planning/design only — no implementation)
**Date:** 2026-07-20
**Nature:** Read-only source inspection + design document creation

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
| Step 1 | COMPLETE — Registration — 2026-07-20 |
| Step 2 | This document — Stage-Start / Frontend UX + API Integration Plan — 2026-07-20 |
| Keith Approval | "go" — 2026-07-20 |
| Predecessor | AGENT-PLATFORM-CREATE-01A — COMPLETE and LOCKED — 2026-07-20 |
| B3 Status | Remains paused — not registered |

---

## 2. Stage-Start Purpose

This document answers all 31 stage-start questions, defines the exact UX pattern, form fields, API integration design, translation key plan, test strategy, and Step 3 file plan for the Create Agent MVP UI on `/[locale]/platform`.

This is design only. No implementation, no source, no tests, no translations, no runtime, no Docker, no DB, no browser, no API, no provider calls.

---

## 3. Files Inspected

### Governance / Checkpoint Documents

| # | File | Method |
|---|------|--------|
| 1 | `TASKS.md` | Read — sections extracted (file too large for single read) |
| 2 | `TASKS_BACKLOG_FULL.md` | Read — sections extracted (file too large for single read) |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Read — full |
| 4 | `docs/AGENT-PLATFORM-CREATE-01A-CHECKPOINT.md` | Read — full |
| 5 | `docs/AGENT-PLATFORM-CREATE-01A-STAGE-START.md` | Read — full |
| 6 | `docs/AGENT-PLATFORM-CREATE-01A-IMPLEMENTATION.md` | Read — full |
| 7 | `docs/AGENT-PLATFORM-RPG-03B-CHECKPOINT.md` | Read — full |
| 8 | `docs/AGENT-PLATFORM-RPG-03A-CHECKPOINT.md` | Read — full |
| 9 | `docs/AGENT-PLATFORM-RPG-MVP-RESET-CHECKPOINT.md` | Read — full |
| 10 | `docs/AGENT-PLATFORM-01-CHECKPOINT.md` | Read — full |

### Frontend Source Inspection (Read-Only)

| # | File / Pattern | Method |
|---|----------------|--------|
| 11 | `frontend/app/[locale]/platform/page.tsx` | Read — full |
| 12 | `frontend/components/platform/platform-dashboard.tsx` | Read — full |
| 13 | `frontend/components/platform/agent-detail-panel.tsx` | Read — full |
| 14 | `frontend/components/platform/agent-station-card.tsx` | Read — full |
| 15 | `frontend/components/platform/platform-dashboard.test.ts` | Read — full |
| 16 | `frontend/components/workspace/workspace-shell.tsx` | Read — partial (first 80 lines for pattern/import inspection) |
| 17 | `frontend/hooks/useBillingData.ts` | Read — full |
| 18 | `frontend/hooks/useTranslations.ts` | Read — full |
| 19 | `frontend/components/billing/billing-page-client.tsx` | Read — full |
| 20 | `frontend/lib/agent-platform/agent-registry.ts` | Read — full |
| 21 | `frontend/messages/en.json` | Read — platform and billing sections |
| 22 | `frontend/messages/zh-TW.json` | Read — platform section |
| 23 | `frontend/messages/zh-CN.json` | Read — platform section |
| 24 | `frontend/app/[locale]/login/page.tsx` | Read — first 60 lines for form pattern |
| 25 | Frontend fetch/API patterns | Grep — `fetch\(` across all .tsx files |

No `.env`, `.env.local`, secret, credential, key, certificate, or token files were opened.

---

## 4. Current Platform UI Structure

### Answer to Q1: What is the current `/[locale]/platform` component structure?

```
frontend/app/[locale]/platform/page.tsx          (server component — thin wrapper)
  └── frontend/components/platform/platform-dashboard.tsx   (client component — main surface)
        ├── frontend/components/platform/agent-station-card.tsx  (agent station card — button)
        └── frontend/components/platform/agent-detail-panel.tsx  (agent detail panel — sidebar)
```

Supporting files:

- `frontend/lib/agent-platform/agent-registry.ts` — static agent registry (`listAgents()`, `getAgentById()`, etc.)
- `frontend/lib/agent-platform/agent-registry.test.ts` — registry unit tests
- `frontend/components/platform/platform-dashboard.test.ts` — dashboard data+navigation integration tests

`page.tsx` is a thin server component that resolves `locale` from params and renders `<PlatformDashboard locale={locale} />`.

`PlatformDashboard` is a `'use client'` component that:
- Imports `listAgents()` from the static agent registry
- Imports locale messages directly (`en.json`, `zh-TW.json`, `zh-CN.json`)
- Uses `resolveNestedMessage()` to resolve translation keys
- Manages `selectedAgentId` state
- Manages `authReady` state (client-side auth guard)
- Renders: header, command-center status block, agent station grid, agent detail panel

`AgentStationCard` is a stateless button component. Each agent card is rendered with resolved translated name/role/description/status.

`AgentDetailPanel` renders a selected agent's full profile, capabilities, and CTA. Builder Agent has a "Start Building" link; coming-soon agents show disabled/future messaging.

---

## 5. Current Auth Guard Behavior

### Answer to Q5: How should the UI preserve the auth guard behavior from RPG-03B?

The auth guard was implemented in AGENT-PLATFORM-RPG-03B directly in `platform-dashboard.tsx`:

1. On mount, `useEffect` fires `fetch('/api/auth/me')`.
2. If the response is not OK, or `payload.id` is missing/invalid, `router.replace(`/${resolvedLocale}/login`)` redirects to login.
3. While checking, `authReady === false` and a loading state renders (`"common.loading"` key).
4. After successful auth, `authReady === true` and the dashboard renders.

**Step 3 must preserve this auth guard exactly.** The Create Agent form and user-agent API calls should only execute after `authReady === true`. No changes to the guard behavior. No backend auth redesign.

---

## 6. Current Frontend API/Fetch Convention

### Answer to Q6: What frontend fetch/API convention should Step 3 use?

Two API fetch patterns exist in the frontend:

**Pattern A — Direct fetch with `useEffect` (platform-dashboard.tsx, login/register pages):**
- `fetch('/api/...', { credentials: 'include' })` inside `useEffect`
- Manual `useState` for loading/error/data
- No abstraction layer

**Pattern B — Custom hook with `useCallback` + `useEffect` (useBillingData.ts):**
- Encapsulated in a custom hook (`useBillingData()`)
- Returns `{ data, loading, error, refetch }`
- Uses `credentials: 'include'` for cookie auth
- Error handling via try/catch

**Decision for Step 3:** Follow Pattern B — create a dedicated `useUserAgents` hook that:
- Fetches `GET /api/agents` on mount (via `credentials: 'include'`)
- Returns `{ agents, loading, error, refetch }`
- Exposes a `createAgent(dto)` function that calls `POST /api/agents`
- On successful create, refetches the list (or optimistically adds the new agent)

Rationale: The `useBillingData` pattern is the most recent and cleanest. A hook isolates API concerns from the component and simplifies testing with mocked fetch.

---

## 7. Proposed Create Agent UX Pattern

### Answer to Q2: Where should the Create Agent entry point live?

A "Create Agent" action should appear in the agent stations section of the existing platform dashboard. It should be a clearly visible button/CTA within or near the station grid.

### Answer to Q3: Should the form be inline, modal, drawer, or panel?

**Inline form panel within the detail panel area** — when no agent is selected, the detail panel shows an empty state. The "Create Agent" button should toggle the detail panel to a create-agent form view.

Rationale:
- The existing layout already has the stations grid on the left and the detail panel on the right.
- A form replaces the empty/detail state in the same panel space — no new layout surface, no modal, no drawer.
- This follows the existing pattern where the detail panel area serves as the contextual action surface.
- Modal/drawer would add new UI patterns not used elsewhere on this page.
- This preserves the RPG command-center layout from RPG-03A.

### Answer to Q4: How should the UI preserve the RPG command-center style?

- The create form renders inside the existing detail panel area (right side on desktop, below on mobile).
- The form uses the same `slate-900/950` dark theme, `indigo` accent colors, and restrained styling.
- The form header includes a Heroicons v2 Outline icon and uses the same `text-sm font-semibold uppercase tracking-wide` heading pattern.
- Form inputs use dark-themed styling consistent with the command-center surface.
- No broad visual redesign. Only the detail panel content changes when the form is open.

---

## 8. Form Fields and Validation Design

### Answer to Q8: What exact request body should the Create Agent form send?

Form fields and validation, matching the CREATE-01A API contract:

| Field | HTML Type | Required | Frontend Validation | Backend Validation |
|-------|-----------|----------|--------------------|--------------------|
| `name` | text input | YES | Non-empty, max 100 chars | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(100)` |
| `role` | text input | YES | Non-empty, max 200 chars | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `description` | textarea | YES | Non-empty, max 2000 chars | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(2000)` |
| `status` | NOT exposed | — | — | Defaults to `active` on backend |
| `initials` | NOT exposed | — | — | Auto-computed from name on backend |

**Decision on status and initials fields:**
- `status` is NOT exposed in the MVP form — defaults to `active`. Users do not need to choose `draft`/`disabled` during creation in MVP. Reduces form complexity.
- `initials` is NOT exposed in the MVP form — auto-computed from `name` on the backend (first letter of first two words, uppercased). If the user wants custom initials, that can be a future edit-agent feature.

**Fields NOT sent from client:**
- `userId` — from session only (backend-enforced)
- `id`, `createdAt`, `updatedAt`, `deletedAt` — server-managed

### Answer to Q20: How should backend constraints map to frontend validation?

| Backend Constraint | Frontend Validation |
|-------------------|---------------------|
| `name` `@IsNotEmpty()` `@MaxLength(100)` | Required field; show error if empty on submit; show char counter or error if > 100 |
| `role` `@IsNotEmpty()` `@MaxLength(200)` | Required field; show error if empty on submit; show char counter or error if > 200 |
| `description` `@IsNotEmpty()` `@MaxLength(2000)` | Required field; show error if empty on submit; show char counter or error if > 2000 |
| 400 response with `{ message: string[] }` | Parse `message` array for field-level errors; show general form error |
| 401 response | Auth expired — redirect to login (same as auth guard) |

---

## 9. API Integration Design

### Answer to Q7: What exact API calls should be made?

### Answer to Q9: What exact response shape should the UI expect?

**On page load (after auth guard passes):**

```
GET /api/agents
Headers: Cookie: aisandbox_session=...
Credentials: include
```

Response (200):
```json
{
  "agents": [
    {
      "id": "uuid",
      "name": "Research Assistant",
      "role": "Gathers and synthesizes information from multiple sources",
      "description": "A specialized agent...",
      "status": "active",
      "initials": "RA",
      "createdAt": "2026-07-20T10:30:00.000Z",
      "updatedAt": "2026-07-20T10:30:00.000Z"
    }
  ]
}
```

Empty state: `{ "agents": [] }`.

**On form submit:**

```
POST /api/agents
Headers: Cookie: aisandbox_session=...; Content-Type: application/json
Credentials: include
Body: { "name": "...", "role": "...", "description": "..." }
```

Response (201 Created):
```json
{
  "id": "uuid",
  "name": "...",
  "role": "...",
  "description": "...",
  "status": "active",
  "initials": "XX",
  "createdAt": "...",
  "updatedAt": "..."
}
```

Error (400):
```json
{
  "message": ["name must be shorter than or equal to 100 characters", ...],
  "error": "Bad Request",
  "statusCode": 400
}
```

Error (401):
```json
{
  "message": "Authentication required"
}
```

### Answer to Q14: Should Step 3 call `GET /api/agents/:id`, or only list/create for MVP?

**Only list and create for MVP.** The `GET /api/agents/:id` endpoint is available but not needed in MVP — the list response contains the full agent shape. No navigation to a dedicated agent detail page is implemented in MVP. The detail panel already receives all data from the list response.

---

## 10. User-Created Agents Display Design

### Answer to Q10: How should user-created agents be displayed?

User-created agents appear in a **separate "Your Agents" section** below the static system agents station grid. They are rendered using a variant of the existing `AgentStationCard` component or a compatible wrapper that accepts the API response shape directly.

Layout:
```
[Existing Station Grid — 4 static agents]

[Your Agents Section — user-created agents]
  [AgentStationCard for each user agent]
  [Create Agent CTA button if form is not open]
```

### Answer to Q11: How should user-created agents be visually distinct from static system agents?

- User-created agents use the same `AgentStationCard` component structure.
- Their status badge shows `Active` (green badge), `Draft` (gray/muted badge), or `Disabled` (gray badge) — NOT `Coming Soon` (amber), which is reserved for static system agents.
- User agents display their `initials` in the avatar circle (same as static agents).
- A subtle section heading (e.g., "Your Agents" / "您的代理" / "您的代理") separates user-created from static system agents.
- User agents are selectable — clicking opens the detail panel with their data.
- The detail panel for a user-created agent shows name, role, description, status. No "Start Building" CTA. No "Coming Soon" messaging. A simple profile view.

### Answer to Q12: How should static system agents remain unchanged?

Static system agents remain:
- Sourced from `listAgents()` in `agent-registry.ts`.
- Rendered exactly as they are now — using `nameKey`/`roleKey`/`descriptionKey` translation keys.
- Builder Agent retains "Start Building" CTA.
- Coming-soon agents retain coming-soon detail messaging.
- No changes to `agent-registry.ts`.
- No changes to how static agents render.

### Answer to Q13: How should the newly created agent appear after successful create?

After a successful `POST /api/agents`:
1. The form closes (returns to default detail panel state or shows the new agent's detail).
2. The user-agents list refetches via `GET /api/agents`.
3. The new agent appears in the "Your Agents" section.
4. Optionally, the new agent is auto-selected and its detail appears in the detail panel.

---

## 11. Static System Agents Preservation Plan

Static agents remain completely unmodified:

- `agent-registry.ts` is NOT modified.
- `listAgents()` continues to return the 4 static agents.
- Static agent rendering path in `platform-dashboard.tsx` is preserved.
- Static agents continue to use `nameKey`/`roleKey`/`descriptionKey` translation keys.
- Static agent detail panel behavior (Builder CTA, coming-soon messaging) is preserved.

The merge is display-level only:
1. `platform-dashboard.tsx` calls `listAgents()` for static agents (existing behavior).
2. `platform-dashboard.tsx` calls `useUserAgents()` for user-created agents (new behavior).
3. Both sets are rendered in their own sections.
4. No unified data model is needed — static agents have `AgentManifest` shape; user agents have the API response shape.

---

## 12. Loading / Empty / Success / Error States

### Answer to Q15: What loading states are needed?

| State | Trigger | UI |
|-------|---------|-----|
| Auth loading | Page mount, before auth probe resolves | Existing full-page loading state (`"common.loading"`) — unchanged |
| User agents loading | After auth passes, `GET /api/agents` in flight | "Your Agents" section shows a compact skeleton/shimmer (2–3 lines) or a small spinner with translated loading text |
| Create agent submitting | After form submit, `POST /api/agents` in flight | Submit button shows disabled state with spinner or "..." text; form inputs disabled during submission |

### Answer to Q16: What empty states are needed?

| State | Trigger | UI |
|-------|---------|-----|
| No user agents yet | `GET /api/agents` returns `{ agents: [] }` | "Your Agents" section shows a compact empty-state card with: icon, translated "You haven't created any agents yet" heading, translated "Create your first agent..." body, and a "Create Agent" CTA button |
| Detail panel empty | No agent (static or user) selected and form not open | Existing empty state — preserved from RPG-03A |

### Answer to Q17: What success states are needed?

| State | Trigger | UI |
|-------|---------|-----|
| Agent created | `POST /api/agents` returns 201 | Brief success feedback (green banner in the form area or auto-dismissing success indicator), form closes, list refetches, new agent appears in "Your Agents" section |

### Answer to Q18: What error states are needed?

| State | Trigger | UI |
|-------|---------|-----|
| List fetch failed | `GET /api/agents` fails (network error, 500, etc.) | "Your Agents" section shows a compact error card with translated error message and "Retry" button |
| Auth expired during fetch | `GET /api/agents` returns 401 | Redirect to `/${locale}/login` (same as auth guard) |
| Validation error on create | `POST /api/agents` returns 400 | Form shows inline validation errors per field where possible; if field mapping is ambiguous, show a general form error message with the backend message array |
| Auth expired during create | `POST /api/agents` returns 401 | Redirect to `/${locale}/login` |
| Network error during create | `POST /api/agents` fails (no response) | Form shows a general network error message with "Retry" option |

### Answer to Q19: What validation messages are needed?

Frontend validation messages (before submit):

| Key | en | zh-TW | zh-CN |
|-----|-----|-------|-------|
| `agentCreate.nameRequired` | Agent name is required | 代理名稱為必填 | 代理名称为必填 |
| `agentCreate.nameTooLong` | Agent name must be 100 characters or fewer | 代理名稱不可超過 100 個字元 | 代理名称不可超过 100 个字符 |
| `agentCreate.roleRequired` | Agent role is required | 代理角色為必填 | 代理角色为必填 |
| `agentCreate.roleTooLong` | Agent role must be 200 characters or fewer | 代理角色不可超過 200 個字元 | 代理角色不可超过 200 个字符 |
| `agentCreate.descriptionRequired` | Agent description is required | 代理描述為必填 | 代理描述为必填 |
| `agentCreate.descriptionTooLong` | Agent description must be 2000 characters or fewer | 代理描述不可超過 2000 個字元 | 代理描述不可超过 2000 个字符 |

General error messages:

| Key | en | zh-TW | zh-CN |
|-----|-----|-------|-------|
| `agentCreate.createError` | Failed to create agent. Please try again. | 建立代理失敗，請重試。 | 创建代理失败，请重试。 |
| `agentCreate.loadError` | Failed to load your agents. | 載入代理清單失敗。 | 加载代理列表失败。 |
| `agentCreate.retry` | Retry | 重試 | 重试 |
| `agentCreate.createSuccess` | Agent created successfully! | 代理建立成功！ | 代理创建成功！ |

---

## 13. Multilingual Copy Plan

### Answer to Q21: Which new translation keys are required?

All new keys use the `platform.agentCreate.*` namespace inside the existing `platform` section. This keeps Create Agent keys co-located with existing platform keys.

New keys to add:

```
platform.agentCreate.sectionTitle       — "Your Agents" section heading
platform.agentCreate.sectionSubtitle    — "Agents you have created"
platform.agentCreate.createButton       — "Create Agent" button label
platform.agentCreate.formTitle          — "Create New Agent" form heading
platform.agentCreate.nameLabel          — "Name" field label
platform.agentCreate.namePlaceholder    — "e.g. Research Assistant" placeholder
platform.agentCreate.roleLabel          — "Role" field label
platform.agentCreate.rolePlaceholder    — "e.g. Gathers and synthesizes information" placeholder
platform.agentCreate.descriptionLabel   — "Description" field label
platform.agentCreate.descriptionPlaceholder — "Describe what this agent does..." placeholder
platform.agentCreate.submitButton       — "Create Agent" submit button
platform.agentCreate.cancelButton       — "Cancel" cancel button
platform.agentCreate.submitting         — "Creating..." loading text on submit button
platform.agentCreate.nameRequired       — validation message
platform.agentCreate.nameTooLong        — validation message
platform.agentCreate.roleRequired       — validation message
platform.agentCreate.roleTooLong        — validation message
platform.agentCreate.descriptionRequired — validation message
platform.agentCreate.descriptionTooLong — validation message
platform.agentCreate.createError        — error message
platform.agentCreate.loadError          — error message
platform.agentCreate.retry              — retry button label
platform.agentCreate.createSuccess      — success message
platform.agentCreate.emptyTitle         — "No agents yet" empty state heading
platform.agentCreate.emptyBody          — "Create your first agent..." empty state body
platform.agentCreate.agentStatusActive  — "Active" status label for user agents
platform.agentCreate.agentStatusDraft   — "Draft" status label
platform.agentCreate.agentStatusDisabled — "Disabled" status label
```

Approximate count: ~27 new keys per locale.

### Answer to Q22: Which three translation files must be updated in Step 3?

1. `frontend/messages/en.json`
2. `frontend/messages/zh-TW.json`
3. `frontend/messages/zh-CN.json`

### Namespace convention

Keys are nested under `platform.agentCreate.*` — consistent with existing `platform.detail.*` nesting for the detail panel keys from RPG-03A.

---

## 14. Heroicons Plan

### Answer to Q23: Which Heroicons v2 Outline icons should be used, if any?

| Icon | Usage |
|------|-------|
| `PlusIcon` | Create Agent button/CTA |
| `UserGroupIcon` or `UsersIcon` | "Your Agents" section icon |
| `CheckCircleIcon` | Success state indicator |
| `ExclamationTriangleIcon` | Error state indicator (already used in billing) |
| `XMarkIcon` | Cancel/close form button (already used in detail panel) |

All from `@heroicons/react/24/outline`. No Lucide, Font Awesome, Material Icons, or emoji icons.

---

## 15. Accessibility and Responsive Plan

### Answer to Q24: What accessibility requirements apply?

| Element | Requirement |
|---------|-------------|
| Form fields | Each input has an associated `<label>` with `htmlFor` matching the input `id` |
| Required fields | Inputs have `required` attribute and `aria-required="true"` |
| Validation errors | Error messages associated via `aria-describedby` on the input |
| Submit button | Has descriptive text; disabled state communicated via `disabled` attribute |
| Cancel button | Keyboard-focusable `<button type="button">` |
| Create Agent CTA | Keyboard-focusable `<button>` with visible focus ring |
| Success/error banners | Use `role="alert"` for dynamic status messages |
| Station cards (user agents) | Same `<button>` pattern as existing `AgentStationCard` with `aria-pressed` |

### Answer to Q25: What responsive behavior is required at desktop and around 390px mobile?

| Breakpoint | Behavior |
|------------|----------|
| Desktop (xl+) | Station grid on left (~1.35fr), detail/form panel on right (~1fr) — existing RPG-03A grid layout preserved |
| Tablet/medium (sm–lg) | Detail/form panel stacks below station grid — existing behavior |
| Mobile (~390px) | Single column; station cards stack; form panel stacks below "Your Agents" section; form inputs are full-width; textarea has adequate height |

No horizontal overflow. No fixed-width elements. The existing responsive grid in `platform-dashboard.tsx` handles this.

---

## 16. Test Strategy

### Answer to Q26: What tests should Step 3 add/update?

**File to update:** `frontend/components/platform/platform-dashboard.test.ts`

New tests to add:

| # | Category | Test |
|---|----------|------|
| 1 | Translation keys | All `platform.agentCreate.*` keys resolve in all 3 locales |
| 2 | Translation keys | No empty/missing `agentCreate` keys in any locale |
| 3 | API contract | `GET /api/agents` list response shape matches expected interface |
| 4 | API contract | `POST /api/agents` request body contains only `name`, `role`, `description` |
| 5 | API contract | `POST /api/agents` response shape matches expected interface |
| 6 | Empty state | Empty agent list returns `{ agents: [] }` |
| 7 | Static agents unchanged | `listAgents()` still returns exactly 4 static agents |
| 8 | Static agents unchanged | Builder agent remains active and enabled |
| 9 | User agent display | User agent has `status` in `['active', 'draft', 'disabled']` |
| 10 | Validation | Empty name triggers validation error key |
| 11 | Validation | Name > 100 chars triggers validation error key |
| 12 | Validation | Empty role triggers validation error key |
| 13 | Validation | Empty description triggers validation error key |

**Potential new test file:** `frontend/hooks/useUserAgents.test.ts`

| # | Category | Test |
|---|----------|------|
| 14 | Hook | Returns loading=true initially |
| 15 | Hook | Returns agents array after successful fetch |
| 16 | Hook | Returns empty array when no user agents |
| 17 | Hook | Returns error on fetch failure |
| 18 | Hook | `createAgent` calls POST with correct body |
| 19 | Hook | `createAgent` returns created agent on success |
| 20 | Hook | `createAgent` returns error on 400 |
| 21 | Hook | `createAgent` handles 401 correctly |
| 22 | Hook | After create, refetches the list |

Approximate total: 13 translation/contract/display tests + 9 hook tests = ~22 new tests.

---

## 17. Mocked API Validation Plan

### Answer to Q27: Can Step 3 use mocked fetch/API behavior only?

**YES.** Step 3 must use mocked fetch/API behavior only in tests.

Test approach:
- Use `globalThis.fetch = jest.fn()` (or `vi.fn()` or manual mock depending on test framework) to mock all API calls.
- Mock `GET /api/agents` to return `{ agents: [...] }` or `{ agents: [] }`.
- Mock `POST /api/agents` to return 201 with a created agent, 400 with validation errors, or network failure.
- No live API calls in any test.
- The existing test file (`platform-dashboard.test.ts`) uses `node:test` with `node:assert/strict` — new tests should follow the same pattern.
- Hook tests (`useUserAgents.test.ts`) may use a simple manual mock of `fetch`.

---

## 18. Deferred Live Migration / Runtime Smoke Note

### Answer to Q28: What live smoke remains deferred until Docker/PostgreSQL/migration execution?

The following require a running backend and cannot be validated in Step 3:

| # | Deferred Smoke Item |
|---|---------------------|
| 1 | `user_agents` migration must be executed (`npm run migration:run` with Docker + PostgreSQL) |
| 2 | Authenticated `GET /api/agents` returning real DB data |
| 3 | Authenticated `POST /api/agents` persisting to real DB |
| 4 | Created agent appearing on dashboard after real API round-trip |
| 5 | Cross-user isolation verified with real users |
| 6 | Auth expiry/redirect under real session lifecycle |
| 7 | Visual browser smoke across all 3 locale routes with authenticated session |

These items are deferred to a future full-stack smoke task (BETA-READY-SMOKE / B3 or equivalent). Step 3 validates with mocked frontend tests and build/typecheck only.

---

## 19. CREATE-01A Contract Dependency

Step 3 depends on the API contract from AGENT-PLATFORM-CREATE-01A (COMPLETE and LOCKED — 2026-07-20):

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/agents` | `POST` | `SessionCookieGuard` (cookie: `aisandbox_session`) | Create user-owned agent |
| `/api/agents` | `GET` | `SessionCookieGuard` | List current user's agents |
| `/api/agents/:id` | `GET` | `SessionCookieGuard` | Get one user-owned agent by ID |

Request body (POST): `{ name, role, description, status?, initials? }`

Response shape (all endpoints): `{ id, name, role, description, status, initials, createdAt, updatedAt }`

List response: `{ agents: AgentResponseDto[] }`

Response excludes: `userId`, `deletedAt`, `user` relation.

Error responses: 400 (validation), 401 (unauthenticated), 404 (not found / cross-user).

Frontend must NOT send: `userId`, `ownerId`, `deletedAt`, internal relation fields, `toolPermissions`, `knowledgeScopes`, `skills`, `referralRules`, `approvalRules`.

---

## 20. Non-Goals Preserved

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
| 19 | Walking character |
| 20 | Pixel-art map |
| 21 | Sprite pipeline |
| 22 | Game engine |
| 23 | Avatar upload |
| 24 | Broad platform dashboard redesign |
| 25 | Broad navigation redesign |
| 26 | Broad auth/session redesign |
| 27 | Package/dependency upgrades |

---

## 21. Step 3 Exact File Plan

### Files to CREATE

| # | Path | Purpose |
|---|------|---------|
| 1 | `frontend/hooks/useUserAgents.ts` | Custom hook for `GET /api/agents` and `POST /api/agents` |
| 2 | `frontend/hooks/useUserAgents.test.ts` | Hook tests with mocked fetch |
| 3 | `frontend/components/platform/create-agent-form.tsx` | Create Agent form component |

### Files to MODIFY

| # | Path | Change |
|---|------|--------|
| 4 | `frontend/components/platform/platform-dashboard.tsx` | Add "Your Agents" section, Create Agent CTA, form toggle state, user agent fetch, user agent display, detail panel for user agents |
| 5 | `frontend/components/platform/platform-dashboard.test.ts` | Add translation key tests, API contract tests, static agent preservation tests |
| 6 | `frontend/messages/en.json` | Add `platform.agentCreate.*` keys (~27 keys) |
| 7 | `frontend/messages/zh-TW.json` | Add `platform.agentCreate.*` keys (~27 keys) |
| 8 | `frontend/messages/zh-CN.json` | Add `platform.agentCreate.*` keys (~27 keys) |

### Total: 3 files created + 5 files modified = 8 files

This is within a safe slice boundary (< 10 files).

### Files NOT modified

- `frontend/app/[locale]/platform/page.tsx` — no changes needed
- `frontend/components/platform/agent-detail-panel.tsx` — may need minor extension to render user-agent details, but likely reusable as-is with the `AgentDetailViewModel` interface
- `frontend/components/platform/agent-station-card.tsx` — reusable as-is for user agents
- `frontend/lib/agent-platform/agent-registry.ts` — NOT modified; static agents unchanged
- Backend files — NOT modified
- Package files — NOT modified

**Note on `agent-detail-panel.tsx`:** The existing `AgentDetailViewModel` interface includes `isBuilder` and `isComingSoon` booleans. For user-created agents, `isBuilder = false` and `isComingSoon = false`. The existing panel will render the detail content but omit both the Builder CTA and the coming-soon messaging — it shows the agent's profile, intent, capabilities, and status. If this produces an inadequate empty bottom section, a minor extension may be needed (add a `isUserCreated` flag or adjust the panel). This will be assessed during implementation and documented. If `agent-detail-panel.tsx` needs modification, the file count increases to 9 — still safe.

---

## 22. Step 3 Validation Commands

Do NOT run these now. These are defined for Step 3 execution.

```powershell
# 1. Run platform-specific tests
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npm test -- platform
```

```powershell
# 2. Run platform-dashboard test file directly
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsx --test components/platform/platform-dashboard.test.ts
```

```powershell
# 3. Run useUserAgents hook tests
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsx --test hooks/useUserAgents.test.ts
```

```powershell
# 4. TypeScript type check
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
```

```powershell
# 5. Build check
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
```

```powershell
# 6. Restore build artifact if needed
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

Also: ReadLints on all touched files:
- `frontend/components/platform/platform-dashboard.tsx`
- `frontend/components/platform/create-agent-form.tsx`
- `frontend/components/platform/platform-dashboard.test.ts`
- `frontend/hooks/useUserAgents.ts`
- `frontend/hooks/useUserAgents.test.ts`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

Do NOT run Docker/PostgreSQL/live DB/migration/runtime/browser commands in Step 3. Those belong to later full-stack smoke only.

---

## 23. Split Decision

### Answer to Q31: Is Step 3 safe as one implementation slice, or should it split?

**YES — Step 3 is safe as one implementation slice.**

Rationale:

1. **File count:** 8 files (3 new + 5 modified) — within the < 10 stop condition.
2. **Scope:** One new hook, one new form component, one dashboard extension, three translation file updates, two test file updates — all tightly coupled to a single feature.
3. **No backend changes:** Frontend-only slice. No API changes, no migration, no entity changes.
4. **No package changes:** All required packages (`@heroicons/react`, `react`, `next`) are already installed.
5. **No cross-cutting changes:** Only platform components affected. No workspace, billing, auth, or agent-harness changes.
6. **Pattern precedent:** RPG-03A was 6 modified + 2 created = 8 files, completed as one slice. This is similar in scope.

**No split required.**

---

## 24. Risks and Stop Conditions

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `AgentDetailPanel` may need minor extension for user agents | LOW | The existing `AgentDetailViewModel` handles non-builder, non-coming-soon agents — renders name/role/description/status without CTA or coming-soon. Assess during implementation; add `isUserCreated` flag if needed. |
| User agents section may introduce layout overflow on mobile | LOW | Existing responsive grid handles stacking; test at 390px width |
| Translation key count (~27 per locale) is substantial | LOW | Follows established pattern from RPG-03A (~40 keys) and billing (~30 keys). All keys are bounded and scoped. |
| `resolveNestedMessage` may not resolve deeply nested `agentCreate.*` under `platform` | LOW | Existing `platform.detail.*` keys are already nested 2 levels deep and work correctly. `platform.agentCreate.*` uses the same depth. |
| `fetch` mocking in `node:test` requires manual setup | LOW | Pattern exists in workspace-shell.test.tsx (very large file, likely has fetch mocking) and can be adapted for the hook test. |

### Stop Conditions

Stop Step 3 and escalate if:

1. More than 10 files need modification.
2. `agent-detail-panel.tsx` requires a broad redesign to accommodate user agents.
3. The existing `resolveNestedMessage` helper cannot handle the proposed key structure.
4. A new npm package or dependency is required.
5. Backend/API Gateway changes are required.
6. The existing responsive grid cannot accommodate the "Your Agents" section without a layout redesign.
7. Translation key naming conflicts with existing keys.
8. The `useUserAgents` hook pattern introduces TypeScript errors that require `tsconfig` changes.

---

## 25. Safety Confirmations

- [x] No source files were modified during this planning pass.
- [x] No test files were modified.
- [x] No translation files were modified.
- [x] No package files were modified.
- [x] No migration/entity/schema files were modified.
- [x] No environment files were opened.
- [x] No Docker commands were run.
- [x] No database was queried or mutated.
- [x] No runtime was started.
- [x] No browser was opened.
- [x] No API calls were made.
- [x] No build or test commands were run.
- [x] No git commit or push was performed.
- [x] No subagents were used.
- [x] No secret-bearing environment file was opened.
- [x] TASKS.md was not modified.
- [x] TASKS_BACKLOG_FULL.md was not modified.
- [x] docs/AINOW-EXECUTION-ROADMAP.md was not modified.
- [x] All locked tasks remain locked and unmodified.
- [x] Only one file was created: this stage-start document.

---

## 26. Exact Next Action

**Proceed to AGENT-PLATFORM-CREATE-01B Step 3 — Implementation.**

Step 3 should:

1. Create the 3 new files listed in Section 21
2. Modify the 5 existing files listed in Section 21
3. Follow the UX pattern, form design, API integration, and translation key plan documented in this stage-start
4. Run validation commands from Section 22
5. Report exact test results
6. Not start runtime, Docker, DB, browser, or provider
7. Not modify backend, API Gateway, ai-service, container-manager, or governance files
8. Not execute migrations
9. Not register another task

After Step 3, Step 4 will consolidate: create checkpoint document, update TASKS.md, TASKS_BACKLOG_FULL.md, and AINOW-EXECUTION-ROADMAP.md.
