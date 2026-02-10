# PHASE 27A DESIGN — Production Hardening

**Phase:** 27A — Production Hardening (DESIGN ONLY)
**Nature:** Design specification (NO implementation)
**Scope:** Platform-wide operational guarantees
**Status:** 🔒 DESIGN LOCKED
**Date:** 2026-02-07
**Dependencies:** Phase 26B (Production Readiness)

---

## PHASE OVERVIEW

Phase 27A defines the non-negotiable production hardening rules that govern platform behavior in real-world deployment environments. These rules establish deterministic operational guarantees for startup safety, environment separation, dependency failures, operator boundaries, and incident containment.

**Core Intent:**
- Prevent production incidents through fail-fast startup validation
- Enforce strict environment separation (dev/staging/prod)
- Define deterministic failure postures for all dependencies
- Establish clear operator authority boundaries
- Guarantee incident containment (no cascading failures)

**Design Principles:**
1. **Fail-Fast at Startup:** Invalid config → crash immediately (do NOT start)
2. **Fail-Closed on Critical:** Database down → block execution (do NOT serve)
3. **Fail-Open on Observability:** Metrics down → continue execution (do NOT block)
4. **Deterministic Failures:** Same dependency state → same behavior (always)
5. **Zero Cross-Environment Leakage:** Prod credentials NEVER touch staging/dev

**What This Phase Defines:**
- Startup validation rules (MUST pass before serving traffic)
- Environment separation contracts (config/data/credentials)
- Dependency failure decision tree (fail-open vs fail-closed)
- Operator mutation boundaries (what can/cannot be changed)
- Deployment safety invariants (pre/post checks)
- Incident containment guarantees (isolation walls)

**What This Phase Does NOT Define:**
- Implementation details (Phase 27B)
- CI/CD pipelines
- Monitoring dashboards
- Autoscaling policies
- Runtime policy engines

---

## 1. ENVIRONMENT SEPARATION MODEL

### 1.1 Environment Definitions

**Three Environments (ONLY):**

1. **Development (dev)**
   - Purpose: Local developer testing
   - Data: Synthetic/mock data ONLY
   - Traffic: Internal only (localhost, dev VPN)
   - Credentials: Dev-specific API keys, stub providers
   - Database: `aisandbox_dev` (local or dev cluster)
   - Deployment: Manual (developer workstation)

2. **Staging (staging)**
   - Purpose: Pre-production validation
   - Data: Anonymized production-like data OR fresh synthetic
   - Traffic: Internal QA team ONLY
   - Credentials: Staging-specific API keys, real provider test accounts
   - Database: `aisandbox_staging` (isolated cluster)
   - Deployment: Automated (CI/CD to staging cluster)

3. **Production (prod)**
   - Purpose: Live customer traffic
   - Data: Real customer data (PII present)
   - Traffic: Public internet
   - Credentials: Production API keys, real provider accounts
   - Database: `aisandbox_prod` (isolated HA cluster)
   - Deployment: Automated with manual approval gate

**Forbidden Environments:**
- ❌ No "local-prod" hybrid environments
- ❌ No "staging-prod" shared clusters
- ❌ No "dev-staging" credential reuse

### 1.2 Configuration Source Isolation

**Rule:** Each environment MUST load config from separate, isolated sources.

**Configuration Hierarchy (in precedence order):**
1. Environment variables (highest precedence)
2. Environment-specific config files (e.g., `.env.production`)
3. Default values in code (lowest precedence, fail-safe only)

**Isolation Rules:**

| Config Type | Development | Staging | Production |
|------------|-------------|---------|------------|
| Database URL | `DB_URL_DEV` | `DB_URL_STAGING` | `DB_URL_PROD` |
| API Keys | `.env.dev` | Kubernetes Secret (staging) | Kubernetes Secret (prod) |
| Provider SDKs | Stub/mock | Real (test accounts) | Real (prod accounts) |
| Kill Switches | Default enabled | Default enabled | Default enabled |
| Safety Limits | Permissive | Production-like | Strict |

**Enforcement:**
- Config file naming MUST include environment suffix: `.env.production`, `config.staging.json`
- Cross-environment config loading is a **startup-blocking error**
- No default fallback to production credentials (crash instead)

**Forbidden Patterns:**
```bash
# ❌ FORBIDDEN: Fallback to prod credentials
DB_URL=${DB_URL_STAGING:-$DB_URL_PROD}

# ✅ ALLOWED: Fail if staging not set
DB_URL=${DB_URL_STAGING:?STAGING DB_URL REQUIRED}
```

### 1.3 Credential Isolation

**Rule:** Production credentials MUST NEVER be accessible from dev or staging environments.

**Credential Storage:**

| Environment | Storage Mechanism | Access Control |
|------------|-------------------|----------------|
| Development | `.env.dev` (gitignored) | Local file system |
| Staging | Kubernetes Secrets (namespace: staging) | RBAC: staging-deploy role |
| Production | Kubernetes Secrets (namespace: prod) | RBAC: prod-deploy role (manual approval) |

**Mandatory Isolation:**
1. **Separate Secret Stores:**
   - Dev: Local files or HashiCorp Vault (dev tier)
   - Staging: Kubernetes Secrets (staging namespace)
   - Production: Kubernetes Secrets (prod namespace) + AWS Secrets Manager backup

2. **Zero Credential Sharing:**
   - Provider API keys MUST be different per environment
   - Database credentials MUST be different per environment
   - Billing/payment credentials MUST be production-exclusive

3. **Credential Rotation Isolation:**
   - Rotating prod credentials MUST NOT affect staging/dev
   - Rotating staging credentials MUST NOT affect prod/dev
   - Each environment rotates independently

**Forbidden:**
- ❌ Reusing production provider API keys in staging
- ❌ Connecting staging to production database (even read-only)
- ❌ Sharing payment system credentials across environments

### 1.4 Data Isolation

**Rule:** Production data MUST NEVER flow to staging or dev environments.

**Data Flow Rules:**

| Source | Destination | Allowed? | Transformation Required |
|--------|-------------|----------|-------------------------|
| Prod → Staging | ❌ NO | N/A (forbidden) |
| Prod → Dev | ❌ NO | N/A (forbidden) |
| Staging → Prod | ❌ NO | N/A (forbidden) |
| Dev → Prod | ❌ NO | N/A (forbidden) |
| Staging → Dev | ⚠️ CONDITIONAL | Must anonymize PII |
| Dev → Staging | ✅ YES | Synthetic data only |

**Anonymization Requirements (if staging → dev allowed):**
- PII fields MUST be replaced with synthetic values
- User IDs MUST be re-hashed
- API keys MUST be regenerated (not copied)
- Billing amounts MUST be randomized

**Database Connection Rules:**
1. **Production Database:**
   - Only production api-gateway connects
   - No read replicas exposed to staging/dev
   - No direct SQL access from staging/dev

2. **Staging Database:**
   - Completely separate cluster
   - Can be seeded with anonymized data OR fresh synthetic data
   - No connection to production database

3. **Development Database:**
   - Local database (developer workstation)
   - OR shared dev cluster (isolated from staging/prod)
   - Synthetic data only

**Forbidden Database Patterns:**
```sql
-- ❌ FORBIDDEN: Cross-environment query
SELECT * FROM prod_db.usage_records WHERE ...

-- ❌ FORBIDDEN: Staging reading from prod
CONNECT TO prod_db AS readonly_user;

-- ✅ ALLOWED: Staging has own database
CONNECT TO staging_db AS staging_user;
```

### 1.5 Explicit Forbidden Paths

**Production → Staging/Dev (FORBIDDEN):**
- ❌ No production database replication to staging
- ❌ No production API keys used in staging tests
- ❌ No production provider credentials in dev
- ❌ No production user data copied to staging
- ❌ No production logs shipped to dev debug tools

**Staging → Production (FORBIDDEN):**
- ❌ No staging code deployed to production (use tagged releases)
- ❌ No staging database migrations applied to production
- ❌ No staging feature flags enabled in production by default
- ❌ No staging test data injected into production

**Dev → Production (FORBIDDEN):**
- ❌ No developer workstation direct access to production database
- ❌ No local code changes deployed to production (use CI/CD)
- ❌ No dev credentials promoted to production

**Cross-Environment Network Access (FORBIDDEN):**
- ❌ No network routes between prod and staging/dev
- ❌ No VPN allowing staging → prod database access
- ❌ No shared Kubernetes clusters (separate namespaces NOT sufficient)

### 1.6 Environment Detection

**Rule:** Services MUST detect their environment at startup and enforce corresponding constraints.

**Detection Mechanism:**
1. Read `NODE_ENV` environment variable
2. Valid values: `development`, `staging`, `production` (ONLY)
3. If `NODE_ENV` not set → **CRASH** (do NOT default)
4. If `NODE_ENV` invalid → **CRASH** (do NOT guess)

**Environment-Specific Behavior:**

| Behavior | Development | Staging | Production |
|----------|-------------|---------|------------|
| Startup Validation | Permissive | Strict | Strictest |
| Error Stack Traces | Full | Full | Sanitized |
| Debug Logging | Enabled | Enabled | Disabled |
| Kill Switch Defaults | All enabled | All enabled | All enabled |
| Safety Limits | 10x prod limits | 2x prod limits | Strict limits |
| Credential Validation | Skip some | Validate all | Validate all |

**Startup Crash Conditions (by Environment):**

**Development:**
- ✅ Missing optional provider credentials → WARN (allow stub)
- ✅ Database not migrated → WARN (offer auto-migrate)
- ❌ `NODE_ENV` not set → CRASH

**Staging:**
- ❌ Missing required provider credentials → CRASH
- ❌ Database not migrated → CRASH
- ❌ Config file missing → CRASH

**Production:**
- ❌ ANY missing required config → CRASH
- ❌ Database not migrated → CRASH
- ❌ Kill switch config invalid → CRASH
- ❌ Safety limit config invalid → CRASH
- ❌ Provider credential validation fails → CRASH

---

## 2. STARTUP FAIL-FAST RULES

### 2.1 Mandatory Startup Checks

**Rule:** Before serving ANY traffic, the system MUST validate all critical configuration and dependencies. If ANY check fails, the system MUST crash immediately (exit code 1).

**Startup Check Sequence (in order):**

#### Phase 1: Environment Detection (0–5 seconds)
1. ✅ `NODE_ENV` is set → if not, **CRASH**
2. ✅ `NODE_ENV` is valid (`development`, `staging`, `production`) → if not, **CRASH**
3. ✅ Current working directory is correct → if not, **CRASH**

#### Phase 2: Configuration Validation (5–10 seconds)
4. ✅ All required environment variables present → if not, **CRASH**
5. ✅ Database URL format valid → if not, **CRASH**
6. ✅ Database credentials format valid → if not, **CRASH**
7. ✅ Provider API keys format valid → if not, **CRASH** (prod/staging only)
8. ✅ Kill switch environment variables are boolean-compatible → if not, **CRASH**
9. ✅ Safety limit environment variables are numeric → if not, **CRASH**
10. ✅ Port number valid and not in use → if not, **CRASH**

#### Phase 3: Database Connectivity (10–20 seconds)
11. ✅ Database reachable (TCP connection) → if not, **CRASH**
12. ✅ Database authentication succeeds → if not, **CRASH**
13. ✅ Database schema exists → if not, **CRASH**
14. ✅ Database migrations up-to-date → if not, **CRASH**
15. ✅ Required tables exist → if not, **CRASH**

#### Phase 4: Dependency Validation (20–30 seconds)
16. ✅ Redis reachable (if configured) → if not, **WARN** (Phase 27B: fail-open for now)
17. ✅ Provider SDK connectivity (health check endpoint) → if not, **CRASH** (prod/staging)
18. ✅ Billing database reachable → if not, **CRASH**

#### Phase 5: Service Initialization (30–40 seconds)
19. ✅ All NestJS modules load successfully → if not, **CRASH**
20. ✅ All guards register successfully → if not, **CRASH**
21. ✅ All repositories initialize → if not, **CRASH**

#### Phase 6: Final Validation (40–45 seconds)
22. ✅ Kill switch config loaded → if not, **CRASH**
23. ✅ Safety limit config loaded → if not, **CRASH**
24. ✅ Audit log service initialized → if not, **CRASH**
25. ✅ HTTP server binds to port → if not, **CRASH**

**Total Startup Time Budget:** 45 seconds maximum (production)

**Startup Success Criteria:**
- All 25 checks pass → log "Service ready" → serve traffic
- ANY check fails → log failure details → exit(1)

### 2.2 Required Environment Variables

**Rule:** Services MUST validate ALL required environment variables at startup. Missing or invalid values MUST cause immediate crash.

**api-gateway Required Variables (Production):**

| Variable | Type | Example | Crash if Missing? |
|----------|------|---------|-------------------|
| `NODE_ENV` | enum | `production` | ✅ YES |
| `PORT` | number | `3000` | ✅ YES |
| `DATABASE_URL` | URL | `postgresql://...` | ✅ YES |
| `REDIS_URL` | URL | `redis://...` | ⚠️ WARN (Phase 27B) |
| `ANTHROPIC_API_KEY` | string | `sk-ant-...` | ✅ YES |
| `OPENAI_API_KEY` | string | `sk-...` | ✅ YES |
| `JWT_SECRET` | string | `[random]` | ✅ YES (Phase 28+) |

**Kill Switch Variables (Optional, with fail-safe defaults):**

| Variable | Default | Crash if Invalid? |
|----------|---------|-------------------|
| `GLOBAL_EXECUTION_ENABLED` | `true` | ✅ YES (if not boolean-compatible) |
| `PROVIDER_OPENAI_ENABLED` | `true` | ✅ YES (if not boolean-compatible) |
| `BILLING_SNAPSHOT_ENABLED` | `true` | ✅ YES (if not boolean-compatible) |

**Safety Limit Variables (Optional, with defaults):**

| Variable | Default | Crash if Invalid? |
|----------|---------|-------------------|
| `MAX_TOKENS_PER_EXECUTION` | `100000` | ✅ YES (if not number) |
| `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | `10000` | ✅ YES (if not number) |
| `MAX_DAILY_SPEND_HARD_USD` | `20000` | ✅ YES (if not number) |

**Validation Rules:**
1. **Boolean Variables:** Must be `"true"`, `"false"`, or unset (default)
   - ❌ Invalid: `"yes"`, `"1"`, `"enabled"` → **CRASH**
2. **Number Variables:** Must parse to valid number
   - ❌ Invalid: `"unlimited"`, `"10k"`, `"NaN"` → **CRASH**
3. **URL Variables:** Must be valid URL with correct protocol
   - ❌ Invalid: `localhost:5432`, `postgres://` (missing host) → **CRASH**

**Startup Validation Example:**
```typescript
// ✅ CORRECT: Crash if invalid
const port = parseInt(process.env.PORT || '', 10);
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be valid number 1-65535');
}

// ❌ WRONG: Silent fallback to default
const port = parseInt(process.env.PORT || '3000', 10);
```

### 2.3 Database Migration State Validation

**Rule:** At startup, the system MUST validate that the database schema matches the expected migration state. Mismatched migration state MUST cause immediate crash.

**Migration State Checks:**
1. ✅ Migrations table exists (`_migrations` or similar)
2. ✅ Latest migration version recorded in database matches code expectation
3. ✅ No pending migrations (all migrations applied)
4. ✅ No orphaned migrations (migrations in DB but not in code)

**Failure Scenarios:**

| Scenario | Behavior |
|----------|----------|
| Migrations table missing | **CRASH** (database not initialized) |
| Migration version mismatch | **CRASH** (code/DB out of sync) |
| Pending migrations exist | **CRASH** (operator must run migrations first) |
| Orphaned migrations | **CRASH** (invalid state, rollback required) |
| Migration lock held | **CRASH** after 30s timeout (another process migrating) |

**Forbidden Auto-Recovery:**
- ❌ Do NOT auto-run migrations at startup (security risk)
- ❌ Do NOT skip migration checks in production
- ❌ Do NOT downgrade schema automatically
- ❌ Do NOT ignore migration errors

**Allowed in Development ONLY:**
- ✅ Offer to auto-run migrations (with explicit confirmation)
- ✅ Allow creating database if missing

### 2.4 Kill Switch & Safety Limit Validation

**Rule:** At startup, validate that kill switch and safety limit configurations are internally consistent and within acceptable bounds.

**Kill Switch Validation:**
1. ✅ All kill switch environment variables parse as boolean-compatible
2. ✅ At least one provider kill switch enabled (warn if all disabled)
3. ✅ Billing/invoice kill switches parseable

**Safety Limit Validation:**
1. ✅ `MAX_TOKENS_PER_EXECUTION` > 0 and < 1,000,000
2. ✅ `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` > 0 and < 1,000,000
3. ✅ `MAX_DAILY_SPEND_SOFT_USD` < `MAX_DAILY_SPEND_HARD_USD`
4. ✅ `MAX_DAILY_SPEND_HARD_USD` > 0 and < $1,000,000
5. ✅ Provider rate limits > 0 and < 100,000

**Crash Conditions:**
- ❌ Soft cap ≥ hard cap → **CRASH** (invalid constraint)
- ❌ Any limit is negative → **CRASH**
- ❌ Any limit is zero → **CRASH** (would block all traffic)
- ❌ Any limit exceeds sanity bounds → **CRASH**

**Warning Conditions:**
- ⚠️ All provider kill switches disabled → **WARN** (no providers available)
- ⚠️ Hard cap < $1,000 → **WARN** (suspiciously low)
- ⚠️ Global rate limit < 100 → **WARN** (suspiciously low)

### 2.5 Startup Failure Error Messages

**Rule:** When startup fails, error messages MUST be actionable and include remediation steps.

**Error Message Template:**
```
[STARTUP FAILURE] {Check Name} failed
Reason: {Specific failure reason}
Expected: {What was expected}
Actual: {What was found}
Remediation: {How to fix}
Documentation: {Link to docs}
```

**Examples:**

**Missing Environment Variable:**
```
[STARTUP FAILURE] Required environment variable missing
Reason: DATABASE_URL not set
Expected: PostgreSQL connection URL
Actual: undefined
Remediation: Set DATABASE_URL environment variable
  Example: export DATABASE_URL="postgresql://user:pass@host:5432/db"
Documentation: https://docs.aisandbox.dev/config/database
Exit Code: 1
```

**Migration State Mismatch:**
```
[STARTUP FAILURE] Database migration state mismatch
Reason: Pending migrations detected
Expected: Migration version 025B-3
Actual: Migration version 025B-2
Remediation: Run migrations before starting service
  Command: npm run migrate:up
Documentation: https://docs.aisandbox.dev/deployment/migrations
Exit Code: 1
```

**Invalid Safety Limit:**
```
[STARTUP FAILURE] Safety limit validation failed
Reason: MAX_DAILY_SPEND_SOFT_USD ≥ MAX_DAILY_SPEND_HARD_USD
Expected: Soft cap < Hard cap
Actual: Soft=20000, Hard=20000
Remediation: Adjust environment variables
  Example: MAX_DAILY_SPEND_SOFT_USD=10000 MAX_DAILY_SPEND_HARD_USD=20000
Documentation: https://docs.aisandbox.dev/config/safety-limits
Exit Code: 1
```

### 2.6 Startup Success Indication

**Rule:** When startup succeeds, the system MUST log a clear success message with service metadata.

**Success Log Format:**
```json
{
  "level": "info",
  "timestamp": "2026-02-07T12:00:00.000Z",
  "message": "Service ready",
  "service": "api-gateway",
  "version": "1.27.0",
  "environment": "production",
  "port": 3000,
  "startupDurationMs": 42350,
  "checks": {
    "database": "connected",
    "migrations": "up-to-date",
    "killSwitches": "loaded",
    "safetyLimits": "loaded"
  }
}
```

**Forbidden:**
- ❌ Logging "Server started" before checks complete
- ❌ Serving traffic before all checks pass
- ❌ Accepting connections during startup validation

---

## 3. DEPENDENCY FAILURE POSTURE

### 3.1 Failure Classification

**Rule:** Every external dependency MUST have a documented failure posture (fail-open vs fail-closed).

**Dependency Categories:**

1. **Critical Dependencies (Fail-Closed):**
   - System CANNOT function without these
   - Failure → reject requests with 503
   - Examples: Database, AI providers, Auth service

2. **Important Dependencies (Fail-Closed with Fallback):**
   - System can function with degraded behavior
   - Failure → reject SOME requests, allow others
   - Examples: Usage ledger (write failures), Billing (read failures)

3. **Observability Dependencies (Fail-Open):**
   - System can function without these
   - Failure → log error, continue execution
   - Examples: Metrics, Logging, Tracing

### 3.2 Database Failure Posture

**Dependency:** PostgreSQL (primary database)

**Failure Posture:** **FAIL-CLOSED**

**Scenarios:**

| Failure Type | Behavior | HTTP Code | Retry? |
|--------------|----------|-----------|--------|
| Connection refused | Reject all requests | 503 | ✅ YES (5 retries, exponential backoff) |
| Authentication failed | Reject all requests | 503 | ❌ NO (crash after 3 attempts) |
| Connection timeout | Reject all requests | 503 | ✅ YES (3 retries) |
| Query timeout | Reject individual request | 504 | ❌ NO (return error to client) |
| Connection pool exhausted | Reject new requests | 503 | ⏳ WAIT (queue up to 10s) |
| Deadlock detected | Reject individual request | 500 | ✅ YES (3 retries with jitter) |
| Constraint violation | Reject individual request | 409 | ❌ NO (client error) |

**Deterministic Behavior:**
- Database down at startup → **CRASH** (do not start)
- Database down during runtime → **503** all requests
- Database recovers → automatically resume serving traffic

**Forbidden:**
- ❌ Do NOT cache database reads to serve stale data
- ❌ Do NOT queue writes to retry later (would violate determinism)
- ❌ Do NOT serve partial responses with missing database data

**Allowed:**
- ✅ Retry transient failures (connection refused, timeout)
- ✅ Health check endpoint returns 503 when DB down
- ✅ Graceful shutdown waits for in-flight DB queries

### 3.3 AI Provider Failure Posture

**Dependency:** AI Provider SDKs (Anthropic, OpenAI, Groq, xAI, DeepSeek)

**Failure Posture:** **FAIL-CLOSED** (per provider)

**Scenarios:**

| Failure Type | Behavior | HTTP Code | Retry? |
|--------------|----------|-----------|--------|
| Provider unreachable | Reject requests for that provider | 503 | ✅ YES (3 retries, exponential backoff) |
| Provider rate limit (429) | Reject request | 429 | ❌ NO (propagate to client) |
| Provider auth failed (401) | Reject requests for that provider | 503 | ❌ NO (operator fix required) |
| Provider invalid request (400) | Reject request | 400 | ❌ NO (client error) |
| Provider timeout | Reject request | 504 | ✅ YES (1 retry) |
| Provider internal error (500) | Reject request | 502 | ✅ YES (2 retries) |

**Provider-Specific Kill Switch Interaction:**
- If provider fails repeatedly (>10 failures in 1 minute) → **LOG** alert (do NOT auto-disable)
- Operator MAY manually disable provider via kill switch
- Provider failure does NOT affect other providers

**Deterministic Behavior:**
- Provider down for `anthropic` → only `anthropic` requests fail (503)
- Provider down for `openai` → `openai` requests fail, `anthropic` continues
- All providers down → all execution requests fail (503)

**Forbidden:**
- ❌ Do NOT auto-failover to different provider (changes execution semantics)
- ❌ Do NOT cache AI responses to serve on failure
- ❌ Do NOT retry on non-idempotent errors (4xx client errors)

### 3.4 Usage Ledger Failure Posture

**Dependency:** Usage ledger write (Phase 22B)

**Failure Posture:** **FAIL-CLOSED** (execution succeeds ONLY if ledger write succeeds)

**Scenarios:**

| Failure Type | Behavior | HTTP Code | Client Sees |
|--------------|----------|-----------|-------------|
| Ledger write fails | Rollback execution, reject request | 500 | AI response NOT returned |
| Ledger table locked | Wait, then fail | 500 | AI response NOT returned |
| Ledger DB unreachable | Fail immediately | 503 | AI response NOT returned |

**Critical Guarantee:**
- AI execution succeeds → Usage record ALWAYS written
- Usage record write fails → AI execution ROLLED BACK (client sees failure)

**Reasoning:**
Usage ledger is source-of-truth for billing. Losing usage records violates billing integrity.

**Forbidden:**
- ❌ Do NOT return AI response if ledger write fails
- ❌ Do NOT queue ledger writes for async retry (would violate determinism)
- ❌ Do NOT skip ledger writes under any circumstances

### 3.5 Billing Snapshot Failure Posture

**Dependency:** Billing snapshot creation (Phase 23B-4)

**Failure Posture:** **FAIL-CLOSED** (with kill switch override)

**Scenarios:**

| Failure Type | Behavior | Kill Switch Effect |
|--------------|----------|-------------------|
| Billing DB unreachable | Snapshot creation fails, throw error | Operator can disable `BILLING_SNAPSHOT_ENABLED` |
| Pricing config missing | Snapshot creation fails, throw error | Operator must fix config |
| Duplicate snapshot | Throw error (idempotency violation) | No override (data integrity) |

**Impact Isolation:**
- Billing snapshot failure does NOT affect AI execution
- Billing snapshot failure does NOT affect usage ledger
- Billing snapshot failure ONLY affects snapshot endpoint

**Forbidden:**
- ❌ Do NOT skip failed snapshots silently
- ❌ Do NOT retry snapshots automatically (could create duplicates)
- ❌ Do NOT block AI execution if billing snapshot fails

### 3.6 Invoice Generation Failure Posture

**Dependency:** Invoice generation (Phase 25B-1)

**Failure Posture:** **FAIL-CLOSED** (with kill switch override)

**Scenarios:**

| Failure Type | Behavior | Kill Switch Effect |
|--------------|----------|-------------------|
| Invoice DB unreachable | Invoice creation fails, throw error | Operator can disable `INVOICE_GENERATION_ENABLED` |
| Snapshot not found | Throw NotFoundException (404) | No override (data missing) |
| Duplicate invoice | Throw ConflictException (409) | No override (idempotency) |

**Impact Isolation:**
- Invoice failure does NOT affect AI execution
- Invoice failure does NOT affect usage ledger
- Invoice failure does NOT affect billing snapshots

### 3.7 Payment Execution Failure Posture (Future)

**Dependency:** Payment processing (Phase 25B-2+)

**Failure Posture:** **FAIL-CLOSED** (with kill switch override)

**Scenarios:**

| Failure Type | Behavior | Kill Switch Effect |
|--------------|----------|-------------------|
| Payment gateway unreachable | Payment fails, throw error | Operator can disable `PAYMENT_EXECUTION_ENABLED` |
| Payment declined | Record failure, throw error | No override (legitimate failure) |
| Payment timeout | Retry 3x, then fail | No override (transient) |

**Impact Isolation:**
- Payment failure does NOT affect AI execution
- Payment failure does NOT affect billing snapshots
- Payment failure does NOT affect invoice generation

### 3.8 Observability Failure Posture

**Dependencies:** Metrics (Prometheus), Logging (stdout), Tracing (Jaeger)

**Failure Posture:** **FAIL-OPEN**

**Scenarios:**

| Failure Type | Behavior | Impact on Execution |
|--------------|----------|---------------------|
| Metrics backend unreachable | Log error, continue execution | ✅ None |
| Log shipping fails | Buffer logs, continue execution | ✅ None |
| Tracing backend unreachable | Drop traces, continue execution | ✅ None |
| Metrics write timeout | Drop metric, continue execution | ✅ None |

**Critical Guarantee:**
- Observability failures NEVER block execution
- Observability failures NEVER cause 5xx errors
- Observability failures NEVER affect billing/payments

**Allowed:**
- ✅ Log observability failures to stderr
- ✅ Increment internal error counter
- ✅ Retry metric writes in background (best-effort)

**Forbidden:**
- ❌ Do NOT block requests if metrics fail
- ❌ Do NOT crash if logging backend unreachable
- ❌ Do NOT retry observability writes synchronously

### 3.9 Failure Posture Summary Table

| Dependency | Posture | Startup Crash? | Runtime Behavior | HTTP Code |
|------------|---------|----------------|------------------|-----------|
| **Database (PostgreSQL)** | Fail-Closed | ✅ YES | 503 all requests | 503 |
| **AI Providers** | Fail-Closed (per provider) | ✅ YES | 503 for that provider | 503 |
| **Usage Ledger** | Fail-Closed | ✅ YES | 500 execution fails | 500 |
| **Billing Snapshot** | Fail-Closed | ❌ NO | Throw error | 500 |
| **Invoice Generation** | Fail-Closed | ❌ NO | Throw error | 500 |
| **Payment Processing** | Fail-Closed | ❌ NO | Throw error | 500 |
| **Metrics (Prometheus)** | Fail-Open | ❌ NO | Log, continue | N/A |
| **Logging (stdout)** | Fail-Open | ❌ NO | Buffer, continue | N/A |
| **Tracing (Jaeger)** | Fail-Open | ❌ NO | Drop, continue | N/A |
| **Redis (Phase 27B+)** | Fail-Open (MVP) | ⚠️ WARN | Degrade to in-memory | N/A |

---

## 4. OPERATOR AUTHORITY & ACCESS BOUNDARIES

### 4.1 Operator Mutation Scope

**Rule:** Operators have LIMITED mutation authority. Most system behavior is locked at deploy-time.

**What Operators CAN Change at Runtime:**

1. **Kill Switches (via environment variables + restart):**
   - ✅ Toggle `GLOBAL_EXECUTION_ENABLED`
   - ✅ Toggle provider kill switches (`PROVIDER_*_ENABLED`)
   - ✅ Toggle billing/invoice kill switches
   - **Mechanism:** Update environment variable → restart pod
   - **Audit:** Logged via audit log service

2. **Safety Limits (via environment variables + restart):**
   - ✅ Adjust `MAX_TOKENS_PER_EXECUTION`
   - ✅ Adjust `MAX_EXECUTIONS_PER_MINUTE_GLOBAL`
   - ✅ Adjust `MAX_DAILY_SPEND_SOFT_USD`
   - ✅ Adjust `MAX_DAILY_SPEND_HARD_USD`
   - ✅ Adjust provider rate limits
   - **Mechanism:** Update environment variable → restart pod
   - **Audit:** Logged via audit log service

3. **Database Migrations (manual command):**
   - ✅ Run forward migrations (`npm run migrate:up`)
   - **Mechanism:** Execute migration command before deploy
   - **Audit:** Migration log table

**What Operators CANNOT Change at Runtime:**

❌ **Execution Logic:** No code changes without deploy
❌ **Billing Calculations:** No pricing changes without deploy
❌ **Data Integrity:** No manual data mutation (see 4.2)
❌ **Authentication:** No API key changes without deploy
❌ **Authorization:** No scope changes without deploy
❌ **Guard Stack Order:** No guard reordering without deploy
❌ **Provider SDK Config:** No provider URL changes without deploy

### 4.2 No Manual Data Mutation Guarantee

**Rule:** Operators MUST NEVER manually modify data in production databases. All data changes MUST occur through application logic.

**Forbidden Operations:**

```sql
-- ❌ FORBIDDEN: Manual update of usage records
UPDATE usage_records SET tokens_used = 0 WHERE user_id = 'X';

-- ❌ FORBIDDEN: Manual deletion of billing snapshots
DELETE FROM billing_snapshots WHERE snapshot_id = 'Y';

-- ❌ FORBIDDEN: Manual adjustment of invoice amounts
UPDATE invoices SET total_cost_usd = 100.00 WHERE invoice_id = 'Z';

-- ❌ FORBIDDEN: Manual insertion of usage records
INSERT INTO usage_records (api_key_id, tokens_used, ...) VALUES (...);

-- ❌ FORBIDDEN: Manual update of kill switch state in DB (if persisted)
UPDATE kill_switches SET enabled = true WHERE name = 'GLOBAL_EXECUTION';
```

**Why Forbidden:**
1. Breaks audit trail (no log of change)
2. Violates deterministic behavior (data out of sync with logic)
3. Bypasses validation (constraint violations)
4. Risk of data corruption

**Allowed Read-Only Operations:**

```sql
-- ✅ ALLOWED: Read-only queries for debugging
SELECT * FROM usage_records WHERE user_id = 'X';

-- ✅ ALLOWED: Aggregate queries for observability
SELECT COUNT(*) FROM billing_snapshots WHERE created_at > NOW() - INTERVAL '1 day';

-- ✅ ALLOWED: Debugging invoice state
SELECT * FROM invoices WHERE status = 'failed';
```

**Exception Handling:**
- If data corruption occurs, operators MUST use application-level repair tools (Phase 28+)
- Repair tools MUST log all changes to audit log
- Manual SQL is ONLY allowed for disaster recovery (with executive approval)

### 4.3 Audit Requirements for Operator Actions

**Rule:** ALL operator actions that affect system behavior MUST be logged to audit log.

**Auditable Actions:**

| Action | Log Entry | Required Fields |
|--------|-----------|-----------------|
| Kill switch toggle | `logKillSwitchChange()` | switchName, oldValue, newValue, actor, reason, timestamp |
| Safety limit change | `logSafetyLimitChange()` | limitName, oldValue, newValue, actor, reason, timestamp |
| Emergency override | `logEmergencyOverride()` | action, actor, reason, incidentId, timestamp |
| Database migration | Migration log table | version, actor, timestamp |

**Audit Log Retention:**
- Minimum: 90 days (compliance requirement)
- Recommended: 1 year (incident investigation)
- Storage: Append-only table (no deletions)

**Audit Log Access:**
- Read: Operators, compliance team
- Write: System only (no manual writes)
- Delete: NO ONE (immutable)

### 4.4 No "God Mode" Guarantees

**Rule:** No single operator action can bypass ALL safety controls.

**Multi-Layer Protection:**

1. **Kill Switches:** Operator can disable execution, but cannot bypass authentication
2. **Safety Limits:** Operator can adjust limits, but cannot disable them entirely (must be > 0)
3. **Database Constraints:** Operator cannot insert invalid data (constraints enforced)
4. **Audit Logs:** Operator cannot delete audit logs (append-only)

**Forbidden "God Mode" Actions:**
- ❌ No "disable all checks" flag
- ❌ No "bypass authentication" mode
- ❌ No "ignore constraints" flag
- ❌ No "admin API key" with unlimited access

**Exception:**
- Disaster recovery procedures (documented separately, requires executive approval)

### 4.5 Operator Access Boundaries

**Rule:** Operator access is scoped by environment and role.

**Access Matrix:**

| Role | Environment | Database Access | Kill Switch Toggle | Deploy Access |
|------|-------------|-----------------|-------------------|---------------|
| Developer | Dev | Full (local) | ✅ YES | ✅ YES (local) |
| QA Engineer | Staging | Read-only | ✅ YES | ✅ YES (via CI/CD) |
| DevOps | Staging, Prod | Read-only | ✅ YES (with approval) | ✅ YES (with approval) |
| SRE | Prod | Read-only | ✅ YES (incident only) | ❌ NO |
| Security | Prod | Read-only | ❌ NO | ❌ NO |
| Executive | All | Read-only | ✅ YES (emergency) | ❌ NO |

**Access Control Enforcement:**
- Environment variables: Kubernetes RBAC
- Database: PostgreSQL roles (read-only for operators)
- Deployments: CI/CD pipeline approvals
- Kill switches: Kubernetes ConfigMap updates (logged)

---

## 5. DEPLOYMENT SAFETY RULES

### 5.1 Pre-Deployment Invariants

**Rule:** Before deploying to production, the following invariants MUST be verified.

**Pre-Deployment Checklist:**

#### Code Quality
- [ ] All unit tests pass (100% required)
- [ ] All integration tests pass (100% required)
- [ ] Code review approved by 2+ engineers
- [ ] No TODO/FIXME comments in critical paths
- [ ] No debug logging in production code

#### Configuration
- [ ] Environment variables documented
- [ ] Kill switch defaults reviewed (all enabled)
- [ ] Safety limits reviewed (within acceptable bounds)
- [ ] Database migration scripts tested in staging
- [ ] No hardcoded credentials in code

#### Database
- [ ] Migrations tested in staging (full cycle: up → down → up)
- [ ] Migration rollback plan documented
- [ ] No destructive migrations (DROP TABLE) without backup
- [ ] Foreign key constraints verified
- [ ] Indexes created for new queries

#### Dependencies
- [ ] All provider API keys valid and tested
- [ ] Database connection tested
- [ ] Redis connection tested (Phase 27B+)
- [ ] External service health checks pass

#### Observability
- [ ] Metrics instrumented for new endpoints
- [ ] Error logging configured
- [ ] Alerts configured for new failure modes
- [ ] Runbooks updated for new features

### 5.2 Post-Deployment Validation

**Rule:** After deploying to production, the following validations MUST be performed within 30 minutes.

**Post-Deployment Checklist:**

#### Health Checks (0–5 minutes)
- [ ] Health endpoint returns 200: `GET /health`
- [ ] Service responds to requests: `POST /api/ai/execute`
- [ ] Database connectivity confirmed
- [ ] Kill switches loaded correctly

#### Smoke Tests (5–15 minutes)
- [ ] Execute 10 test requests (with test API key)
- [ ] Verify usage ledger writes
- [ ] Verify billing snapshot creation
- [ ] Verify invoice generation

#### Monitoring (15–30 minutes)
- [ ] Error rate < 0.1% (99.9% success rate)
- [ ] Response time < 2s (p95)
- [ ] No memory leaks (steady state)
- [ ] No database connection leaks

#### Rollback Readiness
- [ ] Rollback procedure tested in staging
- [ ] Previous version available in registry
- [ ] Rollback command ready: `kubectl rollout undo deployment/api-gateway`

### 5.3 Rollback Safety Expectations

**Rule:** Rollback MUST be possible within 10 minutes without data loss.

**Rollback Scenarios:**

| Scenario | Rollback Procedure | Data Impact |
|----------|-------------------|-------------|
| Code bug discovered | `kubectl rollout undo` → previous version | ✅ None (DB unchanged) |
| Migration breaks app | Revert code → run migration rollback | ⚠️ Possible (if migration was destructive) |
| Config error | Update ConfigMap → restart pods | ✅ None |
| Provider outage | Toggle kill switch → disable provider | ✅ None |

**Rollback Constraints:**

1. **Forward-Only Migrations:**
   - Migrations MUST be forward-compatible (new code works with old schema)
   - Destructive migrations (DROP TABLE) MUST have manual rollback scripts
   - Column additions MUST have default values (allow old code to run)

2. **Config Compatibility:**
   - New environment variables MUST have defaults (allow old code to run)
   - Removed environment variables MUST be deprecated gradually (warn, then remove)

3. **API Compatibility:**
   - New endpoints MUST NOT break existing clients
   - Deprecated endpoints MUST return 410 Gone (not 404)
   - Breaking changes MUST have version bump (v2 API)

**Rollback Test:**
- Deploy version N+1
- Verify health checks pass
- Rollback to version N
- Verify health checks pass
- **Expected result:** No errors, no data loss

### 5.4 Version Compatibility Rules

**Rule:** Deployments MUST be compatible with N-1 version (rolling update support).

**Compatibility Requirements:**

1. **Database Schema:**
   - New code MUST work with old schema (before migration)
   - Old code MUST work with new schema (after migration)
   - **Strategy:** Add columns with defaults, deprecate before dropping

2. **API Contracts:**
   - New code MUST accept old request format
   - Old code MUST accept new response format (ignore unknown fields)
   - **Strategy:** Additive changes only, use optional fields

3. **Kill Switches:**
   - New kill switches MUST have defaults (enabled)
   - Removed kill switches MUST be ignored (no crash)
   - **Strategy:** Graceful degradation if unknown switch

**Example: Adding New Column**

**Phase 1 (Version N):**
```sql
-- Migration: Add column with default
ALTER TABLE invoices ADD COLUMN payment_method VARCHAR(50) DEFAULT 'credit_card';
```
- Version N code: Ignores payment_method (doesn't read it)
- Version N+1 code: Reads and writes payment_method
- **Result:** Both versions work

**Phase 2 (Version N+1):**
- Deploy version N+1 (uses payment_method)
- Rollback to version N (still works, uses default)

**Phase 3 (Version N+2, later):**
- Make payment_method non-nullable (if needed)
- Old code no longer deployed (safe to enforce constraint)

### 5.5 Safe Partial Rollout Behavior

**Rule:** During partial rollouts (canary, blue-green), new and old versions MUST coexist safely.

**Partial Rollout Strategies:**

1. **Canary (10% → 50% → 100%):**
   - Deploy new version to 10% of pods
   - Monitor error rate for 15 minutes
   - If error rate < 1%, increase to 50%
   - If error rate < 1%, increase to 100%
   - If error rate ≥ 1%, rollback immediately

2. **Blue-Green (instant switch):**
   - Deploy new version to separate pod group (green)
   - Validate green pods (smoke tests)
   - Switch traffic from blue → green (instant)
   - Monitor for 30 minutes
   - If errors, switch back to blue

**Coexistence Requirements:**

| Aspect | Requirement |
|--------|-------------|
| Database | Old and new versions MUST use same schema |
| Kill Switches | Old and new versions MUST read same config |
| Safety Limits | Old and new versions MUST enforce same limits |
| API Keys | Old and new versions MUST validate same keys |
| Rate Limiting | Shared state (Redis) OR separate limits per version |

**Forbidden During Rollout:**
- ❌ Running migrations during partial rollout (wait for 100%)
- ❌ Toggling kill switches during rollout (creates inconsistency)
- ❌ Changing safety limits during rollout (creates inconsistency)

---

## 6. INCIDENT CONTAINMENT GUARANTEES

### 6.1 No Cascading Failures

**Rule:** Failures in one subsystem MUST NOT cascade to unrelated subsystems.

**Isolation Boundaries:**

```
┌─────────────────────────────────────────────┐
│            AI Execution Subsystem           │
│  ┌─────────────────────────────────────┐   │
│  │ ai-execution.controller.ts          │   │
│  │ execution-safety.guard.ts           │   │
│  │ ai-service-http.client.ts           │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    ↓ (usage ledger ONLY)
┌─────────────────────────────────────────────┐
│          Billing & Payments Subsystem       │
│  ┌─────────────────────────────────────┐   │
│  │ billing-snapshot.service.ts         │   │
│  │ invoice.service.ts                  │   │
│  │ payment.service.ts (future)         │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Failure Isolation Guarantees:**

1. **AI Execution → Billing:**
   - AI execution failure NEVER affects billing snapshot creation
   - Billing snapshots computed from usage ledger (not execution path)

2. **Billing → AI Execution:**
   - Billing snapshot failure NEVER blocks AI execution
   - Invoice failure NEVER blocks AI execution

3. **AI Execution → Payments:**
   - AI execution failure NEVER affects payment processing
   - Payment failure NEVER blocks AI execution

4. **Observability → All:**
   - Metrics failure NEVER blocks execution, billing, or payments
   - Logging failure NEVER blocks execution, billing, or payments

### 6.2 Execution Isolation from Billing

**Rule:** AI execution and billing MUST be completely isolated except through the usage ledger.

**Allowed Interactions:**
```
AI Execution → Usage Ledger (write)
Billing Snapshot ← Usage Ledger (read)
```

**Forbidden Interactions:**
```
AI Execution → Billing Snapshot (direct call) ❌
AI Execution → Invoice (direct call) ❌
Billing Snapshot → AI Execution (direct call) ❌
Invoice → AI Execution (direct call) ❌
```

**Failure Scenarios:**

| Failure | AI Execution Impact | Billing Impact |
|---------|-------------------|---------------|
| Billing snapshot creation fails | ✅ None (execution continues) | ❌ Snapshot not created |
| Billing DB down | ✅ None (execution continues) | ❌ All billing ops fail |
| Invoice generation fails | ✅ None (execution continues) | ❌ Invoice not created |
| Usage ledger write fails | ❌ Execution fails (500) | ✅ None (no bad data) |

**Critical Guarantee:**
- Usage ledger is the ONLY coupling point
- Usage ledger write failure blocks execution (prevents billing data loss)

### 6.3 Visibility Failures Never Affect Execution

**Rule:** Observability system failures (metrics, logs, traces) MUST NEVER block execution.

**Guaranteed Independence:**

| Observability Component | Failure Behavior | Execution Impact |
|------------------------|------------------|------------------|
| Prometheus (metrics) | Drop metrics, log error | ✅ None |
| Logging backend | Buffer logs, retry async | ✅ None |
| Jaeger (tracing) | Drop traces, continue | ✅ None |
| Health check endpoint | Return 503 if DB down | ✅ None (separate endpoint) |

**Implementation Rules:**
- Metrics writes MUST be async (non-blocking)
- Log writes MUST be async (non-blocking)
- Trace writes MUST be async (non-blocking)
- Observability errors MUST be logged to stderr (separate channel)

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Blocking execution on metrics
await metricsClient.recordExecution(...);
const result = await executeAI(...);

// ✅ ALLOWED: Fire-and-forget metrics
executeAI(...).then(result => {
  metricsClient.recordExecution(...).catch(err => {
    console.error('Metrics failed', err);
  });
  return result;
});
```

### 6.4 Payment Failures Never Affect Billing Snapshots

**Rule:** Payment processing failures MUST NOT corrupt or prevent billing snapshot creation.

**Data Flow Isolation:**

```
Usage Ledger (immutable)
    ↓
Billing Snapshot (derived, immutable)
    ↓
Invoice (derived, immutable)
    ↓
Payment (mutable, failure-prone) ← ISOLATED
```

**Failure Scenarios:**

| Payment Failure | Billing Snapshot Impact | Invoice Impact |
|----------------|------------------------|---------------|
| Payment gateway down | ✅ None (snapshot created) | ✅ None (invoice created) |
| Payment declined | ✅ None (snapshot created) | ✅ None (invoice marked unpaid) |
| Payment timeout | ✅ None (snapshot created) | ✅ None (invoice retries payment) |

**Critical Guarantee:**
- Payment failure ONLY affects payment_status field
- Payment failure NEVER deletes/modifies snapshot
- Payment failure NEVER deletes/modifies invoice
- Payment failure NEVER modifies usage ledger

### 6.5 Incident Containment Checklist

**When an incident occurs, verify these containment guarantees:**

- [ ] Execution failure does NOT affect billing
- [ ] Billing failure does NOT affect execution
- [ ] Payment failure does NOT affect billing
- [ ] Observability failure does NOT affect execution
- [ ] Database failure affects ALL subsystems (expected)
- [ ] Provider failure affects ONLY that provider (expected)
- [ ] Kill switch disables ONLY intended subsystem
- [ ] Safety limit blocks ONLY violating requests

**If containment violated:**
- Immediately toggle relevant kill switch
- Investigate coupling (should not exist)
- Fix in next deploy (add isolation)

---

## 7. EXPLICIT NON-GOALS

Phase 27A design explicitly does NOT include:

### 7.1 Implementation (Phase 27B)
- ❌ No code changes
- ❌ No startup validation implementation
- ❌ No environment detection logic
- ❌ No failure posture implementation
- ❌ No deployment scripts

### 7.2 CI/CD Pipelines
- ❌ No GitHub Actions workflows
- ❌ No Jenkins pipelines
- ❌ No GitLab CI config
- ❌ No automated testing pipelines
- ❌ No deployment automation

### 7.3 Autoscaling Logic
- ❌ No Kubernetes HPA (Horizontal Pod Autoscaler)
- ❌ No load-based scaling rules
- ❌ No auto-recovery mechanisms
- ❌ No dynamic resource allocation

### 7.4 Chaos Engineering
- ❌ No chaos monkey implementation
- ❌ No failure injection tools
- ❌ No resilience testing automation
- ❌ No game day scenarios

### 7.5 Runtime Policy Engines
- ❌ No Open Policy Agent (OPA)
- ❌ No dynamic policy evaluation
- ❌ No runtime rule engines
- ❌ No adaptive throttling

### 7.6 Advanced Monitoring
- ❌ No Grafana dashboards
- ❌ No Prometheus alert rules
- ❌ No PagerDuty integration
- ❌ No SLO/SLI definitions
- ❌ No anomaly detection

### 7.7 Multi-Region Deployment
- ❌ No geo-distribution logic
- ❌ No cross-region replication
- ❌ No regional failover
- ❌ No global load balancing

### 7.8 Disaster Recovery Automation
- ❌ No automated backups
- ❌ No automated restore procedures
- ❌ No disaster recovery runbooks
- ❌ No RTO/RPO guarantees

### 7.9 Security Hardening
- ❌ No penetration testing
- ❌ No security scanning automation
- ❌ No vulnerability patching automation
- ❌ No compliance automation

### 7.10 Performance Optimization
- ❌ No caching strategies
- ❌ No query optimization
- ❌ No connection pooling tuning
- ❌ No load testing automation

**Rationale:**
Phase 27A establishes DESIGN rules only. Implementation, tooling, and automation are deferred to Phase 27B and beyond.

---

## 8. SAFE RESUME POINT FOR PHASE 27B

**Checkpoint File:** `docs/PHASE-27A-DESIGN.md`

**What Phase 27B Can Implement:**

1. **Startup Validation Logic:**
   - Environment detection (NODE_ENV validation)
   - Configuration validation (required env vars)
   - Database connectivity checks
   - Migration state validation
   - Kill switch/safety limit validation

2. **Environment Separation:**
   - Config loading by environment
   - Credential isolation enforcement
   - Cross-environment connection blocking

3. **Failure Posture Implementation:**
   - Database failure handling (fail-closed)
   - AI provider failure handling (fail-closed per provider)
   - Observability failure handling (fail-open)
   - Usage ledger failure handling (fail-closed)

4. **Operator Tooling:**
   - Audit log persistence (database table)
   - Kill switch toggle helpers (CLI or API)
   - Deployment validation scripts

5. **Deployment Automation:**
   - Pre-deployment checks (automated)
   - Post-deployment validation (automated)
   - Rollback procedures (documented, tested)

**What Phase 27B MUST NOT Change:**

- ❌ Kill switch configuration format (Phase 26B)
- ❌ Safety limit configuration format (Phase 26B)
- ❌ Execution semantics (ai-service unchanged)
- ❌ Billing calculation logic (Phase 23B-4)
- ❌ Invoice generation logic (Phase 25B-1)
- ❌ Usage ledger write semantics (Phase 22B)

**Resume Conditions:**
- Phase 27A design reviewed and approved
- All design rules documented clearly
- No conflicts with previous phases (26B, 25B, etc.)
- Safe resume point established

**Suggested Phase 27B Implementation Priority:**
1. Startup validation (critical)
2. Environment detection (critical)
3. Database failure posture (critical)
4. Observability failure posture (important)
5. Deployment validation scripts (important)
6. Operator CLI tooling (nice-to-have)

---

## ULTRA-BRIEF SUMMARY

Phase 27A defines production hardening rules for safe, deterministic operation:

• **Environment Separation:** Strict dev/staging/prod isolation (config, credentials, data) — NO cross-environment leakage, production credentials NEVER touch staging/dev

• **Startup Fail-Fast:** 25 mandatory startup checks (env vars, database, migrations, kill switches) — crash immediately on failure, NO serving traffic with invalid config

• **Dependency Failure Posture:** Database/providers/ledger fail-closed (503/500), observability fails-open (continue execution) — deterministic failures, NO cascading across subsystems

• **Operator Boundaries:** Limited runtime authority (kill switches, safety limits via env vars) — NO manual data mutation, NO "god mode", ALL actions audited

• **Deployment Safety:** Pre/post checks, forward-compatible migrations, N-1 version compatibility, 10-minute rollback guarantee — NO data loss, NO breaking changes without version bump

• **Incident Containment:** Execution isolated from billing, payment failures never corrupt snapshots, observability never blocks execution — failures contained to single subsystem

**Status:** 🔒 DESIGN LOCKED (Phase 27B can implement)

---

**END OF PHASE 27A DESIGN**
