# PHASE 28A DESIGN — Launch Readiness

**Phase:** 28A — Launch Readiness (DESIGN ONLY)
**Nature:** Design specification (NO implementation)
**Scope:** Platform-wide launch enablement
**Status:** 🔒 DESIGN LOCKED
**Date:** 2026-02-07
**Dependencies:** Phase 27B (Production Hardening), Phase 26B (Safety Controls), Phase 25B (Invoicing), Phase 23B (Billing), Phase 22B (Usage Ledger)

---

## PHASE OVERVIEW

Phase 28A defines the launch readiness architecture and operational policy required to safely enable real-user traffic in production. This phase establishes deterministic launch gates, phased traffic enablement, abort conditions, and operator responsibilities to ensure production launch is safe, reversible, and verifiable.

**Core Intent:**
- Define mandatory pre-launch state validation
- Establish phased traffic enablement (closed-by-default → limited → full)
- Create deterministic launch gates (objective go/no-go criteria)
- Define immediate abort conditions and rollback procedures
- Specify post-launch verification requirements
- Clarify operator authority and responsibilities

**Design Principles:**
1. **Closed-by-Default:** System starts with traffic disabled (explicit activation required)
2. **Phased Enablement:** Internal → limited → full (with validation gates between)
3. **Fail-Safe Abort:** Single command kills all traffic (no partial shutdown)
4. **Deterministic Gates:** Objective criteria (no subjective judgment)
5. **Data Integrity:** Rollback never corrupts billing/payment data

**What This Phase Defines:**
- Pre-launch readiness checklist (mandatory system state)
- Traffic enablement strategy (phased rollout)
- Launch gates (objective go/no-go criteria)
- Rollback and abort playbooks
- Post-launch verification (first-hour checks)
- Operator responsibility model (who can do what)

**What This Phase Does NOT Define:**
- Implementation code (Phase 28B)
- Monitoring dashboards or alerts
- Infrastructure provisioning (Kubernetes, Terraform)
- Traffic shaping algorithms
- Business metrics or KPIs

---

## 1. PRE-LAUNCH READINESS CHECKLIST

### 1.1 Mandatory System State Before Launch

**Rule:** Production launch MUST NOT occur until ALL pre-launch conditions are verified. Missing ANY condition → launch BLOCKED.

**Pre-Launch Conditions (MANDATORY):**

#### Environment & Configuration
- [ ] `NODE_ENV=production` set and validated
- [ ] All required environment variables present and valid
- [ ] Database migrations up-to-date (no pending migrations)
- [ ] Database connection healthy (connection pool full)
- [ ] Kill switches loaded and verified (all states known)
- [ ] Safety limits loaded and verified (soft < hard cap)

#### Service Health
- [ ] All 25 startup checks passed (Phase 27B)
- [ ] Health endpoint returns 200: `GET /health`
- [ ] Readiness endpoint returns 200: `GET /health/ready`
- [ ] Database health check passes: `GET /health/db`
- [ ] No startup errors in logs (last 30 minutes)

#### Provider Availability
- [ ] Anthropic API key valid and tested (test request succeeds)
- [ ] OpenAI API key valid and tested (test request succeeds)
- [ ] Provider rate limits configured and within reasonable bounds
- [ ] Provider kill switches tested (disable → enable → verify)

#### Safety Controls
- [ ] Global execution kill switch enabled: `GLOBAL_EXECUTION_ENABLED=true`
- [ ] All provider kill switches enabled (or explicitly disabled with reason)
- [ ] Safety limits within production bounds (not test values)
- [ ] Daily spend hard cap set to production value (e.g., $20,000)
- [ ] Global rate limit set to production value (e.g., 10,000 req/min)

#### Billing & Payments
- [ ] Usage ledger operational (test write succeeds)
- [ ] Billing snapshot creation operational (test snapshot succeeds)
- [ ] Invoice generation operational (test invoice succeeds)
- [ ] Payment execution disabled (if not ready): `PAYMENT_EXECUTION_ENABLED=false`
- [ ] Billing database healthy and reachable

#### Audit & Observability
- [ ] Audit log service initialized (Phase 26B)
- [ ] Metrics collection operational (or fail-open if not ready)
- [ ] Log shipping operational (or fail-open if not ready)
- [ ] No memory leaks detected (startup memory stable)

#### Deployment Verification
- [ ] Container image tagged with version (not `latest`)
- [ ] Previous version available in registry (for rollback)
- [ ] Rollback command tested in staging
- [ ] Incident response team on standby
- [ ] Rollback playbook accessible and reviewed

**Validation Method:**
Each condition MUST be verified programmatically or via manual check before launch. No assumptions, no "probably fine" judgments.

**Failure Behavior:**
- If ANY condition fails → launch BLOCKED
- If ANY condition cannot be verified → launch BLOCKED
- If verification script fails → launch BLOCKED

### 1.2 Required Environment Variables (Production)

**Validation:** All variables MUST be set and validated before launch.

**Core Variables:**
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
```

**Provider Credentials:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

**Kill Switches (explicit verification):**
```bash
GLOBAL_EXECUTION_ENABLED=true  # MUST be true for launch
PROVIDER_ANTHROPIC_ENABLED=true
PROVIDER_OPENAI_ENABLED=true
PROVIDER_GROQ_ENABLED=true
BILLING_SNAPSHOT_ENABLED=true
INVOICE_GENERATION_ENABLED=true
PAYMENT_EXECUTION_ENABLED=false  # Disabled until Phase 25B-2+ ready
```

**Safety Limits:**
```bash
MAX_TOKENS_PER_EXECUTION=100000
MAX_EXECUTIONS_PER_MINUTE_GLOBAL=10000
MAX_DAILY_SPEND_SOFT_USD=10000
MAX_DAILY_SPEND_HARD_USD=20000
MAX_REQUESTS_PER_MINUTE_ANTHROPIC=3000
MAX_REQUESTS_PER_MINUTE_OPENAI=5000
```

**Verification Command:**
```bash
# Phase 28B: Automated verification script
./scripts/verify-production-config.sh
# Returns: exit 0 (all good) or exit 1 (blocked)
```

### 1.3 Kill Switch Verification Procedure

**Rule:** Before launch, operators MUST verify all kill switches are in expected state.

**Verification Steps:**
1. Check kill switch states: `GET /health/ready` (includes kill switch counts)
2. Test kill switch toggle (in staging):
   - Set `GLOBAL_EXECUTION_ENABLED=false` → restart → verify 503
   - Set `GLOBAL_EXECUTION_ENABLED=true` → restart → verify 200
3. Document kill switch states in launch log
4. Confirm kill switch toggle time < 5 minutes

**Expected State at Launch:**
- `GLOBAL_EXECUTION_ENABLED=true` (traffic allowed)
- Provider kill switches: enabled for available providers
- Billing kill switches: enabled (unless incident)
- Payment kill switch: disabled (until Phase 25B-2+ ready)

**Abort Condition:**
- If kill switch toggle takes > 5 minutes → investigate before launch
- If kill switch state unknown → launch BLOCKED

### 1.4 Safety Limit Validation

**Rule:** Safety limits MUST be validated as within production bounds before launch.

**Production Bounds (acceptable ranges):**
- `MAX_TOKENS_PER_EXECUTION`: 50,000 - 150,000 (recommended: 100,000)
- `MAX_EXECUTIONS_PER_MINUTE_GLOBAL`: 5,000 - 20,000 (recommended: 10,000)
- `MAX_DAILY_SPEND_SOFT_USD`: $5,000 - $15,000 (recommended: $10,000)
- `MAX_DAILY_SPEND_HARD_USD`: $15,000 - $30,000 (recommended: $20,000)

**Validation Checks:**
- ✅ All limits > 0
- ✅ Soft cap < hard cap
- ✅ Limits within production bounds
- ✅ Limits not set to test values (e.g., 1, 10, 100)

**Abort Condition:**
- If any limit is 0 → launch BLOCKED (would block all traffic)
- If soft cap ≥ hard cap → launch BLOCKED (invalid constraint)
- If limits suspiciously low (e.g., < 100) → manual review required

### 1.5 Provider Availability Confirmation

**Rule:** Before launch, operators MUST confirm all enabled providers are reachable and accepting requests.

**Verification Procedure:**
1. Execute test request to each enabled provider (using test API key)
2. Verify response within expected latency (< 5 seconds)
3. Verify no authentication errors (401)
4. Verify no rate limit errors (429) at zero load

**Test Request Format:**
```bash
# Phase 28B: Test script
curl -X POST http://localhost:3000/api/ai/execute \
  -H "Authorization: Bearer test-api-key" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Test"}],
    "max_tokens": 100
  }'
# Expected: 200 OK with valid response
```

**Abort Condition:**
- If any enabled provider unreachable → launch BLOCKED (or disable that provider)
- If provider returns 401 → launch BLOCKED (credentials invalid)
- If provider returns 429 at zero load → launch BLOCKED (rate limited before start)

### 1.6 Billing & Payment Readiness

**Rule:** Billing infrastructure MUST be operational before launch (even if payments disabled).

**Billing Readiness Checks:**
- [ ] Usage ledger writes succeed (test record inserted)
- [ ] Billing snapshots created successfully (test snapshot created)
- [ ] Invoices generated successfully (test invoice created)
- [ ] Billing database reachable and healthy
- [ ] No billing errors in logs (last 24 hours)

**Payment Readiness (Phase 25B-2+):**
- [ ] Payment execution kill switch: `PAYMENT_EXECUTION_ENABLED=false` (disabled until ready)
- [ ] Payment gateway NOT configured (no credentials)
- [ ] Invoice status remains `draft` (no payment attempts)

**Critical Guarantee:**
- Usage ledger ALWAYS records successful executions (billing source-of-truth)
- Billing snapshots computed independently of execution (read-only usage ledger)
- Invoices generated independently of execution (read-only snapshots)
- Payments do NOT block execution (isolated subsystem)

**Abort Condition:**
- If usage ledger writes fail → launch BLOCKED (billing integrity violated)
- If billing database unreachable → launch BLOCKED (cannot record usage)
- If billing snapshots fail → WARN (does not block launch, but investigate)

---

## 2. TRAFFIC ENABLEMENT STRATEGY

### 2.1 Phased Rollout Model

**Rule:** Production traffic MUST be enabled in phases with validation gates between each phase.

**Phases:**

#### Phase 0: Pre-Launch (Traffic Disabled)
- **Traffic:** NONE (kill switch disabled or no API keys issued)
- **Duration:** Until all pre-launch checks pass
- **Validation:** Pre-launch readiness checklist complete
- **Transition:** Manual operator decision → Phase 1

#### Phase 1: Internal-Only Traffic
- **Traffic:** Internal test accounts ONLY (< 10 API keys)
- **Duration:** 1 hour minimum
- **Validation:** First-hour checks pass (see Section 5)
- **Abort:** If any first-hour check fails → disable traffic
- **Transition:** Operator approval → Phase 2

#### Phase 2: Limited Exposure (Early Access)
- **Traffic:** Limited user cohort (< 100 API keys)
- **Duration:** 24 hours minimum
- **Validation:** Cost, execution, billing verification (see Section 5)
- **Abort:** If cost exceeds $1,000 in first 24 hours → investigate
- **Transition:** Operator approval → Phase 3

#### Phase 3: Full Availability (Public Launch)
- **Traffic:** Unrestricted (all valid API keys)
- **Duration:** Ongoing
- **Validation:** Continuous monitoring (metrics, alerts)
- **Abort:** If daily spend hard cap reached → automatic block (safety limit)
- **Transition:** N/A (steady state)

**Rollback Between Phases:**
- Phase 1 → Phase 0: Toggle kill switch → all traffic blocked
- Phase 2 → Phase 1: Revoke API keys for early access cohort
- Phase 3 → Phase 2: Revoke API keys for general availability

### 2.2 Closed-by-Default Behavior

**Rule:** System MUST start in a traffic-disabled state requiring explicit activation.

**Implementation Options:**

**Option A: Kill Switch (Recommended)**
- Start with `GLOBAL_EXECUTION_ENABLED=false`
- Launch Phase 1: Set `GLOBAL_EXECUTION_ENABLED=true` → restart pods
- Abort: Set `GLOBAL_EXECUTION_ENABLED=false` → restart pods

**Option B: API Key Issuance**
- Start with ZERO API keys issued
- Launch Phase 1: Issue internal test API keys
- Launch Phase 2: Issue early access API keys
- Launch Phase 3: Issue general availability API keys
- Abort: Revoke all API keys (does not require restart)

**Option C: Combined (Most Flexible)**
- Use kill switch for emergency global stop
- Use API key issuance for phased cohort control
- Abort: Kill switch for immediate stop, API key revocation for gradual stop

**Recommended Strategy:** Option C (kill switch + API key issuance)

**Rationale:**
- Kill switch: Fast emergency abort (< 5 minutes)
- API key issuance: Granular cohort control (no restart)
- Combined: Flexibility for both emergency and gradual rollout

### 2.3 Explicit Activation Steps

**Rule:** Each phase transition MUST require explicit operator action. NO automatic phase transitions.

**Phase 0 → Phase 1 (Internal Launch):**
```bash
# Step 1: Verify pre-launch checklist complete
./scripts/verify-production-config.sh
# Expected: exit 0 (all checks passed)

# Step 2: Enable global execution
kubectl set env deployment/api-gateway GLOBAL_EXECUTION_ENABLED=true
kubectl rollout status deployment/api-gateway

# Step 3: Issue internal test API keys (< 10 keys)
./scripts/issue-api-keys.sh --cohort internal --count 10

# Step 4: Verify traffic working
curl -X POST https://api.aisandbox.com/api/ai/execute \
  -H "Authorization: Bearer <internal-test-key>" \
  -d '{"provider": "anthropic", "messages": [...]}'
# Expected: 200 OK

# Step 5: Monitor first-hour metrics
./scripts/monitor-first-hour.sh
# Expected: No errors, cost < $10
```

**Phase 1 → Phase 2 (Early Access):**
```bash
# Step 1: Verify Phase 1 first-hour checks passed
./scripts/verify-first-hour.sh
# Expected: exit 0 (all checks passed)

# Step 2: Issue early access API keys (< 100 keys)
./scripts/issue-api-keys.sh --cohort early-access --count 100

# Step 3: Monitor 24-hour metrics
./scripts/monitor-24-hour.sh
# Expected: Cost < $1,000, no errors
```

**Phase 2 → Phase 3 (Public Launch):**
```bash
# Step 1: Verify Phase 2 24-hour checks passed
./scripts/verify-24-hour.sh
# Expected: exit 0 (all checks passed)

# Step 2: Enable public API key issuance
./scripts/enable-public-signup.sh

# Step 3: Announce launch
# (External communication, out of scope)

# Step 4: Monitor ongoing metrics
# (Continuous monitoring, see Section 5)
```

### 2.4 Traffic Validation Gates

**Rule:** Between each phase, operators MUST validate traffic behavior before proceeding.

**Gate 1: Phase 0 → Phase 1 (Internal Launch Gate)**
- ✅ All pre-launch checks passed
- ✅ Kill switch toggle tested (disable → enable)
- ✅ Incident response team on standby
- ✅ Rollback playbook accessible

**Gate 2: Phase 1 → Phase 2 (Early Access Gate)**
- ✅ First-hour checks passed (see Section 5.1)
- ✅ No execution errors (success rate > 95%)
- ✅ Cost within expected range (< $10 first hour)
- ✅ Usage ledger writes succeeded (100% success rate)
- ✅ Billing snapshots created (if scheduled)

**Gate 3: Phase 2 → Phase 3 (Public Launch Gate)**
- ✅ 24-hour checks passed (see Section 5.2)
- ✅ Cost within expected range (< $1,000 first 24 hours)
- ✅ No billing integrity violations
- ✅ No payment system errors (if enabled)
- ✅ Operator confidence high (subjective but required)

**Abort at Any Gate:**
- If validation fails → stay in current phase (do NOT proceed)
- If critical issue → abort to Phase 0 (kill switch)
- If non-critical issue → investigate before proceeding

---

## 3. LAUNCH GATES (GO/NO-GO CRITERIA)

### 3.1 Objective Launch Criteria

**Rule:** Launch decision MUST be based on objective, measurable criteria. NO subjective judgment for critical gates.

**Go/No-Go Decision Framework:**

#### GO Criteria (ALL must be true)
1. ✅ **System Health:** All 25 startup checks passed
2. ✅ **Configuration:** All required env vars set and validated
3. ✅ **Kill Switches:** All kill switches in expected state
4. ✅ **Safety Limits:** All safety limits validated and within bounds
5. ✅ **Providers:** All enabled providers reachable and responsive
6. ✅ **Billing:** Usage ledger, snapshots, invoices operational
7. ✅ **Readiness:** Health and readiness endpoints return 200
8. ✅ **Team:** Incident response team on standby
9. ✅ **Rollback:** Rollback playbook tested and accessible
10. ✅ **Approval:** Launch approval documented (incident log entry)

#### NO-GO Criteria (ANY blocks launch)
1. ❌ **Startup Failure:** Any of 25 startup checks failed
2. ❌ **Config Invalid:** Any required env var missing or invalid
3. ❌ **Kill Switch Unknown:** Any kill switch state cannot be verified
4. ❌ **Safety Limit Invalid:** Any safety limit out of bounds or inconsistent
5. ❌ **Provider Unavailable:** Any enabled provider unreachable
6. ❌ **Billing Broken:** Usage ledger writes fail (billing integrity violated)
7. ❌ **Database Down:** Database unreachable or unhealthy
8. ❌ **Readiness Fail:** Readiness endpoint returns non-200
9. ❌ **Team Unavailable:** No incident response team available
10. ❌ **Rollback Untested:** Rollback procedure not tested in staging

**Decision Process:**
1. Run pre-launch verification script
2. Review results (all GO criteria met?)
3. Document decision in launch log
4. If GO → proceed to Phase 1
5. If NO-GO → fix issues, re-verify, retry

### 3.2 Deterministic Launch Checks

**Rule:** Launch checks MUST be deterministic (same state → same outcome).

**Deterministic Checks (programmatic):**

```bash
# Phase 28B: Launch verification script
#!/bin/bash
set -e  # Exit on first error

# Check 1: Health endpoint
curl -f http://localhost:3000/health || exit 1

# Check 2: Readiness endpoint
curl -f http://localhost:3000/health/ready || exit 1

# Check 3: Database health
curl -f http://localhost:3000/health/db || exit 1

# Check 4: Kill switches loaded
READY_RESPONSE=$(curl -s http://localhost:3000/health/ready)
echo "$READY_RESPONSE" | jq -e '.killSwitches.total > 0' || exit 1

# Check 5: Safety limits loaded
echo "$READY_RESPONSE" | jq -e '.safetyLimits.total > 0' || exit 1

# Check 6: Environment is production
echo "$READY_RESPONSE" | jq -e '.environment == "production"' || exit 1

# All checks passed
echo "✅ All launch checks passed"
exit 0
```

**Forbidden Checks (non-deterministic):**
- ❌ "System feels stable" (subjective)
- ❌ "Probably ready" (ambiguous)
- ❌ "Looks good to me" (opinion)
- ❌ Manual inspection of logs without criteria

**Required: Objective Evidence**
- ✅ Health endpoint returns 200 (measurable)
- ✅ Database query succeeds (measurable)
- ✅ Test execution returns 200 (measurable)
- ✅ Kill switch toggle completes in < 5 minutes (measurable)

### 3.3 What Blocks Launch vs What Degrades

**Rule:** Clearly distinguish between launch-blocking issues and degraded-mode issues.

**Launch-Blocking Issues (MUST fix before launch):**
- Database unreachable
- Provider credentials invalid
- Kill switches broken (cannot toggle)
- Safety limits invalid (soft ≥ hard)
- Usage ledger writes fail
- Readiness endpoint returns non-200
- Any startup check fails

**Degraded-Mode Issues (launch allowed, but monitor closely):**
- Metrics collection unavailable (fail-open)
- Log shipping unavailable (fail-open)
- Redis unavailable (not yet required)
- One provider unavailable (if others work)
- Billing snapshots delayed (does not block execution)
- Invoice generation delayed (does not block execution)

**Decision Guideline:**
- Does it affect execution correctness? → **Launch-blocking**
- Does it affect billing integrity? → **Launch-blocking**
- Does it affect observability only? → **Degraded-mode** (launch allowed)

### 3.4 Launch Approval Documentation

**Rule:** Every launch decision MUST be documented with timestamp, decision-maker, and rationale.

**Launch Log Entry Format:**
```
Launch Decision Log Entry

Date: 2026-02-07 12:00:00 UTC
Phase: Phase 1 (Internal-Only Traffic)
Decision: GO
Decision-maker: [Name], [Role]
Approvers: [Name], [Name]

Pre-Launch Checklist: ✅ Complete (10/10 checks passed)
Go/No-Go Criteria: ✅ All GO criteria met

Launch Conditions:
- Environment: production
- Kill Switch: GLOBAL_EXECUTION_ENABLED=true
- Safety Limits: Within production bounds
- Providers: Anthropic (✅), OpenAI (✅)
- Billing: Operational
- Payment: Disabled (PAYMENT_EXECUTION_ENABLED=false)

Expected Behavior:
- Internal test accounts only (< 10 API keys)
- First-hour cost estimate: < $10
- Execution rate estimate: < 100 req/hour

Abort Conditions:
- Cost exceeds $50 in first hour
- Execution success rate < 95%
- Usage ledger write failure

Rollback Plan:
- Kill switch toggle: GLOBAL_EXECUTION_ENABLED=false
- Expected rollback time: < 5 minutes

Incident Response:
- On-call team: [Team Name]
- Escalation: [Contact]
- Communication channel: [Slack/Email]

Signature: [Decision-maker]
```

---

## 4. ROLLBACK & ABORT PLAYBOOKS

### 4.1 Immediate Abort Conditions

**Rule:** Certain conditions require IMMEDIATE traffic abort (no discussion, no delay).

**Immediate Abort Conditions:**

1. **Billing Integrity Violation:**
   - Usage ledger writes failing (> 1% failure rate)
   - Billing snapshots corrupt or inconsistent
   - Execution succeeds but usage not recorded

2. **Cost Runaway:**
   - Daily spend hard cap reached ($20,000 default)
   - Hourly cost exceeds 10x estimate
   - Single user cost exceeds $1,000/hour

3. **System Instability:**
   - Execution success rate < 50%
   - Database connection pool exhausted
   - Memory leak detected (OOM kills)

4. **Security Incident:**
   - Unauthorized access detected
   - API key leak suspected
   - Provider credentials compromised

5. **Provider Outage:**
   - All providers unreachable (no fallback)
   - Provider returning 500 errors (> 50% rate)
   - Provider rate limits exceeded globally

**Abort Action:**
```bash
# Immediate abort command
kubectl set env deployment/api-gateway GLOBAL_EXECUTION_ENABLED=false
kubectl rollout status deployment/api-gateway

# Expected result: All traffic blocked within 5 minutes
```

**Post-Abort:**
1. Document abort reason in incident log
2. Preserve current state (no cleanup yet)
3. Notify incident response team
4. Begin investigation (root cause analysis)
5. Fix issue before re-enabling traffic

### 4.2 Kill Switch Usage Patterns

**Rule:** Kill switches are the primary mechanism for traffic control during incidents.

**Kill Switch Patterns:**

#### Pattern 1: Emergency Global Stop
**Scenario:** System-wide issue (database down, all providers failing)
**Action:** Disable global execution
```bash
GLOBAL_EXECUTION_ENABLED=false
```
**Effect:** ALL execution requests return 503
**Recovery:** Fix issue → enable global execution → restart pods

#### Pattern 2: Provider Isolation
**Scenario:** Single provider failing (e.g., Anthropic down)
**Action:** Disable that provider only
```bash
PROVIDER_ANTHROPIC_ENABLED=false
```
**Effect:** Only Anthropic requests return 503, other providers continue
**Recovery:** Wait for provider → enable provider → restart pods

#### Pattern 3: Billing System Pause
**Scenario:** Billing database issue, need to pause billing operations
**Action:** Disable billing snapshot creation
```bash
BILLING_SNAPSHOT_ENABLED=false
```
**Effect:** Billing snapshots not created (execution continues, usage ledger still writes)
**Recovery:** Fix billing DB → enable billing snapshots → restart pods

#### Pattern 4: Payment Suppression
**Scenario:** Payment gateway issue (Phase 25B-2+)
**Action:** Disable payment execution
```bash
PAYMENT_EXECUTION_ENABLED=false
```
**Effect:** No payment attempts (invoices still generated)
**Recovery:** Fix payment gateway → enable payments → restart pods

**Kill Switch Toggle Time:**
- Target: < 5 minutes (environment variable update + pod restart)
- Maximum acceptable: 10 minutes
- If exceeds 10 minutes → investigate deployment infrastructure

### 4.3 Rollback Procedures

**Rule:** Rollback MUST be possible within 10 minutes without data loss.

**Rollback Scenarios:**

#### Scenario 1: Code Regression
**Symptom:** New code version causing errors
**Action:** Revert to previous container image
```bash
kubectl rollout undo deployment/api-gateway
kubectl rollout status deployment/api-gateway
```
**Data Impact:** ✅ None (database unchanged)
**Time:** ~5 minutes

#### Scenario 2: Configuration Error
**Symptom:** Invalid environment variable causing startup failures
**Action:** Revert environment variable
```bash
kubectl set env deployment/api-gateway DATABASE_URL=<previous-value>
kubectl rollout restart deployment/api-gateway
```
**Data Impact:** ✅ None (database unchanged)
**Time:** ~5 minutes

#### Scenario 3: Provider Credentials Invalid
**Symptom:** Provider authentication failing
**Action:** Update provider API key
```bash
kubectl set env deployment/api-gateway ANTHROPIC_API_KEY=<valid-key>
kubectl rollout restart deployment/api-gateway
```
**Data Impact:** ✅ None (database unchanged)
**Time:** ~5 minutes

#### Scenario 4: Kill Switch Misconfiguration
**Symptom:** Traffic accidentally disabled
**Action:** Re-enable kill switch
```bash
kubectl set env deployment/api-gateway GLOBAL_EXECUTION_ENABLED=true
kubectl rollout restart deployment/api-gateway
```
**Data Impact:** ✅ None (database unchanged)
**Time:** ~5 minutes

**Rollback Validation:**
```bash
# After rollback, verify service healthy
curl -f http://localhost:3000/health/ready
# Expected: 200 OK

# Verify execution working
curl -X POST http://localhost:3000/api/ai/execute \
  -H "Authorization: Bearer test-key" \
  -d '{"provider": "anthropic", "messages": [...]}'
# Expected: 200 OK
```

### 4.4 Billing/Payment Isolation During Rollback

**Rule:** Rollback MUST preserve billing and payment data integrity.

**Billing Isolation Guarantees:**

1. **Usage Ledger Immutable:**
   - Rollback does NOT delete usage records
   - Rollback does NOT modify usage records
   - Usage ledger remains source-of-truth

2. **Billing Snapshots Immutable:**
   - Rollback does NOT delete billing snapshots
   - Rollback does NOT modify billing snapshots
   - Snapshots remain read-only audit trail

3. **Invoices Immutable:**
   - Rollback does NOT delete invoices
   - Rollback does NOT modify invoice amounts
   - Invoice status may remain `draft` (safe)

4. **Payments Idempotent:**
   - Rollback does NOT retry failed payments
   - Rollback does NOT duplicate payments
   - Payment status reflects actual state (not modified)

**Forbidden During Rollback:**
```sql
-- ❌ FORBIDDEN: Deleting usage records
DELETE FROM usage_records WHERE timestamp > '...';

-- ❌ FORBIDDEN: Modifying billing snapshots
UPDATE billing_snapshots SET total_cost_usd = 0 WHERE ...;

-- ❌ FORBIDDEN: Changing invoice amounts
UPDATE invoices SET total_cost_usd = 0 WHERE ...;

-- ❌ FORBIDDEN: Resetting payment status
UPDATE payments SET status = 'pending' WHERE status = 'failed';
```

**Allowed During Rollback:**
```bash
# ✅ ALLOWED: Disabling billing snapshot creation
BILLING_SNAPSHOT_ENABLED=false

# ✅ ALLOWED: Disabling invoice generation
INVOICE_GENERATION_ENABLED=false

# ✅ ALLOWED: Disabling payment execution
PAYMENT_EXECUTION_ENABLED=false
```

### 4.5 Data Integrity Guarantees During Rollback

**Rule:** Rollback NEVER corrupts data. If data corruption detected → escalate immediately.

**Data Integrity Checks Post-Rollback:**

```bash
# Check 1: Usage ledger intact
SELECT COUNT(*) FROM usage_records;
# Expected: Count matches pre-rollback count or higher (monotonic)

# Check 2: No duplicate usage records
SELECT api_key_id, timestamp, tokens_used, COUNT(*)
FROM usage_records
GROUP BY api_key_id, timestamp, tokens_used
HAVING COUNT(*) > 1;
# Expected: 0 rows (no duplicates)

# Check 3: Billing snapshots intact
SELECT COUNT(*) FROM billing_snapshots;
# Expected: Count matches pre-rollback count or higher (monotonic)

# Check 4: Invoices intact
SELECT COUNT(*) FROM invoices;
# Expected: Count matches pre-rollback count or higher (monotonic)

# Check 5: No orphaned records
SELECT COUNT(*) FROM invoices WHERE snapshot_id NOT IN (SELECT snapshot_id FROM billing_snapshots);
# Expected: 0 rows (all invoices have valid snapshot)
```

**If Data Integrity Violated:**
1. ❌ Do NOT attempt to fix data manually
2. ❌ Do NOT delete "bad" records
3. ✅ Document corruption details
4. ✅ Preserve current state (take database snapshot)
5. ✅ Escalate to engineering team
6. ✅ Use application-level repair tools (Phase 28B+)

---

## 5. POST-LAUNCH VERIFICATION

### 5.1 First-Hour Checks (Phase 1 Validation)

**Rule:** Within first hour of Phase 1 launch, operators MUST verify system behaving as expected.

**First-Hour Checklist (0-60 minutes):**

#### T+5 minutes: Immediate Health
- [ ] Service still running (no crashes)
- [ ] Health endpoint returns 200: `GET /health`
- [ ] Readiness endpoint returns 200: `GET /health/ready`
- [ ] No error spikes in logs (error rate < 1%)

#### T+15 minutes: Execution Verification
- [ ] At least 1 successful execution completed
- [ ] Execution success rate > 95%
- [ ] Average response time < 5 seconds
- [ ] No 500 errors (internal server errors)

#### T+30 minutes: Billing Verification
- [ ] Usage ledger writes succeeded (100% success rate)
- [ ] At least 1 usage record created
- [ ] Usage record fields valid (tokens_used > 0, etc.)
- [ ] No billing errors in logs

#### T+60 minutes: Cost Verification
- [ ] Total cost < $10 (internal traffic only)
- [ ] No individual user cost > $5
- [ ] Daily spend tracking accurate (matches usage ledger)
- [ ] No runaway cost detected

**Abort Conditions (First Hour):**
- Execution success rate < 95% → Investigate immediately
- Cost exceeds $50 → Abort (10x estimate)
- Usage ledger write failure → Abort (billing integrity violated)
- Any crash or OOM kill → Abort (instability)

**First-Hour Report:**
```
First-Hour Verification Report

Launch Time: 2026-02-07 12:00:00 UTC
Report Time: 2026-02-07 13:00:00 UTC (T+60 minutes)
Phase: Phase 1 (Internal-Only Traffic)

System Health: ✅ PASS
- Uptime: 60 minutes (no crashes)
- Health: 200 OK
- Readiness: 200 OK

Execution Metrics:
- Total executions: 42
- Success rate: 100% (42/42)
- Average response time: 2.3 seconds
- Error rate: 0%

Billing Integrity:
- Usage ledger writes: 42/42 (100% success)
- Usage records created: 42
- Billing snapshots: N/A (not scheduled yet)

Cost Metrics:
- Total cost: $4.20 (within $10 limit)
- Average cost per execution: $0.10
- Daily spend: $4.20 / $20,000 hard cap (0.02%)

Issues: None

Decision: ✅ PROCEED to Phase 2 (Early Access)
```

### 5.2 24-Hour Checks (Phase 2 Validation)

**Rule:** Within first 24 hours of Phase 2 launch, operators MUST verify system stability under light load.

**24-Hour Checklist (0-24 hours):**

#### Execution Correctness
- [ ] Execution success rate > 95% (over 24 hours)
- [ ] No execution correctness issues reported
- [ ] No prompt/response leakage detected (privacy preserved)
- [ ] No unauthorized access attempts

#### Cost Sanity
- [ ] Total cost < $1,000 (early access cohort)
- [ ] Average cost per user < $50
- [ ] No single user cost > $200
- [ ] Daily spend trend predictable (linear growth)

#### Billing Verification
- [ ] Usage ledger writes succeeded (> 99.9% success rate)
- [ ] Billing snapshots created (if scheduled)
- [ ] Invoices generated (if scheduled)
- [ ] No billing integrity violations detected

#### System Stability
- [ ] No crashes or OOM kills
- [ ] No database connection pool exhaustion
- [ ] No memory leaks detected (memory stable)
- [ ] No provider rate limit errors (within limits)

#### Safety Limits
- [ ] Global rate limit not exceeded
- [ ] Provider rate limits not exceeded
- [ ] Daily spend soft cap not exceeded ($10,000)
- [ ] Daily spend hard cap not approached (< 50%)

**Abort Conditions (24 Hours):**
- Cost exceeds $1,000 → Investigate (expected: < $1,000)
- Single user cost > $200 → Investigate (potential abuse)
- Billing integrity violation → Abort (usage not recorded)
- Execution success rate < 95% → Investigate (quality issue)

### 5.3 Cost Sanity Validation

**Rule:** Cost growth MUST match expected usage patterns. Unexpected cost spikes → investigate immediately.

**Cost Sanity Checks:**

```sql
-- Check 1: Total daily cost
SELECT SUM((tokens_used / 1000.0) * 0.01) AS total_cost_usd
FROM usage_records
WHERE timestamp >= NOW() - INTERVAL '1 day';
-- Expected (Phase 1): < $10
-- Expected (Phase 2): < $1,000
-- Expected (Phase 3): < $20,000 (hard cap)

-- Check 2: Cost per user
SELECT user_id, SUM((tokens_used / 1000.0) * 0.01) AS user_cost_usd
FROM usage_records
WHERE timestamp >= NOW() - INTERVAL '1 day'
GROUP BY user_id
ORDER BY user_cost_usd DESC
LIMIT 10;
-- Expected: Top user < $200 (Phase 2), < $1,000 (Phase 3)

-- Check 3: Cost per provider
SELECT provider, SUM((tokens_used / 1000.0) * 0.01) AS provider_cost_usd
FROM usage_records
WHERE timestamp >= NOW() - INTERVAL '1 day'
GROUP BY provider;
-- Expected: Anthropic cost matches usage

-- Check 4: Hourly cost trend
SELECT DATE_TRUNC('hour', timestamp) AS hour,
       SUM((tokens_used / 1000.0) * 0.01) AS hourly_cost_usd
FROM usage_records
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
-- Expected: Linear growth (not exponential)
```

**Cost Anomaly Detection:**
- Sudden spike (10x hourly average) → Investigate
- Single user dominates (> 50% of cost) → Investigate
- Cost trend exponential (not linear) → Investigate

**Cost Anomaly Response:**
1. Identify high-cost users (query above)
2. Review their API usage patterns
3. Check for abuse or bugs
4. Consider per-user rate limiting (future phase)
5. If abuse → revoke API key
6. If bug → fix bug, adjust safety limits

### 5.4 Execution Correctness Sampling

**Rule:** Periodically verify execution correctness (responses make sense, no errors).

**Sampling Strategy:**
- Sample 10 random executions per hour
- Verify response structure matches expected format
- Verify no error responses (200 OK)
- Verify response latency < 10 seconds

**Correctness Checks:**
```bash
# Sample random execution
curl -X POST http://localhost:3000/api/ai/execute \
  -H "Authorization: Bearer test-key" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 100
  }'

# Expected response structure:
# {
#   "model": "claude-3-5-sonnet-20241022",
#   "tokensUsed": <number>,
#   "response": <string>
# }

# Verify:
# 1. HTTP status: 200 OK
# 2. Response has "model" field
# 3. Response has "tokensUsed" field (> 0)
# 4. Response has "response" field (non-empty)
# 5. No error field in response
```

**If Correctness Issue Detected:**
1. Document issue details (request, response, error)
2. Check if issue is reproducible
3. Check if issue affects all providers or specific provider
4. If reproducible → investigate immediately
5. If provider-specific → disable that provider
6. If widespread → consider abort

### 5.5 Billing Snapshot Verification

**Rule:** If billing snapshots scheduled during launch period, verify snapshots created correctly.

**Snapshot Verification:**
```sql
-- Check 1: Snapshots created
SELECT COUNT(*) FROM billing_snapshots
WHERE period_start >= NOW() - INTERVAL '24 hours';
-- Expected: At least 1 (if scheduled)

-- Check 2: Snapshot totals match usage ledger
SELECT snapshot_id, total_tokens, total_cost_usd
FROM billing_snapshots
WHERE period_start >= NOW() - INTERVAL '24 hours';

-- Cross-check with usage ledger:
SELECT api_key_id,
       SUM(tokens_used) AS total_tokens,
       SUM((tokens_used / 1000.0) * 0.01) AS total_cost_usd
FROM usage_records
WHERE timestamp >= <period_start> AND timestamp <= <period_end>
GROUP BY api_key_id;
-- Expected: Totals match (within rounding)

-- Check 3: No duplicate snapshots
SELECT api_key_id, period_start, period_end, COUNT(*)
FROM billing_snapshots
GROUP BY api_key_id, period_start, period_end
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)
```

**If Snapshot Issue Detected:**
1. Verify usage ledger intact (source-of-truth)
2. Check billing snapshot creation logs
3. If snapshot missing → can be recreated from usage ledger
4. If snapshot incorrect → investigate pricing logic (Phase 23B)
5. If duplicate snapshot → investigate idempotency (Phase 23B)

### 5.6 Payment Attempt Suppression

**Rule:** During Phase 1-2 launch, payment execution MUST be disabled (until Phase 25B-2+ ready).

**Payment Suppression Verification:**
```bash
# Check 1: Payment kill switch disabled
curl -s http://localhost:3000/health/ready | jq '.killSwitches'
# Expected: PAYMENT_EXECUTION_ENABLED = false (or not present)

# Check 2: No payment attempts in database
SELECT COUNT(*) FROM payments
WHERE created_at >= NOW() - INTERVAL '24 hours';
# Expected: 0 rows (no payment attempts)

# Check 3: Invoice status remains draft
SELECT status, COUNT(*) FROM invoices
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status;
-- Expected: All invoices have status = 'draft'
```

**If Payment Attempted (Unexpected):**
1. ❌ CRITICAL: Payment should not execute if kill switch disabled
2. Investigate how payment was triggered
3. Verify kill switch enforcement (Phase 26B)
4. If bug → fix immediately
5. If configuration error → disable payments, restart

---

## 6. OPERATOR RESPONSIBILITY MODEL

### 6.1 Launch Authority

**Rule:** Only designated operators with launch authority can enable production traffic.

**Launch Roles:**

#### Launch Coordinator (Primary Authority)
- **Responsibility:** Makes final launch decision (go/no-go)
- **Authority:** Enable global execution kill switch
- **Requirements:** Completed launch training, reviewed playbooks
- **Accountability:** Documents launch decision in incident log

#### Technical Lead (Secondary Authority)
- **Responsibility:** Verifies pre-launch checklist complete
- **Authority:** Approve/block launch based on technical criteria
- **Requirements:** Deep system knowledge, reviewed all phases
- **Accountability:** Signs off on pre-launch verification

#### On-Call Engineer (Emergency Authority)
- **Responsibility:** Monitor system during launch, execute abort if needed
- **Authority:** Disable global execution kill switch (emergency abort)
- **Requirements:** Incident response training, rollback playbook accessible
- **Accountability:** Documents abort reason, coordinates recovery

**Launch Approval Process:**
1. Technical Lead verifies pre-launch checklist → Sign-off
2. Launch Coordinator reviews verification → Go/No-Go decision
3. Launch Coordinator documents decision in incident log
4. Launch Coordinator enables traffic (Phase 1)
5. On-Call Engineer monitors system (first hour)

### 6.2 Abort Authority

**Rule:** Abort authority is BROADER than launch authority (any engineer can abort if critical issue detected).

**Abort Roles:**

#### Any Engineer (Immediate Abort Authority)
- **Authority:** Disable global execution kill switch if immediate abort condition detected
- **Trigger:** Billing integrity violation, cost runaway, system instability, security incident
- **Process:** Execute abort → notify team → document reason
- **Accountability:** Post-abort review (was abort justified?)

#### Launch Coordinator (Planned Abort Authority)
- **Authority:** Abort launch if validation gates fail
- **Trigger:** First-hour checks fail, 24-hour checks fail, operator concern
- **Process:** Review metrics → make decision → execute abort → document
- **Accountability:** Abort decision documented in incident log

#### Technical Lead (Escalation Authority)
- **Authority:** Make final decision on whether to proceed after abort
- **Trigger:** Abort occurred, issue investigated, fix proposed
- **Process:** Review root cause → verify fix → approve/block re-launch
- **Accountability:** Re-launch decision documented

**Abort Command (Any Engineer):**
```bash
# Immediate abort (no approval needed if critical issue)
kubectl set env deployment/api-gateway GLOBAL_EXECUTION_ENABLED=false
kubectl rollout status deployment/api-gateway

# Notify team
# (Slack, email, incident channel)

# Document abort reason
./scripts/log-abort.sh \
  --reason "Billing integrity violation: usage ledger writes failing" \
  --severity critical \
  --engineer "$(whoami)"
```

### 6.3 Actions Requiring Redeploy vs Config Change

**Rule:** Clearly distinguish between actions requiring code redeploy vs environment variable change.

**Requires Redeploy (Code Change):**
- Change execution logic
- Change billing calculations
- Change provider adapters
- Add new endpoints
- Modify guard stack order
- Change database schema (migration)

**Requires Config Change (Env Var + Restart):**
- Toggle kill switches
- Adjust safety limits
- Update provider API keys
- Change database URL
- Change port

**Requires No Restart (Immediate Effect):**
- Issue API keys (if using database-backed keys)
- Revoke API keys
- View metrics/logs
- Run queries

**Decision Tree:**
```
Does it change code behavior?
├─ Yes → Redeploy required
│  ├─ Test in staging first
│  └─ Follow deployment safety rules (Phase 27B)
└─ No → Config change or no restart
   ├─ Kill switch/safety limit → Env var + restart
   ├─ API key management → No restart
   └─ Observation only → No restart
```

### 6.4 Forbidden Post-Launch Actions

**Rule:** Certain actions are FORBIDDEN post-launch without explicit approval and rollback plan.

**Forbidden Actions:**

❌ **Manual Data Mutation:**
```sql
-- FORBIDDEN: Deleting usage records
DELETE FROM usage_records WHERE ...;

-- FORBIDDEN: Modifying billing snapshots
UPDATE billing_snapshots SET total_cost_usd = 0 WHERE ...;

-- FORBIDDEN: Changing invoice amounts
UPDATE invoices SET total_cost_usd = ... WHERE ...;
```

❌ **Runtime Config Changes (No Restart):**
- Modifying kill switch state in database (if persisted)
- Changing safety limits without restart
- Hot-patching code

❌ **Bypassing Safety Controls:**
- Disabling startup checks
- Skipping validation gates
- Overriding throw-only errors

❌ **Deployment Without Validation:**
- Deploying without testing in staging
- Deploying without pre-launch checklist
- Deploying during high-traffic periods

❌ **Immediate Rollout to Phase 3:**
- Skipping Phase 1 (internal-only)
- Skipping Phase 2 (early access)
- Public launch without validation gates

**Allowed Post-Launch Actions:**

✅ **Kill Switch Toggle (With Restart):**
```bash
kubectl set env deployment/api-gateway GLOBAL_EXECUTION_ENABLED=false
kubectl rollout restart deployment/api-gateway
```

✅ **Safety Limit Adjustment (With Restart):**
```bash
kubectl set env deployment/api-gateway MAX_DAILY_SPEND_HARD_USD=30000
kubectl rollout restart deployment/api-gateway
```

✅ **API Key Issuance/Revocation:**
```bash
./scripts/issue-api-keys.sh --cohort early-access --count 50
./scripts/revoke-api-key.sh --key-id <key-id>
```

✅ **Read-Only Database Queries:**
```sql
SELECT * FROM usage_records WHERE timestamp >= NOW() - INTERVAL '1 hour';
SELECT * FROM billing_snapshots WHERE period_start >= NOW() - INTERVAL '1 day';
```

✅ **Log Analysis:**
```bash
kubectl logs deployment/api-gateway --since=1h | grep ERROR
kubectl logs deployment/api-gateway --since=1h | grep "STARTUP FAILURE"
```

### 6.5 Operator Escalation Path

**Rule:** Clear escalation path for issues beyond operator authority.

**Escalation Levels:**

#### Level 1: On-Call Engineer (First Responder)
- **Handles:** Routine issues, known errors, transient failures
- **Authority:** Execute runbooks, toggle kill switches, restart pods
- **Escalates:** Unknown issues, persistent failures, security incidents

#### Level 2: Technical Lead (Subject Matter Expert)
- **Handles:** Complex issues, billing integrity violations, provider issues
- **Authority:** Make architectural decisions, approve hotfixes, coordinate response
- **Escalates:** Data corruption, security breaches, regulatory issues

#### Level 3: Engineering Manager (Executive Authority)
- **Handles:** Business impact decisions, customer communication, policy changes
- **Authority:** Approve emergency manual data fixes, authorize downtime, external communication
- **Escalates:** Legal issues, compliance violations, executive decisions

**Escalation Triggers:**
- Data corruption detected → Level 2 immediately
- Security breach suspected → Level 2 immediately, Level 3 if confirmed
- Billing integrity violation → Level 2 immediately
- Cost runaway (> $10,000/day) → Level 2 for review
- Execution success rate < 50% → Level 2 for investigation
- Unknown error causing crashes → Level 2 for debugging

---

## 7. EXPLICIT NON-GOALS

Phase 28A explicitly does NOT define:

### Implementation Details (Phase 28B)

❌ **No Code Implementation:**
- No launch verification scripts
- No monitoring dashboards
- No automated rollback triggers
- No cost tracking automation

❌ **No Infrastructure Provisioning:**
- No Kubernetes manifests
- No Terraform configurations
- No load balancer setup
- No DNS configuration

❌ **No Monitoring Setup:**
- No Prometheus configuration
- No Grafana dashboards
- No alert rules
- No log aggregation

### Business Operations

❌ **No Pricing Strategy:**
- No pricing tier definitions
- No billing cycle decisions
- No payment method setup
- No customer communication

❌ **No Marketing/Communications:**
- No launch announcements
- No customer onboarding flows
- No documentation for end users
- No support processes

### Advanced Features

❌ **No Traffic Shaping:**
- No rate limiting per user
- No priority queues
- No traffic routing algorithms
- No A/B testing infrastructure

❌ **No Advanced Billing:**
- No tiered pricing
- No volume discounts
- No payment plans
- No credit system

❌ **No Advanced Monitoring:**
- No anomaly detection
- No predictive alerts
- No cost forecasting
- No SLO/SLI tracking

### Security Hardening

❌ **No Advanced Auth:**
- No JWT implementation (future phase)
- No OAuth integration
- No multi-factor authentication
- No session management

❌ **No DDoS Protection:**
- No rate limiting beyond safety limits
- No IP blocking
- No CAPTCHA
- No request signing

---

## 8. SAFE RESUME POINT FOR PHASE 28B

**Checkpoint File:** `docs/PHASE-28A-DESIGN.md`

**What Phase 28B Can Implement:**

1. **Launch Verification Scripts:**
   - Pre-launch checklist automation
   - Go/no-go validation script
   - First-hour monitoring script
   - 24-hour monitoring script

2. **Abort Automation:**
   - Kill switch toggle commands
   - Rollback execution scripts
   - Abort documentation templates

3. **Cost Tracking:**
   - Cost sanity validation queries
   - Hourly cost trend analysis
   - Per-user cost reporting
   - Cost anomaly detection

4. **Billing Verification:**
   - Usage ledger integrity checks
   - Billing snapshot verification queries
   - Invoice generation verification

5. **Operator Tooling:**
   - Launch log entry templates
   - Incident response playbooks
   - Escalation contact lists

**What Phase 28B MUST NOT Change:**

❌ **Launch Model:**
- Do NOT skip phased rollout (Phase 0 → 1 → 2 → 3)
- Do NOT automate phase transitions (manual approval required)
- Do NOT change abort conditions (objective criteria locked)

❌ **Safety Controls:**
- Do NOT modify kill switch behavior (Phase 26B)
- Do NOT modify safety limit enforcement (Phase 26B)
- Do NOT bypass startup checks (Phase 27B)

❌ **Billing Integrity:**
- Do NOT allow manual data mutation
- Do NOT skip usage ledger writes
- Do NOT modify billing calculations (Phase 23B)

❌ **Operator Authority:**
- Do NOT automate launch approval (human decision required)
- Do NOT automate abort decisions for non-critical issues
- Do NOT bypass escalation paths

**Suggested Phase 28B Implementation Priority:**

1. **Critical (Launch Blockers):**
   - Pre-launch verification script
   - Kill switch toggle commands
   - First-hour monitoring script

2. **Important (Launch Enablers):**
   - Cost sanity validation
   - Billing verification queries
   - Launch log templates

3. **Nice-to-Have (Operational Efficiency):**
   - 24-hour monitoring automation
   - Cost anomaly detection
   - Operator dashboards

**Resume Conditions:**
- Phase 28A design reviewed and approved
- Stakeholders aligned on launch model
- Incident response team trained
- Rollback playbooks accessible

---

## ULTRA-BRIEF SUMMARY

Phase 28A launch readiness architecture locked:

• **Phased Launch Model:** Closed-by-default → Internal (Phase 1) → Early Access (Phase 2) → Public (Phase 3) — validation gates between phases, manual approval required, NO automatic transitions

• **Objective Launch Gates:** 10 GO criteria (health, config, kill switches, providers, billing, team) and 10 NO-GO blockers (startup failures, invalid config, provider unavailable, billing broken) — deterministic checks, objective evidence required, NO subjective judgments

• **Fail-Safe Abort:** Immediate abort conditions (billing integrity violation, cost runaway, system instability, security incident, provider outage) — kill switch toggle < 5 minutes, rollback < 10 minutes, NO data corruption guaranteed

• **Post-Launch Verification:** First-hour checks (health, execution, billing, cost < $10), 24-hour checks (stability, cost < $1,000, billing integrity) — cost sanity validation, execution correctness sampling, billing snapshot verification

• **Clear Operator Authority:** Launch Coordinator (go/no-go decision), Technical Lead (technical sign-off), On-Call Engineer (monitoring/abort), Any Engineer (emergency abort authority) — kill switches via env vars + restart, NO manual data mutation, escalation path defined

**Why This Enables Production Launch:** Deterministic pre-launch validation, phased rollout with abort gates, billing integrity preserved, clear operator responsibilities, 10-minute rollback guarantee, NO ambiguous decisions

---

**END OF PHASE 28A DESIGN**
