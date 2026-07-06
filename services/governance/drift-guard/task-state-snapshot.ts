/**
 * Governance Drift Guard — Task State Snapshot Extractor
 *
 * Parses TASKS.md, TASKS_BACKLOG_FULL.md, and AINOW-EXECUTION-ROADMAP.md
 * into normalized TaskRecord arrays. All parsing is read-only.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  GovernanceSnapshot,
  GovernanceSource,
  NormalizedTaskState,
  TaskRecord,
} from './drift-state.types';

// ─── Task ID pattern ──────────────────────────────────────────────────────────
// Matches IDs like: BILLING-READY-01, AGENT-HARNESS-05C9, ROADMAP-00
const TASK_ID_PATTERN = /\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,})\b/g;

// ─── Checkpoint reference pattern ────────────────────────────────────────────
const CHECKPOINT_PATTERN = /CHECKPOINT\.md|checkpoint/i;

// ─── Raw state keyword mappings ───────────────────────────────────────────────
function normalizeState(raw: string): NormalizedTaskState {
  const upper = raw.toUpperCase();
  if (upper.includes('COMPLETE AND LOCKED') || upper.includes('COMPLETE & LOCKED')) return 'LOCKED';
  if (upper.includes('LOCKED')) return 'LOCKED';
  if (upper.includes('COMPLETE')) return 'COMPLETE';
  if (upper.includes('CONSOLIDATED')) return 'CONSOLIDATED';
  if (upper.includes('REVIEWED')) return 'REVIEWED';
  if (upper.includes('IMPLEMENTED')) return 'IMPLEMENTED';
  if (upper.includes('ACTIVE')) return 'ACTIVE';
  if (upper.includes('REGISTERED')) return 'REGISTERED';
  if (upper.includes('PROPOSED') || upper.includes('PLANNED')) return 'PROPOSED';
  return 'UNKNOWN';
}

// ─── Generic markdown parser ──────────────────────────────────────────────────
// Extracts task records from heading lines or inline task mentions.
// Strategy:
//   1. Scan for markdown table rows: | TASK-ID | Name | Status |
//   2. Scan for heading patterns: ### TASK-ID — Name (STATE)
//   3. Scan for inline mentions: TASK-ID ... COMPLETE / ACTIVE / LOCKED

export function parseMarkdownTasks(content: string, source: GovernanceSource): TaskRecord[] {
  const records = new Map<string, TaskRecord>();

  // Pass 1: Markdown table rows  | ID | Name | Status |
  const tableRowPattern = /\|\s*([A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,})\s*\|([^|]*)\|([^|]+)\|/g;
  let match: RegExpExecArray | null;

  while ((match = tableRowPattern.exec(content)) !== null) {
    const taskId = match[1].trim();
    const name = match[2].trim();
    const rawState = match[3].trim();
    const state = normalizeState(rawState);
    const locked = rawState.toUpperCase().includes('LOCKED');

    // Detect checkpoint reference in the surrounding 200 chars
    const surrounding = content.slice(Math.max(0, match.index - 50), match.index + 200);
    const hasCheckpoint = CHECKPOINT_PATTERN.test(surrounding);

    records.set(taskId, { taskId, name, state, locked, hasCheckpoint, source, rawState });
  }

  // Pass 2: Heading-style task entries
  // e.g. ## BILLING-READY-01 — Credit Ledger Foundation
  // followed by status line like: **Status:** COMPLETE and LOCKED
  const headingPattern = /^#+\s+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,})\s*[—–-]\s*([^\n]+)/gm;

  while ((match = headingPattern.exec(content)) !== null) {
    const taskId = match[1].trim();
    if (records.has(taskId)) continue; // already found in table pass

    const name = match[2].trim();
    // Look ahead up to 400 chars for a status line
    const lookAhead = content.slice(match.index, match.index + 400);
    const statusMatch = lookAhead.match(/\*{0,2}Status[:\s*]+([^\n*]+)/i);
    const rawState = statusMatch ? statusMatch[1].trim() : 'UNKNOWN';
    const state = normalizeState(rawState);
    const locked = rawState.toUpperCase().includes('LOCKED');
    const hasCheckpoint = CHECKPOINT_PATTERN.test(lookAhead);

    records.set(taskId, { taskId, name, state, locked, hasCheckpoint, source, rawState });
  }

  // Pass 3: Inline bold task mentions
  // e.g. **BILLING-READY-01 — COMPLETE and LOCKED**
  const boldPattern = /\*{1,2}([A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,})\s*[—–-]\s*([^*\n]+)\*{0,2}/g;

  while ((match = boldPattern.exec(content)) !== null) {
    const taskId = match[1].trim();
    if (records.has(taskId)) continue;

    const rawState = match[2].trim();
    const state = normalizeState(rawState);
    const locked = rawState.toUpperCase().includes('LOCKED');
    const surrounding = content.slice(Math.max(0, match.index - 50), match.index + 300);
    const hasCheckpoint = CHECKPOINT_PATTERN.test(surrounding);

    records.set(taskId, {
      taskId,
      name: '',
      state,
      locked,
      hasCheckpoint,
      source,
      rawState,
    });
  }

  // Pass 4: Status-tagged lines
  // e.g. BILLING-READY-01 ... COMPLETE and LOCKED
  // e.g. | BILLING-READY-01 | ... | ACTIVE |
  const statusTagPattern =
    /([A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,})[^\n]{0,120}?\b(COMPLETE AND LOCKED|COMPLETE\s*&\s*LOCKED|COMPLETE|ACTIVE|LOCKED|PROPOSED|REGISTERED|CONSOLIDATED|REVIEWED|IMPLEMENTED)\b/gi;

  while ((match = statusTagPattern.exec(content)) !== null) {
    const taskId = match[1].trim();
    if (records.has(taskId)) continue;

    const rawState = match[2].trim();
    const state = normalizeState(rawState);
    const locked = rawState.toUpperCase().includes('LOCKED');
    const surrounding = content.slice(Math.max(0, match.index - 50), match.index + 200);
    const hasCheckpoint = CHECKPOINT_PATTERN.test(surrounding);

    records.set(taskId, { taskId, name: '', state, locked, hasCheckpoint, source, rawState });
  }

  return Array.from(records.values());
}

// ─── Public snapshot builder ──────────────────────────────────────────────────

export interface SnapshotPaths {
  tasksPath: string;
  backlogPath: string;
  roadmapPath: string;
}

export function buildSnapshot(paths: SnapshotPaths): GovernanceSnapshot {
  const readSafe = (filePath: string): string => {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return '';
    return fs.readFileSync(resolved, 'utf-8');
  };

  const tasksContent = readSafe(paths.tasksPath);
  const backlogContent = readSafe(paths.backlogPath);
  const roadmapContent = readSafe(paths.roadmapPath);

  return {
    tasks: parseMarkdownTasks(tasksContent, 'TASKS'),
    backlog: parseMarkdownTasks(backlogContent, 'BACKLOG'),
    roadmap: parseMarkdownTasks(roadmapContent, 'ROADMAP'),
    capturedAt: new Date().toISOString(),
  };
}

// ─── Default repo-root paths ──────────────────────────────────────────────────

export function defaultRepoPaths(repoRoot: string): SnapshotPaths {
  return {
    tasksPath: path.join(repoRoot, 'TASKS.md'),
    backlogPath: path.join(repoRoot, 'TASKS_BACKLOG_FULL.md'),
    roadmapPath: path.join(repoRoot, 'docs', 'AINOW-EXECUTION-ROADMAP.md'),
  };
}
