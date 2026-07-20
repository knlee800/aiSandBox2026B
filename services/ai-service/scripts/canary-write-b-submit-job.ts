/**
 * AGENT-HARNESS-WRITE-CANARY-B Step 3 — Write Canary Job Submission Script
 *
 * Submits exactly ONE controlled BullMQ job for the full E2E
 * write canary using the test-harness-stub adapter in write mode.
 *
 * Safety:
 *  - Provider: test-harness-stub (zero external API calls, zero billing)
 *  - harnessVersion: 'v1' (activates harness gate)
 *  - Write mode: stub emits write_file → read_file → completed
 *  - Requires AGENT_HARNESS_STUB_WRITE_MODE=true on the AI Service Worker
 *  - Requires a REAL session ID (from container-manager) via --sessionId CLI arg
 *  - Inserts a usage_records row so the worker can claim it
 *  - Exits after submission
 *
 * Usage (from services/ai-service/):
 *   npx tsx scripts/canary-write-b-submit-job.ts --sessionId <real-session-id>
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg') as { Client: new (opts: { connectionString: string }) => any };

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const CANARY_PROMPT =
  'Write canary: create canary-write-test.md with a timestamp, then read it back. ' +
  'Do not delete files, rename files, install packages, edit env files, ' +
  'run browser smoke, or run validation commands. ' +
  'Write exactly one file and read it back to verify.';

const EXECUTION_ID = randomUUID();
const DB_SESSION_UUID = '00000000-0b00-4000-a000-00000b000001';
const CONVERSATION_ID = '00000000-0b00-4000-a000-00000b000002';
const USER_ID = 'canary-write-b-user';
const API_KEY_ID = 'canary-write-b-apikey';

function getSessionIdFromArgs(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--sessionId');
  if (idx === -1 || idx + 1 >= args.length) {
    console.error('ERROR: --sessionId <real-session-id> is required');
    console.error('Usage: npx tsx scripts/canary-write-b-submit-job.ts --sessionId <id>');
    process.exit(1);
  }
  const sessionId = args[idx + 1];
  if (!sessionId || sessionId.startsWith('--')) {
    console.error('ERROR: --sessionId value is missing or invalid');
    process.exit(1);
  }
  return sessionId;
}

function getLocalRedisUrl(): string {
  const raw = process.env.REDIS_URL ?? '';
  return raw
    .replace('redis://:aisandboxredis123@redis:', 'redis://:aisandboxredis123@localhost:')
    .replace('@redis:', '@localhost:') || 'redis://:aisandboxredis123@localhost:6379';
}

function getLocalDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? '';
  return raw
    .replace('@postgres:', '@localhost:')
    .replace('@redis:', '@localhost:') || 'postgres://aisandbox:aisandbox@localhost:5432/aisandbox';
}

async function main() {
  const sessionId = getSessionIdFromArgs();

  console.log('=== AGENT-HARNESS-WRITE-CANARY-B Write Canary Job Submission ===');
  console.log(`Execution ID: ${EXECUTION_ID}`);
  console.log(`Session ID:   ${sessionId}`);

  const databaseUrl = getLocalDatabaseUrl();
  const redisUrl = getLocalRedisUrl();

  console.log(`Database URL (host masked): ${databaseUrl.replace(/:[^@]*@/, ':***@')}`);
  console.log(`Redis URL (host masked): ${redisUrl.replace(/:[^@]*@/, ':***@')}`);

  const pgClient = new Client({ connectionString: databaseUrl });
  await pgClient.connect();
  console.log('Connected to PostgreSQL');

  try {
    await pgClient.query(
      `INSERT INTO usage_records
        (execution_id, api_key_id, user_id, session_id, conversation_id,
         provider, adapter, model, execution_status, metadata)
       VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8, 'pending', $9::jsonb)`,
      [
        EXECUTION_ID,
        API_KEY_ID,
        USER_ID,
        DB_SESSION_UUID,
        CONVERSATION_ID,
        'test-harness-stub',
        'test-harness-stub',
        'test-harness-stub',
        JSON.stringify({ canary: 'AGENT-HARNESS-WRITE-CANARY-B', step: 3 }),
      ],
    );
    console.log(`Inserted usage_records row: execution_id=${EXECUTION_ID}, session_id=${DB_SESSION_UUID} (DB reference), status=pending`);
  } catch (err: any) {
    console.error('Failed to insert usage_records row:', err.message);
    await pgClient.end();
    process.exit(1);
  }

  const redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue('ai-execution', { connection: redisConnection as any });

  const jobPayload = {
    executionId: EXECUTION_ID,
    userId: USER_ID,
    apiKeyId: API_KEY_ID,
    sessionId: sessionId,
    conversationId: CONVERSATION_ID,
    provider: 'test-harness-stub',
    adapter: 'test-harness-stub',
    prompt: CANARY_PROMPT,
    harnessVersion: 'v1',
    model: 'test-harness-stub',
    agentRole: 'builder',
    builderProfileId: 'builder-default',
    submittedAt: new Date().toISOString(),
  };

  console.log('Job payload:', JSON.stringify(jobPayload, null, 2));

  const job = await queue.add('ai-execution', jobPayload);
  console.log(`BullMQ job submitted: jobId=${job.id}`);

  await queue.close();
  await redisConnection.quit();
  await pgClient.end();

  console.log('=== Write canary job submitted successfully. Worker will pick it up. ===');
  console.log(`\nTo verify after completion:`);
  console.log(`  SELECT metadata->'preApplyCheckpointHash' FROM usage_records WHERE execution_id = '${EXECUTION_ID}';`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Canary submission failed:', err);
  process.exit(1);
});
