import { asApiGatewayClient, EvalWorkspace } from './eval-workspace';

describe('EvalWorkspace', () => {
  it('records every write and delete that reaches it, including .env', async () => {
    const workspace = new EvalWorkspace({
      'src/keep.ts': 'export const keep = 1;\n',
    });
    const client = asApiGatewayClient(workspace);

    await client.writeWorkspaceFile('eval-session', '.env', 'TOKEN=1');
    await client.writeWorkspaceFile(
      'eval-session',
      'src/keep.ts',
      'export const keep = 2;\n',
    );
    await client.deleteWorkspaceFile('eval-session', 'src/keep.ts');

    expect(workspace.mutationAttempts.map((attempt) => ({
      op: attempt.op,
      path: attempt.path,
      succeeded: attempt.succeeded,
    }))).toEqual([
      { op: 'write', path: '.env', succeeded: true },
      { op: 'write', path: 'src/keep.ts', succeeded: true },
      { op: 'delete', path: 'src/keep.ts', succeeded: true },
    ]);
    expect(workspace.snapshot()).toEqual({ '.env': 'TOKEN=1' });
    expect(client).toBe(workspace);
  });

  it('returns validation failure until every content check holds', async () => {
    const workspace = new EvalWorkspace(
      { 'src/math.ts': 'return a - b;\n' },
      [{ path: 'src/math.ts', substring: 'return a + b', match: 'must' }],
    );

    const before = await workspace.runWorkspaceValidation(
      'eval-session',
      'npm test',
      1000,
    );
    expect(before.exitCode).toBe(1);

    await workspace.writeWorkspaceFile(
      'eval-session',
      'src/math.ts',
      'return a + b;\n',
    );
    const after = await workspace.runWorkspaceValidation(
      'eval-session',
      'npm test',
      1000,
    );
    expect(after).toEqual({
      exitCode: 0,
      stdout: 'validation passed',
      stderr: '',
    });
    expect(workspace.validationRuns.map((run) => run.exitCode)).toEqual([1, 0]);
  });

  it('reads, lists, and searches the in-memory files', async () => {
    const workspace = new EvalWorkspace({
      'src/a.ts': "export const LABEL = 'old-label';\n",
      'README.md': 'hello\n',
    });

    const read = await workspace.readWorkspaceFile('s', 'src/a.ts');
    expect(read.content).toContain('old-label');

    const listed = await workspace.listWorkspaceDirectory('s', '/');
    expect(listed.entries.map((entry) => `${entry.name}:${entry.type}`)).toEqual([
      'README.md:file',
      'src:dir',
    ]);

    const found = await workspace.searchWorkspace('s', 'old-label');
    expect(found.results).toEqual([
      {
        path: 'src/a.ts',
        line: 1,
        preview: "export const LABEL = 'old-label';",
      },
    ]);
    expect(found.truncated).toBe(false);
  });
});
