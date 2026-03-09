# CLAUDE.md — AI Sandbox Platform Governance & Working Contract

---

## Project Overview

AI Sandbox Platform enables users to build software by chatting with AI inside isolated containers.

The platform consists of:

- Frontend (Next.js with chat + code editor + preview)
- Backend (NestJS API + services)
- Sandbox runtime (Docker + gVisor)
- Git auto-commit and checkpoint system
- Billing and usage tracking

---

## Tech Stack

Frontend:
- Next.js
- React
- Monaco Editor

Backend:
- NestJS (TypeScript)

Database:
- PostgreSQL
- Redis

Container Runtime:
- Docker
- gVisor

Optional Agents:
- Multi-AI interactions

---

## Key Goals

- Stateless API
- One isolated container per session
- Token-accurate billing
- Consistent git commits after every action
- Easy import/export of projects
- Deterministic and auditable execution

---

## Project Governance Loop (CRITICAL)

All work on this project follows a closed-loop governance model:

PRD → ARCHITECTURE → TASKS_BACKLOG → TASKS → CHECKPOINTS → CODE → PRD

Meaning:

1. PRD.md defines product intent
2. ARCHITECTURE.md defines system design
3. TASKS_BACKLOG_FULL.md defines full scope
4. TASKS.md defines active work
5. /docs contains checkpoints
6. Code implements approved checkpoints
7. PRD.md is updated if scope changes

Rules:

- No code may be written without an active task
- No task may be completed without a checkpoint
- No checkpoint may exist without source tasks
- No document may contradict the PRD
- No governance step may be skipped
- No undocumented work is permitted

If any conflict exists, this governance loop takes precedence.

---

## Important Commands

```bash
npm install
npm run dev
npm test
docker compose up
```

---

## Conventions

- TypeScript ES modules
- Linting with ESLint + Prettier
- Write tests for every service
- Keep functions < 120 lines
- Use clear, atomic commit messages
- Use consistent file naming (lowercase + hyphens)
- No silent breaking changes

---

## Codebase Base Path (CRITICAL)

All source code lives in the **repository root directory**.

When creating, updating, or referring to code files, always use paths relative to the repository root.

### Examples

```
services/api-gateway/src/...
services/ai-service/src/...
services/container-manager/src/...
frontend/src/...
backend/src/...
```

Do NOT reference a non-existent `aiSandBox/` subdirectory.

All tooling, patches, and diffs must match this layout.

---

## Directory Structure (Expected)

```
/
  CLAUDE.md
  ARCHITECTURE.md
  PRD.md
  TASKS.md
  TASKS_BACKLOG_FULL.md
  docker-compose.yml
  package.json
  frontend/
  backend/
  services/
    api-gateway/
    ai-service/
    container-manager/
```

Any deviation must be explicitly approved by the user.

---

## Workflow Rules (How Claude Must Behave)

- Only work on the current task/module explicitly specified by the user
- Ask for clarification if anything is ambiguous
- Stop immediately after completing the assigned task
- Never refactor unrelated code unless explicitly requested
- Always ask before adding new dependencies
- Avoid architectural changes unless explicitly instructed
- Write minimal, focused unit tests when required
- When generating code, always include full file paths
- Provide code with proper syntax highlighting
- Do not start dev servers unless explicitly instructed

---

## ARCHITECTURE.md Loading Rules

When asked to reference or use ARCHITECTURE.md:

- Always ask which specific section is relevant
- Never paste the entire file
- Use targeted reads only:

```
/read ARCHITECTURE.md <section>
```

- Confirm before loading
- Briefly summarize after reading

---

## session_log.md Loading Rules

When asked to reference or use session_log.md:

- Ask which section or date range is needed
- Never paste the entire file
- Use targeted reads only
- Confirm before loading
- Summarize briefly if needed

---

## Environment & Sandbox Rules (Vibecode)

### System Instructions

All project work must be inside:

```
/home/vibecode/workspace
```

Do not install system-wide packages.

Do not assume shared state between sandboxes.

---

### Dev Server Rules

Never run:

```bash
npm run dev
npm start
```

unless explicitly instructed by the user.

The user controls dev servers via UI.

You may update `/home/vibecode/bin/run` only if requested.

---

## Internal API Endpoints (Architecture Lock)

The following API Gateway endpoints are INTERNAL-ONLY and MUST NOT be treated as public APIs.

### Session Lifecycle  
(container-manager → api-gateway)

```
POST /api/internal/sessions/:sessionId/start
POST /api/internal/sessions/:sessionId/stop
POST /api/internal/sessions/:sessionId/error
```

### Git Checkpoints  
(container-manager → api-gateway)

```
POST /api/internal/git-checkpoints
```

---

## Internal API Rules

- These endpoints are ONLY called by internal services
- They are NOT exposed to frontend or external clients
- They MUST NOT be documented as public APIs
- They MUST NOT be reused by other services
- Authentication and authorization are intentionally deferred

---

## Explicit Restrictions (CRITICAL)

Claude MUST NOT:

- Add JWT guards
- Add API keys
- Add auth middleware
- Add RBAC checks
- Add network restrictions
- Refactor internal endpoints into public APIs
- Redesign routing for internal endpoints
- Introduce shared libraries between services

---

## Future Protection (NOT To Be Implemented Yet)

The following are architectural placeholders only:

- Internal API keys
- mTLS
- Private network routing
- Service identity verification

Do NOT implement these unless explicitly authorized.

---

## Undo & Versioning Rules

- When revising code, provide patch/diff-style updates
- Do not delete user code without confirmation
- Do not squash or rewrite git history unless asked
- Preserve checkpoint integrity

---

## Diff Output Rule

When showing code changes, always use standard unified diff format.

Requirements:
- Use `git diff` style
- Start with `diff --git a/... b/...`
- Include `---` and `+++`
- Include `@@` hunk headers
- Keep context to about 3 lines
- Do not reprint whole files
- Do not describe changes as separate “deleted” / “added” blocks
- Do not add prose before or after the diff unless explicitly asked

---

## Final Authority Clause

This file defines architectural intent.

If any instruction conflicts with:

- implementation assumptions
- convenience refactors
- best-practice automation
- AI “helpfulness” shortcuts

👉 THIS FILE WINS.
