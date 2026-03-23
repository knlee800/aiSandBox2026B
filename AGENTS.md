# aiSandBox Agent Instructions

## Purpose
This repository is a production-oriented AI sandbox platform with strict governance, phased delivery, and checkpoint-based progress. Work must preserve stability, traceability, and existing architectural boundaries.

## Instruction Priority
Always obey higher-authority project documents first:

1. `C:\Users\knlee\aiSandBox2026B\PRD.md`
2. `C:\Users\knlee\aiSandBox2026B\ARCHITECTURE.md`
3. `C:\Users\knlee\aiSandBox2026B\CLAUDE.md`
4. `C:\Users\knlee\aiSandBox2026B\TASKS.md`
5. Relevant checkpoint and phase documents under `C:\Users\knlee\aiSandBox2026B\docs\`

If any lower-level instruction conflicts with a higher-level project document, follow the higher-level document.

## Core Principles
- Security first.
- Plan before execute for non-trivial work.
- Prefer minimal diffs.
- Handle one issue at a time.
- Do not refactor unrelated areas.
- Do not widen scope on your own.
- Preserve existing architecture unless an approved task explicitly requires change.
- Verify results before claiming success.

## Working Model
This repository uses tightly scoped implementation slices.

Required working pattern:
- Identify the exact current task/stage before making changes.
- Read the relevant task and checkpoint context first.
- Implement only the requested slice.
- Keep changes local and controlled.
- Finish the current slice cleanly before moving to the next one.

## Stage and Checkpoint Discipline
Before making changes:
- Identify the current task/stage in `C:\Users\knlee\aiSandBox2026B\TASKS.md`.
- Read the relevant checkpoint documents in `C:\Users\knlee\aiSandBox2026B\docs\`.
- Respect all locked invariants and preserved boundaries from prior checkpoints.

When completing scoped work:
- Update only the files required for that slice.
- Keep checkpoint language factual and implementation-specific.
- Do not mark broader phases complete unless explicitly validated.
- Do not create or modify governance docs unless the task calls for it.

## Architecture Discipline
Treat this codebase as a multi-service system with explicit boundaries.

Do not casually alter:
- service boundaries
- auth flows
- billing and quota semantics
- execution lifecycle semantics
- queue and event contracts
- session and history semantics
- container isolation behavior
- governance and documentation structure

Avoid introducing cross-cutting refactors unless explicitly requested.

## Security Guidelines
Before considering work complete:
- No hardcoded secrets, API keys, passwords, or tokens.
- Validate user input at system boundaries.
- Prevent SQL injection with parameterized queries and safe ORM usage.
- Prevent XSS with safe rendering and sanitization where applicable.
- Ensure authentication and authorization behavior remains correct.
- Ensure rate limiting and abuse controls are preserved where applicable.
- Ensure error messages do not leak sensitive data.
- Validate required environment variables and configuration assumptions.

Secret management rules:
- Never hardcode secrets in source code.
- Always use environment variables or approved secret management.
- If a secret may have been exposed, stop and flag it clearly.
- Review nearby code for similar exposure patterns.

If a critical security issue is found:
- Stop the current change.
- Fix the issue before continuing unrelated work.
- Check whether similar issues exist in related files.
- Do not claim completion until the issue is resolved or explicitly escalated.

## Implementation Rules
- Prefer TypeScript-safe changes.
- Follow existing patterns already used in the touched module.
- Reuse existing DTOs, service contracts, guards, filters, and utility patterns where appropriate.
- Avoid duplicate logic when a local existing pattern already exists.
- Keep naming aligned with nearby code.
- Prefer small focused functions and focused files.
- Avoid deep nesting where practical.
- Do not silently swallow errors.
- In UI code, keep messages user-safe and clear.
- In backend code, log useful diagnostic context without leaking secrets.

## Testing and Validation
Use tests where appropriate for the scope of the change.

Validation expectations:
- confirm the change matches the requested slice exactly
- verify builds/tests/checks relevant to the changed area
- verify no unrelated files were changed
- verify no secrets or unsafe debug artifacts were introduced
- verify documentation/checkpoint updates match the actual implementation

Testing guidance:
- Prefer adding or updating targeted tests when the slice materially changes behavior.
- Do not force broad test rewrites for unrelated areas.
- Do not claim success unless the relevant verification actually passed.

## Planning and Review
For non-trivial work:
- plan the slice before implementing
- identify dependencies and risks
- keep the plan proportional to the task

After meaningful code changes:
- review the changed area for correctness, maintainability, and security
- resolve critical or high-severity issues before considering the slice complete

## Backend Work Reminder
For backend-related work, first ensure required local dependencies are running, especially Docker and PostgreSQL if the affected flow depends on them.

## File Path Convention
When giving commands or implementation notes, always use full absolute Windows paths.

## Response Style for This Repository
- Be concise.
- Be precise.
- Prefer direct execution over long explanation.
- Do not propose multiple simultaneous fixes.
- Do not ask for unnecessary manual editing when a precise implementation can be made directly.
- Preserve checkpoint discipline and staged execution for complex work.

## Out of Bounds Unless Explicitly Requested
- repo-wide refactors
- renaming large module areas
- replacing established patterns wholesale
- changing multiple independent systems in one pass
- speculative cleanup
- design changes without task authorization

## Docs and Governance
Governance files are part of the product workflow, not optional extras.

Be careful when editing:
- `C:\Users\knlee\aiSandBox2026B\CLAUDE.md`
- `C:\Users\knlee\aiSandBox2026B\PRD.md`
- `C:\Users\knlee\aiSandBox2026B\ARCHITECTURE.md`
- `C:\Users\knlee\aiSandBox2026B\TASKS.md`
- `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md`
- checkpoint docs under `C:\Users\knlee\aiSandBox2026B\docs\`

Only edit governance/docs files when the task explicitly calls for it.

## When Unclear
Choose the most conservative path:
- smallest safe change
- no architectural drift
- no hidden scope expansion
- preserve prior checkpoints and invariants