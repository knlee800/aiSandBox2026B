# Smoke Pack — Quick Reference

**Phase 33A: Release Candidate Validation**

---

## What is the Smoke Pack?

A minimal, deterministic set of checks that validate a deployable system in < 2 minutes.

Validates:
- Infrastructure (PostgreSQL, api-gateway, ai-service)
- Startup guards (Phase 32A validators)
- Authentication & authorization
- End-to-end execution (real provider)
- Billing visibility (read-only)

---

## Quick Start

### Option 1: PowerShell Script (Recommended)

```powershell
cd services/api-gateway
.\scripts\smoke-test.ps1
```

**Output:** Color-coded pass/fail with summary

---

### Option 2: Jest Integration Tests

```bash
cd services/api-gateway
npm run test:smoke
```

**Output:** Jest test results with detailed assertions

---

### Option 3: Manual Commands

See `docs/SMOKE-PACK.md` for copy-pasteable PowerShell commands.

---

## Prerequisites

Before running smoke tests:

1. **PostgreSQL running:**
   ```powershell
   docker run -d --name postgres-aisandbox -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aisandbox -p 5432:5432 postgres:15
   ```

2. **Database migrated:**
   ```bash
   cd services/api-gateway
   npm run migration:run
   ```

3. **api-gateway running:**
   ```bash
   cd services/api-gateway
   npm run dev
   ```

4. **ai-service running:**
   ```bash
   cd services/ai-service
   npm run dev
   ```

5. **Environment configured:**
   - api-gateway `.env`: `AI_PROVIDER`, `DATABASE_URL`, `LAUNCH_STATE`, `ABORT_MODE`
   - Google OAuth (AUTH-APP-01D): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `OAUTH_STATE_SECRET`
   - Apple OAuth (AUTH-APP-01E): `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CALLBACK_URL`
   - ai-service `.env`: Provider API key (e.g., `XAI_API_KEY`)
   - Apple OAuth notes:
     - `APPLE_CLIENT_ID` must be the Apple Services ID, not the app Bundle ID.
     - `APPLE_PRIVATE_KEY` should contain the full `.p8` PEM content with newlines serialized as `\n`.
     - `APPLE_CALLBACK_URL` must exactly match the Return URL configured in the Apple Developer Portal.
     - `OAUTH_STATE_SECRET` from the Google OAuth state handling is reused for Apple OAuth state.

6. **Valid API key in database:**
   ```sql
   INSERT INTO api_keys (id, key_hash, user_id, scopes, created_at, is_active)
   VALUES (
     gen_random_uuid(),
     crypt('valid-api-key', gen_salt('bf')),
     'test-user',
     ARRAY['ai:execute'],
     NOW(),
     true
   );
   ```

---

## Expected Results

### ✅ All Tests Pass

```
✓ PostgreSQL connection
✓ Health endpoint
✓ Readiness check
✓ Database check
✓ AI execution
✓ Billing snapshots
✓ Billing summary

Passed: 7
Failed: 0
Duration: 8.5 seconds

✓ All smoke tests passed!
✓ System is ready for deployment.
```

### ❌ Some Tests Fail

Review failure messages and check:
- Services running on correct ports
- Environment variables configured
- Provider API key valid
- Database migrations applied

---

## Validation Coverage

| Layer | What's Validated |
|-------|------------------|
| Infrastructure | PostgreSQL, api-gateway, ai-service running |
| Startup | Phase 32A validators (provider config, guardrails) |
| Auth | API key validation, identity resolution |
| Safety | Launch state, abort mode, kill switches, limits |
| Quota | Request count, token usage quotas |
| Execution | Provider routing, adapter selection, real API call |
| Usage | Ledger write, safety limit tracking |
| Billing | Snapshot queries, time window filtering |

---

## When to Run

✅ **Run smoke pack:**
- Before deployment (release candidate validation)
- After configuration changes
- After dependency updates
- After database migrations
- After environment changes

❌ **Don't run smoke pack:**
- In CI/CD (requires real provider API keys)
- In production (use monitoring instead)
- Continuously (quota limits apply)

---

## Troubleshooting

### PostgreSQL Connection Failed
```
✗ PostgreSQL connection
  psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed
```

**Fix:** Start PostgreSQL container (see Prerequisites)

---

### api-gateway Not Running
```
✗ Health endpoint
  Unable to connect to the remote server
```

**Fix:** Start api-gateway with `npm run dev`

---

### Stub Provider Active
```
✗ AI execution
  Stub provider active (AI_PROVIDER not configured)
```

**Fix:** Set `AI_PROVIDER` in api-gateway `.env` and restart

---

### Authentication Failed
```
✗ AI execution
  Authentication failed (401) - Check API key
```

**Fix:** Insert valid API key in database (see Prerequisites)

---

## Files

| File | Purpose |
|------|---------|
| `docs/SMOKE-PACK.md` | Full documentation with all commands |
| `docs/SMOKE-PACK-README.md` | This quick reference |
| `scripts/smoke-test.ps1` | PowerShell automation script |
| `src/__tests__/smoke.integration.spec.ts` | Jest integration tests |
| `package.json` | npm scripts: `test:smoke`, `smoke` |

---

## Next Steps

After smoke tests pass:
1. Review logs for warnings
2. Check quota state in database
3. Verify usage ledger entries
4. Proceed with deployment

---

**Phase 33A — Release Candidate Smoke Pack**  
**Status:** Ready for use  
**Execution Time:** < 2 minutes  
**Deterministic:** Yes
