import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadEvalTasks } from './eval-loader';

const tasksDir = path.join(__dirname, 'tasks');

describe('loadEvalTasks', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads all eleven seed tasks', () => {
    const tasks = loadEvalTasks(tasksDir);
    expect(tasks.map((task) => task.id)).toEqual([
      'already-satisfied',
      'answer-from-file',
      'change-function-and-caller',
      'create-new-file',
      'delete-a-file',
      'edit-one-file',
      'fix-failing-test',
      'large-request-within-step-limit',
      'refuse-unsafe-delete',
      'refuse-unsafe-write',
      'search-then-edit',
    ]);
    expect(tasks.find((task) => task.id === 'answer-from-file')?.expected.answerChecks).toEqual([
      { substring: 'Paris', match: 'must' },
    ]);
    expect(tasks.find((task) => task.id === 'already-satisfied')?.expected.answerChecks).toEqual([
      { regex: '\\S', match: 'must' },
    ]);
    expect(tasks.find((task) => task.id === 'refuse-unsafe-write')?.expected.answerChecks).toBeUndefined();
    const fix = tasks.find((task) => task.id === 'fix-failing-test');
    expect(fix?.validation).toEqual({
      command: 'npm test',
      passWhen: 'allContentChecks',
    });
    expect(fix?.expected.validationPasses).toBe(true);
    const large = tasks.find(
      (task) => task.id === 'large-request-within-step-limit',
    );
    expect(large?.maxToolIterations).toBe(8);
  });

  it('loads a new task file with no code change', () => {
    const dir = makeTemp();
    fs.writeFileSync(
      path.join(dir, 'extra-task.json'),
      JSON.stringify({
        id: 'extra-task',
        description: 'Proves a new file is loaded without a code change.',
        initialFiles: { 'readme.txt': 'hi' },
        userRequest: 'Read readme.txt.',
        expected: { unchangedFiles: ['readme.txt'] },
      }),
    );
    const tasks = loadEvalTasks(dir);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('extra-task');
    expect(tasks[0].initialFiles['readme.txt']).toBe('hi');
  });

  it('rejects a malformed task file by name', () => {
    const dir = makeTemp();
    fs.writeFileSync(
      path.join(dir, 'bad.json'),
      JSON.stringify({ id: 'bad', description: 'missing the rest' }),
    );
    expect(() => loadEvalTasks(dir)).toThrow(
      /Invalid eval task file bad\.json: userRequest must be a non-empty string/,
    );
  });

  it('rejects invalid JSON by file name', () => {
    const dir = makeTemp();
    fs.writeFileSync(path.join(dir, 'broken.json'), '{');
    expect(() => loadEvalTasks(dir)).toThrow(/Invalid eval task file broken\.json:/);
  });

  it('rejects an answer check that sets both substring and regex', () => {
    const dir = makeTemp();
    fs.writeFileSync(
      path.join(dir, 'bad-answer.json'),
      JSON.stringify({
        id: 'bad-answer',
        description: 'bad answer check',
        initialFiles: {},
        userRequest: 'Say something.',
        expected: {
          answerChecks: [{ substring: 'Paris', regex: 'Paris', match: 'must' }],
        },
      }),
    );
    expect(() => loadEvalTasks(dir)).toThrow(
      /Invalid eval task file bad-answer\.json: answerChecks\[0\] must set exactly one of substring or regex/,
    );
  });

  it('rejects a duplicate task id', () => {
    const dir = makeTemp();
    const body = {
      id: 'same-id',
      description: 'duplicate',
      initialFiles: {},
      userRequest: 'Do nothing.',
      expected: {},
    };
    fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(body));
    fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify(body));
    expect(() => loadEvalTasks(dir)).toThrow(
      /Invalid eval task file b\.json: duplicate task id same-id/,
    );
  });

  function makeTemp(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisb-harness-eval-'));
    tempDirs.push(dir);
    return dir;
  }
});
