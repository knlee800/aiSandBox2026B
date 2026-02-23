# PHASE-43A-2A Verification Commands

## Quick Verification (One-Line Commands)

### A) Verify column exists

```powershell
docker exec -i aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='usage_records' AND column_name='request_id';"
```

**Expected Output:**
```
 column_name |     data_type     | is_nullable 
-------------+-------------------+-------------
 request_id  | character varying | YES
(1 row)
```

---

### B) Verify unique constraint exists

```powershell
docker exec -i aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='usage_records' AND indexdef ILIKE '%request_id%';"
```

**Expected Output:**
```
             indexname             |                                                                    indexdef                                                                    
-----------------------------------+------------------------------------------------------------------------------------------------------------------------------------------------
 idx_usage_records_user_request_id | CREATE UNIQUE INDEX idx_usage_records_user_request_id ON public.usage_records USING btree (user_id, request_id) WHERE (request_id IS NOT NULL)
(1 row)
```

---

### C) Verify behavior (duplicate prevention)

**C1: Insert first record (should succeed)**
```powershell
docker exec -i aisandbox-postgres psql -U aisandbox -d aisandbox -c "INSERT INTO usage_records (execution_id, api_key_id, user_id, session_id, conversation_id, provider, adapter, model, tokens_used, execution_duration_ms, request_id) VALUES ('10000000-0000-0000-0000-000000000001', 'test-key', 'verify-user-001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'test', 'test', 'test-model', 100, 1000, 'verify-request-001');"
```

**Expected Output:** `INSERT 0 1`

**C2: Insert duplicate request_id (should fail)**
```powershell
docker exec -i aisandbox-postgres psql -U aisandbox -d aisandbox -c "INSERT INTO usage_records (execution_id, api_key_id, user_id, session_id, conversation_id, provider, adapter, model, tokens_used, execution_duration_ms, request_id) VALUES ('10000000-0000-0000-0000-000000000002', 'test-key', 'verify-user-001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'test', 'test', 'test-model', 100, 1000, 'verify-request-001');"
```

**Expected Output:** 
```
ERROR:  duplicate key value violates unique constraint "idx_usage_records_user_request_id"
DETAIL:  Key (user_id, request_id)=(verify-user-001, verify-request-001) already exists.
```

**C3: Cleanup test data**
```powershell
docker exec -i aisandbox-postgres psql -U aisandbox -d aisandbox -c "DELETE FROM usage_records WHERE user_id = 'verify-user-001';"
```

---

## Automated Verification Script

For comprehensive automated testing, run:

```powershell
cd C:\Users\knlee\aiSandBox2026B\services\api-gateway
powershell -ExecutionPolicy Bypass -File verify-43a-2a-schema.ps1
```

This script tests:
- Column existence and properties
- Unique constraint existence and definition
- Duplicate prevention behavior
- NULL request_id backward compatibility
- Automatic cleanup of test data

---

## Schema Summary

**Table:** `usage_records`

**New Column:**
- `request_id` VARCHAR(100) NULL
- Client-provided idempotency key
- Optional (backward compatible with existing code)

**New Constraint:**
- UNIQUE INDEX `idx_usage_records_user_request_id` ON `(user_id, request_id)` WHERE `request_id IS NOT NULL`
- Prevents duplicate billing for same user + request_id
- Allows multiple NULL values (backward compatible)

**Entity Updated:**
- `services/api-gateway/src/entities/usage-record.entity.ts`
- Added `requestId?: string` property
- Added index decorator for TypeORM

**Migration Created:**
- `services/api-gateway/src/migrations/1740355200000-AddRequestIdToUsageRecords.ts`
- Adds column and unique constraint
- Fully reversible (down migration included)

---

## Status

✅ Schema changes applied  
✅ Unique constraint enforced  
✅ Backward compatibility verified  
✅ All verifications passed  

**Ready for:** PHASE-43A-2B (service logic implementation)
