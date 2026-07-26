# PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION-REPORT

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION
**Step:** 2 — Source/Config Decision Report
**Date created:** 2026-07-26
**Nature:** Decision report only — source/config analysis — no server action — no source files changed — no governance files changed — no env files opened/created/edited — no secrets disclosed — no subagents used.

---

## Section 1 — Task Identity

| Field | Value |
|-------|-------|
| Report task ID | PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION |
| Step | 2 — Source/Config Decision Report |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04B — Private Env Preparation |
| Grandparent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Blocker | GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not available — 04B stop condition triggered |
| Purpose | Determine whether real Google OAuth credentials are required for 04B completion |
| Date | 2026-07-26 |

---

## Section 2 — Purpose

This report exists to resolve a specific blocker in PRIVATE-BETA-STAGING-EXECUTION-04B (Private Env Preparation). The 04B runbook (Section 11F) classifies `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as `Yes — SECRET` (required), which triggered stop condition #8 because Keith does not currently hold these values.

This report answers, through source code and startup configuration analysis only, whether the API Gateway requires these values at startup or whether Google OAuth can be safely deferred for private beta staging.

**Scope boundary:** Source/config analysis only. No server action. No env files opened or created. No secrets disclosed. No subagents used.

---

## Section 3 — Current Blocker

| Item | State |
|------|-------|
| PRIVATE-BETA-STAGING-EXECUTION-04B status | ACTIVE / PAUSED |
| Paused reason | Keith does not have GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET |
| 04B runbook classification | Section 11F — "Yes — SECRET" — From Google Cloud Console |
| Stop condition triggered | #8 — "Keith does not have a required secret value" |
| Effect | Manual .env creation paused before evidence collection |
| Blocker-resolution task | PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION — ACTIVE |

---

## Section 4 — Files Reviewed

| File | Purpose |
|------|---------|
| `TASKS.md` | Active task status — confirmed blocker registration |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-PRIVATE-ENV-PREPARATION-RUNBOOK.md` | 04B runbook — identified the stop condition and Google OAuth classification |
| `services/api-gateway/src/auth/google.strategy.ts` | GoogleStrategy implementation — conditional loading logic |
| `services/api-gateway/src/auth/auth.module.ts` | AuthModule — googleStrategyProvider factory — conditional registration |
| `services/api-gateway/src/auth/auth.controller.ts` | AuthController — Google OAuth endpoints — strategy registration check |
| `services/api-gateway/src/auth/auth.service.ts` | AuthService — email/password login and registration implementation |
| `services/api-gateway/src/main.ts` | API Gateway bootstrap — startup sequence — no Google OAuth checks |
| `services/api-gateway/src/app.module.ts` | AppModule — module imports — StartupModule sequence |
| `services/api-gateway/src/startup/startup-guard.service.ts` | StartupGuardService — all 25+ startup checks — what fails at startup |
| `services/api-gateway/src/startup/environment.validator.ts` | EnvironmentValidator — NODE_ENV validation |
| `services/api-gateway/src/startup/configuration.validator.ts` | ConfigurationValidator — required env variables at startup |
| `services/api-gateway/src/startup/provider.validator.ts` | ProviderValidator — AI_PROVIDER validation |
| `services/api-gateway/src/startup/production-guardrails.validator.ts` | ProductionGuardrailsValidator — staging/production requirements |
| `services/api-gateway/src/launch/launch.config.ts` | LaunchConfig — LAUNCH_STATE validation |
| `services/api-gateway/src/config/database.config.ts` | Database config — DATABASE_URL handling |

---

## Section 5 — Search Terms Used

Searched source code for:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `GoogleStrategy`
- `passport-google`
- `hasGoogleOAuthConfig`
- `googleStrategyProvider`
- `isPassportStrategyRegistered`
- `validateRequiredVariables`
- `getRequiredVariables`
- `required: true`
- `register` / `login` / `email` / `password`
- `validateProviderConfiguration`
- `validateAll`
- `process.exit(1)`

---

## Section 6 — Google OAuth Env Keys Found

| Key name | File | Usage |
|----------|------|-------|
| `GOOGLE_CLIENT_ID` | `services/api-gateway/src/auth/google.strategy.ts` | Read by `hasGoogleOAuthConfig()` and `getRequiredGoogleEnv()` |
| `GOOGLE_CLIENT_SECRET` | `services/api-gateway/src/auth/google.strategy.ts` | Read by `hasGoogleOAuthConfig()` and `getRequiredGoogleEnv()` |
| `GOOGLE_CALLBACK_URL` | `services/api-gateway/src/auth/google.strategy.ts` | Read by `hasGoogleOAuthConfig()` and `getRequiredGoogleEnv()` |

**Startup validator finding:** None of these three keys appear in `ConfigurationValidator.getRequiredVariables()`, `ProductionGuardrailsValidator`, `ProviderValidator`, or `StartupGuardService`. They are not in any startup fail-fast check list.

---

## Section 7 — Google OAuth Implementation Summary

### `google.strategy.ts`

```
REQUIRED_GOOGLE_ENV_VARS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL']

hasGoogleOAuthConfig(): boolean
  → returns true only if ALL three values are present and non-empty (trim check)
  → returns false if any one is absent or empty

getRequiredGoogleEnv(name): string
  → throws new Error('Google OAuth disabled: missing Google env configuration')
    IF the value is absent or empty
  → this throw is only reached if GoogleStrategy constructor is invoked

GoogleStrategy constructor
  → calls super({ clientID: getRequiredGoogleEnv('GOOGLE_CLIENT_ID'), ... })
  → the constructor ONLY runs if explicitly instantiated
```

### `auth.module.ts`

```
googleStrategyProvider = {
  provide: GoogleStrategy,
  inject: [AuthService],
  useFactory: (authService: AuthService) => {
    if (!hasGoogleOAuthConfig()) {
      Logger.warn('Google OAuth disabled: missing Google env configuration', 'AuthModule');
      return null;  // ← null returned — no crash — strategy simply not registered
    }
    return new GoogleStrategy(authService);  // ← only reached if all three vars present
  },
};
```

**Key finding:** The `googleStrategyProvider` is a NestJS factory provider. When `hasGoogleOAuthConfig()` returns false (any of the three env vars absent), the factory returns `null`. NestJS accepts `null` as a valid factory return — it means the provider resolves to null and the strategy is simply not registered with Passport. No exception is thrown. No startup crash occurs.

### `auth.controller.ts`

```
@Get('auth/google')
async googleAuth(...) {
  if (!this.isPassportStrategyRegistered('google')) {
    response.redirect('/en/login?error=oauth_failed');  // ← graceful redirect
    return;
  }
  // Only reaches Passport authenticate if strategy is registered
}

@Get('auth/google/callback')
async googleCallback(...) {
  if (!this.isPassportStrategyRegistered('google')) {
    response.redirect('/en/login?error=oauth_failed');  // ← graceful redirect
    return;
  }
  // Only reaches Passport authenticate if strategy is registered
}
```

**Key finding:** The Google OAuth endpoints are always declared in the controller, but both check `isPassportStrategyRegistered('google')` before doing any OAuth work. If the strategy is not registered (because env vars were absent), they redirect to the login page with `error=oauth_failed`. No 500. No crash. No blocked startup.

---

## Section 8 — Startup / Config Validation Analysis

### ConfigurationValidator.getRequiredVariables()

The following are the only variables in the startup required list:

| Key name | Required | Environments |
|----------|----------|--------------|
| `NODE_ENV` | always | development, staging, production |
| `PORT` | always | development, staging, production |
| `DATABASE_URL` | always | development, staging, production |
| `ANTHROPIC_API_KEY` | staging and production only | staging, production |
| `OPENAI_API_KEY` | staging and production only | staging, production |

**`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` are NOT in this list.**

Absence of any Google OAuth key causes no startup config validation failure.

### StartupGuardService — 6-phase startup check

| Phase | What it checks | Google OAuth involved? |
|-------|---------------|----------------------|
| Phase 1 | NODE_ENV, working directory | No |
| Phase 2 | ConfigurationValidator.validateAll() → required vars, kill switches, safety limits, launch state, abort mode | No |
| Phase 2 | ProviderValidator.validateProviderConfiguration() | No (AI provider only) |
| Phase 2 | ProductionGuardrailsValidator.validateAll() | No |
| Phase 3 | Database connectivity, table existence | No |
| Phase 4 | Redis config (warn only), provider key format (warn only) | No |
| Phase 5 | NestJS module load confirmation | No (Google strategy is null — not a crash) |
| Phase 6 | KillSwitchConfig, GlobalSafetyLimits, LaunchConfig, AbortConfig | No |

**Finding: No phase of the 6-phase startup check validates or requires Google OAuth env keys. Startup proceeds normally without them.**

---

## Section 9 — Auth Flow Analysis

### Routes defined in `auth.controller.ts`

| Route | Method | Google OAuth dependency |
|-------|--------|----------------------|
| `POST /api/auth/register` | Email/password | None |
| `POST /api/auth/login` | Email/password | None |
| `GET /api/auth/email/verify` | Token-based | None |
| `POST /api/auth/email/verify/resend` | Email | None |
| `POST /api/auth/password-reset/request` | Email | None |
| `POST /api/auth/password-reset/confirm` | Token-based | None |
| `GET /api/auth/google` | Google OAuth | Checks registration first; redirects if not registered |
| `GET /api/auth/google/callback` | Google OAuth | Checks registration first; redirects if not registered |
| `GET /api/auth/apple` | Apple OAuth | Checks registration first; redirects if not registered |
| `POST /api/auth/apple/callback` | Apple OAuth | Checks registration first; redirects if not registered |
| `GET /api/auth/me` | Session | None |
| `POST /api/auth/logout` | Session | None |

All non-Google auth routes function independently of Google OAuth configuration. The Google OAuth routes degrade gracefully.

---

## Section 10 — Email/Password Availability

### `auth.service.ts` — register()

```typescript
async register(email: string, password: string, locale = 'en') {
  const existingUser = await this.userRepository.findOne({ where: { email } });
  if (existingUser) throw new UnauthorizedException('User already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = this.userRepository.create({ email, passwordHash, authProvider: 'email', ... });
  const savedUser = await this.userRepository.save(user);
  // Sends verification email
  return { id, email, role, plan_type };
}
```

### `auth.service.ts` — login()

```typescript
async login(email: string, password: string, lang: string = 'en') {
  const user = await this.validateUser(email, password, lang);
  const sessionToken = await this.createSession(user.id);
  return { sessionToken, user: { id, email, role, plan_type } };
}
```

Both registration and login functions are fully implemented with no dependency on Google OAuth. They operate exclusively through the PostgreSQL database and email delivery.

**Finding: Email/password registration and login are fully available and independent of Google OAuth.**

Note on verification email: `register()` calls `sendVerificationEmail()`, which requires `APP_BASE_URL` (present in 04B runbook) and the email provider. The 04B runbook sets `EMAIL_PROVIDER=stub`, which means no real email is sent. In private beta staging with stub email mode, Keith can register directly and confirm email verification via a direct database update or admin action.

---

## Section 11 — Whether Google OAuth is Required at Startup

**Finding: NO — Google OAuth is NOT required at startup.**

Evidence chain:
1. `hasGoogleOAuthConfig()` in `google.strategy.ts` returns `false` when any of the three env vars is absent or empty.
2. `googleStrategyProvider` factory in `auth.module.ts` checks `hasGoogleOAuthConfig()` first. If false, returns `null` — no crash, no exception.
3. No startup validator (`ConfigurationValidator`, `ProviderValidator`, `ProductionGuardrailsValidator`, `StartupGuardService`) includes Google OAuth keys in any required check.
4. `GoogleStrategy` constructor (the only place `getRequiredGoogleEnv()` is called) is never invoked if the factory returns `null`.

**Conclusion: Omitting GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL from .env does not cause API Gateway startup failure.**

---

## Section 12 — Whether Google OAuth is Required for Private Beta Login

**Finding: NO — Google OAuth is NOT required for private beta login.**

Evidence:
1. `POST /api/auth/register` and `POST /api/auth/login` are fully independent of Google OAuth.
2. `AuthService.register()` and `AuthService.login()` have no Google OAuth dependency.
3. Private beta staging requires only one or a small number of known users. Keith can create a test account via email/password registration.
4. Email verification flow uses `EMAIL_PROVIDER=stub` on staging — no real email is sent — Keith can mark a test account as verified directly if needed.
5. Google OAuth is additive (additional login method) — email/password auth is sufficient for private beta validation.

---

## Section 13 — Whether Placeholder Values are Safe

**Finding: Omission is SAFER than placeholder values for Google OAuth keys.**

Analysis:
- `hasGoogleOAuthConfig()` checks `Boolean(value?.trim())` — any non-empty string returns `true`.
- If a non-empty placeholder is set (e.g., `GOOGLE_CLIENT_ID=placeholder-not-real`), the factory would return `new GoogleStrategy(authService)`.
- The `GoogleStrategy` constructor would be called with fake credentials and would NOT crash at initialization — `passport-google-oauth20` accepts the config and only calls Google at runtime.
- At runtime, when a user tries `/api/auth/google`, the redirect to Google's OAuth endpoint would begin — and Google would reject the fake credentials at the network level (invalid client error), degrading to a runtime failure instead of a graceful redirect.
- With omission (empty or absent keys), `hasGoogleOAuthConfig()` returns `false`, the strategy is not registered, and the controller gracefully redirects to `/login?error=oauth_failed`. This is the intended design.

**Recommendation: Omit GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL from .env entirely. Do not use placeholder values.**

---

## Section 14 — Whether Keys Can Be Omitted

**Finding: YES — GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL can be safely omitted from /opt/aisandbox/.env.**

The source explicitly supports this pattern. The `hasGoogleOAuthConfig()` function and the factory pattern in `auth.module.ts` are precisely the design mechanism for conditional Google OAuth — when these keys are absent, Google OAuth is disabled gracefully without affecting any other functionality.

This is not an override or a hack — it is the intended behavior.

---

## Section 15 — Decision Outcome

### **OUTCOME B — Google OAuth can be deferred.**

The source analysis clearly proves that:
- `GOOGLE_CLIENT_ID` is NOT required at startup.
- `GOOGLE_CLIENT_SECRET` is NOT required at startup.
- `GOOGLE_CALLBACK_URL` is NOT required at startup.
- No startup config validator checks for these keys.
- The strategy loading is conditionally gated by `hasGoogleOAuthConfig()`.
- Absence causes graceful warning + null strategy — no crash.
- Email/password auth is fully available and sufficient for private beta staging.

**Google OAuth deferred: Yes**
**GOOGLE_CLIENT_ID omitted intentionally: Yes**
**GOOGLE_CLIENT_SECRET omitted intentionally: Yes**
**GOOGLE_CALLBACK_URL omitted intentionally: Yes**
**No fake production credentials generated: Confirmed**
**Non-secret placeholder values used: No — omission is safer**

---

## Section 16 — Recommended 04B Runbook Amendment

The following amendment to `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-PRIVATE-ENV-PREPARATION-RUNBOOK.md` is required. This amendment must be performed in Step 3 (not in this step).

### Section 11F Amendment

Current (04B runbook Section 11F):

| Key name | Required for staging? | Notes |
|----------|----------------------|-------|
| `GOOGLE_CLIENT_ID` | Yes — SECRET | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes — SECRET | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | Yes | `https://staging.ainow.biz/api/auth/google/callback` |

Amended (after Step 3 runbook update):

| Key name | Required for staging? | Notes |
|----------|----------------------|-------|
| `GOOGLE_CLIENT_ID` | **Deferred / Conditional** | Omit from .env — API Gateway starts without it — Google OAuth disabled gracefully — Register with Google Cloud Console before public launch |
| `GOOGLE_CLIENT_SECRET` | **Deferred / Conditional** | Omit from .env — same reason as above |
| `GOOGLE_CALLBACK_URL` | **Deferred / Conditional** | Omit from .env — not needed when strategy is disabled |

### Section 14 Key-Presence Validation Script Amendment

Remove `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` from the `required_keys` list in the Python presence-check script. Move them to `optional_keys` (or a new `deferred_keys` list) with a comment explaining they are intentionally omitted pending Google Cloud Console setup.

### Section 22 Stop Condition Amendment

Stop condition #8 currently reads:
> Keith does not have a required secret value (DB password, Redis password, Google OAuth credentials)

Should be amended to:
> Keith does not have a required secret value (DB password, Redis password) — Google OAuth credentials are deferred

### Evidence Template Amendment (Section 21)

Remove the mandatory confirmation lines for Google OAuth:

```
GOOGLE_CLIENT_ID configured privately (key present, value not disclosed): [Yes/No]
GOOGLE_CLIENT_SECRET configured privately (key present, value not disclosed): [Yes/No]
```

Replace with:

```
GOOGLE_CLIENT_ID intentionally omitted (deferred pending Google Cloud Console setup): [Yes/No]
GOOGLE_CLIENT_SECRET intentionally omitted (deferred pending Google Cloud Console setup): [Yes/No]
GOOGLE_CALLBACK_URL intentionally omitted (deferred): [Yes/No]
```

---

## Section 17 — Manual Google Cloud Console Setup Steps

Not applicable — Outcome B selected. Google Cloud Console setup is deferred.

When Keith is ready to enable Google OAuth (before public launch or when explicit testing of Google sign-in is required), Keith will need to:
1. Create or use an existing Google Cloud Console project.
2. Enable the Google+ API or Google Identity service.
3. Create OAuth 2.0 Client ID credentials.
4. Add the authorized redirect URI: `https://staging.ainow.biz/api/auth/google/callback`
5. Obtain the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` values privately.
6. Add them to `/opt/aisandbox/.env` on the VPS.
7. Restart the API Gateway service (PM2 restart) to pick up new values.

Do not paste Google credentials into AI chat at any time.

---

## Section 18 — Secret Safety Rules

| # | Rule |
|---|------|
| 1 | GOOGLE_CLIENT_ID was not printed, requested, or disclosed during this analysis |
| 2 | GOOGLE_CLIENT_SECRET was not printed, requested, or disclosed during this analysis |
| 3 | No .env file was opened, created, or edited |
| 4 | No env values were read or printed |
| 5 | No server, SSH, AWS, DNS, or TLS action was performed |
| 6 | No Docker, PostgreSQL, or Redis action was performed locally |
| 7 | This report contains only source code findings and key names — never values |
| 8 | Keith must not paste Google OAuth credentials into any AI chat when they are obtained |
| 9 | Google credentials, when obtained, must be entered directly in the Lightsail browser SSH console |

---

## Section 19 — Stop Conditions

No stop conditions were triggered during this analysis.

All reviewed source files were accessible and unambiguous. The conditional loading pattern in `auth.module.ts` and `google.strategy.ts` is explicit and deterministic. No inference was required.

---

## Section 20 — Exact Next Action

### Immediate next action

**Step 3 of PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION:**

Amend the 04B runbook as described in Section 16. Specifically:
1. Update Section 11F of `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-PRIVATE-ENV-PREPARATION-RUNBOOK.md` — move Google OAuth keys from Required to Deferred/Conditional.
2. Update the key-presence validation script in Section 14 — move Google OAuth keys to optional/deferred.
3. Update stop condition #8 in Section 22.
4. Update the evidence template in Section 21.
5. Update TASKS.md and TASKS_BACKLOG_FULL.md to reflect Google OAuth decision confirmed — Outcome B.

**After Step 3:**

**Step 3 of PRIVATE-BETA-STAGING-EXECUTION-04B** (Keith manual execution):
- Keith resumes 04B manual execution with the amended runbook.
- Omit GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL from `/opt/aisandbox/.env`.
- The presence-check script will not flag them as MISSING.
- Submit the evidence report per the amended Section 21 template.

**After Keith submits evidence:**

**Step 4 of PRIVATE-BETA-STAGING-EXECUTION-04B** — Consolidation/checkpoint.

---

## Section 21 — Additional Observation (Non-Scope — Do Not Act On In This Step)

During source analysis, an additional startup issue was identified that is **outside the scope of this Google OAuth decision report** and must NOT be acted upon in this step. It is documented here for transparency so it can be registered as a separate task before EXECUTION-04D.

**Observation:** `provider.validator.ts` (Phase 32A) explicitly rejects `AI_PROVIDER=stub` in staging and production environments at startup (exits with code 1). The 04B runbook currently recommends `AI_PROVIDER=stub` for staging. Additionally, `configuration.validator.ts` requires `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` to be present (non-empty) when `NODE_ENV=production` or `NODE_ENV=staging`.

This means the staging `.env` configuration recommended in the 04B runbook (`AI_PROVIDER=stub` + `NODE_ENV=production`) would cause a startup failure in EXECUTION-04D when app services are started — not in 04B (which is only `.env` preparation).

**This is not a blocker for 04B.** The `.env` file can still be created in 04B as designed. The `AI_PROVIDER` issue must be analyzed and resolved before EXECUTION-04C/04D. A separate source-analysis task should be registered before 04C begins to determine the correct AI provider posture for private beta staging.

Do NOT modify the 04B runbook AI provider guidance in Step 3 of the Google OAuth decision task. Register the AI provider issue as a new task after 04B-GOOGLE-OAUTH-DECISION is closed.

---

**Report created:** 2026-07-26
**Task:** PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION — Step 2
**Nature:** Decision report only — source/config analysis — no server action performed — no source files changed — no governance files changed — no env files opened/created/edited — no env values opened/printed — no AWS/SSH/DNS/TLS action — no Docker/PostgreSQL/Redis action locally — no git commit or push — no subagents used.
