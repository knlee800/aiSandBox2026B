# Spec: CO-01-01 — Quota and Usage UX Alignment

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | CO-01-01 |
| **Title** | Quota and Usage UX Alignment |
| **Status** | Draft |
| **Master plan alignment** | Section 7.5 CO-01, Phase 5 |
| **Related task IDs** | None yet registered |
| **Depends on** | AI-03-01/02 (core loop working), CO-01 backend (partially complete) |
| **Enables** | CO-02-01 (Billing and Plans) |

---

## 2. Problem

Backend quota enforcement exists (rate limiting, token usage tracking), but frontend-visible quota messaging is inconsistent with backend enforcement. Users may not understand their limits or why requests are rejected.

---

## 3. Why This Matters

The master plan Section 5.1E requires "user-visible quota messaging" and "backend/frontend consistency." Clear quota visibility is essential for safe commercial operation.

---

## 4. Goal

Ensure frontend quota/usage display is consistent with backend enforcement and clearly communicates limits to users.

---

## 5. Non-Goals

- No advanced analytics dashboard
- No admin-only quota management (that is CO-03-01)
- No billing integration (that is CO-02-01)
- No quota redesign — align what exists

---

## 6. Existing Relevant Completed Work to Preserve

- Phase 41A/B/C rate limiting and metrics
- Phase 84C quota error clarity in chat panel
- Backend token-usage and usage-record entities
- Backend quota evaluation endpoints in container-manager

---

## 7. Scope

1. Display current usage/quota status in workspace UI
2. Ensure rate-limit rejections (429) show clear user-facing messages
3. Ensure quota exhaustion shows clear user-facing messages
4. Ensure backend enforcement and frontend display use consistent data

---

## 8. Functional Requirements

1. Workspace UI shows remaining quota/usage indicator
2. Rate-limit rejection messages include retry timing
3. Quota exhaustion messages explain what limit was hit
4. Usage data is fetched from backend (not invented on frontend)

---

## 9. UX Requirements

1. Quota/usage indicator visible in workspace (header or sidebar)
2. Clear, non-technical language for limit messages
3. No surprise rejections without explanation

---

## 10. Backend Requirements

1. Endpoint to retrieve current usage/quota status for user/session
2. Consistent quota data between enforcement and display endpoints
3. Rate-limit responses include Retry-After header (already implemented in Phase 41B)

---

## 11. Frontend Requirements

1. Quota/usage display component in workspace
2. Error message mapping for 429 and quota-exhaustion responses
3. On-demand usage refresh only — strictly request-driven (e.g., on page load, on user action, after AI execution); no periodic polling or timer-based refresh

---

## 12. Data/State Expectations

- Usage data: token count, session count, rate-limit status
- Quota limits: defined per user/plan
- Display data fetched from backend, not computed on frontend

---

## 13. Error Handling Requirements

1. If usage endpoint fails → show "usage unavailable" rather than stale data
2. Rate-limit errors → existing Phase 84C error clarity patterns

---

## 14. Acceptance Criteria

- [ ] User sees current quota/usage status in workspace
- [ ] Rate-limit rejections show clear messages with retry guidance
- [ ] Quota exhaustion shows clear explanation
- [ ] Backend and frontend quota data are consistent
- [ ] Existing workspace behavior preserved

---

## 15. Invariants to Preserve

- Existing rate-limit enforcement (Phase 41B)
- Existing quota error clarity (Phase 84C)
- Request-driven behavior only

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| Phase 41A/B/C | Complete | Rate limiting infrastructure |
| Phase 84C | Complete | Quota error clarity baseline |
| Backend quota endpoints | Partially complete | Usage data source |

---

## 17. Risks / Edge Cases

- Quota data may be slightly stale between display refresh and actual enforcement
- Multiple quota dimensions (tokens, sessions, requests) need clear presentation

---

## 18. Suggested Implementation Slices

1. **Backend: Usage/quota status endpoint** — Consolidate current usage into one queryable endpoint.
2. **Frontend: Quota display component** — Show usage in workspace UI.
3. **Frontend: Error message alignment** — Ensure all quota/rate-limit errors are clear.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Usage history/trends
- Quota upgrade prompts
- Admin quota management
