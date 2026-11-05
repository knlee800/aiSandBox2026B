import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job, Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { AIExecutionService } from '../ai-execution/ai-execution.service';
import { ExecutionStreamPublisher } from '../streaming/execution-stream.publisher';
import {
  incExecutionStarted,
  incExecutionCompleted,
  incExecutionFailed,
  incExecutionCancelled,
  observeExecutionLatency,
} from '../observability/execution-metrics';
import { observeQueueLag } from '../observability/queue-metrics';
import {
  incrementWorkerClaim,
  incrementStuckRecovered,
} from '../observability/worker-metrics';
import type { AIExecutionRequest } from '../ai-execution/types';
import type { WorkspaceContext } from '../queue/job.types';
import { DEFAULT_AGENT_HARNESS_CONFIG_V1 } from '../agent-harness/config/agent-harness.config';
import { resolveBuilderHarnessConfig } from '../agent-harness/builder-profiles';
import {
  executeAgentHarnessLoop,
  HarnessMaxIterationsError,
} from '../agent-harness/orchestrator/agent-harness-loop';
import { ToolDispatcher } from '../agent-harness/tools/tool-dispatcher';
import { createToolProgressWrapper } from '../agent-harness/tools/tool-progress';
import { InMemoryHarnessAuditRecorder } from '../agent-harness/audit';
import {
  createReadFileHandler,
  createListFilesHandler,
  createWriteFileHandler,
  createDeleteFileHandler,
  createSearchWorkspaceHandler,
} from '../agent-harness/tools/handlers/file-tool-handlers';
import { createRunValidationHandler } from '../agent-harness/tools/handlers/validation-tool-handlers';
import { createBrowserSmokeHandler } from '../agent-harness/tools/handlers/browser-smoke-tool-handlers';
import { ApiGatewayHttpClient } from '../clients/api-gateway-http.client';
import type { AIAdapterToolUseRequestOptions } from '../ai-execution/adapters/adapter-tool-use.contracts';
import { selectAdvertisedAgentHarnessTools } from '../ai-execution/adapters/adapter-tool-use.mapper';
import type { AgentHarnessToolRegistryDefinitionV1 } from '../agent-harness/tools/tool-registry.contracts';
import { createHash } from 'crypto';
import * as nodeCrypto from 'crypto';

/**
 * Phase-51.3: Conservative classifier for transient (retryable) errors.
 * Retries only for: timeout, connection reset, 429, 503, overloaded.
 * Non-transient: 400 validation, auth, quota, prompt errors.
 */
function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|timed out|ECONNRESET|ENOTFOUND|429|503|overloaded/i.test(msg);
}

/**
 * Phase-51.3: Sleep with AbortSignal support. Rejects if aborted during wait.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const FILE_ACTION_OUTPUT_CONTRACT = `Execution output contract:
- If the user request requires creating, modifying, or deleting files, you MUST emit a fenced code block tagged \`file-actions\`.
- The \`file-actions\` block content MUST be valid JSON containing an array of actions.
- Each action MUST use action value "create", "write", "update", or "delete".
- "create", "write", and "update" actions MUST include string fields: "path" and "content".
- "delete" actions MUST include string field "path" and MUST NOT include or require "content".
- Do not claim that files were created, changed, or deleted unless matching \`file-actions\` entries are present.
- If the user request does not require file creation, modification, or deletion, respond normally in plain conversational text and do not emit \`file-actions\` blocks.`;

const HARNESS_TOOL_OUTPUT_CONTRACT = `Execution output contract:
- You work through the tools you are given. Files change only when a write tool call succeeds.
- Do not emit \`file-actions\` blocks; they are not applied here.
- Do not claim that a file was created, changed or deleted, or that a command ran, unless the matching tool call succeeded.
- If the request needs a tool you do not have, say so plainly and do not claim the result.
- If a tool result carries a harnessNotice, follow it.
- When the work is done, answer in plain text.`;

export const FILE_ACTION_CONTRACT_FAILURE_CODE = 'file_action_contract_failure';
export const FILE_ACTION_CONTRACT_FAILURE_MESSAGE =
  'Builder execution produced no valid file actions';
export type BuilderExecutionIntent = 'conversation' | 'workspace_mutation';
export const DEFAULT_BUILDER_EXECUTION_INTENT: BuilderExecutionIntent =
  'workspace_mutation';

export const DEFAULT_EXECUTION_TIMEOUT_MS = 20000;

export function parseExecutionTimeoutBaselineMs(
  rawValue: string | undefined = process.env.EXECUTION_TIMEOUT_MS,
): number {
  const parsed = parseInt(
    rawValue ?? String(DEFAULT_EXECUTION_TIMEOUT_MS),
    10,
  );
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_EXECUTION_TIMEOUT_MS;
  }
  return parsed;
}

export function resolveStuckWatchdogThresholdSeconds(
  baselineMs: number = parseExecutionTimeoutBaselineMs(),
): number {
  return Math.ceil((baselineMs * 2) / 1000);
}

export function resolveBullMqLockDurationMs(
  baselineTimeoutMs: number = parseExecutionTimeoutBaselineMs(),
): number {
  return Math.max(baselineTimeoutMs + 10000, 30000);
}

export function resolveWorkerExecutionIntent(
  input: unknown,
): BuilderExecutionIntent {
  if (input === 'conversation' || input === 'workspace_mutation') {
    return input;
  }
  return DEFAULT_BUILDER_EXECUTION_INTENT;
}

export function resolveEffectiveFileActionsForExecutionIntent<T>(input: {
  executionIntent: BuilderExecutionIntent;
  useHarness: boolean;
  safeFileActions: T[];
}): { effectiveFileActions: T[]; suppressedActionCount: number } {
  if (
    !input.useHarness &&
    input.executionIntent === 'conversation' &&
    input.safeFileActions.length > 0
  ) {
    return {
      effectiveFileActions: [],
      suppressedActionCount: input.safeFileActions.length,
    };
  }

  return {
    effectiveFileActions: input.safeFileActions,
    suppressedActionCount: 0,
  };
}

export function resolveLedgerModel(
  resultModel: unknown,
  jobModel: unknown,
): string | null {
  for (const candidate of [resultModel, jobModel]) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const trimmed = candidate.trim();
    if (trimmed.length === 0) {
      continue;
    }
    return trimmed.length > 100 ? trimmed.slice(0, 100) : trimmed;
  }
  return null;
}

export type HarnessRoutingFailReason =
  | 'tool_loop_disabled'
  | 'adapter_lacks_tool_use'
  | 'adapter_lacks_execute_with_tools';

export type HarnessRoutingDecision =
  | { readonly selectedPath: 'plain' }
  | { readonly selectedPath: 'harness' }
  | {
      readonly selectedPath: 'fail_closed';
      readonly failReason: HarnessRoutingFailReason;
    };

function harnessRoutingFailureMessage(reason: HarnessRoutingFailReason): string {
  return `Requested Harness execution cannot proceed (${reason})`;
}

export class HarnessRoutingError extends Error {
  readonly code: 'harness_tool_loop_disabled' | 'harness_unsupported_adapter';
  readonly reason: HarnessRoutingFailReason;

  constructor(reason: HarnessRoutingFailReason) {
    const code =
      reason === 'tool_loop_disabled'
        ? 'harness_tool_loop_disabled'
        : 'harness_unsupported_adapter';
    super(harnessRoutingFailureMessage(reason));
    this.name = 'HarnessRoutingError';
    this.code = code;
    this.reason = reason;
  }
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

export function copyJobPayloadWithoutProof(
  job: Record<string, unknown>,
): Record<string, unknown> {
  const copy = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(job)) {
    if (key !== 'harnessEntitlementProof') {
      copy[key] = job[key];
    }
  }
  return copy;
}

export function computePayloadDigest(
  payloadWithoutProof: Record<string, unknown>,
): { canonicalJson: string; payloadDigest: string } {
  let jsonStr: string | undefined;
  try {
    jsonStr = JSON.stringify(payloadWithoutProof);
  } catch {
    throw new Error('Payload serialization failed');
  }
  if (jsonStr === undefined) {
    throw new Error(
      'Payload serialization failed: JSON.stringify returned undefined',
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Payload serialization failed');
  }
  const canonicalJson = JSON.stringify(sortKeysRecursive(parsed));
  const payloadDigest = createHash('sha256')
    .update(canonicalJson, 'utf8')
    .digest('hex');
  return { canonicalJson, payloadDigest };
}

export function computeJobPayloadDigest(
  job: Record<string, unknown>,
): { canonicalJson: string; payloadDigest: string } {
  return computePayloadDigest(copyJobPayloadWithoutProof(job));
}

const HARNESS_EMPTY_ADVERTISED_TOOL_SET_MESSAGE =
  'Requested Harness execution cannot proceed (empty_advertised_tool_set)';

export class HarnessEmptyAdvertisedToolSetError extends Error {
  readonly code = 'harness_empty_advertised_tool_set' as const;

  constructor() {
    super(HARNESS_EMPTY_ADVERTISED_TOOL_SET_MESSAGE);
    this.name = 'HarnessEmptyAdvertisedToolSetError';
  }
}

export const HARNESS_ENTITLEMENT_PROOF_MISSING =
  'HARNESS_ENTITLEMENT_PROOF_MISSING';
export const HARNESS_ENTITLEMENT_PROOF_MALFORMED =
  'HARNESS_ENTITLEMENT_PROOF_MALFORMED';
export const HARNESS_ENTITLEMENT_PROOF_UNSUPPORTED_VERSION =
  'HARNESS_ENTITLEMENT_PROOF_UNSUPPORTED_VERSION';
export const HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH =
  'HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH';
export const HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH =
  'HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH';
export const HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE =
  'HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE';
export const HARNESS_ENTITLEMENT_PROOF_SECRET_NOT_CONFIGURED =
  'HARNESS_ENTITLEMENT_PROOF_SECRET_NOT_CONFIGURED';

export class HarnessEntitlementError extends Error {
  readonly code: string;
  readonly isRetryable = false;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HarnessEntitlementError';
    this.code = code;
  }
}

function harnessEntitlementFailureMessage(code: string): string {
  return `Harness entitlement proof verification failed (${code})`;
}

function harnessEntitlementFailure(code: string): HarnessEntitlementError {
  return new HarnessEntitlementError(
    code,
    harnessEntitlementFailureMessage(code),
  );
}

const LOWERCASE_HEX_64 = /^[0-9a-f]{64}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function readValidatedHarnessEntitlementHmacSecret(): string | undefined {
  const raw = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}

export function verifyHarnessEntitlementProof(
  job: Record<string, unknown>,
): void {
  if (job.harnessVersion !== 'v1') {
    return;
  }

  const proof = job.harnessEntitlementProof;
  if (proof === undefined || proof === null) {
    throw harnessEntitlementFailure(HARNESS_ENTITLEMENT_PROOF_MISSING);
  }

  if (typeof proof !== 'object' || Array.isArray(proof)) {
    throw harnessEntitlementFailure(HARNESS_ENTITLEMENT_PROOF_MALFORMED);
  }

  const proofObject = proof as Record<string, unknown>;

  if (typeof proofObject.version === 'number' && proofObject.version !== 1) {
    throw harnessEntitlementFailure(
      HARNESS_ENTITLEMENT_PROOF_UNSUPPORTED_VERSION,
    );
  }
  if (proofObject.version !== 1) {
    throw harnessEntitlementFailure(HARNESS_ENTITLEMENT_PROOF_MALFORMED);
  }

  if (
    !isNonEmptyString(proofObject.executionId) ||
    !isNonEmptyString(proofObject.userId) ||
    !isNonEmptyString(proofObject.apiKeyId) ||
    !isNonEmptyString(proofObject.issuedAt) ||
    proofObject.harnessVersion !== 'v1' ||
    !isNonEmptyString(proofObject.payloadDigest) ||
    !isNonEmptyString(proofObject.signature) ||
    !LOWERCASE_HEX_64.test(proofObject.payloadDigest) ||
    !LOWERCASE_HEX_64.test(proofObject.signature)
  ) {
    throw harnessEntitlementFailure(HARNESS_ENTITLEMENT_PROOF_MALFORMED);
  }

  if (
    proofObject.executionId !== job.executionId ||
    proofObject.userId !== job.userId ||
    proofObject.apiKeyId !== job.apiKeyId ||
    proofObject.harnessVersion !== job.harnessVersion
  ) {
    throw harnessEntitlementFailure(HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH);
  }

  const secret = readValidatedHarnessEntitlementHmacSecret();
  if (secret === undefined) {
    throw harnessEntitlementFailure(
      HARNESS_ENTITLEMENT_PROOF_SECRET_NOT_CONFIGURED,
    );
  }

  let recomputedDigest: string;
  try {
    recomputedDigest = computeJobPayloadDigest(job).payloadDigest;
  } catch (error) {
    if (error instanceof HarnessEntitlementError) {
      throw error;
    }
    throw harnessEntitlementFailure(
      HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH,
    );
  }

  if (recomputedDigest !== proofObject.payloadDigest) {
    throw harnessEntitlementFailure(
      HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH,
    );
  }

  const claim = `v=1|executionId=${proofObject.executionId}|userId=${proofObject.userId}|apiKeyId=${proofObject.apiKeyId}|harnessVersion=v1|issuedAt=${proofObject.issuedAt}|payloadDigest=${proofObject.payloadDigest}`;

  let expectedHex: string;
  try {
    expectedHex = nodeCrypto
      .createHmac('sha256', secret)
      .update(claim, 'utf8')
      .digest('hex');
  } catch {
    throw harnessEntitlementFailure(HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE);
  }

  if (!LOWERCASE_HEX_64.test(expectedHex)) {
    throw harnessEntitlementFailure(HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE);
  }

  let expectedBuffer: Buffer;
  let actualBuffer: Buffer;
  try {
    expectedBuffer = Buffer.from(expectedHex, 'hex');
    actualBuffer = Buffer.from(proofObject.signature, 'hex');
  } catch {
    throw harnessEntitlementFailure(HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE);
  }

  if (
    expectedBuffer.length !== 32 ||
    actualBuffer.length !== 32 ||
    expectedBuffer.length !== actualBuffer.length
  ) {
    throw harnessEntitlementFailure(HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE);
  }

  try {
    if (!nodeCrypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      throw harnessEntitlementFailure(
        HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE,
      );
    }
  } catch (error) {
    if (error instanceof HarnessEntitlementError) {
      throw error;
    }
    throw harnessEntitlementFailure(HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE);
  }
}

export function requireNonEmptyAdvertisedHarnessTools(
  tools: readonly AgentHarnessToolRegistryDefinitionV1[],
): readonly AgentHarnessToolRegistryDefinitionV1[] {
  if (tools.length === 0) {
    throw new HarnessEmptyAdvertisedToolSetError();
  }
  return tools;
}

export function mergeAdvertisedToolsIntoExecuteOptions(
  options: AIAdapterToolUseRequestOptions | undefined,
  advertisedTools: readonly AgentHarnessToolRegistryDefinitionV1[],
): AIAdapterToolUseRequestOptions {
  return {
    ...options,
    tools: advertisedTools,
  };
}

export function resolveHarnessRouting(input: {
  harnessVersion?: string | null;
  enableToolLoop: boolean;
  adapterSupportsToolUse?: boolean;
  adapterHasExecuteWithTools?: boolean;
}): HarnessRoutingDecision {
  if (input.harnessVersion !== 'v1') {
    return { selectedPath: 'plain' };
  }
  if (!input.enableToolLoop) {
    return {
      selectedPath: 'fail_closed',
      failReason: 'tool_loop_disabled',
    };
  }
  if (input.adapterSupportsToolUse !== true) {
    return {
      selectedPath: 'fail_closed',
      failReason: 'adapter_lacks_tool_use',
    };
  }
  if (input.adapterHasExecuteWithTools !== true) {
    return {
      selectedPath: 'fail_closed',
      failReason: 'adapter_lacks_execute_with_tools',
    };
  }
  return { selectedPath: 'harness' };
}

export const HARNESS_TOOL_PROFILE_CONFLICT = 'harness_tool_profile_conflict';
export const HARNESS_TOOL_PROFILE_INVALID = 'harness_tool_profile_invalid';
export const HARNESS_TOOL_PROFILE_MISSING = 'harness_tool_profile_missing';
export const HARNESS_WRITE_TOOLS_DISABLED = 'harness_write_tools_disabled';
export const HARNESS_VALIDATION_TOOLS_DISABLED =
  'harness_validation_tools_disabled';

export const HARNESS_TOOL_PROFILE_CONFLICT_MESSAGE =
  'The tool profile does not match the read-only flag, so this step was stopped.';
export const HARNESS_TOOL_PROFILE_INVALID_MESSAGE =
  'The tool profile is not read, review, write, or agent-write, so this step was stopped.';
export const HARNESS_TOOL_PROFILE_MISSING_MESSAGE =
  'No tool profile was signed for this run, so it was stopped.';
export const HARNESS_TOOL_PROFILE_REQUIRES_HARNESS_MESSAGE =
  'A tool profile was set without harness v1, so this step was stopped.';
export const HARNESS_WRITE_TOOLS_DISABLED_MESSAGE =
  'File changes are turned off, so this writer step cannot run.';
export const HARNESS_VALIDATION_TOOLS_DISABLED_MESSAGE =
  'Test commands are turned off, so this step cannot run.';

export type HarnessToolProfileName =
  | 'read'
  | 'review'
  | 'write'
  | 'agent-write';

export type HarnessToolProfileResolution = {
  readonly ok: boolean;
  readonly profile: HarnessToolProfileName | null;
  readonly code: string;
  readonly message: string;
};

export function resolveHarnessToolProfile(job: {
  readonly harnessToolProfile?: unknown;
  readonly harnessReadOnly?: unknown;
  readonly harnessVersion?: unknown;
}): HarnessToolProfileResolution {
  if (job.harnessToolProfile === undefined) {
    if (job.harnessVersion === 'v1') {
      return {
        ok: false,
        profile: null,
        code: HARNESS_TOOL_PROFILE_MISSING,
        message: HARNESS_TOOL_PROFILE_MISSING_MESSAGE,
      };
    }
    return { ok: true, profile: null, code: '', message: '' };
  }
  if (job.harnessVersion !== 'v1') {
    return {
      ok: false,
      profile: null,
      code: HARNESS_TOOL_PROFILE_INVALID,
      message: HARNESS_TOOL_PROFILE_REQUIRES_HARNESS_MESSAGE,
    };
  }
  if (
    job.harnessToolProfile !== 'read' &&
    job.harnessToolProfile !== 'review' &&
    job.harnessToolProfile !== 'write' &&
    job.harnessToolProfile !== 'agent-write'
  ) {
    return {
      ok: false,
      profile: null,
      code: HARNESS_TOOL_PROFILE_INVALID,
      message: HARNESS_TOOL_PROFILE_INVALID_MESSAGE,
    };
  }
  if (job.harnessReadOnly === true && job.harnessToolProfile !== 'read') {
    return {
      ok: false,
      profile: null,
      code: HARNESS_TOOL_PROFILE_CONFLICT,
      message: HARNESS_TOOL_PROFILE_CONFLICT_MESSAGE,
    };
  }
  return {
    ok: true,
    profile: job.harnessToolProfile,
    code: '',
    message: '',
  };
}

function readStoredUsageMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      return {};
    }
  }
  return {};
}

const STORED_EXECUTION_ERROR_CODE = 'execution_failed';
const STORED_EXECUTION_ERROR_MESSAGE = 'This step failed.';
const STORED_EXECUTION_ERROR_MESSAGE_MAX = 300;
const SHORT_ERROR_CODE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const STUCK_RUNNING_FAILURE_MESSAGE =
  'This step was stopped because it stayed running too long.';
const STALLED_RUNNING_FAILURE_MESSAGE =
  'This step was stopped because it was still marked running.';

const HARNESS_ENTITLEMENT_FAILURE_CODES: readonly string[] = [
  HARNESS_ENTITLEMENT_PROOF_MISSING,
  HARNESS_ENTITLEMENT_PROOF_MALFORMED,
  HARNESS_ENTITLEMENT_PROOF_UNSUPPORTED_VERSION,
  HARNESS_ENTITLEMENT_PROOF_BINDING_MISMATCH,
  HARNESS_ENTITLEMENT_PROOF_PAYLOAD_INTEGRITY_MISMATCH,
  HARNESS_ENTITLEMENT_PROOF_INVALID_SIGNATURE,
  HARNESS_ENTITLEMENT_PROOF_SECRET_NOT_CONFIGURED,
];

function knownHarnessMessages(code: string): readonly string[] {
  switch (code) {
    case 'harness_tool_loop_disabled':
      return [harnessRoutingFailureMessage('tool_loop_disabled')];
    case 'harness_unsupported_adapter':
      return [
        harnessRoutingFailureMessage('adapter_lacks_tool_use'),
        harnessRoutingFailureMessage('adapter_lacks_execute_with_tools'),
      ];
    case 'harness_empty_advertised_tool_set':
      return [HARNESS_EMPTY_ADVERTISED_TOOL_SET_MESSAGE];
    case HARNESS_TOOL_PROFILE_CONFLICT:
      return [HARNESS_TOOL_PROFILE_CONFLICT_MESSAGE];
    case HARNESS_TOOL_PROFILE_MISSING:
      return [HARNESS_TOOL_PROFILE_MISSING_MESSAGE];
    case HARNESS_TOOL_PROFILE_INVALID:
      return [
        HARNESS_TOOL_PROFILE_INVALID_MESSAGE,
        HARNESS_TOOL_PROFILE_REQUIRES_HARNESS_MESSAGE,
      ];
    case HARNESS_WRITE_TOOLS_DISABLED:
      return [HARNESS_WRITE_TOOLS_DISABLED_MESSAGE];
    case HARNESS_VALIDATION_TOOLS_DISABLED:
      return [HARNESS_VALIDATION_TOOLS_DISABLED_MESSAGE];
    default:
      if (HARNESS_ENTITLEMENT_FAILURE_CODES.includes(code)) {
        return [harnessEntitlementFailureMessage(code)];
      }
      return [];
  }
}

function fixedSafeSentence(code: string): string {
  const known = knownHarnessMessages(code);
  if (known.length === 1) {
    return known[0];
  }
  if (code === 'harness_unsupported_adapter') {
    return 'Requested Harness execution cannot proceed (unsupported adapter)';
  }
  if (code === HARNESS_TOOL_PROFILE_INVALID) {
    return HARNESS_TOOL_PROFILE_INVALID_MESSAGE;
  }
  return STORED_EXECUTION_ERROR_MESSAGE;
}

function readShortErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return STORED_EXECUTION_ERROR_CODE;
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string') {
    return STORED_EXECUTION_ERROR_CODE;
  }
  const trimmed = code.trim();
  if (!SHORT_ERROR_CODE.test(trimmed)) {
    return STORED_EXECUTION_ERROR_CODE;
  }
  return trimmed;
}

function readRawErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error || (error && typeof error === 'object' && 'message' in error)) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
}

function collapseFirstLine(value: string): string {
  const firstLine = value.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.replace(/\s+/g, ' ').trim();
}

function looksLikeStackOrNumberedPath(value: string): boolean {
  return (
    value.includes('node_modules') ||
    /\n\s*at\s+\S+/.test(value) ||
    /\bat\s+\S+\s+\(/.test(value) ||
    /[A-Za-z]:\\[^\r\n]{0,240}:\d+/.test(value) ||
    /\b[\w.-]+\.[cm]?[jt]sx?:\d+/.test(value) ||
    /\b[\w.-]+\.py:\d+/.test(value) ||
    /(?:^|[\s'"(])\/[^\s:'"]+\.[A-Za-z0-9]+:\d+/.test(value)
  );
}

function looksLikeCredential(value: string): boolean {
  return (
    /api[_ -]?key/i.test(value) ||
    /\b(?:password|passwd|secret|bearer|token)\b/i.test(value) ||
    /\bkey\b/i.test(value) ||
    /\bsk-[A-Za-z0-9]{6,}/.test(value) ||
    /\beyJ[A-Za-z0-9_-]{8,}/.test(value) ||
    /-----BEGIN [A-Z ]*KEY-----/.test(value)
  );
}

function looksLikePromptOrFileContent(value: string, prompt: string | undefined): boolean {
  if (value.includes('```')) {
    return true;
  }
  const codeLines = value.split(/\r?\n/).filter((line) =>
    /^\s*(?:import |export |function |const |let |class |def |public |private |#include |package )/.test(
      line,
    ),
  );
  if (codeLines.length >= 3) {
    return true;
  }
  if (typeof prompt !== 'string') {
    return false;
  }
  const trimmed = prompt.trim();
  if (trimmed.length < 40) {
    return false;
  }
  const window = 40;
  const step = 20;
  const last = Math.min(trimmed.length - window, 400);
  for (let index = 0; index <= last; index += step) {
    if (value.includes(trimmed.slice(index, index + window))) {
      return true;
    }
  }
  return false;
}

function isUnsafeExecutionErrorText(value: string, prompt: string | undefined): boolean {
  return (
    looksLikeStackOrNumberedPath(value) ||
    looksLikeCredential(value) ||
    looksLikePromptOrFileContent(value, prompt)
  );
}

function resolveStoredExecutionError(
  error: unknown,
  prompt?: string,
): { code: string; message: string } {
  const code = readShortErrorCode(error);
  const raw = readRawErrorMessage(error);
  const known = knownHarnessMessages(code);
  const trimmed = raw.trim();
  const exact = known.find((message) => message === trimmed);
  if (exact) {
    return { code, message: exact };
  }
  if (isUnsafeExecutionErrorText(raw, prompt)) {
    const contained = known.find((message) => trimmed.includes(message));
    return {
      code,
      message: contained ?? fixedSafeSentence(code),
    };
  }
  const collapsed = collapseFirstLine(raw);
  if (collapsed.length === 0) {
    return { code, message: fixedSafeSentence(code) };
  }
  return {
    code,
    message:
      collapsed.length > STORED_EXECUTION_ERROR_MESSAGE_MAX
        ? collapsed.slice(0, STORED_EXECUTION_ERROR_MESSAGE_MAX)
        : collapsed,
  };
}

interface FileActionContractValidationResult {
  isContractFailure: boolean;
  finalContractResult: 'passed' | 'failed';
  errorCode?: typeof FILE_ACTION_CONTRACT_FAILURE_CODE;
  errorMessage?: typeof FILE_ACTION_CONTRACT_FAILURE_MESSAGE;
}

export function validatePlainPathFileActionContract(input: {
  useHarness: boolean;
  safeFileActionCount: number;
  executionIntent?: BuilderExecutionIntent;
}): FileActionContractValidationResult {
  const executionIntent = input.executionIntent ?? DEFAULT_BUILDER_EXECUTION_INTENT;
  if (
    !input.useHarness &&
    executionIntent === 'workspace_mutation' &&
    input.safeFileActionCount === 0
  ) {
    return {
      isContractFailure: true,
      finalContractResult: 'failed',
      errorCode: FILE_ACTION_CONTRACT_FAILURE_CODE,
      errorMessage: FILE_ACTION_CONTRACT_FAILURE_MESSAGE,
    };
  }

  return {
    isContractFailure: false,
    finalContractResult: 'passed',
  };
}

function buildWorkspaceContextBlock(
  workspaceContext?: WorkspaceContext,
): string | null {
  if (!workspaceContext || typeof workspaceContext !== 'object') {
    return null;
  }

  const normalizedFilePaths = Array.isArray(workspaceContext.filePaths)
    ? workspaceContext.filePaths
        .filter((path): path is string => typeof path === 'string')
        .map((path) => path.trim())
        .filter((path) => path.length > 0)
    : [];

  const normalizedSelectedFilePath =
    typeof workspaceContext.selectedFilePath === 'string' &&
    workspaceContext.selectedFilePath.trim().length > 0
      ? workspaceContext.selectedFilePath.trim()
      : null;
  const normalizedSelectedFileContent =
    typeof workspaceContext.selectedFileContent === 'string' &&
    workspaceContext.selectedFileContent.trim().length > 0
      ? workspaceContext.selectedFileContent.trim()
      : null;
  const normalizedNamedFileContents = Array.isArray(workspaceContext.namedFileContents)
    ? workspaceContext.namedFileContents
        .filter(
          (
            file,
          ): file is {
            path: string;
            content: string;
          } =>
            !!file &&
            typeof file === 'object' &&
            typeof file.path === 'string' &&
            typeof file.content === 'string',
        )
        .map((file) => ({
          path: file.path.trim(),
          content: file.content.trim(),
        }))
        .filter((file) => file.path.length > 0 && file.content.length > 0)
    : [];
  const normalizedRepoDocContents = Array.isArray(workspaceContext.repoDocContents)
    ? workspaceContext.repoDocContents
        .filter(
          (
            doc,
          ): doc is {
            path: string;
            content: string;
          } =>
            !!doc &&
            typeof doc === 'object' &&
            typeof doc.path === 'string' &&
            typeof doc.content === 'string',
        )
        .map((doc) => ({
          path: doc.path.trim(),
          content: doc.content.trim(),
        }))
        .filter((doc) => doc.path.length > 0 && doc.content.length > 0)
    : [];
  const normalizedSearchResults =
    workspaceContext.searchResults &&
    typeof workspaceContext.searchResults === 'object' &&
    typeof workspaceContext.searchResults.query === 'string' &&
    workspaceContext.searchResults.query.trim().length > 0
      ? {
          query: workspaceContext.searchResults.query.trim(),
          results: Array.isArray(workspaceContext.searchResults.results)
            ? workspaceContext.searchResults.results
                .filter(
                  (
                    result,
                  ): result is {
                    path: string;
                    line: number;
                    preview: string;
                  } =>
                    !!result &&
                    typeof result === 'object' &&
                    typeof result.path === 'string' &&
                    typeof result.line === 'number' &&
                    Number.isFinite(result.line) &&
                    typeof result.preview === 'string',
                )
                .map((result) => ({
                  path: result.path.trim(),
                  line: Math.max(1, Math.trunc(result.line)),
                  preview: result.preview.trim(),
                }))
                .filter((result) => result.path.length > 0 && result.preview.length > 0)
            : [],
          truncated: workspaceContext.searchResults.truncated === true,
        }
      : null;
  const normalizedProjectName =
    typeof workspaceContext.projectName === 'string' &&
    workspaceContext.projectName.trim().length > 0
      ? workspaceContext.projectName.trim()
      : null;
  const normalizedWorkspaceName =
    typeof workspaceContext.workspaceName === 'string' &&
    workspaceContext.workspaceName.trim().length > 0
      ? workspaceContext.workspaceName.trim()
      : null;

  if (
    normalizedFilePaths.length === 0 &&
    !normalizedSelectedFilePath &&
    !normalizedSelectedFileContent &&
    normalizedNamedFileContents.length === 0 &&
    normalizedRepoDocContents.length === 0 &&
    !normalizedSearchResults &&
    !normalizedProjectName &&
    !normalizedWorkspaceName
  ) {
    return null;
  }

  const sections: string[] = [];
  if (normalizedRepoDocContents.length > 0) {
    sections.push(
      [
        'Repo Docs:',
        ...normalizedRepoDocContents.map(
          (doc) => `Repo doc content: ${doc.path}\n${doc.content}`,
        ),
      ].join('\n\n'),
    );
  }
  if (normalizedProjectName) {
    sections.push(`Current project:\n${normalizedProjectName}`);
  }
  if (normalizedWorkspaceName) {
    sections.push(`Current workspace:\n${normalizedWorkspaceName}`);
  }
  if (normalizedFilePaths.length > 0) {
    sections.push(
      ['Current workspace files:', ...normalizedFilePaths.map((path) => `- ${path}`)].join('\n'),
    );
  }
  if (normalizedSelectedFilePath) {
    sections.push(`Currently open file:\n${normalizedSelectedFilePath}`);
  }
  if (normalizedSelectedFileContent) {
    sections.push(`Selected file content:\n${normalizedSelectedFileContent}`);
  }
  for (const namedFile of normalizedNamedFileContents) {
    sections.push(`Named file content: ${namedFile.path}\n${namedFile.content}`);
  }
  if (normalizedSearchResults) {
    const searchLines =
      normalizedSearchResults.results.length > 0
        ? normalizedSearchResults.results.map(
            (result) => `- ${result.path}:${result.line} - ${result.preview}`,
          )
        : ['(no matches found)'];
    if (normalizedSearchResults.truncated) {
      searchLines.push('[...results truncated]');
    }
    sections.push(
      [`Workspace search results for: ${normalizedSearchResults.query}`, ...searchLines].join(
        '\n',
      ),
    );
  }

  return sections.join('\n\n');
}

function buildGlobalInstructionsBlock(
  globalInstructions?: string | null,
): string | null {
  if (typeof globalInstructions !== 'string') {
    return null;
  }
  const normalizedGlobalInstructions = globalInstructions.trim();
  if (normalizedGlobalInstructions.length === 0) {
    return null;
  }
  return `Global AI Instructions:\n${normalizedGlobalInstructions}`;
}

function buildProjectInstructionsBlock(
  projectInstructions?: string | null,
): string | null {
  if (typeof projectInstructions !== 'string') {
    return null;
  }
  const normalizedProjectInstructions = projectInstructions.trim();
  if (normalizedProjectInstructions.length === 0) {
    return null;
  }
  return `Project AI Instructions:\n${normalizedProjectInstructions}`;
}

export function buildExecutionPromptParts(
  userPrompt: string,
  workspaceContext?: WorkspaceContext,
  globalInstructions?: string | null,
  projectInstructions?: string | null,
  options?: { useHarness?: boolean },
): { system: string; user: string } {
  const normalizedPrompt = typeof userPrompt === 'string' ? userPrompt : '';
  const globalInstructionsBlock = buildGlobalInstructionsBlock(globalInstructions);
  const projectInstructionsBlock =
    buildProjectInstructionsBlock(projectInstructions);
  const workspaceContextBlock = buildWorkspaceContextBlock(workspaceContext);
  const outputContract =
    options?.useHarness === true
      ? HARNESS_TOOL_OUTPUT_CONTRACT
      : FILE_ACTION_OUTPUT_CONTRACT;
  const systemSections: string[] = [outputContract];
  if (globalInstructionsBlock) {
    systemSections.push(globalInstructionsBlock);
  }
  if (projectInstructionsBlock) {
    systemSections.push(projectInstructionsBlock);
  }
  const userSections: string[] = [];
  if (workspaceContextBlock) {
    userSections.push(workspaceContextBlock);
  }
  userSections.push(`User request:\n${normalizedPrompt}`);
  return {
    system: systemSections.join('\n\n'),
    user: userSections.join('\n\n'),
  };
}

export function buildAIExecutionRequest(
  jobData: {
    provider: AIExecutionRequest['provider'];
    executionId: string;
    agentId?: string;
    sessionId: string;
    conversationId: string;
    userId: string;
    model?: string;
  },
  promptParts: { system: string; user: string },
  signal?: AbortSignal,
): AIExecutionRequest {
  return {
    provider: jobData.provider,
    prompt: promptParts.user,
    systemPrompt: promptParts.system,
    executionId: jobData.executionId,
    agentId: jobData.agentId,
    sessionId: jobData.sessionId,
    conversationId: jobData.conversationId,
    userId: jobData.userId,
    model: jobData.model,
    signal,
  };
}

interface ExecutionCompletionLog {
  event: string;
  executionId: string;
  provider: string;
  workerId?: number;
  queue_wait_ms?: number;
  duration_ms: number;
  tokens?: number;
  execution_status: string;
  metrics?: {
    execution_completed_total: number;
    execution_failed_total: number;
    execution_cancelled_total: number;
    execution_timeout_total: number;
  };
}

@Injectable()
export class WorkerProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerProcessor.name);

  private metrics = {
    execution_completed_total: 0,
    execution_failed_total: 0,
    execution_cancelled_total: 0,
    execution_timeout_total: 0,
  };

  private connection: Redis;
  private queueEventsConnection: Redis;
  private queue: Queue;
  private queueEvents: QueueEvents;
  private worker: Worker;
  private readonly workerId = process.pid;
  private stuckScanIntervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly aiExecutionService: AIExecutionService,
    private readonly executionStreamPublisher: ExecutionStreamPublisher,
    private readonly apiGatewayHttpClient: ApiGatewayHttpClient,
  ) {}

  /**
   * Phase-49: Expose metrics for internal endpoint.
   * Returns a copy to prevent external mutation.
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Phase-49: Emit structured execution completion log.
   * Non-intrusive, read-only instrumentation.
   */
  private logExecutionCompletion(payload: ExecutionCompletionLog): void {
    this.logger.log(JSON.stringify(payload));
  }

  /**
   * Phase-51.2: QueueEvents handlers for worker crash resilience.
   * Monitors queue lifecycle events to maintain ledger consistency.
   */
  private setupQueueEventsHandlers(): void {
    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      const executionId = await this.getExecutionIdFromJob(jobId);
      this.logger.log(
        `QueueEvent: job failed executionId=${executionId ?? 'unknown'} workerId=${this.workerId} jobId=${jobId}`,
      );
      if (executionId) {
        const result = await this.markRunningLedgerFailed(
          executionId,
          resolveStoredExecutionError({
            message: typeof failedReason === 'string' ? failedReason : '',
          }),
        );
        if (result.length > 0) {
          incExecutionFailed();
          this.executionStreamPublisher.publishCompletion(executionId);
        }
      }
    });

    this.queueEvents.on('stalled', async ({ jobId }) => {
      const executionId = await this.getExecutionIdFromJob(jobId);
      this.logger.log(
        `QueueEvent: job stalled executionId=${executionId ?? 'unknown'} workerId=${this.workerId} jobId=${jobId}`,
      );
    });

    this.queueEvents.on('completed', async ({ jobId }) => {
      const executionId = await this.getExecutionIdFromJob(jobId);
      this.logger.debug(
        `QueueEvent: job completed executionId=${executionId ?? 'unknown'} workerId=${this.workerId} jobId=${jobId}`,
      );
    });
  }

  private async getExecutionIdFromJob(jobId: string): Promise<string | null> {
    try {
      const job = await this.queue.getJob(jobId);
      return job?.data?.executionId ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Phase-51.5: Stuck execution watchdog scanner.
   * Detects executions stuck in 'running' beyond allowed timeout.
   * Read-only detection; only updates ledger when confirmed stuck.
   * Never triggers AI execution.
   *
   * Threshold is 2 × the global execution timeout (40s under the 20s default).
   */
  private async scanForStuckExecutions(): Promise<void> {
    const stuckThresholdSeconds = resolveStuckWatchdogThresholdSeconds();

    const rows = (await this.dataSource.query(
      `
      SELECT execution_id, timestamp
      FROM usage_records
      WHERE execution_status = 'running'
      AND timestamp < NOW() - INTERVAL '1 second' * $1
      LIMIT 50
      `,
      [stuckThresholdSeconds],
    )) as Array<{ execution_id: string; timestamp: string }>;

    for (const row of rows) {
      const executionId = row.execution_id;
      const result = await this.markRunningLedgerFailed(executionId, {
        code: STORED_EXECUTION_ERROR_CODE,
        message: STUCK_RUNNING_FAILURE_MESSAGE,
      });

      if (result.length > 0) {
        incExecutionFailed();
        incrementStuckRecovered();
        this.executionStreamPublisher.publishCompletion(executionId);
        const runtimeMs = Math.round(
          Date.now() - new Date(row.timestamp).getTime(),
        );
        this.logger.warn(
          `Recovered stuck execution executionId=${executionId} workerId=${this.workerId} runtime_ms=${runtimeMs}`,
        );
      }
    }
  }

  private async persistStoredExecutionFailure(input: {
    executionId: string;
    model: string | undefined;
    code: string;
    message: string;
    executionStartTime: number;
  }): Promise<void> {
    const metadataRows = await this.dataSource.query(
      `
      SELECT metadata
      FROM usage_records
      WHERE execution_id = $1
      `,
      [input.executionId],
    );
    const nextMetadata: Record<string, unknown> = {
      ...readStoredUsageMetadata(metadataRows[0]?.metadata),
      executionError: {
        code: input.code,
        message: input.message,
      },
    };
    const durationMs = Math.round(
      performance.now() - input.executionStartTime,
    );
    await this.dataSource.query(
      `
      UPDATE usage_records
      SET execution_status = 'failed',
          metadata = $2::jsonb,
          model = $3,
          execution_duration_ms = $4
      WHERE execution_id = $1
      `,
      [
        input.executionId,
        JSON.stringify(nextMetadata),
        resolveLedgerModel(undefined, input.model),
        durationMs,
      ],
    );
    this.executionStreamPublisher.publishCompletion(input.executionId);
    incExecutionFailed();
    this.metrics.execution_failed_total++;
    this.logger.warn(
      `Harness tool profile rejected executionId=${input.executionId} code=${input.code}`,
    );
  }

  private async readMergedExecutionMetadata(
    executionId: string,
    executionError: { readonly code: string; readonly message: string },
  ): Promise<string | null> {
    try {
      const metadataRows = await this.dataSource.query(
        `
        SELECT metadata
        FROM usage_records
        WHERE execution_id = $1
        `,
        [executionId],
      );
      return JSON.stringify({
        ...readStoredUsageMetadata(metadataRows[0]?.metadata),
        executionError: {
          code: executionError.code,
          message: executionError.message,
        },
      });
    } catch {
      this.logger.warn(
        `Could not read usage metadata before storing executionError executionId=${executionId}`,
      );
      return null;
    }
  }

  private async markRunningLedgerFailed(
    executionId: string,
    executionError: { readonly code: string; readonly message: string },
  ): Promise<unknown[]> {
    const metadataJson = await this.readMergedExecutionMetadata(
      executionId,
      executionError,
    );
    if (metadataJson === null) {
      return this.dataSource.query(
        `
        UPDATE usage_records
        SET execution_status = 'failed'
        WHERE execution_id = $1
        AND execution_status = 'running'
        RETURNING execution_id
        `,
        [executionId],
      );
    }
    return this.dataSource.query(
      `
      UPDATE usage_records
      SET execution_status = 'failed',
          metadata = $2::jsonb
      WHERE execution_id = $1
      AND execution_status = 'running'
      RETURNING execution_id
      `,
      [executionId, metadataJson],
    );
  }

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.queueEventsConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('ai-execution', {
      connection: this.connection as any,
    });

    this.queueEvents = new QueueEvents('ai-execution', {
      connection: this.queueEventsConnection as any,
    });

    this.setupQueueEventsHandlers();

    const concurrency = Math.max(
      1,
      parseInt(process.env.EXECUTION_WORKER_CONCURRENCY ?? '4', 10) || 4,
    );

    const EXECUTION_TIMEOUT_MS = parseExecutionTimeoutBaselineMs();
    const lockDuration = resolveBullMqLockDurationMs(EXECUTION_TIMEOUT_MS);

    const EXECUTION_PROVIDER_RETRY_ATTEMPTS = Math.max(
      1,
      Math.min(10, parseInt(process.env.EXECUTION_PROVIDER_RETRY_ATTEMPTS ?? '3', 10) || 3),
    );
    const EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS = Math.max(
      50,
      Math.min(10000, parseInt(process.env.EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS ?? '250', 10) || 250),
    );
    const stalledInterval = Math.min(15000, Math.floor(lockDuration / 2));

    this.worker = new Worker(
      'ai-execution',
      async (job: Job) => {
        const executionId = job.data.executionId;
        const provider = job.data.provider ?? 'unknown';
        const executionStartTime = performance.now();

        this.logger.log(
          `Worker received job ${job.id} executionId=${executionId} workerId=${this.workerId}`,
        );

        const result = await this.dataSource.query(
          `
          UPDATE usage_records
          SET execution_status = 'running'
          WHERE execution_id = $1
          AND execution_status = 'pending'
          RETURNING execution_id
          `,
          [executionId],
        );

        if (result.length === 0) {
          const statusCheck = await this.dataSource.query(
            `SELECT execution_status FROM usage_records WHERE execution_id = $1`,
            [executionId],
          );
          const currentStatus = statusCheck[0]?.execution_status;

          if (currentStatus === 'running') {
            const stalledResult = await this.markRunningLedgerFailed(executionId, {
              code: STORED_EXECUTION_ERROR_CODE,
              message: STALLED_RUNNING_FAILURE_MESSAGE,
            });
            if (stalledResult.length > 0) {
              incExecutionFailed();
              incrementStuckRecovered();
              this.executionStreamPublisher.publishCompletion(executionId);
              this.logger.warn(
                `Stalled job recovered, marked failed executionId=${executionId} workerId=${this.workerId}`,
              );
            }
          } else if (currentStatus === 'cancel_requested') {
            const durationMs = Math.round(
              performance.now() - executionStartTime,
            );
            await this.dataSource.query(
              `
              UPDATE usage_records
              SET execution_status = 'cancelled',
                  execution_duration_ms = $2
              WHERE execution_id = $1
              `,
              [executionId, durationMs],
            );
            this.executionStreamPublisher.publishCompletion(executionId);
            this.logger.warn(
              `Claim failed, cancel_requested: set cancelled executionId=${executionId}`,
            );
          } else {
            this.logger.warn(
              `Duplicate job detected, skipping executionId=${executionId}`,
            );
          }
          return;
        }

        const claimTime = Date.now();
        incrementWorkerClaim();
        this.logger.log(
          `Worker claimed executionId=${executionId} workerId=${this.workerId}`,
        );

        const cancelCheck = await this.dataSource.query(
          `
          SELECT execution_status, created_at
          FROM usage_records
          WHERE execution_id = $1
          `,
          [executionId],
        );

        const intentCreatedAt = cancelCheck[0]?.created_at;
        const queueWaitMs =
          intentCreatedAt != null
            ? Math.round(claimTime - new Date(intentCreatedAt).getTime())
            : undefined;

        if (queueWaitMs != null) {
          observeQueueLag(queueWaitMs / 1000);
        }

        if (cancelCheck[0]?.execution_status === 'cancel_requested') {
          const durationMs = Math.round(performance.now() - executionStartTime);
          await this.dataSource.query(
            `
            UPDATE usage_records
            SET execution_status = 'cancelled',
                execution_duration_ms = $2
            WHERE execution_id = $1
            `,
            [executionId, durationMs],
          );

          this.executionStreamPublisher.publishCompletion(executionId);

          incExecutionCancelled();
          this.metrics.execution_cancelled_total++;
          this.logExecutionCompletion({
            event: 'execution_completed',
            executionId,
            provider,
            workerId: this.workerId,
            ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
            duration_ms: durationMs,
            tokens: 0,
            execution_status: 'cancelled',
            metrics: { ...this.metrics },
          });

          this.logger.warn(
            `Execution cancelled before start executionId=${executionId}`,
          );
          return;
        }

        incExecutionStarted();
        const abortController = new AbortController();
        let cancelled = false;
        let timedOut = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        const clearTimeoutWatchdog = () => {
          if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
        };

        timeoutHandle = setTimeout(async () => {
          if (abortController.signal.aborted || cancelled || timedOut) return;
          timedOut = true;
          abortController.abort();

          const durationMs = Math.round(performance.now() - executionStartTime);
          const result = await this.dataSource.query(
            `
            UPDATE usage_records
            SET execution_status = 'timeout',
                execution_duration_ms = $2
            WHERE execution_id = $1
            AND execution_status = 'running'
            RETURNING execution_id
            `,
            [executionId, durationMs],
          );

          if (result.length > 0) {
            incExecutionFailed();
            this.executionStreamPublisher.publishCompletion(executionId);
            this.metrics.execution_timeout_total++;
            observeExecutionLatency(durationMs / 1000);
            this.logExecutionCompletion({
              event: 'execution_completed',
              executionId,
              provider,
              workerId: this.workerId,
              ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
              duration_ms: durationMs,
              tokens: 0,
              execution_status: 'timeout',
              metrics: { ...this.metrics },
            });
            this.logger.warn(
              `Execution timed out executionId=${executionId}`,
            );
          }
        }, EXECUTION_TIMEOUT_MS);

        const pollCancel = async () => {
          if (abortController.signal.aborted || cancelled) return;

          const poll = await this.dataSource.query(
            `SELECT execution_status FROM usage_records WHERE execution_id = $1`,
            [executionId],
          );

          if (poll[0]?.execution_status === 'cancel_requested') {
            abortController.abort();
            return;
          }

          setTimeout(pollCancel, 1000);
        };

        pollCancel();

        try {
          if (
            job.data.harnessReadOnly === true &&
            job.data.harnessVersion !== 'v1'
          ) {
            throw harnessEntitlementFailure(
              job.data.harnessEntitlementProof == null
                ? HARNESS_ENTITLEMENT_PROOF_MISSING
                : HARNESS_ENTITLEMENT_PROOF_MALFORMED,
            );
          }
          if (job.data.harnessVersion === 'v1') {
            try {
              verifyHarnessEntitlementProof(job.data);
            } catch (entitlementError) {
              if (entitlementError instanceof HarnessEntitlementError) {
                const rawProof = job.data.harnessEntitlementProof;
                this.logger.log(
                  JSON.stringify({
                    event: 'agent_harness.entitlement_verification_failed',
                    executionId: job.data.executionId,
                    userId: job.data.userId,
                    apiKeyId: job.data.apiKeyId,
                    harnessVersion: 'v1',
                    errorCode: entitlementError.code,
                    proofVersion:
                      rawProof !== null &&
                      typeof rawProof === 'object' &&
                      !Array.isArray(rawProof) &&
                      typeof (rawProof as { version?: unknown }).version ===
                        'number'
                        ? (rawProof as { version: number }).version
                        : null,
                    proofPresent: rawProof != null,
                  }),
                );
                throw entitlementError;
              }
              throw harnessEntitlementFailure(
                HARNESS_ENTITLEMENT_PROOF_MALFORMED,
              );
            }
          }
          const profileResolution = resolveHarnessToolProfile(job.data);
          if (profileResolution.ok === false) {
            cancelled = true;
            clearTimeoutWatchdog();
            await this.persistStoredExecutionFailure({
              executionId,
              model: job.data.model,
              code: profileResolution.code,
              message: profileResolution.message,
              executionStartTime,
            });
            return;
          }
          const signedToolProfile = profileResolution.profile;
          const harnessRequested = job.data.harnessVersion === 'v1';
          let routedAdapter: ReturnType<AIExecutionService['getAdapter']> | undefined;
          if (harnessRequested && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop) {
            routedAdapter = this.aiExecutionService.getAdapter(
              job.data.provider,
              job.data.model,
            );
          }
          const routing = resolveHarnessRouting({
            harnessVersion: job.data.harnessVersion,
            enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop,
            adapterSupportsToolUse: routedAdapter?.supportsToolUse === true,
            adapterHasExecuteWithTools:
              typeof routedAdapter?.executeWithTools === 'function',
          });
          this.logger.log(
            JSON.stringify({
              event: 'agent_harness.route_evaluated',
              executionId: job.data.executionId,
              agentId: job.data.agentId ?? null,
              harnessVersion: job.data.harnessVersion ?? null,
              enableToolLoop: DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop,
              selectedPath: routing.selectedPath,
            }),
          );
          const useHarness = routing.selectedPath === 'harness';

          if (routing.selectedPath === 'fail_closed') {
            throw new HarnessRoutingError(routing.failReason);
          }

          let aiResult: Awaited<ReturnType<AIExecutionService['execute']>>;
          let harnessPreApplyCheckpointHash: string | undefined;
          // Lives across provider retries. A write on an earlier attempt must still save.
          let harnessWriteOrDeleteAttempted = false;
          const harnessChangedPaths: string[] = [];
          const harnessValidationRuns: Array<{ command: string; passed: boolean }> =
            [];
          for (let attempt = 0; attempt < EXECUTION_PROVIDER_RETRY_ATTEMPTS; attempt++) {
            try {
              const promptParts = buildExecutionPromptParts(
                job.data.prompt ?? '',
                job.data.workspaceContext,
                job.data.globalInstructions,
                job.data.projectInstructions,
                { useHarness },
              );
              const executionRequest = buildAIExecutionRequest(
                job.data,
                promptParts,
                abortController.signal,
              );

              if (useHarness) {
                const { config: resolvedConfig, metadata: configResolutionMetadata } =
                  resolveBuilderHarnessConfig(
                    {
                      agentRole: job.data.agentRole,
                      builderProfileId: job.data.builderProfileId,
                    },
                    DEFAULT_AGENT_HARNESS_CONFIG_V1,
                  );

                this.logger.log(JSON.stringify({
                  event: 'agent_harness.config_resolved',
                  executionId: job.data.executionId,
                  agentId: job.data.agentId ?? null,
                  source: configResolutionMetadata.source,
                  builderProfileId: configResolutionMetadata.builderProfileId ?? null,
                  harnessProfileId: configResolutionMetadata.harnessProfileId ?? null,
                  fieldsOverridden: configResolutionMetadata.fieldsOverridden,
                  warnings: configResolutionMetadata.warnings,
                }));

                if (
                  (signedToolProfile === 'write' ||
                    signedToolProfile === 'agent-write') &&
                  !resolvedConfig.enableWriteTools
                ) {
                  cancelled = true;
                  clearTimeoutWatchdog();
                  await this.persistStoredExecutionFailure({
                    executionId,
                    model: job.data.model,
                    code: HARNESS_WRITE_TOOLS_DISABLED,
                    message: HARNESS_WRITE_TOOLS_DISABLED_MESSAGE,
                    executionStartTime,
                  });
                  return;
                }
                if (
                  (signedToolProfile === 'review' ||
                    signedToolProfile === 'write') &&
                  !resolvedConfig.enableValidationTools
                ) {
                  cancelled = true;
                  clearTimeoutWatchdog();
                  await this.persistStoredExecutionFailure({
                    executionId,
                    model: job.data.model,
                    code: HARNESS_VALIDATION_TOOLS_DISABLED,
                    message: HARNESS_VALIDATION_TOOLS_DISABLED_MESSAGE,
                    executionStartTime,
                  });
                  return;
                }

                const adapter =
                  routedAdapter ??
                  this.aiExecutionService.getAdapter(
                    executionRequest.provider,
                    executionRequest.model,
                  );
                if (!adapter.supportsToolUse || !adapter.executeWithTools) {
                  throw new HarnessRoutingError(
                    adapter.supportsToolUse !== true
                      ? 'adapter_lacks_tool_use'
                      : 'adapter_lacks_execute_with_tools',
                  );
                }
                const dispatcher = new ToolDispatcher({
                    toolTimeoutMs: resolvedConfig.toolTimeoutMs,
                    maxToolResultBytes: resolvedConfig.maxToolResultBytes,
                  });
                  const wrapHarnessTool = createToolProgressWrapper((progress) => {
                    if (
                      progress.tool === 'write_file' ||
                      progress.tool === 'delete_file'
                    ) {
                      harnessWriteOrDeleteAttempted = true;
                    }
                    return this.executionStreamPublisher.publishHarnessProgress(
                      executionId,
                      progress,
                    );
                  });
                  const registeredHandlerNames: string[] = [];
                  dispatcher.registerHandler(
                    'read_file',
                    wrapHarnessTool(
                      'read_file',
                      createReadFileHandler({
                        client: this.apiGatewayHttpClient,
                        sessionId: job.data.sessionId,
                        maxFileReadBytes: resolvedConfig.maxFileReadBytes,
                      }),
                    ),
                  );
                  registeredHandlerNames.push('read_file');
                  dispatcher.registerHandler(
                    'list_files',
                    wrapHarnessTool(
                      'list_files',
                      createListFilesHandler({
                        client: this.apiGatewayHttpClient,
                        sessionId: job.data.sessionId,
                      }),
                    ),
                  );
                  registeredHandlerNames.push('list_files');
                  dispatcher.registerHandler(
                    'search_workspace',
                    wrapHarnessTool(
                      'search_workspace',
                      createSearchWorkspaceHandler({
                        client: this.apiGatewayHttpClient,
                        sessionId: job.data.sessionId,
                      }),
                    ),
                  );
                  registeredHandlerNames.push('search_workspace');
                  const harnessReadOnly = job.data.harnessReadOnly === true;
                  const allowHarnessMutation =
                    signedToolProfile === 'write' ||
                    signedToolProfile === 'agent-write';
                  if (resolvedConfig.enableWriteTools) {
                    if (
                      !harnessReadOnly &&
                      signedToolProfile !== 'read' &&
                      signedToolProfile !== 'review'
                    ) {
                      dispatcher.registerHandler(
                        'write_file',
                        wrapHarnessTool(
                          'write_file',
                          async (args, signal) => {
                            const result = await createWriteFileHandler({
                              client: this.apiGatewayHttpClient,
                              sessionId: job.data.sessionId,
                              maxFileWriteBytes: resolvedConfig.maxFileWriteBytes,
                            })(args, signal);
                            if (
                              signedToolProfile === 'write' &&
                              typeof result.path === 'string' &&
                              result.path.length > 0
                            ) {
                              harnessChangedPaths.push(result.path);
                            }
                            return result;
                          },
                        ),
                      );
                      registeredHandlerNames.push('write_file');
                      if (signedToolProfile !== 'write') {
                        dispatcher.registerHandler(
                          'delete_file',
                          wrapHarnessTool(
                            'delete_file',
                            createDeleteFileHandler({
                              client: this.apiGatewayHttpClient,
                              sessionId: job.data.sessionId,
                            }),
                          ),
                        );
                        registeredHandlerNames.push('delete_file');
                      }
                    }
                  }
                  if (resolvedConfig.enableValidationTools) {
                    if (!harnessReadOnly && signedToolProfile !== 'read') {
                      dispatcher.registerHandler(
                        'run_validation',
                        wrapHarnessTool(
                          'run_validation',
                          async (args, signal) => {
                            const result = await createRunValidationHandler({
                              client: this.apiGatewayHttpClient,
                              sessionId: job.data.sessionId,
                              allowedValidationCommands: resolvedConfig.allowedValidationCommands,
                              validationTimeoutMs: resolvedConfig.validationTimeoutMs,
                              maxValidationOutputBytes: resolvedConfig.maxValidationOutputBytes,
                            })(args, signal);
                            if (
                              (signedToolProfile === 'review' ||
                                signedToolProfile === 'write') &&
                              typeof result.command === 'string' &&
                              result.command.length > 0
                            ) {
                              harnessValidationRuns.push({
                                command: result.command,
                                passed: result.success === true,
                              });
                            }
                            return result;
                          },
                        ),
                      );
                      registeredHandlerNames.push('run_validation');
                    }
                  }
                  if (resolvedConfig.enableBrowserSmoke) {
                    if (!harnessReadOnly && signedToolProfile === 'agent-write') {
                      dispatcher.registerHandler(
                        'browser_smoke',
                        wrapHarnessTool(
                          'browser_smoke',
                          createBrowserSmokeHandler({
                            client: this.apiGatewayHttpClient,
                            sessionId: job.data.sessionId,
                            browserSmokeTimeoutMs: resolvedConfig.browserSmokeTimeoutMs,
                          }),
                        ),
                      );
                      registeredHandlerNames.push('browser_smoke');
                    }
                  }
                  const advertisedTools = requireNonEmptyAdvertisedHarnessTools(
                    selectAdvertisedAgentHarnessTools({
                      registeredHandlerNames,
                      enableWriteTools:
                        signedToolProfile === 'agent-write'
                          ? resolvedConfig.enableWriteTools
                          : signedToolProfile === null
                            ? harnessReadOnly
                              ? false
                              : resolvedConfig.enableWriteTools
                            : signedToolProfile === 'write',
                      enableValidationTools:
                        signedToolProfile === 'agent-write'
                          ? resolvedConfig.enableValidationTools
                          : signedToolProfile === null
                            ? harnessReadOnly
                              ? false
                              : resolvedConfig.enableValidationTools
                            : signedToolProfile === 'review' ||
                              signedToolProfile === 'write',
                      enableBrowserSmoke:
                        signedToolProfile === 'agent-write'
                          ? resolvedConfig.enableBrowserSmoke
                          : signedToolProfile === null
                            ? harnessReadOnly
                              ? false
                              : resolvedConfig.enableBrowserSmoke
                            : false,
                    }),
                  );
                  const auditRecorder = resolvedConfig.auditEventsEnabled
                    ? new InMemoryHarnessAuditRecorder()
                    : undefined;

                  let loopOptions: Parameters<typeof executeAgentHarnessLoop>[0] = {
                    executeFn: (req, opts) => adapter.executeWithTools!(req, mergeAdvertisedToolsIntoExecuteOptions(opts, advertisedTools)),
                    request: executionRequest,
                    config: {
                      maxToolIterations: resolvedConfig.maxToolIterations,
                      maxToolResultBytes: resolvedConfig.maxToolResultBytes,
                      maxRunTokens: resolvedConfig.maxRunTokens ?? DEFAULT_AGENT_HARNESS_CONFIG_V1.maxRunTokens,
                    },
                    signal: abortController.signal,
                    dispatcher,
                    recorder: auditRecorder,
                    toolTimeoutMs: resolvedConfig.toolTimeoutMs,
                  };

                  if (resolvedConfig.enablePreApplyCheckpoint) {
                    if (allowHarnessMutation) {
                      loopOptions = {
                        ...loopOptions,
                        createCheckpointFn: (checkpointSignal) =>
                          this.apiGatewayHttpClient.createWorkspaceCheckpoint(
                            job.data.sessionId,
                            'Pre-apply checkpoint (Agent Harness)',
                            checkpointSignal,
                          ),
                        mutatingToolNames: new Set(['write_file', 'delete_file']),
                      };
                    }
                  }

                  try {
                    const loopResult = await executeAgentHarnessLoop(loopOptions);
                    aiResult = loopResult.result;
                    if (loopResult.preApplyCheckpointHash) {
                      harnessPreApplyCheckpointHash = loopResult.preApplyCheckpointHash;
                    }
                  } finally {
                    if (auditRecorder) {
                      for (const event of auditRecorder.getEvents()) {
                        this.logger.log(JSON.stringify(event));
                      }
                    }
                    if (harnessWriteOrDeleteAttempted && allowHarnessMutation) {
                      try {
                        await this.apiGatewayHttpClient.saveProjectSnapshot(
                          job.data.sessionId,
                        );
                      } catch (saveError: unknown) {
                        const errorMessage =
                          saveError instanceof Error
                            ? saveError.message
                            : String(saveError);
                        this.logger.warn(
                          `Project snapshot save failed executionId=${executionId}: ${errorMessage}`,
                        );
                      }
                    }
                  }
              } else {
                aiResult = await this.aiExecutionService.execute(executionRequest);
              }
              break;
            } catch (err) {
              if (abortController.signal.aborted) throw err;
              if (!isRetryableError(err)) throw err;
              if (attempt === EXECUTION_PROVIDER_RETRY_ATTEMPTS - 1) throw err;
              const delay = EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
              this.logger.log(
                `Transient retry attempt ${attempt + 1}/${EXECUTION_PROVIDER_RETRY_ATTEMPTS} for executionId=${executionId}, delay=${delay}ms`,
              );
              await sleep(delay, abortController.signal);
            }
          }
          cancelled = true;
          clearTimeoutWatchdog();

          this.logger.log(
            `AI execution completed executionId=${executionId} tokens=${aiResult.tokensUsed}`,
          );

          const statusCheck = await this.dataSource.query(
            `
            SELECT execution_status
            FROM usage_records
            WHERE execution_id = $1
            `,
            [executionId],
          );

          if (statusCheck[0]?.execution_status === 'cancel_requested') {
            cancelled = true;
            abortController.abort();
            clearTimeoutWatchdog();

            const durationMs = Math.round(performance.now() - executionStartTime);
            await this.dataSource.query(
              `
              UPDATE usage_records
              SET execution_status = 'cancelled',
                  execution_duration_ms = $2
              WHERE execution_id = $1
              `,
              [executionId, durationMs],
            );

            this.executionStreamPublisher.publishCompletion(executionId);

            incExecutionCancelled();
            this.metrics.execution_cancelled_total++;
            observeExecutionLatency(durationMs / 1000);
            this.logExecutionCompletion({
              event: 'execution_completed',
              executionId,
              provider,
              workerId: this.workerId,
              ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
              duration_ms: durationMs,
              tokens: aiResult.tokensUsed ?? 0,
              execution_status: 'cancelled',
              metrics: { ...this.metrics },
            });

            this.logger.warn(
              `Execution cancelled during run executionId=${executionId}`,
            );
            return;
          }

          const safeFileActions = Array.isArray(aiResult.fileActions)
            ? aiResult.fileActions
            : [];
          const executionIntent = resolveWorkerExecutionIntent(
            job.data.executionIntent,
          );
          const fileActionResolution = resolveEffectiveFileActionsForExecutionIntent(
            {
              executionIntent,
              useHarness,
              safeFileActions,
            },
          );
          const effectiveFileActions =
            job.data.harnessReadOnly === true ||
            (signedToolProfile !== null &&
              signedToolProfile !== 'write' &&
              signedToolProfile !== 'agent-write')
              ? []
              : fileActionResolution.effectiveFileActions;
          const parseMethod = aiResult.parseMethod ?? 'none';
          const workspaceMutationAttempted =
            typeof aiResult.workspaceMutationAttempted === 'boolean'
              ? aiResult.workspaceMutationAttempted
              : null;
          const contractValidation = validatePlainPathFileActionContract({
            useHarness,
            safeFileActionCount: effectiveFileActions.length,
            executionIntent,
          });

          if (fileActionResolution.suppressedActionCount > 0) {
            this.logger.warn(
              JSON.stringify({
                event: 'file_action.conversation_actions_suppressed',
                executionId,
                provider: job.data.provider,
                model: aiResult.model,
                useHarness,
                executionIntent,
                suppressedActionCount: fileActionResolution.suppressedActionCount,
              }),
            );
          }

          this.logger.log(
            JSON.stringify({
              event: 'file_action.parse_result',
              executionId,
              provider: job.data.provider,
              model: aiResult.model,
              useHarness,
              parseMethod,
              executionIntent,
              fileActionCount: effectiveFileActions.length,
              workspaceMutationAttempted,
              finalContractResult: contractValidation.finalContractResult,
            }),
          );

          const metadataRows = await this.dataSource.query(
            `
            SELECT metadata
            FROM usage_records
            WHERE execution_id = $1
            `,
            [executionId],
          );

          const metadataValue = metadataRows[0]?.metadata;
          let existingMetadata: Record<string, unknown> = {};
          if (metadataValue && typeof metadataValue === 'object') {
            existingMetadata = metadataValue as Record<string, unknown>;
          } else if (typeof metadataValue === 'string') {
            try {
              const parsed = JSON.parse(metadataValue) as unknown;
              if (parsed && typeof parsed === 'object') {
                existingMetadata = parsed as Record<string, unknown>;
              }
            } catch {
              existingMetadata = {};
            }
          }

          const nextMetadata: Record<string, unknown> = {
            ...existingMetadata,
            aiExecutionResult: {
              output: aiResult.output,
              tokensUsed: aiResult.tokensUsed ?? 0,
              model: aiResult.model,
              provider: job.data.provider,
              fileActions: effectiveFileActions,
              parseMethod,
              workspaceMutationAttempted,
              executionIntent,
            },
          };

          // AGENT-PLATFORM-06: Preserve upstream identity fields in ledger finalization metadata.
          if (job.data.agentId !== undefined) nextMetadata.agentId = job.data.agentId;
          if (job.data.agentRole !== undefined) nextMetadata.agentRole = job.data.agentRole;
          if (job.data.builderProfileId !== undefined) nextMetadata.builderProfileId = job.data.builderProfileId;
          if (job.data.collaborationRunId !== undefined) nextMetadata.collaborationRunId = job.data.collaborationRunId;
          if (job.data.referralTraceId !== undefined) nextMetadata.referralTraceId = job.data.referralTraceId;

          // AGENT-PLATFORM-07C2: Preserve orchestration referral fields in ledger finalization metadata.
          if (job.data.parentReferralTraceId !== undefined) nextMetadata.parentReferralTraceId = job.data.parentReferralTraceId;
          if (job.data.referringBuilderProfileId !== undefined) nextMetadata.referringBuilderProfileId = job.data.referringBuilderProfileId;
          if (job.data.orchestrationPriority !== undefined) nextMetadata.orchestrationPriority = job.data.orchestrationPriority;
          if (job.data.referralId !== undefined) nextMetadata.referralId = job.data.referralId;
          if (job.data.isReferralExecution !== undefined) nextMetadata.isReferralExecution = job.data.isReferralExecution;

          if (harnessPreApplyCheckpointHash) {
            nextMetadata.preApplyCheckpointHash = harnessPreApplyCheckpointHash;
          }
          if (
            signedToolProfile === 'read' ||
            signedToolProfile === 'review' ||
            signedToolProfile === 'write'
          ) {
            nextMetadata.harnessChangedPaths = harnessChangedPaths;
            nextMetadata.harnessValidationRuns = harnessValidationRuns;
          }

          if (aiResult.output) {
            this.executionStreamPublisher.publishToken(
              executionId,
              aiResult.output,
            );
          }

          this.executionStreamPublisher.publishFileActions(
            executionId,
            effectiveFileActions,
          );

          if (contractValidation.isContractFailure) {
            nextMetadata.executionError = {
              code: contractValidation.errorCode,
              message: contractValidation.errorMessage,
            };

            const durationMs = Math.round(performance.now() - executionStartTime);
            await this.dataSource.query(
              `
              UPDATE usage_records
              SET execution_status = 'failed',
                  tokens_used = $2,
                  metadata = $3::jsonb,
                  model = $4,
                  execution_duration_ms = $5
              WHERE execution_id = $1
              `,
              [
                executionId,
                aiResult.tokensUsed ?? 0,
                JSON.stringify(nextMetadata),
                resolveLedgerModel(aiResult.model, job.data.model),
                durationMs,
              ],
            );

            this.executionStreamPublisher.publishCompletion(executionId);

            incExecutionFailed();
            this.metrics.execution_failed_total++;
            observeExecutionLatency(durationMs / 1000);
            this.logExecutionCompletion({
              event: 'execution_completed',
              executionId,
              provider,
              workerId: this.workerId,
              ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
              duration_ms: durationMs,
              tokens: aiResult.tokensUsed ?? 0,
              execution_status: 'failed',
              metrics: { ...this.metrics },
            });

            this.logger.warn(
              JSON.stringify({
                event: 'file_action.contract_failure',
                executionId,
                provider: job.data.provider,
                model: aiResult.model,
                useHarness,
                parseMethod,
                executionIntent,
                fileActionCount: effectiveFileActions.length,
                workspaceMutationAttempted,
                finalContractResult: contractValidation.finalContractResult,
                errorCode: contractValidation.errorCode,
              }),
            );

            return;
          }

          const durationMs = Math.round(performance.now() - executionStartTime);
          await this.dataSource.query(
            `
            UPDATE usage_records
            SET execution_status = 'completed',
                tokens_used = $2,
                metadata = $3::jsonb,
                model = $4,
                execution_duration_ms = $5
            WHERE execution_id = $1
            `,
            [
              executionId,
              aiResult.tokensUsed ?? 0,
              JSON.stringify(nextMetadata),
              resolveLedgerModel(aiResult.model, job.data.model),
              durationMs,
            ],
          );

          this.executionStreamPublisher.publishCompletion(executionId);

          incExecutionCompleted();
          this.metrics.execution_completed_total++;
          observeExecutionLatency(durationMs / 1000);
          this.logExecutionCompletion({
            event: 'execution_completed',
            executionId,
            provider,
            workerId: this.workerId,
            ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
            duration_ms: durationMs,
            tokens: aiResult.tokensUsed ?? 0,
            execution_status: 'completed',
            metrics: { ...this.metrics },
          });

          this.logger.log(`Ledger finalized executionId=${executionId}`);

          // BILLING-READY-04C: Notify API Gateway to trigger credit deduction.
          // Placed AFTER post-completion cancel check (lines above) and AFTER
          // completion SQL write. If cancel won, we returned early above.
          // Errors are suppressed — must not fail the completed job.
          try {
            await this.apiGatewayHttpClient.notifyExecutionComplete(executionId);
          } catch (notifyError) {
            this.logger.warn(
              `Accounting notification failed (suppressed) executionId=${executionId}: ${notifyError?.message ?? String(notifyError)}`,
            );
          }
        } catch (error) {
          cancelled = true;

          const isAbort =
            error instanceof Error &&
            (error.name === 'AbortError' || abortController.signal.aborted);

          if (isAbort) {
            if (timedOut) {
              return;
            }
            clearTimeoutWatchdog();
            const durationMs = Math.round(performance.now() - executionStartTime);
            await this.dataSource.query(
              `
              UPDATE usage_records
              SET execution_status = 'cancelled',
                  execution_duration_ms = $2
              WHERE execution_id = $1
              `,
              [executionId, durationMs],
            );

            this.executionStreamPublisher.publishCompletion(executionId);

            incExecutionCancelled();
            this.metrics.execution_cancelled_total++;
            observeExecutionLatency(durationMs / 1000);
            this.logExecutionCompletion({
              event: 'execution_completed',
              executionId,
              provider,
              workerId: this.workerId,
              ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
              duration_ms: durationMs,
              tokens: 0,
              execution_status: 'cancelled',
              metrics: { ...this.metrics },
            });

            this.logger.warn(
              `Execution aborted executionId=${executionId}`,
            );
            return;
          }

          clearTimeoutWatchdog();

          incExecutionFailed();
          this.metrics.execution_failed_total++;
          const durationMs = Math.round(performance.now() - executionStartTime);
          observeExecutionLatency(durationMs / 1000);
          const failedLedgerTokens =
            error instanceof HarnessMaxIterationsError ? error.tokensUsed : null;
          this.logExecutionCompletion({
            event: 'execution_completed',
            executionId,
            provider,
            workerId: this.workerId,
            ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
            duration_ms: durationMs,
            tokens: failedLedgerTokens ?? 0,
            execution_status: 'failed',
            metrics: { ...this.metrics },
          });

          this.logger.error(
            `AI execution failed executionId=${executionId}: ${error.message}`,
          );

          const executionError = resolveStoredExecutionError(
            error,
            typeof job.data.prompt === 'string' ? job.data.prompt : undefined,
          );
          const metadataJson = await this.readMergedExecutionMetadata(
            executionId,
            executionError,
          );
          const ledgerModel = resolveLedgerModel(undefined, job.data.model);
          if (metadataJson === null) {
            await this.dataSource.query(
              `
              UPDATE usage_records
              SET execution_status = 'failed',
                  model = $2,
                  tokens_used = COALESCE($3, tokens_used),
                  execution_duration_ms = $4
              WHERE execution_id = $1
              `,
              [executionId, ledgerModel, failedLedgerTokens, durationMs],
            );
          } else {
            await this.dataSource.query(
              `
              UPDATE usage_records
              SET execution_status = 'failed',
                  model = $2,
                  tokens_used = COALESCE($3, tokens_used),
                  metadata = $4::jsonb,
                  execution_duration_ms = $5
              WHERE execution_id = $1
              `,
              [executionId, ledgerModel, failedLedgerTokens, metadataJson, durationMs],
            );
          }

          throw error;
        }
      },
      {
        connection: this.connection as any,
        concurrency,
        lockDuration,
        stalledInterval,
        maxStalledCount: 1,
      },
    );

    this.logger.log('Worker connected to ai-execution queue');

    const scanIntervalMs = parseInt(
      process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS ?? '30000',
      10,
    );
    this.stuckScanIntervalHandle = setInterval(() => {
      this.scanForStuckExecutions().catch((err) => {
        this.logger.error(
          `Stuck execution scan failed: ${err?.message ?? String(err)}`,
        );
      });
    }, scanIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.stuckScanIntervalHandle) {
      clearInterval(this.stuckScanIntervalHandle);
      this.stuckScanIntervalHandle = null;
    }
    await this.queueEvents.close();
    await this.worker.close();
    await this.queueEventsConnection.quit();
    await this.connection.quit();
  }
}
