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
