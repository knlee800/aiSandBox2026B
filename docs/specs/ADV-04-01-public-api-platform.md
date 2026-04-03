# Spec: ADV-04-01 — Public API Platform and Ecosystem

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | ADV-04-01 |
| **Title** | Public API Platform and Ecosystem |
| **Status** | Draft |
| **Master plan alignment** | Section 7.6 ADV-04, Phase 6 |
| **Related task IDs** | None yet registered |
| **Depends on** | Core Phases 1–5 complete, CO-04 (API key management) |
| **Enables** | Third-party integrations, developer ecosystem, automation |

---

## 2. Problem

The platform's APIs are internal-facing. External developers and tools cannot programmatically interact with the platform to create sessions, execute AI prompts, or manage projects.

---

## 3. Why This Matters

The master plan Section 7.6 lists this as a future expansion. A public API enables third-party integrations, CI/CD workflows, and developer ecosystem growth.

---

## 4. Goal

Expose a stable, documented public API that third parties can use to programmatically interact with the platform.

---

## 5. Non-Goals

- No GraphQL (REST only for initial public API)
- No SDK development
- No webhook system
- No marketplace for integrations
- Must not displace core Phases 1–5 work
- Must NOT expose, wrap, or proxy internal-only API routes — internal APIs remain internal per ARCHITECTURE and CLAUDE.md

---

## 6. Existing Relevant Completed Work to Preserve

- Internal API design (ARCHITECTURE Section 8)
- API key management (CO-04)
- Session lifecycle endpoints
- AI execution endpoints

---

## 7. Scope

1. Public API specification (OpenAPI/Swagger)
2. Stable versioned endpoints for: session management, AI execution, file operations, project management
3. API key authentication for external access
4. Rate limiting for public API access
5. API documentation

---

## 8. Functional Requirements

1. Public API endpoints mirror core functionality (sessions, AI, files, projects)
2. API key authentication required for all public API calls
3. Rate limiting per API key
4. Versioned API paths (e.g., `/api/v1/...`)
5. OpenAPI specification generated from endpoint definitions

---

## 9. UX Requirements

1. API documentation page accessible to developers
2. API key management in user account settings (existing CO-04)
3. Clear error responses with machine-readable codes

---

## 10. Backend Requirements

1. Public API controllers — must be a separate public surface with its own controllers and route paths; must NOT wrap, proxy, or expose internal-only controllers or routes (per ARCHITECTURE and CLAUDE.md constraints)
2. API key auth guard for public endpoints
3. Rate limiting per API key (distinct from per-IP)
4. OpenAPI/Swagger generation
5. API versioning strategy

---

## 11. Frontend Requirements

1. API documentation page (static or auto-generated)
2. API key management UI (existing or enhanced)

---

## 12. Data/State Expectations

- API keys linked to users
- Rate-limit counters per API key
- No new entities beyond API key (already exists)

---

## 13. Error Handling Requirements

1. Invalid API key → 401
2. Rate limit exceeded → 429 with Retry-After
3. Standard HTTP error codes with JSON error bodies

---

## 14. Acceptance Criteria

- [ ] Public API endpoints are accessible with API key auth
- [ ] API documentation is available
- [ ] Rate limiting works per API key
- [ ] Core functionality accessible via public API (sessions, AI, files)
- [ ] Internal APIs remain separate and unexposed
- [ ] Core workspace behavior preserved

---

## 15. Invariants to Preserve

- Internal API separation (CLAUDE.md restrictions)
- Session isolation
- Auth enforcement
- Service boundaries

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| Core Phases 1–5 | Partially complete | Stable platform |
| CO-04 API key management | Complete | Authentication |
| Rate limiting | Complete | Abuse prevention |

---

## 17. Risks / Edge Cases

- Public API stability commitment requires careful versioning
- Breaking changes to internal APIs must not break public API
- Abuse potential higher with programmatic access

---

## 18. Suggested Implementation Slices

1. **Backend: Public API controllers** — Create new versioned public controllers that call shared service-layer logic; must NOT wrap or re-expose internal controllers or internal-only routes.
2. **Backend: API key auth guard** — Dedicated guard for public API.
3. **Documentation: OpenAPI spec** — Auto-generate or write API docs.
4. **Rate limiting: Per-API-key** — Extend existing rate limiting.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- SDKs (Python, Node, etc.)
- Webhooks
- Integration marketplace
- GraphQL endpoint
