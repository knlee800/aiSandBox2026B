# PRIVATE-BETA-STAGING-SETUP-03 — Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-SETUP-03
**Title:** Domain / DNS / TLS Plan for staging.ainow.biz
**Checkpoint created:** 2026-07-21
**Status:** COMPLETE and LOCKED — 2026-07-21 — All 3 steps COMPLETE

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP-03 |
| Title | Domain / DNS / TLS Plan for staging.ainow.biz |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | DOMAIN / DNS / TLS PLANNING — planning only — no DNS/TLS/server/Caddy changes |
| Risk | MEDIUM — planning only; all execution requires future Keith explicit approval |
| Registered | 2026-07-21 |
| Approved by | Keith — explicit approval recorded 2026-07-21 ("go") |
| Completed | 2026-07-21 |

---

## 2. Final Status

**COMPLETE and LOCKED — 2026-07-21 — All 3 steps COMPLETE.**

| Step | Status |
|------|--------|
| Step 1 — Registration | COMPLETE — 2026-07-21 |
| Step 2 — Domain / DNS / TLS Plan | COMPLETE — 2026-07-21 — Step 2 verdict: PASS |
| Step 3 — Consolidation / Handoff to SETUP-04 | COMPLETE — 2026-07-21 |

No DNS change occurred. No TLS certificate was requested. No Caddy install/config occurred. No AWS/server/static IP/firewall/SSH action occurred. No implementation occurred. No source/test/package/migration/entity/environment/Docker/deployment files changed. No secrets opened. No subagents used.

---

## 3. Parent Task Status

**PRIVATE-BETA-STAGING-SETUP — ACTIVE — Steps 1–2 COMPLETE — Step 3 executing via 8 child tasks.**

SETUP-03 is now COMPLETE and LOCKED. The next child task is PRIVATE-BETA-STAGING-SETUP-04 — Runtime / Container Deployment Plan. SETUP-04 is not registered in this step. Registration requires Keith explicit approval.

Parent Step 3 (Execution via 8 child tasks) continues. SETUP-01, SETUP-02, SETUP-03 are all COMPLETE and LOCKED. SETUP-04 through SETUP-08 are pending Keith-approved registration and execution.

---

## 4. Why This Child Task Existed

SETUP-01 and SETUP-02 established the AWS Lightsail provider/region/instance decisions and the server baseline/firewall/SSH plan. Before server provisioning and runtime deployment can proceed, the staging environment needs a confirmed domain, DNS, and TLS plan. This task:

- Confirmed staging.ainow.biz as the private beta / staging URL.
- Established a DNS registrar discovery checklist so Keith knows where to create the DNS A record.
- Documented the Lightsail static IP dependency (static IP must exist before DNS A record is created).
- Planned the Caddy reverse proxy and automatic Let's Encrypt TLS strategy.
- Documented routing, cookie/session/domain implications, CORS implications, DNS propagation expectations, and Keith manual actions.
- Produced a reference for all future execution steps that depend on DNS/TLS being configured correctly.

No DNS changes were made. All execution requires Keith explicit approval in future child tasks.

---

## 5. DNS/TLS Plan Path

`docs/PRIVATE-BETA-STAGING-SETUP-03-DNS-TLS-PLAN.md`

Step 2 verdict: **PASS** — all 19 scope items covered. No blockers identified.

---

## 6. Confirmed Domain Decisions

| # | Decision | Value |
|---|----------|-------|
| 1 | Staging / private beta URL | **staging.ainow.biz** |
| 2 | Future production app URL | **app.ainow.biz** |
| 3 | Future root / marketing domain | **ainow.biz** |
| 4 | staging.ainow.biz must NOT be used as production | **Confirmed** |
| 5 | No production domain cutover in SETUP-03 | **Confirmed** |

Domain separation rule: `staging.ainow.biz`, `app.ainow.biz`, and `ainow.biz` are separate environments. Staging must never serve production traffic or be promoted to production without explicit domain migration planning.

---

## 7. DNS Registrar / Discovery Plan

Keith must confirm before any DNS record is created:

| # | Question |
|---|----------|
| 1 | Where is `ainow.biz` registered? (registrar name) |
| 2 | Where is DNS hosted for `ainow.biz`? (may differ from registrar) |
| 3 | Can Keith log into the DNS management panel? |
| 4 | Does the DNS panel support creating A records? |
| 5 | Does the DNS panel support setting TTL (target: 300 seconds)? |
| 6 | Are there existing DNS records for `ainow.biz`? |
| 7 | Is there an existing `staging` subdomain record? |
| 8 | Does the registrar enforce DNSSEC or other restrictions? |

If DNS is hosted at Cloudflare, the A record must be set to "DNS only" (grey cloud), not "Proxied" (orange cloud), so Caddy can perform the Let's Encrypt HTTP-01 challenge.

---

## 8. Lightsail Static IP Dependency

| Field | Value |
|-------|-------|
| Static IP required before DNS | Yes |
| Static IP name | aisandbox-staging-ip |
| Status at SETUP-03 completion | Planned — not created |
| Created when | After Lightsail instance `aisandbox-staging` exists and is running |

Dependency chain:
```
Lightsail instance (aisandbox-staging) must exist
  → Static IP (aisandbox-staging-ip) must be created and attached
    → Static IP address is now known
      → DNS A record can be created: staging.ainow.biz → <static IP>
        → DNS propagation occurs
          → Caddy can obtain Let's Encrypt TLS certificate
            → HTTPS is live at staging.ainow.biz
```

Do NOT create a DNS A record pointing to a temporary or changing public IP. Only use the static IP after it is created and attached.

---

## 9. DNS A Record Decision

| Field | Value |
|-------|-------|
| Record type | A |
| Host/Name | staging |
| Value/Target | Lightsail static IP (value known only after aisandbox-staging-ip is created) |
| TTL | 300 seconds (5 minutes) if configurable; otherwise use default |
| Where to create | At the DNS hosting provider for ainow.biz (determined by discovery checklist) |

This is a future action only. The DNS A record was NOT created in SETUP-03.

---

## 10. Caddy Reverse Proxy Decision

| Factor | Value |
|--------|-------|
| Reverse proxy | Caddy |
| Why Caddy | Automatic HTTPS, minimal configuration, built-in HTTP→HTTPS redirect, proven for single-server |
| Configuration | Single Caddyfile |
| Public ports exposed | 80 and 443 only |
| Internal ports | All closed externally |

Conceptual future Caddyfile (planning reference only — not created in SETUP-03):
```text
staging.ainow.biz {
    reverse_proxy /api/* localhost:4000
    reverse_proxy localhost:3002
}
```

Caddy installation and Caddyfile creation belong to a future setup/execution task with Keith explicit approval.

---

## 11. TLS / Let's Encrypt Decision

| Field | Value |
|-------|-------|
| TLS provider | Let's Encrypt (free, trusted CA) |
| Certificate management | Caddy handles automatically |
| Challenge type | HTTP-01 (Caddy serves challenge on port 80) |
| Certificate renewal | Automatic (Caddy renews before expiry) |

TLS acquisition prerequisites: DNS A record resolved, ports 80/443 open, Caddy installed, Caddyfile references staging.ainow.biz, no other service binding ports 80/443. No TLS certificate was requested in SETUP-03.

---

## 12. HTTP → HTTPS Redirect Decision

| Field | Value |
|-------|-------|
| Redirect method | Caddy automatic |
| Behavior | All HTTP (port 80) requests automatically redirected to HTTPS (port 443) |
| Configuration needed | None — Caddy default behavior |

Port 80 must remain open after HTTPS is working for redirect and certificate renewal. This is automatic with Caddy.

---

## 13. Frontend / API Route Decision

**Route plan:**

| Request | Routed To | Service |
|---------|-----------|---------|
| `staging.ainow.biz/` and all non-`/api/*` paths | `localhost:3002` | Frontend (Next.js) |
| `staging.ainow.biz/api/*` | `localhost:4000` | API Gateway (NestJS) |

Frontend listens on port 3002 (not exposed externally). API Gateway listens on port 4000 (not exposed externally). TLS terminates at Caddy; internal connections are plain HTTP on localhost.

---

## 14. Closed Internal Ports

| # | Port | Protocol | Service |
|---|------|----------|---------|
| 1 | 3002 | TCP | Frontend (Next.js) |
| 2 | 4000 | TCP | API Gateway (NestJS) |
| 3 | 4001 | TCP | AI Service Worker (NestJS) |
| 4 | 4002 | TCP | Container Manager (NestJS) |
| 5 | 5432 | TCP | PostgreSQL 15 |
| 6 | 6379 | TCP | Redis 7 |

Public ports: 22 (SSH admin), 80 (HTTP/Caddy), 443 (HTTPS/Caddy) only.

Defense-in-depth: Lightsail firewall (primary) + application-level binding (PostgreSQL/Redis to 127.0.0.1) + optional UFW.

---

## 15. Cookie / Session / Domain Implications

- staging.ainow.biz and app.ainow.biz are separate — session cookies must not be shared.
- Cookie `Domain` attribute should be scoped to the specific host (`staging.ainow.biz`) or omit `Domain` entirely (browser defaults to exact host). Must NOT be `Domain=.ainow.biz`.
- `Secure` flag must be `true` (all traffic is HTTPS via Caddy).
- `HttpOnly` flag must be `true` for session cookies.
- `SameSite` should be `Lax` or `Strict`.
- `APP_BASE_URL` must be set to `https://staging.ainow.biz` on staging server.
- `GOOGLE_CALLBACK_URL` must be set to `https://staging.ainow.biz/api/auth/google/callback`.
- Google OAuth redirect URI must be added to Google Cloud Console by Keith.

These are planning notes — no env values are stored in this document.

---

## 16. CORS / Origin Implications

- Allowed origins must include `https://staging.ainow.biz`.
- Frontend and API share the same origin (both served via `staging.ainow.biz`) — same-origin requests do not require CORS headers.
- `APP_BASE_URL` controls CORS allowed origins — must be set to `https://staging.ainow.biz` on staging.
- No `localhost` origins in staging CORS.
- If `credentials: 'include'` is used in fetch requests, CORS must explicitly allow `https://staging.ainow.biz` (wildcard `*` does not work with credentials).
- SSR (server-side rendering) from Next.js may use `http://localhost:4000` internally since SSR runs on the same VPS.

---

## 17. DNS Propagation Expectations

| # | Item | Value |
|---|------|-------|
| 1 | Typical propagation time | 5 minutes to 4 hours |
| 2 | TTL recommendation | 300 seconds (5 minutes) initially |
| 3 | Global propagation (worst case) | Up to 48 hours |
| 4 | Verification method | `nslookup staging.ainow.biz` or `dig staging.ainow.biz A` from external machine |
| 5 | Caddy dependency | Caddy must NOT be started until DNS propagation is confirmed |
| 6 | Strategy | Use low TTL (300s) initially; increase after setup is stable |

---

## 18. Keith Manual DNS Actions

These actions must be performed by Keith manually at the DNS hosting provider. They were documented for future reference — none were executed in SETUP-03.

| # | Action | When | Prerequisite |
|---|--------|------|-------------|
| 1 | Determine DNS registrar/hosting provider for ainow.biz | Before any DNS change | Keith knowledge / account access |
| 2 | Log into DNS management panel | Before creating A record | Provider account access |
| 3 | Check for existing `staging` subdomain records | Before creating A record | Logged in |
| 4 | Create A record: Host/Name `staging`, Value `<Lightsail static IP>`, TTL `300` | After static IP exists | Static IP created and attached |
| 5 | Verify DNS propagation from external machine | After A record creation | A record saved |
| 6 | If Cloudflare: ensure "DNS only" (grey cloud), not "Proxied" (orange cloud) | During A record creation | Cloudflare is the DNS host |
| 7 | Confirm DNS resolves correctly before Caddy/TLS setup | After propagation | Propagation complete |

DNS A record creation requires Keith explicit approval. Static IP must exist and be attached before A record creation.

---

## 19. Validation Checks

These are future validation checks — none were executed in SETUP-03.

**DNS:** `nslookup staging.ainow.biz` returns Lightsail static IP. `dig staging.ainow.biz A +short` returns only the Lightsail static IP.

**TLS:** Browser shows lock icon; certificate issued by Let's Encrypt and covers `staging.ainow.biz`.

**HTTP → HTTPS redirect:** `curl -I http://staging.ainow.biz` returns 301 redirect to `https://staging.ainow.biz`.

**Application routing:** `https://staging.ainow.biz/en/platform` loads. `curl https://staging.ainow.biz/api/health` returns `{ "status": "ok" }`. zh-TW and zh-CN routes load.

**Security:** Internal ports 4001, 5432, 6379 are unreachable externally (connection refused or timeout).

**Auth/session:** Google OAuth login succeeds; session cookie set correctly (requires full app deployment — belongs to SETUP-07/SETUP-08).

---

## 20. What Was Not Done

| # | Not Done |
|---|---------|
| 1 | DNS records not changed |
| 2 | AWS server not created |
| 3 | Static IP not created |
| 4 | Caddy not installed or configured |
| 5 | TLS certificate not requested |
| 6 | Firewall rules not changed |
| 7 | SSH not performed |
| 8 | No service deployed |
| 9 | No runtime started |
| 10 | No migrations executed |
| 11 | No tests or builds executed |
| 12 | No API calls made |
| 13 | No browser automation |
| 14 | No source code modified |
| 15 | No test files modified |
| 16 | No package files modified |
| 17 | No environment files opened or modified |
| 18 | No secret-bearing files opened |
| 19 | No beta users invited |
| 20 | No beta launch claimed |
| 21 | No git commit or git push |
| 22 | No subagents used |
| 23 | SETUP-04 not registered in this step |

---

## 21. Safety Boundaries Preserved

All 25 safety boundaries recorded in the DNS/TLS plan (`docs/PRIVATE-BETA-STAGING-SETUP-03-DNS-TLS-PLAN.md` Section 23) were preserved throughout all 3 steps of SETUP-03.

No implementation occurred at any step. No DNS/TLS/Caddy/server/AWS/static IP/firewall/SSH action occurred at any step. No source/test/package/migration/entity/environment/Docker/deployment files were changed at any step. No secrets were opened, printed, or exposed. No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred. No git commit or git push occurred. No subagents were used.

---

## 22. Product Impact

SETUP-03 produces a complete DNS/TLS plan that:

- Confirms `staging.ainow.biz` as the private beta staging URL.
- Records `app.ainow.biz` as the future production app URL (reserved, not used yet).
- Records `ainow.biz` as the future root/marketing domain (reserved, not used yet).
- Provides Keith with a clear reference for all DNS/TLS execution actions.
- Documents all routing, cookie/session, CORS, and propagation implications that apply to staging deployment.
- Unblocks SETUP-04 (Runtime / Container Deployment Plan) registration.

No actual DNS, TLS, or infrastructure change occurred. The plan is a reference for future execution steps.

---

## 23. Dependency / Handoff to SETUP-04

| Field | Value |
|-------|-------|
| Next child task | PRIVATE-BETA-STAGING-SETUP-04 |
| Title | Runtime / Container Deployment Plan |
| Expected scope | Plan Node.js 20 LTS, Docker Engine, PM2, Caddy installation; repo clone and service builds; PM2 ecosystem config; service startup order |
| Registration | Keith must explicitly approve SETUP-04 registration |
| SETUP-03 dependency | COMPLETE — SETUP-04 may be registered |

SETUP-04 is NOT registered in this step. Registration belongs to a future explicit registration step with Keith explicit approval.

---

## 24. Acceptance Criteria Disposition

### Registration (Step 1 — COMPLETE 2026-07-21)
- [x] PRIVATE-BETA-STAGING-SETUP-03 added to TASKS_BACKLOG_FULL.md.
- [x] PRIVATE-BETA-STAGING-SETUP-03 activated in TASKS.md.
- [x] PRIVATE-BETA-STAGING-SETUP-01 remains COMPLETE and LOCKED.
- [x] PRIVATE-BETA-STAGING-SETUP-02 remains COMPLETE and LOCKED.
- [x] Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE.
- [x] Scope limited to domain/DNS/TLS planning.
- [x] 3-step child workflow recorded.
- [x] staging.ainow.biz recorded as staging/private beta URL.
- [x] app.ainow.biz recorded as future production app URL.
- [x] ainow.biz recorded as future root/marketing domain.
- [x] Recommended DNS/TLS defaults recorded.
- [x] No DNS/TLS/Caddy/AWS/server action claimed.
- [x] No implementation during registration.
- [x] No source/test/package/migration/entity/environment/Docker/deployment files changed.
- [x] No runtime, Docker, DB, browser, API, test, build, migration execution, deployment, git commit, or git push occurred.
- [x] No secret-bearing environment file opened.
- [x] No subagents used.
- [x] AINOW-EXECUTION-ROADMAP.md updated.

### Domain / DNS / TLS Plan (Step 2 — COMPLETE 2026-07-21)
- [x] Plan document created covering all 19 scope items — `docs/PRIVATE-BETA-STAGING-SETUP-03-DNS-TLS-PLAN.md`.
- [x] DNS registrar / DNS hosting discovery checklist included.
- [x] Lightsail static IP dependency documented.
- [x] Caddy reverse proxy and Let's Encrypt TLS plan documented.
- [x] Keith manual DNS actions checklist included.
- [x] No DNS/TLS/Caddy/server changes occurred.
- [x] Keith explicit approval recorded before this step.

### Consolidation / Handoff to SETUP-04 (Step 3 — COMPLETE 2026-07-21)
- [x] Checkpoint document created — `docs/PRIVATE-BETA-STAGING-SETUP-03-CHECKPOINT.md`.
- [x] PRIVATE-BETA-STAGING-SETUP-03 marked COMPLETE and LOCKED in TASKS.md.
- [x] PRIVATE-BETA-STAGING-SETUP-03 marked COMPLETE and LOCKED in TASKS_BACKLOG_FULL.md.
- [x] AINOW-EXECUTION-ROADMAP.md updated.
- [x] Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE.
- [x] SETUP-04 not registered in this step.

---

## 25. Locked-State Instruction

**PRIVATE-BETA-STAGING-SETUP-03 is COMPLETE and LOCKED as of 2026-07-21.**

Do not modify this task, its scope, its decisions, its plan document, or this checkpoint. Do not re-open this task. Do not modify the DNS/TLS plan document (`docs/PRIVATE-BETA-STAGING-SETUP-03-DNS-TLS-PLAN.md`). If DNS/TLS execution is required, register a future child task or execution step with Keith explicit approval. If corrections to this document are required, they must be explicitly approved as documentation corrections only.

---

## 26. Exact Next Action

**Register PRIVATE-BETA-STAGING-SETUP-04 — Runtime / Container Deployment Plan.**

Scope: Plan Node.js 20 LTS installation, Docker Engine installation, PM2 installation, Caddy installation, repo clone and service builds, PM2 ecosystem configuration, service startup order. No runtime installation or deployment during SETUP-04 planning.

Registration requires Keith explicit approval ("go" or equivalent).

Do not register SETUP-04 without Keith explicit approval.

---

**Checkpoint created:** 2026-07-21
**PRIVATE-BETA-STAGING-SETUP-03 status:** COMPLETE and LOCKED — 2026-07-21 — All 3 steps COMPLETE.
**DNS/TLS plan:** `docs/PRIVATE-BETA-STAGING-SETUP-03-DNS-TLS-PLAN.md` — Step 2 verdict: PASS.
**No DNS change occurred.**
**No TLS certificate was requested.**
**No Caddy install/config occurred.**
**No AWS/server/static IP/firewall/SSH action occurred.**
**No implementation occurred.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred.**
**No git commit or git push occurred.**
**No secret-bearing environment file opened.**
**No subagents used.**
**SETUP-04 not registered.**
**Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE.**
