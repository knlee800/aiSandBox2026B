# LOCAL-PRIVATE-BETA-READINESS-01 — Step 2 Local Rebaseline Report

Date: 2026-07-23  
Repo: `C:\Users\knlee\aiSandBox2026B`  
Scope type: Review/testing only (no source implementation)

## 1. Task identity

- Task: `LOCAL-PRIVATE-BETA-READINESS-01`
- Step: 2 — Local Rebaseline + Private Beta Gap Review
- Reviewer: Codex 5.3 (no subagents)

## 2. Purpose

Assess local private-beta readiness for:
- ainow.biz shell/platform layer
- aiSandbox Builder Agent core
- integration between shell and Builder Agent

## 3. Scope: ainow.biz shell + aiSandbox Builder Agent core

- Shell routes and locale routing (`/[locale]`, login/register/platform/app)
- Core auth/session + Create Agent + project/workspace/repo-docs API paths
- Local safety posture around billing and AI execution paths

## 4. Current governance state

- `LOCAL-PRIVATE-BETA-READINESS-01` is ACTIVE; Step 1 COMPLETE; Step 2 was pending and is now executed via this report.
- Cloud staging remains paused (per `PRIVATE-BETA-STAGING-EXECUTION-PAUSE` checkpoint).
- `PRIVATE-BETA-STAGING-EXECUTION-02` remains DEFERRED / NOT REGISTERED.
- `PRIVATE-BETA-DEPLOYMENT-READINESS` remains BLOCKED / PAUSED.

## 5. Local command discovery

Discovered from:
- `package.json` (root, frontend, api-gateway, ai-service, container-manager)
- `docker-compose.yml`
- `scripts/start-all.ps1`
- `scripts/README.md`
- `database/README.md`

Key safe local commands discovered:
- Root: `npm run start:all`, `npm run dev`, `npm run down`
- Frontend: `npm run dev` (port 3002)
- API Gateway: `npm run dev`, `npm run build`, `npm run migration:*`
- Docker services: PostgreSQL/Redis via compose

## 6. Docker/PostgreSQL/Redis readiness

- Docker CLI available: `Docker version 29.2.1`
- Docker Compose available: `v5.0.2`
- Running containers:
  - `aisandbox-postgres` healthy on `5432`
  - `aisandbox-redis` healthy on `6379`
- Local port checks confirm PostgreSQL/Redis reachable.

## 7. Env presence check without values

Presence-only checks performed (no values opened):
- Present:
  - `C:\Users\knlee\aiSandBox2026B\.env`
  - `C:\Users\knlee\aiSandBox2026B\services\api-gateway\.env`
  - `C:\Users\knlee\aiSandBox2026B\services\ai-service\.env`
  - `C:\Users\knlee\aiSandBox2026B\services\container-manager\.env`
- Not present:
  - `C:\Users\knlee\aiSandBox2026B\.env.local`
  - `C:\Users\knlee\aiSandBox2026B\.env.staging`
  - `C:\Users\knlee\aiSandBox2026B\.env.production`
  - `C:\Users\knlee\aiSandBox2026B\frontend\.env`
  - `C:\Users\knlee\aiSandBox2026B\frontend\.env.local`

## 8. Local service readiness

- API Gateway startup: PASS (started locally, health/ready checks PASS)
- Frontend startup: PASS after stale listener cleanup/restart
- AI Service: not started in this step (safety boundary)
- Container Manager: not started in this step (safety boundary)

## 9. Frontend readiness

After restart, route probes:
- `http://localhost:3002/` -> 307
- `/en` -> 200
- `/en/login` -> 200
- `/en/register` -> 200
- `/en/platform` -> 200
- `/en/app` -> 200
- `/zh-TW/platform` -> 200
- `/zh-CN/platform` -> 200
- `/zh-TW/login` -> 200
- `/zh-CN/login` -> 200
- `/zh-TW/register` -> 200
- `/zh-CN/register` -> 200
- `/en/dashboard` -> 404

## 10. API Gateway readiness

API Gateway dev start succeeded with:
- DB connected
- readiness guard checks passing
- routes mapped
- startup logs show:
  - billing provider mode resolved `disabled`
  - `BILLING_CHARGES_ENABLED=false`
  - kill-switch configuration loaded

## 11. Health endpoint results

- `GET /api/health` -> 200
- `GET /api/health/db` -> 200
- `GET /api/health/ready` -> 200
  - checks: environment/database/killSwitches/safetyLimits loaded
  - kill switches: total 9, enabled 9
- `GET http://localhost:4002/api/health` -> unreachable (status 000 via curl)
- `GET http://localhost:4001/health` -> unreachable (status 000 via curl)

## 12. Auth/register/login readiness

Verified with local API smoke using a temporary test account:
- `POST /api/auth/register` -> 201
- `POST /api/auth/login` -> 200
- `GET /api/auth/me` (session cookie) -> 200

Also verified endpoint validation behavior:
- invalid empty register/login payload -> 400 (expected validation)

## 13. Session/authenticated redirect readiness

- API session cookie flow works (`login` then `auth/me` -> 200).
- Platform UI guard logic exists in `platform-dashboard` (`fetch('/api/auth/me')`, unauthenticated -> `router.replace('/[locale]/login')`).
- Full JS-driven browser redirect interaction was not executed in this non-interactive API-driven step.

## 14. ainow.biz shell readiness

- Public landing route exists (`/[locale]`) and is functional.
- Login/register routes are functional across locales.
- `dashboard` route check currently returns 404 (`/en/dashboard`).
- Branding/text evidence still shows `AI Sandbox` in translations (`common.appName`, `login.title`), indicating partial/legacy branding remains.

## 15. Builder Agent / aiSandbox core readiness

- Builder Agent manifest exists and is active in registry (`id=builder`, route `/app`).
- Platform route and workspace route are both active (`/platform`, `/app`).
- Authenticated core API flows (`agents`, `projects`, `workspaces`) are reachable and functioning.

## 16. Create Agent local readiness

Authenticated API smoke:
- `GET /api/agents` -> 200 with empty list
- `POST /api/agents` with valid payload -> 201
- Follow-up `GET /api/agents` -> created agent returned

Result: Create Agent core flow is locally functional at API level.

## 17. Project/session linkage readiness

Authenticated API smoke:
- `GET /api/workspaces` -> 200, default personal workspace present
- `POST /api/projects` -> 201
- `GET /api/projects/:projectId/repo-docs` -> 200 (empty)
- `PUT /api/projects/:projectId/repo-docs` -> 200
- `POST /api/projects/:projectId/sessions/<dummy-uuid>` -> 404 (expected for nonexistent session)

Result: project/workspace and repo-docs linkage paths are operational; session-association endpoint reachable and enforcing session existence.

## 18. Billing disabled-state verification

Evidence:
- API startup log: `Provider mode resolved: disabled`
- API startup log: `BILLING_CHARGES_ENABLED=false (charging disabled, safe mode)`
- Unauthenticated billing endpoints return 401 (guarded)

Conclusion: billing/payment execution is in disabled/guarded safe posture for this local run.

## 19. Risky AI/container execution disabled-state verification

Evidence:
- Unauthenticated `POST /api/ai/execute` -> 401
- Authenticated `POST /api/ai/execute` with empty payload -> 402 (not 503)
- `killSwitches.enabled = 9/9` from readiness endpoint

Conclusion:
- Endpoint is guarded from unauthenticated access.
- Endpoint is NOT hard-kill-switched in this local configuration (it is reachable in authenticated flow and fails later with 402), so "disabled-safe" execution posture is **not fully satisfied**.

## 20. Harness/tool-loop disabled-state verification

Evidence:
- `GET /api/health/ready` indicates kill switches loaded and enabled count = total count.
- API-level execution path reachable for authenticated requests (402 with empty payload).
- AI service/container-manager were intentionally not started to avoid enabling risky runtime actions.

Conclusion: harness/tool-loop hard-disable state is not proven; current API behavior suggests execution path is still live behind auth/quota.

## 21. Repo Docs/context readiness if reachable

- Verified reachable with authenticated project:
  - `GET /api/projects/:projectId/repo-docs` -> 200
  - `PUT /api/projects/:projectId/repo-docs` -> 200
  - `GET` again -> persisted doc path

Result: repo-docs context behavior reachable and functional locally.

## 22. Local private-beta gap list

- AI execution path not hard-disabled for authenticated users.
- `dashboard` route expected by shell-scope check currently 404.
- AI Service / Container Manager runtime health not validated in this step (kept off for safety).
- Branding still shows `AI Sandbox` in shell strings (not yet fully ainow-branded).

## 23. Cloud-only checks deferred

- Lightsail runtime install / PM2 lifecycle
- DNS + Caddy + TLS behavior
- staging domain cookie/session behavior
- staging migration execution and post-migration verification
- staging H1-H9 health smoke over HTTPS

## 24. P0/P1/P2 classification

### P0 (blockers before private beta return-to-cloud decision)

1. Risky execution path not hard-disabled locally for authenticated API requests (`/api/ai/execute` returns 402 instead of kill-switch 503).

### P1 (important before private beta)

1. `dashboard` route missing (`/en/dashboard` -> 404) while shell-scope explicitly checks dashboard behavior.
2. AI Service and Container Manager readiness not validated in this step (safety-constrained gap).
3. Shell branding still shows legacy `AI Sandbox` strings.

### P2 (can wait)

1. OAuth provider routes disabled by missing provider env config (warnings); email/password local flow works.

## 25. Recommended next smallest local task

Exactly one recommended next task (do not implement here):

`LOCAL-PRIVATE-BETA-READINESS-01-FIX-EXECUTION-KILLSWITCH-LOCAL`  
Goal: force local private-beta safe mode by setting execution kill switch(es) to block authenticated `POST /api/ai/execute` with 503, then re-smoke `/api/health/ready` + authenticated execution guard behavior.

## 26. Stop conditions encountered

1. Initial frontend listener on `3002` accepted TCP but timed out on HTTP requests; treated as degraded local state.
2. Resolved by safe frontend restart using existing script command path.
3. Early curl JSON quoting attempt produced malformed-body 400; switched to PowerShell web-session requests for stable API validation.

## 27. What was not tested

- Interactive browser-driven authenticated redirect UX (JS navigation) end-to-end.
- Real AI execution payloads (intentionally avoided).
- Container Manager and AI Service runtime startup/health (intentionally avoided for safety).
- Cloud/deployment/staging actions (intentionally out of scope).
- Migration execution in this step (intentionally skipped per constraints).

## 28. Safety boundaries preserved

- No source code files modified.
- No governance files edited in Step 2.
- No env values opened/printed.
- No migrations run.
- No AWS/cloud/DNS/TLS/SSH/deployment actions.
- No billing/payment execution enabled.
- No risky AI/container execution run.
- No git commit/push.
- No subagents used.

## 29. PASS/BLOCKED verdict

**BLOCKED** for private-beta readiness progression.

Reason: P0 gap remains on execution kill-switch posture (authenticated execution endpoint is not hard-disabled).

## 30. Exact next action

Execute exactly one local bounded fix task next:  
`LOCAL-PRIVATE-BETA-READINESS-01-FIX-EXECUTION-KILLSWITCH-LOCAL`  
Then rerun this same local readiness smoke subset to confirm `/api/ai/execute` hard-blocks with 503.

---

## Exact files read

1. `C:\Users\knlee\aiSandBox2026B\TASKS.md` (targeted sections + search)
2. `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` (targeted sections + search)
3. `C:\Users\knlee\aiSandBox2026B\docs\AINOW-EXECUTION-ROADMAP.md` (targeted sections + search)
4. `C:\Users\knlee\aiSandBox2026B\docs\PRIVATE-BETA-STAGING-EXECUTION-PAUSE-CHECKPOINT.md`
5. `C:\Users\knlee\aiSandBox2026B\docs\PRIVATE-BETA-STAGING-EXECUTION-01-CHECKPOINT.md`
6. `C:\Users\knlee\aiSandBox2026B\docs\PRIVATE-BETA-STAGING-SETUP-CHECKPOINT.md`
7. `C:\Users\knlee\aiSandBox2026B\docs\LIMITED-PRIVATE-BETA-HANDOFF-CHECKLIST.md`
8. `C:\Users\knlee\aiSandBox2026B\docs\LIMITED-PRIVATE-BETA-HANDOFF-CHECKPOINT.md`
9. `C:\Users\knlee\aiSandBox2026B\docs\BETA-READY-SMOKE-CHECKPOINT.md`
10. `C:\Users\knlee\aiSandBox2026B\package.json`
11. `C:\Users\knlee\aiSandBox2026B\frontend\package.json`
12. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\package.json`
13. `C:\Users\knlee\aiSandBox2026B\services\ai-service\package.json`
14. `C:\Users\knlee\aiSandBox2026B\services\container-manager\package.json`
15. `C:\Users\knlee\aiSandBox2026B\docker-compose.yml`
16. `C:\Users\knlee\aiSandBox2026B\README.md`
17. `C:\Users\knlee\aiSandBox2026B\scripts\README.md`
18. `C:\Users\knlee\aiSandBox2026B\database\README.md`
19. `C:\Users\knlee\aiSandBox2026B\scripts\start-all.ps1`
20. `C:\Users\knlee\aiSandBox2026B\frontend\hooks\useUserAgents.ts`
21. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\auth\dto\auth.dto.ts`
22. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\auth\auth.controller.ts`
23. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\user-agent\dto\create-agent.dto.ts`
24. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\projects\dto\create-project.dto.ts`
25. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\projects\projects.controller.ts`
26. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\project-repo-docs\project-repo-docs.controller.ts`
27. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\project-repo-docs\dto\upsert-project-repo-docs.dto.ts`
28. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\safety\kill-switch.config.ts`
29. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\safety\execution-safety.guard.ts`
30. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\health\health.controller.ts`
31. `C:\Users\knlee\aiSandBox2026B\frontend\app\[locale]\page.tsx`
32. `C:\Users\knlee\aiSandBox2026B\frontend\components\public\public-landing-slice.tsx`
33. `C:\Users\knlee\aiSandBox2026B\frontend\components\platform\platform-dashboard.tsx`
34. `C:\Users\knlee\aiSandBox2026B\frontend\components\workspace\workspace-shell.tsx`
35. `C:\Users\knlee\aiSandBox2026B\frontend\lib\agent-platform\agent-registry.ts`
36. `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json` (targeted section)

## Exact commands run

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; node -v; npm -v
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker --version; docker compose version
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; Test-NetConnection -ComputerName localhost -Port 3002 -WarningAction SilentlyContinue | Select-Object ComputerName,RemotePort,TcpTestSucceeded; Test-NetConnection -ComputerName localhost -Port 4000 -WarningAction SilentlyContinue | Select-Object ComputerName,RemotePort,TcpTestSucceeded; Test-NetConnection -ComputerName localhost -Port 4001 -WarningAction SilentlyContinue | Select-Object ComputerName,RemotePort,TcpTestSucceeded; Test-NetConnection -ComputerName localhost -Port 4002 -WarningAction SilentlyContinue | Select-Object ComputerName,RemotePort,TcpTestSucceeded; Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue | Select-Object ComputerName,RemotePort,TcpTestSucceeded; Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue | Select-Object ComputerName,RemotePort,TcpTestSucceeded
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; $paths = @('C:\Users\knlee\aiSandBox2026B\.env','C:\Users\knlee\aiSandBox2026B\.env.local','C:\Users\knlee\aiSandBox2026B\.env.staging','C:\Users\knlee\aiSandBox2026B\.env.production','C:\Users\knlee\aiSandBox2026B\frontend\.env','C:\Users\knlee\aiSandBox2026B\frontend\.env.local','C:\Users\knlee\aiSandBox2026B\services\api-gateway\.env','C:\Users\knlee\aiSandBox2026B\services\ai-service\.env','C:\Users\knlee\aiSandBox2026B\services\container-manager\.env'); $paths | ForEach-Object { "$_`t$(Test-Path $_)" }
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run dev
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; Stop-Process -Id 4876 -Force
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; curl.exe -I --max-time 5 "http://localhost:3002/en"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; Stop-Process -Id 15108 -Force; Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run dev
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; $routes = @('http://localhost:3002/','http://localhost:3002/en','http://localhost:3002/en/login','http://localhost:3002/en/register','http://localhost:3002/en/dashboard','http://localhost:3002/en/platform','http://localhost:3002/en/app','http://localhost:3002/zh-TW/platform','http://localhost:3002/zh-CN/platform'); foreach ($url in $routes) { try { $resp = Invoke-WebRequest -Uri $url -MaximumRedirection 0 -TimeoutSec 8 -ErrorAction Stop; "URL=$url STATUS=$($resp.StatusCode)" } catch { if ($_.Exception.Response) { "URL=$url STATUS=$([int]$_.Exception.Response.StatusCode) LOCATION=$($_.Exception.Response.Headers.Location)" } else { "URL=$url ERROR=$($_.Exception.Message)" } } }
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; curl.exe -s -X GET "http://localhost:4000/api/health" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X GET "http://localhost:4000/api/health/db" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X GET "http://localhost:4000/api/health/ready" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X GET "http://localhost:4000/api/auth/me" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X GET "http://localhost:4000/api/agents" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X POST "http://localhost:4000/api/agents" -H "Content-Type: application/json" -d "{}" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X POST "http://localhost:4000/api/auth/register" -H "Content-Type: application/json" -d "{}" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X POST "http://localhost:4000/api/auth/login" -H "Content-Type: application/json" -d "{}" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X GET "http://localhost:4000/api/billing/balance" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X GET "http://localhost:4000/api/billing/subscription" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X POST "http://localhost:4000/api/billing/checkout/subscription" -H "Content-Type: application/json" -d "{}" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X POST "http://localhost:4000/api/billing/checkout/topup" -H "Content-Type: application/json" -d "{}" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X POST "http://localhost:4000/api/ai/execute" -H "Content-Type: application/json" -d "{}" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X POST "http://localhost:4000/api/v1/ai/execute" -H "Content-Type: application/json" -d "{}" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X GET "http://localhost:4002/api/health" -w " HTTP_STATUS:%{http_code}`n"; curl.exe -s -X GET "http://localhost:4001/health" -w " HTTP_STATUS:%{http_code}`n"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); $email = "localpb$ts@example.com"; $password = "LocalBeta123"; $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession; function Invoke-Test { param([string]$Method,[string]$Url,[object]$Payload=$null); try { if ($null -ne $Payload) { $json = $Payload | ConvertTo-Json -Compress; $resp = Invoke-WebRequest -Method $Method -Uri $Url -WebSession $session -ContentType 'application/json' -Body $json -TimeoutSec 10 -ErrorAction Stop; "URL=$Url STATUS=$($resp.StatusCode) BODY=$($resp.Content)" } else { $resp = Invoke-WebRequest -Method $Method -Uri $Url -WebSession $session -TimeoutSec 10 -ErrorAction Stop; "URL=$Url STATUS=$($resp.StatusCode) BODY=$($resp.Content)" } } catch { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode; $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $content = $reader.ReadToEnd(); "URL=$Url STATUS=$status BODY=$content" } else { "URL=$Url ERROR=$($_.Exception.Message)" } } }; "TEST_EMAIL=$email"; Invoke-Test -Method 'POST' -Url 'http://localhost:4000/api/auth/register' -Payload @{ email=$email; password=$password }; Invoke-Test -Method 'POST' -Url 'http://localhost:4000/api/auth/login' -Payload @{ email=$email; password=$password }; Invoke-Test -Method 'GET' -Url 'http://localhost:4000/api/auth/me'; Invoke-Test -Method 'GET' -Url 'http://localhost:4000/api/projects'; Invoke-Test -Method 'GET' -Url 'http://localhost:4000/api/workspaces'; Invoke-Test -Method 'GET' -Url 'http://localhost:4000/api/agents'; Invoke-Test -Method 'POST' -Url 'http://localhost:4000/api/agents' -Payload @{ name="Local Beta Agent $ts"; role='Validator'; description='Step2 local readiness smoke' }; Invoke-Test -Method 'GET' -Url 'http://localhost:4000/api/agents'; Invoke-Test -Method 'GET' -Url 'http://localhost:4000/api/projects/00000000-0000-0000-0000-000000000000/repo-docs'
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); $email = "localpbai$ts@example.com"; $password = "LocalBeta123"; $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession; function Invoke-Test { param([string]$Method,[string]$Url,[object]$Payload=$null); try { if ($null -ne $Payload) { $json = $Payload | ConvertTo-Json -Compress; $resp = Invoke-WebRequest -Method $Method -Uri $Url -WebSession $session -ContentType 'application/json' -Body $json -TimeoutSec 10 -ErrorAction Stop; "URL=$Url STATUS=$($resp.StatusCode) BODY=$($resp.Content)" } else { $resp = Invoke-WebRequest -Method $Method -Uri $Url -WebSession $session -TimeoutSec 10 -ErrorAction Stop; "URL=$Url STATUS=$($resp.StatusCode) BODY=$($resp.Content)" } } catch { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode; $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $content = $reader.ReadToEnd(); "URL=$Url STATUS=$status BODY=$content" } else { "URL=$Url ERROR=$($_.Exception.Message)" } } }; Invoke-Test -Method 'POST' -Url 'http://localhost:4000/api/auth/register' -Payload @{ email=$email; password=$password }; Invoke-Test -Method 'POST' -Url 'http://localhost:4000/api/auth/login' -Payload @{ email=$email; password=$password }; Invoke-Test -Method 'POST' -Url 'http://localhost:4000/api/ai/execute' -Payload @{}; Invoke-Test -Method 'POST' -Url 'http://localhost:4000/api/v1/ai/execute' -Payload @{}
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); $email = "localpbproj$ts@example.com"; $password = "LocalBeta123"; $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession; function Invoke-Req { param([string]$Method,[string]$Url,[object]$Payload=$null); try { if ($null -ne $Payload) { $json = $Payload | ConvertTo-Json -Compress; $resp = Invoke-WebRequest -Method $Method -Uri $Url -WebSession $session -ContentType 'application/json' -Body $json -TimeoutSec 10 -ErrorAction Stop; [PSCustomObject]@{ Url=$Url; Status=[int]$resp.StatusCode; Content=$resp.Content } } else { $resp = Invoke-WebRequest -Method $Method -Uri $Url -WebSession $session -TimeoutSec 10 -ErrorAction Stop; [PSCustomObject]@{ Url=$Url; Status=[int]$resp.StatusCode; Content=$resp.Content } } } catch { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode; $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $content = $reader.ReadToEnd(); [PSCustomObject]@{ Url=$Url; Status=$status; Content=$content } } else { [PSCustomObject]@{ Url=$Url; Status=-1; Content=$_.Exception.Message } } } }; $r1 = Invoke-Req -Method 'POST' -Url 'http://localhost:4000/api/auth/register' -Payload @{ email=$email; password=$password }; "URL=$($r1.Url) STATUS=$($r1.Status) BODY=$($r1.Content)"; $r2 = Invoke-Req -Method 'POST' -Url 'http://localhost:4000/api/auth/login' -Payload @{ email=$email; password=$password }; "URL=$($r2.Url) STATUS=$($r2.Status) BODY=$($r2.Content)"; $r3 = Invoke-Req -Method 'GET' -Url 'http://localhost:4000/api/workspaces'; "URL=$($r3.Url) STATUS=$($r3.Status) BODY=$($r3.Content)"; $workspaceId = $null; if ($r3.Status -eq 200) { $workspaces = $r3.Content | ConvertFrom-Json; if ($workspaces.Count -gt 0) { $workspaceId = $workspaces[0].id } }; "WORKSPACE_ID=$workspaceId"; $r4 = Invoke-Req -Method 'POST' -Url 'http://localhost:4000/api/projects' -Payload @{ name="Local PB Project $ts"; workspaceId=$workspaceId }; "URL=$($r4.Url) STATUS=$($r4.Status) BODY=$($r4.Content)"; $projectId = $null; if ($r4.Status -eq 201) { $projectId = ($r4.Content | ConvertFrom-Json).id }; "PROJECT_ID=$projectId"; if ($projectId) { $r5 = Invoke-Req -Method 'GET' -Url "http://localhost:4000/api/projects/$projectId/repo-docs"; "URL=$($r5.Url) STATUS=$($r5.Status) BODY=$($r5.Content)"; $r6 = Invoke-Req -Method 'PUT' -Url "http://localhost:4000/api/projects/$projectId/repo-docs" -Payload @{ docs=@(@{ path='README.md'; mode='always' }) }; "URL=$($r6.Url) STATUS=$($r6.Status) BODY=$($r6.Content)"; $r7 = Invoke-Req -Method 'GET' -Url "http://localhost:4000/api/projects/$projectId/repo-docs"; "URL=$($r7.Url) STATUS=$($r7.Status) BODY=$($r7.Content)"; $r8 = Invoke-Req -Method 'POST' -Url "http://localhost:4000/api/projects/$projectId/sessions/11111111-1111-1111-1111-111111111111"; "URL=$($r8.Url) STATUS=$($r8.Status) BODY=$($r8.Content)" }
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; foreach ($p in @(19164,12488)) { if (Get-Process -Id $p -ErrorAction SilentlyContinue) { Stop-Process -Id $p -Force } }; $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(3002,4000) }; foreach ($l in $listeners) { if (Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue) { Stop-Process -Id $l.OwningProcess -Force } }; "CLEANUP_DONE"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; Test-NetConnection -ComputerName localhost -Port 3002 -WarningAction SilentlyContinue | Select-Object ComputerName,RemotePort,TcpTestSucceeded; Test-NetConnection -ComputerName localhost -Port 4000 -WarningAction SilentlyContinue | Select-Object ComputerName,RemotePort,TcpTestSucceeded; Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue | Select-Object ComputerName,RemotePort,TcpTestSucceeded; Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue | Select-Object ComputerName,RemotePort,TcpTestSucceeded
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; git status --short
```

---

Report end.
