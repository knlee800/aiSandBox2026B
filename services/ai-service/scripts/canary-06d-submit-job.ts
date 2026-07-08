/**
 * AGENT-HARNESS-06D Step 3 — Canary Job Submission Script
 *
 * Submits exactly ONE controlled BullMQ job for the live Worker/BullMQ
 * read-only canary using the test-harness-stub adapter.
 *
 * Safety:
 *  - Provider: test-harness-stub (zero external API calls, zero billing)
 *  - harnessVersion: 'v1' (activates harness gate)
 *  - Read-only tools only (list_files + read_file)
 *  - Inserts a usage_records row so the worker can claim it
 *  - Exits after submission
 *
 * Usage (from services/ai-service/):
 *   npx ts-node scripts/canary-06d-submit-job.ts
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
  'Read-only live worker canary: list files in the controlled workspace and read README.md. ' +
  'Do not write, delete, rename, install packages, edit env files, run browser smoke, or run validation commands. ' +
  'Return only what files were listed/read.';

const EXECUTION_ID = randomUUID();
const SESSION_ID = '00000000-06d0-4000-a000-000c060d0001';
const CONVERSATION_ID = '00000000-06d0-4000-a000-000c060d0002';
const USER_ID = 'canary-06d-user';
const API_KEY_ID = 'canary-06d-apikey';

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
  console.log('=== AGENT-HARNESS-06D Canary Job Submission ===');
  console.log(`Execution ID: ${EXECUTION_ID}`);

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
       VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6, $7, $8, 'pending', $9::jsonb)`,
      [
        EXECUTION_ID,
        API_KEY_ID,
        USER_ID,
        SESSION_ID,
        CONVERSATION_ID,
        'test-harness-stub',
        'test-harness-stub',
        'test-harness-stub',
        JSON.stringify({ canary: 'AGENT-HARNESS-06D', step: 3 }),
      ],
    );
    console.log(`Inserted usage_records row: execution_id=${EXECUTION_ID}, status=pending`);
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
    sessionId: SESSION_ID,
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

  console.log('=== Canary job submitted successfully. Waiting for worker to pick it up. ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Canary submission failed:', err);
  process.exit(1);
});
