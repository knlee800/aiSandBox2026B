# PHASE 25B-3 DESIGN: Webhooks + Reconciliation

**Phase:** 25B-3
**Nature:** DESIGN ONLY (No Implementation)
**Scope:** api-gateway only
**Status:** DESIGN COMPLETE
**Date:** 2026-02-07
**Prerequisite:** Phase 25B-2 (Payment Attempt System) COMPLETE, Phase 25B-1 (Invoice Persistence) COMPLETE, Phase 25A (Payments Design) COMPLETE
**Next Phase:** Phase 25B-3-IMPL (Webhook Implementation)

---

## 1. Phase Overview

### 1.1 What Phase 25B-3 Defines

Phase 25B-3 establishes the design for **Webhooks + Reconciliation**—the mechanism responsible for receiving asynchronous payment status updates from external payment providers (e.g., Stripe) and deterministically updating PaymentAttempt and Invoice state while maintaining complete isolation from AI execution.

**Core Achievement:**
A webhook ingestion layer that:
- Receives provider payment events via public HTTP endpoint
- Validates event authenticity (signature verification)
- Enforces exactly-once processing (idempotency)
- Deterministically reconciles PaymentAttempt + Invoice state
- Handles out-of-order and duplicate events gracefully
- Maintains complete isolation from AI execution
- Provides append-only audit trail for all webhook events

**Key Architectural Principle:**
Webhook processing is **asynchronous, idempotent, and isolated**—provider webhooks update payment state independently of execution flow, webhook failures NEVER affect AI execution, and all state transitions are deterministic (same event stream always produces same final state).

### 1.2 Why Webhooks are Separated from Synchronous Payment Flow

**Critical Design Decision:**
Phase 25B-3 adds **asynchronous webhook reconciliation** as complement to synchronous payment execution (Phase 25B-2).

**Rationale:**
- **Async Completion:** Some payment methods settle asynchronously (provider may return 'pending', finalize later)
- **Reliability:** Webhooks provide authoritative status updates even if synchronous API call times out
- **Provider-Driven:** Provider pushes updates (don't need to poll for status)
- **Conflict Resolution:** Webhook can correct stale state if synchronous flow missed an update
- **Audit Trail:** All provider events logged for dispute resolution and debugging

**Clear Boundary:**
```
Phase 25B-2: Platform → Provider (synchronous charge API call)
Phase 25B-3: Provider → Platform (asynchronous webhook status update) — THIS
```

**Interaction:**
```
Synchronous flow creates PaymentAttempt (status='pending')
  → Provider processes payment asynchronously
  → Provider sends webhook (payment.succeeded / payment.failed)
  → Webhook updates PaymentAttempt status
  → Invoice status transitions accordingly
```

---

## 2. Locked Guarantees (CRITICAL)

### 2.1 Execution Isolation (IMMUTABLE)

**LOCKED INVARIANT:**
Webhook processing NEVER affects AI execution.

**Enforcement:**
```
AI Execution Flow (Phase 12-21):
  Client Request → Auth → Authz → Quota → ai-service Execute → AIExecutionResult
  ❌ NO dependency on webhook processing
  ❌ NO dependency on payment provider uptime
  ❌ NO checks of webhook event state

Webhook Flow (Phase 25B-3):
  Provider → Webhook Endpoint → Validate → Persist Event → Reconcile State
  ❌ NO writes to ai-service
  ❌ NO writes to usage_records
  ❌ NO writes to billing_snapshots
  ❌ NO quota enforcement changes
```

**Guarantee:**
- Webhook endpoint downtime → AI execution unaffected
- Webhook processing errors → AI execution unaffected
- Provider webhook delivery delays → AI execution unaffected
- Invalid webhook signatures → AI execution unaffected

### 2.2 Immutability Guarantees (IMMUTABLE)

**BillingSnapshot Immutability:**
```
Webhooks have ZERO write access to billing_snapshots table.
```

**Invoice Amount Immutability:**
```
Invoice.totalCostUSD, Invoice.lineItems[], Invoice.periodStart/periodEnd
  → FROZEN after creation
  → Webhooks CANNOT modify these fields
```

**Mutable Invoice Fields (Webhooks Allowed to Update):**
```
Invoice.status (state transitions: pending_payment → paid/failed/written_off)
Invoice.paidAt (timestamp when payment succeeded)
Invoice.paymentAttemptCount (incremented per attempt, but webhooks do NOT increment)
Invoice.lastPaymentAttemptAt (updated per attempt, but webhooks do NOT update)
```

**PaymentAttempt Status Mutability:**
```
PaymentAttempt.status (pending → succeeded/failed)
PaymentAttempt.failureCode, PaymentAttempt.failureMessage (set on failure)
PaymentAttempt.retryable (set on failure)
PaymentAttempt.completedAt (set when terminal state reached)
PaymentAttempt.providerReferenceId (may be null initially, set by webhook)
```

**PaymentAttempt Immutable Fields:**
```
PaymentAttempt.paymentAttemptId (never changes)
PaymentAttempt.invoiceId (never changes)
PaymentAttempt.attemptNumber (never changes)
PaymentAttempt.amountUSD (never changes)
PaymentAttempt.currency (never changes)
PaymentAttempt.idempotencyKey (never changes)
PaymentAttempt.createdAt (never changes)
```

### 2.3 Determinism Guarantee (IMMUTABLE)

**LOCKED INVARIANT:**
Same event stream always produces same final state.

**Enforcement:**
- No randomness in event processing
- No timestamps in reconciliation logic (only use event.occurredAt for ordering)
- No race conditions (idempotency key uniqueness)
- No non-deterministic retries (webhook handler is deterministic)
- Out-of-order events handled deterministically (see section 4.4)

### 2.4 Privacy Guarantee (IMMUTABLE)

**LOCKED INVARIANT:**
Webhooks NEVER access or log prompt/response content.

**Enforcement:**
```
Webhook events contain:
  ✅ invoiceId (reference to invoice)
  ✅ paymentAttemptId (reference to attempt)
  ✅ amountUSD (payment amount)
  ✅ status (succeeded/failed)
  ✅ providerReferenceId (provider's payment ID)

  ❌ NO prompt content
  ❌ NO response content
  ❌ NO executionId (internal only, not in webhook payload)
  ❌ NO usage details beyond high-level status
```

---

## 3. Webhook Endpoint Contract

### 3.1 Endpoint Definition

**Public Webhook Endpoint:**
```
POST /api/webhooks/payment-provider
```

**Purpose:**
Receive asynchronous payment status updates from external payment providers.

**Visibility:**
- Public endpoint (provider must be able to reach it)
- NOT authenticated via API key (provider-specific signature verification instead)

### 3.2 Request Contract

**HTTP Method:**
```
POST
```

**Content-Type:**
```
application/json
```

**Required Headers:**
```
Content-Type: application/json
X-Provider-Signature: <signature>    // Provider-specific signature (e.g., Stripe signature)
X-Provider-Timestamp: <unix_timestamp>  // Event timestamp (for replay prevention)
```

**Optional Headers:**
```
X-Provider-Event-Id: <event_id>  // Provider's event ID (for idempotency)
```

**Request Body (Provider-Agnostic Schema):**
```json
{
  "id": "evt_stripe_abc123",           // Provider's event ID (string, max 255 chars)
  "type": "payment_intent.succeeded",  // Provider's event type (string, max 100 chars)
  "created": 1672531200,               // Unix timestamp (number)
  "data": {
    "object": {
      "id": "pi_stripe_xyz789",        // Provider's payment reference ID
      "amount": 1500,                  // Amount in provider's smallest unit (e.g., cents)
      "currency": "usd",               // Currency code (lowercase)
      "status": "succeeded",           // Payment status (string)
      "metadata": {
        "invoiceId": "550e8400-...",   // Platform invoice ID (UUID)
        "paymentAttemptId": "660f9511-...", // Platform payment attempt ID (UUID)
        "idempotencyKey": "invoice-550e8400-...-1"  // Platform idempotency key
      }
    }
  }
}
```

**Request Size Limits:**
```
Max body size: 100 KB
Max header size: 8 KB (total)
```

**Rationale:**
- Large payloads not expected (payment events are small)
- Prevents DoS attacks via large webhook payloads

### 3.3 Response Contract

**Success Response:**
```
HTTP 200 OK
Content-Type: application/json

{
  "received": true
}
```

**Idempotency Response (Event Already Processed):**
```
HTTP 200 OK
Content-Type: application/json

{
  "received": true,
  "alreadyProcessed": true
}
```

**Validation Error Response:**
```
HTTP 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_request",
  "message": "Missing required field: id"
}
```

**Authentication Error Response:**
```
HTTP 401 Unauthorized
Content-Type: application/json

{
  "error": "invalid_signature",
  "message": "Webhook signature verification failed"
}
```

**Timestamp Error Response (Replay Attack Prevention):**
```
HTTP 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_timestamp",
  "message": "Webhook timestamp is too old or too far in future"
}
```

**Internal Error Response:**
```
HTTP 500 Internal Server Error
Content-Type: application/json

{
  "error": "internal_error",
  "message": "Failed to process webhook"
}
```

**Response Semantics:**
- `200 OK`: Event received and processed (or already processed)
- `400 Bad Request`: Invalid request format or expired timestamp
- `401 Unauthorized`: Signature verification failed
- `500 Internal Server Error`: Transient error (provider should retry)

**Provider Retry Behavior:**
- Providers retry on 5xx errors (transient failures)
- Providers do NOT retry on 2xx (success, even if alreadyProcessed)
- Providers do NOT retry on 4xx (permanent failures)

### 3.4 Authentication & Verification

**Signature Verification Strategy:**
```
Webhook authenticity verified via provider-specific signature mechanism.
```

**Example: Stripe Signature Verification:**
```
1. Provider computes signature:
   signature = HMAC_SHA256(webhook_secret, timestamp + '.' + request_body)

2. Provider sends signature in header:
   X-Provider-Signature: t=1672531200,v1=<signature_hex>

3. Platform verifies:
   - Extract timestamp and signature from header
   - Recompute signature using shared webhook secret
   - Compare computed signature with provided signature
   - Reject if mismatch
```

**Webhook Secret Storage:**
```
Webhook secret stored in environment variables (not database):
  STRIPE_WEBHOOK_SECRET=whsec_abc123...
  PAYPAL_WEBHOOK_SECRET=whsec_xyz789...
```

**Timestamp Tolerance:**
```
Accept webhooks with timestamp within ±5 minutes of current time.
```

**Rationale:**
- Prevents replay attacks (old webhooks rejected)
- Allows for clock skew between provider and platform
- Standard industry practice (Stripe uses 5-minute tolerance)

**Verification Pseudocode:**
```typescript
function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: number,
  secret: string
): boolean {
  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(now - timestamp);
  if (timeDiff > 300) {  // 5 minutes = 300 seconds
    throw new Error('Webhook timestamp outside tolerance window');
  }

  // Recompute signature
  const payload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Compare signatures (constant-time comparison to prevent timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## 4. Event Model & Idempotency

### 4.1 Canonical Internal Event Schema

**WebhookEvent Entity (Canonical Form):**
```typescript
WebhookEvent {
  // Identity
  webhookEventId: string;         // UUID, platform-generated primary key
  providerEventId: string;        // Provider's event ID (e.g., evt_stripe_abc123)
  provider: string;               // Provider name (e.g., 'stripe', 'paypal')

  // Event Type
  eventType: string;              // Provider's event type (e.g., 'payment_intent.succeeded')
  normalizedEventType: string;    // Normalized type (e.g., 'payment.succeeded', 'payment.failed')

  // References (Nullable: event may not match any invoice)
  invoiceId: string | null;       // Platform invoice ID (extracted from metadata)
  paymentAttemptId: string | null; // Platform payment attempt ID (extracted from metadata)

  // Payment Details
  providerReferenceId: string;    // Provider's payment reference (e.g., pi_stripe_xyz789)
  amountUSD: number;              // Amount in USD (3 decimals, converted from provider units)
  currency: string;               // Currency code (lowercase, e.g., 'usd')
  status: string;                 // Payment status (e.g., 'succeeded', 'failed', 'pending')

  // Failure Information (Nullable)
  failureCode: string | null;     // Normalized failure code (if status='failed')
  failureMessage: string | null;  // Human-readable failure message (if status='failed')

  // Timestamps
  occurredAt: Date;               // When event occurred (provider timestamp)
  receivedAt: Date;               // When platform received webhook
  processedAt: Date | null;       // When reconciliation completed

  // Processing State
  processingStatus: 'pending' | 'processed' | 'ignored';
  // 'pending': received but not yet reconciled
  // 'processed': reconciliation completed
  // 'ignored': event not applicable (e.g., no matching invoice)

  // Payload Verification (Privacy-Preserving)
  payloadHash: string;            // SHA-256 hash of original provider payload (for verification only)
}
```

**Field Constraints:**

**providerEventId:**
```
- UNIQUE constraint: no duplicate provider event IDs
- Max length: 255 characters
- Used for idempotency (prevent duplicate processing)
```

**normalizedEventType:**
```
Provider-specific event types mapped to normalized types:
  'payment_intent.succeeded' → 'payment.succeeded'
  'payment_intent.payment_failed' → 'payment.failed'
  'charge.succeeded' → 'payment.succeeded'
  'charge.failed' → 'payment.failed'
```

**invoiceId / paymentAttemptId:**
```
- Nullable (event may arrive before payment attempt created, or for unrelated payment)
- Extracted from event.data.object.metadata.invoiceId (provider-specific location)
- If missing or invalid UUID: set to null, processingStatus='ignored'
```

**amountUSD:**
```
- Converted from provider's smallest unit (e.g., Stripe cents → USD)
- Example: Stripe amount=1500 (cents) → amountUSD=15.000 (USD)
- 3 decimal precision
```

**status:**
```
- Provider-specific status (e.g., 'succeeded', 'failed', 'pending', 'canceled')
- Stored as-is for audit trail
- Mapped to normalized statuses during reconciliation
```

**payloadHash:**
```
- SHA-256 hash of original provider payload
- Used for verification and debugging correlation only
- Does NOT contain PII (one-way hash, cannot be reversed)
- Enables correlation with provider dashboards without storing sensitive data
```

### 4.2 Idempotency Strategy

**Guarantee:**
Same provider event processed exactly once, even if webhook delivered multiple times.

**Enforcement Mechanisms:**

**1. Database Uniqueness Constraint:**
```sql
CREATE UNIQUE INDEX idx_webhook_events_provider_event_id
ON webhook_events(provider_event_id);
```

**2. Application-Level Check:**
```typescript
async function processWebhook(event: ProviderWebhookPayload): Promise<void> {
  // Check if event already exists
  const existing = await webhookEventRepository.findOne({
    where: { providerEventId: event.id }
  });

  if (existing) {
    // Event already processed, return success immediately
    return { received: true, alreadyProcessed: true };
  }

  // Proceed with processing (insert + reconcile)
  const webhookEvent = await createWebhookEvent(event);
  await reconcilePaymentState(webhookEvent);
}
```

**3. Transaction Isolation:**
```typescript
// Wrap in database transaction
await db.transaction(async (txn) => {
  // Insert webhook event (unique constraint enforced)
  const webhookEvent = await txn.webhookEvents.create({
    providerEventId: event.id,
    // ... other fields
  });

  // Reconcile state (update PaymentAttempt, Invoice)
  await reconcilePaymentState(webhookEvent, txn);

  // Transaction commits only if both succeed
});
```

**Idempotency Guarantee:**
- If webhook delivered twice concurrently:
  - First request: inserts event, reconciles state, returns 200
  - Second request: unique constraint violation, returns 200 with alreadyProcessed=true
- If webhook delivered twice sequentially:
  - First request: processes event
  - Second request: finds existing event, returns 200 immediately (no duplicate reconciliation)

### 4.3 Event Ordering & Out-of-Order Handling

**Guarantee:**
Out-of-order events handled deterministically (final state always correct).

**Scenario 1: Events Arrive Out of Order**
```
Provider sends events:
  T0: Event A (payment.pending, occurredAt=100)
  T1: Event B (payment.succeeded, occurredAt=200)

Platform receives:
  T2: Event B arrives first (out of order)
  T3: Event A arrives second

Processing:
  T2: Process Event B → PaymentAttempt.status = 'succeeded', Invoice.status = 'paid'
  T3: Process Event A → Check: PaymentAttempt.status already 'succeeded' (terminal state)
                      → Ignore Event A (no state change, already in terminal state)
```

**Deterministic Rule:**
```
Terminal states (succeeded, written_off) are immutable.
Once reached, earlier events are ignored (no backwards transitions).
```

**Scenario 2: Duplicate Events (Same Event Type)**
```
Provider sends:
  T0: Event A (payment.succeeded, occurredAt=100)
  T1: Event B (payment.succeeded, occurredAt=100) — same event, re-sent

Processing:
  T0: Process Event A → PaymentAttempt.status = 'succeeded'
  T1: Event B → providerEventId matches Event A → alreadyProcessed=true (no reconciliation)
```

**Idempotency Key Match:**
```
If providerEventId is identical, event is duplicate (idempotency enforced).
```

**Scenario 3: Conflicting Events (Different Statuses)**
```
Provider sends:
  T0: Event A (payment.succeeded, occurredAt=100)
  T1: Event B (payment.failed, occurredAt=200)

Processing:
  T0: Process Event A → PaymentAttempt.status = 'succeeded', Invoice.status = 'paid'
  T1: Process Event B → Check: PaymentAttempt.status = 'succeeded' (terminal)
                      → Log warning: "Conflicting event received after terminal state"
                      → Ignore Event B (no state change)
```

**Conflict Resolution Rule:**
```
Terminal state wins (succeeded > failed > pending).
Later events cannot override terminal states.
```

### 4.4 Event Processing State Machine

**WebhookEvent Processing Lifecycle:**
```
[received] (webhook arrives, signature verified)
  ↓
[pending] (event persisted, not yet reconciled)
  ↓
[reconciliation] (update PaymentAttempt + Invoice)
  ↓
  ├─ [processed] (reconciliation succeeded)
  └─ [ignored] (event not applicable, e.g., no matching invoice)
```

**Processing Status Values:**
```
'pending': Event received, awaiting reconciliation
'processed': Reconciliation completed successfully
'ignored': Event skipped (no matching invoice, or terminal state already reached)
```

**State Transition Rules:**
```
pending → processed (reconciliation succeeds)
pending → ignored (no matching invoice, or state already terminal)
```

**No Retry State:**
```
Webhook processing is synchronous and deterministic.
If reconciliation fails (database error), webhook handler returns 500.
Provider retries entire webhook (idempotency prevents duplicate processing).
```

---

## 5. State Reconciliation Rules

### 5.1 Event Type Mapping (Provider-Agnostic)

**Normalized Event Types:**
```
payment.succeeded → Payment completed successfully
payment.failed → Payment attempt failed
payment.pending → Payment in progress (async settlement)
payment.canceled → Payment canceled by user or provider
```

**Provider-Specific Mapping (Stripe Example):**
```typescript
const STRIPE_EVENT_TYPE_MAP = {
  'payment_intent.succeeded': 'payment.succeeded',
  'payment_intent.payment_failed': 'payment.failed',
  'payment_intent.processing': 'payment.pending',
  'payment_intent.canceled': 'payment.canceled',
  'charge.succeeded': 'payment.succeeded',
  'charge.failed': 'payment.failed',
};
```

**Unmapped Event Types:**
```
Events not in mapping → processingStatus='ignored', logged for visibility.
```

### 5.2 PaymentAttempt State Reconciliation

**Reconciliation Rules:**

**Rule 1: payment.succeeded**
```
IF normalizedEventType = 'payment.succeeded':
  FIND PaymentAttempt WHERE paymentAttemptId = event.paymentAttemptId
  IF PaymentAttempt.status = 'pending':
    SET PaymentAttempt.status = 'succeeded'
    SET PaymentAttempt.completedAt = event.occurredAt
    SET PaymentAttempt.providerReferenceId = event.providerReferenceId (if missing)
    → Trigger Invoice reconciliation (see section 5.3)
  ELSE IF PaymentAttempt.status = 'succeeded':
    → No-op (already succeeded, idempotent)
  ELSE IF PaymentAttempt.status = 'failed':
    → Log warning: "Event succeeded after failed" → Ignore (terminal state)
```

**Rule 2: payment.failed**
```
IF normalizedEventType = 'payment.failed':
  FIND PaymentAttempt WHERE paymentAttemptId = event.paymentAttemptId
  IF PaymentAttempt.status = 'pending':
    SET PaymentAttempt.status = 'failed'
    SET PaymentAttempt.failureCode = event.failureCode (normalized)
    SET PaymentAttempt.failureMessage = event.failureMessage
    SET PaymentAttempt.retryable = deriveRetryable(event.failureCode)
    SET PaymentAttempt.completedAt = event.occurredAt
    SET PaymentAttempt.providerReferenceId = event.providerReferenceId (if missing)
    → Trigger Invoice reconciliation (see section 5.3)
  ELSE IF PaymentAttempt.status = 'succeeded':
    → Log warning: "Event failed after succeeded" → Ignore (terminal state)
  ELSE IF PaymentAttempt.status = 'failed':
    → No-op (already failed, idempotent)
```

**Rule 3: payment.pending**
```
IF normalizedEventType = 'payment.pending':
  FIND PaymentAttempt WHERE paymentAttemptId = event.paymentAttemptId
  IF PaymentAttempt.status = 'pending':
    → No-op (already pending, idempotent)
    → Optionally update providerReferenceId if missing
  ELSE:
    → Log info: "Pending event after terminal state" → Ignore
```

**Rule 4: payment.canceled**
```
IF normalizedEventType = 'payment.canceled':
  FIND PaymentAttempt WHERE paymentAttemptId = event.paymentAttemptId
  IF PaymentAttempt.status = 'pending':
    SET PaymentAttempt.status = 'failed'
    SET PaymentAttempt.failureCode = 'payment_canceled'
    SET PaymentAttempt.failureMessage = 'Payment was canceled'
    SET PaymentAttempt.retryable = false (terminal)
    SET PaymentAttempt.completedAt = event.occurredAt
    → Trigger Invoice reconciliation
  ELSE:
    → Log info: "Canceled event after terminal state" → Ignore
```

**Terminal State Protection:**
```
IF PaymentAttempt.status IN ['succeeded', 'failed'] AND PaymentAttempt.completedAt IS NOT NULL:
  → No further updates allowed (terminal state reached)
  → Log webhook event but do NOT modify PaymentAttempt
  → Return processingStatus='ignored'
```

### 5.3 Invoice State Reconciliation

**Reconciliation Triggered By:**
```
PaymentAttempt status transition (pending → succeeded/failed)
  → Update Invoice.status accordingly
```

**Invoice Reconciliation Rules:**

**Rule 1: PaymentAttempt Succeeded → Invoice Paid**
```
IF PaymentAttempt.status = 'succeeded':
  FIND Invoice WHERE invoiceId = PaymentAttempt.invoiceId
  IF Invoice.status IN ['pending_payment', 'failed']:
    SET Invoice.status = 'paid'
    SET Invoice.paidAt = PaymentAttempt.completedAt
  ELSE IF Invoice.status = 'paid':
    → No-op (already paid, idempotent)
  ELSE IF Invoice.status = 'written_off':
    → Log warning: "Payment succeeded for written-off invoice" → Update to 'paid' anyway
```

**Rule 2: PaymentAttempt Failed → Retry Decision**
```
IF PaymentAttempt.status = 'failed':
  FIND Invoice WHERE invoiceId = PaymentAttempt.invoiceId
  COUNT attempts = number of PaymentAttempts for this invoice

  IF PaymentAttempt.retryable = true AND attempts < 4:
    SET Invoice.status = 'failed' (temporarily)
    → Retry eligible (but NOT triggered by webhook — manual or background job)
  ELSE:
    SET Invoice.status = 'written_off' (terminal, max retries exceeded or non-retryable)
```

**Rule 3: Invoice Already Paid → Ignore**
```
IF Invoice.status = 'paid':
  → No state changes allowed (terminal state)
  → Webhook event logged but ignored
  → Return processingStatus='ignored'
```

**Rule 4: Invoice Written Off → Allow Recovery**
```
IF Invoice.status = 'written_off' AND PaymentAttempt.status = 'succeeded':
  → Allow transition to 'paid' (recovery case: manual retry succeeded after write-off)
  SET Invoice.status = 'paid'
  SET Invoice.paidAt = PaymentAttempt.completedAt
```

### 5.4 Conflict Resolution (Deterministic)

**Conflict Scenario 1: Multiple Attempts, Different Statuses**
```
Invoice has 2 PaymentAttempts:
  Attempt #1: status='failed', completedAt=T1
  Attempt #2: status='succeeded', completedAt=T2 (T2 > T1)

Webhook arrives for Attempt #1 (late delivery):
  → Check Invoice.status → 'paid' (Attempt #2 already succeeded)
  → Ignore webhook (Invoice already in terminal state)
```

**Conflict Scenario 2: Succeeded Event After Failed Event (Same Attempt)**
```
Webhook 1: payment.failed for Attempt #1
  → PaymentAttempt.status = 'failed'

Webhook 2: payment.succeeded for Attempt #1 (provider corrected status)
  → PaymentAttempt.status = 'failed' (terminal)
  → Log error: "Conflicting events for same attempt"
  → Ignore webhook (terminal state protection)
```

**Conflict Scenario 3: Out-of-Order Events**
```
Webhook 1 (delayed): payment.pending, occurredAt=T1
Webhook 2 (on-time): payment.succeeded, occurredAt=T2 (T2 > T1)

Processing order:
  1. Webhook 2 arrives first → PaymentAttempt.status = 'succeeded', Invoice.status = 'paid'
  2. Webhook 1 arrives later → PaymentAttempt.status = 'succeeded' (already terminal) → Ignore
```

**Deterministic Conflict Resolution Policy:**
```
1. Terminal states (succeeded, written_off) are immutable once reached
2. Later events with earlier occurredAt timestamps are ignored if state is terminal
3. Events for same attempt with conflicting statuses → log error, keep first terminal state
4. Events for paid invoices → always ignored (invoice terminal state)
```

### 5.5 Zero-Dollar Invoice Handling

**Design Decision:**
Zero-dollar invoices skip payment attempts (marked as paid immediately).

**Webhook Handling:**
```
IF event.invoiceId references zero-dollar invoice (totalCostUSD = 0):
  → processingStatus='ignored'
  → Log: "Webhook for zero-dollar invoice (should not occur)"
  → Return 200 OK (no error, but no reconciliation)
```

**Rationale:**
- Zero-dollar invoices have no PaymentAttempts (no charge initiated)
- Webhooks for zero-dollar invoices indicate provider error or test event
- Safe to ignore (invoice already marked as paid)

---

## 6. Storage Design

### 6.1 WebhookEvent Table Schema

**Table: webhook_events**
```sql
CREATE TABLE webhook_events (
  webhook_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  normalized_event_type VARCHAR(50),
  invoice_id UUID,
  payment_attempt_id UUID,
  provider_reference_id VARCHAR(255) NOT NULL,
  amount_usd DECIMAL(15, 3) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(50) NOT NULL,
  failure_code VARCHAR(100),
  failure_message TEXT,
  occurred_at TIMESTAMP NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payload_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_webhook_events_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_webhook_events_payment_attempt
    FOREIGN KEY (payment_attempt_id) REFERENCES payment_attempts(payment_attempt_id)
    ON DELETE SET NULL
);

-- Unique constraint for idempotency
CREATE UNIQUE INDEX idx_webhook_events_provider_event_id
ON webhook_events(provider_event_id);

-- Lookup indexes
CREATE INDEX idx_webhook_events_invoice_id
ON webhook_events(invoice_id);

CREATE INDEX idx_webhook_events_payment_attempt_id
ON webhook_events(payment_attempt_id);

CREATE INDEX idx_webhook_events_processing_status
ON webhook_events(processing_status);

CREATE INDEX idx_webhook_events_received_at
ON webhook_events(received_at DESC);
```

### 6.2 Table Immutability Rules

**Append-Only Fields:**
```
webhook_event_id, provider_event_id, provider, event_type, normalized_event_type,
invoice_id, payment_attempt_id, provider_reference_id, amount_usd, currency, status,
failure_code, failure_message, occurred_at, received_at, payload_hash, created_at
  → NEVER updated after insert
```

**Mutable Fields:**
```
processing_status: pending → processed/ignored (one-time update)
processed_at: NULL → Date (set when processing completes)
updated_at: auto-updated on any change
```

**Rationale:**
- Webhook events are immutable audit log
- Only processing metadata (status, timestamps) can be updated
- Event payload and references never change (source-of-truth)

### 6.3 Relationship to Existing Entities

**Foreign Keys:**

**invoice_id (Nullable):**
```
References invoices(invoice_id)
ON DELETE SET NULL (if invoice deleted, webhook event preserved for audit)
```

**payment_attempt_id (Nullable):**
```
References payment_attempts(payment_attempt_id)
ON DELETE SET NULL (if attempt deleted, webhook event preserved for audit)
```

**Why Nullable:**
- Event may arrive before PaymentAttempt created (race condition)
- Event may reference non-existent invoice (test event, misrouted webhook)
- Event should be logged regardless of matching invoice

### 6.4 Storage Retention Policy (Deferred)

**Design Note:**
```
Webhook events stored indefinitely in Phase 25B-3.
Retention policy (e.g., delete events older than 2 years) deferred to Phase 26+.
```

**Rationale:**
- Audit trail compliance (financial records typically retained 7+ years)
- Dispute resolution (need historical webhook events for investigations)
- Low storage cost (events are small, ~1 KB each)

---

## 7. Reconciliation Process Flow

### 7.1 Synchronous Webhook Handler Flow

**End-to-End Flow:**
```
1. Webhook arrives at POST /api/webhooks/payment-provider
2. Parse raw body (JSON)
3. Verify signature (HMAC + timestamp tolerance)
4. Extract provider event ID
5. Check idempotency (query webhook_events by provider_event_id)
   → If exists: return 200 OK (alreadyProcessed=true)
6. Begin database transaction
7. Parse webhook payload → extract invoiceId, paymentAttemptId, status, etc.
8. Insert WebhookEvent (status='pending')
9. Reconcile PaymentAttempt state (see section 5.2)
10. Reconcile Invoice state (see section 5.3)
11. Update WebhookEvent (status='processed', processedAt=now)
12. Commit transaction
13. Return 200 OK
```

**Pseudocode:**
```typescript
async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    // 1. Verify signature
    const rawBody = req.rawBody;
    const signature = req.headers['x-provider-signature'];
    const timestamp = req.headers['x-provider-timestamp'];
    verifySignature(rawBody, signature, timestamp, WEBHOOK_SECRET);

    // 2. Parse payload
    const payload = JSON.parse(rawBody);

    // 3. Check idempotency
    const existing = await webhookEventRepo.findOne({
      where: { providerEventId: payload.id }
    });
    if (existing) {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    // 4. Process in transaction
    await db.transaction(async (txn) => {
      // 5. Create webhook event
      const webhookEvent = await createWebhookEvent(payload, txn);

      // 6. Reconcile state
      await reconcilePaymentState(webhookEvent, txn);

      // 7. Mark as processed
      webhookEvent.processingStatus = 'processed';
      webhookEvent.processedAt = new Date();
      await txn.webhookEvents.save(webhookEvent);
    });

    // 8. Return success
    return res.status(200).json({ received: true });
  } catch (error) {
    // Handle errors (see section 7.2)
    handleWebhookError(error, res);
  }
}
```

### 7.2 Failure Handling

**Failure Scenario 1: Signature Verification Fails**
```
Error: Invalid signature
Response: 401 Unauthorized
Provider behavior: Does NOT retry (permanent auth failure)
Platform action: Log warning, increment metrics counter (invalid_signature_count)
```

**Failure Scenario 2: Timestamp Outside Tolerance**
```
Error: Timestamp too old (> 5 minutes)
Response: 400 Bad Request (invalid_timestamp)
Provider behavior: Does NOT retry (permanent validation failure)
Platform action: Log warning, increment metrics counter (expired_timestamp_count)
```

**Failure Scenario 3: Duplicate Event (Idempotency)**
```
Error: None (normal idempotency case)
Response: 200 OK (alreadyProcessed=true)
Provider behavior: Does NOT retry (success response)
Platform action: No-op (no logging, normal case)
```

**Failure Scenario 4: Database Write Fails**
```
Error: Database constraint violation, connection timeout, etc.
Response: 500 Internal Server Error
Provider behavior: Retries webhook (exponential backoff)
Platform action: Log error, increment metrics counter (db_error_count)
              → Provider retry eventually succeeds (idempotency prevents duplicate)
```

**Failure Scenario 5: Reconciliation Logic Error**
```
Error: Unexpected state transition, missing invoice, etc.
Response: 500 Internal Server Error
Provider behavior: Retries webhook
Platform action: Log error with full context (invoiceId, paymentAttemptId, event payload)
              → If invoice missing: webhook event created, processingStatus='ignored'
              → If state transition invalid: webhook event created, logged, processingStatus='ignored'
```

**Failure Scenario 6: Invalid Payload Format**
```
Error: Missing required fields, invalid JSON, etc.
Response: 400 Bad Request (invalid_request)
Provider behavior: Does NOT retry (permanent validation failure)
Platform action: Log error with raw payload (truncated to 1 KB for logging)
```

### 7.3 Transaction Boundaries

**Transaction Scope:**
```
BEGIN TRANSACTION
  1. Insert WebhookEvent
  2. Update PaymentAttempt (if applicable)
  3. Update Invoice (if applicable)
  4. Update WebhookEvent.processingStatus = 'processed'
COMMIT TRANSACTION
```

**Atomicity Guarantee:**
```
All state updates (webhook event + payment attempt + invoice) succeed or fail together.
No partial updates (e.g., webhook persisted but reconciliation failed).
```

**Idempotency Under Transaction Failures:**
```
IF transaction fails:
  → Webhook event NOT persisted
  → Next webhook retry creates event (idempotency check passes)
  → Reconciliation retried with new transaction
```

### 7.4 Operator Visibility (Logs & Metrics Only)

**Logging:**
```
INFO: Webhook received (provider, event type, invoiceId)
INFO: Webhook processed (provider_event_id, processing time)
WARN: Webhook ignored (reason: no matching invoice, or terminal state)
ERROR: Webhook processing failed (error message, stack trace)
```

**Metrics (Prometheus-Style):**
```
webhook_received_total{provider="stripe", event_type="payment.succeeded"}
webhook_processed_total{provider="stripe", processing_status="processed"}
webhook_ignored_total{provider="stripe", reason="terminal_state"}
webhook_error_total{provider="stripe", error_type="db_error"}
webhook_processing_duration_seconds{provider="stripe"}
webhook_signature_verification_failures_total{provider="stripe"}
```

**No UI in Phase 25B-3:**
```
Operator visibility via logs and metrics only.
Admin dashboard for webhook events deferred to Phase 26+.
```

---

## 8. Security & Privacy

### 8.1 Signature Verification (Critical)

**Requirement:**
All incoming webhooks MUST be verified before processing.

**Verification Steps:**
```
1. Extract signature and timestamp from headers
2. Validate timestamp (within ±5 minutes)
3. Reconstruct payload (timestamp + '.' + raw body)
4. Compute HMAC-SHA256(webhook_secret, payload)
5. Compare computed signature with provided signature (constant-time comparison)
6. Reject if mismatch or timestamp invalid
```

**Webhook Secret Rotation:**
```
Design Note: Webhook secret rotation deferred to Phase 26+.
Phase 25B-3 assumes static webhook secret (env var, not rotated).
```

**Provider-Specific Verification:**
```
Different providers use different signature schemes:
  - Stripe: HMAC-SHA256 with timestamp in header
  - PayPal: JWT signature with certificate validation
  - Stub: No signature (testing only)

Platform must implement provider-specific verification logic.
```

### 8.2 Replay Attack Prevention

**Mechanism:**
Timestamp tolerance (±5 minutes) prevents replay of old webhooks.

**Attack Scenario:**
```
Attacker captures legitimate webhook:
  X-Provider-Signature: t=1672531200,v1=abc123...
  Body: {"id": "evt_xyz", ...}

Attacker replays webhook 10 minutes later:
  → Timestamp check fails (1672531200 is > 5 minutes old)
  → Webhook rejected with 400 Bad Request
```

**Nonce/Event ID Protection:**
```
Provider event ID uniqueness prevents duplicate processing:
  - Event ID "evt_xyz" processed once
  - Replay with same event ID → alreadyProcessed=true (no reconciliation)
```

### 8.3 No Sensitive Logging

**Prohibited Logging:**
```
❌ DO NOT log:
  - Raw webhook payload (may contain PII)
  - Signature headers (secrets)
  - Full error stack traces (may contain secrets)
  - Customer payment method details
  - Provider customer IDs
```

**Allowed Logging:**
```
✅ CAN log:
  - Provider event ID (evt_xyz)
  - Event type (payment.succeeded)
  - Invoice ID (platform UUID)
  - Payment attempt ID (platform UUID)
  - Amount (USD value)
  - Processing status (processed/ignored)
  - Error types (without sensitive details)
```

**Example Safe Log:**
```
INFO: Webhook processed
  provider: stripe
  eventId: evt_1A2B3C
  eventType: payment_intent.succeeded
  invoiceId: 550e8400-e29b-41d4-a716-446655440000
  processingStatus: processed
  duration: 45ms
```

**Example Unsafe Log (DO NOT USE):**
```
ERROR: Webhook processing failed
  rawPayload: {"id": "evt_xyz", "data": {"object": {"customer": "cus_ABC", ...}}}
  ❌ Contains provider customer ID (PII)
```

### 8.4 PII Minimization & Privacy-Preserving Storage

**PRIVACY CORRECTION (Phase 25B-3 Design Update):**
```
Original design stored rawEventPayload (full provider payload).
CORRECTED: Store only payloadHash (SHA-256) instead.
```

**Rationale:**
- Provider webhook payloads may contain PII (customer IDs, metadata, etc.)
- Storing raw payloads violates privacy guarantees
- Hash provides verification capability without PII exposure

**Webhook Event Storage (Privacy-Preserving):**
```
payloadHash field stores SHA-256 hash of provider payload.
  - One-way hash (cannot be reversed to recover PII)
  - Enables correlation with provider dashboards (providers log same event ID)
  - Debugging via provider-side logs (not platform storage)

NO raw provider payloads persisted in database.
```

**Debugging Without Raw Payloads:**
```
When investigating webhook issues:
  1. Use payloadHash to correlate with provider event ID
  2. Access provider dashboard (Stripe, PayPal) to view full event
  3. Provider retains raw webhook payloads for audit (30+ days typically)
  4. Platform stores only extracted fields (invoiceId, amount, status, etc.)
```

**Provider Reference IDs:**
```
providerReferenceId (e.g., pi_stripe_xyz) stored for correlation.
This is NOT PII (payment intent ID, not customer ID).
```

**No Customer PII in Webhook Events:**
```
Webhook events do NOT store:
  - Customer name
  - Customer email
  - Customer address
  - Payment method details (card last 4 digits, etc.)
```

### 8.5 Rate Limiting (Out of Scope)

**SCOPE CORRECTION (Phase 25B-3 Design Update):**
```
Rate limiting is infrastructure/policy concern, NOT core webhook design.
REMOVED from Phase 25B-3 scope.
```

**Rationale:**
- Rate limiting is deployment/infrastructure responsibility
- Not part of webhook ingestion contract or reconciliation logic
- Should be implemented at reverse proxy/API gateway layer (e.g., nginx, Kong)
- Phase 25B-3 focuses on: signature verification, idempotency, deterministic reconciliation

**Future Hardening (Deferred):**
- Rate limits per provider (e.g., 1000 req/min)
- Rate limits per IP address
- DDoS protection at infrastructure layer
- Webhook endpoint throttling

**Phase 25B-3 Scope:**
- Signature verification (authentication)
- Idempotency (duplicate prevention)
- State reconciliation (deterministic transitions)
- Transaction boundaries (atomicity)

---

## 9. Testing Plan (Design Only)

### 9.1 Unit Test Matrix

**Test Category 1: Signature Verification**
```
Test: Valid signature accepted
  Given: Webhook with valid HMAC signature
  When: Signature verification called
  Then: Verification succeeds

Test: Invalid signature rejected
  Given: Webhook with incorrect signature
  When: Signature verification called
  Then: Throws InvalidSignatureError

Test: Expired timestamp rejected
  Given: Webhook with timestamp > 5 minutes old
  When: Signature verification called
  Then: Throws ExpiredTimestampError

Test: Future timestamp rejected
  Given: Webhook with timestamp > 5 minutes in future
  When: Signature verification called
  Then: Throws InvalidTimestampError
```

**Test Category 2: Idempotency**
```
Test: Duplicate event ignored
  Given: Webhook event with provider_event_id "evt_123" already exists
  When: New webhook with same provider_event_id arrives
  Then: Returns alreadyProcessed=true, no reconciliation

Test: Concurrent duplicate events
  Given: Two webhooks with same provider_event_id arrive simultaneously
  When: Both processed concurrently
  Then: One succeeds (creates event), one returns alreadyProcessed=true

Test: Unique events processed independently
  Given: Two webhooks with different provider_event_ids
  When: Both processed
  Then: Both create separate webhook events
```

**Test Category 3: Out-of-Order Events**
```
Test: Succeeded event before pending event
  Given: Webhook "payment.succeeded" (occurredAt=T2) arrives first
  And: Webhook "payment.pending" (occurredAt=T1) arrives second
  When: Both processed
  Then: PaymentAttempt.status = 'succeeded' (terminal state)
        Second webhook ignored (terminal state protection)

Test: Failed event after succeeded event
  Given: Webhook "payment.succeeded" arrives first
  And: Webhook "payment.failed" arrives second (late delivery)
  When: Both processed
  Then: PaymentAttempt.status = 'succeeded' (terminal state)
        Second webhook ignored, warning logged
```

**Test Category 4: Reconciliation Logic**
```
Test: Succeeded webhook transitions PaymentAttempt to succeeded
  Given: PaymentAttempt with status='pending'
  When: Webhook "payment.succeeded" arrives
  Then: PaymentAttempt.status = 'succeeded'
        Invoice.status = 'paid'
        Invoice.paidAt set

Test: Failed webhook transitions PaymentAttempt to failed
  Given: PaymentAttempt with status='pending'
  When: Webhook "payment.failed" arrives
  Then: PaymentAttempt.status = 'failed'
        PaymentAttempt.failureCode set
        Invoice.status = 'failed' or 'written_off' (based on retry eligibility)

Test: Webhook for non-existent invoice ignored
  Given: Webhook with invoiceId not in database
  When: Webhook processed
  Then: WebhookEvent created with processingStatus='ignored'
        No PaymentAttempt or Invoice updates

Test: Zero-dollar invoice webhook ignored
  Given: Webhook references invoice with totalCostUSD=0
  When: Webhook processed
  Then: WebhookEvent created with processingStatus='ignored'
        Warning logged
```

**Test Category 5: Conflict Resolution**
```
Test: Terminal state immutability
  Given: PaymentAttempt with status='succeeded'
  When: Webhook "payment.failed" arrives
  Then: PaymentAttempt.status remains 'succeeded'
        Webhook processingStatus='ignored'
        Warning logged

Test: Invoice paid state immutability
  Given: Invoice with status='paid'
  When: Webhook "payment.failed" for earlier attempt arrives
  Then: Invoice.status remains 'paid'
        Webhook processingStatus='ignored'
```

### 9.2 Integration Test Plan

**Integration Test 1: End-to-End Webhook Processing**
```
Setup: Create Invoice with PaymentAttempt (status='pending')
Action: Send valid webhook "payment.succeeded"
Assert:
  - WebhookEvent created in database
  - PaymentAttempt.status = 'succeeded'
  - Invoice.status = 'paid'
  - Response 200 OK
```

**Integration Test 2: Signature Verification Failure**
```
Setup: None
Action: Send webhook with invalid signature
Assert:
  - No WebhookEvent created
  - No PaymentAttempt updates
  - Response 401 Unauthorized
```

**Integration Test 3: Idempotency Enforcement**
```
Setup: Create Invoice with PaymentAttempt
Action: Send same webhook twice (same provider_event_id)
Assert:
  - First request: WebhookEvent created, reconciliation runs
  - Second request: Returns alreadyProcessed=true, no duplicate reconciliation
  - Only one WebhookEvent in database
  - PaymentAttempt updated exactly once
```

**Integration Test 4: Transaction Rollback on Error**
```
Setup: Create Invoice with PaymentAttempt
Action: Send webhook, simulate database error during reconciliation
Assert:
  - Transaction rolled back
  - No WebhookEvent created
  - PaymentAttempt status unchanged
  - Response 500 Internal Server Error
  - Provider can retry successfully
```

**Integration Test 5: AI Execution Independence**
```
Setup: Running AI execution endpoint
Action: Send invalid webhook (causes 500 error)
Assert:
  - Webhook processing fails
  - AI execution endpoint remains functional (independent endpoints)
  - User can execute AI requests successfully
```

### 9.3 Test Environment Setup

**Test Database:**
```
Use in-memory SQLite or PostgreSQL test database.
Migrations applied automatically before tests.
```

**Stub Payment Provider:**
```
Mock provider that generates predictable webhook payloads.
No external API calls (all responses hardcoded).
```

**Test Webhook Secret:**
```
Use test webhook secret (not production secret).
Example: "whsec_test_abc123"
```

**Test Fixtures:**
```
Pre-created test data:
  - Test Invoice (status='finalized', totalCostUSD=15.000)
  - Test PaymentAttempt (status='pending', attemptNumber=1)
  - Test Provider Event IDs (evt_test_001, evt_test_002, etc.)
```

---

## 10. Explicit Non-Goals (NOT in Phase 25B-3 Design)

### 10.1 No Stripe SDK Integration

**NOT Included:**
- ❌ Stripe SDK installation or usage
- ❌ Stripe-specific webhook parsing logic
- ❌ Stripe customer creation
- ❌ Stripe payment method attachment

**Rationale:**
Design is provider-agnostic. Stripe-specific implementation deferred to Phase 25B-3-IMPL.

### 10.2 No Background Workers / Queues

**NOT Included:**
- ❌ BullMQ or Agenda job queue
- ❌ Asynchronous webhook processing (webhooks processed synchronously)
- ❌ Retry queue for failed reconciliations

**Rationale:**
Webhooks processed synchronously in Phase 25B-3. Async processing deferred to Phase 26+.

### 10.3 No Refunds, Disputes, or Chargebacks

**NOT Included:**
- ❌ Refund webhook handling (payment.refunded)
- ❌ Dispute webhook handling (charge.dispute.created)
- ❌ Chargeback webhook handling

**Rationale:**
Refunds and disputes are Phase 25C+ features. Phase 25B-3 focuses on payment completion events only.

### 10.4 No Payment Method Management

**NOT Included:**
- ❌ Webhook events for payment method updates
- ❌ Customer account events (customer.created, customer.deleted)
- ❌ Payment method expiry notifications

**Rationale:**
Payment method management is separate concern. Deferred to Phase 26+.

### 10.5 No Customer Notifications

**NOT Included:**
- ❌ Email notifications triggered by webhooks
- ❌ SMS notifications
- ❌ In-app notifications

**Rationale:**
Notifications are Phase 25C+ feature. Webhooks update state only.

### 10.6 No Public APIs or Dashboards

**NOT Included:**
- ❌ GET /api/webhooks (list webhook events)
- ❌ GET /api/webhooks/:id (view single webhook event)
- ❌ Admin dashboard for webhook events

**Rationale:**
Webhook visibility limited to logs and metrics in Phase 25B-3. UI deferred to Phase 26+.

### 10.7 No Webhook Retry from Platform

**NOT Included:**
- ❌ Platform retrying webhook processing (provider retries only)
- ❌ Dead letter queue for failed webhooks

**Rationale:**
Webhooks are idempotent and deterministic. Provider retries on 5xx errors. No platform-side retry needed.

### 10.8 No Implementation Code

**NOT Included:**
- ❌ WebhookController implementation
- ❌ WebhookEvent entity TypeORM code
- ❌ Migration files
- ❌ Unit tests
- ❌ Integration tests

**Rationale:**
Phase 25B-3 is DESIGN ONLY. Implementation deferred to Phase 25B-3-IMPL.

---

## 11. Safe Resume Point

### 11.1 Phase 25B-3 Status

**Status:** DESIGN COMPLETE

**Completion Criteria Met:**
- ✅ Webhook endpoint contract defined (POST /api/webhooks/payment-provider)
- ✅ Authentication/verification strategy defined (HMAC signature, timestamp tolerance)
- ✅ Event model designed (WebhookEvent entity, canonical schema)
- ✅ Idempotency strategy defined (provider_event_id uniqueness, transaction isolation)
- ✅ State reconciliation rules defined (PaymentAttempt + Invoice transitions)
- ✅ Out-of-order and conflict handling defined (deterministic rules)
- ✅ Storage design complete (webhook_events table schema, indexes)
- ✅ Reconciliation process flow defined (synchronous handler, transaction boundaries)
- ✅ Security measures defined (signature verification, replay prevention, no sensitive logging)
- ✅ Testing plan defined (unit tests, integration tests, test matrix)
- ✅ Explicit non-goals documented

**Design Readiness:**
Phase 25B-3 design is complete and ready for implementation (Phase 25B-3-IMPL).

### 11.2 Next Allowable Phase

**Phase 25B-3-IMPL: Webhook Implementation (NOT AUTHORIZED)**

**Scope (if authorized):**
- Implement WebhookController (POST /api/webhooks/payment-provider endpoint)
- Implement WebhookEvent entity (TypeORM)
- Create migration for webhook_events table
- Implement signature verification (provider-specific: Stripe, Stub)
- Implement idempotency checks (provider_event_id uniqueness)
- Implement reconciliation logic (PaymentAttempt + Invoice state updates)
- Implement error handling (signature failures, validation errors, db errors)
- Write unit tests (signature verification, idempotency, reconciliation)
- Write integration tests (end-to-end webhook processing)

**Prerequisites:**
- ✅ Phase 25B-3 (Webhook Design) COMPLETE
- ✅ Phase 25B-2 (Payment Attempt System) COMPLETE
- ✅ Phase 25B-1 (Invoice Persistence) COMPLETE

**Unlocks:**
- Automatic payment state updates from provider
- Resilient payment reconciliation (webhooks as source-of-truth)
- Audit trail for all provider events

**Recommended Next Step:**
Phase 25B-3-IMPL (Webhook Implementation).

### 11.3 Phase 25B-3 Lock Policy

**Phase 25B-3 Design Must NOT Be Modified Without:**
1. Explicit user approval to reopen Phase 25B-3
2. Updated ARCHITECTURE.md (if architectural changes required)
3. Updated PRD.md (if scope changes required)
4. New Phase 25B-3-REVISION checkpoint

**Safe Clarifications (No Reopening Required):**
- Adding examples or diagrams
- Clarifying ambiguous design decisions
- Fixing typos or formatting
- Adding provider-specific signature verification examples

**Unsafe Modifications (Reopening Required):**
- Changing webhook endpoint contract (path, method, headers)
- Changing event model schema (WebhookEvent fields)
- Changing reconciliation rules (state transition logic)
- Changing idempotency strategy (uniqueness constraints)
- Violating locked invariants (execution coupling, immutability, determinism)

---

## ULTRA-BRIEF SUMMARY

• **Webhook ingestion designed with provider-agnostic endpoint and signature verification** via POST /api/webhooks/payment-provider accepting provider webhooks (Stripe-like), authenticating via HMAC-SHA256 signature with ±5 minute timestamp tolerance for replay prevention, enforcing 100KB request limit, returning 200 OK (success/idempotent), 401 Unauthorized (invalid signature), 400 Bad Request (validation error), or 500 Internal Server Error (transient failure with provider retry)

• **Canonical WebhookEvent entity enforces exactly-once processing** with provider_event_id UNIQUE constraint for database-level idempotency, synchronous transaction wrapping (insert event + reconcile state + mark processed atomically), and append-only audit trail storing webhookEventId, providerEventId, provider, eventType, normalizedEventType, invoiceId/paymentAttemptId references (nullable), providerReferenceId, amountUSD, status, failureCode/failureMessage, occurredAt/receivedAt/processedAt timestamps, processingStatus (pending/processed/ignored), and payloadHash (SHA-256 hash for verification, privacy-preserving, no raw payload storage)

• **Deterministic reconciliation maps provider events to state transitions** with normalized event types (payment.succeeded/failed/pending/canceled), PaymentAttempt updates (pending → succeeded/failed with terminal state protection), Invoice updates (pending_payment → paid/failed/written_off based on attempt outcome and retry eligibility), out-of-order event handling (terminal states immutable, earlier events ignored if state already final), duplicate event idempotency (same providerEventId returns alreadyProcessed=true), and conflict resolution (succeeded > failed > pending, later events cannot override terminal states)

• **Complete execution isolation and immutability preserved** where webhook failures NEVER affect AI execution (ai-service has zero webhook dependencies, /api/ai/execute remains functional regardless of webhook processing errors), BillingSnapshot remains read-only (no writes from webhooks), Invoice amounts/lineItems/periods immutable (only status/paidAt mutable), PaymentAttempt immutable except status/failureCode/failureMessage/completedAt updates during lifecycle transitions, and no sensitive logging (no raw payloads, signatures, or PII in logs, only eventId/eventType/invoiceId/processingStatus/duration)

• **No implementation, background workers, rate limiting, or provider-specific code** with Phase 25B-3 being pure design specification defining conceptual webhook_events table schema (indexes on provider_event_id UNIQUE, invoice_id, payment_attempt_id, processing_status, received_at), transaction boundaries (event insert + reconciliation + status update atomic), testing plan (unit tests for signature/idempotency/reconciliation, integration tests for end-to-end flow), privacy correction (removed rawEventPayload storage, replaced with payloadHash for PII protection), scope correction (removed rate limiting as infrastructure concern), and explicit exclusions (no Stripe SDK, no queues/cron jobs, no refunds/disputes, no notifications, no UI, no implementation code), with implementation readiness confirmed for Phase 25B-3-IMPL

---

**END OF PHASE 25B-3 DESIGN**

**Phase 25B-3 design is COMPLETE.**

**Next Phase (Phase 25B-3-IMPL: Webhook Implementation) requires explicit user authorization.**
