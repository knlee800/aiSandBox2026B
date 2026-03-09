# PHASE-68A-CHECKPOINT.md

## Metadata

**Phase:** 68
**Stage:** 68A
**Task ID:** TASK-68A
**Title:** UX/UI Implementation Planning
**Status:** COMPLETE
**Date:** 2026-03-09
**Nature:** DOCUMENTATION / PLANNING (NO CODE)

---

## 1. Objective

Convert completed Phase 67 UX/UI design outputs into an implementation-ready execution plan for launch-priority UX/UI work. This checkpoint produces a structured implementation roadmap that sequences backend and frontend work, identifies dependencies, defines controlled implementation stages, and provides actionable task definitions for implementation phases.

---

## 2. Why Phase 68A Is Needed Now

### Context

Phase 67 produced comprehensive UX/UI design documentation across three slices:
- **PHASE-67A-1:** Main authenticated workspace UX (chat/editor/preview layout, session navigation)
- **PHASE-67A-2:** History/control UX (timeline, checkpoint, revert, diff, git-log)
- **PHASE-67A-3:** Dashboards, public surfaces, launch polish

Phase 67B validated cross-slice consistency, PRD/ARCHITECTURE alignment, and identified backend dependencies.

### The Gap

Phase 67 defined **what** to build (UX/UI design), but not **how** to build it (implementation sequence, task breakdown, dependency order). Before implementation can begin, we need:

1. **Implementation sequence** — Which work happens first, what can be parallelized
2. **Backend dependency mapping** — Which endpoints must exist before frontend work can proceed
3. **Frontend dependency mapping** — Which components depend on which backend endpoints
4. **Controlled staging** — How to slice implementation into verifiable stages
5. **Blocker identification** — What's missing, what's ready now
6. **Task definitions** — Specific, scoped implementation tasks with clear boundaries

### Why Now

Phase 67 is complete and locked. Implementation cannot proceed without a structured plan. This task bridges design (Phase 67) and implementation (future phases) by producing an actionable roadmap that respects architecture constraints, preserves governance, and enables controlled, verifiable implementation.

---

## 3. Input Artifacts Reviewed

### Phase 67 Design Outputs

**Primary Inputs:**
- `docs/PHASE-67A-1-CHECKPOINT.md` — Main workspace UX (1101 lines)
- `docs/PHASE-67A-2-CHECKPOINT.md` — History/control UX (1427 lines)
- `docs/PHASE-67A-3-CHECKPOINT.md` — Dashboards/public/polish UX (1996 lines)
- `docs/PHASE-67B-CHECKPOINT.md` — Validation (648 lines)
- `docs/PHASE-67-CHECKPOINT.md` — Final checkpoint (745 lines)

**Governance Documents:**
- `PRD.md` — Product requirements authority
- `ARCHITECTURE.md` — System architecture authority
- `CLAUDE.md` — Governance contract
- `TASKS.md` — Active task scope
- `TASKS_BACKLOG_FULL.md` — Full task definitions (TASK-68A)

### Key Findings from Phase 67

**Existing Backend Capabilities:**
- ✅ Session CRUD (POST/GET/DELETE /api/sessions)
- ✅ Session execution (POST /api/sessions/:id/exec)
- ✅ Preview proxy and health (GET /api/sessions/:id/preview/*)
- ✅ Runtime metrics (GET /api/runtime/metrics)
- ✅ Admin user summary (GET /api/internal/admin/users/:userId/summary)
- ✅ Billing visibility endpoints
- ✅ Git auto-commit (internal, already implemented)
- ✅ Checkpoint recording (internal, already implemented)

**Missing Backend Endpoints (Required for Phase 67 UX):**
- ❌ History/control endpoints (GET checkpoints, GET diff, POST revert)
- ❌ User dashboard endpoints (GET /api/users/me, GET /api/users/me/usage, GET /api/users/me/quotas)
- ❌ Session list with terminated (GET /api/sessions?includeTerminated=true)
- ❌ Admin dashboard endpoints (GET /api/internal/admin/users, GET /api/internal/admin/sessions)

**Frontend Components Needed:**
- Main workspace components (WorkspaceLayout, ChatPanel, EditorPanel, PreviewPanel, SessionSidebar)
- History/control components (TimelineDrawer, CheckpointCard, DiffViewer, RevertModal)
- Dashboard components (UserDashboard, SessionTable, UsageCard, AdminDashboard)
- Public surface components (LandingPage, PricingPage, DocsLayout)

---

## 4. Launch-Priority UX/UI Implementation Order

### Critical Path for Launch

The implementation sequence is constrained by backend dependencies. Frontend components cannot be implemented until required backend endpoints exist.

### Recommended Implementation Sequence

**Stage 1: Backend Foundation (Endpoints)**
1. History/control endpoints (highest priority, blocks workspace polish)
2. User dashboard endpoints (high priority, blocks user management)
3. Admin dashboard endpoints (medium priority, blocks operator visibility)

**Stage 2: Frontend Core (Workspace)**
1. Main workspace layout (highest priority, foundation for all UX)
2. Session navigation (high priority, required for workspace)
3. Chat/editor/preview panels (high priority, core product value)

**Stage 3: Frontend History (Version Control)**
1. Timeline drawer (high priority, launch-critical)
2. Checkpoint inspection (high priority, launch-critical)
3. Diff viewer (high priority, launch-critical)
4. Revert flow (high priority, launch-critical)

**Stage 4: Frontend Dashboards**
1. User dashboard (high priority, launch-critical)
2. Admin dashboard (medium priority, operator-critical)

**Stage 5: Frontend Public Surfaces**
1. Landing page (high priority, first impression)
2. Pricing page (high priority, transparency)
3. Docs site (medium priority, discoverability)

**Stage 6: Launch Polish**
1. Cross-surface consistency (high priority)
2. Error message clarity (high priority)
3. Loading feedback (high priority)
4. Responsive basics (medium priority)
5. Accessibility basics (medium priority)

---

## 5. Recommended Implementation Slices/Stages

### Implementation Stage Definitions

#### STAGE-68B: Backend UX/UI Support Endpoints

**Objective:** Implement all backend endpoints required by Phase 67 UX/UI designs

**Scope:**
- History/control endpoints (3 endpoints)
- User dashboard endpoints (4 endpoints)
- Admin dashboard endpoints (2 endpoints)

**Nature:** IMPLEMENTATION (BACKEND ONLY, ADDITIVE)

**Deliverables:**
- 9 new endpoints (public and internal)
- Endpoint tests
- API documentation
- Checkpoint: `docs/PHASE-68B-CHECKPOINT.md`

**Dependencies:** Phase 67 complete (design), existing backend services operational

**Estimated Complexity:** Medium (9 endpoints, mostly CRUD, uses existing data model)

---

#### STAGE-68C: Frontend Core Workspace Implementation

**Objective:** Implement main authenticated workspace per PHASE-67A-1 design

**Scope:**
- Workspace layout (three-panel, resizable)
- Session navigation (sidebar, switcher, creation, deletion)
- Chat panel (message display, input, streaming)
- Editor panel (Monaco integration, file tree)
- Preview panel (iframe, health polling)
- Workspace states (empty, loading, active, error)

**Nature:** IMPLEMENTATION (FRONTEND ONLY)

**Deliverables:**
- Workspace components (WorkspaceLayout, ChatPanel, EditorPanel, PreviewPanel, SessionSidebar)
- Session management integration
- State management (session list, current session, panel sizes)
- Checkpoint: `docs/PHASE-68C-CHECKPOINT.md`

**Dependencies:** STAGE-68B complete (uses existing session endpoints only)

**Estimated Complexity:** High (complex layout, Monaco integration, state management)

---

#### STAGE-68D: Frontend History/Control Implementation

**Objective:** Implement history and version control UX per PHASE-67A-2 design

**Scope:**
- Timeline drawer (checkpoint list, navigation)
- Checkpoint inspection (metadata, files changed)
- Diff viewer (Monaco diff editor)
- Revert flow (confirmation, execution, success/error)
- Git-log view (technical commit history)
- Timeline states (empty, loading, active, error)

**Nature:** IMPLEMENTATION (FRONTEND ONLY)

**Deliverables:**
- History components (TimelineDrawer, CheckpointCard, DiffViewer, RevertModal)
- Checkpoint API integration
- Timeline state management
- Checkpoint: `docs/PHASE-68D-CHECKPOINT.md`

**Dependencies:** STAGE-68B complete (requires history/control endpoints), STAGE-68C complete (integrates with workspace)

**Estimated Complexity:** High (complex timeline UX, Monaco diff integration, revert flow)

---

#### STAGE-68E: Frontend Dashboard Implementation

**Objective:** Implement user and admin dashboards per PHASE-67A-3 design

**Scope:**
- User dashboard (sessions, usage, quotas, settings)
- Admin dashboard (overview, users, sessions, metrics)
- Dashboard states (empty, loading, active, error)

**Nature:** IMPLEMENTATION (FRONTEND ONLY)

**Deliverables:**
- Dashboard components (UserDashboard, AdminDashboard, SessionTable, UsageCard)
- Dashboard API integration
- Dashboard state management
- Checkpoint: `docs/PHASE-68E-CHECKPOINT.md`

**Dependencies:** STAGE-68B complete (requires user/admin endpoints)

**Estimated Complexity:** Medium (standard CRUD UI, table/card layouts)

---

#### STAGE-68F: Frontend Public Surfaces Implementation

**Objective:** Implement landing page, pricing page, docs site per PHASE-67A-3 design

**Scope:**
- Landing page (hero, features, footer)
- Pricing page (tiers, FAQ)
- Docs site (getting started, core concepts, search)

**Nature:** IMPLEMENTATION (FRONTEND ONLY)

**Deliverables:**
- Public page components (LandingPage, PricingPage, DocsLayout)
- Static content (marketing copy, docs content)
- Navigation integration
- Checkpoint: `docs/PHASE-68F-CHECKPOINT.md`

**Dependencies:** None (static pages, no backend dependencies)

**Estimated Complexity:** Low (static content, standard layouts)

---

#### STAGE-68G: Launch Polish Implementation

**Objective:** Implement cross-surface polish per PHASE-67A-3 design

**Scope:**
- Visual consistency (color scheme, typography, spacing)
- Error message clarity (consistent format)
- Loading feedback (spinners, messages, timeouts)
- Trust signals (privacy, terms, security messaging)
- Responsive basics (desktop-first, mobile simplified)
- Accessibility basics (keyboard nav, ARIA labels, contrast)

**Nature:** IMPLEMENTATION (FRONTEND ONLY, CROSS-CUTTING)

**Deliverables:**
- Shared styles (colors, typography, spacing)
- Error message components (ErrorBanner, ErrorModal)
- Loading components (LoadingSpinner, LoadingState)
- Responsive layouts (media queries, breakpoints)
- Accessibility improvements (ARIA, keyboard shortcuts)
- Checkpoint: `docs/PHASE-68G-CHECKPOINT.md`

**Dependencies:** STAGE-68C, STAGE-68D, STAGE-68E, STAGE-68F complete (applies polish to all surfaces)

**Estimated Complexity:** Medium (cross-cutting, requires coordination across all surfaces)

---

## 6. What Can Be Implemented Immediately

### Ready Now (No Backend Blockers)

**1. Frontend Public Surfaces (STAGE-68F)**
- Landing page
- Pricing page
- Docs site structure (content creation)
- **Reason:** Static pages, no backend dependencies
- **Can Start:** Immediately after Phase 68A approved

**2. Partial Workspace Layout (STAGE-68C, Partial)**
- Workspace layout structure (three-panel container, resizable)
- Session sidebar UI (list rendering, no data)
- Panel components (shells, no data integration)
- **Reason:** Layout and UI structure independent of backend
- **Can Start:** Immediately after Phase 68A approved
- **Blocker:** Cannot integrate session data until existing endpoints tested/verified

---

## 7. What Is Blocked by Backend/Product Dependencies

### Blocked by Missing Backend Endpoints

**1. History/Control UX (STAGE-68D) — BLOCKED**
- Timeline drawer (requires GET /api/sessions/:id/checkpoints)
- Checkpoint inspection (requires GET /api/sessions/:id/checkpoints)
- Diff viewer (requires GET /api/sessions/:id/checkpoints/:hash/diff)
- Revert flow (requires POST /api/sessions/:id/revert)
- **Blocker:** History/control endpoints not implemented
- **Unblocks After:** STAGE-68B complete

**2. User Dashboard UX (STAGE-68E, Partial) — BLOCKED**
- Usage & quotas section (requires GET /api/users/me/usage, GET /api/users/me/quotas)
- Account settings section (requires GET /api/users/me)
- All sessions list (requires GET /api/sessions?includeTerminated=true)
- **Blocker:** User dashboard endpoints not implemented
- **Unblocks After:** STAGE-68B complete

**3. Admin Dashboard UX (STAGE-68E, Partial) — BLOCKED**
- Users section (requires GET /api/internal/admin/users)
- Sessions section (requires GET /api/internal/admin/sessions)
- **Blocker:** Admin dashboard endpoints not implemented
- **Unblocks After:** STAGE-68B complete

**4. Full Workspace Integration (STAGE-68C, Partial) — BLOCKED**
- Session data integration (requires verification of existing session endpoints)
- Chat message integration (requires verification of AI execution endpoints)
- File operations integration (requires verification of filesystem endpoints)
- **Blocker:** Existing endpoints not verified for frontend integration
- **Unblocks After:** Endpoint verification task complete

---

### Blocked by Missing Product Features

**None Identified.**

All Phase 67 UX designs use existing product features. No new product features required. Only backend API exposure needed (endpoints for existing features).

---

## 8. Frontend Dependency Mapping

### Phase 67 UX → Frontend Components

#### From PHASE-67A-1 (Main Workspace)

**Workspace Layout:**
- `WorkspaceLayout` (container, panel management, resize logic)
- `WorkspaceHeader` (session context, user menu)
- `WorkspaceFooter` (container status, session metadata)

**Session Navigation:**
- `SessionSidebar` (session list, switcher, collapse logic)
- `SessionList` (session entries, status indicators)
- `SessionCreationModal` (session creation flow)
- `SessionDeletionModal` (deletion confirmation)

**Chat Panel:**
- `ChatPanel` (container, message list, input field)
- `ChatMessage` (message display, code blocks, command output)
- `ChatInput` (input field, send button, streaming indicator)

**Editor Panel:**
- `EditorPanel` (container, file tree, Monaco wrapper)
- `FileTree` (directory tree, file selection)
- `MonacoEditor` (Monaco integration, syntax highlighting, read-only mode)

**Preview Panel:**
- `PreviewPanel` (container, iframe, controls)
- `PreviewIframe` (iframe wrapper, URL management)
- `PreviewControls` (refresh, open in new tab, health indicator)

**Workspace States:**
- `EmptyState` (no session selected)
- `LoadingState` (session starting)
- `ErrorState` (session terminated, error banner)

**Dependencies:**
- Existing session endpoints (POST/GET/DELETE /api/sessions, POST /api/sessions/:id/exec)
- Existing preview endpoints (GET /api/sessions/:id/preview/health, preview proxy)

---

#### From PHASE-67A-2 (History/Control)

**Timeline UX:**
- `TimelineDrawer` (drawer container, slide-in/out logic)
- `TimelineList` (checkpoint list, scrolling, pagination)
- `CheckpointCard` (checkpoint entry, compact view)
- `CheckpointDetailView` (expanded checkpoint, metadata, file list)
- `TimelineControls` (search, filter, view toggle)

**Diff UX:**
- `DiffViewer` (Monaco diff editor wrapper, file navigation)
- `DiffControls` (close, copy, view toggle)
- `DiffFileList` (files changed, change indicators)

**Revert UX:**
- `RevertConfirmationModal` (confirmation flow, checkpoint summary)
- `RevertProgressModal` (loading state during revert)
- `RevertSuccessToast` (success feedback)
- `RevertErrorModal` (error handling)

**Git-Log UX:**
- `GitLogView` (technical commit history, toggle from timeline)

**Dependencies:**
- ❌ GET /api/sessions/:id/checkpoints (not implemented)
- ❌ GET /api/sessions/:id/checkpoints/:hash/diff (not implemented)
- ❌ POST /api/sessions/:id/revert (not implemented)

---

#### From PHASE-67A-3 (Dashboards/Public/Polish)

**User Dashboard:**
- `UserDashboard` (dashboard layout, sidebar navigation)
- `SessionsSection` (session table, filters, sorting)
- `UsageQuotasSection` (quota cards, progress bars)
- `AccountSettingsSection` (user info, preferences)
- `SessionTable` (reusable session table component)
- `UsageCard` (reusable quota card component)

**Admin Dashboard:**
- `AdminDashboard` (admin layout, sidebar navigation)
- `AdminOverview` (platform metrics, recent activity)
- `AdminUsersSection` (user list, search, detail view)
- `AdminSessionsSection` (session list, all users, filters)
- `AdminMetricsSection` (runtime metrics, cost visibility)

**Public Surfaces:**
- `LandingPage` (hero, features, footer)
- `PricingPage` (tiers, FAQ)
- `DocsLayout` (sidebar, content, search)
- `DocsContent` (markdown rendering, code highlighting)

**Launch Polish:**
- Shared styles (colors, typography, spacing)
- `ErrorBanner` (consistent error display)
- `LoadingSpinner` (consistent loading indicator)
- `StatusBadge` (session status, reusable)
- Responsive layouts (media queries)
- Accessibility improvements (ARIA labels, keyboard shortcuts)

**Dependencies:**
- User dashboard: ❌ GET /api/users/me, GET /api/users/me/usage, GET /api/users/me/quotas, GET /api/sessions?includeTerminated=true (not implemented)
- Admin dashboard: ❌ GET /api/internal/admin/users, GET /api/internal/admin/sessions (not implemented)
- Public surfaces: ✅ No backend dependencies (static)
- Launch polish: ✅ No backend dependencies (frontend-only)

---

## 9. Backend Dependency Mapping

### Phase 67 UX → Required Backend Endpoints

#### History/Control Endpoints (From PHASE-67A-2)

**1. GET /api/sessions/:id/checkpoints**
- **Purpose:** List all checkpoints for a session
- **UX Dependency:** Timeline drawer (PHASE-67A-2)
- **Auth:** JWT required, session ownership enforced
- **Response Format:**
  ```json
  [
    {
      "id": "uuid",
      "commitHash": "abc123def456...",
      "messageNumber": 1,
      "description": "Created Flask app",
      "filesChanged": 2,
      "createdAt": "2026-03-09T14:32:15Z"
    }
  ]
  ```
- **Error Handling:** 404 (session not found), 410 (session terminated, but still returns checkpoints), 403 (not owned)
- **Implementation Complexity:** Low (query git_checkpoints table, filter by session_id, order by created_at DESC)

---

**2. GET /api/sessions/:id/checkpoints/:hash/diff**
- **Purpose:** Get diff for a specific checkpoint (vs parent commit)
- **UX Dependency:** Diff viewer (PHASE-67A-2)
- **Auth:** JWT required, session ownership enforced
- **Response Format:**
  ```json
  {
    "commitHash": "abc123def456...",
    "parentHash": "parent123...",
    "files": [
      {
        "path": "app.py",
        "status": "added",
        "diff": "unified diff content..."
      }
    ]
  }
  ```
- **Error Handling:** 404 (checkpoint not found), 403 (session not owned), 410 (session terminated, but still returns diff)
- **Implementation Complexity:** Medium (requires git diff execution inside container or via git CLI)

---

**3. POST /api/sessions/:id/revert**
- **Purpose:** Revert session to a specific checkpoint
- **UX Dependency:** Revert flow (PHASE-67A-2)
- **Auth:** JWT required, session ownership enforced
- **Request Body:**
  ```json
  {
    "commitHash": "abc123def456..."
  }
  ```
- **Response Format:**
  ```json
  {
    "message": "Reverted successfully",
    "newCheckpoint": {
      "id": "uuid",
      "commitHash": "new123...",
      "description": "Reverted to abc123"
    }
  }
  ```
- **Behavior:** Execute git revert or git reset inside container, create new checkpoint
- **Error Handling:** 410 (session terminated), 404 (checkpoint not found), 403 (not owned)
- **Implementation Complexity:** High (requires git execution inside container, checkpoint creation, workspace reload)

---

#### User Dashboard Endpoints (From PHASE-67A-3)

**4. GET /api/users/me**
- **Purpose:** Get current user info
- **UX Dependency:** User dashboard account section (PHASE-67A-3)
- **Auth:** JWT required
- **Response Format:**
  ```json
  {
    "userId": "uuid",
    "email": "user@example.com",
    "createdAt": "2026-01-15T10:00:00Z"
  }
  ```
- **Error Handling:** 401 (not authenticated)
- **Implementation Complexity:** Low (extract user from JWT, query users table)

---

**5. GET /api/users/me/usage**
- **Purpose:** Get current user usage statistics
- **UX Dependency:** User dashboard usage section (PHASE-67A-3)
- **Auth:** JWT required
- **Response Format:**
  ```json
  {
    "activeSessions": 3,
    "sessionsCreated24h": 8,
    "tokensUsed24h": 45230,
    "estimatedCost": 2.45,
    "resetAt": "2026-03-09T20:00:00Z"
  }
  ```
- **Error Handling:** 401 (not authenticated)
- **Implementation Complexity:** Medium (aggregate queries: COUNT sessions, SUM tokens, calculate rolling 24h window)

---

**6. GET /api/users/me/quotas**
- **Purpose:** Get quota limits and current usage
- **UX Dependency:** User dashboard quota cards (PHASE-67A-3)
- **Auth:** JWT required
- **Response Format:**
  ```json
  {
    "maxActiveSessions": 5,
    "currentActiveSessions": 3,
    "maxSessions24h": 20,
    "currentSessions24h": 8,
    "maxTokens24h": 100000,
    "currentTokens24h": 45230,
    "resetAt": "2026-03-09T20:00:00Z"
  }
  ```
- **Error Handling:** 401 (not authenticated)
- **Implementation Complexity:** Medium (combines quota config + usage queries, similar to GET /api/users/me/usage)

---

**7. GET /api/sessions?includeTerminated=true**
- **Purpose:** List all sessions (active and terminated)
- **UX Dependency:** User dashboard sessions section (PHASE-67A-3)
- **Auth:** JWT required
- **Query Params:** `includeTerminated` (boolean, default false)
- **Response Format:** Array of sessions (same format as existing GET /api/sessions)
- **Error Handling:** 401 (not authenticated)
- **Implementation Complexity:** Low (extend existing GET /api/sessions to support query param)

---

#### Admin Dashboard Endpoints (From PHASE-67A-3)

**8. GET /api/internal/admin/users**
- **Purpose:** List all users with summary
- **UX Dependency:** Admin dashboard users section (PHASE-67A-3)
- **Auth:** Internal service auth required (X-Internal-Service-Key)
- **Query Params:** `search` (email/userId), `quotaStatus` (OK/WARN/EXCEEDED)
- **Response Format:**
  ```json
  {
    "users": [
      {
        "userId": "uuid",
        "email": "user@example.com",
        "activeSessions": 3,
        "totalSessions": 15,
        "quotaStatus": "OK",
        "createdAt": "2026-01-15T10:00:00Z"
      }
    ]
  }
  ```
- **Error Handling:** 401 (not authenticated), 403 (not admin)
- **Implementation Complexity:** Medium (aggregate queries across users, join sessions table)

---

**9. GET /api/internal/admin/sessions**
- **Purpose:** List all sessions across all users
- **UX Dependency:** Admin dashboard sessions section (PHASE-67A-3)
- **Auth:** Internal service auth required
- **Query Params:** `status` (active/terminated), `userId`, `dateRange`
- **Response Format:** Array of sessions with user info
- **Error Handling:** 401 (not authenticated), 403 (not admin)
- **Implementation Complexity:** Medium (query sessions table with joins, filter by status/user/date)

---

### Backend Endpoint Implementation Priority

**Priority 1 (Highest):**
1. GET /api/sessions/:id/checkpoints (enables timeline drawer, launch-critical)
2. GET /api/sessions/:id/checkpoints/:hash/diff (enables diff viewer, launch-critical)
3. POST /api/sessions/:id/revert (enables revert flow, launch-critical)

**Priority 2 (High):**
4. GET /api/users/me (enables user dashboard, launch-critical)
5. GET /api/users/me/usage (enables usage visibility, launch-critical)
6. GET /api/users/me/quotas (enables quota visibility, launch-critical)
7. GET /api/sessions?includeTerminated=true (enables full session list, launch-critical)

**Priority 3 (Medium):**
8. GET /api/internal/admin/users (enables admin user management, operator-critical)
9. GET /api/internal/admin/sessions (enables admin session monitoring, operator-critical)

---

## 10. Validation/Testing Expectations for Later Implementation Stages

### Backend Endpoint Validation (STAGE-68B)

**Endpoint Tests Required:**
- Unit tests for each endpoint (controller, service, repository)
- Integration tests for endpoint behavior (auth, ownership, error handling)
- E2E tests for endpoint workflows (create checkpoint → list → diff → revert)

**Validation Criteria:**
- ✅ Endpoint returns correct data format (matches response schema)
- ✅ Endpoint enforces auth (401 if not authenticated)
- ✅ Endpoint enforces ownership (403 if not owned, 404 if not found)
- ✅ Endpoint respects session termination (410 Gone for terminated sessions where applicable)
- ✅ Endpoint handles errors gracefully (404, 410, 429, 500)
- ✅ Endpoint performance acceptable (<500ms for list, <2s for diff, <5s for revert)

**Test Coverage Target:** 80%+ for new endpoints

---

### Frontend Component Validation (STAGE-68C/D/E/F/G)

**Component Tests Required:**
- Unit tests for each component (rendering, props, state)
- Integration tests for component interactions (chat → editor, timeline → diff)
- E2E tests for user flows (session creation → build → preview, timeline → revert)

**Validation Criteria:**
- ✅ Component renders correctly (all states: empty, loading, active, error)
- ✅ Component handles user interactions (click, input, resize)
- ✅ Component integrates with API (correct endpoints called, errors handled)
- ✅ Component respects session state (read-only for terminated sessions)
- ✅ Component accessible (keyboard nav, ARIA labels, focus management)
- ✅ Component responsive (desktop baseline, mobile basic)

**Test Coverage Target:** 70%+ for new components

---

### Integration Validation (Cross-Stage)

**Integration Tests Required:**
- Workspace + Timeline integration (timeline drawer overlays preview, links to chat messages)
- Workspace + Dashboard integration (dashboard links to workspace, session switching)
- Chat + Editor integration (AI code changes appear in editor)
- Editor + Preview integration (file save triggers preview reload)
- Timeline + Diff integration (view diff opens Monaco diff editor)
- Revert + Workspace integration (revert reloads workspace)

**Validation Criteria:**
- ✅ Cross-component communication works (state synchronization)
- ✅ Navigation works (dashboard → workspace, timeline → chat message)
- ✅ Data consistency (session state consistent across all components)
- ✅ Error propagation (errors in one component don't break others)

---

### Launch Readiness Validation (Final Stage)

**Launch Checklist:**
- ✅ All Phase 67 UX surfaces implemented
- ✅ All backend endpoints functional and tested
- ✅ All frontend components functional and tested
- ✅ All integration points validated
- ✅ All error states handled gracefully
- ✅ All loading states provide feedback
- ✅ All empty states guide user action
- ✅ Responsive basics functional (desktop + mobile simplified)
- ✅ Accessibility basics functional (keyboard nav, screen reader)
- ✅ Visual consistency across surfaces
- ✅ Error message clarity across surfaces
- ✅ Trust signals present (privacy, terms, security)

**Launch Acceptance Criteria:**
- User can create session, chat with AI, see code, preview app, revert changes
- User can view dashboard, see usage/quota, manage sessions
- Admin can monitor platform, view users, view sessions
- Prospective user can view landing page, pricing, docs, sign up
- All critical user flows work end-to-end
- No critical bugs blocking launch

---

## 11. Risks / Sequencing Constraints

### Risk 1: Backend Endpoint Delays Block Frontend Work

**Risk:** If STAGE-68B (backend endpoints) takes longer than expected, STAGE-68D and STAGE-68E (frontend history/dashboard) are blocked.

**Mitigation:**
- Prioritize history/control endpoints (highest launch impact)
- Parallelize frontend public surfaces (STAGE-68F) and workspace layout shell (STAGE-68C partial)
- Use mock endpoints for frontend development if backend delayed (with clear migration plan)

**Sequencing Constraint:** STAGE-68D and STAGE-68E cannot start until STAGE-68B complete

---

### Risk 2: Monaco Integration Complexity

**Risk:** Monaco Editor and Monaco Diff Editor integration may be more complex than expected (editor panel, diff viewer).

**Mitigation:**
- Prototype Monaco integration early (before full workspace implementation)
- Use Monaco examples/documentation for integration patterns
- Allocate buffer time for Monaco-specific issues (syntax highlighting, file tree, diff view)

**Sequencing Constraint:** Monaco integration must be validated before STAGE-68C and STAGE-68D proceed

---

### Risk 3: Timeline Drawer + Workspace Integration

**Risk:** Timeline drawer overlays preview panel and integrates with chat/editor. Integration points may be more complex than expected.

**Mitigation:**
- Implement workspace layout (STAGE-68C) first, stabilize before adding timeline
- Use drawer/overlay pattern from existing component library (if available)
- Test drawer behavior independently before integrating with workspace

**Sequencing Constraint:** STAGE-68C must be stable before STAGE-68D begins

---

### Risk 4: Admin Dashboard Access Control

**Risk:** Admin dashboard requires admin role enforcement. Auth system may not support role-based access yet.

**Mitigation:**
- Verify auth system supports admin role (JWT claim or separate mechanism)
- If not supported, defer admin dashboard (STAGE-68E partial) to post-launch
- Prioritize user dashboard (no admin role required)

**Sequencing Constraint:** Admin dashboard depends on admin role support in auth system

---

### Risk 5: Cross-Surface Polish Coordination

**Risk:** Launch polish (STAGE-68G) applies to all surfaces. Requires coordination across all previous stages.

**Mitigation:**
- Define shared styles early (colors, typography, spacing)
- Create reusable components (ErrorBanner, LoadingSpinner, StatusBadge) during STAGE-68C
- Apply polish incrementally (don't wait until end)

**Sequencing Constraint:** STAGE-68G must be last (applies to all surfaces)

---

## 12. Explicit Out-of-Scope

### Not Included in Phase 68 Implementation Plan

**Advanced Features (Deferred to Post-Launch):**
- ❌ Advanced admin actions (ban, suspend, refund, manual quota adjustment)
- ❌ Detailed mobile/tablet optimization (beyond basic responsive)
- ❌ Advanced accessibility audit (full WCAG 2.1 AA compliance)
- ❌ Real-time admin alerts/notifications
- ❌ Advanced user analytics dashboards
- ❌ User data export/deletion UI
- ❌ Multi-language support

**Design System:**
- ❌ No design system refactor
- ❌ No visual asset production (use placeholders)
- ❌ No copywriting expansion (use functional text)

**Architecture Changes:**
- ❌ No service architecture modifications
- ❌ No communication pattern changes
- ❌ No governance model changes
- ❌ No deployment changes

**Scope Expansion:**
- ❌ No new features beyond Phase 67 design
- ❌ No backend refactors (unless fixing bugs)
- ❌ No frontend refactors (unless fixing bugs)
- ❌ No schema changes (use existing data model)

---

## 13. Alignment with PRD / ARCHITECTURE

### PRD Alignment

**PRD Section 1: Overview**
- ✅ Implementation plan enables "AI-powered coding environment" (workspace implementation)
- ✅ Implementation plan enables "Git auto-commit and checkpoint system" (history/control endpoints)

**PRD Section 2: Product Goals**
- ✅ Implementation plan enables "isolated, reproducible coding sandbox per session" (workspace + session management)
- ✅ Implementation plan enables "AI-assisted code generation, execution, and previewing" (workspace panels)
- ✅ Implementation plan enforces "strong governance guarantees" (quota/termination UX)

**PRD Section 3A-3F:**
- ✅ Implementation plan covers all product features (session management, execution, filesystem, preview, AI, quotas)

**PRD Section 6: Error & Status Semantics**
- ✅ Implementation plan respects error codes (404, 410, 429, 502)

---

### ARCHITECTURE Alignment

**ARCHITECTURE Section 2: Architecture Principles**
- ✅ Implementation plan respects determinism (no background workers)
- ✅ Implementation plan respects request-driven enforcement (no cron jobs)
- ✅ Implementation plan respects persistent terminal state (read-only on terminated sessions)

**ARCHITECTURE Section 3: Service Architecture**
- ✅ Implementation plan respects service boundaries (API Gateway for auth, Container Manager for runtime)
- ✅ Implementation plan uses HTTP-only communication

**ARCHITECTURE Section 8: API Design**
- ✅ Implementation plan uses public APIs (JWT auth) for user-facing surfaces
- ✅ Implementation plan uses internal APIs (internal auth) for admin surfaces

**ARCHITECTURE Section 11: Explicit Non-Goals**
- ✅ Implementation plan respects non-goals (no background cleanup, no clustering, no resurrection)

---

## 14. Preserved Invariants

### Architecture Invariants

- ✅ No background workers (all implementation request-driven)
- ✅ Request-driven enforcement (no cron jobs, no schedulers)
- ✅ Persistent terminal state (terminated sessions stay terminated)
- ✅ Deterministic error semantics (404, 410, 429, 502)
- ✅ No WebSocket control plane (WebSocket for preview only)

### Backend Invariants

- ✅ No schema changes (use existing data model: sessions, git_checkpoints, users tables)
- ✅ No API contract changes to existing endpoints
- ✅ New endpoints additive only (no breaking changes)
- ✅ Existing endpoints unchanged

### Governance Invariants

- ✅ Session lifecycle respected (CREATED → ACTIVE → TERMINATED)
- ✅ Quotas enforced (5 concurrent, 20/24h, 100k tokens/24h)
- ✅ Rate limits respected (429 handling)
- ✅ Termination permanent (no resurrection)
- ✅ Ownership enforced (user sees only their sessions)

### UX Invariants

- ✅ No session resurrection (terminated = permanent)
- ✅ No background state mutation visible to user
- ✅ Deterministic state transitions (same input → same output)
- ✅ Clear error messages for all failure modes
- ✅ Privacy preserved (no conversation content in admin dashboard)

---

## 15. Recommended Next Stage (High-Level Only)

### PHASE-68B: Backend UX/UI Support Endpoints (Recommended First)

**Why First:**
- Unblocks frontend history/control implementation (STAGE-68D)
- Unblocks frontend dashboard implementation (STAGE-68E)
- Backend endpoints can be implemented and tested independently
- Frontend can proceed in parallel after backend complete

**Objective:** Implement 9 backend endpoints required by Phase 67 UX/UI designs

**Scope:**
- History/control endpoints (3 endpoints: GET checkpoints, GET diff, POST revert)
- User dashboard endpoints (4 endpoints: GET /api/users/me/*, GET /api/sessions?includeTerminated=true)
- Admin dashboard endpoints (2 endpoints: GET /api/internal/admin/*)

**Nature:** IMPLEMENTATION (BACKEND ONLY, ADDITIVE)

**Estimated Complexity:** Medium (9 endpoints, mostly CRUD/aggregation, uses existing data model)

**Deliverables:**
- 9 new endpoints implemented
- Endpoint tests (unit, integration, E2E)
- API documentation
- Checkpoint: `docs/PHASE-68B-CHECKPOINT.md`

---

### PHASE-68C: Frontend Core Workspace Implementation (Recommended Second)

**Why Second:**
- Foundation for all other frontend work
- Can start after existing session endpoints verified
- Partially unblocked (layout/UI can start immediately, data integration after verification)

**Objective:** Implement main authenticated workspace per PHASE-67A-1 design

**Scope:** Workspace layout, session navigation, chat/editor/preview panels, workspace states

**Nature:** IMPLEMENTATION (FRONTEND ONLY)

**Estimated Complexity:** High (complex layout, Monaco integration, state management)

**Deliverables:**
- Workspace components
- Session management integration
- Checkpoint: `docs/PHASE-68C-CHECKPOINT.md`

---

### Subsequent Stages (Recommended Order)

**STAGE-68D:** Frontend History/Control Implementation (after 68B + 68C complete)
**STAGE-68E:** Frontend Dashboard Implementation (after 68B complete)
**STAGE-68F:** Frontend Public Surfaces Implementation (can start anytime, no blockers)
**STAGE-68G:** Launch Polish Implementation (after 68C/D/E/F complete)

---

## 16. Implementation Task Breakdown and Sequencing

### STAGE-68B: Backend UX/UI Support Endpoints

**Task 68B-1: History/Control Endpoints**
- **Scope:** Implement GET /api/sessions/:id/checkpoints, GET /api/sessions/:id/checkpoints/:hash/diff, POST /api/sessions/:id/revert
- **Dependencies:** Existing git_checkpoints table, existing git auto-commit system
- **Deliverables:** 3 endpoints, tests, API docs
- **Estimated Complexity:** Medium-High (revert endpoint complex, requires git execution)

**Task 68B-2: User Dashboard Endpoints**
- **Scope:** Implement GET /api/users/me, GET /api/users/me/usage, GET /api/users/me/quotas, extend GET /api/sessions
- **Dependencies:** Existing users table, existing sessions table, existing quota enforcement
- **Deliverables:** 4 endpoints, tests, API docs
- **Estimated Complexity:** Medium (aggregate queries, rolling window calculations)

**Task 68B-3: Admin Dashboard Endpoints**
- **Scope:** Implement GET /api/internal/admin/users, GET /api/internal/admin/sessions
- **Dependencies:** Existing users table, existing sessions table, internal auth system
- **Deliverables:** 2 endpoints, tests, API docs
- **Estimated Complexity:** Medium (aggregate queries, admin auth enforcement)

**Sequencing:** 68B-1 highest priority (unblocks timeline), 68B-2 second (unblocks user dashboard), 68B-3 third (admin can wait)

**Parallelization:** All three tasks can be implemented in parallel (independent endpoints)

---

### STAGE-68C: Frontend Core Workspace Implementation

**Task 68C-1: Workspace Layout Foundation**
- **Scope:** Implement WorkspaceLayout, three-panel container, resize logic, panel state persistence
- **Dependencies:** None (layout structure independent)
- **Deliverables:** WorkspaceLayout component, resize logic, localStorage persistence
- **Estimated Complexity:** Medium (resize logic, state management)

**Task 68C-2: Session Navigation**
- **Scope:** Implement SessionSidebar, SessionList, session creation/deletion modals, session switcher
- **Dependencies:** Task 68C-1 (workspace layout), existing session endpoints
- **Deliverables:** SessionSidebar, SessionList, SessionCreationModal, SessionDeletionModal
- **Estimated Complexity:** Medium (session management, modal flows)

**Task 68C-3: Chat Panel**
- **Scope:** Implement ChatPanel, ChatMessage, ChatInput, message streaming, command output display
- **Dependencies:** Task 68C-1 (workspace layout), existing AI execution endpoints
- **Deliverables:** ChatPanel, ChatMessage, ChatInput components
- **Estimated Complexity:** Medium (message streaming, code block rendering)

**Task 68C-4: Editor Panel**
- **Scope:** Implement EditorPanel, FileTree, Monaco Editor integration, file operations
- **Dependencies:** Task 68C-1 (workspace layout), Monaco Editor library, existing filesystem endpoints
- **Deliverables:** EditorPanel, FileTree, MonacoEditor wrapper
- **Estimated Complexity:** High (Monaco integration, file tree, read-only mode)

**Task 68C-5: Preview Panel**
- **Scope:** Implement PreviewPanel, PreviewIframe, preview controls, health polling
- **Dependencies:** Task 68C-1 (workspace layout), existing preview endpoints
- **Deliverables:** PreviewPanel, PreviewIframe, PreviewControls
- **Estimated Complexity:** Low (iframe wrapper, health polling)

**Task 68C-6: Workspace States**
- **Scope:** Implement EmptyState, LoadingState, ErrorState components, state transitions
- **Dependencies:** Task 68C-1/2/3/4/5 (all workspace components)
- **Deliverables:** EmptyState, LoadingState, ErrorState components
- **Estimated Complexity:** Low (state display components)

**Sequencing:** 68C-1 first (foundation), 68C-2/3/4/5 in parallel (independent panels), 68C-6 last (integrates all states)

---

### STAGE-68D: Frontend History/Control Implementation

**Task 68D-1: Timeline Drawer**
- **Scope:** Implement TimelineDrawer, TimelineList, CheckpointCard, timeline controls
- **Dependencies:** STAGE-68B complete (GET checkpoints endpoint), STAGE-68C complete (workspace integration)
- **Deliverables:** TimelineDrawer, TimelineList, CheckpointCard, TimelineControls
- **Estimated Complexity:** Medium (drawer overlay, checkpoint list, search/filter)

**Task 68D-2: Diff Viewer**
- **Scope:** Implement DiffViewer, Monaco diff editor integration, file navigation
- **Dependencies:** Task 68D-1 (timeline drawer), STAGE-68B complete (GET diff endpoint), Monaco Diff Editor library
- **Deliverables:** DiffViewer component, Monaco diff integration
- **Estimated Complexity:** High (Monaco diff editor, side-by-side view, file navigation)

**Task 68D-3: Revert Flow**
- **Scope:** Implement RevertConfirmationModal, revert execution, success/error handling, workspace reload
- **Dependencies:** Task 68D-1 (timeline drawer), STAGE-68B complete (POST revert endpoint)
- **Deliverables:** RevertConfirmationModal, RevertProgressModal, RevertSuccessToast, RevertErrorModal
- **Estimated Complexity:** Medium (confirmation flow, workspace reload)

**Task 68D-4: Git-Log View**
- **Scope:** Implement GitLogView, toggle from timeline view, technical commit display
- **Dependencies:** Task 68D-1 (timeline drawer)
- **Deliverables:** GitLogView component
- **Estimated Complexity:** Low (alternate view of same data)

**Sequencing:** 68D-1 first (timeline foundation), 68D-2/3/4 in parallel (independent features)

---

### STAGE-68E: Frontend Dashboard Implementation

**Task 68E-1: User Dashboard Layout**
- **Scope:** Implement UserDashboard, dashboard layout, sidebar navigation
- **Dependencies:** STAGE-68B complete (user dashboard endpoints)
- **Deliverables:** UserDashboard layout, sidebar navigation
- **Estimated Complexity:** Low (standard dashboard layout)

**Task 68E-2: Sessions Section**
- **Scope:** Implement SessionsSection, SessionTable, session filters/sorting, session actions
- **Dependencies:** Task 68E-1 (dashboard layout), STAGE-68B complete (GET /api/sessions?includeTerminated=true)
- **Deliverables:** SessionsSection, SessionTable components
- **Estimated Complexity:** Medium (table display, filters, sorting, pagination)

**Task 68E-3: Usage & Quotas Section**
- **Scope:** Implement UsageQuotasSection, UsageCard, quota progress bars, reset timers
- **Dependencies:** Task 68E-1 (dashboard layout), STAGE-68B complete (GET /api/users/me/usage, GET /api/users/me/quotas)
- **Deliverables:** UsageQuotasSection, UsageCard components
- **Estimated Complexity:** Low (card display, progress bars)

**Task 68E-4: Account Settings Section**
- **Scope:** Implement AccountSettingsSection, user info display, preferences
- **Dependencies:** Task 68E-1 (dashboard layout), STAGE-68B complete (GET /api/users/me)
- **Deliverables:** AccountSettingsSection component
- **Estimated Complexity:** Low (form display, read-only fields)

**Task 68E-5: Admin Dashboard**
- **Scope:** Implement AdminDashboard, admin layout, overview/users/sessions/metrics sections
- **Dependencies:** STAGE-68B complete (admin endpoints), admin role support in auth system
- **Deliverables:** AdminDashboard, AdminOverview, AdminUsersSection, AdminSessionsSection, AdminMetricsSection
- **Estimated Complexity:** Medium (admin-specific components, internal auth integration)

**Sequencing:** 68E-1 first (dashboard foundation), 68E-2/3/4 in parallel (independent sections), 68E-5 parallel or after (independent admin dashboard)

---

### STAGE-68F: Frontend Public Surfaces Implementation

**Task 68F-1: Landing Page**
- **Scope:** Implement LandingPage, hero section, features section, footer
- **Dependencies:** None (static page)
- **Deliverables:** LandingPage component, hero/features/footer sections
- **Estimated Complexity:** Low (static content, standard layout)

**Task 68F-2: Pricing Page**
- **Scope:** Implement PricingPage, pricing tiers, FAQ section
- **Dependencies:** None (static page)
- **Deliverables:** PricingPage component, tier cards, FAQ
- **Estimated Complexity:** Low (static content, standard layout)

**Task 68F-3: Docs Site**
- **Scope:** Implement DocsLayout, docs sidebar, docs content rendering, search
- **Dependencies:** None (static content, markdown rendering)
- **Deliverables:** DocsLayout, DocsSidebar, DocsContent, DocsSearch
- **Estimated Complexity:** Medium (markdown rendering, search, navigation)

**Sequencing:** All three tasks can be implemented in parallel (independent pages)

**Can Start:** Immediately (no backend blockers)

---

### STAGE-68G: Launch Polish Implementation

**Task 68G-1: Shared Styles & Components**
- **Scope:** Define shared styles (colors, typography, spacing), create reusable components (ErrorBanner, LoadingSpinner, StatusBadge)
- **Dependencies:** STAGE-68C/D/E/F complete (applies to all surfaces)
- **Deliverables:** Shared style definitions, reusable components
- **Estimated Complexity:** Low (style definitions, simple components)

**Task 68G-2: Error Message Consistency**
- **Scope:** Apply consistent error message format across all surfaces (heading + body + action)
- **Dependencies:** Task 68G-1 (shared components), STAGE-68C/D/E/F complete
- **Deliverables:** Consistent error messages, ErrorBanner/ErrorModal usage
- **Estimated Complexity:** Low (apply existing pattern)

**Task 68G-3: Loading Feedback**
- **Scope:** Apply consistent loading feedback across all surfaces (spinner, message, timeout)
- **Dependencies:** Task 68G-1 (shared components), STAGE-68C/D/E/F complete
- **Deliverables:** Consistent loading states, LoadingSpinner usage
- **Estimated Complexity:** Low (apply existing pattern)

**Task 68G-4: Responsive Basics**
- **Scope:** Implement responsive layouts (desktop baseline, mobile simplified)
- **Dependencies:** STAGE-68C/D/E/F complete (applies to all surfaces)
- **Deliverables:** Media queries, responsive breakpoints, mobile simplified views
- **Estimated Complexity:** Medium (responsive layouts, mobile simplification)

**Task 68G-5: Accessibility Basics**
- **Scope:** Implement keyboard navigation, ARIA labels, focus management, color contrast
- **Dependencies:** STAGE-68C/D/E/F complete (applies to all surfaces)
- **Deliverables:** Keyboard shortcuts, ARIA labels, focus trap, contrast fixes
- **Estimated Complexity:** Medium (cross-cutting, requires testing)

**Sequencing:** 68G-1 first (foundation), 68G-2/3 in parallel (independent), 68G-4/5 in parallel (independent)

---

## 17. Implementation Task Registry

### Backend Endpoint Tasks (STAGE-68B)

| Task ID | Description | Priority | Complexity | Dependencies | Deliverable |
|---------|-------------|----------|------------|--------------|-------------|
| 68B-1 | History/Control Endpoints | High | Medium-High | Existing git system | 3 endpoints + tests |
| 68B-2 | User Dashboard Endpoints | High | Medium | Existing users/sessions tables | 4 endpoints + tests |
| 68B-3 | Admin Dashboard Endpoints | Medium | Medium | Existing tables + internal auth | 2 endpoints + tests |

**Total:** 3 tasks, 9 endpoints

---

### Frontend Component Tasks (STAGE-68C/D/E/F/G)

| Task ID | Description | Priority | Complexity | Dependencies | Deliverable |
|---------|-------------|----------|------------|--------------|-------------|
| 68C-1 | Workspace Layout Foundation | High | Medium | None | WorkspaceLayout component |
| 68C-2 | Session Navigation | High | Medium | 68C-1, existing endpoints | SessionSidebar + modals |
| 68C-3 | Chat Panel | High | Medium | 68C-1, existing endpoints | ChatPanel components |
| 68C-4 | Editor Panel | High | High | 68C-1, Monaco, existing endpoints | EditorPanel + Monaco |
| 68C-5 | Preview Panel | High | Low | 68C-1, existing endpoints | PreviewPanel components |
| 68C-6 | Workspace States | High | Low | 68C-1/2/3/4/5 | State components |
| 68D-1 | Timeline Drawer | High | Medium | 68B-1, 68C-* | TimelineDrawer components |
| 68D-2 | Diff Viewer | High | High | 68B-1, 68D-1, Monaco Diff | DiffViewer + Monaco Diff |
| 68D-3 | Revert Flow | High | Medium | 68B-1, 68D-1 | Revert modals + flow |
| 68D-4 | Git-Log View | Medium | Low | 68D-1 | GitLogView component |
| 68E-1 | User Dashboard Layout | High | Low | 68B-2 | UserDashboard layout |
| 68E-2 | Sessions Section | High | Medium | 68E-1, 68B-2 | SessionsSection + table |
| 68E-3 | Usage & Quotas Section | High | Low | 68E-1, 68B-2 | UsageQuotasSection + cards |
| 68E-4 | Account Settings Section | Medium | Low | 68E-1, 68B-2 | AccountSettingsSection |
| 68E-5 | Admin Dashboard | Medium | Medium | 68B-3, admin role | AdminDashboard components |
| 68F-1 | Landing Page | High | Low | None | LandingPage component |
| 68F-2 | Pricing Page | High | Low | None | PricingPage component |
| 68F-3 | Docs Site | Medium | Medium | None | DocsLayout + content |
| 68G-1 | Shared Styles & Components | High | Low | 68C/D/E/F | Shared styles + components |
| 68G-2 | Error Message Consistency | High | Low | 68G-1, 68C/D/E/F | Error pattern application |
| 68G-3 | Loading Feedback | High | Low | 68G-1, 68C/D/E/F | Loading pattern application |
| 68G-4 | Responsive Basics | Medium | Medium | 68C/D/E/F | Responsive layouts |
| 68G-5 | Accessibility Basics | Medium | Medium | 68C/D/E/F | Accessibility improvements |

**Total:** 22 tasks (3 backend, 19 frontend)

---

## 18. Dependency Graph (High-Level)

### Critical Path

```
STAGE-68B (Backend Endpoints)
    ↓
STAGE-68C (Workspace) + STAGE-68D (History) + STAGE-68E (Dashboard)
    ↓
STAGE-68G (Polish)
```

### Parallel Work Streams

**Stream 1: Backend (Can Start Immediately)**
- 68B-1, 68B-2, 68B-3 (all parallel)

**Stream 2: Frontend Public (Can Start Immediately)**
- 68F-1, 68F-2, 68F-3 (all parallel, no blockers)

**Stream 3: Frontend Workspace (After 68B-1/2 Complete)**
- 68C-1 → 68C-2/3/4/5 (parallel) → 68C-6

**Stream 4: Frontend History (After 68B-1 + 68C Complete)**
- 68D-1 → 68D-2/3/4 (parallel)

**Stream 5: Frontend Dashboard (After 68B-2/3 Complete)**
- 68E-1 → 68E-2/3/4 (parallel), 68E-5 (independent)

**Stream 6: Frontend Polish (After 68C/D/E/F Complete)**
- 68G-1 → 68G-2/3/4/5 (parallel)

---

## 19. Detailed Implementation Stages

### STAGE-68B: Backend UX/UI Support Endpoints

**Objective:** Implement 9 backend endpoints required by Phase 67 UX/UI designs

**Scope:**
- History/control endpoints (3)
- User dashboard endpoints (4)
- Admin dashboard endpoints (2)

**Nature:** IMPLEMENTATION (BACKEND ONLY, ADDITIVE)

**Task Breakdown:**

**Task 68B-1: History/Control Endpoints**

**Scope:**
1. `GET /api/sessions/:id/checkpoints`
   - Query git_checkpoints table WHERE session_id = :id
   - Order by created_at DESC
   - Return array of checkpoints (id, commitHash, messageNumber, description, filesChanged, createdAt)
   - Enforce JWT auth, session ownership
   - Handle 404 (session not found), 410 (session terminated, but still return checkpoints), 403 (not owned)

2. `GET /api/sessions/:id/checkpoints/:hash/diff`
   - Execute git diff inside session container (or via git CLI)
   - Get diff for commit :hash vs parent commit
   - Parse diff output, structure as JSON (files array with path, status, diff content)
   - Enforce JWT auth, session ownership
   - Handle 404 (checkpoint not found), 403 (not owned), 410 (terminated, but still return diff)

3. `POST /api/sessions/:id/revert`
   - Validate request body (commitHash required)
   - Verify session active (not terminated) → 410 if terminated
   - Execute git revert or git reset inside container
   - Create new checkpoint via existing internal checkpoint system
   - Return new checkpoint info
   - Enforce JWT auth, session ownership
   - Handle 410 (session terminated), 404 (checkpoint not found), 403 (not owned)

**Deliverables:**
- 3 new controller methods (in sessions.controller.ts or new checkpoints.controller.ts)
- 3 new service methods (in sessions.service.ts or new checkpoints.service.ts)
- Unit tests (controller, service)
- Integration tests (E2E endpoint behavior)
- API documentation (OpenAPI/Swagger)

**Acceptance Criteria:**
- ✅ GET checkpoints returns correct data format
- ✅ GET diff returns valid diff content
- ✅ POST revert creates new checkpoint and reverts workspace
- ✅ All endpoints enforce auth and ownership
- ✅ All endpoints handle termination correctly (410 for revert, but allow read for checkpoints/diff)
- ✅ All endpoints tested (80%+ coverage)

**Estimated Effort:** Medium-High (revert endpoint complex, requires git execution inside container)

---

**Task 68B-2: User Dashboard Endpoints**

**Scope:**
1. `GET /api/users/me`
   - Extract user from JWT
   - Query users table WHERE id = userId
   - Return user info (userId, email, createdAt)
   - Enforce JWT auth
   - Handle 401 (not authenticated)

2. `GET /api/users/me/usage`
   - Extract user from JWT
   - Query sessions table: COUNT WHERE user_id = userId AND terminated_at IS NULL (active sessions)
   - Query sessions table: COUNT WHERE user_id = userId AND created_at > NOW() - INTERVAL 24 HOUR (sessions created 24h)
   - Query token_usage table: SUM WHERE user_id = userId AND timestamp > NOW() - INTERVAL 24 HOUR (tokens used 24h)
   - Calculate estimated cost (tokens * rate)
   - Calculate resetAt (rolling 24h window)
   - Return usage summary
   - Enforce JWT auth
   - Handle 401 (not authenticated)

3. `GET /api/users/me/quotas`
   - Extract user from JWT
   - Get quota limits from config (5 concurrent, 20/24h, 100k tokens/24h)
   - Query current usage (same as GET /api/users/me/usage)
   - Return quota limits + current usage
   - Enforce JWT auth
   - Handle 401 (not authenticated)

4. `GET /api/sessions?includeTerminated=true`
   - Extend existing GET /api/sessions endpoint
   - Add query param: includeTerminated (boolean, default false)
   - If includeTerminated=true, return all sessions (active and terminated)
   - If includeTerminated=false, return only active sessions (existing behavior)
   - Enforce JWT auth, user ownership
   - Handle 401 (not authenticated)

**Deliverables:**
- 1 new controller (users.controller.ts or extend existing)
- 3 new controller methods (GET /api/users/me/*)
- 1 modified controller method (GET /api/sessions, add query param)
- Service methods for usage/quota aggregation
- Unit tests (controller, service)
- Integration tests (E2E endpoint behavior)
- API documentation

**Acceptance Criteria:**
- ✅ GET /api/users/me returns correct user info
- ✅ GET /api/users/me/usage returns correct usage (rolling 24h calculations correct)
- ✅ GET /api/users/me/quotas returns correct quota limits + usage
- ✅ GET /api/sessions?includeTerminated=true returns all sessions
- ✅ All endpoints enforce auth
- ✅ All endpoints tested (80%+ coverage)

**Estimated Effort:** Medium (aggregate queries, rolling window calculations)

---

**Task 68B-3: Admin Dashboard Endpoints**

**Scope:**
1. `GET /api/internal/admin/users`
   - Query users table (all users)
   - Join sessions table: COUNT active sessions per user, COUNT total sessions per user
   - Calculate quota status per user (OK/WARN/EXCEEDED)
   - Support search query param (filter by email or userId)
   - Support quotaStatus query param (filter by OK/WARN/EXCEEDED)
   - Return array of user summaries
   - Enforce internal auth (X-Internal-Service-Key)
   - Handle 401 (not authenticated), 403 (not admin)

2. `GET /api/internal/admin/sessions`
   - Query sessions table (all sessions, all users)
   - Join users table: include user email/info
   - Support status query param (filter by active/terminated)
   - Support userId query param (filter by user)
   - Support dateRange query param (filter by created_at)
   - Return array of sessions with user info
   - Enforce internal auth
   - Handle 401 (not authenticated), 403 (not admin)

**Deliverables:**
- 2 new controller methods (in admin.controller.ts or new admin-dashboard.controller.ts)
- 2 new service methods (aggregate queries, joins)
- Unit tests (controller, service)
- Integration tests (E2E endpoint behavior)
- API documentation (internal only)

**Acceptance Criteria:**
- ✅ GET /api/internal/admin/users returns all users with summaries
- ✅ GET /api/internal/admin/sessions returns all sessions with user info
- ✅ Search/filter query params work correctly
- ✅ All endpoints enforce internal auth
- ✅ All endpoints tested (80%+ coverage)

**Estimated Effort:** Medium (aggregate queries, joins, admin auth)

---

### STAGE-68C: Frontend Core Workspace Implementation

**Objective:** Implement main authenticated workspace per PHASE-67A-1 design

**Task Breakdown:**

**Task 68C-1: Workspace Layout Foundation**

**Scope:**
- Implement WorkspaceLayout component (three-panel container)
- Implement panel resize logic (drag handles, min/max widths)
- Implement panel state persistence (localStorage: panel sizes, sidebar collapsed)
- Implement WorkspaceHeader component (session context, user menu)
- Implement WorkspaceFooter component (container status, session metadata)

**Deliverables:**
- `WorkspaceLayout.tsx` (layout container, resize logic)
- `WorkspaceHeader.tsx` (header component)
- `WorkspaceFooter.tsx` (footer component)
- `usePanelResize.ts` (custom hook for resize logic)
- `useWorkspaceState.ts` (custom hook for workspace state management)
- Unit tests (component rendering, resize logic)

**Acceptance Criteria:**
- ✅ Three-panel layout renders correctly (chat 30%, editor 40%, preview 30% default)
- ✅ Panels resizable via drag handles (20-50% range enforced)
- ✅ Panel sizes persist in localStorage
- ✅ Header displays session context (name, status, age)
- ✅ Footer displays container status (running/stopped)

**Estimated Effort:** Medium (resize logic, state management)

---

**Task 68C-2: Session Navigation**

**Scope:**
- Implement SessionSidebar component (collapsible, session list)
- Implement SessionList component (session entries, status indicators)
- Implement SessionCreationModal component (modal, form, validation)
- Implement SessionDeletionModal component (confirmation modal)
- Integrate with existing session endpoints (POST/GET/DELETE /api/sessions)
- Implement session switching logic (load session data, update workspace)

**Deliverables:**
- `SessionSidebar.tsx` (sidebar container, collapse logic)
- `SessionList.tsx` (session list rendering)
- `SessionCreationModal.tsx` (creation modal + form)
- `SessionDeletionModal.tsx` (deletion confirmation)
- `useSessionManagement.ts` (custom hook for session CRUD)
- Unit tests (component rendering, modal flows)
- Integration tests (session creation, deletion, switching)

**Acceptance Criteria:**
- ✅ Session sidebar renders session list (active and terminated)
- ✅ Session creation modal works (creates session, switches to new session)
- ✅ Session deletion modal works (confirms, deletes session)
- ✅ Session switching works (click session → load workspace)
- ✅ Quota indicator shows X/5 active sessions
- ✅ "New Session" button disabled if quota reached (5/5)

**Estimated Effort:** Medium (session management, modal flows)

---

**Task 68C-3: Chat Panel**

**Scope:**
- Implement ChatPanel component (message list, input field)
- Implement ChatMessage component (message display, code blocks, command output)
- Implement ChatInput component (input field, send button)
- Implement message streaming (if supported by backend)
- Integrate with AI execution endpoint (POST /api/sessions/:id/exec or POST /api/ai/execute)
- Implement auto-scroll to latest message

**Deliverables:**
- `ChatPanel.tsx` (chat container)
- `ChatMessage.tsx` (message rendering, code block syntax highlighting)
- `ChatInput.tsx` (input field, send logic)
- `useChatMessages.ts` (custom hook for message state, streaming)
- Unit tests (component rendering, message display)
- Integration tests (send message, receive response, streaming)

**Acceptance Criteria:**
- ✅ Chat panel renders message history
- ✅ Chat input sends messages to AI
- ✅ AI responses appear in chat (streaming or polling)
- ✅ Code blocks syntax-highlighted
- ✅ Command outputs formatted
- ✅ Auto-scroll to latest message
- ✅ Chat input disabled for terminated sessions

**Estimated Effort:** Medium (message streaming, code block rendering)

---

**Task 68C-4: Editor Panel**

**Scope:**
- Implement EditorPanel component (file tree, Monaco editor)
- Implement FileTree component (directory tree, file selection)
- Integrate Monaco Editor (syntax highlighting, read-only mode)
- Integrate with filesystem endpoints (read/write files)
- Implement file tab bar (open files, switch between files)
- Implement editor read-only mode for terminated sessions

**Deliverables:**
- `EditorPanel.tsx` (editor container)
- `FileTree.tsx` (file tree rendering, directory expansion)
- `MonacoEditor.tsx` (Monaco wrapper, file content display)
- `useFileSystem.ts` (custom hook for file operations)
- `useMonaco.ts` (custom hook for Monaco integration)
- Unit tests (component rendering, file tree, Monaco)
- Integration tests (file selection, file editing, save)

**Acceptance Criteria:**
- ✅ Editor panel renders file tree
- ✅ File tree shows workspace files (from session)
- ✅ Click file → Monaco editor shows file content
- ✅ Monaco editor syntax-highlighted
- ✅ Monaco editor read-only for terminated sessions
- ✅ File tab bar shows open files
- ✅ File save triggers API call (if editable)

**Estimated Effort:** High (Monaco integration, file tree, read-only mode)

---

**Task 68C-5: Preview Panel**

**Scope:**
- Implement PreviewPanel component (iframe, controls)
- Implement PreviewIframe component (iframe wrapper, URL management)
- Implement PreviewControls component (refresh, open in new tab, health indicator)
- Implement preview health polling (GET /api/sessions/:id/preview/health)
- Implement preview error handling (502, 410)

**Deliverables:**
- `PreviewPanel.tsx` (preview container)
- `PreviewIframe.tsx` (iframe wrapper)
- `PreviewControls.tsx` (controls, health polling)
- `usePreviewHealth.ts` (custom hook for health polling)
- Unit tests (component rendering, health polling)
- Integration tests (preview load, health check, error handling)

**Acceptance Criteria:**
- ✅ Preview panel renders iframe (if preview URL available)
- ✅ Preview panel shows "No preview running" if no URL
- ✅ Preview health polling works (polls every 10s)
- ✅ Preview controls work (refresh, open in new tab)
- ✅ Preview error state displays (502, 410)

**Estimated Effort:** Low (iframe wrapper, health polling)

---

**Task 68C-6: Workspace States**

**Scope:**
- Implement EmptyState component (no session selected)
- Implement LoadingState component (session starting)
- Implement ErrorState component (session terminated, error banner)
- Implement state transition logic (empty → loading → active → error)
- Integrate with workspace layout (display correct state based on session status)

**Deliverables:**
- `EmptyState.tsx` (empty state display)
- `LoadingState.tsx` (loading spinner, message)
- `ErrorState.tsx` (error banner, termination reason)
- `useWorkspaceState.ts` (custom hook for state transitions)
- Unit tests (component rendering, state transitions)

**Acceptance Criteria:**
- ✅ Empty state displays when no session selected
- ✅ Loading state displays during session creation (10-15s typical)
- ✅ Active state displays when session ready (all panels interactive)
- ✅ Error state displays when session terminated (read-only, termination reason shown)
- ✅ State transitions deterministic (same input → same output)

**Estimated Effort:** Low (state display components)

---

### STAGE-68D: Frontend History/Control Implementation

**Objective:** Implement history and version control UX per PHASE-67A-2 design

**Task Breakdown:**

**Task 68D-1: Timeline Drawer**

**Scope:**
- Implement TimelineDrawer component (drawer container, slide-in/out)
- Implement TimelineList component (checkpoint list, scrolling)
- Implement CheckpointCard component (checkpoint entry, compact view)
- Implement CheckpointDetailView component (expanded checkpoint, metadata)
- Implement TimelineControls component (search, filter, view toggle)
- Integrate with GET /api/sessions/:id/checkpoints endpoint
- Implement timeline states (empty, loading, active, error)

**Deliverables:**
- `TimelineDrawer.tsx` (drawer container, overlay logic)
- `TimelineList.tsx` (checkpoint list rendering)
- `CheckpointCard.tsx` (checkpoint entry display)
- `CheckpointDetailView.tsx` (expanded checkpoint)
- `TimelineControls.tsx` (search, filter, toggle)
- `useTimeline.ts` (custom hook for checkpoint fetching, state management)
- Unit tests (component rendering, drawer behavior)
- Integration tests (fetch checkpoints, display timeline, search/filter)

**Acceptance Criteria:**
- ✅ Timeline drawer slides from right, overlays preview panel
- ✅ Timeline drawer fetches checkpoints from API
- ✅ Checkpoint list displays (reverse chronological, newest first)
- ✅ Checkpoint card shows metadata (hash, timestamp, description, files changed, linked message)
- ✅ Click checkpoint → expand detail view
- ✅ Search/filter works (filter by description/file)
- ✅ Timeline states handled (empty, loading, active, error)

**Estimated Effort:** Medium (drawer overlay, checkpoint list, search/filter)

---

**Task 68D-2: Diff Viewer**

**Scope:**
- Implement DiffViewer component (Monaco diff editor wrapper)
- Integrate Monaco Diff Editor (side-by-side view, syntax highlighting)
- Implement DiffFileList component (files changed, change indicators)
- Implement DiffControls component (close, copy, view toggle)
- Integrate with GET /api/sessions/:id/checkpoints/:hash/diff endpoint
- Implement diff viewer states (empty, loading, active, error)
- Implement diff viewer in editor panel (replaces normal editor temporarily)

**Deliverables:**
- `DiffViewer.tsx` (diff viewer container)
- `MonacoDiffEditor.tsx` (Monaco diff editor wrapper)
- `DiffFileList.tsx` (file list with change indicators)
- `DiffControls.tsx` (controls)
- `useDiff.ts` (custom hook for diff fetching, state management)
- Unit tests (component rendering, Monaco diff)
- Integration tests (fetch diff, display diff, navigate files)

**Acceptance Criteria:**
- ✅ Diff viewer renders in editor panel (replaces editor temporarily)
- ✅ Monaco diff editor displays side-by-side diff
- ✅ Diff syntax-highlighted
- ✅ File list shows files changed (added, modified, deleted indicators)
- ✅ Navigate between files (previous/next buttons)
- ✅ Close diff → return to normal editor
- ✅ Diff states handled (empty, loading, active, error)

**Estimated Effort:** High (Monaco diff editor integration, file navigation)

---

**Task 68D-3: Revert Flow**

**Scope:**
- Implement RevertConfirmationModal component (confirmation flow)
- Implement RevertProgressModal component (loading state during revert)
- Implement RevertSuccessToast component (success feedback)
- Implement RevertErrorModal component (error handling)
- Integrate with POST /api/sessions/:id/revert endpoint
- Implement workspace reload after revert (chat, editor, preview all reload)
- Implement revert constraints (disabled for terminated sessions)

**Deliverables:**
- `RevertConfirmationModal.tsx` (confirmation modal)
- `RevertProgressModal.tsx` (loading modal)
- `RevertSuccessToast.tsx` (success toast)
- `RevertErrorModal.tsx` (error modal)
- `useRevert.ts` (custom hook for revert execution, state management)
- Unit tests (component rendering, modal flows)
- Integration tests (revert execution, workspace reload, error handling)

**Acceptance Criteria:**
- ✅ Click "Revert" on checkpoint → confirmation modal appears
- ✅ Confirmation modal shows checkpoint summary (hash, timestamp, description)
- ✅ Confirm revert → progress modal appears, API called
- ✅ Revert success → workspace reloads, timeline updates, success toast
- ✅ Revert error → error modal appears, no state change
- ✅ Revert disabled for terminated sessions (button disabled, tooltip explains)

**Estimated Effort:** Medium (confirmation flow, workspace reload)

---

**Task 68D-4: Git-Log View**

**Scope:**
- Implement GitLogView component (technical commit history)
- Implement view toggle (Timeline View / Git Log View)
- Display commit metadata (full hash, absolute timestamp, author, commit message)
- Use same data as timeline (from GET /api/sessions/:id/checkpoints)

**Deliverables:**
- `GitLogView.tsx` (git log rendering)
- `ViewToggle.tsx` (toggle between timeline and git log)
- Unit tests (component rendering, toggle)

**Acceptance Criteria:**
- ✅ Git log view displays commit history (same data as timeline, different format)
- ✅ Toggle works (switch between timeline and git log)
- ✅ Git log shows full commit hash (copyable)
- ✅ Git log shows absolute timestamps (not relative)

**Estimated Effort:** Low (alternate view of same data)

---

### STAGE-68E: Frontend Dashboard Implementation

**Objective:** Implement user and admin dashboards per PHASE-67A-3 design

**Task Breakdown:**

**Task 68E-1: User Dashboard Layout**

**Scope:**
- Implement UserDashboard component (dashboard layout, sidebar navigation)
- Implement dashboard header (logo, user menu)
- Implement dashboard sidebar (navigation: sessions, usage, settings)
- Implement routing (dashboard sections)

**Deliverables:**
- `UserDashboard.tsx` (dashboard layout)
- `DashboardHeader.tsx` (header component)
- `DashboardSidebar.tsx` (sidebar navigation)
- Unit tests (component rendering, navigation)

**Acceptance Criteria:**
- ✅ Dashboard layout renders (sidebar + content area)
- ✅ Sidebar navigation works (sessions, usage, settings)
- ✅ Header displays user menu (logout, settings)
- ✅ Routing works (navigate between sections)

**Estimated Effort:** Low (standard dashboard layout)

---

**Task 68E-2: Sessions Section**

**Scope:**
- Implement SessionsSection component (session table, filters, sorting)
- Implement SessionTable component (reusable session table)
- Integrate with GET /api/sessions?includeTerminated=true endpoint
- Implement filters (all, active, terminated)
- Implement sorting (last activity, created, name)
- Implement pagination (20 per page)
- Implement session actions (open, delete)

**Deliverables:**
- `SessionsSection.tsx` (sessions section container)
- `SessionTable.tsx` (reusable session table)
- `useSessionList.ts` (custom hook for session fetching, filtering, sorting)
- Unit tests (component rendering, filters, sorting)
- Integration tests (fetch sessions, display table, actions)

**Acceptance Criteria:**
- ✅ Sessions section displays all sessions (active and terminated)
- ✅ Filters work (all, active, terminated)
- ✅ Sorting works (last activity, created, name)
- ✅ Pagination works (20 per page)
- ✅ "Open" action navigates to workspace
- ✅ "Delete" action opens confirmation modal, deletes session

**Estimated Effort:** Medium (table display, filters, sorting, pagination)

---

**Task 68E-3: Usage & Quotas Section**

**Scope:**
- Implement UsageQuotasSection component (quota cards container)
- Implement UsageCard component (reusable quota card with progress bar)
- Integrate with GET /api/users/me/usage and GET /api/users/me/quotas endpoints
- Implement quota progress bars (visual indicator, percentage)
- Implement quota status colors (OK green, warning yellow, exceeded red)
- Implement reset timers (rolling 24h window)

**Deliverables:**
- `UsageQuotasSection.tsx` (quota cards container)
- `UsageCard.tsx` (reusable quota card)
- `QuotaProgressBar.tsx` (progress bar component)
- `useUserQuotas.ts` (custom hook for quota fetching)
- Unit tests (component rendering, progress bars)
- Integration tests (fetch quotas, display cards, status colors)

**Acceptance Criteria:**
- ✅ Usage & quotas section displays 3 quota cards (active sessions, sessions 24h, tokens 24h)
- ✅ Progress bars show usage percentage
- ✅ Status colors correct (green <80%, yellow 80-100%, red 100%+)
- ✅ Reset timers show correct time (rolling 24h window)
- ✅ Estimated cost displays (if available)

**Estimated Effort:** Low (card display, progress bars)

---

**Task 68E-4: Account Settings Section**

**Scope:**
- Implement AccountSettingsSection component (user info, preferences)
- Integrate with GET /api/users/me endpoint
- Display user info (userId, email, createdAt) read-only
- Implement preferences (default session name, workspace layout)
- Implement save preferences logic (if backend supports)

**Deliverables:**
- `AccountSettingsSection.tsx` (settings section)
- `useUserInfo.ts` (custom hook for user info fetching)
- Unit tests (component rendering, form display)

**Acceptance Criteria:**
- ✅ Account settings section displays user info (read-only)
- ✅ Preferences editable (default session name, workspace layout)
- ✅ Save preferences works (if backend supports)

**Estimated Effort:** Low (form display, read-only fields)

---

**Task 68E-5: Admin Dashboard**

**Scope:**
- Implement AdminDashboard component (admin layout, sidebar navigation)
- Implement AdminOverview component (platform metrics, recent activity)
- Implement AdminUsersSection component (user list, search, detail view)
- Implement AdminSessionsSection component (session list, all users, filters)
- Implement AdminMetricsSection component (runtime metrics, cost visibility)
- Integrate with admin endpoints (GET /api/internal/admin/users, GET /api/internal/admin/sessions)
- Integrate with runtime metrics (GET /api/runtime/metrics)
- Enforce admin access control (403 for non-admin)

**Deliverables:**
- `AdminDashboard.tsx` (admin layout)
- `AdminOverview.tsx` (overview section)
- `AdminUsersSection.tsx` (users section)
- `AdminSessionsSection.tsx` (sessions section)
- `AdminMetricsSection.tsx` (metrics section)
- `useAdminData.ts` (custom hook for admin data fetching)
- Unit tests (component rendering, admin sections)
- Integration tests (fetch admin data, display sections, access control)

**Acceptance Criteria:**
- ✅ Admin dashboard renders (sidebar + content)
- ✅ Overview section displays platform metrics (active sessions, users, error rate, uptime)
- ✅ Users section displays user list (search, filter, detail view)
- ✅ Sessions section displays session list (all users, filters)
- ✅ Metrics section displays runtime metrics (from existing endpoint)
- ✅ Admin access control enforced (403 for non-admin)

**Estimated Effort:** Medium (admin-specific components, internal auth integration)

---

### STAGE-68F: Frontend Public Surfaces Implementation

**Objective:** Implement landing page, pricing page, docs site per PHASE-67A-3 design

**Task Breakdown:**

**Task 68F-1: Landing Page**

**Scope:**
- Implement LandingPage component (hero, features, footer)
- Implement hero section (headline, subheadline, CTAs)
- Implement features section (4 feature cards)
- Implement footer (links: features, pricing, docs, terms, privacy)
- Implement navigation header (logo, nav links, auth buttons)

**Deliverables:**
- `LandingPage.tsx` (landing page layout)
- `HeroSection.tsx` (hero section)
- `FeaturesSection.tsx` (features section)
- `Footer.tsx` (reusable footer)
- `Header.tsx` (reusable header)
- Unit tests (component rendering)

**Acceptance Criteria:**
- ✅ Landing page renders (hero, features, footer)
- ✅ Hero section displays headline, subheadline, CTAs
- ✅ CTAs work (signup, login)
- ✅ Features section displays 4 feature cards
- ✅ Footer links work (pricing, docs, terms, privacy)

**Estimated Effort:** Low (static content, standard layout)

---

**Task 68F-2: Pricing Page**

**Scope:**
- Implement PricingPage component (hero, pricing tiers, FAQ)
- Implement pricing tier cards (free tier, future paid tiers)
- Implement FAQ section (5-7 common questions)
- Implement navigation header and footer (reuse from landing page)

**Deliverables:**
- `PricingPage.tsx` (pricing page layout)
- `PricingTierCard.tsx` (tier card component)
- `FAQSection.tsx` (FAQ section)
- Unit tests (component rendering)

**Acceptance Criteria:**
- ✅ Pricing page renders (hero, tiers, FAQ)
- ✅ Free tier card displays quota limits (5 concurrent, 20/24h, 100k tokens/24h)
- ✅ FAQ section displays common questions
- ✅ Signup CTA works

**Estimated Effort:** Low (static content, standard layout)

---

**Task 68F-3: Docs Site**

**Scope:**
- Implement DocsLayout component (sidebar, content area, search)
- Implement DocsSidebar component (navigation tree)
- Implement DocsContent component (markdown rendering, code highlighting)
- Implement DocsSearch component (search input, results)
- Create initial docs content (getting started, core concepts, reference)
- Implement markdown rendering (syntax highlighting for code blocks)

**Deliverables:**
- `DocsLayout.tsx` (docs layout)
- `DocsSidebar.tsx` (sidebar navigation)
- `DocsContent.tsx` (markdown rendering)
- `DocsSearch.tsx` (search component)
- Docs content files (markdown)
- Unit tests (component rendering, markdown rendering)

**Acceptance Criteria:**
- ✅ Docs site renders (sidebar, content, search)
- ✅ Sidebar navigation works (getting started, core concepts, reference)
- ✅ Markdown content renders correctly (headings, lists, code blocks)
- ✅ Code blocks syntax-highlighted
- ✅ Search works (basic, search across all docs)

**Estimated Effort:** Medium (markdown rendering, search, navigation)

---

### STAGE-68G: Launch Polish Implementation

**Objective:** Implement cross-surface polish per PHASE-67A-3 design

**Task Breakdown:**

**Task 68G-1: Shared Styles & Components**

**Scope:**
- Define shared styles (colors, typography, spacing)
- Create reusable components (ErrorBanner, LoadingSpinner, StatusBadge)
- Create shared CSS/SCSS (or styled-components)
- Implement design tokens (colors, font sizes, spacing units)

**Deliverables:**
- `styles/shared.css` (or `styles/theme.ts` if using styled-components)
- `ErrorBanner.tsx` (reusable error banner)
- `LoadingSpinner.tsx` (reusable loading spinner)
- `StatusBadge.tsx` (reusable status badge)
- Unit tests (component rendering)

**Acceptance Criteria:**
- ✅ Shared styles defined (colors, typography, spacing)
- ✅ Reusable components created (ErrorBanner, LoadingSpinner, StatusBadge)
- ✅ Components used across all surfaces (workspace, dashboard, public)

**Estimated Effort:** Low (style definitions, simple components)

---

**Task 68G-2: Error Message Consistency**

**Scope:**
- Apply consistent error message format across all surfaces (heading + body + action)
- Replace ad-hoc error displays with ErrorBanner component
- Ensure all error states use consistent format

**Deliverables:**
- Updated components (use ErrorBanner consistently)
- Error message audit (verify all surfaces use consistent format)

**Acceptance Criteria:**
- ✅ All error messages use consistent format (heading + body + action)
- ✅ ErrorBanner component used across all surfaces
- ✅ Error messages actionable (user knows what to do)

**Estimated Effort:** Low (apply existing pattern)

---

**Task 68G-3: Loading Feedback**

**Scope:**
- Apply consistent loading feedback across all surfaces (spinner, message, timeout)
- Replace ad-hoc loading displays with LoadingSpinner component
- Ensure all loading states provide feedback

**Deliverables:**
- Updated components (use LoadingSpinner consistently)
- Loading state audit (verify all surfaces provide feedback)

**Acceptance Criteria:**
- ✅ All loading states use consistent format (spinner + message)
- ✅ LoadingSpinner component used across all surfaces
- ✅ Timeout handling consistent (show warning after 30s, error after 60s)

**Estimated Effort:** Low (apply existing pattern)

---

**Task 68G-4: Responsive Basics**

**Scope:**
- Implement responsive layouts (desktop baseline 1280px+, mobile simplified)
- Define media queries (desktop ≥1280px, tablet 768-1279px, mobile <768px)
- Implement mobile simplified views (dashboard, public surfaces)
- Implement "Use desktop" message for workspace on mobile

**Deliverables:**
- Responsive CSS (media queries)
- Mobile simplified layouts (dashboard, landing, pricing)
- "Use desktop" message for workspace on mobile
- Responsive testing (desktop, tablet, mobile)

**Acceptance Criteria:**
- ✅ Desktop (≥1280px): Full experience (all surfaces)
- ✅ Tablet (768-1279px): Simplified layouts (dashboard, public)
- ✅ Mobile (<768px): Dashboard works (simplified), workspace shows "use desktop" message
- ✅ Landing/pricing/docs work on mobile

**Estimated Effort:** Medium (responsive layouts, mobile simplification)

---

**Task 68G-5: Accessibility Basics**

**Scope:**
- Implement keyboard navigation (Tab, Enter, Esc, Ctrl+1/2/3)
- Add ARIA labels (all interactive elements, panel regions)
- Implement focus management (focus visible, focus trap in modals)
- Verify color contrast (4.5:1 minimum for text)
- Implement semantic HTML (header, nav, main, footer, proper heading hierarchy)

**Deliverables:**
- Keyboard shortcuts (workspace: Ctrl+1/2/3, Ctrl+H)
- ARIA labels (all interactive elements)
- Focus management (modals, drawers)
- Color contrast fixes (if needed)
- Semantic HTML (all pages)
- Accessibility testing (keyboard nav, screen reader)

**Acceptance Criteria:**
- ✅ Keyboard navigation works (all interactive elements accessible via keyboard)
- ✅ ARIA labels present (all interactive elements, panel regions)
- ✅ Focus visible (outline on focus)
- ✅ Focus trap in modals (focus stays in modal until dismissed)
- ✅ Color contrast meets minimum (4.5:1 for text)
- ✅ Semantic HTML used (proper heading hierarchy, regions)

**Estimated Effort:** Medium (cross-cutting, requires testing)

---

## 20. Implementation Sequencing Summary

### Phase 1: Backend Foundation (STAGE-68B)
- **Duration:** Estimated 1-2 weeks
- **Parallelization:** All 3 tasks (68B-1, 68B-2, 68B-3) can run in parallel
- **Critical Path:** 68B-1 (history/control endpoints) highest priority
- **Deliverable:** 9 backend endpoints, tests, API docs

### Phase 2: Frontend Foundation (STAGE-68C + STAGE-68F)
- **Duration:** Estimated 2-3 weeks
- **Parallelization:** STAGE-68C (workspace) and STAGE-68F (public surfaces) can run in parallel
- **Critical Path:** 68C-4 (Monaco integration) likely most complex
- **Deliverable:** Workspace components, public pages

### Phase 3: Frontend Advanced (STAGE-68D + STAGE-68E)
- **Duration:** Estimated 2-3 weeks
- **Parallelization:** STAGE-68D (history) and STAGE-68E (dashboard) can run in parallel (after STAGE-68B complete)
- **Critical Path:** 68D-2 (Monaco diff integration) likely most complex
- **Deliverable:** History/control components, dashboard components

### Phase 4: Launch Polish (STAGE-68G)
- **Duration:** Estimated 1 week
- **Parallelization:** All 5 tasks (68G-1/2/3/4/5) can run in parallel (after STAGE-68C/D/E/F complete)
- **Deliverable:** Shared styles, consistent errors/loading, responsive, accessibility

**Total Estimated Duration:** 6-9 weeks (with parallelization)

---

## 21. What Can Start Immediately (Summary)

### Immediate Start (No Blockers)

**Backend:**
- ✅ STAGE-68B (all tasks: 68B-1, 68B-2, 68B-3) — Can start immediately

**Frontend:**
- ✅ STAGE-68F (all tasks: 68F-1, 68F-2, 68F-3) — Can start immediately (static pages, no backend dependencies)
- ✅ Task 68C-1 (Workspace Layout Foundation) — Can start immediately (layout structure independent)

**Total:** 3 backend tasks + 3 frontend tasks + 1 frontend task = 7 tasks can start immediately

---

### Blocked Until STAGE-68B Complete

**Frontend:**
- ❌ Task 68C-2/3/4/5/6 (Session navigation, chat, editor, preview, states) — Blocked until existing endpoints verified
- ❌ STAGE-68D (all tasks: 68D-1, 68D-2, 68D-3, 68D-4) — Blocked until 68B-1 complete (history/control endpoints)
- ❌ STAGE-68E (all tasks: 68E-1, 68E-2, 68E-3, 68E-4, 68E-5) — Blocked until 68B-2/3 complete (user/admin endpoints)

**Total:** 16 frontend tasks blocked until backend complete

---

## 22. Validation

### Planning Completeness

- ✅ Implementation sequence defined (6 stages: 68B → 68C → 68D → 68E → 68F → 68G)
- ✅ Backend dependencies mapped (9 endpoints identified, prioritized)
- ✅ Frontend dependencies mapped (22 frontend tasks identified, sequenced)
- ✅ Implementation sliced into controlled stages (6 stages, clear boundaries)
- ✅ Blockers identified (backend endpoints block frontend history/dashboard)
- ✅ Ready-to-implement work identified (7 tasks can start immediately)
- ✅ Implementation tasks defined with IDs, scope, dependencies, deliverables
- ✅ Validation expectations defined (tests, acceptance criteria, launch checklist)
- ✅ Risks identified (5 risks, mitigations provided)
- ✅ Sequencing constraints documented (critical path, parallelization)

### Scope Discipline

- ✅ Stayed within implementation planning only
- ✅ Did not implement code
- ✅ Did not modify schema
- ✅ Did not create endpoints
- ✅ Did not expand scope beyond Phase 67 design outputs
- ✅ Preserved all Phase 67 design decisions
- ✅ Identified dependencies only (did not implement)

### Alignment Verification

- ✅ PRD alignment verified (all product features covered)
- ✅ ARCHITECTURE alignment verified (all principles respected)
- ✅ Phase 67 design alignment verified (all UX surfaces mapped to implementation tasks)
- ✅ Governance alignment verified (quotas, rate limits, termination, ownership)

### Launch-Readiness

- ✅ Implementation plan is actionable (specific tasks, clear dependencies)
- ✅ Implementation plan is launch-oriented (prioritizes launch-critical work)
- ✅ Implementation plan is verifiable (acceptance criteria, test expectations)
- ✅ Implementation plan is realistic (estimated complexity, sequencing constraints)
- ✅ Implementation plan respects architecture (no background workers, request-driven, deterministic)

---

## 23. References

**Phase 67 Design Outputs:**
- `docs/PHASE-67A-1-CHECKPOINT.md` — Main workspace UX
- `docs/PHASE-67A-2-CHECKPOINT.md` — History/control UX
- `docs/PHASE-67A-3-CHECKPOINT.md` — Dashboards/public/polish UX
- `docs/PHASE-67B-CHECKPOINT.md` — Validation
- `docs/PHASE-67-CHECKPOINT.md` — Final checkpoint

**Governance Documents:**
- `PRD.md` — Product requirements authority
- `ARCHITECTURE.md` — System architecture authority
- `CLAUDE.md` — Governance contract
- `TASKS.md` — Active task scope
- `TASKS_BACKLOG_FULL.md` — TASK-68A definition

**Related Backend Code:**
- `services/api-gateway/src/sessions/sessions.controller.ts` — Existing session endpoints
- `services/api-gateway/src/entities/git-checkpoint.entity.ts` — Checkpoint data model
- `services/api-gateway/src/runtime/runtime.controller.ts` — Runtime metrics endpoint
- `services/api-gateway/src/admin/admin.controller.ts` — Admin endpoints

---

## 24. Rollback

Not applicable. Documentation only. No runtime changes.

---

## 25. Sign-Off

**Phase:** 68
**Stage:** 68A
**Task ID:** TASK-68A
**Status:** COMPLETE
**Checkpoint:** PHASE-68A-CHECKPOINT.md
**Date:** 2026-03-09

**TASK-68A Status:** COMPLETE

This checkpoint converts Phase 67 UX/UI design outputs into an implementation-ready execution plan. All implementation stages defined (68B → 68C → 68D → 68E → 68F → 68G), all dependencies mapped (backend → frontend), all tasks broken down (25 tasks total: 3 backend, 22 frontend), all blockers identified, all validation expectations defined.

**Next Recommended Stage:** PHASE-68B (Backend UX/UI Support Endpoints)

Ready for implementation phases to begin.
