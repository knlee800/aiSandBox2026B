# REL-01-02 CHECKPOINT - Integration Smoke Sweep

## Task Metadata

- Task ID: REL-01-02
- Title: Integration Smoke Sweep
- Nature: VALIDATION (RELEASE READINESS, CROSS-SURFACE REGRESSION SWEEP)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-01-02-CHECKPOINT.md`

## Objective

Run a bounded end-to-end integration smoke sweep across preserved regression-gate surfaces on the live stack.

## Resume Context

- REL-01-02A fixed and locked the startup migration blocker (`projects.updated_at`).
- REL-01-02B fixed and locked the project creation slug blocker (`projects.slug`).
- REL-01-02C fixed and locked the snapshot-after-checkpoint blocker (`/.git` recursion path normalization).
- REL-01-02D fixed and locked the public API execution-status lookup blocker (`GET /api/v1/ai/executions/:executionId`).
- REL-01-02 resumed for bounded final coherence validation.

## Exact Commands / Actions / Checks Run

1. Bounded live-stack sweep (PowerShell) against `http://localhost:4000`:
   - `GET /api/health`
   - `GET /api/health/db`
   - `GET /api/health/ready`
   - unauthenticated `GET /api/sessions` (auth gate)
   - `POST /api/auth/register`
   - `POST /api/auth/login`
   - `GET /api/sessions?includeTerminated=true`
   - `POST /api/sessions`
   - `GET /api/sessions/:id`
   - `POST /api/projects`
   - `POST /api/projects/:id/sessions/:sessionId`
   - `POST /api/projects/:id/open` (with `sessionId` in body)
   - `POST /api/sessions/:id/files/write`
   - `POST /api/sessions/:id/files/read`
   - `GET /api/sessions/:id/files/list?path=notes`
   - `POST /api/sessions/:id/checkpoints`
   - `GET /api/sessions/:id/checkpoints`
   - `GET /api/sessions/:id/checkpoints/:commitHash/diff`
   - `POST /api/sessions/:id/snapshot`
   - `GET /api/preview/:sessionId/status`
   - `GET /api/preview/:sessionId/proxy`
2. Focused bounded follow-up for remaining surfaces (PowerShell) against `http://localhost:4000`:
   - `POST /api/sessions/:id/messages` (valid DTO: `role`, `content`)
   - `GET /api/sessions/:id/conversation`
   - `GET /api/conversations/:id/messages`
   - re-login and `GET /api/conversations/:id/messages` (persistence check)
   - `GET /api/users/me/usage`
   - `GET /api/users/me/quotas`
   - `POST /api/keys`
   - `GET /api/v1/docs`
   - `POST /api/v1/ai/execute`
   - bounded polling `GET /api/v1/ai/executions/:executionId` (up to 10 attempts, 2s interval)
3. Additional bounded action to align validation assumptions with current endpoint shapes:
   - inspected checkpoint create/list responses (`commitHash` field) and used `commitHash` for checkpoint diff validation.
   - inspected session conversation response (`id` field) and used that ID for conversation-message validation.

## Regression-Gate Surface Outcomes (Final Resumed Validation)

- Session lifecycle and sidebar actions: **PASS** (`GET/POST/GET` session path passed)
- Checkpoint creation/history/diff/snapshot: **PASS** (create/list/diff/snapshot all passed)
- Editor file loading/saving: **PASS** (write/read/list passed)
- Preview routing/status: **PASS** (`status` returned `200`; `proxy` returned expected non-running `503`)
- Chat prompt/response/thread behavior: **PASS** (`POST /messages` + conversation reads passed)
- Per-session chat persistence: **PASS** (re-login conversation message retrieval passed)
- Auth gating for workspace access: **PASS** (unauthenticated `GET /api/sessions` returned `401`)
- Quota enforcement and visibility: **PASS** (`/api/users/me/usage` and `/api/users/me/quotas` passed)
- API-key based AI execution flow: **PASS** (`POST /api/v1/ai/execute` succeeded; status lookup returned `200` with coherent status)
- Route bootstrapping and workspace loading behavior: **PASS** (health/auth/project/session/open flow passed)

## Final Recommendation

- REL-01-02 is complete.
- Safe to proceed to REL-01-03.
