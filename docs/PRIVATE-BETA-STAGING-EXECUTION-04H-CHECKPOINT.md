# PRIVATE-BETA-STAGING-EXECUTION-04H — Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04H  
**Step:** 5 — Consolidation / Checkpoint  
**Checkpoint date:** 2026-08-03  
**Nature:** Consolidation/governance only — no SSH — no AWS CLI/actions — no DNS changes — no Caddy configuration or reload — no TLS certificate request — no port changes — no reboot — no PM2/systemd commands — no `.env` opened/created/edited — no env values printed — no dependency install/build — no app services started/stopped/restarted — no migrations — no Docker/PostgreSQL/Redis actions — no tests/builds — no source or migration file changes — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04H |
| Title | Public Routing / DNS / TLS Baseline |
| Step | 5 — Consolidation / Checkpoint |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Predecessors | PRIVATE-BETA-STAGING-EXECUTION-04G COMPLETE and LOCKED — 2026-07-29; PRIVATE-BETA-STAGING-EXECUTION-04F / 04F1 COMPLETE and LOCKED — 2026-07-29; PRIVATE-BETA-STAGING-EXECUTION-04D COMPLETE and LOCKED — 2026-07-27; PRIVATE-BETA-STAGING-EXECUTION-04E COMPLETE and LOCKED — 2026-07-27; PRIVATE-BETA-STAGING-SETUP-03 COMPLETE and LOCKED — 2026-07-21; PRIVATE-BETA-STAGING-EXECUTION-02 COMPLETE and LOCKED — 2026-07-24 (Caddy v2.11.4 installed); PRIVATE-BETA-STAGING-EXECUTION-01 COMPLETE and LOCKED — 2026-07-23 (static IP + firewall 22/80/443) |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — public routing / DNS / TLS baseline consolidation |
| Risk | HIGH — public routing and TLS issuance validated; consolidation step only |
| Registered | 2026-07-29 |
| Completed | 2026-08-03 |
| Operator | Keith |
| Execution venue (operator) | AWS Lightsail browser SSH + DNS provider panel (operator-side; not Cursor) |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Static IP | `aisandbox-staging-ip` — public IP `18.136.141.186` |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-PUBLIC-ROUTING-DNS-TLS-RUNBOOK.md` |
| Evidence review | `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-PUBLIC-ROUTING-DNS-TLS-EVIDENCE-REVIEW.md` — verdict **PASS** |
| Source DNS/TLS plan | `docs/PRIVATE-BETA-STAGING-SETUP-03-DNS-TLS-PLAN.md` — COMPLETE and LOCKED |
| Setup-03 checkpoint | `docs/PRIVATE-BETA-STAGING-SETUP-03-CHECKPOINT.md` — COMPLETE and LOCKED |
| 04G checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04G-CHECKPOINT.md` — COMPLETE and LOCKED |
| Checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-CHECKPOINT.md` — **this file** |

---

## 2. Status

**COMPLETE and LOCKED — 2026-08-03. Do not modify this entry.**

All 04H steps COMPLETE. Evidence review verdict: PASS. Source-grounded hostname `staging.ainow.biz` confirmed. Pre-change local baseline healthy. Caddy v2.11.4 installed, enabled, active, and validated before change. Existing Caddyfile was default `:80` static file server. DNS initially did not resolve. Keith approved DNS record change. `staging.ainow.biz` resolved externally to `18.136.141.186` via 1.1.1.1 and 8.8.8.8. Keith approved Caddy public route change and TLS public validation. Caddyfile backup created at `/etc/caddy/Caddyfile.backup-04H-20260803-133529`. Caddy configured for `staging.ainow.biz` with `/api/*` → `127.0.0.1:4000` and frontend → `127.0.0.1:3002`. Caddy validation returned `Valid configuration`. Caddy remained enabled and active. Public HTTPS health-only smoke PASS: `PUBLIC_HTTP_ROOT_FORCED=308`, `PUBLIC_HTTPS_ROOT_FORCED=307`, `PUBLIC_HTTPS_API_HEALTH_FORCED=200`, `PUBLIC_HTTPS_API_DB_HEALTH_FORCED=200`, `PUBLIC_HTTPS_API_READY_FORCED=200`. Final local health PASS. Public table count remained 26. No secrets printed. No AI / billing / container / Google OAuth enablement. No source/migration/env changes. Parent 04 remains ACTIVE. PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

---

## 3. Purpose

04H safely prepared and validated public routing for staging through Caddy, DNS, and TLS after PM2/systemd boot persistence was reboot-proven (04G COMPLETE and LOCKED — 2026-07-29).

04H remained bounded to:

* source-grounded hostname confirmation (`staging.ainow.biz`)
* pre-change local baseline verification
* Caddy / DNS / firewall discovery
* explicit Keith approval gates for DNS, Caddy, and TLS public validation
* controlled DNS A record creation (`staging.ainow.biz → 18.136.141.186`)
* controlled Caddyfile configuration with backup before modification
* Caddy validation and reload
* TLS issuance via Caddy automatic HTTPS (Let's Encrypt)
* public HTTPS health-only smoke (API health endpoints + frontend root only)
* final local health and safe-state verification
* evidence review and consolidation
* no DNS/TLS changes beyond `staging.ainow.biz`
* no migrations / `.env` changes
* no paid/AI/container/OAuth execution enablement
* no secret output

---

## 4. Scope Completed

| Step | Result |
|------|--------|
| Step 1 — Registration | COMPLETE — 2026-07-29 |
| Step 2 — Public Routing / DNS / TLS Runbook | COMPLETE — `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-PUBLIC-ROUTING-DNS-TLS-RUNBOOK.md` |
| Step 3 — Manual Public Routing / DNS / TLS Validation + Evidence | COMPLETE — operator evidence captured |
| Step 4 — Evidence Review | COMPLETE — verdict **PASS** — `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-PUBLIC-ROUTING-DNS-TLS-EVIDENCE-REVIEW.md` |
| Step 5 — Consolidation / Checkpoint | COMPLETE — this checkpoint |

Operator-side (Keith, AWS Lightsail browser SSH + DNS provider panel — not Cursor):

* Pre-change local baseline verified
* Caddy / DNS / firewall discovery completed
* Explicit approval: `go — approve 04H DNS record change`
* DNS A record created: `staging.ainow.biz → 18.136.141.186`
* External DNS confirmed via 1.1.1.1 and 8.8.8.8
* Explicit approval: `go — approve 04H Caddy public route change and TLS public validation`
* Caddyfile backup created before modification
* Caddy configured for `staging.ainow.biz`; validated and reloaded
* Public HTTPS health-only smoke completed
* Final local health and safe-state verified

---

## 5. Source-Grounded Hostname

| Field | Value |
|-------|-------|
| Hostname | **`staging.ainow.biz`** |
| Source documents | `docs/PRIVATE-BETA-STAGING-SETUP-03-DNS-TLS-PLAN.md` (COMPLETE and LOCKED — 2026-07-21); `docs/PRIVATE-BETA-STAGING-SETUP-03-CHECKPOINT.md` (COMPLETE and LOCKED — 2026-07-21); PRIVATE-BETA-STAGING-EXECUTION-04H registration evidence |
| Conflict | None — hostname consistent across all source documents and Keith's evidence |
| Out-of-scope hostnames | `app.ainow.biz` (production — not configured in 04H); `ainow.biz` root (not cut over in 04H) |

**Conclusion:** Target hostname is source-grounded as `staging.ainow.biz`. No hostname conflict was found. Hostname was not invented or switched in 04H.

---

## 6. Pre-Change Local Baseline

| Check | Evidence | Verdict |
|-------|----------|---------|
| Date | Wed Jul 29 18:13:46 HKT 2026 | PASS |
| Uptime | up 57 min | PASS |
| Public table count | 26 | PASS |
| `pm2-ubuntu` enabled | enabled | PASS |
| `pm2-ubuntu` active | active | PASS |
| systemd Result | success | PASS |
| `PM2_DUMP_PRESENT` | yes | PASS |
| `pm2 ping` | pong | PASS |
| `aisandbox-api-gateway` | ok count=1 status=online restarts=0 | PASS |
| `aisandbox-ai-service` | ok count=1 status=online restarts=0 | PASS |
| `aisandbox-container-manager` | ok count=1 status=online restarts=0 | PASS |
| `aisandbox-frontend` | ok count=1 status=online restarts=0 | PASS |
| `API_HEALTH` | 200 | PASS |
| `API_DB_HEALTH` | 200 | PASS |
| `API_READY` | 200 | PASS |
| `CONTAINER_HEALTH` | 200 | PASS |
| `FRONTEND_ROOT` | 307 | PASS — accepted as locale redirect |

**Conclusion:** Pre-change local PM2/systemd baseline was healthy. Local health-only smoke passed. Public table count was 26. All four apps were online with zero restarts. Confirms continuity from 04G COMPLETE and LOCKED.

---

## 7. Initial Caddy / DNS / Firewall Discovery

### Caddy Discovery

| Check | Evidence | Verdict |
|-------|----------|---------|
| Caddy version | v2.11.4 | PASS — consistent with EXECUTION-02 |
| Caddy enabled | enabled | PASS |
| Caddy active | active | PASS |
| Caddy validate (before change) | Valid configuration | PASS |
| Existing Caddyfile summary | Default `:80` static file server | PASS — no `staging.ainow.biz` entry existed; no unexpected routes to conflict |

### App Ports Observed

| Port | Value | Verdict |
|------|-------|---------|
| Frontend | 127.0.0.1:3002 | PASS — consistent with candidate route intent |
| API Gateway | *:4000 | PASS — consistent with candidate route intent |
| Container Manager | *:4002 | PASS |

### Firewall State

| Check | Evidence | Verdict |
|-------|----------|---------|
| UFW status | inactive | PASS — Lightsail firewall (not UFW) was the perimeter control |
| Prior Lightsail firewall | documented as exposing 22/80/443 | PASS — consistent with EXECUTION-01 intent |

### DNS Discovery (Initial)

| Check | Evidence | Verdict |
|-------|----------|---------|
| DNS resolution (initial) | Did not resolve | EXPECTED — no A record existed yet |
| `HTTP_PUBLIC` (initial) | 000 — `staging.ainow.biz` did not resolve | EXPECTED |
| `HTTPS_PUBLIC_INSECURE` (initial) | 000 — `staging.ainow.biz` did not resolve | EXPECTED |

**Conclusion:** Caddy v2.11.4 was installed, enabled, active, and validated before change. The existing Caddyfile was the default `:80` static file server with no `staging.ainow.biz` entry. DNS initially did not resolve, as expected before DNS change. No stop condition was triggered.

---

## 8. DNS Approval and Result

| Check | Evidence | Verdict |
|-------|----------|---------|
| Keith approval (DNS) | `go — approve 04H DNS record change` | PASS |
| DNS A record set | `staging.ainow.biz → 18.136.141.186` | PASS |
| External DNS: 1.1.1.1 | `dig @1.1.1.1 staging.ainow.biz A = 18.136.141.186` | PASS |
| External DNS: 8.8.8.8 | `dig @8.8.8.8 staging.ainow.biz A = 18.136.141.186` | PASS |
| Local resolver | Stale negative cache temporarily — resolved via forced IP probe | PASS — no server DNS config changed |
| No server DNS config change | No | PASS |

**Conclusion:** Keith explicitly approved the DNS record change. `staging.ainow.biz` was externally resolved to `18.136.141.186` via both 1.1.1.1 and 8.8.8.8. Local resolver staleness was handled safely by using forced IP probes — no server DNS configuration was changed. The static IP `18.136.141.186` is consistent with the `aisandbox-staging-ip` Lightsail attachment established in EXECUTION-01.

---

## 9. Caddy / TLS Approval and Result

| Check | Evidence | Verdict |
|-------|----------|---------|
| Keith approval (Caddy + TLS) | `go — approve 04H Caddy public route change and TLS public validation` | PASS |
| Caddyfile backup | `/etc/caddy/Caddyfile.backup-04H-20260803-133529` | PASS |
| Caddy configured for | `staging.ainow.biz` | PASS |
| Route: `/api/*` | `reverse_proxy 127.0.0.1:4000` | PASS |
| Route: all other | `reverse_proxy 127.0.0.1:3002` | PASS |
| Caddy validate after change | `Valid configuration` | PASS |
| Caddy formatting warning | `Caddyfile input is not formatted` — warning only | NON-BLOCKING |
| `auto_https` | enabled automatic HTTP→HTTPS redirect | PASS |
| Caddy enabled after change | enabled | PASS |
| Caddy active after change | active | PASS |

**Conclusion:** Keith explicitly approved the Caddy route change and TLS public validation. A Caddyfile backup was created at `/etc/caddy/Caddyfile.backup-04H-20260803-133529` before any modification. Caddy was configured for `staging.ainow.biz` with the intended routing. Caddy validation returned `Valid configuration`. The formatting warning is non-blocking. Caddy remained enabled and active after the change with automatic HTTPS enabled (Let's Encrypt HTTP-01 via Caddy).

---

## 10. Public HTTPS Health-Only Smoke

| Check | Evidence | Verdict |
|-------|----------|---------|
| `PUBLIC_HTTP_ROOT_FORCED` | 308 | PASS — Caddy automatic HTTP→HTTPS redirect (permanent redirect) |
| `PUBLIC_HTTPS_ROOT_FORCED` | 307 | PASS — frontend locale redirect; 2xx/3xx acceptable per runbook |
| `PUBLIC_HTTPS_API_HEALTH_FORCED` | 200 | PASS |
| `PUBLIC_HTTPS_API_DB_HEALTH_FORCED` | 200 | PASS |
| `PUBLIC_HTTPS_API_READY_FORCED` | 200 | PASS |

### Interpretation Notes

* `PUBLIC_HTTP_ROOT_FORCED=308` accepted as Caddy automatic HTTPS redirect — expected per runbook and Caddy `auto_https` behavior.
* `PUBLIC_HTTPS_ROOT_FORCED=307` accepted as frontend locale redirect — consistent with all prior evidence where `FRONTEND_ROOT=307`.
* Forced resolve checks accepted as valid evidence: external DNS via 1.1.1.1 and 8.8.8.8 confirmed correct resolution to `18.136.141.186`; local stale resolver was a transient caching artifact.
* These checks validate public routing and TLS only. Broader app/browser/login/billing/AI/container/OAuth flows were not performed and are not claimed.

**Conclusion:** Public HTTP root returned the expected redirect (308 via Caddy HTTPS redirect). Public HTTPS root returned the expected frontend locale redirect (307). All three public HTTPS API health endpoints returned 200. Public routing / DNS / TLS health-only smoke **PASS**.

---

## 11. Final Local Health and Safe State

| Check | Evidence | Verdict |
|-------|----------|---------|
| `LOCAL_API_HEALTH` | 200 | PASS |
| `LOCAL_API_DB_HEALTH` | 200 | PASS |
| `LOCAL_API_READY` | 200 | PASS |
| `LOCAL_CONTAINER_HEALTH` | 200 | PASS |
| `LOCAL_FRONTEND_ROOT` | 307 | PASS — accepted as locale redirect |
| `pm2-ubuntu` enabled | enabled | PASS |
| `pm2-ubuntu` active | active | PASS |
| Caddy enabled | enabled | PASS |
| Caddy active | active | PASS |
| Public table count | 26 | PASS |
| Git status | no output (treated as clean) | PASS — no source changes occurred in 04H |

**Conclusion:** Final local health-only checks all passed. PM2/systemd remained healthy. Caddy remained enabled and active. Public table count remained 26. No public routing changes disrupted the local app layer or database state.

---

## 12. Secret-Safety Verification

| Check | Evidence | Verdict |
|-------|----------|---------|
| `.env` values printed | No | PASS |
| DNS provider secrets printed | No | PASS |
| Cert private keys printed | No | PASS |
| `env` / `printenv` / `cat .env` / `echo $DATABASE_URL` / `echo $REDIS_URL` used | No | PASS |
| Evidence content | Only safe outputs: hostnames, HTTP status codes, DNS record types/values (public IP), systemd/PM2 states, approval tokens, Caddy version/state, backup path | PASS |

**Conclusion:** No `.env` values or secrets were printed. No DNS provider credentials, cert private keys, or token values appeared in the evidence. Evidence content was limited to safe public and status outputs only. This consolidation step did not open or print env values.

---

## 13. Non-Goal Verification

| Non-goal | Occurred? | Verdict |
|----------|-----------|---------|
| AI execution | No | PASS |
| Billing/payment execution | No | PASS |
| Container workflow beyond Container Manager health check | No | PASS |
| Google OAuth enablement | No | PASS |
| Source/migration file changes | No | PASS |
| `.env` create/edit/print | No | PASS |
| Migrations / DB table creation | No | PASS |
| Production domain cutover (`app.ainow.biz` / `ainow.biz`) | No | PASS |
| PRIVATE-BETA-DEPLOYMENT-READINESS marked ready | No | PASS |
| Parent PRIVATE-BETA-STAGING-EXECUTION-04 marked complete | No | PASS |

**Conclusion:** All 04H non-goals were respected. No AI, billing/payment, container workflow (beyond health endpoint), Google OAuth, or source/migration/env changes occurred.

---

## 14. Files Changed

| File | Change |
|------|--------|
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-CHECKPOINT.md` | Created — this file |
| `TASKS.md` | Updated — 04H COMPLETE and LOCKED; parent 04 ACTIVE with 04H complete; PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED |
| `TASKS_BACKLOG_FULL.md` | Updated — mirroring TASKS.md |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Updated — 04H COMPLETE and LOCKED; next recommend register next safe deployment baseline slice for browser/user-facing smoke |

---

## 15. Files Intentionally Not Changed

* Source files
* Tests
* Package files / lockfiles
* Migration files
* Env files
* Docker files
* Caddy files
* PM2 config files
* systemd files
* Unrelated docs
* Locked 04A / 04B / 04C / 04D / 04E / 04F / 04F1 / 04G entries except necessary cross-references

---

## 16. Runtime/Server Actions

| Actor | Action in this consolidation step |
|-------|-----------------------------------|
| Cursor | None — no SSH, no AWS, no reboot, no PM2/systemd commands, no health curls, no installs/builds |
| Operator (prior 04H execution) | Pre-change checks + DNS record creation + Caddy configuration/reload/TLS + public smoke + final safe-state verification — all completed outside Cursor |

---

## 17. Database Actions

| Actor | Action in this consolidation step |
|-------|-----------------------------------|
| Cursor | None — no migrations; no PostgreSQL tables created; no Docker/PostgreSQL/Redis |
| Operator (prior path) | Observed public table count `26` in pre-change baseline and final safe-state checks |

---

## 18. Residual Risks

| Residual risk | Notes |
|---------------|-------|
| Public health-only smoke only | Browser/user-facing workflow smoke (login, register, workspace, Create Agent, etc.) was not validated; remains separate |
| DNS propagation/caching variance | Some clients or resolvers may still have stale cache; this is transient and expected |
| Login/authenticated flows not tested | Authentication, session cookie, CSRF behavior not validated in 04H |
| Billing/payment flows not tested or enabled | Intentionally deferred |
| AI execution not tested or enabled | Intentionally deferred |
| Container workflow execution not tested or enabled | Container Manager health endpoint only; full workflow deferred |
| Google OAuth remains deferred | Not enabled in 04H |
| Caddyfile formatting warning | Non-blocking warning present; Caddyfile could be reformatted in a future bounded formatting-only slice if desired |
| UFW inactive | Perimeter protection relies entirely on Lightsail firewall; consistent with prior evidence |
| Parent EXECUTION-04 remains ACTIVE | Full staging baseline not complete until remaining roadmap child slices are resolved |
| PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED | Must not advance from 04H alone |

---

## 19. What Remains Blocked

* Parent **PRIVATE-BETA-STAGING-EXECUTION-04** completion — full app deployment / public staging path not complete until remaining open child slices are resolved
* **Browser/user-facing smoke** beyond health-only checks
* **Login/register/workspace/Create Agent** flow validation
* **AI execution** enablement
* **Billing/payment execution** enablement
* **Container execution workflows** beyond Container Manager health endpoint
* **Google OAuth** enablement
* **Advancing PRIVATE-BETA-DEPLOYMENT-READINESS** — remains **BLOCKED / PAUSED**

---

## 20. Parent 04 Status

04H is COMPLETE and LOCKED. 04A / 04B / 04C / 04D / 04E / 04F / 04G / 04H are COMPLETE and LOCKED. 04F1 is COMPLETE and LOCKED.

Parent **PRIVATE-BETA-STAGING-EXECUTION-04** remains **ACTIVE** because full app deployment baseline is still not complete (browser/user-facing smoke and broader deployment readiness remain open).

PM2/systemd boot persistence is reboot-proven (04G). Public routing / DNS / TLS baseline is now established (04H). `staging.ainow.biz` is publicly reachable and externally resolves to `18.136.141.186`. Caddy is enabled and active with valid configuration routing the staging hostname.

Keep PRIVATE-BETA-DEPLOYMENT-READINESS **BLOCKED / PAUSED**.

---

## 21. Final Locked State

| Task | Status |
|------|--------|
| PRIVATE-BETA-STAGING-EXECUTION-04H | **COMPLETE and LOCKED — 2026-08-03** |
| PRIVATE-BETA-STAGING-EXECUTION-04G | COMPLETE and LOCKED — 2026-07-29 |
| PRIVATE-BETA-STAGING-EXECUTION-04F | COMPLETE and LOCKED — 2026-07-29 |
| PRIVATE-BETA-STAGING-EXECUTION-04F1 | COMPLETE and LOCKED — 2026-07-29 |
| PRIVATE-BETA-STAGING-EXECUTION-04E | COMPLETE and LOCKED — 2026-07-27 |
| PRIVATE-BETA-STAGING-EXECUTION-04D | COMPLETE and LOCKED — 2026-07-27 |
| PRIVATE-BETA-STAGING-EXECUTION-04C | COMPLETE and LOCKED — 2026-07-26 |
| PRIVATE-BETA-STAGING-EXECUTION-04B | COMPLETE and LOCKED — 2026-07-26 |
| PRIVATE-BETA-STAGING-EXECUTION-04A | COMPLETE and LOCKED — 2026-07-25 |
| PRIVATE-BETA-STAGING-EXECUTION-04 | ACTIVE — 04A/04B/04C/04D/04E/04F/04G/04H COMPLETE and LOCKED — 04F1 COMPLETE and LOCKED — PM2 persistence reboot-proven — public routing / DNS / TLS baseline established — full app deployment still not complete |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

---

## 22. Next Recommended Action

```text
Register next safe deployment baseline slice for browser/user-facing smoke only.
```

Source grounding: Parent `PRIVATE-BETA-STAGING-EXECUTION-04` remaining open work includes browser/user-facing workflow smoke (login/register/workspace/Create Agent). No explicit next child beyond 04H is registered in current TASKS.md or roadmap.

Keep parent PRIVATE-BETA-STAGING-EXECUTION-04 **ACTIVE**.  
Keep PRIVATE-BETA-DEPLOYMENT-READINESS **BLOCKED / PAUSED**.  
Do not enable AI / billing / container / OAuth execution.  
Do not mark PRIVATE-BETA-DEPLOYMENT-READINESS ready from 04H alone.  
Do not cut over production domain (`app.ainow.biz` / `ainow.biz`).

---

**End of checkpoint.**

**Document created:** 2026-08-03  
**Step 5 status:** Consolidation / Checkpoint COMPLETE — 04H **COMPLETE and LOCKED — 2026-08-03**.  
**No DNS/TLS/Caddy/server action occurred in Cursor.**  
**No env values printed.**  
**No subagents used.**  
**No source or migration files changed.**  
**No git commit or push.**
