# Spec: ADV-05-01 — Public Sharing and Community Layer

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | ADV-05-01 |
| **Title** | Public Sharing and Community Layer |
| **Status** | Draft |
| **Master plan alignment** | Section 7.6 ADV-05, Phase 6 |
| **Related task IDs** | None yet registered |
| **Depends on** | PR-01-01 (project save), PR-03-01 (project identity), Core Phases 1–5 complete |
| **Enables** | Project sharing, community templates, discovery |

---

## 2. Problem

Users cannot share their projects publicly or discover other users' projects. The platform is entirely private per-user.

---

## 3. Why This Matters

The master plan Section 7.6 lists this as a future expansion. Public sharing enables community growth, project templates, and showcase of AI-built projects.

---

## 4. Goal

Allow users to optionally share projects publicly and browse/fork shared projects.

---

## 5. Non-Goals

- No collaborative real-time editing
- No social features (likes, comments, follows)
- No marketplace/monetization
- No project ranking/recommendation engine
- Must not displace core Phases 1–5 work

---

## 6. Existing Relevant Completed Work to Preserve

- Project identity (PR-03-01 dependency)
- Project save/restore (PR-01-01 dependency)
- Session isolation
- Auth model

---

## 7. Scope

1. Project visibility toggle: private (default) or public
2. Public project listing/browse page
3. Fork: copy a public project into user's own project list
4. Public project view: read-only preview of files and README

---

## 8. Functional Requirements

1. User can mark a project as public or private
2. Public projects are listed on a browse page
3. Any authenticated user can fork a public project
4. Public projects have a read-only view (files, README)
5. Public project URLs are shareable

---

## 9. UX Requirements

1. Privacy toggle on project settings
2. Browse/explore page for public projects
3. Fork button on public project view
4. Clear distinction between own projects and forked projects

---

## 10. Backend Requirements

1. Project `visibility` field (private/public)
2. Public project list endpoint (unauthenticated or authenticated)
3. Fork endpoint: copies project state into user's project list
4. Public project detail endpoint (read-only)

---

## 11. Frontend Requirements

1. Privacy toggle in project settings
2. Public project browse page
3. Public project detail page (read-only file view)
4. Fork button and flow

---

## 12. Data/State Expectations

- Project entity extended with `visibility` field
- Fork creates a new project linked to source (optional: source_project_id)
- No shared mutable state between original and fork

---

## 13. Error Handling Requirements

1. Fork of non-existent project → 404
2. Fork of private project by non-owner → 403
3. Visibility change failure → clear error

---

## 14. Acceptance Criteria

- [ ] User can make a project public
- [ ] Public projects appear on browse page
- [ ] Users can fork a public project
- [ ] Public project view is read-only
- [ ] Private projects remain invisible to other users
- [ ] Core workspace behavior preserved

---

## 15. Invariants to Preserve

- Private-by-default project visibility
- Session isolation (forking creates a new project, not shared session)
- Auth enforcement
- Project ownership

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| PR-01-01 | Planned | Project save for forking |
| PR-03-01 | Planned | Project identity for visibility |
| Core Phases 1–5 | Partially complete | Stable platform |

---

## 17. Risks / Edge Cases

- Public project content moderation
- Large projects may be expensive to fork
- Public project URLs must be stable (project identity prerequisite)
- Copyright/license considerations for shared projects

---

## 18. Suggested Implementation Slices

1. **Backend: Visibility field and public list** — Migration, public list endpoint.
2. **Backend: Fork endpoint** — Copy project state for authenticated user.
3. **Frontend: Browse page** — Public project listing.
4. **Frontend: Public project view** — Read-only file/README view.
5. **Frontend: Privacy toggle** — Project settings.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Social features (likes, comments, follows)
- Project templates/marketplace
- Monetization of shared projects
- Collaborative editing
- Project search/ranking
