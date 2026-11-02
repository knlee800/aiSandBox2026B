const MAX_FAILURE_REASON_CHARS = 500;

/**
 * Keep a short failure sentence already stored on the execution.
 *
 * Read path: ExecutionResultService.getExecution selects usage_records.metadata.
 * The worker writes metadata.executionError.message and metadata.executionError.code
 * when a file-action contract check fails. The general failure path, including
 * tool_loop_disabled, only logs the reason and does not store it on the row.
 */
export function readStoredExecutionFailureReason(metadata: unknown): string {
  if (!isRecord(metadata)) {
    return '';
  }
  const executionError = metadata.executionError;
  if (!isRecord(executionError)) {
    return '';
  }
  const message = typeof executionError.message === 'string' ? executionError.message : '';
  const code = typeof executionError.code === 'string' ? executionError.code : '';
  const candidate = message.trim().length > 0 ? message : code;
  return sanitizeCollaborationFailureReason(candidate);
}

export function sanitizeCollaborationFailureReason(raw: string): string {
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? '';
  const collapsed = firstLine.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) {
    return '';
  }
  if (looksLikeStack(collapsed) || looksLikeSecret(collapsed)) {
    return '';
  }
  if (collapsed.length > MAX_FAILURE_REASON_CHARS) {
    return collapsed.slice(0, MAX_FAILURE_REASON_CHARS);
  }
  return collapsed;
}

function looksLikeStack(value: string): boolean {
  return (
    /\bat\s+\S+\s+\(.+:\d+:\d+\)/.test(value) ||
    value.includes('node_modules') ||
    /\.[jt]s:\d+/.test(value)
  );
}

function looksLikeSecret(value: string): boolean {
  return (
    /sk-[a-z0-9]/i.test(value) ||
    /bearer\s+[a-z0-9]/i.test(value) ||
    /api[_-]?key\s*[:=]/i.test(value) ||
    /password\s*[:=]/i.test(value) ||
    /secret\s*[:=]/i.test(value) ||
    /token\s*[:=]/i.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
