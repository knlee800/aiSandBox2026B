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

  it('falls back to top-level raw json file-actions objects for delete actions', () => {
    const output = JSON.stringify({
      'file-actions': [{ action: 'delete', path: 'foo.html' }],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.fileActions).toEqual([{ action: 'delete', path: 'foo.html' }]);
    expect(parsed.textOutput).toBe(output);
  });

  it('falls back to top-level raw json file-actions objects for write actions with content', () => {
    const output = JSON.stringify({
      'file-actions': [{ action: 'write', path: 'src/app.ts', content: 'export {};\n' }],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.fileActions).toEqual([
      { action: 'write', path: 'src/app.ts', content: 'export {};\n' },
    ]);
  });

  it('rejects non-delete raw json actions missing content', () => {
    const output = JSON.stringify({
      'file-actions': [{ action: 'update', path: 'src/app.ts' }],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.fileActions).toEqual([]);
  });

  it('returns empty actions for malformed raw json fallback payloads', () => {
    const output = '{"file-actions":[{"action":"delete","path":"foo.html"}]';

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.fileActions).toEqual([]);
    expect(parsed.textOutput).toBe(output);
  });

  it('rejects unsafe raw json fallback paths', () => {
    const output = JSON.stringify({
      'file-actions': [{ action: 'delete', path: '../escape.ts' }],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.fileActions).toEqual([]);
  });

  it('returns empty actions when raw json fallback has no file-actions array', () => {
    const output = JSON.stringify({
      actions: [{ action: 'delete', path: 'foo.html' }],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.fileActions).toEqual([]);
  });

  it('keeps fenced file-actions blocks as the primary extraction path', () => {
    const output = [
      '```file-actions',
      JSON.stringify([{ action: 'delete', path: 'from-block.html' }]),
      '```',
      JSON.stringify({
        'file-actions': [{ action: 'delete', path: 'from-raw-json.html' }],
      }),
    ].join('\n');

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.fileActions).toEqual([{ action: 'delete', path: 'from-block.html' }]);
    expect(parsed.textOutput).toContain('"from-raw-json.html"');
  });

  it('keeps non-file-action outputs intact with empty actions', () => {
    const output = 'Here is the explanation without file action blocks.';
    const parsed = extractFileActionsFromOutput(output);
    expect(parsed.fileActions).toEqual([]);
    expect(parsed.textOutput).toBe(output);
  });
});
