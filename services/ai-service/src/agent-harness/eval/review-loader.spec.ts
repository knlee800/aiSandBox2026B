import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadReviewTasks } from './review-loader';

const tasksDir = path.join(__dirname, 'review-tasks');

describe('loadReviewTasks', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads the six seed reviewer tasks', () => {
    const tasks = loadReviewTasks(tasksDir);
    expect(tasks.map((task) => task.id)).toEqual([
      'clean-change',
      'missing-null-check',
      'off-by-one',
      'security-slip',
      'test-asserts-nothing',
      'wrong-comparison',
    ]);

    for (const task of tasks) {
      const fileCount = Object.keys(task.initialFiles).length;
      expect(fileCount).toBeGreaterThanOrEqual(2);
      expect(fileCount).toBeLessThanOrEqual(4);
      expect(
        Object.keys(task.initialFiles).some((file) => file.endsWith('.test.ts')),
      ).toBe(true);
      expect(task.reviewerPrompt.startsWith('You are reviewer.')).toBe(true);
    }

    expect(tasks.find((task) => task.id === 'clean-change')?.plantedBugs).toEqual([]);
    expect(tasks.find((task) => task.id === 'off-by-one')?.plantedBugs).toEqual([
      {
        id: 'drops-last-item',
        kind: 'off-by-one',
        file: 'src/items.ts',
        markers: ['copyAll', 'off-by-one', 'length - 1', 'last item'],
      },
    ]);
    expect(tasks.find((task) => task.id === 'wrong-comparison')?.plantedBugs).toEqual([
      {
        id: 'inclusive-bound',
        kind: 'wrong-comparison',
        file: 'src/limit.ts',
        markers: ['withinLimit', 'wrong comparison', '<=', 'operator'],
      },
    ]);
    expect(tasks.find((task) => task.id === 'missing-null-check')?.plantedBugs).toEqual([
      {
        id: 'missing-user-check',
        kind: 'missing-null-check',
        file: 'src/user.ts',
        markers: ['displayName', 'undefined', 'null check', 'without a check'],
      },
    ]);
    expect(tasks.find((task) => task.id === 'test-asserts-nothing')?.plantedBugs).toEqual([
      {
        id: 'asserts-nothing',
        kind: 'test-asserts-nothing',
        file: 'src/sum.test.ts',
        markers: ['asserts nothing', 'no assertion', 'adds the numbers', 'no expect'],
      },
    ]);
    expect(tasks.find((task) => task.id === 'security-slip')?.plantedBugs).toEqual([
      {
        id: 'path-traversal',
        kind: 'security-slip',
        file: 'src/files.ts',
        markers: ['resolveUserPath', 'traversal', 'user input', 'outside the workspace'],
      },
    ]);
  });

  it('accepts maxToolIterations and the harness validation rule', () => {
    const dir = makeTemp();
    fs.writeFileSync(
      path.join(dir, 'with-validation.json'),
      JSON.stringify({
        ...body(),
        maxToolIterations: 4,
        validation: { command: 'npm test', passWhen: 'allContentChecks' },
      }),
    );
    const tasks = loadReviewTasks(dir);
    expect(tasks[0].maxToolIterations).toBe(4);
    expect(tasks[0].validation).toEqual({
      command: 'npm test',
      passWhen: 'allContentChecks',
    });
  });

  it('rejects an unknown field', () => {
    const dir = makeTemp();
    fs.writeFileSync(
      path.join(dir, 'extra.json'),
      JSON.stringify({ ...body(), note: 'nope' }),
    );
    expect(() => loadReviewTasks(dir)).toThrow(
      /Invalid review task file extra\.json: task has unknown field note/,
    );
  });

  it('rejects a duplicate task id', () => {
    const dir = makeTemp();
    const raw = JSON.stringify(body());
    fs.writeFileSync(path.join(dir, 'a.json'), raw);
    fs.writeFileSync(path.join(dir, 'b.json'), raw);
    expect(() => loadReviewTasks(dir)).toThrow(
      /Invalid review task file b\.json: duplicate task id sample/,
    );
  });

  it('rejects a bug whose only marker is ".."', () => {
    const dir = makeTemp();
    fs.writeFileSync(
      path.join(dir, 'dots.json'),
      JSON.stringify(
        body({
          id: 'dots-task',
          initialFiles: { 'src/files.ts': 'export const files = 1;\n' },
          plantedBugs: [
            {
              id: 'path-traversal',
              kind: 'security-slip',
              file: 'src/files.ts',
              markers: ['..'],
            },
          ],
        }),
      ),
    );
    expect(() => loadReviewTasks(dir)).toThrow(
      /Invalid review task file dots\.json: task dots-task planted bug path-traversal marker "\.\." contains no letter or digit/,
    );
  });

  it('rejects a planted bug whose file is not in initialFiles', () => {
    const dir = makeTemp();
    fs.writeFileSync(
      path.join(dir, 'missing-file.json'),
      JSON.stringify(
        body({
          plantedBugs: [
            {
              id: 'ghost',
              kind: 'off-by-one',
              file: 'src/missing.ts',
              markers: ['off-by-one'],
            },
          ],
        }),
      ),
    );
    expect(() => loadReviewTasks(dir)).toThrow(
      /Invalid review task file missing-file\.json: plantedBugs\[0\]\.file is not an initial file: src\/missing\.ts/,
    );
  });

  function makeTemp(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisb-review-eval-'));
    tempDirs.push(dir);
    return dir;
  }
});

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sample',
    description: 'A sample review task.',
    initialFiles: { 'src/a.ts': 'export const a = 1;\n' },
    handoffTask: 'Please review the change.',
    reviewerPrompt: 'You are reviewer.',
    plantedBugs: [],
    ...overrides,
  };
}
