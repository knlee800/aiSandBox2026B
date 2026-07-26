# PRIVATE-BETA-STAGING-EXECUTION-04B — Evidence Review

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04B
**Title:** Private Env Preparation
**Step:** 3 — Keith Manual Evidence Review
**Date:** 2026-07-26
**Nature:** Evidence review only — no server action — no source changes — no AWS action — no env files opened/created/edited — no env values printed — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04B |
| Title | Private Env Preparation |
| Step | 3 — Evidence Review |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | REAL STAGING EXECUTION — private `/opt/aisandbox/.env` preparation on Lightsail instance |
| Risk | HIGH — credential handling; first `.env` file on staging VPS |
| Registered | 2026-07-26 |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Evidence date | 2026-07-26 |
| Reviewer | AI — Step 3 — evidence review only |
| Google OAuth decision | PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION — COMPLETE and LOCKED — Outcome B — deferred |
| Runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-PRIVATE-ENV-PREPARATION-RUNBOOK.md` (amended 2026-07-26) |

---

## 2. Purpose

This document records the formal review of Keith's safe evidence from the EXECUTION-04B manual run on the `aisandbox-staging` Lightsail server. It verifies each evidence item against the amended runbook expectations, issues a final PASS/BLOCKED verdict, and documents the recommendation for Step 4 consolidation.

Step 3 is an evidence review step only. No server actions, source changes, AWS actions, env file access, git commits, pushes, or subagent use occurred during this step.

---

## 3. Evidence Source

**Evidence provided by:** Keith — manual execution inside AWS Lightsail browser SSH console per the amended `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-PRIVATE-ENV-PREPARATION-RUNBOOK.md`.

**Evidence type:** User-provided safe evidence — treated as authoritative. No secrets, passwords, connection strings, private keys, or `.env` values were present in the evidence.

**Evidence title:** `PRIVATE-BETA-STAGING-EXECUTION-04B — Evidence Report` — Date: 2026-07-26 — Instance: `aisandbox-staging`.

**Runbook reference:** `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-PRIVATE-ENV-PREPARATION-RUNBOOK.md` (Outcome B amendments applied).

**Decision references:**
- `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION-REPORT.md`
- `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION-CHECKPOINT.md`

**Prior checkpoint reference:** `docs/PRIVATE-BETA-STAGING-EXECUTION-04A-CHECKPOINT.md`

---

## 4. Evidence Review Verdict

**VERDICT: PASS**

No direct contradiction was found between Keith's safe evidence and the amended 04B runbook. All required review items pass. One non-blocking PostgreSQL directory permission warning was recorded and assessed as acceptable because the table-count query returned `0`. No stop conditions were triggered. No secrets were disclosed.

---

## 5. Snapshot Review

| Check | Evidence | Expected (amended runbook) | Verdict |
|-------|----------|----------------------------|---------|
| Pre-env snapshot created | Yes | Yes — before `.env` creation | PASS |
| Pre-env snapshot name | `aisandbox-staging-postclone-preenv-2026-07-26` | `aisandbox-staging-postclone-preenv-2026-07-26` (or date-adjusted equivalent) | PASS |
| Pre-env snapshot status | Available | Available before `.env` creation | PASS |

**Snapshot review result:** PASS. Rollback point created and Available before private `.env` creation.

---

## 6. Repo Baseline Review

| Check | Evidence | Expected (04A baseline / amended runbook) | Verdict |
|-------|----------|-------------------------------------------|---------|
| Repo path `/opt/aisandbox` exists | Yes | Directory present | PASS |
| Repo owner `ubuntu:ubuntu` unchanged from 04A | Yes | `ubuntu:ubuntu` | PASS |
| Repo branch `main` unchanged from 04A | Yes | `main` | PASS |
| Repo commit `c55a278` unchanged from 04A | Yes | `c55a278` | PASS |
| Git status clean before `.env` creation | Yes | Clean / empty | PASS |
| No `.env` existed before creation | Yes | Absent before Section 12 | PASS |

**Repo baseline review result:** PASS. 04A clone baseline preserved through private `.env` creation.

---

## 7. `.env` Creation and Permissions Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `/opt/aisandbox/.env` created privately | Yes | Created privately on VPS | PASS |
| `.env` owner `ubuntu:ubuntu` | Yes | `ubuntu:ubuntu` | PASS |
| `.env` chmod `600` | Yes | `600` | PASS |
| `.env` stat output | `ubuntu ubuntu 600 /opt/aisandbox/.env` | `ubuntu ubuntu 600 /opt/aisandbox/.env` | PASS |

**`.env` permissions review result:** PASS. Ownership and permissions match runbook Section 13 expectations. No `.env` values were disclosed.

---

## 8. Key-Presence Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| Required key presence check | PASS | PASS — all required keys PRESENT | PASS |
| All 47 required non-Google keys present | Yes — `PASS: All 47 required non-Google keys present. Google OAuth omitted intentionally.` | Amended runbook Section 14 `required_keys` length = 47; Google keys deferred | PASS |

The amended runbook presence-check script defines exactly 47 required keys after Google OAuth keys were moved to `deferred_keys`. Keith's PASS message matches that count and Outcome B posture.

**Required key-presence result:** PASS.

---

## 9. Google OAuth Deferred Review

| Check | Evidence | Expected (Outcome B / amended runbook) | Verdict |
|-------|----------|----------------------------------------|---------|
| Google OAuth deferred for private beta staging | Yes | Deferred | PASS |
| `GOOGLE_CLIENT_ID` omitted intentionally | Yes | Omit — no fake placeholders | PASS |
| `GOOGLE_CLIENT_SECRET` omitted intentionally | Yes | Omit — no fake placeholders | PASS |
| `GOOGLE_CALLBACK_URL` omitted intentionally | Yes | Omit — no fake placeholders | PASS |
| No fake Google OAuth placeholder values used | Yes | Omission safer than placeholders | PASS |
| Email/password remains intended staging auth path | Yes | Email/password intended path | PASS |

**Google OAuth deferred result:** PASS. Aligns with PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION Outcome B and amended runbook Sections 11F / 14 / 21 / 22.

---

## 10. Secret-Safety Review

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| `DATABASE_URL` configured privately | Yes — value not disclosed | Key present; value not disclosed | PASS |
| `REDIS_URL` configured privately | Yes — value not disclosed | Key present; value not disclosed | PASS |
| `JWT_SECRET` configured privately | Yes — value not disclosed | Key present; value not disclosed | PASS |
| `SESSION_SECRET` configured privately | Yes — value not disclosed | Key present; value not disclosed | PASS |
| `OAUTH_STATE_SECRET` configured privately | Yes — value not disclosed | Key present; value not disclosed | PASS |
| `INTERNAL_SERVICE_KEY` configured privately | Yes — value not disclosed | Key present; value not disclosed | PASS |
| No secrets disclosed | Yes | Evidence contains Yes/No and key-name status only | PASS |

Evidence contains no passwords, connection strings, tokens, provider keys, JWT/session secrets, Google credentials, AWS credentials, or `.env` contents.

**Secret safety result:** PASS.

---

## 11. Kill-Switch / Provider-Safety Review

| Check | Evidence | Required posture | Verdict |
|-------|----------|------------------|---------|
| Kill-switch/provider-safety posture set safely | Yes | All false/disabled | PASS |
| `GLOBAL_EXECUTION_ENABLED` set to false | Yes | `false` | PASS |
| `PROVIDER_OPENAI_ENABLED` set to false | Yes | `false` | PASS |
| `PROVIDER_ANTHROPIC_ENABLED` set to false | Yes | `false` | PASS |
| `PROVIDER_GROQ_ENABLED` set to false | Yes | `false` | PASS |
| `PROVIDER_XAI_ENABLED` set to false | Yes | `false` | PASS |
| `PROVIDER_DEEPSEEK_ENABLED` set to false | Yes | `false` | PASS |
| `BILLING_CHARGES_ENABLED` set to false | Yes | `false` | PASS |
| `BILLING_SNAPSHOT_ENABLED` set to false | Yes | `false` | PASS |
| `INVOICE_GENERATION_ENABLED` set to false | Yes | `false` | PASS |
| `PAYMENT_EXECUTION_ENABLED` set to false | Yes | `false` | PASS |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` set to false | Yes | `false` | PASS |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` set to false | Yes | `false` | PASS |
| `AGENT_HARNESS_STUB_WRITE_MODE` set to false | Yes | `false` | PASS |

**Kill-switch/provider-safety result:** PASS. All listed execution, provider, billing, and agent kill switches confirmed false.

---

## 12. Non-Goal Review — No Install / Build / Services / Migrations / DNS / TLS

| Check | Evidence | Expected | Verdict |
|-------|----------|----------|---------|
| No dependency install | Yes | No `npm install` / `npm ci` / `node_modules` | PASS |
| No build | Yes | No `dist` / `.next` / build commands | PASS |
| No app services started | Yes | PM2 empty / no app services | PASS |
| No migrations run | Yes | No migration commands | PASS |
| Database table count = 0 | Yes | `count = 0` | PASS |
| No DNS/TLS configured | Yes | Not configured | PASS |

**Non-goal review result:** PASS. 04B remained strictly limited to private `.env` preparation.

---

## 13. PostgreSQL Warning Assessment

**Warning reported:**

> PostgreSQL printed `could not change directory to /home/ubuntu: Permission denied` before returning table count 0. No blocker.

| Assessment item | Result |
|-----------------|--------|
| Query returned table count | 0 |
| Migrations indicated | No |
| Stop condition #21 (table count not 0) | Not triggered |
| Blocking? | No |

This is a known non-blocking `psql` client message when the invoking process cannot `chdir` to the invoking user's home directory. It does not indicate migration activity, schema change, or failed table-count verification. Because the count returned `0`, the warning is accepted as non-blocking.

**PostgreSQL warning assessment:** NON-BLOCKING — PASS.

---

## 14. Stop Condition Review

| Item | Evidence | Verdict |
|------|----------|---------|
| Stop conditions triggered | None | PASS / CLEAR |

Amended runbook Section 22 stop conditions were reviewed against the evidence. None were triggered, including:
- Missing required secrets (Google OAuth omission is explicitly not a stop condition under Outcome B)
- Fake Google OAuth placeholders
- Permission/ownership failures
- Key-presence MISSING results
- Install/build/service/migration/DNS/TLS actions
- Secret disclosure
- Pre-env snapshot not Available

**Stop condition result:** CLEAR — none triggered.

---

## 15. Final Evidence Matrix

| # | Review item | Verdict |
|---|-------------|---------|
| 1 | Pre-env snapshot created | PASS |
| 2 | Pre-env snapshot name recorded | PASS |
| 3 | Pre-env snapshot status Available | PASS |
| 4 | Repo path `/opt/aisandbox` exists | PASS |
| 5 | Repo owner remains `ubuntu:ubuntu` | PASS |
| 6 | Repo branch remains `main` | PASS |
| 7 | Repo commit remains `c55a278` | PASS |
| 8 | Git status clean before `.env` creation | PASS |
| 9 | No `.env` existed before creation | PASS |
| 10 | `/opt/aisandbox/.env` created privately | PASS |
| 11 | `.env` owner is `ubuntu:ubuntu` | PASS |
| 12 | `.env` chmod is `600` | PASS |
| 13 | Required key presence check passed | PASS |
| 14 | All 47 required non-Google keys present | PASS |
| 15 | Google OAuth deferred | PASS |
| 16 | `GOOGLE_CLIENT_ID` omitted intentionally | PASS |
| 17 | `GOOGLE_CLIENT_SECRET` omitted intentionally | PASS |
| 18 | `GOOGLE_CALLBACK_URL` omitted intentionally | PASS |
| 19 | No fake Google OAuth placeholders used | PASS |
| 20 | Email/password remains intended staging auth path | PASS |
| 21 | `DATABASE_URL` configured privately, value not disclosed | PASS |
| 22 | `REDIS_URL` configured privately, value not disclosed | PASS |
| 23 | `JWT_SECRET` configured privately, value not disclosed | PASS |
| 24 | `SESSION_SECRET` configured privately, value not disclosed | PASS |
| 25 | `OAUTH_STATE_SECRET` configured privately, value not disclosed | PASS |
| 26 | `INTERNAL_SERVICE_KEY` configured privately, value not disclosed | PASS |
| 27 | Kill-switch/provider-safety posture set safely | PASS |
| 28 | All listed execution/provider/billing/agent kill switches confirmed false | PASS |
| 29 | No dependency install | PASS |
| 30 | No build | PASS |
| 31 | No app services started | PASS |
| 32 | No migrations run | PASS |
| 33 | Database table count = 0 | PASS |
| 34 | No DNS/TLS configured | PASS |
| 35 | No secrets disclosed | PASS |
| 36 | PostgreSQL warning non-blocking (table count 0) | PASS |
| 37 | No stop conditions triggered | PASS |

**Matrix summary:** 37 / 37 PASS. Overall verdict: **PASS**.

---

## 16. Residual Risks

| Risk | Notes | Blocking for 04B Step 4? |
|------|-------|--------------------------|
| Google login unavailable on staging until a future OAuth task | Expected under Outcome B | No |
| Out-of-scope AI provider staging posture (`AI_PROVIDER=stub` vs startup validators) | Documented in Google OAuth decision report Section 21; must be handled in a separate future task before 04C/04D | No — not a 04B blocker |
| Redis 8.8.0 formal runtime compatibility still deferred to 04D | Carried forward from 04A | No |
| Secrets exist only on VPS filesystem | Correct by design; protect snapshot/access hygiene | No |
| Non-blocking PostgreSQL home-directory warning may reappear on later `psql` checks | Cosmetic client message; does not change table-count semantics | No |

No residual risk blocks 04B consolidation.

---

## 17. Recommendation

Recommend:

**PRIVATE-BETA-STAGING-EXECUTION-04B Step 4 — Consolidation / checkpoint**

Step 4 should:

* mark 04B COMPLETE and LOCKED
* create 04B checkpoint
* update `TASKS.md`
* update `TASKS_BACKLOG_FULL.md`
* update `docs/AINOW-EXECUTION-ROADMAP.md`
* record Google OAuth deferred
* record `.env` created privately
* record no secrets disclosed
* keep PRIVATE-BETA-STAGING-EXECUTION-04 active
* keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED
* set next child slice to PRIVATE-BETA-STAGING-EXECUTION-04C — Dependency Install + Build

Do not install dependencies, build, start app services, run migrations, or configure DNS/TLS in Step 4.

---

## 18. Exact Next Action

**Exact next action:** PRIVATE-BETA-STAGING-EXECUTION-04B Step 4 — Consolidation / checkpoint.

Governance/docs only. Create the 04B checkpoint, mark 04B COMPLETE and LOCKED, mirror status into `TASKS.md`, `TASKS_BACKLOG_FULL.md`, and `docs/AINOW-EXECUTION-ROADMAP.md`, keep EXECUTION-04 ACTIVE, keep PRIVATE-BETA-DEPLOYMENT-READINESS BLOCKED / PAUSED, and hand off next child to PRIVATE-BETA-STAGING-EXECUTION-04C — Dependency Install + Build (PENDING registration / requires Keith explicit approval).

---

**Evidence review created:** 2026-07-26  
**Task:** PRIVATE-BETA-STAGING-EXECUTION-04B — Step 3  
**Nature:** Evidence review documentation only — no server action — no source changes — no governance file changes — no runbook changes — no env files opened/created/edited — no env values opened/printed — no AWS/SSH/DNS/TLS action — no Docker/PostgreSQL/Redis action — no local runtime/test/build — no git commit or push — no subagents used.
