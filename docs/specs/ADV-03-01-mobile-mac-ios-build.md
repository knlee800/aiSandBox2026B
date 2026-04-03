# Spec: ADV-03-01 — Mobile / Mac / iOS Build Support

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | ADV-03-01 |
| **Title** | Mobile / Mac / iOS Build Support |
| **Status** | Draft |
| **Master plan alignment** | Section 7.6 ADV-03, Phase 6 |
| **Related task IDs** | None yet registered |
| **Depends on** | Core Phases 1–5 complete |
| **Enables** | Mobile app development within the platform |

---

## 2. Problem

The current sandbox runtime is Linux/Docker-based and cannot build or preview iOS/Mac applications. Mobile developers cannot use the platform for native mobile work.

---

## 3. Why This Matters

The master plan Section 7.6 lists this as a future expansion. Mobile/iOS build support would expand the platform's addressable market to mobile developers.

---

## 4. Goal

Add build and preview capabilities for mobile/iOS/Mac applications within the platform.

---

## 5. Non-Goals

- No replacement of the web-focused workspace
- No native IDE features (Xcode integration)
- No Android emulator investment in this spec
- Must not displace core Phases 1–5 work

---

## 6. Existing Relevant Completed Work to Preserve

- Container isolation model
- Session lifecycle
- File system operations
- Preview architecture

---

## 7. Scope

1. Mac build agent integration (remote macOS build server)
2. iOS simulator or preview mechanism for mobile apps
3. Build output accessible in workspace
4. Preview of mobile app output in workspace UI

---

## 8. Functional Requirements

1. User can trigger a mobile build from workspace
2. Build executes on a Mac build agent (remote)
3. Build output (artifacts, logs) is accessible in workspace
4. Preview of built app is available (simulator screenshot/stream or web-based preview)

---

## 9. UX Requirements

1. "Build for iOS/Mac" action in workspace
2. Build progress and log visibility
3. Preview/screenshot of built app
4. Clear error messages for build failures

---

## 10. Backend Requirements

1. Mac build agent integration (remote API or SSH-based)
2. Build job queue and status tracking
3. Artifact storage and retrieval
4. Preview generation from build output

---

## 11. Frontend Requirements

1. Build trigger UI
2. Build log/progress display
3. Mobile preview surface in workspace

---

## 12. Data/State Expectations

- Build jobs: session-scoped, status-tracked
- Artifacts: temporary storage, session-scoped
- Build agent: external resource, not part of session container

---

## 13. Error Handling Requirements

1. Build agent unavailable → clear error, no silent failure
2. Build failure → show build logs with error context
3. Artifact retrieval failure → clear error

---

## 14. Acceptance Criteria

- [ ] User can trigger a mobile/iOS build from workspace
- [ ] Build executes on remote Mac agent
- [ ] Build output is accessible in workspace
- [ ] Build failures show clear error and logs
- [ ] Core web-focused workspace behavior preserved

---

## 15. Invariants to Preserve

- Web-focused workspace as primary experience
- Session isolation
- Auth/quota enforcement

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| Core Phases 1–5 | Partially complete | Stable platform before expansion |
| Mac build agent infrastructure | Not available | Remote build capability |

---

## 17. Risks / Edge Cases

- Mac build agents are expensive infrastructure
- Build times for iOS apps are long
- Xcode version management adds complexity
- Provisioning profiles and code signing are complex

---

## 18. Suggested Implementation Slices

1. **Infrastructure: Mac build agent setup** — Remote macOS build server.
2. **Backend: Build job API** — Trigger, status, artifacts.
3. **Frontend: Build UI** — Trigger, progress, preview.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Android emulator support
- App Store submission automation
- Device farm testing
- CI/CD pipeline integration
