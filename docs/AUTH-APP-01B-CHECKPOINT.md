# AUTH-APP-01B Checkpoint — Database / Schema Migrations

**Task:** AUTH-APP-01B — Database / Schema Migrations
**Status:** COMPLETE and LOCKED
**Date:** 2026-05-06
**Depends on:** AUTH-APP-01A (COMPLETE and LOCKED)

---

## Scope Completed

All schema and entity work required to support multi-provider OAuth, HTTP-only cookie sessions, email verification, and password reset — without implementing any of those behaviors yet.

---

## Files Changed

| File | Action |
|---|---|
| `services/api-gateway/src/migrations/1771700000000-AddAuthSchemaFoundation.ts` | Created — full auth schema migration |
| `services/api-gateway/src/entities/oauth-account.entity.ts` | Created — `OauthAccount` TypeORM entity |
| `services/api-gateway/src/entities/verification-token.entity.ts` | Created — `VerificationToken` TypeORM entity |
| `services/api-gateway/src/entities/auth-session.entity.ts` | Created — `AuthSession` TypeORM entity |
| `services/api-gateway/src/entities/user.entity.ts` | Edited — legacy comments on `authProvider`/`oauthId`; added `oauthAccounts` OneToMany |
| `services/api-gateway/src/auth/auth.module.ts` | Edited — added three new entities to `TypeOrmModule.forFeature` |
| `docs/AUTH-APP-01B-CHECKPOINT.md` | Created — this checkpoint |
| `TASKS.md` | Updated — AUTH-APP-01B marked COMPLETE; family status and current stage updated |
| `TASKS_BACKLOG_FULL.md` | Updated — AUTH-APP-01B marked COMPLETE; implementation summary and validation recorded |

**No frontend files changed. No `package.json` changed. No auth controller or auth service behavior changed. No dependencies installed.**

---

## Database Schema Changes

### Migration: `1771700000000-AddAuthSchemaFoundation.ts`

**`users` table amendments:**

```sql
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" character varying(50) NOT NULL DEFAULT 'email';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oauth_id" character varying(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" character varying(255);
```

Note: `auth_provider`, `oauth_id`, `last_login_at`, `stripe_customer_id` were already declared in `user.entity.ts` but absent from all prior migrations. This migration resolves that pre-existing drift. The `auth_provider` and `oauth_id` columns are legacy/single-provider fields; `oauth_accounts` is the authoritative multi-provider record going forward.

**New tables:**

`oauth_accounts`:
- `id` uuid PK
- `user_id` uuid FK → users(id) ON DELETE CASCADE
- `provider` varchar(50) NOT NULL
- `provider_account_id` varchar(255) NOT NULL
- `provider_email` varchar(255) nullable
- `created_at` TIMESTAMP NOT NULL DEFAULT now()
- UNIQUE: (`provider`, `provider_account_id`)
- INDEX: `idx_oauth_accounts_user_id` on (`user_id`)

`verification_tokens`:
- `id` uuid PK
- `user_id` uuid FK → users(id) ON DELETE CASCADE
- `token_hash` varchar(255) NOT NULL
- `type` varchar(50) NOT NULL (`'email_verify'` | `'password_reset'`)
- `expires_at` TIMESTAMP NOT NULL
- `used_at` TIMESTAMP nullable
- `created_at` TIMESTAMP NOT NULL DEFAULT now()
- UNIQUE: (`token_hash`)
- INDEX: `idx_verification_tokens_user_id_type` on (`user_id`, `type`)

`auth_sessions`:
- `id` uuid PK
- `user_id` uuid FK → users(id) ON DELETE CASCADE
- `session_token_hash` varchar(255) NOT NULL
- `expires_at` TIMESTAMP NOT NULL
- `last_active_at` TIMESTAMP NOT NULL DEFAULT now()
- `revoked_at` TIMESTAMP nullable
- `created_at` TIMESTAMP NOT NULL DEFAULT now()
- UNIQUE: (`session_token_hash`)
- INDEX: `idx_auth_sessions_user_id` on (`user_id`)
- INDEX: `idx_auth_sessions_expires_at` on (`expires_at`)

**Down migration:** Drops `auth_sessions`, `verification_tokens`, `oauth_accounts` in that order. Drops added `users` columns. Includes a safety guard before restoring `password_hash NOT NULL` — aborts with exception if any null values exist.

---

## Entity / Module Changes

**`OauthAccount` entity** (`src/entities/oauth-account.entity.ts`):
- Maps `oauth_accounts` table
- `@ManyToOne` to `User` via `user_id`
- Composite unique index `uq_oauth_accounts_provider_provider_account_id` on `(provider, providerAccountId)`
- Index `idx_oauth_accounts_user_id` on `userId`

**`VerificationToken` entity** (`src/entities/verification-token.entity.ts`):
- Maps `verification_tokens` table
- `@ManyToOne` to `User` via `user_id`
- Unique index on `tokenHash`; composite index on `(userId, type)`

**`AuthSession` entity** (`src/entities/auth-session.entity.ts`):
- Maps `auth_sessions` table
- `@ManyToOne` to `User` via `user_id`
- Unique index on `sessionTokenHash`; indexes on `userId` and `expiresAt`

**`User` entity updates** (`src/entities/user.entity.ts`):
- Added JSDoc comment on `authProvider`: marked as legacy single-provider field; `oauth_accounts` is authoritative
- Added JSDoc comment on `oauthId`: marked as legacy single-provider field; `oauth_accounts` is authoritative
- Added `oauthAccounts: OauthAccount[]` with `@OneToMany(() => OauthAccount, (o) => o.user)`
- No fields removed; no behavior changed

**`AuthModule` update** (`src/auth/auth.module.ts`):
- Added `OauthAccount`, `VerificationToken`, `AuthSession` to `TypeOrmModule.forFeature([...])`

---

## Validation Results

| Command | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | **PASS** | Clean compile; no type errors |
| `npm test` | **FAIL** | Pre-existing environment issue: `REDIS_URL environment variable is not set` during test bootstrap. 10 suites fail, 72 pass. Not introduced by this slice. |
| `npm run lint` | **FAIL** | Pre-existing tooling issue: ESLint config not discoverable by the package lint script. Not introduced by this slice. |

**Scope confirmation:**
- No frontend files changed
- No `package.json` changed
- No auth controller or auth service behavior changed
- No OAuth strategies added
- No session middleware added
- No email sending added
- No rate limiting added
- No npm dependencies installed

---

## Carry-Forward Risks to AUTH-APP-01C

| Risk | Severity | Required action |
|---|---|---|
| `npm test` blocked by missing `REDIS_URL` in test environment | MEDIUM | Resolve test env setup before AUTH-APP-01C validation can be trusted |
| `npm run lint` not runnable (ESLint config not found) | MEDIUM | Resolve ESLint config/script issue before lint validation can be trusted |
| No transactional email provider configured | HIGH | Must choose provider (Resend, SendGrid, or SES) and add API key to env **before AUTH-APP-01C stage-start** if email verification / password reset is in scope for AUTH-APP-01C |

---

## Next Slice

**AUTH-APP-01C — Token Storage & Email Auth Hardening**

Must be registered before starting. Key deliverables:
- Replace frontend `localStorage` JWT with HTTP-only cookie session
- Implement session middleware using the `auth_sessions` table
- Implement session creation on login / revocation on logout
- Email verification flow (requires transactional email provider — not yet configured)
- Password reset flow
- Rate limiting on auth endpoints

**AUTH-APP-01C split decision** at stage-start: if HTTP-only cookie/session migration and email auth hardening is too large for one slice, split into:
- AUTH-APP-01C1 — HTTP-only Cookie / Session Migration
- AUTH-APP-01C2 — Email Verification / Password Reset / Rate Limiting

---

## Invariants Preserved

- AUTH-APP-01A checkpoint and spec remain intact and locked
- No existing tables or columns removed
- All migrations additive and backward-compatible
- No auth controller, auth service, or JWT logic changed
- No frontend code changed
- Governance loop respected: implementation → checkpoint → TASKS update
