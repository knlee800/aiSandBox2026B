# Spec Breakdown Index — AI Sandbox Platform

**Status:** Draft
**Purpose:** Master index of all product specs for unfinished and future work, derived from the revised master plan.
**Authority source:** `AI_Sandbox_Platform_Master_Plan_Revised.md`

---

## Purpose of This Spec Set

This spec breakdown converts the unfinished and future work identified in the revised master plan into bounded, implementation-ready specifications. Each spec defines a clear problem, scope, acceptance criteria, and preservation requirements.

These specs are planning artifacts. They do not imply implementation has started. Implementation must still follow the governance loop: specs → task registration in `TASKS.md` and `TASKS_BACKLOG_FULL.md` → implementation → checkpoints.

---

## Authority Order

When implementing any spec, follow this authority order:

1. `AI_Sandbox_Platform_Master_Plan_Revised.md` — product direction
2. `PRD.md` — product requirements
3. `ARCHITECTURE.md` — system architecture
4. `TASKS_BACKLOG_FULL.md` — task scope
5. `TASKS.md` — active work
6. Relevant completed checkpoints in `docs/`

---

## Current Completed Work to Preserve

All specs must preserve the following completed and working capabilities:

| Capability | Source Phases |
|-----------|-------------|
| Chat panel prompt/response/thread/persistence/auth-gate | Phase 84 (84A–84G) |
| Preview panel (loading/ready/unavailable/error, refresh) | Phase 79A |
| File tree, file selection, content display | Phase 79B |
| Editor save (clean/dirty/saving/saved/save-error) | Phase 80A |
| Manual checkpoint creation ("Save Point") | Phase 80B |
| Manual revert with confirmation | Phase 80C |
| History/control surface (diff, compare, timeline, etc.) | Phase 81–82 |
| Exec interaction panel | Phase 78 |
| Session lifecycle (create/select/stop/remove) | Various |
| Auth gating for workspace route | Phase 84G |
| Rate limiting and quota enforcement | Phase 41A/B/C |
| Runtime metrics and health checks | Phase 41A |

---

## Spec Families and Sequence

### Group 1: Unfinished Core — AI Workspace Loop (Highest Priority)

These specs close the central product gap: AI modifying the workspace.

| Spec ID | Title | File | Status |
|---------|-------|------|--------|
| AI-03-01 | AI-to-Workspace File Actions | `AI-03-01-ai-to-workspace-file-actions.md` | Draft |
| AI-03-02 | Post-AI-Action Workspace Coherence | `AI-03-02-post-ai-workspace-coherence.md` | Draft |
| AI-04-01 | Backend Chat Persistence Wiring | `AI-04-01-backend-chat-persistence.md` | Draft |

**AI-03-01** is the single most important spec. It enables the minimal AI file-action path: user asks AI → AI writes/creates/updates files in the workspace → user sees confirmation in chat. It owns the structured file-action output, file application, and chat-visible result payload. It does NOT own broader workspace surface refresh (file tree, editor, preview, checkpoint). Without it, the platform is a chat window, not an AI coding workspace.

**AI-03-02** owns all post-action workspace coherence: file tree refresh, editor reload, preview refresh, auto-checkpoint creation, and checkpoint list refresh after AI changes files. It consumes the result payload produced by AI-03-01. It makes the AI-first loop feel complete and trustworthy.

**AI-04-01** moves chat persistence from fragile localStorage to the backend, ensuring chat history survives across devices and browser data clearing. Can proceed in parallel with AI-03-01 since it depends only on Phase 84 chat baseline.

### Group 2: Project Persistence (High Priority)

These specs ensure user work outlives session lifetime.

| Spec ID | Title | File | Status |
|---------|-------|------|--------|
| PR-01-01 | Project Save and Restore | `PR-01-01-project-save-restore.md` | Draft |
| PR-02-01 | Project Import and Export | `PR-02-01-project-import-export.md` | Draft |
| PR-03-01 | Project Identity | `PR-03-01-project-identity.md` | Draft |

**PR-01-01** prevents work loss on session expiry — users can save and later restore their workspace as a files-only snapshot. This spec explicitly does not introduce a project entity.

**PR-02-01** adds portability — users can download and upload projects as archives.

**PR-03-01** introduces a persistent project entity on top of PR-01-01, giving users a stable named handle for their work across sessions. PR-03-01 must come after PR-01-01 because it wraps the files-only persistence with identity.

### Group 3: Commercial / Operations (Medium Priority)

These specs prepare the platform for safe commercial operation.

| Spec ID | Title | File | Status |
|---------|-------|------|--------|
| CO-01-01 | Quota and Usage UX Alignment | `CO-01-01-quota-usage-ux.md` | Draft |
| CO-02-01 | Billing and Plans Foundation | `CO-02-01-billing-plans-foundation.md` | Draft |
| CO-03-01 | Admin and Operational Completeness | `CO-03-01-admin-operational.md` | Draft |

**CO-01-01** aligns frontend quota/usage display with backend enforcement so users understand their limits.

**CO-02-01** implements subscription/plan model with billing correctness sufficient for commercial operation.

**CO-03-01** completes admin tooling and observability for operator support and diagnostics.

### Group 4: Future / Optional Expansion (Lowest Priority)

These specs are later-phase expansions that must not displace Groups 1–3.

| Spec ID | Title | File | Status |
|---------|-------|------|--------|
| ADV-01-01 | Multi-AI Collaboration | `ADV-01-01-multi-ai-collaboration.md` | Draft |
| ADV-02-01 | Conversational Orchestrator | `ADV-02-01-conversational-orchestrator.md` | Draft |
| ADV-03-01 | Mobile / Mac / iOS Build Support | `ADV-03-01-mobile-mac-ios-build.md` | Draft |
| ADV-04-01 | Public API Platform and Ecosystem | `ADV-04-01-public-api-platform.md` | Draft |
| ADV-05-01 | Public Sharing and Community Layer | `ADV-05-01-public-sharing-community.md` | Draft |

**ADV-01-01** allows multiple AI models to contribute to the same workspace session.

**ADV-02-01** introduces multi-step autonomous AI workflows with user control and step-level checkpoints. Depends on AI-03-01/02 and AI-04-01 only; ADV-01-01 (multi-AI) is an optional enhancement, not a hard prerequisite.

**ADV-03-01** adds iOS/Mac build capability via remote Mac build agents.

**ADV-04-01** exposes a stable, documented public API for third-party integrations. Public API must be a separate surface with its own controllers; it must not wrap or expose internal-only routes.

**ADV-05-01** enables public project sharing, browsing, and forking.

---

## Recommended Implementation Order

```
Phase 2 (Core AI Loop):
  1. AI-03-01 — AI-to-Workspace File Actions         ← NEXT (already registered)
  1b. AI-04-01 — Backend Chat Persistence Wiring      (can proceed in parallel with AI-03-01; depends only on Phase 84)
  2. AI-03-02 — Post-AI-Action Workspace Coherence    (depends on AI-03-01)

Phase 4 (Project Persistence):
  4. PR-01-01 — Project Save and Restore
  5. PR-02-01 — Project Import and Export
  6. PR-03-01 — Project Identity

Phase 5 (Commercial Readiness):
  7. CO-01-01 — Quota and Usage UX Alignment
  8. CO-02-01 — Billing and Plans Foundation
  9. CO-03-01 — Admin and Operational Completeness

Phase 6 (Optional Expansion — only after Phases 2–5 are stable):
  10. ADV-01-01 — Multi-AI Collaboration
  11. ADV-02-01 — Conversational Orchestrator
  12. ADV-04-01 — Public API Platform
  13. ADV-05-01 — Public Sharing and Community
  14. ADV-03-01 — Mobile / Mac / iOS Build Support
```

---

## Dependency Graph

```
Phase 84 (complete) ──→ AI-03-01 ──→ AI-03-02
                    ──→ AI-04-01 (parallel with AI-03-01)

AI-03-01 ──→ PR-01-01 (files-only) ──→ PR-02-01
                                    ──→ PR-03-01 (project entity) ──→ ADV-05-01

AI-03-01 ──→ CO-01-01 ──→ CO-02-01 ──→ CO-03-01

AI-03-01/02 + AI-04-01 ──→ ADV-02-01 (orchestrator; ADV-01-01 is optional enhancement)
                        ──→ ADV-01-01 (multi-AI)
                        ──→ ADV-04-01 (public API, separate surface)
                        ──→ ADV-03-01 (mobile/mac/iOS)
```

AI-03-01 is the root dependency for most downstream work. AI-04-01 can proceed in parallel with AI-03-01 since it depends only on the Phase 84 chat baseline.

---

## Important Governance Notes

1. **Specs do not imply completion status.** All specs in this index are Draft. No implementation has started unless a checkpoint exists.

2. **Implementation must be registered first.** Before any spec is implemented, the corresponding task must be registered in both `TASKS.md` and `TASKS_BACKLOG_FULL.md` per the governance loop in `CLAUDE.md`.

3. **Specs are subordinate to authority documents.** If any spec conflicts with the revised master plan, PRD, or ARCHITECTURE, the authority document wins.

4. **Future/optional specs (ADV-*) do not displace core work.** Nothing in Group 4 should be implemented until Groups 1–3 are stable and complete.

5. **Raw exec/terminal is secondary.** The product center is the AI-first workspace loop. Shell/exec surfaces exist as supporting tools and must not drive the roadmap.

---

## Spec File Naming Convention

```
{SPEC-ID}-{short-slug}.md
```

All spec files live in `docs/specs/`.

Examples:
- `AI-03-01-ai-to-workspace-file-actions.md`
- `PR-01-01-project-save-restore.md`
- `CO-02-01-billing-plans-foundation.md`
- `ADV-01-01-multi-ai-collaboration.md`
