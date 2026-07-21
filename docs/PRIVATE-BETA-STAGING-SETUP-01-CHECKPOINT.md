# PRIVATE-BETA-STAGING-SETUP-01 — Consolidation Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-SETUP-01
**Title:** AWS Lightsail Account / Region / Instance Decision
**Step:** 3 — Consolidation / Handoff to SETUP-02
**Final Status:** COMPLETE and LOCKED — 2026-07-21
**Date:** 2026-07-21
**Nature:** Governance / checkpoint only — no server creation, no implementation, no source/test/package/migration/entity/environment/Docker/deployment files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP-01 |
| Title | AWS Lightsail Account / Region / Instance Decision |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | AWS LIGHTSAIL ACCOUNT / REGION / INSTANCE DECISION — GOVERNANCE / DECISION RECORD |
| Risk | LOW — decision and guidance only; no server creation in this task |
| Registered | 2026-07-21 |
| Completed | 2026-07-21 |

---

## 2. Final Status

**PRIVATE-BETA-STAGING-SETUP-01: COMPLETE and LOCKED — 2026-07-21**

All 3 steps complete:
- Step 1 — Registration — COMPLETE (2026-07-21)
- Step 2 — AWS Lightsail Account / Region / Instance Decision Guide — COMPLETE (2026-07-21)
- Step 3 — Consolidation / Handoff to SETUP-02 — COMPLETE (2026-07-21)

---

## 3. Parent Task Status

**PRIVATE-BETA-STAGING-SETUP** (Staging / Production-like Deployment Target Setup)
- Status: ACTIVE — Steps 1–2 COMPLETE — Step 3 continues via remaining child tasks (SETUP-02 through SETUP-08)
- Step 3 is IN PROGRESS — SETUP-01 is now the first completed child task
- Parent task is NOT complete — 7 more child tasks remain (SETUP-02 through SETUP-08)
- PRIVATE-BETA-DEPLOYMENT-READINESS remains BLOCKED / PAUSED — blocker: no verified staging target yet

---

## 4. Why This Child Task Existed

PRIVATE-BETA-STAGING-SETUP-01 was the first child task of PRIVATE-BETA-STAGING-SETUP Step 3 (Execution). Its sole purpose was to record Keith's AWS Lightsail account/region/instance/cost/domain decisions and confirm those decisions were verified in the AWS console — before any server was created.

The decision guide (Step 2) gave Keith a structured checklist for the AWS console. Keith completed the checklist manually and reported all answers as Yes. This confirmed that SETUP-01 could PASS and hand off to SETUP-02 (Server Baseline and SSH Access Plan).

No server was created in this task. No deployment occurred. No implementation occurred.

---

## 5. Decision Guide Path

| Document | Path |
|----------|------|
| Step 2 Decision Guide | `docs/PRIVATE-BETA-STAGING-SETUP-01-DECISION-GUIDE.md` |
| Stage-start (parent) | `docs/PRIVATE-BETA-STAGING-SETUP-STAGE-START.md` |
| This checkpoint | `docs/PRIVATE-BETA-STAGING-SETUP-01-CHECKPOINT.md` |

---

## 6. Keith Manual Confirmations (Step 2 — 2026-07-21)

Keith verified each item in the AWS Lightsail console and provided the following answers:

| # | Question | Keith Answer |
|---|----------|-------------|
| 1 | AWS account access | **Yes** |
| 2 | Lightsail available | **Yes** |
| 3 | Singapore region (ap-southeast-1) available | **Yes** |
| 4 | 8 GB instance option visible | **Yes** |
| 5 | Estimated monthly cost (~$40/month) acceptable | **Yes** |
| 6 | Static IP acceptable later | **Yes** |
| 7 | Use staging.ainow.biz later | **Yes** |
| 8 | Ready to proceed to SETUP-01 Step 3 | **Yes** |

**Step 2 verdict: PASS — all 8 checks answered Yes.**

---

## 7. Final Provider Decision

**Provider: AWS Lightsail**

Keith confirmed Lightsail is available in the AWS account. No provider change. No fallback required.

---

## 8. Final Region Decision

**Region: Singapore / ap-southeast-1**

Keith confirmed ap-southeast-1 (Singapore) is available as a selectable region in the Lightsail console. No fallback required.

---

## 9. Final Instance Decision

**Instance: 8 GB RAM / 2 vCPU / 160 GB SSD**

Keith confirmed the 8 GB plan is visible on the instance creation screen. No fallback required. Memory budget is adequate for private beta workload (estimated 3–5 GB used; 3–5 GB headroom).

---

## 10. Final Cost Decision

**Budget: ~US$40–44/month**

Keith confirmed the estimated monthly cost is acceptable. Cost breakdown confirmed:

| Item | Estimated Monthly Cost |
|------|----------------------|
| Lightsail 8 GB instance | ~$40 USD |
| Lightsail static IP (free when attached) | $0 |
| DNS (existing domain) | $0 |
| TLS (Let's Encrypt via Caddy) | $0 |
| PostgreSQL (self-hosted) | $0 |
| Redis (self-hosted) | $0 |
| Data transfer (first 3 TB free) | $0 for beta |
| **Total estimated** | **~$40 USD/month** |

---

## 11. Static IP / Domain Decision

**Static IP:** Will be created after the Lightsail instance exists — in SETUP-02 or a future child task. Keith confirmed this is acceptable. Static IP is free when attached to a running Lightsail instance.

**Domain:** `staging.ainow.biz` — Keith confirmed this remains the intended staging subdomain. DNS A record (staging.ainow.biz → Lightsail static IP) and TLS (Caddy + Let's Encrypt) will be configured in SETUP-03.

No static IP was created. No DNS records were created. No TLS was configured. These belong to future child tasks.

---

## 12. What Was Not Done

The following items were explicitly NOT done in this task, as required by scope and safety boundaries:

| # | Not Done |
|---|---------|
| 1 | No AWS Lightsail instance created |
| 2 | No static IP created |
| 3 | No DNS records created |
| 4 | No TLS / Caddy configured |
| 5 | No server software installed |
| 6 | No deployment of any service |
| 7 | No environment file opened or modified |
| 8 | No source code modified |
| 9 | No test or package changes |
| 10 | No migration executed |
| 11 | No Docker or runtime started |
| 12 | No beta users invited |
| 13 | No beta launch claimed |
| 14 | No git commit |
| 15 | No git push |
| 16 | No subagents used |
| 17 | No secret-bearing file opened |
| 18 | SETUP-02 not registered in this step |

---

## 13. Safety Boundaries Preserved

- No `.env`, `.env.local`, `.env.staging`, `.env.production`, credential, key, certificate, or token files opened.
- No AWS console actions beyond manual read/verify (no server created).
- No destructive database commands.
- No deployment.
- No runtime started (Docker, PostgreSQL, Redis, PM2, Node).
- No browser automation.
- No API calls.
- No tests or builds executed.
- No subagents launched.

---

## 14. Product Impact

SETUP-01 completes the first child task of PRIVATE-BETA-STAGING-SETUP Step 3. The confirmed decisions establish the authoritative AWS Lightsail target for all subsequent child tasks:

- **SETUP-02** will plan server baseline provisioning and SSH access (instance creation, static IP, firewall ports) — requires Keith explicit approval before server is created.
- **SETUP-03** will plan DNS and TLS configuration.
- **SETUP-04** will plan system dependencies and environment.
- **SETUP-05** will plan environment variable configuration.
- **SETUP-06** will plan service deployment.
- **SETUP-07** will plan health checks, smoke tests, and staging verification.
- **SETUP-08** will plan production-readiness final checks.

No staging server exists yet. No public endpoint exists. No beta users can access staging. PRIVATE-BETA-DEPLOYMENT-READINESS Step 3 remains BLOCKED until a verified staging target exists.

---

## 15. Dependency / Handoff to SETUP-02

**SETUP-01 → SETUP-02 handoff confirmed.**

SETUP-02 (Server Baseline and SSH Access Plan) is the recommended next child task. It will:

1. Plan the Lightsail instance creation step (requires Keith explicit approval before creation).
2. Plan static IP creation and attachment.
3. Plan firewall port configuration (80/443/22).
4. Plan SSH key generation / access setup.
5. No server creation in SETUP-02 registration or planning steps — only in an explicitly approved execution step.

Keith must explicitly approve registration and activation of SETUP-02 before it begins.

---

## 16. Acceptance Criteria Disposition

### Step 1 — Registration
- [x] PRIVATE-BETA-STAGING-SETUP-01 registered in TASKS.md with ACTIVE status.
- [x] PRIVATE-BETA-STAGING-SETUP-01 registered in TASKS_BACKLOG_FULL.md with matching content.
- [x] AINOW-EXECUTION-ROADMAP.md updated to reflect PRIVATE-BETA-STAGING-SETUP-01 as current ACTIVE child task.
- [x] Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE after Step 2.
- [x] Keith decisions recorded: AWS Lightsail / ap-southeast-1 / 8 GB / ~$40/month / staging.ainow.biz / Caddy / PostgreSQL 15 / Redis 7 / PM2 / kill switches / 8 child tasks / migration separate / beta invite separate.
- [x] 3-step child workflow registered.
- [x] Scope for future Step 2 documented.
- [x] Non-goals documented.
- [x] No server created.
- [x] No implementation occurred.
- [x] No source/test/package/migration/entity/environment/Docker/deployment files changed.
- [x] No runtime, Docker, DB, browser, API, test, build, migration execution, deployment, git commit, or git push occurred.
- [x] No secret-bearing environment file opened.
- [x] No subagents used.

### Step 2 — Decision Guide
- [x] Decision guide document created: `docs/PRIVATE-BETA-STAGING-SETUP-01-DECISION-GUIDE.md`
- [x] All 8 PASS/BLOCKED criteria items addressed by Keith's responses.
- [x] AWS account access confirmed: Yes.
- [x] Lightsail availability confirmed: Yes.
- [x] Singapore / ap-southeast-1 availability confirmed: Yes.
- [x] 8 GB instance option confirmed visible: Yes.
- [x] Monthly cost (~$40/month) confirmed acceptable: Yes.
- [x] Static IP acceptable later confirmed: Yes.
- [x] staging.ainow.biz confirmed as intended staging domain: Yes.
- [x] No server created in Step 2.
- [x] Step 2 verdict: PASS — all 8 checks Yes.

### Step 3 — Consolidation / Handoff to SETUP-02
- [x] Checkpoint document created: `docs/PRIVATE-BETA-STAGING-SETUP-01-CHECKPOINT.md`
- [x] TASKS.md updated: SETUP-01 COMPLETE and LOCKED — 2026-07-21.
- [x] TASKS_BACKLOG_FULL.md updated: SETUP-01 COMPLETE and LOCKED — 2026-07-21.
- [x] AINOW-EXECUTION-ROADMAP.md updated: SETUP-01 COMPLETE and LOCKED — 2026-07-21.
- [x] Keith confirmations consolidated.
- [x] Final decisions recorded.
- [x] No server created confirmed.
- [x] Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE.
- [x] SETUP-02 not registered in this step.
- [x] No implementation occurred.
- [x] No source/test/package/migration/entity/environment/Docker/deployment files changed.
- [x] No runtime, Docker, DB, browser, API, test, build, migration execution, deployment, git commit, or git push occurred.
- [x] No secret-bearing environment file opened.
- [x] No subagents used.

---

## 17. Locked-State Instruction

**PRIVATE-BETA-STAGING-SETUP-01 is COMPLETE and LOCKED.**

This task and its checkpoint must not be modified except for explicitly approved documentation correction. No implementation, re-scoping, or status reversal is permitted without Keith's explicit written approval.

---

## 18. Exact Next Action

**Register PRIVATE-BETA-STAGING-SETUP-02 — Server Baseline and SSH Access Plan.**

This is the second child task of PRIVATE-BETA-STAGING-SETUP Step 3. It will plan the Lightsail instance creation, static IP, SSH access, and firewall configuration — with no actual server creation until Keith explicitly approves a separate execution step.

Keith must explicitly say "go" or equivalent before SETUP-02 registration begins.

---

**Checkpoint created:** 2026-07-21
**Final status:** PRIVATE-BETA-STAGING-SETUP-01 COMPLETE and LOCKED — 2026-07-21
**No server created.**
**No implementation occurred.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred.**
**No git commit or git push occurred.**
**No secret-bearing environment file opened.**
**No subagents used.**
**SETUP-02 not registered.**
