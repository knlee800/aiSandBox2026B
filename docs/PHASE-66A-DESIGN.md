# PHASE 66A DESIGN: Analytics & Growth Visibility

**Phase:** 66A
**Stage:** STAGE-66A
**Task:** TASK-66A — Analytics & Growth Visibility Design
**Nature:** DOCUMENTATION / DESIGN (NO CODE)
**Status:** DESIGN COMPLETE
**Date:** 2026-03-09
**Prerequisite:** PHASE-58, PHASE-59, PHASE-60, PHASE-65 COMPLETE
**Next Phase:** Implementation (when authorized)

---

## 1. Overview

### 1.1 Purpose

Phase 66A defines launch-ready analytics and growth visibility scope for the AI Sandbox Platform. The design establishes product usage, retention, feature adoption, reliability, and cost visibility requirements; operator and stakeholder dashboard needs; and evidence/review/signoff expectations. All visibility is derived from **existing endpoints and data sources**—no new platform endpoints, no schema changes, no background workers.

### 1.2 Architectural Constraints

Per ARCHITECTURE.md Section 11:
- No background workers
- No cron jobs
- No event bus

**Implication:** Analytics and growth visibility are **consumption-only**. Operators and stakeholders obtain visibility by polling existing endpoints, running manual queries, or using external BI tools. The platform does not aggregate, store, or push analytics data.

### 1.3 Baseline Endpoints (Unchanged)

| Endpoint | Source | Purpose |
|----------|--------|---------|
| `GET /api/runtime/metrics` | PHASE-41A | Session/container counts, connectivity, termination reasons |
| `GET /api/health` | api-gateway | Basic liveness |
| `GET /api/health/db` | api-gateway | Database connectivity |
| `GET /api/health/ready` | api-gateway | Readiness |
| `GET /api/billing/efficiency-summary` | PHASE-59 | Cost efficiency (periodStart/periodEnd) |
| `GET /api/billing/provider-trends` | PHASE-59 | Cost trends (periodStart/periodEnd) |
| `GET /api/internal/admin/users/:userId/summary` | Task 11A | Per-user quota, usage |

---

## 2. Analytics Scope

### 2.1 Launch-Ready Analytics Visibility (In Scope)

| Category | Visibility Required | Data Source |
|----------|---------------------|-------------|
| **Session activity** | Active/terminated counts; termination reason breakdown | /api/runtime/metrics |
| **Reliability** | Error termination rate; connectivity status | /api/runtime/metrics |
| **Cost** | Efficiency summary; provider trends; cost per execution | /api/billing/efficiency-summary, provider-trends |
| **User usage** | Per-user quota status, usage | /api/internal/admin/users/:userId/summary |
| **Operational health** | Liveness, DB, readiness | /api/health, /api/health/db, /api/health/ready |

### 2.2 In Scope vs Deferred

| In Scope | Deferred |
|----------|----------|
| Design-level visibility requirements | New analytics endpoints |
| Product/usage visibility definitions | Automated retention/cohort analysis |
| Reliability/cost visibility definitions | Real-time dashboards in platform |
| Operator/stakeholder dashboard requirements | BI tool integration in platform |
| Evidence/review/signoff expectations | Background aggregation jobs |
| Architecture fit and constraints | Prometheus/OpenMetrics format |
| Manual/script-driven consumption model | Event-driven analytics |

### 2.3 Launch-Day Analytics Reality

- **Visibility:** Operators and stakeholders use existing endpoints (curl, scripts, external BI) or manual DB queries
- **No analytics API:** All data comes from runtime metrics, billing, and admin endpoints
- **No time-series storage:** Platform does not retain historical metrics; external systems must store if needed
- **Request-driven:** Each visibility need is satisfied by an HTTP request or DB query at review time

---

## 3. Product / Usage Visibility Requirements

### 3.1 User Activity Visibility

| Metric | Definition | Source | Aggregation |
|--------|------------|--------|-------------|
| **Active sessions** | Count of non-terminated sessions | runtime/metrics → activeSessionCount | Point-in-time |
| **Terminated sessions** | Count of terminated sessions | runtime/metrics → terminatedSessionCount | Point-in-time |
| **Termination breakdown** | Count by reason (idle_timeout, max_lifetime, explicit_delete, error) | runtime/metrics → terminationReasons | Point-in-time |
| **Per-user usage** | Quota status, tokens used, sessions | admin/users/:userId/summary | Per-user, on-demand |

**Limitation:** No historical session creation rate, no DAU/WAU/MAU from platform. These require external polling and storage or manual DB queries.

### 3.2 Feature Usage Visibility

| Feature | Observable Signal | Source |
|---------|------------------|--------|
| **Session creation** | activeSessionCount + terminatedSessionCount (cumulative) | runtime/metrics |
| **AI execution** | totalExecutions, totalTokens in efficiency-summary | billing/efficiency-summary |
| **Preview** | Not separately observable in current endpoints | Deferred |
| **Import/export** | Not separately observable in current endpoints | Deferred |

**Design expectation:** Feature-level visibility is limited to what billing and runtime metrics expose. Granular feature instrumentation is deferred.

### 3.3 Retention / Repeat Usage Visibility

| Metric | Definition | How to Obtain |
|--------|------------|---------------|
| **Repeat users** | Users with >1 session in period | Manual DB query: COUNT(DISTINCT user_id) WHERE created_at IN period, GROUP BY user_id HAVING COUNT(*) > 1 |
| **New vs returning** | First-time vs repeat in period | Manual DB query; requires session history |
| **Session frequency** | Sessions per user per period | Manual DB query: sessions GROUP BY user_id |

**Design expectation:** Retention and repeat usage require manual DB queries or external aggregation. No platform endpoint provides this. Launch-ready minimum: per-user summary on demand.

### 3.4 Common Workflow / Operation Visibility

| Workflow | Observable | Source |
|----------|-----------|--------|
| **Create session → use → terminate** | Session counts; termination reasons | runtime/metrics |
| **AI execution** | totalExecutions, totalTokens, failedExecutions | billing/efficiency-summary |
| **Quota exhaustion** | Per-user quota status | admin/users/:userId/summary |
| **Cost accumulation** | totalCostUSD, byProvider | billing/efficiency-summary, provider-trends |

---

## 4. Reliability / Cost Visibility Requirements

### 4.1 Error / Failure Visibility

| Metric | Definition | Source |
|--------|-------------|--------|
| **Error termination rate** | terminationReasons[reason="error"].count / terminatedSessionCount | runtime/metrics |
| **Connectivity status** | dockerConnectivity, databaseConnectivity | runtime/metrics |
| **Failed executions** | failedExecutions in efficiency-summary | billing/efficiency-summary |
| **Execution success rate** | completedExecutions / (completedExecutions + failedExecutions) | billing/efficiency-summary |

**Correlation:** When error termination rate is elevated (per PHASE-60 >20%), correlate with failedExecutions in efficiency-summary for same period to distinguish session-level vs execution-level failures.

### 4.2 Cost-Per-User / Cost-Per-Feature Visibility

| Metric | Definition | Source |
|--------|-------------|--------|
| **Total cost (period)** | totalCostUSD | billing/efficiency-summary |
| **Cost by provider** | byProvider[].totalCostUSD | billing/efficiency-summary, provider-trends |
| **Cost per execution** | totalCostUSD / completedExecutions | billing/efficiency-summary |
| **Cost per 1K tokens** | totalCostUSD / (totalTokens/1000) | billing/efficiency-summary |
| **Per-user cost** | Not available from current endpoints | Manual DB query or deferred |

**Design expectation:** Cost visibility is apiKeyId-scoped (billing endpoints). Per-user cost requires manual aggregation from usage_records or future endpoint.

### 4.3 Operational Correlation Requirements

| Correlation | When | How |
|-------------|------|-----|
| **Error rate vs cost** | Elevated errors | Compare terminationReasons (runtime/metrics) with failedExecutions (efficiency-summary); failed executions may incur cost |
| **Session volume vs cost** | Cost spike | efficiency-summary totalExecutions, totalTokens vs provider-trends by day |
| **Connectivity vs reliability** | Incident investigation | runtime/metrics dockerConnectivity, databaseConnectivity with terminationReasons |

---

## 5. Dashboard / Consumer Requirements

### 5.1 Operator Dashboard Needs

| Need | Data | Refresh Model |
|------|------|---------------|
| **Runtime health** | activeSessionCount, runningContainerCount, connectivity | Poll runtime/metrics every 60s (per PHASE-60) |
| **Termination health** | terminationReasons; error rate | Poll runtime/metrics every 60s |
| **Cost snapshot** | efficiency-summary for rolling 24h or 7d | On-demand or daily script |
| **User lookup** | Per-user quota/usage | On-demand via admin/users/:userId/summary |

**Consumption:** Operator uses existing endpoints via curl, Postman, or external dashboard (Grafana, custom script). No platform-hosted operator dashboard.

### 5.2 Stakeholder / Founder Reporting Needs

| Need | Data | Refresh Model |
|------|------|---------------|
| **Usage growth** | totalExecutions, totalTokens, totalCostUSD over periods | Weekly/monthly: call efficiency-summary with periodStart/periodEnd |
| **Reliability** | Error rate, success rate | Weekly: runtime/metrics + efficiency-summary |
| **Cost efficiency** | Cost per execution, cost per 1K tokens, byProvider | Weekly/monthly: efficiency-summary, provider-trends |
| **Session activity** | activeSessionCount, terminatedSessionCount | Point-in-time or polled; runtime/metrics |

**Consumption:** Stakeholder receives reports from operator (spreadsheet, slide deck) or accesses external BI that polls endpoints. No platform-hosted stakeholder dashboard.

### 5.3 Review Cadence Expectations

| Review | Frequency | Owner | Data Sources |
|--------|-----------|-------|--------------|
| **Operational health** | Continuous (external monitor) | Operator | runtime/metrics, health endpoints |
| **Cost review** | Weekly | Platform owner or delegate | efficiency-summary, provider-trends |
| **Usage/growth review** | Weekly or monthly | Stakeholder | efficiency-summary, provider-trends |
| **Reliability review** | Weekly | Operator | runtime/metrics, efficiency-summary |
| **Analytics signoff** | Per launch milestone | Platform owner | Evidence per Section 6 |

---

## 6. Data Definitions / Evidence Requirements

### 6.1 Required Metric Definitions

| Metric | Definition | Aggregation Boundary |
|--------|-------------|----------------------|
| **activeSessionCount** | Sessions with terminated_at IS NULL | Platform-wide; point-in-time |
| **terminatedSessionCount** | Sessions with terminated_at IS NOT NULL | Platform-wide; cumulative |
| **runningContainerCount** | Containers reported by Docker API | Platform-wide; point-in-time |
| **totalExecutions** | Count of usage_records in period | apiKeyId + periodStart/periodEnd |
| **totalTokens** | Sum of tokensUsed in period | apiKeyId + periodStart/periodEnd |
| **totalCostUSD** | Sum of cost from usage_records (pricing applied) | apiKeyId + periodStart/periodEnd |
| **failedExecutions** | Count where execution_status = 'failed' | apiKeyId + periodStart/periodEnd |
| **error termination rate** | terminationReasons[error] / terminatedSessionCount | Platform-wide; point-in-time |

### 6.2 Aggregation Boundaries

| Boundary | Scope | Notes |
|----------|-------|-------|
| **Platform** | All sessions, all containers | runtime/metrics |
| **apiKeyId** | Billing/usage for single apiKey | billing endpoints |
| **user_id** | Per-user quota, usage | admin/users/:userId/summary |
| **Time window** | periodStart, periodEnd | billing endpoints require explicit params |

**No cross-apiKey aggregation** in current design. Multi-tenant rollup requires external aggregation.

### 6.3 Review / Signoff / Evidence Expectations

| Deliverable | Evidence | Signoff |
|-------------|----------|---------|
| **Launch analytics readiness** | Checklist: all required visibility obtainable from existing endpoints | Platform owner |
| **Cost visibility** | efficiency-summary and provider-trends return valid data for test period | Platform owner |
| **Reliability visibility** | runtime/metrics returns terminationReasons; error rate computable | Operator |
| **Operator dashboard** | Document or script showing how to obtain each required view | Operator |
| **Stakeholder report** | Sample report (spreadsheet/slide) with weekly usage, cost, reliability | Platform owner |

**Retention:** Evidence (checklists, sample reports) retained per PHASE-65 audit expectations (12 months minimum for operational records).

---

## 7. Architecture Fit

### 7.1 Alignment with No-Worker / No-Cron Constraints

| Constraint | Implication for Analytics |
|------------|---------------------------|
| No background workers | No automated analytics aggregation; operators or external tools poll on demand |
| No cron | No scheduled report generation; external scheduler or manual |
| No event bus | No real-time analytics events; polling interval determines freshness |
| Request-driven | Every visibility need = HTTP request or DB query at review time |

### 7.2 Request-Driven Reality First

- **Existing endpoints** provide all launch-ready analytics data
- **Billing endpoints** require periodStart/periodEnd; caller chooses window
- **runtime/metrics** is point-in-time; no history; external system must store for trends
- **Per-user data** requires known user_id; no bulk user analytics endpoint

### 7.3 Deferred Future Analytics Automation / BI Improvements

| Improvement | When | Notes |
|-------------|------|-------|
| Dedicated analytics API | When product requires | New read-only endpoints; schema unchanged |
| Per-user cost aggregation | When multi-tenant reporting required | New endpoint or DB view |
| Retention/cohort endpoints | When growth analytics required | New endpoint; may need schema |
| Prometheus/OpenMetrics format | When Prometheus scrape required | runtime/metrics format change |
| Platform-hosted dashboards | When operator UI required | New frontend; architecture change |
| Automated report generation | When cron/tooling approved | External job; no platform cron |
| Real-time analytics | When event bus approved | Architecture change |

---

## 8. Phase Output Docs

| Document | Path | Purpose |
|----------|------|---------|
| Design | `docs/PHASE-66A-DESIGN.md` | This document |
| Checkpoint | `docs/PHASE-66A-CHECKPOINT.md` | Completion record |

---

**END OF DESIGN**
