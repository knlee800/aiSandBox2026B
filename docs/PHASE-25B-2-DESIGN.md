# PHASE 25B-2 DESIGN: Payment Attempt System

**Phase:** 25B-2
**Nature:** DESIGN ONLY (No Implementation)
**Scope:** api-gateway only
**Status:** DESIGN COMPLETE
**Date:** 2026-02-07
**Prerequisite:** Phase 25B-1 (Invoice Persistence) COMPLETE, Phase 25A (Payments Design) COMPLETE
**Next Phase:** Phase 25B-3 (Payment Attempt Implementation)

---

## 1. Phase Overview

### 1.1 What Phase 25B-2 Defines

Phase 25B-2 establishes the design for **Payment Attempt System**—the mechanism responsible for executing payment charges against invoices created in Phase 25B-1, tracking payment attempts, handling failures, and managing retries while maintaining strict isolation from execution and billing correctness.

**Core Achievement:**
A payment attempt layer that:
- Executes payment charges via external payment provider (Stripe-like)
- Tracks each payment attempt with full audit trail
- Handles retryable vs terminal failures deterministically
- Manages retry logic with capped attempts and backoff strategy
- Transitions invoice status based on payment outcomes
- Maintains complete isolation from AI execution and billing calculation
- Guarantees idempotency (no duplicate charges)

**Key Architectural Principle:**
Payment attempts are **synchronous, deterministic, and isolated**—payment execution happens on-demand (no background jobs in Phase 25B-2), retry decisions are deterministic (no randomness), and payment failures NEVER affect AI execution or billing snapshot correctness.

### 1.2 Why Payment Attempts are Separated from Invoices

**Critical Design Decision:**
Phase 25B-2 separates **attempting payments** from **storing invoices** (Phase 25B-1).

**Rationale:**
- **Audit Trail:** Each payment attempt is logged independently (1 invoice → N attempts)
- **Retry Transparency:** Multiple attempts visible (not hidden in invoice status changes)
- **Failure Analysis:** Detailed failure reasons per attempt (not just invoice-level status)
- **Idempotency:** Attempt number drives idempotency key (prevents duplicate charges)
- **Provider Independence:** Attempt entity is provider-agnostic (Stripe ID stored as reference)

**Clear Boundary:**
```
Phase 25B-1: BillingSnapshot → Invoice (persistence only, status='draft')
Phase 25B-2: Invoice → PaymentAttempt → Provider API Call → Status Update (THIS: charge execution)
Phase 25B-3+: Provider → Webhook → Status Sync (future: async notifications)
```

---

## 2. PaymentAttempt Entity (Conceptual)

### 2.1 Entity Purpose

**PaymentAttempt** represents a single attempt to charge an invoice via external payment provider.

**Why Separate Entity:**
- One invoice can have multiple payment attempts (1:N relationship)
- Each attempt is immutable after creation (append-only audit log)
- Attempt entity stores provider-specific identifiers (e.g., Stripe payment intent ID)
- Enables detailed failure analysis per attempt (not just final invoice status)

### 2.2 Entity Fields

**PaymentAttempt Entity Design:**
```typescript
PaymentAttempt {
  // Identity
  paymentAttemptId: string;      // UUID, primary key, unique identifier
  invoiceId: string;             // FK to invoices.invoice_id (which invoice)

  // Attempt Metadata
  attemptNumber: number;         // 1, 2, 3, 4 (sequential, starts at 1)
  provider: string;              // Payment provider name (e.g., 'stripe', 'stub')

  // Charge Details
  amountUSD: number;             // Amount attempted (USD, 3 decimals, copied from invoice)
  currency: string;              // Currency code (always 'USD' in Phase 25B-2)

  // Status
  status: 'pending' | 'succeeded' | 'failed';  // Attempt outcome

  // Provider Reference
  providerReferenceId: string | null;  // Provider's payment ID (e.g., Stripe payment intent ID)

  // Idempotency
  idempotencyKey: string;        // Format: 'invoice-{invoiceId}-{attemptNumber}'

  // Failure Information (nullable, only set on failure)
  failureCode: string | null;    // Normalized failure code (e.g., 'card_declined', 'insufficient_funds')
  failureMessage: string | null; // Human-readable failure message
  retryable: boolean;            // Can this failure be retried? (derived from failureCode)

  // Timestamps
  createdAt: Date;               // When attempt was initiated
  completedAt: Date | null;      // When attempt finished (success or failure)
}
```

### 2.3 Field Constraints

**Primary Key:**
```typescript
paymentAttemptId: string;  // UUID v4, unique identifier
```
- Each attempt has unique ID (even retries of same invoice)
- Enables distinct audit trail per attempt

**Foreign Key:**
```typescript
invoiceId: string;  // FK to invoices.invoice_id
```
- Links attempt to invoice
- Constraint: ON DELETE RESTRICT (cannot delete invoice with attempts)
- Index: `idx_payment_attempts_invoice_id` for fast lookups

**Attempt Sequencing:**
```typescript
attemptNumber: number;  // 1, 2, 3, 4
```
- Starts at 1 for first attempt
- Increments by 1 for each retry
- Max value: 4 (Phase 25A constraint)
- Unique constraint: (invoiceId, attemptNumber) prevents duplicate attempt numbers

**Idempotency Key:**
```typescript
idempotencyKey: string;  // Format: 'invoice-{invoiceId}-{attemptNumber}'
```
- Example: `'invoice-550e8400-e29b-41d4-a716-446655440000-1'`
- Sent to payment provider for duplicate prevention
- Unique constraint: `idx_payment_attempts_idempotency_key` (unique)
- Provider caches result for 24 hours (Stripe-like behavior)

**Status Values:**
```typescript
status: 'pending' | 'succeeded' | 'failed';
```
- `pending`: Payment attempt in progress (transient state)
- `succeeded`: Payment completed successfully (terminal state)
- `failed`: Payment attempt failed (may be retryable or terminal)

**Failure Taxonomy:**
```typescript
failureCode: string | null;  // Normalized codes (see section 4.2)
```
- `null` if status='succeeded' or status='pending'
- Normalized failure codes (provider-agnostic):
  - `card_declined`
  - `insufficient_funds`
  - `card_expired`
  - `provider_error`
  - `network_error`
  - etc. (see section 4.2 for full taxonomy)

**Retryability Flag:**
```typescript
retryable: boolean;
```
- `true` if failure is transient (e.g., provider_error, network_error)
- `false` if failure is permanent (e.g., card_declined, card_expired)
- Derived from failureCode (deterministic mapping, see section 4.2)

### 2.4 Entity Relationships

**Invoice ← PaymentAttempt (1:N):**
```
One Invoice can have multiple PaymentAttempts
  - First attempt: attemptNumber=1
  - Retry 1: attemptNumber=2
  - Retry 2: attemptNumber=3
  - Retry 3: attemptNumber=4
  - Max 4 attempts per invoice (Phase 25A constraint)
```

**Example Scenario:**
```
Invoice ID: inv_123
  → PaymentAttempt #1: status=failed, failureCode=provider_error, retryable=true
  → PaymentAttempt #2: status=failed, failureCode=network_error, retryable=true
  → PaymentAttempt #3: status=succeeded (final)

Invoice status progression:
  draft → pending_payment (attempt #1 initiated)
        → failed (attempt #1 failed, retry scheduled)
        → pending_payment (attempt #2 initiated)
        → failed (attempt #2 failed, retry scheduled)
        → pending_payment (attempt #3 initiated)
        → paid (attempt #3 succeeded, terminal)
```

### 2.5 Immutability Rules

**PaymentAttempt is Append-Only:**
```
Once created, PaymentAttempt records are NEVER updated or deleted.
```

**Enforcement:**
- No UPDATE operations on payment_attempts table
- No DELETE operations on payment_attempts table
- Only INSERT operations allowed
- Audit trail integrity guaranteed (cannot tamper with attempt history)

**Status Transitions (Within Attempt Lifecycle):**
```
pending → succeeded (success)
pending → failed (failure)
```
- Status transitions happen via INSERT of new attempt record, NOT UPDATE of existing record
- Example: Attempt #1 fails → new PaymentAttempt record created with status='failed'
- Correction: Actually, each attempt's status CAN transition (pending → succeeded/failed) within its lifecycle, but once succeeded/failed, it's immutable

**Clarification:**
```
PaymentAttempt status field IS mutable during attempt lifecycle:
  1. Create PaymentAttempt (status='pending')
  2. Call payment provider API
  3. Update PaymentAttempt.status to 'succeeded' or 'failed'
  4. PaymentAttempt is now immutable (no further updates)
```

**Why This Matters:**
- Each attempt represents a single API call to payment provider
- Status reflects outcome of that single API call
- Once outcome known (succeeded/failed), attempt is frozen
- Retries create NEW PaymentAttempt records (attemptNumber incremented)

---

## 3. Payment Attempt Lifecycle

### 3.1 Lifecycle State Machine

**Invoice Status Machine (With Payment Attempts):**
```
[draft]
  ↓ (initiate payment)
[pending_payment] ← PaymentAttempt #1 created (status=pending)
  ↓
  ├─ [succeeded] → [paid] (terminal, attempt #1 status=succeeded)
  │
  └─ [failed] → Retry Decision:
       ├─ retryable=true AND attemptNumber < 4 → [pending_payment] (create attempt #2)
       │    ↓
       │    └─ (repeat: succeeded → paid OR failed → retry decision)
       │
       └─ retryable=false OR attemptNumber >= 4 → [written_off] (terminal)
```

**PaymentAttempt Status Machine (Per Attempt):**
```
[pending] (attempt created, API call initiated)
  ↓
  ├─ [succeeded] (payment provider returned success)
  │    → Invoice.status = 'paid'
  │    → Terminal (no retries)
  │
  └─ [failed] (payment provider returned failure)
       → Invoice.status = 'failed' (temporarily)
       → Check retryable flag:
            ├─ retryable=true AND attemptNumber < 4 → Schedule retry (create new attempt)
            └─ retryable=false OR attemptNumber >= 4 → Invoice.status = 'written_off' (terminal)
```

### 3.2 When Payment Attempts Are Created

**Trigger 1: Automatic Invoice Finalization (Phase 25B-2 MVP):**
```
1. BillingSnapshot finalized (status='finalized')
2. InvoiceService.createFromSnapshot(snapshotId) → Invoice created (status='draft')
3. InvoiceService.finalizeInvoice(invoiceId) → Invoice.status = 'finalized'
4. PaymentService.chargeInvoice(invoiceId) → PaymentAttempt #1 created
```

**Trigger 2: Manual Retry (Phase 25C+):**
```
Admin clicks "Retry Payment" button
  → PaymentService.retryInvoice(invoiceId) → PaymentAttempt #N created (N = previous attempts + 1)
```

**Trigger 3: Automatic Retry (Phase 25B-3+ with background jobs):**
```
PaymentAttempt #N fails with retryable=true
  → Background job scheduled (delay based on attempt number)
  → Job executes: PaymentService.retryInvoice(invoiceId) → PaymentAttempt #N+1 created
```

**Phase 25B-2 Scope:**
- Trigger 1 (automatic on finalization) — INCLUDED
- Trigger 2 (manual retry) — DEFERRED to Phase 25C+
- Trigger 3 (automatic retry with background jobs) — DEFERRED to Phase 25B-3+

### 3.3 Maximum Retry Count

**Constraint from Phase 25A:**
```
Max Attempts: 4
```

**Attempt Numbering:**
```
Attempt #1: Initial charge attempt
Attempt #2: First retry (if #1 fails with retryable=true)
Attempt #3: Second retry (if #2 fails with retryable=true)
Attempt #4: Third retry (if #3 fails with retryable=true)
```

**Terminal Condition:**
```
IF attemptNumber >= 4 AND status='failed':
  Invoice.status = 'written_off' (no more automatic retries)
```

**Why 4 Attempts:**
- Balances retry persistence vs acceptance of payment failure
- Prevents infinite retry loops
- Allows time for user to fix payment method (between retries)
- Industry standard (Stripe uses similar retry counts)

### 3.4 Backoff Strategy (Conceptual)

**Retry Delays (From Phase 25A):**
```
Attempt #1: Immediate (on invoice finalization)
Attempt #2: 30 minutes after attempt #1 failure
Attempt #3: 24 hours after attempt #2 failure
Attempt #4: 72 hours after attempt #3 failure
```

**Backoff Type:**
- Linear backoff with increasing delays (not exponential)
- Deterministic (no randomness, no jitter)
- Time-based (not request-count-based)

**Why Linear Backoff:**
- Exponential backoff unnecessary (max 4 attempts, not hundreds)
- Predictable retry schedule (easier to debug and explain to users)
- Aligns with business expectations (e.g., "retry daily" is understandable)

**Backoff Implementation (Deferred to Phase 25B-3+):**
```
Phase 25B-2: No automatic retry scheduling (manual trigger only)
Phase 25B-3+: Background job scheduler implements backoff delays
```

### 3.5 Invoice Status Transitions

**Status Transition Rules:**
```
draft → finalized (invoice ready for payment)
  → Triggered by: InvoiceService.finalizeInvoice(invoiceId)
  → Precondition: Invoice exists, status='draft'
  → Effect: Invoice.status = 'finalized'

finalized → pending_payment (payment attempt initiated)
  → Triggered by: PaymentService.chargeInvoice(invoiceId)
  → Effect: Invoice.status = 'pending_payment', PaymentAttempt #1 created (status='pending')

pending_payment → paid (payment succeeded)
  → Triggered by: PaymentAttempt.status = 'succeeded'
  → Effect: Invoice.status = 'paid', Invoice.paidAt = now()
  → Terminal state (no further transitions)

pending_payment → failed (payment failed, retry possible)
  → Triggered by: PaymentAttempt.status = 'failed', retryable=true, attemptNumber < 4
  → Effect: Invoice.status = 'failed' (temporarily)
  → Next action: Retry initiated (new PaymentAttempt created)

failed → pending_payment (retry attempt)
  → Triggered by: PaymentService.retryInvoice(invoiceId)
  → Effect: Invoice.status = 'pending_payment', PaymentAttempt #N created (status='pending')

failed → written_off (max retries exceeded or non-retryable failure)
  → Triggered by: PaymentAttempt.status = 'failed', retryable=false OR attemptNumber >= 4
  → Effect: Invoice.status = 'written_off'
  → Terminal state (no automatic retries, manual intervention required)
```

**Invoice Status Field (Phase 25B-2):**
```typescript
Invoice.status: 'draft' | 'finalized' | 'pending_payment' | 'paid' | 'failed' | 'written_off'
```

**Additional Invoice Fields Updated:**
```typescript
Invoice.paidAt: Date | null;           // Set when status='paid'
Invoice.paymentAttemptCount: number;   // Incremented on each attempt
Invoice.lastPaymentAttemptAt: Date;    // Updated on each attempt
```

**Immutability Constraint:**
```
Invoice line items, amounts, period remain immutable (no updates).
Only status, paidAt, paymentAttemptCount, lastPaymentAttemptAt are mutable.
```

---

## 4. Retry Semantics

### 4.1 Retryable vs Terminal Failures

**Retryable Failures (Transient Errors):**
```
Failures that are temporary and likely to succeed on retry.
```

**Examples:**
- `provider_error`: Payment provider API returned 5xx error (server-side issue)
- `network_error`: Network timeout or connection failure
- `rate_limit_exceeded`: Provider rate limit hit (retry after delay)
- `provider_timeout`: Provider API took too long to respond

**Retry Logic:**
```
IF failureCode IN retryable_codes AND attemptNumber < 4:
  Schedule retry (create new PaymentAttempt)
ELSE:
  Mark invoice as written_off
```

---

**Terminal Failures (Permanent Errors):**
```
Failures that are permanent and will NOT succeed on retry (require user action).
```

**Examples:**
- `card_declined`: Customer's card declined by issuer (insufficient funds, fraud, etc.)
- `card_expired`: Payment method expired
- `card_invalid`: Invalid card number or CVV
- `payment_method_removed`: Customer removed payment method
- `customer_account_closed`: Customer's account with provider closed
- `insufficient_funds`: Explicit insufficient funds error

**Retry Logic:**
```
IF failureCode IN terminal_codes:
  Mark invoice as written_off (no retries)
  Notify user (email: "Payment failed, update payment method")
```

### 4.2 Failure Taxonomy (Provider-Agnostic)

**Normalized Failure Codes:**
```
Payment providers return provider-specific error codes.
PaymentService normalizes these to provider-agnostic codes.
```

**Failure Code Mapping (Stripe → Normalized):**
```typescript
// Stripe error code → Normalized code (retryable flag)
{
  'card_declined': { code: 'card_declined', retryable: false },
  'insufficient_funds': { code: 'insufficient_funds', retryable: false },
  'expired_card': { code: 'card_expired', retryable: false },
  'incorrect_cvc': { code: 'card_invalid', retryable: false },
  'processing_error': { code: 'provider_error', retryable: true },
  'rate_limit': { code: 'rate_limit_exceeded', retryable: true },
  // ... (full mapping in Phase 25B-3 implementation)
}
```

**Failure Code Categories:**

**Category 1: Card/Payment Method Issues (Terminal):**
```
card_declined, card_expired, card_invalid, payment_method_removed
  → retryable: false
  → Action: User must update payment method
```

**Category 2: Account/Balance Issues (Terminal):**
```
insufficient_funds, customer_account_closed
  → retryable: false
  → Action: User must add funds or resolve account issue
```

**Category 3: Provider Issues (Retryable):**
```
provider_error, provider_timeout, rate_limit_exceeded
  → retryable: true
  → Action: Automatic retry after delay
```

**Category 4: Network Issues (Retryable):**
```
network_error, network_timeout
  → retryable: true
  → Action: Automatic retry after delay
```

**Category 5: Unknown (Conservative: Non-Retryable):**
```
unknown_error
  → retryable: false (conservative approach)
  → Action: Manual investigation required
```

### 4.3 Idempotency Guarantees Per Attempt

**Idempotency Key Strategy:**
```typescript
idempotencyKey = `invoice-${invoiceId}-${attemptNumber}`
```

**Example:**
```
Invoice ID: 550e8400-e29b-41d4-a716-446655440000
Attempt #1: 'invoice-550e8400-e29b-41d4-a716-446655440000-1'
Attempt #2: 'invoice-550e8400-e29b-41d4-a716-446655440000-2'
Attempt #3: 'invoice-550e8400-e29b-41d4-a716-446655440000-3'
```

**Provider Idempotency Behavior (Stripe-like):**
```
1. First call with key X → payment processed, result cached
2. Duplicate call with same key X (within 24 hours) → returns cached result (no duplicate charge)
3. Call with different key Y → new payment processed
```

**Why This Works:**
- `invoiceId` ensures per-invoice uniqueness (same invoice never charged twice accidentally)
- `attemptNumber` enables retries (different key for each retry = new payment attempt)
- Provider caches result per key (duplicate API calls with same key return cached result)

**Idempotency Enforcement:**

**Database-Level:**
```sql
CREATE UNIQUE INDEX idx_payment_attempts_idempotency_key
ON payment_attempts(idempotency_key);
```
- Prevents duplicate PaymentAttempt records with same idempotency key
- Application-level duplicate detection (throw ConflictException if duplicate)

**Application-Level:**
```typescript
// Before creating PaymentAttempt:
const existingAttempt = await paymentAttemptRepository.findOne({
  where: { idempotencyKey }
});
if (existingAttempt) {
  throw new ConflictException('Payment attempt already exists with this idempotency key');
}
```

**Provider-Level:**
```typescript
// Send idempotency key to provider:
const result = await paymentProvider.charge({
  amount: invoice.totalCostUSD,
  customerId: providerCustomerId,
  idempotencyKey: attempt.idempotencyKey,  // Provider caches result
});
```

### 4.4 Deterministic Retry Rules (No Randomness)

**Design Principle:**
All retry decisions are deterministic (no random backoff, no probabilistic retries).

**Deterministic Rules:**

**Rule 1: Retry Eligibility**
```typescript
canRetry = (
  attempt.retryable === true &&
  invoice.paymentAttemptCount < 4
);
```
- No randomness (always same decision for same inputs)

**Rule 2: Retry Delay (Deferred to Phase 25B-3+)**
```typescript
retryDelay = getRetryDelay(attemptNumber);

function getRetryDelay(attemptNumber: number): number {
  const delays = [
    0,           // Attempt #1: immediate
    30 * 60,     // Attempt #2: 30 minutes (in seconds)
    24 * 60 * 60, // Attempt #3: 24 hours
    72 * 60 * 60, // Attempt #4: 72 hours
  ];
  return delays[attemptNumber - 1] || 0;
}
```
- No jitter (exact delays, not randomized)
- No exponential backoff variation

**Rule 3: Retry Trigger**
```typescript
// Phase 25B-2 (manual trigger only):
await paymentService.retryInvoice(invoiceId);  // Explicit call

// Phase 25B-3+ (automatic trigger with scheduler):
scheduleJob({
  name: 'retry-payment',
  invoiceId: invoice.invoiceId,
  runAt: now() + retryDelay,  // Deterministic delay
});
```

**Why Deterministic:**
- Reproducible behavior (same failure always produces same retry schedule)
- Easier to debug (no "it worked this time but not last time" due to randomness)
- Predictable for users (retry schedule is communicable: "We'll retry in 30 minutes")
- Testable (unit tests can verify retry logic without mocking random functions)

---

## 5. Provider Abstraction Design

### 5.1 PaymentProvider Interface (Conceptual)

**Purpose:**
Abstract external payment provider (Stripe, PayPal, etc.) behind interface.

**Design Principle:**
Provider-agnostic interface enables provider swapping without changing core payment logic.

**Interface Definition:**
```typescript
interface PaymentProviderInterface {
  /**
   * Get provider name
   * @returns Provider name (e.g., 'stripe', 'stub')
   */
  getProviderName(): string;

  /**
   * Charge customer for invoice
   * @param request - Charge request details
   * @returns Charge result (success or failure)
   * @throws PaymentProviderError if provider API fails
   */
  charge(request: ChargeRequest): Promise<ChargeResult>;

  /**
   * Get payment status (for polling if needed)
   * @param providerReferenceId - Provider's payment ID
   * @returns Payment status
   * @throws PaymentProviderError if provider API fails
   */
  getPaymentStatus(providerReferenceId: string): Promise<PaymentStatus>;
}
```

**ChargeRequest:**
```typescript
interface ChargeRequest {
  customerId: string;           // Provider's customer ID (e.g., Stripe customer ID)
  paymentMethodId: string;      // Provider's payment method ID (e.g., Stripe payment method ID)
  amountUSD: number;            // Amount to charge (USD, 3 decimals)
  currency: string;             // Currency code (always 'USD' in Phase 25B-2)
  description: string;          // Charge description (e.g., 'AI Sandbox Usage: Feb 2026')
  invoiceId: string;            // Platform invoice ID (for reference)
  idempotencyKey: string;       // Idempotency key (format: 'invoice-{invoiceId}-{attemptNumber}')
}
```

**ChargeResult:**
```typescript
interface ChargeResult {
  status: 'succeeded' | 'failed' | 'pending';  // Charge outcome
  providerReferenceId: string;                 // Provider's payment ID (e.g., Stripe payment intent ID)
  failureCode?: string;                        // Provider-specific failure code (if failed)
  failureMessage?: string;                     // Human-readable failure message (if failed)
  retryable: boolean;                          // Can this failure be retried?
}
```

**PaymentStatus:**
```typescript
interface PaymentStatus {
  status: 'succeeded' | 'failed' | 'pending';  // Current payment status
  providerReferenceId: string;                 // Provider's payment ID
  failureCode?: string;                        // Failure code (if failed)
  failureMessage?: string;                     // Failure message (if failed)
}
```

### 5.2 Provider Implementations (Deferred to Phase 25B-3)

**StripePaymentProvider (NOT in Phase 25B-2 design):**
```typescript
class StripePaymentProvider implements PaymentProviderInterface {
  // Implementation deferred to Phase 25B-3
  // Wraps Stripe SDK calls
  // Normalizes Stripe error codes to PaymentProviderInterface format
}
```

**StubPaymentProvider (For Testing):**
```typescript
class StubPaymentProvider implements PaymentProviderInterface {
  // Implementation deferred to Phase 25B-3
  // Returns hardcoded success/failure for testing
  // No external API calls
}
```

### 5.3 Error Mapping Responsibilities

**Provider Responsibility:**
```
Payment provider implementation MUST:
  1. Call external provider API (e.g., Stripe)
  2. Catch provider-specific errors
  3. Map to normalized failure codes (see section 4.2)
  4. Set retryable flag based on error category
  5. Return ChargeResult with normalized data
```

**Example Error Mapping (Stripe):**
```typescript
// Stripe returns error code 'card_declined'
// Provider maps to:
{
  status: 'failed',
  failureCode: 'card_declined',  // Normalized code
  failureMessage: 'Your card was declined',
  retryable: false,  // Terminal failure
}

// Stripe returns error code 'processing_error'
// Provider maps to:
{
  status: 'failed',
  failureCode: 'provider_error',  // Normalized code
  failureMessage: 'Payment provider encountered an error',
  retryable: true,  // Transient failure
}
```

**Why Provider Handles Mapping:**
- Core payment logic (PaymentService) remains provider-agnostic
- Adding new provider only requires implementing mapping for that provider
- Testing easier (mock provider returns normalized errors)

### 5.4 Provider-Agnostic Error Normalization

**Design Goal:**
PaymentService never sees provider-specific error codes.

**Data Flow:**
```
1. PaymentService calls: provider.charge(request)
2. Provider calls: Stripe API
3. Stripe returns: { error: { code: 'card_declined', message: '...' } }
4. Provider maps: 'card_declined' → { failureCode: 'card_declined', retryable: false }
5. Provider returns: ChargeResult { status: 'failed', failureCode: 'card_declined', retryable: false }
6. PaymentService receives: ChargeResult (provider-agnostic)
7. PaymentService stores: PaymentAttempt { failureCode: 'card_declined', retryable: false }
```

**Benefit:**
- Swapping Stripe for PayPal requires NO changes to PaymentService
- Retry logic (retryable flag) is provider-independent
- Failure codes are consistent across providers (easier to debug)

---

## 6. Determinism and Idempotency Guarantees

### 6.1 Deterministic Payment Execution

**Guarantee:**
Same invoice + same attempt number → same payment behavior.

**Enforcement:**

**1. Idempotency Key Determinism:**
```typescript
idempotencyKey = `invoice-${invoiceId}-${attemptNumber}`
// Always same key for same invoice+attempt
// No timestamps, no random UUIDs in key
```

**2. Amount Determinism:**
```typescript
amountUSD = invoice.totalCostUSD;  // Copied from invoice (immutable)
// No recalculation, no rounding variations
```

**3. Provider Customer ID Determinism:**
```typescript
customerId = getProviderCustomerId(invoice.apiKeyId);
// Same API key always maps to same provider customer ID
// Stored in database (not dynamically generated)
```

**4. Retry Decision Determinism:**
```typescript
canRetry = (attempt.retryable && invoice.paymentAttemptCount < 4);
// No randomness, no time-based cutoffs (e.g., "retry only during business hours")
```

**Why Determinism Matters:**
- Reproducible behavior (debugging, testing)
- Predictable billing (users trust consistent behavior)
- Audit trail clarity (no "sometimes it retries, sometimes it doesn't")

### 6.2 Idempotency at Multiple Levels

**Level 1: Database Idempotency (PaymentAttempt)**
```sql
CREATE UNIQUE INDEX idx_payment_attempts_idempotency_key
ON payment_attempts(idempotency_key);
```
- Prevents duplicate PaymentAttempt records with same idempotency key
- Application throws ConflictException if duplicate insert attempted

**Level 2: Provider Idempotency (Stripe API)**
```typescript
// Stripe API call with idempotency key:
const result = await stripe.paymentIntents.create({
  amount: amountUSD * 100,  // Convert to cents
  currency: 'usd',
  customer: customerId,
  payment_method: paymentMethodId,
  confirm: true,
}, {
  idempotencyKey: attempt.idempotencyKey,  // Stripe caches result for 24 hours
});
```
- Provider (Stripe) caches result for idempotency key
- Duplicate calls with same key return cached result (no duplicate charge)

**Level 3: Invoice Status Idempotency**
```typescript
// Before charging invoice:
if (invoice.status === 'paid') {
  throw new ConflictException('Invoice already paid');
}
if (invoice.status === 'pending_payment') {
  // Check if payment attempt already in progress
  const pendingAttempt = await findPendingAttempt(invoice.invoiceId);
  if (pendingAttempt) {
    throw new ConflictException('Payment attempt already in progress');
  }
}
```

**Level 4: Optimistic Locking (Invoice Status Transition)**
```typescript
// Update invoice status with optimistic lock:
const result = await invoiceRepository.update(
  { invoiceId: invoice.invoiceId, status: 'finalized' },  // WHERE clause
  { status: 'pending_payment' }                           // SET clause
);
if (result.affected === 0) {
  throw new ConflictException('Invoice status changed concurrently');
}
```

### 6.3 No Duplicate Charges Guarantee

**Guarantee:**
Same invoice charged at most once successfully (even if API called multiple times).

**Enforcement:**

**Scenario 1: Duplicate API Calls (Same Attempt)**
```
Time T0: Call PaymentService.chargeInvoice(invoiceId)
Time T1: PaymentAttempt #1 created (status='pending', idempotencyKey='invoice-...-1')
Time T2: Call provider.charge(request) with idempotencyKey='invoice-...-1'
Time T3: Provider processes payment (SUCCESS)
Time T4: PaymentAttempt #1 updated (status='succeeded')

Time T5: Duplicate call PaymentService.chargeInvoice(invoiceId)
Time T6: Check invoice.status → 'paid'
Time T7: Throw ConflictException('Invoice already paid')
Time T8: No duplicate charge (prevented at application level)
```

**Scenario 2: Concurrent API Calls (Race Condition)**
```
Time T0: Thread A calls PaymentService.chargeInvoice(invoiceId)
Time T1: Thread B calls PaymentService.chargeInvoice(invoiceId) (concurrently)

Time T2: Thread A checks invoice.status → 'finalized' (OK to charge)
Time T3: Thread B checks invoice.status → 'finalized' (OK to charge)

Time T4: Thread A updates invoice.status → 'pending_payment' (optimistic lock succeeds)
Time T5: Thread B updates invoice.status → 'pending_payment' (optimistic lock FAILS, affected=0)

Time T6: Thread A proceeds with payment
Time T7: Thread B throws ConflictException (prevented by optimistic lock)
Time T8: No duplicate charge
```

**Scenario 3: Provider-Level Duplicate (Same Idempotency Key)**
```
Time T0: Create PaymentAttempt #1 (idempotencyKey='invoice-...-1')
Time T1: Call provider.charge(request) with idempotencyKey='invoice-...-1'
Time T2: Network timeout (no response from provider)
Time T3: Application retries: provider.charge(request) with same idempotencyKey
Time T4: Provider recognizes duplicate idempotency key → returns cached result
Time T5: No duplicate charge (prevented at provider level)
```

---

## 7. Isolation Guarantees

### 7.1 Why Payment Failures Cannot Affect AI Execution

**Architectural Isolation:**
```
AI Execution Flow (Phase 12-21):
  User Request → Auth → Authz → Quota → ai-service Execute → AIExecutionResult

Payment Flow (Phase 25B-2):
  BillingSnapshot → Invoice → PaymentAttempt → Provider API Call → Status Update

ZERO coupling between flows:
  - ai-service has NO dependencies on InvoiceModule or PaymentService
  - Execution does NOT check invoice status or payment attempts
  - Payment failures do NOT affect quota enforcement
  - Payment provider outages do NOT block AI execution
```

**Execution Independence Scenarios:**

**Scenario 1: Payment Provider Outage**
```
Time T0: User executes AI request → SUCCESS (execution proceeds)
Time T1: Usage recorded → SUCCESS
Time T2: Billing snapshot created → SUCCESS
Time T3: Invoice created → SUCCESS
Time T4: Payment attempt initiated → FAILURE (provider API unreachable)
Time T5: User executes another AI request → SUCCESS (execution unaffected)
```

**Scenario 2: Unpaid Invoices**
```
User has 10 unpaid invoices (status='failed')
  → User can STILL execute AI requests
  → Quota enforcement based on usage, NOT payment status
  → Payment issues isolated to billing/payment system
```

**Scenario 3: Payment Retry Failures**
```
Payment attempts fail 4 times (max retries exceeded)
Invoice status = 'written_off'
  → User can STILL execute AI requests
  → Usage continues to be recorded correctly
  → Billing snapshots continue to be created
  → Only payment collection affected (not service access)
```

**Why This Matters:**
- Service availability NOT dependent on payment provider uptime
- Users not punished for payment provider issues (transient failures)
- Clear separation: execution = service delivery, payment = money collection

### 7.2 Why Retries Cannot Cause Duplicate Charges

**Idempotency Guarantees (See Section 6.2):**

**At Database Level:**
```
UNIQUE constraint on idempotency_key prevents duplicate PaymentAttempt records.
```

**At Provider Level:**
```
Provider (Stripe) caches result per idempotency key (24-hour window).
Duplicate API calls with same key return cached result (no duplicate charge).
```

**At Application Level:**
```
Invoice status checks prevent duplicate charge attempts:
  - Invoice.status='paid' → no further charges
  - Invoice.status='pending_payment' → wait for current attempt to complete
```

**Retry Scenario (No Duplicate Charge):**
```
Attempt #1: idempotencyKey='invoice-123-1' → FAILURE (retryable)
  → Invoice.status='failed'
  → PaymentAttempt #1 created (status='failed', retryable=true)

Attempt #2: idempotencyKey='invoice-123-2' → SUCCESS
  → Invoice.status='paid'
  → PaymentAttempt #2 created (status='succeeded')

Result: Only 1 successful charge (different idempotency keys for each attempt)
```

**Network Failure Scenario (No Duplicate Charge):**
```
Attempt #1: idempotencyKey='invoice-123-1'
  → Call provider.charge(request) → Network timeout (no response)
  → Application retries: provider.charge(request) with SAME idempotencyKey
  → Provider recognizes duplicate key → returns cached result
  → No duplicate charge (provider-level deduplication)
```

### 7.3 Why Invoice and Snapshot Immutability Is Preserved

**BillingSnapshot Immutability (Phase 23 Guarantee):**
```
PaymentService has READ-ONLY access to BillingSnapshot:
  - No writes to billing_snapshots table
  - No updates to BillingSnapshot.status
  - Invoice created from snapshot (snapshot remains unchanged)
```

**Invoice Line Items Immutability (Phase 25B-1 Guarantee):**
```
Invoice line items, amounts, period are FROZEN after creation:
  - Invoice.totalCostUSD NEVER updated (copied from snapshot once)
  - Invoice.lineItems[] NEVER modified
  - Invoice.periodStart/periodEnd NEVER changed
```

**Mutable Invoice Fields (Allowed):**
```
ONLY the following Invoice fields can be updated:
  - status (draft → finalized → pending_payment → paid/failed/written_off)
  - paidAt (null → Date when payment succeeds)
  - paymentAttemptCount (incremented on each attempt)
  - lastPaymentAttemptAt (updated on each attempt)
```

**Why This Matters:**
- Payment outcomes do NOT retroactively change billing amounts
- Audit trail integrity: invoice amounts match snapshot (source-of-truth)
- Dispute resolution: invoice amounts are deterministic (reproducible from snapshot)

**Enforcement:**
```typescript
// InvoiceService has NO methods for:
updateInvoiceAmount(...)     // ❌ Does not exist
updateInvoiceLineItems(...)  // ❌ Does not exist
recalculateInvoice(...)      // ❌ Does not exist

// ONLY allowed:
updateInvoiceStatus(...)     // ✅ Allowed (status transitions only)
```

---

## 8. Explicit Non-Goals (NOT in Phase 25B-2 Design)

### 8.1 No Payment Provider SDK Integration

**NOT Included in Phase 25B-2 Design:**
- ❌ Stripe SDK installation or configuration
- ❌ Stripe API key management
- ❌ Stripe customer creation logic
- ❌ Stripe payment method attachment
- ❌ Stripe payment intent API calls

**Rationale:**
Design defines PaymentProvider interface, implementation deferred to Phase 25B-3.

### 8.2 No Stripe Implementation

**NOT Included in Phase 25B-2 Design:**
- ❌ StripePaymentProvider class implementation
- ❌ Stripe error code mapping
- ❌ Stripe webhook signature validation
- ❌ Stripe idempotency key handling

**Rationale:**
Design is provider-agnostic, specific provider implementation deferred to Phase 25B-3.

### 8.3 No Webhook Handling

**NOT Included in Phase 25B-2 Design:**
- ❌ POST /api/webhooks/stripe endpoint
- ❌ Webhook event processing (payment.succeeded, payment.failed)
- ❌ Webhook signature validation
- ❌ Webhook idempotency (prevent duplicate event processing)

**Rationale:**
Core payment flow uses synchronous API calls, webhooks deferred to Phase 25B-4+ for async notifications.

### 8.4 No Background Jobs / Schedulers

**NOT Included in Phase 25B-2 Design:**
- ❌ BullMQ job queue setup
- ❌ Agenda scheduler setup
- ❌ Background job for automatic retries (deferred to Phase 25B-3+)
- ❌ Cron job for periodic invoice finalization

**Rationale:**
Phase 25B-2 focuses on synchronous payment execution, automatic retry scheduling deferred to Phase 25B-3+.

### 8.5 No Async Workers

**NOT Included in Phase 25B-2 Design:**
- ❌ Worker processes for payment processing
- ❌ Queue-based payment processing
- ❌ Asynchronous payment status polling

**Rationale:**
Payment execution is synchronous in Phase 25B-2 (call provider API, wait for result).

### 8.6 No Payment Reconciliation

**NOT Included in Phase 25B-2 Design:**
- ❌ Reconciliation between platform records and provider records
- ❌ Detecting missing payments
- ❌ Detecting duplicate charges
- ❌ Automated reconciliation reports

**Rationale:**
Reconciliation is Phase 26+ feature (requires mature payment system and reporting infrastructure).

### 8.7 No Refunds or Credits

**NOT Included in Phase 25B-2 Design:**
- ❌ Refund API (POST /api/invoices/:id/refund)
- ❌ Partial refunds
- ❌ Credit application to invoices
- ❌ Refund reason tracking
- ❌ Refund audit trail

**Rationale:**
Refunds are Phase 25C+ feature (requires admin workflows and UI).

### 8.8 No Customer Notifications

**NOT Included in Phase 25B-2 Design:**
- ❌ Email notifications (payment success, payment failure)
- ❌ SMS notifications
- ❌ In-app notifications
- ❌ Notification templates
- ❌ Notification preferences

**Rationale:**
Notifications are Phase 25C+ feature (requires notification service and user preferences).

### 8.9 No UI or Dashboards

**NOT Included in Phase 25B-2 Design:**
- ❌ Admin dashboard for payment attempts
- ❌ Payment attempt list view
- ❌ Payment failure analysis charts
- ❌ Manual retry button
- ❌ Payment history timeline

**Rationale:**
UI is Phase 26+ feature (Phase 25B-2 is backend infrastructure only).

### 8.10 No Public APIs

**NOT Included in Phase 25B-2 Design:**
- ❌ GET /api/payment-attempts (list payment attempts)
- ❌ GET /api/payment-attempts/:id (view single attempt)
- ❌ POST /api/invoices/:id/retry (manual retry endpoint)

**Rationale:**
APIs are internal-only in Phase 25B-2, user-facing APIs deferred to Phase 25C+.

### 8.11 No Code Implementation

**NOT Included in Phase 25B-2:**
- ❌ PaymentService class implementation
- ❌ PaymentAttempt entity TypeORM code
- ❌ Migration file for payment_attempts table
- ❌ Unit tests
- ❌ Integration tests

**Rationale:**
Phase 25B-2 is DESIGN ONLY, implementation deferred to Phase 25B-3.

---

## 9. Safe Resume Point

### 9.1 Phase 25B-2 Status

**Status:** DESIGN COMPLETE

**Completion Criteria Met:**
- ✅ PaymentAttempt entity designed (conceptual model)
- ✅ Payment attempt lifecycle defined (state machine)
- ✅ Retry semantics defined (retryable vs terminal, max 4 attempts)
- ✅ Provider abstraction designed (PaymentProviderInterface)
- ✅ Determinism guarantees defined (idempotency, no randomness)
- ✅ Isolation guarantees documented (execution independence)
- ✅ Failure taxonomy defined (normalized error codes)
- ✅ Explicit non-goals listed (no implementation, SDKs, webhooks, jobs)

**Design Readiness:**
Phase 25B-2 design is complete and ready for implementation (Phase 25B-3).

### 9.2 Next Allowable Phase

**Phase 25B-3: Payment Attempt Implementation (NOT AUTHORIZED)**

**Scope (if authorized):**
- Implement PaymentAttempt entity (TypeORM)
- Create migration for payment_attempts table
- Implement PaymentService.chargeInvoice() method
- Implement PaymentProviderInterface
- Implement StripePaymentProvider (Stripe SDK integration)
- Implement StubPaymentProvider (testing stub)
- Implement retry logic (synchronous, on-demand retries)
- Write unit tests (PaymentService, error mapping)
- Write integration tests (end-to-end payment flow)

**Prerequisites:**
- ✅ Phase 25B-2 (Payment Attempt Design) COMPLETE
- ✅ Phase 25B-1 (Invoice Persistence) COMPLETE
- ✅ Phase 25A (Payments Architecture) COMPLETE

**Unlocks:**
- Phase 25B-4 (Automatic Retry Scheduling with Background Jobs)
- Phase 25C (User-Facing Invoice & Payment APIs)

**Recommended Next Step:**
Phase 25B-3 (Payment Attempt Implementation).

---

**Phase 25B-4: Automatic Retry Scheduling (NOT AUTHORIZED)**

**Scope (if authorized):**
- Setup BullMQ or Agenda job queue
- Implement background job for payment retries
- Implement retry scheduling logic (backoff delays)
- Implement job idempotency (prevent duplicate retries)
- Write tests for retry scheduling

**Prerequisites:**
- ✅ Phase 25B-3 (Payment Attempt Implementation) COMPLETE

**Unlocks:**
- Automatic payment retries (no manual intervention required)

**Recommended Timing:**
After Phase 25B-3, before Phase 25C.

---

**Phase 25C: User-Facing Payment APIs (NOT AUTHORIZED)**

**Scope (if authorized):**
- GET /api/invoices (list user's invoices)
- GET /api/invoices/:id (view invoice with payment attempts)
- POST /api/invoices/:id/retry (manual retry endpoint)
- Invoice payment history (list all attempts)
- Email notifications (payment success/failure)

**Prerequisites:**
- ✅ Phase 25B-3 (Payment Attempt Implementation) COMPLETE
- Optional: Phase 25B-4 (Automatic Retry Scheduling) for better UX

**Unlocks:**
- Users can view payment status and retry failed payments

**Recommended Timing:**
After Phase 25B-4 (automatic retries working).

---

### 9.3 Phase 25B-2 Lock Policy

**Phase 25B-2 Design Must NOT Be Modified Without:**
1. Explicit user approval to reopen Phase 25B-2
2. Updated ARCHITECTURE.md (if architectural changes required)
3. Updated PRD.md (if scope changes required)
4. New Phase 25B-2-REVISION checkpoint

**Safe Clarifications (No Reopening Required):**
- Adding examples or diagrams
- Clarifying ambiguous design decisions
- Fixing typos or formatting
- Adding open questions section

**Unsafe Modifications (Reopening Required):**
- Changing PaymentAttempt entity fields
- Changing retry semantics (max attempts, backoff strategy)
- Changing failure taxonomy
- Adding new payment states
- Violating locked invariants (execution coupling, snapshot mutations, etc.)

---

## 10. Open Questions

### 10.1 Design Decisions Requiring Clarification

**Question 1: Retry Trigger in Phase 25B-3**
```
Phase 25B-2 design assumes synchronous, on-demand retries (manual trigger).
Phase 25B-3 implementation: Should retries be manual-only or automatic?

Option A: Manual retries only (admin clicks "Retry" button)
  + Simpler implementation (no background jobs in Phase 25B-3)
  - Requires admin intervention for every failed payment

Option B: Automatic retries with background jobs
  + Better UX (no admin intervention required)
  - More complex (requires job queue setup in Phase 25B-3)

Recommendation: Option A for Phase 25B-3 (manual), Option B for Phase 25B-4 (automatic)
```

**Question 2: Payment Method Storage**
```
Design assumes provider customer ID and payment method ID are already stored.
Where are these stored?

Option A: api_keys table (link API key to provider customer ID)
  + Simple (one-to-one mapping: API key ↔ provider customer)

Option B: payment_methods table (separate table for payment methods)
  + Flexible (multiple payment methods per user)
  - More complex (requires new table)

Recommendation: Option A for Phase 25B-3 (simplicity), Option B for Phase 26+ (flexibility)
```

**Question 3: Zero-Dollar Invoice Handling**
```
If invoice.totalCostUSD = 0, should payment attempt be created?

Option A: Skip payment attempt (mark invoice as paid immediately)
  + Efficient (no unnecessary API calls)
  - Inconsistent (some invoices have attempts, some don't)

Option B: Create payment attempt (but skip provider API call)
  + Consistent (all invoices have at least one attempt)
  - Slightly inefficient (extra database row for $0 charge)

Recommendation: Option A (skip payment attempt for zero-dollar invoices)
```

**Question 4: Currency Support**
```
Phase 25B-2 design assumes USD only.
When should multi-currency support be added?

Recommendation: Phase 26+ (requires exchange rate service, currency conversion, etc.)
```

---

## ULTRA-BRIEF SUMMARY

• **Payment attempt lifecycle designed with deterministic retries and capped attempts** via PaymentAttempt entity (paymentAttemptId, invoiceId FK, attemptNumber 1-4, status pending/succeeded/failed, idempotencyKey format 'invoice-{id}-{num}', failureCode/failureMessage for audit, retryable boolean flag) enabling one invoice to have multiple payment attempts (1:N), max 4 attempts per invoice (Phase 25A constraint), linear backoff strategy (30 min, 24 hours, 72 hours delays), and invoice status transitions (draft → finalized → pending_payment → paid/failed/written_off) with append-only audit trail (attempts never updated or deleted after completion)

• **Provider-agnostic abstraction defined with normalized failure taxonomy** via PaymentProviderInterface (charge method, getPaymentStatus method) accepting ChargeRequest (customerId, paymentMethodId, amountUSD, idempotencyKey) and returning ChargeResult (status, providerReferenceId, failureCode, retryable flag), mapping provider-specific errors (Stripe 'card_declined', 'processing_error') to normalized codes (card_declined, provider_error, network_error, etc.) with retryable categorization (card issues/insufficient funds = terminal, provider/network errors = retryable), enabling provider swapping (Stripe, PayPal, stub) without changing core payment logic

• **Invoice status transitions defined without execution coupling** maintaining strict isolation where payment failures NEVER affect AI execution (ai-service has zero payment dependencies, quota enforcement based on usage not payment status, users can execute requests with unpaid invoices), idempotency enforced at multiple levels (database UNIQUE constraint on idempotency_key, provider 24-hour caching per key, optimistic locking on invoice status transitions preventing concurrent charges), and immutability preserved (BillingSnapshot read-only access, Invoice line items/amounts never modified, only status/paidAt/attemptCount fields mutable)

• **No implementation, SDKs, or async systems introduced** with Phase 25B-2 being pure design specification defining conceptual models only (no TypeORM entities, no migration files, no service classes, no tests), explicitly excluding Stripe SDK integration (deferred to Phase 25B-3), webhook handling (deferred to Phase 25B-4+), background jobs/schedulers (deferred to Phase 25B-4), refunds/credits (deferred to Phase 25C+), customer notifications (deferred to Phase 25C+), and public APIs (deferred to Phase 25C+), with implementation readiness confirmed for Phase 25B-3 (Payment Attempt Implementation)

---

**END OF PHASE 25B-2 DESIGN**

**Phase 25B-2 design is COMPLETE.**

**Next Phase (Phase 25B-3: Payment Attempt Implementation) requires explicit user authorization.**
