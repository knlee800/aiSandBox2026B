# PRIVATE-BETA-OPS-01-CHECKPOINT.md
## PRIVATE-BETA-OPS-01 — Minimal Operational Visibility Baseline — Consolidation Checkpoint

**Task ID:** PRIVATE-BETA-OPS-01  
**Title:** Minimal Operational Visibility Baseline  
**Status:** COMPLETE AND LOCKED — 2026-08-10  
**Family:** PRIVATE BETA / OPERATIONS / OBSERVABILITY / INCIDENT VISIBILITY  
**Nature:** BOUNDED OPERATIONS / OBSERVABILITY READINESS  
**Workflow:** 4-step HIGH-risk operational lifecycle (with Step 2A architecture correction; Step 3 split into 3A implementation + 3B staging smoke)  
**Closed:** 2026-08-10  
**Predecessor:** GOV-PRD-01 COMPLETE AND LOCKED — 2026-08-10 — Checkpoint: `docs/GOV-PRD-01-CHECKPOINT.md`  
**Stage-start:** `docs/PRIVATE-BETA-OPS-01-STAGE-START.md`  
**Author:** Cursor / Grok 4.5 (Step 4 consolidation only)

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-OPS-01 |
| Title | Minimal Operational Visibility Baseline |
| Priority | P1 — required before controlled Builder AI execution activation and before PRIVATE-BETA-INVITE-01 |
| Risk | HIGH — staging runtime, notification path, operator visibility |
| Cohort | Builder-first private beta — approximately 1–3 trusted users |
| Execution gating | `GLOBAL_EXECUTION_ENABLED=false` throughout (unchanged) |
| Invite posture | PRIVATE-BETA-INVITE-01 remains untouched / unregistered |

---

## 2. Purpose

Deliver the smallest safe operational baseline so that if a critical ainow.biz / Builder staging service crashes, becomes unhealthy, or becomes unavailable during early trusted-Builder beta, Keith receives practical notification quickly enough to respond — without requiring continuous manual SSH watching, and without building an enterprise observability platform.

---

## 3. Initial Operational Risk

Before PRIVATE-BETA-OPS-01:

- Existing health endpoints, runtime metrics, PM2 state, and structured logs provided **passive** visibility only.
- Phase 60A/60B produced **documentation/design/runbooks only** — no alert evaluation or notification implementation.
- PM2 auto-restarted crashed processes but sent **no active notification** to Keith.
- Redis/BullMQ failure was invisible in queryable health surfaces.
- AI Service had no HTTP health controller (only `/metrics` liveness and PM2 status).
- A silent full or partial outage during 1–3 user beta was an unacceptable operator risk.

---

## 4. Step 2 Audit Findings

Step 2 (`docs/PRIVATE-BETA-OPS-01-STAGE-START.md`) completed a read-only audit on 2026-08-10. Key findings:

| Area | Finding |
|------|---------|
| API Gateway health | `/api/health` liveness; `/api/health/db` DB check; `/api/health/ready` highest-value readiness (env + DB + kill-switch/config) |
| container-manager health | Process liveness only (`/api/health`); internal port |
| AI Service health | **No HealthController**; `/metrics` exists as liveness signal |
| Frontend health | No dedicated endpoint; public URL reachability only |
| Runtime metrics (41A) | Useful passive session/Docker/DB signals; not an active alert path |
| PM2 | Passive restart/crash tracking; **zero outbound notification** |
| Phase 60A/60B | **Documentation / design / runbooks only** — alert evaluation NOT implemented |
| Prometheus/Grafana | Config present; **not running on staging PM2 deployment** |
| Resend | Already configured for auth email; **not used for operator alerts** |
| Recurring monitors | No active outage notification job existed |

**Critical gap:** no active notification path — Keith could not learn of a crash/outage without manually SSHing.

---

## 5. Step 2A Architecture Correction

Step 2 initially recommended an in-process API Gateway `OperatorAlertService`.

**Verdict: INSUFFICIENT / REJECTED.**

Reason: a monitor inside API Gateway shares the API Gateway failure domain and **cannot detect API Gateway crash/hang**. It also omitted independent coverage for frontend, AI Service, container-manager, and Redis.

**Corrected principle:** monitoring must not share the exact same failure domain as the service whose complete outage it must detect.

Step 2A superseded the in-process NestJS design. Step 3 implemented the corrected architecture only.

---

## 6. Final Architecture

**Independent PM2-managed Node.js operations watchdog**

| Property | Value |
|----------|-------|
| Runtime | Standalone Node.js script (no NestJS / no DI) |
| Repo path | `monitoring/watchdog/ops-watchdog.js` |
| Staging path | `/opt/aisandbox/monitoring/watchdog/ops-watchdog.js` |
| PM2 process name | `aisandbox-ops-watchdog` |
| Check interval | 60 seconds |
| Notification | Resend REST API via built-in `fetch()` |
| Dependencies | **None new** — Node built-ins only (`http`/`https`/`net`/`tls`/`fetch`) |
| Vendor | **None new** — reuses existing Resend |
| Character | Deliberate **small-beta** architecture for 1–3 trusted users — **not** enterprise observability |

PostgreSQL is covered transitively via API Gateway `/api/health/ready` (`SELECT 1`). Redis is covered by direct TCP AUTH+PING from `REDIS_URL`.

---

## 7. Exact Implementation Files

| File | Action | Step |
|------|--------|------|
| `monitoring/watchdog/ops-watchdog.js` | CREATE | 3A |
| `monitoring/watchdog/__tests__/ops-watchdog.test.js` | CREATE | 3A |
| `docs/PRIVATE-BETA-OPS-01-STAGE-START.md` | CREATE / APPEND (Step 2 + 2A) | 2 / 2A |
| `docs/PRIVATE-BETA-OPS-01-CHECKPOINT.md` | CREATE (this file) | 4 |
| `TASKS.md` | PRIVATE-BETA-OPS-01 entry only | 1 + 4 |
| `TASKS_BACKLOG_FULL.md` | PRIVATE-BETA-OPS-01 entry only | 1 + 4 |

**No application source outside `monitoring/watchdog/` was modified for implementation.**  
**No npm dependency was added.**

---

## 8. Probe Coverage

| Component | Probe | Success | Failure threshold |
|-----------|-------|---------|-------------------|
| API Gateway | `GET http://127.0.0.1:4000/api/health/ready` | HTTP 200 | 2 consecutive failures |
| AI Service | `GET http://127.0.0.1:4001/metrics` | HTTP 200 | 2 consecutive failures |
| Frontend | `GET https://staging.ainow.biz` | HTTP 2xx or 3xx | 3 consecutive failures |
| container-manager | `GET http://127.0.0.1:4002/api/health` | HTTP 200 | 2 consecutive failures |
| Redis | Direct TCP AUTH (if configured) + PING from `REDIS_URL` | `+PONG` | 2 consecutive failures |
| PostgreSQL | Transitive via API Gateway readiness | readiness 200 implies DB alive | Covered by API Gateway probe |

---

## 9. Debounce / Cooldown Behavior

| Behavior | Value |
|----------|-------|
| Check interval | 60 seconds |
| Non-frontend alert threshold | 2 consecutive failures |
| Frontend alert threshold | 3 consecutive failures |
| Repeat-alert cooldown | 30 minutes per component condition |
| Recovery notification | Sent when a previously degraded component returns healthy |
| Independent counters | Per-component failure and cooldown state |

---

## 10. Notification Mechanism

- Resend HTTP API: `POST https://api.resend.com/emails`
- From: existing `AUTH_EMAIL_FROM`
- To: `OPERATOR_ALERT_RECIPIENT` (runtime configuration; **not hardcoded**)
- Auth: existing `RESEND_API_KEY`
- Alert subjects: `[aiSandBox ALERT] <component> unhealthy`
- Recovery subjects: `[aiSandBox RECOVERY] <component> recovered`
- Missing recipient → safe no-op / suppress
- Notification failure → logged and contained; does **not** crash watchdog

---

## 11. Secret / Configuration Handling

| Variable | Role | New secret? |
|----------|------|-------------|
| `OPERATOR_ALERT_RECIPIENT` | Alert destination email (`alerts@ainow.biz` on staging) | No — non-secret runtime config |
| `RESEND_API_KEY` | Resend auth | Existing |
| `AUTH_EMAIL_FROM` | Sender | Existing |
| `REDIS_URL` | Redis probe host/port/auth | Existing |

Watchdog redacts Bearer tokens, URL credentials, password/api-key query values, and configured secret strings from diagnostics. Secrets are not logged in cleartext.

---

## 12. Unit-Test Evidence (Step 3A)

Local validation recorded:

| Metric | Result |
|--------|--------|
| Tests | 17 |
| PASS | 17 |
| FAIL | 0 |
| Syntax checks | PASS (`node --check`) |
| New npm dependency | None |
| Application source outside `monitoring/watchdog/` | Unchanged |

Coverage includes: HTTP probe success/error/timeout; Redis PING/AUTH/TLS parse; independent thresholds; 30-minute cooldown; Resend notification path; missing-recipient safe no-op; notification failure containment; secret redaction/safety.

---

## 13. Staging Deployment Evidence (Step 3B)

Pre-flight:

- Staging host reachable through authorized SSH
- Deploy root `/opt/aisandbox`
- Node v20.20.2
- `GLOBAL_EXECUTION_ENABLED=false`
- Existing Resend/Redis configuration present

Watchdog deployment:

- Script at `/opt/aisandbox/monitoring/watchdog/ops-watchdog.js`
- Independent PM2 process `aisandbox-ops-watchdog`
- Status: **online**
- Restart count: **0**
- Persistence: `pm2 save` succeeded

Baseline probes (all PASS):

| Probe | Result |
|-------|--------|
| API Gateway readiness | PASS (200) |
| AI Service metrics | PASS (200) |
| Frontend reachability | PASS (307 healthy under approved 2xx/3xx rule) |
| container-manager health | PASS (200) |
| Redis PING | PASS (HEALTHY) |

---

## 14. Controlled Outage Evidence

| Field | Evidence |
|-------|----------|
| Target | AI Service only |
| Outage start | 2026-08-10T07:50:11Z |
| Threshold applied | 2 consecutive failures |
| Outage alert send | 2026-08-10T07:52:08.069Z |
| Outage alert count | Exactly one |
| Scope of disruption | Controlled; AI Service only |

---

## 15. Actual Email-Delivery Confirmation

| Event | Confirmation |
|-------|--------------|
| Outage email | Keith **CONFIRMED** actual mailbox receipt at `alerts@ainow.biz` |
| Recovery email | Keith **CONFIRMED** actual mailbox receipt at `alerts@ainow.biz` |
| Recipient source | Runtime `OPERATOR_ALERT_RECIPIENT` — **not hardcoded** |

---

## 16. Recovery Evidence

| Field | Evidence |
|-------|----------|
| Restoration | AI Service restored immediately after controlled outage |
| Metrics recovery | AI Service `/metrics` returned 200 |
| Recovery detection | 2026-08-10T07:53:08.132Z |
| Recovery email | Sent successfully; Keith confirmed receipt |
| Post-recovery probes | All five probes healthy |
| Watchdog process | Remained online |

---

## 17. PM2 Persistence Evidence

| Field | Evidence |
|-------|----------|
| Process name | `aisandbox-ops-watchdog` |
| Final status | online |
| Restart count | 0 |
| Persistence | `pm2 save` completed successfully |
| Lifecycle | Independent of application service processes |

---

## 18. Safety-Gate Evidence

| Gate | Status |
|------|--------|
| `GLOBAL_EXECUTION_ENABLED` | **false throughout** |
| Provider / AI execution | **None occurred** during OPS-01 validation |
| DB mutation by watchdog | **None** |
| Redis mutation by watchdog | **None** (PING only) |
| PRIVATE-BETA-INVITE-01 | **Untouched / unregistered** |
| Application auth / CSRF / internal keys | Unchanged |
| ARCHITECTURE.md / PRD.md | Not modified by this task's implementation path |

---

## 19. Known Limitations

- Not enterprise observability; single-node PM2 watchdog only.
- Watchdog itself depends on PM2/VPS; if PM2 daemon or VPS dies, recovery is OS/Lightsail-level.
- AI Service probe is HTTP liveness via `/metrics`, not deep BullMQ worker-stuck detection.
- PostgreSQL is transitive via API Gateway readiness, not a direct DB probe.
- Frontend uses public HTTPS path (DNS/Caddy/Next.js combined); transient edge issues mitigated by 3-failure threshold.
- No pager rotation, no HA monitor replica, no historical time-series alerting UI.
- Phase 60 Prometheus alert rules remain inactive on staging (Prometheus not running).
- No dedicated first-responder runbook rewrite beyond existing Phase 60B runbooks + watchdog alert hints.

---

## 20. Explicit Non-Requirements (Intentionally Outside Scope)

Do **not** characterize PRIVATE-BETA-OPS-01 as providing:

- Distributed tracing
- Centralized log aggregation
- HA monitoring
- Pager rotation
- Full synthetic monitoring platform
- External observability vendor (Sentry / Datadog / Grafana Cloud / UptimeRobot / etc.)
- Broad monitoring dashboard redesign
- Agent Harness activation
- Controlled Builder AI execution activation
- PRIVATE-BETA-INVITE-01 execution

---

## 21. Rollback / Removal Path

| Action | Command / effect |
|--------|------------------|
| Stop watchdog | `pm2 stop aisandbox-ops-watchdog` |
| Remove watchdog | `pm2 delete aisandbox-ops-watchdog` then `pm2 save` |
| Disable alerts without removing process | Unset/clear `OPERATOR_ALERT_RECIPIENT` (safe suppress) |
| Application impact | **Zero** — watchdog is additive and isolated |
| Repo removal (optional) | Remove `monitoring/watchdog/` — no application imports reference it |

---

## 22. Final Acceptance Criteria

| # | Criterion | Verdict |
|---|-----------|---------|
| 1 | Existing observability audited; gaps documented | PASS — Step 2 |
| 2 | In-process API Gateway alert design rejected on failure-domain grounds | PASS — Step 2A |
| 3 | Independent PM2-managed watchdog implemented | PASS — Step 3A |
| 4 | Five critical probes covered (API Gateway, AI Service, frontend, container-manager, Redis) | PASS |
| 5 | Debounce + 30-minute cooldown + recovery alerts | PASS (unit + staging) |
| 6 | Resend notification via existing credentials + `OPERATOR_ALERT_RECIPIENT` | PASS |
| 7 | Local tests 17/17 PASS; no new npm dependency | PASS |
| 8 | Staging deployment online; restart count 0; `pm2 save` persisted | PASS — Step 3B |
| 9 | Controlled AI Service outage detected at 2-failure threshold | PASS |
| 10 | Outage + recovery emails actually received by Keith | PASS |
| 11 | All five probes healthy post-recovery; watchdog remained online | PASS |
| 12 | `GLOBAL_EXECUTION_ENABLED=false` throughout | PASS |
| 13 | PRIVATE-BETA-INVITE-01 untouched | PASS |
| 14 | Checkpoint created; task locked | PASS — Step 4 |

**14 / 14 acceptance criteria: SATISFIED**

---

## 23. Final Task Status

**PRIVATE-BETA-OPS-01 — COMPLETE AND LOCKED — 2026-08-10**

| Step | Description | Status | Date |
|------|-------------|--------|------|
| Step 1 | Registration | COMPLETE | 2026-08-10 |
| Step 2 | Existing Observability / Alerting Audit + Stage-Start | COMPLETE | 2026-08-10 |
| Step 2A | Architecture Correction (failure-domain redesign) | COMPLETE | 2026-08-10 |
| Step 3A | Out-of-Process Watchdog Implementation + Local Tests | COMPLETE | 2026-08-10 |
| Step 3B | Controlled Staging Activation + Alert Delivery Smoke | COMPLETE / PASS | 2026-08-10 |
| Step 4 | Consolidation / Checkpoint | COMPLETE | 2026-08-10 |

---

## 24. Private-Beta Readiness Impact

The P1 requirement:

> **minimal operational crash/error visibility appropriate to 1–3 trusted users**

is now **SATISFIED**.

This does **NOT** mean private beta itself is approved.

Remaining Builder-first beta sequence:

1. Minimal operational visibility — **COMPLETE** (this task)
2. Controlled Builder AI execution activation — **not registered / not executed**
3. One fresh Keith full end-to-end staging journey — **not registered / not executed**
4. Final go/no-go decision — **not taken**
5. PRIVATE-BETA-INVITE-01 — **only after Keith explicit approval** — remains untouched / unregistered

---

## 25. Exact Next Recommended Task

**Controlled Builder AI execution activation** (separate task; **not registered in this consolidation**).

Do not register or execute:

- Controlled Builder AI execution activation
- Keith end-to-end staging journey
- Final go/no-go
- PRIVATE-BETA-INVITE-01

in this Step 4 consolidation.

---

## Step Completion Evidence Map

| Step | Artifact |
|------|----------|
| Step 1 | `TASKS.md` / `TASKS_BACKLOG_FULL.md` registration |
| Step 2 / 2A | `docs/PRIVATE-BETA-OPS-01-STAGE-START.md` |
| Step 3A | `monitoring/watchdog/ops-watchdog.js` + `__tests__/ops-watchdog.test.js` |
| Step 3B | Staging smoke evidence recorded in this checkpoint §§13–18 |
| Step 4 | This checkpoint + ledger lock |

---

## Lock Notice

PRIVATE-BETA-OPS-01 is **COMPLETE AND LOCKED — 2026-08-10**.

Do not modify this checkpoint except for explicitly approved documentation correction.

Step 4 performed **governance/consolidation only**:

- No implementation source modified
- No tests modified
- No staging runtime action
- No SSH / PM2 / Docker / Postgres / Redis action
- No `.env` modification
- No `GLOBAL_EXECUTION_ENABLED` change
- No PRIVATE-BETA-INVITE-01 registration
- No next P1 task registration
- No git commit or push
- ARCHITECTURE.md / PRD.md unchanged

*Checkpoint created: 2026-08-10 — PRIVATE-BETA-OPS-01 Step 4 Consolidation.*
