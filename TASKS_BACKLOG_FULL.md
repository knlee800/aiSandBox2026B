## Authority Notice

This document is the MASTER task backlog.

All implementation tasks originate here.

Other task documents derive from this file:

- TASKS.md → Active / selected tasks
- Checkpoints → Completion records

Rules:

- No task may be invented outside this file
- No task may be executed unless listed here
- All checkpoints must reference task IDs from this file
- Deprecated tasks must be marked, never deleted

This file is the single source of truth for project scope.


# TASKS.md — Project Task Breakdown
## AI Sandbox Platform

---

## Overview

This document breaks down the AI Sandbox Platform into discrete, actionable tasks organized by module. Each task includes priority, dependencies, and acceptance criteria.

**Priority Levels:**
- 🔴 **High**: Critical for MVP, blocks other work
- 🟡 **Medium**: Important but not blocking
- 🟢 **Low**: Nice-to-have, polish, future features

**Important:** Follow CLAUDE.md workflow rules:
- Only work on current module specified by user
- Ask for clarifications if ambiguous
- Stop after completing assigned task
- Never refactor unrelated code unless requested
- Always ask before adding new dependencies

---

## Module 1: Project Setup & Infrastructure

### Task 1.1: Initialize Project Structure
**Priority:** 🔴 High
**Dependencies:** None
**Description:**
- Create monorepo structure with `/frontend`, `/backend`, `/services`, `/db`, `/docs`, `/tests`
- Initialize git repository
- Set up `.gitignore` for Node.js/TypeScript projects
- Create `.env.example` template

**Acceptance Criteria:**
- [ ] Directory structure matches ARCHITECTURE.md Section 1
- [ ] Git initialized with initial commit
- [ ] README.md with project overview created
- [ ] .env.example includes all required secrets

**Effort:** 1 hour

---

### Task 1.2: Setup TypeScript Configuration
**Priority:** 🔴 High
**Dependencies:** 1.1
**Description:**
- Configure `tsconfig.json` for both frontend and backend
- Set up ES modules
- Configure path aliases
- Enable strict mode

**Acceptance Criteria:**
- [ ] TypeScript compiles without errors
- [ ] ES module imports work correctly
- [ ] Path aliases configured for clean imports
- [ ] Strict mode enabled

**Effort:** 2 hours

---

### Task 1.3: Setup Linting & Formatting
**Priority:** 🟡 Medium
**Dependencies:** 1.2
**Description:**
- Install ESLint with TypeScript parser
- Configure Prettier
- Add pre-commit hooks with Husky
- Create `.eslintrc` and `.prettierrc`

**Acceptance Criteria:**
- [ ] `npm run lint` runs successfully
- [ ] `npm run format` formats code consistently
- [ ] Pre-commit hooks prevent bad commits
- [ ] Functions kept under 120 lines as per CLAUDE.md conventions

**Effort:** 2 hours

---

### Task 1.4: Setup Docker Environment
**Priority:** 🔴 High
**Dependencies:** 1.1
**Description:**
- Install Docker and Docker Compose
- Create `docker-compose.yml` for local development
- Configure gVisor runtime (runsc)
- Set up Docker secrets management

**Acceptance Criteria:**
- [ ] Docker Compose starts all services
- [ ] gVisor runtime installed and configured
- [ ] Can create isolated containers with gVisor
- [ ] Docker secrets configured per ARCHITECTURE.md Section 10

**Effort:** 4 hours

---

## Module 2: Database Setup

### Task 2.1: PostgreSQL Setup
**Priority:** 🔴 High
**Dependencies:** 1.4
**Description:**
- Add PostgreSQL container to docker-compose
- Create initial database schema
- Set up connection pooling
- Configure encryption at rest

**Acceptance Criteria:**
- [ ] PostgreSQL container starts successfully
- [ ] Can connect from backend
- [ ] Database persists after container restart
- [ ] Encryption configured for sensitive fields

**Effort:** 2 hours

---

### Task 2.2: Redis Setup
**Priority:** 🔴 High
**Dependencies:** 1.4
**Description:**
- Add Redis container to docker-compose
- Configure Redis for session storage and caching
- Set up pub/sub channels
- Configure for rate limiting

**Acceptance Criteria:**
- [ ] Redis container starts successfully
- [ ] Can connect from backend
- [ ] Pub/sub working for real-time events
- [ ] Rate limiting storage configured

**Effort:** 2 hours

---

### Task 2.3: TypeORM Integration
**Priority:** 🔴 High
**Dependencies:** 2.1, 1.2
**Description:**
- Install TypeORM and pg driver
- Configure TypeORM with NestJS
- Create base entity classes
- Set up migration system

**Acceptance Criteria:**
- [ ] TypeORM connects to PostgreSQL
- [ ] Migrations system working
- [ ] Can run `npm run migration:run`
- [ ] Parameterized queries enforced (prevent SQL injection)

**Effort:** 3 hours

---

### Task 2.4: Define Data Models
**Priority:** 🔴 High
**Dependencies:** 2.3
**Description:**
- Create entity models: User, Session, ChatMessage, GitCommit, BillingLog, Container
- Define relationships (1:N, etc.)
- Add validation decorators
- Implement encryption for sensitive fields

**Acceptance Criteria:**
- [ ] All entities match ERD in ARCHITECTURE.md Section 4
- [ ] Relationships properly defined with foreign keys
- [ ] Validation works on entity fields
- [ ] Sensitive fields encrypted (email, payment info)
- [ ] Initial migration generated

**Effort:** 4 hours

---

### Task 2.5: Create Repository Layer
**Priority:** 🔴 High
**Dependencies:** 2.4
**Description:**
- Create repositories for each entity
- Implement common CRUD operations
- Add custom query methods
- Ensure all queries use parameterization

**Acceptance Criteria:**
- [ ] Repository pattern implemented
- [ ] Basic CRUD works for all entities
- [ ] Custom queries tested
- [ ] No raw SQL with string concatenation

**Effort:** 3 hours

---

## Module 3: Backend - Core Infrastructure

### Task 3.1: NestJS Project Setup
**Priority:** 🔴 High
**Dependencies:** 1.2, 2.3
**Description:**
- Initialize NestJS application in `/backend`
- Configure modules, controllers, services structure
- Set up dependency injection
- Configure environment variables with validation

**Acceptance Criteria:**
- [ ] NestJS app starts on port 3002
- [ ] Health check endpoint returns 200
- [ ] Environment variables loaded and validated from .env
- [ ] Modular structure matches ARCHITECTURE.md Section 2
- [ ] Missing secrets throw errors at startup

**Effort:** 3 hours

---

### Task 3.2: Error Handling Infrastructure
**Priority:** 🔴 High
**Dependencies:** 3.1
**Description:**
- Implement global exception filter
- Create standard error response format
- Define error code categories
- Add correlation ID middleware

**Reference:** ARCHITECTURE.md Section 11

**Acceptance Criteria:**
- [ ] All errors return consistent JSON structure
- [ ] Error codes match ARCHITECTURE.md Section 11
- [ ] Correlation IDs added to all requests
- [ ] X-Correlation-Id header in responses
- [ ] Stack traces included in error logs (not exposed to clients)

**Effort:** 4 hours

---

### Task 3.3: Centralized Logging Setup
**Priority:** 🔴 High
**Dependencies:** 3.2
**Description:**
- Install and configure Winston logger
- Implement structured logging format
- Add correlation ID to all logs
- Configure log levels (debug, info, warn, error, critical)
- Set up log rotation

**Reference:** ARCHITECTURE.md Section 11

**Acceptance Criteria:**
- [ ] Winston configured with JSON format
- [ ] Logs include timestamp, level, service, correlationId
- [ ] Log files: error.log and combined.log
- [ ] Secrets redacted in logs
- [ ] Log rotation configured
- [ ] 90-day retention policy

**Effort:** 3 hours

---

### Task 3.4: Authentication & User Service
**Priority:** 🔴 High
**Dependencies:** 3.1, 2.5, 3.3
**Description:**
- Implement user registration
- Implement login with JWT
- Create auth middleware
- Hash passwords with bcrypt
- Implement JWT validation
- Add password strength validation

**Reference:** ARCHITECTURE.md Section 10

**Acceptance Criteria:**
- [ ] POST /auth/register creates user
- [ ] POST /auth/login returns JWT token
- [ ] Protected routes require valid JWT
- [ ] Passwords stored as bcrypt hashes
- [ ] JWT expires after 24 hours
- [ ] Tokens stored securely (httpOnly cookies)
- [ ] All auth attempts logged

**Effort:** 5 hours

---

### Task 3.5: Rate Limiting Service
**Priority:** 🔴 High
**Dependencies:** 2.2, 3.2
**Description:**
- Implement Redis-based rate limiting
- Configure per-user and per-endpoint limits
- Add rate limit middleware
- Return proper 429 responses with Retry-After header

**Reference:** ARCHITECTURE.md Section 10

**Acceptance Criteria:**
- [ ] Global: 1000 req/hour, 100 req/minute per user
- [ ] /auth/login: 5 req/5min
- [ ] /auth/register: 3 req/hour
- [ ] /chat/send: 60 req/minute
- [ ] /container/exec: 120 req/minute
- [ ] 429 responses include retry info
- [ ] Rate limits tracked by user ID or IP

**Effort:** 4 hours

---

## Module 4: Backend - Core Services

### Task 4.1: Session Service
**Priority:** 🔴 High
**Dependencies:** 3.4, 2.5
**Description:**
- Implement `SessionService` with methods:
  - `createSession(userId, runtimeType)`
  - `getSession(sessionId)`
  - `deleteSession(sessionId)`
  - `listSessions(userId)`
- Add session ownership validation

**Acceptance Criteria:**
- [ ] Sessions stored in database
- [ ] Session lifecycle tracked (active, expired, archived)
- [ ] Auto-expiration after timeout
- [ ] Each session linked to user
- [ ] Ownership validated before operations
- [ ] All operations logged with correlationId

**Effort:** 4 hours

---

### Task 4.2: Container Service - Basic Operations
**Priority:** 🔴 High
**Dependencies:** 4.1, 1.4
**Description:**
- Implement `ContainerService` with Docker SDK
- Methods:
  - `startContainer(sessionId, image)`
  - `stopContainer(containerId)`
  - `execCommand(containerId, command)`
  - `getContainerLogs(containerId)`
- Implement retry logic for container startup

**Reference:** ARCHITECTURE.md Section 11 (Retry Logic)

**Acceptance Criteria:**
- [ ] Can create Docker container with gVisor
- [ ] Container starts in <5 seconds
- [ ] Retry up to 2 times on startup failure
- [ ] Can execute commands in container
- [ ] Logs retrieved successfully
- [ ] Failed containers cleaned up

**Effort:** 6 hours

---

### Task 4.3: Container Service - Isolation & Security
**Priority:** 🔴 High
**Dependencies:** 4.2
**Description:**
- Configure gVisor runtime for containers
- Set resource limits (CPU, memory, disk, network)
- Implement network isolation
- Configure read-only base image with writable overlay
- Run as non-root user
- Drop all capabilities

**Reference:** ARCHITECTURE.md Section 6 & 10

**Acceptance Criteria:**
- [ ] Containers run with gVisor
- [ ] Resource limits enforced (1 core, 2GB RAM, 5GB disk)
- [ ] No inter-container communication
- [ ] Filesystem isolation working
- [ ] Containers run as non-root
- [ ] No privileged mode
- [ ] AppArmor/SELinux profiles applied

**Effort:** 5 hours

---

### Task 4.4: Input Validation Service
**Priority:** 🔴 High
**Dependencies:** 3.1
**Description:**
- Create validation DTOs for all endpoints
- Implement class-validator decorators
- Add validation pipe globally
- Create sanitization utilities for command injection prevention

**Reference:** ARCHITECTURE.md Section 10

**Acceptance Criteria:**
- [ ] All DTOs have validation decorators
- [ ] Invalid requests return 400 with field errors
- [ ] Command injection prevented (use execFile, not execSync)
- [ ] XSS prevention utilities created
- [ ] File upload validation (size, type, malware scan)
- [ ] SQL injection prevented (parameterized queries only)

**Effort:** 4 hours

---

### Task 4.5: Git Service - Repository Management
**Priority:** 🔴 High
**Dependencies:** 4.2, 4.4
**Description:**
- Implement `GitService` with methods:
  - `initRepo(containerId)`
  - `commit(containerId, message, files[])`
  - `getHistory(containerId)`
  - `rollback(containerId, commitHash)`
- Implement rollback on commit failure

**Reference:** ARCHITECTURE.md Section 11 (Rollback)

**Acceptance Criteria:**
- [ ] Git initialized in container workspace
- [ ] Can create commits programmatically (use execFile for safety)
- [ ] Can retrieve commit history
- [ ] Rollback restores previous state
- [ ] Failed commits automatically rolled back
- [ ] Sessions marked corrupted if rollback fails
- [ ] All git operations logged

**Effort:** 5 hours

---

### Task 4.6: AI Gateway Service - Claude Integration
**Priority:** 🔴 High
**Dependencies:** 3.1, 3.3
**Description:**
- Implement `AIGatewayService` with Anthropic SDK
- Methods:
  - `callClaude(messages, stream, correlationId)`
  - `countTokens(content)`
- Handle streaming responses
- Implement retry logic with exponential backoff

**Reference:** ARCHITECTURE.md Section 11 (Retry Logic)

**Acceptance Criteria:**
- [ ] Can send messages to Claude API
- [ ] Streaming responses work
- [ ] Token counting accurate
- [ ] Retry 3 times on 5xx errors with exponential backoff (1s, 2s, 4s)
- [ ] Errors handled gracefully
- [ ] API key never logged
- [ ] Correlation ID passed to Claude API

**Effort:** 4 hours

---

### Task 4.7: Chat Service - Message Handling
**Priority:** 🔴 High
**Dependencies:** 4.6, 4.5, 2.5
**Description:**
- Implement `ChatService` with methods:
  - `sendMessage(sessionId, message, stream)`
  - `getHistory(sessionId, limit, offset)`
  - `streamResponse(sessionId, message)`
- Store messages in database
- Track token usage per message

**Acceptance Criteria:**
- [ ] Messages stored with role (user/assistant)
- [ ] Chat history paginated correctly
- [ ] Token usage tracked per message
- [ ] Streaming works with SSE
- [ ] All operations include correlationId

**Effort:** 5 hours

---

### Task 4.8: Chat Service - Code Execution Integration
**Priority:** 🔴 High
**Dependencies:** 4.7, 4.2, 4.4
**Description:**
- Integrate chat with container execution
- Parse AI responses for code blocks
- Automatically write code to container filesystem
- Execute commands suggested by AI (with validation)

**Acceptance Criteria:**
- [ ] Code blocks from AI written to files
- [ ] Files created in container workspace
- [ ] Commands validated before execution (prevent injection)
- [ ] Command execution results returned to chat
- [ ] Errors handled gracefully

**Effort:** 6 hours

---

### Task 4.9: Chat Service - Auto-commit After Changes
**Priority:** 🔴 High
**Dependencies:** 4.8, 4.5
**Description:**
- Automatically create git commit after each AI interaction
- Generate meaningful commit messages
- Store commit metadata in database
- Handle commit failures with rollback

**Acceptance Criteria:**
- [ ] Git commit created after code changes
- [ ] Commit message describes changes
- [ ] Commit hash stored in database
- [ ] Can rollback to any commit
- [ ] Failed commits trigger rollback

**Effort:** 3 hours

---

### Task 4.10: Billing Service - Token Tracking
**Priority:** 🔴 High
**Dependencies:** 4.7, 2.5
**Description:**
- Implement `BillingService` with methods:
  - `trackTokens(userId, sessionId, tokens, cost)`
  - `enforceQuota(userId)`
  - `getUsage(userId, dateRange)`
  - `generateInvoice(userId, period)`
- Use database transactions for billing operations

**Reference:** ARCHITECTURE.md Section 11 (Rollback)

**Acceptance Criteria:**
- [ ] Token usage logged immutably with transactions
- [ ] Quota enforcement blocks over-usage
- [ ] Usage reports accurate
- [ ] Billing logs never deleted or modified
- [ ] Transaction failures automatically rolled back
- [ ] All billing operations audited in logs

**Effort:** 4 hours

---

### Task 4.11: Project Import Service
**Priority:** 🟡 Medium
**Dependencies:** 4.5, 4.2, 4.4
**Description:**
- Implement file upload endpoint
- Extract .zip/.tar archives
- Scan for malware (ClamAV or basic)
- Import files to container workspace
- Initialize git repository

**Reference:** ARCHITECTURE.md Section 10 (Input Validation)

**Acceptance Criteria:**
- [ ] Can upload .zip archive
- [ ] Files extracted to container
- [ ] File size limited to 100MB
- [ ] Only zip/tar allowed
- [ ] Malware scan runs
- [ ] Git history preserved if present
- [ ] Upload validation matches ARCHITECTURE.md Section 10

**Effort:** 5 hours

---

### Task 4.12: Project Export Service
**Priority:** 🟡 Medium
**Dependencies:** 4.2, 4.5
**Description:**
- Export container workspace as .zip
- Include git history
- Stream download to user

**Acceptance Criteria:**
- [ ] GET /project/export returns .zip
- [ ] Zip contains all workspace files
- [ ] Git history included
- [ ] Large files streamed efficiently

**Effort:** 3 hours

---

## Module 5: Backend - API Endpoints

### Task 5.1: Session Endpoints
**Priority:** 🔴 High
**Dependencies:** 4.1, 3.5, 4.4
**Description:**
- POST /api/sessions - create session
- GET /api/sessions/:id - get session details
- GET /api/sessions - list user sessions
- DELETE /api/sessions/:id - delete session
- Add authorization checks

**Reference:** ARCHITECTURE.md Section 5 & 10

**Acceptance Criteria:**
- [ ] All endpoints respond correctly
- [ ] DTO validation for required fields
- [ ] Authorization checks (user owns session)
- [ ] Proper HTTP status codes
- [ ] Rate limiting applied
- [ ] Standard error format (ARCHITECTURE.md Section 11)
- [ ] Correlation IDs in responses

**Effort:** 3 hours

---

### Task 5.2: Chat Endpoints
**Priority:** 🔴 High
**Dependencies:** 4.7, 3.5, 4.4
**Description:**
- POST /api/chat/send - send message
- GET /api/chat/history/:sessionId - get history
- Add authorization and rate limiting

**Acceptance Criteria:**
- [ ] Messages sent and stored
- [ ] Streaming works with SSE
- [ ] History paginated with limit/offset
- [ ] Only session owner can access
- [ ] Rate limiting: 60 req/minute
- [ ] Standard error format

**Effort:** 3 hours

---

### Task 5.3: Git Endpoints
**Priority:** 🔴 High
**Dependencies:** 4.5, 3.5, 4.4
**Description:**
- POST /api/git/commit - manual commit
- GET /api/git/history/:sessionId - commit history
- POST /api/git/rollback - rollback to commit
- Add authorization

**Acceptance Criteria:**
- [ ] Commits created successfully
- [ ] History shows all commits
- [ ] Rollback restores previous state
- [ ] Only session owner can modify
- [ ] Rollback failures handled gracefully
- [ ] Standard error format

**Effort:** 3 hours

---

### Task 5.4: Container Endpoints
**Priority:** 🔴 High
**Dependencies:** 4.2, 3.5, 4.4
**Description:**
- POST /api/container/exec - execute command
- GET /api/container/logs/:sessionId - get logs
- GET /api/container/preview/:sessionId - preview proxy
- Add security checks

**Acceptance Criteria:**
- [ ] Commands execute in container (validated for injection)
- [ ] Logs streamed in real-time
- [ ] Preview proxies to port 3000
- [ ] Security checks prevent abuse
- [ ] Rate limiting: 120 req/minute for exec
- [ ] Standard error format

**Effort:** 4 hours

---

### Task 5.5: Billing Endpoints
**Priority:** 🟡 Medium
**Dependencies:** 4.10, 3.5
**Description:**
- GET /api/billing/usage/:userId - get usage stats
- GET /api/billing/quota/:userId - check quota
- Add authorization

**Acceptance Criteria:**
- [ ] Usage data returned correctly
- [ ] Date range filtering works
- [ ] Quota shows limit/used/remaining
- [ ] Only user can see their own data
- [ ] Standard error format

**Effort:** 2 hours

---

### Task 5.6: Import/Export Endpoints
**Priority:** 🟡 Medium
**Dependencies:** 4.11, 4.12, 3.5
**Description:**
- POST /api/project/import - upload project
- GET /api/project/export/:sessionId - download project
- Add authorization and validation

**Acceptance Criteria:**
- [ ] File upload works (multipart)
- [ ] Export streams .zip file
- [ ] Progress feedback for uploads
- [ ] File size limits enforced (100MB)
- [ ] Standard error format

**Effort:** 3 hours

---

## Module 6: Backend - WebSocket & Real-time

### Task 6.1: WebSocket Gateway Setup
**Priority:** 🔴 High
**Dependencies:** 3.1, 3.4
**Description:**
- Configure WebSocket gateway in NestJS
- Implement authentication for WebSocket connections
- Set up event handlers
- Add correlation ID to WebSocket messages

**Acceptance Criteria:**
- [ ] WebSocket server running
- [ ] Clients can connect with JWT
- [ ] Events can be sent/received
- [ ] Disconnection handled gracefully
- [ ] Correlation IDs in WebSocket messages

**Effort:** 4 hours

---

### Task 6.2: Real-time Chat Events
**Priority:** 🔴 High
**Dependencies:** 6.1, 4.7
**Description:**
- Implement WebSocket events for chat:
  - `chat.message` (client -> server)
  - `chat.response` (server -> client)
  - `chat.error` (server -> client)
- Use standard error format for WebSocket errors

**Acceptance Criteria:**
- [ ] Messages sent via WebSocket
- [ ] Responses streamed in real-time
- [ ] Errors communicated to client (standard format)
- [ ] Lower latency than HTTP polling

**Effort:** 3 hours

---

### Task 6.3: Container Status Events
**Priority:** 🟡 Medium
**Dependencies:** 6.1, 4.2
**Description:**
- Broadcast container status changes:
  - `container.status` (starting, ready, stopped, error)
  - `container.output` (stdout/stderr)

**Acceptance Criteria:**
- [ ] Status updates pushed to client
- [ ] Container logs streamed in real-time
- [ ] Only session owner receives events

**Effort:** 3 hours

---

### Task 6.4: Editor Sync Events
**Priority:** 🟢 Low
**Dependencies:** 6.1
**Description:**
- Implement file sync events:
  - `editor.change` (client -> server)
  - `editor.sync` (server -> client)
- Allow real-time collaborative editing (future)

**Acceptance Criteria:**
- [ ] File changes pushed to server
- [ ] Changes broadcasted to other clients (if multiple)
- [ ] Conflict resolution strategy defined

**Effort:** 4 hours

---

## Module 7: Frontend - Project Setup

### Task 7.1: Next.js Project Initialization
**Priority:** 🔴 High
**Dependencies:** 1.2
**Description:**
- Initialize Next.js 14+ app in `/frontend`
- Configure TypeScript
- Set up app router structure
- Install core dependencies (React, TailwindCSS, etc.)

**Acceptance Criteria:**
- [ ] Next.js dev server runs on port 3001
- [ ] TypeScript configured
- [ ] App router with basic pages
- [ ] TailwindCSS working

**Effort:** 2 hours

---

### Task 7.2: UI Component Library Setup
**Priority:** 🟡 Medium
**Dependencies:** 7.1
**Description:**
- Install UI library (shadcn/ui, Radix, or similar)
- Create base components: Button, Input, Card, Modal
- Set up theming system

**Acceptance Criteria:**
- [ ] Component library installed
- [ ] Base components created and styled
- [ ] Theming works (light/dark mode optional)
- [ ] Components documented in Storybook (optional)

**Effort:** 4 hours

---

### Task 7.3: API Client Layer
**Priority:** 🔴 High
**Dependencies:** 7.1
**Description:**
- Create API client wrapper using fetch/axios
- Implement authentication interceptor (JWT)
- Add error handling (parse standard error format)
- Configure base URL and endpoints
- Add correlation ID to all requests

**Reference:** ARCHITECTURE.md Section 11 (Error Format)

**Acceptance Criteria:**
- [ ] API client connects to backend
- [ ] JWT token automatically attached
- [ ] Errors parsed using standard format
- [ ] Correlation IDs added to requests
- [ ] TypeScript types for requests/responses

**Effort:** 3 hours

---

### Task 7.4: WebSocket Client Setup
**Priority:** 🔴 High
**Dependencies:** 7.3
**Description:**
- Create WebSocket client wrapper
- Handle connection/disconnection
- Implement event listeners
- Auto-reconnect logic
- Add correlation ID to messages

**Acceptance Criteria:**
- [ ] WebSocket connects to backend
- [ ] Events sent and received
- [ ] Reconnects on disconnection
- [ ] Authentication with JWT
- [ ] Correlation IDs in messages

**Effort:** 3 hours

---

### Task 7.5: State Management Setup
**Priority:** 🔴 High
**Dependencies:** 7.1
**Description:**
- Choose and install state management (Zustand/Redux)
- Create stores for:
  - Auth state
  - Session state
  - Chat state
  - Editor state

**Acceptance Criteria:**
- [ ] State management library installed
- [ ] Stores created and working
- [ ] State persists across page reloads (where needed)
- [ ] DevTools configured

**Effort:** 4 hours

---

## Module 8: Frontend - Authentication & Dashboard

### Task 8.1: Login/Register Pages
**Priority:** 🔴 High
**Dependencies:** 7.2, 7.3
**Description:**
- Create login page with form
- Create register page with form
- Form validation (client-side)
- Connect to auth endpoints
- Display errors using standard format

**Acceptance Criteria:**
- [ ] Login form submits and stores JWT
- [ ] Register form creates new user
- [ ] Validation shows errors
- [ ] Redirects to dashboard on success
- [ ] Error messages from standard format displayed

**Effort:** 4 hours

---

### Task 8.2: Protected Route Wrapper
**Priority:** 🔴 High
**Dependencies:** 8.1, 7.5
**Description:**
- Create auth middleware for Next.js
- Redirect to login if not authenticated
- Store user info in state

**Acceptance Criteria:**
- [ ] Protected routes check authentication
- [ ] Unauthenticated users redirected
- [ ] User info available in components

**Effort:** 2 hours

---

### Task 8.3: Dashboard Page
**Priority:** 🔴 High
**Dependencies:** 8.2, 7.2
**Description:**
- Create dashboard layout
- List user's sessions
- Show session status (active/expired)
- "New Session" button

**Acceptance Criteria:**
- [ ] Dashboard shows user's sessions
- [ ] Can create new session
- [ ] Can open existing session
- [ ] Can delete session

**Effort:** 5 hours

---

## Module 9: Frontend - Session View

### Task 9.1: Session Layout
**Priority:** 🔴 High
**Dependencies:** 8.3
**Description:**
- Create 3-column layout:
  - Left: Chat window
  - Center: Code editor
  - Right: Preview (collapsible)
- Responsive design
- Resizable panels

**Acceptance Criteria:**
- [ ] Layout renders correctly
- [ ] Panels resizable with drag handles
- [ ] Responsive on mobile/tablet
- [ ] Preview can be collapsed

**Effort:** 5 hours

---

### Task 9.2: Chat Window Component
**Priority:** 🔴 High
**Dependencies:** 9.1, 7.4, 7.5
**Description:**
- Create chat UI with message list
- User input box with send button
- Display user and AI messages
- Show typing indicator
- Markdown rendering for AI responses
- Error display using standard format

**Acceptance Criteria:**
- [ ] Messages displayed in order
- [ ] User can send messages
- [ ] AI responses streamed in real-time
- [ ] Code blocks syntax-highlighted
- [ ] Auto-scroll to bottom
- [ ] Errors displayed properly

**Effort:** 6 hours

---

### Task 9.3: Monaco Editor Integration
**Priority:** 🔴 High
**Dependencies:** 9.1
**Description:**
- Install Monaco editor
- Create editor component wrapper
- Configure for multiple languages
- Add file tree navigation

**Acceptance Criteria:**
- [ ] Monaco editor renders
- [ ] Syntax highlighting works
- [ ] File tree shows workspace files
- [ ] Can switch between files
- [ ] Save triggers update to backend

**Effort:** 6 hours

---

### Task 9.4: File Tree Component
**Priority:** 🟡 Medium
**Dependencies:** 9.3
**Description:**
- Display container filesystem as tree
- Expandable folders
- Click to open file in editor
- Icons for file types

**Acceptance Criteria:**
- [ ] File tree shows all workspace files
- [ ] Folders expandable/collapsible
- [ ] Clicking file opens in editor
- [ ] Updates when files added/removed

**Effort:** 4 hours

---

### Task 9.5: Preview Component (iframe)
**Priority:** 🔴 High
**Dependencies:** 9.1, 5.4
**Description:**
- Create iframe component for preview
- Proxy to container port 3000
- Refresh button
- Show loading state
- Secure sandbox attributes

**Acceptance Criteria:**
- [ ] iframe loads preview from backend proxy
- [ ] Refresh reloads preview
- [ ] Loading spinner shown while loading
- [ ] Secure sandbox attributes on iframe

**Effort:** 3 hours

---

### Task 9.6: Git History UI
**Priority:** 🟡 Medium
**Dependencies:** 9.1, 5.3
**Description:**
- Display commit history in sidebar/modal
- Show commit message, timestamp, hash
- Rollback button for each commit
- Confirm before rollback

**Acceptance Criteria:**
- [ ] Commit history displayed
- [ ] Can rollback to any commit
- [ ] Confirmation dialog before rollback
- [ ] Editor updates after rollback

**Effort:** 4 hours

---

## Module 10: Frontend - Advanced Features

### Task 10.1: Terminal Component
**Priority:** 🟢 Low
**Dependencies:** 9.1, 7.4
**Description:**
- Create terminal UI using xterm.js
- Connect to container via WebSocket
- Allow command execution
- Show stdout/stderr

**Acceptance Criteria:**
- [ ] Terminal renders and accepts input
- [ ] Commands executed in container
- [ ] Output displayed in real-time
- [ ] Command history with up/down arrows

**Effort:** 5 hours

---

### Task 10.2: File Upload/Download UI
**Priority:** 🟡 Medium
**Dependencies:** 5.6
**Description:**
- Upload files to container
- Download files from container
- Drag-and-drop support
- Progress indicators

**Acceptance Criteria:**
- [ ] Can upload files via drag-drop or button
- [ ] Progress bar shows upload status
- [ ] Can download individual files
- [ ] File size limits enforced (100MB)

**Effort:** 4 hours

---

### Task 10.3: Usage & Billing Dashboard
**Priority:** 🟡 Medium
**Dependencies:** 8.3, 5.5
**Description:**
- Show token usage stats
- Display quota remaining
- Cost breakdown by session
- Charts/graphs for visualization

**Acceptance Criteria:**
- [ ] Current usage displayed
- [ ] Quota progress bar shown
- [ ] Historical usage viewable
- [ ] Charts render correctly

**Effort:** 5 hours

---

## Module 11: Security Implementation

### Task 11.1: Security Headers & CORS
**Priority:** 🔴 High
**Dependencies:** 3.1
**Description:**
- Install and configure Helmet.js
- Configure CORS for specific origins
- Set up Content Security Policy
- Enable HSTS

**Reference:** ARCHITECTURE.md Section 10

**Acceptance Criteria:**
- [ ] Helmet.js configured with CSP
- [ ] CORS limited to specific origins
- [ ] HSTS enabled (max-age: 31536000)
- [ ] TLS 1.2 minimum enforced

**Effort:** 2 hours

---

### Task 11.2: Secrets Management
**Priority:** 🔴 High
**Dependencies:** 1.1, 3.1
**Description:**
- Create .env.example template
- Implement secret validation at startup
- Document all required secrets
- Set up Docker secrets (Phase 1)
- Plan cloud secrets management (Phase 2)

**Reference:** ARCHITECTURE.md Section 10

**Acceptance Criteria:**
- [ ] .env.example lists all secrets
- [ ] Missing secrets throw error at startup
- [ ] Secrets never logged
- [ ] Docker secrets configured
- [ ] Rotation policy documented

**Effort:** 3 hours

---

### Task 11.3: Container Security Hardening
**Priority:** 🔴 High
**Dependencies:** 4.3
**Description:**
- Configure AppArmor/SELinux profiles
- Ensure non-root user in containers
- Drop all capabilities
- Audit container security settings

**Reference:** ARCHITECTURE.md Section 10

**Acceptance Criteria:**
- [ ] Containers run as non-root
- [ ] All capabilities dropped
- [ ] AppArmor/SELinux profiles active
- [ ] No privileged mode
- [ ] Security audit passes

**Effort:** 4 hours

---

### Task 11.4: Dependency Security Scanning
**Priority:** 🟡 Medium
**Dependencies:** 1.3
**Description:**
- Set up npm audit in CI/CD
- Configure Dependabot
- Document update policy
- Lock dependency versions for production

**Reference:** ARCHITECTURE.md Section 10

**Acceptance Criteria:**
- [ ] npm audit runs on every commit
- [ ] Dependabot enabled
- [ ] Monthly update schedule documented
- [ ] Production dependencies locked

**Effort:** 2 hours

---

## Module 12: Testing

### Task 12.1: Backend Unit Tests
**Priority:** 🟡 Medium
**Dependencies:** Module 4 complete
**Description:**
- Write unit tests for all services
- Mock database and external APIs
- Aim for 70%+ code coverage
- Test error handling paths

**Acceptance Criteria:**
- [ ] All services have unit tests
- [ ] Tests pass with `npm test`
- [ ] Coverage report generated
- [ ] 70%+ coverage achieved
- [ ] Error handling tested

**Effort:** 10 hours

---

### Task 12.2: Backend Integration Tests
**Priority:** 🟡 Medium
**Dependencies:** Module 5 complete
**Description:**
- Write integration tests for API endpoints
- Use test database
- Test with actual Docker containers
- Test error responses match standard format

**Acceptance Criteria:**
- [ ] All endpoints tested
- [ ] Tests run in CI/CD pipeline
- [ ] Test database cleaned between runs
- [ ] Container creation/deletion tested
- [ ] Error format validated

**Effort:** 8 hours

---

### Task 12.3: Frontend Component Tests
**Priority:** 🟢 Low
**Dependencies:** Module 9 complete
**Description:**
- Write tests for React components
- Use React Testing Library
- Mock API calls

**Acceptance Criteria:**
- [ ] Key components tested
- [ ] Tests run with `npm test`
- [ ] Mock data used
- [ ] User interactions tested

**Effort:** 8 hours

---

### Task 12.4: End-to-End Tests
**Priority:** 🟢 Low
**Dependencies:** Modules 4, 5, 9 complete
**Description:**
- Write E2E tests with Playwright/Cypress
- Test complete user flows:
  - Login -> Create session -> Chat -> Preview
  - Git commit -> Rollback
- Test error scenarios

**Acceptance Criteria:**
- [ ] E2E tests cover main user flows
- [ ] Tests run in CI/CD
- [ ] Screenshots on failure
- [ ] Tests stable and not flaky
- [ ] Error handling tested

**Effort:** 10 hours

---

## Module 13: Documentation

### Task 13.1: API Documentation
**Priority:** 🟡 Medium
**Dependencies:** Module 5 complete
**Description:**
- Document all API endpoints
- Use Swagger/OpenAPI
- Include request/response examples
- Document standard error format
- Authentication requirements

**Acceptance Criteria:**
- [ ] Swagger UI accessible at /api/docs
- [ ] All endpoints documented
- [ ] Error format documented
- [ ] Examples provided
- [ ] Try-it-out feature works

**Effort:** 4 hours

---

### Task 13.2: Developer Guide
**Priority:** 🟢 Low
**Dependencies:** All modules
**Description:**
- Write setup instructions
- Explain architecture (reference ARCHITECTURE.md sections)
- Code examples for common tasks
- Troubleshooting guide
- Document ARCHITECTURE.md loading rules

**Acceptance Criteria:**
- [ ] README.md updated with setup steps
- [ ] Developer guide in /docs/DEVELOPER.md
- [ ] Examples for extending platform
- [ ] Common issues documented
- [ ] References to ARCHITECTURE.md sections

**Effort:** 6 hours

---

### Task 13.3: User Guide
**Priority:** 🟢 Low
**Dependencies:** Module 9 complete
**Description:**
- Create user-facing documentation
- How to create sessions
- How to use chat interface
- Tips for effective AI prompts

**Acceptance Criteria:**
- [ ] User guide published
- [ ] Screenshots included
- [ ] Video tutorials (optional)
- [ ] FAQ section

**Effort:** 4 hours

---

## Module 14: Deployment

### Task 14.1: Docker Images for Production
**Priority:** 🔴 High
**Dependencies:** Modules 4, 7 complete
**Description:**
- Create production Dockerfiles for frontend and backend
- Multi-stage builds for smaller images
- Optimize for security and performance
- Non-root user in containers

**Acceptance Criteria:**
- [ ] Frontend Docker image builds
- [ ] Backend Docker image builds
- [ ] Images under 500MB each
- [ ] Non-root user in containers
- [ ] Security best practices followed

**Effort:** 4 hours

---

### Task 14.2: Docker Compose for QNAP
**Priority:** 🔴 High
**Dependencies:** 14.1, 2.1, 2.2
**Description:**
- Create production docker-compose.yml
- Configure Nginx reverse proxy
- Set up SSL/TLS certificates
- Configure volumes for persistence
- Set up Docker secrets

**Reference:** ARCHITECTURE.md Section 7

**Acceptance Criteria:**
- [ ] `docker-compose up` starts all services
- [ ] Nginx proxies to frontend/backend
- [ ] HTTPS working with Let's Encrypt
- [ ] Data persists across restarts
- [ ] Secrets managed with Docker secrets

**Effort:** 5 hours

---

### Task 14.3: Environment Configuration
**Priority:** 🔴 High
**Dependencies:** 14.2, 11.2
**Description:**
- Create .env templates
- Document all environment variables
- Set up secrets management
- Configure for different environments (dev/prod)

**Acceptance Criteria:**
- [ ] .env.example provided
- [ ] All required vars documented
- [ ] Secrets not committed to git
- [ ] Different configs for dev/prod

**Effort:** 2 hours

---

### Task 14.4: Database Migration Strategy
**Priority:** 🟡 Medium
**Dependencies:** 2.4
**Description:**
- Set up migration scripts
- Create backup strategy
- Document rollback procedure
- Test migrations in staging

**Acceptance Criteria:**
- [ ] Migrations run automatically on deploy
- [ ] Backups created before migrations
- [ ] Rollback procedure documented
- [ ] Tested on staging environment

**Effort:** 3 hours

---

### Task 14.5: Monitoring & Logging Setup
**Priority:** 🟡 Medium
**Dependencies:** 14.2, 3.3
**Description:**
- Configure log aggregation (ELK stack or similar)
- Set up basic monitoring (CPU, memory, disk)
- Create health check endpoints
- Set up alerts for critical issues

**Reference:** ARCHITECTURE.md Section 11

**Acceptance Criteria:**
- [ ] Logs centralized and searchable
- [ ] Monitoring dashboard shows system health
- [ ] Alerts configured for critical issues
- [ ] Health checks return proper status
- [ ] 90-day log retention

**Effort:** 5 hours

---

### Task 14.6: CI/CD Pipeline
**Priority:** 🟡 Medium
**Dependencies:** 14.1, 12.1, 12.2
**Description:**
- Set up GitHub Actions / GitLab CI
- Automate tests on PR
- Build Docker images
- Deploy to staging/production
- Run security scans

**Acceptance Criteria:**
- [ ] Tests run on every commit
- [ ] Docker images built and pushed
- [ ] Deployment automated
- [ ] Rollback possible
- [ ] Security scans in pipeline

**Effort:** 6 hours

---

### Task 14.7: QNAP Deployment & Testing
**Priority:** 🔴 High
**Dependencies:** 14.2, 14.3, 14.5
**Description:**
- Deploy to QNAP NAS
- Configure port forwarding
- Set up domain and SSL
- Load testing with 10-20 concurrent users

**Acceptance Criteria:**
- [ ] Application accessible via public URL
- [ ] HTTPS working
- [ ] Can handle 10+ concurrent sessions
- [ ] Performance meets requirements (<300ms API, <5s container start)

**Effort:** 8 hours

---

## Module 15: Performance Optimization

### Task 15.1: Backend Performance Tuning
**Priority:** 🟢 Low
**Dependencies:** Module 4 complete
**Description:**
- Profile slow endpoints
- Add database indexes
- Implement caching strategy
- Optimize queries

**Acceptance Criteria:**
- [ ] API responses < 300ms (p95)
- [ ] Database queries optimized
- [ ] Redis caching implemented
- [ ] Load testing passes

**Effort:** 6 hours

---

### Task 15.2: Frontend Performance Optimization
**Priority:** 🟢 Low
**Dependencies:** Module 9 complete
**Description:**
- Code splitting and lazy loading
- Image optimization
- Minimize bundle size
- Implement service worker (PWA)

**Acceptance Criteria:**
- [ ] Initial load < 3 seconds
- [ ] Lighthouse score > 90
- [ ] Bundle size optimized
- [ ] Images lazy-loaded

**Effort:** 5 hours

---

### Task 15.3: Container Startup Optimization
**Priority:** 🟡 Medium
**Dependencies:** 4.2
**Description:**
- Optimize Docker image size
- Pre-pull common images
- Implement container pooling
- Reduce startup time

**Acceptance Criteria:**
- [ ] Container starts in < 5 seconds
- [ ] Image size minimized
- [ ] Common images pre-cached
- [ ] Startup time consistent

**Effort:** 4 hours

---

## Summary

### Task Count by Priority
- 🔴 **High**: 53 tasks (MVP critical)
- 🟡 **Medium**: 26 tasks (Important for production)
- 🟢 **Low**: 9 tasks (Polish and future)

**Total**: 88 tasks

### Key Changes from Original

**Added Tasks:**
1. **Task 3.2**: Error Handling Infrastructure (implements Section 11)
2. **Task 3.3**: Centralized Logging Setup (implements Section 11)
3. **Task 3.5**: Rate Limiting Service (implements Section 10)
4. **Task 4.4**: Input Validation Service (implements Section 10)
5. **Module 11**: Security Implementation (4 tasks for Section 10)

**Enhanced Tasks:**
- Added security references to container, auth, and API tasks
- Added retry logic references to Claude API and container tasks
- Added rollback references to git and billing tasks
- Added correlation ID requirements throughout
- Added standard error format requirements
- Added validation requirements per ARCHITECTURE.md Section 10

### Estimated Timeline (MVP - High Priority Only)

- **Module 1-2** (Infrastructure & DB): ~20 hours
- **Module 3** (Backend Infrastructure): ~19 hours
- **Module 4** (Backend Services): ~51 hours
- **Module 5** (API Endpoints): ~18 hours
- **Module 6** (WebSocket): ~7 hours
- **Module 7-9** (Frontend): ~51 hours
- **Module 11** (Security): ~9 hours
- **Module 14** (Deployment): ~19 hours

**Total MVP Effort**: ~194 hours (~5 weeks for 1 developer, ~2.5 weeks for 2 developers)

### Recommended Execution Order

**Phase 1: Foundation (Week 1)**
- Module 1: Project setup
- Module 2: Database setup
- Tasks 3.1-3.3: Backend infrastructure with logging/error handling

**Phase 2: Core Backend (Week 2-3)**
- Task 3.4-3.5: Auth & rate limiting
- Tasks 4.1-4.6: Core services (Session, Container, Git, AI)
- Task 4.4: Input validation

**Phase 3: API & Frontend (Week 3-4)**
- Tasks 4.7-4.10: Chat & Billing services
- Module 5: API endpoints
- Module 6: WebSocket
- Module 7-8: Frontend setup & auth

**Phase 4: UI & Security (Week 4-5)**
- Module 9: Session view
- Module 11: Security implementation
- Module 14: Deployment

**Phase 5: Testing & Deploy (Week 5)**
- Integration testing
- Security audit
- QNAP deployment
- Bug fixes

---

## Notes

- All file paths should follow lowercase-with-hyphens convention per CLAUDE.md
- Each service must have minimal unit tests
- Functions should be kept under 120 lines per CLAUDE.md
- Always ask before adding new dependencies per CLAUDE.md
- Follow ARCHITECTURE.md loading rules: ask user which section to load before reading
- Reference specific ARCHITECTURE.md sections in task descriptions
- Implement standard error format from ARCHITECTURE.md Section 11
- Implement security measures from ARCHITECTURE.md Section 10
- All tasks should include correlation ID logging

---

## Phase 40: Runtime Hardening & Verification

### TASK-40B-1: Runtime Hardening — Container Lifecycle & Cleanup Verification
**Task ID:** TASK-40B-1  
**Phase:** 40B  
**Stage:** 40B-1  
**Priority:** 🔴 High  
**Nature:** DIAGNOSTIC + FIX-IF-REQUIRED  
**Dependencies:** PHASE-8.3, PHASE-8.4, PHASE-40A-3  
**Checkpoint:** `docs/PHASE-40B-1-CHECKPOINT.md`

**Objective:**

Verify container lifecycle correctness and cleanup guarantees under normal and failure conditions on Windows runtime. Ensure that session creation, termination, and container cleanup behave deterministically and leave no orphaned resources.

**Scope:**

This task is limited to **runtime verification and minimal fixes** in:
- `services/api-gateway` (session lifecycle behavior)
- `services/container-manager` (container lifecycle behavior)

**In Scope:**
1. **Session → Container Creation Verification**
   - Verify container creation during session start
   - Verify container naming and labeling consistency
   - Verify workspace mount behavior

2. **Session Termination → Container Cleanup Verification**
   - Verify container stop on session termination
   - Verify container removal after stop
   - Verify cleanup on max lifetime violation
   - Verify cleanup on idle timeout violation
   - Verify cleanup on explicit DELETE /api/sessions/:id

3. **Restart Scenarios**
   - Verify behavior when api-gateway restarts (container state)
   - Verify behavior when container-manager restarts (container state)
   - Verify termination state survives restarts (DB-backed)

4. **Docker Engine Failure Scenarios**
   - Verify behavior when Docker daemon is unavailable
   - Verify error handling when container stop fails
   - Verify error handling when container remove fails

5. **Orphan Container Detection**
   - Verify no orphaned containers after repeated create/terminate cycles
   - Document any edge cases where containers may remain

6. **Documentation**
   - Explicit documentation of current cleanup behavior
   - Document any gaps or known limitations
   - Document Windows-specific considerations

**Explicitly Out of Scope:**
- ❌ No background cleanup workers (violates ARCHITECTURE.md Section 11)
- ❌ No scheduled jobs or cron tasks
- ❌ No distributed coordination or clustering
- ❌ No database schema changes
- ❌ No authentication or authorization changes
- ❌ No preview system modifications
- ❌ No billing or quota logic changes
- ❌ No architectural refactors
- ❌ No new features or capabilities
- ❌ No multi-node orchestration

**Acceptance Criteria:**

**Verification Requirements:**
- [ ] Session creation consistently creates exactly one container
- [ ] Session termination (all paths) stops and removes container
- [ ] No orphaned containers after 10+ create/terminate cycles
- [ ] Termination state survives api-gateway restart
- [ ] Termination state survives container-manager restart
- [ ] Docker daemon failure returns appropriate HTTP errors
- [ ] Container stop failure is handled gracefully
- [ ] Container remove failure is logged but doesn't block termination state write

**Documentation Requirements:**
- [ ] Current cleanup behavior explicitly documented
- [ ] Edge cases and failure modes documented
- [ ] Windows-specific behavior documented
- [ ] Known limitations documented

**Fix Requirements (If Defect Found):**
- [ ] Minimal fix applied to smallest possible file set
- [ ] Fix preserves existing governance guarantees
- [ ] Fix does not introduce new dependencies
- [ ] Fix does not violate ARCHITECTURE.md principles
- [ ] Linter passes on modified files
- [ ] No regressions introduced

**Stop Conditions:**

This task MUST stop when:
1. ✅ All verification checklist items completed
2. ✅ Any necessary minimal fix applied and verified
3. ✅ Checkpoint written to `docs/PHASE-40B-1-CHECKPOINT.md`
4. ✅ No scope expansion occurred

**References:**
- ARCHITECTURE.md Section 4 (Session Lifecycle)
- ARCHITECTURE.md Section 9 (Container Isolation)
- ARCHITECTURE.md Section 11 (Explicit Non-Goals)
- PRD.md Section 3.A (Session Management)
- PRD.md Section 3.A (Termination Semantics)
- PHASE-8.3-CHECKPOINT.md (Idle Timeout + Max Lifetime)
- PHASE-8.4-CHECKPOINT.md (Session Termination Semantics)

**Known Context:**

From PHASE-8.4-CHECKPOINT.md (Line 130):
> "No container cleanup automation (containers remain running after termination)"

This task verifies whether this statement is still accurate and whether cleanup is correctly triggered on all termination paths.

**Effort Estimate:** 2-4 hours (verification + minimal fixes if needed)

**Test Strategy:**
1. Manual verification on Windows runtime
2. Repeated create/terminate cycles
3. Service restart testing
4. Docker daemon failure simulation
5. Orphan container detection via `docker ps -a`

**Rollback Plan:**

If fixes are required and introduce regressions:
- Revert code changes via git
- Restore previous checkpoint state
- Document issue for future phase

**Invariants That MUST Be Preserved:**
- Request-driven enforcement only (no background workers)
- DB-backed termination state
- HTTP 410 Gone on terminated sessions
- Single-process enforcement model
- No WebSocket control plane
- Idempotent termination writes

---

### TASK-40B-2: Runtime Hardening — Session State Transitions & Expiry Semantics Verification
**Task ID:** TASK-40B-2  
**Phase:** 40B  
**Stage:** 40B-2  
**Priority:** 🔴 High  
**Nature:** DIAGNOSTIC + FIX-IF-REQUIRED  
**Dependencies:** PHASE-8.3, PHASE-8.4, TASK-40B-1  
**Checkpoint:** `docs/PHASE-40B-2-CHECKPOINT.md`

**Objective:**

Verify correctness of session state transitions and expiry semantics on Windows runtime. Ensure that session lifecycle state management, activity tracking, and timeout enforcement behave deterministically and consistently with PRD and ARCHITECTURE specifications.

**Scope:**

This task is limited to **runtime verification and minimal fixes** in:
- `services/api-gateway` (session state management)
- `services/container-manager` (session activity tracking)

**In Scope:**
1. **Session State Transitions**
   - Verify pending → active transition (if implemented)
   - Verify state persistence in database
   - Verify state consistency across service restarts
   - Verify container_id assignment and persistence

2. **Activity Tracking**
   - Verify last_activity_at updates on message send
   - Verify last_activity_at updates on command execution
   - Verify last_activity_at updates on file operations
   - Verify activity tracking survives restarts

3. **Idle Timeout Enforcement**
   - Verify idle timeout calculation correctness
   - Verify termination triggered when idle timeout exceeded
   - Verify HTTP 410 Gone returned after idle timeout
   - Verify termination_reason = 'idle_timeout' persisted

4. **Max Lifetime Enforcement**
   - Verify max lifetime calculation from created_at
   - Verify termination triggered when max lifetime exceeded
   - Verify HTTP 410 Gone returned after max lifetime
   - Verify termination_reason = 'max_lifetime' persisted

5. **Termination State Determinism**
   - Verify terminated_at timestamp written atomically
   - Verify termination state survives restarts
   - Verify termination is irreversible
   - Verify all subsequent requests return 410 Gone

6. **Database State Consistency**
   - Verify session record reflects current state
   - Verify no orphaned session records
   - Verify state transitions are atomic
   - Verify concurrent request handling

7. **Documentation**
   - Document current state transition behavior
   - Document activity tracking trigger points
   - Document timeout calculation logic
   - Document any edge cases or limitations

**Explicitly Out of Scope:**
- ❌ No container cleanup logic (handled in TASK-40B-1)
- ❌ No background workers or scheduled jobs
- ❌ No database schema changes
- ❌ No authentication or authorization changes
- ❌ No routing or endpoint changes
- ❌ No preview system modifications
- ❌ No billing or quota logic changes
- ❌ No architectural refactors
- ❌ No new features or capabilities
- ❌ No multi-node orchestration
- ❌ No UI or frontend changes

**Acceptance Criteria:**

**Verification Requirements:**
- [ ] Session state transitions documented and verified
- [ ] container_id persistence behavior verified
- [ ] last_activity_at updates correctly on all activity types
- [ ] Idle timeout enforcement verified with test scenarios
- [ ] Max lifetime enforcement verified with test scenarios
- [ ] Termination state persists across api-gateway restart
- [ ] Termination state persists across container-manager restart
- [ ] HTTP 410 Gone consistently returned for terminated sessions
- [ ] termination_reason correctly set for each termination path
- [ ] Database state remains consistent under concurrent requests

**Documentation Requirements:**
- [ ] State transition diagram or description provided
- [ ] Activity tracking trigger points documented
- [ ] Timeout calculation formulas documented
- [ ] Edge cases and failure modes documented
- [ ] Windows-specific behavior documented (if any)

**Fix Requirements (If Defect Found):**
- [ ] Minimal fix applied to smallest possible file set
- [ ] Fix preserves existing governance guarantees
- [ ] Fix does not introduce new dependencies
- [ ] Fix does not violate ARCHITECTURE.md principles
- [ ] Linter passes on modified files
- [ ] No regressions introduced

**Stop Conditions:**

This task MUST stop when:
1. ✅ All verification checklist items completed
2. ✅ Any necessary minimal fix applied and verified
3. ✅ Checkpoint written to `docs/PHASE-40B-2-CHECKPOINT.md`
4. ✅ No scope expansion occurred

**References:**
- ARCHITECTURE.md Section 4 (Session Lifecycle)
- ARCHITECTURE.md Section 5 (Governance Model)
- ARCHITECTURE.md Section 11 (Explicit Non-Goals)
- PRD.md Section 3.A (Session Management)
- PRD.md Section 3.A (Governance & Lifecycle Guarantees)
- PRD.md Section 5 (Governance Model)
- PRD.md Section 6 (Error & Status Semantics)
- PHASE-8.3-CHECKPOINT.md (Idle Timeout + Max Lifetime)
- PHASE-8.4-CHECKPOINT.md (Session Termination Semantics)

**Known Context:**

From PRD.md Section 3.A (Lines 40-62):
> "Each session has:
> - Idle timeout (activity-based)
> - Maximum lifetime (absolute, from creation time)
> - Governance limits are config-driven and enforced by the system
> - Enforcement is request-driven (no background workers)"

From ARCHITECTURE.md Section 4 (Lines 172-182):
> "States: CREATED → ACTIVE → TERMINATED
> TERMINATED is final. No resurrection."

From PRD.md Section 6 (Lines 217-223):
> "Session terminated → 410 Gone
> Idle timeout exceeded → 410 Gone
> Max lifetime exceeded → 410 Gone"

**Effort Estimate:** 2-4 hours (verification + minimal fixes if needed)

**Test Strategy:**
1. Manual verification on Windows runtime
2. Test idle timeout with controlled activity gaps
3. Test max lifetime with controlled session duration
4. Test concurrent request handling
5. Test service restart scenarios
6. Verify database state consistency

**Rollback Plan:**

If fixes are required and introduce regressions:
- Revert code changes via git
- Restore previous checkpoint state
- Document issue for future phase

**Invariants That MUST Be Preserved:**
- Request-driven enforcement only (no background workers)
- DB-backed session state
- HTTP 410 Gone on terminated sessions
- Single-process enforcement model
- Deterministic state transitions
- Idempotent termination writes
- No resurrection of terminated sessions

---

### ~~TASK-40B-3: Runtime Hardening — Session Database Unification (PostgreSQL Single Source of Truth)~~ [DEPRECATED]

**⚠️ DEPRECATED — INVALID FOR PHASE 40B**

**Task ID:** TASK-40B-3 (DEPRECATED)  
**Status:** ❌ **NOT AUTHORIZED UNDER RUNTIME HARDENING**  
**Reason:** This task is an architectural refactor (SQLite → PostgreSQL migration) and exceeds the scope of Phase 40B Runtime Hardening, which is limited to diagnostic verification and minimal correctness fixes only.

**Moved to:** Future Architecture Phase (TBD)

**Original Objective (Invalid for Phase 40B):**

Unify session persistence across services by eliminating SQLite usage in container-manager and consolidating all session state into PostgreSQL. Ensure a single authoritative session record per session.

**Why This Is Not Runtime Hardening:**
- ❌ Architectural refactor (database layer redesign)
- ❌ Cross-service persistence changes
- ❌ Schema migrations and data migrations
- ❌ Not a minimal fix for runtime correctness
- ❌ Exceeds diagnostic + fix-if-required boundary

**Note:** Not authorized under Runtime Hardening. Moved to future Architecture phase.

---

### TASK-40B-3R: Runtime Hardening — Concurrency & Stress Verification

**Task ID:** TASK-40B-3R  
**Phase:** 40B  
**Stage:** 40B-3  
**Priority:** 🔴 High  
**Nature:** DIAGNOSTIC + FIX-IF-REQUIRED  
**Dependencies:** PHASE-8.3, PHASE-8.4, TASK-40B-1, TASK-40B-2  
**Checkpoint:** `docs/PHASE-40B-3R-CHECKPOINT.md`

**Objective:**

Validate session and container runtime correctness under concurrency and stress conditions on Windows. Ensure deterministic behavior under rapid create/delete cycles, concurrent requests, and service restarts. Document observed limits and fix only verified correctness defects.

**Scope:**

This task is limited to **runtime verification and minimal fixes** in:
- `services/api-gateway` (session concurrency behavior)
- `services/container-manager` (container lifecycle under stress)

**In Scope:**

1. **Rapid Session Create/Delete Cycles**
   - Verify session creation under rapid sequential requests
   - Verify session deletion under rapid sequential requests
   - Verify no orphaned database records after cycles
   - Verify no orphaned Docker containers after cycles
   - Verify no orphaned Docker volumes after cycles
   - Verify no orphaned Docker networks after cycles

2. **Multiple Sessions Per User**
   - Verify behavior when user creates multiple concurrent sessions
   - Document whether multiple sessions per user are allowed or rejected
   - Verify deterministic error responses if rejected
   - Verify session isolation if allowed

3. **Concurrent Requests During Lifecycle Changes**
   - Verify concurrent exec requests during session creation
   - Verify concurrent exec requests during session termination
   - Verify concurrent file operations during container lifecycle changes
   - Verify deterministic error responses (410 Gone, 404, 429)
   - Verify no race conditions in termination state writes

4. **Service Restart During Active Sessions**
   - Verify api-gateway restart with active sessions
   - Verify container-manager restart with active sessions
   - Verify termination state survives restarts (DB-backed)
   - Verify in-memory tracking (idle timeout, exec concurrency) resets correctly
   - Document expected behavior after restart

5. **Orphan Resource Detection**
   - Run stress test: 20+ rapid create/delete cycles
   - Verify no orphaned containers (`docker ps -a`)
   - Verify no orphaned volumes (`docker volume ls`)
   - Verify no orphaned networks (`docker network ls`)
   - Document any edge cases where resources may remain

6. **Deterministic Error Behavior Under Load**
   - Verify HTTP status codes under concurrent requests
   - Verify error messages are consistent
   - Verify no crash loops or unhandled exceptions
   - Verify graceful degradation under resource exhaustion

7. **Documentation**
   - Document observed concurrency limits
   - Document restart behavior
   - Document any known edge cases
   - Document Windows-specific considerations

**Explicitly Out of Scope:**

- ❌ No database schema changes or migrations
- ❌ No authentication or authorization changes
- ❌ No background workers or scheduled jobs
- ❌ No preview system modifications
- ❌ No billing or quota logic changes
- ❌ No architectural refactors
- ❌ No performance optimization (unless fixing correctness bugs)
- ❌ No new features or capabilities
- ❌ No multi-node orchestration
- ❌ No UI or frontend changes

**Acceptance Criteria:**

**Verification Requirements:**
- [ ] No orphaned containers after 20+ create/delete cycles
- [ ] No orphaned volumes after stress runs
- [ ] No orphaned networks after stress runs
- [ ] No orphaned database records after stress runs
- [ ] Deterministic behavior on concurrent create/delete
- [ ] Deterministic error responses (410, 404, 429) under concurrency
- [ ] No crash loops or unhandled exceptions
- [ ] Termination state survives api-gateway restart
- [ ] Termination state survives container-manager restart
- [ ] In-memory tracking resets correctly after restart

**Documentation Requirements:**
- [ ] Concurrency behavior explicitly documented
- [ ] Multiple sessions per user policy documented
- [ ] Restart behavior documented
- [ ] Edge cases and failure modes documented
- [ ] Windows-specific behavior documented (if any)
- [ ] Observed limits documented (max concurrent sessions, etc.)

**Fix Requirements (If Defect Found):**
- [ ] Minimal fix applied to smallest possible file set
- [ ] Fix preserves existing governance guarantees
- [ ] Fix does not introduce new dependencies
- [ ] Fix does not violate ARCHITECTURE.md principles
- [ ] Linter passes on modified files
- [ ] No regressions introduced

**Stop Conditions:**

This task MUST stop when:
1. ✅ All verification checklist items completed
2. ✅ Any necessary minimal fix applied and verified
3. ✅ Checkpoint written to `docs/PHASE-40B-3R-CHECKPOINT.md`
4. ✅ No scope expansion occurred

**References:**
- ARCHITECTURE.md Section 4 (Session Lifecycle)
- ARCHITECTURE.md Section 5 (Governance Model)
- ARCHITECTURE.md Section 9 (Container Isolation)
- ARCHITECTURE.md Section 11 (Explicit Non-Goals)
- PRD.md Section 3.A (Session Management)
- PRD.md Section 5 (Governance Model)
- PRD.md Section 6 (Error & Status Semantics)
- PHASE-8.3-CHECKPOINT.md (Idle Timeout + Max Lifetime)
- PHASE-8.4-CHECKPOINT.md (Session Termination Semantics)
- TASK-40B-1 (Container Lifecycle & Cleanup Verification)
- TASK-40B-2 (Session State Transitions & Expiry Semantics)

**Known Context:**

From PRD.md Section 3.A:
> "Enforcement is request-driven (no background workers)"

From ARCHITECTURE.md Section 4:
> "States: CREATED → ACTIVE → TERMINATED. TERMINATED is final. No resurrection."

From PRD.md Section 6:
> "Session terminated → 410 Gone. Idle timeout exceeded → 410 Gone. Max lifetime exceeded → 410 Gone."

**Effort Estimate:** 3-5 hours (stress testing + verification + minimal fixes if needed)

**Test Strategy:**

1. **Stress Test Script:**
   - Create 20 sessions rapidly (sequential)
   - Delete all 20 sessions rapidly (sequential)
   - Verify no orphans after each cycle
   - Repeat 3 times

2. **Concurrency Test:**
   - Create 5 sessions concurrently (parallel requests)
   - Execute commands in all 5 sessions concurrently
   - Terminate all 5 sessions concurrently
   - Verify deterministic responses

3. **Restart Test:**
   - Create 3 active sessions
   - Restart api-gateway
   - Verify sessions still accessible
   - Restart container-manager
   - Verify containers still running
   - Verify termination enforcement still works

4. **Orphan Detection:**
   - Run `docker ps -a` before and after stress test
   - Run `docker volume ls` before and after stress test
   - Run `docker network ls` before and after stress test
   - Query database for session count before and after

**Rollback Plan:**

If fixes are required and introduce regressions:
- Revert code changes via git
- Restore previous checkpoint state
- Document issue for future phase

**Invariants That MUST Be Preserved:**
- Request-driven enforcement only (no background workers)
- DB-backed termination state
- HTTP 410 Gone on terminated sessions
- Single-process enforcement model
- Deterministic state transitions
- Idempotent termination writes
- No resurrection of terminated sessions

---

## Phase 41: Observability & Runtime Metrics Foundation

### TASK-41A: Observability & Runtime Metrics Foundation

**Task ID:** TASK-41A  
**Phase:** 41  
**Stage:** 41A  
**Priority:** 🟡 Medium  
**Nature:** IMPLEMENTATION (ADDITIVE ONLY)  
**Dependencies:** PHASE-8.3, PHASE-8.4, TASK-40B-3R  
**Checkpoint:** `docs/PHASE-41A-CHECKPOINT.md`

**Objective:**

Introduce minimal runtime observability for diagnostic visibility into session and container runtime state. Provide lightweight metrics endpoint for active session count, running container count, termination reason distribution, and basic error counters without external monitoring system integration.

**Scope:**

This task is limited to **additive implementation only** in:
- `services/api-gateway` (metrics endpoint + session stats)
- `services/container-manager` (container stats method)

**In Scope:**

1. **Metrics Endpoint in API Gateway**
   - Add `GET /api/runtime/metrics` endpoint (internal-only or admin-only)
   - Return JSON with runtime statistics
   - No authentication required (internal endpoint)
   - Deterministic response format

2. **Session Statistics**
   - Active session count (non-terminated)
   - Terminated session count
   - Termination reason distribution (idle_timeout, max_lifetime, explicit_delete, error)
   - Sessions by state (if state field exists)

3. **Container Statistics (via Container Manager)**
   - Running container count (from Docker API)
   - Stopped container count (if applicable)
   - Container creation success/failure counters (if tracked)

4. **Basic Error Counters**
   - Session creation failures (if tracked)
   - Container creation failures (if tracked)
   - Termination errors (if tracked)
   - Optional: aggregate from logs or add minimal tracking

5. **Health Diagnostics Enhancement**
   - Extend existing health check endpoint (if exists)
   - Add diagnostic fields: database connectivity, Docker daemon connectivity
   - Return detailed status beyond 200 OK

6. **Structured Logging Improvements (Minimal)**
   - Add log messages for metrics endpoint access
   - Ensure termination events are logged with reason
   - No major logging refactor

7. **Documentation**
   - Document metrics endpoint response format
   - Document manual verification steps
   - Document how to interpret metrics

**Explicitly Out of Scope:**

- ❌ No external monitoring systems (Prometheus, Grafana, Datadog, etc.)
- ❌ No Prometheus exposition format
- ❌ No alerting systems
- ❌ No background workers or scheduled jobs
- ❌ No database schema changes or migrations
- ❌ No performance optimization
- ❌ No tracing systems (OpenTelemetry, Jaeger, etc.)
- ❌ No rate limiting changes
- ❌ No authentication or authorization changes (unless endpoint requires admin access)
- ❌ No architectural refactors
- ❌ No preview system modifications
- ❌ No billing or quota logic changes
- ❌ No UI or frontend changes
- ❌ No WebSocket changes
- ❌ No container isolation changes

**Acceptance Criteria:**

**Implementation Requirements:**
- [ ] `GET /api/runtime/metrics` endpoint implemented in api-gateway
- [ ] Endpoint returns deterministic JSON response
- [ ] Active session count accurate (query from database)
- [ ] Terminated session count accurate (query from database)
- [ ] Termination reason distribution accurate (group by termination_reason)
- [ ] Running container count accurate (query from Docker API)
- [ ] Health check endpoint enhanced with diagnostic fields
- [ ] Database connectivity status included in health check
- [ ] Docker daemon connectivity status included in health check

**Quality Requirements:**
- [ ] No change to existing session lifecycle behavior
- [ ] No change to existing termination enforcement
- [ ] No change to existing container lifecycle behavior
- [ ] Build passes (linter + TypeScript compilation)
- [ ] No regressions in existing tests (if any)
- [ ] Metrics endpoint does not block or slow down critical paths

**Documentation Requirements:**
- [ ] Metrics endpoint response format documented
- [ ] Example response provided
- [ ] Manual verification steps documented
- [ ] Interpretation guide provided

**Stop Conditions:**

This task MUST stop when:
1. ✅ Metrics endpoint implemented and tested
2. ✅ Health diagnostics enhanced
3. ✅ Manual verification completed
4. ✅ Checkpoint written to `docs/PHASE-41A-CHECKPOINT.md`
5. ✅ No scope expansion occurred

**References:**
- ARCHITECTURE.md Section 4 (Session Lifecycle)
- ARCHITECTURE.md Section 9 (Container Isolation)
- ARCHITECTURE.md Section 11 (Explicit Non-Goals)
- PRD.md Section 3.A (Session Management)
- PRD.md Section 7 (Non-Functional Requirements - Reliability)
- PHASE-8.3-CHECKPOINT.md (Idle Timeout + Max Lifetime)
- PHASE-8.4-CHECKPOINT.md (Session Termination Semantics)
- TASK-40B-3R (Concurrency & Stress Verification)

**Known Context:**

From ARCHITECTURE.md Section 11:
> "No background workers. No event buses. No cron."

From PRD.md Section 7:
> "Deterministic failure modes. Persistent termination state. Safe restart behavior."

This task provides visibility into runtime state without violating architectural principles.

**Effort Estimate:** 3-5 hours (implementation + verification + documentation)

**Example Metrics Response Format:**

```json
{
  "timestamp": "2026-02-20T10:30:00.000Z",
  "uptime_seconds": 86400,
  "sessions": {
    "active": 12,
    "terminated": 145,
    "total": 157,
    "termination_reasons": {
      "idle_timeout": 78,
      "max_lifetime": 34,
      "explicit_delete": 28,
      "error": 5
    }
  },
  "containers": {
    "running": 12,
    "stopped": 0
  },
  "errors": {
    "session_creation_failures": 2,
    "container_creation_failures": 1,
    "termination_errors": 0
  },
  "health": {
    "database": "connected",
    "docker": "connected"
  }
}
```

**Manual Verification Steps:**

1. Start api-gateway and container-manager
2. Create 3 sessions
3. Call `GET /api/runtime/metrics`
4. Verify `sessions.active = 3`
5. Verify `containers.running = 3`
6. Terminate 1 session (DELETE)
7. Call `GET /api/runtime/metrics`
8. Verify `sessions.active = 2`
9. Verify `sessions.terminated = 1`
10. Verify `sessions.termination_reasons.explicit_delete = 1`
11. Wait for idle timeout on 1 session
12. Call `GET /api/runtime/metrics`
13. Verify `sessions.termination_reasons.idle_timeout = 1`
14. Verify health fields show "connected"
15. Stop Docker daemon
16. Call `GET /api/runtime/metrics`
17. Verify `health.docker = "disconnected"` or similar
18. Restart Docker daemon
19. Verify metrics return to normal

**Rollback Plan:**

If implementation introduces regressions:
- Revert code changes via git
- Remove metrics endpoint
- Restore previous checkpoint state
- Document issue for future phase

**Invariants That MUST Be Preserved:**
- Request-driven enforcement only (no background workers)
- DB-backed termination state
- HTTP 410 Gone on terminated sessions
- Single-process enforcement model
- Deterministic state transitions
- Idempotent termination writes
- No resurrection of terminated sessions
- No performance degradation on critical paths

---

### TASK-41B: Security Hardening — Rate Limits + Internal Endpoint Protection

**Task ID:** TASK-41B  
**Phase:** 41  
**Stage:** 41B  
**Priority:** 🔴 High  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Dependencies:** PHASE-41A  
**Checkpoint:** `docs/PHASE-41B-CHECKPOINT.md`

**Objective:**

Add minimal rate limiting to high-risk endpoints and harden internal endpoint protection to prevent abuse and ensure internal routes are properly secured.

**Scope:**

This task is limited to **minimal, additive implementation only** in:
- `services/api-gateway` (rate limiting + internal endpoint hardening)

**In Scope:**

1. **Rate Limiting for High-Risk Endpoints**
   - Add rate limiting to `POST /api/sessions` (session creation)
   - Add rate limiting to `DELETE /api/sessions/:id` (session deletion)
   - Add rate limiting to `POST /api/ai/execute` (AI execution)
   - Use simple in-memory rate limiter (no Redis/external dependencies)
   - Return HTTP 429 Too Many Requests when limit exceeded
   - Deterministic behavior (same request rate → same response)

2. **Internal Endpoint Protection Hardening**
   - Verify all `/api/internal/*` routes require `InternalServiceAuthGuard`
   - Ensure no internal endpoint bypasses guard
   - Tighten auth checks if any endpoint currently allows unauthenticated access
   - Verify `X-Internal-Service-Key` header validation is consistent

3. **Rate Limit Configuration**
   - Define rate limits as constants (no environment variables)
   - Example: 10 sessions per minute per IP
   - Example: 5 session deletions per minute per IP
   - Example: 20 AI executions per minute per IP
   - Conservative defaults (can be tuned later)

4. **Error Response Format**
   - HTTP 429 with JSON body: `{ "statusCode": 429, "message": "Too Many Requests", "retryAfter": <seconds> }`
   - Include `Retry-After` header
   - Deterministic error messages

5. **Documentation**
   - Document rate limits per endpoint
   - Document 429 response format
   - Document PowerShell 5.x verification steps
   - Document how to test rate limiting manually

**Explicitly Out of Scope:**

- ❌ No external WAF or CDN integration
- ❌ No Redis or distributed rate limiting
- ❌ No database schema changes
- ❌ No new authentication system
- ❌ No background workers or cleanup jobs
- ❌ No architectural refactors
- ❌ No UI changes or user-facing messaging
- ❌ No dependency-heavy security frameworks (helmet, express-rate-limit with Redis, etc.)
- ❌ No IP-based blocking or blacklisting
- ❌ No CAPTCHA or challenge-response systems
- ❌ No logging changes (beyond rate limit events)
- ❌ No performance optimization
- ❌ No WebSocket rate limiting
- ❌ No preview endpoint rate limiting

**Acceptance Criteria:**

**Implementation Requirements:**
- [ ] Rate limiting applied to `POST /api/sessions`
- [ ] Rate limiting applied to `DELETE /api/sessions/:id`
- [ ] Rate limiting applied to `POST /api/ai/execute`
- [ ] HTTP 429 returned when rate limit exceeded
- [ ] `Retry-After` header included in 429 responses
- [ ] All `/api/internal/*` routes protected by `InternalServiceAuthGuard`
- [ ] No internal endpoint bypasses guard
- [ ] Rate limiter uses in-memory storage (no external dependencies)
- [ ] Rate limits are per-IP address
- [ ] Rate limits reset after time window expires

**Quality Requirements:**
- [ ] No change to existing session lifecycle behavior
- [ ] No change to existing termination enforcement
- [ ] No change to existing authentication logic (except internal endpoint hardening)
- [ ] Build passes (linter + TypeScript compilation)
- [ ] No regressions in existing functionality
- [ ] Rate limiting does not block legitimate traffic under normal load
- [ ] Deterministic 429 behavior (same rate → same response)

**Documentation Requirements:**
- [ ] Rate limits documented per endpoint
- [ ] 429 response format documented
- [ ] PowerShell 5.x verification steps provided
- [ ] Manual testing procedure documented

**Stop Conditions:**

This task MUST stop when:
1. ✅ Rate limiting implemented for 3 specified endpoints
2. ✅ Internal endpoint protection verified and hardened
3. ✅ Manual verification completed (PowerShell 5.x)
4. ✅ Checkpoint written to `docs/PHASE-41B-CHECKPOINT.md`
5. ✅ No scope expansion occurred

**Rate Limit Defaults:**

```typescript
// Conservative defaults (can be tuned later)
const RATE_LIMITS = {
  SESSION_CREATE: { maxRequests: 10, windowMs: 60000 },  // 10 per minute
  SESSION_DELETE: { maxRequests: 5, windowMs: 60000 },   // 5 per minute
  AI_EXECUTE: { maxRequests: 20, windowMs: 60000 },      // 20 per minute
};
```

**Expected 429 Response:**

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "Rate limit exceeded for POST /api/sessions",
  "retryAfter": 45
}
```

**Headers:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
Content-Type: application/json
```

**PowerShell Verification Steps:**

```powershell
# Test 1: Session creation rate limit
for ($i = 1; $i -le 15; $i++) {
    $response = Invoke-WebRequest -Uri http://localhost:4000/api/sessions -Method POST -Body '{"userId":"test"}' -ContentType "application/json" -SkipHttpErrorCheck
    Write-Host "Request $i: $($response.StatusCode)"
}
# Expected: First 10 return 200/201, next 5 return 429

# Test 2: Verify Retry-After header
$response = Invoke-WebRequest -Uri http://localhost:4000/api/sessions -Method POST -Body '{"userId":"test"}' -ContentType "application/json" -SkipHttpErrorCheck
$response.Headers['Retry-After']
# Expected: Number of seconds until rate limit resets

# Test 3: Internal endpoint without key
$response = Invoke-WebRequest -Uri http://localhost:4000/api/internal/stats -Method GET -SkipHttpErrorCheck
Write-Host $response.StatusCode
# Expected: 403 Forbidden

# Test 4: Internal endpoint with invalid key
$response = Invoke-WebRequest -Uri http://localhost:4000/api/internal/stats -Method GET -Headers @{"X-Internal-Service-Key"="invalid"} -SkipHttpErrorCheck
Write-Host $response.StatusCode
# Expected: 403 Forbidden

# Test 5: Internal endpoint with valid key
$response = Invoke-WebRequest -Uri http://localhost:4000/api/internal/stats -Method GET -Headers @{"X-Internal-Service-Key"=$env:INTERNAL_SERVICE_KEY} -SkipHttpErrorCheck
Write-Host $response.StatusCode
# Expected: 200 OK
```

**References:**
- ARCHITECTURE.md Section 2 (Architecture Principles - Determinism)
- ARCHITECTURE.md Section 11 (Explicit Non-Goals)
- PRD.md Section 7 (Non-Functional Requirements - Security)
- PHASE-41A-CHECKPOINT.md (Runtime Metrics Foundation)
- CLAUDE.md (Internal API Rules)

**Known Context:**

From ARCHITECTURE.md Section 11:
> "No background workers. No event buses. No cron."

From CLAUDE.md Internal API Rules:
> "These endpoints are ONLY called by internal services. They are NOT exposed to frontend or external clients."

This task adds minimal security hardening without introducing external dependencies or architectural changes.

**Effort Estimate:** 3-4 hours (implementation + verification + documentation)

**Rollback Plan:**

If implementation introduces regressions:
- Revert rate limiting middleware
- Revert internal endpoint hardening changes
- Restore previous checkpoint state
- Document issue for future phase

**Invariants That MUST Be Preserved:**
- Request-driven enforcement only (no background workers)
- DB-backed termination state
- HTTP 410 Gone on terminated sessions
- Single-process enforcement model
- Deterministic state transitions
- No external dependencies for rate limiting (in-memory only)
- No performance degradation on critical paths
- Internal endpoints remain internal-only

---

### TASK-41C: Abuse Hardening — Proxy-Aware IP Normalization

**Task ID:** TASK-41C  
**Phase:** 41  
**Stage:** 41C  
**Priority:** 🟡 Medium  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Dependencies:** PHASE-41B  
**Checkpoint:** `docs/PHASE-41C-CHECKPOINT.md`

**Objective:**

Improve rate limiting accuracy by correctly parsing client IP addresses from proxy headers, preventing rate limit bypass via proxy manipulation while maintaining deterministic behavior.

**Scope:**

This task is limited to **minimal changes inside existing RateLimitGuard only** in:
- `services/api-gateway/src/guards/rate-limit.guard.ts`

**In Scope:**

1. **X-Forwarded-For Header Parsing**
   - Parse `X-Forwarded-For` header correctly
   - Extract first public IP only (ignore private/internal IPs)
   - Handle comma-separated IP lists (e.g., "client, proxy1, proxy2")
   - Take leftmost public IP as true client IP

2. **Fallback Chain**
   - Primary: First public IP from `X-Forwarded-For`
   - Secondary: `request.ip` (Express/NestJS property)
   - Tertiary: `request.socket.remoteAddress`
   - Final: `'unknown'` (safe default)

3. **IP Format Normalization**
   - Normalize IPv6 formats (e.g., `::ffff:127.0.0.1` → `127.0.0.1`)
   - Trim whitespace from parsed IPs
   - Handle IPv4-mapped IPv6 addresses
   - Consistent string format for Map keys

4. **Private IP Detection**
   - Skip private IP ranges in `X-Forwarded-For`:
     - `10.0.0.0/8`
     - `172.16.0.0/12`
     - `192.168.0.0/16`
     - `127.0.0.0/8` (localhost)
     - `::1` (IPv6 localhost)
     - `fc00::/7` (IPv6 private)
   - Use first public IP found in chain

5. **Safe Behavior**
   - If header missing: fall back to `request.ip`
   - If header malformed: fall back to `request.ip`
   - If all IPs are private: use last IP in chain (closest to server)
   - Never throw exceptions during IP extraction

6. **Deterministic Behavior**
   - Same header value → same extracted IP
   - Same IP → same rate limit bucket
   - No randomness or time-based logic
   - Consistent across requests

**Explicitly Out of Scope:**

- ❌ No external IP geolocation services
- ❌ No IP reputation checking
- ❌ No IP blacklist/whitelist
- ❌ No database schema changes
- ❌ No Redis or distributed storage
- ❌ No background workers
- ❌ No architectural refactors
- ❌ No changes to rate limit logic (maxRequests, windowMs)
- ❌ No changes to other guards or controllers
- ❌ No logging changes (beyond minimal debug logs)
- ❌ No environment variable configuration
- ❌ No UI changes

**Acceptance Criteria:**

**Implementation Requirements:**
- [ ] `getClientIp()` method updated to parse `X-Forwarded-For` correctly
- [ ] Private IP ranges detected and skipped
- [ ] IPv6 formats normalized to IPv4 when possible
- [ ] Fallback chain implemented (X-Forwarded-For → request.ip → socket.remoteAddress → 'unknown')
- [ ] Deterministic IP extraction (same input → same output)
- [ ] No exceptions thrown during IP parsing
- [ ] Whitespace trimmed from parsed IPs

**Quality Requirements:**
- [ ] No change to rate limit logic (maxRequests, windowMs, window reset)
- [ ] No change to 429 response format
- [ ] No change to Retry-After header behavior
- [ ] Build passes (linter + TypeScript compilation)
- [ ] No regressions in existing rate limiting
- [ ] Rate limiting still works when X-Forwarded-For is missing

**Documentation Requirements:**
- [ ] IP extraction logic documented in code comments
- [ ] Private IP ranges documented
- [ ] Fallback chain documented
- [ ] PowerShell verification steps updated

**Stop Conditions:**

This task MUST stop when:
1. ✅ IP extraction logic updated in `getClientIp()` method
2. ✅ Private IP detection implemented
3. ✅ IPv6 normalization implemented
4. ✅ Fallback chain implemented
5. ✅ Manual verification completed (PowerShell)
6. ✅ Checkpoint written to `docs/PHASE-41C-CHECKPOINT.md`
7. ✅ No scope expansion occurred

**Implementation Guidance:**

**Private IP Detection Function:**
```typescript
private isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('127.')) return true;
  
  // IPv6 private ranges
  if (ip === '::1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  
  return false;
}
```

**IPv6 Normalization:**
```typescript
private normalizeIp(ip: string): string {
  // Remove IPv4-mapped IPv6 prefix
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  return ip;
}
```

**Updated getClientIp() Logic:**
```typescript
private getClientIp(request: Request): string {
  // 1. Try X-Forwarded-For (first public IP)
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor)
      ? forwardedFor[0].split(',')
      : forwardedFor.split(',');
    
    for (const ip of ips) {
      const normalized = this.normalizeIp(ip.trim());
      if (!this.isPrivateIp(normalized)) {
        return normalized;
      }
    }
    // All IPs are private, use last one (closest to server)
    if (ips.length > 0) {
      return this.normalizeIp(ips[ips.length - 1].trim());
    }
  }
  
  // 2. Fallback to request.ip
  if (request.ip) {
    return this.normalizeIp(request.ip);
  }
  
  // 3. Fallback to socket.remoteAddress
  if (request.socket.remoteAddress) {
    return this.normalizeIp(request.socket.remoteAddress);
  }
  
  // 4. Final fallback
  return 'unknown';
}
```

**PowerShell Verification Steps:**

```powershell
# Test 1: Rate limiting with X-Forwarded-For
$headers = @{
    "Authorization" = "Bearer <token>"
    "X-Forwarded-For" = "203.0.113.1"
    "Content-Type" = "application/json"
}
for ($i = 1; $i -le 12; $i++) {
    $response = Invoke-WebRequest -Uri http://localhost:4000/api/sessions -Method POST -Headers $headers -Body '{"userId":"test"}' -SkipHttpErrorCheck
    Write-Host "Request $i : $($response.StatusCode)"
}
# Expected: First 10 succeed, next 2 return 429

# Test 2: Rate limiting with multiple proxies
$headers = @{
    "Authorization" = "Bearer <token>"
    "X-Forwarded-For" = "203.0.113.1, 10.0.0.1, 192.168.1.1"
    "Content-Type" = "application/json"
}
# Should use 203.0.113.1 (first public IP)

# Test 3: Rate limiting with all private IPs
$headers = @{
    "Authorization" = "Bearer <token>"
    "X-Forwarded-For" = "10.0.0.1, 192.168.1.1"
    "Content-Type" = "application/json"
}
# Should use 192.168.1.1 (last IP, closest to server)

# Test 4: Rate limiting without X-Forwarded-For
$headers = @{
    "Authorization" = "Bearer <token>"
    "Content-Type" = "application/json"
}
# Should fall back to request.ip or socket.remoteAddress

# Test 5: IPv6 normalization
$headers = @{
    "Authorization" = "Bearer <token>"
    "X-Forwarded-For" = "::ffff:203.0.113.1"
    "Content-Type" = "application/json"
}
# Should normalize to 203.0.113.1
```

**References:**
- ARCHITECTURE.md Section 2 (Architecture Principles - Determinism)
- PHASE-41B-CHECKPOINT.md (Rate Limiting Implementation)
- RFC 7239 (Forwarded HTTP Extension)
- RFC 1918 (Private IPv4 Address Space)
- RFC 4193 (IPv6 Unique Local Addresses)

**Known Context:**

From ARCHITECTURE.md Section 2:
> "Determinism: Same input → same output. No background state mutation."

This task improves rate limiting accuracy without changing its deterministic behavior. IP extraction remains deterministic: same headers → same extracted IP → same rate limit bucket.

**Effort Estimate:** 2-3 hours (implementation + verification + documentation)

**Rollback Plan:**

If implementation introduces regressions:
- Revert `getClientIp()` method to original implementation
- Remove `isPrivateIp()` and `normalizeIp()` helper methods
- Restore previous checkpoint state
- Document issue for future phase

**Invariants That MUST Be Preserved:**
- Request-driven enforcement only (no background workers)
- Deterministic state transitions
- No external dependencies for rate limiting (in-memory only)
- No performance degradation on critical paths
- Rate limit logic unchanged (maxRequests, windowMs, window reset)
- 429 response format unchanged
- Retry-After header behavior unchanged

---

## Phase 42: Hard Quota Enforcement

### TASK-42A-1: Hard Quota Enforcement — Max Active Sessions Per User

**Task ID:** TASK-42A-1  
**Phase:** 42  
**Stage:** 42A  
**Priority:** 🔴 High  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Dependencies:** PHASE-41C  
**Checkpoint:** `docs/PHASE-42A-1-CHECKPOINT.md`

**Objective:**

Implement deterministic, database-backed hard quota enforcement for maximum concurrent active sessions per user. Enforce ceiling at request time in `POST /api/sessions` with hard stop behavior and no background workers.

**Core Requirements:**
- Must enforce ceiling at request time (before container creation)
- No background workers or reconciliation jobs
- No probabilistic logic (deterministic only)
- Database-backed quota tracking
- Idempotent enforcement across restarts

**Scope:**

This task is limited to **minimal, additive implementation only** in:
- `services/api-gateway` (quota guard for session creation only)

**In Scope:**

1. **Max Active Sessions Per User Enforcement**
   - Enforce ceiling on concurrent active (non-terminated) sessions
   - Check before container creation in `POST /api/sessions`
   - Query database: `COUNT(*) WHERE user_id = ? AND terminated_at IS NULL`
   - Return HTTP 403 Forbidden if limit exceeded
   - Deterministic error response with quota details

2. **Hard Stop Behavior**
   - No partial execution (all-or-nothing)
   - No container started if quota exceeded
   - Fail fast with clear error message

3. **Deterministic DB-Backed Enforcement**
   - All quota state stored in database (no in-memory only)
   - Quota checks survive service restarts
   - Idempotent enforcement (same request → same result)

4. **Enforcement at Request Entry**
   - Quota check occurs before side effects
   - Check before `ContainerService.startContainer()`
   - Fail fast with clear error message

**Quota Configuration:**
```typescript
const QUOTA_LIMITS = {
  MAX_ACTIVE_SESSIONS_PER_USER: 5,
};
```

**Enforcement Logic:**
```
IF (active_sessions_count >= MAX_ACTIVE_SESSIONS_PER_USER) THEN
  RETURN HTTP 403 Forbidden
  { "error": "quota_exceeded", "quota_type": "max_active_sessions", "limit": 5, "current": N }
ELSE
  PROCEED with session creation
```

**Explicitly Out of Scope:**
- ❌ No rolling 24h session limit (TASK-42A-2)
- ❌ No token quota enforcement (TASK-42A-3)
- ❌ No billing system redesign
- ❌ No background workers
- ❌ No schema changes
- ❌ No Redis or distributed caching
- ❌ No soft warnings or grace periods

**Acceptance Criteria:**
- [ ] `QuotaGuard` implemented for `POST /api/sessions`
- [ ] Active session count queried from database
- [ ] HTTP 403 returned if limit exceeded
- [ ] Error response includes quota_type, limit, current
- [ ] No container started if quota exceeded
- [ ] Works across api-gateway restarts (DB-backed)
- [ ] Build passes (linter + TypeScript)
- [ ] No regressions to PHASE-41A/41B/41C

**Stop Conditions:**
1. ✅ Max active sessions enforcement implemented
2. ✅ Manual PowerShell verification completed
3. ✅ Checkpoint written to `docs/PHASE-42A-1-CHECKPOINT.md`
4. ✅ No scope expansion occurred

**Effort Estimate:** 1-2 hours

---

### TASK-42A-2: Hard Quota Enforcement — Max Sessions Per Rolling 24h

**Task ID:** TASK-42A-2  
**Phase:** 42  
**Stage:** 42A  
**Priority:** 🔴 High  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Dependencies:** TASK-42A-1  
**Checkpoint:** `docs/PHASE-42A-2-CHECKPOINT.md`

**Objective:**

Implement deterministic, database-backed hard quota enforcement for maximum total sessions created per rolling 24-hour window. Enforce ceiling at request time in `POST /api/sessions` with hard stop behavior.

**Core Requirements:**
- Must enforce ceiling at request time (before container creation)
- No background workers or reconciliation jobs
- Database-backed quota tracking
- Idempotent enforcement across restarts

**Scope:**

This task is limited to **minimal, additive implementation only** in:
- `services/api-gateway` (extend existing QuotaGuard from TASK-42A-1)

**In Scope:**

1. **Max Sessions Per Rolling 24h Enforcement**
   - Enforce ceiling on session creation rate (rolling 24h)
   - Query database: `COUNT(*) WHERE user_id = ? AND created_at > NOW() - INTERVAL 24 HOUR`
   - Return HTTP 403 Forbidden if limit exceeded
   - Deterministic error response with quota details and reset_at timestamp

2. **Hard Stop Behavior**
   - No container started if quota exceeded
   - Fail fast with clear error message

3. **Rolling Window Calculation**
   - Use `created_at` timestamp for rolling window
   - Window resets continuously (not fixed daily)
   - Deterministic calculation (same time → same result)

**Quota Configuration:**
```typescript
const QUOTA_LIMITS = {
  MAX_SESSIONS_PER_24H: 20,
};
```

**Enforcement Logic:**
```
IF (sessions_created_last_24h >= MAX_SESSIONS_PER_24H) THEN
  RETURN HTTP 403 Forbidden
  { "error": "quota_exceeded", "quota_type": "max_sessions_per_day", "limit": 20, "current": N, "reset_at": "<timestamp>" }
ELSE
  PROCEED with session creation
```

**Explicitly Out of Scope:**
- ❌ No token quota enforcement (TASK-42A-3)
- ❌ No billing system redesign
- ❌ No background workers
- ❌ No schema changes
- ❌ No Redis or distributed caching

**Acceptance Criteria:**
- [ ] Rolling 24h session count queried from database
- [ ] HTTP 403 returned if limit exceeded
- [ ] Error response includes reset_at timestamp
- [ ] Works across api-gateway restarts (DB-backed)
- [ ] Build passes (linter + TypeScript)
- [ ] No regressions to TASK-42A-1

**Stop Conditions:**
1. ✅ Rolling 24h session limit enforcement implemented
2. ✅ Manual PowerShell verification completed
3. ✅ Checkpoint written to `docs/PHASE-42A-2-CHECKPOINT.md`
4. ✅ No scope expansion occurred

**Effort Estimate:** 1-2 hours

---

### TASK-42A-3: Hard Quota Enforcement — Max Tokens Per Rolling 24h

**Task ID:** TASK-42A-3  
**Phase:** 42  
**Stage:** 42A  
**Priority:** 🔴 High  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Dependencies:** TASK-42A-2  
**Checkpoint:** `docs/PHASE-42A-3-CHECKPOINT.md`

**Objective:**

Implement deterministic, database-backed hard quota enforcement for maximum AI tokens consumed per rolling 24-hour window. Enforce ceiling at request time in `POST /api/ai/execute` with hard stop behavior.

**Core Requirements:**
- Must enforce ceiling at request time (before AI provider call)
- No background workers or reconciliation jobs
- Database-backed quota tracking
- Idempotent enforcement across restarts

**Scope:**

This task is limited to **minimal, additive implementation only** in:
- `services/api-gateway` (quota guard for AI execution)

**In Scope:**

1. **Max Tokens Per Rolling 24h Enforcement**
   - Enforce ceiling on AI token consumption (rolling 24h)
   - Query database: `SUM(tokens_used) WHERE user_id = ? AND created_at > NOW() - INTERVAL 24 HOUR`
   - Estimate tokens for current request (use token counter)
   - Return HTTP 403 Forbidden if limit would be exceeded
   - Deterministic error response with quota details

2. **Hard Stop Behavior**
   - No AI provider called if quota exceeded
   - Fail fast with clear error message

3. **Rolling Window Calculation**
   - Use `created_at` timestamp for rolling window
   - Window resets continuously (not fixed daily)
   - Deterministic calculation (same time → same result)

**Quota Configuration:**
```typescript
const QUOTA_LIMITS = {
  MAX_TOKENS_PER_24H: 100000,
};
```

**Enforcement Logic:**
```
IF (tokens_used_last_24h + estimated_tokens >= MAX_TOKENS_PER_24H) THEN
  RETURN HTTP 403 Forbidden
  { "error": "quota_exceeded", "quota_type": "max_tokens_per_day", "limit": 100000, "used": N, "reset_at": "<timestamp>" }
ELSE
  PROCEED with AI execution
```

**Explicitly Out of Scope:**
- ❌ No billing system redesign
- ❌ No background workers
- ❌ No schema changes
- ❌ No Redis or distributed caching

**Acceptance Criteria:**
- [ ] `QuotaGuard` implemented for `POST /api/ai/execute`
- [ ] Token usage queried from database (rolling 24h)
- [ ] Token estimation performed before enforcement
- [ ] HTTP 403 returned if limit would be exceeded
- [ ] Error response includes used, limit, reset_at
- [ ] No AI provider called if quota exceeded
- [ ] Works across api-gateway restarts (DB-backed)
- [ ] Build passes (linter + TypeScript)
- [ ] No regressions to TASK-42A-1, TASK-42A-2

**Stop Conditions:**
1. ✅ Token quota enforcement implemented
2. ✅ Manual PowerShell verification completed
3. ✅ Checkpoint written to `docs/PHASE-42A-3-CHECKPOINT.md`
4. ✅ No scope expansion occurred

**Effort Estimate:** 1-2 hours

---

### TASK-42A-4: Hard Quota Enforcement — PS 5.x Verification + PHASE-42A Finalization

**Task ID:** TASK-42A-4  
**Phase:** 42  
**Stage:** 42A  
**Priority:** 🔴 High  
**Nature:** VERIFICATION + DOCUMENTATION  
**Dependencies:** TASK-42A-1, TASK-42A-2, TASK-42A-3  
**Checkpoint:** `docs/PHASE-42A-CHECKPOINT.md`

**Objective:**

Comprehensive verification of all PHASE-42A quota enforcement mechanisms using PowerShell 5.x scripts. Finalize PHASE-42A checkpoint with complete documentation and rollback procedures.

**Scope:**

This task is limited to **verification and documentation only**:
- No code changes
- PowerShell 5.x verification scripts
- Comprehensive checkpoint documentation

**In Scope:**

1. **PowerShell 5.x Verification Scripts**
   - Test max active sessions enforcement (TASK-42A-1)
   - Test rolling 24h session limit enforcement (TASK-42A-2)
   - Test rolling 24h token limit enforcement (TASK-42A-3)
   - Test error response formats
   - Test restart persistence
   - Test concurrent request behavior

2. **Integration Verification**
   - Verify all three quota types work together
   - Verify no interference with rate limiting (PHASE-41B)
   - Verify no interference with metrics (PHASE-41A)
   - Verify deterministic behavior across restarts

3. **PHASE-42A Checkpoint Finalization**
   - Consolidate all TASK-42A-1/2/3 checkpoints
   - Document complete quota enforcement system
   - Document rollback procedures
   - Document known limitations
   - Document future work (if any)

**Explicitly Out of Scope:**
- ❌ No code changes
- ❌ No new features
- ❌ No refactors

**Acceptance Criteria:**
- [ ] PowerShell 5.x scripts execute successfully on Windows
- [ ] All quota enforcement mechanisms verified
- [ ] Error response formats verified
- [ ] Restart persistence verified
- [ ] Concurrent request behavior verified
- [ ] No regressions to PHASE-41A/41B/41C
- [ ] PHASE-42A checkpoint written to `docs/PHASE-42A-CHECKPOINT.md`
- [ ] Rollback procedures documented

**Stop Conditions:**
1. ✅ All PowerShell verification scripts completed
2. ✅ PHASE-42A checkpoint finalized
3. ✅ No scope expansion occurred

**Effort Estimate:** 1-2 hours

---

### ~~TASK-42A (ORIGINAL)~~ [DEPRECATED - SPLIT INTO TASK-42A-1/2/3/4]

**⚠️ DEPRECATED — REPLACED BY TASK-42A-1, TASK-42A-2, TASK-42A-3, TASK-42A-4**

**Task ID:** TASK-42A (DEPRECATED)  
**Status:** ❌ **SPLIT INTO 4 SUBTASKS**  
**Reason:** Original task scope too broad for single implementation phase. Split into focused subtasks for tighter scope control and incremental verification.

**Replaced By:**
- TASK-42A-1: Max Active Sessions Per User
- TASK-42A-2: Max Sessions Per Rolling 24h
- TASK-42A-3: Max Tokens Per Rolling 24h
- TASK-42A-4: PS 5.x Verification + PHASE-42A Finalization

**Original Objective (Preserved for Reference):**

Implement deterministic, database-backed hard quota enforcement to prevent resource abuse beyond authenticated rate limits. Enforce resource ceilings at request time with hard stop behavior and no background workers.

**Core Requirements:**
- Must enforce ceilings at request time (before side effects)
- No background workers or reconciliation jobs
- No probabilistic logic (deterministic only)
- Database-backed quota tracking
- Idempotent enforcement across restarts

**Scope:**

This task is limited to **minimal, additive implementation only** in:
- `services/api-gateway` (quota guard + enforcement logic)

**In Scope:**

1. **Max Active Sessions Per User**
   - Enforce ceiling on concurrent active (non-terminated) sessions
   - Check before container creation
   - Return HTTP 403 Forbidden if limit exceeded

2. **Max Total Sessions Per Rolling 24h Window**
   - Enforce ceiling on session creation rate (rolling 24h)
   - Query database for session count in last 24 hours
   - Return HTTP 403 Forbidden if limit exceeded

3. **Max AI Tokens Per Rolling 24h Window**
   - Enforce ceiling on AI token consumption (rolling 24h)
   - Query database for token usage in last 24 hours
   - Return HTTP 403 Forbidden or 402 Payment Required if limit exceeded

4. **Hard Stop Behavior**
   - No partial execution (all-or-nothing)
   - Deterministic error responses
   - No container started if quota exceeded
   - No AI provider called if quota exceeded

5. **Deterministic DB-Backed Enforcement**
   - All quota state stored in database (no in-memory only)
   - Quota checks survive service restarts
   - Idempotent enforcement (same request → same result)

6. **Enforcement at Request Entry**
   - Quota checks occur before side effects
   - Check before `ContainerService.startContainer()`
   - Check before `AIGatewayService.callClaude()`
   - Fail fast with clear error message

**Note:** This task was split into TASK-42A-1, TASK-42A-2, TASK-42A-3, TASK-42A-4 for tighter scope control and incremental verification. See above for replacement tasks.

---

## Phase 60: Alerting & Incident Readiness

### TASK-60A: Alerting & Incident Readiness Design

**Task ID:** TASK-60A  
**Phase:** 60  
**Stage:** 60A  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Dependencies:** PHASE-41A (Runtime Metrics)  
**Checkpoint:** `docs/PHASE-60A-CHECKPOINT.md`

**Objective:**

Define production alerting scope, alert thresholds, incident signal definitions, and runbook requirements. Design must align with current architecture constraints (no background workers, request-driven enforcement, no event bus).

**Scope:**

This task is limited to **documentation and design only**—no code changes.

**In Scope:**

1. **Production Alerting Scope**
   - What to alert on (connectivity, session drift, error rates, etc.)
   - How alerting integrates with existing `/api/runtime/metrics` (external polling)
   - Boundaries: no in-process alerting agents, no background workers

2. **Alert Thresholds**
   - Numeric thresholds for alert conditions
   - Severity levels (warning, critical)
   - Threshold rationale

3. **Incident Signal Definitions**
   - What constitutes an incident
   - Incident severity classification
   - Signal-to-incident mapping

4. **Runbook Requirements**
   - Runbook structure and content
   - Required runbooks (connectivity, session drift, etc.)
   - Escalation paths

5. **Architecture Alignment**
   - Alignment with ARCHITECTURE.md (no background workers, no cron, no event bus)
   - Preserve execution, quota, billing, ledger, observability behavior

**Explicitly Out of Scope:**

- ❌ No code changes in 60A
- ❌ No implementation of alerting systems (Prometheus, Grafana, etc.)
- ❌ No database schema changes
- ❌ No background workers or scheduled jobs
- ❌ No modifications to existing metrics endpoint

**Acceptance Criteria:**

- [ ] Design document covers production alerting scope
- [ ] Alert thresholds defined with rationale
- [ ] Incident signal definitions documented
- [ ] Runbook requirements specified
- [ ] Architecture constraints respected
- [ ] Checkpoint written to `docs/PHASE-60A-CHECKPOINT.md`

**Stop Conditions:**

1. ✅ Design document complete
2. ✅ Checkpoint written
3. ✅ No scope expansion occurred

**Reference:** ARCHITECTURE.md Section 11 (Explicit Non-Goals), PHASE-41A-CHECKPOINT.md (Runtime Metrics)

---

### TASK-60B: External Monitoring Contract & Runbook Implementation

**Task ID:** TASK-60B  
**Phase:** 60  
**Stage:** 60B  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION (NO CODE)  
**Dependencies:** PHASE-60A (Design)  
**Checkpoint:** `docs/PHASE-60B-CHECKPOINT.md`

**Objective:**

Implement external monitoring contract and runbook documents to make Phase 60A design operationally usable. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**

1. **External Monitoring Contract**
   - Contract for existing endpoints (`/api/runtime/metrics`, `/api/health`, `/api/health/ready`, `/api/health/db`)
   - Polling/evaluation rules based on Phase 60A design
   - Response format, thresholds, debounce/cooldown guidance

2. **Runbook Implementation**
   - Five runbook documents for the 5 defined incident categories
   - Connectivity: Docker connectivity lost, Database connectivity lost, API Gateway unreachable
   - Session/Container: Session–container drift
   - Termination: Elevated error termination rate
   - Per PHASE-60A-DESIGN.md section 5 (structure, verification, remediation, escalation)

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No background workers, cron, or event bus

**Acceptance Criteria:**

- [ ] External monitoring contract document created
- [ ] Five runbook documents created per Phase 60A design
- [ ] Checkpoint written to `docs/PHASE-60B-CHECKPOINT.md`

**Reference:** PHASE-60A-DESIGN.md, PHASE-60A-CHECKPOINT.md

---

## Phase 61: Backup & Disaster Recovery

### TASK-61A: Backup & Disaster Recovery Design

**Task ID:** TASK-61A  
**Phase:** 61  
**Stage:** 61A  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Dependencies:** None  
**Checkpoint:** `docs/PHASE-61A-CHECKPOINT.md`

**Objective:**

Define backup scope, restore priorities, disaster recovery scenarios, recovery objectives (RPO/RTO), and operational restore/runbook requirements. Design must align with current architecture constraints (no background workers, request-driven, single-node focus).

**Scope:**

This task is limited to **documentation and design only**—no code changes.

**In Scope:**

1. **Backup Scope and Backup Targets**
   - What to back up (database, configuration, workspace data, etc.)
   - Backup targets and storage considerations

2. **Restore Priorities and Recovery Order**
   - Order of restore operations
   - Dependencies between restore steps

3. **Disaster Recovery Scenarios**
   - Scenario definitions (data loss, node failure, corruption, etc.)
   - Response procedures per scenario

4. **Recovery Objectives (RPO/RTO)**
   - Recovery Point Objective where applicable
   - Recovery Time Objective where applicable

5. **Operational Restore/Runbook Requirements**
   - Runbook structure for restore operations
   - Verification and validation steps

6. **Architecture Alignment**
   - Alignment with ARCHITECTURE.md (no background workers, no cron, single-node)
   - Preserve governance, session lifecycle, and data integrity guarantees

**Explicitly Out of Scope:**

- ❌ No code changes in 61A
- ❌ No implementation of backup systems
- ❌ No database schema changes
- ❌ No background workers or scheduled jobs

**Acceptance Criteria:**

- [ ] Design document covers backup scope and targets
- [ ] Restore priorities and recovery order defined
- [ ] Disaster recovery scenarios documented
- [ ] RPO/RTO specified where applicable
- [ ] Operational restore/runbook requirements specified
- [ ] Architecture constraints respected
- [ ] Checkpoint written to `docs/PHASE-61A-CHECKPOINT.md`

**Reference:** ARCHITECTURE.md Section 11 (Explicit Non-Goals), Section 12 (Summary)

---

### TASK-61B: Backup & Restore Runbook Implementation

**Task ID:** TASK-61B  
**Phase:** 61  
**Stage:** 61B  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION (NO CODE)  
**Dependencies:** PHASE-61A (Design)  
**Checkpoint:** `docs/PHASE-61B-CHECKPOINT.md`

**Objective:**

Implement operational backup procedure documents and restore runbooks for the Phase 61A recovery scenarios. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**

This task is limited to **documentation only**—no code changes.

**In Scope:**

1. **Operational Backup Procedure Documents**
   - Backup procedure for PostgreSQL (pg_dump or equivalent)
   - Backup procedure for configuration
   - Verification and integrity checks

2. **Restore Runbooks**

   Per PHASE-61A-DESIGN.md Section 6.2:
   - PostgreSQL restore from dump
   - Full stack rebuild (host loss)
   - Configuration/secrets restore

3. **Recovery Verification Steps**
   - Per PHASE-61A-DESIGN.md Section 6.3, 6.5
   - Health checks, smoke tests

4. **Rollback / Retry Guidance**
   - Per PHASE-61A-DESIGN.md Section 6.4

5. **Operator Prerequisites, Dependencies, and Safety Checks**
   - Tools required (pg_dump, pg_restore, etc.)
   - Backup location, credentials
   - Pre-restore safety checks

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No background workers, cron, or event bus

**Acceptance Criteria:**

- [ ] Operational backup procedure documents created
- [ ] Restore runbooks created for all Phase 61A scenarios
- [ ] Recovery verification steps documented
- [ ] Rollback/retry guidance documented
- [ ] Operator prerequisites and safety checks documented
- [ ] Checkpoint written to `docs/PHASE-61B-CHECKPOINT.md`

**Reference:** PHASE-61A-DESIGN.md, PHASE-61A-CHECKPOINT.md

---

## Phase 62: Backup & Restore Validation Drill

### TASK-62A: Backup & Restore Validation Drill Design

**Task ID:** TASK-62A  
**Phase:** 62  
**Stage:** 62A  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Dependencies:** PHASE-61 COMPLETE  
**Checkpoint:** `docs/PHASE-62A-CHECKPOINT.md`

**Objective:**

Produce the Phase 62A design for backup and restore validation drills so the platform can regularly prove that Phase 61 backup and disaster recovery procedures actually work in practice.

**Reference:** PHASE-62A-DESIGN.md, PHASE-62A-CHECKPOINT.md

---

### TASK-62B: Backup & Restore Validation Drill Runbook Implementation

**Task ID:** TASK-62B  
**Phase:** 62  
**Stage:** 62B  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION (NO CODE)  
**Dependencies:** PHASE-62A (Design)  
**Checkpoint:** `docs/PHASE-62B-CHECKPOINT.md`

**Objective:**

Implement operator-ready validation drill runbooks for Phase 62A scenarios. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**

This task is limited to **documentation only**—no code changes.

**In Scope:**

1. **Operator-Ready Validation Drill Runbooks**
   - Per PHASE-62A-DESIGN.md Section 6.1
   - Database restore validation drill
   - Configuration/secrets restore validation drill
   - Full stack rebuild validation drill
   - Backup integrity verification drill
   - Corrupted deployment recovery drill (optional)

2. **Drill Execution Steps**
   - Ordered steps for each Phase 62A scenario
   - Reference to Phase 61 runbooks where applicable

3. **Evidence Capture Requirements**
   - Drill log (date, operator, environment, duration)
   - Pass/fail recording requirements
   - RTO measurement where applicable
   - Checksum verification output (backup integrity)

4. **Abort / Rollback Conditions**
   - Per PHASE-62A-DESIGN.md Section 6.4
   - When to stop, how to clean up

5. **Post-Drill Cleanup and Signoff**
   - Per PHASE-62A-DESIGN.md Section 6.5
   - Restore staging to normal state
   - Signoff expectations

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No background workers, cron, or event bus

**Acceptance Criteria:**

- [ ] Validation drill runbooks created for all Phase 62A mandatory scenarios
- [ ] Drill execution steps documented
- [ ] Evidence capture and pass/fail recording documented
- [ ] Abort/rollback conditions documented
- [ ] Post-drill cleanup and signoff documented
- [ ] Checkpoint written to `docs/PHASE-62B-CHECKPOINT.md`

**Reference:** PHASE-62A-DESIGN.md, PHASE-62A-CHECKPOINT.md

---

## Phase 63: Security Operations & Compliance Readiness

### TASK-63A: Security Operations & Compliance Readiness Design

**Task ID:** TASK-63A  
**Phase:** 63  
**Stage:** 63A  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Dependencies:** None  
**Checkpoint:** `docs/PHASE-63A-CHECKPOINT.md`

**Objective:**

Define security operations scope for launch readiness, including audit logging, incident response, access control, backup encryption, privacy/compliance, and security runbook requirements. Design must align with current architecture constraints.

**Scope:**

This task is limited to **documentation/design only**—no code changes.

**In Scope:**

1. **Security Operations Scope for Launch Readiness**
   - What security operations are required before production launch

2. **Audit Logging and Audit Review Requirements**
   - What must be logged, retention, review cadence

3. **Incident Response / Security Event Handling Requirements**
   - How security events are detected, escalated, and resolved

4. **Access Control / Secrets Handling Operational Requirements**
   - Operational procedures for access control and secrets management

5. **Backup Encryption / Sensitive Data Protection Requirements**
   - How backups and sensitive data are protected at rest and in transit

6. **Privacy / Compliance Readiness Requirements**
   - Where applicable (e.g., data handling, retention, user rights)

7. **Security Runbook / Review Requirements**
   - Security-specific runbooks and periodic review expectations

8. **Alignment with Current Architecture Constraints**
   - No background workers, request-driven, stateless API

**Explicitly Out of Scope:**

- ❌ No code changes in 63A
- ❌ No implementation of security systems
- ❌ No schema changes

**Reference:** PHASE-63A-CHECKPOINT.md

---

### TASK-63B: Security Runbooks & Compliance Operational Documentation

**Task ID:** TASK-63B  
**Phase:** 63  
**Stage:** 63B  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION (NO CODE)  
**Dependencies:** PHASE-63A (Design)  
**Checkpoint:** `docs/PHASE-63B-CHECKPOINT.md`

**Objective:**

Implement operator-ready security runbooks and compliance operational documentation per Phase 63A design. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**

This task is limited to **documentation only**—no code changes.

**In Scope:**

1. **Operator-Ready Security Runbooks**
   - Per PHASE-63A-DESIGN.md Section 8.1
   - Incident response (extends PHASE-60 runbooks with security extensions)
   - Security incidents (credential compromise, unauthorized access, backup exposure)
   - Secrets rotation procedure, emergency rotation
   - Access revocation, emergency access

2. **Audit Review Procedures**
   - Monthly audit log review procedure
   - Quarterly access control review procedure
   - Security runbook review procedure

3. **Security Incident Handling Procedures**
   - Triage, escalation, containment, recovery, post-incident per PHASE-63A Section 4

4. **Secrets / Credential Handling Procedures**
   - Rotation procedure for INTERNAL_SERVICE_KEY, JWT_SECRET, DB passwords
   - Storage and access expectations

5. **Backup Protection / Restore-Time Sensitive Data Handling Procedures**
   - Encryption verification, off-host storage, restore-time protection

6. **Privacy / Compliance Operational Checklists**
   - Data handling, retention, deletion readiness
   - GDPR operational readiness where applicable

7. **Evidence / Signoff Requirements**
   - Per PHASE-63A Section 8.3
   - Audit log review, access control review, security runbook review signoff

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** PHASE-63A-DESIGN.md, PHASE-63A-CHECKPOINT.md

---

## Phase 64: Legal, Privacy & User Data Rights Readiness

### TASK-64A: Legal, Privacy & User Data Rights Readiness Design

**Task ID:** TASK-64A  
**Phase:** 64  
**Stage:** 64A  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Dependencies:** None  
**Checkpoint:** `docs/PHASE-64A-CHECKPOINT.md`

**Objective:**

Define launch-ready legal/privacy document scope, privacy policy/terms/cookie notice requirements at platform level, user data rights handling requirements, export/deletion request operational requirements, consent/disclosure requirements where applicable, evidence/signoff requirements, aligned with current architecture constraints.

**Scope:**

This task is limited to **documentation/design only**—no code changes.

**In Scope:**

1. **Launch-Ready Legal/Privacy Document Scope**
   - What legal and privacy documents are required before production launch

2. **Privacy Policy / Terms / Cookie Notice Requirements**
   - Platform-level requirements for privacy policy, terms of service, cookie notice

3. **User Data Rights Handling Requirements**
   - How user data rights (access, rectification, deletion, portability) are addressed

4. **Export / Deletion Request Operational Requirements**
   - Operational procedures for handling export and deletion requests

5. **Consent / Disclosure Requirements**
   - Where applicable (e.g., data collection, processing, third-party sharing)

6. **Evidence / Signoff Requirements**
   - Documentation and signoff expectations for legal/privacy readiness

7. **Alignment with Current Architecture Constraints**
   - No background workers, request-driven, stateless API

**Explicitly Out of Scope:**

- ❌ No code changes in 64A

**Reference:** PHASE-64A-CHECKPOINT.md

---

### TASK-64B: Legal, Privacy & User Data Rights Operational Documentation

**Task ID:** TASK-64B
**Phase:** 64
**Stage:** 64B
**Priority:** 🟡 Medium
**Nature:** DOCUMENTATION (NO CODE)
**Dependencies:** PHASE-64A (Design)
**Checkpoint:** `docs/PHASE-64B-CHECKPOINT.md`

**Objective:**

Implement operator-ready legal/privacy operational documentation per Phase 64A design. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**

This task is limited to **documentation only**—no code changes.

**In Scope:**

1. **Operator-Ready Legal/Privacy Operational Docs**
   - Per PHASE-64A-DESIGN.md
   - Operational procedures for legal/privacy request handling

2. **User Data Access/Export Request Procedure**
   - Intake, verification, fulfillment, evidence steps
   - Per PHASE-64A Section 4.1, 5

3. **User Data Deletion Request Procedure**
   - Intake, verification, cascade deletion, evidence steps
   - Per PHASE-64A Section 4.2, 5; extends privacy-compliance-request-handling runbook

4. **Identity Verification and Request Intake Handling**
   - Verification expectations; intake channel; tracking
   - Per PHASE-64A Section 4.4, 5.1

5. **Evidence / Tracking / Signoff Requirements**
   - Per PHASE-64A Section 5.2, 5.3
   - Request log; completion sign-off; escalation rules

6. **Cookie / Consent / Disclosure Operational Checklist**
   - Where applicable (e.g., policy updates, consent verification)
   - Per PHASE-64A Section 3.4

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** PHASE-64A-DESIGN.md, PHASE-64A-CHECKPOINT.md

---

## Phase 65: Admin Tools & Launch Operations

### TASK-65A: Admin Tools & Launch Operations Design

**Task ID:** TASK-65A  
**Phase:** 65  
**Stage:** 65A  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Dependencies:** None  
**Checkpoint:** `docs/PHASE-65A-CHECKPOINT.md`

**Objective:**

Define launch-ready admin tool scope, admin actions and operator permissions, abuse/ban/suspension operational requirements, refund/credit/manual quota adjustment operational requirements, admin health/visibility requirements, audit/evidence/signoff requirements for admin actions, aligned with current architecture constraints.

**Scope:**

This task is limited to **documentation/design only**—no code changes.

**In Scope:**

1. **Launch-Ready Admin Tool Scope**
   - What admin tools and capabilities are required before production launch

2. **Admin Actions and Operator Permissions**
   - Admin action catalog; operator roles and permission boundaries

3. **Abuse / Ban / Suspension Operational Requirements**
   - Operational procedures for abuse handling, user ban, account suspension

4. **Refund / Credit / Manual Quota Adjustment Operational Requirements**
   - Operational procedures for refunds, credits, manual quota overrides

5. **Admin Health / Visibility Requirements**
   - Admin-facing health checks, visibility into runtime state, diagnostic access

6. **Audit / Evidence / Signoff Requirements for Admin Actions**
   - Audit trail expectations, evidence capture, signoff requirements for admin mutations

7. **Alignment with Current Architecture Constraints**
   - No background workers, request-driven, stateless API; internal endpoints only

**Explicitly Out of Scope:**

- ❌ No code changes in 65A

**Reference:** PHASE-65A-CHECKPOINT.md

---

### TASK-65B: Admin Operations & Operator Procedure Documentation

**Task ID:** TASK-65B  
**Phase:** 65  
**Stage:** 65B  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION (NO CODE)  
**Dependencies:** PHASE-65A (Design)  
**Checkpoint:** `docs/PHASE-65B-CHECKPOINT.md`

**Objective:**

Implement operator-ready admin procedures per Phase 65A design. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**

This task is limited to **documentation only**—no code changes.

**In Scope:**

1. **Operator-Ready Admin Procedures**
   - Per PHASE-65A-DESIGN.md
   - Operational procedures for admin actions

2. **Abuse / Suspension / Ban Handling Procedures**
   - Intake, evidence, decision, escalation steps
   - Per PHASE-65A Section 4

3. **Refund / Credit / Manual Quota Adjustment Procedures**
   - When to act; checks; audit; rollback
   - Per PHASE-65A Section 5

4. **Launch-Day Admin Health / Visibility Checklist**
   - Per PHASE-65A Section 6; PHASE-57, PHASE-60

5. **Audit / Evidence / Signoff Requirements for Admin Actions**
   - Per PHASE-65A Section 7
   - Required records; review expectations; retention

6. **Operator Permissions / Approval Workflow Guidance**
   - Per PHASE-65A Section 3
   - Role expectations; approval for sensitive actions

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** PHASE-65A-DESIGN.md, PHASE-65A-CHECKPOINT.md

---

### TASK-65C: Admin Tools & Launch Operations Final Validation + Checkpoint

**Task ID:** TASK-65C  
**Phase:** 65  
**Stage:** 65C  
**Priority:** 🟡 Medium  
**Nature:** VALIDATION / DOCUMENTATION (NO CODE)  
**Dependencies:** PHASE-65A (Design), PHASE-65B (Operator Procedures)  
**Checkpoint:** `docs/PHASE-65C-CHECKPOINT.md`

**Objective:**

Final validation of Phase 65A design and Phase 65B operator documentation, with checkpoint creation. No platform code, schema, or endpoint changes.

**Scope:**

1. **Validation of Phase 65A Design and Phase 65B Operator Docs**
   - Verify design completeness and operator doc alignment

2. **Verification of Required Admin Procedure Docs**
   - Confirm all required admin procedure documents exist

3. **Verification of Admin Action Coverage, Evidence/Signoff, and Approval Workflow Guidance**
   - Admin action coverage; evidence/signoff requirements; approval workflow guidance

4. **Verification That Architecture Constraints Remain Preserved**
   - No background workers; request-driven; stateless API; internal endpoints only

5. **Final Checkpoint Creation**
   - Produce `docs/PHASE-65C-CHECKPOINT.md`

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** PHASE-65A-CHECKPOINT.md, PHASE-65B-CHECKPOINT.md

---

## Phase 66: Analytics & Growth Visibility

### TASK-66A: Analytics & Growth Visibility Design

**Task ID:** TASK-66A
**Phase:** 66
**Stage:** 66A
**Priority:** 🟡 Medium
**Nature:** DOCUMENTATION / DESIGN (NO CODE)
**Dependencies:** None
**Checkpoint:** `docs/PHASE-66A-CHECKPOINT.md`

**Objective:**

Define launch-ready analytics and growth visibility scope, product usage/retention/feature adoption visibility requirements, error/reliability/cost-per-user visibility requirements, operator/stakeholder dashboard requirements, evidence/review/signoff expectations, aligned with current architecture constraints.

**Scope:**

This task is limited to **documentation and design only**—no code changes.

**In Scope:**

1. **Launch-Ready Analytics and Growth Visibility Scope**
   - What analytics and growth visibility capabilities are required before production launch

2. **Product Usage / Retention / Feature Adoption Visibility Requirements**
   - Usage metrics, retention signals, feature adoption tracking requirements

3. **Error / Reliability / Cost-Per-User Visibility Requirements**
   - Error rate visibility, reliability metrics, cost-per-user visibility requirements

4. **Operator / Stakeholder Dashboard Requirements**
   - Dashboard scope for operators and stakeholders; data sources and refresh model

5. **Evidence / Review / Signoff Expectations**
   - Evidence capture, review cadence, signoff requirements for analytics deliverables

6. **Alignment with Current Architecture Constraints**
   - No background workers, request-driven, stateless API; existing metrics endpoints only

**Explicitly Out of Scope:**

- ❌ No code changes in 66A

**Reference:** PHASE-66A-CHECKPOINT.md

---

### TASK-66B: Analytics & Growth Visibility Operational Documentation

**Task ID:** TASK-66B
**Phase:** 66
**Stage:** 66B
**Priority:** 🟡 Medium
**Nature:** DOCUMENTATION (NO CODE)
**Dependencies:** PHASE-66A (Design)
**Checkpoint:** `docs/PHASE-66B-CHECKPOINT.md`

**Objective:**

Implement operator-ready analytics review procedures and stakeholder/founder reporting procedures per Phase 66A design. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**

This task is limited to **documentation only**—no code changes.

**In Scope:**

1. **Operator-Ready Analytics Review Procedures**
   - Per PHASE-66A-DESIGN.md
   - Operational procedures for analytics review

2. **Stakeholder / Founder Reporting Procedures**
   - Report structure; data sources; delivery cadence

3. **Metric Review Cadence and Ownership**
   - Review frequency; owner assignment; escalation

4. **Evidence / Signoff / Interpretation Guidance**
   - Evidence capture; signoff requirements; metric interpretation

5. **Dashboard Usage Guidance**
   - Product, cost, reliability, and growth visibility
   - How to obtain each view from existing endpoints

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** PHASE-66A-DESIGN.md, PHASE-66A-CHECKPOINT.md

---

## Phase 67: Core Product UX/UI Design

### TASK-67A: Core Product UX/UI Design

**Task ID:** TASK-67A
**Phase:** 67
**Stage:** 67A
**Priority:** 🟡 Medium
**Nature:** DOCUMENTATION / DESIGN (NO CODE)
**Dependencies:** None
**Checkpoint:** `docs/PHASE-67A-CHECKPOINT.md`

**Objective:**

Define launch-ready core product UX/UI requirements for the AI Sandbox Platform, focused on the main authenticated product experience and highest-priority user-facing surfaces still blocking launch readiness.

**Scope:**

This task is limited to **documentation/design only**—no code changes.

**In Scope:**

1. **Main App UX/UI Scope**
   - Core product UX/UI boundaries and requirements

2. **Chat / Editor / Preview Workspace UX**
   - Workspace layout, interaction patterns, and UX expectations

3. **Session Layout and Navigation UX**
   - Session layout, navigation patterns, and UX requirements

4. **History / Timeline UX**
   - History and timeline UX expectations

5. **Checkpoint / Revert / Diff / Git-Log UX Expectations**
   - Checkpoint, revert, diff, and git-log UX requirements

6. **User Dashboard UX Requirements**
   - User-facing dashboard UX requirements

7. **Admin Dashboard UX Requirements**
   - Admin dashboard UX requirements at high level only

8. **Public-Facing Product Surface Requirements**
   - Public-facing product surface requirements at high level only where needed for launch coherence

9. **Responsive / Launch-Polish Requirements**
   - Responsive and launch-polish requirements

10. **Alignment with Current Architecture and Existing Backend Constraints**
    - Alignment with current architecture and existing backend constraints

**Explicitly Out of Scope:**

- ❌ No implementation
- ❌ No frontend code changes
- ❌ No backend code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No design system refactor
- ❌ No visual asset production
- ❌ No copywriting expansion beyond task registration text

**Reference:** PHASE-67A-CHECKPOINT.md

---

### TASK-67B: UX/UI Final Consolidation + Validation

**Task ID:** TASK-67B
**Phase:** 67
**Stage:** 67B
**Priority:** 🟡 Medium
**Nature:** DOCUMENTATION / VALIDATION (NO CODE)
**Dependencies:** PHASE-67A (Design)
**Checkpoint:** `docs/PHASE-67B-CHECKPOINT.md`

**Objective:**

Final consolidation and validation of all Phase 67A UX/UI design documentation to ensure consistency, completeness, and launch readiness. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**

This task is limited to **documentation and validation only**—no code changes.

**In Scope:**

1. **Validation of PHASE-67A-1, PHASE-67A-2, and PHASE-67A-3 Checkpoint Consistency**
   - Verify all Phase 67A checkpoint slices are internally consistent
   - Verify no contradictions across checkpoint documents

2. **Consolidation of Core Product UX/UI Design Coverage**
   - Consolidate coverage across all Phase 67A slices
   - Verify workspace UX, history/control UX, dashboards, and public-facing surfaces are fully covered

3. **Conflict/Gap Review**
   - Identify conflicts across workspace UX, history/control UX, dashboards, and public-facing surfaces
   - Identify gaps in UX/UI design documentation

4. **PRD / ARCHITECTURE Alignment Review**
   - Verify UX/UI design aligns with PRD.md and ARCHITECTURE.md
   - Verify no architectural violations

5. **Launch-Readiness Validation for UX/UI Documentation Scope**
   - Verify UX/UI documentation scope is sufficient for launch readiness
   - Verify no blocking UX/UI design gaps remain

6. **Final Phase 67 Checkpoint Creation Readiness**
   - Produce `docs/PHASE-67B-CHECKPOINT.md`

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No implementation
- ❌ No frontend code changes
- ❌ No backend code changes

**Reference:** PHASE-67A-CHECKPOINT.md

---

### TASK-67C: Phase 67 Final Checkpoint

**Task ID:** TASK-67C
**Phase:** 67
**Stage:** 67C
**Priority:** 🟡 Medium
**Nature:** DOCUMENTATION (NO CODE)
**Dependencies:** PHASE-67A (Design), PHASE-67B (Validation)
**Checkpoint:** `docs/PHASE-67-CHECKPOINT.md`

**Objective:**

Create final Phase 67 checkpoint summarizing all UX/UI design work and confirming documentation-only scope compliance. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**

This task is limited to **documentation only**—no code changes.

**In Scope:**

1. **Final Validation Summary of Phase 67A-1, 67A-2, 67A-3, and 67B**
   - Summarize all Phase 67 checkpoint outputs
   - Confirm all checkpoints complete and locked

2. **Confirmation That Phase 67 UX/UI Design Scope is Complete**
   - Verify all launch-critical UX/UI surfaces defined
   - Verify all user types addressed
   - Verify all states covered

3. **Confirmation That Scope Remained Documentation-Only**
   - Verify no code changes occurred during Phase 67
   - Verify no schema changes occurred
   - Verify no endpoint changes occurred

4. **Confirmation That No Code/Schema/Endpoint Changes Occurred**
   - Explicit verification of documentation-only constraint
   - Confirmation that all invariants preserved

5. **Creation of the Final Phase 67 Checkpoint**
   - Produce `docs/PHASE-67-CHECKPOINT.md`
   - Lock Phase 67 as complete

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No implementation
- ❌ No frontend code changes
- ❌ No backend code changes

**Reference:** PHASE-67A-CHECKPOINT.md, PHASE-67B-CHECKPOINT.md

---

### TASK-68A: UX/UI Implementation Planning

**Task ID:** TASK-68A
**Phase:** 68
**Stage:** 68A
**Priority:** 🟡 Medium
**Nature:** DOCUMENTATION / PLANNING (NO CODE)
**Dependencies:** PHASE-67 (Complete)
**Checkpoint:** `docs/PHASE-68A-CHECKPOINT.md`

**Objective:**

Convert completed Phase 67 UX/UI design outputs into an implementation-ready execution plan for launch-priority UX/UI work. This task produces a structured implementation roadmap that sequences backend and frontend work, identifies dependencies, and defines controlled implementation stages. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**

This task is limited to **documentation only**—no code changes.

**In Scope:**

1. **Recommended Implementation Sequence for Launch-Priority UX/UI Work**
   - Define implementation order (backend endpoints first, then frontend components)
   - Identify critical path for launch readiness
   - Define parallel vs sequential work streams

2. **Backend Dependency Mapping for UX/UI Implementation**
   - Map Phase 67 UX requirements to required backend endpoints
   - Identify existing endpoints (already implemented)
   - Identify missing endpoints (not yet implemented)
   - Define endpoint implementation priority

3. **Frontend Dependency Mapping for UX/UI Implementation**
   - Map Phase 67 UX designs to frontend components
   - Identify component dependencies
   - Define component implementation order

4. **Slicing of Implementation into Controlled Stages**
   - Break implementation into manageable stages
   - Define stage boundaries (backend vs frontend, workspace vs dashboard, etc.)
   - Define stage dependencies and prerequisites

5. **Validation of What Can Be Implemented Immediately vs What Depends on Missing Backend/Product Surfaces**
   - Identify blockers (missing endpoints, missing product features)
   - Identify ready-to-implement surfaces (no blockers)
   - Define workarounds or stubs for blocked work (if applicable)

6. **Implementation Task Breakdown and Sequencing**
   - Define specific implementation tasks (backend endpoint tasks, frontend component tasks)
   - Sequence tasks by dependency order
   - Estimate complexity/scope per task (high-level)

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No implementation
- ❌ No frontend code changes
- ❌ No backend code changes
- ❌ No architecture changes
- ❌ No scope expansion beyond Phase 67 design outputs

**Deliverables:**

1. **Implementation Plan Document**
   - Checkpoint: `docs/PHASE-68A-CHECKPOINT.md`
   - Contents:
     - Implementation sequence (backend → frontend)
     - Backend endpoint task breakdown
     - Frontend component task breakdown
     - Dependency mapping (Phase 67 UX → backend endpoints → frontend components)
     - Stage definitions (controlled slicing)
     - Blocker identification (missing endpoints, missing features)
     - Ready-to-implement identification
     - Implementation task registry (task IDs, scope, dependencies)

2. **Task Status Update**
   - Mark TASK-68A as COMPLETE in `TASKS.md`
   - Lock TASK-68A after checkpoint creation

**Acceptance Criteria:**

- ✅ Implementation sequence clearly defined
- ✅ Backend dependencies mapped (Phase 67 UX → required endpoints)
- ✅ Frontend dependencies mapped (Phase 67 UX → required components)
- ✅ Implementation sliced into controlled stages
- ✅ Blockers identified (missing endpoints/features)
- ✅ Ready-to-implement work identified
- ✅ Implementation tasks defined with IDs and dependencies
- ✅ Checkpoint created: `docs/PHASE-68A-CHECKPOINT.md`

**Preserved Invariants:**

- No code changes (documentation only)
- No schema changes
- No endpoint changes
- No architecture changes
- No scope expansion beyond Phase 67 outputs

**Reference:** PHASE-67-FINAL-CHECKPOINT.md

---

### TASK-68B: Backend UX/UI Support Endpoints — History/Control Slice

**Task ID:** TASK-68B
**Phase:** 68
**Stage:** 68B
**Priority:** 🔴 High
**Nature:** IMPLEMENTATION (BACKEND ONLY, ADDITIVE)
**Dependencies:** PHASE-68A (Complete), Existing git_checkpoints table, Existing git auto-commit system
**Checkpoint:** `docs/PHASE-68B-CHECKPOINT.md`

**Objective:**

Implement the first minimal backend endpoint slice to unblock frontend history/control UX implementation (PHASE-67A-2). This task implements only the three history/control endpoints identified as highest priority in Phase 68A implementation plan. These endpoints expose the existing git checkpoint system to the frontend via public REST APIs.

**Scope:**

This task is limited to **backend implementation only**—no frontend, no schema changes.

**In Scope:**

1. **GET /api/sessions/:id/checkpoints**
   - List all checkpoints for a session
   - Query git_checkpoints table WHERE session_id = :id
   - Order by created_at DESC (newest first)
   - Return array of checkpoints (id, commitHash, messageNumber, description, filesChanged, createdAt)
   - Enforce JWT auth, session ownership
   - Handle 404 (session not found), 410 (session terminated, but still return checkpoints), 403 (not owned)
   - Response format:
     ```json
     [
       {
         "id": "uuid",
         "commitHash": "abc123def456...",
         "messageNumber": 1,
         "description": "Created Flask app",
         "filesChanged": 2,
         "createdAt": "2026-03-09T14:32:15Z"
       }
     ]
     ```

2. **GET /api/sessions/:id/checkpoints/:hash/diff**
   - Get diff for a specific checkpoint (vs parent commit)
   - Execute git diff inside session container (or via git CLI)
   - Parse diff output, structure as JSON
   - Return files array with path, status, diff content
   - Enforce JWT auth, session ownership
   - Handle 404 (checkpoint not found), 403 (not owned), 410 (terminated, but still return diff)
   - Response format:
     ```json
     {
       "commitHash": "abc123def456...",
       "parentHash": "parent123...",
       "files": [
         {
           "path": "app.py",
           "status": "added",
           "diff": "unified diff content..."
         }
       ]
     }
     ```

3. **POST /api/sessions/:id/revert**
   - Revert session to a specific checkpoint
   - Validate request body (commitHash required)
   - Verify session active (not terminated) → 410 if terminated
   - Execute git revert or git reset inside container
   - Create new checkpoint via existing internal checkpoint system
   - Return new checkpoint info
   - Enforce JWT auth, session ownership
   - Handle 410 (session terminated), 404 (checkpoint not found), 403 (not owned)
   - Request body:
     ```json
     {
       "commitHash": "abc123def456..."
     }
     ```
   - Response format:
     ```json
     {
       "message": "Reverted successfully",
       "newCheckpoint": {
         "id": "uuid",
         "commitHash": "new123...",
         "description": "Reverted to abc123"
       }
     }
     ```

4. **Endpoint Tests**
   - Unit tests (controller, service methods)
   - Integration tests (E2E endpoint behavior, auth, ownership, error handling)
   - Test coverage target: 80%+

5. **API Documentation**
   - OpenAPI/Swagger documentation for all 3 endpoints
   - Request/response schemas
   - Error response documentation (404, 410, 429, 403, 500)

**Explicitly Out of Scope:**

- ❌ No user dashboard endpoints (deferred to TASK-68B-2)
- ❌ No admin dashboard endpoints (deferred to TASK-68B-3)
- ❌ No schema changes (use existing git_checkpoints table)
- ❌ No git_checkpoints table modifications
- ❌ No frontend work
- ❌ No frontend components
- ❌ No refactors outside endpoint implementation
- ❌ No architectural changes
- ❌ No scope expansion beyond history/control endpoints

**Deliverables:**

1. **Controller Implementation**
   - New controller: `checkpoints.controller.ts` (or extend `sessions.controller.ts`)
   - 3 new controller methods (GET checkpoints, GET diff, POST revert)
   - JWT auth guards applied
   - Session ownership guards applied

2. **Service Implementation**
   - New service: `checkpoints.service.ts` (or extend `sessions.service.ts`)
   - 3 new service methods (list checkpoints, get diff, execute revert)
   - Git operations (query git_checkpoints table, execute git diff/revert inside container)
   - Checkpoint creation integration (use existing internal checkpoint system)

3. **Tests**
   - Unit tests (controller methods, service methods)
   - Integration tests (E2E endpoint behavior)
   - Test coverage: 80%+ for new code

4. **API Documentation**
   - OpenAPI/Swagger specs for 3 endpoints
   - Request/response schemas
   - Error documentation

5. **Checkpoint**
   - `docs/PHASE-68B-CHECKPOINT.md`
   - Implementation summary
   - Test results
   - API documentation references

**Acceptance Criteria:**

- ✅ GET /api/sessions/:id/checkpoints returns correct data format
- ✅ GET /api/sessions/:id/checkpoints/:hash/diff returns valid diff content
- ✅ POST /api/sessions/:id/revert creates new checkpoint and reverts workspace
- ✅ All endpoints enforce JWT auth
- ✅ All endpoints enforce session ownership (403 if not owned, 404 if not found)
- ✅ All endpoints handle termination correctly (410 for revert, but allow read for checkpoints/diff)
- ✅ All endpoints tested (80%+ coverage)
- ✅ API documentation complete (OpenAPI/Swagger)
- ✅ No schema changes occurred
- ✅ No frontend changes occurred

**Preserved Invariants:**

- No schema changes (use existing git_checkpoints table)
- No API contract changes to existing endpoints
- New endpoints additive only (no breaking changes)
- Request-driven enforcement (no background workers)
- Deterministic error semantics (404, 410, 429, 403, 500)
- Session lifecycle respected (CREATED → ACTIVE → TERMINATED)
- Termination permanent (revert returns 410 for terminated sessions)

**Reference:** PHASE-68A-CHECKPOINT.md (Section 8: Backend Dependency Mapping, Section 16: Implementation Task Breakdown)

---

### TASK-68B-2: Backend UX/UI Support Endpoints — User Dashboard Slice

**Task ID:** TASK-68B-2
**Phase:** 68
**Stage:** 68B-2
**Priority:** 🔴 High
**Nature:** IMPLEMENTATION (BACKEND ONLY, ADDITIVE)
**Dependencies:** PHASE-68B (Complete), Existing users table, Existing sessions table, Existing quota enforcement
**Checkpoint:** `docs/PHASE-68B-2-CHECKPOINT.md`

**Objective:**

Implement the second minimal backend endpoint slice to unblock frontend user dashboard UX implementation (PHASE-67A-3). This task implements only the four user dashboard endpoints identified as high priority in Phase 68A implementation plan. These endpoints expose user account info, usage statistics, and quota visibility to the authenticated user dashboard.

**Scope:**

This task is limited to **backend implementation only**—no frontend, no schema changes.

**In Scope:**

1. **GET /api/users/me**
   - Get current user info
   - Extract user from JWT
   - Query users table WHERE id = userId
   - Return user info (userId, email, createdAt)
   - Enforce JWT auth
   - Handle 401 (not authenticated)
   - Response format:
     ```json
     {
       "userId": "uuid",
       "email": "user@example.com",
       "createdAt": "2026-01-15T10:00:00Z"
     }
     ```

2. **GET /api/users/me/usage**
   - Get current user usage statistics
   - Extract user from JWT
   - Query sessions table: COUNT WHERE user_id = userId AND terminated_at IS NULL (active sessions)
   - Query sessions table: COUNT WHERE user_id = userId AND created_at > NOW() - INTERVAL 24 HOUR (sessions created 24h)
   - Query token_usage table: SUM WHERE user_id = userId AND timestamp > NOW() - INTERVAL 24 HOUR (tokens used 24h)
   - Calculate estimated cost (tokens * rate)
   - Calculate resetAt (rolling 24h window)
   - Return usage summary
   - Enforce JWT auth
   - Handle 401 (not authenticated)
   - Response format:
     ```json
     {
       "activeSessions": 3,
       "sessionsCreated24h": 8,
       "tokensUsed24h": 45230,
       "estimatedCost": 2.45,
       "resetAt": "2026-03-09T20:00:00Z"
     }
     ```

3. **GET /api/users/me/quotas**
   - Get quota limits and current usage
   - Extract user from JWT
   - Get quota limits from config (5 concurrent, 20/24h, 100k tokens/24h)
   - Query current usage (same as GET /api/users/me/usage)
   - Return quota limits + current usage
   - Enforce JWT auth
   - Handle 401 (not authenticated)
   - Response format:
     ```json
     {
       "maxActiveSessions": 5,
       "currentActiveSessions": 3,
       "maxSessions24h": 20,
       "currentSessions24h": 8,
       "maxTokens24h": 100000,
       "currentTokens24h": 45230,
       "resetAt": "2026-03-09T20:00:00Z"
     }
     ```

4. **GET /api/sessions?includeTerminated=true**
   - List all sessions (active and terminated)
   - Extend existing GET /api/sessions endpoint
   - Add query param: includeTerminated (boolean, default false)
   - If includeTerminated=true, return all sessions (active and terminated)
   - If includeTerminated=false, return only active sessions (existing behavior)
   - Enforce JWT auth, user ownership
   - Handle 401 (not authenticated)
   - Response format: Array of sessions (same format as existing GET /api/sessions)

5. **Endpoint Tests**
   - Unit tests (controller, service methods)
   - Integration tests (E2E endpoint behavior, auth enforcement)
   - Test coverage target: 80%+

6. **API Documentation**
   - JSDoc comments for all 4 endpoints
   - Request/response type definitions
   - Error response documentation (401, 404, 500)

**Explicitly Out of Scope:**

- ❌ No admin dashboard endpoints (deferred to TASK-68B-3)
- ❌ No history/control endpoints (already complete in TASK-68B)
- ❌ No schema changes (use existing users, sessions, token_usage tables)
- ❌ No table modifications
- ❌ No frontend work
- ❌ No frontend components
- ❌ No refactors outside endpoint implementation
- ❌ No architectural changes
- ❌ No scope expansion beyond user dashboard endpoints

**Deliverables:**

1. **Controller Implementation**
   - New controller: `users.controller.ts` (or extend existing auth.controller.ts)
   - 3 new controller methods (GET /api/users/me, GET /api/users/me/usage, GET /api/users/me/quotas)
   - 1 modified controller method (GET /api/sessions, add includeTerminated query param)
   - JWT auth guards applied
   - User identity extraction from JWT

2. **Service Implementation**
   - New service: `users.service.ts` (or extend existing auth.service.ts)
   - 3 new service methods (get user info, get usage, get quotas)
   - Usage aggregation logic (rolling 24h window calculations)
   - Quota visibility logic (limits + current usage)
   - Session query extension (include terminated sessions)

3. **Tests**
   - Unit tests (controller methods, service methods)
   - Integration tests (E2E endpoint behavior)
   - Test coverage: 80%+ for new code

4. **API Documentation**
   - JSDoc comments for 4 endpoints
   - Request/response type definitions
   - Error documentation

5. **Checkpoint**
   - `docs/PHASE-68B-2-CHECKPOINT.md`
   - Implementation summary
   - Test results
   - API documentation references

**Acceptance Criteria:**

- ✅ GET /api/users/me returns correct user info
- ✅ GET /api/users/me/usage returns correct usage (rolling 24h calculations correct)
- ✅ GET /api/users/me/quotas returns correct quota limits + usage
- ✅ GET /api/sessions?includeTerminated=true returns all sessions
- ✅ All endpoints enforce JWT auth
- ✅ All endpoints tested (80%+ coverage)
- ✅ API documentation complete
- ✅ No schema changes occurred
- ✅ No frontend changes occurred

**Preserved Invariants:**

- No schema changes (use existing users, sessions, token_usage tables)
- No API contract changes to existing endpoints (except GET /api/sessions query param extension)
- New endpoints additive only (no breaking changes)
- Request-driven enforcement (no background workers)
- Deterministic error semantics (401, 404, 500)
- Quota enforcement preserved (existing quota guards unchanged)

**Reference:** PHASE-68A-CHECKPOINT.md (Section 9: Backend Dependency Mapping, Task 68B-2 definition)

---

### TASK-68B-3: Backend UX/UI Support Endpoints — Admin Dashboard Slice

**Task ID:** TASK-68B-3  
**Phase:** 68  
**Stage:** 68B-3  
**Priority:** 🟡 Medium  
**Nature:** IMPLEMENTATION (BACKEND ONLY, ADDITIVE)  
**Dependencies:** PHASE-68B (Complete), TASK-68B-2 (Complete), Existing users table, Existing sessions table, Existing internal auth guards, Existing runtime metrics endpoint  
**Checkpoint:** `docs/PHASE-68B-3-CHECKPOINT.md`

**Objective:**

Implement the third minimal backend endpoint slice to unblock admin dashboard UX implementation from Phase 68A planning. This task is limited to admin dashboard visibility endpoints and must remain launch-priority and narrowly scoped.

**Scope:**

This task is limited to **backend implementation only**—no frontend and no scope expansion beyond admin dashboard endpoint needs.

**In Scope:**

1. **`GET /api/internal/admin/users`**
   - Implement admin users visibility endpoint for dashboard list/summary
   - Return user-level operational summary using existing data sources (users/sessions/usage/cost visibility already available in architecture)
   - Support search/filter parameters defined in Phase 68A planning
   - Enforce internal-only auth conventions already used for `/api/internal/*`
   - Document deterministic error behavior

2. **`GET /api/internal/admin/sessions`**
   - Implement admin sessions visibility endpoint across users
   - Return session-level visibility including status/state and user linkage needed by admin dashboard
   - Support status/user/date filtering defined in Phase 68A planning
   - Enforce internal-only auth conventions already used for `/api/internal/*`
   - Document deterministic error behavior

3. **Admin visibility boundaries for this slice**
   - Include admin-facing visibility for users, sessions, usage/cost summaries, and operational/system status signals only where already supported by approved architecture/planning
   - Reuse existing runtime/system visibility endpoints where applicable (no redesign)

4. **Endpoint Tests**
   - Unit tests (controller/service)
   - Integration tests (endpoint behavior, internal auth enforcement, filters, error cases)
   - Test coverage target: 80%+ for new/changed code

5. **API Documentation**
   - Internal endpoint JSDoc/contracts for this slice only
   - Request query contract and response shape definitions
   - Error response documentation

**Explicitly Out of Scope:**

- ❌ No user dashboard endpoints (already complete in TASK-68B-2)
- ❌ No history/control endpoints (already complete in TASK-68B)
- ❌ No public-facing endpoints
- ❌ No frontend work
- ❌ No schema changes unless already explicitly justified and allowed by approved design
- ❌ No auth redesign
- ❌ No refactors outside endpoint implementation
- ❌ No scope expansion beyond this admin dashboard endpoint slice

**Deliverables:**

1. **Controller Implementation**
   - Admin dashboard endpoint methods for:
     - `GET /api/internal/admin/users`
     - `GET /api/internal/admin/sessions`
   - Existing internal guard/auth conventions reused
   - Query/filter handling aligned with Phase 68A task definition

2. **Service Implementation**
   - Minimal service/query logic required for endpoint responses
   - Aggregation/filter logic for users/sessions visibility only
   - Reuse existing usage/cost/runtime visibility sources where available

3. **Tests**
   - Unit tests for controller/service behavior
   - Integration tests for internal auth, filters, and response/error contracts

4. **API Documentation**
   - Internal endpoint contracts documented in code for this slice only

5. **Checkpoint**
   - `docs/PHASE-68B-3-CHECKPOINT.md`
   - Implementation summary, test results, and scope validation

**Acceptance Criteria:**

- ✅ `GET /api/internal/admin/users` returns admin user visibility summary per defined contract
- ✅ `GET /api/internal/admin/sessions` returns admin session visibility with required filters
- ✅ Admin-facing visibility needs for users/sessions/usage/cost/ops-status are covered within approved architecture constraints
- ✅ Internal auth conventions enforced on both endpoints
- ✅ Tests added and passing for this slice
- ✅ API documentation updated for this slice
- ✅ No frontend changes occurred
- ✅ No schema changes occurred (unless explicitly approved by existing design authority)

**Preserved Invariants:**

- No schema changes by default
- No public API surface expansion for admin slice endpoints
- No endpoint work beyond this slice
- Request-driven behavior only
- Deterministic error semantics
- No refactors

**Reference:** PHASE-68A-CHECKPOINT.md (Section 9: Backend Dependency Mapping, Task 68B-3 definition)

---

### TASK-68B-FINAL: Backend UX/UI Support Endpoints Final Consolidation

**Task ID:** TASK-68B-FINAL  
**Phase:** 68  
**Stage:** 68B-FINAL  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)  
**Dependencies:** TASK-68B (Complete), TASK-68B-2 (Complete), TASK-68B-3 (Complete), Existing PRD/ARCHITECTURE authority documents  
**Checkpoint:** `docs/PHASE-68B-FINAL-CHECKPOINT.md`

**Objective:**

Register and execute final consolidation validation for completed backend UX/UI support endpoint slices before frontend implementation stages proceed.

**Scope:**

This task is limited to **documentation and validation only** for completed backend slice outputs.

**In Scope:**

1. **Final consolidation of completed 68B backend slices**
   - Validate and consolidate outputs from:
     - `TASK-68B` (history/control endpoints)
     - `TASK-68B-2` (user dashboard endpoints)
     - `TASK-68B-3` (admin dashboard endpoints)
   - Confirm combined endpoint coverage is coherent and implementation-ready for frontend phases

2. **Scope and invariant validation**
   - Confirm all 68B slice work remained backend-only and additive
   - Confirm no schema changes occurred across 68B slices
   - Confirm no frontend work occurred
   - Confirm no refactor scope expansion occurred

3. **Authority alignment validation**
   - Confirm consolidated 68B outputs align with `PRD.md` and `ARCHITECTURE.md`
   - Confirm preserved request-driven and deterministic behavior expectations from governing documents

4. **Final consolidation checkpoint**
   - Create `docs/PHASE-68B-FINAL-CHECKPOINT.md`
   - Include consolidated coverage matrix, invariant validation, and readiness statement for frontend phases

**Explicitly Out of Scope:**

- ❌ No new endpoint implementation
- ❌ No endpoint contract expansion
- ❌ No frontend implementation
- ❌ No schema changes
- ❌ No refactors
- ❌ No architecture or auth redesign

**Deliverables:**

1. **Consolidation Validation Summary**
   - Cross-task validation for `TASK-68B`, `TASK-68B-2`, and `TASK-68B-3`
   - Coverage confirmation for backend UX/UI support endpoint set

2. **Scope Compliance Validation**
   - Backend-only/additive confirmation
   - No-schema-change confirmation
   - No-frontend/no-refactor confirmation

3. **Authority Alignment Validation**
   - PRD and ARCHITECTURE alignment confirmation for consolidated backend slice outputs

4. **Checkpoint**
   - `docs/PHASE-68B-FINAL-CHECKPOINT.md`
   - Consolidated validation results and readiness sign-off

**Acceptance Criteria:**

- ✅ Completed slices (`TASK-68B`, `TASK-68B-2`, `TASK-68B-3`) are consolidated and validated together
- ✅ Backend UX/UI support endpoint coverage is coherent and implementation-ready for frontend stages
- ✅ Scope remained backend-only and additive
- ✅ No schema changes occurred across 68B work
- ✅ PRD and ARCHITECTURE alignment confirmed
- ✅ Final consolidation checkpoint created
- ✅ No new implementation was introduced in this task

**Preserved Invariants:**

- No schema changes
- No frontend changes
- No endpoint implementation expansion
- No refactors
- Request-driven behavior only
- Deterministic semantics preserved

**Reference:** PHASE-68A-CHECKPOINT.md (Section 9), PHASE-68B-CHECKPOINT.md, PHASE-68B-2-CHECKPOINT.md, PHASE-68B-3-CHECKPOINT.md

---

### TASK-68C: Frontend Core Workspace Slice 1

**Task ID:** TASK-68C  
**Phase:** 68  
**Stage:** 68C  
**Priority:** 🔴 High  
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)  
**Dependencies:** TASK-68A (Complete), TASK-68B-FINAL (Complete), Existing backend session capabilities only  
**Checkpoint:** `docs/PHASE-68C-CHECKPOINT.md`

**Objective:**

Implement the first minimal frontend core workspace slice identified as unblocked in PHASE-68A to establish the authenticated workspace shell baseline before later frontend slices. Scope remains narrow and launch-priority.

**Scope:**

This task is limited to **frontend implementation only** for the first core workspace slice.

**In Scope:**

1. **Authenticated Workspace Shell Foundation (First Slice Only)**
   - Implement minimal authenticated workspace shell/container structure
   - Implement base panel shells needed for the core workspace frame
   - Implement foundational workspace states for shell-level rendering only

2. **Minimal Session Shell Wiring (Existing Backend Capabilities Only)**
   - Use already available session capabilities required for shell initialization
   - No new endpoint dependencies or backend contract expansion
   - No backend-side changes

3. **Slice-Specific Validation**
   - Add focused frontend tests for this slice only
   - Document slice outputs and constraints in checkpoint

**Explicitly Out of Scope:**

- ❌ No backend changes
- ❌ No schema changes
- ❌ No refactors
- ❌ No history/control UI in this task
- ❌ No dashboard UI in this task
- ❌ No public-facing UI in this task
- ❌ No registration of later 68C sub-slices in this task
- ❌ No 68D / 68E / 68F / 68G scope in this task

**Deliverables:**

1. **Frontend Workspace Slice 1 Implementation**
   - Minimal authenticated workspace shell baseline
   - First-slice-only UI foundation required for later workspace slices

2. **Tests**
   - Focused frontend tests for this slice only

3. **Checkpoint**
   - `docs/PHASE-68C-CHECKPOINT.md`
   - Slice summary, scope validation, and preserved invariants

**Acceptance Criteria:**

- ✅ First minimal unblocked frontend workspace slice is implemented
- ✅ Scope remains limited to core workspace slice 1 only
- ✅ Uses already available backend capabilities only
- ✅ No backend changes and no schema changes
- ✅ No history/control, dashboard, or public-facing UI work included
- ✅ Focused tests for this slice are included
- ✅ Checkpoint created for this slice

**Preserved Invariants:**

- No backend changes
- No schema changes
- No refactors
- Frontend-only additive scope
- Request-driven and deterministic platform behavior assumptions preserved

**Reference:** PHASE-68A-CHECKPOINT.md (STAGE-68C and immediate unblocked first-slice guidance), PHASE-68B-FINAL-CHECKPOINT.md

---

### TASK-68D: Frontend History/Control Slice 1

**Task ID:** TASK-68D  
**Phase:** 68  
**Stage:** 68D  
**Priority:** 🔴 High  
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)  
**Dependencies:** TASK-68A (Complete), TASK-68B-FINAL (Complete), TASK-68C (Complete), Existing backend history/control capabilities only  
**Checkpoint:** `docs/PHASE-68D-CHECKPOINT.md`

**Objective:**

Implement only the first minimal frontend history/control slice identified as unblocked in PHASE-68A, building directly on the existing workspace shell baseline delivered in TASK-68C.

**Scope:**

This task is limited to **frontend implementation only** for the first history/control slice.

**In Scope:**

1. **History/Control Shell Integration (First Slice Only)**
   - Implement only the smallest launch-priority history/control UI slice
   - Integrate at shell level with the existing TASK-68C workspace baseline
   - Keep scope intentionally narrow for first-slice validation

2. **Minimal Backend Capability Usage (Existing Only)**
   - Use only already available backend history/control capabilities completed in Phase 68B
   - No new endpoint dependencies or backend contract expansion
   - No backend-side changes

3. **Slice-Specific Validation**
   - Add focused frontend tests for this slice only
   - Document slice outputs and constraints in checkpoint

**Explicitly Out of Scope:**

- ❌ No backend changes
- ❌ No schema changes
- ❌ No refactors
- ❌ No dashboard UI in this task
- ❌ No public-facing UI in this task
- ❌ No broader workspace redesign outside this history/control slice
- ❌ No 68E / 68F / 68G scope in this task

**Deliverables:**

1. **Frontend History/Control Slice 1 Implementation**
   - Minimal first-slice history/control UI baseline integrated with TASK-68C workspace shell

2. **Tests**
   - Focused frontend tests for this slice only

3. **Checkpoint**
   - `docs/PHASE-68D-CHECKPOINT.md`
   - Slice summary, scope validation, and preserved invariants

**Acceptance Criteria:**

- ✅ First minimal unblocked frontend history/control slice is implemented
- ✅ Scope remains limited to history/control slice 1 only
- ✅ Uses already available backend history/control capabilities only
- ✅ Builds on existing TASK-68C workspace shell baseline
- ✅ No backend changes and no schema changes
- ✅ No dashboard/public-facing UI work included
- ✅ Focused tests for this slice are included
- ✅ Checkpoint created for this slice

**Preserved Invariants:**

- No backend changes
- No schema changes
- No refactors
- Frontend-only additive scope
- Request-driven and deterministic platform behavior assumptions preserved

**Reference:** PHASE-68A-CHECKPOINT.md (STAGE-68D sequencing and dependencies), PHASE-68B-FINAL-CHECKPOINT.md, PHASE-68C-CHECKPOINT.md

---

### TASK-68E: Frontend Dashboard Slice 1

**Task ID:** TASK-68E  
**Phase:** 68  
**Stage:** 68E  
**Priority:** 🔴 High  
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)  
**Dependencies:** TASK-68A (Complete), TASK-68B-FINAL (Complete), TASK-68C (Complete), Existing backend dashboard capabilities only  
**Checkpoint:** `docs/PHASE-68E-CHECKPOINT.md`

**Objective:**

Implement only the first minimal frontend dashboard slice identified as unblocked in PHASE-68A, with narrow launch-priority scope for authenticated dashboard UX.

**Scope:**

This task is limited to **frontend implementation only** for the first dashboard slice.

**In Scope:**

1. **Dashboard Shell Integration (First Slice Only)**
   - Implement only the smallest launch-priority dashboard UI slice
   - Integrate with the existing authenticated frontend baseline
   - Keep scope intentionally narrow for first-slice validation

2. **Minimal Backend Capability Usage (Existing Only)**
   - Use only already available backend dashboard capabilities completed in Phase 68B slices
   - No new endpoint dependencies or backend contract expansion
   - No backend-side changes

3. **Slice-Specific Validation**
   - Add focused frontend tests for this slice only
   - Document slice outputs and constraints in checkpoint

**Explicitly Out of Scope:**

- ❌ No backend changes
- ❌ No schema changes
- ❌ No refactors
- ❌ No history/control expansion in this task
- ❌ No public-facing UI in this task
- ❌ No broader workspace redesign outside this dashboard slice
- ❌ No 68F / 68G scope in this task

**Deliverables:**

1. **Frontend Dashboard Slice 1 Implementation**
   - Minimal first-slice dashboard UI baseline for authenticated dashboard UX

2. **Tests**
   - Focused frontend tests for this slice only

3. **Checkpoint**
   - `docs/PHASE-68E-CHECKPOINT.md`
   - Slice summary, scope validation, and preserved invariants

**Acceptance Criteria:**

- ✅ First minimal unblocked frontend dashboard slice is implemented
- ✅ Scope remains limited to dashboard slice 1 only
- ✅ Uses already available backend dashboard capabilities only
- ✅ Covers authenticated dashboard UX only for this slice
- ✅ No backend changes and no schema changes
- ✅ No public-facing UI work included
- ✅ Focused tests for this slice are included
- ✅ Checkpoint created for this slice

**Preserved Invariants:**

- No backend changes
- No schema changes
- No refactors
- Frontend-only additive scope
- Request-driven and deterministic platform behavior assumptions preserved

**Reference:** PHASE-68A-CHECKPOINT.md (STAGE-68E sequencing and first-slice dashboard scope), PHASE-68B-FINAL-CHECKPOINT.md, PHASE-68C-CHECKPOINT.md, PHASE-68D-CHECKPOINT.md

---

### TASK-68F: Frontend Public-Facing Slice 1

**Task ID:** TASK-68F  
**Phase:** 68  
**Stage:** 68F  
**Priority:** 🔴 High  
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)  
**Dependencies:** TASK-68A (Complete), Existing frontend baseline only  
**Checkpoint:** `docs/PHASE-68F-CHECKPOINT.md`

**Objective:**

Implement only the first minimal frontend public-facing slice identified as unblocked in PHASE-68A, with narrow launch-priority scope for core public product visibility.

**Scope:**

This task is limited to **frontend implementation only** for the first public-facing slice.

**In Scope:**

1. **Public Surface Integration (First Slice Only)**
   - Implement only the smallest launch-priority public-facing UI slice
   - Focus only on the core public product surface for this first slice
   - Keep scope intentionally narrow for first-slice validation

2. **Minimal Dependency Usage**
   - Prefer no backend dependency unless already available and clearly required
   - No new endpoint dependencies or backend contract expansion
   - No backend-side changes

3. **Slice-Specific Validation**
   - Add focused frontend tests for this slice only
   - Document slice outputs and constraints in checkpoint

**Explicitly Out of Scope:**

- ❌ No backend changes
- ❌ No schema changes
- ❌ No refactors
- ❌ No authenticated workspace/dashboard/history-control scope in this task
- ❌ No broader marketing/docs-site expansion outside this first slice
- ❌ No 68G scope in this task

**Deliverables:**

1. **Frontend Public-Facing Slice 1 Implementation**
   - Minimal first-slice public-facing UI baseline for launch-priority product surface

2. **Tests**
   - Focused frontend tests for this slice only

3. **Checkpoint**
   - `docs/PHASE-68F-CHECKPOINT.md`
   - Slice summary, scope validation, and preserved invariants

**Acceptance Criteria:**

- ✅ First minimal unblocked frontend public-facing slice is implemented
- ✅ Scope remains limited to public-facing slice 1 only
- ✅ No backend changes and no schema changes
- ✅ No authenticated dashboard/workspace/history-control scope included
- ✅ No broader marketing/docs-site expansion included
- ✅ Focused tests for this slice are included
- ✅ Checkpoint created for this slice

**Preserved Invariants:**

- No backend changes
- No schema changes
- No refactors
- Frontend-only additive scope
- Request-driven and deterministic platform behavior assumptions preserved

**Reference:** PHASE-68A-CHECKPOINT.md (STAGE-68F sequencing and first-slice public-facing scope), PHASE-68B-FINAL-CHECKPOINT.md, PHASE-68C-CHECKPOINT.md, PHASE-68D-CHECKPOINT.md, PHASE-68E-CHECKPOINT.md

---

### TASK-68G: Launch Polish Slice 1

**Task ID:** TASK-68G  
**Phase:** 68  
**Stage:** 68G  
**Priority:** 🔴 High  
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)  
**Dependencies:** TASK-68A (Complete), TASK-68C (Complete), TASK-68D (Complete), TASK-68E (Complete), TASK-68F (Complete)  
**Checkpoint:** `docs/PHASE-68G-CHECKPOINT.md`

**Objective:**

Implement only the first minimal frontend launch-polish slice identified in PHASE-68A, with narrow launch-priority scope focused on usability/readiness improvements for already-implemented frontend surfaces.

**Scope:**

This task is limited to **frontend implementation only** for the first launch-polish slice.

**In Scope:**

1. **Launch Polish Integration (First Slice Only)**
   - Implement only the smallest launch-priority polish slice
   - Improve usability/readiness only where already covered by completed frontend slices
   - Keep scope intentionally narrow for first-slice validation

2. **Polish Focus Areas (Narrow Slice)**
   - Responsive polish for already-implemented surfaces only
   - State polish (loading/empty/error/ready clarity) for already-implemented surfaces only
   - Clarity/trust polish for already-implemented surfaces only

3. **Slice-Specific Validation**
   - Add focused frontend tests for this slice only
   - Document slice outputs and constraints in checkpoint

**Explicitly Out of Scope:**

- ❌ No backend changes
- ❌ No schema changes
- ❌ No refactors
- ❌ No new product feature scope
- ❌ No major redesign of completed surfaces
- ❌ No broader cross-platform polish beyond this first slice

**Deliverables:**

1. **Frontend Launch Polish Slice 1 Implementation**
   - Minimal first-slice launch polish baseline for already-implemented frontend surfaces

2. **Tests**
   - Focused frontend tests for this slice only

3. **Checkpoint**
   - `docs/PHASE-68G-CHECKPOINT.md`
   - Slice summary, scope validation, and preserved invariants

**Acceptance Criteria:**

- ✅ First minimal unblocked frontend launch-polish slice is implemented
- ✅ Scope remains limited to launch-polish slice 1 only
- ✅ Improves responsive/state/clarity-trust polish only for already-implemented surfaces
- ✅ No backend changes and no schema changes
- ✅ No refactors and no new product feature scope
- ✅ Focused tests for this slice are included
- ✅ Checkpoint created for this slice

**Preserved Invariants:**

- No backend changes
- No schema changes
- No refactors
- Frontend-only additive scope
- Request-driven and deterministic platform behavior assumptions preserved

**Reference:** PHASE-68A-CHECKPOINT.md (STAGE-68G launch-polish sequencing/scope), PHASE-68C-CHECKPOINT.md, PHASE-68D-CHECKPOINT.md, PHASE-68E-CHECKPOINT.md, PHASE-68F-CHECKPOINT.md

---

### TASK-68-FINAL: Phase 68 Final Consolidation

**Task ID:** TASK-68-FINAL  
**Phase:** 68  
**Stage:** 68-FINAL  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)  
**Dependencies:** TASK-68A (Complete), TASK-68B (Complete), TASK-68B-2 (Complete), TASK-68B-3 (Complete), TASK-68B-FINAL (Complete), TASK-68C (Complete), TASK-68D (Complete), TASK-68E (Complete), TASK-68F (Complete), TASK-68G (Complete)  
**Checkpoint:** `docs/PHASE-68-FINAL-CHECKPOINT.md`

**Objective:**

Register and execute final Phase 68 consolidation validation for completed planning, backend, frontend, and launch-polish slices before any post-phase validation expansion.

**Scope:**

This task is limited to **documentation and validation only** for completed Phase 68 outputs.

**In Scope:**

1. **Final consolidation across completed Phase 68 tasks**
   - Validate and consolidate outputs from:
     - `TASK-68A`
     - `TASK-68B`
     - `TASK-68B-2`
     - `TASK-68B-3`
     - `TASK-68B-FINAL`
     - `TASK-68C`
     - `TASK-68D`
     - `TASK-68E`
     - `TASK-68F`
     - `TASK-68G`

2. **Coherence and authority alignment validation**
   - Confirm consolidated Phase 68 outputs are coherent
   - Confirm alignment with `PRD.md` and `ARCHITECTURE.md`
   - Confirm no contradiction with active task/governance constraints

3. **Scope and sequencing validation**
   - Confirm work remained within approved planning/implementation boundaries
   - Confirm backend/frontend slice sequencing remained consistent with Phase 68 planning
   - Confirm no schema changes occurred across Phase 68 work

4. **Final checkpoint**
   - Create `docs/PHASE-68-FINAL-CHECKPOINT.md`
   - Include consolidated validation results, preserved invariants, and final readiness sign-off

**Explicitly Out of Scope:**

- ❌ No new implementation
- ❌ No backend changes
- ❌ No frontend feature expansion
- ❌ No schema changes
- ❌ No refactors
- ❌ No architecture redesign

**Deliverables:**

1. **Consolidation Validation Summary**
   - Cross-task validation for all completed 68A/68B/68C/68D/68E/68F/68G outputs
   - Coherence confirmation across planning and implementation slices

2. **Scope/Invariant Compliance Validation**
   - Boundary compliance confirmation for approved Phase 68 scope
   - No-schema-change confirmation
   - No-refactor and no-new-implementation confirmation

3. **Authority and Sequencing Validation**
   - PRD/ARCHITECTURE alignment confirmation
   - Backend/frontend sequencing consistency confirmation

4. **Checkpoint**
   - `docs/PHASE-68-FINAL-CHECKPOINT.md`
   - Final consolidated validation results and sign-off

**Acceptance Criteria:**

- ✅ All listed completed Phase 68 tasks are consolidated and validated together
- ✅ Phase 68 outputs are coherent and aligned with PRD and ARCHITECTURE
- ✅ Scope remained within approved planning/implementation boundaries
- ✅ Backend/frontend sequencing remains consistent with Phase 68 plan
- ✅ No schema changes occurred across Phase 68 work
- ✅ Final Phase 68 checkpoint created
- ✅ No new implementation introduced in this task
- ✅ No refactors introduced in this task

**Preserved Invariants:**

- No backend changes
- No schema changes
- No refactors
- No new implementation
- Request-driven and deterministic platform behavior assumptions preserved

**Reference:** PHASE-68A-CHECKPOINT.md, PHASE-68B-FINAL-CHECKPOINT.md, PHASE-68C-CHECKPOINT.md, PHASE-68D-CHECKPOINT.md, PHASE-68E-CHECKPOINT.md, PHASE-68F-CHECKPOINT.md, PHASE-68G-CHECKPOINT.md

---

### TASK-69A: UX/UI Validation and End-to-End Readiness Planning

**Task ID:** TASK-69A  
**Phase:** 69  
**Stage:** 69A  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / PLANNING (NO CODE)  
**Dependencies:** PHASE-67-FINAL (Complete), PHASE-68-FINAL (Complete)  
**Checkpoint:** `docs/PHASE-69A-CHECKPOINT.md`

**Objective:**

Plan the validation and end-to-end readiness review approach for completed Phase 67 and Phase 68 UX/UI outputs, including targeted regression validation planning and sequencing for any remaining UX/UI validation/fix slices if needed.

**Scope:**

This task is limited to **documentation and planning only**.

**In Scope:**

1. **Validation Planning for Completed Phase 67 and Phase 68 UX/UI Outputs**
   - Plan structured validation coverage across completed UX/UI design and implementation outputs
   - Confirm validation scope references final outputs from Phase 67 and Phase 68 checkpoints

2. **End-to-End Readiness Review Planning**
   - Plan end-to-end readiness review coverage across:
     - authenticated workspace shell
     - history/control slice
     - dashboard slice
     - public-facing slice
     - launch-polish slice

3. **Remaining Validation Gap Identification Planning**
   - Plan method for identifying remaining UX/UI validation gaps before wider release-readiness work
   - Define how gaps will be categorized and prioritized for follow-up

4. **Targeted Regression Validation Planning**
   - Plan targeted regression validation for newly implemented frontend/backend UX-support slices
   - Define planned regression areas and expected verification boundaries

5. **Validation/Fix Slice Sequencing Planning (If Needed)**
   - Plan sequencing for any remaining UX/UI validation/fix slices required after validation findings
   - Keep sequencing constrained to readiness-focused validation/fix scope

6. **Checkpoint**
   - Create `docs/PHASE-69A-CHECKPOINT.md`
   - Include planning scope, validation approach, gap strategy, and sequencing guidance

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No implementation
- ❌ No refactors

**Deliverables:**

1. **Phase 69A Validation Planning Output**
   - Validation planning for completed 67/68 UX/UI outputs
   - End-to-end readiness review planning coverage map

2. **Gap and Regression Planning Output**
   - Planned method for gap identification
   - Targeted regression validation planning boundaries
   - Sequencing proposal for potential validation/fix slices (if needed)

3. **Checkpoint**
   - `docs/PHASE-69A-CHECKPOINT.md`
   - Planning summary and preserved invariants

**Acceptance Criteria:**

- ✅ Validation planning for completed Phase 67 and Phase 68 UX/UI outputs is documented
- ✅ End-to-end readiness review planning covers workspace/history-control/dashboard/public/polish slices
- ✅ Approach for identifying remaining UX/UI validation gaps is documented
- ✅ Targeted regression validation planning for newly implemented frontend/backend UX-support slices is documented
- ✅ Sequencing plan for potential remaining validation/fix slices is documented (if needed)
- ✅ No platform code/schema/endpoint changes occurred
- ✅ Checkpoint created for Phase 69A

**Preserved Invariants:**

- No platform code changes
- No schema changes
- No endpoint changes
- No refactors
- Documentation/planning-only scope

**Reference:** PHASE-67-FINAL-CHECKPOINT.md, PHASE-68-FINAL-CHECKPOINT.md, PRD.md, ARCHITECTURE.md

---

### TASK-69B: UX/UI Validation Execution

**Task ID:** TASK-69B  
**Phase:** 69  
**Stage:** 69B  
**Priority:** 🟡 Medium  
**Nature:** VALIDATION / DOCUMENTATION (NO CODE)  
**Dependencies:** TASK-69A (Complete)  
**Checkpoint:** `docs/PHASE-69B-CHECKPOINT.md`

**Objective:**

Execute the UX/UI validation plan defined in Phase 69A and produce end-to-end validation findings/readiness results for completed Phase 67 and Phase 68 UX/UI outputs.

**Scope:**

This task is limited to **validation and documentation only**.

**In Scope:**

1. **Phase 69A Plan Execution**
   - Execute the UX/UI validation approach and sequence defined by TASK-69A
   - Use Phase 67/68 final outputs as validation baseline authority

2. **End-to-End Validation Coverage**
   - Validate end-to-end readiness across:
     - authenticated workspace shell
     - history/control slice
     - dashboard slice
     - public-facing slice
     - launch-polish outputs

3. **Targeted Regression Validation**
   - Execute targeted regression validation on completed frontend/backend UX-support slices
   - Verify critical integration boundaries and status/error-state consistency

4. **Findings and Gap Documentation**
   - Document validation findings, detected gaps, conflicts, and pass/fail outcomes
   - Record gap severity/category and readiness impact

5. **Follow-Up Determination**
   - Confirm whether additional UX/UI validation/fix slices are required
   - If required, provide constrained sequencing recommendation for follow-up slices

6. **Checkpoint**
   - Create `docs/PHASE-69B-CHECKPOINT.md`
   - Include validation coverage, findings, pass/fail conclusions, and follow-up decision

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No implementation work
- ❌ No refactors

**Deliverables:**

1. **Validation Execution Output**
   - End-to-end validation results across the five Phase 69A coverage slices
   - Targeted regression validation results for UX-support slices

2. **Findings Output**
   - Documented validation findings, conflicts, gaps, and pass/fail outcomes
   - Determination of whether follow-up UX/UI validation/fix slices are required

3. **Checkpoint**
   - `docs/PHASE-69B-CHECKPOINT.md`
   - Validation summary, findings register, and preserved invariants

**Acceptance Criteria:**

- ✅ Phase 69A validation plan execution is documented
- ✅ End-to-end validation covers workspace/history-control/dashboard/public/polish outputs
- ✅ Targeted regression validation is executed and documented for completed frontend/backend UX-support slices
- ✅ Validation findings, gaps, conflicts, and pass/fail outcomes are documented
- ✅ Follow-up UX/UI validation/fix-slice requirement is explicitly confirmed (required/not required)
- ✅ No platform code/schema/endpoint changes occurred
- ✅ Phase 69B checkpoint created

**Preserved Invariants:**

- No platform code changes
- No schema changes
- No endpoint changes
- No refactors
- Validation/documentation-only scope

**Reference:** PHASE-69A-CHECKPOINT.md, PHASE-67-FINAL-CHECKPOINT.md, PHASE-68-FINAL-CHECKPOINT.md, PRD.md, ARCHITECTURE.md

---

### TASK-69-FINAL: Phase 69 Final Consolidation

**Task ID:** TASK-69-FINAL  
**Phase:** 69  
**Stage:** 69-FINAL  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)  
**Dependencies:** TASK-69A (Complete), TASK-69B (Complete)  
**Checkpoint:** `docs/PHASE-69-FINAL-CHECKPOINT.md`

**Objective:**

Validate and consolidate completed Phase 69 planning and validation outputs (`TASK-69A`, `TASK-69B`) and produce a final Phase 69 checkpoint.

**Scope:**

This task is limited to **documentation and final validation only**.

**In Scope:**

1. **Phase 69 Consolidation Validation**
   - Validate and consolidate outputs from `TASK-69A` and `TASK-69B`
   - Confirm completed planning and validation outputs are coherent

2. **Follow-Up Requirement Confirmation**
   - Confirm no follow-up UX/UI validation/fix slices are required from Phase 69 results

3. **Scope and Invariant Confirmation**
   - Confirm Phase 69 remained documentation/validation-only
   - Confirm no platform code/schema/endpoint changes occurred in Phase 69 tasks

4. **Checkpoint**
   - Create `docs/PHASE-69-FINAL-CHECKPOINT.md`
   - Include consolidation result, final readiness conclusion, and preserved invariants

**Explicitly Out of Scope:**

- ❌ No new implementation
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No refactors

**Deliverables:**

1. **Final Consolidation Output**
   - Consolidated validation of `TASK-69A` and `TASK-69B`
   - Coherence confirmation for Phase 69 outputs

2. **Follow-Up Determination Output**
   - Explicit confirmation that follow-up UX/UI fix slices are not required (or required if evidence indicates otherwise)

3. **Checkpoint**
   - `docs/PHASE-69-FINAL-CHECKPOINT.md`
   - Final phase-level consolidation summary and preserved invariants

**Acceptance Criteria:**

- ✅ `TASK-69A` and `TASK-69B` outputs are consolidated and validated
- ✅ Phase 69 outputs are coherent
- ✅ Follow-up UX/UI fix-slice requirement is explicitly confirmed
- ✅ Phase 69 documentation/validation-only scope is confirmed preserved
- ✅ No platform code/schema/endpoint changes occurred
- ✅ Final Phase 69 checkpoint created
- ✅ No new implementation introduced
- ✅ No refactors introduced

**Preserved Invariants:**

- No platform code changes
- No schema changes
- No endpoint changes
- No refactors
- Documentation/validation-only scope

**Reference:** PHASE-69A-CHECKPOINT.md, PHASE-69B-CHECKPOINT.md, PRD.md, ARCHITECTURE.md

---

### TASK-70A: Launch Readiness Validation Planning

**Task ID:** TASK-70A  
**Phase:** 70  
**Stage:** 70A  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / PLANNING (NO CODE)  
**Dependencies:** PHASE-68-FINAL (Complete), PHASE-69-FINAL (Complete)  
**Checkpoint:** `docs/PHASE-70A-CHECKPOINT.md`

**Objective:**

Plan launch-readiness validation scope and execution approach after completed UX/UI design, implementation, and validation work.

**Scope:**

This task is limited to **documentation and planning only**.

**In Scope:**

1. **Launch Validation Coverage Planning**
   - Plan validation coverage across product, operational, and user-facing launch surfaces

2. **Targeted Release-Readiness Checks Planning**
   - Plan targeted validation checks for:
     - authenticated app surfaces
     - public-facing surfaces
     - backend support paths
     - user-critical flows

3. **Pre-Launch Validation Boundary Planning**
   - Define remaining pre-launch validation boundaries
   - Define evidence requirements and pass/fail criteria for launch-readiness validation

4. **Validation-Only Slice Sequencing Planning (If Needed)**
   - Plan sequencing for any final validation-only slices required before broader launch sign-off

5. **Checkpoint**
   - Create `docs/PHASE-70A-CHECKPOINT.md`
   - Include coverage map, validation boundaries, evidence model, pass/fail criteria, and sequencing guidance

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No implementation
- ❌ No refactors

**Deliverables:**

1. **Launch Validation Planning Output**
   - Planned coverage across product/operational/user-facing launch surfaces
   - Planned targeted release-readiness checks for key launch-critical areas

2. **Pre-Launch Validation Governance Output**
   - Planned validation boundaries
   - Planned evidence requirements
   - Planned pass/fail criteria
   - Sequencing proposal for final validation-only slices (if needed)

3. **Checkpoint**
   - `docs/PHASE-70A-CHECKPOINT.md`
   - Planning summary and preserved invariants

**Acceptance Criteria:**

- ✅ Launch-readiness validation coverage planning is documented
- ✅ Targeted release-readiness checks are planned for authenticated app/public/backend-support/user-critical paths
- ✅ Remaining pre-launch validation boundaries, evidence requirements, and pass/fail criteria are documented
- ✅ Sequencing plan for final validation-only slices is documented (if needed)
- ✅ No platform code/schema/endpoint changes occurred
- ✅ Phase 70A checkpoint created

**Preserved Invariants:**

- No platform code changes
- No schema changes
- No endpoint changes
- No refactors
- Documentation/planning-only scope

**Reference:** PHASE-68-FINAL-CHECKPOINT.md, PHASE-69-FINAL-CHECKPOINT.md, PRD.md, ARCHITECTURE.md

---

### TASK-70B: Launch Readiness Validation Execution

**Task ID:** TASK-70B  
**Phase:** 70  
**Stage:** 70B  
**Priority:** 🟡 Medium  
**Nature:** VALIDATION / DOCUMENTATION (NO CODE)  
**Dependencies:** TASK-70A (Complete)  
**Checkpoint:** `docs/PHASE-70B-CHECKPOINT.md`

**Objective:**

Execute the launch-readiness validation plan defined in Phase 70A and produce documented readiness outcomes before broader launch sign-off.

**Scope:**

This task is limited to **validation and documentation only**.

**In Scope:**

1. **Launch Validation Coverage Execution**
   - Execute validation coverage across product, operational, and user-facing launch surfaces

2. **Targeted Release-Readiness Check Execution**
   - Execute targeted checks for:
     - authenticated app surfaces
     - public-facing surfaces
     - backend support paths
     - user-critical flows

3. **Readiness Findings and Evidence Documentation**
   - Document launch-readiness findings, evidence, gaps, risks, and pass/fail outcomes
   - Record validation results by coverage area and flow

4. **Blocking Determination**
   - Explicitly determine whether any blocking issues remain before broader launch sign-off

5. **Checkpoint**
   - Create `docs/PHASE-70B-CHECKPOINT.md`
   - Include execution coverage summary, findings/risk register, evidence summary, pass/fail outcome, and blocking determination

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No implementation
- ❌ No refactors

**Deliverables:**

1. **Launch Validation Execution Output**
   - Executed coverage results across product/operational/user-facing launch surfaces
   - Executed targeted release-readiness results for authenticated/public/backend-support/user-critical paths

2. **Readiness Findings Output**
   - Documented findings, evidence, gaps, risks, and pass/fail outcomes
   - Explicit blocking/not-blocking determination for broader launch sign-off

3. **Checkpoint**
   - `docs/PHASE-70B-CHECKPOINT.md`
   - Validation execution summary and preserved invariants

**Acceptance Criteria:**

- ✅ Launch-readiness validation plan from Phase 70A is executed and documented
- ✅ Validation coverage execution is documented across product, operational, and user-facing launch surfaces
- ✅ Targeted release-readiness checks are executed and documented for authenticated app/public/backend-support/user-critical paths
- ✅ Launch-readiness findings, evidence, gaps, risks, and pass/fail outcomes are documented
- ✅ Blocking determination is explicit and documented
- ✅ No platform code/schema/endpoint changes occurred
- ✅ Phase 70B checkpoint created

**Preserved Invariants:**

- No platform code changes
- No schema changes
- No endpoint changes
- No refactors
- Validation/documentation-only scope

**Reference:** PHASE-70A-CHECKPOINT.md, PRD.md, ARCHITECTURE.md

---

### TASK-70-FINAL: Phase 70 Final Consolidation

**Task ID:** TASK-70-FINAL  
**Phase:** 70  
**Stage:** 70-FINAL  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)  
**Dependencies:** TASK-70A (Complete), TASK-70B (Complete)  
**Checkpoint:** `docs/PHASE-70-FINAL-CHECKPOINT.md`

**Objective:**

Validate and consolidate completed Phase 70 planning and validation outputs and close Phase 70 with a final checkpoint.

**Scope:**

This task is limited to **documentation and validation only**.

**In Scope:**

1. **Phase 70 Consolidation**
   - Validate and consolidate `TASK-70A` and `TASK-70B`
   - Confirm launch-readiness planning and execution outputs are coherent

2. **Blocking-State Confirmation**
   - Confirm no blocking issues remain before broader launch sign-off

3. **Scope and Invariant Confirmation**
   - Confirm Phase 70 remained documentation/validation-only
   - Confirm no platform code/schema/endpoint changes occurred

4. **Checkpoint**
   - Create `docs/PHASE-70-FINAL-CHECKPOINT.md`
   - Include consolidation summary, coherence confirmation, blocking-state confirmation, and preserved invariants

**Explicitly Out of Scope:**

- ❌ No new implementation
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No refactors

**Deliverables:**

1. **Consolidated Phase 70 Validation Output**
   - Consolidated validation of `TASK-70A` and `TASK-70B`
   - Coherence confirmation across planning and execution outputs

2. **Final Readiness Confirmation Output**
   - Explicit blocking/not-blocking confirmation before broader launch sign-off
   - Confirmation that Phase 70 remained documentation/validation-only with no code/schema/endpoint changes

3. **Checkpoint**
   - `docs/PHASE-70-FINAL-CHECKPOINT.md`
   - Final Phase 70 consolidation summary and preserved invariants

**Acceptance Criteria:**

- ✅ `TASK-70A` and `TASK-70B` are consolidated and validated
- ✅ Launch-readiness planning and execution outputs are confirmed coherent
- ✅ No blocking issues remain is explicitly confirmed
- ✅ Phase 70 documentation/validation-only scope is confirmed preserved
- ✅ No platform code/schema/endpoint changes occurred
- ✅ Final Phase 70 checkpoint created
- ✅ No new implementation introduced
- ✅ No refactors introduced

**Preserved Invariants:**

- No platform code changes
- No schema changes
- No endpoint changes
- No refactors
- Documentation/validation-only scope

**Reference:** PHASE-70A-CHECKPOINT.md, PHASE-70B-CHECKPOINT.md, PRD.md, ARCHITECTURE.md

---

### TASK-71A: Master Plan Gap Analysis

**Task ID:** TASK-71A  
**Phase:** 71  
**Stage:** 71A  
**Priority:** 🟡 Medium  
**Nature:** DOCUMENTATION / PLANNING (NO CODE)  
**Dependencies:** PHASE-70-FINAL (Complete)  
**Checkpoint:** `docs/PHASE-71A-CHECKPOINT.md`

**Objective:**

Compare the broader master plan against the completed/narrowed implementation path and produce an authoritative reconciliation baseline for post-Phase-70 priority setting.

**Scope:**

This task is limited to **documentation and planning only**.

**In Scope:**

1. **Master Plan Comparison**
   - Compare broader master plan coverage against current completed implementation path
   - Identify what is already complete, partially complete, deferred, missing, or incompatible with current constraints

2. **Authoritative Reconciliation Planning**
   - Reconcile master plan vision with:
     - current `PRD.md`
     - current `ARCHITECTURE.md`
     - current `TASKS.md` / `TASKS_BACKLOG_FULL.md` state

3. **Post-Phase-70 Priority Definition**
   - Identify next authoritative product/workstream priorities after Phase 70 closure

4. **High-Level Sequencing Proposal**
   - Propose high-level sequencing for remaining master-plan work only

5. **Checkpoint**
   - Create `docs/PHASE-71A-CHECKPOINT.md`
   - Include gap classification, reconciliation outputs, priority recommendations, and sequencing proposal

**Explicitly Out of Scope:**

- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No implementation
- ❌ No refactors

**Deliverables:**

1. **Gap Analysis Output**
   - Classified comparison of master plan versus current implementation path
   - Status map: complete / partial / deferred / missing / incompatible

2. **Reconciliation Output**
   - Reconciled alignment plan across master plan, PRD, ARCHITECTURE, TASKS, and TASKS_BACKLOG
   - Authoritative post-Phase-70 priorities

3. **Sequencing Output**
   - High-level sequencing proposal for remaining master-plan work

4. **Checkpoint**
   - `docs/PHASE-71A-CHECKPOINT.md`
   - Planning summary and preserved invariants

**Acceptance Criteria:**

- ✅ Master plan comparison against current completed/narrowed implementation path is documented
- ✅ Complete/partial/deferred/missing/incompatible classifications are documented
- ✅ Reconciliation plan across master plan, PRD, ARCHITECTURE, TASKS, and TASKS_BACKLOG is documented
- ✅ Next authoritative post-Phase-70 priorities are documented
- ✅ High-level sequencing proposal is documented
- ✅ No platform code/schema/endpoint changes occurred
- ✅ Phase 71A checkpoint created

**Preserved Invariants:**

- No platform code changes
- No schema changes
- No endpoint changes
- No refactors
- Documentation/planning-only scope

**Reference:** AI-SANDBOX-PLATFORM-PLAN.md, PRD.md, ARCHITECTURE.md, PHASE-70-FINAL-CHECKPOINT.md

---
