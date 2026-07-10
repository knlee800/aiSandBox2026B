/**
 * AGENT-PLATFORM-07F2 Step 3 — Cancel Signal Path Canary
 *
 * Verifies that the exact SQL used by ExecutionResultService.requestCancel()
 * correctly transitions a 'running' row to 'cancel_requested' and leaves
 * a 'completed' row unchanged.
 *
 * Runtime: Docker + PostgreSQL only (no Redis, no BullMQ, no Worker, no API Gateway)
 *
 * Usage (from services/ai-service/):
 *   npx tsx scripts/canary-07f2-cancel-signal.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg') as { Client: new (opts: { connectionString: string }) => any };

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const RUN_ID = Date.now().toString();

const ROW_A_EXECUTION_ID = randomUUID();
const ROW_B_EXECUTION_ID = randomUUID();

const SESSION_ID_A = '00000000-07f2-4000-a000-000c07f20001';
const CONVERSATION_ID_A = '00000000-07f2-4000-a000-000c07f20002';
const SESSION_ID_B = '00000000-07f2-4000-a000-000c07f20003';
const CONVERSATION_ID_B = '00000000-07f2-4000-a000-000c07f20004';

const USER_ID = 'canary-07f2-user';
const API_KEY_ID = 'canary-07f2-apikey';
const CANARY_MARKER = 'AGENT-PLATFORM-07F2';

function getLocalDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? '';
  return raw.replace('@postgres:', '@localhost:') ||
    'postgres://aisandbox:aisandbox@localhost:5432/aisandbox';
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function main() {
  console.log('=== AGENT-PLATFORM-07F2 Cancel Signal Path Canary ===');
  console.log(`Run ID:         ${RUN_ID}`);
  console.log(`Row A (running):   ${ROW_A_EXECUTION_ID}`);
  console.log(`Row B (completed): ${ROW_B_EXECUTION_ID}`);

  const databaseUrl = getLocalDatabaseUrl();
  console.log(`Database URL (masked): ${databaseUrl.replace(/:[^@]*@/, ':***@')}`);

  const pgClient = new Client({ connectionString: databaseUrl });
  await pgClient.connect();
  console.log('Connected to PostgreSQL');

  let preInsertionCount: number;

  try {
    // ── Step 1: Record pre-existing total row count ──
    const preCountResult = await pgClient.query('SELECT COUNT(*)::int AS cnt FROM usage_records');
    preInsertionCount = preCountResult.rows[0].cnt;
    console.log(`\n--- Step 1: Pre-insertion total row count = ${preInsertionCount} ---`);

    // ── Step 2: Verify no pre-existing 07F2 canary rows ──
    const preCanaryResult = await pgClient.query(
      `SELECT COUNT(*)::int AS cnt FROM usage_records WHERE metadata->>'canary' = $1`,
      [CANARY_MARKER],
    );
    assert(
      preCanaryResult.rows[0].cnt === 0,
      `No pre-existing 07F2 canary rows (found ${preCanaryResult.rows[0].cnt})`,
    );

    // ── Step 3: Insert Row A (execution_status = 'running') ──
    console.log('\n--- Step 3: Insert Row A (running) ---');
    await pgClient.query(
      `INSERT INTO usage_records
        (execution_id, api_key_id, user_id, session_id, conversation_id,
         provider, adapter, model, tokens_used, execution_status, metadata)
       VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6, $7, $8, $9, 'running', $10::jsonb)`,
      [
        ROW_A_EXECUTION_ID,
        API_KEY_ID,
        USER_ID,
        SESSION_ID_A,
        CONVERSATION_ID_A,
        'stub',
        'stub',
        'stub',
        0,
        JSON.stringify({
          canary: CANARY_MARKER,
          step: 3,
          scenario: 'cancel-running',
          runId: RUN_ID,
        }),
      ],
    );
    console.log(`Inserted Row A: execution_id=${ROW_A_EXECUTION_ID}, status=running`);

    // ── Step 4: Insert Row B (execution_status = 'completed') ──
    console.log('\n--- Step 4: Insert Row B (completed) ---');
    await pgClient.query(
      `INSERT INTO usage_records
        (execution_id, api_key_id, user_id, session_id, conversation_id,
         provider, adapter, model, tokens_used, execution_status, metadata)
       VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6, $7, $8, $9, 'completed', $10::jsonb)`,
      [
        ROW_B_EXECUTION_ID,
        API_KEY_ID,
        USER_ID,
        SESSION_ID_B,
        CONVERSATION_ID_B,
        'stub',
        'stub',
        'stub',
        0,
        JSON.stringify({
          canary: CANARY_MARKER,
          step: 3,
          scenario: 'cancel-completed',
          runId: RUN_ID,
        }),
      ],
    );
    console.log(`Inserted Row B: execution_id=${ROW_B_EXECUTION_ID}, status=completed`);

    // ── Step 5: Verify exactly 2 canary rows ──
    console.log('\n--- Step 5: Verify canary row count ---');
    const canaryCountResult = await pgClient.query(
      `SELECT COUNT(*)::int AS cnt FROM usage_records WHERE metadata->>'canary' = $1`,
      [CANARY_MARKER],
    );
    assert(
      canaryCountResult.rows[0].cnt === 2,
      `Exactly 2 canary rows after insertion (found ${canaryCountResult.rows[0].cnt})`,
    );

    // ── Step 6: Execute requestCancel SQL against Row A (running → cancel_requested) ──
    console.log('\n--- Step 6: Execute cancel SQL against Row A (running) ---');
    const cancelRunningResult = await pgClient.query(
      `UPDATE usage_records
       SET execution_status = 'cancel_requested'
       WHERE execution_id = $1
       AND execution_status = 'running'
       RETURNING execution_id`,
      [ROW_A_EXECUTION_ID],
    );
    const cancelRunningSuccess = cancelRunningResult.rows.length > 0;
    assert(
      cancelRunningSuccess,
      `Cancel SQL against running Row A returned ${cancelRunningResult.rows.length} row(s) — expected 1`,
    );

    // ── Step 7: Verify Row A status is now 'cancel_requested' ──
    console.log('\n--- Step 7: Verify Row A status changed ---');
    const rowAVerify = await pgClient.query(
      `SELECT execution_id, execution_status FROM usage_records WHERE execution_id = $1`,
      [ROW_A_EXECUTION_ID],
    );
    assert(
      rowAVerify.rows[0].execution_status === 'cancel_requested',
      `Row A execution_status = '${rowAVerify.rows[0].execution_status}' — expected 'cancel_requested'`,
    );

    // ── Step 8: Execute requestCancel SQL against Row B (completed — should NOT update) ──
    console.log('\n--- Step 8: Execute cancel SQL against Row B (completed) ---');
    const cancelCompletedResult = await pgClient.query(
      `UPDATE usage_records
       SET execution_status = 'cancel_requested'
       WHERE execution_id = $1
       AND execution_status = 'running'
       RETURNING execution_id`,
      [ROW_B_EXECUTION_ID],
    );
    const cancelCompletedSuccess = cancelCompletedResult.rows.length > 0;
    assert(
      !cancelCompletedSuccess,
      `Cancel SQL against completed Row B returned ${cancelCompletedResult.rows.length} row(s) — expected 0`,
    );

    // ── Step 9: Verify Row B status is still 'completed' ──
    console.log('\n--- Step 9: Verify Row B status unchanged ---');
    const rowBVerify = await pgClient.query(
      `SELECT execution_id, execution_status FROM usage_records WHERE execution_id = $1`,
      [ROW_B_EXECUTION_ID],
    );
    assert(
      rowBVerify.rows[0].execution_status === 'completed',
      `Row B execution_status = '${rowBVerify.rows[0].execution_status}' — expected 'completed'`,
    );

    // ── Step 10: Non-canary row safety check ──
    console.log('\n--- Step 10: Non-canary row safety check ---');
    const nonCanaryResult = await pgClient.query(
      `SELECT COUNT(*)::int AS cnt FROM usage_records
       WHERE metadata->>'canary' != $1 OR metadata->>'canary' IS NULL`,
      [CANARY_MARKER],
    );
    assert(
      nonCanaryResult.rows[0].cnt === preInsertionCount,
      `Non-canary row count = ${nonCanaryResult.rows[0].cnt} — expected ${preInsertionCount} (unchanged)`,
    );

    // ── Step 11: Cleanup — delete canary rows ──
    console.log('\n--- Step 11: Cleanup ---');
    const deleteResult = await pgClient.query(
      `DELETE FROM usage_records WHERE metadata->>'canary' = $1`,
      [CANARY_MARKER],
    );
    console.log(`Deleted ${deleteResult.rowCount} canary row(s)`);
    assert(
      deleteResult.rowCount === 2,
      `Cleanup deleted ${deleteResult.rowCount} row(s) — expected 2`,
    );

    // ── Step 12: Verify 0 canary rows remain ──
    console.log('\n--- Step 12: Verify cleanup ---');
    const postCleanupResult = await pgClient.query(
      `SELECT COUNT(*)::int AS cnt FROM usage_records WHERE metadata->>'canary' = $1`,
      [CANARY_MARKER],
    );
    assert(
      postCleanupResult.rows[0].cnt === 0,
      `Post-cleanup canary row count = ${postCleanupResult.rows[0].cnt} — expected 0`,
    );

    // ── Step 13: Verify total row count restored ──
    console.log('\n--- Step 13: Verify total row count restored ---');
    const postTotalResult = await pgClient.query('SELECT COUNT(*)::int AS cnt FROM usage_records');
    assert(
      postTotalResult.rows[0].cnt === preInsertionCount,
      `Post-cleanup total row count = ${postTotalResult.rows[0].cnt} — expected ${preInsertionCount}`,
    );

    console.log('\n=== AGENT-PLATFORM-07F2 Cancel Signal Path Canary: ALL ASSERTIONS PASSED ===');
    console.log('Result: PASS');

  } catch (err: any) {
    console.error(`\n=== CANARY FAILED: ${err.message} ===`);

    // Emergency cleanup
    console.log('Attempting emergency cleanup...');
    try {
      const emergencyDelete = await pgClient.query(
        `DELETE FROM usage_records WHERE metadata->>'canary' = $1`,
        [CANARY_MARKER],
      );
      console.log(`Emergency cleanup deleted ${emergencyDelete.rowCount} row(s)`);
      const emergencyVerify = await pgClient.query(
        `SELECT COUNT(*)::int AS cnt FROM usage_records WHERE metadata->>'canary' = $1`,
        [CANARY_MARKER],
      );
      console.log(`Post-emergency canary rows remaining: ${emergencyVerify.rows[0].cnt}`);
    } catch (cleanupErr: any) {
      console.error(`Emergency cleanup failed: ${cleanupErr.message}`);
    }

    await pgClient.end();
    console.log('Result: FAIL');
    process.exit(1);
  }

  await pgClient.end();
  console.log('PostgreSQL connection closed');
  process.exit(0);
}

main().catch((err) => {
  console.error('Canary execution failed:', err);
  process.exit(1);
});
