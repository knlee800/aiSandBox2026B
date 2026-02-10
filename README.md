# AI Sandbox Platform

AI Sandbox Platform is an AI-powered coding sandbox that allows users to generate, run, and iterate on code through natural language interaction with AI assistants.

Each user session runs inside an isolated, governed container with strict lifecycle, resource, and access controls.

---

## Purpose of This Repository

This repository contains the source code and documentation for the AI Sandbox Platform.

It is organized as a root-based monorepo and follows a strict governance and checkpoint-driven workflow.

This README is intentionally minimal.

---

## Repository Structure (High Level)

```
/
  frontend/                # Web UI (Next.js)
  backend/                 # Backend APIs (NestJS, if applicable)
  services/                # Core services (api-gateway, ai-service, container-manager)
  docs/                    # Checkpoints and formal records
  CLAUDE.md                # AI governance & working contract
  ARCHITECTURE.md          # System architecture (authoritative)
  PRD.md                   # Product requirements
  TASKS.md                 # Active task index
  TASKS_BACKLOG_FULL.md    # Master task backlog
```

All paths are relative to the repository root.

---

## Getting Started (High Level)

This project uses Node.js, Docker, and containerized services.

Exact setup steps, commands, and workflows are intentionally **not defined here**.

Refer to the authoritative documents below before making changes.

---

## Authoritative Documentation

The following files define how this project must be worked on:

- **CLAUDE.md** — Project governance, AI behavior, and workflow rules  
- **ARCHITECTURE.md** — System architecture and invariants  
- **PRD.md** — Product intent and feature scope  
- **TASKS_BACKLOG_FULL.md** — Complete task scope  
- **TASKS.md** — Currently active tasks  
- **/docs/** — Checkpoints and formal completion records  

If any document conflicts with this README, the other document takes precedence.

---

## Status

This is an active, evolving project.

All work is tracked through tasks and formal checkpoints.

---

## License / Contributing

This project is under active development.

Contribution rules and licensing are intentionally not defined yet.
