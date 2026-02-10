# PHASE 25B-3 FINAL CHECKPOINT: Webhooks + Reconciliation (Design Complete)

**Phase:** 25B-3
**Nature:** DESIGN ONLY (No Implementation)
**Scope:** Payment Webhooks & Reconciliation Design
**Status:** COMPLETE and LOCKED
**Date:** 2026-02-07
**Prerequisite:** Phase 25B-2 (Payment Attempt System) COMPLETE, Phase 25B-1 (Invoice Persistence) COMPLETE, Phase 25A (Payments Design) COMPLETE
**Next Phase:** Phase 25B-3-IMPL (Webhook Implementation) — NOT AUTHORIZED

---

## 1. Phase 25B-3 Overview

### 1.1 What Phase 25B-3 Achieved

Phase 25B-3 establishes the complete design specification for **Payment Webhooks + Reconciliation**—the system responsible for receiving asynchronous payment status updates from external payment providers and deterministically reconciling PaymentAttempt and Invoice state while maintaining complete isolation from AI execution and billing calculation.

**Design Deliverables:**
- Provider-agnostic webhook ingestion endpoint contract
- Signature verification strategy (HMAC-SHA256 with replay prevention)
- Exactly-once processing semantics (idempotency via database constraints)
- Canonical WebhookEvent entity schema
- Deterministic state reconciliation rules (PaymentAttempt + Invoice transitions)
- Privacy-preserving storage design (no raw payloads, hash-only verification)
- Out-of-order and duplicate event handling rules
- Comprehensive testing plan

**No Implementation:**
Phase 25B-3 is design-only. No code, entities, migrations, or tests were created.

### 1.2 Architectural Achievement

**Core Principle:**
Webhook reconciliation is **asynchronous, idempotent, isolated, and privacy-preserving**—provider webhooks update payment state independently of execution flow, webhook failures NEVER affect AI execution or billing correctness, and no provider payloads or PII are persisted.

**Separation of Concerns:**
```
Phase 12-21: AI Execution (ai-service) — NO webhook awareness
Phase 22: Usage Recording (append-only) — NO webhook writes
Phase 23: Billing Calculation (immutable snapshots) — NO webhook writes
Phase 25B-1: Invoice Persistence — NO webhook coupling
Phase 25B-2: Payment Attempts — Synchronous provider API calls
Phase 25B-3: Webhook Reconciliation — Asynchronous provider events (THIS)
```

**Key Innovation:**
Webhooks provide authoritative status updates even if synchronous payment flow fails or times out, enabling reliable payment reconciliation without blocking execution or violating privacy guarantees.

---

## 2. Scope: What Phase 25B-3 Defines

### 2.1 Webhook Ingestion Contract

**Endpoint:**
```
POST /api/webhooks/payment-provider
```

**Authentication:**
- Provider-specific signature verification (HMAC-SHA256)
- Timestamp-based replay prevention (±5 minute tolerance)
- No API key authentication (public endpoint)

**Request Format:**
- Content-Type: application/json
- Max body size: 100 KB
- Required headers: X-Provider-Signature, X-Provider-Timestamp
- Provider-agnostic JSON schema

**Response Semantics:**
- `200 OK`: Event processed or already processed (idempotent)
- `400 Bad Request`: Invalid format or expired timestamp
- `401 Unauthorized`: Signature verification failed
- `500 Internal Server Error`: Transient error (provider retries)

### 2.2 Idempotency & Audit Trail

**WebhookEvent Entity (Canonical):**
```typescript
WebhookEvent {
  webhookEventId: string;         // Platform UUID
  providerEventId: string;        // Provider event ID (UNIQUE constraint)
  provider: string;               // 'stripe', 'paypal', etc.
  eventType: string;              // Provider event type
  normalizedEventType: string;    // 'payment.succeeded', 'payment.failed', etc.
  invoiceId: string | null;       // Platform invoice reference
  paymentAttemptId: string | null; // Platform payment attempt reference
  providerReferenceId: string;    // Provider payment ID
  amountUSD: number;              // 3 decimal precision
  currency: string;               // 'usd'
  status: string;                 // 'succeeded', 'failed', 'pending'
  failureCode: string | null;     // Normalized failure code
  failureMessage: string | null;  // Human-readable message
  occurredAt: Date;               // Provider timestamp
  receivedAt: Date;               // Platform receipt time
  processedAt: Date | null;       // Reconciliation completion time
  processingStatus: 'pending' | 'processed' | 'ignored';
  payloadHash: string;            // SHA-256 hash (verification only, NO raw payload)
}
```

**Idempotency Enforcement:**
- Database UNIQUE constraint on `provider_event_id`
- Application-level duplicate check before processing
- Transaction isolation (insert + reconcile + mark processed atomically)
- Concurrent requests handled safely (first succeeds, duplicates return 200 with alreadyProcessed=true)

**Append-Only Audit:**
- WebhookEvent records never updated after creation (except processing_status, processed_at)
- All provider events logged permanently
- Complete audit trail for dispute resolution

### 2.3 Privacy Guarantees (CRITICAL)

**NO Raw Payload Storage:**
```
✅ Store: payloadHash (SHA-256 one-way hash)
❌ NEVER store: rawEventPayload (contains PII)
❌ NEVER store: Full provider JSON
❌ NEVER log: Raw webhook bodies
```

**Privacy-Preserving Design:**
- Only extracted fields persisted (invoiceId, amount, status, references)
- Hash enables correlation with provider dashboards (for debugging)
- Provider retains full event history (30+ days typically)
- Platform storage is PII-free

**Debugging Without Raw Payloads:**
```
Investigation process:
  1. Look up WebhookEvent by providerEventId or invoiceId
  2. Use payloadHash to verify event integrity
  3. Correlate providerEventId with provider dashboard (Stripe, PayPal)
  4. View full event details in provider's logs (not platform)
```

**No Customer PII:**
- NO customer names, emails, addresses
- NO payment method details (card numbers, last 4 digits)
- NO provider customer IDs
- ONLY payment intent IDs (providerReferenceId)

### 2.4 Deterministic Reconciliation Rules

**Normalized Event Types:**
```
payment.succeeded → Payment completed successfully
payment.failed → Payment attempt failed
payment.pending → Payment processing asynchronously
payment.canceled → Payment canceled
```

**PaymentAttempt State Transitions:**
```
payment.succeeded:
  pending → succeeded (set completedAt, providerReferenceId)
  succeeded → no-op (idempotent)
  failed → IGNORE (terminal state protection)

payment.failed:
  pending → failed (set failureCode, failureMessage, retryable, completedAt)
  succeeded → IGNORE (terminal state protection)
  failed → no-op (idempotent)

payment.pending:
  pending → no-op (idempotent)
  terminal → IGNORE (log info)

payment.canceled:
  pending → failed (failureCode='payment_canceled', retryable=false)
  terminal → IGNORE
```

**Invoice State Transitions:**
```
PaymentAttempt succeeded:
  Invoice: pending_payment | failed → paid (set paidAt)
  Invoice: paid → no-op (idempotent)
  Invoice: written_off → paid (recovery case)

PaymentAttempt failed:
  IF retryable=true AND attempts < 4:
    Invoice: → failed (temporarily, retry eligible)
  ELSE:
    Invoice: → written_off (terminal, max retries or non-retryable)
```

**Terminal State Protection:**
- Once PaymentAttempt reaches 'succeeded' or 'failed' with completedAt set → immutable
- Once Invoice reaches 'paid' or 'written_off' → immutable (except paid recovery)
- Out-of-order events ignored if terminal state already reached

**Conflict Resolution (Deterministic):**
- Terminal states win (succeeded > failed > pending)
- Later events with earlier occurredAt ignored if state is terminal
- Events for same attempt with conflicting statuses → log error, keep first terminal state
- Events for paid invoices → always ignored

### 2.5 Storage Design

**webhook_events Table:**
```sql
CREATE TABLE webhook_events (
  webhook_event_id UUID PRIMARY KEY,
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

CREATE UNIQUE INDEX idx_webhook_events_provider_event_id
ON webhook_events(provider_event_id);

CREATE INDEX idx_webhook_events_invoice_id ON webhook_events(invoice_id);
CREATE INDEX idx_webhook_events_payment_attempt_id ON webhook_events(payment_attempt_id);
CREATE INDEX idx_webhook_events_processing_status ON webhook_events(processing_status);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at DESC);
```

**Immutability Rules:**
- Append-only: webhookEventId, providerEventId, provider, eventType, invoiceId, paymentAttemptId, providerReferenceId, amountUSD, status, failureCode, occurredAt, receivedAt, payloadHash, createdAt
- Mutable: processingStatus (pending → processed/ignored), processedAt (NULL → Date), updatedAt (auto)

---

## 3. Locked Invariants (IMMUTABLE)

### 3.1 Execution Isolation

**LOCKED GUARANTEE:**
Webhook processing NEVER affects AI execution.

**Enforcement:**
```
ai-service has ZERO dependencies on:
  - WebhookEvent entity
  - WebhookController
  - Payment reconciliation logic

Execution flow NEVER checks:
  - Webhook event state
  - Payment provider uptime
  - Webhook processing errors

Result: Webhook failures do NOT block /api/ai/execute
```

### 3.2 Billing Immutability

**LOCKED GUARANTEE:**
Webhooks have ZERO write access to BillingSnapshot.

**Enforcement:**
```
Webhook reconciliation:
  ✅ Reads: BillingSnapshot (via Invoice reference)
  ❌ Writes: billing_snapshots table
  ❌ Updates: BillingSnapshot.status
  ❌ Modifies: BillingSnapshot amounts or line items
```

### 3.3 Invoice Amount Immutability

**LOCKED GUARANTEE:**
Webhooks CANNOT modify invoice financial data.

**Enforcement:**
```
Immutable Invoice fields:
  - totalCostUSD (FROZEN)
  - lineItems[] (FROZEN)
  - periodStart, periodEnd (FROZEN)
  - apiKeyId, userId (FROZEN)

Mutable Invoice fields (webhooks allowed):
  - status (state transitions)
  - paidAt (set when paid)

Webhooks do NOT modify:
  - paymentAttemptCount (incremented by PaymentService, not webhooks)
  - lastPaymentAttemptAt (set by PaymentService, not webhooks)
```

### 3.4 Determinism

**LOCKED GUARANTEE:**
Same event stream always produces same final state.

**Enforcement:**
- No randomness in reconciliation logic
- No time-based cutoffs in decision logic
- No race conditions (idempotency enforced)
- Out-of-order events handled deterministically
- Terminal state protection prevents state reversals

### 3.5 Privacy

**LOCKED GUARANTEE:**
NO prompt/response content, NO raw provider payloads, NO PII in webhook storage.

**Enforcement:**
```
Webhook events contain:
  ✅ invoiceId, paymentAttemptId (platform references)
  ✅ amountUSD, currency, status (extracted fields)
  ✅ payloadHash (SHA-256, verification only)

  ❌ NO prompts or responses
  ❌ NO executionId
  ❌ NO rawEventPayload
  ❌ NO customer PII
  ❌ NO payment method details
```

### 3.6 Throw-Only Error Semantics

**LOCKED GUARANTEE:**
Webhook errors thrown, NEVER returned as success payloads.

**Enforcement:**
- Signature verification failure → 401 (thrown)
- Timestamp validation failure → 400 (thrown)
- Database errors → 500 (thrown)
- NO error payloads in 200 responses

---

## 4. Explicit Non-Goals (NOT in Phase 25B-3)

### 4.1 No Implementation

**NOT Delivered:**
- ❌ WebhookController class
- ❌ WebhookEvent entity (TypeORM code)
- ❌ Migration files
- ❌ Signature verification implementation
- ❌ Reconciliation logic code
- ❌ Unit tests
- ❌ Integration tests

**Rationale:** Phase 25B-3 is design specification only.

### 4.2 No Provider SDK Integration

**NOT Delivered:**
- ❌ Stripe SDK installation or usage
- ❌ Stripe-specific webhook parsing
- ❌ PayPal webhook handling
- ❌ Provider customer creation
- ❌ Provider payment method attachment

**Rationale:** Design is provider-agnostic. SDK integration deferred to Phase 25B-3-IMPL.

### 4.3 No Background Jobs or Queues

**NOT Delivered:**
- ❌ BullMQ or Agenda setup
- ❌ Asynchronous webhook processing
- ❌ Retry queues
- ❌ Scheduled jobs

**Rationale:** Webhooks processed synchronously. Async processing deferred to Phase 26+.

### 4.4 No Rate Limiting

**NOT Delivered:**
- ❌ Rate limits per provider
- ❌ Rate limits per IP address
- ❌ DDoS protection
- ❌ Throttling logic

**Rationale:** Rate limiting is infrastructure/policy concern, not core webhook design. Should be implemented at reverse proxy/API gateway layer (nginx, Kong). Reclassified as out-of-scope for Phase 25B-3.

### 4.5 No Refunds, Disputes, or Chargebacks

**NOT Delivered:**
- ❌ Refund webhook handling (payment.refunded)
- ❌ Dispute webhooks (charge.dispute.created)
- ❌ Chargeback webhooks
- ❌ Refund audit trail

**Rationale:** Phase 25C+ features. Phase 25B-3 focuses on payment completion events only.

### 4.6 No Customer Notifications

**NOT Delivered:**
- ❌ Email notifications
- ❌ SMS notifications
- ❌ In-app notifications
- ❌ Notification templates

**Rationale:** Notifications are Phase 25C+ feature. Webhooks update state only.

### 4.7 No UI or Dashboards

**NOT Delivered:**
- ❌ Webhook event list view
- ❌ Admin dashboard
- ❌ Payment attempt timeline
- ❌ Reconciliation status UI

**Rationale:** Operator visibility via logs and metrics only. UI deferred to Phase 26+.

### 4.8 No Public APIs

**NOT Delivered:**
- ❌ GET /api/webhooks (list events)
- ❌ GET /api/webhooks/:id (view event)
- ❌ POST /api/invoices/:id/retry (manual retry)

**Rationale:** Webhooks are internal reconciliation mechanism. User-facing APIs deferred to Phase 25C+.

### 4.9 No Encryption or Retention Policies

**NOT Delivered:**
- ❌ Payload encryption
- ❌ Webhook secret rotation
- ❌ Event retention policies
- ❌ Data archival logic

**Rationale:** Infrastructure concerns deferred to Phase 26+.

---

## 5. Architecture Snapshot

### 5.1 System Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ EXECUTION & BILLING (Phase 12-23) — NO WEBHOOK COUPLING        │
│ ----------------------------------------------------------------│
│ Client → Auth → Authz → Quota → ai-service → AIExecutionResult │
│   → UsageRecord → BillingSnapshot → Invoice (Phase 25B-1)      │
│                                                                 │
│ ❌ NO webhook awareness                                         │
│ ❌ NO payment provider dependencies                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SYNCHRONOUS PAYMENT (Phase 25B-2) — NO WEBHOOK COUPLING        │
│ ----------------------------------------------------------------│
│ Invoice → PaymentService.chargeInvoice()                        │
│   → PaymentProvider.charge() (Stripe API call)                 │
│   → PaymentAttempt created (status='pending')                  │
│   → Provider returns: succeeded | failed | pending             │
│   → PaymentAttempt updated                                     │
│                                                                 │
│ ❌ NO webhook processing in sync flow                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ WEBHOOK RECONCILIATION (Phase 25B-3: THIS) — ASYNC UPDATES     │
│ ----------------------------------------------------------------│
│                                                                 │
│ Provider → POST /api/webhooks/payment-provider                 │
│   ↓                                                             │
│ Signature Verification (HMAC-SHA256 + timestamp)               │
│   ↓                                                             │
│ Idempotency Check (provider_event_id uniqueness)               │
│   ↓                                                             │
│ BEGIN TRANSACTION                                               │
│   1. Insert WebhookEvent (status='pending')                    │
│   2. Reconcile PaymentAttempt state (pending → succeeded/failed)│
│   3. Reconcile Invoice state (pending_payment → paid/failed)   │
│   4. Update WebhookEvent (status='processed')                  │
│ COMMIT TRANSACTION                                              │
│   ↓                                                             │
│ Return 200 OK                                                   │
│                                                                 │
│ Guarantees:                                                     │
│   ✅ Exactly-once processing (idempotency)                     │
│   ✅ Deterministic state transitions                           │
│   ✅ Terminal state protection                                 │
│   ✅ No AI execution coupling                                  │
│   ✅ Privacy-preserving (no raw payloads)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Flow

```
Provider Event Lifecycle:

1. Provider processes payment
   → Stripe: payment_intent.succeeded
   → PayPal: PAYMENT.CAPTURE.COMPLETED

2. Provider sends webhook to platform
   → POST /api/webhooks/payment-provider
   → Signed with HMAC-SHA256
   → Timestamped (within ±5 minutes)

3. Platform verifies authenticity
   → Extract signature from header
   → Recompute signature
   → Compare (constant-time)
   → Reject if mismatch or expired

4. Platform checks idempotency
   → Query: SELECT * FROM webhook_events WHERE provider_event_id = ?
   → If exists: return 200 OK (alreadyProcessed=true)
   → If not exists: proceed

5. Platform reconciles state (transaction)
   → Insert WebhookEvent
   → Extract normalized event type (payment.succeeded)
   → Find PaymentAttempt by paymentAttemptId
   → Update PaymentAttempt.status = 'succeeded'
   → Find Invoice by invoiceId
   → Update Invoice.status = 'paid', Invoice.paidAt = now()
   → Update WebhookEvent.processingStatus = 'processed'
   → Commit

6. Platform returns success
   → HTTP 200 OK
   → Provider marks webhook as delivered

Privacy Flow:
  Raw payload → Extract fields → Compute payloadHash (SHA-256)
  → Store extracted fields + hash → Discard raw payload
  → NEVER persist provider JSON
```

### 5.3 State Machine

**PaymentAttempt States (Webhook-Updated):**
```
[pending] (initial, created by PaymentService)
  ↓ payment.succeeded webhook
[succeeded] (terminal, Invoice → paid)

[pending]
  ↓ payment.failed webhook
[failed] (terminal, Invoice → failed or written_off)

Terminal state protection:
  [succeeded] or [failed] → ignore all subsequent webhooks
```

**Invoice States (Webhook-Updated):**
```
[pending_payment] (payment attempt in progress)
  ↓ PaymentAttempt succeeded
[paid] (terminal)

[pending_payment]
  ↓ PaymentAttempt failed (retryable, attempts < 4)
[failed] (temporarily, retry eligible)

[failed]
  ↓ PaymentAttempt failed (non-retryable OR attempts >= 4)
[written_off] (terminal)

Recovery case:
  [written_off] → [paid] (if later PaymentAttempt succeeds)
```

---

## 6. Testing Strategy (Design Only)

### 6.1 Unit Test Coverage

**Signature Verification:**
- Valid signature accepted
- Invalid signature rejected (401)
- Expired timestamp rejected (400)
- Future timestamp rejected (400)

**Idempotency:**
- Duplicate event ignored (alreadyProcessed=true)
- Concurrent duplicates handled (first succeeds, second returns 200)
- Unique events processed independently

**Out-of-Order Events:**
- Succeeded before pending → terminal state wins
- Failed after succeeded → terminal state wins
- Events ignored if state already terminal

**Reconciliation Logic:**
- Succeeded webhook → PaymentAttempt.succeeded, Invoice.paid
- Failed webhook → PaymentAttempt.failed, Invoice.failed or written_off
- Non-existent invoice → processingStatus='ignored'
- Zero-dollar invoice → processingStatus='ignored'

**Conflict Resolution:**
- Terminal state immutability enforced
- Invoice paid state immutability enforced

### 6.2 Integration Test Plan

**End-to-End Flow:**
- Valid webhook → event created, state reconciled, 200 OK

**Signature Failure:**
- Invalid signature → no event created, no state changes, 401

**Idempotency Enforcement:**
- Same webhook twice → one event, one reconciliation, both return 200

**Transaction Rollback:**
- Database error during reconciliation → rollback, no event, 500

**AI Execution Independence:**
- Invalid webhook → webhook fails, AI execution unaffected

### 6.3 Test Environment

- In-memory database (SQLite or PostgreSQL)
- Stub payment provider (no external API calls)
- Test webhook secret
- Pre-created fixtures (invoices, payment attempts)

---

## 7. Operator Visibility

### 7.1 Logging (Safe)

**INFO logs:**
- Webhook received (provider, eventType, invoiceId)
- Webhook processed (providerEventId, duration)

**WARN logs:**
- Webhook ignored (reason: no invoice, terminal state)

**ERROR logs:**
- Webhook processing failed (error type, invoiceId, paymentAttemptId)
- NO raw payloads
- NO signatures
- NO PII

### 7.2 Metrics (Prometheus-Style)

```
webhook_received_total{provider, event_type}
webhook_processed_total{provider, processing_status}
webhook_ignored_total{provider, reason}
webhook_error_total{provider, error_type}
webhook_processing_duration_seconds{provider}
webhook_signature_verification_failures_total{provider}
```

### 7.3 No UI in Phase 25B-3

Operator visibility via logs and metrics only. Admin dashboard deferred to Phase 26+.

---

## 8. Safe Resume Point

### 8.1 Phase 25B-3 Status

**Status:** COMPLETE and LOCKED

**Design Deliverables:**
- ✅ Webhook endpoint contract (POST /api/webhooks/payment-provider)
- ✅ Signature verification strategy (HMAC-SHA256, ±5 min tolerance)
- ✅ Idempotency strategy (provider_event_id UNIQUE constraint)
- ✅ WebhookEvent entity schema (canonical model)
- ✅ Privacy-preserving storage (payloadHash, no raw payloads)
- ✅ Deterministic reconciliation rules (PaymentAttempt + Invoice)
- ✅ Out-of-order and conflict handling (terminal state protection)
- ✅ Transaction boundaries (atomic insert + reconcile)
- ✅ Security measures (replay prevention, no sensitive logging)
- ✅ Testing plan (unit + integration test matrix)
- ✅ Explicit non-goals documented

**Design Correctness:**
- Privacy issue corrected: Removed rawEventPayload storage, replaced with payloadHash
- Scope issue corrected: Removed rate limiting (reclassified as infrastructure concern)

**No Implementation:**
Phase 25B-3 contains ZERO code, entities, migrations, or tests. All design only.

### 8.2 What is LOCKED

**Locked Invariants (Cannot Change Without User Approval):**
- Execution isolation (ai-service unchanged, webhook failures don't block execution)
- BillingSnapshot immutability (webhooks read-only)
- Invoice amount immutability (webhooks can only update status)
- Deterministic reconciliation (same event stream → same final state)
- Privacy guarantees (no raw payloads, no PII storage)
- Throw-only error semantics (errors thrown, not returned as success)

**Locked Design Elements:**
- Endpoint: POST /api/webhooks/payment-provider
- Signature verification: HMAC-SHA256 with ±5 minute tolerance
- Idempotency: provider_event_id UNIQUE constraint
- Storage: payloadHash (SHA-256), no rawEventPayload
- Reconciliation: Normalized event types → state transitions
- Terminal state protection: succeeded/written_off immutable

### 8.3 What is NOT Implemented

**No Code:**
- NO WebhookController
- NO WebhookEvent entity code
- NO migration files
- NO signature verification implementation
- NO reconciliation logic
- NO tests

**No Infrastructure:**
- NO rate limiting
- NO background jobs
- NO queues
- NO Stripe SDK

**No Features:**
- NO refunds/disputes
- NO notifications
- NO UI/dashboards
- NO public APIs

### 8.4 Next Allowable Phase

**Phase 25B-3-IMPL: Webhook Implementation (NOT AUTHORIZED)**

**Scope (if authorized):**
- Implement WebhookController (POST /api/webhooks/payment-provider)
- Implement WebhookEvent entity (TypeORM)
- Create migration for webhook_events table
- Implement signature verification (Stripe, Stub providers)
- Implement idempotency checks
- Implement reconciliation logic
- Implement error handling
- Write unit tests (signature, idempotency, reconciliation)
- Write integration tests (end-to-end webhook flow)

**Prerequisites:**
- ✅ Phase 25B-3 (Webhook Design) COMPLETE
- ✅ Phase 25B-2 (Payment Attempt System) COMPLETE
- ✅ Phase 25B-1 (Invoice Persistence) COMPLETE

**Unlocks:**
- Automatic payment state updates from provider
- Resilient payment reconciliation (webhooks as source-of-truth)
- Complete audit trail for provider events

**NOT Authorized Yet:** Requires explicit user approval to proceed.

---

## 9. Design Corrections History

### 9.1 Privacy Correction (Applied)

**Original Design Issue:**
- Stored rawEventPayload field (full provider JSON)
- Risk: Provider payloads may contain PII
- Violation: Privacy guarantees

**Correction Applied:**
- Removed rawEventPayload field
- Added payloadHash field (SHA-256 one-way hash)
- Updated storage schema (payload_hash VARCHAR(64))
- Updated documentation (section 8.4)

**Result:**
- NO PII or raw provider data stored
- Debugging via hash correlation to provider dashboards
- Privacy guarantee preserved

### 9.2 Scope Correction (Applied)

**Original Design Issue:**
- Included rate limiting in core design (section 8.5)
- Scope creep: Rate limiting is infrastructure concern

**Correction Applied:**
- Removed rate limiting from Phase 25B-3 scope
- Reclassified as infrastructure/policy concern (out of scope)
- Updated endpoint visibility (removed rate limit mention)
- Updated implementation scope (removed rate limit setup)

**Result:**
- Phase 25B-3 focused on: ingestion, idempotency, reconciliation
- Rate limiting deferred to infrastructure layer (nginx, Kong)
- Clean separation of concerns

---

## 10. Phase 25B-3 Lock Policy

**Phase 25B-3 Design is LOCKED.**

**Modifications Require:**
1. Explicit user approval to reopen Phase 25B-3
2. Updated ARCHITECTURE.md (if architectural changes)
3. Updated PRD.md (if scope changes)
4. New Phase 25B-3-REVISION checkpoint

**Safe Clarifications (No Reopening):**
- Adding examples or diagrams
- Clarifying ambiguous wording
- Fixing typos
- Adding provider-specific signature examples

**Unsafe Modifications (Reopening Required):**
- Changing webhook endpoint contract
- Changing event schema
- Changing reconciliation rules
- Changing idempotency strategy
- Violating locked invariants

---

## ULTRA-BRIEF SUMMARY

• **Phase 25B-3 defines complete webhook reconciliation design** with provider-agnostic POST /api/webhooks/payment-provider endpoint accepting asynchronous payment events, authenticating via HMAC-SHA256 signature with ±5 minute timestamp tolerance for replay prevention, enforcing exactly-once processing via provider_event_id UNIQUE constraint, and deterministically reconciling PaymentAttempt (pending → succeeded/failed) and Invoice (pending_payment → paid/failed/written_off) state with terminal state protection preventing backwards transitions

• **Privacy guarantees enforced via payload-free storage** with NO rawEventPayload persistence (corrected from original design), ONLY payloadHash (SHA-256 one-way hash) stored for verification/debug correlation, NO provider payloads or PII stored in database, debugging relying on hash correlation to provider dashboards where full events are retained, and extracted fields only (invoiceId, amount, status, providerReferenceId) persisted for reconciliation

• **Complete isolation from execution and billing preserved** where webhook failures NEVER affect AI execution (ai-service unchanged, /api/ai/execute remains functional regardless of webhook errors), BillingSnapshot remains immutable and read-only (no webhook writes), Invoice financial data immutable (amounts/lineItems/periods FROZEN, only status/paidAt mutable), PaymentAttempt immutable except status/failureCode/completedAt updates during reconciliation, and deterministic state transitions ensure same event stream always produces same final state (no randomness, no race conditions)

• **Status: COMPLETE and LOCKED** with all design deliverables finalized (endpoint contract, signature verification, idempotency strategy, canonical entity schema, reconciliation rules, testing plan), two corrections applied (privacy: removed rawEventPayload, scope: removed rate limiting as infrastructure concern), explicit non-goals documented (no implementation, no SDKs, no background jobs, no rate limiting, no refunds/disputes, no notifications, no UI), and safe resume point established for Phase 25B-3-IMPL (webhook implementation) pending explicit user authorization

---

**END OF PHASE 25B-3 FINAL CHECKPOINT**

**Phase 25B-3 design is COMPLETE and LOCKED.**

**Next phase (Phase 25B-3-IMPL: Webhook Implementation) requires explicit user authorization.**
