import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PHASE-76G: ISSUE-76-003 Regression Tests
 *
 * Validates that the git_checkpoints table exists and the migration file
 * is present, preventing re-introduction of the missing-table root cause.
 */

const ROOT = join(import.meta.dirname, '..', '..');
const API_GW = join(ROOT, 'services', 'api-gateway');

describe('PHASE-76G: ISSUE-76-003 regression protection', () => {
  it('migration file for git_checkpoints table exists', () => {
    const migrationPath = join(
      API_GW,
      'src',
      'migrations',
      '1771496000000-CreateGitCheckpointsTable.ts',
    );
    const content = readFileSync(migrationPath, 'utf-8');
    assert.ok(
      content.includes('git_checkpoints'),
      'Migration file must reference git_checkpoints table',
    );
    assert.ok(
      content.includes('CREATE TABLE IF NOT EXISTS'),
      'Migration must use IF NOT EXISTS for safety',
    );
  });

  it('GitCheckpoint entity references git_checkpoints table', () => {
    const entityPath = join(
      API_GW,
      'src',
      'entities',
      'git-checkpoint.entity.ts',
    );
    const content = readFileSync(entityPath, 'utf-8');
    assert.ok(
      content.includes("'git_checkpoints'"),
      'Entity must reference git_checkpoints table name',
    );
  });

  it('migration creates required columns matching entity definition', () => {
    const migrationPath = join(
      API_GW,
      'src',
      'migrations',
      '1771496000000-CreateGitCheckpointsTable.ts',
    );
    const content = readFileSync(migrationPath, 'utf-8');
    const requiredColumns = [
      'session_id',
      'commit_hash',
      'message_number',
      'description',
      'files_changed',
      'created_at',
    ];
    for (const col of requiredColumns) {
      assert.ok(
        content.includes(col),
        `Migration must create column: ${col}`,
      );
    }
  });

  it('migration creates required indexes', () => {
    const migrationPath = join(
      API_GW,
      'src',
      'migrations',
      '1771496000000-CreateGitCheckpointsTable.ts',
    );
    const content = readFileSync(migrationPath, 'utf-8');
    const requiredIndexes = [
      'idx_git_checkpoint_session_id',
      'idx_git_checkpoint_commit_hash',
      'idx_git_checkpoint_created_at',
    ];
    for (const idx of requiredIndexes) {
      assert.ok(
        content.includes(idx),
        `Migration must create index: ${idx}`,
      );
    }
  });

  it('migration has FK constraint to sessions table', () => {
    const migrationPath = join(
      API_GW,
      'src',
      'migrations',
      '1771496000000-CreateGitCheckpointsTable.ts',
    );
    const content = readFileSync(migrationPath, 'utf-8');
    assert.ok(
      content.includes('REFERENCES') && content.includes('sessions'),
      'Migration must have FK constraint referencing sessions table',
    );
  });
});
