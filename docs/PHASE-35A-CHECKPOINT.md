# PHASE 35A CHECKPOINT

**Phase:** 35A — Product Surface Definition (Design Only)  
**Stage:** DESIGN / SPECIFICATION ONLY  
**Title:** Product UI Surface Definition  
**Status:** ✅ COMPLETE  
**Date:** 2026-02-10  
**Previous Checkpoint:** PHASE-34B-CHECKPOINT.md

---

## Executive Summary

Phase 35A defines the **minimal, correct product UI surface** for the AI Sandbox Platform based strictly on validated findings from Phase 34B. This is a **design specification only** with NO implementation.

**Key Principle:**  
The UI exists to solve **validated friction points** discovered during real-world usage observation. Every surface, interaction, and capability traces directly to a specific problem documented in Phase 34B.

**Critical Decision:**  
This is NOT a "developer tools dashboard." This is a **developer-facing product** that enables AI-assisted coding workflows. The UI must get out of the way once the system is working correctly.

---

## 1. Target User Definition

### Primary Persona

**Who:** Software developers building applications with AI assistance

**Expertise Assumed:**
- ✅ Understands basic web development concepts
- ✅ Familiar with terminal commands and environment variables
- ✅ Knows what an API key is and how to use it
- ✅ Comfortable with git and version control
- ✅ Understands HTTP status codes (404, 429, 503, etc.)

**Expertise NOT Assumed:**
- ❌ Does NOT know the internal architecture of this platform
- ❌ Does NOT know which services exist or how they communicate
- ❌ Does NOT know what "api-gateway" or "container-manager" means
- ❌ Does NOT know what startup validators do
- ❌ Does NOT want to read logs to diagnose errors
- ❌ Does NOT want to manually coordinate service startup

**Mental Model:**
- "I want to chat with AI and build software"
- "The system should just work"
- "If something breaks, tell me what to do"
- "I don't care about internal services, I care about my project"

---

## 2. Core Problems to Solve

Derived directly from Phase 34B findings, ordered by severity:

### P0 - Blocking Problems (Must Solve)

**Problem 1: Environment Setup Friction**
- **Finding:** Phase 34B Section 1 — "Time to First Success: ~10-15 minutes"
- **User Impact:** Cannot start the platform without expert knowledge
- **What Failed:** No "one command" startup, cryptic failures, manual `.env` editing
- **Must Solve:** Get from "nothing running" to "ready to code" in < 1 minute

**Problem 2: Error Messages Are Cryptic**
- **Finding:** Phase 34B Section 3 — "Provider unknown temporarily unavailable"
- **User Impact:** Cannot diagnose problems without reading terminal logs
- **What Failed:** No remediation guidance, misleading messages, no context
- **Must Solve:** Every error must tell user exactly what to do next

**Problem 3: Configuration Changes Require Restart**
- **Finding:** Phase 34B Section 2 — "Time to Reload: ~10-15 seconds"
- **User Impact:** Slow iteration when testing different AI providers
- **What Failed:** No hot-reload, no visual indicator of current config
- **Must Solve:** Change AI provider without restarting services

### P1 - Quality of Life Problems (Should Solve)

**Problem 4: Multi-Service Startup Complexity**
- **Finding:** Phase 34B Section 5 — "Time to Start All Services: ~2-3 minutes"
- **User Impact:** Must manually start three services in correct order
- **What Failed:** No orchestration, no dependency checking
- **Must Solve:** Single command to start everything

**Problem 5: API Key Management**
- **Finding:** Phase 34B Section 4 — "Hardcoded in ApiKeyConfig class"
- **User Impact:** Cannot create/revoke keys without code changes
- **What Failed:** No user-facing key management
- **Must Solve:** Create and manage API keys via UI

**Problem 6: No System State Visibility**
- **Finding:** Phase 34B Section 7 — "What the AI Needed But Couldn't Get"
- **User Impact:** Cannot see what's running or what configuration is active
- **What Failed:** No status endpoint, no service dashboard
- **Must Solve:** Always show current system state

### P2 - Nice to Have (Can Defer)

**Problem 7: Startup Feels Slow**
- **Finding:** Phase 34B Section 6 — "API Gateway startup: ~6-7s"
- **User Impact:** No progress indicator during startup
- **What Failed:** No fast mode for development
- **Can Defer:** Startup is already fast enough, just needs visibility

**Problem 8: No Request Tracing**
- **Finding:** Phase 34B Section 7 — "No request ID for tracing"
- **User Impact:** Cannot debug multi-service request flows
- **What Failed:** No correlation IDs, no request history
- **Can Defer:** Advanced debugging feature, not needed for basic usage

---

## 3. Non-Goals

Explicit list of things the product UI will **NOT** do:

### Out of Scope (Explicitly)

❌ **NOT a DevOps Dashboard**
- Will NOT show CPU/memory graphs
- Will NOT show container orchestration details
- Will NOT show database query performance
- Will NOT show network topology

❌ **NOT an Admin Panel**
- Will NOT manage user accounts (single-user for now)
- Will NOT manage billing and payments
- Will NOT manage quotas across multiple users
- Will NOT show audit logs

❌ **NOT a Monitoring System**
- Will NOT replace proper logging infrastructure
- Will NOT show historical metrics
- Will NOT send alerts or notifications
- Will NOT integrate with external monitoring

❌ **NOT a Code Editor**
- Will NOT replace Monaco Editor (already exists)
- Will NOT show file tree (already exists)
- Will NOT show git diffs (already exists)
- Will NOT provide code completion

❌ **NOT a Chat Interface**
- Will NOT replace the chat UI (already exists)
- Will NOT show conversation history (already exists)
- Will NOT provide AI model selection (handled by backend)

### Deferred to Future Phases

⏸️ **Multi-User Features**
- User authentication and authorization
- Team collaboration
- Project sharing
- Access control

⏸️ **Advanced Debugging**
- Request replay
- Performance profiling
- Distributed tracing
- Log aggregation

⏸️ **Billing and Usage**
- Usage dashboards
- Cost estimation
- Quota management UI
- Payment integration

---

## 4. Minimal Product Surface

Conceptual surfaces (not screens) that solve validated problems:

### Surface 1: System Readiness

**Purpose:** Solve Problem 1 (Environment Setup Friction) and Problem 6 (No System State Visibility)

**What It Enables:**
- User knows if system is ready to use
- User knows what's wrong if system is not ready
- User can fix problems without reading logs

**What Data It Needs (Conceptually):**
- Service status: running / stopped / error
- Dependency status: PostgreSQL, Redis, etc.
- Configuration validity: NODE_ENV, AI_PROVIDER, API keys
- Startup progress: which checks passed/failed

**Interaction Model:**
- **Always visible** when system is not ready
- **Gets out of the way** when system is ready
- **Actionable** — every error has a fix button

**Example States:**
- ✅ "System Ready" → hide this surface, show main UI
- ⚠️ "PostgreSQL not running" → show "Start PostgreSQL" button
- ❌ "NODE_ENV not set" → show "Set NODE_ENV to 'development'" button
- 🔄 "Starting services..." → show progress indicator

---

### Surface 2: Configuration Control

**Purpose:** Solve Problem 3 (Configuration Changes Require Restart)

**What It Enables:**
- User can change AI provider without restarting
- User can see current configuration at a glance
- User can validate configuration before applying
- User can rollback if configuration fails

**What Data It Needs (Conceptually):**
- Current AI_PROVIDER value
- Available providers (stub, anthropic, openai, xai)
- Provider-specific requirements (e.g., XAI_API_KEY)
- Configuration validation status

**Interaction Model:**
- **Visible on demand** — not always shown
- **Immediate feedback** — validate before applying
- **Reversible** — can rollback to previous config
- **Non-blocking** — doesn't interrupt coding workflow

**Example States:**
- Current: "Using stub provider (no API key required)"
- Change: "Switch to xai" → validates XAI_API_KEY → applies or shows error
- Error: "XAI_API_KEY not set" → shows remediation: "Add XAI_API_KEY to .env"

---

### Surface 3: API Key Management

**Purpose:** Solve Problem 5 (API Key Management)

**What It Enables:**
- User can create API keys for authentication
- User can revoke keys that are compromised
- User can see when keys were last used
- User can copy keys for use in requests

**What Data It Needs (Conceptually):**
- List of API keys (id, name, created_at, last_used_at)
- Key scopes (ai:execute, session:create, etc.)
- Key status (active, revoked)
- Usage statistics (request count, last used)

**Interaction Model:**
- **Visible on demand** — accessed via settings or menu
- **Secure** — keys shown once on creation, then hidden
- **Auditable** — shows when keys were created/used/revoked
- **Simple** — create/revoke only, no complex permissions

**Example Actions:**
- Create: "New API Key" → generates key → shows once → user copies
- Revoke: "Revoke Key" → confirms → marks as revoked → immediate effect
- View: Shows list of keys with last used time

---

### Surface 4: Error Remediation

**Purpose:** Solve Problem 2 (Error Messages Are Cryptic)

**What It Enables:**
- User understands what went wrong
- User knows exactly what to do next
- User can fix problems without external help
- User can retry after fixing

**What Data It Needs (Conceptually):**
- Error message (human-readable)
- Error context (which service, which operation)
- Remediation steps (ordered, actionable)
- Documentation link (if available)
- Request ID (for support/debugging)

**Interaction Model:**
- **Shown on error** — appears when something fails
- **Actionable** — provides buttons for common fixes
- **Dismissible** — user can close after reading
- **Persistent** — recent errors accessible for review

**Example Error (Before):**
```json
{
  "message": "Provider unknown temporarily unavailable",
  "error": "Service Unavailable",
  "statusCode": 503
}
```

**Example Error (After):**
```
❌ AI Provider Not Available

Problem: The xai provider requires an API key, but XAI_API_KEY is not set.

How to Fix:
1. Get an API key from https://x.ai/api
2. Add to .env: XAI_API_KEY=your-key-here
3. Click "Reload Configuration" below

OR

Switch to stub provider (no API key required):
[Switch to Stub Provider]

Request ID: req_abc123
```

---

### Surface 5: Startup Orchestration

**Purpose:** Solve Problem 4 (Multi-Service Startup Complexity)

**What It Enables:**
- User starts all services with one action
- User sees startup progress in real-time
- User knows when system is ready to use
- User can diagnose startup failures

**What Data It Needs (Conceptually):**
- Service list (api-gateway, ai-service, frontend)
- Dependency list (PostgreSQL, Redis)
- Startup sequence (order of operations)
- Progress status (pending, starting, running, failed)

**Interaction Model:**
- **Triggered on demand** — user clicks "Start System"
- **Shows progress** — real-time status updates
- **Handles failures** — stops on error, shows remediation
- **Idempotent** — safe to retry after fixing errors

**Example Flow:**
```
Starting AI Sandbox Platform...

✅ PostgreSQL (running)
✅ Redis (running)
🔄 API Gateway (starting...)
⏳ AI Service (waiting for API Gateway)
⏳ Frontend (waiting for API Gateway)

[Cancel]
```

---

## 5. Interaction Principles

How humans, AI, and system interact:

### Principle 1: Visibility Without Noise

**Rule:** Show critical information always, everything else on demand

**What's Always Visible:**
- System readiness status (ready / not ready)
- Current AI provider
- Active session (if any)
- Recent errors (if any)

**What's Hidden Until Needed:**
- Service details (unless there's an error)
- Configuration options (unless user is changing config)
- API key management (unless user needs keys)
- Request history (unless user is debugging)

**Rationale:** Users want to code, not monitor infrastructure. Only show infrastructure when it's blocking them.

---

### Principle 2: Errors Are Opportunities

**Rule:** Every error must teach the user something

**What Every Error Must Include:**
1. **What happened** (in plain language)
2. **Why it happened** (root cause)
3. **How to fix it** (actionable steps)
4. **How to prevent it** (optional, for learning)

**What Errors Must NOT Include:**
- Stack traces (unless user explicitly requests)
- Internal service names (api-gateway, container-manager)
- Technical jargon (503 Service Unavailable)
- Vague messages ("something went wrong")

**Rationale:** Phase 34B showed that cryptic errors waste 5-10 minutes per occurrence. Good errors save time and teach users.

---

### Principle 3: Configuration Is Explicit

**Rule:** Never change configuration silently

**What This Means:**
- User must explicitly approve configuration changes
- System must validate configuration before applying
- System must show what will change before changing it
- System must allow rollback if change fails

**What This Prevents:**
- Accidental provider switches
- Silent failures due to missing API keys
- Configuration drift between services
- Confusion about which config is active

**Rationale:** Phase 34B showed that configuration confusion wastes time. Explicit configuration builds trust.

---

### Principle 4: Progressive Disclosure

**Rule:** Show simple things first, complex things on demand

**Levels of Detail:**
1. **Status** — "System Ready" or "System Not Ready"
2. **Summary** — "3 services running, 0 errors"
3. **Details** — List of services with individual status
4. **Diagnostics** — Logs, request IDs, internal state

**User Control:**
- User can drill down for more detail
- User can collapse back to summary
- User can hide diagnostics when not needed

**Rationale:** Most of the time, users just need to know "is it working?" Only show details when troubleshooting.

---

### Principle 5: Idempotency and Safety

**Rule:** Every action must be safe to retry

**What This Means:**
- Starting services is idempotent (no-op if already running)
- Stopping services is idempotent (no-op if already stopped)
- Creating API keys generates new key each time (not an error)
- Revoking API keys is idempotent (no-op if already revoked)

**What This Prevents:**
- Fear of clicking buttons
- Confusion about current state
- Accidental duplicate operations
- Need for confirmation dialogs

**Rationale:** Users should feel confident clicking buttons. Idempotency removes fear.

---

## 6. Failure & Recovery Philosophy

How errors should be presented and remediated:

### Philosophy 1: Fail Fast, Recover Faster

**Principle:** Detect problems immediately, provide instant remediation

**Detection:**
- Validate configuration at startup (Phase 32A validators)
- Validate requests before execution (guards)
- Validate dependencies before starting services

**Remediation:**
- Show fix button next to every error
- Automate common fixes (e.g., "Start PostgreSQL")
- Provide copy-paste commands for manual fixes

**Example:**
```
❌ PostgreSQL Not Running

The system requires PostgreSQL to store session data.

[Start PostgreSQL Automatically]

OR

Start manually:
$ brew services start postgresql

[Retry]
```

---

### Philosophy 2: Context Over Codes

**Principle:** Replace HTTP codes with human context

**Bad (Current):**
```
503 Service Unavailable
```

**Good (Target):**
```
❌ AI Provider Not Ready

The xai provider is configured but the API key is missing.

Fix: Add XAI_API_KEY to .env
```

**Mapping:**
| HTTP Code | User-Facing Message |
|-----------|---------------------|
| 404 Not Found | "Session not found. It may have expired or been deleted." |
| 410 Gone | "Session terminated due to idle timeout. Create a new session to continue." |
| 429 Too Many Requests | "Request limit reached. Wait 60 seconds or upgrade your plan." |
| 503 Service Unavailable | "AI provider not available. Check configuration." |

---

### Philosophy 3: Remediation Is Built-In

**Principle:** Don't just show errors, provide fixes

**Remediation Types:**

**Type 1: Automated Fix**
- System can fix the problem automatically
- Example: Start PostgreSQL, reload configuration
- UI: Show button that executes fix

**Type 2: Guided Fix**
- User must take action, but system guides them
- Example: Add API key to .env, install dependency
- UI: Show step-by-step instructions with copy-paste commands

**Type 3: External Fix**
- Problem is outside system control
- Example: AI provider API is down, network issue
- UI: Show status page link, suggest alternatives

**Type 4: User Error**
- User made a mistake (e.g., invalid input)
- Example: Invalid session ID, malformed request
- UI: Show what was wrong, what's expected

---

### Philosophy 4: Errors Are Temporary

**Principle:** Errors should disappear when fixed

**Behavior:**
- Error shown → user fixes problem → error auto-dismisses
- No manual dismissal needed (system detects fix)
- Recent errors accessible for review (but not blocking)

**Example Flow:**
1. System shows: "PostgreSQL not running"
2. User starts PostgreSQL
3. System detects PostgreSQL is now running
4. Error disappears automatically
5. System shows: "System Ready"

---

### Philosophy 5: Never Hide Critical Errors

**Principle:** Blocking errors must be impossible to ignore

**Critical Errors (Blocking):**
- Service startup failures
- Database connection failures
- Missing required configuration
- Security violations

**Non-Critical Errors (Non-Blocking):**
- Slow request warnings
- Quota approaching limit
- Deprecated API usage
- Optional feature unavailable

**UI Treatment:**
- Critical: Modal or full-screen, cannot be dismissed until fixed
- Non-Critical: Toast or banner, can be dismissed, accessible in history

---

## 7. Success Criteria

How we know the UI is "working" for users:

### Criterion 1: Time to First Success

**Metric:** Time from "nothing running" to "first AI request succeeds"

**Current (Phase 34B):** 10-15 minutes  
**Target:** < 1 minute  

**How to Measure:**
- Start timer when user runs first command
- Stop timer when first AI request returns 200 OK
- Include all setup, configuration, and startup time

**Success Indicator:**
- New developer can start system without documentation
- No manual .env editing required
- No terminal log reading required

---

### Criterion 2: Error Resolution Time

**Metric:** Time from "error occurs" to "error resolved"

**Current (Phase 34B):** 5-10 minutes (with log reading)  
**Target:** < 30 seconds  

**How to Measure:**
- Start timer when error occurs
- Stop timer when user successfully retries
- Include diagnosis and remediation time

**Success Indicator:**
- User understands error without reading logs
- User knows exactly what to do
- User can fix error without external help

---

### Criterion 3: Configuration Change Time

**Metric:** Time to switch AI provider

**Current (Phase 34B):** 10-15 seconds (with restart)  
**Target:** < 2 seconds (no restart)  

**How to Measure:**
- Start timer when user initiates change
- Stop timer when new provider is active
- Include validation and application time

**Success Indicator:**
- No service restart required
- Validation happens before applying
- User sees immediate feedback

---

### Criterion 4: Zero Log Reading

**Metric:** Percentage of errors that require reading terminal logs

**Current (Phase 34B):** 100% (all errors require log reading)  
**Target:** 0% (no errors require log reading)  

**How to Measure:**
- Track errors that occur during usage
- Count how many require terminal log access
- Calculate percentage

**Success Indicator:**
- All error information visible in UI
- Remediation steps shown in UI
- Logs only needed for advanced debugging

---

### Criterion 5: Single-Command Startup

**Metric:** Number of commands required to start system

**Current (Phase 34B):** 3 commands (one per service)  
**Target:** 1 command (all services)  

**How to Measure:**
- Count terminal commands user must run
- Include dependency checking
- Include service coordination

**Success Indicator:**
- `npm run start:all` starts everything
- Dependency checks happen automatically
- Services start in correct order

---

### Criterion 6: API Key Self-Service

**Metric:** Can user create API key without code changes?

**Current (Phase 34B):** No (hardcoded in ApiKeyConfig)  
**Target:** Yes (via UI)  

**How to Measure:**
- User creates new API key via UI
- Key is immediately usable
- No code changes required
- No service restart required

**Success Indicator:**
- UI provides "Create API Key" button
- Key is generated and shown once
- Key works immediately in requests

---

## 8. Conceptual Data Requirements

What data the UI needs (conceptually, not implementation):

### Data Category 1: System State

**What:**
- Service status (running, stopped, error)
- Service health (healthy, degraded, unhealthy)
- Dependency status (PostgreSQL, Redis, etc.)
- Configuration validity (valid, invalid, missing)

**Why:**
- Surface 1 (System Readiness) needs this
- Surface 5 (Startup Orchestration) needs this

**Update Frequency:**
- Real-time during startup
- Periodic polling when running (every 5-10 seconds)
- Immediate on error

---

### Data Category 2: Configuration State

**What:**
- Current AI_PROVIDER value
- Available providers
- Provider requirements (API keys, etc.)
- Configuration validation results

**Why:**
- Surface 2 (Configuration Control) needs this

**Update Frequency:**
- On demand (when user opens config UI)
- Immediate after change

---

### Data Category 3: API Keys

**What:**
- List of API keys (id, name, created_at)
- Key status (active, revoked)
- Key scopes (ai:execute, etc.)
- Usage statistics (last_used_at, request_count)

**Why:**
- Surface 3 (API Key Management) needs this

**Update Frequency:**
- On demand (when user opens key management UI)
- Immediate after create/revoke

---

### Data Category 4: Error Context

**What:**
- Error message (human-readable)
- Error cause (root cause)
- Remediation steps (ordered list)
- Request ID (for tracing)
- Timestamp (when it occurred)

**Why:**
- Surface 4 (Error Remediation) needs this

**Update Frequency:**
- Immediate when error occurs
- Historical errors on demand

---

### Data Category 5: Startup Progress

**What:**
- Service list (api-gateway, ai-service, frontend)
- Dependency list (PostgreSQL, Redis)
- Progress status (pending, starting, running, failed)
- Startup logs (for diagnostics)

**Why:**
- Surface 5 (Startup Orchestration) needs this

**Update Frequency:**
- Real-time during startup
- Final state when complete

---

## 9. Workflow Mapping

How surfaces support user workflows:

### Workflow 1: First-Time Startup

**User Goal:** Start the system for the first time

**Steps:**
1. User runs `npm run start:all`
2. **Surface 5 (Startup Orchestration)** shows progress
3. If dependency missing → **Surface 4 (Error Remediation)** shows fix
4. User fixes dependency
5. System retries automatically
6. **Surface 1 (System Readiness)** shows "System Ready"
7. User proceeds to coding

**Success:** User never reads logs, never manually starts services

---

### Workflow 2: Change AI Provider

**User Goal:** Switch from stub to real AI provider

**Steps:**
1. User opens **Surface 2 (Configuration Control)**
2. User selects "xai" provider
3. System validates XAI_API_KEY
4. If missing → **Surface 4 (Error Remediation)** shows how to add it
5. User adds XAI_API_KEY to .env
6. User clicks "Apply Configuration"
7. System hot-reloads configuration (no restart)
8. **Surface 1 (System Readiness)** shows "Using xai provider"
9. User proceeds to coding

**Success:** No service restart, immediate feedback, clear errors

---

### Workflow 3: Create API Key

**User Goal:** Create API key for authentication

**Steps:**
1. User opens **Surface 3 (API Key Management)**
2. User clicks "Create API Key"
3. System generates key
4. System shows key once (with copy button)
5. User copies key
6. User uses key in requests
7. Key works immediately (no restart)

**Success:** Self-service, no code changes, immediate effect

---

### Workflow 4: Diagnose Error

**User Goal:** Understand why AI request failed

**Steps:**
1. User makes AI request
2. Request fails with error
3. **Surface 4 (Error Remediation)** shows:
   - What happened
   - Why it happened
   - How to fix it
4. User follows remediation steps
5. User retries request
6. Request succeeds

**Success:** No log reading, clear remediation, fast resolution

---

### Workflow 5: System Recovery

**User Goal:** Recover from service crash

**Steps:**
1. Service crashes (e.g., api-gateway)
2. **Surface 1 (System Readiness)** shows "api-gateway stopped"
3. **Surface 4 (Error Remediation)** shows crash reason
4. User clicks "Restart Service"
5. **Surface 5 (Startup Orchestration)** shows restart progress
6. Service restarts successfully
7. **Surface 1 (System Readiness)** shows "System Ready"
8. User proceeds to coding

**Success:** Automated recovery, no manual terminal commands

---

## 10. Architectural Constraints

Constraints from ARCHITECTURE.md that the UI must respect:

### Constraint 1: Request-Driven Enforcement

**From:** ARCHITECTURE.md Section 2 — "Request-Driven Enforcement"

**What It Means:**
- No background workers
- No polling loops
- No cron jobs
- All state changes happen on request

**UI Implication:**
- UI must poll for state updates (system won't push)
- UI must trigger actions via API requests
- UI must handle eventual consistency

---

### Constraint 2: Persistent Terminal State

**From:** ARCHITECTURE.md Section 4 — "TERMINATED is final"

**What It Means:**
- Session termination is permanent
- No resurrection
- 410 Gone is forever

**UI Implication:**
- UI must clearly indicate terminated sessions
- UI must prevent actions on terminated sessions
- UI must guide user to create new session

---

### Constraint 3: HTTP-Only Communication

**From:** ARCHITECTURE.md Section 1 — "All communication is HTTP-only"

**What It Means:**
- No WebSocket for control plane
- No message queues
- No event buses

**UI Implication:**
- UI uses REST APIs for all control operations
- UI uses polling for state updates
- UI uses WebSocket ONLY for preview traffic

---

### Constraint 4: Service Ownership

**From:** ARCHITECTURE.md Section 3 — "Explicit Ownership"

**What It Means:**
- API Gateway owns auth, not runtime
- Container Manager owns runtime, not auth
- No shared state between services

**UI Implication:**
- UI must call correct service for each operation
- UI must not assume services share state
- UI must handle cross-service consistency

---

### Constraint 5: No Background Cleanup

**From:** ARCHITECTURE.md Section 11 — "Explicit Non-Goals"

**What It Means:**
- No automatic session cleanup
- No automatic container removal
- No scheduled tasks

**UI Implication:**
- UI must provide manual cleanup actions
- UI must show resource usage
- UI must guide user to clean up when needed

---

## 11. What This Phase Does NOT Define

Explicitly out of scope for Phase 35A:

### NOT Defined: Visual Design

❌ Colors, fonts, spacing
❌ Component library selection
❌ Layout and positioning
❌ Icons and imagery
❌ Responsive breakpoints

**Why:** Phase 35A defines WHAT surfaces exist, not HOW they look

---

### NOT Defined: Technical Implementation

❌ React components
❌ State management (Redux, Context, etc.)
❌ API client implementation
❌ Routing strategy
❌ Build configuration

**Why:** Phase 35A is design only, no implementation

---

### NOT Defined: API Endpoints

❌ Endpoint paths
❌ Request/response schemas
❌ HTTP methods
❌ Authentication headers

**Why:** UI consumes existing APIs, doesn't define new ones (unless Phase 35B identifies gaps)

---

### NOT Defined: Data Models

❌ Database schemas
❌ TypeScript interfaces
❌ Validation rules
❌ Serialization formats

**Why:** UI uses existing data models from backend

---

## 12. Dependencies and Prerequisites

What must exist before Phase 35B (implementation):

### Prerequisite 1: Existing APIs

**Required:**
- ✅ Health check endpoints (already exist)
- ✅ AI execution endpoint (already exists)
- ✅ Session management endpoints (already exist)

**May Need:**
- ❓ Configuration management endpoint (may need to add)
- ❓ API key management endpoints (may need to add)
- ❓ System status endpoint (may need to add)

**Decision:** Phase 35B will identify API gaps

---

### Prerequisite 2: Existing Services

**Required:**
- ✅ API Gateway (already exists)
- ✅ AI Service (already exists)
- ✅ Frontend (already exists)

**May Need:**
- ❓ Orchestration script (may need to add)
- ❓ Configuration hot-reload (may need to add)

**Decision:** Phase 35B will identify service gaps

---

### Prerequisite 3: Existing Data

**Required:**
- ✅ Session state (already exists in database)
- ✅ Usage ledger (already exists)
- ✅ Quota state (already exists)

**May Need:**
- ❓ API key storage (currently hardcoded)
- ❓ Configuration state (currently in .env files)
- ❓ Error history (currently in logs)

**Decision:** Phase 35B will identify data gaps

---

## 13. Validation Against Phase 34B

Ensuring all validated problems are addressed:

### Phase 34B Problem → Phase 35A Surface

| Phase 34B Finding | Problem | Phase 35A Surface | How It Solves |
|-------------------|---------|-------------------|---------------|
| Section 1 | Environment Setup Friction | Surface 5 (Startup Orchestration) | Single-command startup |
| Section 2 | Configuration Reload Requires Restart | Surface 2 (Configuration Control) | Hot-reload configuration |
| Section 3 | Error Messages Are Cryptic | Surface 4 (Error Remediation) | Clear errors with remediation |
| Section 4 | API Key Management | Surface 3 (API Key Management) | Self-service key creation |
| Section 5 | Multi-Service Startup Complexity | Surface 5 (Startup Orchestration) | Automated orchestration |
| Section 6 | Latency Observations | Surface 5 (Startup Orchestration) | Progress visibility |
| Section 7 | What AI Needed But Couldn't Get | Surface 1 (System Readiness) | System state visibility |
| Section 8 | What Humans Had to Compensate For | All Surfaces | Eliminate manual coordination |

**Coverage:** 100% of Phase 34B problems addressed

---

## 14. Alignment with PRD and Architecture

### PRD Alignment

**PRD Section 2: Product Goals**
- ✅ "Isolated, reproducible coding sandbox" → UI doesn't interfere with isolation
- ✅ "AI-assisted code generation" → UI enables AI interaction
- ✅ "Strong governance guarantees" → UI respects termination, quotas
- ✅ "Predictable lifecycle behavior" → UI shows lifecycle state clearly

**PRD Section 3E: AI Integration**
- ✅ "AI actions subject to same governance" → UI shows governance state
- ✅ "AI cannot bypass termination" → UI prevents actions on terminated sessions

**PRD Section 6: Error & Status Semantics**
- ✅ UI translates HTTP codes to human-readable messages
- ✅ UI respects 410 Gone as permanent
- ✅ UI shows remediation for 429 Too Many Requests

---

### Architecture Alignment

**ARCHITECTURE.md Section 2: Architecture Principles**
- ✅ Determinism → UI shows deterministic state
- ✅ Request-Driven Enforcement → UI polls, doesn't assume push
- ✅ Persistent Terminal State → UI respects termination
- ✅ Idempotency → UI actions are safe to retry

**ARCHITECTURE.md Section 8: API Design**
- ✅ UI uses public APIs only
- ✅ UI never calls internal APIs
- ✅ UI respects JWT authentication

**ARCHITECTURE.md Section 11: Explicit Non-Goals**
- ✅ UI doesn't assume background cleanup
- ✅ UI doesn't assume clustering
- ✅ UI doesn't assume resurrection

---

## 15. Success Metrics Summary

How we measure if Phase 35 succeeds:

| Metric | Current (34B) | Target (35) | How to Measure |
|--------|---------------|-------------|----------------|
| Time to First Success | 10-15 min | < 1 min | Startup to first AI request |
| Error Resolution Time | 5-10 min | < 30 sec | Error to successful retry |
| Configuration Change Time | 10-15 sec | < 2 sec | Provider switch duration |
| Zero Log Reading | 0% (all errors) | 100% (no errors) | Errors resolved without logs |
| Single-Command Startup | 3 commands | 1 command | Commands to start system |
| API Key Self-Service | No | Yes | Can create key via UI |

---

## 16. Phase 35B Readiness

What Phase 35B (implementation) needs from this checkpoint:

### Inputs for Phase 35B

✅ **5 Surfaces Defined:**
1. System Readiness
2. Configuration Control
3. API Key Management
4. Error Remediation
5. Startup Orchestration

✅ **5 Interaction Principles:**
1. Visibility Without Noise
2. Errors Are Opportunities
3. Configuration Is Explicit
4. Progressive Disclosure
5. Idempotency and Safety

✅ **5 Failure Philosophies:**
1. Fail Fast, Recover Faster
2. Context Over Codes
3. Remediation Is Built-In
4. Errors Are Temporary
5. Never Hide Critical Errors

✅ **6 Success Criteria:**
1. Time to First Success < 1 min
2. Error Resolution Time < 30 sec
3. Configuration Change Time < 2 sec
4. Zero Log Reading
5. Single-Command Startup
6. API Key Self-Service

✅ **5 Workflows Mapped:**
1. First-Time Startup
2. Change AI Provider
3. Create API Key
4. Diagnose Error
5. System Recovery

---

### Questions for Phase 35B

Phase 35B must answer:

1. **API Gaps:** What endpoints are missing?
2. **Component Design:** What React components are needed?
3. **State Management:** How to manage UI state?
4. **Polling Strategy:** How often to poll for updates?
5. **Error Handling:** How to handle API errors?
6. **Orchestration:** How to implement single-command startup?
7. **Hot-Reload:** How to reload configuration without restart?
8. **Key Storage:** Where to store API keys (database)?

---

## 17. Risks and Mitigations

Potential risks in implementing this design:

### Risk 1: API Gaps

**Risk:** Required endpoints don't exist yet

**Mitigation:**
- Phase 35B will identify gaps early
- Add minimal endpoints only (no over-engineering)
- Respect ARCHITECTURE.md constraints

---

### Risk 2: Hot-Reload Complexity

**Risk:** Configuration hot-reload may be technically difficult

**Mitigation:**
- Start with restart-based approach (already works)
- Add hot-reload incrementally
- Document limitations clearly

---

### Risk 3: Orchestration Complexity

**Risk:** Single-command startup may require significant changes

**Mitigation:**
- Use simple shell script initially
- Add proper orchestration later if needed
- Don't over-engineer (no Kubernetes)

---

### Risk 4: Scope Creep

**Risk:** Implementation may expand beyond validated problems

**Mitigation:**
- Strict adherence to Phase 34B findings
- No features unless they solve validated problems
- Regular checkpoint reviews

---

### Risk 5: User Confusion

**Risk:** UI may still be confusing despite design

**Mitigation:**
- User testing with real developers
- Iterate based on feedback
- Measure success criteria continuously

---

## 18. Conclusion

### Summary

Phase 35A defines a **minimal, correct product UI surface** that solves the validated friction points discovered in Phase 34B. The design prioritizes:

1. **Getting out of the way** — UI is visible when needed, hidden when not
2. **Clear errors** — Every error teaches the user something
3. **Explicit configuration** — No silent changes
4. **Progressive disclosure** — Simple by default, detailed on demand
5. **Idempotency** — Safe to retry everything

### Key Decisions

**What We're Building:**
- 5 conceptual surfaces (not screens)
- 5 interaction principles
- 5 failure philosophies
- 6 success criteria

**What We're NOT Building:**
- DevOps dashboard
- Admin panel
- Monitoring system
- Code editor
- Chat interface

### Next Steps

**Phase 35B (Implementation) will:**
1. Identify API gaps
2. Design React components
3. Implement surfaces
4. Measure success criteria
5. Iterate based on feedback

**Phase 35B must NOT:**
- Expand scope beyond this design
- Add features not validated by Phase 34B
- Violate ARCHITECTURE.md constraints
- Over-engineer solutions

---

## 19. Approval and Sign-Off

### Design Approval Checklist

- ✅ All Phase 34B problems addressed
- ✅ All surfaces trace to validated problems
- ✅ All non-goals explicitly stated
- ✅ All success criteria measurable
- ✅ All architectural constraints respected
- ✅ All workflows mapped
- ✅ All risks identified

### Governance Compliance

- ✅ Aligned with PRD.md
- ✅ Aligned with ARCHITECTURE.md
- ✅ Aligned with CLAUDE.md
- ✅ Based on Phase 34B findings
- ✅ No implementation in this phase
- ✅ No code changes
- ✅ Design only

---

**Document Status:** Authoritative  
**Alignment:** CLAUDE.md + PRD.md + ARCHITECTURE.md + PHASE-34B  
**Nature:** Design Specification Only (No Implementation)  
**Next Phase:** 35B — Product Surface Implementation
