# Cursor AI Rules — AI Sandbox Platform

## Mandatory Read Order (STRICT)

Before generating or modifying any code, the AI MUST:

1. Read and obey `CLAUDE.md`
2. Treat `PRD.md` and `ARCHITECTURE.md` as higher authority than any other document
3. Consult `TASKS.md` to identify the active task
4. Refuse to proceed if no active task is specified

## Authority Resolution

If any conflict exists:
PRD.md > ARCHITECTURE.md > CLAUDE.md > TASKS.md > code

## Scope Rules

- Only work on the explicitly selected task
- No scope expansion
- No refactors unless explicitly requested
- No architectural changes unless explicitly approved

## Repository Layout

- All paths are relative to repository root
- There is NO `aiSandBox/` directory
- Never invent directories or paths

## Stopping Rules

- Stop immediately after completing the assigned task
- Do not continue with suggestions or follow-up work
- Checkpoints are mandatory for task completion

## Forbidden Behaviors

- Do not add authentication, guards, or middleware
- Do not redesign internal APIs
- Do not introduce background jobs, queues, or schedulers
- Do not optimize or future-proof unless instructed
