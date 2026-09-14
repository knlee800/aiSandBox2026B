/**
 * AGENT-PLATFORM-EXEC-01C6A — stub canary submit (preparation).
 *
 * Ingress: STUB_DIRECT_QUEUE_WITH_CONTRACT_PROOF
 * Queue: ai-execution / job name execute-ai
 * Job options (deployed 804f8983 QueueService contract):
 *   attempts: 1, removeOnComplete: true, removeOnFail: false
 *
 * Concrete Redis / PostgreSQL adapters exist behind the live-authorization
 * gate (AISB_01C6A_LIVE_SUBMIT + AISB_01C6A_STAGING_EXECUTION_AUTHORIZED).
 * Preparation must not invoke them against staging.
 *
 * Does not create keys, grant internal access, alter PM2, provision credits,
 * create fixtures, load repository .env, rewrite Docker localhost URLs,
 * delete retained ledger rows, or automatically retry a lost acknowledgment.
 */
import { createHash, createHmac, randomUUID } from 'crypto';

export const QUEUE_NAME = 'ai-execution';
export const JOB_NAME = 'execute-ai';
export const REGISTERED_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: true,
  removeOnFail: false,
} as const;

export const DEFAULT_WAIT_MS = 20000;
export const POLL_INTERVAL_MS = 250;
export const CONNECT_TIMEOUT_MS = 5000;
export const DEFAULT_OP_TIMEOUT_MS = 8000;
export const SHUTDOWN_TIMEOUT_MS = 5000;
export const REVOKED_KEY_ID = '60937d22-090a-4011-9e21-e7d3dac9ced9';

export const EXIT_SUCCESS = 0;
export const EXIT_FAILURE = 1;
export const EXIT_REFUSED = 2;
export const EXIT_INCOMPLETE = 3;
export const EXIT_ACK_UNKNOWN = 4;
export const EXIT_TIMEOUT = 5;
export const EXIT_CLEANUP_INCOMPLETE = 6;

export interface ShutdownResult {
  complete: boolean;
  pendingClients: string[];
  forcedClients: string[];
}

export const BULLMQ_JOB_TYPES = [
  'failed',
  'waiting',
  'wait',
  'active',
  'delayed',
  'paused',
  'completed',
] as const;

export const STUB_PROMPT =
  'Read-only live worker canary: list files in the controlled workspace and read README.md. ' +
  'Do not write, delete, rename, install packages, edit env files, run browser smoke, or run validation commands. ' +
  'Return only what files were listed/read.';

export const ENTITLEMENT_FAIL_CODES = [
  'HARNESS_ENTITLEMENT_PROOF_MISSING',
  'HARNESS_ENTITLEMENT_PROOF_MALFORMED',
  'HARNESS_ENTITLEMENT_PROOF_UNSUPPORTED_VERSION',
  'HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH',
  'HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH',
  'HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE',
  'HARNESS_ENTITLEMENT_PROOF_SECRET_NOT_CONFIGURED',
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SECRET_KEYS = new Set([
  'signature',
  'hmacSecret',
  'secret',
  'authorization',
  'Authorization',
  'apiKey',
  'api_key',
  'token',
  'password',
  'redisUrl',
  'databaseUrl',
  'REDIS_URL',
  'DATABASE_URL',
  'AISB_01C6A_HMAC_SECRET',
  'HARNESS_ENTITLEMENT_HMAC_SECRET',
  'AISB_01C6A_API_KEY_TOKEN',
  'harnessEntitlementProof',
  'connectionString',
]);

export type JobState =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'unknown'
  | 'missing';

export type ProofAcceptance = 'accepted' | 'rejected' | 'unknown';
export type SubmissionMode = 'isolated-mock' | 'live' | 'refuse' | 'reconcile';
export type AccountingEvidence =
  | 'pass'
  | 'fail_nonzero'
  | 'not_present'
  | 'unknown'
  | 'incomplete'
  | 'conflicting';
export type AckClass = 'ack' | 'ack_unknown' | 'did_not_occur';

export interface HarnessEntitlementProof {
  readonly version: 1;
  readonly executionId: string;
  readonly userId: string;
  readonly apiKeyId: string;
  readonly harnessVersion: 'v1';
  readonly issuedAt: string;
  readonly payloadDigest: string;
  readonly signature: string;
}

export interface StubFixtures {
  userId: string;
  apiKeyId: string;
  sessionId: string;
  conversationId: string;
  agentId: string;
  hmacSecret: string;
  redisUrl?: string;
  databaseUrl?: string;
  waitMs: number;
}

export interface QueueAddCall {
  jobName: string;
  payload: Record<string, unknown>;
  options: { attempts: number; removeOnComplete: boolean; removeOnFail: boolean };
}

export interface JobObservation {
  state: JobState;
  failedReason?: string | null;
  executionIdFromJob?: string;
}

export interface DeductionRowObservation {
  id?: string | null;
  sourceEventId?: string | null;
  executionId?: string | null;
  appliedCredits?: number | null;
  requestedCredits?: number | null;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
}

export interface LedgerObservation {
  executionStatus?: string | null;
  tokensUsed?: number | null;
  provider?: string | null;
  adapter?: string | null;
  model?: string | null;
  agentId?: string | null;
  deductionPresent: boolean;
  appliedCredits?: number | null;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  sourceEventId?: string | null;
  deductionRows?: DeductionRowObservation[];
  usageRowCount?: number;
}

export interface PgLike {
  connect: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
}

export interface QueueJobLike {
  id?: string;
  failedReason?: string;
  data?: { executionId?: string };
  getState: () => Promise<string>;
}

export interface QueueLike {
  add?: (
    name: string,
    payload: Record<string, unknown>,
    options: { attempts: number; removeOnComplete: boolean; removeOnFail: boolean },
  ) => Promise<{ id?: string }>;
  getJob: (id: string) => Promise<QueueJobLike | null | undefined>;
  getJobs?: (types: string[], start?: number, end?: number) => Promise<QueueJobLike[]>;
  close: () => Promise<void>;
}

export interface RedisLike {
  connect?: () => Promise<void>;
  quit: () => Promise<unknown>;
  disconnect?: () => void;
}

export interface StubPorts {
  env: NodeJS.Dict<string>;
  nowIso: () => string;
  nowMs?: () => number;
  randomUUID: () => string;
  log: (line: string) => void;
  insertUsageRecord: (row: Record<string, unknown>, signal?: AbortSignal) => Promise<void>;
  addJob: (call: QueueAddCall, signal?: AbortSignal) => Promise<{ id: string }>;
  getJobObservation: (jobId: string, signal?: AbortSignal) => Promise<JobObservation>;
  findJobByExecutionId?: (executionId: string, signal?: AbortSignal) => Promise<JobObservation | undefined>;
  observeLedger: (executionId: string, signal?: AbortSignal) => Promise<LedgerObservation | undefined>;
  wait: (ms: number, signal?: AbortSignal) => Promise<void>;
  connectNetwork?: (signal?: AbortSignal) => Promise<void>;
  shutdown?: (signal?: AbortSignal) => Promise<ShutdownResult>;
}

export class CanaryPrepError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly ackClass?: AckClass,
  ) {
    super(message);
    this.name = 'CanaryPrepError';
  }
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function redactString(s: string, extraSecrets: string[]): string {
  let out = s;
  out = out.replace(/(\b(?:Bearer|Basic)\s+)(\S+)/gi, '$1[REDACTED]');
  out = out.replace(/:\/\/([^/@\s]+):([^@/\s]+)@/g, '://$1:[REDACTED]@');
  out = out.replace(/:\/\/:([^@/\s]+)@/g, '://:[REDACTED]@');
  for (const needle of extraSecrets) {
    if (needle.length >= 4 && out.includes(needle)) {
      out = out.split(needle).join('[REDACTED]');
    }
  }
  return out;
}

export function redactSecrets(value: unknown, extraSecrets: string[] = []): unknown {
  const secretNeedles = extraSecrets.filter((s) => s.length > 0);
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      return redactString(v, secretNeedles);
    }
    if (v === null || v === undefined || typeof v !== 'object') {
      return v;
    }
    if (Array.isArray(v)) {
      return v.map(walk);
    }
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (
        SECRET_KEYS.has(k) ||
        lower.includes('secret') ||
        lower.includes('signature') ||
        lower.includes('password') ||
        lower.includes('authorization')
      ) {
        out[k] = '[REDACTED]';
      } else if (lower.includes('prompt') || lower.includes('payload') || lower.includes('body')) {
        out[k] = '[REDACTED_PAYLOAD]';
      } else {
        out[k] = walk(val);
      }
    }
    return out;
  };
  return walk(value);
}

export function sanitizeUntrustedError(err: unknown, extraSecrets: string[] = []): string {
  const code = err instanceof CanaryPrepError ? err.code : 'UNTRUSTED_ERROR';
  return `code=${code} detail=[REDACTED]`;
}

export function collectSecretNeedles(env: NodeJS.Dict<string>, extra: string[] = []): string[] {
  const names = [
    'AISB_01C6A_HMAC_SECRET',
    'HARNESS_ENTITLEMENT_HMAC_SECRET',
    'AISB_01C6A_API_KEY_TOKEN',
    'REDIS_URL',
    'DATABASE_URL',
  ];
  const out = extra.slice();
  for (const name of names) {
    const raw = env[name];
    if (raw && raw.length >= 4) {
      out.push(raw);
      try {
        const u = new URL(raw);
        if (u.password) {
          out.push(u.password);
        }
      } catch {
        const m = raw.match(/:([^@/]+)@/);
        if (m && m[1]) {
          out.push(m[1]);
        }
      }
    }
  }
  return out.filter((s) => s.length >= 4);
}

export function sortKeysRecursive(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursive);
  }
  const obj = value as Record<string, unknown>;
  const sorted = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeysRecursive(obj[key]);
  }
  return sorted;
}

export function computePayloadDigest(
  payloadWithoutProof: Record<string, unknown>,
): { canonicalJson: string; payloadDigest: string } {
  const jsonStr = JSON.stringify(payloadWithoutProof);
  if (jsonStr === undefined) {
    throw new CanaryPrepError('PAYLOAD_SERIALIZATION_FAILED', 'JSON.stringify returned undefined');
  }
  const parsed = JSON.parse(jsonStr);
  const canonicalJson = JSON.stringify(sortKeysRecursive(parsed));
  const payloadDigest = createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
  return { canonicalJson, payloadDigest };
}

export function buildHarnessEntitlementClaimString(input: {
  readonly executionId: string;
  readonly userId: string;
  readonly apiKeyId: string;
  readonly issuedAt: string;
  readonly payloadDigest: string;
}): string {
  return `v=1|executionId=${input.executionId}|userId=${input.userId}|apiKeyId=${input.apiKeyId}|harnessVersion=v1|issuedAt=${input.issuedAt}|payloadDigest=${input.payloadDigest}`;
}

export function createHarnessEntitlementProof(input: {
  readonly executionId: string;
  readonly userId: string;
  readonly apiKeyId: string;
  readonly issuedAt: string;
  readonly payloadWithoutProof: Record<string, unknown>;
  readonly secret: string;
}): HarnessEntitlementProof {
  const { payloadDigest } = computePayloadDigest(input.payloadWithoutProof);
  const claim = buildHarnessEntitlementClaimString({
    executionId: input.executionId,
    userId: input.userId,
    apiKeyId: input.apiKeyId,
    issuedAt: input.issuedAt,
    payloadDigest,
  });
  return {
    version: 1,
    executionId: input.executionId,
    userId: input.userId,
    apiKeyId: input.apiKeyId,
    harnessVersion: 'v1',
    issuedAt: input.issuedAt,
    payloadDigest,
    signature: createHmac('sha256', input.secret).update(claim, 'utf8').digest('hex'),
  };
}

export function verifyHarnessEntitlementProof(
  job: Record<string, unknown>,
  secret: string,
): { accepted: boolean; errorCode?: string } {
  if (job.harnessVersion !== 'v1') {
    return { accepted: true };
  }
  const proof = job.harnessEntitlementProof;
  if (proof === undefined || proof === null || typeof proof !== 'object' || Array.isArray(proof)) {
    return { accepted: false, errorCode: 'HARNESS_ENTITLEMENT_PROOF_MISSING' };
  }
  const p = proof as Record<string, unknown>;
  if (p.version !== 1) {
    return { accepted: false, errorCode: 'HARNESS_ENTITLEMENT_PROOF_MALFORMED' };
  }
  if (typeof p.signature !== 'string' || !/^[0-9a-f]{64}$/.test(p.signature)) {
    return { accepted: false, errorCode: 'HARNESS_ENTITLEMENT_PROOF_MALFORMED' };
  }
  if (p.executionId !== job.executionId || p.userId !== job.userId || p.apiKeyId !== job.apiKeyId) {
    return { accepted: false, errorCode: 'HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH' };
  }
  const { payloadDigest } = computePayloadDigest(
    Object.fromEntries(Object.entries(job).filter(([k]) => k !== 'harnessEntitlementProof')),
  );
  if (p.payloadDigest !== payloadDigest) {
    return { accepted: false, errorCode: 'HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH' };
  }
  const claim = buildHarnessEntitlementClaimString({
    executionId: String(p.executionId),
    userId: String(p.userId),
    apiKeyId: String(p.apiKeyId),
    issuedAt: String(p.issuedAt),
    payloadDigest: String(p.payloadDigest),
  });
  const expected = createHmac('sha256', secret).update(claim, 'utf8').digest('hex');
  if (expected !== p.signature) {
    return { accepted: false, errorCode: 'HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE' };
  }
  return { accepted: true };
}

export function readFlag(env: NodeJS.Dict<string>, name: string): boolean {
  const raw = env[name];
  if (raw === undefined) {
    return false;
  }
  return raw.trim() === '1' || raw.trim().toUpperCase() === 'YES' || raw.trim().toUpperCase() === 'TRUE';
}

export function classifySubmissionMode(env: NodeJS.Dict<string>): SubmissionMode {
  const isolated = readFlag(env, 'AISB_01C6A_ISOLATED_MOCK');
  const live = readFlag(env, 'AISB_01C6A_LIVE_SUBMIT');
  const reconcile = readFlag(env, 'AISB_01C6A_RECONCILE');
  const setCount = [isolated, live, reconcile].filter(Boolean).length;
  if (setCount > 1) {
    throw new CanaryPrepError(
      'SUBMISSION_AMBIGUITY',
      'Exactly one of AISB_01C6A_ISOLATED_MOCK, AISB_01C6A_LIVE_SUBMIT, AISB_01C6A_RECONCILE may be set',
    );
  }
  if (isolated) {
    return 'isolated-mock';
  }
  if (reconcile) {
    return 'reconcile';
  }
  if (live) {
    return 'live';
  }
  return 'refuse';
}

export function parseWaitMs(env: NodeJS.Dict<string>): number {
  const raw = env.AISB_01C6A_WAIT_MS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_WAIT_MS;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 120000) {
    throw new CanaryPrepError('INVALID_WAIT_MS', 'AISB_01C6A_WAIT_MS must be a positive number <= 120000');
  }
  return Math.floor(n);
}

export function parseOpTimeoutMs(env: NodeJS.Dict<string>): number {
  const raw = env.AISB_01C6A_OP_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_OP_TIMEOUT_MS;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 20 || n > 30000) {
    throw new CanaryPrepError('INVALID_OP_TIMEOUT_MS', 'AISB_01C6A_OP_TIMEOUT_MS must be 20..30000');
  }
  return Math.floor(n);
}

export function loadStubFixtures(env: NodeJS.Dict<string>): StubFixtures {
  const required = [
    'AISB_01C6A_USER_ID',
    'AISB_01C6A_API_KEY_ID',
    'AISB_01C6A_SESSION_ID',
    'AISB_01C6A_CONVERSATION_ID',
    'AISB_01C6A_AGENT_ID',
  ] as const;
  const missing: string[] = [];
  const values: Record<string, string> = {};
  for (const key of required) {
    const raw = env[key];
    if (raw === undefined || raw.trim() === '') {
      missing.push(key);
    } else {
      values[key] = raw.trim();
    }
  }
  if (missing.length > 0) {
    throw new CanaryPrepError('MISSING_FIXTURES', `Missing designated fixtures: ${missing.join(', ')}`);
  }
  for (const key of required) {
    if (!isUuid(values[key])) {
      throw new CanaryPrepError('INVALID_UUID', `${key} must be a UUID`);
    }
  }
  if (values.AISB_01C6A_API_KEY_ID.toLowerCase() === REVOKED_KEY_ID) {
    throw new CanaryPrepError(
      'REVOKED_KEY_EXCLUDED',
      'AISB_01C6A_API_KEY_ID must not be the excluded revoked key',
    );
  }
  const hmacSecret = (env.AISB_01C6A_HMAC_SECRET ?? env.HARNESS_ENTITLEMENT_HMAC_SECRET ?? '').trim();
  if (hmacSecret.length === 0) {
    throw new CanaryPrepError('MISSING_HMAC_SECRET', 'AISB_01C6A_HMAC_SECRET is required and must be non-empty');
  }
  return {
    userId: values.AISB_01C6A_USER_ID,
    apiKeyId: values.AISB_01C6A_API_KEY_ID,
    sessionId: values.AISB_01C6A_SESSION_ID,
    conversationId: values.AISB_01C6A_CONVERSATION_ID,
    agentId: values.AISB_01C6A_AGENT_ID,
    hmacSecret,
    redisUrl: env.REDIS_URL,
    databaseUrl: env.DATABASE_URL,
    waitMs: parseWaitMs(env),
  };
}

export function assertLiveTargets(fixtures: StubFixtures): { redisHost: string; dbHost: string } {
  if (!fixtures.redisUrl || !fixtures.databaseUrl) {
    throw new CanaryPrepError('MISSING_FIXTURES', 'REDIS_URL and DATABASE_URL are required for live submit');
  }
  let redisHost: string;
  let dbHost: string;
  try {
    const redis = new URL(fixtures.redisUrl);
    if (redis.protocol !== 'redis:' && redis.protocol !== 'rediss:') {
      throw new Error('bad redis protocol');
    }
    if (!redis.hostname) {
      throw new Error('missing redis host');
    }
    redisHost = redis.hostname;
  } catch {
    throw new CanaryPrepError('INVALID_REDIS_URL', 'REDIS_URL must be redis(s) with a hostname');
  }
  try {
    const db = new URL(fixtures.databaseUrl);
    if (db.protocol !== 'postgres:' && db.protocol !== 'postgresql:') {
      throw new Error('bad db protocol');
    }
    if (!db.hostname) {
      throw new Error('missing db host');
    }
    dbHost = db.hostname;
  } catch {
    throw new CanaryPrepError('INVALID_DATABASE_URL', 'DATABASE_URL must be postgres(ql) with a hostname');
  }
  return { redisHost, dbHost };
}

export function buildStubPayload(input: {
  executionId: string;
  fixtures: StubFixtures;
  submittedAt: string;
}): Record<string, unknown> {
  return {
    executionId: input.executionId,
    userId: input.fixtures.userId,
    apiKeyId: input.fixtures.apiKeyId,
    sessionId: input.fixtures.sessionId,
    conversationId: input.fixtures.conversationId,
    provider: 'test-harness-stub',
    adapter: 'test-harness-stub',
    prompt: STUB_PROMPT,
    model: 'test-harness-stub',
    harnessVersion: 'v1',
    agentId: input.fixtures.agentId,
    executionIntent: 'conversation',
    agentRole: 'builder',
    builderProfileId: 'builder-default',
    submittedAt: input.submittedAt,
  };
}

export function parseJobFailedReason(raw: string | null | undefined): {
  adapterLacksToolUse: boolean;
  routingFailReason: string | null;
  entitlementCode: string | null;
} {
  if (!raw) {
    return { adapterLacksToolUse: false, routingFailReason: null, entitlementCode: null };
  }
  for (const code of ENTITLEMENT_FAIL_CODES) {
    if (raw.includes(code)) {
      return { adapterLacksToolUse: false, routingFailReason: null, entitlementCode: code };
    }
  }
  if (/\badapter_lacks_tool_use\b/.test(raw)) {
    return {
      adapterLacksToolUse: true,
      routingFailReason: 'adapter_lacks_tool_use',
      entitlementCode: null,
    };
  }
  if (/\badapter_lacks_execute_with_tools\b/.test(raw)) {
    return {
      adapterLacksToolUse: false,
      routingFailReason: 'adapter_lacks_execute_with_tools',
      entitlementCode: null,
    };
  }
  if (/\btool_loop_disabled\b/.test(raw)) {
    return {
      adapterLacksToolUse: false,
      routingFailReason: 'tool_loop_disabled',
      entitlementCode: null,
    };
  }
  return { adapterLacksToolUse: false, routingFailReason: null, entitlementCode: null };
}

export function deriveProofAcceptance(ev: {
  entitlementCode: string | null;
  executionStatus?: string | null;
  jobState?: JobState;
  routingFailReason: string | null;
}): ProofAcceptance {
  if (ev.entitlementCode) {
    return 'rejected';
  }
  if (ev.routingFailReason) {
    return 'accepted';
  }
  if (ev.executionStatus === 'completed' || ev.jobState === 'completed') {
    return 'accepted';
  }
  if (ev.jobState === 'missing' && ev.executionStatus === 'completed') {
    return 'accepted';
  }
  return 'unknown';
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function assessZeroTokenAccounting(ev: {
  executionId?: string;
  tokensUsed?: number | null;
  deductionPresent?: boolean;
  appliedCredits?: number | null;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  sourceEventId?: string | null;
  deductionRows?: DeductionRowObservation[];
  usageRowCount?: number;
}): AccountingEvidence {
  if (typeof ev.usageRowCount === 'number' && ev.usageRowCount > 1) {
    return 'conflicting';
  }
  const rows = ev.deductionRows;
  if (!rows || rows.length === 0) {
    if (ev.deductionPresent === true) {
      return 'incomplete';
    }
    return 'not_present';
  }
  if (rows.length !== 1) {
    return 'conflicting';
  }
  const d = rows[0];
  const executionId = ev.executionId;
  if (!executionId) {
    return 'incomplete';
  }
  const sourceOk = d.sourceEventId == null || d.sourceEventId === executionId;
  const execOk = d.executionId == null || d.executionId === executionId;
  if (!sourceOk || !execOk) {
    return 'incomplete';
  }
  if (d.sourceEventId !== executionId && d.executionId !== executionId) {
    return 'incomplete';
  }
  if (!isFiniteNumber(ev.tokensUsed)) {
    return 'incomplete';
  }
  if (ev.tokensUsed !== 0) {
    return 'fail_nonzero';
  }
  if (!isFiniteNumber(d.appliedCredits) || !isFiniteNumber(d.balanceBefore) || !isFiniteNumber(d.balanceAfter)) {
    return 'incomplete';
  }
  if (d.appliedCredits !== 0) {
    return 'fail_nonzero';
  }
  if (d.balanceAfter !== d.balanceBefore) {
    return 'fail_nonzero';
  }
  return 'pass';
}

export async function boundCall<T>(
  label: string,
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
  ackOnTimeout: AckClass = 'did_not_occur',
): Promise<T> {
  if (ms <= 0) {
    throw new CanaryPrepError('TIMEOUT', `${label} has no remaining budget`, ackOnTimeout);
  }
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ac.abort();
      reject(new CanaryPrepError('TIMEOUT', `${label} exceeded ${ms}ms`, ackOnTimeout));
    }, ms);
  });
  try {
    return await Promise.race([fn(ac.signal), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export function abortable<T>(signal: AbortSignal | undefined, work: Promise<T>): Promise<T> {
  if (!signal) {
    return work;
  }
  if (signal.aborted) {
    return Promise.reject(new CanaryPrepError('TIMEOUT', 'operation aborted', 'did_not_occur'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new CanaryPrepError('TIMEOUT', 'operation aborted', 'did_not_occur'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

export function remainingMs(deadline: number, nowMs: () => number): number {
  return deadline - nowMs();
}

export function exitCodeForStubResult(result: StubCanaryResult): number {
  if (result.outcome === 'refused') {
    return EXIT_REFUSED;
  }
  if (result.outcome === 'ack_unknown' || result.insertAck === 'ack_unknown' || result.enqueueAck === 'ack_unknown') {
    return EXIT_ACK_UNKNOWN;
  }
  if (result.outcome === 'timeout') {
    return EXIT_TIMEOUT;
  }
  if (result.outcome === 'incomplete') {
    return EXIT_INCOMPLETE;
  }
  if (result.outcome === 'completed' && result.accountingEvidence === 'pass' && result.proofAccepted === 'accepted') {
    return EXIT_SUCCESS;
  }
  return EXIT_FAILURE;
}

export function exitCodeForError(err: unknown): number {
  if (!(err instanceof CanaryPrepError)) {
    return EXIT_FAILURE;
  }
  if (err.code === 'TIMEOUT') {
    return EXIT_TIMEOUT;
  }
  if (
    err.code === 'INSERT_ACK_UNKNOWN' ||
    err.code === 'ENQUEUE_ACK_UNKNOWN' ||
    err.code === 'POST_ACK_UNKNOWN' ||
    err.ackClass === 'ack_unknown'
  ) {
    return EXIT_ACK_UNKNOWN;
  }
  return EXIT_FAILURE;
}

export interface StubCanaryResult {
  outcome: 'completed' | 'failed' | 'timeout' | 'refused' | 'ack_unknown' | 'incomplete';
  executionId?: string;
  jobId?: string;
  jobState?: JobState;
  proofAccepted: ProofAcceptance;
  usageRecordDeleted: boolean;
  failedJobRemoved: boolean;
  accountingEvidence: AccountingEvidence;
  automaticRetryCount: number;
  insertAck?: AckClass;
  enqueueAck?: AckClass;
}

export async function reconcileStubSubmission(
  ports: Pick<StubPorts, 'observeLedger' | 'getJobObservation' | 'findJobByExecutionId' | 'log' | 'env'>,
  ids: { executionId: string; jobId?: string },
): Promise<{ ledger?: LedgerObservation; job?: JobObservation }> {
  const opMs = parseOpTimeoutMs(ports.env);
  ports.log(
    JSON.stringify({
      event: 'stub_reconcile_readonly',
      executionId: ids.executionId,
      jobId: ids.jobId ?? null,
      automaticRetryForbidden: true,
    }),
  );
  const ledger = await boundCall(
    'reconcile.ledger',
    opMs,
    (signal) => ports.observeLedger(ids.executionId, signal),
    'did_not_occur',
  );
  let job: JobObservation | undefined;
  if (ids.jobId) {
    job = await boundCall(
      'reconcile.job',
      opMs,
      (signal) => ports.getJobObservation(ids.jobId as string, signal),
      'did_not_occur',
    );
  } else if (ports.findJobByExecutionId) {
    job = await boundCall(
      'reconcile.jobByExecutionId',
      opMs,
      (signal) => ports.findJobByExecutionId!(ids.executionId, signal),
      'did_not_occur',
    );
  }
  return { ledger, job };
}

function settledJob(obs: JobObservation, ledger?: LedgerObservation): boolean {
  if (obs.state === 'completed' || obs.state === 'failed') {
    return true;
  }
  if (obs.state === 'missing' && ledger && ledger.executionStatus && ledger.executionStatus !== 'pending' && ledger.executionStatus !== 'running') {
    return true;
  }
  return false;
}

export async function runStubCanary(ports: StubPorts): Promise<StubCanaryResult> {
  const secrets = collectSecretNeedles(ports.env);
  const log = (line: string) => ports.log(String(redactSecrets(line, secrets)));
  const mode = classifySubmissionMode(ports.env);
  const empty: StubCanaryResult = {
    outcome: 'refused',
    proofAccepted: 'unknown',
    usageRecordDeleted: false,
    failedJobRemoved: false,
    accountingEvidence: 'unknown',
    automaticRetryCount: 0,
  };
  if (mode === 'refuse') {
    log('LIVE_SUBMIT_UNAUTHORIZED: stub canary not submitted (preparation only)');
    return empty;
  }
  if (mode === 'live' && !readFlag(ports.env, 'AISB_01C6A_STAGING_EXECUTION_AUTHORIZED')) {
    throw new CanaryPrepError(
      'LIVE_SUBMIT_BLOCKED_IN_PREPARATION',
      'Live stub submit requires AISB_01C6A_STAGING_EXECUTION_AUTHORIZED',
    );
  }

  const fixtures = loadStubFixtures(ports.env);
  const opMs = parseOpTimeoutMs(ports.env);
  if (mode === 'live' || mode === 'reconcile') {
    const hosts = assertLiveTargets(fixtures);
    log(JSON.stringify({ event: 'targets_validated', redisHost: hosts.redisHost, dbHost: hosts.dbHost }));
  }

  if (mode === 'reconcile') {
    const executionId = (ports.env.AISB_01C6A_RECONCILE_EXECUTION_ID ?? '').trim();
    const jobId = (ports.env.AISB_01C6A_RECONCILE_JOB_ID ?? '').trim() || undefined;
    if (!isUuid(executionId)) {
      throw new CanaryPrepError('INVALID_UUID', 'AISB_01C6A_RECONCILE_EXECUTION_ID must be a UUID');
    }
    if (ports.connectNetwork) {
      await boundCall('connect', CONNECT_TIMEOUT_MS, (signal) => ports.connectNetwork!(signal), 'did_not_occur');
    }
    const rec = await reconcileStubSubmission({ ...ports, log }, { executionId, jobId });
    const parsed = parseJobFailedReason(rec.job?.failedReason);
    const proofAccepted = deriveProofAcceptance({
      entitlementCode: parsed.entitlementCode,
      executionStatus: rec.ledger?.executionStatus,
      jobState: rec.job?.state,
      routingFailReason: parsed.routingFailReason,
    });
    const accountingEvidence = rec.ledger
      ? assessZeroTokenAccounting({ ...rec.ledger, executionId })
      : 'unknown';
    return {
      outcome: 'incomplete',
      executionId,
      jobId,
      jobState: rec.job?.state,
      proofAccepted,
      usageRecordDeleted: false,
      failedJobRemoved: false,
      accountingEvidence,
      automaticRetryCount: 0,
    };
  }

  if (ports.connectNetwork) {
    await boundCall('connect', CONNECT_TIMEOUT_MS, (signal) => ports.connectNetwork!(signal), 'did_not_occur');
  }

  const executionId = ports.randomUUID();
  const submittedAt = ports.nowIso();
  const nowMs = ports.nowMs ?? (() => Date.now());
  log(JSON.stringify({ event: 'stub_identifiers_recorded', executionId, automaticRetryForbidden: true }));

  const payload = buildStubPayload({ executionId, fixtures, submittedAt });
  const proof = createHarnessEntitlementProof({
    executionId,
    userId: fixtures.userId,
    apiKeyId: fixtures.apiKeyId,
    issuedAt: submittedAt,
    payloadWithoutProof: payload,
    secret: fixtures.hmacSecret,
  });
  const localVerify = verifyHarnessEntitlementProof(
    { ...payload, harnessEntitlementProof: proof },
    fixtures.hmacSecret,
  );
  if (!localVerify.accepted) {
    throw new CanaryPrepError('HMAC_PREFLIGHT_FAILED', 'Local HMAC preflight rejected the constructed proof');
  }

  log(
    JSON.stringify(
      redactSecrets(
        {
          event: 'stub_payload_prepared',
          executionId,
          provider: 'test-harness-stub',
          ingress: 'STUB_DIRECT_QUEUE_WITH_CONTRACT_PROOF',
          jobOptions: REGISTERED_JOB_OPTIONS,
          proof: {
            version: proof.version,
            harnessVersion: proof.harnessVersion,
            payloadDigestPresent: proof.payloadDigest.length === 64,
            signaturePresent: proof.signature.length === 64,
            executionIdMatches: proof.executionId === executionId,
          },
        },
        secrets,
      ),
    ),
  );

  let insertAck: AckClass = 'did_not_occur';
  try {
    await boundCall(
      'insertUsageRecord',
      opMs,
      (signal) =>
        ports.insertUsageRecord(
          {
            executionId,
            apiKeyId: fixtures.apiKeyId,
            userId: fixtures.userId,
            sessionId: fixtures.sessionId,
            conversationId: fixtures.conversationId,
            provider: 'test-harness-stub',
            adapter: 'test-harness-stub',
            model: 'test-harness-stub',
            executionStatus: 'pending',
            metadata: {
              canary: 'AGENT-PLATFORM-EXEC-01C6A',
              kind: 'stub',
              agentId: fixtures.agentId,
              retainUsageRecord: true,
              retainZeroTokenCreditRow: true,
            },
          },
          signal,
        ),
      'ack_unknown',
    );
    insertAck = 'ack';
  } catch (err) {
    insertAck = 'ack_unknown';
    log(JSON.stringify({ event: 'insert_ack_unknown', executionId, automaticRetryForbidden: true }));
    throw new CanaryPrepError(
      'INSERT_ACK_UNKNOWN',
      'usage_records insert acknowledgment was lost; reconcile read-only by executionId; do not submit another canary',
      'ack_unknown',
    );
  }

  let jobId: string | undefined;
  let enqueueAck: AckClass = 'did_not_occur';
  try {
    const job = await boundCall(
      'addJob',
      opMs,
      (signal) =>
        ports.addJob(
          {
            jobName: JOB_NAME,
            payload: { ...payload, harnessEntitlementProof: proof },
            options: { ...REGISTERED_JOB_OPTIONS },
          },
          signal,
        ),
      'ack_unknown',
    );
    if (!job?.id) {
      enqueueAck = 'ack_unknown';
      throw new CanaryPrepError(
        'ENQUEUE_ACK_UNKNOWN',
        'Queue add returned no job id; reconcile read-only by executionId; do not enqueue again',
        'ack_unknown',
      );
    }
    jobId = job.id;
    enqueueAck = 'ack';
    log(JSON.stringify({ event: 'stub_enqueued', executionId, jobId }));
  } catch (err) {
    enqueueAck = 'ack_unknown';
    log(
      JSON.stringify({
        event: 'enqueue_ack_unknown',
        executionId,
        automaticRetryForbidden: true,
      }),
    );
    throw new CanaryPrepError(
      'ENQUEUE_ACK_UNKNOWN',
      'Queue add acknowledgment was lost; reconcile read-only by executionId; do not submit another canary',
      'ack_unknown',
    );
  }

  const deadline = nowMs() + fixtures.waitMs;
  let jobObs: JobObservation = { state: 'waiting' };
  let ledger: LedgerObservation | undefined;
  try {
    while (remainingMs(deadline, nowMs) > 0) {
      const jobBudget = Math.min(opMs, remainingMs(deadline, nowMs));
      if (jobId) {
        jobObs = await boundCall(
          'getJobObservation',
          jobBudget,
          (signal) => ports.getJobObservation(jobId as string, signal),
          'did_not_occur',
        );
      } else if (ports.findJobByExecutionId) {
        jobObs =
          (await boundCall(
            'findJobByExecutionId',
            jobBudget,
            (signal) => ports.findJobByExecutionId!(executionId, signal),
            'did_not_occur',
          )) ?? { state: 'missing' };
      }
      const ledgerBudget = Math.min(opMs, remainingMs(deadline, nowMs));
      ledger = await boundCall(
        'observeLedger',
        ledgerBudget,
        (signal) => ports.observeLedger(executionId, signal),
        'did_not_occur',
      );
      if (settledJob(jobObs, ledger) && remainingMs(deadline, nowMs) >= 0) {
        break;
      }
      const waitBudget = Math.min(POLL_INTERVAL_MS, remainingMs(deadline, nowMs));
      if (waitBudget <= 0) {
        break;
      }
      await boundCall('pollWait', waitBudget, (signal) => ports.wait(waitBudget, signal), 'did_not_occur');
    }
  } catch (err) {
    if (err instanceof CanaryPrepError && err.code === 'TIMEOUT') {
      throw new CanaryPrepError(
        'TIMEOUT',
        `Stub observation exceeded bounded wait (executionId recorded; submission ack was ${enqueueAck})`,
        enqueueAck,
      );
    }
    throw err;
  }

  if (!settledJob(jobObs, ledger) || remainingMs(deadline, nowMs) < 0) {
    throw new CanaryPrepError(
      'TIMEOUT',
      'Stub job did not settle within the bounded wait; submission occurred; this is not proof of non-submission',
      'ack',
    );
  }

  const parsed = parseJobFailedReason(jobObs.failedReason);
  const executionStatus =
    ledger?.executionStatus ??
    (jobObs.state === 'completed' || (jobObs.state === 'missing' && ledger?.executionStatus === 'completed')
      ? 'completed'
      : jobObs.state === 'failed'
        ? 'failed'
        : undefined);
  const proofAccepted = deriveProofAcceptance({
    entitlementCode: parsed.entitlementCode,
    executionStatus,
    jobState: jobObs.state,
    routingFailReason: parsed.routingFailReason,
  });
  const accountingEvidence = ledger
    ? assessZeroTokenAccounting({ ...ledger, executionId })
    : 'unknown';

  let outcome: StubCanaryResult['outcome'];
  if (accountingEvidence === 'fail_nonzero') {
    outcome = 'failed';
  } else if (executionStatus === 'completed' || jobObs.state === 'completed' || (jobObs.state === 'missing' && executionStatus === 'completed')) {
    if (proofAccepted !== 'accepted' || accountingEvidence !== 'pass') {
      outcome = 'incomplete';
    } else {
      outcome = 'completed';
    }
  } else if (executionStatus === 'failed' || jobObs.state === 'failed') {
    outcome = proofAccepted === 'rejected' ? 'failed' : proofAccepted === 'unknown' ? 'incomplete' : 'failed';
  } else {
    outcome = 'incomplete';
  }

  return {
    outcome,
    executionId,
    jobId,
    jobState: jobObs.state,
    proofAccepted,
    usageRecordDeleted: false,
    failedJobRemoved: false,
    accountingEvidence,
    automaticRetryCount: 0,
    insertAck,
    enqueueAck,
  };
}

const USAGE_INSERT_SQL = `INSERT INTO usage_records
        (execution_id, api_key_id, user_id, session_id, conversation_id,
         provider, adapter, model, execution_status, metadata)
       VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6, $7, $8, 'pending', $9::jsonb)`;

const USAGE_SELECT_SQL = `SELECT execution_id, execution_status, tokens_used, metadata, provider, adapter, model
       FROM usage_records WHERE execution_id = $1`;

const DEDUCTION_SELECT_SQL = `SELECT id, source_event_id, execution_id, applied_credits, requested_credits,
              balance_before, balance_after, status
       FROM credit_deduction_records
       WHERE source_event_id = $1 OR execution_id::text = $1`;

function mapDeductionRow(d: Record<string, unknown>): DeductionRowObservation {
  const executionIdRaw = d.execution_id;
  return {
    id: typeof d.id === 'string' ? d.id : null,
    sourceEventId: typeof d.source_event_id === 'string' ? d.source_event_id : null,
    executionId:
      typeof executionIdRaw === 'string'
        ? executionIdRaw
        : executionIdRaw != null
          ? String(executionIdRaw)
          : null,
    appliedCredits: d.applied_credits == null ? null : Number(d.applied_credits),
    requestedCredits: d.requested_credits == null ? null : Number(d.requested_credits),
    balanceBefore: d.balance_before == null ? null : Number(d.balance_before),
    balanceAfter: d.balance_after == null ? null : Number(d.balance_after),
  };
}

function mapLedgerRows(
  usageRows: Array<Record<string, unknown>>,
  deductionRows: Array<Record<string, unknown>>,
): LedgerObservation | undefined {
  if (usageRows.length === 0) {
    return undefined;
  }
  const u = usageRows[0];
  const meta = (u.metadata ?? {}) as Record<string, unknown>;
  const mappedDeductions = deductionRows.map(mapDeductionRow);
  const d = mappedDeductions[0];
  return {
    executionStatus: typeof u.execution_status === 'string' ? u.execution_status : null,
    tokensUsed: u.tokens_used == null ? null : Number(u.tokens_used),
    provider: typeof u.provider === 'string' ? u.provider : null,
    adapter: typeof u.adapter === 'string' ? u.adapter : null,
    model: typeof u.model === 'string' ? u.model : null,
    agentId: typeof meta.agentId === 'string' ? meta.agentId : null,
    deductionPresent: mappedDeductions.length > 0,
    appliedCredits: d ? d.appliedCredits ?? null : null,
    balanceBefore: d ? d.balanceBefore ?? null : null,
    balanceAfter: d ? d.balanceAfter ?? null : null,
    sourceEventId: d ? d.sourceEventId ?? null : null,
    deductionRows: mappedDeductions,
    usageRowCount: usageRows.length,
  };
}

export async function findJobByExecutionIdFromQueue(
  queue: QueueLike,
  executionId: string,
): Promise<JobObservation> {
  if (!queue.getJobs) {
    return { state: 'missing', failedReason: null };
  }
  const jobs = await queue.getJobs([...BULLMQ_JOB_TYPES], 0, 199);
  const matches = jobs.filter((job) => job.data?.executionId === executionId);
  if (matches.length === 0) {
    return { state: 'missing', failedReason: null };
  }
  if (matches.length > 1) {
    return { state: 'unknown', failedReason: null };
  }
  const job = matches[0];
  const rawState = await job.getState();
  const state = (
    ['waiting', 'active', 'completed', 'failed', 'delayed'].includes(rawState) ? rawState : 'unknown'
  ) as JobState;
  return {
    state,
    failedReason: job.failedReason ?? null,
    executionIdFromJob: job.data?.executionId,
  };
}

function signalAwareWait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CanaryPrepError('TIMEOUT', 'wait aborted', 'did_not_occur'));
      return;
    }
    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new CanaryPrepError('TIMEOUT', 'wait aborted', 'did_not_occur'));
    };
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function normalizePgResult(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as Array<Record<string, unknown>>;
  }
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: Array<Record<string, unknown>> }).rows;
  }
  return [];
}

function resolveShutdownTimeoutMs(env: NodeJS.Dict<string>): number {
  const raw = env.AISB_01C6A_SHUTDOWN_TIMEOUT_MS;
  if (raw !== undefined && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 20 && n <= 30000) return Math.floor(n);
  }
  return SHUTDOWN_TIMEOUT_MS;
}

export function createStubLiveAdapters(input: {
  env: NodeJS.Dict<string>;
  fixtures: StubFixtures;
  log: (line: string) => void;
  nowIso?: () => string;
  randomUUID?: () => string;
  clients?: { pg: PgLike; queue: QueueLike; redis?: RedisLike };
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}): { ports: StubPorts; shutdown: () => Promise<ShutdownResult> } {
  const live = readFlag(input.env, 'AISB_01C6A_LIVE_SUBMIT');
  const staging = readFlag(input.env, 'AISB_01C6A_STAGING_EXECUTION_AUTHORIZED');
  const reconcile = readFlag(input.env, 'AISB_01C6A_RECONCILE');
  if ((!live && !reconcile) || !staging) {
    throw new CanaryPrepError(
      'LIVE_SUBMIT_BLOCKED_IN_PREPARATION',
      'Concrete adapters require live or reconcile plus AISB_01C6A_STAGING_EXECUTION_AUTHORIZED',
    );
  }
  if (readFlag(input.env, 'AISB_01C6A_ISOLATED_MOCK') && !input.clients) {
    throw new CanaryPrepError('SUBMISSION_AMBIGUITY', 'Isolated mock must not construct real network clients');
  }
  assertLiveTargets(input.fixtures);

  let pg = input.clients?.pg;
  let queue = input.clients?.queue;
  let redis = input.clients?.redis;
  let constructed = false;

  const connectNetwork = async (signal?: AbortSignal) => {
    if (input.clients) {
      await boundCall('pg.connect', CONNECT_TIMEOUT_MS, () => abortable(signal, pg!.connect()), 'did_not_occur');
      if (redis?.connect) {
        await boundCall('redis.connect', CONNECT_TIMEOUT_MS, () => abortable(signal, redis!.connect!()), 'did_not_occur');
      }
      return;
    }
    constructed = true;
    const PgClient = require('pg').Client as new (opts: {
      connectionString: string;
      connectionTimeoutMillis?: number;
    }) => PgLike;
    const { Queue } = require('bullmq') as { Queue: new (name: string, opts: { connection: unknown }) => QueueLike };
    const Redis = require('ioredis') as {
      new (url: string, opts: Record<string, unknown>): RedisLike & { status?: string };
    };
    pg = new PgClient({
      connectionString: input.fixtures.databaseUrl as string,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    });
    redis = new Redis(input.fixtures.redisUrl as string, {
      maxRetriesPerRequest: null,
      connectTimeout: CONNECT_TIMEOUT_MS,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    await boundCall('pg.connect', CONNECT_TIMEOUT_MS, () => abortable(signal, pg!.connect()), 'did_not_occur');
    if (redis.connect) {
      await boundCall('redis.connect', CONNECT_TIMEOUT_MS, () => abortable(signal, redis!.connect!()), 'did_not_occur');
    }
    queue = new Queue(QUEUE_NAME, { connection: redis });
  };

  const shutdown = async (signal?: AbortSignal): Promise<ShutdownResult> => {
    const shutdownMs = resolveShutdownTimeoutMs(input.env);
    const settled = new Set<string>();
    const forced: string[] = [];
    const failures: string[] = [];
    const tasks: Promise<void>[] = [];
    if (queue) {
      tasks.push(queue.close().then(() => { settled.add('queue'); }, () => { failures.push('queue'); }) as Promise<void>);
    }
    if (redis) {
      tasks.push(Promise.resolve(redis.quit()).then(() => { settled.add('redis'); }, () => { failures.push('redis'); }) as Promise<void>);
    }
    if (pg) {
      tasks.push(pg.end().then(() => { settled.add('pg'); }, () => { failures.push('pg'); }) as Promise<void>);
    }
    let gracefulDone = false;
    try {
      await boundCall('shutdown', shutdownMs, () => abortable(signal, Promise.all(tasks)), 'did_not_occur');
      gracefulDone = true;
    } catch {
      // graceful timeout
    }
    if (!gracefulDone) {
      if (redis && !settled.has('redis')) {
        try { redis.disconnect?.(); forced.push('redis'); settled.add('redis'); } catch { /* force failed */ }
      }
    }
    const allClients: string[] = [];
    if (queue) allClients.push('queue');
    if (redis) allClients.push('redis');
    if (pg) allClients.push('pg');
    const pending = allClients.filter(c => !settled.has(c));
    const complete = pending.length === 0;
    if (!complete || failures.length > 0) {
      input.log(JSON.stringify({ event: 'shutdown_cleanup_incomplete', failures, forcedClients: forced, pendingClients: pending }));
    }
    void constructed;
    return { complete, pendingClients: pending, forcedClients: forced };
  };

  const ports: StubPorts = {
    env: input.env,
    nowIso: input.nowIso ?? (() => new Date().toISOString()),
    randomUUID: input.randomUUID ?? (() => randomUUID()),
    log: input.log,
    connectNetwork,
    shutdown,
    wait: input.wait ?? signalAwareWait,
    insertUsageRecord: async (row, signal) => {
      const result = await abortable(
        signal,
        pg!.query(USAGE_INSERT_SQL, [
          row.executionId,
          row.apiKeyId,
          row.userId,
          row.sessionId,
          row.conversationId,
          row.provider,
          row.adapter,
          row.model,
          JSON.stringify(row.metadata ?? {}),
        ]),
      );
      void result;
    },
    addJob: async (call, signal) => {
      if (!queue?.add) {
        throw new CanaryPrepError('ENQUEUE_ACK_UNKNOWN', 'queue.add is not available', 'ack_unknown');
      }
      const result = await abortable(signal, queue.add(call.jobName, call.payload, call.options));
      const rawId = result?.id;
      if (rawId == null || String(rawId).trim() === '' || String(rawId) === 'undefined' || String(rawId) === 'null') {
        throw new CanaryPrepError(
          'ENQUEUE_ACK_UNKNOWN',
          'Queue add returned missing or invalid job id; reconcile read-only by executionId; do not enqueue again',
          'ack_unknown',
        );
      }
      return { id: String(rawId) };
    },
    getJobObservation: async (jobId, signal) => {
      const job = await abortable(signal, queue!.getJob(jobId));
      if (!job) {
        return { state: 'missing', failedReason: null };
      }
      const rawState = await abortable(signal, job.getState());
      const state = (
        ['waiting', 'active', 'completed', 'failed', 'delayed'].includes(rawState) ? rawState : 'unknown'
      ) as JobState;
      return {
        state,
        failedReason: job.failedReason ?? null,
        executionIdFromJob: job.data?.executionId,
      };
    },
    findJobByExecutionId: async (executionId, signal) =>
      abortable(signal, findJobByExecutionIdFromQueue(queue!, executionId)),
    observeLedger: async (executionId, signal) => {
      const usage = normalizePgResult(await abortable(signal, pg!.query(USAGE_SELECT_SQL, [executionId])));
      const deduction = normalizePgResult(await abortable(signal, pg!.query(DEDUCTION_SELECT_SQL, [executionId])));
      return mapLedgerRows(usage, deduction);
    },
  };
  return { ports, shutdown };
}

function neverResolve<T = never>(): Promise<T> {
  return new Promise(() => undefined);
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`SELF_TEST_FAIL: ${message}`);
  }
}

function baseEnv(): NodeJS.Dict<string> {
  return {
    AISB_01C6A_ISOLATED_MOCK: '1',
    AISB_01C6A_USER_ID: '7f772841-7844-401b-a3da-e928b0c7b79c',
    AISB_01C6A_API_KEY_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    AISB_01C6A_SESSION_ID: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    AISB_01C6A_CONVERSATION_ID: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    AISB_01C6A_AGENT_ID: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    AISB_01C6A_HMAC_SECRET: 'unit-test-hmac-secret',
    AISB_01C6A_WAIT_MS: '80',
    AISB_01C6A_OP_TIMEOUT_MS: '40',
  };
}

function passingLedger(overrides?: Partial<LedgerObservation>): LedgerObservation {
  const executionId = '11111111-1111-4111-8111-111111111111';
  const row: DeductionRowObservation = {
    sourceEventId: executionId,
    executionId,
    appliedCredits: 0,
    balanceBefore: 10,
    balanceAfter: 10,
  };
  return {
    executionStatus: 'completed',
    tokensUsed: 0,
    deductionPresent: true,
    appliedCredits: 0,
    balanceBefore: 10,
    balanceAfter: 10,
    sourceEventId: executionId,
    usageRowCount: 1,
    deductionRows: [row],
    ...overrides,
  };
}

function hangUntilAbort(
  flag: { insert: boolean; enqueue: boolean; observe: boolean },
  key: 'insert' | 'enqueue' | 'observe',
  signal?: AbortSignal,
): Promise<never> {
  return new Promise((_, reject) => {
    const onAbort = () => {
      flag[key] = true;
      reject(new CanaryPrepError('TIMEOUT', 'aborted', 'ack_unknown'));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return signalAwareWait(ms, signal);
}

function makeMemoryPorts(
  env: NodeJS.Dict<string>,
  opts?: {
    jobSequence?: JobObservation[];
    insertHang?: boolean;
    enqueueHang?: boolean;
    observeHang?: boolean;
    insertCommitThenDisconnect?: boolean;
    enqueueCommitThenDisconnect?: boolean;
    observeDelayMs?: number;
    enqueueId?: string | undefined;
    failedReason?: string;
    ledger?: LedgerObservation | (() => LedgerObservation | undefined);
    jobsByExecutionId?: JobObservation;
  },
): {
  ports: StubPorts;
  calls: { inserts: number; adds: number };
  cancelled: { insert: boolean; enqueue: boolean; observe: boolean };
} {
  const calls = { inserts: 0, adds: 0 };
  const cancelled = { insert: false, enqueue: false, observe: false };
  const sequence = opts?.jobSequence?.slice() ?? [
    { state: 'waiting' as JobState },
    { state: 'active' as JobState },
    { state: 'completed' as JobState },
  ];
  let idx = 0;
  const ports: StubPorts = {
    env,
    nowIso: () => '2026-09-10T09:00:00.000Z',
    randomUUID: () => '11111111-1111-4111-8111-111111111111',
    log: () => undefined,
    insertUsageRecord: async (_row, signal) => {
      calls.inserts += 1;
      if (opts?.insertHang) {
        return hangUntilAbort(cancelled, 'insert', signal);
      }
      if (opts?.insertCommitThenDisconnect) {
        const err = new Error('read ECONNRESET');
        (err as NodeJS.ErrnoException).code = 'ECONNRESET';
        throw err;
      }
    },
    addJob: async (_call, signal) => {
      calls.adds += 1;
      if (opts?.enqueueHang) {
        return hangUntilAbort(cancelled, 'enqueue', signal);
      }
      if (opts?.enqueueCommitThenDisconnect) {
        const err = new Error('read ECONNRESET');
        (err as NodeJS.ErrnoException).code = 'ECONNRESET';
        throw err;
      }
      if (opts && 'enqueueId' in opts && opts.enqueueId === undefined) {
        return { id: undefined as unknown as string };
      }
      return { id: 'stub-job-1' };
    },
    getJobObservation: async (_jobId, signal) => {
      if (opts?.observeHang) {
        return hangUntilAbort(cancelled, 'observe', signal);
      }
      if (opts?.observeDelayMs) {
        await delay(opts.observeDelayMs, signal);
      }
      const next = sequence[Math.min(idx, sequence.length - 1)];
      idx += 1;
      return { ...next, failedReason: opts?.failedReason ?? next.failedReason ?? null };
    },
    findJobByExecutionId: async (_executionId, signal) => {
      if (opts?.observeHang) {
        return hangUntilAbort(cancelled, 'observe', signal);
      }
      return opts?.jobsByExecutionId;
    },
    observeLedger: async (_executionId, signal) => {
      if (opts?.observeHang) {
        return hangUntilAbort(cancelled, 'observe', signal);
      }
      if (opts?.observeDelayMs) {
        await delay(opts.observeDelayMs, signal);
      }
      if (typeof opts?.ledger === 'function') {
        return opts.ledger();
      }
      return opts?.ledger ?? passingLedger();
    },
    wait: async (_ms, signal) => delay(0, signal),
  };
  return { ports, calls, cancelled };
}

export async function runStubIsolatedSelfTests(): Promise<string[]> {
  const passed: string[] = [];

  try {
    classifySubmissionMode({ AISB_01C6A_ISOLATED_MOCK: '1', AISB_01C6A_LIVE_SUBMIT: 'YES' });
    throw new Error('expected ambiguity');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'SUBMISSION_AMBIGUITY', 'flag ambiguity');
    passed.push('submission-ambiguity-flags');
  }

  try {
    classifySubmissionMode({ AISB_01C6A_LIVE_SUBMIT: 'YES', AISB_01C6A_RECONCILE: 'YES' });
    throw new Error('expected ambiguity');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'SUBMISSION_AMBIGUITY', 'live+reconcile ambiguity');
    passed.push('submission-ambiguity-lost-ack-no-retry-mode');
  }

  try {
    const { ports } = makeMemoryPorts({ AISB_01C6A_ISOLATED_MOCK: '1' });
    await runStubCanary(ports);
    throw new Error('expected missing fixtures');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'MISSING_FIXTURES', 'missing fixtures');
    passed.push('missing-fixtures');
  }

  try {
    loadStubFixtures({ ...baseEnv(), AISB_01C6A_API_KEY_ID: REVOKED_KEY_ID });
    throw new Error('expected revoked exclusion');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'REVOKED_KEY_EXCLUDED', 'revoked key excluded');
    passed.push('revoked-key-excluded');
  }

  const refuse = await runStubCanary(makeMemoryPorts({}).ports);
  assert(refuse.outcome === 'refused', 'live refuse without LIVE_SUBMIT');
  passed.push('live-refuse');

  try {
    await runStubCanary(
      makeMemoryPorts({
        ...baseEnv(),
        AISB_01C6A_ISOLATED_MOCK: '1',
        AISB_01C6A_LIVE_SUBMIT: undefined,
        AISB_01C6A_WAIT_MS: '30',
      }, { observeHang: true }).ports,
    );
    throw new Error('expected timeout');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'TIMEOUT', 'stalled poll');
    passed.push('stalled-observation-timeout');
  }

  const { ports: insertHangPorts, calls: insertCalls } = makeMemoryPorts(baseEnv(), { insertHang: true });
  try {
    await runStubCanary(insertHangPorts);
    throw new Error('expected insert ack unknown');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'INSERT_ACK_UNKNOWN', 'lost insert ack');
    assert(err instanceof CanaryPrepError && err.ackClass === 'ack_unknown', 'insert ack class');
    assert(insertCalls.adds === 0, 'no enqueue after lost insert ack');
    passed.push('lost-insert-acknowledgment');
  }

  const { ports: enqueueHangPorts, calls: enqueueCalls } = makeMemoryPorts(baseEnv(), { enqueueHang: true });
  try {
    await runStubCanary(enqueueHangPorts);
    throw new Error('expected enqueue ack unknown');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'ENQUEUE_ACK_UNKNOWN', 'lost enqueue ack');
    assert(enqueueCalls.adds === 1, 'enqueue attempted once');
    passed.push('lost-enqueue-acknowledgment');
  }

  const failedHmac = await runStubCanary(
    makeMemoryPorts(baseEnv(), {
      jobSequence: [{ state: 'failed' }],
      failedReason: 'Harness entitlement proof verification failed (HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE)',
      ledger: {
        executionStatus: 'failed',
        tokensUsed: null,
        deductionPresent: false,
      },
    }).ports,
  );
  assert(failedHmac.outcome === 'failed', 'hmac fail outcome');
  assert(failedHmac.proofAccepted === 'rejected', 'failed HMAC is not proofAccepted=true');
  passed.push('failed-hmac-verification');

  const failedUnknown = await runStubCanary(
    makeMemoryPorts(baseEnv(), {
      jobSequence: [{ state: 'failed' }],
      failedReason: 'generic boom',
      ledger: { executionStatus: 'failed', tokensUsed: null, deductionPresent: false },
    }).ports,
  );
  assert(failedUnknown.proofAccepted === 'unknown', 'failed stub without correlated proof evidence');
  assert(failedUnknown.outcome === 'incomplete', 'missing proof evidence is incomplete');
  passed.push('failed-stub-proof-unknown');

  const disappeared = await runStubCanary(
    makeMemoryPorts(baseEnv(), {
      jobSequence: [{ state: 'missing' }],
      ledger: passingLedger({
        balanceBefore: 5,
        balanceAfter: 5,
        deductionRows: [
          {
            sourceEventId: '11111111-1111-4111-8111-111111111111',
            executionId: '11111111-1111-4111-8111-111111111111',
            appliedCredits: 0,
            balanceBefore: 5,
            balanceAfter: 5,
          },
        ],
      }),
    }).ports,
  );
  assert(disappeared.outcome === 'completed', 'completed job disappearance uses ledger');
  assert(disappeared.proofAccepted === 'accepted', 'completed ledger implies proof accepted');
  assert(disappeared.accountingEvidence === 'pass', 'zero-token row retained and checked');
  assert(disappeared.usageRecordDeleted === false, 'usage retained');
  assert(disappeared.failedJobRemoved === false, 'failed job not removed');
  passed.push('completed-job-disappearance-ledger');

  const logs: string[] = [];
  const { ports: happyPorts, calls } = makeMemoryPorts(baseEnv());
  happyPorts.log = (line) => logs.push(line);
  const happy = await runStubCanary(happyPorts);
  assert(happy.outcome === 'completed', 'happy completed');
  assert(happy.proofAccepted === 'accepted', 'happy proof from completed evidence');
  assert(calls.inserts === 1 && calls.adds === 1, 'single insert/enqueue');
  assert(happy.automaticRetryCount === 0, 'no automatic retry');
  const joined = logs.join('\n');
  assert(!joined.includes('unit-test-hmac-secret'), 'hmac redacted');
  passed.push('happy-path-retain-and-redact');

  const leak = sanitizeUntrustedError(
    new Error('connect ECONNREFUSED redis://:super-secret-value@127.0.0.1:6379 Authorization: Bearer abcdefghijklmnop'),
    ['super-secret-value', 'abcdefghijklmnop'],
  );
  assert(!leak.includes('super-secret-value'), 'secret stripped from error');
  assert(!leak.includes('abcdefghijklmnop'), 'bearer stripped from error');
  assert(!leak.includes('redis://'), 'url stripped from error');
  const redactedUrl = redactSecrets('postgres://aisandbox:hunter2@db.example:5432/aisandbox', ['hunter2']);
  assert(String(redactedUrl).includes('[REDACTED]'), 'url password redacted');
  assert(!String(redactedUrl).includes('hunter2'), 'password gone');
  passed.push('secrets-embedded-in-errors');

  const localBad = verifyHarnessEntitlementProof(
    {
      ...buildStubPayload({
        executionId: '11111111-1111-4111-8111-111111111111',
        fixtures: loadStubFixtures(baseEnv()),
        submittedAt: '2026-09-10T09:00:00.000Z',
      }),
      harnessEntitlementProof: {
        version: 1,
        executionId: '11111111-1111-4111-8111-111111111111',
        userId: '7f772841-7844-401b-a3da-e928b0c7b79c',
        apiKeyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        harnessVersion: 'v1',
        issuedAt: '2026-09-10T09:00:00.000Z',
        payloadDigest: 'a'.repeat(64),
        signature: 'b'.repeat(64),
      },
    },
    'unit-test-hmac-secret',
  );
  assert(localBad.accepted === false, 'local verify rejects bad hmac');
  passed.push('local-hmac-verify-reject');

  const liveEnv: NodeJS.Dict<string> = {
    ...baseEnv(),
    AISB_01C6A_ISOLATED_MOCK: undefined,
    AISB_01C6A_LIVE_SUBMIT: 'YES',
    AISB_01C6A_STAGING_EXECUTION_AUTHORIZED: 'YES',
    REDIS_URL: 'redis://:mockpass@redis.example:6379',
    DATABASE_URL: 'postgres://aisandbox:mockpass@db.example:5432/aisandbox',
  };
  const fixtures = loadStubFixtures(liveEnv);
  let pgConnects = 0;
  let insertedSql = '';
  const mockPg: PgLike = {
    connect: async () => {
      pgConnects += 1;
    },
    query: async (sql, params) => {
      if (sql.includes('INSERT INTO usage_records')) {
        insertedSql = sql;
        assert(params?.[0] === '11111111-1111-4111-8111-111111111111', 'insert uses recorded executionId');
        return { rows: [] };
      }
      if (sql.includes('FROM usage_records')) {
        return {
          rows: [
            {
              execution_id: params?.[0],
              execution_status: 'completed',
              tokens_used: 0,
              metadata: { agentId: fixtures.agentId },
              provider: 'test-harness-stub',
              adapter: 'test-harness-stub',
              model: 'test-harness-stub',
            },
          ],
        };
      }
      if (sql.includes('credit_deduction_records')) {
        return {
          rows: [
            {
              source_event_id: params?.[0],
              execution_id: params?.[0],
              applied_credits: 0,
              requested_credits: 0,
              balance_before: 8,
              balance_after: 8,
              status: 'applied',
            },
          ],
        };
      }
      return { rows: [] };
    },
    end: async () => undefined,
  };
  const mockQueue: QueueLike = {
    add: async (name, _payload, options) => {
      assert(name === JOB_NAME, 'job name');
      assert(options.attempts === 1 && options.removeOnComplete === true && options.removeOnFail === false, 'job options');
      return { id: 'stub-job-1' };
    },
    getJob: async () => ({
      id: 'stub-job-1',
      data: { executionId: '11111111-1111-4111-8111-111111111111' },
      getState: async () => 'completed',
    }),
    getJobs: async () => [
      {
        id: 'stub-job-1',
        data: { executionId: '11111111-1111-4111-8111-111111111111' },
        getState: async () => 'completed',
      },
    ],
    close: async () => undefined,
  };
  const handle = createStubLiveAdapters({
    env: liveEnv,
    fixtures,
    log: () => undefined,
    nowIso: () => '2026-09-10T09:00:00.000Z',
    randomUUID: () => '11111111-1111-4111-8111-111111111111',
    clients: { pg: mockPg, queue: mockQueue },
    wait: async () => undefined,
  });
  const adapterResult = await runStubCanary(handle.ports);
  assert(pgConnects === 1, 'pg connected via adapter');
  assert(insertedSql.includes('INSERT INTO usage_records'), '804f8983 usage_records insert');
  assert(adapterResult.outcome === 'completed', 'mocked live adapter completed');
  assert(adapterResult.accountingEvidence === 'pass', 'zero-token accounting via adapter');
  await handle.shutdown();
  passed.push('concrete-adapter-mocked-clients');

  try {
    createStubLiveAdapters({
      env: { ...liveEnv, AISB_01C6A_STAGING_EXECUTION_AUTHORIZED: undefined },
      fixtures,
      log: () => undefined,
    });
    throw new Error('expected blocked');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'LIVE_SUBMIT_BLOCKED_IN_PREPARATION', 'gate');
    passed.push('live-adapter-gate');
  }

  const recEnv: NodeJS.Dict<string> = {
    ...liveEnv,
    AISB_01C6A_LIVE_SUBMIT: undefined,
    AISB_01C6A_RECONCILE: 'YES',
    AISB_01C6A_RECONCILE_EXECUTION_ID: '11111111-1111-4111-8111-111111111111',
    AISB_01C6A_RECONCILE_JOB_ID: 'stub-job-1',
  };
  const recHandle = createStubLiveAdapters({
    env: recEnv,
    fixtures: loadStubFixtures(recEnv),
    log: () => undefined,
    clients: { pg: mockPg, queue: mockQueue },
  });
  const rec = await runStubCanary(recHandle.ports);
  assert(rec.executionId === '11111111-1111-4111-8111-111111111111', 'reconcile uses recorded id');
  assert(rec.automaticRetryCount === 0, 'reconcile does not submit');
  passed.push('readonly-reconciliation-path');

  assert(
    assessZeroTokenAccounting({ deductionPresent: true }) === 'incomplete',
    'deductionPresent true without rows is incomplete',
  );
  assert(
    assessZeroTokenAccounting({
      executionId: '11111111-1111-4111-8111-111111111111',
      tokensUsed: 0,
      deductionPresent: true,
      usageRowCount: 2,
      deductionRows: [
        {
          sourceEventId: '11111111-1111-4111-8111-111111111111',
          executionId: '11111111-1111-4111-8111-111111111111',
          appliedCredits: 0,
          balanceBefore: 1,
          balanceAfter: 1,
        },
      ],
    }) === 'conflicting',
    'conflicting usage rows',
  );
  assert(
    assessZeroTokenAccounting({
      executionId: '11111111-1111-4111-8111-111111111111',
      tokensUsed: 0,
      deductionPresent: true,
      deductionRows: [
        {
          sourceEventId: '11111111-1111-4111-8111-111111111111',
          executionId: '11111111-1111-4111-8111-111111111111',
          appliedCredits: 0,
          balanceBefore: 1,
          balanceAfter: 1,
        },
        {
          sourceEventId: '11111111-1111-4111-8111-111111111111',
          executionId: '11111111-1111-4111-8111-111111111111',
          appliedCredits: 0,
          balanceBefore: 2,
          balanceAfter: 2,
        },
      ],
    }) === 'conflicting',
    'conflicting deduction rows',
  );
  assert(
    assessZeroTokenAccounting({
      executionId: '11111111-1111-4111-8111-111111111111',
      tokensUsed: null,
      deductionPresent: true,
      deductionRows: [
        {
          sourceEventId: '11111111-1111-4111-8111-111111111111',
          executionId: '11111111-1111-4111-8111-111111111111',
          appliedCredits: 0,
          balanceBefore: 1,
          balanceAfter: 1,
        },
      ],
    }) === 'incomplete',
    'null tokens incomplete',
  );
  assert(
    assessZeroTokenAccounting({
      executionId: '11111111-1111-4111-8111-111111111111',
      tokensUsed: Number.NaN,
      deductionPresent: true,
      deductionRows: [
        {
          sourceEventId: '11111111-1111-4111-8111-111111111111',
          executionId: '11111111-1111-4111-8111-111111111111',
          appliedCredits: 0,
          balanceBefore: 1,
          balanceAfter: 1,
        },
      ],
    }) === 'incomplete',
    'malformed tokens incomplete',
  );
  assert(
    assessZeroTokenAccounting({
      executionId: '11111111-1111-4111-8111-111111111111',
      tokensUsed: 0,
      deductionPresent: true,
      deductionRows: [
        {
          sourceEventId: '99999999-9999-4999-8999-999999999999',
          executionId: '99999999-9999-4999-8999-999999999999',
          appliedCredits: 0,
          balanceBefore: 1,
          balanceAfter: 1,
        },
      ],
    }) === 'incomplete',
    'mismatched deduction identity incomplete',
  );
  passed.push('complete-accounting-evidence');

  const incompleteAccounting = await runStubCanary(
    makeMemoryPorts(baseEnv(), {
      jobSequence: [{ state: 'completed' }],
      ledger: {
        executionStatus: 'completed',
        tokensUsed: 0,
        deductionPresent: true,
      },
    }).ports,
  );
  assert(incompleteAccounting.outcome === 'incomplete', 'missing deduction rows cannot complete');
  assert(incompleteAccounting.accountingEvidence === 'incomplete', 'accounting incomplete');
  passed.push('completed-requires-complete-accounting');

  const { ports: insertResetPorts, calls: insertResetCalls } = makeMemoryPorts(baseEnv(), {
    insertCommitThenDisconnect: true,
  });
  try {
    await runStubCanary(insertResetPorts);
    throw new Error('expected insert ack unknown after ECONNRESET');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'INSERT_ACK_UNKNOWN', 'insert reset unknown');
    assert(insertResetCalls.adds === 0, 'no enqueue after insert reset');
    passed.push('insert-committed-then-disconnected');
  }

  const { ports: enqueueResetPorts, calls: enqueueResetCalls } = makeMemoryPorts(baseEnv(), {
    enqueueCommitThenDisconnect: true,
  });
  try {
    await runStubCanary(enqueueResetPorts);
    throw new Error('expected enqueue ack unknown after ECONNRESET');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'ENQUEUE_ACK_UNKNOWN', 'enqueue reset unknown');
    assert(enqueueResetCalls.adds === 1, 'enqueue attempted once');
    passed.push('enqueue-committed-then-disconnected');
  }

  const recNoJobEnv: NodeJS.Dict<string> = {
    ...liveEnv,
    AISB_01C6A_LIVE_SUBMIT: undefined,
    AISB_01C6A_RECONCILE: 'YES',
    AISB_01C6A_RECONCILE_EXECUTION_ID: '11111111-1111-4111-8111-111111111111',
  };
  const recNoJobQueue: QueueLike = {
    getJob: async () => null,
    getJobs: async (types) => {
      assert(types.includes('failed') && types.includes('completed'), 'bounded getJobs types');
      return [
        {
          id: 'found-by-execution',
          data: { executionId: '11111111-1111-4111-8111-111111111111' },
          failedReason: undefined,
          getState: async () => 'completed',
        },
      ];
    },
    close: async () => undefined,
  };
  const recNoJob = createStubLiveAdapters({
    env: recNoJobEnv,
    fixtures: loadStubFixtures(recNoJobEnv),
    log: () => undefined,
    clients: { pg: mockPg, queue: recNoJobQueue },
  });
  const recNoJobResult = await runStubCanary(recNoJob.ports);
  assert(recNoJobResult.jobState === 'completed', 'reconcile finds job by executionId');
  assert(recNoJobResult.automaticRetryCount === 0, 'reconcile does not generate a replacement');
  await recNoJob.shutdown();
  passed.push('reconcile-without-returned-job-id');

  try {
    await runStubCanary(
      makeMemoryPorts(
        { ...baseEnv(), AISB_01C6A_WAIT_MS: '20', AISB_01C6A_OP_TIMEOUT_MS: '50' },
        { observeDelayMs: 15, jobSequence: [{ state: 'completed' }] },
      ).ports,
    );
    throw new Error('expected deadline timeout');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'TIMEOUT', 'sequential delay exceeds remaining budget');
    passed.push('sequential-delay-deadline');
  }

  const hanging = makeMemoryPorts(baseEnv(), { insertHang: true });
  try {
    await runStubCanary(hanging.ports);
    throw new Error('expected hanging insert timeout');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'INSERT_ACK_UNKNOWN', 'hanging insert unknown');
    assert(hanging.cancelled.insert === true, 'timed-out insert client aborted');
    passed.push('hanging-client-cleanup');
  }

  const sdLiveEnv: NodeJS.Dict<string> = {
    ...liveEnv,
    AISB_01C6A_SHUTDOWN_TIMEOUT_MS: '80',
  };
  let sdDisconnects = 0;
  const sdLogs: string[] = [];
  const hangingPgSd: PgLike = {
    connect: async () => undefined,
    query: async (sql, params) => mockPg.query(sql, params),
    end: async () => neverResolve(),
  };
  const hangingQueueSd: QueueLike = {
    add: async (name, _payload, options) => {
      return { id: 'stub-job-1' };
    },
    getJob: async () => ({
      id: 'stub-job-1',
      data: { executionId: '11111111-1111-4111-8111-111111111111' },
      getState: async () => 'completed',
    }),
    getJobs: async () => [],
    close: async () => neverResolve(),
  };
  const hangingRedisSd: RedisLike = {
    quit: async () => neverResolve(),
    disconnect: () => { sdDisconnects += 1; },
  };
  const sdHandle = createStubLiveAdapters({
    env: sdLiveEnv,
    fixtures: loadStubFixtures(sdLiveEnv),
    log: (line) => sdLogs.push(line),
    nowIso: () => '2026-09-10T09:00:00.000Z',
    randomUUID: () => '11111111-1111-4111-8111-111111111111',
    clients: { pg: hangingPgSd, queue: hangingQueueSd, redis: hangingRedisSd },
    wait: async () => undefined,
  });
  const sdResult = await runStubCanary(sdHandle.ports);
  assert(sdResult.outcome === 'completed', 'primary outcome preserved despite hung clients');
  const sdShutdown = await sdHandle.shutdown();
  assert(sdDisconnects >= 1, 'redis forced disconnect after graceful timeout');
  assert(!sdShutdown.complete, 'shutdown incomplete with hanging clients');
  assert(sdShutdown.pendingClients.includes('pg'), 'pg still pending');
  assert(sdShutdown.pendingClients.includes('queue'), 'queue still pending');
  assert(sdShutdown.forcedClients.includes('redis'), 'redis was force-disconnected');
  const sdCleanupLog = sdLogs.find((l) => l.includes('shutdown_cleanup_incomplete'));
  assert(sdCleanupLog !== undefined, 'cleanup failure reported');
  assert(sdCleanupLog!.includes('"pg"'), 'pg pending reported');
  passed.push('shutdown-timeout-forced-disconnect');

  const noIdEnv: NodeJS.Dict<string> = {
    ...liveEnv,
    AISB_01C6A_SHUTDOWN_TIMEOUT_MS: '80',
  };
  const noIdQueue: QueueLike = {
    add: async () => ({ id: undefined }),
    getJob: async () => null,
    getJobs: async () => [],
    close: async () => undefined,
  };
  const noIdHandle = createStubLiveAdapters({
    env: noIdEnv,
    fixtures: loadStubFixtures(noIdEnv),
    log: () => undefined,
    nowIso: () => '2026-09-10T09:00:00.000Z',
    randomUUID: () => '11111111-1111-4111-8111-111111111111',
    clients: { pg: mockPg, queue: noIdQueue },
    wait: async () => undefined,
  });
  try {
    await runStubCanary(noIdHandle.ports);
    throw new Error('expected enqueue ack unknown for missing id');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'ENQUEUE_ACK_UNKNOWN', 'missing id is ack unknown');
    assert(err instanceof CanaryPrepError && err.ackClass === 'ack_unknown', 'missing id ack class');
  }
  await noIdHandle.shutdown();
  passed.push('missing-job-id-validation');

  const nullIdQueue: QueueLike = {
    add: async () => ({ id: null as unknown as string }),
    getJob: async () => null,
    getJobs: async () => [],
    close: async () => undefined,
  };
  const nullIdHandle = createStubLiveAdapters({
    env: noIdEnv,
    fixtures: loadStubFixtures(noIdEnv),
    log: () => undefined,
    nowIso: () => '2026-09-10T09:00:00.000Z',
    randomUUID: () => '11111111-1111-4111-8111-111111111111',
    clients: { pg: mockPg, queue: nullIdQueue },
    wait: async () => undefined,
  });
  try {
    await runStubCanary(nullIdHandle.ports);
    throw new Error('expected enqueue ack unknown for null id');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'ENQUEUE_ACK_UNKNOWN', 'null id is ack unknown');
  }
  await nullIdHandle.shutdown();
  passed.push('null-job-id-validation');

  let shutdowns = 0;
  const cliSuccess = await runStubCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: () => undefined },
    createLiveAdapters: (input) => {
      const handle = createStubLiveAdapters({
        ...input,
        nowIso: () => '2026-09-10T09:00:00.000Z',
        randomUUID: () => '11111111-1111-4111-8111-111111111111',
        clients: { pg: mockPg, queue: mockQueue },
        wait: async () => undefined,
      });
      return {
        ports: handle.ports,
        shutdown: async () => {
          shutdowns += 1;
          return await handle.shutdown();
        },
      };
    },
  });
  assert(cliSuccess === EXIT_SUCCESS, 'cli success exit 0');
  assert(shutdowns === 1, 'cli success shutdown');
  passed.push('cli-success-exit');

  const cliRefuse = await runStubCli({
    env: {},
    stdout: { write: () => undefined },
    stderr: { write: () => undefined },
  });
  assert(cliRefuse === EXIT_REFUSED, 'cli refuse exit 2');
  passed.push('cli-refuse-exit');

  const cliIncomplete = await runStubCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: () => undefined },
    createLiveAdapters: () => {
      const { ports } = makeMemoryPorts(
        { ...baseEnv(), AISB_01C6A_ISOLATED_MOCK: undefined, AISB_01C6A_LIVE_SUBMIT: 'YES' },
        {
          jobSequence: [{ state: 'completed' }],
          ledger: { executionStatus: 'completed', tokensUsed: 0, deductionPresent: true },
        },
      );
      ports.env = liveEnv;
      return {
        ports,
        shutdown: async () => {
          shutdowns += 1;
          return { complete: true, pendingClients: [], forcedClients: [] };
        },
      };
    },
  });
  assert(cliIncomplete === EXIT_INCOMPLETE, 'cli incomplete exit 3');
  passed.push('cli-incomplete-exit');

  let ackShutdown = 0;
  const cliAck = await runStubCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: () => undefined },
    createLiveAdapters: () => {
      const { ports } = makeMemoryPorts(
        { ...baseEnv(), AISB_01C6A_ISOLATED_MOCK: undefined, AISB_01C6A_LIVE_SUBMIT: 'YES' },
        { insertHang: true },
      );
      ports.env = liveEnv;
      return {
        ports,
        shutdown: async () => {
          ackShutdown += 1;
          return { complete: true, pendingClients: [], forcedClients: [] };
        },
      };
    },
  });
  assert(cliAck === EXIT_ACK_UNKNOWN, 'cli ack unknown exit 4');
  assert(ackShutdown === 1, 'cli ack unknown still shuts down');
  passed.push('cli-ack-unknown-exit');

  let timeoutShutdown = 0;
  const cliTimeout = await runStubCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: () => undefined },
    createLiveAdapters: () => {
      const { ports } = makeMemoryPorts(
        {
          ...baseEnv(),
          AISB_01C6A_ISOLATED_MOCK: undefined,
          AISB_01C6A_LIVE_SUBMIT: 'YES',
          AISB_01C6A_WAIT_MS: '30',
        },
        { observeHang: true },
      );
      ports.env = liveEnv;
      return {
        ports,
        shutdown: async () => {
          timeoutShutdown += 1;
          return { complete: true, pendingClients: [], forcedClients: [] };
        },
      };
    },
  });
  assert(cliTimeout === EXIT_TIMEOUT, 'cli timeout exit 5');
  assert(timeoutShutdown === 1, 'cli timeout still shuts down');
  passed.push('cli-timeout-exit');

  const cliCleanupStderr: string[] = [];
  const cliCleanupIncomplete = await runStubCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: (s: string) => cliCleanupStderr.push(s) },
    createLiveAdapters: (input) => {
      const handle = createStubLiveAdapters({
        ...input,
        nowIso: () => '2026-09-10T09:00:00.000Z',
        randomUUID: () => '11111111-1111-4111-8111-111111111111',
        clients: { pg: mockPg, queue: mockQueue },
        wait: async () => undefined,
      });
      return {
        ports: handle.ports,
        shutdown: async () => ({ complete: false, pendingClients: ['pg'], forcedClients: ['redis'] }),
      };
    },
  });
  assert(cliCleanupIncomplete === EXIT_CLEANUP_INCOMPLETE, 'success + incomplete cleanup exits 6');
  assert(cliCleanupStderr.some(s => s.includes('CLEANUP_INCOMPLETE')), 'cleanup incomplete reported to stderr');
  assert(cliCleanupStderr.some(s => s.includes('pg')), 'pending client name reported');
  passed.push('cli-cleanup-incomplete-exit');

  const cliFailCleanupStderr: string[] = [];
  const cliFailPlusCleanup = await runStubCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: (s: string) => cliFailCleanupStderr.push(s) },
    createLiveAdapters: () => {
      const { ports } = makeMemoryPorts(
        { ...baseEnv(), AISB_01C6A_ISOLATED_MOCK: undefined, AISB_01C6A_LIVE_SUBMIT: 'YES' },
        { insertHang: true },
      );
      ports.env = liveEnv;
      return {
        ports,
        shutdown: async () => ({ complete: false, pendingClients: ['pg'], forcedClients: [] }),
      };
    },
  });
  assert(cliFailPlusCleanup === EXIT_ACK_UNKNOWN, 'failure + incomplete cleanup preserves primary exit');
  assert(cliFailCleanupStderr.some(s => s.includes('CLEANUP_INCOMPLETE')), 'cleanup incomplete reported even on failure');
  passed.push('cli-failure-plus-cleanup-failure');

  return passed;
}

export async function runStubCli(io: {
  env: NodeJS.Dict<string>;
  stdout: { write: (chunk: string) => void };
  stderr: { write: (chunk: string) => void };
  createLiveAdapters?: typeof createStubLiveAdapters;
}): Promise<number> {
  const secrets = collectSecretNeedles(io.env);
  const mode = classifySubmissionMode(io.env);
  if (mode === 'isolated-mock') {
    const passed = await runStubIsolatedSelfTests();
    io.stdout.write(`STUB_ISOLATED_MOCK_PASS count=${passed.length} cases=${passed.join(',')}\n`);
    return EXIT_SUCCESS;
  }
  if (mode === 'refuse') {
    io.stdout.write(
      'STUB_CANARY_NOT_SUBMITTED: AISB_01C6A_LIVE_SUBMIT is not set. Preparation only. Staging execution unauthorized.\n',
    );
    return EXIT_REFUSED;
  }

  let shutdown: (() => Promise<ShutdownResult>) | undefined;
  let primaryExitCode: number;

  try {
    if (!readFlag(io.env, 'AISB_01C6A_STAGING_EXECUTION_AUTHORIZED')) {
      throw new CanaryPrepError(
        'LIVE_SUBMIT_BLOCKED_IN_PREPARATION',
        'Live stub adapters are implemented but staging execution is not authorized in this window',
      );
    }
    const fixtures = loadStubFixtures(io.env);
    assertLiveTargets(fixtures);
    const create = io.createLiveAdapters ?? createStubLiveAdapters;
    const handle = create({
      env: io.env,
      fixtures,
      log: (line) => io.stdout.write(`${redactSecrets(line, secrets)}\n`),
    });
    shutdown = handle.shutdown;
    const result = await runStubCanary(handle.ports);
    io.stdout.write(`${JSON.stringify(redactSecrets({ event: 'stub_canary_result', ...result }, secrets))}\n`);
    primaryExitCode = exitCodeForStubResult(result);
  } catch (err) {
    const code = err instanceof CanaryPrepError ? err.code : 'UNCAUGHT';
    io.stderr.write(`STUB_CANARY_FAIL ${sanitizeUntrustedError(err, secrets)}\n`);
    io.stderr.write(`STUB_CANARY_FAIL_CODE=${code}\n`);
    primaryExitCode = exitCodeForError(err);
  }

  let cleanupComplete = true;
  let cleanupPending: string[] = [];
  if (shutdown) {
    try {
      const sr = await shutdown();
      cleanupComplete = sr.complete;
      cleanupPending = sr.pendingClients;
    } catch (shutdownErr) {
      cleanupComplete = false;
      io.stderr.write(`SHUTDOWN_ERROR: ${sanitizeUntrustedError(shutdownErr, secrets)}\n`);
    }
  }

  if (!cleanupComplete) {
    io.stderr.write(`CLEANUP_INCOMPLETE: ${cleanupPending.join(',') || 'unknown'}\n`);
    if (primaryExitCode === EXIT_SUCCESS) {
      return EXIT_CLEANUP_INCOMPLETE;
    }
  }
  return primaryExitCode;
}

async function main(): Promise<void> {
  process.exitCode = await runStubCli({
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}

if (require.main === module) {
  main().catch((err) => {
    const code = err instanceof CanaryPrepError ? err.code : 'UNCAUGHT';
    process.stderr.write(`STUB_CANARY_FAIL ${sanitizeUntrustedError(err, collectSecretNeedles(process.env))}\n`);
    process.stderr.write(`STUB_CANARY_FAIL_CODE=${code}\n`);
    process.exitCode = 1;
  });
}
