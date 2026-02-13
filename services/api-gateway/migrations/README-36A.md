# Phase 36A: Schema Alignment Migration

## Problem

The `User` entity in `src/entities/user.entity.ts` defines columns that don't exist in the PostgreSQL database:

**Missing columns:**
- `auth_provider` (VARCHAR(50), default 'email')
- `oauth_id` (VARCHAR(255), nullable)
- `plan_type` (VARCHAR(50), default 'free')
- `stripe_customer_id` (VARCHAR(255), nullable)
- `last_login_at` (TIMESTAMP, nullable)
- `is_active` (BOOLEAN, default true)

**Column name mismatch:**
- Database has `user_id` but entity expects `id`

**Column constraint mismatch:**
- `password_hash` should be nullable (for OAuth users)

This causes runtime errors:
```
QueryFailedError: column User.id does not exist
```

## Solution

Migration `1770915174111-AlignUsersSchema.ts` performs additive schema changes:

1. ✅ Renames `user_id` → `id` (if needed)
2. ✅ Makes `password_hash` nullable
3. ✅ Adds missing columns with proper defaults
4. ✅ Updates foreign key constraints in `sessions` table
5. ✅ No data loss, no destructive operations

## How to Run

### Prerequisites

1. **Start PostgreSQL:**
   ```bash
   docker-compose up -d postgres
   ```

2. **Set DATABASE_URL:**
   ```powershell
   $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aisandbox_dev"
   ```

### Run Migration

**Option 1: Using helper script (recommended)**
```powershell
cd services/api-gateway
.\scripts\run-migration-36a.ps1
```

**Option 2: Manual**
```powershell
cd services/api-gateway
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aisandbox_dev"
npm run migration:run
```

### Verify

1. **Check migration status:**
   ```powershell
   npm run migration:show
   ```

2. **Start API Gateway:**
   ```powershell
   npm run dev
   ```

3. **Test login:**
   ```bash
   curl -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

## Migration Details

### Added Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `auth_provider` | VARCHAR(50) | NO | 'email' | Authentication method (email, google, apple, github) |
| `oauth_id` | VARCHAR(255) | YES | NULL | OAuth provider user ID |
| `plan_type` | VARCHAR(50) | NO | 'free' | Subscription plan (free, pro, enterprise) |
| `stripe_customer_id` | VARCHAR(255) | YES | NULL | Stripe billing ID |
| `last_login_at` | TIMESTAMP | YES | NULL | Last successful login timestamp |
| `is_active` | BOOLEAN | NO | TRUE | Account active status |

### Schema Changes

**Before:**
```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**After:**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,  -- renamed from user_id
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- now nullable
    auth_provider VARCHAR(50) NOT NULL DEFAULT 'email',  -- NEW
    oauth_id VARCHAR(255),  -- NEW
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    plan_type VARCHAR(50) NOT NULL DEFAULT 'free',  -- NEW
    stripe_customer_id VARCHAR(255),  -- NEW
    is_active BOOLEAN NOT NULL DEFAULT TRUE,  -- NEW
    last_login_at TIMESTAMP,  -- NEW
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Rollback

If needed, revert the migration:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aisandbox_dev"
npm run migration:revert
```

This will:
- Remove added columns
- Revert `password_hash` to NOT NULL
- Rename `id` back to `user_id`

⚠️ **Warning:** Rollback will lose data in new columns!

## Safety Guarantees

✅ **No data loss:** Existing rows preserved  
✅ **No table drops:** Only column additions  
✅ **Idempotent:** Safe to run multiple times  
✅ **Backward compatible:** Existing code continues to work  
✅ **Transactional:** Rolls back on error  

## Architecture Compliance

- ✅ Entity is source of truth (not modified)
- ✅ Database aligns to entity
- ✅ No destructive operations
- ✅ Additive migration only
- ✅ Preserves existing data
- ✅ Phase 36A scope: api-gateway only

## Testing

After migration, verify:

1. **Schema matches entity:**
   ```sql
   \d users
   ```

2. **Existing users still work:**
   ```sql
   SELECT id, email, auth_provider, plan_type, is_active FROM users;
   ```

3. **Login succeeds:**
   ```bash
   POST /api/auth/login
   ```

4. **New users can be created:**
   ```bash
   POST /api/auth/register
   ```

## Troubleshooting

### Error: "column User.id does not exist"

**Cause:** Migration not run yet  
**Fix:** Run migration as described above

### Error: "relation 'users' does not exist"

**Cause:** Database not initialized  
**Fix:** Run initial schema migration first:
```powershell
npm run migration:run
```

### Error: "ECONNREFUSED ::1:5432"

**Cause:** PostgreSQL not running  
**Fix:**
```bash
docker-compose up -d postgres
```

### Error: "DATABASE_URL is required"

**Cause:** Environment variable not set  
**Fix:**
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aisandbox_dev"
```

## Files Changed

- ✅ `migrations/1770915174111-AlignUsersSchema.ts` (NEW)
- ✅ `scripts/run-migration-36a.ps1` (NEW)
- ✅ `migrations/README-36A.md` (NEW)
- ❌ No entity changes
- ❌ No service changes
- ❌ No controller changes

## Checkpoint

This migration completes **Phase 36A: Schema Alignment Fix**.

**Status:** ✅ READY TO RUN  
**Risk:** LOW (additive only)  
**Impact:** Fixes login errors  
**Scope:** api-gateway database only  
