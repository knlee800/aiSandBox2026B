# Privacy data inventory

Task: PRIVACY-INVENTORY-01. Built from the repository at commit d830f84 on 2026-11-12. Read-only: no code was changed and nothing was run.

## Summary

The platform keeps user data in five places: a PostgreSQL database, a small SQLite file, Redis, workspace folders on the host disk, and snapshot files on the host disk. Chat messages, AI answers, knowledge documents, agent definitions, hand-off prompts and workspace files are all stored as plain text; the only application-level protection is hashing of passwords, sign-in tokens and API keys, and AES-256-GCM encryption of connector passwords. Prompts, file contents, knowledge text and mail excerpts leave our servers to whichever of five AI providers a run uses (Anthropic, OpenAI, xAI, Groq, DeepSeek); the OpenAI and xAI Agent paths also ask the provider to store the conversation. Email (Resend), Google and Apple sign-in and the mail and calendar connectors are present but off or gated by configuration; Stripe code exists but makes no outside call. Users can remove a knowledge document, a workflow, a connection, an API key and a workspace label, but there is no account deletion, no chat or project deletion, no general export, and no code that deletes workspace folders, snapshots or old rows over time. One earlier statement needs correcting: the usage ledger does store the AI's answer text (section 1.2, `usage_records.metadata`).

## How this was built

- Read every TypeORM entity under `services/api-gateway/src/entities` and `services/api-gateway/src/orchestration/*.entity.ts`, and listed `CREATE TABLE` statements in the migrations.
- Listed every route decorator and guard in the gateway controllers; read the global internal-key guard and the admin guard.
- Searched the gateway for every delete path (`.delete(`, `.remove(`, `softDelete`, `DELETE FROM`), every timer (`@Cron`, `setInterval`) and for log lines that mention email, prompt, content, password or body.
- Read the AI adapters, the job type, the worker's result write, the harness tool list and the connector code in `services/ai-service` and `services/connectors-mcp`.
- Read the container-manager session, Docker, git and preview code for paths, volumes and removal.
- Read the host tooling in `ops/clean-baseline` (backup script, library, Caddyfile, env templates by variable name only, systemd units).
- Searched the frontend for browser storage, third-party scripts, fonts, analytics and error tracking.

**Not checked**

- The running staging host: nothing here is confirmed against it (section 5).
- Whether the frontend adds earlier chat turns to the prompt text it sends; the prompt builder in `frontend/app/[locale]/app/page.tsx` was read only around the multi-step path.
- Every log line in every service. The log search was by keyword, not a full audit.
- Test files, `e2e/`, `monitoring/`, `docs/` evidence folders and `services/governance`.
- Legacy files at the repository root (`database/schema.sql`, `src/`, `projects/`), except where a live service opens them.
- Provider terms, and any law. This is not legal advice.

Path shorthand: **GW** = `services/api-gateway/src`, **AI** = `services/ai-service/src`, **CM** = `services/container-manager/src`, **MCP** = `services/connectors-mcp/src`, **FE** = `frontend`, **OPS** = `ops/clean-baseline`.

---

## 1. Data stored

### 1.1 PostgreSQL: account and sign-in

Written and read by the gateway unless stated. "Cascade" means the row is removed by the database when its user row is removed; no code removes a user row today (section 4).

| Table | Holds | Protection in the app | Retention and deletion today | Reference |
|---|---|---|---|---|
| `users` | email, password hash, auth provider, OAuth id, role, plan type and status, Stripe customer id, active and verified flags, last login time | password hashed with bcrypt, cost 12 | kept; no delete route or code | GW/entities/user.entity.ts:20-111; GW/auth/auth.service.ts:272, 643 |
| `auth_sessions` | user id, sign-in session token hash, expiry, last active, revoked time | token stored as SHA-256 hash; cookie is httpOnly | 7-day expiry; revoked on logout and password reset; expired rows are not purged; cascade | GW/entities/auth-session.entity.ts:15-43; GW/auth/auth.service.ts:34, 84-86, 285-299; GW/auth/auth.controller.ts:94-99, 398 |
| `verification_tokens` | user id, token hash, type, expiry, used time, locale | SHA-256 hash | 24-hour expiry for email verification; rows not purged; cascade | GW/entities/verification-token.entity.ts:14-45; GW/auth/auth.service.ts:35, 92-121 |
| `oauth_accounts` | user id, provider, provider account id, provider email | none | kept; cascade | GW/entities/oauth-account.entity.ts:15-41; GW/auth/auth.service.ts:354-395 |
| `api_keys` | user id, key hash, key prefix, scopes, revoked time, internal flag | bcrypt hash; the full key is shown once | "delete" sets `revoked_at`; the row stays; no cascade set on the relation | GW/entities/api-key.entity.ts:30-95; GW/auth/api-key.service.ts:52-67, 141; GW/auth/api-key.controller.ts:81 |
| `user_entitlements` | per-user feature access, plan override, token limit override, who changed it | none | kept; cascade | GW/entities/user-entitlement.entity.ts:8-33; GW/migrations/1801000000000-CreateUserEntitlementsTable.ts:12 |

### 1.2 PostgreSQL: user content

| Table | Holds | Protection in the app | Retention and deletion today | Reference |
|---|---|---|---|---|
| `chat_messages` | message text (`content`), role, tokens, per conversation | none (plain text) | kept; no delete route; cascade from conversation | GW/entities/chat-message.entity.ts:18-75; written at GW/conversations/conversation.controller.ts:106 and GW/chat-messages/chat-message.controller.ts:24 |
| `conversations` | session id, message count | none | kept; cascade from session | GW/entities/conversation.entity.ts:18-63 |
| `usage_records` | one row per AI run: user, session, provider, model, tokens, status; and in `metadata`: **the AI's answer text and proposed file changes** (`aiExecutionResult.output`, `fileActions`), error messages, changed paths, any metadata the client sent | none | kept; described as append-only; `user_id` has no foreign key, so nothing cascades | GW/entities/usage-record.entity.ts:15-27, 66, 153-157; AI/worker/worker.processor.ts:2274-2284, 2335-2339; GW/ai/ai-execution.controller.ts:932-939 |
| `knowledge_documents` | title, full document text (`content`), hash, size, scope | none | user delete is a soft delete: `deleted_at` is set and the text stays in the table; limit 200 KB a document, 50 documents, 4 MB an account; cascade | GW/entities/knowledge-document.entity.ts:14-53; GW/knowledge/knowledge.service.ts:184-192; GW/knowledge/knowledge-content.ts:9-11 |
| `user_agents` | the user's agents and workflows: name, role, description, purpose, procedure, result, tone, tool and knowledge settings, budgets, team members | none | user delete is a soft delete (`deleted_at`); cascade | GW/entities/user-agent.entity.ts:23-114; GW/user-agent/user-agent.service.ts:392-393 |
| `user_ai_instructions` | the user's global AI instructions text | none | kept; cascade | GW/entities/user-ai-instructions.entity.ts:13-36 |
| `project_ai_context` | project instructions text | none | kept; cascade from project | GW/entities/project-ai-context.entity.ts:13-36 |
| `project_repo_docs` | file paths chosen as always-included docs | none | replaced on update; cascade from project | GW/entities/project-repo-doc.entity.ts:13-40; GW/project-repo-docs/project-repo-docs.service.ts:41 |
| `projects` | name, slug, visibility (private or public), owner | none | kept; no delete route; cascade | GW/entities/project.entity.ts:22-66; GW/projects/projects.controller.ts:23-107 |
| `workspaces` | workspace name and slug (a label that groups projects, not the files) | none | user can delete; its projects move to the default workspace | GW/entities/workspace.entity.ts:17-49; GW/workspaces/workspaces.service.ts:144-148 |
| `sessions` | owner, project, status, container id, activity times, termination reason | none | "delete" marks the session terminated; the row stays; cascade | GW/entities/session.entity.ts:18-119; GW/sessions/session.controller.ts:504-540 |
| `containers` | container name, image, limits, status | none | kept; cascade from session | GW/entities/container.entity.ts:19-107 |
| `git_checkpoints` | commit hash, description, message number, files changed, per session | none | kept; cascade from session | GW/entities/git-checkpoint.entity.ts:17-80 |
| `collaboration_runs` | Team-page runs: owner, project, roles, status, cancel reason and who cancelled | none | kept; no delete route; `user_id` is text with no foreign key | GW/orchestration/collaboration-run.entity.ts:8-81; GW/migrations/1773100000000-CreateCollaborationOrchestrationTables.ts:78-101 |
| `collaboration_referrals` | each hand-off: in `pending_job` the **prompt, global and project instructions, workspace context, hand-off note and the working-tree diff text**; `result_summary`; output file names; cancel reason | none | kept; cascade from its run only | GW/orchestration/collaboration-referral.entity.ts:19-154; GW/orchestration/orchestration.contracts.ts:248-273 |
| `collaboration_rosters` | the owner's chosen team member ids | none | kept; cascade | GW/orchestration/collaboration-roster.entity.ts:11-20; GW/migrations/1805000000000-CreateCollaborationRostersTable.ts:29 |
| `connector_connections` | mail or calendar connection: kind, preset, mailbox username, encrypted secret (app password or calendar URL), key version | secret encrypted with AES-256-GCM; key from `CONNECTOR_CREDENTIALS_KEY`; username is plain | user delete removes the row; cascade | GW/entities/connector-connection.entity.ts:17-52; GW/connectors/connector-crypto.ts:42, 62, 80; GW/connectors/connectors.service.ts:122, 166 |

### 1.3 PostgreSQL: usage, billing and audit

| Table | Holds | Retention and deletion today | Reference |
|---|---|---|---|
| `token_usage` | tokens per session, conversation and message; model | kept; the session relation is `RESTRICT`, so a session with token rows cannot be removed by the database | GW/entities/token-usage.entity.ts:21-104 (line 35) |
| `credit_balances`, `credit_deduction_records`, `credit_grants` | balance, each deduction (session, execution, model, amounts, metadata), each grant (amount, reason, which admin granted) | kept; owner id has no foreign key | GW/entities/credit-balance.entity.ts:23-69; GW/entities/credit-deduction-record.entity.ts:23-90; GW/entities/credit-grant.entity.ts:51-146 |
| `subscriptions` | plan, status, period, Stripe subscription and price ids | kept; no cascade set | GW/entities/subscription.entity.ts:49-117 |
| `billing_snapshots`, `invoices` | per-period token totals and cost by provider and model, per user and API key | kept | GW/entities/billing-snapshot.entity.ts:37-176; GW/entities/invoice.entity.ts:39-168 |
| `webhook_events` | payment webhook event ids, type, status, a hash of the payload (not the payload), error text | kept | GW/entities/webhook-event.entity.ts:37-98; GW/billing/webhook/webhook.service.ts:75 |
| `audit_events` | category, event type, subject, user id and a JSON payload. Three writers: entitlement changes by an admin; connector connect, replace, delete, verify and call (tool id, item count, size, duration, outcome; no mail text); collaboration events (ids, roles, status, reasons, prompt length, and the result summary text on a failed hand-off) | kept; no delete code; `user_id` nullable, no cascade seen | GW/entities/audit-event.entity.ts:9-45; GW/auth/entitlement.service.ts:114-144; GW/connectors/connector-broker.ts:329-349; GW/orchestration/orchestration-audit.recorder.ts:53-63; GW/orchestration/orchestration.service.ts:808-818, 1338-1352 |
| `plans` | plan catalogue; no user data | n/a | GW/entities/plan.entity.ts:10-38 |

Kept in gateway memory only, lost on restart: the operator audit log of kill-switch changes (GW/safety/audit-log.service.ts:33-35) and rate-limit counters keyed by user or IP address (GW/guards/rate-limit.guard.ts:51; GW/auth/email-throttler.guard.ts:15).

### 1.4 SQLite file `database/aisandbox.db`

| Store | Holds | Who writes and reads | Retention and deletion today | Reference |
|---|---|---|---|---|
| `sessions` (container-manager copy) | session id, user id, project id, container id, status, times, termination reason | container-manager | row removed only by its `deleteSession`, which the gateway code never calls (search found the client method but no caller) | CM/sessions/sessions.service.ts:66-88, 189-229; GW/clients/container-manager-http.client.ts:180 |
| `governance_events` | session id, user id, termination reason and time | container-manager | kept | CM/sessions/sessions.service.ts:89-97; CM/governance/governance-events.service.ts:44 |
| `conversations` (old ai-service store) | messages as JSON per session | old ai-service routes behind the internal key | not confirmed whether anything still writes it; see section 5 | AI/conversations/conversations.service.ts:9-23, 49-60; AI/conversations/conversations.controller.ts:6-32 |

### 1.5 Redis

| Key or channel | Holds | Retention today | Reference |
|---|---|---|---|
| BullMQ queue `ai-execution` | the whole job for each AI run: user id, prompt, workspace context (file paths and file contents), global and project instructions, model, the connector grant token | completed jobs are removed; **failed jobs are kept** (`removeOnFail: false`) with no expiry in code | GW/queue/queue.service.ts:39-45; AI/queue/job.types.ts:23-32, 45-131 |
| Pub/sub `ai-execution-stream:<executionId>` | the answer text and file actions as they stream | not stored (publish only) | AI/streaming/execution-stream.publisher.ts:20-60; AI/worker/worker.processor.ts:2314-2324 |

Whether Redis writes its data to disk on the host is a host setting (section 5). The backup copies `redis.conf` but not Redis data (OPS/lib/ops-lib.sh:1194-1198).

### 1.6 Files on the host disk

| Place | Holds | Who writes and reads | Retention and deletion today | Reference |
|---|---|---|---|---|
| `workspaces/<sessionId>/` | every file of the user's project for that session, including the `.git` folder | container-manager creates it and mounts it into the session container as `/workspace`, read-write | kept when a session is stopped, terminated or times out (only the container is removed). The one code path that deletes the folder is container-manager `deleteSession`, which the gateway never calls | CM/sessions/sessions.service.ts:103, 125, 148-187, 189-222, 296-297; CM/docker/docker-runtime.service.ts:134 |
| `.git` inside the workspace | checkpoint history: every checkpoint is a git commit made inside the container, so earlier versions of files (deleted ones too) stay in history | container-manager, through the container | kept with the workspace folder | CM/git/git.service.ts:249-253, 282-315 |
| `snapshot-store/<userId>/<id>.data.json` and `.meta.json` | a full copy of the workspace files (text, or base64 for binary), without `.git`, plus label and time | gateway; written on a manual snapshot and by the agent save route; read on restore and project reopen | kept; no delete code found in the service; no limit on the number of snapshots found | GW/snapshots/snapshot-persistence.service.ts:49, 85-125, 308-326; GW/sessions/session.controller.ts:350-366; GW/sessions/internal-workspace-files.controller.ts:197-217 |
| Session containers | a `node:24-alpine` (or browser-capable) container per session; its only bind is the workspace folder; no platform secrets are passed in at creation | container-manager | removed on stop, timeout and termination; anything written outside `/workspace` goes with it | CM/docker/docker-runtime.service.ts:42, 107-157, 281-284 |
| Uploads | knowledge uploads are held in memory and saved to `knowledge_documents`; a workspace zip import is unpacked into the workspace | gateway | as their targets above | GW/knowledge/knowledge-upload.interceptor.ts:25; GW/sessions/session.controller.ts:453 |

### 1.7 The user's browser

| Place | Holds | Reference |
|---|---|---|
| `localStorage` | a copy of the chat thread per session, a pending-run marker, layout choices | FE/app/[locale]/app/page.tsx:966-982, 1917, 1960; FE/components/workspace/workspace-shell.tsx:472-479 |
| `sessionStorage` | selected session, project and workspace; an unsaved editor draft; a prompt typed on the landing page | FE/app/[locale]/app/page.tsx:1435-1442, 1510-1511; FE/components/public/public-landing-slice.tsx:82 |
| `localStorage` on the `/driver` developer page | the API key typed into that page, in plain text | FE/app/[locale]/driver/page.tsx:74, 288 |
| Cookies | `aisandbox_session` (httpOnly, 7 days), `aisandbox_csrf` (not httpOnly, so page scripts can read it), `aisandbox_oauth_state` (10 minutes) | GW/auth/auth.controller.ts:94-99; GW/main.ts:36-55 |

### 1.8 Logs

Services log to standard output; the gateway enables log, error, warn and debug levels (GW/main.ts:19). The systemd units set no log target, so where logs go and how long they are kept is a host matter (section 5). The Caddyfile has no `log` directive (OPS/caddy/Caddyfile:1-17).

| What reaches the logs | Reference |
|---|---|
| Session, conversation, execution and user ids on most AI and session lines | AI/ai-execution/adapters/anthropic-ai.adapter.ts:139-141; GW/billing/checkout/checkout.service.ts:189-203 |
| One JSON line per finished run, and each agent audit event: ids, tool names, sizes, durations, token counts, and a provider error message on failure. No prompt or file content fields in the event types | AI/worker/worker.processor.ts:1182-1184, 2099-2102; AI/agent-harness/audit/harness-audit-events.ts:8-73 |
| The admin's email address when an admin terminates a session | GW/admin/admin-operational.controller.ts:135; GW/admin/admin-dashboard.service.ts:269-285 |
| The preview start command for a session | CM/preview/preview.service.ts:133-138 |
| Internal-route refusals with the path | GW/guards/internal-service-auth.guard.ts:90-106 |

The keyword search found no log line that prints a prompt, a chat message, a password, a token or a connector secret. That search was not a full audit.

### 1.9 Backups, as the repository's host tooling describes them

| Fact | Reference |
|---|---|
| A timer runs the backup every day at 03:30 | OPS/systemd/aisandbox-backup.timer:5 |
| A backup set holds: a tar of `workspaces`, `database`, `projects` and the snapshot store; a full PostgreSQL dump; database roles without passwords; env variable names and file hashes, not values; copies of the PostgreSQL access file, `redis.conf`, the Caddyfile and the service units | OPS/lib/ops-lib.sh:978-992, 1109-1114, 1127-1135, 1175-1205 |
| The set is written unencrypted to `/var/backups/aisandbox/<time>` with mode 0700 | OPS/bin/aisandbox-backup:68-70; OPS/lib/ops-lib.sh:20 |
| Each set is also packed and encrypted with `age` to a recipient key, into `/var/backups/aisandbox-offhost/<time>.tar.age` | OPS/lib/ops-lib.sh:21, 1232-1260 |
| Retention of the unencrypted sets: the newest seven ordinary sets, and pre-migration sets for 30 days | OPS/bin/aisandbox-backup:92-116; OPS/README.md:160 |
| The script does not prune the encrypted bundles, and does not copy them to another machine | OPS/bin/aisandbox-backup:1-117 |
| An older procedure document names a different policy ("30 days daily, 1 year weekly") | docs/backup/postgresql-backup-procedure.md:94 |

So a backup contains everything in sections 1.1 to 1.4 and 1.6. Data a user removes later stays in earlier backup sets until those sets are pruned.

---

## 2. Data that leaves our servers

### 2.1 AI providers

The gateway's catalogue names five providers (GW/ai/provider-model.catalogue.ts:1-7). The call is made by ai-service with keys from its environment (AI/ai-execution/ai-execution.service.ts:198-249).

| Provider | Endpoint and call | Provider-side storage requested by our code | Reference |
|---|---|---|---|
| Anthropic | Anthropic SDK, `messages.create` | none requested | AI/ai-execution/adapters/anthropic-ai.adapter.ts:116-119, 170, 233 |
| OpenAI | OpenAI SDK; chat completions for plain runs, Responses API for Agent runs | **yes on Agent runs**: `store: true`, and later steps send `previous_response_id` so the provider supplies the earlier turns | AI/ai-execution/adapters/openai-ai.adapter.ts:160, 193, 220, 237-238; AI/ai-execution/adapters/adapter-tool-use.mapper.ts:441, 476-483 |
| xAI | OpenAI SDK pointed at `https://api.x.ai/v1`; same two paths | **yes on Agent runs**: `store: true` and `previous_response_id` | AI/ai-execution/adapters/xai-ai.adapter.ts:65, 159, 192, 219, 236-237 |
| Groq | Groq SDK, chat completions | none requested | AI/ai-execution/adapters/groq-ai.adapter.ts:76-79, 141 |
| DeepSeek | OpenAI SDK pointed at `https://api.deepseek.com` | none requested | AI/ai-execution/adapters/deepseek-ai.adapter.ts:75, 168, 239 |

**What is sent on a run**

- The prompt text. On multi-step chat runs the frontend puts earlier step outputs and the original request into it (FE/app/[locale]/app/page.tsx:4610-4620).
- A system prompt that can include the user's global instructions and the project instructions (AI/queue/job.types.ts:60-61).
- Workspace context: file paths, the selected file's content, named file contents, always-included repo docs, search results, project and workspace names (AI/queue/job.types.ts:23-32; AI/worker/worker.processor.ts:882-907).
- On Agent and Team runs, every tool result goes back to the model (AI/agent-harness/orchestrator/agent-harness-loop.ts:274, 353, 506). The tools are: list, read, write, delete and search files; run validation; start preview; browser smoke; search and read Knowledge (AI/agent-harness/tools/tool-registry.ts:25-362); unread mail and today's calendar (AI/agent-harness/tools/connector-tool-definitions.ts:15-16). So file contents, command output, knowledge document text, and mail senders, subjects and body excerpts can all be sent.
- Mail excerpts are capped at 25 messages and 800 characters each (MCP/limits.ts:5, 10).
- No user email address or account id is put in the provider request by the adapter code read.

**Live or gated**

- All runs are off unless `GLOBAL_EXECUTION_ENABLED` is exactly `true`; the default is off (GW/safety/kill-switch.config.ts:17-18). The board records runs as off on staging since the tester window closed (TASKS.md:1022).
- Each provider has a switch that defaults to on (GW/safety/kill-switch.config.ts:25-38) and needs its key (AI/ai-execution/ai-execution.service.ts:198-249).
- Agent and Team runs need the per-user harness entitlement (GW/ai/ai-execution.controller.ts:749; GW/orchestration/collaboration.controller.ts:573).
- Keith's decision D3 withholds OpenAI and xAI Agent runs from anyone but Keith and records that staging held no OpenAI or xAI key on 2026-11-06 (TASKS_BACKLOG_FULL.md:84326). Which keys are on the host today is a host question.

### 2.2 Other outside services

| Service | What is sent, and when | Live or gated | Reference |
|---|---|---|---|
| Resend (email) | the user's email address and a verification or password-reset link, on register, resend and reset request | off by default: `EMAIL_PROVIDER` defaults to `stub`, which sends nothing; `resend` needs `RESEND_API_KEY` and `AUTH_EMAIL_FROM` | GW/email/email.module.ts:19-26; GW/email/stub-email.provider.ts:6-13; GW/email/resend-email.provider.ts:12-40; GW/auth/auth.service.ts:123-160 |
| Google sign-in | the browser is sent to Google; we receive the email and Google account id (scopes `email`, `profile`) | only when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALLBACK_URL` are set; the gateway env template lists none of them | GW/auth/google.strategy.ts:6-13, 33-48; GW/auth/auth.controller.ts:241-263; OPS/env/gateway.env.template |
| Apple sign-in | the browser is sent to Apple; we receive the Apple id, email and name (scopes `name`, `email`) | only when five `APPLE_*` variables are set; the template lists none | GW/auth/apple.strategy.ts:6-11, 49-65; GW/auth/auth.controller.ts:305-327 |
| Stripe (payments) | nothing today. The code would send the user id and email to create a customer, but the provider class has no Stripe SDK call: `test` and `live` modes return "Stripe SDK not available", and no Stripe package is a dependency | mode defaults to `disabled` | GW/payments/providers/stripe-payment.provider.ts:66-99, 162, 183, 201, 220, 243; GW/billing/checkout/checkout.service.ts:183-187; services/api-gateway/package.json |
| The user's mail provider | our server signs in to the user's mailbox over IMAP with the stored app password and reads unread messages; hosts are `imap.gmail.com`, `imap.mail.yahoo.com`, `imap.mail.me.com` | needs the harness entitlement and `CONNECTOR_CREDENTIALS_KEY`; runs only when the user connects, verifies or an agent calls the tool | MCP/limits.ts:22-26; MCP/clients/imap-client.ts:73-76; GW/connectors/connectors.controller.ts:137; GW/connectors/connector-crypto.ts:80 |
| The user's calendar host | our server fetches the user's private iCal URL over HTTPS | same gates | MCP/clients/ical-feed.ts:223-232; MCP/net/public-https.ts:95, 133 |
| Chat channels (Discord and others) | no code found | n/a | search of `services/*/src` and `frontend` |
| Error tracking, analytics | none found: no such package or script tag | n/a | FE/package.json; search of `frontend/app`, `frontend/components`, `frontend/lib` |
| Fonts and CDNs | the Inter font is loaded through `next/font/google`, which fetches the font when the frontend is built, not from the user's browser (Next.js behaviour; not checked in a build). `@monaco-editor/react` is a dependency but is not imported in the source read | n/a | FE/app/[locale]/layout.tsx:2, 8; FE/package.json |
| Generated apps | code running in a session container, and its preview in the browser, can make its own outside calls. Container creation sets no network restriction | host question | CM/docker/docker-runtime.service.ts:133-157 |

---

## 3. Who can read what

### 3.1 The user

- Signs in with the session cookie and reaches only rows whose `userId` matches. Examples: sessions and files (GW/sessions/session.controller.ts:515-518), chat (GW/conversations/conversation.controller.ts:55, 91, 116), checkpoints (GW/checkpoints/checkpoints.controller.ts:41, 78, 108, 140), Knowledge (GW/knowledge/knowledge.service.ts:51, 113-117), connections (GW/connectors/connectors.service.ts:119, 138), Team runs and results (GW/orchestration/collaboration.controller.ts:411, 798; GW/orchestration/collaboration-results.ts:264), AI runs (GW/ai/ai-execution.controller.ts:281, 336, 786), preview (GW/preview/preview-ownership.guard.ts:41-45).
- Can download one session's workspace as a zip (GW/sessions/session.controller.ts:428).
- API keys give the same owner-scoped access on `/api/v1/*` (GW/public-api/public-files.controller.ts:47, 82; GW/public-api/public-ai.controller.ts:120).

### 3.2 Other users

- A wrong owner gets "not found" or "forbidden" on the routes above.
- Socket.IO: a connection needs the session cookie, and `join-session` checks the session's owner (GW/websocket/websocket.gateway.ts:127-156, 188-204).
- A project set to public shows its id, name and dates to anyone, without sign-in; no files. A fork copies the name only (GW/projects/public-projects.controller.ts:14-58; GW/projects/projects.service.ts:155-177).
- HTTP CORS allows only the app's own origin (GW/main.ts:23-27).

### 3.3 Admins and staff, in the code

| Path | What it shows or does | Check | Reference |
|---|---|---|---|
| `/api/admin/*` | user list and detail: email, role, plan, session counts, tokens, cost, quota, credit balance; session list with owner email; grant credits; change entitlements; terminate a session | session cookie plus admin role | GW/admin/admin-operational.controller.ts:46-140; GW/guards/admin-role.guard.ts:13-19; GW/admin/dto/admin-users-response.dto.ts:5-45; GW/admin/dto/admin-sessions-response.dto.ts:5-13 |
| `/api/internal/admin/*`, `/api/internal/invoices/*` | user summary, invoices, reconciliation | internal service key only | GW/admin/admin.controller.ts:53-326; GW/admin/reconciliation.controller.ts:41-178; GW/invoices/invoices.controller.ts:28-113 |
| Other internal routes | read, list, search, write and delete files of any session; search and read any user's Knowledge by user id; add chat messages; start and approve Team runs; record checkpoints | internal service key only; connector calls also need a signed grant token | GW/guards/internal-service-auth.guard.ts:11-17, 77-112; GW/sessions/internal-workspace-files.controller.ts:48-230; GW/knowledge/internal-knowledge.controller.ts:31-57, 107; GW/chat-messages/chat-message.controller.ts:12-24; GW/connectors/internal-connectors.controller.ts:20-24 |

- No admin route returns chat text, workspace files, Knowledge text or connector secrets (from the route list and the admin response types).
- Entitlement changes and connector actions write an audit row (section 1.3). Admin reads of the user list, and credit grants, write no `audit_events` row; a grant is recorded in `credit_grants` with the admin's id (GW/entities/credit-grant.entity.ts:112-119).
- There is no audit record of a person reading user content, because no such app route exists; reading it means database, disk or internal-key access.
- Anyone holding the internal service key can reach the internal routes above. Anyone with database access can read every table in section 1 as plain text, except the hashed and encrypted fields. Anyone with host file access can read workspaces, snapshots, the SQLite file, the env files (which hold the connector encryption key) and the unencrypted backup sets. Who those people are is in section 5.

### 3.4 Generated apps in containers

- A session container sees only its own workspace folder (CM/docker/docker-runtime.service.ts:134) and gets no platform environment variables at creation (CM/docker/docker-runtime.service.ts:146-157).
- The preview proxy removes `cookie`, `authorization`, `proxy-authorization` and the internal key before forwarding a request to the generated app (GW/preview/preview.controller.ts:8-14; CM/guards/strip-internal-key.ts:11).
- The preview is shown in an iframe from the platform's own address (`/api/preview/<session>/proxy`), and the iframe has no `sandbox` attribute (FE/components/workspace/workspace-preview.logic.ts:65; FE/components/workspace/workspace-shell.tsx:5186-5193). So the generated app's browser code runs on the platform's origin in its owner's browser. What it could reach there was not assessed.

---

## 4. Gaps today

Facts only. Each line names the later privacy item that would address it: **principles**; **delete and export with retention**; **policy and terms**; **staff access with an audit log**; **public privacy page**.

| # | Gap | Evidence | Addressed by |
|---|---|---|---|
| 1 | No account deletion: no route or code removes a `users` row | GW/users/users.controller.ts:20-58; delete search in "How this was built" | delete and export with retention |
| 2 | If a user row were removed, `usage_records`, credit tables, billing tables, `collaboration_runs` (with their hand-off prompts) and `audit_events` would stay, and `token_usage` would block removing the user's sessions | section 1.2 and 1.3 references | delete and export with retention |
| 3 | No way to delete a chat, a conversation or a project | GW/conversations/conversation.controller.ts:28-106; GW/projects/projects.controller.ts:23-107 | delete and export with retention |
| 4 | Deleting a session only marks it terminated; the workspace folder, its git history, the chat and the snapshots stay | GW/sessions/session.controller.ts:504-540; CM/sessions/sessions.service.ts:148-187 | delete and export with retention |
| 5 | Workspace folders and snapshot files are never deleted by the running system | CM/sessions/sessions.service.ts:189-222; GW/snapshots/snapshot-persistence.service.ts:85-125 | delete and export with retention |
| 6 | Deleted Knowledge documents and workflows are soft-deleted; their text stays in the table | GW/knowledge/knowledge.service.ts:188; GW/user-agent/user-agent.service.ts:393 | delete and export with retention |
| 7 | No retention period anywhere in the app: no timer purges old chats, usage rows, audit rows, expired sign-in sessions, used tokens or failed queue jobs | timers found: GW/orchestration/collaboration-sweep.worker.ts:18; GW/usage-ledger/orphan-reconciliation.worker.ts:65 (a Team-run sweep and a status change for stuck usage rows; neither deletes old data) | delete and export with retention |
| 8 | No export beyond one session's workspace zip | GW/sessions/session.controller.ts:428 | delete and export with retention |
| 9 | Backups keep removed data until pruned; the encrypted bundles are not pruned by the script | section 1.9 | delete and export with retention |
| 10 | The usage ledger stores the AI's answer text and file changes, while its own comment says it holds no prompt or response content | GW/entities/usage-record.entity.ts:24; AI/worker/worker.processor.ts:2274-2284 | principles |
| 11 | User content is plain text in the database, on disk and in Redis; the app encrypts only connector secrets | sections 1.2, 1.5, 1.6 | principles |
| 12 | Failed AI jobs stay in Redis with the prompt, file contents and connector grant token | GW/queue/queue.service.ts:39-45 | delete and export with retention |
| 13 | OpenAI and xAI Agent runs ask the provider to store the conversation | section 2.1 | principles |
| 14 | No privacy policy, terms page or consent step: no such page under the app routes | FE/app/[locale]/ (pages listed: account, admin, app, billing, collaboration, connections, driver, forgot-password, gallery, keys, knowledge, login, office, platform, projects, register, reset-password, results, share) | policy and terms |
| 15 | No notice in the product of which AI provider receives a prompt, or that mail excerpts go to the model provider, was looked for or found in this pass | not checked in `frontend/messages` beyond the earlier search recorded in docs/OFFICE-VOICE-PRIVACY-DISCUSSION-2026-11-12.md section 4.1 | policy and terms |
| 16 | No public list of outside processors | same as 14 | public privacy page |
| 17 | No written rule for staff access to user content, and no record when someone reads it through the database, the disk or the internal key | section 3.3 | staff access with an audit log |
| 18 | Admin reads of user lists are not audited; the operator audit log for kill switches is in memory only | GW/admin/admin-operational.controller.ts:55-69; GW/safety/audit-log.service.ts:33-35 | staff access with an audit log |
| 19 | One shared internal key opens every internal route for every user's data; it is not per service or per user | GW/guards/internal-service-auth.guard.ts:65-68 | staff access with an audit log |
| 20 | The developer `/driver` page keeps an API key in browser `localStorage` | FE/app/[locale]/driver/page.tsx:288 | principles |
| 21 | Generated-app previews run on the platform's origin without an iframe sandbox | section 3.4 | principles |
| 22 | Logs carry user ids, session ids and an admin's email; log retention is not set in the repository | section 1.8 | delete and export with retention |

---

## 5. Open questions only the host or Keith can answer

**Storage and encryption**

1. Is the staging disk (PostgreSQL data, `/opt/aisandbox/workspaces`, the snapshot store, `/var/backups`) encrypted at rest by the cloud provider or the operating system?
2. Does Redis on staging write to disk (RDB or AOF)? If so, where, and is that disk covered by question 1?
3. Are connections to PostgreSQL and Redis local only (loopback) on staging, as the prepare script sets (OPS/bin/aisandbox-prepare:452-453, 466)?
4. Does `database/aisandbox.db` on staging hold rows in the old `conversations` table, and does anything still write to it?
5. Where does the gateway build place the snapshot store on staging: `/opt/aisandbox/snapshot-store` or `/opt/aisandbox/services/snapshot-store`? The backup covers both (OPS/lib/ops-lib.sh:985).

**Backups**

6. Is the nightly backup timer enabled on staging, and are the seven-set and 30-day rules in OPS/bin/aisandbox-backup:92-116 what actually runs?
7. How long are the encrypted bundles in `/var/backups/aisandbox-offhost` kept? The script never deletes them.
8. Where are the bundles copied off the host, by whom, how often, and how long are those copies kept?
9. Who holds the `age` private key that opens the bundles, and where is it stored?
10. Do cloud-level snapshots of the staging instance exist? If so, how many, how long are they kept, and are the snapshots of the deleted old instance still held?
11. Which backup policy is the intended one: the script's, or the older "30 days daily, 1 year weekly" in docs/backup/postgresql-backup-procedure.md:94?

**Logs**

12. Where do the service logs go on staging (systemd journal or files), and how long are they kept?
13. Does Caddy write access logs on staging (the repository Caddyfile sets none), and do they hold IP addresses?

**People and access**

14. Who has SSH access to the staging host, and who can become root or the `aisandbox` or `postgres` user?
15. Who can read `/etc/aisandbox/*.env` (internal service key, connector encryption key, provider keys)?
16. Who has the admin role in the `users` table on staging?
17. Who knows the basic-auth operator password in front of staging?
18. Who can sign in to the cloud console, the domain and DNS account, and each AI provider's console (where stored conversations and request logs may be visible)?

**Outside processors**

19. Which provider keys are set on staging today (variable names only: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`), and which `PROVIDER_*_ENABLED` switches are off?
20. For each provider in use, what do the commercial API terms on Keith's account say about (a) training on API data, (b) how long requests and responses are kept, (c) where data is processed, and (d) whether a zero-retention option exists and is switched on?
21. For OpenAI and xAI: how long are responses created with `store: true` kept, and can they be deleted per user?
22. What is `EMAIL_PROVIDER` on staging? If `resend`, what do Resend's terms say about keeping recipient addresses and message content?
23. Are any `GOOGLE_*` or `APPLE_*` sign-in variables set on staging?
24. Is `STRIPE_PROVIDER_MODE` set on staging (the code makes no Stripe call either way)?
25. Can session containers on staging reach the internet and the host's loopback services (PostgreSQL, Redis, the internal ports)?

**Decisions that are Keith's**

26. Should the usage ledger keep the AI's answer text (gap 10), or should that live only in chat and run results?
27. Which regions' users are expected first (Taiwan, mainland China, EU, others)? The rules for retention, export and deletion differ by region; a lawyer answers which apply.

---

## 6. Follow-ups noticed

Reported for the control plane to dispose; nothing here is registered by this document.

1. Correct the record that "the usage ledger stores no prompt or response content" (docs/OFFICE-VOICE-PRIVACY-DISCUSSION-2026-11-12.md section 4.1 and the ACCESS-READY-01 body): `usage_records.metadata` holds the answer text and file changes (gap 10).
2. Failed BullMQ jobs are kept in Redis with full prompt and file contents and no expiry (gap 12).
3. The preview iframe has no `sandbox` attribute and is same-origin with the platform (gap 21); a security review would say whether this matters.
4. The `/driver` page stores an API key in `localStorage` (gap 20).
5. The encrypted backup bundles are never pruned by the backup script (gap 9, question 7).
6. `token_usage` uses `RESTRICT` on its session relation, which would block a future account deletion until handled (gap 2).
7. The old ai-service conversation store and its routes still exist (section 1.4, question 4).
8. `docs/backup/postgresql-backup-procedure.md` states a retention policy that differs from the backup script (question 11).
