# Test API Key Creation for PHASE-42A-3

## Overview

This script creates a deterministic test API key for verifying token quota enforcement (TASK-42A-3).

## Prerequisites

1. **Database running** - PostgreSQL must be accessible
2. **API Gateway built** - Run `npm run build` if not already built
3. **Environment configured** - `.env` file with database connection

## Usage

### Step 1: Navigate to api-gateway directory

```powershell
cd services/api-gateway
```

### Step 2: Run the key creation script

```powershell
.\scripts\create-test-api-key.ps1
```

### Step 3: Save the API key

The script will output:
- **API Key** (plaintext, shown ONLY ONCE)
- **Key ID** (UUID)
- **Key Prefix** (first 16 characters)
- **User ID** (fa17c118-44a9-4440-9bac-d68923452c5e)
- **Scopes** (ai:execute, sessions:read, sessions:write)

**⚠️ IMPORTANT:** Save the API key immediately. It cannot be retrieved later.

## What the Script Does

1. **Creates test user** (if not exists)
   - User ID: `fa17c118-44a9-4440-9bac-d68923452c5e`
   - Email: `test-user-42a3@example.com`

2. **Generates API key** using `ApiKeyService.createApiKey()`
   - Cryptographically secure random key (32 bytes)
   - Prefix: `sk_` + hex string
   - Hashed with bcrypt (10 rounds)
   - Stored in `api_keys` table

3. **Outputs verification commands**
   - PowerShell commands to test AI execution
   - Command to run token quota verification script

## Verification Commands

After creating the key, the script outputs PowerShell commands to:

1. **Create a test session**
2. **Execute AI request** (test single execution)
3. **Run token quota verification** (test quota enforcement)

## Example Output

```
========================================
API KEY CREATED
========================================

⚠️  SAVE THIS KEY NOW - IT WILL NOT BE SHOWN AGAIN

API Key:     sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
Key ID:      12345678-1234-1234-1234-123456789012
Key Prefix:  sk_a1b2c3d4e5f6
User ID:     fa17c118-44a9-4440-9bac-d68923452c5e
Scopes:      ai:execute, sessions:read, sessions:write
Created At:  2026-02-23T12:00:00.000Z
```

## Testing Token Quota

Use the generated API key with the verification script:

```powershell
.\scripts\verify-token-quota-42a3.ps1 `
    -BaseUrl "http://localhost:4000" `
    -TestApiKey "sk_YOUR_GENERATED_KEY_HERE"
```

## Troubleshooting

### Error: "Cannot connect to database"

**Solution:** Ensure PostgreSQL is running and `.env` is configured correctly.

```powershell
# Check database connection
psql -h localhost -U postgres -d aisandbox
```

### Error: "node_modules not found"

**Solution:** Install dependencies first.

```powershell
npm install
```

### Error: "User already exists"

**Solution:** This is normal. The script will use the existing user.

### Error: "ts-node not found"

**Solution:** Install ts-node globally or use npx.

```powershell
npm install -g ts-node
# OR
npx ts-node scripts/create-test-api-key.ts
```

## Security Notes

- **Test keys only:** This script is for testing purposes only
- **Never commit keys:** Do not commit API keys to git
- **Revoke after testing:** Revoke test keys after verification
- **Production keys:** Use proper key management in production

## Database Verification

To verify the key was created in the database:

```sql
SELECT 
    id,
    key_prefix,
    user_id,
    scopes,
    created_at,
    revoked_at
FROM api_keys
WHERE user_id = 'fa17c118-44a9-4440-9bac-d68923452c5e';
```

**Note:** The `hashed_key` column contains the bcrypt hash, not the plaintext key.

## Cleanup

To revoke the test key after verification:

```powershell
# Using the API (requires JWT)
curl -X DELETE http://localhost:4000/api/keys/<KEY_ID> `
  -H "Authorization: Bearer <JWT_TOKEN>"

# OR directly in database
UPDATE api_keys 
SET revoked_at = NOW() 
WHERE user_id = 'fa17c118-44a9-4440-9bac-d68923452c5e';
```

## Related Files

- `scripts/create-test-api-key.ts` - TypeScript implementation
- `scripts/create-test-api-key.ps1` - PowerShell wrapper
- `scripts/verify-token-quota-42a3.ps1` - Token quota verification script
- `src/auth/api-key.service.ts` - API key service (key generation logic)
- `src/entities/api-key.entity.ts` - API key entity

## References

- PHASE-42A-3-CHECKPOINT.md - Token quota implementation
- PHASE-36A-SUMMARY.md - API key management system
