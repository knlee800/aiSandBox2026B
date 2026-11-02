export interface HarnessProgressItem {
  step: number;
  tool: string;
  target?: string;
}

const HARNESS_TOOL_LABEL_KEYS = {
  list_files: 'harnessToolListFiles',
  read_file: 'harnessToolReadFile',
  search_workspace: 'harnessToolSearchWorkspace',
  write_file: 'harnessToolWriteFile',
  delete_file: 'harnessToolDeleteFile',
  run_validation: 'harnessToolRunValidation',
  browser_smoke: 'harnessToolBrowserSmoke',
} as const;

export type HarnessToolLabelKey =
  | (typeof HARNESS_TOOL_LABEL_KEYS)[keyof typeof HARNESS_TOOL_LABEL_KEYS]
  | 'harnessToolGeneric';

export function parseHarnessProgressMessage(raw: unknown): HarnessProgressItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  if (record.type !== 'harness_progress') {
    return null;
  }
  if (typeof record.step !== 'number' || !Number.isInteger(record.step) || record.step < 1) {
    return null;
  }
  if (typeof record.tool !== 'string' || record.tool.trim().length === 0) {
    return null;
  }
  if (record.target !== undefined && typeof record.target !== 'string') {
    return null;
  }

  const item: HarnessProgressItem = {
    step: record.step,
    tool: record.tool,
  };
  if (typeof record.target === 'string' && record.target.length > 0) {
    item.target = record.target;
  }
  return item;
}

export function appendHarnessProgress(
  list: readonly HarnessProgressItem[],
  item: HarnessProgressItem,
): HarnessProgressItem[] {
  let highestStep = 0;
  for (const entry of list) {
    if (entry.step > highestStep) {
      highestStep = entry.step;
    }
  }
  if (list.length > 0 && item.step < highestStep) {
    return [item];
  }
  for (const entry of list) {
    if (entry.step === item.step) {
      return [...list];
    }
  }
  return [...list, item];
}

export function harnessProgressShowsWrite(list: readonly HarnessProgressItem[]): boolean {
  return list.some((item) => item.tool === 'write_file' || item.tool === 'delete_file');
}

export function buildAgentModeRequestFields(): {
  executionIntent: 'conversation';
  harnessVersion: 'v1';
} {
  return {
    executionIntent: 'conversation',
    harnessVersion: 'v1',
  };
}

export function parseHarnessEntitled(me: unknown): boolean {
  if (!me || typeof me !== 'object') {
    return false;
  }
  return (me as { harnessEntitled?: unknown }).harnessEntitled === true;
}

export function toolLabelKey(tool: string): HarnessToolLabelKey {
  if (Object.prototype.hasOwnProperty.call(HARNESS_TOOL_LABEL_KEYS, tool)) {
    return HARNESS_TOOL_LABEL_KEYS[tool as keyof typeof HARNESS_TOOL_LABEL_KEYS];
  }
  return 'harnessToolGeneric';
}
