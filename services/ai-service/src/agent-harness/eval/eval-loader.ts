import * as fs from 'fs';
import * as path from 'path';
import {
  EVAL_ALLOWED_VALIDATION_COMMANDS,
  type EvalAnswerCheck,
  type EvalContentCheck,
  type EvalExpectedOutcome,
  type EvalTask,
  type EvalValidationRule,
  isEnvFilePath,
  isOutsideWorkspacePath,
  normalizeEvalPath,
} from './eval-types';

const TASK_FIELDS = [
  'id',
  'description',
  'initialFiles',
  'userRequest',
  'expected',
  'maxToolIterations',
  'validation',
];

const EXPECTED_FIELDS = [
  'filesCreated',
  'filesModified',
  'filesDeleted',
  'unchangedFiles',
  'contentChecks',
  'answerChecks',
  'validationPasses',
  'mustNotWrite',
];

const CONTENT_CHECK_FIELDS = ['path', 'substring', 'regex', 'match'];
const ANSWER_CHECK_FIELDS = ['substring', 'regex', 'match'];

const VALIDATION_FIELDS = ['command', 'passWhen'];

/**
 * Loads every *.json task in a directory. Adding a task is adding a file.
 * Files are returned in filename order. A bad file throws with its name.
 */
export function loadEvalTasks(dir: string): EvalTask[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Eval task directory not found: ${dir}`);
  }

  const names = fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort();

  const tasks: EvalTask[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const fullPath = path.join(dir, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid eval task file ${name}: ${message}`);
    }
    const task = parseEvalTask(parsed, name);
    if (seen.has(task.id)) {
      throw new Error(
        `Invalid eval task file ${name}: duplicate task id ${task.id}`,
      );
    }
    seen.add(task.id);
    tasks.push(task);
  }
  return tasks;
}

export function parseEvalTask(value: unknown, fileLabel: string): EvalTask {
  const fail = (message: string): never => {
    throw new Error(`Invalid eval task file ${fileLabel}: ${message}`);
  };

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('task must be a JSON object');
  }
  const record = value as Record<string, unknown>;
  assertOnlyKeys(record, TASK_FIELDS, 'task', fail);

  const id = readNonEmptyString(record.id, 'id', fail);
  const description = readNonEmptyString(record.description, 'description', fail);
  const userRequest = readNonEmptyString(record.userRequest, 'userRequest', fail);
  const initialFiles = readInitialFiles(record.initialFiles, fail);
  const expected = readExpected(record.expected, initialFiles, fail);
  const maxToolIterations = readMaxToolIterations(record.maxToolIterations, fail);
  const validation = readValidation(record.validation, fail);

  const task: EvalTask = {
    id,
    description,
    initialFiles,
    userRequest,
    expected,
    ...(maxToolIterations !== undefined ? { maxToolIterations } : {}),
    ...(validation !== undefined ? { validation } : {}),
  };
  return task;
}

function readInitialFiles(
  value: unknown,
  fail: (message: string) => never,
): Readonly<Record<string, string>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('initialFiles must be an object of path to content');
  }
  const files: Record<string, string> = {};
  for (const [rawPath, content] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (typeof content !== 'string') {
      fail(`initialFiles content for ${rawPath} must be a string`);
    }
    if (isOutsideWorkspacePath(rawPath) || isEnvFilePath(rawPath)) {
      fail(`initialFiles path is not allowed: ${rawPath}`);
    }
    const key = normalizeEvalPath(rawPath);
    if (key.length === 0 || key === '.') {
      fail(`initialFiles path is empty: ${rawPath}`);
    }
    if (Object.prototype.hasOwnProperty.call(files, key)) {
      fail(`initialFiles contains duplicate path ${rawPath}`);
    }
    files[key] = content;
  }
  return files;
}

function readExpected(
  value: unknown,
  initialFiles: Readonly<Record<string, string>>,
  fail: (message: string) => never,
): EvalExpectedOutcome {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('expected must be an object');
  }
  const record = value as Record<string, unknown>;
  assertOnlyKeys(record, EXPECTED_FIELDS, 'expected', fail);

  const filesCreated = readPathList(record.filesCreated, 'filesCreated', fail);
  const filesModified = readPathList(record.filesModified, 'filesModified', fail);
  const filesDeleted = readPathList(record.filesDeleted, 'filesDeleted', fail);
  const unchangedFiles = readPathList(
    record.unchangedFiles,
    'unchangedFiles',
    fail,
  );
  const mustNotWrite = readPathList(record.mustNotWrite, 'mustNotWrite', fail);
  const contentChecks = readContentChecks(record.contentChecks, fail);
  const answerChecks = readAnswerChecks(record.answerChecks, fail);

  const initial = new Set(Object.keys(initialFiles));
  for (const created of filesCreated ?? []) {
    if (initial.has(created)) {
      fail(`filesCreated path already exists: ${created}`);
    }
  }
  for (const modified of filesModified ?? []) {
    if (!initial.has(modified)) {
      fail(`filesModified path is not an initial file: ${modified}`);
    }
  }
  for (const deleted of filesDeleted ?? []) {
    if (!initial.has(deleted)) {
      fail(`filesDeleted path is not an initial file: ${deleted}`);
    }
  }
  for (const unchanged of unchangedFiles ?? []) {
    if (!initial.has(unchanged)) {
      fail(`unchangedFiles path is not an initial file: ${unchanged}`);
    }
  }

  let validationPasses: boolean | undefined;
  if (record.validationPasses !== undefined) {
    if (typeof record.validationPasses !== 'boolean') {
      fail('validationPasses must be a boolean');
    }
    validationPasses = record.validationPasses;
  }

  return {
    ...(filesCreated !== undefined ? { filesCreated } : {}),
    ...(filesModified !== undefined ? { filesModified } : {}),
    ...(filesDeleted !== undefined ? { filesDeleted } : {}),
    ...(unchangedFiles !== undefined ? { unchangedFiles } : {}),
    ...(contentChecks !== undefined ? { contentChecks } : {}),
    ...(answerChecks !== undefined ? { answerChecks } : {}),
    ...(validationPasses !== undefined ? { validationPasses } : {}),
    ...(mustNotWrite !== undefined ? { mustNotWrite } : {}),
  };
}

function readContentChecks(
  value: unknown,
  fail: (message: string) => never,
): readonly EvalContentCheck[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    fail('contentChecks must be an array');
  }
  return value.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`contentChecks[${index}] must be an object`);
    }
    const record = entry as Record<string, unknown>;
    assertOnlyKeys(record, CONTENT_CHECK_FIELDS, `contentChecks[${index}]`, fail);
    const checkPath = readNonEmptyString(record.path, `contentChecks[${index}].path`, fail);
    const normalized = normalizeEvalPath(checkPath);
    if (normalized.length === 0) {
      fail(`contentChecks[${index}].path is empty`);
    }
    const hasSubstring = record.substring !== undefined;
    const hasRegex = record.regex !== undefined;
    if (hasSubstring === hasRegex) {
      fail(
        `contentChecks[${index}] must set exactly one of substring or regex`,
      );
    }
    let substring: string | undefined;
    let regex: string | undefined;
    if (hasSubstring) {
      if (typeof record.substring !== 'string' || record.substring.length === 0) {
        fail(`contentChecks[${index}].substring must be a non-empty string`);
      }
      substring = record.substring;
    }
    if (hasRegex) {
      if (typeof record.regex !== 'string' || record.regex.length === 0) {
        fail(`contentChecks[${index}].regex must be a non-empty string`);
      }
      try {
        new RegExp(record.regex);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        fail(`contentChecks[${index}].regex is invalid: ${message}`);
      }
      regex = record.regex;
    }
    if (record.match !== 'must' && record.match !== 'must-not') {
      fail(`contentChecks[${index}].match must be "must" or "must-not"`);
    }
    return {
      path: normalized,
      ...(substring !== undefined ? { substring } : {}),
      ...(regex !== undefined ? { regex } : {}),
      match: record.match,
    };
  });
}

function readAnswerChecks(
  value: unknown,
  fail: (message: string) => never,
): readonly EvalAnswerCheck[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    fail('answerChecks must be an array');
  }
  return value.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`answerChecks[${index}] must be an object`);
    }
    const record = entry as Record<string, unknown>;
    assertOnlyKeys(record, ANSWER_CHECK_FIELDS, `answerChecks[${index}]`, fail);
    const hasSubstring = record.substring !== undefined;
    const hasRegex = record.regex !== undefined;
    if (hasSubstring === hasRegex) {
      fail(`answerChecks[${index}] must set exactly one of substring or regex`);
    }
    let substring: string | undefined;
    let regex: string | undefined;
    if (hasSubstring) {
      if (typeof record.substring !== 'string' || record.substring.length === 0) {
        fail(`answerChecks[${index}].substring must be a non-empty string`);
      }
      substring = record.substring;
    }
    if (hasRegex) {
      if (typeof record.regex !== 'string' || record.regex.length === 0) {
        fail(`answerChecks[${index}].regex must be a non-empty string`);
      }
      try {
        new RegExp(record.regex);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        fail(`answerChecks[${index}].regex is invalid: ${message}`);
      }
      regex = record.regex;
    }
    if (record.match !== 'must' && record.match !== 'must-not') {
      fail(`answerChecks[${index}].match must be "must" or "must-not"`);
    }
    return {
      ...(substring !== undefined ? { substring } : {}),
      ...(regex !== undefined ? { regex } : {}),
      match: record.match,
    };
  });
}

function readValidation(
  value: unknown,
  fail: (message: string) => never,
): EvalValidationRule | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('validation must be an object');
  }
  const record = value as Record<string, unknown>;
  assertOnlyKeys(record, VALIDATION_FIELDS, 'validation', fail);
  const command = readNonEmptyString(record.command, 'validation.command', fail);
  if (!EVAL_ALLOWED_VALIDATION_COMMANDS.includes(command)) {
    fail(
      `validation.command is not allow-listed: ${command}. Allowed: ${EVAL_ALLOWED_VALIDATION_COMMANDS.join(', ')}`,
    );
  }
  if (record.passWhen !== 'allContentChecks') {
    fail('validation.passWhen must be "allContentChecks"');
  }
  return { command, passWhen: 'allContentChecks' };
}

function readMaxToolIterations(
  value: unknown,
  fail: (message: string) => never,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail('maxToolIterations must be an integer >= 1');
  }
  return value;
}

function readPathList(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    fail(`${field} must be an array of paths`);
  }
  const paths: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      fail(`${field} must contain non-empty strings`);
    }
    const normalized = normalizeEvalPath(entry);
    if (normalized.length === 0) {
      fail(`${field} contains an empty path`);
    }
    if (paths.includes(normalized)) {
      fail(`${field} contains duplicate path ${entry}`);
    }
    paths.push(normalized);
  }
  return paths;
}

function readNonEmptyString(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${field} must be a non-empty string`);
  }
  return value;
}

function assertOnlyKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
  fail: (message: string) => never,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      fail(`${label} has unknown field ${key}`);
    }
  }
}
