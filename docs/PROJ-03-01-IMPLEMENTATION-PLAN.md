# PROJ-03-01 — Phased Implementation Plan

## Document Metadata

- Source design: `docs/PROJ-03-01-DESIGN.md`
- Status: PLANNING (no code, no task registration)
- Output: this document only.
- Note: `docs/POST-RECOVERY-FINAL-CHECKPOINT.md` was referenced by the prompt but does not exist on disk; this plan is grounded in `CURRENT-WORKING-STATE-CHECKPOINT.md`, the PROJ-01 family checkpoints, the PROJ-02 family checkpoints, the UX-01 final checkpoint, the PREV-01 final checkpoint, and PROJ-03-01-DESIGN.md.

This plan converts the approved PROJ-03-01 design into an opinionated, phased rollout. Phases are ordered to *de-risk* the transition: each phase preserves currently working behavior and is independently revertible. No phase requires a backend rewrite. No phase reintroduces a long unstable recovery wave.

---

## 1. Phase structure

Five phases, plus a tiny phase-0 enabling slice. Each phase is a self-contained unit that can be paused, re-validated, or shipped to a flag/feature gate before the next phase begins.

| Phase | Name                                                  | Theme                                                   |
|-------|-------------------------------------------------------|---------------------------------------------------------|
| 0     | Phase 0 — Plan/Flag Foundation                        | One-time slice: feature flag and copy infrastructure.   |
| A     | Phase A — Project-First Navigation Shell              | IA cleanup. New routes, vocabulary, no behavior change. |
| B     | Phase B — Auto-Session New / Open Flows               | Behavior change behind flags. Hides session lifecycle.  |
| C     | Phase C — History Timeline + Autosave                 | Persistence UX redesign on top of existing storage.     |
| D     | Phase D — Share, Gallery, and Public Browsing         | Surface promotion + visibility UX cleanup.              |
| E     | Phase E — Operator Console (Internal Recovery UI)     | Internal-only console. Inspect + force-restore first.   |

Future phases (F+) for AI-to-AI / multi-agent / dashboards are deliberately not scheduled here; Section 7 shows where they hook in.

---

## 2. Recommended order

The order below trades a small amount of UX coherence in the middle for substantially lower regression risk.

### Why this order

- **Phase 0 first** because feature flags and copy infrastructure are cheap, reversible, and remove most "ship and panic" risk from later phases.
- **Phase A before Phase B** because IA changes are pure relocation (move components, rename labels, add new top-level routes) with no runtime semantic change. They unlock the *language* later phases will speak ("Reopen project", "History", "Share") before that language has any new behavior behind it.
- **Phase B before Phase C** because auto-session deterministically anchors the workspace lifecycle. Once we always create a fresh session on Open/New, the History timeline can confidently restore against a known-good runtime. Doing C first would mean restoring into stale or shared sessions, which is the failure shape PROJ-02 spent six fixes eliminating.
- **Phase C before Phase D** because "Make Public" should snapshot in the background (per design Section 5.2). That requires the autosave/snapshot path of Phase C to be stable and battle-tested.
- **Phase D before Phase E** because Gallery/Share work surfaces *real user data* into a public route; we want that done and observed in the wild before we expose any operator tooling. The operator console is a high-leverage internal surface; we want to build it after we have a stable user surface to compose, not in parallel with one.
- **Phase E last** because the operator console is the *only* phase that requires a new auth gate. We want to be the last people standing in the user surface so we can pull the operator console behind a real role-based guard without forcing the rest of the product to wait.

### What each phase unlocks

| Phase | Unlocks                                                                        |
|-------|--------------------------------------------------------------------------------|
| 0     | Feature flag the rest of the work; safe to merge incrementally.                |
| A     | New IA, new vocabulary, no behavior change. Sets the stage for B/C/D.          |
| B     | Reliable, deterministic project lifecycle. "Reopen project" recovery primitive.|
| C     | One History timeline, autosave UX, named saves. Enables D's "publish snapshot".|
| D     | Public Gallery as a destination. Share modal. Forks land in a clean private.   |
| E     | Operator can inspect, integrity-check, and recover any user's project.         |

### What to wait on

- **Backend rename of "snapshot"** — never. Internal vocabulary stays.
- **Compare/diff in History** — defer to a Phase C-2 follow-on, after Restore-only history is in place and used.
- **Multi-agent / AI-to-AI** — defer entirely; reserved IA slots in Phase A are sufficient.
- **Operator destructive actions** (delete project / delete snapshot) — defer to a Phase E-2; ship inspect + force-restore first.
- **Real operator-role auth scheme** — separate task (PROJ-03-10 in design Section 9.5), required *before* operator console is reachable in production.

---

## 3. Slice strategy inside each phase

Every slice below is sized to fit a single bounded task with one checkpoint. Slices are described as **proposed** task IDs. They are not registered by this document.

### Phase 0 — Plan/Flag Foundation

#### Slice 0.1 — Feature flag and copy bundle

- Proposed task ID: PROJ-03-A0
- Title: Add Feature Flag Infrastructure And Recovery Vocabulary Copy Bundle
- Goal: introduce a single feature flag (e.g. `PROJECT_FIRST_UX`) toggleable per environment, plus a centralized `recoveryCopy` strings file/module.
- Scope: frontend only. New `frontend/lib/feature-flags.ts` (or extend an existing config module if one exists). New `frontend/lib/recovery-copy.ts`. Wired into `app/[locale]/app/page.tsx` and `components/workspace/workspace-shell.tsx` only as the consumption points; no UI strings are *changed* in this slice — only made addressable.
- Out of scope: any visible UX change, any rollout decision, any backend env wiring beyond reading an env var.
- Acceptance criteria:
  - flag defaults to `false` in all environments,
  - flag can be flipped in dev locally (env var),
  - new copy bundle exports the strings the design will need ("Reopen project", "Workspace disconnected", "All changes saved", etc.) but no UI consumes them yet,
  - existing 65/65 workspace shell tests still pass.
- Touch areas: frontend only. Backend: none. Docs: a small note in the slice's own checkpoint.
- Recommended model: smaller is fine; this is mechanical scaffolding.

### Phase A — Project-First Navigation Shell

#### Slice A.1 — Top-level routes and labels (Home, Projects, Gallery, Account, Workspace)

- Proposed task ID: PROJ-03-A1
- Title: Add Project-First Top-Level Routes And Labels Behind Feature Flag
- Goal: stand up the IA from design Section 8 as a thin shell. Behind `PROJECT_FIRST_UX`, the new routes exist and link to existing functionality (no new pages from scratch — they wrap or redirect).
- Scope: frontend routing + nav only. Add `/[locale]/projects`, `/[locale]/gallery`, `/[locale]/account` (the latter folds in `/keys` per design Section 8). The current `/app/...` workspace surface stays intact; the new `/projects/:id` route reuses it under the hood.
- Out of scope: behavior changes, backend changes, nav under the existing flag-off path.
- Acceptance criteria:
  - with the flag off, the product is identical to today's,
  - with the flag on, the new top-level nav appears with correct labels,
  - all routes render content equivalent to today's surfaces (no white screens, no 404s, no broken links),
  - existing tests pass; new tests verify the flag gates.
- Touch areas: `frontend/app/[locale]/...`, `frontend/components/workspace/workspace-shell.tsx` (header nav).
- Recommended model: any.

#### Slice A.2 — Demote sessions list, hide stop-session from primary

- Proposed task ID: PROJ-03-A2
- Title: Hide Sessions List From Primary Nav And Move Stop-Session To Advanced Drawer
- Goal: make sessions invisible on the primary path while keeping them functional under an Advanced drawer (design Section 3.3). Behind the flag.
- Scope: frontend only. Sessions list stays mounted but hidden when flag is on. Stop-Session button moves into the Advanced drawer in the workspace.
- Out of scope: removing the underlying components, backend changes, autosave, history.
- Acceptance criteria:
  - with the flag on, no primary nav exposes the word "session",
  - stop-session is reachable from Advanced and still works,
  - existing flows that hit Sessions endpoints continue to work (smoke check).
- Touch areas: `frontend/components/workspace/workspace-shell.tsx`, top-level nav components.
- Recommended model: any.

#### Slice A.3 — Recovery vocabulary banners (no new behavior, just better strings)

- Proposed task ID: PROJ-03-A3
- Title: Replace Raw Session Lifecycle Strings With Recovery Vocabulary
- Goal: every "session expired", "container exited", "session disconnected" raw string in the user-visible UI is replaced (under the flag) by the recovery copy bundle, with a primary "Reopen project" action that wraps existing open-project behavior.
- Scope: frontend only. Wraps existing handlers; no new endpoints.
- Out of scope: changing the underlying lifecycle, retry logic, or backend errors. Just strings + one-button affordance.
- Acceptance criteria:
  - all known raw lifecycle strings on the user surface are replaced when the flag is on,
  - "Reopen project" button consistently calls the existing project-open path,
  - no orphaned references to raw strings remain in the user-visible flag-on path,
  - existing tests pass.
- Touch areas: `frontend/components/workspace/workspace-shell.tsx`, `frontend/app/[locale]/app/page.tsx`, copy bundle from slice 0.1.
- Recommended model: any.

### Phase B — Auto-Session New / Open Flows

#### Slice B.1 — Auto-fresh-session on New Project

- Proposed task ID: PROJ-03-B1
- Title: Auto-Create Fresh Session On New Project
- Goal: clicking **New Project** creates the project and a fresh attached session and lands the user in the workspace, with no session-selection step. Behind the flag.
- Scope: frontend only. Wraps existing project-create + session-create + project-association calls into a single sequence. PROJ-02-01's deterministic hydration sequence is the contract for the post-create handoff.
- Out of scope: backend changes; redesign of project create flow; changing default session config.
- Acceptance criteria:
  - flag on: New Project drops user into a workspace with a fresh empty session attached,
  - no choice of session is offered,
  - no race regressions vs PROJ-02-01,
  - flag off: legacy flow unchanged,
  - smallest relevant test suite passes.
- Touch areas: `frontend/app/[locale]/app/page.tsx` (new-project handler), workspace shell.
- Recommended model: any with care; carry over the discipline from PROJ-02-01.

#### Slice B.2 — Auto-fresh-session on Open Existing Project

- Proposed task ID: PROJ-03-B2
- Title: Always Open Project Into A Fresh Session
- Goal: clicking a project always opens a brand-new session and restores the project deterministically, never reattaching to a prior session. Behind the flag.
- Scope: frontend only. Builds on the existing `handleOpenWorkspaceProject` and `hydrateWorkspaceForProjectOpen` from PROJ-02-01. Selection of "the session to open into" becomes a platform-internal "create one now" call.
- Out of scope: backend changes (the open-project endpoint already supports a target sessionId; we just always pass a fresh one). No change to snapshot resolution.
- Acceptance criteria:
  - flag on: Open Project always lands in a freshly created session with files/content restored deterministically (no refresh required — same contract as PROJ-02-01),
  - no regression vs PROJ-02-02 / PROJ-02-03 invariants,
  - container churn is acceptable (one new container per Open),
  - flag off: legacy flow unchanged.
- Touch areas: `frontend/app/[locale]/app/page.tsx`. Possibly small follow-up in the workspace shell to remove any "select session for this project" affordance behind the flag.
- Recommended model: any with care.

#### Slice B.3 — "Reopen project" replaces "session expired" recovery

- Proposed task ID: PROJ-03-B3
- Title: Wire Recovery Banners To Reopen Project Action
- Goal: take the strings/buttons introduced in slice A.3 and bind their primary action to the Open-Project-into-fresh-session flow from B.2.
- Scope: frontend. No new endpoints. All existing recovery dead-ends are replaced by a single primary action.
- Out of scope: backend, autosave, history.
- Acceptance criteria:
  - any "workspace disconnected / expired / failed-to-start" condition presents a single **Reopen project** button,
  - the button executes the B.2 path,
  - no regressions in normal use.
- Touch areas: workspace shell, page.tsx.
- Recommended model: any.

#### Slice B.4 — Resume Latest Work entry point

- Proposed task ID: PROJ-03-B4
- Title: Add Resume Latest Project CTA On Home
- Goal: Home page shows a "Resume latest" CTA that opens the most-recently-touched project via the B.2 path.
- Scope: frontend. Sorting is by existing `updatedAt` on `projects`.
- Out of scope: any backend change, "last workspace touch" telemetry (use what exists today).
- Acceptance criteria: clicking the CTA opens the most recent project; no project? CTA is hidden.
- Touch areas: home page.
- Recommended model: any.

### Phase C — History Timeline + Autosave

#### Slice C.1 — Workspace History tab (read + restore only)

- Proposed task ID: PROJ-03-C1
- Title: Add Workspace History Tab Backed By Snapshots And Git Checkpoints
- Goal: introduce the History tab in the workspace right rail. Rows are the union of project-scoped snapshots and (when available) git checkpoints. Each row exposes a Restore action that wraps the existing project-open-with-snapshot path.
- Scope: frontend only. Backend: none. Restoration always goes through the B.2 path so we get fresh-session determinism for free.
- Out of scope: Compare/diff, autosave triggers (C.2), retention (C.3).
- Acceptance criteria:
  - History tab lists snapshots for the current project sorted newest-first with human labels,
  - selecting Restore opens the project at that point into a fresh session,
  - no destabilization of the open path.
- Touch areas: workspace shell, page.tsx, possibly a new small component file.
- Recommended model: any.

#### Slice C.2 — Autosave triggers and named-save UI

- Proposed task ID: PROJ-03-C2
- Title: Implement Autosave Triggers And Named-Save Dialog
- Goal: implement the trigger ladder from design Section 4.3 (idle debounce, AI action boundary, explicit save, lifecycle boundaries, per-minute safety net) using the existing checkpoint and snapshot endpoints.
- Scope: frontend orchestration of existing endpoints. Modest backend rate-limiter consideration if not already in place.
- Out of scope: changing the underlying snapshot service; changing checkpoint format.
- Acceptance criteria:
  - autosaves observable in the History list under the flag,
  - "Save current state…" dialog produces a named-save row,
  - no more than one autosave snapshot per project per minute (safety net),
  - no regression in chat/preview/preview lifecycle.
- Touch areas: page.tsx, workspace shell, possibly a small new client wrapper for snapshot create.
- Recommended model: medium. Triggers interact with multiple existing effects; carry PROJ-02 discipline.

#### Slice C.3 — Snapshot retention and background compaction job

- Proposed task ID: PROJ-03-C3
- Title: Implement Snapshot Retention And Compaction
- Goal: keep snapshot storage bounded per design Section 4.5: keep all named saves, last 20 autosaves, then daily for 14 days, then weekly. Always keep at least one.
- Scope: backend (api-gateway) only. New scheduled job (or on-write compaction). All-defaults via configuration.
- Out of scope: schema changes; moving to object storage; changing the on-disk format.
- Acceptance criteria:
  - a project with many autosaves does not grow `/snapshot-store/` unbounded,
  - named saves are never removed by compaction,
  - the most recent restore point is always preserved,
  - PROJ-01-21 volume layout untouched,
  - PROJ-02-03 git-exclusion untouched.
- Touch areas: `services/api-gateway/src/snapshots/...`, possibly a tiny scheduler module.
- Recommended model: medium; isolated change but storage-policy correctness matters.

#### Slice C.4 — Hide "Snapshot" wording from primary UI

- Proposed task ID: PROJ-03-C4
- Title: Replace User-Facing Snapshot Wording With History Vocabulary
- Goal: any remaining user-visible "snapshot" string is replaced (flag on) by History vocabulary ("Auto-save", "Saved version", "Background recovery snapshots" only inside Advanced).
- Scope: frontend strings. Backend keeps "snapshot".
- Out of scope: backend renames, schema renames, API renames.
- Acceptance criteria: no flag-on user-facing string contains the word "snapshot" outside Advanced.
- Touch areas: copy bundle, workspace shell, page.tsx.
- Recommended model: any.

### Phase D — Share, Gallery, and Public Browsing

#### Slice D.1 — Share modal in the workspace

- Proposed task ID: PROJ-03-D1
- Title: Add Workspace Share Modal With Visibility Toggle And Public URL
- Goal: implement design Section 5.3 — Share menu in the workspace top-right cluster, visibility toggle (private/public), public URL, copy, "Make a copy", "Download as ZIP".
- Scope: frontend. Wraps existing project visibility update + (Section 2.7) existing export endpoint.
- Out of scope: backend visibility changes, gallery promotion (D.2), zip-import (postponed).
- Acceptance criteria:
  - flipping visibility is instant and survives reload,
  - public URL works for unauth users (existing public route),
  - copy-to-clipboard succeeds,
  - download-as-zip produces the expected file with no `.git/` content.
- Touch areas: workspace shell.
- Recommended model: any.

#### Slice D.2 — Background snapshot on Make Public

- Proposed task ID: PROJ-03-D2
- Title: Auto-Snapshot Project On Public Visibility Toggle
- Goal: when a project flips Private → Public, the platform takes a fresh snapshot in the background so the published state is reproducible (design Section 2.5 / 5.2).
- Scope: backend hook on visibility change. Reuses existing snapshot create.
- Out of scope: any change to public access semantics; any new endpoint.
- Acceptance criteria:
  - going public produces exactly one new snapshot,
  - the snapshot follows PROJ-02-03 invariants,
  - reverting to private does not delete that snapshot.
- Touch areas: api-gateway projects service.
- Recommended model: any.

#### Slice D.3 — Top-level Gallery destination

- Proposed task ID: PROJ-03-D3
- Title: Promote Public Projects Browser To Top-Level Gallery
- Goal: add the `/[locale]/gallery` page (cards, sort, filter), each card linking to the existing public project view; primary action **Make a copy** wired to existing fork-then-open flow.
- Scope: frontend.
- Out of scope: backend search, recommendations, social.
- Acceptance criteria:
  - flag on: Gallery is reachable from primary nav and shows public projects,
  - Fork lands the user in a fresh private project (via B.2),
  - flag off: today's public surface unchanged.
- Touch areas: new gallery page component, top-level nav.
- Recommended model: any.

### Phase E — Operator Console (Internal Recovery UI)

#### Slice E.1 — Operator console route and search (read-only)

- Proposed task ID: PROJ-03-E1
- Title: Internal Operator Console Route With Unified Search
- Goal: stand up `/internal/ops` (frontend) backed by a small set of internal endpoints. Search by user email/id, project id/slug, session id, snapshot id. Read-only.
- Scope: frontend new route + small set of internal API additions if necessary, behind the most aggressive available auth baseline (feature flag + dev-only flag until E.4 lands).
- Out of scope: any destructive action; any production rollout (the route stays gated).
- Acceptance criteria:
  - search resolves all four entity types,
  - non-operators get 404,
  - audit log records every query.
- Touch areas: `services/api-gateway/src/internal/...` (new module if needed), `frontend/app/internal/ops/...`.
- Recommended model: medium; new internal surface, get the auth/audit shape right.

#### Slice E.2 — Detail views (user / project / snapshot / session)

- Proposed task ID: PROJ-03-E2
- Title: Internal Operator Detail Views For User Project Snapshot And Session
- Goal: read-only detail panels for each entity (design Section 6.1.2–6.1.4). Snapshot detail includes presence checks for `.meta.json`/`.data.json`, byte size, file count, integrity flags (binary content, leaked `.git/` entries).
- Scope: backend small read endpoints + frontend panels.
- Out of scope: destructive actions, force-restore (E.3).
- Acceptance criteria:
  - integrity scan reports correct counts on a known-good and a synthetic-bad snapshot,
  - logs filtered by entity id render correctly.
- Touch areas: api-gateway snapshots/projects/sessions read APIs (internal-only), frontend ops panels.
- Recommended model: medium.

#### Slice E.3 — Force-restore into a fresh session

- Proposed task ID: PROJ-03-E3
- Title: Operator Force Restore Into Fresh Session
- Goal: implement design Section 6.1.5 — operator picks a snapshot, platform creates a fresh session for the target user and restores. Returns the new session id.
- Scope: backend reuses existing project-open / restore code; new internal endpoint that wires it for an arbitrary target user.
- Out of scope: deleting/expiring the prior session; modifying snapshot data.
- Acceptance criteria:
  - operator can recover a user from a stuck state without giving the user new credentials,
  - audit trail records the operation,
  - no path validation guard is weakened.
- Touch areas: api-gateway internal controller, frontend ops action button.
- Recommended model: medium.

#### Slice E.4 — Operator-role auth scheme

- Proposed task ID: PROJ-03-E4
- Title: Operator Role Auth Scheme For Internal Console
- Goal: replace the placeholder gate from E.1 with a real role + network gate (design Section 6.2). Per `CLAUDE.md`, this is the only slice in the whole plan that touches auth.
- Scope: backend + frontend gate. New role on user record, IP allowlist (configurable), env-driven enforcement.
- Out of scope: anything not on `/internal/ops/*`. The product user-auth flows are not changed.
- Acceptance criteria:
  - non-operators get 404 on every `/internal/ops/*`,
  - operators must satisfy both role and network checks,
  - audit log captures auth result for every request.
- Touch areas: auth module, internal controllers, frontend route guard.
- Recommended model: medium-to-high; auth correctness matters.

#### Slice E.5 (optional, deferred) — Destructive operator actions

- Proposed task ID: PROJ-03-E5
- Title: Operator Destructive Actions With Typed Confirmation
- Goal: delete project, delete snapshot, force-stop container. Each requires typed-confirm and audit entry.
- Scope: backend endpoints + frontend modals.
- Out of scope: bulk operations.
- Acceptance criteria: no destructive action runs without typed confirm + audit.
- Touch areas: same surface as E.1–E.3.
- Recommended model: high; destructive surface needs care.

---

## 4. Safety / migration strategy

The single most important rule: **every phase ships behind `PROJECT_FIRST_UX`** and is independently revertible. The current product surface keeps working as the default until a phase is explicitly cut over.

### 4.1 What stays temporarily

- The current sessions list page stays mounted (Slice A.2 hides it from primary nav but does not delete it). This gives us a 1-click escape hatch if Phase B regresses.
- The current "Open Project" handler stays callable in legacy mode (flag off). It is not deleted until Phase B is observed stable for a deliberate cooldown period.
- The existing `/keys` page stays reachable while Phase A folds it under `/account`; only the link relocates.

### 4.2 What moves to Advanced

- Stop Session button (A.2).
- Backing session ID display (A.2).
- "Force restart workspace" (A.2).
- Container status pill (A.2).
- Raw snapshot list, raw git log, raw container info (Phase C and onwards).

### 4.3 What gets hidden later (only after stability is confirmed)

- The standalone Sessions page (after Phase B has run for a deliberate cooldown — at minimum two consecutive bug-free weeks of normal use, ideally also after Phase C ships).
- The wording "snapshot" in the user-facing UI (Phase C-4).
- Any remaining raw-string lifecycle banners (Phase B-3).

### 4.4 How to avoid another long unstable recovery wave

The PROJ-02 family taught us:

1. **Never combine an architectural change with a behavior change in the same slice.** Phase A separates IA changes from Phase B's behavior change for exactly this reason.
2. **Protect the project-open hydration contract from PROJ-02-01.** Every slice that touches open/restore (B.1, B.2, C.1, D.2, E.3) is required to preserve the deterministic hydration sequence and the `projectOpenInProgressRef` guard. Any slice that adds a new effect to `page.tsx` must explicitly state how it interacts with that ref.
3. **Add no fire-and-forget async to the lifecycle path.** Continue PROJ-02-01's discipline of awaiting every step of the open sequence.
4. **Snapshot exclusion from PROJ-02-03 is a hard invariant.** Any slice that touches snapshot collection (C.2, C.3, D.2) must restate that `.git/` cannot enter a snapshot.
5. **Snapshot persistence from PROJ-01-21 is a hard invariant.** Any slice that touches storage (C.3 in particular) must not move data off the named volume without an explicit migration sub-slice.
6. **Each slice ships a minimal targeted test.** No phase is allowed to broaden its test scope into "let's also fix X in tests." That is what made the recovery wave feel long.
7. **Each phase has a "kill switch":** flipping `PROJECT_FIRST_UX=false` in env returns the product to today's behavior. We never lose this property.

---

## 5. Persistence / history rollout

The persistence work in Phase C is the highest-risk part of this plan because it sits on top of the now-finally-stable open/restore plumbing. Sequence below is designed to cause zero regressions to the working flow.

### 5.1 Step-by-step

1. **Read-only History first (C.1).** No new writes. The History tab is purely a presentational layer over the existing snapshot list. If C.1 introduces any regression, it is local to the History tab and cannot affect open/restore.
2. **Restore is the second writer to land — but it reuses the existing path.** History's Restore action calls the same project-open-with-snapshot endpoint. No new restore code path is introduced in C.1.
3. **Autosave triggers next (C.2), with a per-minute snapshot safety net.** This is the first slice that introduces *new* writes. The safety net is the regression brake: even if a trigger ladder bug fires too often, snapshots are bounded.
4. **Retention/compaction (C.3) lands only after autosave (C.2) has been observed in real use.** Compaction touches durable storage; we want a representative real workload before flipping it on. Until C.3 ships, autosave will accumulate; that is acceptable for the cooldown window.
5. **Vocabulary cleanup (C.4) is purely cosmetic and ships last.** No data path touched.

### 5.2 Backwards compatibility

- Existing snapshots created before C.2 must continue to appear in History rows (they already do — they are project-scoped).
- Existing snapshots that *do* contain `.git/*` (legacy, pre-PROJ-02-03) continue to be tolerated by restore (PROJ-02-03 invariant) and are not retroactively rewritten.
- Existing project-open API contracts are unchanged.
- Existing session/project/auth schemas are unchanged.

### 5.3 What the user sees during the transition

- Flag off: today's experience exactly.
- Flag on, post-Phase A: same behavior, new vocabulary, new IA.
- Flag on, post-Phase B: reliable Open/New always lands in a fresh session; "Reopen project" is the recovery primitive.
- Flag on, post-Phase C: a History timeline replaces the snapshot mental model; autosave just works.
- Flag on, post-Phase D: Gallery and Share are first-class destinations.
- Flag on, post-Phase E: operators have inspect+restore power.

At no point does a normal user need to learn anything new about sessions or snapshots.

---

## 6. Internal recovery UI rollout

### 6.1 Timing

Phase E should happen *after* Phase D, not in parallel. Reasons:

- Phase B and C significantly reshape what an operator would inspect; building the operator surface against the redesigned model is cheaper and more accurate than building it twice.
- Phase D is when the public surface lights up; observability of operator concerns sharpens after the public surface is alive.
- Operator console requires a real auth gate (Slice E.4) which we deliberately do *not* want to be the first auth change of the whole rollout — we want it to be done in isolation.

### 6.2 Minimum viable recovery tools (the order to ship them in)

1. **Search** (E.1). Read-only. The single most useful operator tool: "given a user email, where are their things?"
2. **Detail views with integrity checks** (E.2). Confirms a snapshot is present, sized, intact, and free of `.git/` leaks (PROJ-02-03 cross-check). Detects "the symptom user X is reporting".
3. **Force-restore** (E.3). The single most useful *recovery* primitive: drop the user back into a working workspace from any historic snapshot.
4. **Real auth** (E.4). Lock the console down before any wider availability.

### 6.3 What can wait

- Destructive operator actions (E.5). Even when needed, they should land after E.4's auth scheme is real.
- Bulk operations (export many users' data, mass-snapshot-prune). Out of scope.
- Operator-side telemetry dashboards. Out of scope.
- A separate operator domain / sub-domain. Out of scope; the route gate is enough for v1.

---

## 7. Future features — where they hook in without implementing now

| Future feature                | IA slot reserved by                                                  | Phase that *must* exist first |
|-------------------------------|-----------------------------------------------------------------------|-------------------------------|
| AI-to-AI collaboration        | Workspace Chat surface keeps a "participants" abstraction (design Section 7.1). No code change in PROJ-03-A through E. Multi-participant rendering is the future slice's problem, not ours. | Phase B (so workspace lifecycle is deterministic) |
| Multi-agent workflows         | Workspace right-rail has History; design Section 7.2 reserves a "Plan" slot next to it. No build-out now. | Phase C |
| Richer project dashboards     | Projects page is built as a sortable card list with status-badge slots (design Section 7.3). Adding columns is purely additive. | Phase A |
| Advanced orchestration        | Workspace abstraction (design Section 7.4) hides the underlying session model. New orchestrations swap in behind the same abstraction. | Phase B |
| Cross-project search          | Operator console search (E.1) prefigures the data shape needed; a future user-facing search can reuse the same indexes. | Phase E.1 |
| Conversation persistence/export | Already partially planned in AI-04 family. No PROJ-03 phase blocks it. | Independent of this plan. |

The deliberate property of this plan: nothing here forces a redesign for the future features above.

---

## 8. Risks and tradeoffs

### 8.1 Hydration / state regressions (HIGH)

- Phase B is the highest-risk phase because it touches the open/restore handler that PROJ-02 stabilized.
- Mitigation:
  - every B-slice must restate and respect PROJ-02-01's deterministic hydration contract,
  - no fire-and-forget added to the open path,
  - the `projectOpenInProgressRef` discipline is preserved,
  - every B-slice ships behind the flag with a kill-switch path,
  - B.1 and B.2 are *separate* slices to keep change diffs small.

### 8.2 Persistence regressions (HIGH for Phase C, otherwise low)

- C.2 (autosave triggers) and C.3 (compaction) write to durable storage.
- Mitigation:
  - per-minute snapshot safety net in C.2,
  - never compact named saves,
  - never reduce below one snapshot per project,
  - PROJ-01-21 named volume is hard invariant,
  - PROJ-02-03 git-exclusion is hard invariant,
  - C.3 lands only after a cooldown of C.2 in use.

### 8.3 Preview breakage (LOW–MEDIUM)

- Auto-fresh-session on Open (B.2) means more preview cold-starts. PREV-01/02 work has made this reliable for static HTML, but newly created sessions still need preview start.
- Mitigation:
  - keep the existing PREV-01 start-preview UX intact during this rollout,
  - autosnapshot on preview start (already in C.2 trigger ladder) so a successful preview implies a recovery point.

### 8.4 User confusion during migration (MEDIUM)

- Vocabulary change ("snapshot" → "history", "session" → hidden) risks confusing users who learned the old model.
- Mitigation:
  - flag-gated rollout,
  - preserve all existing surfaces under flag-off mode for the duration of Phases A–D,
  - "snapshot" stays internally and inside Advanced,
  - never auto-cut over without an explicit decision per phase.

### 8.5 Admin / recovery scope creep (MEDIUM)

- The operator console is appealing; it is easy to keep adding "just one more" capability.
- Mitigation:
  - explicit ordering (E.1 → E.2 → E.3 → E.4 → E.5),
  - destructive actions deferred until last,
  - bulk operations explicitly out of scope.

### 8.6 Auth scope creep (MEDIUM)

- Until Slice E.4 is built, the operator route is dev-only. There is a temptation to "just add a quick admin guard".
- Mitigation: hard rule — no auth changes outside E.4. Until then, the operator route is not deployed publicly.

### 8.7 IA churn risk (LOW)

- We are adding several top-level routes (Home, Projects, Gallery, Account). Naming churn is possible.
- Mitigation: the design (Section 8) already locked recommended labels; this plan reuses them. The copy bundle from Phase 0 keeps strings centrally addressable so a label change is one-file.

---

## 9. Recommended immediate next phase

### 9.1 Best first phase to implement

**Phase 0 + Phase A.** Together they constitute the safest possible first step: they introduce the feature flag and copy infrastructure (Phase 0) and then the new IA shell (Phase A) without changing any behavior. Every slice in this combined first phase is independently revertible by flipping `PROJECT_FIRST_UX=false` in env.

If we had to pick a single phase, **Phase A** with Phase 0 absorbed into it as a prerequisite slice.

### 9.2 Best first 1–3 slices to start with

In order:

1. **PROJ-03-A0 — Add Feature Flag Infrastructure And Recovery Vocabulary Copy Bundle.** Pure scaffolding. Frontend only. No behavior change. Smallest possible diff. Sets up everything else.
2. **PROJ-03-A1 — Add Project-First Top-Level Routes And Labels Behind Feature Flag.** First user-visible slice (only behind the flag). New routes, new nav, but every page still wraps existing functionality. No behavior change with flag off.
3. **PROJ-03-A3 — Replace Raw Session Lifecycle Strings With Recovery Vocabulary.** First copy cleanup. Wraps existing handlers. Sets the tone for Phase B's recovery work without committing to the lifecycle changes yet.

### 9.3 What not to start yet

- Anything in Phase B (auto-fresh-session). Wait until Phase A is observed clean. Phase B touches the open/restore path that we just spent six PROJ-02 fixes stabilizing; do not move on it until A is mature.
- Anything in Phase C (history/autosave). It depends on B.
- Anything in Phase D (share/gallery). It depends on C-2 (background snapshot on publish).
- Anything in Phase E (operator console). It depends on D.
- Slice A.2 (hide sessions from nav, move stop-session to Advanced) before A.0/A.1/A.3 are in. Do A.2 *after* the copy bundle and routes exist, so the demoted UI has a coherent destination.
- Any auth work outside Slice E.4. Hard rule.

### 9.4 Definition of "Phase A done"

Phase A is considered complete (and the gate to start Phase B) when all of the following are true:

- All A-slices are merged behind `PROJECT_FIRST_UX`.
- With the flag off, the product is byte-equivalent in user-visible behavior to today's.
- With the flag on, the new IA renders without console errors and with no broken links.
- The existing test suites still pass with no new flakes.
- A short manual smoke pass (open a project, write a file, run preview, stop a session via Advanced) is recorded in the slice's checkpoint.
- No new effect was added to `page.tsx` without a written interaction note vs `projectOpenInProgressRef`.

---

## 10. Out-of-scope reaffirmation

This document does not:

- change any code,
- change any task-status fields,
- register any new implementation tasks,
- change any backend API contract,
- change any frontend component,
- propose any change to internal-only endpoints (`CLAUDE.md`-locked),
- propose any change to billing, quotas, kill switches, plan tiers, or auth flows except inside Slice E.4 which is deliberately deferred,
- propose any change to PROJ-01-21 snapshot persistence behavior (hard invariant),
- propose any change to PROJ-02-01 deterministic project-open hydration (hard invariant),
- propose any change to PROJ-02-03 git-internals exclusion (hard invariant),
- change `PROJ-03-01-DESIGN.md` (it remains the source of truth for *what* we are building).

PROJ-03-01 planning is complete when this document is reviewed and accepted as the basis for slicing the future implementation tasks (PROJ-03-A0 through PROJ-03-E5) when explicitly authorized.
