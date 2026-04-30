import { extractFileActionsFromOutput } from '../file-actions.parser';

describe('file-actions parser', () => {
  it('extracts valid file actions and preserves normal text output', () => {
    const output = [
      'I made the requested updates.',
      '```file-actions',
      '[{"action":"create","path":"src/app.ts","content":"console.log(\\"hi\\")"}]',
      '```',
      'Please review the changes.',
    ].join('\n');

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.fileActions).toEqual([
      {
        action: 'create',
        path: 'src/app.ts',
        content: 'console.log("hi")',
      },
    ]);
    expect(parsed.textOutput).toContain('I made the requested updates.');
    expect(parsed.textOutput).toContain('Please review the changes.');
    expect(parsed.textOutput).not.toContain('```file-actions');
  });

  it('returns empty actions for malformed blocks and keeps text', () => {
    const output = [
      'Normal text',
      '```file-actions',
      '{"action":"create","path":"src/a.ts"', // malformed JSON
      '```',
    ].join('\n');

    const parsed = extractFileActionsFromOutput(output);
    expect(parsed.fileActions).toEqual([]);
    expect(parsed.textOutput).toBe('Normal text');
  });

  it('rejects invalid and unsafe paths deterministically', () => {
    const output = [
      '```file-actions',
      JSON.stringify([
        { action: 'write', path: '../escape.ts', content: 'bad' },
        { action: 'write', path: '', content: 'bad' },
        { action: 'write', path: '/etc/passwd', content: 'bad' },
        { action: 'write', path: 'C:\\\\Windows\\\\test.txt', content: 'bad' },
        { action: 'write', path: 'src/safe.ts', content: 'ok' },
      ]),
      '```',
    ].join('\n');

    const parsed = extractFileActionsFromOutput(output);
    expect(parsed.fileActions).toEqual([
      { action: 'write', path: 'src/safe.ts', content: 'ok' },
    ]);
  });

  it('parses delete actions with path only', () => {
    const output = [
      '```file-actions',
      JSON.stringify([{ action: 'delete', path: 'src/old.ts' }]),
      '```',
    ].join('\n');

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.fileActions).toEqual([{ action: 'delete', path: 'src/old.ts' }]);
  });

  it('still requires content for non-delete actions', () => {
    const output = [
      '```file-actions',
      JSON.stringify([
        { action: 'write', path: 'src/missing.ts' },
        { action: 'update', path: 'src/also-missing.ts' },
        { action: 'delete', path: 'src/old.ts' },
      ]),
      '```',
    ].join('\n');

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.fileActions).toEqual([{ action: 'delete', path: 'src/old.ts' }]);
  });

  it('keeps non-file-action outputs intact with empty actions', () => {
    const output = 'Here is the explanation without file action blocks.';
    const parsed = extractFileActionsFromOutput(output);
    expect(parsed.fileActions).toEqual([]);
    expect(parsed.textOutput).toBe(output);
  });
});
