# ARCHITECTURE.md — System Architecture
## AI Sandbox Platform

---

## Authority Notice

This document defines the system architecture.

All implementation must conform to this file and CLAUDE.md.

If conflicts arise, these documents take precedence.

---

## Repository Layout (CRITICAL)

All source code lives in the repository root.

There is NO `aiSandBox/` subdirectory.

All paths are relative to root.

### Canonical Paths

```
services/api-gateway/
services/ai-service/
services/container-manager/
frontend/
backend/
```

Any change to this layout requires explicit approval.

---

## Table of Contents

1. System Overview  
2. Architecture Principles  
3. Service Architecture  
4. Session Lifecycle  
5. Governance Model  
6. Preview Architecture  
7. Data Model  
8. API Design  
9. Container Isolation  
10. Error Semantics  
11. Explicit Non-Goals  
12. Summary

---

## 1. System Overview

### High-Level Architecture

```
Browser
   │
   ▼
Frontend (Next.js)
   │
   ▼
API Gateway (NestJS)
   │
   ▼
Container Manager
   │
   ▼
Docker Runtime
```

All communication is HTTP-only.

No message queues.
No event buses.
No background workers.

---

## 2. Architecture Principles

### Core Principles

#### Determinism
- Same input → same output
- No background state mutation

#### Request-Driven Enforcement
- Governance only on requests
- No cron jobs
- No schedulers

#### Persistent Terminal State
- Termination is permanent
- Stored in database

#### Idempotency
- Safe retries
- No duplicate effects

#### Explicit Ownership
- Each service owns its domain
- No shared state

---

## 3. Service Architecture

### API Gateway

Owns:

- Authentication
- Authorization
- User identity
- Session ownership

Does NOT own:

- Containers
- Runtime
- Enforcement

Path:
```
services/api-gateway/
```

---

### Container Manager

Owns:

- Docker lifecycle
- Governance
- Termination
- Preview routing
- Runtime state

Does NOT own:

- Auth
- User data

Path:
```
services/container-manager/
```

---

### AI Service

Owns:

- AI adapters
- Token accounting
- Execution routing

Path:
```
services/ai-service/
```

---

## 4. Session Lifecycle

### States

```
CREATED → ACTIVE → TERMINATED
```

TERMINATED is final.

No resurrection.

---

### Enforcement Order

1. Exists? → 404
2. Terminated? → 410
3. Max lifetime? → 410
4. Idle timeout? → 410
5. Concurrency? → 429
6. Execute

---

## 5. Governance Model

### Layers

```
Request → Application → Container
```

---

### Application-Level

- Max lifetime
- Idle timeout (in-memory)
- Exec concurrency

---

### Container-Level

- CPU limits
- Memory limits
- PID limits
- Filesystem isolation

---

## 6. Preview Architecture

Preview is passive proxy only.

No governance logic inside preview channel.

WebSocket = preview only.

Never control plane.

---

## 7. Data Model

### Current Database

SQLite (single-process safe)

Authoritative source.

---

### Session Table

```sql
id
user_id
created_at
last_activity_at
terminated_at
termination_reason
```

terminated_at ≠ NULL → terminal.

---

## 8. API Design

### Public APIs

```
POST   /api/sessions
GET    /api/sessions/:id
DELETE /api/sessions/:id
POST   /api/sessions/:id/exec
```

JWT required.

Ownership enforced.

---

### Internal APIs (LOCKED)

```
POST /api/internal/sessions/:id/start
POST /api/internal/sessions/:id/stop
POST /api/internal/sessions/:id/error
POST /api/internal/git-checkpoints
```

Never expose.

Never refactor.

---

## 9. Container Isolation

### Stack

- Docker
- Overlay FS
- Namespaces
- cgroups
- gVisor (planned)

---

### Filesystem

Only `/workspace` is writable.

No host mounts.

---

## 10. Error Semantics

| Code | Meaning |
|------|----------|
| 404  | Not found |
| 410  | Terminated |
| 429  | Rate limit |
| 502  | Preview failure |

410 is permanent.

---

## 11. Explicit Non-Goals

- No background cleanup
- No clustering
- No distributed locks
- No resurrection
- No event bus
- No cron

All intentional.

---

## 12. Summary

This architecture prioritizes:

- Determinism
- Simplicity
- Auditability
- Governance
- Predictability

Trade-offs:

- No horizontal scaling
- No HA
- Single-node focus

These are accepted.

---

Document Status: Authoritative  
Alignment: CLAUDE.md + PRD.md  
Layout: Root-Based Monorepo
