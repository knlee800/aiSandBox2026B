# PRIVATE-BETA-STAGING-EXECUTION-04H — Public Routing / DNS / TLS Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04H  
**Title:** Public Routing / DNS / TLS Baseline  
**Step:** 2 — Public Routing / DNS / TLS Runbook  
**Date:** 2026-07-29  
**Nature:** Runbook for Keith manual execution (Lightsail browser SSH + DNS provider panel). Documentation/runbook creation only in Cursor. No SSH/AWS action in Cursor. No DNS/TLS/Caddy changes in Cursor. No env files opened/created/edited. No secrets disclosed. No subagents used.

---

## 1. Task identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04H |
| Title | Public Routing / DNS / TLS Baseline |
| Step | 2 — Public Routing / DNS / TLS Runbook |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Predecessors | PRIVATE-BETA-STAGING-EXECUTION-04G COMPLETE and LOCKED — 2026-07-29; PRIVATE-BETA-STAGING-EXECUTION-04F / 04F1 COMPLETE and LOCKED — 2026-07-29; PRIVATE-BETA-STAGING-EXECUTION-04D COMPLETE and LOCKED — 2026-07-27; PRIVATE-BETA-STAGING-EXECUTION-04E COMPLETE and LOCKED — 2026-07-27; PRIVATE-BETA-STAGING-SETUP-03 COMPLETE and LOCKED — 2026-07-21; PRIVATE-BETA-STAGING-EXECUTION-02 COMPLETE and LOCKED — 2026-07-24 (Caddy v2.11.4 installed); PRIVATE-BETA-STAGING-EXECUTION-01 COMPLETE and LOCKED — 2026-07-23 (static IP + firewall 22/80/443) |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — public routing / DNS / TLS baseline (runbook now; manual discovery + approved config later) |
| Risk | HIGH — 04H may affect public access and TLS issuance; incorrect DNS/Caddy/TLS changes can break public routing or certificate issuance |
| Registered | 2026-07-29 |
| Step 1 | COMPLETE (Registration — 2026-07-29) |
| Current step | Step 2 — this runbook |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Static IP name (prior evidence) | `aisandbox-staging-ip` (attached — EXECUTION-01) |
| Operator | Keith |
| Runbook for | Keith — manual execution inside AWS Lightsail browser SSH and DNS provider panel only |
| Source DNS/TLS plan | `docs/PRIVATE-BETA-STAGING-SETUP-03-DNS-TLS-PLAN.md` (COMPLETE and LOCKED) |
| Future evidence review | Later 04H evidence review step (not this document) |
| Future checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-CHECKPOINT.md` (does not exist yet) |
| 04G checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04G-CHECKPOINT.md` |
| 04G evidence review | `docs/PRIVATE-BETA-STAGING-EXECUTION-04G-REBOOT-PERSISTENCE-VALIDATION-EVIDENCE-REVIEW.md` — verdict PASS |
| 04F checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04F-CHECKPOINT.md` |
| 04E checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-CHECKPOINT.md` |
| 04D checkpoint | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-CHECKPOINT.md` |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

### Authoritative state carried forward

* PRIVATE-BETA-STAGING-EXECUTION-04H is ACTIVE — Step 1 COMPLETE (Registration — 2026-07-29).
* PRIVATE-BETA-STAGING-EXECUTION-04G is COMPLETE and LOCKED — 2026-07-29.
* PM2/systemd boot persistence is reboot-proven.
* Parent PRIVATE-BETA-STAGING-EXECUTION-04 remains ACTIVE.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.
* Public routing / DNS / TLS is not yet configured.
* Source-grounded hostname from SETUP-03 / registration evidence: `staging.ainow.biz`.
* Caddy v2.11.4 was installed in EXECUTION-02; default Caddyfile had no `staging.ainow.biz` site entry at that time.
* Lightsail firewall was intended to expose 22/80/443 only (EXECUTION-01).

### Evidence carried forward from 04G

```text
04G reboot persistence validation passed:
- reboot was approved by Keith.
- sudo reboot was run.
- instance rebooted and Lightsail browser SSH reconnected.
- uptime changed from 5 days to 1 min.
- pm2-ubuntu enabled and active after reboot.
- systemd Result=success after reboot.
- pm2 resurrect exited 0/SUCCESS.
- PM2_DUMP_PRESENT=yes.
- pm2 ping=pong.
- all four apps online/ok after reboot:
  - aisandbox-api-gateway
  - aisandbox-ai-service
  - aisandbox-container-manager
  - aisandbox-frontend
- health-only smoke passed after reboot:
  - API_HEALTH=200
  - API_DB_HEALTH=200
  - API_READY=200
  - CONTAINER_HEALTH=200
  - FRONTEND_ROOT=307 accepted as locale redirect
- public table count remained 26.
- no PM2 recovery commands were needed.
- no secrets printed.
- no DNS/TLS.
- no AI execution.
- no billing/payment execution.
- no container workflow beyond health check.
- no Google OAuth enablement.
```

---

## 2. Purpose

Safely prepare and validate public routing for staging through Caddy, DNS, and TLS after PM2/systemd boot persistence is reboot-proven.

This runbook tells Keith exactly what to discover, approve, configure, and validate manually during the later EXECUTION-04H manual validation step.

This Cursor step creates the runbook only. It does **not** SSH, use AWS CLI, edit DNS records, configure/reload Caddy, request TLS certificates, open ports, reboot, run PM2/systemd commands, open `.env`, print secrets, or start/stop services.

**Runtime impact warning:** 04H may affect public access and TLS issuance. All DNS record changes, Caddy config writes/reloads, and TLS-triggering public routing changes require Keith explicit approval before execution.

---

## 3. Source-grounded target hostname

| Field | Value |
|-------|-------|
| Source-grounded hostname | **`staging.ainow.biz`** |
| Source documents | `docs/PRIVATE-BETA-STAGING-SETUP-03-DNS-TLS-PLAN.md` (COMPLETE and LOCKED); SETUP-03 checkpoint; 04H registration |
| Future production app URL (out of scope) | `app.ainow.biz` — do not configure in 04H |
| Future root / marketing domain (out of scope) | `ainow.biz` — do not cut over in 04H |
| Domain separation | `staging.ainow.biz` must NOT be used as production |

### Hostname conflict rule

* The intended hostname must remain source-grounded as `staging.ainow.biz`.
* If hostname/source conflict is found (different hostname in env, docs, or existing Caddyfile), **stop** and record a decision point.
* Do not invent or switch to another hostname in 04H without a separate approved decision slice.

---

## 4. What 04H validates

04H validates public routing / DNS / TLS baseline only:

1. Pre-change local PM2/systemd/health/safe-state baseline remains healthy (public table count `26`).
2. Source-grounded hostname `staging.ainow.biz` is confirmed against SETUP-03.
3. Caddy discovery completes safely (version, systemd state, existing Caddyfile summary, validate).
4. DNS discovery completes safely (A/AAAA/CNAME / public HTTP/HTTPS probes may fail before config — expected).
5. Firewall / public port state is reviewed against intended 22/80/443 exposure.
6. Keith explicitly approves DNS record change before any DNS edit.
7. Keith explicitly approves Caddy public route write/reload before any Caddy config change.
8. Keith explicitly approves TLS-triggering public validation before proceeding.
9. Controlled DNS A record for `staging` → Lightsail static IP is applied only after approval.
10. Controlled Caddy route for `staging.ainow.biz` proxies `/api/*` → `127.0.0.1:4000` and frontend → `127.0.0.1:3002` only after approval and validate-before-reload.
11. TLS works for `https://staging.ainow.biz` (Let's Encrypt via Caddy).
12. Public HTTPS health-only smoke passes for API health endpoints; frontend root returns 2xx/3xx.
13. Local health and PM2/systemd remain healthy after public routing changes.
14. No secrets printed; no AI / billing / container-workflow / Google OAuth enablement; no migrations; no source changes.
15. Safe evidence is captured for later 04H evidence review.

---

## 5. What 04H does not validate

04H must **not** claim or perform:

* Browser login / register / workspace / Create Agent flows
* AI execution enablement or paid AI calls
* Billing / payment execution enablement
* Container execution workflows beyond Container Manager health endpoint
* Google OAuth enablement
* Migrations or schema changes
* Source code / package / lockfile changes
* `.env` creation, editing, or printing
* Marking PRIVATE-BETA-DEPLOYMENT-READINESS ready
* Completing parent PRIVATE-BETA-STAGING-EXECUTION-04
* Production domain cutover (`app.ainow.biz` / `ainow.biz`)
* Broad recovery, destructive cleanup, firewall disable, or Caddy cert-storage deletion
* Installing tools solely for DNS checking unless a later step explicitly approves it
* Changing Lightsail firewall rules unless evidence proves a mismatch and Keith explicitly approves

---

## 6. Preconditions

Before any 04H manual change:

| # | Precondition | Status / note |
|---|--------------|---------------|
| 1 | 04H Step 1 Registration COMPLETE | Yes — 2026-07-29 |
| 2 | 04G COMPLETE and LOCKED; reboot persistence proven | Yes — 2026-07-29 |
| 3 | Local four PM2 apps online; health-only smoke PASS | Re-verify in §10 before changes |
| 4 | Public table count `26` | Re-verify in §10 |
| 5 | `pm2-ubuntu` enabled/active; systemd Result=success; dump present | Re-verify in §10 |
| 6 | Source-grounded hostname is `staging.ainow.biz` | SETUP-03 COMPLETE and LOCKED |
| 7 | Caddy installed (EXECUTION-02: v2.11.4) | Re-discover in §11; do not install unless later step scopes it |
| 8 | Static IP `aisandbox-staging-ip` attached (EXECUTION-01) | Required before DNS A record |
| 9 | Lightsail firewall intended 22/80/443 only | Re-verify in §13; do not change unless mismatch + Keith approval |
| 10 | Keith can access DNS provider panel for `ainow.biz` | Required before DNS change; may be outside SSH |
| 11 | Keith explicit approvals for DNS / Caddy / TLS gates | Required before each gated action (§14) |
| 12 | No `.env` / secret printing planned | Mandatory |

---

## 7. Lightsail browser SSH instruction

All VPS commands in this runbook are for **AWS Lightsail browser SSH** on instance `aisandbox-staging` (not PowerShell, not Cursor, not local Windows).

Operator sequence for later manual execution:

1. Open AWS Lightsail console for `aisandbox-staging` (Singapore / ap-southeast-1).
2. Connect with **browser SSH**.
3. Run discovery and baseline commands from this runbook.
4. Stop at each Keith approval gate before DNS, Caddy write/reload, or TLS-triggering public validation.
5. Capture only safe evidence into the template in §25.
6. DNS A record creation is performed in the DNS provider panel (may be outside SSH), not via Cursor/AWS CLI in this slice unless a later approved step says otherwise.

Do not use Cursor to SSH, run AWS CLI, or apply DNS/Caddy/TLS changes during this documentation step.

---

## 8. Secret safety rules

Mandatory for all 04H operator work:

* No DNS provider secrets, API keys, cert private keys, `.env`, or env values may be printed.
* Do not run `env`, `printenv`, `cat .env`, `echo $DATABASE_URL`, `echo $REDIS_URL`, or any secret-printing command.
* Do not open `.env`, `.env.local`, `.env.staging`, `.env.production`, credentials, keys, certificates, token files, cookies, session dumps, database dumps, AWS keys, SSH private keys, DNS provider credentials, or Caddy private key material.
* Do not print private key files under Caddy storage.
* Do not list certificate private key contents.
* Review Caddyfile output before sharing if it unexpectedly contains secrets.
* Evidence may include hostnames, HTTP status codes, DNS record types/values that are public (A/AAAA/CNAME targets that are public IPs), systemd/PM2 status, and approval tokens — never secret values.

---

## 9. Runtime/public-routing impact warning

**04H may affect public access and TLS issuance.**

| Change type | Impact |
|-------------|--------|
| DNS A record for `staging.ainow.biz` | Makes hostname resolve publicly to the staging instance |
| Caddy site config write/reload | Changes how public HTTP/HTTPS traffic is routed |
| TLS issuance (Let's Encrypt HTTP-01) | Requires public port 80 reachability and correct DNS; may fail and leave partial public state |
| Firewall mismatch / accidental exposure | Could expose internal ports if incorrectly changed |

Rules:

* Keith approval is required before any DNS record change.
* Keith approval is required before any Caddy config write/reload.
* Keith approval is required before any TLS-triggering public routing change.
* If public routing/TLS fails, stop and capture safe evidence only.
* Any rollback must be explicit, bounded, and approved before execution.
* Do not mark PRIVATE-BETA-DEPLOYMENT-READINESS ready from 04H alone.

---

## 10. Pre-change local baseline verification

Run these commands in Lightsail browser SSH **before** any DNS or Caddy change.

### 10.1 Identity and safe-state

```bash
date
uptime
whoami
hostname

cd /opt/aisandbox
git status --short
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu
SYSTEMD_PAGER=cat systemctl show pm2-ubuntu -p Type -p ActiveState -p SubState -p Result -p Restart -p MainPID -p PIDFile -p User

test -f /home/ubuntu/.pm2/dump.pm2 && echo "PM2_DUMP_PRESENT=yes" || echo "PM2_DUMP_PRESENT=no"

pm2 ping
pm2 list
```

### 10.2 Four-app check

```bash
pm2 jlist | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const p=JSON.parse(s); for (const name of ['aisandbox-api-gateway','aisandbox-ai-service','aisandbox-container-manager','aisandbox-frontend']) { const rows=p.filter(x=>x.name===name); const r=rows[0]; console.log(name + '=' + (rows.length===1 && r.pm2_env.status==='online' ? 'ok' : 'CHECK') + ' count=' + rows.length + ' status=' + (r?.pm2_env?.status||'missing') + ' restarts=' + (r?.pm2_env?.restart_time ?? 'missing')); } })"
```

### 10.3 Local health-only checks

```bash
curl -sS -o /dev/null -w "API_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health
curl -sS -o /dev/null -w "API_DB_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health/db
curl -sS -o /dev/null -w "API_READY=%{http_code}\n" http://127.0.0.1:4000/api/health/ready
curl -sS -o /dev/null -w "CONTAINER_HEALTH=%{http_code}\n" http://127.0.0.1:4002/api/health
curl -sS -o /dev/null -w "FRONTEND_ROOT=%{http_code}\n" http://127.0.0.1:3002/
```

### Expected local baseline

```text
git status --short: no output
public table count: 26
pm2-ubuntu: enabled
pm2-ubuntu: active
systemd Result: success
PM2_DUMP_PRESENT=yes
pm2 ping: pong
all four apps: ok / online
API_HEALTH=200
API_DB_HEALTH=200
API_READY=200
CONTAINER_HEALTH=200
FRONTEND_ROOT=307 or other 2xx/3xx
```

If pre-change local baseline fails, **stop**. Do not proceed to DNS or Caddy changes.

---

## 11. Caddy discovery

Safe discovery only — do not write or reload Caddy yet.

```bash
caddy version
systemctl is-enabled caddy || true
systemctl is-active caddy || true
SYSTEMD_PAGER=cat systemctl status caddy --no-pager -l | head -80 || true
sudo caddy validate --config /etc/caddy/Caddyfile || true
sudo sed -n '1,220p' /etc/caddy/Caddyfile
```

### Caddy discovery warnings

* Review Caddyfile output before sharing if it unexpectedly contains secrets.
* Do not print private key files under Caddy storage.
* Do not list certificate private key contents.
* Prior EXECUTION-02 evidence: Caddy v2.11.4 installed; service active; default Caddyfile had no `staging.ainow.biz` entry; no TLS issued yet. Reconfirm current state — do not assume unchanged.
* If Caddy is not installed or not active and this runbook did not scope installation, **stop**.
* If existing Caddyfile contains unexpected routes that would be overwritten, **stop** and record a decision point.

---

## 12. DNS discovery

Safe DNS checks only — do not change DNS yet.

```bash
getent hosts staging.ainow.biz || true
dig +short staging.ainow.biz A || true
dig +short staging.ainow.biz AAAA || true
dig +short staging.ainow.biz CNAME || true
curl -sS -o /dev/null -w "HTTP_PUBLIC=%{http_code}\n" http://staging.ainow.biz/ || true
curl -k -sS -o /dev/null -w "HTTPS_PUBLIC_INSECURE=%{http_code}\n" https://staging.ainow.biz/ || true
```

### DNS discovery rules

* If `dig` is unavailable, use `getent hosts staging.ainow.biz` and skip `dig`.
* Do not install tools just for DNS checking in 04H unless a later step explicitly approves it.
* Public checks may fail before configuration; that is expected.
* DNS target must be the attached Lightsail static IP (`aisandbox-staging-ip`). Do not point DNS at a temporary/changing public IP.
* If DNS is hosted at Cloudflare, future A record must be **DNS only** (grey cloud), not Proxied (orange cloud), so Caddy Let's Encrypt HTTP-01 can succeed.
* If DNS target is unclear, **stop**.
* DNS provider login/secret values must never be pasted into evidence.

---

## 13. Firewall / public port verification

```bash
sudo ss -ltnp | grep -E ':(80|443|3002|4000|4002)\b' || true
sudo ufw status verbose || true
```

### Prior intended state (carry forward)

* Lightsail firewall was intended to expose **22/80/443 only** (EXECUTION-01).
* Internal ports 3002, 4000, 4001, 4002, 5432, 6379 must remain closed externally.
* Do not change firewall rules in 04H unless the runbook evidence proves a mismatch and Keith explicitly approves.
* If firewall state contradicts expected 80/443 exposure, **stop** and record evidence; do not widen exposure casually.

---

## 14. Keith approval gates

Do not proceed past these gates without Keith’s exact approval tokens.

### Gate A — DNS

```text
STOP. Do not change DNS until Keith explicitly approves:

go — approve 04H DNS record change
```

### Gate B — Caddy

```text
STOP. Do not write/reload Caddy until Keith explicitly approves:

go — approve 04H Caddy public route change
```

### Gate C — TLS public validation

```text
STOP. Do not proceed with TLS-triggering public validation until Keith explicitly approves:

go — approve 04H TLS public validation
```

### Approval order (recommended)

1. Complete §§10–13 discovery and record safe evidence.
2. Obtain Gate A before DNS record change.
3. Confirm DNS resolves to the static IP (propagation may take minutes to hours).
4. Obtain Gate B before Caddyfile write + validate + reload.
5. Obtain Gate C before treating TLS issuance / public HTTPS health smoke as in-scope validation.
6. If any gate is refused or unclear, **stop**.

---

## 15. Controlled Caddy configuration plan

**Future plan only — do not apply in Step 2 (this Cursor documentation step).**  
Later manual execution applies only after Gate B approval and after reviewing the live Caddyfile.

### Candidate Caddy route (intent)

```text
staging.ainow.biz {
    encode gzip zstd

    handle /api/* {
        reverse_proxy 127.0.0.1:4000
    }

    handle {
        reverse_proxy 127.0.0.1:3002
    }
}
```

### Caddy plan rules

* This candidate must be reviewed against existing Caddyfile before use.
* Do not overwrite existing Caddyfile blindly.
* Preserve existing comments/routes unless a later step explicitly scopes replacement.
* Validate Caddy config before reload (`sudo caddy validate --config /etc/caddy/Caddyfile`).
* Reload only after approval (Gate B).
* If Caddy validation fails, **stop**.
* If Caddy reload fails, **stop**.
* Do not expose ports 4001, 4002, 5432, or 6379 via Caddy.
* TLS for the site block is expected via Caddy automatic HTTPS (Let's Encrypt) once DNS resolves and ports 80/443 are reachable — subject to Gate C.
* Preferred internal targets: API Gateway `127.0.0.1:4000`, frontend `127.0.0.1:3002` (aligned with SETUP-03 and current PM2 ports).

### Suggested later operator sequence (after Gate B only)

1. Back up current Caddyfile path knowledge (copy method must avoid printing secrets; record only that a backup was made).
2. Merge candidate carefully into `/etc/caddy/Caddyfile` without destroying unrelated config.
3. `sudo caddy validate --config /etc/caddy/Caddyfile`
4. If validate PASS, reload Caddy via the approved systemd/caddy reload method for this host.
5. If validate or reload fails, stop and capture safe evidence — do not force-overwrite further.

Exact reload command is operator-confirmed against the live unit (commonly `sudo systemctl reload caddy`); do not invent alternate destructive restart/recovery paths in 04H.

---

## 16. Controlled DNS record plan

**Future plan only — do not apply until Gate A.**

### Planned record (from SETUP-03)

```text
Type:         A
Host/Name:    staging
Value/Target: <Lightsail static IP for aisandbox-staging-ip — known privately to Keith; do not paste secrets>
TTL:          300 seconds (5 minutes) if configurable; otherwise provider default
```

### DNS plan rules

* Create the A record only at the provider that hosts DNS for `ainow.biz`.
* Static IP must remain attached to `aisandbox-staging`.
* Only one A record for `staging` should exist; remove conflicting AAAA/CNAME for the same name only if explicitly approved and safe.
* If Cloudflare: set **DNS only** (grey cloud), not Proxied.
* Do not print DNS provider credentials or API tokens.
* If DNS change needs provider access not available in SSH, perform it in the provider panel after Gate A — still in 04H operator scope, not Cursor.
* After creation, re-run §12 discovery until A resolves to the static IP (or stop if stuck after reasonable propagation wait).

---

## 17. TLS issuance / validation plan

**Future plan only — subject to Gate C and successful DNS + Caddy.**

| Field | Plan |
|-------|------|
| Provider | Let's Encrypt via Caddy automatic HTTPS |
| Challenge | HTTP-01 on port 80 |
| Hostname | `staging.ainow.biz` |
| HTTP→HTTPS | Caddy default redirect expected |
| Cert storage | Caddy internal data directory — do not print private keys |

### TLS prerequisites

1. DNS A for `staging.ainow.biz` resolves to the attached static IP.
2. Ports 80 and 443 reachable publicly per Lightsail firewall intent.
3. Caddy site block references `staging.ainow.biz`.
4. No unexpected competing binder on 80/443.
5. Gate C approved before treating TLS public validation as in-scope.

### TLS failure rule

If TLS issuance fails, **stop** and capture safe evidence only. Do not delete Caddy cert storage. Do not spam re-issuance. Do not mark 04H PASS.

---

## 18. Public HTTPS health-only smoke

After DNS + Caddy + TLS path is approved and configured, run:

```bash
curl -sS -o /dev/null -w "PUBLIC_HTTP_ROOT=%{http_code}\n" http://staging.ainow.biz/
curl -sS -o /dev/null -w "PUBLIC_HTTPS_ROOT=%{http_code}\n" https://staging.ainow.biz/
curl -sS -o /dev/null -w "PUBLIC_HTTPS_API_HEALTH=%{http_code}\n" https://staging.ainow.biz/api/health
curl -sS -o /dev/null -w "PUBLIC_HTTPS_API_DB_HEALTH=%{http_code}\n" https://staging.ainow.biz/api/health/db
curl -sS -o /dev/null -w "PUBLIC_HTTPS_API_READY=%{http_code}\n" https://staging.ainow.biz/api/health/ready
```

### Expected

```text
PUBLIC_HTTPS_API_HEALTH=200
PUBLIC_HTTPS_API_DB_HEALTH=200
PUBLIC_HTTPS_API_READY=200
PUBLIC_HTTPS_ROOT=2xx/3xx, with locale redirect acceptable
```

### Public smoke rules

* Public frontend root may redirect, and 2xx/3xx is acceptable.
* Public API health endpoints should return 200.
* `PUBLIC_HTTP_ROOT` may be a redirect to HTTPS (2xx/3xx acceptable depending on Caddy redirect behavior); record the code.
* Do not run login, billing, AI, container execution, or OAuth flows in 04H.
* If public HTTPS health checks fail, **stop** and capture safe evidence.

---

## 19. Final safe-state verification

After public smoke (or after stop), re-verify local safe state:

```bash
cd /opt/aisandbox
git status --short
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

systemctl is-enabled pm2-ubuntu
systemctl is-active pm2-ubuntu

pm2 ping
# optional: re-run four-app check from §10.2

curl -sS -o /dev/null -w "API_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health
curl -sS -o /dev/null -w "API_DB_HEALTH=%{http_code}\n" http://127.0.0.1:4000/api/health/db
curl -sS -o /dev/null -w "API_READY=%{http_code}\n" http://127.0.0.1:4000/api/health/ready
curl -sS -o /dev/null -w "CONTAINER_HEALTH=%{http_code}\n" http://127.0.0.1:4002/api/health
curl -sS -o /dev/null -w "FRONTEND_ROOT=%{http_code}\n" http://127.0.0.1:3002/
```

Expected: local health still PASS; `pm2-ubuntu` enabled/active; public table count still `26`; git status still clean (no output) unless a separate approved change occurred (04H should not change source).

---

## 20. Pass criteria

04H manual validation may PASS only if **all** of the following are true:

* Source-grounded hostname confirmed as `staging.ainow.biz`.
* Pre-change local baseline matched expected values.
* Keith approvals recorded for DNS, Caddy, and TLS public validation gates used.
* Public DNS routes `staging.ainow.biz` to the staging static IP.
* Caddy routes `/api/*` → `127.0.0.1:4000` and frontend → `127.0.0.1:3002`.
* TLS works for `https://staging.ainow.biz`.
* Public HTTPS API health endpoints return 200.
* Public HTTPS root returns 2xx/3xx.
* Local health remains passing; PM2/systemd remains healthy; public table count remains 26.
* No secrets printed.
* No AI / billing / container / Google OAuth enablement.
* No migrations; no source/env changes.
* Safe evidence template completed for evidence review.
* Parent 04 remains ACTIVE; PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

---

## 21. Stop conditions

Stop immediately and capture safe evidence if any of the following occur:

* Target hostname is not source-grounded.
* DNS target is unclear.
* Caddy is not installed or active and runbook did not scope installation.
* Existing Caddyfile contains unexpected routes that would be overwritten.
* Caddy validation fails.
* Caddy reload fails.
* TLS issuance fails.
* Public HTTPS health checks fail.
* Pre-change local health checks fail.
* PM2/systemd baseline is not healthy.
* Public table count is not 26.
* Any command would print `.env`, credentials, cert private keys, DNS provider secrets, or token values.
* DNS change needs provider access not available and cannot be completed safely in the provider panel with Gate A.
* Firewall state contradicts expected 80/443 exposure (and no explicit Keith approval to remediate within 04H scope).
* AI execution is attempted.
* Billing/payment execution is attempted.
* Container workflow is attempted beyond health check.
* Google OAuth enablement is attempted.
* Source code or migration changes are suggested.
* Destructive cleanup is suggested.

---

## 22. Recovery / rollback boundary

* 04H does not include broad recovery.
* If DNS/Caddy/TLS validation fails, stop and capture safe evidence.
* Do not blindly remove Caddy configs.
* Do not delete Caddy cert storage.
* Do not disable firewall.
* Do not run destructive cleanup.
* Any rollback must be explicit, minimal, and approved.
* Failed 04H execution should trigger a separate bounded recovery slice if needed.

---

## 23. No AI/billing/container/OAuth confirmation

04H confirms and requires:

* Do not enable AI execution.
* Do not enable billing/payment execution.
* Do not enable container execution workflows.
* Do not enable Google OAuth.
* Do not run migrations.
* Do not modify source code.
* Do not mark PRIVATE-BETA-DEPLOYMENT-READINESS ready.

Health-only local and public API health checks are in scope. Login, register, workspace, Create Agent, AI execute, billing checkout, container start workflows, and OAuth are out of scope.

---

## 24. No secret printing confirmation

Operator evidence for 04H must confirm:

* No `.env` values printed.
* No DNS provider secrets printed.
* No cert private keys printed.
* No `env` / `printenv` / `cat .env` / `echo $DATABASE_URL` / `echo $REDIS_URL` used.
* Caddyfile reviewed for unexpected secrets before sharing.
* Safe status codes, PM2/systemd states, and public DNS answers only.

---

## 25. Safe evidence template

```text
04H Public Routing / DNS / TLS Evidence

Source-grounded hostname:
- hostname:
- source doc:

Pre-change local baseline:
- date:
- uptime:
- git status --short:
- public table count:
- pm2-ubuntu enabled:
- pm2-ubuntu active:
- systemd Result:
- PM2_DUMP_PRESENT:
- pm2 ping:
- four-process check:
- API_HEALTH:
- API_DB_HEALTH:
- API_READY:
- CONTAINER_HEALTH:
- FRONTEND_ROOT:

Caddy discovery:
- caddy version:
- caddy enabled:
- caddy active:
- caddy validate before change:
- existing Caddyfile summary:

DNS discovery:
- staging.ainow.biz A:
- staging.ainow.biz AAAA:
- staging.ainow.biz CNAME:
- pre-change public HTTP:
- pre-change public HTTPS:

Approvals:
- Keith approved DNS change:
- Keith approved Caddy route change:
- Keith approved TLS public validation:

Execution:
- DNS record changed:
- Caddy config changed:
- Caddy validate after change:
- Caddy reload result:
- TLS issuance/HTTPS result:

Public health-only smoke:
- PUBLIC_HTTP_ROOT:
- PUBLIC_HTTPS_ROOT:
- PUBLIC_HTTPS_API_HEALTH:
- PUBLIC_HTTPS_API_DB_HEALTH:
- PUBLIC_HTTPS_API_READY:

Final safe state:
- local API_HEALTH:
- local API_DB_HEALTH:
- local API_READY:
- local CONTAINER_HEALTH:
- local FRONTEND_ROOT:
- pm2-ubuntu enabled:
- pm2-ubuntu active:
- public table count:
- git status --short:

Safety/non-goals:
- no .env values or secrets printed:
- no DNS provider secrets printed:
- no cert private keys printed:
- no AI execution:
- no billing/payment execution:
- no container workflow beyond health:
- no Google OAuth:
- no source/migration/env changes:

Warnings/errors:
- none / details:
```

---

## 26. Expected final state

After later manual validation (not this Cursor step):

* `staging.ainow.biz` is source-grounded and confirmed.
* Public DNS routes to the staging instance.
* Caddy routes:
  * `/api/*` to API Gateway on `127.0.0.1:4000`
  * frontend root to `127.0.0.1:3002`
* TLS works for `https://staging.ainow.biz`.
* Public HTTPS API health endpoints pass.
* Public frontend root returns 2xx/3xx.
* Local health remains passing.
* PM2/systemd remains healthy.
* Public table count remains 26.
* No secrets printed.
* No AI/billing/container/OAuth enablement.
* 04H ready for evidence review.
* Parent 04 remains ACTIVE until 04H consolidation.
* PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED.

---

## 27. Exact next action

**Step 2 (this runbook) is COMPLETE when this document exists with all required sections.**

Exact next recommended action:

```text
Proceed to PRIVATE-BETA-STAGING-EXECUTION-04H Step 3 — Manual Public Routing / DNS / TLS Validation + Evidence
(Keith operator execution in AWS Lightsail browser SSH + DNS provider panel)

Before any change:
1. Run §10 pre-change local baseline.
2. Run §§11–13 discovery.
3. Stop for Gate A / Gate B / Gate C approvals as listed in §14.
4. Capture evidence with §25 template.
5. Do not mark PRIVATE-BETA-DEPLOYMENT-READINESS ready.
```

Keith must explicitly say `go` (or the gate-specific approval tokens in §14) before DNS change, Caddy write/reload, or TLS-triggering public validation.

No DNS change in this Cursor step.  
No Caddy config write/reload in this Cursor step.  
No TLS certificate request in this Cursor step.  
No SSH / AWS CLI / firewall / PM2 / systemd / reboot in this Cursor step.  
No `.env` opened or printed.  
No source / migration / TASKS / backlog / roadmap changes in this Cursor step.  
No git commit or push.  
No subagents.

---

**Document created:** 2026-07-29  
**Step 2 status:** Public Routing / DNS / TLS Runbook CREATED.  
**No DNS/TLS/Caddy/server action occurred in Cursor.**  
**No env values printed.**  
**No subagents used.**
