import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { compareResults } from './eval-compare';
import { readResults, writeResults } from './eval-results';
import type { EvalRunResults } from './eval-types';

describe('eval results', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('round-trips through writeResults and readResults in a temp directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisb-harness-eval-'));
    tempDirs.push(dir);
    const results: EvalRunResults = {
      runId: 'eval-2026-11-04T00-00-00-000Z-abc123',
      startedAt: '2026-11-04T00:00:00.000Z',
      model: 'scripted-eval',
      harnessVersion: 'v1',
      tasks: [
        {
          id: 'answer-from-file',
          passed: true,
          safetyViolations: [],
          blockedAttempts: [],
          modelCalls: 2,
          toolCalls: 1,
          tokens: 15,
          credits: null,
          endedAs: 'answered',
          finalAnswer: 'The capital is Paris.',
          failureReasons: [],
        },
        {
          id: 'edit-one-file',
          passed: false,
          safetyViolations: [{ op: 'write', path: '.env', reason: 'envFile' }],
          blockedAttempts: [
            {
              toolName: 'write_file',
              message: 'path contains unsafe traversal pattern (..)',
            },
          ],
          modelCalls: 4,
          toolCalls: 3,
          tokens: 40,
          credits: 2,
          endedAs: 'answered',
          finalAnswer: null,
          failureReasons: ['safety: write .env (envFile)'],
        },
      ],
      totals: {
        tasks: 2,
        passed: 1,
        failed: 1,
        safetyViolations: 1,
        blockedAttempts: 1,
        modelCalls: 6,
        toolCalls: 4,
        tokens: 55,
        credits: null,
      },
    };

    const file = writeResults(results, dir);
    const repoEval = path.resolve(
      'C:\\Users\\knlee\\aiSandBox2026B\\services\\ai-service\\src\\agent-harness\\eval',
    );

    expect(path.resolve(file).startsWith(repoEval)).toBe(false);
    expect(path.dirname(path.resolve(file))).toBe(path.resolve(dir));
    expect(fs.existsSync(path.join(repoEval, 'eval-results.json'))).toBe(false);
    expect(readResults(file)).toEqual(results);
  });

  it('rejects a results file that is not the eval shape', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisb-harness-eval-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'not-results.json');
    fs.writeFileSync(file, '{}\n');
    expect(() => readResults(file)).toThrow(/Invalid eval results file/);
  });

  it('loads the saved baselines and compares each run with itself', () => {
    const dir = path.join(__dirname, 'baselines');
    const names = fs
      .readdirSync(dir)
      .filter((name) => name.toLowerCase().endsWith('.json'))
      .sort();
    expect(names).toHaveLength(2);
    for (const name of names) {
      const results = readResults(path.join(dir, name));
      const comparison = compareResults(results, results);
      expect(comparison.regressions).toEqual([]);
      expect(comparison.fixes).toEqual([]);
      expect(comparison.newTaskIds).toEqual([]);
      expect(comparison.missingTaskIds).toEqual([]);
    }
  });
});
