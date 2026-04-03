# Spec: CO-03-01 — Admin and Operational Completeness

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | CO-03-01 |
| **Title** | Admin and Operational Completeness |
| **Status** | Draft |
| **Master plan alignment** | Section 7.5 CO-03, Phase 5 |
| **Related task IDs** | None yet registered |
| **Depends on** | CO-01-01 (Quota UX), CO-02-01 (Billing) |
| **Enables** | Safe public/beta operation, user support |

---

## 2. Problem

Admin controllers and runtime metrics exist but admin dashboard, user diagnostics, and customer-safe operational controls are incomplete. Operators cannot effectively support users or diagnose issues.

---

## 3. Why This Matters

The master plan Phase 5 requires "admins can diagnose/support users" and "operational visibility is good enough for public/beta service."

---

## 4. Goal

Complete admin tooling and observability to the level required for safe public/beta operation.

---

## 5. Non-Goals

- No enterprise-grade analytics
- No broad partner ecosystem tools
- No customer-facing admin self-service beyond basic needs
- No real-time alerting system (existing Prometheus/Grafana is sufficient)

---

## 6. Existing Relevant Completed Work to Preserve

- Phase 41A runtime metrics endpoint
- Backend admin controller and admin-dashboard controller
- Prometheus/Grafana monitoring stack
- Health/readiness endpoints

---

## 7. Scope

1. Admin dashboard: view users, sessions, usage summaries
2. User diagnostics: view session history, quota status, errors for a specific user
3. Session management: admin stop/terminate sessions
4. Operational alerts: ensure existing Prometheus/Grafana stack has meaningful alerts
5. Log visibility: ensure structured logging covers key operational events

---

## 8. Functional Requirements

1. Admin can view user list with activity summary
2. Admin can view sessions for a specific user
3. Admin can terminate a session on behalf of a user
4. Admin can view quota/usage for a specific user
5. Admin actions require admin auth

---

## 9. UX Requirements

1. Admin dashboard accessible via admin route
2. User search/filter
3. Session detail view with status and actions
4. Clear confirmation for destructive actions (terminate session)

---

## 10. Backend Requirements

1. Admin endpoints for user list, session list, user detail, session terminate
2. Admin auth guard (role-based or separate admin auth)
3. Structured logging for admin actions (audit trail)

---

## 11. Frontend Requirements

1. Admin dashboard page(s)
2. User list, session list, user detail components
3. Admin action buttons with confirmation

---

## 12. Data/State Expectations

- Uses existing user, session, usage entities
- Admin role or flag on user entity (may already exist)
- No new entities required for basic admin

---

## 13. Error Handling Requirements

1. Unauthorized admin access → 401/403
2. Admin action on non-existent resource → 404
3. Admin action failure → clear error, no silent failure

---

## 14. Acceptance Criteria

- [ ] Admin can view users and sessions
- [ ] Admin can diagnose user issues (view quota, sessions, errors)
- [ ] Admin can terminate sessions
- [ ] Admin actions require admin auth
- [ ] Operational visibility sufficient for beta service
- [ ] Existing product behavior preserved

---

## 15. Invariants to Preserve

- Session lifecycle (admin terminate uses same termination semantics)
- Auth enforcement
- Existing monitoring stack

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| Backend admin controllers | Exist | Admin endpoint foundation |
| Phase 41A metrics | Complete | Operational data |
| CO-01-01, CO-02-01 | Planned | Quota/billing data to display |

---

## 17. Risks / Edge Cases

- Admin auth must be distinct from regular user auth
- Admin actions on active sessions must respect container lifecycle
- Audit trail for admin actions is important for trust

---

## 18. Suggested Implementation Slices

1. **Backend: Admin user/session endpoints** — List users, list sessions, user detail.
2. **Backend: Admin session terminate** — Admin-authorized session termination.
3. **Frontend: Admin dashboard** — User list, session list, detail views.
4. **Observability: Alert rules** — Meaningful Prometheus alert rules.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Customer-facing admin self-service
- Advanced analytics/reporting
- Automated incident response
- Multi-admin roles/permissions
