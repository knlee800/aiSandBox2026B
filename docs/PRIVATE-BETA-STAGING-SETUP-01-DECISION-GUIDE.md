# PRIVATE-BETA-STAGING-SETUP-01 — Step 2 — AWS Lightsail Account / Region / Instance Decision Guide

**Task ID:** PRIVATE-BETA-STAGING-SETUP-01
**Step:** 2 — AWS Lightsail Account / Region / Instance Decision Guide
**Status:** CREATED — 2026-07-21
**Date:** 2026-07-21
**Nature:** Decision guidance only — no server creation, no implementation, no source/test/package/migration/entity/environment/Docker/deployment files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP-01 |
| Title | AWS Lightsail Account / Region / Instance Decision |
| Parent | PRIVATE-BETA-STAGING-SETUP — Staging / Production-like Deployment Target Setup |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | AWS LIGHTSAIL ACCOUNT / REGION / INSTANCE DECISION — GOVERNANCE / DECISION RECORD |
| Risk | LOW — decision and guidance only; no server creation in this step |
| Step 1 | COMPLETE — Registration — 2026-07-21 |
| Step 2 | This document — Decision Guide — 2026-07-21 |
| Step 3 | PENDING — Consolidation / handoff to SETUP-02 |
| Predecessors | PRIVATE-BETA-STAGING-SETUP Steps 1–2 COMPLETE |
| | PRIVATE-BETA-DEPLOYMENT-READINESS Steps 1–2 COMPLETE — BLOCKED / PAUSED — blocker: no staging target |
| | LIMITED-PRIVATE-BETA-HANDOFF — COMPLETE and LOCKED — 2026-07-21 |
| | BETA-READY-SMOKE / B3 — COMPLETE and LOCKED — PASS — 2026-07-21 |
| | BETA-READY-MIGRATION-CLI-01 — COMPLETE and LOCKED — 2026-07-21 |
| | BETA-READY-DEPLOYMENT-CONFIG — COMPLETE and LOCKED — 2026-07-20 |

---

## 2. Purpose

This document gives Keith a practical checklist to verify that AWS Lightsail is accessible, the chosen region and instance size are available, and the cost is acceptable — before any server is created.

No server is created in this step. No deployment occurs. No implementation occurs. Keith manually checks the AWS console and records answers. Those answers determine whether SETUP-01 can PASS and hand off to SETUP-02 (Server Baseline and SSH Access).

---

## 3. Confirmed Default Decisions

These defaults were recorded during PRIVATE-BETA-STAGING-SETUP Step 2 (stage-start) and confirmed by Keith on 2026-07-21.

| # | Decision | Confirmed Default |
|---|----------|-------------------|
| 1 | Provider | **AWS Lightsail** |
| 2 | Region | **Singapore / ap-southeast-1** |
| 3 | Instance | **8 GB RAM / 2 vCPU / 160 GB SSD** |
| 4 | Budget | **~US$40–44/month** |
| 5 | Domain | **staging.ainow.biz** |
| 6 | Architecture | **Single VPS staging** |
| 7 | Reverse proxy / TLS | **Caddy** (automatic Let's Encrypt) |
| 8 | Database | **Self-host PostgreSQL 15 on same VPS** |
| 9 | Redis | **Self-host Redis 7 on same VPS** |
| 10 | Process manager | **PM2** |
| 11 | AI Service / Container Manager | **Deploy for startup parity; risky execution disabled by kill switches** |
| 12 | Task split | **8 small child tasks (SETUP-01 through SETUP-08)** |
| 13 | Migration execution | **Separate explicit approval only** |
| 14 | Beta invite | **Separate explicit approval only** |

---

## 4. What Keith Must Check in AWS Lightsail

Keith should log into the AWS console and manually verify each item below. No server should be created during this check.

| # | Check | How |
|---|-------|-----|
| 1 | Can log into AWS | Go to https://console.aws.amazon.com/ and sign in |
| 2 | Lightsail is available | Navigate to https://lightsail.aws.amazon.com/ — the Lightsail home page should load |
| 3 | Singapore region is available | In the Lightsail console, look for the region selector (top-right or instance creation screen). Verify **ap-southeast-1 (Singapore)** appears as a selectable region |
| 4 | Linux/Unix instance creation screen is available | Click "Create instance" (do NOT proceed past the configuration screen). Verify the OS selection screen appears with Linux/Unix options |
| 5 | 8 GB / 2 vCPU / 160 GB SSD bundle is visible | On the instance creation screen, scroll to the plan/bundle selection. Look for the **8 GB RAM / 2 vCPUs / 160 GB SSD** option |
| 6 | Monthly price is acceptable | Confirm the displayed price is approximately **$40 USD/month** and within budget |
| 7 | Static IP can be created later | Note: Static IPs are created separately in Lightsail after an instance exists. No action needed now — just confirm awareness |
| 8 | Comfortable using staging.ainow.biz later | Confirm that **staging.ainow.biz** remains the intended staging subdomain and that Keith has access to the DNS registrar for `ainow.biz` |

**Do NOT click "Create" or finalize any instance. This step is verification only.**

---

## 5. AWS Account Access Checklist

| # | Question | Expected Answer |
|---|----------|-----------------|
| 1 | Can Keith sign into the AWS Management Console? | Yes |
| 2 | Does Keith have an IAM user or root account with Lightsail permissions? | Yes |
| 3 | Is the AWS account in good standing (not suspended, no billing hold)? | Yes |
| 4 | Does Keith know the account's payment method (credit card / billing)? | Yes |

**If any answer is No:** Document the blocker. SETUP-01 cannot proceed until AWS account access is resolved.

### Fallback

If Keith does not have an AWS account, a new account can be created at https://aws.amazon.com/. AWS Lightsail is available on new accounts. New accounts may have a free-tier period for smaller Lightsail instances but the 8 GB plan is a paid plan.

---

## 6. Lightsail Region Checklist

| # | Question | Expected Answer |
|---|----------|-----------------|
| 1 | Does the Lightsail console show **ap-southeast-1 (Singapore)** in the region list? | Yes |
| 2 | Can Keith select Singapore as the region for a new instance? | Yes |
| 3 | Are Linux/Unix instance plans visible in the Singapore region? | Yes |

### Fallback Region

If Singapore is not available in Keith's Lightsail console:

| Fallback # | Region | Region Code | Rationale |
|------------|--------|-------------|-----------|
| 1 | Tokyo | ap-northeast-1 | Next closest Asia-Pacific region |
| 2 | Sydney | ap-southeast-2 | Alternative Asia-Pacific |
| 3 | Mumbai | ap-south-1 | Alternative Asia-Pacific |

If a fallback region is used, record it in Keith's response and adjust all subsequent child tasks accordingly.

---

## 7. Instance Size Checklist

| # | Question | Expected Answer |
|---|----------|-----------------|
| 1 | Is the **8 GB RAM / 2 vCPU / 160 GB SSD** plan visible on the instance creation screen? | Yes |
| 2 | Is the displayed monthly price approximately **$40 USD/month**? | Yes |
| 3 | Is this the same plan labeled as the "$40" Linux/Unix bundle? | Yes |

### Fallback Size

If the 8 GB plan is not available or pricing has changed:

| Fallback # | Plan | Estimated Cost | Risk |
|------------|------|---------------|------|
| 1 | 4 GB / 2 vCPU / 80 GB SSD | ~$20/month | OOM risk under concurrent Docker sandbox containers; may work for initial staging with < 5 users |
| 2 | 16 GB / 4 vCPU / 320 GB SSD | ~$80/month | Higher cost; more headroom than needed for private beta |

If a fallback size is used, record it in Keith's response.

### Memory Budget Reference (8 GB Plan)

| Component | Estimated RAM |
|-----------|--------------|
| PostgreSQL 15 | ~512 MB |
| Redis 7 | ~128 MB |
| API Gateway (NestJS) | ~256 MB |
| AI Service Worker (NestJS) | ~256 MB |
| Container Manager (NestJS) | ~256 MB |
| Frontend (Next.js) | ~512 MB |
| Caddy | ~64 MB |
| Docker Engine + 1–2 sandbox containers | ~1–2 GB |
| OS + buffers | ~1 GB |
| **Total estimated** | **~3–5 GB** |
| **Headroom** | **~3–5 GB** |

---

## 8. Static IP Decision

| # | Question | Answer |
|---|----------|--------|
| 1 | Will a static IP be needed? | **Yes** — required for DNS A record pointing `staging.ainow.biz` to the server |
| 2 | When should it be created? | **After the instance is created** — in a future child task (SETUP-01 Step 3 or SETUP-02) |
| 3 | Cost? | **Free** when attached to a running Lightsail instance; $3.50/month if detached |
| 4 | Action now? | **None** — just confirm awareness that a static IP will be needed later |

Keith does not need to create a static IP in this step. The static IP will be created and attached after the Lightsail instance is created in a future child task.

---

## 9. Domain Intent

| # | Field | Value |
|---|-------|-------|
| 1 | Staging domain | **staging.ainow.biz** |
| 2 | Production domain | **ainow.biz** (NOT used for staging) |
| 3 | DNS record type | A record → Lightsail static IP |
| 4 | TLS | Automatic via Caddy + Let's Encrypt |
| 5 | When is DNS configured? | **Future child task** — SETUP-03 (Domain / DNS / TLS) |
| 6 | Action now? | **None** — just confirm `staging.ainow.biz` is the intended subdomain and Keith has registrar access |

Keith does not need to create DNS records in this step. DNS setup belongs to SETUP-03.

---

## 10. Cost Expectation

| Item | Estimated Monthly Cost |
|------|----------------------|
| Lightsail 8 GB instance | ~$40 USD |
| Lightsail static IP (free when attached) | $0 |
| DNS (existing domain) | $0 (already owned) |
| TLS (Let's Encrypt via Caddy) | $0 |
| PostgreSQL (self-hosted) | $0 (included in VPS) |
| Redis (self-hosted) | $0 (included in VPS) |
| Data transfer (first 3 TB free on most Lightsail plans) | $0 for beta |
| **Total estimated** | **~$40 USD/month** |

Additional potential costs:
- Lightsail snapshots (manual backups): ~$0.05/GB/month — negligible for a 160 GB disk
- Excess data transfer beyond 3 TB: unlikely during private beta with < 10 users

---

## 11. What Must NOT Happen Yet

| # | Prohibited Action | Reason |
|---|-------------------|--------|
| 1 | Create a Lightsail instance | Server creation belongs to a future child task after this decision step passes |
| 2 | Install software on any server | No server exists yet |
| 3 | Configure DNS records | DNS setup belongs to SETUP-03 |
| 4 | Deploy code | Deployment belongs to SETUP-04/07 |
| 5 | Run migrations | Migration belongs to SETUP-08 with separate explicit approval |
| 6 | Configure environment variables | Env setup belongs to SETUP-05 |
| 7 | Open or edit `.env` files | Secret-bearing files must not be opened |
| 8 | Invite beta users | Beta invite requires separate explicit approval |
| 9 | Claim beta launch | No launch has occurred |
| 10 | Start Docker, PostgreSQL, or Redis | No runtime in this step |
| 11 | Execute tests or builds | No validation in this step |
| 12 | Modify source code | No implementation in this step |
| 13 | Make git commits or pushes | Governance updates belong to Step 3 |

---

## 12. Risks / Caveats

| # | Risk | Likelihood | Mitigation |
|---|------|-----------|------------|
| 1 | AWS account does not exist or is inaccessible | LOW | Create new account or recover access |
| 2 | Lightsail is not available in Keith's AWS account | VERY LOW | Lightsail is available in all standard AWS accounts |
| 3 | Singapore region unavailable | VERY LOW | Fallback to Tokyo (ap-northeast-1) |
| 4 | 8 GB plan unavailable or pricing changed | LOW | Check current pricing; consider 4 GB fallback at $20/month (with OOM risk caveat) |
| 5 | Monthly cost exceeds budget | LOW | $40/month is within stated budget; downgrade to 4 GB if cost is a concern |
| 6 | Keith lacks registrar access for ainow.biz | LOW | Required for DNS in SETUP-03; not blocking this step but must be resolved before SETUP-03 |
| 7 | AWS Lightsail deprecated or discontinued | VERY LOW | No indication of this; Lightsail remains an active AWS service |
| 8 | Credit card or payment method issues | LOW | Resolve with AWS billing support before proceeding |

---

## 13. PASS / BLOCKED Criteria

### PASS — Step 2 passes if ALL of the following are true:

- [ ] AWS account access is available or Keith knows how to access it.
- [ ] Lightsail service is available in Keith's AWS account.
- [ ] Singapore (ap-southeast-1) region is available, OR a fallback region is documented and accepted.
- [ ] 8 GB / 2 vCPU / 160 GB SSD instance option is visible, OR a fallback size is documented and accepted.
- [ ] Monthly cost (~$40/month) is acceptable.
- [ ] Static IP creation is acceptable for a future step.
- [ ] `staging.ainow.biz` remains the intended staging domain.
- [ ] No server was created in this step.

### BLOCKED — Step 2 is BLOCKED if ANY of the following are true:

- [ ] Keith cannot access AWS and cannot resolve access.
- [ ] Lightsail is unavailable in Keith's AWS account.
- [ ] Singapore region is unavailable AND no fallback region is accepted.
- [ ] 8 GB instance is unavailable AND no fallback size is accepted.
- [ ] Monthly cost is not approved by Keith.
- [ ] Domain intent is unresolved (Keith does not want to use staging.ainow.biz and has no alternative).
- [ ] Keith is not ready to proceed to the next child task.

---

## 14. Exact Recommended Keith Action

1. **Log into the AWS Management Console** at https://console.aws.amazon.com/.
2. **Navigate to Lightsail** at https://lightsail.aws.amazon.com/.
3. **Verify the region selector** shows **ap-southeast-1 (Singapore)** — select it.
4. **Click "Create instance"** (do NOT finalize or click the final create button).
5. **Verify** the instance creation screen shows:
   - Platform: **Linux/Unix**
   - Plan/bundle: **8 GB RAM / 2 vCPUs / 160 GB SSD**
   - Price: approximately **$40 USD/month**
6. **Cancel** out of the instance creation screen — do NOT create the instance.
7. **Fill in the response template** below with your answers.
8. **Provide the completed response** so Step 3 (Consolidation / Handoff to SETUP-02) can proceed.

---

## 15. Keith Response Template

Copy and fill in this template after checking the AWS console:

```text
AWS account access: Yes / No
Lightsail available: Yes / No
Singapore region available: Yes / No
8GB instance option visible: Yes / No
Estimated monthly cost acceptable: Yes / No
Static IP acceptable later: Yes / No
Use staging.ainow.biz later: Yes / No
Ready to proceed to SETUP-01 Step 3: Yes / No
```

If any answer is **No**, add a brief note explaining the issue so the appropriate fallback or blocker can be documented.

---

## 16. Handoff to Step 3

After Keith provides his response:

- If all answers are **Yes** → SETUP-01 Step 2 **PASSES** → proceed to SETUP-01 Step 3 (Consolidation / Handoff to SETUP-02).
- If any answer is **No** with a documented fallback → SETUP-01 Step 2 **PASSES WITH DOCUMENTED FALLBACK** → proceed to Step 3 with the fallback recorded.
- If any answer is **No** without an acceptable fallback → SETUP-01 Step 2 is **BLOCKED** → document the blocker and pause until resolved.

Step 3 (Consolidation) will:
1. Record Keith's answers and the PASS/BLOCKED verdict.
2. Update TASKS.md and TASKS_BACKLOG_FULL.md.
3. Update AINOW-EXECUTION-ROADMAP.md.
4. Hand off to SETUP-02 (Server Baseline and SSH Access) if PASS.

**No server creation occurs until a future child task explicitly creates one with Keith's approval.**

---

**Document created:** 2026-07-21
**Step 2 status:** Decision guide created — awaiting Keith response.
**No server created.**
**No implementation occurred.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred.**
**No git commit or git push occurred.**
**No secret-bearing environment file opened.**
**No subagents used.**
