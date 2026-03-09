# PHASE-67A-1-CHECKPOINT.md

## Metadata

**Phase:** 67
**Stage:** 67A-1
**Task ID:** TASK-67A (Slice 1)
**Title:** Core Product UX/UI Design — Main Authenticated Workspace Only
**Status:** COMPLETE
**Date:** 2026-03-09
**Nature:** DOCUMENTATION / DESIGN (NO CODE)

---

## 1. Scope

### Objective

Produce the first narrowed design checkpoint for the core authenticated product workspace, covering only the main app experience and primary workspace structure. This slice establishes the foundation for authenticated user interaction with the AI Sandbox Platform.

### Why This Slice First

The main authenticated workspace is the primary user-facing surface where all core product value is delivered. Before designing history/timeline, checkpoints, dashboards, or public-facing surfaces, the fundamental workspace layout and interaction model must be established. This slice defines:

- How users interact with their sandbox
- How chat, editor, and preview coexist
- How sessions are structured and navigated
- The core information architecture for authenticated users

All subsequent UX slices (history, checkpoints, dashboards) depend on this foundation.

### In-Scope Surfaces

1. **Main Authenticated Workspace Layout**
   - Chat panel
   - Code editor panel
   - Preview panel
   - Session context panel

2. **Session Layout and Navigation**
   - Session list/switcher
   - Session creation entry point
   - Session context display
   - Session status visibility

3. **Chat / Editor / Preview Interaction Model**
   - Panel arrangement and resizing
   - Focus management
   - State synchronization
   - Workspace modes (chat-focused, code-focused, preview-focused)

4. **Core Authenticated User Journey**
   - Entry to workspace
   - Session creation
   - First interaction
   - Iterative development cycle

5. **Main Workspace States**
   - Empty state (no session)
   - Loading state (session starting)
   - Active state (session ready)
   - Error state (session failed/terminated)

### Out-of-Scope

- History / timeline UX (PHASE-67A-2)
- Checkpoint / revert / diff / git-log UX (PHASE-67A-3)
- User dashboard UX (PHASE-67A-4)
- Admin dashboard UX (PHASE-67A-5)
- Landing page / pricing / docs (PHASE-67A-6)
- Responsive/polish beyond main workspace (PHASE-67A-7)
- Any implementation
- Any code changes
- Any schema/API/backend/frontend changes

---

## 2. User Types Relevant to Main Workspace

### Primary User: Authenticated Developer

**Context:**
- Has account
- Authenticated via JWT
- Owns sessions
- Interacts with AI to build software

**Goals:**
- Create sandbox sessions
- Chat with AI to generate/modify code
- See code in editor
- Preview running applications
- Iterate quickly

**Constraints:**
- Subject to quotas (max 5 concurrent sessions, 20 sessions/24h, 100k tokens/24h)
- Subject to rate limits
- Subject to session governance (idle timeout, max lifetime)

---

## 3. Core Authenticated User Journey

### Journey: Create Session → Build → Preview → Iterate

**Step 1: Entry to Workspace**
- User logs in (auth handled separately)
- Lands on main authenticated workspace
- Sees session list/switcher (empty or with existing sessions)

**Step 2: Session Creation**
- User clicks "New Session" or similar entry point
- Session creation modal/flow appears
- User optionally provides session name/description
- System creates session (POST /api/sessions)
- Workspace transitions to loading state

**Step 3: Session Ready**
- Container starts
- Workspace transitions to active state
- Chat panel ready for input
- Editor shows workspace filesystem (empty or template)
- Preview panel shows "no preview running" or similar

**Step 4: First Interaction**
- User types message in chat
- AI responds with code/commands
- Code appears in editor
- User can execute commands
- Preview updates if app runs

**Step 5: Iterative Development**
- User continues chatting
- AI modifies code
- User reviews changes in editor
- User previews running app
- Cycle repeats

**Step 6: Session End (Optional)**
- User closes session
- System terminates session
- Workspace returns to session list

---

## 4. Workspace Layout Model

### Layout Structure

The main authenticated workspace uses a **three-panel layout** with optional fourth panel:

```
+------------------------------------------+
| Header (session context, user menu)     |
+------------------------------------------+
| Chat Panel | Editor Panel | Preview Panel|
|            |              |               |
|            |              |               |
|            |              |               |
+------------------------------------------+
| Footer (status, session info)           |
+------------------------------------------+
```

Optional fourth panel: **Session Sidebar** (collapsible, left side)

### Panel Responsibilities

**Chat Panel (Left)**
- AI conversation history
- User input field
- Message streaming
- Code blocks in messages
- Command execution results

**Editor Panel (Center)**
- Monaco Editor instance
- File tree (collapsible)
- Current file content
- Syntax highlighting
- Read-only or editable based on session state

**Preview Panel (Right)**
- Iframe for preview proxy
- Preview URL display
- Preview status (loading, ready, error)
- Refresh control
- "No preview running" empty state

**Session Sidebar (Optional, Left)**
- Session list
- Session switcher
- Session creation button
- Session status indicators
- Collapsible to maximize workspace

### Panel Sizing

- Default: Chat 30%, Editor 40%, Preview 30%
- Resizable via drag handles
- Minimum width: 20% per panel
- Panels can be collapsed (not removed)
- Layout preference persists per user (localStorage)

---

## 5. Chat / Editor / Preview Interaction Model

### Interaction Patterns

**Chat → Editor:**
- AI generates code → appears in editor
- AI modifies file → editor updates
- User references file in chat → editor highlights

**Chat → Preview:**
- AI runs dev server → preview loads
- User requests preview → preview panel activates
- Preview error → chat shows error message

**Editor → Chat:**
- User selects code → "Ask AI about this" action
- User edits file → AI aware of changes
- File error → chat shows error

**Editor → Preview:**
- File save → preview hot-reloads (if dev server running)
- No direct interaction otherwise

**Preview → Chat:**
- Preview error → user asks AI to fix
- User describes preview behavior → AI responds

### Focus Management

- One panel has focus at a time
- Focus indicated by border highlight
- Keyboard shortcuts switch focus (Ctrl+1, Ctrl+2, Ctrl+3)
- Click switches focus
- Chat input always captures focus when user types

### State Synchronization

- Chat messages reference files → editor scrolls to file
- Editor changes → chat aware (AI context)
- Preview URL changes → chat shows notification
- Session state changes → all panels update

### Workspace Modes

**Chat-Focused Mode:**
- Chat panel expanded (50%)
- Editor collapsed or minimized
- Preview hidden or minimized
- Used for: initial planning, asking questions

**Code-Focused Mode:**
- Editor panel expanded (60%)
- Chat visible but narrow (20%)
- Preview visible (20%)
- Used for: reviewing code, manual edits

**Preview-Focused Mode:**
- Preview panel expanded (60%)
- Editor visible (30%)
- Chat visible but narrow (10%)
- Used for: testing UI, reviewing app behavior

**Balanced Mode (Default):**
- Chat 30%, Editor 40%, Preview 30%
- Used for: iterative development

---

## 6. Session Layout and Navigation Model

### Session Context Display

**Header Section:**
- Session name (editable inline)
- Session status badge (active, starting, terminated)
- Session age (time since creation)
- Last activity timestamp
- User menu (logout, settings)

**Footer Section:**
- Container status (running, stopped)
- Resource usage (optional, if available from metrics)
- Session ID (for debugging)
- Preview URL (if active)

### Session Switcher

**Location:** Session Sidebar (collapsible, left side)

**Contents:**
- List of user's sessions (most recent first)
- Session name
- Session status indicator (dot: green=active, red=terminated, yellow=starting)
- Last activity timestamp
- "New Session" button at top

**Behavior:**
- Click session → switch workspace to that session
- Click "New Session" → create session flow
- Session list updates on session create/delete
- Terminated sessions shown but grayed out
- Maximum 5 active sessions enforced (quota)

### Navigation Patterns

**Session Switching:**
- Click session in sidebar → workspace loads that session
- Workspace state resets (chat, editor, preview all reload)
- URL updates to `/workspace/:sessionId`

**Session Creation:**
- Click "New Session" → modal appears
- User provides optional name
- System creates session
- Workspace switches to new session

**Session Deletion:**
- Click "Delete" in session context menu
- Confirmation modal appears
- System deletes session (DELETE /api/sessions/:id)
- Workspace returns to session list or switches to another session

---

## 7. Main Workspace Information Architecture

### Information Hierarchy

**Primary:** Current session's chat conversation
**Secondary:** Current file in editor
**Tertiary:** Preview of running app
**Contextual:** Session metadata, status, resource info

### Visual Hierarchy

**High Priority (Always Visible):**
- Chat input field
- Current message stream
- Editor current file
- Preview iframe

**Medium Priority (Visible but not focal):**
- File tree
- Session status badge
- Session name
- Footer info

**Low Priority (Collapsible/Hidden by Default):**
- Session sidebar (can collapse)
- Session list (in sidebar)
- Advanced session info (in footer)

### Content Organization

**Chat Panel:**
- Reverse chronological (newest at bottom)
- Auto-scroll to latest message
- Code blocks syntax-highlighted
- Command outputs formatted
- Error messages visually distinct

**Editor Panel:**
- File tree (collapsible)
- Breadcrumb for current file
- Tab bar for open files
- Editor content (Monaco)

**Preview Panel:**
- Preview URL bar (read-only)
- Iframe for preview content
- Refresh button
- "Open in new tab" button
- Status indicator (loading, ready, error)

---

## 8. Main Workspace States

### Empty State (No Session)

**Trigger:** User has no active session selected

**Display:**
- Session sidebar visible
- Session list empty or shows only terminated sessions
- Main workspace shows empty state message
- "Create your first session" call-to-action
- Brief explanation of what sessions are

**Actions Available:**
- Create new session
- View terminated sessions (read-only)

**Visual:**
- Centered empty state illustration
- Primary CTA button
- Secondary help text

---

### Loading State (Session Starting)

**Trigger:** Session creation in progress, container starting

**Display:**
- Chat panel: "Starting session..." message
- Editor panel: Loading spinner
- Preview panel: Disabled/grayed
- Session status badge: "Starting" (yellow)

**Actions Available:**
- Cancel session creation (optional)
- No chat input
- No editor interaction
- No preview interaction

**Visual:**
- Loading spinner in each panel
- Progress message in chat
- Estimated time (if available)

**Timeout Behavior:**
- If loading exceeds 30 seconds → show warning
- If loading exceeds 60 seconds → show error, offer retry

---

### Active State (Session Ready)

**Trigger:** Session container running, ready for interaction

**Display:**
- Chat panel: Ready for input, shows conversation history
- Editor panel: Shows workspace files, ready for edits
- Preview panel: Shows "no preview" or active preview
- Session status badge: "Active" (green)

**Actions Available:**
- Send chat messages
- Execute commands
- Edit files (if editable)
- View preview
- Switch sessions
- Delete session

**Visual:**
- All panels interactive
- Focus indicators visible
- Status badge green
- Footer shows session info

---

### Error State (Session Failed/Terminated)

**Trigger:** Session terminated (idle timeout, max lifetime, error, user deletion)

**Display:**
- Chat panel: Error message with termination reason
- Editor panel: Read-only, grayed out
- Preview panel: Disabled, shows error
- Session status badge: "Terminated" (red)

**Actions Available:**
- View conversation history (read-only)
- View files (read-only)
- Create new session
- Return to session list

**Visual:**
- Error banner at top of workspace
- Termination reason displayed
- All panels read-only
- "Create New Session" CTA

**Error Messages by Termination Reason:**
- `idle_timeout`: "Session terminated due to inactivity"
- `max_lifetime`: "Session reached maximum lifetime"
- `user_deleted`: "Session deleted"
- `error`: "Session terminated due to error"

---

## 9. Launch-Readiness Criteria for This Slice

### Required for Launch

1. **Workspace Layout Implemented**
   - Three-panel layout functional
   - Panels resizable
   - Layout persists per user

2. **Session Navigation Functional**
   - Session list/switcher works
   - Session creation works
   - Session switching works
   - Session deletion works

3. **Core States Implemented**
   - Empty state displays correctly
   - Loading state displays during session start
   - Active state enables all interactions
   - Error state displays termination reason

4. **Chat/Editor/Preview Interaction Works**
   - Chat messages appear
   - AI responses stream
   - Code appears in editor
   - Preview loads when app runs

5. **Session Context Visible**
   - Session name displayed
   - Session status badge accurate
   - Session age/activity visible
   - Footer info correct

### Acceptance Criteria

- User can create session and see workspace
- User can chat with AI and see responses
- User can see code in editor
- User can see preview when app runs
- User can switch between sessions
- User can see session status
- User sees correct empty/loading/error states
- Workspace layout is usable on desktop (1920x1080 minimum)

### Deferred to Later Slices

- History/timeline UX (67A-2)
- Checkpoint/revert/diff UX (67A-3)
- User dashboard (67A-4)
- Admin dashboard (67A-5)
- Public-facing surfaces (67A-6)
- Responsive/mobile polish (67A-7)

---

## 10. Alignment with PRD / ARCHITECTURE / Backend Constraints

### PRD Alignment

**PRD Section 3A: Session Management**
- Workspace displays session lifecycle (created → active → terminated)
- Workspace enforces read-only on terminated sessions
- Workspace shows termination reason

**PRD Section 3B: Code Execution**
- Chat panel shows command execution results
- Editor reflects file changes from AI actions

**PRD Section 3C: File System Operations**
- Editor shows workspace filesystem
- File tree reflects current session workspace

**PRD Section 3D: Preview & Run**
- Preview panel proxies to session preview URL
- Preview shows health/readiness status
- Preview respects session termination (410 Gone)

**PRD Section 3E: AI Integration**
- Chat panel is primary AI interaction surface
- AI responses appear in chat
- AI-generated code appears in editor

### ARCHITECTURE Alignment

**ARCHITECTURE Section 4: Session Lifecycle**
- Workspace reflects session states: CREATED → ACTIVE → TERMINATED
- Workspace enforces terminal state (no resurrection)
- Workspace shows 410 Gone as error state

**ARCHITECTURE Section 6: Preview Architecture**
- Preview panel is passive proxy only
- Preview does not contain governance logic
- WebSocket preview only (not control plane)

**ARCHITECTURE Section 10: Error Semantics**
- Workspace displays HTTP 404 (not found) as error
- Workspace displays HTTP 410 (terminated) as terminal error
- Workspace displays HTTP 429 (rate limit) as temporary error
- Workspace displays HTTP 502 (preview failure) as preview error

### Backend Constraints

**Existing Endpoints:**
- `POST /api/sessions` → Create session (workspace calls on "New Session")
- `GET /api/sessions/:id` → Get session (workspace polls for status)
- `DELETE /api/sessions/:id` → Delete session (workspace calls on delete)
- `POST /api/sessions/:id/exec` → Execute command (chat panel calls)
- `GET /api/sessions/:id/preview/health` → Preview health (preview panel polls)
- Preview proxy: `/api/sessions/:id/preview/*` (preview iframe src)

**No New Endpoints Required:**
- All workspace functionality uses existing endpoints
- No new backend changes needed for this slice

**Quota Enforcement:**
- Workspace respects HTTP 403 Forbidden (quota exceeded)
- Workspace shows quota error in session creation flow
- Workspace shows max 5 concurrent sessions in session list

**Rate Limiting:**
- Workspace respects HTTP 429 Too Many Requests
- Workspace shows rate limit error with Retry-After
- Workspace disables actions temporarily on rate limit

---

## 11. Workspace Layout Design

### Layout Model: Adaptive Three-Panel

**Default Layout (Balanced Mode):**

```
+---------------------------------------------------------------+
| Header: Session "My Project" | Active | 5m ago | [User Menu] |
+---------------------------------------------------------------+
| [Sidebar] | Chat (30%)    | Editor (40%)   | Preview (30%)  |
| Sessions  |               |                |                 |
|           | AI: Hello!    | [File Tree]    | [Preview URL]  |
| • Active1 | User: Build   | main.py        | [Iframe]       |
| • Active2 | AI: Sure...   | [Monaco]       |                 |
| [+New]    | [Input...]    |                |                 |
+---------------------------------------------------------------+
| Footer: Container Running | Session ID: abc123 | Preview: ... |
+---------------------------------------------------------------+
```

### Panel Details

**Session Sidebar (Collapsible):**
- Width: 240px (collapsed: 0px)
- Position: Left edge
- Contains: Session list, "New Session" button
- Collapse toggle: Icon in header
- Persists: Collapsed state in localStorage

**Chat Panel:**
- Width: 30% (default), 20-50% (resizable)
- Position: Left (after sidebar)
- Contains: Message history, input field, streaming indicator
- Scroll: Auto-scroll to bottom on new message
- Overflow: Scroll independently

**Editor Panel:**
- Width: 40% (default), 30-60% (resizable)
- Position: Center
- Contains: File tree (collapsible), tab bar, Monaco editor
- Scroll: Editor content scrolls independently
- File tree: Collapsible to maximize editor space

**Preview Panel:**
- Width: 30% (default), 20-50% (resizable)
- Position: Right edge
- Contains: Preview URL bar, iframe, controls
- Scroll: Iframe scrolls independently
- Empty state: "No preview running" message

### Responsive Behavior (Desktop Only for This Slice)

- Minimum workspace width: 1280px
- Minimum workspace height: 720px
- Below minimum: Show "Please use larger screen" message
- Mobile/tablet: Deferred to PHASE-67A-7

---

## 12. Session Layout and Navigation

### Session List (In Sidebar)

**Display:**
- Session name (truncated if long)
- Status indicator (dot: green/yellow/red)
- Last activity (relative time: "5m ago")
- Current session highlighted

**Sorting:**
- Active sessions first (by last activity, most recent first)
- Terminated sessions last (by terminated_at, most recent first)

**Actions:**
- Click session → switch to session
- Hover → show tooltip with full name, created_at, status
- Right-click → context menu (rename, delete)

**Quota Indicator:**
- Show "X/5 active sessions" at top of list
- Disable "New Session" button if quota reached (5/5)
- Show tooltip explaining quota on hover

### Session Creation Flow

**Trigger:** Click "New Session" button

**Modal/Flow:**
1. Modal appears
2. Optional input: Session name (default: "Untitled Session")
3. Optional input: Session description
4. "Create" button (primary)
5. "Cancel" button (secondary)

**On Create:**
- Modal closes
- Workspace transitions to loading state
- Session appears in sidebar with "starting" status
- Chat shows "Starting session..." message

**On Error:**
- Modal stays open
- Error message appears below inputs
- User can retry or cancel

**Quota Exceeded:**
- "Create" button disabled if 5/5 active sessions
- Tooltip: "Maximum 5 concurrent sessions. Delete a session to create a new one."

### Session Deletion Flow

**Trigger:** Right-click session → "Delete" or delete button in header

**Confirmation Modal:**
1. Modal appears
2. Warning: "Delete session 'X'? This cannot be undone."
3. "Delete" button (danger style)
4. "Cancel" button

**On Delete:**
- Modal closes
- Session removed from sidebar
- If current session deleted → workspace switches to another session or empty state
- Chat shows "Session deleted" message

**On Error:**
- Modal stays open
- Error message appears
- User can retry or cancel

---

## 13. Main Workspace Information Architecture

### Information Layers

**Layer 1: Primary Task (Always Visible)**
- Chat conversation (current context)
- Editor current file (current code)
- Preview current page (current output)

**Layer 2: Session Context (Persistent)**
- Session name
- Session status
- Session age
- Last activity

**Layer 3: Navigation (On-Demand)**
- Session list (sidebar, collapsible)
- File tree (editor, collapsible)
- Preview controls (preview panel)

**Layer 4: Metadata (Footer)**
- Container status
- Session ID
- Preview URL
- Resource info (optional)

### Content Prioritization

**High Priority:**
- Latest chat message
- Current editor file
- Preview iframe

**Medium Priority:**
- Chat history (scrollable)
- File tree
- Session status badge

**Low Priority:**
- Footer metadata
- Session sidebar (collapsible)
- Advanced session info

---

## 14. Main Workspace States (Detailed)

### Empty State (No Session Selected)

**Visual:**
- Session sidebar visible (or empty)
- Main workspace area shows centered empty state
- Empty state contains:
  - Illustration or icon
  - Heading: "No Session Selected"
  - Body: "Create a new session to start building with AI"
  - Primary CTA: "Create New Session" button
  - Secondary text: "Or select an existing session from the sidebar"

**Behavior:**
- Chat panel: Hidden or shows empty state
- Editor panel: Hidden or shows empty state
- Preview panel: Hidden or shows empty state
- Session sidebar: Visible with session list (if any)

**Edge Cases:**
- User has 5/5 active sessions → CTA disabled, tooltip explains quota
- User has 0 sessions → sidebar shows "No sessions yet"

---

### Loading State (Session Starting)

**Visual:**
- Chat panel: Shows "Starting session..." message with spinner
- Editor panel: Shows loading spinner, no content
- Preview panel: Grayed out, shows "Preview unavailable during startup"
- Session status badge: "Starting" (yellow dot)
- Header: Session name visible (if provided)

**Behavior:**
- Chat input: Disabled
- Editor: Not interactive
- Preview: Not available
- Session sidebar: New session appears with "starting" status

**Progress Indication:**
- Spinner in chat panel
- "Initializing container..." message
- Estimated time: "Usually takes 10-15 seconds"

**Timeout Handling:**
- After 30s: Show warning "Taking longer than usual..."
- After 60s: Show error "Session failed to start" with retry option

---

### Active State (Session Ready)

**Visual:**
- Chat panel: Ready for input, shows conversation history
- Editor panel: Shows workspace files, Monaco editor ready
- Preview panel: Shows "No preview running" or active preview iframe
- Session status badge: "Active" (green dot)
- Header: Session name, age, last activity visible
- Footer: Container status "Running", session ID, preview URL (if active)

**Behavior:**
- Chat input: Enabled, focused by default
- Editor: Interactive, can view/edit files
- Preview: Shows iframe if preview running, else empty state
- Session sidebar: Current session highlighted
- All panels responsive to user interaction

**Interaction Readiness:**
- User can type in chat immediately
- User can click files in file tree
- User can resize panels
- User can collapse/expand panels

---

### Error State (Session Failed/Terminated)

**Visual:**
- Error banner at top of workspace (red background)
- Banner text: Termination reason
- Chat panel: Read-only, shows conversation history
- Editor panel: Read-only, grayed out
- Preview panel: Disabled, shows error message
- Session status badge: "Terminated" (red dot)

**Behavior:**
- Chat input: Disabled
- Editor: Read-only (can view, cannot edit)
- Preview: Not available
- Session sidebar: Session shown with "terminated" status
- All interactive actions disabled except:
  - View history (read-only)
  - Create new session
  - Switch to another session
  - Delete terminated session

**Error Banner Content:**
- Icon: Warning/error icon
- Message: Termination reason (user-friendly)
- Action: "Create New Session" button
- Dismiss: Close button (hides banner, but session still terminated)

**Termination Reason Messages:**
- `idle_timeout`: "This session was terminated due to inactivity. Create a new session to continue."
- `max_lifetime`: "This session reached its maximum lifetime. Create a new session to continue."
- `user_deleted`: "This session was deleted."
- `error`: "This session encountered an error and was terminated. Create a new session to continue."
- `quota_exceeded`: "Session terminated because quota was exceeded."

**Recovery Actions:**
- "Create New Session" → Opens session creation modal
- "View Sessions" → Focuses session sidebar
- "Dismiss" → Hides banner (session still read-only)

---

## 15. Preserved Invariants

### Architecture Invariants

- No background workers
- No WebSocket control plane (WebSocket for preview only)
- Request-driven enforcement
- Persistent terminal state (terminated sessions stay terminated)
- Deterministic error semantics (404, 410, 429, 502)

### Backend Invariants

- No new endpoints required
- No schema changes required
- No API contract changes
- All workspace functionality uses existing APIs

### Governance Invariants

- Workspace respects session lifecycle (CREATED → ACTIVE → TERMINATED)
- Workspace enforces read-only on terminated sessions
- Workspace respects quotas (max 5 concurrent sessions)
- Workspace respects rate limits (429 handling)

### UX Invariants

- No session resurrection (terminated = permanent)
- No background state mutation visible to user
- Deterministic state transitions (same input → same output)
- Clear error messages for all failure modes

---

## 16. Implementation Guidance (For Next Phase)

### Frontend Requirements

**Framework:** Next.js + React (per CLAUDE.md)

**Components Needed:**
- `WorkspaceLayout` (three-panel container)
- `ChatPanel` (message list + input)
- `EditorPanel` (Monaco + file tree)
- `PreviewPanel` (iframe + controls)
- `SessionSidebar` (session list + switcher)
- `SessionHeader` (context display)
- `SessionFooter` (metadata display)

**State Management:**
- Current session ID
- Session list
- Chat messages
- Editor files
- Preview URL
- Panel sizes (localStorage)
- Sidebar collapsed state (localStorage)

**API Integration:**
- Session CRUD (create, read, delete)
- Session status polling (GET /api/sessions/:id)
- Chat message submission (POST /api/ai/execute)
- File operations (read/write via existing endpoints)
- Preview health polling (GET /api/sessions/:id/preview/health)

**Monaco Editor:**
- Use existing Monaco Editor (per CLAUDE.md)
- Syntax highlighting
- Read-only mode for terminated sessions
- File tree integration

### Design Constraints

**No Custom Design System:**
- Use existing component library (if any)
- Use standard HTML/CSS
- No design system refactor

**No Visual Assets:**
- Use placeholder icons
- Use standard colors
- No custom illustrations (use text placeholders)

**No Copywriting:**
- Use functional placeholder text
- No marketing copy
- No help documentation beyond inline tooltips

### Performance Constraints

**Session Status Polling:**
- Poll GET /api/sessions/:id every 5 seconds while session starting
- Stop polling once session active
- Resume polling if user switches sessions

**Preview Health Polling:**
- Poll GET /api/sessions/:id/preview/health every 10 seconds if preview expected
- Stop polling if preview healthy
- Show error if preview fails

**Chat Message Streaming:**
- Use existing streaming mechanism (if any)
- Fall back to polling if no streaming

---

## 17. Recommended Next Slice

### PHASE-67A-2: History / Timeline UX

**Scope:**
- Chat history navigation
- Session timeline view
- Message search/filter
- Execution history
- File change history (high-level)

**Why Next:**
- Builds on workspace foundation
- Required for users to review past interactions
- Prerequisite for checkpoint/revert UX

**Out-of-Scope for 67A-2:**
- Checkpoint/revert/diff UX (67A-3)
- User dashboard (67A-4)
- Admin dashboard (67A-5)
- Public surfaces (67A-6)

---

## 18. Validation

### Design Completeness

- ✅ Main workspace layout defined
- ✅ Session navigation model defined
- ✅ Chat/editor/preview interaction model defined
- ✅ Core user journey defined
- ✅ Workspace states defined (empty, loading, active, error)
- ✅ Information architecture defined
- ✅ Alignment with PRD/ARCHITECTURE verified
- ✅ Backend constraints respected
- ✅ No new endpoints required
- ✅ No schema changes required

### Scope Discipline

- ✅ Stayed within main workspace only
- ✅ Did not expand into history/timeline
- ✅ Did not expand into checkpoint/revert
- ✅ Did not expand into dashboards
- ✅ Did not expand into public surfaces
- ✅ Did not invent new features
- ✅ Did not propose backend changes

### Launch-Readiness

- ✅ Defines minimum viable authenticated workspace
- ✅ Covers all critical user interactions
- ✅ Addresses all workspace states
- ✅ Provides implementation guidance
- ✅ Ready for frontend implementation (next phase)

---

## 19. References

- TASKS_BACKLOG_FULL.md → TASK-67A
- TASKS.md → TASK-67A
- PRD.md → Sections 3A, 3B, 3C, 3D, 3E
- ARCHITECTURE.md → Sections 4, 6, 10
- CLAUDE.md → Tech Stack, Workflow Rules

---

## 20. Rollback

Not applicable. Documentation only. No runtime changes.

---

## 21. Sign-Off

**Phase:** 67
**Stage:** 67A-1
**Status:** COMPLETE
**Checkpoint:** PHASE-67A-1-CHECKPOINT.md
**Next Slice:** PHASE-67A-2 (History / Timeline UX)

This checkpoint defines the core authenticated workspace UX/UI foundation. All subsequent UX slices depend on this design. Ready for frontend implementation (separate phase).
