# PHASE 25A DESIGN: Payments Architecture

**Phase:** 25A
**Nature:** DESIGN ONLY (No Implementation)
**Scope:** api-gateway only
**Status:** DESIGN COMPLETE
**Date:** 2026-02-07
**Prerequisite:** Phase 24B (Billing Visibility) COMPLETE
**Next Phase:** Phase 25B (Payments Implementation)

---

## 1. Phase Overview

### 1.1 What Phase 25A Defines

Phase 25A establishes the design for **Payments Architecture**—the system responsible for collecting money from users based on immutable Billing Snapshots (Phase 23) while maintaining strict isolation from execution (Phase 12-21) and billing calculation (Phase 23).

**Core Achievement:**
A payment layer that:
- Converts finalized Billing Snapshots into Invoices
- Initiates payment collection via external payment provider (Stripe-like)
- Tracks payment attempts, successes, and failures
- Maintains complete isolation from AI execution (payment failures NEVER block execution)
- Preserves all privacy guarantees (no prompt/response content involved)
- Enables audit trail from execution → usage → billing → invoice → payment

**Key Architectural Principle:**
Payments are **completely decoupled from execution**—payment state NEVER affects a user's ability to execute AI requests. Billing remains source-of-truth, payments are money collection only.

### 1.2 Why Payments are Separated from Execution and Billing

**Critical Design Decision:**
Phase 25A intentionally separates **collecting money** from **executing AI requests** and **calculating costs**.

**Rationale:**
- **Execution Independence:** Users can execute AI requests regardless of payment state (prevents service denial)
- **Billing Correctness:** Billing snapshots remain immutable and accurate regardless of payment outcomes
- **Failure Isolation:** Payment provider outages do NOT affect AI service availability
- **Privacy Preservation:** Payment processing never accesses prompt/response content
- **Auditability:** Clear separation enables independent verification of execution vs billing vs payment

**Clear Boundary:**
```
Phase 12-21: Client Request → Execution → AIExecutionResult (NO payment awareness)
Phase 22: AIExecutionResult → UsageRecord (immutable, append-only)
Phase 23: UsageRecord → BillingSnapshot (immutable after finalization)
Phase 24: BillingSnapshot → Query → Visibility (read-only)
Phase 25: BillingSnapshot (finalized) → Invoice → Payment Attempt (THIS: Money Collection)
```

---

## 2. Payment Responsibility Boundaries

### 2.1 What Payments Control

**Payments ARE Responsible For:**
- ✅ Converting finalized BillingSnapshots into Invoices
- ✅ Initiating payment collection via external provider (Stripe API calls)
- ✅ Tracking payment attempts (success, failure, retry)
- ✅ Recording payment state transitions (pending → succeeded → failed)
- ✅ Idempotency enforcement (same invoice never charged twice)
- ✅ Retry logic (when and how often to retry failed payments)
- ✅ Payment audit trail (who paid what, when, for which invoice)
- ✅ Invoice finalization (draft → finalized state transition)

**Payment Ownership:**
```
api-gateway owns:
  - InvoiceService (converts snapshots → invoices)
  - PaymentService (interacts with external payment provider)
  - Invoice entity (invoice lifecycle management)
  - PaymentAttempt entity (payment attempt tracking)
```

### 2.2 What Payments Do NOT Control

**Payments Are NOT Responsible For:**
- ❌ AI execution (ai-service remains unchanged, no payment awareness)
- ❌ Quota enforcement (Phase 20: quotas based on usage, NOT payment state)
- ❌ Billing calculation (Phase 23: snapshot creation independent of payment)
- ❌ Usage recording (Phase 22: usage ledger append-only, immutable)
- ❌ Billing snapshot creation (Phase 23 responsibility)
- ❌ Billing snapshot modification (snapshots remain immutable)
- ❌ Cost calculation (pricing logic in Phase 23, not Phase 25)
- ❌ User authentication (Phase 20 responsibility)
- ❌ API key management (Phase 20 responsibility)

**Explicit Non-Dependencies:**
```
Payment failures DO NOT:
  - Block AI execution
  - Delete usage records
  - Modify billing snapshots
  - Affect quota enforcement
  - Trigger execution retries
  - Expose prompt/response content
```

### 2.3 Separation from Execution

**LOCKED INVARIANT:**
Payment state NEVER affects execution flow.

**Enforcement:**
```
User makes AI request → api-gateway checks:
  1. Authentication (Phase 20: API key valid?)
  2. Authorization (Phase 20: user has access?)
  3. Quota (Phase 20: under quota limit?)

  ❌ NO CHECK: Payment state
  ❌ NO CHECK: Unpaid invoices
  ❌ NO CHECK: Failed payment attempts

  → If auth/authz/quota pass, execution proceeds
  → Payment state is IRRELEVANT to execution
```

**Why This Matters:**
- Payment provider outage → users can still execute AI requests
- Failed credit card → users can still execute AI requests
- Unpaid invoices → users can still execute AI requests (billing issue, not service issue)
- Payment disputes → users can still execute AI requests

**Future Exception (Phase 26+):**
- Soft limits / warnings (e.g., "You have unpaid invoices") → user informed but NOT blocked
- Hard limits (e.g., account suspension) → requires explicit admin action, NOT automatic payment denial

---

## 3. Invoice Lifecycle

### 3.1 Invoice States

**Invoice State Machine:**
```
draft → finalized → (pending_payment) → paid
                                      → failed
                                      → written_off
```

**State Definitions:**

**`draft`**
- Invoice created but not ready for payment
- Line items can still be modified (if needed for corrections)
- User cannot see draft invoices (internal only)
- Transition: manual or automatic finalization

**`finalized`**
- Invoice immutable (line items locked)
- Ready for payment collection
- User can view invoice (via Phase 24 visibility or future invoice API)
- Transition: payment attempt initiated → `pending_payment`

**`pending_payment`**
- Payment attempt in progress (external provider processing)
- Transient state (typically seconds to minutes)
- Retry possible if payment provider returns retryable error
- Transition: provider response → `paid` or `failed`

**`paid`**
- Payment successfully collected
- Terminal state (no further transitions)
- Invoice closed (no further action required)
- Audit: PaymentAttempt record with success status

**`failed`**
- Payment attempt failed (declined card, insufficient funds, etc.)
- Non-terminal state (retry possible)
- Transition: retry attempt → `pending_payment` (if retry strategy allows)
- Transition: max retries exceeded → `written_off`

**`written_off`**
- Invoice deemed uncollectible (max retries exceeded, account closed, etc.)
- Terminal state (no further automatic retries)
- Manual intervention required (admin action or debt collection)
- Audit: PaymentAttempt records showing all retry attempts

### 3.2 State Transition Rules

**Valid Transitions:**
```
draft → finalized (always allowed)
finalized → pending_payment (on first payment attempt)
pending_payment → paid (on success)
pending_payment → failed (on failure, retries remaining)
failed → pending_payment (on retry)
failed → written_off (max retries exceeded)
```

**Invalid Transitions (Enforced by InvoiceService):**
```
paid → * (terminal state, no transitions allowed)
written_off → pending_payment (terminal state, requires manual intervention)
finalized → draft (immutability violation)
```

**Idempotency Guarantee:**
```
Invoice in state `paid` → subsequent payment attempts rejected
  (prevents double-charging)
```

### 3.3 Invoice Immutability Rules

**Immutable After Finalization:**
Once invoice state = `finalized`, the following fields are FROZEN:
- `snapshotId` (which billing snapshot this invoice is for)
- `apiKeyId`, `userId` (identity)
- `periodStart`, `periodEnd` (billing period)
- `totalAmountUSD` (amount to charge)
- `lineItems[]` (cost breakdown by provider/model)

**Mutable Fields (Even After Finalization):**
- `status` (state transitions: finalized → pending_payment → paid/failed/written_off)
- `paidAt` (timestamp when payment succeeded, null until paid)
- `paymentAttemptCount` (increments on each retry)
- `lastPaymentAttemptAt` (timestamp of most recent payment attempt)

**Why Immutability Matters:**
- Prevents invoice tampering after finalization
- Ensures audit trail integrity (invoice amount matches billing snapshot)
- Enables deterministic replay (re-run payment logic, get same invoice)

---

## 4. Relationship: BillingSnapshot → Invoice

### 4.1 One-to-One Mapping

**Design Decision:**
Each finalized BillingSnapshot maps to exactly ONE Invoice.

**Rationale:**
- Simple audit trail (snapshot ID → invoice ID, deterministic)
- No invoice splitting (entire snapshot charged as single invoice)
- No invoice merging (snapshots remain independent)
- Idempotency (same snapshot never generates multiple invoices)

**Enforcement:**
```sql
CREATE UNIQUE INDEX idx_invoice_snapshot_id
ON invoices(snapshot_id);

-- Ensures: 1 snapshot → 1 invoice (maximum)
```

### 4.2 Invoice Creation Trigger

**When Invoices Are Created:**

**Option 1: Automatic (Recommended for Phase 25B MVP)**
```
BillingSnapshot transitions to status=finalized
  → Trigger: InvoiceService.createInvoiceFromSnapshot(snapshotId)
  → Invoice created in state=draft
  → Invoice immediately transitioned to state=finalized
  → Payment attempt initiated (async)
```

**Option 2: Manual (Admin-Driven)**
```
Admin reviews finalized BillingSnapshots
  → Admin approves snapshot for invoicing
  → InvoiceService.createInvoiceFromSnapshot(snapshotId)
  → Invoice created in state=finalized
  → Payment attempt initiated on demand
```

**Design Recommendation:**
- **Phase 25B MVP:** Option 1 (automatic) for simplicity
- **Phase 25C+:** Option 2 (manual) for admin review workflows

### 4.3 Invoice Content (Derived from Snapshot)

**Invoice Fields (Copied from BillingSnapshot):**
```typescript
Invoice {
  invoiceId: string;              // UUID, unique identifier
  snapshotId: string;             // Foreign key to billing_snapshots
  apiKeyId: string;               // Who is being charged
  userId: string;                 // User associated with API key
  periodStart: Date;              // Billing period (copied from snapshot)
  periodEnd: Date;
  totalAmountUSD: number;         // Copied from snapshot.totalCostUSD
  lineItems: InvoiceLineItem[];   // Copied from snapshot.lineItems
  status: InvoiceStatus;          // State machine (draft/finalized/paid/etc.)
  createdAt: Date;                // When invoice was created
  finalizedAt: Date;              // When invoice became finalized
  paidAt: Date | null;            // When payment succeeded (null if unpaid)
  paymentAttemptCount: number;    // How many payment attempts
  lastPaymentAttemptAt: Date | null; // Most recent payment attempt
}
```

**InvoiceLineItem (Copied from BillingSnapshot.lineItems):**
```typescript
InvoiceLineItem {
  provider: string;               // e.g., 'anthropic'
  model: string;                  // e.g., 'claude-3-5-sonnet-20241022'
  totalTokens: number;            // Tokens used
  totalRequests: number;          // Requests made
  pricePerThousandTokens: number; // Pricing rate applied
  amountUSD: number;              // Cost for this line item
}
```

**No Additional Calculations:**
Phase 25 does NOT recalculate costs (snapshot values are source-of-truth).

### 4.4 BillingSnapshot Remains Immutable

**LOCKED INVARIANT:**
Invoice creation/payment does NOT modify BillingSnapshot.

**Enforcement:**
```
InvoiceService has read-only access to BillingSnapshot:
  - Can SELECT from billing_snapshots
  - CANNOT UPDATE billing_snapshots
  - CANNOT DELETE billing_snapshots
  - CANNOT INSERT into billing_snapshots

Payment success/failure does NOT update snapshot status
  (snapshot status remains 'finalized' regardless of payment outcome)
```

---

## 5. Payment Provider Abstraction

### 5.1 External Provider (Stripe-Like System)

**Design Decision:**
Phase 25 integrates with an external payment provider (e.g., Stripe, PayPal, or Stripe-like API).

**Provider Responsibilities:**
- Store customer payment methods (credit cards, bank accounts)
- Process payment transactions (charge customer)
- Handle PCI compliance (no card data stored in ai-sandbox platform)
- Return payment success/failure status
- Provide idempotency keys for duplicate prevention

**Platform Responsibilities (api-gateway):**
- Call provider API to initiate payments
- Store provider customer ID (e.g., Stripe customer ID) linked to userId
- Store provider payment method ID (e.g., Stripe payment method ID) linked to apiKeyId
- Track payment attempts in PaymentAttempt entity
- Retry failed payments (if retryable)

### 5.2 One-Way Integration (Platform → Provider)

**Design Decision:**
Phase 25A uses **one-way push integration** (platform initiates all payment actions).

**One-Way Flow:**
```
api-gateway → External Payment Provider
  (Initiate payment, poll status if needed)

External Payment Provider → api-gateway
  ❌ NO webhooks required for core correctness
  ✅ Webhooks optional for async notifications (Phase 25C+)
```

**Why One-Way:**
- **Simplicity:** No webhook endpoint security, no webhook validation, no webhook replay
- **Reliability:** Platform controls retry logic (not dependent on provider callbacks)
- **Determinism:** Payment state queryable on-demand (not dependent on webhook delivery)
- **Testability:** No need to simulate webhook events in tests

**Future Extension (Phase 25C+):**
- Webhooks for async payment status updates (e.g., subscription renewals, refunds)
- Webhook signature validation
- Webhook idempotency (prevent duplicate processing)

### 5.3 Provider Abstraction Layer

**Design Pattern:**
Interface-based abstraction enables provider swapping.

**PaymentProviderInterface:**
```typescript
interface PaymentProviderInterface {
  // Create customer in provider system
  createCustomer(userId: string, email: string): Promise<ProviderCustomerId>;

  // Attach payment method to customer
  attachPaymentMethod(
    customerId: ProviderCustomerId,
    paymentMethodToken: string
  ): Promise<ProviderPaymentMethodId>;

  // Charge customer for invoice
  chargeInvoice(
    customerId: ProviderCustomerId,
    paymentMethodId: ProviderPaymentMethodId,
    amountUSD: number,
    invoiceId: string,
    idempotencyKey: string
  ): Promise<PaymentResult>;

  // Query payment status (for polling)
  getPaymentStatus(
    paymentIntentId: ProviderPaymentIntentId
  ): Promise<PaymentStatus>;
}

type PaymentResult = {
  status: 'succeeded' | 'failed' | 'pending';
  paymentIntentId: ProviderPaymentIntentId;
  failureReason?: string;
  retryable: boolean;
};
```

**Implementations:**
- `StripePaymentProvider` (Phase 25B: Stripe SDK integration)
- `StubPaymentProvider` (Phase 25B: testing/development stub)
- Future: `PayPalPaymentProvider`, `BraintreePaymentProvider`, etc.

### 5.4 Idempotency Key Strategy

**Idempotency Guarantee:**
Same invoice charged at most once, even if payment API called multiple times.

**Idempotency Key Generation:**
```typescript
idempotencyKey = `invoice-${invoiceId}-${paymentAttemptCount}`

// Example: "invoice-550e8400-e29b-41d4-a716-446655440000-1"
//          (first payment attempt for this invoice)
```

**Provider Behavior:**
- First call with key X → payment processed
- Subsequent calls with same key X → returns cached result (no duplicate charge)
- Different key Y → new payment processed (enables retries)

**Why This Works:**
- `invoiceId` ensures per-invoice uniqueness
- `paymentAttemptCount` enables retries (new key for each retry)
- Provider deduplicates within 24-hour window (Stripe-like behavior)

---

## 6. Charging Model

### 6.1 Manual vs Automatic Charging

**Phase 25B Design Decision: Automatic Charging**

**Automatic Charging (Recommended for MVP):**
```
BillingSnapshot finalized (status=finalized)
  → Trigger: InvoiceService.createAndChargeInvoice(snapshotId)
  → Invoice created (state=finalized)
  → PaymentService.chargeInvoice(invoiceId) called immediately
  → Payment attempt recorded
  → If failed: retry according to retry strategy
```

**Manual Charging (Deferred to Phase 25C+):**
```
BillingSnapshot finalized
  → Invoice created (state=finalized)
  → Admin reviews invoice
  → Admin clicks "Charge Customer" button
  → PaymentService.chargeInvoice(invoiceId) called on demand
```

**Why Automatic for MVP:**
- Simpler implementation (no admin UI required)
- Faster payment collection (no human delay)
- Predictable cash flow (payments initiated immediately after billing)

**When Manual Makes Sense (Future):**
- High-value invoices requiring review
- Disputed billing periods
- Custom payment arrangements (e.g., net-30 payment terms)

### 6.2 Prepaid vs Postpaid

**Phase 25A Design Decision: Postpaid (Usage-Based Billing)**

**Postpaid (Selected for Phase 25B):**
```
Time T0: User executes AI requests (no payment required upfront)
Time T1: Usage recorded (Phase 22)
Time T2: Billing snapshot created (Phase 23)
Time T3: Invoice created and charged (Phase 25)
```

**Why Postpaid:**
- Aligns with metered billing model (charge for what was used)
- No upfront payment friction (users can start immediately)
- Accurate billing (charge exact usage, not estimates)
- Industry standard for API platforms (AWS, Stripe, etc.)

**Prepaid (Deferred to Phase 26+):**
```
Time T0: User deposits $100 into account (credits)
Time T1: User executes AI requests (credits deducted)
Time T2: Credits depleted → user prompted to add more
```

**Why Deferred:**
- Requires credits/wallet system (additional complexity)
- Requires real-time balance tracking (execution must check balance)
- Violates execution isolation (execution would depend on prepaid balance)

**Design Recommendation:**
- **Phase 25B:** Postpaid only
- **Phase 26+:** Optional prepaid for users who prefer it

### 6.3 Currency Handling

**Phase 25A Design Decision: USD Only**

**Currency:**
- All invoices denominated in USD (US Dollars)
- All payment amounts in USD
- No multi-currency support (Phase 25B)

**Rounding Rules:**
- Invoice amounts rounded to 2 decimal places (standard currency precision)
- Example: $0.12345 → $0.12 (banker's rounding)
- Matches billing snapshot rounding (Phase 23: 3 decimals → 2 decimals for invoice)

**Multi-Currency (Deferred to Phase 26+):**
- User-selected currency (EUR, GBP, JPY, etc.)
- Real-time exchange rates
- Currency conversion at invoice finalization time

**Why USD-Only for MVP:**
- Simplicity (no exchange rate API integration)
- Most payment providers charge in USD by default
- Reduces testing complexity (no currency edge cases)

### 6.4 Minimum Charge Amount

**Design Decision: No Minimum (Phase 25B MVP)**

**Rationale:**
- Simplicity (charge any amount, even $0.01)
- Accurate billing (charge exact usage, no artificial minimums)
- Transparent pricing (users see exactly what they used)

**Future Consideration (Phase 25C+):**
- Minimum charge $1.00 (reduces payment processing fees)
- Invoice aggregation (combine multiple small snapshots into single invoice)

**Example Scenarios (Phase 25B MVP):**
- User uses 100 tokens → $0.001 → Invoice for $0.001 created and charged
- User uses 0 tokens → $0.00 → Invoice for $0.00 created (but payment skipped)

**Zero-Dollar Invoice Handling:**
```
if (invoice.totalAmountUSD === 0) {
  invoice.status = 'paid';  // Mark as paid immediately (no payment required)
  invoice.paidAt = new Date();
  // No PaymentAttempt created
}
```

---

## 7. Failure & Retry Semantics

### 7.1 Payment Failure Isolation

**LOCKED INVARIANT:**
Payment failures NEVER affect AI execution.

**Failure Scenarios:**

**Scenario 1: Payment Provider Outage**
```
Time T0: User executes AI request → SUCCESS (execution unaffected)
Time T1: Usage recorded → SUCCESS
Time T2: Billing snapshot created → SUCCESS
Time T3: Invoice created → SUCCESS
Time T4: Payment attempt → FAILURE (provider API unreachable)
Time T5: User executes another AI request → SUCCESS (execution unaffected)
Time T6: Payment retry (30 minutes later) → SUCCESS
```

**Scenario 2: Declined Credit Card**
```
Time T0: User executes AI request → SUCCESS
Time T1: Billing snapshot finalized → Invoice created
Time T2: Payment attempt → FAILURE (card declined)
Time T3: User executes another AI request → SUCCESS (execution unaffected)
Time T4: Payment retry (24 hours later) → FAILURE (card still declined)
Time T5: Invoice status = failed (manual intervention required)
Time T6: User can still execute AI requests (payment issue != service denial)
```

**Enforcement:**
```
QuotaService (Phase 20) checks:
  ✅ Usage against quota limits
  ❌ NOT payment state
  ❌ NOT unpaid invoices

Result: Payment failures do NOT affect quota enforcement
```

### 7.2 Retry Ownership

**Design Decision:**
api-gateway PaymentService owns retry logic (NOT external provider).

**Why Platform-Owned Retries:**
- **Control:** Platform decides when/how often to retry
- **Consistency:** Same retry strategy across all payment providers
- **Auditability:** All retry attempts logged in PaymentAttempt table
- **Determinism:** Retry behavior reproducible in tests

**Retry Strategy (Phase 25B MVP):**
```
Payment attempt 1: Immediate (on invoice finalization)
Payment attempt 2: 30 minutes after failure (if retryable)
Payment attempt 3: 24 hours after attempt 2 (if retryable)
Payment attempt 4: 72 hours after attempt 3 (if retryable)
Max attempts: 4
After max attempts: Invoice status = written_off
```

**Retryable vs Non-Retryable Failures:**

**Retryable (Transient Errors):**
- Payment provider API timeout
- Payment provider 5xx errors
- Network errors
- Rate limit exceeded

**Non-Retryable (Permanent Errors):**
- Card declined (insufficient funds)
- Card expired
- Payment method removed by customer
- Customer account closed

**Retry Logic:**
```typescript
if (paymentResult.retryable && invoice.paymentAttemptCount < MAX_RETRIES) {
  // Schedule retry (background job)
  schedulePaymentRetry(invoice.invoiceId, retryDelay);
} else {
  // Mark invoice as failed (no more retries)
  invoice.status = 'written_off';
}
```

### 7.3 Idempotency Guarantees

**Guarantee 1: No Double-Charging**
```
Invoice status = paid → subsequent payment attempts rejected
  (prevents double-charging if retry job runs after success)
```

**Guarantee 2: Provider-Level Idempotency**
```
Idempotency key = `invoice-${invoiceId}-${attemptCount}`
Provider caches result for 24 hours
Duplicate calls return cached result (no duplicate charge)
```

**Guarantee 3: Concurrent Payment Prevention**
```
Payment attempt in progress (status=pending_payment)
  → Concurrent payment attempt rejected (lock via invoice status)
  → Only one payment attempt active at a time per invoice
```

**Implementation:**
```typescript
async chargeInvoice(invoiceId: string) {
  // Optimistic lock: update status to pending_payment
  const updated = await db.invoice.updateStatus(
    invoiceId,
    { from: 'finalized', to: 'pending_payment' }
  );

  if (!updated) {
    throw new Error('Invoice not in finalized state (concurrent attempt?)');
  }

  // Proceed with payment (no other attempt can start now)
  const result = await paymentProvider.chargeInvoice(...);

  // Update status based on result
  if (result.status === 'succeeded') {
    invoice.status = 'paid';
    invoice.paidAt = new Date();
  } else {
    invoice.status = 'failed';
  }
}
```

### 7.4 Retry Scheduling (Background Jobs)

**Design Decision:**
Retry scheduling via background job system (e.g., BullMQ, Agenda, or database-based cron).

**Job Definition:**
```typescript
Job: PaymentRetryJob {
  jobId: string;
  invoiceId: string;
  attemptNumber: number;
  scheduledAt: Date;
  status: 'pending' | 'completed' | 'failed';
}
```

**Job Execution:**
```typescript
async executePaymentRetryJob(jobId: string) {
  const job = await getJob(jobId);
  const invoice = await getInvoice(job.invoiceId);

  // Check if retry still needed
  if (invoice.status === 'paid') {
    // Payment succeeded elsewhere (e.g., manual retry), skip
    return;
  }

  if (invoice.status === 'pending_payment') {
    // Concurrent payment in progress, skip
    return;
  }

  // Attempt payment
  await paymentService.chargeInvoice(invoice.invoiceId);
}
```

**Deferred Decision (Phase 25B):**
- Use BullMQ (Redis-based) vs database-based cron
- Retry backoff strategy (exponential vs linear)
- Max retry duration (7 days vs 30 days)

---

## 8. Security & Privacy Guarantees

### 8.1 No Prompt or Response Content

**LOCKED INVARIANT:**
Payment system NEVER accesses prompt/response content.

**Data Flows (Privacy-Preserving):**
```
Phase 12-21: Execution (prompts/responses)
  → Phase 22: UsageRecord (NO prompts/responses, only metadata: tokens, model, timestamp)
  → Phase 23: BillingSnapshot (NO prompts/responses, only costs: totalTokens, totalCostUSD)
  → Phase 25: Invoice (NO prompts/responses, only amounts: totalAmountUSD, lineItems)

Privacy guarantee: Prompts/responses NEVER leave ai-service execution context
```

**Invoice Content (Privacy-Safe):**
```typescript
Invoice {
  ✅ snapshotId, apiKeyId, userId (identity)
  ✅ periodStart, periodEnd (time window)
  ✅ totalAmountUSD (amount to charge)
  ✅ lineItems[] (provider, model, tokens, requests, amountUSD)

  ❌ NO prompt content
  ❌ NO response content
  ❌ NO conversation history
  ❌ NO executionId (internal identifier only)
}
```

**Payment Provider Data (Privacy-Safe):**
```
Data sent to payment provider (e.g., Stripe):
  ✅ customerId (Stripe customer ID)
  ✅ amount (e.g., $15.75)
  ✅ description (e.g., "AI Sandbox Usage: Feb 2026")
  ✅ invoiceId (reference for audit trail)

  ❌ NO prompt content
  ❌ NO response content
  ❌ NO usage details beyond high-level description
```

### 8.2 No Payment Data in ai-service

**LOCKED INVARIANT:**
ai-service remains completely unaware of payment system.

**Enforcement:**
```
ai-service has ZERO dependencies on:
  ❌ InvoiceService
  ❌ PaymentService
  ❌ Invoice entity
  ❌ PaymentAttempt entity
  ❌ Payment provider SDK

ai-service returns AIExecutionResult (unchanged from Phase 12B)
  → api-gateway records usage (Phase 22)
  → Billing/payment happen asynchronously (Phase 23/25)
```

**Why This Matters:**
- ai-service remains focused on execution quality
- Payment logic changes do NOT affect ai-service
- ai-service can be deployed/tested independently of payment system

### 8.3 Token Usage as Source-of-Truth

**LOCKED INVARIANT:**
Token counts in UsageRecord (Phase 22) remain authoritative.

**Guarantee:**
```
Payment system does NOT recalculate tokens:
  ✅ Invoice.lineItems[].totalTokens = BillingSnapshot.lineItems[].totalTokens
  ✅ Invoice.totalAmountUSD = BillingSnapshot.totalCostUSD

  ❌ Payment system does NOT query ai-service for token counts
  ❌ Payment system does NOT query usage_records for raw data
  ❌ Payment system does NOT recalculate costs
```

**Audit Trail:**
```
execution → UsageRecord.tokenCount (source-of-truth)
  → BillingSnapshot.totalTokens (aggregated)
  → Invoice.lineItems[].totalTokens (copied)
  → Payment amount based on Invoice.totalAmountUSD

Any discrepancy investigation starts at UsageRecord
  (payment/invoice are downstream, not authoritative)
```

### 8.4 PCI Compliance (Out-of-Scope for Platform)

**Design Decision:**
Platform does NOT store credit card data (PCI-DSS scope minimization).

**Payment Method Storage:**
```
api-gateway stores:
  ✅ userId → providerCustomerId (e.g., Stripe customer ID)
  ✅ apiKeyId → providerPaymentMethodId (e.g., Stripe payment method ID)

  ❌ NO credit card numbers
  ❌ NO CVV codes
  ❌ NO card expiration dates

Payment provider (Stripe) stores actual card data
  → Platform references provider IDs only
```

**Payment Method Setup (User Flow):**
```
1. User clicks "Add Payment Method" in UI
2. Frontend loads Stripe.js (client-side tokenization)
3. User enters card details (NEVER sent to api-gateway)
4. Stripe.js tokenizes card → returns paymentMethodToken
5. Frontend sends paymentMethodToken to api-gateway
6. api-gateway calls Stripe API: attachPaymentMethod(customerId, paymentMethodToken)
7. Stripe returns paymentMethodId (e.g., "pm_xyz123")
8. api-gateway stores: apiKeyId → "pm_xyz123"
```

**Result:**
- Platform NEVER sees raw card data
- PCI compliance is payment provider's responsibility
- Platform security scope minimized

---

## 9. Auditability

### 9.1 Traceability Chain

**Complete Audit Trail:**
```
executionId (Phase 12-21)
  ↓
usageRecordId (Phase 22: usage_records.id)
  ↓
snapshotId (Phase 23: billing_snapshots.snapshot_id)
  ↓
invoiceId (Phase 25: invoices.invoice_id)
  ↓
paymentAttemptId (Phase 25: payment_attempts.id)
  ↓
providerPaymentIntentId (External provider: Stripe payment intent)
```

**Lookup Queries:**

**Q: What was charged for execution X?**
```sql
SELECT i.invoiceId, i.totalAmountUSD, i.status, i.paidAt
FROM executions e
JOIN usage_records u ON u.execution_id = e.execution_id
JOIN billing_snapshots s ON s.snapshot_id = (
  SELECT snapshot_id FROM billing_views WHERE usage_record_id = u.id
)
JOIN invoices i ON i.snapshot_id = s.snapshot_id
WHERE e.execution_id = 'exec_xyz';
```

**Q: What usage contributed to invoice Y?**
```sql
SELECT u.execution_id, u.provider, u.model, u.token_count, u.created_at
FROM invoices i
JOIN billing_snapshots s ON s.snapshot_id = i.snapshot_id
JOIN billing_views bv ON bv.snapshot_id = s.snapshot_id
JOIN usage_records u ON u.id = bv.usage_record_id
WHERE i.invoice_id = 'inv_abc';
```

**Q: How many payment attempts for invoice Y?**
```sql
SELECT pa.id, pa.attempt_number, pa.status, pa.failure_reason, pa.created_at
FROM payment_attempts pa
WHERE pa.invoice_id = 'inv_abc'
ORDER BY pa.attempt_number ASC;
```

### 9.2 Deterministic Replay

**Guarantee:**
Given the same BillingSnapshot, invoice generation produces identical result.

**Replay Procedure:**
```
1. Identify snapshotId for investigation
2. Query billing_snapshots WHERE snapshot_id = :snapshotId
3. Run: InvoiceService.createInvoiceFromSnapshot(snapshotId, dryRun=true)
4. Compare generated invoice with actual invoice
5. If mismatch: investigate InvoiceService logic for bugs
```

**Why This Matters:**
- Billing disputes: can reproduce invoice from snapshot
- Compliance audits: prove invoices match usage
- Regression testing: verify invoice generation correctness

### 9.3 Payment Attempt Logging

**PaymentAttempt Entity:**
```typescript
PaymentAttempt {
  id: string;                     // UUID, unique identifier
  invoiceId: string;              // Which invoice this attempt is for
  attemptNumber: number;          // 1, 2, 3, ... (increments on retry)
  status: 'pending' | 'succeeded' | 'failed';
  amountUSD: number;              // Amount attempted (should match invoice total)
  providerPaymentIntentId: string | null; // Provider's payment ID (e.g., Stripe PI)
  failureReason: string | null;   // Error message if failed
  retryable: boolean;             // Was this failure retryable?
  idempotencyKey: string;         // Idempotency key used for this attempt
  createdAt: Date;                // When attempt was initiated
  completedAt: Date | null;       // When attempt completed (success or failure)
}
```

**Audit Queries:**

**Q: How many failed payment attempts today?**
```sql
SELECT COUNT(*) FROM payment_attempts
WHERE status = 'failed' AND DATE(created_at) = CURRENT_DATE;
```

**Q: What's the average retry count before success?**
```sql
SELECT AVG(attempt_number) FROM payment_attempts
WHERE status = 'succeeded' AND attempt_number > 1;
```

**Q: Which invoices have exceeded max retries?**
```sql
SELECT i.invoice_id, i.api_key_id, i.total_amount_usd, COUNT(pa.id) AS attempt_count
FROM invoices i
JOIN payment_attempts pa ON pa.invoice_id = i.invoice_id
WHERE i.status = 'written_off'
GROUP BY i.invoice_id
HAVING COUNT(pa.id) >= 4;
```

### 9.4 Immutable Audit Log

**Design Decision:**
PaymentAttempt records are append-only (never updated or deleted).

**Enforcement:**
```typescript
// PaymentAttempt entity has NO update methods
class PaymentAttemptService {
  create(attempt: PaymentAttempt): Promise<void>;  // ✅ Allowed
  findById(id: string): Promise<PaymentAttempt>;    // ✅ Allowed
  findByInvoiceId(id: string): Promise<PaymentAttempt[]>; // ✅ Allowed

  // ❌ NO update method
  // ❌ NO delete method
}
```

**Why Immutability:**
- Audit trail integrity (no tampering with payment history)
- Compliance (regulators expect immutable financial logs)
- Debugging (can see all retry attempts, even after success)

---

## 10. Architecture Diagrams (Textual)

### 10.1 Payment Flow Overview

```
┌──────────────────────────────────────────────────────────────────┐
│ EXECUTION & BILLING (Phase 12-23) — NO CHANGES                  │
│ ---------------------------------------------------------------- │
│ Client Request → Auth → Authz → Quota → ai-service Execute      │
│   → AIExecutionResult → UsageRecord → BillingSnapshot           │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓ (finalized snapshots only)
┌──────────────────────────────────────────────────────────────────┐
│ PAYMENT COLLECTION (Phase 25: THIS DESIGN)                      │
│ ---------------------------------------------------------------- │
│                                                                  │
│ BillingSnapshot (status=finalized)                              │
│   ↓                                                              │
│ InvoiceService.createInvoiceFromSnapshot(snapshotId)            │
│   → Invoice created (state=draft)                               │
│   → Invoice.finalize() (state=finalized)                        │
│   ↓                                                              │
│ PaymentService.chargeInvoice(invoiceId)                         │
│   → Invoice.status = pending_payment                            │
│   → PaymentProvider.chargeInvoice(customerId, amount)           │
│   → External Provider (Stripe API call)                         │
│   ↓                                                              │
│ Payment Result:                                                  │
│   • Success → Invoice.status = paid, Invoice.paidAt = now       │
│   • Failure (retryable) → Invoice.status = failed, schedule retry│
│   • Failure (non-retryable) → Invoice.status = written_off      │
│   ↓                                                              │
│ PaymentAttempt logged (immutable audit record)                  │
│                                                                  │
│ NEVER writes to billing_snapshots                               │
│ NEVER modifies usage_records                                    │
│ NEVER affects execution flow                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 10.2 Service Ownership

```
┌─────────────────────────────────────────────────────────────────┐
│ api-gateway (Billing & Payment Owner)                           │
│ ----------------------------------------------------------------│
│                                                                 │
│ BillingService (Phase 23)                                       │
│   → Creates BillingSnapshots from UsageRecords                  │
│   → Finalizes snapshots (status = finalized)                    │
│                                                                 │
│ InvoiceService (Phase 25: NEW)                                  │
│   → Reads finalized BillingSnapshots                            │
│   → Creates Invoices (one per snapshot)                         │
│   → Manages invoice lifecycle (draft → finalized → paid)        │
│                                                                 │
│ PaymentService (Phase 25: NEW)                                  │
│   → Initiates payment via PaymentProviderInterface              │
│   → Tracks PaymentAttempts (success/failure)                    │
│   → Schedules retries (if failure retryable)                    │
│                                                                 │
│ PaymentProviderInterface (Phase 25: NEW)                        │
│   → Abstraction over external provider (Stripe, etc.)           │
│   → Implementations: StripePaymentProvider, StubPaymentProvider │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ai-service (Execution Owner) — NO CHANGES                       │
│ ----------------------------------------------------------------│
│                                                                 │
│ ❌ NO payment awareness                                         │
│ ❌ NO invoice awareness                                         │
│ ❌ NO payment provider dependencies                             │
│                                                                 │
│ Returns AIExecutionResult (unchanged from Phase 12B)            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ External Payment Provider (e.g., Stripe)                        │
│ ----------------------------------------------------------------│
│                                                                 │
│ Stores customer payment methods (credit cards)                  │
│ Processes payment transactions                                  │
│ Returns payment success/failure status                          │
│ Provides idempotency guarantees (24-hour cache)                 │
│                                                                 │
│ ❌ NO access to ai-sandbox platform database                    │
│ ❌ NO webhooks required for core correctness (Phase 25B)        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 Invoice State Machine (Detailed)

```
                    ┌──────────┐
                    │  draft   │ (Invoice created, not ready for payment)
                    └────┬─────┘
                         │ finalize()
                         ↓
                    ┌──────────┐
                    │finalized │ (Invoice immutable, ready for payment)
                    └────┬─────┘
                         │ chargeInvoice()
                         ↓
                ┌────────────────┐
                │pending_payment │ (Payment in progress)
                └────────┬───────┘
                         │
         ┌───────────────┼───────────────┐
         │ (success)     │ (failure)     │
         ↓               ↓               ↓
    ┌────────┐      ┌────────┐     ┌────────────┐
    │  paid  │      │ failed │     │written_off │
    │(TERM.) │      └───┬────┘     │  (TERM.)   │
    └────────┘          │           └────────────┘
                        │ retry (if retryable && attempts < max)
                        │
                        └──────────────┐
                                       ↓
                                ┌────────────────┐
                                │pending_payment │ (Retry attempt)
                                └────────────────┘
                                       │
                           ┌───────────┼───────────┐
                           │           │           │
                           ↓           ↓           ↓
                        (paid)      (failed)  (written_off)

TERMINAL STATES (no further transitions):
  • paid (success, no more action needed)
  • written_off (max retries exceeded, manual intervention required)

RETRY LIMIT:
  • Max 4 payment attempts
  • After 4th failure: status = written_off
```

### 10.4 Data Model Relationships

```
┌──────────────────────────────────────────────────────────────────┐
│ billing_snapshots (Phase 23) — IMMUTABLE                         │
├──────────────────────────────────────────────────────────────────┤
│ snapshot_id (PK)                                                 │
│ api_key_id                                                       │
│ user_id                                                          │
│ period_start, period_end                                         │
│ total_cost_usd                                                   │
│ line_items (JSON)                                                │
│ status (draft | finalized)                                       │
└────────────────┬─────────────────────────────────────────────────┘
                 │ 1:1
                 ↓
┌──────────────────────────────────────────────────────────────────┐
│ invoices (Phase 25) — MUTABLE (status transitions)              │
├──────────────────────────────────────────────────────────────────┤
│ invoice_id (PK)                                                  │
│ snapshot_id (FK → billing_snapshots.snapshot_id) UNIQUE          │
│ api_key_id                                                       │
│ user_id                                                          │
│ period_start, period_end                                         │
│ total_amount_usd (copied from snapshot.total_cost_usd)           │
│ line_items (JSON, copied from snapshot.line_items)              │
│ status (draft | finalized | pending_payment | paid | failed | written_off) │
│ created_at, finalized_at, paid_at                                │
│ payment_attempt_count                                            │
└────────────────┬─────────────────────────────────────────────────┘
                 │ 1:N
                 ↓
┌──────────────────────────────────────────────────────────────────┐
│ payment_attempts (Phase 25) — APPEND-ONLY                       │
├──────────────────────────────────────────────────────────────────┤
│ id (PK)                                                          │
│ invoice_id (FK → invoices.invoice_id)                            │
│ attempt_number (1, 2, 3, 4)                                      │
│ status (pending | succeeded | failed)                            │
│ amount_usd                                                       │
│ provider_payment_intent_id (e.g., Stripe PI ID)                  │
│ failure_reason (if failed)                                       │
│ retryable (boolean)                                              │
│ idempotency_key                                                  │
│ created_at, completed_at                                         │
└──────────────────────────────────────────────────────────────────┘

RELATIONSHIPS:
  • 1 BillingSnapshot → 1 Invoice (enforced by UNIQUE constraint on snapshot_id)
  • 1 Invoice → N PaymentAttempts (1 per attempt, max 4)

IMMUTABILITY:
  • BillingSnapshot: immutable after status=finalized
  • Invoice line items: immutable after status=finalized
  • Invoice status: mutable (state transitions)
  • PaymentAttempt: fully immutable (append-only)
```

---

## 11. Responsibility Ownership Table

| Responsibility | Owner | Phase | Notes |
|----------------|-------|-------|-------|
| **AI Execution** | ai-service | 12-21 | LOCKED: NO payment awareness |
| **Usage Recording** | api-gateway (UsageLedgerService) | 22 | LOCKED: append-only, immutable |
| **Billing Calculation** | api-gateway (BillingService) | 23 | LOCKED: snapshot creation, cost calculation |
| **Billing Visibility** | api-gateway (BillingVisibilityService) | 24 | LOCKED: read-only queries |
| **Invoice Creation** | api-gateway (InvoiceService) | 25 | NEW: converts snapshots → invoices |
| **Payment Initiation** | api-gateway (PaymentService) | 25 | NEW: calls payment provider API |
| **Payment Retry Logic** | api-gateway (PaymentService) | 25 | NEW: schedules retries, tracks attempts |
| **Payment Provider Integration** | api-gateway (PaymentProviderInterface) | 25 | NEW: abstraction over Stripe/etc. |
| **Payment Method Storage** | External Provider (Stripe) | N/A | Provider stores card data (not platform) |
| **Payment Processing** | External Provider (Stripe) | N/A | Provider charges customer (not platform) |
| **PCI Compliance** | External Provider (Stripe) | N/A | Provider handles card data (not platform) |
| **Audit Trail** | api-gateway (PaymentAttempt logging) | 25 | NEW: immutable payment attempt log |
| **Invoice State Machine** | api-gateway (InvoiceService) | 25 | NEW: draft → finalized → paid/failed/written_off |
| **Quota Enforcement** | api-gateway (QuotaService) | 20 | LOCKED: usage-based, NOT payment-based |
| **Authentication** | api-gateway (ApiKeyAuthGuard) | 20 | LOCKED: NO payment checks |
| **Authorization** | api-gateway (AuthorizationGuard) | 20 | LOCKED: NO payment checks |

**Key Ownership Principles:**
- **api-gateway** owns all billing and payment logic
- **ai-service** remains execution-focused (no payment awareness)
- **External provider** handles actual money movement and card storage
- **Payment failures** do NOT affect execution, quota, or billing calculation

---

## 12. Failure Scenarios & Isolation

### 12.1 Scenario: Payment Provider Outage

**Timeline:**
```
T0: User executes AI request → SUCCESS (execution proceeds normally)
T1: Usage recorded → SUCCESS
T2: Billing snapshot created → SUCCESS
T3: Billing snapshot finalized → SUCCESS
T4: Invoice created → SUCCESS
T5: PaymentService.chargeInvoice() called → External provider API unreachable
T6: Payment attempt fails (retryable error)
T7: PaymentAttempt logged (status=failed, retryable=true)
T8: Retry scheduled (30 minutes later)
T9: User executes another AI request → SUCCESS (execution unaffected)
T10: Retry attempt (30 min later) → Provider API still unreachable
T11: Second retry scheduled (24 hours later)
T12: Second retry → SUCCESS (provider recovered)
T13: Invoice.status = paid
```

**Isolation Guarantees:**
- ✅ Execution continues during provider outage (T9)
- ✅ Billing snapshot remains accurate (no modification)
- ✅ Invoice retries automatically (no manual intervention)
- ✅ Payment eventually succeeds (persistent retry)

### 12.2 Scenario: Declined Credit Card

**Timeline:**
```
T0: User executes AI requests throughout February
T1: End of month: Billing snapshot finalized ($50.00)
T2: Invoice created ($50.00)
T3: Payment attempt → FAILURE (card declined, insufficient funds)
T4: PaymentAttempt logged (status=failed, retryable=false, reason="card_declined")
T5: Invoice.status = failed (no retry, non-retryable error)
T6: User executes AI request on March 1 → SUCCESS (execution unaffected)
T7: Email notification sent to user: "Payment failed, please update payment method"
T8: User updates payment method in UI
T9: Admin triggers manual payment retry → SUCCESS
T10: Invoice.status = paid
```

**Isolation Guarantees:**
- ✅ Execution continues after payment failure (T6)
- ✅ User can execute AI requests with unpaid invoice (not service denial)
- ✅ Billing snapshot unchanged (remains source-of-truth)
- ✅ Manual retry possible (admin can force retry after user fixes payment method)

### 12.3 Scenario: Concurrent Payment Attempts

**Timeline:**
```
T0: Invoice finalized (status=finalized)
T1: Background job 1 picks up invoice for payment
T2: Job 1 updates invoice.status = pending_payment (optimistic lock acquired)
T3: Background job 2 picks up same invoice (due to scheduling bug)
T4: Job 2 attempts to update invoice.status = pending_payment → FAILURE (status not finalized)
T5: Job 2 exits (concurrent attempt detected, no action taken)
T6: Job 1 completes payment → SUCCESS
T7: Invoice.status = paid
```

**Isolation Guarantees:**
- ✅ Only one payment attempt active at a time (optimistic lock)
- ✅ No double-charging (concurrent attempt rejected)
- ✅ Idempotency preserved

### 12.4 Scenario: Invoice Already Paid

**Timeline:**
```
T0: Invoice paid successfully (status=paid)
T1: Retry job incorrectly scheduled (due to bug)
T2: Retry job executes PaymentService.chargeInvoice(invoiceId)
T3: Service checks invoice.status → PAID
T4: Service rejects payment attempt (invoice already paid)
T5: No payment provider API call made (short-circuit)
T6: Retry job exits (no action taken)
```

**Isolation Guarantees:**
- ✅ No double-charging (invoice status checked before payment)
- ✅ Idempotency preserved (paid invoices cannot be charged again)

### 12.5 Scenario: Max Retries Exceeded

**Timeline:**
```
T0: Invoice created ($10.00)
T1: Payment attempt 1 → FAILURE (retryable: provider timeout)
T2: Payment attempt 2 (30 min later) → FAILURE (retryable: provider timeout)
T3: Payment attempt 3 (24 hours later) → FAILURE (retryable: provider timeout)
T4: Payment attempt 4 (72 hours later) → FAILURE (retryable: provider timeout)
T5: Max retries exceeded (4 attempts)
T6: Invoice.status = written_off
T7: Admin notification: "Invoice written off, manual intervention required"
T8: User can still execute AI requests (execution unaffected)
T9: Admin reviews invoice, contacts user for alternative payment
```

**Isolation Guarantees:**
- ✅ Execution unaffected by payment failures (T8)
- ✅ Invoice not deleted (preserved for audit/manual collection)
- ✅ Clear terminal state (written_off = no more automatic retries)

---

## 13. Assumptions & Deferred Decisions

### 13.1 Assumptions

**Assumption 1: External Payment Provider Available**
- Platform integrates with Stripe-like API
- Provider handles PCI compliance (card data storage)
- Provider provides idempotency guarantees (24-hour key cache)

**Assumption 2: One Payment Method per API Key**
- Each apiKeyId has at most one active payment method
- User can update payment method (replaces previous)
- No multiple payment methods per user (deferred to Phase 26+)

**Assumption 3: Postpaid Model Only (Phase 25B)**
- Users charged after usage occurs (not upfront)
- No prepaid credits or wallet system (deferred to Phase 26+)
- No real-time balance checks during execution

**Assumption 4: USD Currency Only (Phase 25B)**
- All invoices denominated in US Dollars
- No multi-currency support (deferred to Phase 26+)
- No exchange rate handling

**Assumption 5: Automatic Charging (Phase 25B)**
- Invoices charged immediately after finalization
- No manual admin approval required (deferred to Phase 25C+)
- No delayed charging or payment terms (e.g., net-30)

**Assumption 6: No Minimum Charge**
- Invoices can be $0.01 or less
- Zero-dollar invoices marked as paid immediately (no payment attempt)
- No invoice aggregation (each snapshot = one invoice)

**Assumption 7: Background Jobs for Retries**
- Retry scheduling via background job system (BullMQ or database-based)
- Jobs are reliable (at-least-once delivery)
- Jobs handle idempotency (duplicate jobs do not double-charge)

**Assumption 8: No Webhooks Required (Phase 25B)**
- Platform polls payment status if needed (synchronous or short polling)
- Webhooks optional for Phase 25C+ (async notifications)
- Core correctness does not depend on webhook delivery

### 13.2 Deferred Decisions

**Deferred to Phase 25B (Implementation):**
- Specific payment provider (Stripe vs PayPal vs other)
- Database schema details (table definitions, indexes)
- Background job system choice (BullMQ vs Agenda vs database-based)
- Retry backoff strategy (exponential vs linear)
- Max retry duration (7 days vs 30 days vs other)
- Payment method setup UI flow (frontend implementation)
- Email notification templates (payment success, failure, etc.)

**Deferred to Phase 25C+ (Advanced Features):**
- Manual charging (admin approval before payment)
- Multiple payment methods per user
- Payment method priority (fallback to secondary card)
- Invoice aggregation (combine multiple snapshots into one invoice)
- Minimum charge amount ($1.00 threshold)
- Payment terms (net-30, net-60, etc.)
- Dunning workflows (escalating reminders for unpaid invoices)
- Refunds (full or partial)
- Credits (apply credits to invoices)
- Discounts (promo codes, volume discounts)
- Chargebacks and disputes
- Webhooks (async payment status updates)
- Multi-currency support (EUR, GBP, JPY, etc.)
- Tax handling (VAT, sales tax, etc.)
- Invoice PDF generation
- Invoice delivery (email invoices to users)

**Deferred to Phase 26+ (Prepaid / Credits):**
- Prepaid credits system (wallet)
- Real-time balance tracking during execution
- Auto-reload (automatically add funds when balance low)
- Prepaid vs postpaid toggle (user preference)

---

## 14. Explicit Non-Goals

### 14.1 No Payment Implementation (Phase 25A)

**❌ NOT Implemented in Phase 25A:**
- No InvoiceService code
- No PaymentService code
- No Invoice entity
- No PaymentAttempt entity
- No database migrations
- No Stripe SDK integration
- No payment provider API calls
- No background job setup

**Rationale:** Phase 25A is design-only (implementation is Phase 25B).

### 14.2 No Stripe SDK Integration

**❌ NOT Implemented in Phase 25B:**
- Stripe SDK dependency (added in Phase 25B)
- Stripe API calls (implemented in Phase 25B)
- Stripe webhook endpoint (deferred to Phase 25C+)
- Stripe customer creation (implemented in Phase 25B)
- Stripe payment method attachment (implemented in Phase 25B)

**Rationale:** Design defines abstraction (PaymentProviderInterface), implementation chooses provider.

### 14.3 No Webhook Handling

**❌ NOT Implemented in Phase 25B:**
- Webhook endpoint (POST /api/webhooks/stripe)
- Webhook signature validation
- Webhook event processing (payment.succeeded, payment.failed, etc.)
- Webhook idempotency (prevent duplicate event processing)

**Rationale:** Core correctness does not require webhooks (platform polls status if needed). Webhooks deferred to Phase 25C+ for async notifications.

### 14.4 No Refunds

**❌ NOT Implemented in Phase 25B:**
- Refund API (POST /api/invoices/:id/refund)
- Partial refunds (refund $5.00 of $10.00 invoice)
- Refund reasons (user request, billing error, etc.)
- Refund audit trail (who issued refund, when, why)

**Rationale:** Refunds are Phase 25C+ feature (requires admin UI, workflows, etc.).

### 14.5 No Charge Disputes

**❌ NOT Implemented in Phase 25B or 25C:**
- Dispute handling (customer disputes charge with bank)
- Dispute evidence upload (prove usage occurred)
- Dispute resolution (win/lose outcome)
- Chargeback fee tracking

**Rationale:** Disputes are payment provider responsibility (Stripe handles dispute workflows).

### 14.6 No Taxes or VAT

**❌ NOT Implemented in Phase 25B:**
- Tax calculation (sales tax, VAT, GST, etc.)
- Tax rate lookup by region (US state, EU country, etc.)
- Tax-inclusive vs tax-exclusive pricing
- Tax reporting (1099 forms, VAT returns, etc.)

**Rationale:** Tax handling is Phase 26+ feature (complex, region-specific, requires legal review).

### 14.7 No Invoices Exposed to Users

**❌ NOT Implemented in Phase 25B:**
- GET /api/invoices (list user's invoices)
- GET /api/invoices/:id (view single invoice)
- Invoice PDF generation
- Invoice email delivery

**Rationale:** Invoice visibility is Phase 25C+ feature (Phase 25B focuses on payment collection backend only).

### 14.8 No UI or Dashboards

**❌ NOT Implemented in Phase 25A or 25B:**
- Payment method management UI (add/remove cards)
- Invoice list UI (view unpaid invoices)
- Payment history UI (view past payments)
- Admin dashboard (view failed payments, written-off invoices, etc.)

**Rationale:** UI is Phase 26+ feature (Phase 25B is backend-only).

### 14.9 No Execution Blocking on Payment State

**❌ NOT Implemented (EVER):**
- Block AI execution if user has unpaid invoices
- Block AI execution if payment method missing
- Block AI execution if payment failed

**Rationale:** LOCKED INVARIANT—execution independence preserved.

**Future Soft Limits (Phase 26+):**
- Warning message if unpaid invoices exist (user informed, NOT blocked)
- Account suspension if admin manually disables account (explicit action, NOT automatic)

---

## 15. Safe Resume Point

### 15.1 Phase 25A Status

**Status:** DESIGN COMPLETE

**Completion Criteria Met:**
- ✅ Payment responsibility boundaries defined
- ✅ Invoice lifecycle (state machine) defined
- ✅ Relationship: BillingSnapshot → Invoice defined
- ✅ Payment provider abstraction designed
- ✅ Charging model (postpaid, automatic) selected
- ✅ Failure & retry semantics defined
- ✅ Security & privacy guarantees documented
- ✅ Auditability (traceability chain) defined
- ✅ Architecture diagrams (textual) provided
- ✅ Responsibility ownership table complete
- ✅ Failure scenarios & isolation documented
- ✅ Assumptions & deferred decisions listed
- ✅ Explicit non-goals documented

**Design Readiness:** Phase 25A design is complete and ready for implementation (Phase 25B).

### 15.2 Next Allowable Phase

**Phase 25B: Payments Implementation**

**Scope:**
- Implement InvoiceService (convert snapshots → invoices)
- Implement PaymentService (initiate payments, track attempts)
- Implement PaymentProviderInterface (abstraction)
- Implement StripePaymentProvider (Stripe SDK integration)
- Implement StubPaymentProvider (testing/development stub)
- Create Invoice entity (TypeORM)
- Create PaymentAttempt entity (TypeORM)
- Write unit tests (InvoiceService, PaymentService)
- Write integration tests (end-to-end payment flow)
- Setup background jobs (retry scheduling)

**Prerequisites:**
- ✅ Phase 25A (COMPLETE)
- ✅ Phase 23B-4 (billing snapshots exist)
- ✅ Phase 24B (billing visibility exists, optional)

**Unlocks:**
- Phase 25C (Advanced Payment Features: refunds, credits, manual charging)
- Phase 26 (User-Facing Invoices & Dashboards)

**Recommended Next Step:** Phase 25B (Payments Implementation).

### 15.3 Phase 25A Lock Policy

**Phase 25A Design Must NOT Be Modified Without:**
1. Explicit user approval to reopen Phase 25A
2. Updated ARCHITECTURE.md (if architectural changes required)
3. Updated PRD.md (if scope changes required)
4. New Phase 25A-REVISION checkpoint

**Safe Clarifications (No Reopening Required):**
- Clarifying ambiguous design decisions
- Adding examples or diagrams
- Fixing typos or formatting

**Unsafe Modifications (Reopening Required):**
- Changing invoice state machine (adding/removing states)
- Changing failure isolation guarantees
- Adding new payment models (prepaid, credits, etc.)
- Violating locked invariants (execution independence, etc.)

---

## ULTRA-BRIEF SUMMARY

• **Phase 25A designs Payments Architecture for AI Sandbox Platform** with complete separation from execution (payment failures NEVER block AI requests), billing calculation (snapshots remain immutable), and privacy (no prompt/response content in payment system), enabling money collection via external provider (Stripe-like) while preserving all locked invariants from Phase 12-24

• **Invoice lifecycle converts finalized BillingSnapshots into chargeable Invoices** with state machine (draft → finalized → pending_payment → paid/failed/written_off), one-to-one snapshot-to-invoice mapping enforced by unique constraint, immutable line items after finalization, and deterministic replay capability (same snapshot always produces identical invoice)

• **Payment provider abstraction enables Stripe-like integration** via one-way push flow (platform initiates all payment actions, no webhooks required for core correctness), idempotency guarantees (invoice-level and provider-level), and interface-based design (PaymentProviderInterface with StripePaymentProvider and StubPaymentProvider implementations) enabling future provider swapping

• **Postpaid automatic charging model with robust retry semantics** charges users after usage occurs (not upfront), initiates payment immediately on invoice finalization, retries transient failures up to 4 attempts (30 min, 24 hours, 72 hours), transitions to written_off state after max retries, and logs all attempts in append-only PaymentAttempt entity for complete audit trail

• **Complete failure isolation and auditability preserved** with execution proceeding regardless of payment state (provider outages, declined cards, unpaid invoices do NOT affect AI service availability), traceability chain from executionId → usageRecordId → snapshotId → invoiceId → paymentAttemptId → providerPaymentIntentId, and privacy guarantees maintained (no card data stored in platform, no prompt/response content in payment system, PCI compliance is provider responsibility)

---

**END OF PHASE 25A DESIGN**
