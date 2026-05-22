# CLAUDE.md — AI Sandbox Platform Governance & Working Contract

---

## Project Overview

AI Sandbox Platform enables users to build software by chatting with AI inside isolated containers.

The platform consists of:

- Frontend: Next.js, React, Monaco Editor
- Backend services: NestJS / TypeScript services under `services/`
- Sandbox runtime: Docker + gVisor
- Git auto-commit and checkpoint/revert system
- Usage/quota tracking and future commercial readiness surfaces
- AI execution, streaming, workspace file actions, preview, editor, and checkpoint history

---

## Repository Root and Path Rules

The repository root is:

```powershell
C:\Users\knlee\aiSandBox2026B
```

All source paths must be relative to the repository root unless the user explicitly asks for another form.

Use full Windows paths when giving commands or handoff prompts.

Examples:

```text
C:\Users\knlee\aiSandBox2026B\frontend\...
C:\Users\knlee\aiSandBox2026B\services\api-gateway\...
C:\Users\knlee\aiSandBox2026B\services\ai-service\...
C:\Users\knlee\aiSandBox2026B\services\container-manager\...
C:\Users\knlee\aiSandBox2026B\docs\...
```

Do not reference a non-existent `aiSandBox/` subdirectory.

---

## Current Directory Structure

```text
C:\Users\knlee\aiSandBox2026B\
  CLAUDE.md
  ARCHITECTURE.md
  PRD.md
  TASKS.md
  TASKS_BACKLOG_FULL.md
  docker-compose.yml
  package.json
  frontend\
  services\
    api-gateway\
    ai-service\
    container-manager\
  docs\
```

Any structural deviation must be explicitly approved.

---

## Project Governance Loop

All project work follows this closed-loop governance model:

```text
PRD → ARCHITECTURE → TASKS_BACKLOG_FULL → TASKS → CHECKPOINTS → CODE → CHECKPOINTS/TASKS
```

Rules:

- No code may be written without an active task.
- No task may be completed without a checkpoint.
- No checkpoint may exist without a source task.
- `TASKS.md` is the active execution ledger.
- `TASKS_BACKLOG_FULL.md` is the authoritative long-form backlog.
- Status changes must be mirrored in both files when applicable.
- Completed work must be marked `COMPLETE and LOCKED`.
- Locked tasks must not be edited except for explicitly approved documentation correction.
- No undocumented work is permitted.
- If scope changes materially, update governance docs before implementation.

If governance conflicts with convenience, governance wins.

---

## Task Workflow Rules

Default task loops:

### Tiny implementation / obvious fix
Use a 2-step loop:

1. Implementation
2. Consolidation/checkpoint

### Normal bounded feature or bug fix
Use a 3-step loop:

1. Registration or activation
2. Implementation
3. Consolidation/checkpoint

### Risky, architectural, security-sensitive, or ambiguous work
Use a 4-step loop:

1. Registration
2. Stage-start / triage / plan
3. Implementation
4. Consolidation/checkpoint

Always prefer smaller bounded child slices over large mixed changes.

Do not fix two unrelated issues at once. Register or defer follow-up issues.

---

## New Window Rules

Use a new window by default for:

- Consolidation/checkpoint steps
- Starting a new major family, phase, or task
- Heavy context or slow Cursor/Claude sessions
- Security-sensitive or architecture-heavy work
- Any time Cursor/Claude shows `Append data exceeds maximum size of 52428800 bytes`

Implementation may continue in the same window when the active task context is still small and stable.

---

## Model Guidance

- Sonnet 4.6: registration, planning, stage-start, checkpoint, consolidation, governance/doc work.
- GPT-5.3 Codex: routine implementation, tests, debugging, code fixes.
- GPT-5.3 Codex High: security-adjacent, backend/runtime, checkpoint/revert, or higher-risk implementation.
- Opus / GPT-5.5 High: only for genuinely hard architecture, ambiguous failures, risky migrations, or stuck debugging.

Stay cost-aware. Do not use stronger models for routine bounded edits.

---

## Multilingual-First UX/UI Rule

For all aiSandBox2026B UX/UI work, multilingual support is a top priority.

Any new or changed user-facing UI text must be implemented multilingual-first:

- Add or update keys in:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`
- Use the existing translation hook/pattern.
- Do not add hardcoded English UI copy unless explicitly approved as temporary developer/debug-only text.
- Tests or source assertions should verify translation keys or rendered translated copy where practical.

This applies to:

- empty states
- loading, error, warning, and success messages
- buttons, labels, tabs, headings, and form text
- chat/system status messages
- auth-module UX copy
- checkpoint/history/revert UX copy
- mobile/responsive UI copy
- tooltips, help text, banners, and inline guidance

If a UX/UI task proposes new visible text without i18n updates, stop and revise the scope before implementation.

---

## UX/UI Work Rules

UX/UI work must be bounded and reversible.

Use advisory skills when useful:

- Impeccable: broad UI/UX audit, visual hierarchy, spacing, anti-slop polish.
- Emil Kowalski design engineering: component polish, interaction quality, motion restraint, empty/loading/error states.

These skills are advisory only and must never override:

- `CLAUDE.md`
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- registered scope
- architecture
- tests

UX/UI tasks must not introduce broad redesigns, routing changes, backend work, new dependencies, or architecture refactors unless explicitly approved.

---

## Commands and Shell Rules

Use PowerShell commands only.

Always include full filesystem paths in commands.

Preferred command style:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test
```

Do not use CMD commands.

Do not start dev servers unless explicitly instructed.

Before backend work, remind the user to ensure Docker Desktop and PostgreSQL are running.

---

## Common Validation Commands

Frontend:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

API Gateway:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

Container Manager:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm run build
```

When `npm run build` updates `frontend/tsconfig.tsbuildinfo`, restore it unless that artifact change is explicitly intended.

---

## Source and Scope Rules

Claude must:

- Only work on the active task/module explicitly specified by the user.
- Stop after the assigned task is complete.
- Never refactor unrelated code unless explicitly requested.
- Ask before adding dependencies.
- Avoid architectural changes unless explicitly approved.
- Keep changes minimal and reversible.
- Preserve existing test IDs unless the task explicitly changes them.
- Add or update tests for behavior changes.
- Report exact files changed and validation results.

Claude must not:

- Register unrelated follow-up work inside the current implementation step.
- Hide failures or claim validation passed without running it.
- Convert a bug fix into a broad redesign.
- Modify locked tasks unless explicitly approved.
- Touch production source files during consolidation-only steps.

---

## Architecture and Document Loading Rules

When asked to use large governance docs:

- Read targeted sections only.
- Do not paste entire files.
- Summarize only the relevant section.
- Do not load broad docs unnecessarily in implementation steps.

For new windows, use short-context mode and list only the needed files.

---

## Internal API Endpoints

The following API Gateway endpoints are internal service endpoints and must not be treated as public external APIs.

### Session Lifecycle
Container-manager → api-gateway:

```text
POST /api/internal/sessions/:sessionId/start
POST /api/internal/sessions/:sessionId/stop
POST /api/internal/sessions/:sessionId/error
```

### Git Checkpoint Ledger
Container-manager → api-gateway:

```text
POST /api/internal/git-checkpoints
```

Internal service endpoints must preserve existing internal authentication and guard behavior. Do not expose them to the frontend or external users.

Do not change internal route security, guard strategy, or service identity behavior unless the active task explicitly authorizes it.

---

## Auth and Security Rules

Do not alter platform auth, session cookies, CSRF behavior, internal service keys, guards, or authorization logic unless the active task explicitly requires it.

Generated apps must remain isolated from aiSandBox platform auth:

- Do not reference `aisandbox_session`.
- Do not reference `aisandbox_csrf`.
- Do not reference `aisandbox_oauth_state`.
- Do not reuse `X-Internal-Service-Key`.
- Do not import platform guards or platform auth services into generated app templates.

Platform auth and generated-app auth are separate systems.

---

## Checkpoint and Revert Rules

Checkpoint integrity is production-critical.

- Preserve existing checkpoint creation, listing, and revert behavior unless the active task targets it.
- Revert must restore workspace files, editor state, file tree, preview, and checkpoint list.
- Do not add a parallel undo system unless explicitly approved.
- Do not bypass confirmation flows for risky file actions.
- Any checkpoint/revert change requires tests and live smoke where practical.

---

## AI Workspace File-Action Rules

AI-proposed file changes must use the existing file-action flow.

Do not bypass:

- file-action parsing
- risky batch confirmation
- apply-once guards
- sequential file writes
- post-action coherence
- checkpoint creation
- refresh of file tree/editor/preview/checkpoints

Do not introduce direct DOM rollback, direct workspace mutation, or unconfirmed auto-apply paths unless explicitly approved.

---

## Testing and Validation Rules

Before claiming success:

- Run the validation commands relevant to the changed files.
- Report exact command results.
- Report known environmental failures separately from code failures.
- Use live browser smoke for UI flows that cannot be proven by tests.
- Do not mark tasks complete if required live smoke is blocked and the task acceptance criteria require it.

When a validation artifact changes unintentionally, restore it.

---

## Diff Output Rule

When showing code changes, use standard unified diff format.

Requirements:

- Use `git diff` style.
- Start with `diff --git a/... b/...`.
- Include `---` and `+++`.
- Include `@@` hunk headers.
- Keep context to about 3 lines.
- Do not reprint whole files.
- Do not describe changes as separate deleted/added blocks.

---

## Final Authority Clause

This file defines the working contract for aiSandBox2026B.

If any instruction conflicts with:

- convenience refactors
- broad AI helpfulness
- implementation assumptions
- unregistered scope
- shortcuts around validation or governance

this file wins.
