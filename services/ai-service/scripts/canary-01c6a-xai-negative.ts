/**
 * AGENT-PLATFORM-EXEC-01C6A -- xAI-negative canary (preparation).
 *
 * Ingress: GATEWAY_HTTP_POST_/api/ai/execute
 * Never direct-enqueue as a substitute.
 * Provider/model: xai / grok-4.5 (deployed 804f8983 catalogue).
 *
 * Concrete HTTP / ledger / failed-job adapters exist behind the
 * live-authorization gate. Preparation must not invoke them against staging.
 *
 * EXPECTED_XAI_REJECTION requires failReason adapter_lacks_tool_use plus the
 * registered supporting observations. Generic fail_closed or missing evidence
 * is not an expected pass. providerTrafficProof remains NOT_ESTABLISHED.
 */
import { randomUUID } from 'crypto';

export const GATEWAY_EXECUTE_PATH = '/api/ai/execute';
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
export const XAI_PROMPT =
  'Read-only xAI-negative canary: do not write, delete, rename, install packages, edit env files, run browser smoke, or run validation commands.';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SECRET_KEYS = new Set([
  'authorization',
  'Authorization',
  'apiKeyToken',
  'token',
  'signature',
  'hmacSecret',
  'password',
  'AISB_01C6A_API_KEY_TOKEN',
  'AISB_01C6A_HMAC_SECRET',
  'harnessEntitlementProof',
  'REDIS_URL',
  'DATABASE_URL',
  'connectionString',
]);

export type ResultClass =
  | 'EXPECTED_XAI_REJECTION'
  | 'TRANSPORT_OR_SETUP_FAILURE'
  | 'UNEXPECTED_ROUTING_RESULT'
  | 'TIMEOUT'
  | 'REFUSED'
  | 'INCOMPLETE_OBSERVATIONS'
  | 'POST_ACK_UNKNOWN'
  | 'PROVIDER_TRAFFIC_UNPROVEN';

export type ObservationTri = 'true' | 'false' | 'unknown';
export type SubmissionMode = 'isolated-mock' | 'live' | 'refuse' | 'reconcile';
export type AckClass = 'ack' | 'ack_unknown' | 'did_not_occur';
export type ProofAcceptance = 'accepted' | 'rejected' | 'unknown';

export interface XaiFixtures {
  gatewayBaseUrl: string;
  apiKeyToken: string;
  userId: string;
  apiKeyId: string;
  sessionId: string;
  conversationId: string;
  agentId: string;
  waitMs: number;
  databaseUrl?: string;
  redisUrl?: string;
  workerLogPath?: string;
}

export interface HttpPostCall {
  url: string;
  method: 'POST';
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface HttpResponse {
  status: number;
  json?: Record<string, unknown>;
}

export interface LedgerObservation {
  executionStatus?: string | null;
  tokensUsed?: number | null;
  failReason?: string | null;
  deductionPresent: boolean;
  appliedCredits?: number | null;
  usageRowCount?: number;
  executionId?: string | null;
  requestId?: string | null;
  userId?: string | null;
}

export interface JobObservation {
  state?: string | null;
  failedReason?: string | null;
}

export interface QueueJobLike {
  id?: string;
  failedReason?: string;
  data?: { executionId?: string };
  getState: () => Promise<string>;
}

export interface ReadOnlyQueueLike {
  getJobs: (types: string[], start?: number, end?: number) => Promise<QueueJobLike[]>;
  close: () => Promise<void>;
  add?: (...args: never[]) => Promise<unknown>;
}

export interface RedisLike {
  connect?: () => Promise<void>;
  quit: () => Promise<unknown>;
  disconnect?: () => void;
}

export interface LogSourceLike {
  readLines: (signal?: AbortSignal) => Promise<string[]>;
}

export interface LogObservation {
  entitlementVerificationFailed: ObservationTri;
  routeEvaluatedFailClosed: ObservationTri;
  routeEvidenceConflicting: boolean;
  loopStarted: ObservationTri;
}

export interface XaiPorts {
  env: NodeJS.Dict<string>;
  log: (line: string) => void;
  randomUUID: () => string;
  nowMs?: () => number;
  httpPost: (call: HttpPostCall, signal?: AbortSignal) => Promise<HttpResponse>;
  observeLedger: (executionId: string, signal?: AbortSignal) => Promise<LedgerObservation | undefined>;
  observeJob?: (executionId: string, signal?: AbortSignal) => Promise<JobObservation | undefined>;
  observeLogs?: (executionId: string, signal?: AbortSignal) => Promise<LogObservation | undefined>;
  lookupUsageByUserRequest?: (
    userId: string,
    requestId: string,
    signal?: AbortSignal,
  ) => Promise<LedgerObservation[]>;
  wait: (ms: number, signal?: AbortSignal) => Promise<void>;
  enqueueDirect?: (payload: unknown) => Promise<void>;
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
        lower.includes('token') ||
        lower.includes('secret') ||
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
  void extraSecrets;
  return `code=${code} detail=[REDACTED]`;
}

export function collectSecretNeedles(env: NodeJS.Dict<string>, extra: string[] = []): string[] {
  const names = ['AISB_01C6A_API_KEY_TOKEN', 'AISB_01C6A_HMAC_SECRET', 'REDIS_URL', 'DATABASE_URL'];
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
  if ([isolated, live, reconcile].filter(Boolean).length > 1) {
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

export function loadXaiFixtures(env: NodeJS.Dict<string>): XaiFixtures {
  const required = [
    'AISB_01C6A_GATEWAY_BASE_URL',
    'AISB_01C6A_API_KEY_TOKEN',
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
  for (const key of [
    'AISB_01C6A_USER_ID',
    'AISB_01C6A_API_KEY_ID',
    'AISB_01C6A_SESSION_ID',
    'AISB_01C6A_CONVERSATION_ID',
    'AISB_01C6A_AGENT_ID',
  ] as const) {
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
  const base = values.AISB_01C6A_GATEWAY_BASE_URL.replace(/\/+$/, '');
  let host: string;
  try {
    const u = new URL(base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('bad scheme');
    }
    if (!u.hostname) {
      throw new Error('missing host');
    }
    if (u.username || u.password) {
      throw new Error('userinfo');
    }
    host = u.hostname;
  } catch {
    throw new CanaryPrepError('INVALID_GATEWAY_URL', 'AISB_01C6A_GATEWAY_BASE_URL must be http(s) without userinfo');
  }
  void host;
  return {
    gatewayBaseUrl: base,
    apiKeyToken: values.AISB_01C6A_API_KEY_TOKEN,
    userId: values.AISB_01C6A_USER_ID,
    apiKeyId: values.AISB_01C6A_API_KEY_ID,
    sessionId: values.AISB_01C6A_SESSION_ID,
    conversationId: values.AISB_01C6A_CONVERSATION_ID,
    agentId: values.AISB_01C6A_AGENT_ID,
    waitMs: parseWaitMs(env),
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    workerLogPath: (env.AISB_01C6A_WORKER_LOG_PATH ?? '').trim() || undefined,
  };
}

export function buildExecuteBody(fixtures: XaiFixtures): Record<string, unknown> {
  return {
    sessionId: fixtures.sessionId,
    conversationId: fixtures.conversationId,
    userId: fixtures.userId,
    prompt: XAI_PROMPT,
    executionIntent: 'conversation',
    provider: 'xai',
    model: 'grok-4.5',
    harnessVersion: 'v1',
    agentId: fixtures.agentId,
  };
}

export function parseJobFailedReason(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  if (/\badapter_lacks_tool_use\b/.test(raw)) {
    return 'adapter_lacks_tool_use';
  }
  if (/\badapter_lacks_execute_with_tools\b/.test(raw)) {
    return 'adapter_lacks_execute_with_tools';
  }
  if (/\btool_loop_disabled\b/.test(raw)) {
    return 'tool_loop_disabled';
  }
  if (/\bfail_closed\b/.test(raw)) {
    return 'fail_closed';
  }
  for (const code of [
    'HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE',
    'HARNESS_ENTITLEMENT_PROOF_MISSING',
    'HARNESS_ENTITLEMENT_PROOF_MALFORMED',
    'HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH',
    'HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH',
    'HARNESS_ENTITLEMENT_PROOF_SECRET_NOT_CONFIGURED',
  ]) {
    if (raw.includes(code)) {
      return code;
    }
  }
  return null;
}

export function deriveProofAcceptance(ev: {
  entitlementFailed: ObservationTri;
  failReason: string | null;
  executionStatus?: string | null;
}): ProofAcceptance {
  if (ev.entitlementFailed === 'true' || (ev.failReason && ev.failReason.startsWith('HARNESS_ENTITLEMENT_PROOF_'))) {
    return 'rejected';
  }
  if (ev.failReason === 'adapter_lacks_tool_use' || ev.failReason === 'tool_loop_disabled' || ev.failReason === 'adapter_lacks_execute_with_tools') {
    return 'accepted';
  }
  if (ev.executionStatus === 'completed') {
    return 'accepted';
  }
  return 'unknown';
}

export interface XaiClassifiedEvidence {
  failReason: string | null;
  executionStatus?: string | null;
  loopStarted: ObservationTri;
  notifyComplete: ObservationTri;
  applyDeduction: ObservationTri;
  entitlementVerificationFailed: ObservationTri;
  routeEvaluatedFailClosed: ObservationTri;
  routeEvidenceConflicting: boolean;
}

export function classifyXaiEvidence(ev: XaiClassifiedEvidence): ResultClass {
  if (ev.routeEvidenceConflicting) {
    return 'UNEXPECTED_ROUTING_RESULT';
  }
  if (ev.entitlementVerificationFailed === 'true') {
    return 'UNEXPECTED_ROUTING_RESULT';
  }
  if (ev.loopStarted === 'true' || ev.notifyComplete === 'true' || ev.applyDeduction === 'true') {
    return 'UNEXPECTED_ROUTING_RESULT';
  }
  if (ev.executionStatus === 'completed') {
    return 'UNEXPECTED_ROUTING_RESULT';
  }
  if (ev.routeEvaluatedFailClosed === 'false') {
    return 'UNEXPECTED_ROUTING_RESULT';
  }
  if (ev.failReason && ev.failReason !== 'adapter_lacks_tool_use') {
    return 'UNEXPECTED_ROUTING_RESULT';
  }
  if (
    ev.failReason === 'adapter_lacks_tool_use' &&
    ev.executionStatus === 'failed' &&
    ev.loopStarted === 'false' &&
    ev.notifyComplete === 'false' &&
    ev.applyDeduction === 'false' &&
    ev.routeEvaluatedFailClosed === 'true'
  ) {
    return 'EXPECTED_XAI_REJECTION';
  }
  return 'INCOMPLETE_OBSERVATIONS';
}

export function assembleXaiEvidence(input: {
  ledger?: LedgerObservation;
  job?: JobObservation;
  logs?: LogObservation;
}): XaiClassifiedEvidence {
  const failReason =
    parseJobFailedReason(input.job?.failedReason) ??
    (typeof input.ledger?.failReason === 'string' ? input.ledger.failReason : null);
  const executionStatus = input.ledger?.executionStatus ?? null;
  const loopStarted: ObservationTri = input.logs?.loopStarted ?? 'unknown';
  const entitlementVerificationFailed: ObservationTri = input.logs?.entitlementVerificationFailed ?? 'unknown';
  const routeEvaluatedFailClosed: ObservationTri = input.logs?.routeEvaluatedFailClosed ?? 'unknown';
  let notifyComplete: ObservationTri = 'unknown';
  if (executionStatus === 'completed') {
    notifyComplete = 'unknown';
  } else if (executionStatus === 'failed') {
    notifyComplete = 'false';
  }
  let applyDeduction: ObservationTri = 'unknown';
  if (input.ledger) {
    if (typeof input.ledger.usageRowCount === 'number' && input.ledger.usageRowCount > 1) {
      applyDeduction = 'unknown';
    } else {
      applyDeduction = input.ledger.deductionPresent ? 'true' : 'false';
    }
  }
  const routeEvidenceConflicting: boolean = input.logs?.routeEvidenceConflicting ?? false;
  return { failReason, executionStatus, loopStarted, notifyComplete, applyDeduction, entitlementVerificationFailed, routeEvaluatedFailClosed, routeEvidenceConflicting };
}

export function remainingMs(deadline: number, nowMs: () => number): number {
  return deadline - nowMs();
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
    const onAbort = () => reject(new CanaryPrepError('TIMEOUT', 'operation aborted', 'did_not_occur'));
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

export function assertObservationConfig(env: NodeJS.Dict<string>): {
  databaseUrl: string;
  redisUrl: string;
  workerLogPath: string;
} {
  const databaseUrl = (env.DATABASE_URL ?? '').trim();
  const redisUrl = (env.REDIS_URL ?? '').trim();
  const workerLogPath = (env.AISB_01C6A_WORKER_LOG_PATH ?? '').trim();
  if (!databaseUrl || !redisUrl || !workerLogPath) {
    throw new CanaryPrepError(
      'MISSING_OBSERVATION_CONFIG',
      'DATABASE_URL, REDIS_URL, and AISB_01C6A_WORKER_LOG_PATH are required before POST',
    );
  }
  return { databaseUrl, redisUrl, workerLogPath };
}

/**
 * Extract a JSON object from a log line that may have a NestJS ConsoleLogger
 * prefix and/or ANSI escape codes. The deployed worker (804f8983) emits
 * structured JSON via `this.logger.log(JSON.stringify({...}))` using the
 * default Nest Logger, which prepends e.g.:
 *   [Nest] <pid>  - <date>     LOG [WorkerProcessor] {...}
 * with optional ANSI colour codes around each segment.
 *
 * Source-based inference from worker.processor.ts; not direct observation.
 */
function tryParseJsonFromLine(line: string): Record<string, unknown> | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const stripped = trimmed.replace(/\x1b\[[0-9;]*m/g, '');
    const jsonStart = stripped.indexOf('{');
    if (jsonStart < 0) return undefined;
    try {
      return JSON.parse(stripped.slice(jsonStart)) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
}

export function parseWorkerLogLines(lines: string[], executionId: string): LogObservation {
  let sawRouteEvaluated = false;
  let routeEvidenceConflicting = false;
  let entitlementVerificationFailed: ObservationTri = 'unknown';
  let routeEvaluatedFailClosed: ObservationTri = 'unknown';
  let loopStarted: ObservationTri = 'unknown';
  for (const line of lines) {
    const obj = tryParseJsonFromLine(line);
    if (!obj) continue;
    if (obj.executionId !== executionId) continue;
    const event = obj.event ?? obj.eventType;
    if (event === 'agent_harness.entitlement_verification_failed') {
      entitlementVerificationFailed = 'true';
    }
    if (event === 'agent_harness.route_evaluated') {
      sawRouteEvaluated = true;
      let thisValue: ObservationTri = 'unknown';
      if (obj.selectedPath === 'fail_closed') {
        thisValue = 'true';
      } else if (typeof obj.selectedPath === 'string') {
        thisValue = 'false';
      }
      if (thisValue !== 'unknown') {
        if (routeEvaluatedFailClosed !== 'unknown' && routeEvaluatedFailClosed !== thisValue) {
          routeEvidenceConflicting = true;
        }
        routeEvaluatedFailClosed = thisValue;
      }
    }
    if (event === 'harness.loop_started') {
      loopStarted = 'true';
    }
  }
  if (sawRouteEvaluated && loopStarted === 'unknown') {
    loopStarted = 'false';
  }
  if (sawRouteEvaluated && entitlementVerificationFailed === 'unknown') {
    entitlementVerificationFailed = 'false';
  }
  return { entitlementVerificationFailed, routeEvaluatedFailClosed, routeEvidenceConflicting, loopStarted };
}

export async function findFailedJobByExecutionId(
  queue: ReadOnlyQueueLike,
  executionId: string,
): Promise<JobObservation | undefined> {
  const jobs = await queue.getJobs([...BULLMQ_JOB_TYPES], 0, 199);
  const matches = jobs.filter((job) => job.data?.executionId === executionId);
  if (matches.length === 0) {
    return { state: 'missing', failedReason: null };
  }
  if (matches.length > 1) {
    return { state: 'unknown', failedReason: null };
  }
  const job = matches[0];
  return {
    state: await job.getState(),
    failedReason: job.failedReason ?? null,
  };
}

export function exitCodeForXaiResult(result: XaiCanaryResult): number {
  if (result.outcome === 'REFUSED') {
    return EXIT_REFUSED;
  }
  if (result.outcome === 'EXPECTED_XAI_REJECTION') {
    return EXIT_SUCCESS;
  }
  if (result.outcome === 'POST_ACK_UNKNOWN' || result.postAck === 'ack_unknown') {
    return EXIT_ACK_UNKNOWN;
  }
  if (result.outcome === 'TIMEOUT') {
    return EXIT_TIMEOUT;
  }
  if (result.outcome === 'INCOMPLETE_OBSERVATIONS') {
    return EXIT_INCOMPLETE;
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
  if (err.code === 'POST_ACK_UNKNOWN' || err.ackClass === 'ack_unknown') {
    return EXIT_ACK_UNKNOWN;
  }
  if (err.code === 'MISSING_OBSERVATION_CONFIG') {
    return EXIT_FAILURE;
  }
  return EXIT_FAILURE;
}

export interface XaiCanaryResult {
  outcome: ResultClass;
  executionId?: string;
  requestId?: string;
  httpStatus?: number;
  proofAccepted: ProofAcceptance;
  providerTrafficProof: 'NOT_ESTABLISHED';
  directEnqueueUsed: boolean;
  automaticRetryCount: number;
  postAck?: AckClass;
}

function ledgerSettled(obs?: LedgerObservation): boolean {
  const status = obs?.executionStatus;
  return !!status && status !== 'pending' && status !== 'running';
}

export async function reconcileXaiSubmission(
  ports: XaiPorts,
  ids: { executionId?: string; requestId?: string; userId?: string },
): Promise<{ ledger?: LedgerObservation; job?: JobObservation; logs?: LogObservation }> {
  ports.log(
    JSON.stringify({
      event: 'xai_reconcile_readonly',
      executionId: ids.executionId ?? null,
      requestId: ids.requestId ?? null,
      userId: ids.userId ?? null,
      automaticRetryForbidden: true,
    }),
  );
  const opMs = parseOpTimeoutMs(ports.env);
  let executionId = ids.executionId;
  let ledger: LedgerObservation | undefined;
  if (!executionId && ids.requestId && ids.userId && ports.lookupUsageByUserRequest) {
    const found = await boundCall(
      'reconcile.lookupRequest',
      opMs,
      (signal) => ports.lookupUsageByUserRequest!(ids.userId as string, ids.requestId as string, signal),
      'did_not_occur',
    );
    if (found.length > 1) {
      return { ledger: { deductionPresent: false, usageRowCount: found.length } };
    }
    if (found.length === 1 && found[0].executionId) {
      executionId = found[0].executionId;
      ledger = found[0];
    } else {
      return {};
    }
  }
  if (!executionId) {
    return {};
  }
  if (!ledger) {
    ledger = await boundCall(
      'reconcile.ledger',
      opMs,
      (signal) => ports.observeLedger(executionId as string, signal),
      'did_not_occur',
    );
  }
  const job = ports.observeJob
    ? await boundCall(
        'reconcile.job',
        opMs,
        (signal) => ports.observeJob!(executionId as string, signal),
        'did_not_occur',
      )
    : undefined;
  const logs = ports.observeLogs
    ? await boundCall(
        'reconcile.logs',
        opMs,
        (signal) => ports.observeLogs!(executionId as string, signal),
        'did_not_occur',
      )
    : undefined;
  return { ledger, job, logs };
}

export async function runXaiNegativeCanary(ports: XaiPorts): Promise<XaiCanaryResult> {
  const secrets = collectSecretNeedles(ports.env);
  const log = (line: string) => ports.log(String(redactSecrets(line, secrets)));
  const mode = classifySubmissionMode(ports.env);
  const nowMs = ports.nowMs ?? (() => Date.now());
  const base: XaiCanaryResult = {
    outcome: 'REFUSED',
    proofAccepted: 'unknown',
    providerTrafficProof: 'NOT_ESTABLISHED',
    directEnqueueUsed: false,
    automaticRetryCount: 0,
  };
  if (mode === 'refuse') {
    log('LIVE_SUBMIT_UNAUTHORIZED: xAI-negative canary not submitted (preparation only)');
    return base;
  }
  if (mode === 'live' && !readFlag(ports.env, 'AISB_01C6A_STAGING_EXECUTION_AUTHORIZED')) {
    throw new CanaryPrepError(
      'LIVE_SUBMIT_BLOCKED_IN_PREPARATION',
      'Live xAI-negative submit requires AISB_01C6A_STAGING_EXECUTION_AUTHORIZED',
    );
  }
  if (ports.enqueueDirect) {
    throw new CanaryPrepError(
      'DIRECT_ENQUEUE_FORBIDDEN',
      'xAI-negative must not direct-enqueue; Gateway POST /api/ai/execute is required',
    );
  }

  const fixtures = loadXaiFixtures(ports.env);
  const opMs = parseOpTimeoutMs(ports.env);
  const requestId = (ports.env.AISB_01C6A_IDEMPOTENCY_KEY ?? '').trim() || ports.randomUUID();
  if (!isUuid(requestId)) {
    throw new CanaryPrepError('INVALID_UUID', 'Idempotency-Key must be a UUID');
  }
  log(JSON.stringify({ event: 'xai_identifiers_recorded', requestId, automaticRetryForbidden: true }));

  if (mode === 'live' || mode === 'reconcile') {
    assertObservationConfig(ports.env);
  }

  if (mode === 'reconcile') {
    const executionId = (ports.env.AISB_01C6A_RECONCILE_EXECUTION_ID ?? '').trim() || undefined;
    if (executionId && !isUuid(executionId)) {
      throw new CanaryPrepError('INVALID_UUID', 'AISB_01C6A_RECONCILE_EXECUTION_ID must be a UUID');
    }
    if (ports.connectNetwork) {
      await boundCall('connect', CONNECT_TIMEOUT_MS, (signal) => ports.connectNetwork!(signal), 'did_not_occur');
    }
    const rec = await reconcileXaiSubmission(
      { ...ports, log },
      { executionId, requestId, userId: fixtures.userId },
    );
    const assembled = assembleXaiEvidence(rec);
    return {
      outcome: classifyXaiEvidence(assembled),
      executionId: rec.ledger?.executionId ?? executionId,
      requestId,
      proofAccepted: deriveProofAcceptance({
        entitlementFailed: rec.logs?.entitlementVerificationFailed ?? 'unknown',
        failReason: assembled.failReason,
        executionStatus: assembled.executionStatus,
      }),
      providerTrafficProof: 'NOT_ESTABLISHED',
      directEnqueueUsed: false,
      automaticRetryCount: 0,
    };
  }

  if (ports.connectNetwork) {
    await boundCall('connect', CONNECT_TIMEOUT_MS, (signal) => ports.connectNetwork!(signal), 'did_not_occur');
  }

  const body = buildExecuteBody(fixtures);
  const url = `${fixtures.gatewayBaseUrl}${GATEWAY_EXECUTE_PATH}`;
  const call: HttpPostCall = {
    url,
    method: 'POST',
    path: GATEWAY_EXECUTE_PATH,
    headers: {
      Authorization: `Bearer ${fixtures.apiKeyToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': requestId,
    },
    body,
  };
  log(
    JSON.stringify({
      event: 'xai_gateway_post_prepared',
      ingress: 'GATEWAY_HTTP_POST_/api/ai/execute',
      path: GATEWAY_EXECUTE_PATH,
      provider: 'xai',
      model: 'grok-4.5',
      requestId,
    }),
  );

  let response: HttpResponse;
  let postAck: AckClass = 'did_not_occur';
  try {
    response = await boundCall('httpPost', opMs, (signal) => ports.httpPost(call, signal), 'ack_unknown');
    postAck = 'ack';
  } catch {
    log(JSON.stringify({ event: 'post_ack_unknown', requestId, automaticRetryForbidden: true }));
    return {
      outcome: 'POST_ACK_UNKNOWN',
      requestId,
      proofAccepted: 'unknown',
      providerTrafficProof: 'NOT_ESTABLISHED',
      directEnqueueUsed: false,
      automaticRetryCount: 0,
      postAck: 'ack_unknown',
    };
  }

  if (response.status === 202 && typeof response.json?.executionId !== 'string') {
    log(JSON.stringify({ event: 'post_ack_unknown', requestId, reason: '202_missing_executionId' }));
    return {
      outcome: 'POST_ACK_UNKNOWN',
      requestId,
      httpStatus: 202,
      proofAccepted: 'unknown',
      providerTrafficProof: 'NOT_ESTABLISHED',
      directEnqueueUsed: false,
      automaticRetryCount: 0,
      postAck: 'ack_unknown',
    };
  }

  if (response.status !== 202 || typeof response.json?.executionId !== 'string') {
    log(JSON.stringify({ event: 'gateway_not_accepted', class: 'TRANSPORT_OR_SETUP_FAILURE', httpStatus: response.status }));
    return {
      outcome: 'TRANSPORT_OR_SETUP_FAILURE',
      requestId,
      httpStatus: response.status,
      proofAccepted: 'unknown',
      providerTrafficProof: 'NOT_ESTABLISHED',
      directEnqueueUsed: false,
      automaticRetryCount: 0,
      postAck,
    };
  }
  const executionId = response.json.executionId as string;
  if (!isUuid(executionId)) {
    throw new CanaryPrepError('INVALID_EXECUTION_ID', 'Gateway executionId is not a UUID');
  }
  log(JSON.stringify({ event: 'xai_accepted', executionId, requestId, httpStatus: 202 }));

  const deadline = nowMs() + fixtures.waitMs;
  let ledger: LedgerObservation | undefined;
  let job: JobObservation | undefined;
  let logs: LogObservation | undefined;
  try {
    while (remainingMs(deadline, nowMs) > 0) {
      ledger = await boundCall(
        'observeLedger',
        Math.min(opMs, remainingMs(deadline, nowMs)),
        (signal) => ports.observeLedger(executionId, signal),
        'did_not_occur',
      );
      if (ports.observeJob) {
        job = await boundCall(
          'observeJob',
          Math.min(opMs, remainingMs(deadline, nowMs)),
          (signal) => ports.observeJob!(executionId, signal),
          'did_not_occur',
        );
      }
      if (ports.observeLogs) {
        logs = await boundCall(
          'observeLogs',
          Math.min(opMs, remainingMs(deadline, nowMs)),
          (signal) => ports.observeLogs!(executionId, signal),
          'did_not_occur',
        );
      }
      if (ledgerSettled(ledger) && remainingMs(deadline, nowMs) >= 0) {
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
        'xAI observation exceeded bounded wait; POST was acknowledged; this is not proof of non-submission',
        'ack',
      );
    }
    throw err;
  }

  if (!ledgerSettled(ledger) || remainingMs(deadline, nowMs) < 0) {
    throw new CanaryPrepError(
      'TIMEOUT',
      'xAI-negative execution did not settle within the bounded wait',
      'ack',
    );
  }

  const assembled = assembleXaiEvidence({ ledger, job, logs });
  const classified = classifyXaiEvidence(assembled);
  const proofAccepted = deriveProofAcceptance({
    entitlementFailed: logs?.entitlementVerificationFailed ?? 'unknown',
    failReason: assembled.failReason,
    executionStatus: assembled.executionStatus,
  });
  log(
    JSON.stringify({
      event: 'xai_result_classified',
      executionId,
      class: classified,
      failReason: assembled.failReason,
      loopStarted: assembled.loopStarted,
      notifyComplete: assembled.notifyComplete,
      applyDeduction: assembled.applyDeduction,
      proofAccepted,
      providerTrafficProof: 'NOT_ESTABLISHED',
      note: 'Expected routing rejection is not independently observed zero provider traffic',
    }),
  );
  return {
    outcome: classified,
    executionId,
    requestId,
    httpStatus: 202,
    proofAccepted,
    providerTrafficProof: 'NOT_ESTABLISHED',
    directEnqueueUsed: false,
    automaticRetryCount: 0,
    postAck,
  };
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

export interface PgLike {
  connect: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
}

export interface HttpLike {
  post: (call: HttpPostCall, signal?: AbortSignal) => Promise<HttpResponse>;
}

const USAGE_BY_EXECUTION_SQL = `SELECT execution_id, execution_status, tokens_used, metadata, request_id, user_id
       FROM usage_records WHERE execution_id = $1`;
const USAGE_BY_USER_REQUEST_SQL = `SELECT execution_id, execution_status, tokens_used, metadata, request_id, user_id
       FROM usage_records WHERE user_id = $1 AND request_id = $2`;
const DEDUCTION_SELECT_SQL = `SELECT id, source_event_id, applied_credits, balance_before, balance_after
       FROM credit_deduction_records WHERE source_event_id = $1 OR execution_id::text = $1`;

function mapUsageLedger(
  usage: Array<Record<string, unknown>>,
  deduction: Array<Record<string, unknown>>,
): LedgerObservation | undefined {
  if (usage.length === 0) {
    return undefined;
  }
  const u = usage[0];
  return {
    executionId: typeof u.execution_id === 'string' ? u.execution_id : null,
    requestId: typeof u.request_id === 'string' ? u.request_id : null,
    userId: typeof u.user_id === 'string' ? u.user_id : null,
    executionStatus: typeof u.execution_status === 'string' ? u.execution_status : null,
    tokensUsed: u.tokens_used == null ? null : Number(u.tokens_used),
    deductionPresent: deduction.length > 0,
    appliedCredits: deduction[0] ? Number(deduction[0].applied_credits) : null,
    usageRowCount: usage.length,
  };
}

function resolveShutdownTimeoutMs(env: NodeJS.Dict<string>): number {
  const raw = env.AISB_01C6A_SHUTDOWN_TIMEOUT_MS;
  if (raw !== undefined && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 20 && n <= 30000) return Math.floor(n);
  }
  return SHUTDOWN_TIMEOUT_MS;
}

export function createXaiLiveAdapters(input: {
  env: NodeJS.Dict<string>;
  fixtures: XaiFixtures;
  log: (line: string) => void;
  randomUUID?: () => string;
  clients?: {
    http: HttpLike;
    pg?: PgLike;
    queue?: ReadOnlyQueueLike;
    redis?: RedisLike;
    logSource?: LogSourceLike;
  };
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}): { ports: XaiPorts; shutdown: () => Promise<ShutdownResult> } {
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
  const observation = assertObservationConfig(input.env);

  let pg = input.clients?.pg;
  let http = input.clients?.http;
  let queue = input.clients?.queue;
  let redis = input.clients?.redis;
  let logSource = input.clients?.logSource;
  let constructed = false;

  const connectNetwork = async (signal?: AbortSignal) => {
    if (input.clients) {
      if (pg) {
        await boundCall('pg.connect', CONNECT_TIMEOUT_MS, () => abortable(signal, pg!.connect()), 'did_not_occur');
      }
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
    const { Queue } = require('bullmq') as {
      Queue: new (name: string, opts: { connection: unknown }) => ReadOnlyQueueLike;
    };
    const Redis = require('ioredis') as {
      new (url: string, opts: Record<string, unknown>): RedisLike;
    };
    pg = new PgClient({
      connectionString: observation.databaseUrl,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    });
    redis = new Redis(observation.redisUrl, {
      maxRetriesPerRequest: null,
      connectTimeout: CONNECT_TIMEOUT_MS,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    await boundCall('pg.connect', CONNECT_TIMEOUT_MS, () => abortable(signal, pg!.connect()), 'did_not_occur');
    if (redis.connect) {
      await boundCall('redis.connect', CONNECT_TIMEOUT_MS, () => abortable(signal, redis!.connect!()), 'did_not_occur');
    }
    queue = new Queue('ai-execution', { connection: redis });
    http = {
      post: async (call, postSignal) => {
        const res = await fetch(call.url, {
          method: 'POST',
          headers: call.headers,
          body: JSON.stringify(call.body),
          signal: postSignal,
        });
        let json: Record<string, unknown> | undefined;
        try {
          json = (await res.json()) as Record<string, unknown>;
        } catch {
          json = undefined;
        }
        return { status: res.status, json };
      },
    };
    logSource = {
      readLines: async (readSignal) => {
        const fs = require('fs').promises as { readFile: (path: string, enc: string) => Promise<string> };
        const text = await abortable(readSignal, fs.readFile(observation.workerLogPath, 'utf8'));
        return text.split(/\r?\n/);
      },
    };
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

  const ports: XaiPorts = {
    env: input.env,
    log: input.log,
    randomUUID: input.randomUUID ?? (() => randomUUID()),
    connectNetwork,
    shutdown,
    wait: input.wait ?? signalAwareWait,
    httpPost: async (call, signal) => abortable(signal, http!.post(call, signal)),
    observeLedger: async (executionId, signal) => {
      if (!pg) {
        return undefined;
      }
      const usage = normalizePgResult(await abortable(signal, pg.query(USAGE_BY_EXECUTION_SQL, [executionId])));
      const deduction = normalizePgResult(await abortable(signal, pg.query(DEDUCTION_SELECT_SQL, [executionId])));
      return mapUsageLedger(usage, deduction);
    },
    lookupUsageByUserRequest: async (userId, requestId, signal) => {
      if (!pg) {
        return [];
      }
      const usage = normalizePgResult(
        await abortable(signal, pg.query(USAGE_BY_USER_REQUEST_SQL, [userId, requestId])),
      );
      if (usage.length === 0) {
        return [];
      }
      const out: LedgerObservation[] = [];
      for (const row of usage) {
        const executionId = typeof row.execution_id === 'string' ? row.execution_id : '';
        const deduction = executionId
          ? normalizePgResult(await abortable(signal, pg.query(DEDUCTION_SELECT_SQL, [executionId])))
          : [];
        const mapped = mapUsageLedger([row], deduction);
        if (mapped) {
          out.push(mapped);
        }
      }
      return out;
    },
    observeJob: async (executionId, signal) => {
      if (!queue) {
        return undefined;
      }
      return abortable(signal, findFailedJobByExecutionId(queue, executionId));
    },
    observeLogs: async (executionId, signal) => {
      if (!logSource) {
        return undefined;
      }
      const lines = await abortable(signal, logSource.readLines(signal));
      return parseWorkerLogLines(lines, executionId);
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
    AISB_01C6A_GATEWAY_BASE_URL: 'https://example.invalid',
    AISB_01C6A_API_KEY_TOKEN: 'test-token-value-not-real',
    AISB_01C6A_USER_ID: '7f772841-7844-401b-a3da-e928b0c7b79c',
    AISB_01C6A_API_KEY_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    AISB_01C6A_SESSION_ID: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    AISB_01C6A_CONVERSATION_ID: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    AISB_01C6A_AGENT_ID: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    AISB_01C6A_WAIT_MS: '80',
    AISB_01C6A_OP_TIMEOUT_MS: '40',
  };
}

function expectedObs(): {
  ledger: LedgerObservation;
  job: JobObservation;
  logs: LogObservation;
} {
  return {
    ledger: { executionStatus: 'failed', tokensUsed: null, deductionPresent: false },
    job: { state: 'failed', failedReason: 'Requested Harness execution cannot proceed (adapter_lacks_tool_use)' },
    logs: {
      entitlementVerificationFailed: 'false',
      routeEvaluatedFailClosed: 'true',
      routeEvidenceConflicting: false,
      loopStarted: 'false',
    },
  };
}

export async function runXaiIsolatedSelfTests(): Promise<string[]> {
  const passed: string[] = [];

  try {
    classifySubmissionMode({ AISB_01C6A_ISOLATED_MOCK: '1', AISB_01C6A_LIVE_SUBMIT: 'YES' });
    throw new Error('expected ambiguity');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'SUBMISSION_AMBIGUITY', 'flag ambiguity');
    passed.push('submission-ambiguity-flags');
  }

  try {
    classifySubmissionMode({ AISB_01C6A_LIVE_SUBMIT: 'YES', AISB_01C6A_RECONCILE: '1' });
    throw new Error('expected ambiguity');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'SUBMISSION_AMBIGUITY', 'lost-ack mode conflict');
    passed.push('submission-ambiguity-lost-ack-no-retry-mode');
  }

  try {
    await runXaiNegativeCanary({
      env: { AISB_01C6A_ISOLATED_MOCK: '1' },
      log: () => undefined,
      randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      httpPost: async () => ({ status: 599 }),
      observeLedger: async () => undefined,
      wait: async () => undefined,
    });
    throw new Error('expected missing fixtures');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'MISSING_FIXTURES', 'missing fixtures');
    passed.push('missing-fixtures');
  }

  try {
    loadXaiFixtures({ ...baseEnv(), AISB_01C6A_API_KEY_ID: REVOKED_KEY_ID });
    throw new Error('expected revoked exclusion');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'REVOKED_KEY_EXCLUDED', 'revoked key');
    passed.push('revoked-key-excluded');
  }

  const refused = await runXaiNegativeCanary({
    env: {},
    log: () => undefined,
    randomUUID,
    httpPost: async () => ({ status: 202, json: { executionId: randomUUID(), status: 'queued' } }),
    observeLedger: async () => undefined,
    wait: async () => undefined,
  });
  assert(refused.outcome === 'REFUSED', 'refuse');
  passed.push('live-refuse');

  const exp = expectedObs();
  const posts: HttpPostCall[] = [];
  const expected = await runXaiNegativeCanary({
    env: baseEnv(),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    httpPost: async (call) => {
      posts.push(call);
      return { status: 202, json: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'queued' } };
    },
    observeLedger: async () => exp.ledger,
    observeJob: async () => exp.job,
    observeLogs: async () => exp.logs,
    wait: async () => undefined,
  });
  assert(expected.outcome === 'EXPECTED_XAI_REJECTION', 'expected with specific reason + observations');
  assert(expected.proofAccepted === 'accepted', 'proof accepted after routing fail');
  assert(expected.providerTrafficProof === 'NOT_ESTABLISHED', 'traffic unproven');
  assert(posts[0].headers['Idempotency-Key'] === 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'idempotency recorded before POST');
  assert(posts[0].body.provider === 'xai' && posts[0].body.model === 'grok-4.5', 'provider/model');
  passed.push('expected-xai-rejection');

  const generic = classifyXaiEvidence({
    failReason: 'fail_closed',
    executionStatus: 'failed',
    loopStarted: 'unknown',
    notifyComplete: 'unknown',
    applyDeduction: 'unknown',
    entitlementVerificationFailed: 'unknown',
    routeEvaluatedFailClosed: 'unknown',
    routeEvidenceConflicting: false,
  });
  assert(generic === 'UNEXPECTED_ROUTING_RESULT', 'generic fail_closed is not EXPECTED');
  passed.push('generic-fail-closed-not-expected');

  const incomplete = await runXaiNegativeCanary({
    env: baseEnv(),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    httpPost: async () => ({
      status: 202,
      json: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'queued' },
    }),
    observeLedger: async () => ({ executionStatus: 'failed', deductionPresent: false }),
    wait: async () => undefined,
  });
  assert(incomplete.outcome === 'INCOMPLETE_OBSERVATIONS', 'missing failReason stays incomplete');
  passed.push('incomplete-observations');

  const hmacFail = await runXaiNegativeCanary({
    env: baseEnv(),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    httpPost: async () => ({
      status: 202,
      json: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'queued' },
    }),
    observeLedger: async () => ({ executionStatus: 'failed', deductionPresent: false }),
    observeJob: async () => ({
      state: 'failed',
      failedReason: 'Harness entitlement proof verification failed (HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE)',
    }),
    observeLogs: async () => ({
      entitlementVerificationFailed: 'true' as const,
      routeEvaluatedFailClosed: 'unknown' as const,
      routeEvidenceConflicting: false,
      loopStarted: 'false' as const,
    }),
    wait: async () => undefined,
  });
  assert(hmacFail.proofAccepted === 'rejected', 'failed HMAC rejected');
  assert(hmacFail.outcome === 'UNEXPECTED_ROUTING_RESULT', 'entitlement fail is not xAI routing pass');
  passed.push('failed-hmac-verification');

  const transport = await runXaiNegativeCanary({
    env: baseEnv(),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    httpPost: async () => {
      throw new Error('ECONNREFUSED Authorization: Bearer test-token-value-not-real');
    },
    observeLedger: async () => undefined,
    wait: async () => undefined,
  });
  assert(transport.outcome === 'POST_ACK_UNKNOWN', 'post invoked then refused is ack unknown');
  assert(transport.postAck === 'ack_unknown', 'post ack class unknown');
  passed.push('transport-failure');

  const connectFail = await runXaiNegativeCanary({
    env: baseEnv(),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    connectNetwork: async () => {
      throw new CanaryPrepError('TRANSPORT_OR_SETUP_FAILURE', 'connect refused before POST');
    },
    httpPost: async () => {
      throw new Error('httpPost must not run');
    },
    observeLedger: async () => undefined,
    wait: async () => undefined,
  }).then(
    () => {
      throw new Error('expected connect failure');
    },
    (err) => err,
  );
  assert(connectFail instanceof CanaryPrepError && connectFail.code === 'TRANSPORT_OR_SETUP_FAILURE', 'pre-POST connect failure');
  passed.push('pre-post-transport-failure');

  const unexpected = await runXaiNegativeCanary({
    env: baseEnv(),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    httpPost: async () => ({
      status: 202,
      json: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'queued' },
    }),
    observeLedger: async () => ({ executionStatus: 'completed', deductionPresent: true, appliedCredits: 3 }),
    observeLogs: async () => ({
      entitlementVerificationFailed: 'false' as const,
      routeEvaluatedFailClosed: 'false' as const,
      routeEvidenceConflicting: false,
      loopStarted: 'true' as const,
    }),
    wait: async () => undefined,
  });
  assert(unexpected.outcome === 'UNEXPECTED_ROUTING_RESULT', 'unexpected routing');
  passed.push('unexpected-routing-result');

  try {
    await runXaiNegativeCanary({
      env: { ...baseEnv(), AISB_01C6A_WAIT_MS: '30' },
      log: () => undefined,
      randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      httpPost: async () => ({
        status: 202,
        json: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'queued' },
      }),
      observeLedger: async () => ({ executionStatus: 'pending', deductionPresent: false }),
      wait: async () => undefined,
    });
    throw new Error('expected timeout');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'TIMEOUT', 'timeout');
    passed.push('timeout');
  }

  const stalledPost = await runXaiNegativeCanary({
    env: { ...baseEnv(), AISB_01C6A_OP_TIMEOUT_MS: '40' },
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    httpPost: async () => neverResolve(),
    observeLedger: async () => undefined,
    wait: async () => undefined,
  });
  assert(stalledPost.outcome === 'POST_ACK_UNKNOWN', 'lost POST ack');
  assert(stalledPost.automaticRetryCount === 0, 'no retry after lost ack');
  assert(stalledPost.requestId === 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'requestId recorded before POST');
  passed.push('stalled-http-lost-acknowledgment');

  try {
    await runXaiNegativeCanary({
      env: { ...baseEnv(), AISB_01C6A_WAIT_MS: '80', AISB_01C6A_OP_TIMEOUT_MS: '40' },
      log: () => undefined,
      randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      httpPost: async () => ({
        status: 202,
        json: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'queued' },
      }),
      observeLedger: async () => neverResolve(),
      wait: async () => undefined,
    });
    throw new Error('expected observer timeout');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'TIMEOUT', 'stalled observer');
    assert(err instanceof CanaryPrepError && err.ackClass === 'ack', 'POST was acked');
    passed.push('stalled-observer-timeout');
  }

  try {
    await runXaiNegativeCanary({
      env: baseEnv(),
      log: () => undefined,
      randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      httpPost: async () => ({ status: 202, json: { executionId: randomUUID(), status: 'queued' } }),
      observeLedger: async () => undefined,
      wait: async () => undefined,
      enqueueDirect: async () => undefined,
    });
    throw new Error('expected direct enqueue forbidden');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'DIRECT_ENQUEUE_FORBIDDEN', 'no direct enqueue');
    passed.push('direct-enqueue-forbidden');
  }

  const logs: string[] = [];
  await runXaiNegativeCanary({
    env: baseEnv(),
    log: (line) => logs.push(line),
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    httpPost: async () => {
      throw new Error('fetch failed Authorization: Bearer test-token-value-not-real postgres://u:hunter2@host/db');
    },
    observeLedger: async () => undefined,
    wait: async () => undefined,
  });
  const joined = logs.join('\n');
  assert(!joined.includes('test-token-value-not-real'), 'token redacted from logs');
  assert(!joined.includes('hunter2'), 'url password not logged');
  const sanitized = sanitizeUntrustedError(
    new Error('Authorization: Bearer test-token-value-not-real'),
    ['test-token-value-not-real'],
  );
  assert(!sanitized.includes('test-token-value-not-real'), 'raw exception not printed');
  passed.push('secrets-embedded-in-errors');

  const resetPost = await runXaiNegativeCanary({
    env: baseEnv(),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    httpPost: async () => {
      const err = new Error('read ECONNRESET');
      (err as NodeJS.ErrnoException).code = 'ECONNRESET';
      throw err;
    },
    observeLedger: async () => undefined,
    wait: async () => undefined,
  });
  assert(resetPost.outcome === 'POST_ACK_UNKNOWN', 'committed then disconnected POST');
  assert(resetPost.automaticRetryCount === 0, 'no retry after reset');
  passed.push('post-committed-then-disconnected');

  const missingExec = await runXaiNegativeCanary({
    env: baseEnv(),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    httpPost: async () => ({ status: 202, json: { status: 'queued' } }),
    observeLedger: async () => undefined,
    wait: async () => undefined,
  });
  assert(missingExec.outcome === 'POST_ACK_UNKNOWN', '202 without executionId is unknown');
  passed.push('post-202-missing-execution-id');

  function delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new CanaryPrepError('TIMEOUT', 'aborted', 'did_not_occur'));
        return;
      }
      const t = setTimeout(resolve, ms);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new CanaryPrepError('TIMEOUT', 'aborted', 'did_not_occur'));
        },
        { once: true },
      );
    });
  }

  try {
    await runXaiNegativeCanary({
      env: { ...baseEnv(), AISB_01C6A_WAIT_MS: '20', AISB_01C6A_OP_TIMEOUT_MS: '50' },
      log: () => undefined,
      randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      httpPost: async () => ({
        status: 202,
        json: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'queued' },
      }),
      observeLedger: async (_id, signal) => {
        await delay(15, signal);
        return { executionStatus: 'failed', deductionPresent: false };
      },
      observeJob: async (_id, signal) => {
        await delay(15, signal);
        return expectedObs().job;
      },
      observeLogs: async (_id, signal) => {
        await delay(15, signal);
        return expectedObs().logs;
      },
      wait: async () => undefined,
    });
    throw new Error('expected sequential delay timeout');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'TIMEOUT', 'sequential delay exceeds remaining budget');
    passed.push('sequential-delay-deadline');
  }

  const hangFlag = { cancelled: false };
  const hangPost = await runXaiNegativeCanary({
    env: { ...baseEnv(), AISB_01C6A_OP_TIMEOUT_MS: '40' },
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    httpPost: async (_call, signal) =>
      new Promise((_resolve, reject) => {
        const onAbort = () => {
          hangFlag.cancelled = true;
          reject(new CanaryPrepError('TIMEOUT', 'aborted', 'ack_unknown'));
        };
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener('abort', onAbort, { once: true });
      }),
    observeLedger: async () => undefined,
    wait: async () => undefined,
  });
  assert(hangPost.outcome === 'POST_ACK_UNKNOWN', 'hanging POST unknown');
  assert(hangFlag.cancelled === true, 'timed-out POST aborted');
  passed.push('hanging-client-cleanup');

  const liveEnv: NodeJS.Dict<string> = {
    ...baseEnv(),
    AISB_01C6A_ISOLATED_MOCK: undefined,
    AISB_01C6A_LIVE_SUBMIT: 'YES',
    AISB_01C6A_STAGING_EXECUTION_AUTHORIZED: 'YES',
    DATABASE_URL: 'postgres://aisandbox:mockpass@db.example:5432/aisandbox',
    REDIS_URL: 'redis://:mockpass@redis.example:6379',
    AISB_01C6A_WORKER_LOG_PATH: 'C:\\mock\\worker.log',
  };
  let httpCalls = 0;
  let addCalls = 0;
  const mockHttp: HttpLike = {
    post: async (call) => {
      httpCalls += 1;
      assert(call.path === GATEWAY_EXECUTE_PATH, 'gateway path');
      assert(call.headers.Authorization.startsWith('Bearer '), 'bearer present on wire mock');
      return { status: 202, json: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'queued' } };
    },
  };
  const mockPg: PgLike = {
    connect: async () => undefined,
    query: async (sql, params) => {
      if (sql.includes('WHERE user_id = $1 AND request_id = $2')) {
        assert(params?.[0] === liveEnv.AISB_01C6A_USER_ID, 'reconcile uses designated user');
        assert(params?.[1] === 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'reconcile uses request id');
        return {
          rows: [
            {
              execution_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              execution_status: 'failed',
              tokens_used: null,
              request_id: params?.[1],
              user_id: params?.[0],
            },
          ],
        };
      }
      if (sql.includes('usage_records')) {
        return {
          rows: [
            {
              execution_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              execution_status: 'failed',
              tokens_used: null,
            },
          ],
        };
      }
      return { rows: [] };
    },
    end: async () => undefined,
  };
  const mockQueue: ReadOnlyQueueLike = {
    getJobs: async (types) => {
      assert(types.includes('failed'), 'read-only getJobs includes failed');
      return [
        {
          data: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
          failedReason: 'Requested Harness execution cannot proceed (adapter_lacks_tool_use)',
          getState: async () => 'failed',
        },
      ];
    },
    add: async () => {
      addCalls += 1;
      return {};
    },
    close: async () => undefined,
  };
  const mockLogs: LogSourceLike = {
    readLines: async () => [
      JSON.stringify({
        event: 'agent_harness.route_evaluated',
        executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        selectedPath: 'fail_closed',
      }),
    ],
  };
  const handle = createXaiLiveAdapters({
    env: liveEnv,
    fixtures: loadXaiFixtures(liveEnv),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    clients: {
      http: mockHttp,
      pg: mockPg,
      queue: mockQueue,
      logSource: mockLogs,
    },
    wait: async () => undefined,
  });
  const adapterResult = await runXaiNegativeCanary(handle.ports);
  assert(httpCalls === 1, 'single POST');
  assert(addCalls === 0, 'BullMQ read must not enqueue');
  assert(adapterResult.outcome === 'EXPECTED_XAI_REJECTION', 'mocked adapter expected from real observation path');
  assert(adapterResult.providerTrafficProof === 'NOT_ESTABLISHED', 'traffic still unproven');
  assert(adapterResult.automaticRetryCount === 0, 'no retry');
  await handle.shutdown();
  passed.push('concrete-adapter-mocked-clients');

  httpCalls = 0;
  try {
    createXaiLiveAdapters({
      env: {
        ...liveEnv,
        DATABASE_URL: undefined,
      },
      fixtures: loadXaiFixtures({ ...liveEnv, DATABASE_URL: undefined }),
      log: () => undefined,
      clients: { http: mockHttp },
    });
    throw new Error('expected missing observation config');
  } catch (err) {
    assert(err instanceof CanaryPrepError && err.code === 'MISSING_OBSERVATION_CONFIG', 'observation config before POST');
    assert(httpCalls === 0, 'POST not sent without observation config');
    passed.push('observation-config-before-post');
  }

  const emptyQueue: ReadOnlyQueueLike = {
    getJobs: async () => [],
    close: async () => undefined,
  };
  const emptyHandle = createXaiLiveAdapters({
    env: liveEnv,
    fixtures: loadXaiFixtures(liveEnv),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    clients: { http: mockHttp, pg: mockPg, queue: emptyQueue, logSource: mockLogs },
    wait: async () => undefined,
  });
  const emptyJobs = await runXaiNegativeCanary(emptyHandle.ports);
  assert(emptyJobs.outcome === 'INCOMPLETE_OBSERVATIONS', 'empty getJobs cannot pass');
  await emptyHandle.shutdown();
  passed.push('empty-queue-incomplete');

  const loopLogs: LogSourceLike = {
    readLines: async () => [
      JSON.stringify({
        event: 'agent_harness.route_evaluated',
        executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        selectedPath: 'fail_closed',
      }),
      JSON.stringify({
        eventType: 'harness.loop_started',
        executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      }),
    ],
  };
  const loopHandle = createXaiLiveAdapters({
    env: liveEnv,
    fixtures: loadXaiFixtures(liveEnv),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    clients: { http: mockHttp, pg: mockPg, queue: mockQueue, logSource: loopLogs },
    wait: async () => undefined,
  });
  const contradictory = await runXaiNegativeCanary(loopHandle.ports);
  assert(contradictory.outcome === 'UNEXPECTED_ROUTING_RESULT', 'loop_started contradicts fail-closed');
  await loopHandle.shutdown();
  passed.push('contradictory-loop-started');

  const unrelatedLogOnly: LogSourceLike = {
    readLines: async () => [
      JSON.stringify({
        event: 'execution_completed',
        executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        provider: 'xai',
        execution_status: 'failed',
      }),
    ],
  };
  const unrelatedHandle = createXaiLiveAdapters({
    env: liveEnv,
    fixtures: loadXaiFixtures(liveEnv),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    clients: { http: mockHttp, pg: mockPg, queue: mockQueue, logSource: unrelatedLogOnly },
    wait: async () => undefined,
  });
  const unrelatedResult = await runXaiNegativeCanary(unrelatedHandle.ports);
  assert(unrelatedResult.outcome === 'INCOMPLETE_OBSERVATIONS', 'unrelated correlated log must not infer routing evidence');
  await unrelatedHandle.shutdown();
  passed.push('unrelated-log-event');

  const entitlementContradiction = classifyXaiEvidence({
    failReason: 'adapter_lacks_tool_use',
    executionStatus: 'failed',
    loopStarted: 'false',
    notifyComplete: 'false',
    applyDeduction: 'false',
    entitlementVerificationFailed: 'true',
    routeEvaluatedFailClosed: 'true',
    routeEvidenceConflicting: false,
  });
  assert(entitlementContradiction === 'UNEXPECTED_ROUTING_RESULT', 'entitlement rejection contradicts expected success');
  passed.push('entitlement-contradiction');

  const conflictingRoute = classifyXaiEvidence({
    failReason: 'adapter_lacks_tool_use',
    executionStatus: 'failed',
    loopStarted: 'false',
    notifyComplete: 'false',
    applyDeduction: 'false',
    entitlementVerificationFailed: 'false',
    routeEvaluatedFailClosed: 'false',
    routeEvidenceConflicting: false,
  });
  assert(conflictingRoute === 'UNEXPECTED_ROUTING_RESULT', 'non-fail route contradicts adapter_lacks_tool_use');
  passed.push('conflicting-route-evidence');

  const missingLogEvidence = classifyXaiEvidence({
    failReason: 'adapter_lacks_tool_use',
    executionStatus: 'failed',
    loopStarted: 'false',
    notifyComplete: 'false',
    applyDeduction: 'false',
    entitlementVerificationFailed: 'unknown',
    routeEvaluatedFailClosed: 'unknown',
    routeEvidenceConflicting: false,
  });
  assert(missingLogEvidence === 'INCOMPLETE_OBSERVATIONS', 'missing routing evidence is incomplete');
  passed.push('missing-log-evidence');

  const loopContradictionClassify = classifyXaiEvidence({
    failReason: 'adapter_lacks_tool_use',
    executionStatus: 'failed',
    loopStarted: 'true',
    notifyComplete: 'false',
    applyDeduction: 'false',
    entitlementVerificationFailed: 'false',
    routeEvaluatedFailClosed: 'true',
    routeEvidenceConflicting: false,
  });
  assert(loopContradictionClassify === 'UNEXPECTED_ROUTING_RESULT', 'loop start contradicts expected failure');
  passed.push('loop-start-contradiction');

  const nestLine = `[Nest] 833303  - 09/10/2026, 12:00:00 AM     LOG [WorkerProcessor] ${JSON.stringify({
    event: 'agent_harness.route_evaluated',
    executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    selectedPath: 'fail_closed',
  })}`;
  const ansiLine = `\x1b[32m[Nest] 833303\x1b[39m  - 09/10/2026, 12:00:00 AM     \x1b[32mLOG\x1b[39m \x1b[33m[WorkerProcessor]\x1b[39m \x1b[32m${JSON.stringify({
    event: 'agent_harness.route_evaluated',
    executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    selectedPath: 'fail_closed',
  })}\x1b[39m`;
  const nestParsed = parseWorkerLogLines([nestLine], 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  assert(nestParsed.routeEvaluatedFailClosed === 'true', 'Nest-prefixed line parsed');
  assert(nestParsed.loopStarted === 'false', 'Nest-prefixed inference from route_evaluated');
  const ansiParsed = parseWorkerLogLines([ansiLine], 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  assert(ansiParsed.routeEvaluatedFailClosed === 'true', 'ANSI-colored Nest line parsed');
  passed.push('nest-formatted-log-lines');

  const eid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const harnessFirst = parseWorkerLogLines([
    JSON.stringify({ event: 'agent_harness.route_evaluated', executionId: eid, selectedPath: 'harness' }),
    JSON.stringify({ event: 'agent_harness.route_evaluated', executionId: eid, selectedPath: 'fail_closed' }),
  ], eid);
  assert(harnessFirst.routeEvidenceConflicting === true, 'harness→fail_closed is conflicting');
  const failFirst = parseWorkerLogLines([
    JSON.stringify({ event: 'agent_harness.route_evaluated', executionId: eid, selectedPath: 'fail_closed' }),
    JSON.stringify({ event: 'agent_harness.route_evaluated', executionId: eid, selectedPath: 'harness' }),
  ], eid);
  assert(failFirst.routeEvidenceConflicting === true, 'fail_closed→harness is conflicting');
  const repeatedIdentical = parseWorkerLogLines([
    JSON.stringify({ event: 'agent_harness.route_evaluated', executionId: eid, selectedPath: 'fail_closed' }),
    JSON.stringify({ event: 'agent_harness.route_evaluated', executionId: eid, selectedPath: 'fail_closed' }),
  ], eid);
  assert(repeatedIdentical.routeEvidenceConflicting === false, 'repeated identical is not conflicting');
  assert(repeatedIdentical.routeEvaluatedFailClosed === 'true', 'repeated identical preserves value');
  const crossExecution = parseWorkerLogLines([
    JSON.stringify({ event: 'agent_harness.route_evaluated', executionId: eid, selectedPath: 'fail_closed' }),
    JSON.stringify({ event: 'agent_harness.route_evaluated', executionId: 'other-id', selectedPath: 'harness' }),
  ], eid);
  assert(crossExecution.routeEvidenceConflicting === false, 'other executionId does not contaminate');
  assert(crossExecution.routeEvaluatedFailClosed === 'true', 'cross-execution preserves value');
  const conflictClassify = classifyXaiEvidence({
    failReason: 'adapter_lacks_tool_use',
    executionStatus: 'failed',
    loopStarted: 'false',
    notifyComplete: 'false',
    applyDeduction: 'false',
    entitlementVerificationFailed: 'false',
    routeEvaluatedFailClosed: 'true',
    routeEvidenceConflicting: true,
  });
  assert(conflictClassify === 'UNEXPECTED_ROUTING_RESULT', 'conflicting route evidence rejects expected success');
  passed.push('contradictory-route-order');

  const conflictLogSource: LogSourceLike = {
    readLines: async () => [
      JSON.stringify({ event: 'agent_harness.route_evaluated', executionId: eid, selectedPath: 'harness' }),
      JSON.stringify({ event: 'agent_harness.route_evaluated', executionId: eid, selectedPath: 'fail_closed' }),
    ],
  };
  const conflictHandle = createXaiLiveAdapters({
    env: liveEnv,
    fixtures: loadXaiFixtures(liveEnv),
    log: () => undefined,
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    clients: { http: mockHttp, pg: mockPg, queue: mockQueue, logSource: conflictLogSource },
    wait: async () => undefined,
  });
  const conflictResult = await runXaiNegativeCanary(conflictHandle.ports);
  assert(conflictResult.outcome === 'UNEXPECTED_ROUTING_RESULT', 'concrete adapter rejects conflicting routes');
  await conflictHandle.shutdown();
  passed.push('contradictory-route-concrete');

  const sdLiveEnv: NodeJS.Dict<string> = {
    ...liveEnv,
    AISB_01C6A_SHUTDOWN_TIMEOUT_MS: '80',
  };
  let sdDisconnects = 0;
  const sdLogs: string[] = [];
  const hangingPg: PgLike = {
    connect: async () => undefined,
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('usage_records')) {
        return {
          rows: [{
            execution_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            execution_status: 'failed',
            tokens_used: null,
          }],
        };
      }
      return { rows: [] };
    },
    end: async () => neverResolve(),
  };
  const hangingQueue: ReadOnlyQueueLike = {
    getJobs: async () => mockQueue.getJobs(['failed'], 0, 199),
    close: async () => neverResolve(),
  };
  const hangingRedis: RedisLike = {
    quit: async () => neverResolve(),
    disconnect: () => { sdDisconnects += 1; },
  };
  const sdHandle = createXaiLiveAdapters({
    env: sdLiveEnv,
    fixtures: loadXaiFixtures(sdLiveEnv),
    log: (line) => sdLogs.push(line),
    randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    clients: { http: mockHttp, pg: hangingPg, queue: hangingQueue, redis: hangingRedis, logSource: mockLogs },
    wait: async () => undefined,
  });
  const sdResult = await runXaiNegativeCanary(sdHandle.ports);
  assert(sdResult.outcome === 'EXPECTED_XAI_REJECTION', 'primary outcome preserved despite hung clients');
  const sdShutdown = await sdHandle.shutdown();
  assert(sdDisconnects >= 1, 'redis forced disconnect after graceful timeout');
  assert(!sdShutdown.complete, 'shutdown incomplete with hanging clients');
  assert(sdShutdown.pendingClients.includes('pg'), 'pg still pending');
  assert(sdShutdown.pendingClients.includes('queue'), 'queue still pending');
  assert(sdShutdown.forcedClients.includes('redis'), 'redis was force-disconnected');
  const sdCleanupLog = sdLogs.find((l) => l.includes('shutdown_cleanup_incomplete'));
  assert(sdCleanupLog, 'cleanup failure reported');
  assert(sdCleanupLog!.includes('"pg"'), 'pg pending reported');
  passed.push('shutdown-timeout-forced-disconnect');

  try {
    createXaiLiveAdapters({
      env: { ...liveEnv, AISB_01C6A_STAGING_EXECUTION_AUTHORIZED: undefined },
      fixtures: loadXaiFixtures(liveEnv),
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
    AISB_01C6A_IDEMPOTENCY_KEY: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  };
  const recHandle = createXaiLiveAdapters({
    env: recEnv,
    fixtures: loadXaiFixtures(recEnv),
    log: () => undefined,
    clients: { http: mockHttp, pg: mockPg, queue: mockQueue, logSource: mockLogs },
  });
  const rec = await runXaiNegativeCanary(recHandle.ports);
  assert(rec.executionId === 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'reconcile resolved execution from user+request');
  assert(rec.automaticRetryCount === 0, 'reconcile does not POST a replacement');
  assert(rec.outcome === 'EXPECTED_XAI_REJECTION', 'reconcile uses observation path');
  await recHandle.shutdown();
  passed.push('reconcile-by-user-and-request-id');

  const recEmptyPg: PgLike = {
    connect: async () => undefined,
    query: async () => ({ rows: [] }),
    end: async () => undefined,
  };
  const recEmpty = createXaiLiveAdapters({
    env: recEnv,
    fixtures: loadXaiFixtures(recEnv),
    log: () => undefined,
    clients: { http: mockHttp, pg: recEmptyPg, queue: mockQueue, logSource: mockLogs },
  });
  const recUnknown = await runXaiNegativeCanary(recEmpty.ports);
  assert(recUnknown.outcome === 'INCOMPLETE_OBSERVATIONS', 'zero usage rows remain unresolved');
  await recEmpty.shutdown();
  passed.push('reconcile-unresolved-without-execution-id');

  let shutdowns = 0;
  const cliSuccess = await runXaiCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: () => undefined },
    createLiveAdapters: (input) => {
      const h = createXaiLiveAdapters({
        ...input,
        randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        clients: { http: mockHttp, pg: mockPg, queue: mockQueue, logSource: mockLogs },
        wait: async () => undefined,
      });
      return {
        ports: h.ports,
        shutdown: async () => {
          shutdowns += 1;
          return await h.shutdown();
        },
      };
    },
  });
  assert(cliSuccess === EXIT_SUCCESS, 'cli expected rejection exits 0');
  assert(shutdowns === 1, 'cli success shutdown');
  passed.push('cli-success-exit');

  const cliRefuse = await runXaiCli({
    env: {},
    stdout: { write: () => undefined },
    stderr: { write: () => undefined },
  });
  assert(cliRefuse === EXIT_REFUSED, 'cli refuse exit 2');
  passed.push('cli-refuse-exit');

  const cliIncomplete = await runXaiCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: () => undefined },
    createLiveAdapters: () => ({
      ports: {
        env: liveEnv,
        log: () => undefined,
        randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        httpPost: async () => ({
          status: 202,
          json: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'queued' },
        }),
        observeLedger: async () => ({ executionStatus: 'failed', deductionPresent: false }),
        wait: async () => undefined,
      },
      shutdown: async () => {
        shutdowns += 1;
        return { complete: true, pendingClients: [], forcedClients: [] };
      },
    }),
  });
  assert(cliIncomplete === EXIT_INCOMPLETE, 'cli incomplete exit 3');
  passed.push('cli-incomplete-exit');

  let ackShutdown = 0;
  const cliAck = await runXaiCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: () => undefined },
    createLiveAdapters: () => ({
      ports: {
        env: liveEnv,
        log: () => undefined,
        randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        httpPost: async () => neverResolve(),
        observeLedger: async () => undefined,
        wait: async () => undefined,
      },
      shutdown: async () => {
        ackShutdown += 1;
        return { complete: true, pendingClients: [], forcedClients: [] };
      },
    }),
  });
  assert(cliAck === EXIT_ACK_UNKNOWN, 'cli ack unknown exit 4');
  assert(ackShutdown === 1, 'cli ack unknown shutdown');
  passed.push('cli-ack-unknown-exit');

  let timeoutShutdown = 0;
  const cliTimeout = await runXaiCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: () => undefined },
    createLiveAdapters: () => ({
      ports: {
        env: liveEnv,
        log: () => undefined,
        randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        httpPost: async () => ({
          status: 202,
          json: { executionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'queued' },
        }),
        observeLedger: async () => ({ executionStatus: 'pending', deductionPresent: false }),
        wait: async () => undefined,
      },
      shutdown: async () => {
        timeoutShutdown += 1;
        return { complete: true, pendingClients: [], forcedClients: [] };
      },
    }),
  });
  assert(cliTimeout === EXIT_TIMEOUT, 'cli timeout exit 5');
  assert(timeoutShutdown === 1, 'cli timeout shutdown');
  passed.push('cli-timeout-exit');

  const cliCleanupStderr: string[] = [];
  const cliCleanupIncomplete = await runXaiCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: (s: string) => cliCleanupStderr.push(s) },
    createLiveAdapters: (input) => {
      const h = createXaiLiveAdapters({
        ...input,
        randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        clients: { http: mockHttp, pg: mockPg, queue: mockQueue, logSource: mockLogs },
        wait: async () => undefined,
      });
      return {
        ports: h.ports,
        shutdown: async () => ({ complete: false, pendingClients: ['pg'], forcedClients: ['redis'] }),
      };
    },
  });
  assert(cliCleanupIncomplete === EXIT_CLEANUP_INCOMPLETE, 'success + incomplete cleanup exits 6');
  assert(cliCleanupStderr.some(s => s.includes('CLEANUP_INCOMPLETE')), 'cleanup incomplete reported to stderr');
  assert(cliCleanupStderr.some(s => s.includes('pg')), 'pending client name reported');
  passed.push('cli-cleanup-incomplete-exit');

  const cliFailCleanupStderr: string[] = [];
  const cliFailPlusCleanup = await runXaiCli({
    env: liveEnv,
    stdout: { write: () => undefined },
    stderr: { write: (s: string) => cliFailCleanupStderr.push(s) },
    createLiveAdapters: () => ({
      ports: {
        env: liveEnv,
        log: () => undefined,
        randomUUID: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        httpPost: async () => neverResolve(),
        observeLedger: async () => undefined,
        wait: async () => undefined,
      },
      shutdown: async () => ({ complete: false, pendingClients: ['pg'], forcedClients: [] }),
    }),
  });
  assert(cliFailPlusCleanup === EXIT_ACK_UNKNOWN, 'failure + incomplete cleanup preserves primary exit');
  assert(cliFailCleanupStderr.some(s => s.includes('CLEANUP_INCOMPLETE')), 'cleanup incomplete reported even on failure');
  passed.push('cli-failure-plus-cleanup-failure');

  return passed;
}

export async function runXaiCli(io: {
  env: NodeJS.Dict<string>;
  stdout: { write: (chunk: string) => void };
  stderr: { write: (chunk: string) => void };
  createLiveAdapters?: typeof createXaiLiveAdapters;
}): Promise<number> {
  const secrets = collectSecretNeedles(io.env);
  const mode = classifySubmissionMode(io.env);
  if (mode === 'isolated-mock') {
    const passed = await runXaiIsolatedSelfTests();
    io.stdout.write(`XAI_ISOLATED_MOCK_PASS count=${passed.length} cases=${passed.join(',')}\n`);
    return EXIT_SUCCESS;
  }
  if (mode === 'refuse') {
    io.stdout.write(
      'XAI_CANARY_NOT_SUBMITTED: AISB_01C6A_LIVE_SUBMIT is not set. Preparation only. Staging execution unauthorized.\n',
    );
    return EXIT_REFUSED;
  }

  let shutdown: (() => Promise<ShutdownResult>) | undefined;
  let primaryExitCode: number;

  try {
    if (!readFlag(io.env, 'AISB_01C6A_STAGING_EXECUTION_AUTHORIZED')) {
      throw new CanaryPrepError(
        'LIVE_SUBMIT_BLOCKED_IN_PREPARATION',
        'Live xAI adapters are implemented but staging execution is not authorized in this window',
      );
    }
    const fixtures = loadXaiFixtures(io.env);
    const create = io.createLiveAdapters ?? createXaiLiveAdapters;
    const handle = create({
      env: io.env,
      fixtures,
      log: (line) => io.stdout.write(`${redactSecrets(line, secrets)}\n`),
    });
    shutdown = handle.shutdown;
    const result = await runXaiNegativeCanary(handle.ports);
    io.stdout.write(`${JSON.stringify(redactSecrets({ event: 'xai_canary_result', ...result }, secrets))}\n`);
    primaryExitCode = exitCodeForXaiResult(result);
  } catch (err) {
    const code = err instanceof CanaryPrepError ? err.code : 'UNCAUGHT';
    io.stderr.write(`XAI_CANARY_FAIL ${sanitizeUntrustedError(err, secrets)}\n`);
    io.stderr.write(`XAI_CANARY_FAIL_CODE=${code}\n`);
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
  process.exitCode = await runXaiCli({
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}

if (require.main === module) {
  main().catch((err) => {
    const code = err instanceof CanaryPrepError ? err.code : 'UNCAUGHT';
    process.stderr.write(`XAI_CANARY_FAIL ${sanitizeUntrustedError(err, collectSecretNeedles(process.env))}\n`);
    process.stderr.write(`XAI_CANARY_FAIL_CODE=${code}\n`);
    process.exitCode = 1;
  });
}
