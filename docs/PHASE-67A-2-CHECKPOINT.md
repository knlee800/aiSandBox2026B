# PHASE-67A-2-CHECKPOINT.md

## Metadata

**Phase:** 67
**Stage:** 67A-2
**Task ID:** TASK-67A (Slice 2)
**Title:** Core Product UX/UI Design — History / Control UX Only
**Status:** COMPLETE
**Date:** 2026-03-09
**Nature:** DOCUMENTATION / DESIGN (NO CODE)

---

## 1. Scope

### Objective

Produce the second narrowed design checkpoint for history and control UX, covering only session history, timeline, checkpoint, revert, diff, and git-log user experience. This slice defines how users navigate and control their project's version history within the authenticated workspace.

### Why This Slice Follows 67A-1

PHASE-67A-1 established the main authenticated workspace foundation (chat/editor/preview layout, session navigation, core states). History and control UX builds directly on this foundation by adding temporal navigation and version control capabilities to the existing workspace.

Users need to:
- Review past interactions and code changes
- Understand project evolution over time
- Revert to previous states when needed
- Inspect diffs and commit history
- Navigate checkpoints created by AI actions

This slice defines the UX layer for the existing git checkpoint system (already implemented in backend) without requiring new backend functionality.

### In-Scope Surfaces

1. **Session History UX**
   - Chat message history navigation
   - Execution history display
   - File change history (high-level)

2. **Timeline UX**
   - Checkpoint timeline visualization
   - Chronological navigation
   - Timeline filtering/search

3. **Checkpoint UX**
   - Checkpoint list display
   - Checkpoint metadata display
   - Checkpoint selection/navigation

4. **Revert UX**
   - Revert action trigger
   - Revert confirmation flow
   - Revert success/error states

5. **Diff UX**
   - File diff display
   - Checkpoint-to-checkpoint diff
   - Inline diff visualization

6. **Git-Log UX**
   - Commit history display
   - Commit metadata (hash, message, timestamp, files changed)
   - Commit navigation

7. **User Mental Model**
   - How users understand project state history
   - How checkpoints relate to chat messages
   - How revert affects current session

8. **History/Control States**
   - Empty state (no checkpoints)
   - Loading state (fetching history)
   - Active state (history available)
   - Error state (history unavailable)

### Out-of-Scope

- Main workspace UX (already covered in 67A-1)
- User dashboard UX (PHASE-67A-4)
- Admin dashboard UX (PHASE-67A-5)
- Landing page / pricing / docs (PHASE-67A-6)
- Responsive/polish beyond history/control surfaces (PHASE-67A-7)
- Any implementation
- Any code changes
- Any schema/API/backend/frontend changes
- Any new backend endpoints (use existing only)

---

## 2. Relevant User Types

### Primary User: Authenticated Developer (History Consumer)

**Context:**
- Has active session with code changes
- AI has made commits (auto-checkpoint after each action)
- User wants to review or revert changes

**Goals:**
- Review what AI changed and when
- Understand project evolution
- Revert to previous working state
- Compare versions
- Navigate commit history

**Constraints:**
- Can only access history for owned sessions
- Revert only available for active (non-terminated) sessions
- History read-only for terminated sessions

---

## 3. Session/History Mental Model

### User Mental Model: "Checkpoint = Snapshot"

**Core Concept:**
- Each AI action creates a git commit (checkpoint)
- Checkpoints are automatic and immutable
- User can view timeline of checkpoints
- User can revert to any checkpoint
- Revert creates new checkpoint (no history rewrite)

**Key Principles:**
- **Automatic:** User doesn't manually create checkpoints
- **Linked:** Each checkpoint linked to chat message that triggered it
- **Chronological:** Timeline shows checkpoints in order
- **Reversible:** Revert doesn't delete history, creates new commit
- **Inspectable:** User can see what changed in each checkpoint

### Relationship: Chat Message ↔ Checkpoint

**1:1 Relationship (Typical):**
- User sends chat message
- AI responds with code changes
- System creates git commit
- Checkpoint linked to message via `messageNumber`

**Timeline View:**
```
Message #1: "Create a Flask app"
  └─ Checkpoint abc123: Created app.py, requirements.txt (2 files)

Message #2: "Add a home route"
  └─ Checkpoint def456: Modified app.py (1 file)

Message #3: "Add error handling"
  └─ Checkpoint ghi789: Modified app.py (1 file)
```

**Edge Cases:**
- Initial checkpoint (no message): `messageNumber = null`
- Manual checkpoint (future): `messageNumber = null`
- Multiple commits per message (rare): Multiple checkpoints, same `messageNumber`

---

## 4. Timeline Model

### Timeline Structure

**Timeline = Ordered List of Checkpoints**

Each checkpoint contains:
- Commit hash (Git SHA)
- Timestamp (created_at)
- Description (human-readable summary)
- Files changed count
- Linked message number (if applicable)

**Ordering:**
- Reverse chronological (newest first)
- Grouped by date (optional)
- Filterable by date range

### Timeline Display Location

**Option A: Timeline Panel (Fourth Panel)**
- Add fourth panel to workspace layout
- Position: Left side, between sidebar and chat
- Width: 250px (collapsible)
- Contains: Checkpoint list, timeline controls

**Option B: Timeline Drawer (Overlay)**
- Drawer slides from right side
- Overlays preview panel
- Width: 400px
- Contains: Checkpoint list, timeline controls
- Dismissible

**Option C: Timeline Modal (Full-Screen)**
- Modal overlays entire workspace
- Full-screen timeline view
- Contains: Checkpoint list, diff viewer, controls
- Dismissible

**Recommended: Option B (Timeline Drawer)**
- Non-intrusive (doesn't change workspace layout)
- Contextual (appears when needed)
- Dismissible (doesn't block workspace)
- Sufficient space for checkpoint list + metadata

### Timeline Entry Format

**Compact Format (List View):**
```
[Checkpoint Icon] 5 minutes ago
"Created Flask app"
2 files changed • Message #1
[View Diff] [Revert]
```

**Expanded Format (Detail View):**
```
Checkpoint abc123def456...
Created: 2026-03-09 14:32:15
Linked to: Message #1 ("Create a Flask app")
Files Changed: 2
  + app.py
  + requirements.txt
Description: Created Flask app with basic structure
[View Full Diff] [Revert to This] [Copy Hash]
```

### Timeline Controls

**Top Bar:**
- "Close" button (dismiss drawer)
- "Refresh" button (reload timeline)
- Search input (filter by description/file)

**Timeline List:**
- Scrollable list of checkpoints
- Click checkpoint → expand detail view
- Hover → show quick actions

**Bottom Bar:**
- "Show Older" button (pagination)
- Checkpoint count indicator

---

## 5. Checkpoint Model

### Checkpoint Display

**Checkpoint Card (In Timeline):**
- Commit hash (truncated: first 7 chars)
- Relative timestamp ("5 minutes ago")
- Description
- Files changed count
- Linked message indicator (if applicable)
- Quick actions (View Diff, Revert)

**Checkpoint Detail View:**
- Full commit hash (copyable)
- Absolute timestamp
- Full description
- File list with change indicators (+, -, ~)
- Linked message preview (if applicable)
- Actions (View Full Diff, Revert, Copy Hash)

### Checkpoint Selection

**Single Selection:**
- Click checkpoint → select (highlight)
- Selected checkpoint shows detail view
- Only one checkpoint selected at a time

**Comparison Mode (Optional):**
- Shift+Click second checkpoint → compare mode
- Shows diff between two checkpoints
- Clear selection to exit compare mode

### Checkpoint Actions

**View Diff:**
- Opens diff viewer (inline or modal)
- Shows file-by-file changes
- Syntax-highlighted diff

**Revert:**
- Opens revert confirmation modal
- Reverts session to selected checkpoint
- Creates new checkpoint (doesn't delete history)

**Copy Hash:**
- Copies commit hash to clipboard
- Shows "Copied" tooltip

---

## 6. Revert Model

### Revert Flow

**Step 1: User Selects Checkpoint**
- User opens timeline drawer
- User clicks checkpoint
- Checkpoint detail view appears

**Step 2: User Initiates Revert**
- User clicks "Revert to This" button
- Revert confirmation modal appears

**Step 3: Confirmation Modal**
- Modal shows:
  - Warning: "Revert to checkpoint X?"
  - Explanation: "This will restore your project to this state. Current changes will be preserved in a new checkpoint."
  - Checkpoint summary (hash, timestamp, description)
  - "Revert" button (danger style)
  - "Cancel" button

**Step 4: Revert Execution**
- User clicks "Revert"
- Modal shows loading state
- System calls revert endpoint (backend)
- Backend creates new commit reverting to target
- New checkpoint created
- Workspace reloads (chat, editor, preview)

**Step 5: Revert Success**
- Modal closes
- Timeline drawer shows new checkpoint at top
- Chat shows system message: "Reverted to checkpoint X"
- Editor shows reverted files
- Preview reloads (if running)

**Step 6: Revert Error (If Fails)**
- Modal shows error message
- User can retry or cancel
- No state change if error

### Revert Constraints

**When Revert Available:**
- Session is active (not terminated)
- Checkpoint exists
- User owns session

**When Revert Unavailable:**
- Session terminated → Show "Cannot revert terminated session"
- No checkpoints → Revert button hidden
- User doesn't own session → 404

**Revert Behavior:**
- Creates new commit (git revert or git reset + commit)
- Preserves history (no force push, no history rewrite)
- New checkpoint appears at top of timeline
- Description: "Reverted to checkpoint X"

---

## 7. Diff Model

### Diff Viewer Location

**Option A: Inline Diff (In Editor Panel)**
- Replace editor content with diff view
- Temporary mode (exit to return to normal editor)
- Uses Monaco diff editor

**Option B: Diff Modal (Overlay)**
- Modal overlays workspace
- Full-screen or large modal
- Contains file list + diff viewer
- Dismissible

**Option C: Diff Drawer (Side Panel)**
- Drawer slides from right (replaces preview temporarily)
- Width: 50% of workspace
- Contains file list + diff viewer
- Dismissible

**Recommended: Option A (Inline Diff in Editor)**
- Uses existing Monaco diff editor
- No new layout components
- Familiar to developers
- Easy to exit (close diff tab)

### Diff Display Format

**File List (Left Sidebar in Diff View):**
```
Files Changed (3)
  + app.py (added)
  ~ main.py (modified)
  - old.py (deleted)
```

**Diff Content (Main Area):**
- Side-by-side diff (Monaco default)
- Line numbers
- Syntax highlighting
- Added lines (green background)
- Removed lines (red background)
- Modified lines (yellow background)

**Diff Controls:**
- "Previous File" / "Next File" buttons
- "Close Diff" button (return to editor)
- "Copy Diff" button (copy to clipboard)

### Diff Trigger Points

**From Timeline:**
- Click "View Diff" on checkpoint → shows diff for that checkpoint (vs parent)
- Select two checkpoints → shows diff between them

**From Chat:**
- AI makes changes → inline "View Changes" button appears
- Click → shows diff for latest checkpoint

**From Editor:**
- File modified by AI → editor shows diff indicator
- Click indicator → shows diff for that file

---

## 8. Git-Log Model

### Git-Log Display

**Location:** Timeline drawer (same as checkpoint timeline)

**Format:** Checkpoint list (as defined in Timeline Model)

**Content:**
- Commit hash (truncated)
- Commit message (description)
- Timestamp
- Files changed count
- Author (always "AI Assistant" for auto-commits)

**Ordering:**
- Reverse chronological (newest first)
- Paginated (20 per page)

### Git-Log vs Timeline

**Timeline (Primary):**
- User-facing view
- Emphasizes checkpoints linked to chat messages
- Shows relative timestamps
- Optimized for navigation and revert

**Git-Log (Technical):**
- Developer-facing view
- Shows all commits (including manual, if any)
- Shows absolute timestamps
- Shows commit hashes prominently
- Optimized for inspection and debugging

**UI Toggle:**
- Timeline drawer has toggle: "Timeline View" / "Git Log View"
- Same data, different presentation
- Default: Timeline View

---

## 9. Permissions/Guardrail Expectations (UX Level Only)

### Read Permissions

**Who Can View History:**
- Session owner (authenticated user)
- Admin (future, out of scope for this slice)

**What Can Be Viewed:**
- All checkpoints for owned sessions
- All diffs for owned sessions
- All commit metadata for owned sessions

**When History Available:**
- Active sessions: Full access
- Terminated sessions: Read-only access (no revert)

### Write Permissions (Revert)

**Who Can Revert:**
- Session owner (authenticated user)
- Only for active (non-terminated) sessions

**When Revert Unavailable:**
- Session terminated → Revert button disabled, tooltip explains
- Session not owned → 404 (history not visible)
- No checkpoints → Revert button hidden

**Revert Guardrails:**
- Confirmation modal required (no accidental revert)
- Warning message explains revert behavior
- Cannot revert terminated sessions (enforced by backend)

### UX-Level Guardrails

**Timeline Access:**
- Timeline drawer only accessible when session selected
- Empty state if no checkpoints
- Error state if history fetch fails

**Diff Access:**
- Diff only available for existing checkpoints
- Cannot diff non-existent commits
- Error message if diff fails to load

**Revert Safety:**
- Revert requires explicit confirmation
- Revert shows preview of target state (checkpoint summary)
- Revert cannot be undone (but creates new checkpoint, so can revert again)

---

## 10. Empty/Loading/Error/Success States for History/Control Surfaces

### Timeline Drawer States

#### Empty State (No Checkpoints)

**Trigger:** Session has no git checkpoints

**Display:**
- Timeline drawer shows centered empty state
- Icon: Clock or history icon
- Heading: "No Checkpoints Yet"
- Body: "Checkpoints are created automatically as you build with AI"
- No action buttons (checkpoints are automatic)

**Behavior:**
- Timeline drawer can still be opened
- No timeline list shown
- No revert action available

---

#### Loading State (Fetching Timeline)

**Trigger:** Timeline drawer opened, fetching checkpoints from API

**Display:**
- Timeline drawer shows loading spinner
- Message: "Loading checkpoint history..."
- Timeline list area shows skeleton/placeholder items

**Behavior:**
- Timeline drawer remains open
- Controls disabled until loaded
- Timeout after 10 seconds → show error

---

#### Active State (Timeline Available)

**Trigger:** Checkpoints fetched successfully

**Display:**
- Timeline drawer shows checkpoint list
- Each checkpoint shows metadata (hash, timestamp, description, files changed)
- Controls enabled (search, filter, pagination)
- Selected checkpoint shows detail view

**Behavior:**
- User can scroll timeline
- User can click checkpoints
- User can view diffs
- User can revert (if session active)
- User can search/filter

---

#### Error State (Timeline Fetch Failed)

**Trigger:** API error fetching checkpoints

**Display:**
- Timeline drawer shows error message
- Icon: Error icon
- Heading: "Failed to Load History"
- Body: Error reason (e.g., "Network error", "Session not found")
- Action: "Retry" button

**Behavior:**
- Timeline list not shown
- User can retry
- User can close drawer
- No revert available

---

### Diff Viewer States

#### Empty State (No Changes)

**Trigger:** Checkpoint has no file changes (rare, but possible for initial commit)

**Display:**
- Diff viewer shows empty state
- Message: "No changes in this checkpoint"
- Action: "Close" button

---

#### Loading State (Fetching Diff)

**Trigger:** User clicks "View Diff", fetching diff from API

**Display:**
- Diff viewer shows loading spinner
- Message: "Loading diff..."
- Placeholder diff content

**Behavior:**
- Diff viewer remains open
- Controls disabled until loaded
- Timeout after 10 seconds → show error

---

#### Active State (Diff Available)

**Trigger:** Diff fetched successfully

**Display:**
- Diff viewer shows file list + diff content
- Monaco diff editor (side-by-side)
- Syntax highlighting
- Line numbers
- Change indicators

**Behavior:**
- User can navigate files
- User can scroll diff
- User can close diff viewer
- User can copy diff

---

#### Error State (Diff Fetch Failed)

**Trigger:** API error fetching diff

**Display:**
- Diff viewer shows error message
- Heading: "Failed to Load Diff"
- Body: Error reason
- Action: "Retry" button or "Close" button

**Behavior:**
- Diff content not shown
- User can retry or close
- Timeline drawer remains accessible

---

### Revert States

#### Revert Confirmation (Pre-Execution)

**Trigger:** User clicks "Revert to This" on checkpoint

**Display:**
- Modal appears
- Warning icon
- Heading: "Revert to Checkpoint?"
- Body: Checkpoint summary (hash, timestamp, description)
- Explanation: "This will restore your project to this state. Your current changes will be saved in a new checkpoint before reverting."
- "Revert" button (danger style)
- "Cancel" button

**Behavior:**
- User can confirm or cancel
- No state change until confirmed

---

#### Revert In-Progress (Executing)

**Trigger:** User confirms revert, API call in progress

**Display:**
- Modal shows loading spinner
- Message: "Reverting to checkpoint..."
- Progress indicator (if available)

**Behavior:**
- Modal remains open
- Buttons disabled
- Timeout after 30 seconds → show error

---

#### Revert Success

**Trigger:** Revert API call succeeds

**Display:**
- Modal closes
- Timeline drawer updates (new checkpoint at top)
- Chat shows system message: "Reverted to checkpoint X"
- Editor reloads with reverted files
- Preview reloads (if running)
- Success toast: "Reverted successfully"

**Behavior:**
- Workspace reflects reverted state
- Timeline shows new revert checkpoint
- User can continue working

---

#### Revert Error

**Trigger:** Revert API call fails

**Display:**
- Modal shows error message
- Heading: "Revert Failed"
- Body: Error reason (e.g., "Session terminated", "Network error")
- Action: "Retry" button or "Close" button

**Behavior:**
- No state change
- User can retry or cancel
- Workspace unchanged

---

## 11. Launch-Readiness Criteria for This Slice

### Required for Launch

1. **Timeline Accessible**
   - User can open timeline drawer from workspace
   - Timeline shows checkpoint list
   - Timeline loads from existing API

2. **Checkpoint Inspection**
   - User can view checkpoint metadata
   - User can see files changed
   - User can see linked message

3. **Diff Viewing**
   - User can view diff for any checkpoint
   - Diff shows file changes
   - Diff is syntax-highlighted

4. **Revert Functional**
   - User can revert to any checkpoint (if session active)
   - Revert requires confirmation
   - Revert creates new checkpoint
   - Workspace reloads after revert

5. **History States Handled**
   - Empty state (no checkpoints)
   - Loading state (fetching timeline)
   - Error state (fetch failed)
   - Active state (timeline available)

### Acceptance Criteria

- User can open timeline and see checkpoints
- User can view diff for any checkpoint
- User can revert to any checkpoint (active session only)
- User sees correct empty/loading/error states
- Timeline links to chat messages correctly
- Revert confirmation prevents accidental reverts
- Terminated sessions show read-only history

### Deferred to Later Slices

- User dashboard (67A-4)
- Admin dashboard (67A-5)
- Public-facing surfaces (67A-6)
- Responsive/mobile polish (67A-7)

---

## 12. Alignment with PRD / ARCHITECTURE / Backend Constraints

### PRD Alignment

**PRD Section 1: Overview**
- "Git auto-commit and checkpoint system" → Timeline displays auto-commits

**PRD Section 2: Key Goals**
- "Consistent git commits after every action" → Timeline shows all commits
- "Easy import/export of projects" → History enables project state inspection

**PRD Section 3A: Session Management**
- "Terminated sessions are irreversible" → Revert unavailable for terminated sessions

### ARCHITECTURE Alignment

**ARCHITECTURE Section 4: Session Lifecycle**
- Timeline respects session states (CREATED → ACTIVE → TERMINATED)
- Revert only available for ACTIVE sessions
- History read-only for TERMINATED sessions

**ARCHITECTURE Section 7: Data Model**
- Timeline uses `git_checkpoints` table
- Checkpoint fields: id, session_id, commit_hash, message_number, description, files_changed, created_at

**ARCHITECTURE Section 8: API Design**
- Timeline uses existing internal endpoints (no new public APIs)

### Backend Constraints

**Existing Data Model (git_checkpoints table):**
- `id` (UUID)
- `session_id` (UUID, foreign key)
- `commit_hash` (VARCHAR 40, Git SHA)
- `message_number` (INTEGER, nullable)
- `description` (VARCHAR 500, nullable)
- `files_changed` (INTEGER)
- `created_at` (TIMESTAMP)

**Existing Backend Capabilities:**
- Git auto-commit after each AI action (already implemented)
- Checkpoint recording via `POST /api/internal/git-checkpoints` (internal only)
- Checkpoint storage in PostgreSQL (already implemented)

**Required New Endpoints (Public, for Frontend):**
- `GET /api/sessions/:id/checkpoints` → List checkpoints for session
- `GET /api/sessions/:id/checkpoints/:hash/diff` → Get diff for checkpoint
- `POST /api/sessions/:id/revert` → Revert session to checkpoint (body: `{ commitHash }`)

**Endpoint Constraints:**
- Must require JWT authentication
- Must enforce session ownership
- Must respect session termination (410 Gone for terminated sessions)
- Must return 404 for non-existent checkpoints
- Must return 403 for quota/permission errors

**Note:** These endpoints do NOT exist yet. This design assumes they will be implemented in a future backend task. For now, this is UX design only.

---

## 13. Timeline UX Details

### Timeline Drawer Layout

**Structure:**
```
+----------------------------------+
| Timeline                    [X] |
| [Search: filter by...]          |
+----------------------------------+
| [Timeline View] [Git Log View]  |
+----------------------------------+
| • 5 min ago                     |
| "Created Flask app"             |
| 2 files • Message #1            |
| [View Diff] [Revert]            |
+----------------------------------+
| • 15 min ago                    |
| "Added home route"              |
| 1 file • Message #2             |
| [View Diff] [Revert]            |
+----------------------------------+
| • 30 min ago                    |
| "Initial commit"                |
| 0 files • (no message)          |
| [View Diff]                     |
+----------------------------------+
| Showing 3 checkpoints           |
| [Load More]                     |
+----------------------------------+
```

### Timeline Drawer Behavior

**Open Trigger:**
- Button in workspace header: "History" icon
- Keyboard shortcut: Ctrl+H
- Chat command: "/history" (optional)

**Close Trigger:**
- Click "X" button in drawer header
- Click outside drawer (overlay)
- Keyboard shortcut: Esc

**Persistence:**
- Drawer state (open/closed) persists per session (localStorage)
- Selected checkpoint persists (until drawer closed)

### Timeline Entry Interaction

**Hover:**
- Checkpoint card highlights
- Quick actions appear (View Diff, Revert)
- Tooltip shows full commit hash

**Click:**
- Checkpoint expands to detail view
- Detail view shows full metadata
- File list appears
- Actions appear (View Full Diff, Revert, Copy Hash)

**Double-Click:**
- Opens diff viewer immediately
- Skips detail view

---

## 14. Diff UX Details

### Diff Viewer Trigger

**From Timeline:**
- Click "View Diff" on checkpoint → opens diff viewer
- Select two checkpoints → click "Compare" → opens diff viewer

**From Chat:**
- AI makes changes → "View Changes" button appears in message
- Click → opens diff viewer for latest checkpoint

**From Editor:**
- File modified by AI → diff indicator in gutter
- Click indicator → opens diff viewer for that file only

### Diff Viewer Layout (Inline in Editor)

**Structure:**
```
+----------------------------------+
| [Diff] app.py          [Close] |
+----------------------------------+
| Before (abc123) | After (def456)|
|                 |                |
| def hello():    | def hello():   |
|   return "Hi"   |   return "Hi!" |
|                 | + print("log") |
+----------------------------------+
```

**Monaco Diff Editor:**
- Side-by-side view (default)
- Inline view (toggle option)
- Line-level diff
- Syntax highlighting
- Scroll sync between panes

### Diff Viewer Controls

**Top Bar:**
- File name breadcrumb
- "Previous File" / "Next File" buttons (if multiple files)
- View toggle: "Side-by-Side" / "Inline"
- "Close" button

**Bottom Bar:**
- File count: "File 1 of 3"
- Change summary: "+15 -3 lines"

### Diff Viewer Behavior

**Navigation:**
- Arrow keys: Navigate between changes
- Ctrl+Up/Down: Previous/next file
- Esc: Close diff viewer

**Copy:**
- Select text → copy (standard behavior)
- "Copy Diff" button → copies entire diff to clipboard

**Exit:**
- Click "Close" → return to normal editor
- Diff viewer closes, editor shows current file

---

## 15. Git-Log UX Details

### Git-Log View (In Timeline Drawer)

**Toggle:** Timeline drawer has toggle at top: [Timeline View] [Git Log View]

**Git Log View Format:**
```
+----------------------------------+
| Git Log                     [X] |
| [Search: filter by...]          |
+----------------------------------+
| commit abc123def456...          |
| Author: AI Assistant            |
| Date: 2026-03-09 14:32:15       |
|                                 |
| Created Flask app               |
|                                 |
| Files: 2 changed                |
| [View Diff] [Revert]            |
+----------------------------------+
| commit def456ghi789...          |
| Author: AI Assistant            |
| Date: 2026-03-09 14:45:22       |
|                                 |
| Added home route                |
|                                 |
| Files: 1 changed                |
| [View Diff] [Revert]            |
+----------------------------------+
```

**Differences from Timeline View:**
- Shows full commit hash (expandable)
- Shows absolute timestamps (not relative)
- Shows "Author" field (always "AI Assistant")
- More technical presentation
- Same data, different format

### Git-Log Entry Interaction

**Hover:**
- Commit entry highlights
- Quick actions appear

**Click:**
- Commit expands to show full details
- Shows commit message (description)
- Shows file list
- Shows linked message (if applicable)

**Copy Hash:**
- Click commit hash → copies to clipboard
- Tooltip: "Copied"

---

## 16. User Mental Model for History/Control

### Mental Model: "Timeline = Project Evolution"

**User Understanding:**
1. Every AI action creates a checkpoint
2. Checkpoints are snapshots in time
3. Timeline shows all checkpoints chronologically
4. User can inspect any checkpoint
5. User can revert to any checkpoint (if session active)
6. Revert doesn't delete history, creates new checkpoint

**Key UX Principles:**
- **Automatic:** Checkpoints happen automatically (no user action required)
- **Linked:** Checkpoints linked to chat messages (user can trace cause)
- **Inspectable:** User can see what changed in each checkpoint
- **Reversible:** User can revert to any checkpoint
- **Non-Destructive:** Revert preserves history (creates new checkpoint)

### Mental Model: "Revert = Time Travel"

**User Understanding:**
1. Revert restores project to selected checkpoint
2. Current state saved before revert (new checkpoint)
3. Revert creates new commit (doesn't delete history)
4. User can revert again if needed
5. Revert only available for active sessions

**Key UX Principles:**
- **Safe:** Revert requires confirmation
- **Preserving:** Current state saved before revert
- **Reversible:** Can revert the revert
- **Transparent:** User sees what will happen before confirming

### Mental Model: "Diff = What Changed"

**User Understanding:**
1. Diff shows file changes between two states
2. Green = added, red = removed, yellow = modified
3. Diff available for any checkpoint
4. Diff can compare any two checkpoints

**Key UX Principles:**
- **Visual:** Color-coded changes
- **Contextual:** Shows surrounding code
- **Navigable:** Can jump between files
- **Copyable:** Can copy diff text

---

## 17. Timeline Integration with Main Workspace (67A-1)

### Timeline Drawer Placement

**Position:** Right side of workspace (overlays preview panel)

**Trigger:** "History" button in workspace header (next to session name)

**Layout Impact:**
- Timeline drawer slides in from right
- Preview panel dims/blurs (overlay effect)
- Chat and editor remain visible
- Drawer width: 400px (fixed, not resizable)

**Dismissal:**
- Click "X" in drawer header
- Click outside drawer (on dimmed preview panel)
- Press Esc key
- Drawer slides out, preview panel returns to normal

### Timeline + Chat Integration

**Linked Messages:**
- Timeline checkpoint shows "Message #X" link
- Click link → chat scrolls to that message
- Message highlights temporarily
- Timeline drawer remains open

**Recent Changes Indicator:**
- Chat message shows "Checkpoint created" badge after AI response
- Badge clickable → opens timeline drawer, scrolls to that checkpoint

### Timeline + Editor Integration

**File Navigation from Timeline:**
- Timeline checkpoint shows file list
- Click file → editor opens that file
- Editor scrolls to first change (if diff available)
- Timeline drawer remains open

**Diff Viewer Replaces Editor:**
- Click "View Diff" → editor switches to diff mode
- Diff viewer shows in editor panel
- Timeline drawer remains open (side-by-side)
- Close diff → editor returns to normal mode

### Timeline + Preview Integration

**No Direct Integration:**
- Timeline drawer overlays preview panel
- Preview not visible while timeline open
- Preview continues running (not paused)
- Close timeline → preview visible again

---

## 18. Permissions/Guardrail Implementation Expectations

### Frontend Guardrails

**Timeline Access:**
- Timeline button disabled if no session selected
- Timeline button disabled if session terminated (but shows read-only history)
- Timeline drawer shows "Read-only" badge for terminated sessions

**Revert Button:**
- Revert button disabled if session terminated
- Revert button disabled if checkpoint is current state
- Revert button shows tooltip explaining why disabled

**Diff Viewer:**
- Diff viewer available for all checkpoints (read-only)
- Diff viewer works for terminated sessions (inspection only)

### Backend Guardrails (Expected)

**Timeline Endpoint:**
- `GET /api/sessions/:id/checkpoints`
- Requires JWT
- Enforces session ownership (404 if not owned)
- Returns 410 Gone if session terminated (but still returns checkpoints)

**Diff Endpoint:**
- `GET /api/sessions/:id/checkpoints/:hash/diff`
- Requires JWT
- Enforces session ownership
- Returns 404 if checkpoint not found
- Returns diff even for terminated sessions (read-only)

**Revert Endpoint:**
- `POST /api/sessions/:id/revert`
- Requires JWT
- Enforces session ownership
- Returns 410 Gone if session terminated
- Returns 404 if target checkpoint not found
- Creates new checkpoint after revert

---

## 19. Preserved Invariants

### Architecture Invariants

- No background workers
- Request-driven enforcement
- Persistent terminal state (terminated sessions stay terminated)
- Deterministic error semantics (404, 410, 429, 502)
- No WebSocket control plane

### Backend Invariants

- Git checkpoints already exist in database
- Auto-commit already implemented
- No schema changes required
- New public endpoints required (GET checkpoints, GET diff, POST revert)
- Internal checkpoint recording unchanged

### Governance Invariants

- Revert only available for active sessions
- Revert respects session termination (410 Gone)
- History read-only for terminated sessions
- Checkpoint creation automatic (no manual checkpoints in this slice)

### UX Invariants

- Timeline non-intrusive (drawer, not permanent panel)
- Revert requires confirmation (no accidental reverts)
- Revert preserves history (creates new checkpoint)
- Diff viewer uses Monaco (consistent with editor)
- History available for all sessions (active and terminated)

---

## 20. Implementation Guidance (For Next Phase)

### Frontend Requirements

**New Components:**
- `TimelineDrawer` (checkpoint list + controls)
- `CheckpointCard` (timeline entry)
- `CheckpointDetailView` (expanded checkpoint)
- `DiffViewer` (Monaco diff editor wrapper)
- `RevertConfirmationModal` (revert confirmation)

**State Management:**
- Timeline drawer open/closed state
- Checkpoint list (fetched from API)
- Selected checkpoint (for detail view)
- Diff data (fetched from API)
- Revert in-progress state

**API Integration (New Endpoints Required):**
- `GET /api/sessions/:id/checkpoints` → Fetch checkpoint list
- `GET /api/sessions/:id/checkpoints/:hash/diff` → Fetch diff for checkpoint
- `POST /api/sessions/:id/revert` → Revert session to checkpoint

**Monaco Diff Editor:**
- Use Monaco's built-in diff editor
- Side-by-side view (default)
- Inline view (optional toggle)
- Syntax highlighting
- Line numbers
- Read-only (no editing in diff view)

### Backend Requirements (New Endpoints)

**Note:** These endpoints do NOT exist yet. Backend implementation required before frontend can be built.

**1. GET /api/sessions/:id/checkpoints**
- Returns: Array of checkpoints for session
- Sorted: Reverse chronological (newest first)
- Pagination: Optional (limit, offset)
- Auth: JWT required, session ownership enforced
- Response:
  ```json
  [
    {
      "id": "uuid",
      "commitHash": "abc123...",
      "messageNumber": 1,
      "description": "Created Flask app",
      "filesChanged": 2,
      "createdAt": "2026-03-09T14:32:15Z"
    }
  ]
  ```

**2. GET /api/sessions/:id/checkpoints/:hash/diff**
- Returns: Diff for checkpoint (vs parent commit)
- Format: Unified diff or structured JSON
- Auth: JWT required, session ownership enforced
- Response:
  ```json
  {
    "commitHash": "abc123...",
    "parentHash": "parent123...",
    "files": [
      {
        "path": "app.py",
        "status": "added",
        "diff": "diff content..."
      }
    ]
  }
  ```

**3. POST /api/sessions/:id/revert**
- Body: `{ "commitHash": "abc123..." }`
- Returns: New checkpoint created by revert
- Behavior: Git revert or reset + commit
- Auth: JWT required, session ownership enforced
- Response:
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

### Design Constraints

**No Custom Design System:**
- Use existing component library
- Use standard HTML/CSS
- No design system refactor

**No Visual Assets:**
- Use placeholder icons (clock, history, revert)
- Use standard colors
- No custom illustrations

**No Copywriting:**
- Use functional placeholder text
- No marketing copy
- No extensive help documentation

---

## 21. Recommended Next Slice

### PHASE-67A-3: User Dashboard UX

**Scope:**
- User account overview
- Session list (all sessions, not just active)
- Usage statistics
- Quota visibility
- Account settings

**Why Next:**
- Builds on workspace (67A-1) and history (67A-2) foundations
- Required for users to manage sessions outside workspace
- Required for users to see quota/usage
- Prerequisite for admin dashboard (67A-5)

**Out-of-Scope for 67A-3:**
- Admin dashboard (67A-5)
- Public surfaces (67A-6)
- Responsive/mobile polish (67A-7)

---

## 22. Validation

### Design Completeness

- ✅ Timeline UX defined (drawer, checkpoint list, navigation)
- ✅ Checkpoint UX defined (display, selection, metadata)
- ✅ Revert UX defined (confirmation, execution, success/error)
- ✅ Diff UX defined (viewer, navigation, display)
- ✅ Git-log UX defined (technical view, toggle)
- ✅ User mental model defined (checkpoint = snapshot, revert = time travel)
- ✅ History/control states defined (empty, loading, active, error)
- ✅ Integration with main workspace defined (drawer placement, interactions)
- ✅ Alignment with PRD/ARCHITECTURE verified
- ✅ Backend constraints identified (new endpoints required)

### Scope Discipline

- ✅ Stayed within history/control UX only
- ✅ Did not expand into user dashboard
- ✅ Did not expand into admin dashboard
- ✅ Did not expand into public surfaces
- ✅ Did not invent new features beyond history/control
- ✅ Identified required backend endpoints (but did not implement)

### Launch-Readiness

- ✅ Defines minimum viable history/control UX
- ✅ Covers all critical history interactions
- ✅ Addresses all history/control states
- ✅ Provides implementation guidance
- ✅ Identifies backend dependencies
- ⚠️ Requires new backend endpoints (GET checkpoints, GET diff, POST revert)

---

## 23. Backend Dependency Summary

### Existing (Already Implemented)

- ✅ Git auto-commit after each AI action
- ✅ Checkpoint recording in database (git_checkpoints table)
- ✅ Internal checkpoint endpoint (POST /api/internal/git-checkpoints)

### Required (Not Yet Implemented)

- ❌ Public checkpoint list endpoint (GET /api/sessions/:id/checkpoints)
- ❌ Public diff endpoint (GET /api/sessions/:id/checkpoints/:hash/diff)
- ❌ Public revert endpoint (POST /api/sessions/:id/revert)

**Note:** Backend implementation of these endpoints is a prerequisite for frontend implementation of this UX slice. Backend task should be created separately.

---

## 24. References

- TASKS_BACKLOG_FULL.md → TASK-67A
- TASKS.md → TASK-67A
- PRD.md → Sections 1, 2, 3A
- ARCHITECTURE.md → Sections 4, 7, 8
- CLAUDE.md → Git auto-commit and checkpoint system
- docs/PHASE-67A-1-CHECKPOINT.md → Main workspace foundation
- docs/TASK-4.2-INTEGRATION.md → Git checkpoint integration
- services/api-gateway/src/entities/git-checkpoint.entity.ts → Checkpoint data model

---

## 25. Rollback

Not applicable. Documentation only. No runtime changes.

---

## 26. Sign-Off

**Phase:** 67
**Stage:** 67A-2
**Status:** COMPLETE
**Checkpoint:** PHASE-67A-2-CHECKPOINT.md
**Next Slice:** PHASE-67A-3 (User Dashboard UX)

This checkpoint defines the history and control UX layer for the authenticated workspace. Builds on PHASE-67A-1 foundation. Requires backend endpoints (GET checkpoints, GET diff, POST revert) before frontend implementation. Ready for backend task creation and subsequent frontend implementation.
