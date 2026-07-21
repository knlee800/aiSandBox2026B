# PRIVATE-BETA-STAGING-SETUP-03 — Domain / DNS / TLS Plan for staging.ainow.biz

**Task ID:** PRIVATE-BETA-STAGING-SETUP-03
**Step:** 2 — Domain / DNS / TLS Plan
**Status:** CREATED — 2026-07-21
**Date:** 2026-07-21
**Nature:** Planning only — no DNS changes, no TLS certificate requests, no Caddy installation/configuration, no AWS/server/static IP/firewall/SSH action, no implementation, no source/test/package/migration/entity/environment/Docker/deployment files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP-03 |
| Title | Domain / DNS / TLS Plan for staging.ainow.biz |
| Parent | PRIVATE-BETA-STAGING-SETUP — Staging / Production-like Deployment Target Setup |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | DOMAIN / DNS / TLS PLANNING — NO IMPLEMENTATION |
| Risk | MEDIUM — planning only during this step; no DNS/TLS/server changes |
| Step 1 | COMPLETE — Registration — 2026-07-21 |
| Step 2 | This document — Domain / DNS / TLS Plan — 2026-07-21 |
| Step 3 | PENDING — Consolidation / handoff to SETUP-04 |
| Predecessors | PRIVATE-BETA-STAGING-SETUP-01 — COMPLETE and LOCKED — 2026-07-21 |
| | PRIVATE-BETA-STAGING-SETUP-02 — COMPLETE and LOCKED — 2026-07-21 |
| | PRIVATE-BETA-STAGING-SETUP Steps 1–2 COMPLETE — Step 3 executing via 8 child tasks |
| Keith approval | "go" — 2026-07-21 |

---

## 2. Purpose

This document records the complete Domain / DNS / TLS plan for staging.ainow.biz. It provides Keith with a concrete reference for:

- Discovering the DNS registrar/hosting for ainow.biz
- Creating a DNS A record pointing staging.ainow.biz to the Lightsail static IP
- Installing and configuring Caddy as a reverse proxy with automatic Let's Encrypt TLS
- Configuring HTTP → HTTPS redirect
- Routing public traffic to frontend and API Gateway
- Understanding cookie/session/domain and CORS implications
- Validating DNS/TLS after future setup

**No DNS changes are made in this step.** All execution requires Keith explicit approval in a future child task or execution step.

---

## 3. Confirmed Domain Decisions

| # | Decision | Value |
|---|----------|-------|
| 1 | Staging / private beta URL | **staging.ainow.biz** |
| 2 | Future production app URL | **app.ainow.biz** |
| 3 | Future root / marketing domain | **ainow.biz** |
| 4 | staging.ainow.biz must NOT be used as production | **Confirmed** |
| 5 | No production domain cutover in SETUP-03 | **Confirmed** |

### Domain Separation Rules

- `staging.ainow.biz` is the private beta / staging environment only.
- `app.ainow.biz` is reserved for future production app deployment (not used yet).
- `ainow.biz` root domain is reserved for future marketing/landing page (not used yet).
- Staging and production domains must remain separate. No domain sharing.
- staging.ainow.biz must never serve production traffic or be promoted to production without explicit domain migration planning.

---

## 4. What SETUP-03 Covers

| # | Item |
|---|------|
| 1 | Confirmed domain decisions |
| 2 | DNS registrar / DNS hosting discovery checklist |
| 3 | Lightsail static IP dependency |
| 4 | DNS A record plan |
| 5 | Caddy reverse proxy plan |
| 6 | Automatic Let's Encrypt TLS plan |
| 7 | HTTP → HTTPS redirect plan |
| 8 | Frontend proxy route plan |
| 9 | API Gateway `/api/*` proxy route plan |
| 10 | Internal service ports that must remain closed |
| 11 | Cookie / session / domain implications |
| 12 | CORS / origin implications |
| 13 | DNS propagation expectations |
| 14 | Keith manual DNS actions |
| 15 | Validation checks after DNS/TLS setup |
| 16 | What must not happen yet |
| 17 | PASS / BLOCKED criteria |
| 18 | Handoff to SETUP-04 |

---

## 5. What SETUP-03 Does NOT Do

| # | Not Done |
|---|---------|
| 1 | Does NOT change DNS records |
| 2 | Does NOT create AWS server or static IP |
| 3 | Does NOT install or configure Caddy |
| 4 | Does NOT request TLS certificates |
| 5 | Does NOT change firewall rules |
| 6 | Does NOT SSH to any server |
| 7 | Does NOT deploy any service |
| 8 | Does NOT start any runtime (Docker, PostgreSQL, Redis, PM2, Node) |
| 9 | Does NOT execute migrations |
| 10 | Does NOT run tests or builds |
| 11 | Does NOT call APIs or open browsers |
| 12 | Does NOT modify source code, test files, or package files |
| 13 | Does NOT modify environment files or open secret-bearing files |
| 14 | Does NOT invite beta users or claim beta launch |
| 15 | Does NOT make git commits or pushes |
| 16 | Does NOT use subagents |
| 17 | Does NOT modify TASKS.md, TASKS_BACKLOG_FULL.md, or AINOW-EXECUTION-ROADMAP.md |

---

## 6. DNS Registrar / DNS Hosting Discovery Checklist

Keith must confirm the following before any DNS record can be created. This is a discovery checklist — not an action list.

| # | Question | Keith Must Confirm |
|---|----------|--------------------|
| 1 | Where is `ainow.biz` registered? | Registrar name (e.g., Namecheap, GoDaddy, Google Domains, Cloudflare, AWS Route 53) |
| 2 | Where is DNS hosted for `ainow.biz`? | DNS hosting may differ from the registrar if nameservers have been delegated (e.g., registered at Namecheap but DNS hosted at Cloudflare or Route 53) |
| 3 | Can Keith log in to the DNS management panel? | Confirm login access to the registrar or DNS hosting provider dashboard |
| 4 | Does the DNS panel support creating A records? | Standard feature — confirm it is available |
| 5 | Does the DNS panel support setting TTL? | Some panels have fixed TTLs; confirm if TTL can be set to 300 seconds |
| 6 | Are there any existing DNS records for `ainow.biz`? | Check for existing A, AAAA, CNAME, MX, TXT records that might conflict |
| 7 | Is there an existing `staging` subdomain record? | Check for any pre-existing `staging.ainow.biz` record that might need removal |
| 8 | Does the registrar enforce DNSSEC or other restrictions? | Confirm no special restrictions that would block adding an A record |

### Why Discovery Matters

- If DNS is hosted at a different provider than the registrar, the A record must be created at the DNS hosting provider, not the registrar.
- If DNS is hosted at Cloudflare, Cloudflare's proxy mode may interfere with Caddy's Let's Encrypt HTTP-01 challenge unless configured correctly (set DNS record to "DNS only" / grey cloud, not "Proxied" / orange cloud).
- If DNS is hosted at AWS Route 53, the A record is created in the Route 53 hosted zone.
- Knowing the DNS provider before creating the A record avoids confusion during execution.

---

## 7. Lightsail Static IP Dependency

| Field | Value |
|-------|-------|
| Static IP required before DNS | **Yes** |
| Static IP name (from SETUP-02 plan) | **aisandbox-staging-ip** |
| Static IP status | **Planned — not created** |
| Created when | After Lightsail instance `aisandbox-staging` exists and is running |
| Cost | Free when attached to a running instance |

### Dependency Chain

```
Lightsail instance (aisandbox-staging) must exist
  → Static IP (aisandbox-staging-ip) must be created and attached
    → Static IP address is now known
      → DNS A record can be created: staging.ainow.biz → <static IP>
        → DNS propagation occurs (minutes to hours)
          → Caddy can obtain Let's Encrypt TLS certificate
            → HTTPS is live at staging.ainow.biz
```

### Rules

- Do NOT create a DNS A record pointing to a temporary or changing public IP. Only use the static IP.
- The static IP must be attached to the running instance before the DNS A record is created.
- If the static IP is detached or released, the DNS A record becomes stale and must be updated.
- Static IP creation belongs to SETUP-02 execution or a future infrastructure step — not this planning task.

---

## 8. DNS A Record Plan

**This documents a future DNS action only. Do not create this record now.**

### Future DNS Record

```text
Type:         A
Host/Name:    staging
Value/Target: <Lightsail static IP — value known only after aisandbox-staging-ip is created>
TTL:          300 seconds (5 minutes) if configurable; otherwise use default
```

### Where to Create

The A record must be created at whichever provider hosts DNS for `ainow.biz`. This is determined by the discovery checklist in Section 6.

### Rules

- Keith must know where `ainow.biz` DNS is hosted before attempting to create the record.
- DNS change requires Keith explicit approval.
- Static IP must exist before the DNS A record can be created.
- Do NOT put temporary or changing public IPs into permanent DNS if a static IP is not attached.
- If the DNS host is Cloudflare, the A record must be set to "DNS only" (grey cloud), not "Proxied" (orange cloud), so Caddy can perform Let's Encrypt HTTP-01 challenge directly.
- Only one A record for `staging` should exist. Remove any conflicting AAAA or CNAME records for the same name if present.

### Verification After Creation

```bash
# Run from any machine after DNS propagation
nslookup staging.ainow.biz
# or
dig staging.ainow.biz A
```

Expected result: the query returns the Lightsail static IP address.

---

## 9. Caddy Reverse Proxy Plan

**This documents a future Caddy plan only. Do not create the Caddyfile or install Caddy now.**

### Why Caddy

| Factor | Value |
|--------|-------|
| Automatic HTTPS | Caddy obtains and renews Let's Encrypt certificates automatically |
| Minimal configuration | Single Caddyfile with a few lines |
| HTTP → HTTPS redirect | Built-in — automatic when HTTPS is configured |
| Proven for single-server setups | Widely used for small/medium deployments |
| Alternative | nginx + certbot (more manual, equally viable, not recommended for simplicity) |

### Conceptual Future Caddyfile

```text
staging.ainow.biz {
    reverse_proxy /api/* localhost:4000
    reverse_proxy localhost:3002
}
```

### Caddy Routing Behavior

| Request Path | Routed To | Service |
|-------------|-----------|---------|
| `staging.ainow.biz/` | `localhost:3002` | Frontend (Next.js) |
| `staging.ainow.biz/en/platform` | `localhost:3002` | Frontend (Next.js) |
| `staging.ainow.biz/zh-TW/platform` | `localhost:3002` | Frontend (Next.js) |
| `staging.ainow.biz/zh-CN/platform` | `localhost:3002` | Frontend (Next.js) |
| `staging.ainow.biz/api/health` | `localhost:4000` | API Gateway (NestJS) |
| `staging.ainow.biz/api/auth/google/callback` | `localhost:4000` | API Gateway (NestJS) |
| `staging.ainow.biz/api/*` | `localhost:4000` | API Gateway (NestJS) |

### Caddy Rules

- Actual Caddyfile creation and Caddy installation belong to a later setup/execution task.
- Caddy install/config requires Keith explicit approval.
- Caddy should manage HTTPS automatically via Let's Encrypt.
- HTTP should redirect to HTTPS automatically (Caddy default behavior).
- Only ports 80 and 443 should expose app traffic publicly.
- Caddy must NOT expose internal service ports (4001, 4002, 5432, 6379) to the internet.
- `/api/*` routes go to API Gateway; all other routes go to frontend.
- Caddy must be started after the DNS A record resolves to the static IP — otherwise Let's Encrypt HTTP-01 challenge will fail.

### Caddy Installation Reference (Future)

```bash
# Future — Keith runs on VPS — not executed now
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Verify installation: `caddy version`.

---

## 10. Automatic Let's Encrypt TLS Plan

| Field | Value |
|-------|-------|
| TLS provider | **Let's Encrypt** (free, automated, trusted CA) |
| Certificate management | **Caddy handles automatically** |
| Challenge type | **HTTP-01** (Caddy serves challenge on port 80) |
| Certificate renewal | **Automatic** (Caddy renews before expiry) |
| Certificate storage | Caddy's internal data directory (`/var/lib/caddy/.local/share/caddy/`) |

### Prerequisites for TLS Certificate Acquisition

| # | Prerequisite | Status |
|---|-------------|--------|
| 1 | DNS A record `staging.ainow.biz` resolves to Lightsail static IP | Must be done before Caddy starts |
| 2 | Port 80 is open to the internet (Lightsail firewall) | Planned in SETUP-02 |
| 3 | Port 443 is open to the internet (Lightsail firewall) | Planned in SETUP-02 |
| 4 | Caddy is installed on the VPS | Future step |
| 5 | Caddyfile references `staging.ainow.biz` | Future step |
| 6 | No other service is binding to ports 80 or 443 on the VPS | Ensure before Caddy starts |

### TLS Failure Scenarios

| # | Scenario | Cause | Resolution |
|---|----------|-------|------------|
| 1 | DNS not propagated | A record not yet visible to Let's Encrypt servers | Wait for propagation; verify with `dig staging.ainow.biz` from external machine |
| 2 | Port 80 blocked | Lightsail firewall not configured | Add TCP 80 to Lightsail firewall |
| 3 | Port 443 blocked | Lightsail firewall not configured | Add TCP 443 to Lightsail firewall |
| 4 | Another service on port 80 | Apache/nginx/other process binding to 80 | Stop conflicting service before starting Caddy |
| 5 | Cloudflare proxy enabled | Orange cloud in Cloudflare blocks HTTP-01 challenge | Set DNS record to "DNS only" (grey cloud) |
| 6 | Rate limit | Too many certificate requests in short period | Wait and retry (rare for new domains) |

### TLS Rules

- No TLS certificate is requested in this planning step.
- Let's Encrypt issues free, trusted TLS certificates.
- Caddy handles all certificate lifecycle automatically (issuance, renewal, storage).
- If TLS acquisition fails, check the prerequisite list above before debugging further.
- TLS setup requires Keith explicit approval.

---

## 11. HTTP → HTTPS Redirect Plan

| Field | Value |
|-------|-------|
| Redirect method | **Caddy automatic** |
| Behavior | All HTTP (port 80) requests to `staging.ainow.biz` are automatically redirected to HTTPS (port 443) |
| Configuration needed | **None** — Caddy redirects HTTP to HTTPS by default when HTTPS is configured |

### Redirect Flow

```
Browser → http://staging.ainow.biz/...
  → Caddy (port 80) → 301 redirect → https://staging.ainow.biz/...
    → Caddy (port 443) → reverse proxy → internal service
```

### Rules

- No manual redirect configuration is needed with Caddy.
- Port 80 must remain open so Caddy can serve the redirect and the Let's Encrypt HTTP-01 challenge.
- Do NOT close port 80 after HTTPS is working — it is needed for redirect and certificate renewal.

---

## 12. Frontend Proxy Route Plan

| Field | Value |
|-------|-------|
| Public URL | `staging.ainow.biz` (root and all non-`/api/*` paths) |
| Internal target | `localhost:3002` |
| Service | Frontend (Next.js) |
| Protocol | HTTP (Caddy → frontend is localhost; TLS terminates at Caddy) |

### Routes Handled by Frontend

| Route Pattern | Example | Description |
|--------------|---------|-------------|
| `/` | `staging.ainow.biz/` | Root redirect (Next.js handles locale redirect) |
| `/en/*` | `staging.ainow.biz/en/platform` | English locale routes |
| `/zh-TW/*` | `staging.ainow.biz/zh-TW/platform` | Traditional Chinese routes |
| `/zh-CN/*` | `staging.ainow.biz/zh-CN/platform` | Simplified Chinese routes |
| `/_next/*` | Static assets | Next.js static files |
| Any non-`/api/*` path | Various | All other paths fall through to frontend |

### Frontend Internal Port Rules

- Frontend listens on port 3002 on the VPS.
- Port 3002 must NOT be exposed to the internet via Lightsail firewall.
- Caddy proxies all non-`/api/*` traffic to `localhost:3002`.
- Frontend receives plain HTTP from Caddy (TLS terminates at Caddy).

---

## 13. API Gateway `/api/*` Proxy Route Plan

| Field | Value |
|-------|-------|
| Public URL pattern | `staging.ainow.biz/api/*` |
| Internal target | `localhost:4000` |
| Service | API Gateway (NestJS) |
| Protocol | HTTP (Caddy → API Gateway is localhost; TLS terminates at Caddy) |

### Routes Handled by API Gateway

| Route Pattern | Example | Description |
|--------------|---------|-------------|
| `/api/health` | Health check | Basic health endpoint |
| `/api/health/db` | DB health check | Database connectivity check |
| `/api/health/ready` | Readiness check | Full readiness check |
| `/api/auth/*` | Auth endpoints | Google OAuth, session management |
| `/api/agents/*` | Agent CRUD | Create/list/detail agents |
| `/api/internal/*` | Internal service endpoints | Internal only — should not be called by external clients |
| `/api/*` (all) | All API routes | Everything under `/api/` |

### API Gateway Internal Port Rules

- API Gateway listens on port 4000 on the VPS.
- Port 4000 must NOT be exposed to the internet via Lightsail firewall.
- Caddy proxies all `/api/*` traffic to `localhost:4000`.
- API Gateway receives plain HTTP from Caddy (TLS terminates at Caddy).

### Internal API Endpoint Note

`/api/internal/*` endpoints (session lifecycle, git checkpoint ledger) are internal service-to-service endpoints. They are NOT intended for external client access. However, they share the same port 4000 and are protected by internal service key guards, not by network isolation. Future hardening could add Caddy-level path blocking for `/api/internal/*` if needed, but this is not required for initial staging.

---

## 14. Internal Service Ports That Must Remain Closed

| # | Port | Protocol | Service | Why Closed |
|---|------|----------|---------|-----------|
| 1 | 3002 | TCP | Frontend (Next.js) | Accessed only via Caddy on localhost |
| 2 | 4000 | TCP | API Gateway (NestJS) | Accessed only via Caddy on localhost |
| 3 | 4001 | TCP | AI Service Worker (NestJS) | Internal only — no external access needed |
| 4 | 4002 | TCP | Container Manager (NestJS) | Internal only — no external access needed |
| 5 | 5432 | TCP | PostgreSQL 15 | Database — localhost binding + firewall block |
| 6 | 6379 | TCP | Redis 7 | Cache/queue — localhost binding + firewall block |

### Defense-in-Depth

- **Lightsail firewall** blocks external access to all ports except 22, 80, 443.
- **Application configuration** binds PostgreSQL to `127.0.0.1` only (`pg_hba.conf` and `listen_addresses`).
- **Application configuration** binds Redis to `127.0.0.1` only (`bind 127.0.0.1` in `redis.conf`).
- **Optional UFW** on the server provides an additional OS-level firewall layer.
- Lightsail firewall is the primary enforcement. Application-level binding and optional UFW are defense-in-depth.

### Public Ports (Recap)

| # | Port | Protocol | Service |
|---|------|----------|---------|
| 1 | 22 | TCP | SSH (admin access) |
| 2 | 80 | TCP | HTTP (Caddy — redirect to HTTPS + Let's Encrypt challenge) |
| 3 | 443 | TCP | HTTPS (Caddy — reverse proxy to frontend/API) |

---

## 15. Cookie / Session / Domain Implications

### Planning Notes

| # | Implication | Notes |
|---|-------------|-------|
| 1 | staging.ainow.biz is separate from app.ainow.biz | Session cookies from staging must NOT be shared with future production |
| 2 | Cookie `Domain` attribute | If cookies are set with `Domain=.ainow.biz`, they would be shared across staging and production subdomains. Cookies should be scoped to the specific host (`staging.ainow.biz`) or omit the `Domain` attribute entirely (browser defaults to exact host) |
| 3 | `Secure` flag | Must be `true` — all traffic is HTTPS via Caddy |
| 4 | `HttpOnly` flag | Must be `true` for session cookies — prevents JavaScript access |
| 5 | `SameSite` attribute | Should be `Lax` or `Strict` — prevents CSRF via cross-site requests |
| 6 | `APP_BASE_URL` | Must be set to `https://staging.ainow.biz` on the staging server |
| 7 | `GOOGLE_CALLBACK_URL` | Must be set to `https://staging.ainow.biz/api/auth/google/callback` |
| 8 | Google OAuth redirect URI | Must be added to Google Cloud Console by Keith: `https://staging.ainow.biz/api/auth/google/callback` |
| 9 | Session persistence | Sessions are stored server-side; cookie carries session ID only |

### Cookie Domain Verification Checklist (Future)

After deployment, Keith should verify:

- [ ] Session cookies are set without `Domain=.ainow.biz` (or explicitly set to `staging.ainow.biz`).
- [ ] `Secure` flag is `true` on all session cookies.
- [ ] `HttpOnly` flag is `true` on all session cookies.
- [ ] Cookies are not leaking to `app.ainow.biz` or `ainow.biz`.

### Rules

- No env values should be printed or stored in this document.
- Cookie and session flags must be checked after deployment, not during planning.
- If cookie domain is set too broadly (`.ainow.biz`), it must be corrected before production app domain goes live.

---

## 16. CORS / Origin Implications

### Planning Notes

| # | Implication | Notes |
|---|-------------|-------|
| 1 | Allowed origins must include `https://staging.ainow.biz` | API Gateway CORS config must list this origin |
| 2 | Frontend and API share the same origin | Both served via `staging.ainow.biz` — same-origin requests do NOT require CORS headers |
| 3 | Cross-origin only applies if external clients call the API | For staging beta, only the frontend at `staging.ainow.biz` calls the API |
| 4 | `APP_BASE_URL` controls CORS allowed origins | Set to `https://staging.ainow.biz` on staging |
| 5 | No `localhost` origins in staging CORS | `localhost` origins should be removed or disabled for staging deployment |
| 6 | Credentials mode | If `credentials: 'include'` is used in fetch requests, CORS must explicitly allow `https://staging.ainow.biz` (wildcard `*` does not work with credentials) |

### Same-Origin Advantage

Because Caddy serves both the frontend and the API under the same domain (`staging.ainow.biz`), browser requests from the frontend to `/api/*` are same-origin requests. This means:

- CORS headers are technically not required for frontend → API requests.
- However, the API Gateway CORS configuration should still list `https://staging.ainow.biz` as an allowed origin for defensive correctness.
- If any future external client or mobile app needs to call the staging API, CORS must be configured.

### Frontend Public API Base URL

- The frontend must point its API calls to `https://staging.ainow.biz/api` (relative `/api` paths work because of same-origin).
- The server-side rendering (SSR) API call from Next.js may use `http://localhost:4000` (internal) since SSR runs on the same VPS.
- No env values should be printed or stored in this document.

---

## 17. DNS Propagation Expectations

| # | Item | Value |
|---|------|-------|
| 1 | Typical propagation time | **5 minutes to 4 hours** for most DNS providers |
| 2 | TTL recommendation | **300 seconds (5 minutes)** — allows fast changes if the IP needs correction |
| 3 | Global propagation | **Up to 48 hours** in rare cases (ISP-level caching) |
| 4 | Verification method | `nslookup staging.ainow.biz` or `dig staging.ainow.biz A` from external machine |
| 5 | Caddy dependency | Caddy should NOT be started until DNS propagation is confirmed |
| 6 | Initial TTL strategy | Use low TTL (300s) initially; increase to 3600s or higher after the setup is stable |

### Propagation Verification Steps (Future)

```bash
# From Keith's local machine or any external machine
nslookup staging.ainow.biz

# Expected result: returns the Lightsail static IP
# If it returns the wrong IP or NXDOMAIN, propagation is not complete

# Alternative using dig (if available)
dig staging.ainow.biz A +short
```

### Rules

- Do NOT start Caddy before DNS propagation is verified — Let's Encrypt HTTP-01 challenge will fail.
- If DNS shows the wrong IP, wait and retry.
- If DNS returns NXDOMAIN after several hours, verify the A record was created at the correct DNS provider.

---

## 18. Keith Manual DNS Actions

These actions must be performed by Keith manually at the DNS hosting provider for `ainow.biz`. They are documented here for future reference — **do not execute in this planning step.**

| # | Action | When | Prerequisite |
|---|--------|------|-------------|
| 1 | Determine DNS registrar/hosting provider for `ainow.biz` | Before any DNS change | Keith knowledge / account access |
| 2 | Log into DNS management panel | Before creating A record | Provider account access |
| 3 | Check for existing `staging` subdomain records | Before creating A record | Logged in |
| 4 | Create A record: Host/Name `staging`, Value `<Lightsail static IP>`, TTL `300` | After static IP exists | Static IP created and attached |
| 5 | Verify DNS propagation from external machine | After A record creation | A record saved |
| 6 | If Cloudflare: ensure "DNS only" (grey cloud), not "Proxied" (orange cloud) | During A record creation | Cloudflare is the DNS host |
| 7 | Confirm DNS resolves correctly before Caddy/TLS setup | After propagation | Propagation complete |

### Keith DNS Approval Requirements

- Keith must confirm DNS registrar/provider access before any DNS change is planned in detail.
- DNS A record creation requires Keith explicit approval.
- Static IP must exist and be attached before the DNS A record can be created.
- Keith should verify the A record from an external machine (not the VPS itself).

---

## 19. Validation Checks After DNS/TLS Setup

**These are future validation checks only. Do not execute them now.**

### DNS Validation

| # | Check | Command / Method | Expected Result |
|---|-------|-----------------|-----------------|
| 1 | DNS resolves staging.ainow.biz to Lightsail static IP | `nslookup staging.ainow.biz` | Returns Lightsail static IP |
| 2 | No stale/wrong DNS records | `dig staging.ainow.biz A +short` | Returns only the Lightsail static IP |

### TLS Validation

| # | Check | Command / Method | Expected Result |
|---|-------|-----------------|-----------------|
| 3 | HTTPS certificate is valid | Browser: visit `https://staging.ainow.biz` | Lock icon; certificate issued by Let's Encrypt |
| 4 | Certificate covers `staging.ainow.biz` | Browser: inspect certificate | CN or SAN includes `staging.ainow.biz` |

### HTTP → HTTPS Redirect Validation

| # | Check | Command / Method | Expected Result |
|---|-------|-----------------|-----------------|
| 5 | HTTP redirects to HTTPS | `curl -I http://staging.ainow.biz` | 301 redirect to `https://staging.ainow.biz` |

### Application Routing Validation

| # | Check | Command / Method | Expected Result |
|---|-------|-----------------|-----------------|
| 6 | `/` or `/en/platform` loads through HTTPS | Browser: `https://staging.ainow.biz/en/platform` | Page loads correctly |
| 7 | `/api/health` works through HTTPS | `curl https://staging.ainow.biz/api/health` | `{ "status": "ok" }` |
| 8 | zh-TW routes load | Browser: `https://staging.ainow.biz/zh-TW/platform` | Page loads in Traditional Chinese |
| 9 | zh-CN routes load | Browser: `https://staging.ainow.biz/zh-CN/platform` | Page loads in Simplified Chinese |

### Security Validation

| # | Check | Command / Method | Expected Result |
|---|-------|-----------------|-----------------|
| 10 | Internal service ports remain closed externally | `curl http://<static-ip>:4001` from external | Connection refused or timeout |
| 11 | PostgreSQL port closed externally | `curl http://<static-ip>:5432` from external | Connection refused or timeout |
| 12 | Redis port closed externally | `curl http://<static-ip>:6379` from external | Connection refused or timeout |

### Auth / Session Validation (After App Deployment)

| # | Check | Command / Method | Expected Result |
|---|-------|-----------------|-----------------|
| 13 | Auth/session still works | Browser: Google OAuth login at staging.ainow.biz | Login succeeds; session cookie set |
| 14 | Create Agent flow works | Browser: create agent at staging.ainow.biz | Agent created and visible in list |

Notes:
- Checks 13–14 require full app deployment and database setup — they belong to later child tasks (SETUP-07, SETUP-08).
- Checks 1–12 can be performed after DNS/TLS/Caddy setup is complete.

---

## 20. What Must NOT Happen Yet

| # | Prohibited Action | Belongs To |
|---|-------------------|-----------|
| 1 | Create DNS A record | Future execution step — requires Keith explicit approval and static IP |
| 2 | Install Caddy | Future execution step — SETUP-04 or later |
| 3 | Create Caddyfile | Future execution step — SETUP-04 or later |
| 4 | Request TLS certificate | Future — automatic when Caddy starts after DNS resolves |
| 5 | Create Lightsail instance | Future execution step — requires Keith explicit approval |
| 6 | Create static IP | Future execution step — after instance exists |
| 7 | Change firewall rules | Future execution step — after instance exists |
| 8 | SSH to any server | Future execution step — after instance exists |
| 9 | Deploy any service | SETUP-07 |
| 10 | Configure environment variables | SETUP-05 |
| 11 | Run migrations | SETUP-08 with separate explicit approval |
| 12 | Invite beta users | Separate explicit approval |
| 13 | Claim beta launch | No launch has occurred |
| 14 | Modify source/test/package/migration/entity files | Not in this planning step |
| 15 | Open/edit `.env` files or secret-bearing files | Never in planning steps |
| 16 | Git commit or git push | Not in this planning step |
| 17 | Production domain cutover | Not in SETUP-03 scope |

---

## 21. PASS / BLOCKED Criteria

### PASS — Step 2 passes if ALL of the following are recorded:

- [ ] `staging.ainow.biz` as staging domain.
- [ ] `app.ainow.biz` as future production app domain.
- [ ] `ainow.biz` as future root/marketing domain.
- [ ] DNS A record plan documented.
- [ ] Lightsail static IP dependency documented.
- [ ] Caddy reverse proxy plan documented.
- [ ] Let's Encrypt TLS plan documented.
- [ ] HTTP → HTTPS redirect plan documented.
- [ ] Frontend route plan documented.
- [ ] API Gateway `/api/*` route plan documented.
- [ ] Internal service ports that must remain closed documented.
- [ ] Cookie / session / domain implications documented.
- [ ] CORS / origin implications documented.
- [ ] DNS propagation expectations documented.
- [ ] Keith manual DNS actions documented.
- [ ] Validation checks documented.
- [ ] No DNS/TLS/Caddy/server action occurred during this step.

### BLOCKED — Step 2 is BLOCKED if ANY of the following are true:

- [ ] Staging domain is unresolved.
- [ ] DNS host/registrar discovery plan is missing.
- [ ] Static IP dependency is unclear.
- [ ] Reverse proxy plan is unsafe (exposes internal ports).
- [ ] Internal ports would be exposed publicly.
- [ ] Cookie / session / CORS implications are not addressed.
- [ ] DNS/TLS execution is required in this step.
- [ ] Secret handling is unsafe (secrets in tracked docs or chat).

**Step 2 verdict: PASS — all criteria met. No blockers identified.**

---

## 22. Handoff to SETUP-04

| Field | Value |
|-------|-------|
| Next child task | **PRIVATE-BETA-STAGING-SETUP-04** |
| Title | **Runtime / Container Deployment Plan** |
| Scope | Plan runtime dependency installation (Node.js 20, Docker, PM2, Caddy), repo clone, service build, PM2 process configuration |
| Prerequisites | SETUP-03 PASS (this document confirms) |
| Registration | Keith must explicitly approve SETUP-04 registration |

### SETUP-04 Expected Scope

1. Plan Node.js 20 LTS installation on VPS.
2. Plan Docker Engine installation on VPS.
3. Plan PM2 installation on VPS.
4. Plan Caddy installation on VPS (may overlap with DNS/TLS execution).
5. Plan repo clone and service builds.
6. Plan PM2 ecosystem configuration.
7. Plan service startup order.
8. No runtime installation or deployment during SETUP-04 planning.

**SETUP-04 is NOT registered in this step.** Registration belongs to Step 3 (Consolidation) or a future explicit registration step.

---

## 23. Safety Boundaries

| # | Safety Boundary |
|---|----------------|
| 1 | No implementation during this step |
| 2 | No DNS changes |
| 3 | No TLS certificate requests |
| 4 | No Caddy installation or configuration |
| 5 | No AWS server/static IP/firewall/SSH action |
| 6 | No source code changes |
| 7 | No test file changes |
| 8 | No package file changes |
| 9 | No migration execution |
| 10 | No environment file editing or opening |
| 11 | No Docker/runtime startup |
| 12 | No user invitations |
| 13 | No public beta launch claims |
| 14 | No secrets opened, printed, or exposed |
| 15 | No `.env`, `.env.local`, `.env.staging`, `.env.production` opened |
| 16 | No credential, key, certificate, or token files opened |
| 17 | No destructive database commands |
| 18 | No `docker compose down -v` |
| 19 | No deployment setup or configuration changes |
| 20 | No git commit or git push |
| 21 | No subagents |
| 22 | No governance file changes (TASKS.md, TASKS_BACKLOG_FULL.md, roadmap) — governance updates belong to Step 3 |
| 23 | No API calls |
| 24 | No browser automation |
| 25 | No test or build execution |

---

## 24. Exact Next Action

**Step 2 is COMPLETE. Proceed to Step 3 — Consolidation / Handoff to SETUP-04.**

Step 3 will:

1. Update TASKS.md — mark SETUP-03 COMPLETE and LOCKED.
2. Update TASKS_BACKLOG_FULL.md — mirror status.
3. Update AINOW-EXECUTION-ROADMAP.md — mirror status.
4. Create checkpoint document: `docs/PRIVATE-BETA-STAGING-SETUP-03-CHECKPOINT.md`.
5. Hand off to SETUP-04 registration (Keith explicit approval required).

**Keith must explicitly say "go" or equivalent before Step 3 (Consolidation) begins.**

No DNS changes. No TLS certificate requested. No Caddy installed or configured. No AWS/server/static IP/firewall/SSH action. No implementation. No deployment. No migration execution. No user invitations. No secrets. No subagents. No governance file changes.

---

**Document created:** 2026-07-21
**Step 2 status:** Domain / DNS / TLS Plan CREATED.
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
