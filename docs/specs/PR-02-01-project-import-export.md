# Spec: PR-02-01 — Project Import and Export

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | PR-02-01 |
| **Title** | Project Import and Export |
| **Status** | Draft |
| **Master plan alignment** | Section 7.4 PR-02, Phase 4 |
| **Related task IDs** | None yet registered |
| **Depends on** | PR-01-01 (Project Save/Restore) |
| **Enables** | User portability, local backup, external project onboarding |

---

## 2. Problem

Users cannot download their work from the platform or bring external projects into it. There is no portability.

---

## 3. Why This Matters

The master plan Section 7.4 lists import/export as core. Portability prevents lock-in, enables local backups, and lets users bring existing code into the AI workspace.

---

## 4. Goal

Allow users to download their workspace as an archive and upload/import projects into a workspace session.

---

## 5. Non-Goals

- No GitHub/GitLab integration
- No CI/CD pipeline integration
- No partial/selective import
- No real-time sync with external repositories
- No binary/media-heavy project handling beyond basic files

---

## 6. Existing Relevant Completed Work to Preserve

- File tree, editor, preview behavior
- Session lifecycle
- Checkpoint/history model
- PR-01-01 save/restore (dependency)

---

## 7. Scope

1. Export: download workspace files as a zip/tar archive
2. Import: upload a zip/tar archive and populate workspace files in the active session
3. Optional: git-preserving export (include `.git` directory)

---

## 8. Functional Requirements

1. Export produces a downloadable archive of workspace files
2. Import accepts an archive and extracts files into the session workspace
3. Import must validate archive contents (no path traversal, reasonable size)
4. Export/import scoped to active session only
5. Auth/ownership enforced

---

## 9. UX Requirements

1. "Download Project" button in workspace
2. "Import Project" button/action in workspace (file upload)
3. Progress indication for large archives
4. Clear error messages for invalid archives

---

## 10. Backend Requirements

1. Export endpoint: stream workspace files as archive from container-manager
2. Import endpoint: accept archive upload, extract into session workspace
3. Size limits and validation on import
4. Auth/session ownership checks

---

## 11. Frontend Requirements

1. Download trigger (browser download from export endpoint)
2. File upload UI for import
3. Import/export state feedback

---

## 12. Data/State Expectations

- Archive format: zip (most portable) or tar.gz
- File paths relative to workspace root
- No special metadata required in archive for basic import/export

---

## 13. Error Handling Requirements

1. Invalid archive format → clear error
2. Archive too large → clear error with limit info
3. Path traversal attempt → reject import
4. Session terminated during import → graceful failure

---

## 14. Acceptance Criteria

- [ ] User can download workspace as archive
- [ ] User can upload archive into workspace session
- [ ] Imported files appear in file tree and editor
- [ ] Invalid archives are rejected with clear errors
- [ ] Existing workspace behavior preserved

---

## 15. Invariants to Preserve

- Session isolation
- Auth/ownership enforcement
- File tree/editor/preview state machines
- No background workers

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| PR-01-01 | Planned | Shared storage/archive infrastructure |
| File system endpoints | Complete | Reading/writing workspace files |

---

## 17. Risks / Edge Cases

- Very large projects may need streaming download/upload
- Conflicting files on import needs clear overwrite semantics
- Hidden files (`.git`, `.env`) need handling decisions

---

## 18. Suggested Implementation Slices

1. **Backend: Export endpoint** — Stream workspace as zip archive.
2. **Backend: Import endpoint** — Accept zip upload, extract into workspace.
3. **Frontend: Download/upload UI** — Buttons and progress feedback.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Git clone from URL
- GitHub integration
- Selective file export
- Archive format conversion
