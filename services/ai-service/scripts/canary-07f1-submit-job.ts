/**
 * AGENT-PLATFORM-07F1 Step 3 — Queue Transport + Metadata Preservation Canary
 *
 * Submits exactly ONE controlled BullMQ job to verify that orchestration
 * metadata fields survive queue transport and are persisted into
 * usage_records.metadata JSONB by the worker.
 *
 * Safety:
 *  - Provider: stub (zero external API calls, zero billing, zero tokens)
 *  - No harnessVersion (plain execution path only)
 *  - AGENT_HARNESS_ENABLE_TOOL_LOOP=false (process-scoped)
 *  - Inserts a usage_records intent row so the worker can claim it
 *  - Exits after submission
 *
 * Usage (from services/ai-service/):
 *   npx tsx scripts/canary-07f1-submit-job.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg') as { Client: new (opts: { connectionString: string }) => any };

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const TIMESTAMP = Date.now();
const EXECUTION_ID = randomUUID();
const SESSION_ID = '00000000-07f1-4000-a000-000c07f10001';
const CONVERSATION_ID = '00000000-07f1-4000-a000-000c07f10002';
const USER_ID = 'canary-07f1-user';
const API_KEY_ID = 'canary-07f1-apikey';

const CANARY_PROMPT =
  'Canary 07F1: metadata preservation test. Return immediately.';

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
  console.log('=== AGENT-PLATFORM-07F1 Queue Transport + Metadata Preservation Canary ===');
  console.log(`Execution ID: ${EXECUTION_ID}`);
  console.log(`Timestamp:    ${TIMESTAMP}`);

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
        'stub',
        'stub',
        'stub',
        JSON.stringify({ canary: 'AGENT-PLATFORM-07F1', step: 3 }),
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
    provider: 'stub',
    adapter: 'stub',
    prompt: CANARY_PROMPT,
    model: 'stub',
    submittedAt: new Date().toISOString(),

    // AGENT-PLATFORM-06: Upstream identity fields
    agentRole: 'builder',
    builderProfileId: 'builder-canary-07f1',

    // AGENT-PLATFORM-06: Collaboration identity
    collaborationRunId: `collab_canary-07f1-run`,
    referralTraceId: `trace_canary-07f1-trace`,

    // AGENT-PLATFORM-07C2: Orchestration referral metadata
    parentReferralTraceId: `trace_canary-07f1-parent`,
    referringBuilderProfileId: 'builder-canary-07f1-source',
    orchestrationPriority: 5,
    referralId: `ref_canary-07f1-referral`,
    isReferralExecution: true,
  };

  console.log('Job payload:', JSON.stringify(jobPayload, null, 2));

  const job = await queue.add('execute-ai', jobPayload, {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false,
  });
  console.log(`BullMQ job submitted: jobId=${job.id}`);

  await queue.close();
  await redisConnection.quit();
  await pgClient.end();

  console.log('=== 07F1 canary job submitted successfully. Waiting for worker to pick it up. ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Canary submission failed:', err);
  process.exit(1);
});
