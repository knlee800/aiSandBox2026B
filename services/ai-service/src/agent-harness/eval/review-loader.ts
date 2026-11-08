import * as fs from 'fs';
import * as path from 'path';
import {
  EVAL_ALLOWED_VALIDATION_COMMANDS,
  type EvalValidationRule,
  isEnvFilePath,
  isOutsideWorkspacePath,
  normalizeEvalPath,
} from './eval-types';
import type { ReviewPlantedBug, ReviewTask } from './review-types';

const TASK_FIELDS = [
  'id',
  'description',
  'initialFiles',
  'handoffTask',
  'reviewerPrompt',
  'plantedBugs',
  'maxToolIterations',
  'validation',
];

const BUG_FIELDS = ['id', 'kind', 'file', 'markers'];
const VALIDATION_FIELDS = ['command', 'passWhen'];

/** Comparison operators may be markers even though they contain no letter or digit. */
const COMPARISON_OPERATOR_MARKERS = new Set([
  '<',
  '<=',
  '>',
  '>=',
  '==',
  '===',
  '!=',
  '!==',
]);

/**
 * Loads every *.json reviewer task in a directory. Adding a task is adding a file.
 * Files are returned in filename order. A bad file throws with its name.
 */
export function loadReviewTasks(dir: string): ReviewTask[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Review task directory not found: ${dir}`);
  }

  const names = fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort();

  const tasks: ReviewTask[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const fullPath = path.join(dir, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid review task file ${name}: ${message}`);
    }
    const task = parseReviewTask(parsed, name);
    if (seen.has(task.id)) {
      throw new Error(
        `Invalid review task file ${name}: duplicate task id ${task.id}`,
      );
    }
    seen.add(task.id);
    tasks.push(task);
  }
  return tasks;
}

export function parseReviewTask(value: unknown, fileLabel: string): ReviewTask {
  const fail = (message: string): never => {
    throw new Error(`Invalid review task file ${fileLabel}: ${message}`);
  };

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('task must be a JSON object');
  }
  const record = value as Record<string, unknown>;
  assertOnlyKeys(record, TASK_FIELDS, 'task', fail);

  const id = readNonEmptyString(record.id, 'id', fail);
  const description = readNonEmptyString(record.description, 'description', fail);
  const handoffTask = readNonEmptyString(record.handoffTask, 'handoffTask', fail);
  const reviewerPrompt = readNonEmptyString(
    record.reviewerPrompt,
    'reviewerPrompt',
    fail,
  );
  const initialFiles = readInitialFiles(record.initialFiles, fail);
  const plantedBugs = readPlantedBugs(record.plantedBugs, initialFiles, id, fail);
  const maxToolIterations = readMaxToolIterations(record.maxToolIterations, fail);
  const validation = readValidation(record.validation, fail);

  return {
    id,
    description,
    initialFiles,
    handoffTask,
    reviewerPrompt,
    plantedBugs,
    ...(maxToolIterations !== undefined ? { maxToolIterations } : {}),
    ...(validation !== undefined ? { validation } : {}),
  };
}

function readPlantedBugs(
  value: unknown,
  initialFiles: Readonly<Record<string, string>>,
  taskId: string,
  fail: (message: string) => never,
): readonly ReviewPlantedBug[] {
  if (!Array.isArray(value)) {
    fail('plantedBugs must be an array');
  }
  const bugs: ReviewPlantedBug[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`plantedBugs[${index}] must be an object`);
    }
    const record = entry as Record<string, unknown>;
    assertOnlyKeys(record, BUG_FIELDS, `plantedBugs[${index}]`, fail);
    const id = readNonEmptyString(record.id, `plantedBugs[${index}].id`, fail);
    if (seen.has(id)) {
      fail(`duplicate planted bug id ${id}`);
    }
    seen.add(id);
    const kind = readNonEmptyString(record.kind, `plantedBugs[${index}].kind`, fail);
    const file = readNonEmptyString(record.file, `plantedBugs[${index}].file`, fail);
    const normalized = normalizeEvalPath(file);
    if (normalized.length === 0 || normalized === '.') {
      fail(`plantedBugs[${index}].file is empty`);
    }
    if (!Object.prototype.hasOwnProperty.call(initialFiles, normalized)) {
      fail(`plantedBugs[${index}].file is not an initial file: ${file}`);
    }
    const markers = readMarkers(record.markers, index, taskId, id, fail);
    bugs.push({ id, kind, file: normalized, markers });
  }
  return bugs;
}

function readMarkers(
  value: unknown,
  index: number,
  taskId: string,
  bugId: string,
  fail: (message: string) => never,
): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`plantedBugs[${index}].markers must be a non-empty array`);
  }
  const markers: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      fail(`plantedBugs[${index}].markers must contain non-empty strings`);
    }
    if (!markerIsAllowed(entry)) {
      fail(
        `task ${taskId} planted bug ${bugId} marker "${entry}" contains no letter or digit`,
      );
    }
    if (markers.includes(entry)) {
      fail(`plantedBugs[${index}].markers contains duplicate ${entry}`);
    }
    markers.push(entry);
  }
  return markers;
}

function markerIsAllowed(marker: string): boolean {
  if (COMPARISON_OPERATOR_MARKERS.has(marker)) {
    return true;
  }
  return /[\p{L}\p{N}]/u.test(marker);
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
