# PROJ-03-01 — Project-First UX, Auto Session Flow, Git-Backed Autosave, and Internal Recovery UI

## Task Metadata

- Task ID: PROJ-03-01
- Title: Design Project First UX Auto Session Flow Git Backed Autosave And Internal Recovery UI
- Nature: PRODUCT / UX / ARCHITECTURE DESIGN
- Status: PLANNED (design deliverable)
- Output: this document only. No code. No task registration.

This document is opinionated and prescriptive. It is meant to be the basis for slicing future implementation tasks. It does not authorize implementation by itself.

---

## 0. Design constraints reaffirmed

- The product already has working pieces: persisted snapshot store (PROJ-01-21), correct project open hydration (PROJ-02-01), restore that no longer crashes on git internals (PROJ-02-03), preview that works for static HTML (PREV-01 family / PREV-02 family), session stop/cleanup (OPS-01-04), and a reasonably polished baseline UX (UX-01 family).
- The product is technically usable end-to-end. The remaining problem is conceptual: the user model leaks runtime mechanics (sessions, snapshots, container lifecycles) into the surface that an end-user sees.
- This design must be implementable as an evolution of the current system, not a rewrite. It must preserve existing backend contracts unless an explicit follow-up task is registered for change.
- Internal endpoints (`POST /api/internal/...`) remain internal-only per `CLAUDE.md`. No public surface change is proposed for them.

---

## 1. Product model

### 1.1 Primary user-facing concepts (after redesign)

For a normal end user, only these concepts exist in the product surface:

1. **Project** — the only first-class user object. A project is a named, persistent unit of work. It owns its files, its git history, its visibility (private/public), and any number of background runtime sessions over its lifetime.
2. **Workspace** — the place a user goes to *do work* on a project (editor + chat + preview + history + share). A workspace is what the user sees; sessions are how the platform implements it.
3. **History** — a single user-facing timeline of named, restorable points in a project, surfaced in the workspace.
4. **Public Gallery** — read-only browsing surface of public projects, with the ability to fork/import.
5. **Account / Settings** — login, plan, API keys, language, basic preferences.

That is the entire user-visible vocabulary.

### 1.2 Hidden runtime concepts (background machinery)

Sessions, snapshots, containers, preview proxies, image tags, quotas, kill switches, and similar are runtime machinery. They are **not** part of the primary product vocabulary. They are referenced only in:

- the internal recovery / operator UI (Section 6),
- an opt-in "Advanced" sub-section inside a project workspace for power users (Section 3.3),
- system messages when a runtime failure must be communicated (always with a recovery action attached, never as raw mechanics).

### 1.3 Why projects are the right primary concept

- Users open the product wanting to *work on a thing they made*, not to "spin up a session". Projects match that mental model.
- Projects already exist in the backend (`projects` table, `/api/projects/...` endpoints, project-scoped snapshots).
- Projects are what we want to share/list publicly. Sessions are not user-meaningful.
- Projects are what survive Docker restarts conceptually; sessions are explicitly not stable across restart, container loss, or expiry.
- The current "create a session, then maybe attach a project, then maybe save a snapshot" flow exposes too many failure modes (session expiry, project not associated, snapshot stale). A project-first model makes those failure modes the platform's problem, not the user's.

### 1.4 Mapping to backend (no schema change required for this design)

| User concept    | Backend reality                                                              |
|-----------------|------------------------------------------------------------------------------|
| Project         | `projects` row + project-scoped snapshots + project-scoped git history       |
| Workspace       | One bound `sessions` row, one container, plus the existing chat/preview UI  |
| History         | Git checkpoints (auto + manual) + named "named saves"                        |
| Public Gallery  | Existing `/api/projects/public` surface                                      |

All of this can be built on the current backend with additive thin wrappers.

---

## 2. Core user flows

All flows below are described from the **normal user's** perspective. Internal mechanics for each are listed under "Behind the scenes". Numbered steps describe what the user does or sees, not what the platform does internally.

### 2.1 New Project

User experience:
1. User clicks **New Project** on the Projects page.
2. Optional small dialog: project name (default auto-generated, e.g., "Untitled project"), optional description, visibility default = Private.
3. User is dropped into the **Workspace** with an empty editor and a fresh chat. They can immediately type or chat.
4. Autosave starts in the background. The workspace shows "All changes saved" once initial state has been persisted.

Behind the scenes:
- Backend creates a `projects` row.
- Platform automatically creates a fresh `sessions` row, attached to the project, started, and bound to the user. The user is never asked.
- Workspace UI binds to that session implicitly.
- The first git checkpoint is created at workspace boot so an empty restore is always possible.

User never sees the words "session", "container", or "snapshot".

### 2.2 Open Existing Project

User experience:
1. User clicks a project on the Projects page.
2. UI shows a brief "Opening project…" state with no choices to make.
3. The Workspace appears with the project's restored files, last-used file open in the editor, and chat history visible.

Behind the scenes:
- Platform always creates a **fresh** session and restores the project into it deterministically. We do **not** try to re-attach to a previous session, even if one exists; previous sessions are treated as ephemeral runtime and not part of the user model.
- Restore source: the latest project-scoped snapshot, falling back to project files if no snapshot exists yet (unchanged from current open semantics).
- The project's prior session, if still alive, is allowed to expire on its normal timeout. There is no user-visible cleanup step.
- The PROJ-02-01 deterministic hydration sequence is the contract here; this design keeps it.

Why "always fresh session": deterministic, no hidden carryover state, simpler error recovery, simpler quota accounting, matches user intuition ("I just opened my project, it should look exactly like what I saved").

### 2.3 Resume Latest Work

User experience:
1. From the home page or an explicit "Resume latest" affordance, user lands directly in the workspace of the most recently edited project.
2. Equivalent to "Open Existing Project" on the most-recently-touched project.

Behind the scenes:
- Sort projects by `updatedAt` (or by last workspace-touch timestamp) and take the top one.
- Same auto-fresh-session restore as Open.

### 2.4 Recover after accidental session termination

User experience:
1. User notices something went wrong: "Session disconnected", iframe blank, edits stopped applying, etc. They click a single button: **Reopen project**.
2. UI re-enters the workspace state with their last saved state restored.

Behind the scenes:
- Same as Open Existing Project.
- The "session disconnected" banner always carries a single primary action: "Reopen project" (not "Open new session", not "Restart container").
- If the latest known good restore point is older than X minutes, the banner additionally shows "View history…" (Section 4.1) so the user can pick a different point.

Critical: the user never has to choose between "stop session", "start session", "restart container", "rebuild image", etc. Those are not user-level concepts.

### 2.5 Share / Make Public

User experience:
1. From within the workspace, user clicks **Share**.
2. Modal: visibility toggle (Private / Public), shareable URL displayed when Public, copy-to-clipboard.
3. Confirms with a single click. No second dialog about "snapshot" or "publish".

Behind the scenes:
- Reuses the existing project visibility update endpoint.
- When flipping to Public, the platform takes a fresh project-scoped snapshot in the background so the published state is reproducible. The user does not see this; they see only "Project published".
- Public URL points at the project, not at any session.

### 2.6 Browse Public Projects

User experience:
1. Top-level navigation entry: **Gallery** (or **Public**, but the design recommends **Gallery** to make it sound like a destination, not a permission).
2. Cards of public projects: title, owner display name (not email, not UUID), last updated, language tag.
3. Click → preview-only view of the project (read-only file tree, read-only editor pane, live preview if available).
4. Primary action: **Make a copy** (fork). Secondary: **Share link**.

Behind the scenes:
- Existing `/api/projects/public` and `/api/projects/public/:id/fork` endpoints back this.
- Fork creates a fresh project for the requester, then auto-opens it (Section 2.2).

### 2.7 Import Project

User experience:
1. From the Projects page, **Import** button.
2. Choose source: ZIP upload, public URL, or paste files.
3. Platform shows progress, then drops the user into the imported project's workspace.

Behind the scenes:
- Wraps existing import endpoints (the import flow already exists in some form via project save/restore primitives; the design here does not require a new backend service, it requires a UX wrapper). If the backend doesn't yet have ZIP-import as a single endpoint, that becomes a future bounded task — *not registered here*.
- After import: same auto-fresh-session open path.

### 2.8 Download Project

User experience:
1. From the workspace **Share** menu (or project menu on the Projects page), **Download as ZIP**.
2. Browser downloads `project-name.zip` containing the user's files (no `.git/` internals).

Behind the scenes:
- Reuses existing session export path (`GET /api/sessions/:id/export` is already mapped per session controller routes), but the user-visible name and source is the **project**. The platform internally exports the currently bound session's workspace (which equals the project state).
- `.git/` is excluded from the zip just as it is excluded from snapshots (PROJ-02-03 invariant).

---

## 3. Session visibility policy

### 3.1 What normal users should never see

- The word "session".
- Session UUIDs.
- "Stop session" / "Start session" buttons.
- "Session expired" raw error text.
- "Container" anywhere.
- "Snapshot" as a primary verb (see Section 4).
- Any "Sessions" list page.

### 3.2 What normal users do see (recovery vocabulary)

- "Workspace disconnected" with a "Reopen project" button.
- "Workspace stopped due to inactivity" with a "Reopen project" button.
- "Saving…" / "All changes saved" / "Save failed — retry" inline indicators.
- "Last saved 3 minutes ago" timestamps.

The design recommendation is that **stop session** as a user action be **removed from the primary UI**. Inactivity-based stop is always platform-driven; if a user wants to stop a workspace explicitly, the affordance should be "Close project" (which navigates away) rather than a destructive runtime button. The platform stops the underlying session in the background after a short grace period.

### 3.3 Advanced / debug surface

Inside a project workspace, behind a clearly-labeled **Advanced** drawer (default collapsed), expose:

- The current backing session ID (read-only, copy-to-clipboard) — useful for support.
- "Force restart workspace" button → stops session, opens a fresh one with restore (under the hood: open-project against latest snapshot).
- "Container status" pill (running / starting / stopped).
- "Open raw logs" if/when log surface exists.

These are visible to all users in case they need them, but never primary. They are explicitly **not** required for normal use.

For operators only (separate route, Section 6), the full session/container/snapshot surface is exposed.

### 3.4 Communication of stop / restart / expired session events

- "Workspace stopped due to inactivity" → primary action: **Reopen project** → goes through Section 2.2.
- "Workspace failed to start" → primary action: **Try again** → retries open. Secondary: **Open older version** → opens history picker (Section 4.1).
- "Workspace was restarted" (after a Force Restart Workspace from Advanced) → notice with current state preserved.

Never expose: "container exited 137", "OOM killed", raw nest error JSON, snapshot UUIDs. These belong in the operator UI (Section 6).

---

## 4. Persistence and history model

### 4.1 User-facing history (one timeline)

Single user-facing concept: the project's **History** tab inside the workspace.

Each entry in History is a row with:
- a human label ("Auto-save", "Saved version: 'Working layout'", "Imported from ZIP", "Forked from <gallery project>"),
- a relative timestamp ("2 minutes ago"),
- a marker if this entry was a manual named save vs an automatic save,
- two actions per entry: **Restore** and **Compare** (compare may be deferred; restore must work day one).

No commit hashes, no snapshot UUIDs are shown unless the user opens the Advanced drawer.

User actions inside History:
- **Save current state…** — opens a small dialog asking for an optional name. Always succeeds; produces a new "named save" entry at the top.
- **Restore** — replaces current workspace state with the chosen entry's state, after a confirmation. This always opens a fresh session under the hood and never silently overwrites unsaved edits without confirmation.
- **Compare** (later phase) — diff view between current state and the chosen entry.

### 4.2 Background autosave / recovery layer

A separate layer that the user never directly sees as "snapshots":

- Auto-saves are taken on a debounced trigger (Section 4.3).
- Auto-saves are **git-backed** (one commit per autosave) plus periodic project-scoped snapshots for cross-restart durability (Section 4.4).
- Auto-saves have a retention policy (Section 4.5) so the History list doesn't drown.
- Recovery snapshots that were never user-named eventually compact down or roll up (Section 4.5).
- If the user selects "Restore", the platform always restores from the durable backing (snapshot, not just git), to avoid relying on container-local git.

The user only sees a clean History timeline. Internally there are two stores: git (in-container, cheap, dense) and snapshots (durable, sparse, cross-restart).

### 4.3 Autosave triggers (recommendation)

Trigger autosave on whichever fires first:

- **Idle debounce**: 2 seconds after the last edit/file-write, with a max-deferral of 15 seconds (so a continuously typing user still gets autosaves).
- **AI action boundary**: every successful AI file-action commit (write/create/delete) causes a git commit, with auto-snapshot every Nth AI action (recommend N=5).
- **Explicit save**: user-initiated "Save current state…" always commits + snapshots.
- **Lifecycle boundaries**: on workspace close, on session-expiry warning, on preview-start success, take a snapshot.
- **Time-based safety net**: at most one autosave snapshot every 60 seconds, even if many triggers fired in between.

### 4.4 Git vs. snapshot roles (keep both, separate purposes)

| Layer    | Lives in              | Strength                                     | Weakness                                |
|----------|-----------------------|----------------------------------------------|------------------------------------------|
| git      | session container `.git/` (excluded from snapshots per PROJ-02-03) | Dense, cheap, perfect for diffs/timeline    | Dies with the container. Not durable.   |
| snapshot | `/snapshot-store/` named volume (PROJ-01-21)                       | Durable across restarts, restorable into any session | Coarser, large, not great for fine timeline |

Rule of thumb:

- **Every** edit gets a git commit (cheap, dense).
- **Every named save and every Nth autosave** also gets a snapshot (durable, recovery-grade).
- The user-facing History is the **union** of these two layers, with the same row model. Internally we know which row is "git only" vs "git + snapshot". Restore prefers the snapshot if present, and reconstructs from git as a fallback.

### 4.5 Retention rules (recommendation)

Snapshots:
- Keep all named-save snapshots indefinitely (until user deletes).
- Keep the most recent N=20 autosave snapshots per project.
- Beyond N: compact to keep one per day for the past 14 days, one per week beyond that, drop the rest.
- Always keep at least one snapshot per project as long as the project exists.

Git:
- Container-local, lives as long as the session does. No retention pressure.

This bounds storage growth while always keeping the recent edit experience intact.

### 4.6 Behavior across Docker restarts and session expiry

- After Docker restart: project still openable. Restore picks the latest snapshot (PROJ-01-21 invariant). Git history inside the prior container is gone — that's acceptable because user-facing History rows backed by snapshots remain.
- After session expiry: same as Docker restart from the user's perspective — Reopen Project restores from snapshot.
- After container OOM/crash: same again. The "workspace disconnected" banner is the only difference, and the recovery path is identical.

The user model becomes resilient: anything that kills runtime turns into a single "Reopen project" click that lands the user back at the latest durable point.

### 4.7 What happens to "Project Snapshots" as a user-facing term

**Recommendation: rename and demote.**

- The user-facing word "Snapshot" disappears from the primary UI.
- It is replaced by **History** rows (auto-save / named save).
- The internal API and code keep using "snapshot" — no backend rename is needed.
- An "Advanced" surface inside a workspace may show "Background recovery snapshots" for power users / operators, but most users never see this.

---

## 5. Public / private / share model

### 5.1 Defaults

- New projects are **Private by default**. No exceptions, no per-user opt-in.
- Forks of public projects are also Private by default.

### 5.2 Going public

- A single toggle inside the project's **Share** modal: Private ⇄ Public.
- Going public:
  - shows the public URL,
  - takes a background snapshot (so the published state is reproducible),
  - shows a one-line warning: "Public projects are visible to anyone with the link and on the public gallery."
- Going private: instant toggle, link breaks, gallery card is hidden. No data loss.

### 5.3 Sharing surface

- Inside the workspace: **Share** menu in the top-right cluster, between History and Account.
- Contents: visibility toggle, public URL (when public), copy button, "Download as ZIP" (Section 2.8), "Make a copy" (clones to a new private project for the current user — useful for "save as").

### 5.4 Where public browsing lives

- A top-level **Gallery** route, separate from "My Projects".
- Gallery is read-only by default. Users can view and fork. They cannot edit somebody else's project in place. (Forking always creates a private project for the requester.)

### 5.5 Primary vs secondary in the UX

**Primary** (always visible to a logged-in user):
- My Projects (default landing).
- Workspace (when in a project).
- Gallery (top nav entry).
- Account menu.

**Secondary** (one click in):
- History (inside workspace).
- Share (inside workspace).
- Settings (under Account).

**Tertiary / Advanced** (collapsed):
- Backing session ID, container status, force restart, raw snapshot list, raw git log.

This three-tier IA gives a clean default surface while keeping power-user knobs reachable.

---

## 6. Internal / operator recovery UI

A separate surface intended only for platform operators. Not linked from the user-facing nav. Mounted under e.g. `/internal/ops` or a separate sub-domain. Authorization is the most aggressive available (admin role + IP allowlist + same-internal-network requirement). Per `CLAUDE.md` and `AGENTS.md`, the precise auth scheme is intentionally deferred — this design only specifies functional requirements; auth implementation is a separate future task and explicitly out of scope here.

### 6.1 Functional requirements

1. **Search** by user email, user ID, project ID, project slug, session ID, snapshot ID. One unified search box.
2. **User detail view**:
   - basic account info,
   - list of their projects with size and last-touched,
   - list of recent sessions with status (running / stopped / expired),
   - list of all snapshots with sizes and parent project (if any).
3. **Project detail view**:
   - metadata (id, slug, owner, visibility, created/updated),
   - associated snapshot history (durable view, not the user's filtered History),
   - associated sessions, current and historical,
   - file count and total size,
   - last open/restore attempt and its outcome.
4. **Snapshot detail view**:
   - on-disk path,
   - byte size,
   - file count and breakdown,
   - presence checks for both `.meta.json` and `.data.json`,
   - "verify integrity" action that walks the payload (counts files, flags binary content, flags any `.git/` entries even though those should never appear post-PROJ-02-03).
5. **Force restore**:
   - choose a target user, choose a snapshot, click "Restore into fresh session".
   - the operator UI creates a fresh session for that user, runs the existing project-open / restore path, and reports the resulting session id and outcome.
   - this is the operator's main recovery primitive.
6. **Open/restore failure inspector**:
   - tail of api-gateway and container-manager logs filtered by session/project/snapshot id,
   - the most recent ExceptionsHandler events for the entity,
   - a "what would PROJ-02-02-style diagnosis say" summary panel (which subsystem refused: snapshot read, restore write, container start, preview start, git checkpoint).
7. **Health surface**:
   - per-service health rolled up (api-gateway, container-manager, postgres, redis, snapshot volume free space, docker daemon reachability),
   - per-session preview/container status checks on demand,
   - per-snapshot read-back smoke test on demand.

### 6.2 Visibility / access model

- Internal-only route, hard-isolated from user-facing routes. No element of the user nav links here.
- Operator role (a new explicit role; persisted on the user record). Non-operators get 404, never 401, on any internal route.
- All operator actions are audit-logged: who did what to which entity at what time, with the outcome. The audit log is itself queryable from the operator UI.
- All destructive actions (delete project, delete snapshot, force-stop container) require a typed-confirmation step; restores do not.

### 6.3 What the operator UI explicitly is not

- It is not a customer support chat tool.
- It is not a billing console.
- It is not a place to edit user data arbitrarily.
- It does not run AI on behalf of users.
- It does not bypass normal product flows; it composes them.

---

## 7. Future-ready UX extension points

The IA proposed in Sections 1–6 leaves clear extension slots for upcoming features. None of these slots imply implementation work in PROJ-03; they are commitments to keep the IA from blocking us later.

### 7.1 AI-to-AI collaboration

- The workspace's chat panel already implies "AI participants". The design treats the Chat as a **conversation surface** that can host one or more participants, where today there is exactly one assistant.
- Extension slot: a participants list on the chat surface (default: one model). Multi-agent introduces additional rows; the IA does not need to change.
- Extension slot: per-message attribution (which participant produced it). Already present in spirit; the redesign just keeps it explicit.

### 7.2 Multi-agent workflows

- The workspace gains a **Plan** subsurface (later phase) that hosts agent task graphs. It lives next to History on the right rail, never replacing it.
- Operator UI gains a "running plans" inspector. Same shape as snapshot inspector.

### 7.3 Richer project dashboards

- The Projects page is built as a **list with sortable cards**, not a single ad-hoc layout. Adding columns (last AI cost, last preview status, collaborators, plan count) is purely additive.
- Each project card has a small slot for status badges so future systems can publish into it without redesign.

### 7.4 Advanced orchestration

- Today's "open project → fresh session" is one orchestration. Tomorrow's might involve scheduled jobs, parallel sessions per project, etc. The design isolates this behind the **Workspace** abstraction. As long as the workspace can be opened, restored, edited, saved, and closed, the orchestration underneath can grow.

---

## 8. Recommended IA / screen structure

Top-level routes (recommended labels in **bold**):

| Route               | Label               | Audience  | Purpose                                                                  |
|---------------------|---------------------|-----------|--------------------------------------------------------------------------|
| `/`                 | **Home**            | Logged-in | Lists "My Projects", with primary CTAs: New Project, Resume Latest.       |
| `/projects`         | **Projects**        | Logged-in | Full projects list with filters (private/public, recent, alphabetical).   |
| `/projects/:id`     | **Workspace**       | Logged-in | Editor + chat + preview + history + share. The center of gravity.        |
| `/gallery`          | **Gallery**         | Anyone    | Public projects browser. Read-only with Fork.                            |
| `/gallery/:id`      | **Public Project**  | Anyone    | Read-only project view with Fork.                                        |
| `/account`          | **Account**         | Logged-in | Profile, plan, API keys, language. (Folds in current `/keys`.)           |
| `/login`, `/signup` | (auth)              | Anyone    | Existing pages, modernized labels per UX-01.                             |
| `/internal/ops/...` | **Operator Console**| Operators | Section 6 surface. Hard-isolated.                                         |

Inside the workspace (`/projects/:id`), tabbed/right-rail sub-surfaces:

| Sub-surface  | Label         | Notes                                                                    |
|--------------|---------------|--------------------------------------------------------------------------|
| Editor       | (no tab; default canvas) | Monaco + file tree.                                          |
| Chat         | **Chat**      | Existing AI conversation surface.                                        |
| Preview      | **Preview**   | Existing preview iframe.                                                 |
| History      | **History**   | Section 4.1.                                                             |
| Share        | **Share**     | Section 5.3.                                                             |
| Advanced     | **Advanced**  | Section 3.3, collapsed by default, off the primary path.                 |

Notable removals from the current product surface:

- The "Sessions" list as a primary destination is removed.
- "Stop Session" as a primary button is removed (Section 3.2).
- "Project Snapshots" as a separate user-facing term is removed (Section 4.7).
- Internal task-slice / spec / debug labels stay removed (already handled by UX-01-02).

Notable additions:

- **Gallery** as a top-level destination.
- **History** as a workspace tab.
- **Operator Console** as an internal-only surface.
- A clear "Reopen project" recovery primitive instead of session-restart language.

---

## 9. Decisions, recommendations, risks

### 9.1 Recommended direction

Adopt the project-first model in this document. Specifically:

- Make Projects the only first-class user object.
- Always auto-create a fresh session when entering a workspace; never expose session lifecycle to normal users.
- Replace user-facing "snapshots" with a single History timeline backed by both git (dense) and snapshots (durable).
- Default everything to Private, ship a separate Gallery for Public.
- Build a separate Operator Console for recovery and integrity tooling.
- Hold a clearly-labeled Advanced drawer inside the workspace as the safety valve for power users without contaminating the default surface.

### 9.2 What to do now

Nothing, in code. This document is design only. PROJ-03-01's deliverable is this document.

The next step (when ready) is to register, **as separate bounded tasks**, the implementation slices listed in Section 9.5. Those tasks must be authorized explicitly per `CLAUDE.md` governance — they are **not** registered by this document.

### 9.3 What to postpone

- Backend rename of "snapshot" — postpone indefinitely. Internal vocabulary can stay.
- Multi-agent / AI-to-AI work — postpone until current chat UX is fully migrated to project-first.
- Compare/diff in History — postpone to a phase 2 of History; restore-only is enough for v1.
- Plan / multi-agent right-rail — postpone until at least one concrete multi-agent feature is committed.
- Operator Console destructive actions (delete project, delete snapshot) — defer; ship inspect/restore first.
- Operator role auth scheme — defer per `CLAUDE.md` (architecturally placeholder only).

### 9.4 Risks and trade-offs

1. **Always-fresh-session on Open** is simpler but uses a bit more container churn. Trade-off accepted because deterministic open is more important than container reuse, and PROJ-02-01/02-03 have already paid the cost of making this path reliable.
2. **Hiding the word "snapshot"** removes a familiar concept for existing users. Mitigation: History rows clearly say "Auto-save" / "Saved version" so users still understand what they're picking. Internal/Advanced surfaces still expose the snapshot list verbatim for those who want it.
3. **Removing Stop Session as a primary button** could surprise power users. Mitigation: keep it in Advanced and keep platform-driven cleanup aggressive enough that nobody needs to stop a session manually.
4. **Operator Console is a new surface to maintain.** Mitigation: build it on top of existing endpoints first; do not add new backend services for it. Most of it is composition over what already exists.
5. **History compaction policy** has to be tuned with real usage data. Risk: compacting too aggressively loses recent recoverability; too laxly explodes storage. Mitigation: ship the policy as a config so it can be adjusted without code change.
6. **Backwards compatibility for existing users.** They have projects, sessions, and snapshots in the wild. The redesign is a UI/UX overlay that must not break their data. The PROJ-02-03 restore-skip pattern is a precedent: tolerate legacy artifacts silently.
7. **Operator route security**. Until the auth scheme is built, the Operator Console must not be deployed publicly. Mitigation: gate the route entirely behind a build-time flag or local-dev-only flag until the operator-auth follow-up task lands.

### 9.5 Suggested later implementation slicing (NOT registered)

These are *suggested* future bounded tasks. None are registered by this document. Each one should be reviewed and registered explicitly via the CLAUDE.md governance loop when the user is ready.

1. **PROJ-03-02 — Auto-create-session on New Project / Open Project (frontend)**
   Wrap current handlers with auto-fresh-session creation; remove the "select session" affordance from primary nav. Backend unchanged. PROJ-02-01 invariants preserved.

2. **PROJ-03-03 — Hide Sessions list from primary navigation**
   Move existing Sessions surface behind the Advanced drawer. Add "Reopen project" recovery banner. Keep all routes intact.

3. **PROJ-03-04 — Workspace History tab (read + restore only)**
   Build the unified History view from the existing snapshot list + git checkpoint list. Restore action wraps current open-project-with-snapshot path. No backend change.

4. **PROJ-03-05 — Autosave triggers and named-save UI**
   Implement Section 4.3 triggers and the "Save current state…" dialog. Reuses existing checkpoint/snapshot endpoints.

5. **PROJ-03-06 — Snapshot retention policy and background compaction job**
   Implement Section 4.5 retention rules. New backend job; bounded scope.

6. **PROJ-03-07 — Gallery as a top-level route**
   Promote `/api/projects/public` browsing to a top-level page; add Fork-then-Open flow.

7. **PROJ-03-08 — Share modal and visibility toggle in workspace**
   Inline the visibility toggle, public URL, copy, download-zip into a Share menu.

8. **PROJ-03-09 — Operator Console v1 (inspect + restore)**
   Internal route, search, user/project/snapshot detail views, force-restore action. Audit-logged. Auth uses the most aggressive available baseline; full operator-auth design is its own task (PROJ-03-10).

9. **PROJ-03-10 — Operator-role auth scheme (design + impl)**
   Bounded task to replace the placeholder auth on `/internal/ops` with a real role + network gate.

10. **PROJ-03-11 — UX copy pass for recovery / lifecycle messages**
    Replace any remaining "session expired" / "container stopped" raw strings with the recovery vocabulary in Section 3.4.

Each of these is small enough to be a single bounded task with its own checkpoint.

---

## 10. Out-of-scope reaffirmation

This document does not:

- change any code,
- change any task-status fields,
- register any new implementation tasks,
- change any backend API contract,
- change any frontend component,
- propose any change to internal-only endpoints (which remain as locked by `CLAUDE.md`),
- propose changes to billing, quotas, kill switches, plan tiers, or auth flows,
- propose any change to PROJ-01-21 snapshot persistence behavior,
- propose any change to PROJ-02-01 deterministic project-open hydration,
- propose any change to PROJ-02-03 git-internals exclusion (it is a hard invariant in this design).

PROJ-03-01 is complete when this document is reviewed and accepted as the basis for the future implementation slices listed in Section 9.5.
