# PHASE-67A-3-CHECKPOINT.md

## Metadata

**Phase:** 67
**Stage:** 67A-3
**Task ID:** TASK-67A (Slice 3 — Final)
**Title:** Core Product UX/UI Design — Dashboards, Public Surfaces, Launch Polish
**Status:** COMPLETE
**Date:** 2026-03-09
**Nature:** DOCUMENTATION / DESIGN (NO CODE)

---

## 1. Scope

### Objective

Produce the third and final narrowed design checkpoint covering the remaining launch-priority UX/UI surfaces: user dashboard, admin dashboard at high level, public-facing product surfaces at high level, and cross-surface launch polish requirements. This slice completes TASK-67A by defining all remaining user-facing surfaces required for launch readiness.

### Why This Slice Completes TASK-67A

PHASE-67A-1 established the main authenticated workspace (chat/editor/preview).
PHASE-67A-2 established history and control UX (timeline/checkpoint/revert/diff).

This final slice covers:
- **User Dashboard:** Where users manage sessions, view usage, see quotas
- **Admin Dashboard:** Where operators monitor platform health, manage users (high-level only)
- **Public Surfaces:** Landing page, pricing, docs (high-level only)
- **Launch Polish:** Responsive, accessibility, trust signals (cross-surface)

After this slice, all launch-critical UX surfaces are defined. Implementation can proceed.

### In-Scope Surfaces

1. **User Dashboard UX**
   - Session list (all sessions, not just active)
   - Usage statistics (tokens, sessions, cost)
   - Quota visibility (current usage vs limits)
   - Account settings (basic)

2. **Admin Dashboard UX (High-Level Only)**
   - Platform health visibility
   - User management (list, search, summary)
   - Session monitoring (active, terminated)
   - System metrics visibility

3. **Usage / Cost / Session / System Visibility (High-Level)**
   - User-facing usage visibility expectations
   - Admin-facing system visibility expectations
   - Cost transparency requirements

4. **Landing Page Requirements (High-Level)**
   - Purpose, target audience, key messages
   - Call-to-action (signup/login)
   - Trust signals

5. **Pricing Page Requirements (High-Level)**
   - Pricing model visibility
   - Plan comparison (if applicable)
   - Signup entry point

6. **Docs / Discoverability Requirements (High-Level)**
   - Documentation scope
   - Help/support entry points
   - Onboarding guidance

7. **Cross-Surface Responsive Requirements**
   - Desktop-first (1920x1080 baseline)
   - Minimum viable mobile (deferred details)
   - Tablet considerations (deferred details)

8. **Cross-Surface Accessibility Requirements (High-Level)**
   - Keyboard navigation
   - Screen reader compatibility (basic)
   - Color contrast (basic)

9. **Launch-Critical States for These Surfaces**
   - Empty states
   - Loading states
   - Error states
   - Success states
   - Trust/clarity states

10. **Launch-Readiness Polish Expectations**
    - Visual consistency across surfaces
    - Error message clarity
    - Loading feedback
    - Trust signals

### Out-of-Scope

- Main workspace UX (already covered in 67A-1)
- History/control UX (already covered in 67A-2)
- Any implementation
- Any code changes
- Any schema/API/backend/frontend changes
- Any design system rewrite
- Detailed branding/marketing copy production
- Detailed responsive breakpoints (high-level only)
- Detailed accessibility audit (high-level only)

---

## 2. Relevant User Types

### Primary User: Authenticated Developer (Dashboard Consumer)

**Context:**
- Has account
- Owns multiple sessions
- Subject to quotas
- Wants to manage sessions outside workspace

**Goals:**
- View all sessions (active and terminated)
- See usage statistics (tokens, sessions, cost)
- Understand quota limits
- Manage account settings

**Dashboard Needs:**
- Session list with status/metadata
- Usage summary (current period)
- Quota indicators (usage vs limits)
- Account management entry points

---

### Secondary User: Platform Operator (Admin Dashboard Consumer)

**Context:**
- Has admin access
- Monitors platform health
- Responds to incidents
- Manages users (abuse, support)

**Goals:**
- Monitor platform health (sessions, containers, errors)
- View user summaries (usage, quota, status)
- Investigate issues (session failures, quota violations)
- Perform admin actions (future: ban, refund, etc.)

**Dashboard Needs:**
- Platform metrics (active sessions, errors, resource usage)
- User list with search/filter
- Session monitoring (active, terminated, errors)
- Admin action entry points (high-level)

---

### Tertiary User: Prospective User (Public Surface Consumer)

**Context:**
- Not yet registered
- Evaluating platform
- Needs to understand value proposition

**Goals:**
- Understand what platform does
- See pricing/plans
- Sign up or log in
- Access documentation

**Public Surface Needs:**
- Clear value proposition (landing page)
- Pricing transparency (pricing page)
- Signup/login entry points
- Help/docs links

---

## 3. User Dashboard Model

### Dashboard Location

**URL:** `/dashboard` (authenticated route)

**Navigation:**
- Accessible from workspace header (user menu → "Dashboard")
- Accessible from landing page (after login)
- Separate from workspace (different route)

### Dashboard Layout

**Structure:**
```
+------------------------------------------+
| Header (user menu, logout)              |
+------------------------------------------+
| Sidebar       | Main Content             |
| • Sessions    |                          |
| • Usage       | [Dashboard Content]      |
| • Settings    |                          |
+------------------------------------------+
```

**Sidebar Navigation:**
- Sessions (default view)
- Usage & Quotas
- Account Settings
- Back to Workspace (link)

### Dashboard Sections

#### Section 1: Sessions Overview

**Purpose:** View and manage all sessions (active and terminated)

**Display:**
- Session list (table or card grid)
- Columns: Name, Status, Created, Last Activity, Actions
- Sorting: By last activity (most recent first)
- Filtering: All / Active / Terminated
- Pagination: 20 per page

**Session Card/Row:**
- Session name (clickable → opens workspace)
- Status badge (active, starting, terminated)
- Created timestamp (absolute)
- Last activity timestamp (relative)
- Actions: Open, Delete

**Actions:**
- "Open" → Navigate to workspace for that session
- "Delete" → Delete session (confirmation required)
- "New Session" → Create new session (opens workspace)

**Empty State:**
- No sessions: "No sessions yet. Create your first session to start building."
- CTA: "Create New Session" button

**Quota Indicator:**
- Show "X/5 active sessions" at top
- Show "X/20 sessions created today" (rolling 24h)
- Warning if approaching limits

---

#### Section 2: Usage & Quotas

**Purpose:** View current usage and quota limits

**Display:**
- Usage summary cards
- Quota progress bars
- Cost visibility (if available)

**Usage Summary Cards:**

**Card 1: Active Sessions**
- Current: X / 5 active sessions
- Progress bar (visual indicator)
- Status: OK / Warning / Exceeded
- Reset: N/A (concurrent limit)

**Card 2: Sessions Created (Rolling 24h)**
- Current: X / 20 sessions
- Progress bar
- Status: OK / Warning / Exceeded
- Reset: "Resets in X hours" (rolling window)

**Card 3: Tokens Used (Rolling 24h)**
- Current: X / 100,000 tokens
- Progress bar
- Status: OK / Warning / Exceeded
- Reset: "Resets in X hours" (rolling window)

**Card 4: Estimated Cost (Optional)**
- Current period cost: $X.XX
- Based on token usage
- Link to billing visibility (if available)

**Status Colors:**
- OK: Green (usage < 80%)
- Warning: Yellow (usage 80-100%)
- Exceeded: Red (usage >= 100%)

**Empty State:**
- No usage yet: "No usage recorded. Start a session to see your usage."

---

#### Section 3: Account Settings

**Purpose:** Manage account preferences

**Display:**
- Account information (read-only)
- Preferences (editable)
- Danger zone (account deletion, future)

**Account Information:**
- User ID (UUID, read-only)
- Email (read-only, or editable if auth supports)
- Account created date (read-only)

**Preferences:**
- Default session name format
- Workspace layout preference
- Notification preferences (future)

**Danger Zone:**
- Delete account (future, out of scope)
- Export data (future, out of scope)

---

## 4. Admin Dashboard Model (High-Level Only)

### Dashboard Location

**URL:** `/admin` (authenticated route, admin role required)

**Access Control:**
- Requires admin role (JWT claim or separate auth)
- Returns 403 Forbidden for non-admin users

### Dashboard Layout

**Structure:**
```
+------------------------------------------+
| Header (admin menu, logout)             |
+------------------------------------------+
| Sidebar       | Main Content             |
| • Overview    |                          |
| • Users       | [Admin Content]          |
| • Sessions    |                          |
| • System      |                          |
+------------------------------------------+
```

**Sidebar Navigation:**
- Overview (default view)
- Users
- Sessions
- System Metrics
- Back to Workspace (link)

### Dashboard Sections (High-Level)

#### Section 1: Overview

**Purpose:** Platform health at-a-glance

**Display:**
- Key metrics cards
- Recent activity feed
- Alert indicators (if any)

**Metrics Cards:**
- Active sessions count
- Total users count
- Error rate (last 24h)
- System uptime

**Data Source:**
- `GET /api/runtime/metrics` (existing endpoint)
- Admin-specific aggregations (future)

---

#### Section 2: Users

**Purpose:** User management and visibility

**Display:**
- User list (table)
- Search/filter by user ID, email
- User summary (usage, quota, sessions)

**User Table Columns:**
- User ID
- Email (if available)
- Active sessions count
- Total sessions count (all time)
- Quota status (OK / Warning / Exceeded)
- Actions (View Summary, future: Ban/Suspend)

**User Summary (Detail View):**
- User metadata
- Current quota usage
- Session list (all sessions for user)
- Usage history (high-level)

**Data Source:**
- `GET /api/internal/admin/users/:userId/summary` (existing endpoint)
- User list endpoint (future, not yet implemented)

---

#### Section 3: Sessions

**Purpose:** Session monitoring across all users

**Display:**
- Session list (all users, admin view)
- Filter by status, user, date
- Session detail view

**Session Table Columns:**
- Session ID
- User ID (or email)
- Status
- Created
- Last Activity
- Termination Reason (if terminated)
- Actions (View, Terminate future)

**Data Source:**
- Admin session list endpoint (future, not yet implemented)
- Existing session endpoints (per-user only currently)

---

#### Section 4: System Metrics

**Purpose:** Platform health and operational visibility

**Display:**
- Runtime metrics (from existing endpoint)
- Container statistics
- Error/termination breakdown
- Cost visibility (high-level)

**Data Source:**
- `GET /api/runtime/metrics` (existing)
- Billing visibility endpoints (existing, admin access)
- Efficiency summary (existing, admin access)

---

## 5. Visibility/Reporting Expectations (High-Level)

### User-Facing Visibility

**What Users See:**
- Their own sessions (all, not just active)
- Their own usage (tokens, sessions, cost)
- Their own quota limits and current usage
- Their own session history/timeline (per session)

**What Users Don't See:**
- Other users' sessions
- Other users' usage
- Platform-wide metrics
- Admin-level system health

**Transparency Requirements:**
- Clear quota limits (5 concurrent, 20/24h, 100k tokens/24h)
- Real-time usage updates (or near-real-time)
- Clear error messages when quota exceeded
- Cost visibility (if billing implemented)

---

### Admin-Facing Visibility

**What Admins See:**
- Platform-wide metrics (sessions, users, errors)
- Per-user summaries (usage, quota, sessions)
- System health (containers, database, uptime)
- Cost/billing data (aggregated)

**What Admins Don't See (Yet):**
- User conversation content (privacy)
- User code content (privacy)
- Real-time logs (deferred)
- Detailed billing breakdowns (deferred)

**Operational Requirements:**
- Real-time platform health (via existing runtime/metrics)
- On-demand user summaries (via existing admin endpoints)
- Error/termination visibility (via existing metrics)
- Cost visibility (via existing billing-visibility endpoints)

---

## 6. Landing Page Requirements (High-Level)

### Purpose

**Goal:** Convert prospective users to registered users

**Target Audience:**
- Developers evaluating AI coding tools
- Teams exploring sandbox environments
- Educators/students learning to code with AI

### Key Messages (High-Level)

**Primary Message:**
- "Build software by chatting with AI in isolated sandboxes"

**Secondary Messages:**
- Safe, isolated execution environment
- Automatic version control (checkpoints)
- Preview running applications
- Easy project export

**Trust Signals:**
- Security/isolation guarantees
- Pricing transparency
- Clear terms of service
- Privacy policy link

### Landing Page Structure (High-Level)

**Hero Section:**
- Headline (primary message)
- Subheadline (value proposition)
- Primary CTA: "Get Started" (signup)
- Secondary CTA: "Sign In" (login)

**Features Section:**
- 3-4 key features with icons/descriptions
- AI-assisted coding
- Isolated sandboxes
- Automatic checkpoints
- Live preview

**Social Proof Section (Optional):**
- Testimonials (future)
- Usage statistics (future)
- Trust badges (future)

**Footer:**
- Links: Pricing, Docs, Terms, Privacy
- Contact/support link

### Navigation

**Header:**
- Logo (left)
- Nav links: Features, Pricing, Docs
- Auth buttons: Sign In, Get Started (right)

**Footer:**
- Product links (Features, Pricing)
- Legal links (Terms, Privacy)
- Support links (Docs, Contact)

---

## 7. Pricing Page Requirements (High-Level)

### Purpose

**Goal:** Communicate pricing model and convert to signup

**Target Audience:**
- Prospective users evaluating cost
- Existing users considering upgrade (future)

### Pricing Model Visibility

**Current Model (Based on Quotas):**
- Free tier (default)
  - 5 concurrent sessions
  - 20 sessions per 24h
  - 100,000 tokens per 24h
- Paid tiers (future, out of scope)

**Pricing Page Structure (High-Level):**

**Hero Section:**
- Headline: "Simple, transparent pricing"
- Subheadline: "Start free, scale as you grow"

**Pricing Tiers (Cards):**

**Free Tier:**
- Price: $0/month
- Limits: 5 concurrent sessions, 20 sessions/24h, 100k tokens/24h
- Features: All core features
- CTA: "Get Started Free"

**Paid Tiers (Future):**
- Placeholder for Pro/Enterprise tiers
- Higher limits
- Additional features (future)

**FAQ Section:**
- What counts as a session?
- What counts as a token?
- What happens if I exceed limits?
- Can I upgrade later?

**Footer:**
- Link to full terms
- Link to docs
- Contact sales (future)

---

## 8. Docs / Discoverability Requirements (High-Level)

### Purpose

**Goal:** Help users understand and use the platform

**Target Audience:**
- New users (onboarding)
- Existing users (reference)
- Developers (API docs, future)

### Documentation Scope (High-Level)

**Getting Started:**
- What is AI Sandbox Platform?
- How to create a session
- How to chat with AI
- How to preview your app
- How to use checkpoints/revert

**Core Concepts:**
- Sessions
- Sandboxes
- Checkpoints
- Quotas
- Governance (idle timeout, max lifetime)

**Reference:**
- Quota limits
- Session lifecycle
- Error messages
- Troubleshooting

**API Documentation (Future):**
- REST API reference
- Authentication
- Rate limits
- Error codes

### Discoverability Entry Points

**In-App Help:**
- Help icon in workspace header → opens docs
- Contextual help tooltips (inline)
- Empty state messages link to docs

**Public Help:**
- Docs link in landing page footer
- Docs link in pricing page
- Docs link in error messages (where applicable)

**Search:**
- Docs site search (future)
- In-app help search (future)

---

## 9. Cross-Surface Responsive Requirements

### Responsive Strategy

**Desktop-First:**
- Primary target: 1920x1080 (baseline)
- Minimum: 1280x720
- Below minimum: Show "Please use larger screen" message

**Mobile (Deferred Details, High-Level Only):**
- Minimum viable mobile experience
- Focus: Dashboard and public surfaces (not workspace)
- Workspace on mobile: "Use desktop for full experience" message

**Tablet (Deferred Details, High-Level Only):**
- Hybrid approach (between mobile and desktop)
- Dashboard: Full experience
- Workspace: Simplified layout (stacked panels)

### Responsive Breakpoints (High-Level)

**Desktop (≥1280px):**
- Full three-panel workspace layout
- Full dashboard layout (sidebar + content)
- Full landing page layout

**Tablet (768px - 1279px):**
- Workspace: Stacked panels (chat → editor → preview, vertical)
- Dashboard: Simplified sidebar (collapsible)
- Landing page: Single-column layout

**Mobile (<768px):**
- Workspace: "Use desktop" message
- Dashboard: Mobile-optimized (no sidebar, stacked cards)
- Landing page: Mobile-optimized (single column, simplified)

### Cross-Surface Consistency

**Layout Patterns:**
- Consistent header across all surfaces (logo, nav, auth buttons)
- Consistent footer across public surfaces
- Consistent color scheme (primary, secondary, error, success)
- Consistent typography (headings, body, code)

**Component Reuse:**
- Session status badge (workspace, dashboard, admin)
- Quota progress bar (dashboard, admin)
- Error banner (workspace, dashboard)
- Loading spinner (all surfaces)

---

## 10. Cross-Surface Accessibility Requirements (High-Level)

### Accessibility Goals

**Baseline Compliance:**
- WCAG 2.1 Level AA (target, high-level)
- Keyboard navigation (all interactive elements)
- Screen reader compatibility (basic)
- Color contrast (4.5:1 minimum for text)

### Keyboard Navigation

**Workspace:**
- Tab: Navigate between panels
- Ctrl+1/2/3: Focus chat/editor/preview
- Ctrl+H: Open history drawer
- Esc: Close modals/drawers

**Dashboard:**
- Tab: Navigate between sections
- Enter: Activate links/buttons
- Esc: Close modals

**Public Surfaces:**
- Tab: Navigate links/buttons
- Enter: Activate CTAs
- Esc: Close modals (if any)

### Screen Reader Compatibility (Basic)

**ARIA Labels:**
- All interactive elements have labels
- Panel regions have role="region" and aria-label
- Status badges have aria-label (e.g., "Session status: active")

**Semantic HTML:**
- Use semantic elements (header, nav, main, footer, article, section)
- Use proper heading hierarchy (h1 → h2 → h3)
- Use lists for navigation and session lists

**Focus Management:**
- Focus visible (outline on focus)
- Focus trap in modals
- Focus returns to trigger after modal close

### Color Contrast (Basic)

**Text Contrast:**
- Body text: 4.5:1 minimum
- Headings: 4.5:1 minimum
- Links: 4.5:1 minimum

**Status Indicators:**
- Don't rely on color alone (use icons + text)
- Status badges: Icon + text + color
- Quota bars: Percentage + color

---

## 11. Launch-Critical States for Dashboard/Public Surfaces

### User Dashboard States

#### Empty State (No Sessions)

**Trigger:** User has no sessions

**Display:**
- Sessions section shows empty state
- Icon: Folder or session icon
- Heading: "No Sessions Yet"
- Body: "Create your first session to start building with AI"
- CTA: "Create New Session" button

---

#### Loading State (Fetching Dashboard Data)

**Trigger:** Dashboard loading sessions/usage data

**Display:**
- Skeleton/placeholder cards
- Loading spinner
- Message: "Loading dashboard..."

**Timeout:**
- After 10 seconds → show error

---

#### Active State (Dashboard Data Loaded)

**Trigger:** Dashboard data fetched successfully

**Display:**
- Session list populated
- Usage cards show current data
- Quota bars show usage
- All interactive elements enabled

---

#### Error State (Dashboard Fetch Failed)

**Trigger:** API error fetching dashboard data

**Display:**
- Error banner at top
- Message: "Failed to load dashboard"
- Body: Error reason (network, server, etc.)
- Action: "Retry" button

**Partial Failure:**
- If sessions load but usage fails → show sessions, show usage error
- If usage loads but sessions fail → show usage, show sessions error

---

### Admin Dashboard States

#### Empty State (No Data)

**Trigger:** No users, no sessions (unlikely in production)

**Display:**
- Empty state per section
- Overview: "No active sessions"
- Users: "No users yet"
- Sessions: "No sessions yet"

---

#### Loading State (Fetching Admin Data)

**Trigger:** Admin dashboard loading

**Display:**
- Skeleton/placeholder tables
- Loading spinner
- Message: "Loading admin dashboard..."

---

#### Active State (Admin Data Loaded)

**Trigger:** Admin data fetched successfully

**Display:**
- Metrics cards populated
- User list populated
- Session list populated
- All filters/search enabled

---

#### Error State (Admin Fetch Failed)

**Trigger:** API error fetching admin data

**Display:**
- Error banner
- Message: "Failed to load admin data"
- Action: "Retry" button

---

### Landing Page States

#### Loading State (Initial Load)

**Trigger:** Landing page loading

**Display:**
- Loading spinner (brief)
- Blank page or skeleton

**Note:** Should be fast (static content), loading state minimal

---

#### Active State (Page Loaded)

**Trigger:** Landing page loaded

**Display:**
- Hero section visible
- Features section visible
- Footer visible
- All CTAs enabled

---

#### Error State (Page Load Failed)

**Trigger:** Critical error loading page (rare)

**Display:**
- Error message
- Retry button
- Fallback: "Please refresh the page"

---

### Pricing Page States

**Same as Landing Page:**
- Loading state (brief)
- Active state (page loaded)
- Error state (page load failed, rare)

---

## 12. Launch-Readiness Criteria for This Slice

### Required for Launch

1. **User Dashboard Functional**
   - User can view all sessions
   - User can see usage/quota
   - User can navigate to workspace
   - User can delete sessions

2. **Admin Dashboard Functional (Basic)**
   - Admin can view platform metrics
   - Admin can view user summaries
   - Admin can search users
   - Admin can view session list

3. **Landing Page Functional**
   - Landing page loads
   - Hero section visible
   - CTAs work (signup/login)
   - Links work (pricing, docs)

4. **Pricing Page Functional**
   - Pricing page loads
   - Free tier visible
   - Quota limits clear
   - Signup CTA works

5. **Docs Functional (Basic)**
   - Docs site accessible
   - Getting started guide exists
   - Core concepts documented
   - Search works (basic)

6. **Responsive (Basic)**
   - Desktop: Full experience (1280px+)
   - Mobile: Dashboard works (simplified)
   - Mobile: Landing/pricing work
   - Mobile: Workspace shows "use desktop" message

7. **Accessibility (Basic)**
   - Keyboard navigation works
   - Focus visible
   - ARIA labels present
   - Color contrast meets minimum

### Acceptance Criteria

- User can access dashboard and see sessions/usage
- Admin can access admin dashboard and see platform health
- Prospective user can view landing page and sign up
- Prospective user can view pricing and understand limits
- User can access docs and find help
- All surfaces work on desktop (1280px+)
- Basic mobile experience for dashboard/public surfaces
- Keyboard navigation works across all surfaces
- Screen readers can navigate (basic)

### Deferred to Post-Launch

- Advanced admin actions (ban, suspend, refund)
- Detailed mobile/tablet optimization
- Advanced accessibility audit (WCAG 2.1 AA full compliance)
- Real-time admin alerts/notifications
- Advanced analytics dashboards
- User data export/deletion UI

---

## 13. Alignment with PRD / ARCHITECTURE / Backend Constraints

### PRD Alignment

**PRD Section 3A: Session Management**
- User dashboard displays all sessions (active and terminated)
- Admin dashboard monitors sessions across users

**PRD Section 3F: Usage, Quotas, and Billing**
- User dashboard shows quota usage (5 concurrent, 20/24h, 100k tokens/24h)
- Dashboard displays usage statistics
- Cost visibility foundation (billing-visibility endpoints)

**PRD Section 6: Error & Status Semantics**
- Dashboard respects 404 (not found), 410 (terminated), 429 (rate limit)
- Admin dashboard displays termination reasons

### ARCHITECTURE Alignment

**ARCHITECTURE Section 3: Service Architecture**
- Dashboard uses API Gateway endpoints (no direct service access)
- Admin dashboard uses internal admin endpoints (existing)

**ARCHITECTURE Section 7: Data Model**
- Dashboard queries sessions table (via API)
- Dashboard queries git_checkpoints table (via API, for timeline)
- Admin dashboard queries aggregated metrics (via runtime/metrics)

**ARCHITECTURE Section 8: API Design**
- Dashboard uses public APIs (JWT auth)
- Admin dashboard uses internal APIs (internal auth)

### Backend Constraints

**Existing Endpoints (User Dashboard):**
- `GET /api/sessions` → List user's active sessions (existing)
- `GET /api/sessions/:id` → Get session details (existing)
- `DELETE /api/sessions/:id` → Delete session (existing)

**Required New Endpoints (User Dashboard):**
- `GET /api/users/me` → Get current user info (user ID, email, created_at)
- `GET /api/users/me/usage` → Get current usage (sessions, tokens, cost)
- `GET /api/users/me/quotas` → Get quota limits and current usage
- `GET /api/sessions?includeTerminated=true` → List all sessions (not just active)

**Existing Endpoints (Admin Dashboard):**
- `GET /api/runtime/metrics` → Platform metrics (existing)
- `GET /api/internal/admin/users/:userId/summary` → User summary (existing)

**Required New Endpoints (Admin Dashboard):**
- `GET /api/internal/admin/users` → List all users (with search/filter)
- `GET /api/internal/admin/sessions` → List all sessions (all users, with filter)

**Note:** New endpoints required. Backend implementation task needed before frontend implementation.

---

## 14. User Dashboard UX Details

### Dashboard Header

**Content:**
- Logo (left, clickable → landing page)
- "Dashboard" title
- User menu (right): Username, Logout, Settings

**Navigation:**
- "Back to Workspace" link (returns to last session or workspace home)

### Sessions Section (Default View)

**Layout:**
```
+------------------------------------------+
| Sessions                    [New Session]|
+------------------------------------------+
| [All] [Active] [Terminated]             |
+------------------------------------------+
| Session Name    | Status | Created | ... |
|-----------------|--------|---------|-----|
| My Flask App    | Active | 2h ago  | [Open] [Delete] |
| Test Project    | Term.  | 1d ago  | [Open] [Delete] |
+------------------------------------------+
| Showing 2 of 2 sessions                 |
+------------------------------------------+
```

**Filters:**
- All (default)
- Active only
- Terminated only

**Sorting:**
- Last activity (default, most recent first)
- Created (oldest/newest)
- Name (alphabetical)

**Actions:**
- "Open" → Navigate to `/workspace/:sessionId`
- "Delete" → Confirmation modal → DELETE /api/sessions/:id

**Pagination:**
- 20 sessions per page
- "Load More" button or pagination controls

---

### Usage & Quotas Section

**Layout:**
```
+------------------------------------------+
| Usage & Quotas                          |
+------------------------------------------+
| Active Sessions                         |
| 3 / 5 used                              |
| [=========>    ] 60%                    |
| Status: OK                              |
+------------------------------------------+
| Sessions Created (Rolling 24h)          |
| 8 / 20 used                             |
| [======>       ] 40%                    |
| Resets in 6 hours                       |
+------------------------------------------+
| Tokens Used (Rolling 24h)               |
| 45,230 / 100,000 used                   |
| [=======>      ] 45%                    |
| Resets in 6 hours                       |
+------------------------------------------+
| Estimated Cost (Current Period)         |
| $2.45                                   |
| Based on token usage                    |
+------------------------------------------+
```

**Quota Cards:**
- Progress bar (visual)
- Percentage (numeric)
- Status indicator (OK / Warning / Exceeded)
- Reset time (for rolling windows)

**Warning Thresholds:**
- 80-100%: Warning (yellow)
- 100%+: Exceeded (red)

---

### Account Settings Section

**Layout:**
```
+------------------------------------------+
| Account Settings                        |
+------------------------------------------+
| Account Information                     |
| User ID: abc-123-def-456                |
| Email: user@example.com                 |
| Created: 2026-01-15                     |
+------------------------------------------+
| Preferences                             |
| Default session name: [Untitled]        |
| Workspace layout: [Balanced]            |
| [Save Changes]                          |
+------------------------------------------+
```

**Editable Fields:**
- Default session name format
- Workspace layout preference (balanced, chat-focused, code-focused, preview-focused)

**Read-Only Fields:**
- User ID
- Email (unless auth supports email change)
- Account created date

---

## 15. Admin Dashboard UX Details (High-Level Only)

### Admin Dashboard Header

**Content:**
- Logo (left)
- "Admin Dashboard" title
- Admin menu (right): Admin name, Logout

**Access Control:**
- Requires admin role
- 403 Forbidden for non-admin users

### Overview Section (Default View)

**Layout:**
```
+------------------------------------------+
| Platform Overview                       |
+------------------------------------------+
| [Active Sessions] [Total Users]         |
| 42                12                     |
+------------------------------------------+
| [Error Rate]      [System Uptime]       |
| 0.3%              99.9%                  |
+------------------------------------------+
| Recent Activity                         |
| • Session abc123 started (user@...)     |
| • Session def456 terminated (idle)      |
| • User xyz created                      |
+------------------------------------------+
```

**Metrics Cards:**
- Active sessions count (from runtime/metrics)
- Total users count (from admin endpoint, future)
- Error rate (last 24h, from runtime/metrics)
- System uptime (from runtime/metrics)

**Recent Activity Feed:**
- Last 10 events (session start, stop, terminate, user create)
- Timestamp (relative)
- Event type
- User/session identifier

---

### Users Section

**Layout:**
```
+------------------------------------------+
| Users                     [Search: ...] |
+------------------------------------------+
| User ID | Email | Sessions | Quota | ... |
|---------|-------|----------|-------|-----|
| abc-123 | u@e.c | 3 active | OK    | [View] |
| def-456 | x@y.c | 0 active | WARN  | [View] |
+------------------------------------------+
```

**Search/Filter:**
- Search by user ID or email
- Filter by quota status (OK, Warning, Exceeded)
- Filter by active sessions count

**User Detail View (Modal or Separate Page):**
- User metadata
- Current quota usage (all three quotas)
- Session list (all sessions for user)
- Usage history (high-level)
- Admin actions (future: ban, suspend, refund)

---

### Sessions Section

**Layout:**
```
+------------------------------------------+
| Sessions                  [Filter: ...] |
+------------------------------------------+
| Session ID | User | Status | Created | ...|
|------------|------|--------|---------|-----|
| abc-123... | u@e  | Active | 2h ago  | [View] |
| def-456... | x@y  | Term.  | 1d ago  | [View] |
+------------------------------------------+
```

**Filter:**
- By status (active, terminated)
- By user (search by user ID or email)
- By date range

**Session Detail View:**
- Session metadata
- User info
- Timeline (checkpoints)
- Termination reason (if terminated)
- Admin actions (future: force terminate)

---

### System Metrics Section

**Layout:**
```
+------------------------------------------+
| System Metrics                          |
+------------------------------------------+
| Runtime Metrics (from /api/runtime/metrics) |
| • Active sessions: 42                   |
| • Running containers: 42                |
| • Terminated sessions: 158              |
| • Termination reasons:                  |
|   - idle_timeout: 120                   |
|   - max_lifetime: 30                    |
|   - user_deleted: 8                     |
+------------------------------------------+
| Cost Visibility (from billing endpoints)|
| • Total cost (current period): $123.45  |
| • Provider breakdown: ...               |
+------------------------------------------+
```

**Data Sources:**
- Runtime metrics: `GET /api/runtime/metrics`
- Cost visibility: Billing-visibility endpoints (existing)
- Efficiency summary: Efficiency-summary endpoints (existing)

---

## 16. Landing Page UX Details (High-Level Only)

### Landing Page Layout

**Structure:**
```
+------------------------------------------+
| Header: [Logo] [Features] [Pricing] [Docs] [Sign In] [Get Started] |
+------------------------------------------+
| Hero Section                            |
| Build software by chatting with AI      |
| [Get Started Free] [Sign In]            |
+------------------------------------------+
| Features Section                        |
| [Icon] AI-Assisted Coding               |
| [Icon] Isolated Sandboxes               |
| [Icon] Automatic Checkpoints            |
| [Icon] Live Preview                     |
+------------------------------------------+
| Footer: [Features] [Pricing] [Docs] [Terms] [Privacy] |
+------------------------------------------+
```

**Hero Section:**
- Headline (H1): "Build software by chatting with AI"
- Subheadline: "Isolated sandboxes with automatic version control"
- Primary CTA: "Get Started Free" (signup)
- Secondary CTA: "Sign In" (login)

**Features Section:**
- 4 feature cards (icon + title + description)
- Brief descriptions (1-2 sentences each)

**Footer:**
- Product links (Features, Pricing, Docs)
- Legal links (Terms of Service, Privacy Policy)
- Support links (Contact, Help)

---

## 17. Pricing Page UX Details (High-Level Only)

### Pricing Page Layout

**Structure:**
```
+------------------------------------------+
| Header: [Logo] [Features] [Pricing] [Docs] [Sign In] [Get Started] |
+------------------------------------------+
| Hero Section                            |
| Simple, transparent pricing             |
+------------------------------------------+
| Pricing Tiers                           |
| [Free Tier Card]                        |
| $0/month                                |
| 5 concurrent sessions                   |
| 20 sessions/24h                         |
| 100k tokens/24h                         |
| [Get Started Free]                      |
+------------------------------------------+
| FAQ Section                             |
| Q: What counts as a session?            |
| A: ...                                  |
+------------------------------------------+
| Footer: [Features] [Pricing] [Docs] [Terms] [Privacy] |
+------------------------------------------+
```

**Free Tier Card:**
- Price: $0/month
- Limits (clear, specific)
- Features (all core features)
- CTA: "Get Started Free"

**FAQ:**
- 5-7 common questions
- Clear, concise answers
- Link to full docs

---

## 18. Docs / Discoverability UX Details (High-Level Only)

### Docs Site Layout

**Structure:**
```
+------------------------------------------+
| Header: [Logo] [Search] [Sign In]      |
+------------------------------------------+
| Sidebar       | Main Content             |
| Getting Started                         |
| • What is...  | [Doc Content]            |
| • Create...   |                          |
| Core Concepts |                          |
| • Sessions    |                          |
| • Checkpoints |                          |
+------------------------------------------+
```

**Sidebar Navigation:**
- Getting Started (default)
- Core Concepts
- Reference
- Troubleshooting
- API Docs (future)

**Search:**
- Search bar in header
- Search across all docs
- Results page with snippets

**Doc Content:**
- Markdown-based
- Code examples (syntax-highlighted)
- Screenshots (optional)
- Links to related docs

---

## 19. Cross-Surface Launch Polish Requirements

### Visual Consistency

**Color Scheme:**
- Primary color (CTAs, links, active states)
- Secondary color (secondary CTAs, accents)
- Success color (green, for active/success states)
- Warning color (yellow, for warning states)
- Error color (red, for error/terminated states)
- Neutral colors (grays, for text/backgrounds)

**Typography:**
- Headings: Sans-serif, bold, consistent hierarchy
- Body: Sans-serif, regular, 16px minimum
- Code: Monospace, syntax-highlighted

**Spacing:**
- Consistent padding/margin (8px grid)
- Consistent card/panel spacing
- Consistent section spacing

---

### Error Message Clarity

**Error Message Format:**
- Heading: What went wrong (concise)
- Body: Why it happened (1-2 sentences)
- Action: What user can do (button or link)

**Examples:**

**Session Creation Failed:**
- Heading: "Failed to Create Session"
- Body: "Maximum 5 concurrent sessions reached. Delete a session to create a new one."
- Action: "View Sessions" button

**Quota Exceeded:**
- Heading: "Quota Exceeded"
- Body: "You've used 100,000 tokens in the last 24 hours. Your quota resets in 6 hours."
- Action: "View Usage" button

**Network Error:**
- Heading: "Connection Error"
- Body: "Unable to reach the server. Please check your connection and try again."
- Action: "Retry" button

---

### Loading Feedback

**Loading States:**
- Spinner (visual indicator)
- Message (what's loading)
- Estimated time (if available)
- Timeout handling (show error after threshold)

**Loading Locations:**
- Session creation (10-15 seconds)
- Dashboard data fetch (1-2 seconds)
- Timeline fetch (1-2 seconds)
- Diff fetch (1-3 seconds)
- Preview load (variable)

**Loading Best Practices:**
- Show spinner immediately (no delay)
- Show message after 1 second (if still loading)
- Show timeout warning after 30 seconds (if still loading)
- Show error after 60 seconds (if still loading)

---

### Trust Signals

**Security/Isolation:**
- "Isolated sandboxes" messaging (landing page)
- "Your code is private" (privacy policy link)
- "Automatic backups" (checkpoint messaging)

**Transparency:**
- Clear pricing (pricing page)
- Clear quota limits (dashboard)
- Clear error messages (all surfaces)
- Clear terms of service (footer link)

**Reliability:**
- System uptime indicator (admin dashboard)
- Error rate visibility (admin dashboard)
- Session status accuracy (workspace, dashboard)

**Privacy:**
- Privacy policy link (footer)
- "We don't sell your data" (privacy page)
- "Your conversations are private" (docs)

---

## 20. Preserved Invariants

### Architecture Invariants

- No background workers
- Request-driven enforcement
- Persistent terminal state (terminated sessions stay terminated)
- Deterministic error semantics (404, 410, 429, 502)
- No WebSocket control plane

### Backend Invariants

- New public endpoints required (user dashboard: GET /api/users/me, GET /api/users/me/usage, GET /api/users/me/quotas)
- New internal endpoints required (admin dashboard: GET /api/internal/admin/users, GET /api/internal/admin/sessions)
- No schema changes required (use existing tables)
- No API contract changes to existing endpoints

### Governance Invariants

- Dashboard respects session lifecycle (CREATED → ACTIVE → TERMINATED)
- Dashboard enforces read-only on terminated sessions
- Dashboard respects quotas (max 5 concurrent sessions, 20/24h, 100k tokens/24h)
- Dashboard respects rate limits (429 handling)
- Admin dashboard respects internal auth (X-Internal-Service-Key)

### UX Invariants

- No session resurrection (terminated = permanent)
- No background state mutation visible to user
- Deterministic state transitions (same input → same output)
- Clear error messages for all failure modes
- Privacy preserved (no conversation content in admin dashboard)

---

## 21. Implementation Guidance (For Next Phase)

### Frontend Requirements

**New Pages:**
- `/dashboard` (user dashboard)
- `/admin` (admin dashboard)
- `/` (landing page)
- `/pricing` (pricing page)
- `/docs` (docs site)

**New Components:**
- `UserDashboard` (sessions, usage, settings)
- `SessionTable` (session list with actions)
- `UsageCard` (quota progress card)
- `AdminDashboard` (platform overview)
- `AdminUserTable` (user list)
- `AdminSessionTable` (session list, all users)
- `LandingPage` (hero, features, footer)
- `PricingPage` (tiers, FAQ)
- `DocsLayout` (sidebar, content)

**State Management:**
- User sessions list
- User usage/quota data
- Admin metrics data
- Admin user list
- Admin session list

**API Integration (New Endpoints Required):**
- `GET /api/users/me` → Current user info
- `GET /api/users/me/usage` → Current usage
- `GET /api/users/me/quotas` → Quota limits and usage
- `GET /api/sessions?includeTerminated=true` → All sessions (not just active)
- `GET /api/internal/admin/users` → All users (admin only)
- `GET /api/internal/admin/sessions` → All sessions (admin only)

### Backend Requirements (New Endpoints)

**User Endpoints (Public, JWT Auth):**

**1. GET /api/users/me**
- Returns: Current user info (userId, email, createdAt)
- Auth: JWT required
- Response:
  ```json
  {
    "userId": "uuid",
    "email": "user@example.com",
    "createdAt": "2026-01-15T10:00:00Z"
  }
  ```

**2. GET /api/users/me/usage**
- Returns: Current usage (sessions, tokens, cost)
- Auth: JWT required
- Response:
  ```json
  {
    "activeSessions": 3,
    "sessionsCreated24h": 8,
    "tokensUsed24h": 45230,
    "estimatedCost": 2.45,
    "resetAt": "2026-03-09T20:00:00Z"
  }
  ```

**3. GET /api/users/me/quotas**
- Returns: Quota limits and current usage
- Auth: JWT required
- Response:
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

**4. GET /api/sessions?includeTerminated=true**
- Returns: All sessions (active and terminated)
- Auth: JWT required
- Query param: `includeTerminated` (boolean, default false)
- Response: Array of sessions (same format as existing GET /api/sessions)

**Admin Endpoints (Internal, Internal Auth):**

**5. GET /api/internal/admin/users**
- Returns: List of all users with summary
- Auth: Internal service auth required
- Query params: `search` (email/userId), `quotaStatus` (OK/WARN/EXCEEDED)
- Response:
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

**6. GET /api/internal/admin/sessions**
- Returns: List of all sessions (all users)
- Auth: Internal service auth required
- Query params: `status` (active/terminated), `userId`, `dateRange`
- Response: Array of sessions with user info

---

## 22. TASK-67A Completion Status

### Coverage Summary

**PHASE-67A-1 (Complete):**
- ✅ Main authenticated workspace UX
- ✅ Chat/editor/preview layout
- ✅ Session navigation
- ✅ Core workspace states

**PHASE-67A-2 (Complete):**
- ✅ History/timeline UX
- ✅ Checkpoint/revert/diff UX
- ✅ Git-log UX
- ✅ Version control mental model

**PHASE-67A-3 (This Slice, Complete):**
- ✅ User dashboard UX
- ✅ Admin dashboard UX (high-level)
- ✅ Public surfaces (high-level)
- ✅ Launch polish (cross-surface)

### TASK-67A Scope Coverage

**From TASKS_BACKLOG_FULL.md → TASK-67A:**

1. ✅ Main App UX/UI Scope → Covered in 67A-1
2. ✅ Chat / Editor / Preview Workspace UX → Covered in 67A-1
3. ✅ Session Layout and Navigation UX → Covered in 67A-1
4. ✅ History / Timeline UX → Covered in 67A-2
5. ✅ Checkpoint / Revert / Diff / Git-Log UX → Covered in 67A-2
6. ✅ User Dashboard UX Requirements → Covered in 67A-3
7. ✅ Admin Dashboard UX Requirements (high-level) → Covered in 67A-3
8. ✅ Public-Facing Product Surface Requirements (high-level) → Covered in 67A-3
9. ✅ Responsive / Launch-Polish Requirements → Covered in 67A-3
10. ✅ Alignment with Current Architecture → All slices

### TASK-67A Status

**Status:** COMPLETE

All required UX/UI surfaces for launch readiness are now defined across three slices (67A-1, 67A-2, 67A-3). Design phase complete. Ready for implementation phase (separate tasks).

---

## 23. Launch-Readiness Criteria for This Slice

### Required for Launch

1. **User Dashboard Functional**
   - User can view all sessions (active and terminated)
   - User can see current usage and quota limits
   - User can navigate to workspace from dashboard
   - User can delete sessions from dashboard

2. **Admin Dashboard Functional (Basic)**
   - Admin can view platform metrics
   - Admin can view user list
   - Admin can search users
   - Admin can view session list (all users)

3. **Landing Page Functional**
   - Landing page loads and displays hero
   - CTAs work (signup, login)
   - Navigation works (features, pricing, docs)
   - Footer links work

4. **Pricing Page Functional**
   - Pricing page loads and displays free tier
   - Quota limits clearly stated
   - Signup CTA works
   - FAQ section present

5. **Docs Functional (Basic)**
   - Docs site accessible
   - Getting started guide present
   - Core concepts documented
   - Search works (basic)

6. **Cross-Surface Polish**
   - Visual consistency (colors, typography, spacing)
   - Error messages clear and actionable
   - Loading states provide feedback
   - Trust signals present (privacy, terms, security)

### Acceptance Criteria

- User can access dashboard and manage sessions
- User can see usage/quota and understand limits
- Admin can monitor platform and users
- Prospective user can understand platform and sign up
- All surfaces visually consistent
- All surfaces handle empty/loading/error states
- Basic responsive support (desktop + simplified mobile)
- Basic accessibility support (keyboard nav, screen reader)

### Deferred to Post-Launch

- Advanced admin actions (ban, suspend, refund, manual quota adjustment)
- Detailed mobile/tablet optimization (beyond basic responsive)
- Advanced accessibility audit (full WCAG 2.1 AA compliance)
- Real-time admin alerts/notifications
- Advanced user analytics dashboards
- User data export/deletion UI
- Multi-language support

---

## 24. Alignment with PRD / ARCHITECTURE / Backend Constraints

### PRD Alignment

**PRD Section 3A: Session Management**
- User dashboard lists all sessions (active and terminated)
- Admin dashboard monitors sessions across users
- Dashboard enforces session ownership (user sees only their sessions)

**PRD Section 3F: Usage, Quotas, and Billing**
- User dashboard displays quota usage (5 concurrent, 20/24h, 100k tokens/24h)
- Dashboard shows usage statistics
- Cost visibility (via billing-visibility endpoints)
- Admin dashboard shows platform-wide usage

**PRD Section 6: Error & Status Semantics**
- Dashboard respects 404, 410, 429, 502
- Dashboard displays termination reasons
- Dashboard handles quota exceeded (403)

### ARCHITECTURE Alignment

**ARCHITECTURE Section 3: Service Architecture**
- Dashboard uses API Gateway endpoints (no direct service access)
- Admin dashboard uses internal admin endpoints
- Public surfaces are stateless (no backend state)

**ARCHITECTURE Section 8: API Design**
- Dashboard uses public APIs (JWT auth)
- Admin dashboard uses internal APIs (internal auth)
- Public surfaces use public APIs (no auth required)

### Backend Constraints

**Existing Endpoints:**
- ✅ `GET /api/sessions` (list active sessions)
- ✅ `GET /api/sessions/:id` (get session)
- ✅ `DELETE /api/sessions/:id` (delete session)
- ✅ `GET /api/runtime/metrics` (platform metrics)
- ✅ `GET /api/internal/admin/users/:userId/summary` (user summary)
- ✅ Billing-visibility endpoints (cost/usage)

**Required New Endpoints:**
- ❌ `GET /api/users/me` (current user info)
- ❌ `GET /api/users/me/usage` (current usage)
- ❌ `GET /api/users/me/quotas` (quota limits and usage)
- ❌ `GET /api/sessions?includeTerminated=true` (all sessions)
- ❌ `GET /api/internal/admin/users` (all users, admin only)
- ❌ `GET /api/internal/admin/sessions` (all sessions, admin only)

**Note:** Backend implementation of these endpoints is a prerequisite for frontend implementation of this UX slice. Backend task should be created separately.

---

## 25. Backend Dependency Summary

### Existing (Already Implemented)

**User-Facing:**
- ✅ Session CRUD (create, read, delete)
- ✅ Session status (active, terminated)
- ✅ Checkpoint recording (auto-commit)

**Admin-Facing:**
- ✅ Runtime metrics (GET /api/runtime/metrics)
- ✅ User summary (GET /api/internal/admin/users/:userId/summary)
- ✅ Billing visibility (GET /api/billing/*)

### Required (Not Yet Implemented)

**User Dashboard:**
- ❌ Current user endpoint (GET /api/users/me)
- ❌ User usage endpoint (GET /api/users/me/usage)
- ❌ User quota endpoint (GET /api/users/me/quotas)
- ❌ All sessions endpoint (GET /api/sessions?includeTerminated=true)

**Admin Dashboard:**
- ❌ User list endpoint (GET /api/internal/admin/users)
- ❌ All sessions endpoint (GET /api/internal/admin/sessions)

**History/Control (From 67A-2):**
- ❌ Checkpoint list endpoint (GET /api/sessions/:id/checkpoints)
- ❌ Checkpoint diff endpoint (GET /api/sessions/:id/checkpoints/:hash/diff)
- ❌ Revert endpoint (POST /api/sessions/:id/revert)

**Note:** Backend implementation of these endpoints is required before frontend implementation can proceed. Separate backend task(s) should be created.

---

## 26. Recommended Next Steps

### Backend Implementation Tasks (Required Before Frontend)

**Task 1: User Dashboard Endpoints**
- Implement GET /api/users/me
- Implement GET /api/users/me/usage
- Implement GET /api/users/me/quotas
- Extend GET /api/sessions to support includeTerminated query param

**Task 2: Admin Dashboard Endpoints**
- Implement GET /api/internal/admin/users
- Implement GET /api/internal/admin/sessions

**Task 3: History/Control Endpoints (From 67A-2)**
- Implement GET /api/sessions/:id/checkpoints
- Implement GET /api/sessions/:id/checkpoints/:hash/diff
- Implement POST /api/sessions/:id/revert

### Frontend Implementation Tasks (After Backend Complete)

**Task 4: Main Workspace Implementation (67A-1)**
- Implement WorkspaceLayout component
- Implement ChatPanel, EditorPanel, PreviewPanel
- Implement SessionSidebar
- Implement workspace states (empty, loading, active, error)

**Task 5: History/Control Implementation (67A-2)**
- Implement TimelineDrawer component
- Implement DiffViewer component
- Implement RevertConfirmationModal
- Integrate with workspace

**Task 6: Dashboard Implementation (67A-3)**
- Implement UserDashboard page
- Implement AdminDashboard page
- Implement session/usage/quota displays

**Task 7: Public Surfaces Implementation (67A-3)**
- Implement LandingPage
- Implement PricingPage
- Implement DocsLayout

**Task 8: Launch Polish (67A-3)**
- Implement responsive layouts
- Implement accessibility features
- Implement error message consistency
- Implement loading feedback
- Implement trust signals

---

## 27. Validation

### Design Completeness

- ✅ User dashboard UX defined (sessions, usage, quotas, settings)
- ✅ Admin dashboard UX defined (high-level: overview, users, sessions, metrics)
- ✅ Public surfaces defined (high-level: landing, pricing, docs)
- ✅ Cross-surface responsive requirements defined (desktop-first, mobile basic)
- ✅ Cross-surface accessibility requirements defined (high-level: keyboard, screen reader, contrast)
- ✅ Launch polish requirements defined (consistency, errors, loading, trust)
- ✅ All dashboard states defined (empty, loading, active, error)
- ✅ Alignment with PRD/ARCHITECTURE verified
- ✅ Backend constraints identified (new endpoints required)

### Scope Discipline

- ✅ Stayed within dashboard/public/polish surfaces only
- ✅ Did not expand into implementation
- ✅ Did not invent new features beyond current platform direction
- ✅ Identified required backend endpoints (but did not implement)
- ✅ High-level only for admin dashboard, public surfaces, responsive, accessibility (as instructed)

### TASK-67A Completeness

- ✅ All required surfaces covered (workspace, history, dashboard, public)
- ✅ All user types addressed (developer, operator, prospective)
- ✅ All launch-critical states addressed (empty, loading, error, success)
- ✅ All alignment requirements met (PRD, ARCHITECTURE, backend)
- ✅ Implementation guidance provided (components, endpoints, tasks)

### Launch-Readiness

- ✅ Defines minimum viable dashboard UX
- ✅ Defines minimum viable admin dashboard UX (high-level)
- ✅ Defines minimum viable public surfaces (high-level)
- ✅ Defines launch polish requirements (cross-surface)
- ✅ Provides implementation roadmap (backend → frontend)
- ⚠️ Requires new backend endpoints (see section 24)

---

## 28. References

- TASKS_BACKLOG_FULL.md → TASK-67A
- TASKS.md → TASK-67A
- PRD.md → Sections 3A, 3F, 6
- ARCHITECTURE.md → Sections 3, 7, 8
- CLAUDE.md → Tech Stack, Workflow Rules
- docs/PHASE-67A-1-CHECKPOINT.md → Main workspace foundation
- docs/PHASE-67A-2-CHECKPOINT.md → History/control UX
- services/api-gateway/src/runtime/runtime.controller.ts → Runtime metrics endpoint
- services/api-gateway/src/admin/admin.controller.ts → Admin endpoints
- services/api-gateway/src/billing-visibility/billing-visibility.controller.ts → Billing visibility endpoints

---

## 29. Rollback

Not applicable. Documentation only. No runtime changes.

---

## 30. Sign-Off

**Phase:** 67
**Stage:** 67A-3
**Task ID:** TASK-67A
**Status:** COMPLETE
**Checkpoint:** PHASE-67A-3-CHECKPOINT.md

**TASK-67A Status:** COMPLETE

All three slices of TASK-67A are now complete:
- ✅ PHASE-67A-1: Main authenticated workspace UX
- ✅ PHASE-67A-2: History/control UX
- ✅ PHASE-67A-3: Dashboard/public/polish UX

**Next Phase:** Backend implementation tasks (create endpoints required by 67A-2 and 67A-3), followed by frontend implementation tasks (implement UX designs from 67A-1, 67A-2, 67A-3).

This checkpoint completes the core product UX/UI design phase. All launch-critical user-facing surfaces are now defined. Ready for implementation.
