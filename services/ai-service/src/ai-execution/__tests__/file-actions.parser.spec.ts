import { extractFileActionsFromOutput } from '../file-actions.parser';

describe('file-actions parser', () => {
  it('parses structured JSON responses before legacy formats', () => {
    const output = JSON.stringify({
      assistantText: 'Created the requested file.',
      workspaceMutationAttempted: true,
      fileActions: [
        {
          action: 'create',
          path: 'src/app.ts',
          content: 'console.log("hi")',
        },
      ],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('structured_json');
    expect(parsed.workspaceMutationAttempted).toBe(true);
    expect(parsed.textOutput).toBe('Created the requested file.');
    expect(parsed.fileActions).toEqual([
      {
        action: 'create',
        path: 'src/app.ts',
        content: 'console.log("hi")',
      },
    ]);
  });

  it('keeps assistant text and multiple valid actions in structured JSON responses', () => {
    const output = JSON.stringify({
      assistantText: 'Updated files',
      fileActions: [
        {
          action: 'write',
          path: 'src/a.ts',
          content: 'export const a = 1;',
        },
        {
          action: 'delete',
          path: 'src/old.ts',
        },
      ],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('structured_json');
    expect(parsed.textOutput).toBe('Updated files');
    expect(parsed.fileActions).toEqual([
      {
        action: 'write',
        path: 'src/a.ts',
        content: 'export const a = 1;',
      },
      {
        action: 'delete',
        path: 'src/old.ts',
      },
    ]);
  });

  it('keeps advisory workspaceMutationAttempted in structured JSON without treating it as authority', () => {
    const output = JSON.stringify({
      assistantText: 'No file changes attempted.',
      workspaceMutationAttempted: false,
      fileActions: [],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('structured_json');
    expect(parsed.workspaceMutationAttempted).toBe(false);
    expect(parsed.fileActions).toEqual([]);
  });

  it('returns structured_json parse method when structured actions are invalid and filter to empty', () => {
    const output = JSON.stringify({
      assistantText: 'Tried to update files.',
      workspaceMutationAttempted: true,
      fileActions: [
        { action: 'write', path: '../escape.ts', content: 'bad' },
        { action: 'write', path: '', content: 'bad' },
      ],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('structured_json');
    expect(parsed.workspaceMutationAttempted).toBe(true);
    expect(parsed.fileActions).toEqual([]);
  });

  it('treats malformed structured JSON deterministically as parseMethod none', () => {
    const output = '{"assistantText":"hello","fileActions":[{"action":"delete","path":"a.ts"}]';
    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('none');
    expect(parsed.fileActions).toEqual([]);
    expect(parsed.textOutput).toBe(output);
  });

  it('falls back when JSON is valid but missing structured fields', () => {
    const output = JSON.stringify({
      reply: 'hello',
    });
    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('none');
    expect(parsed.fileActions).toEqual([]);
    expect(parsed.textOutput).toBe(output);
  });

  it('prefers structured JSON over fenced file-actions when both patterns appear', () => {
    const output = JSON.stringify({
      assistantText: 'Use structured payload.',
      fileActions: [{ action: 'delete', path: 'from-structured.ts' }],
      workspaceMutationAttempted: true,
      legacyPreview:
        '```file-actions\n[{"action":"delete","path":"from-fence.ts"}]\n```',
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('structured_json');
    expect(parsed.fileActions).toEqual([
      { action: 'delete', path: 'from-structured.ts' },
    ]);
  });

  it('extracts valid file actions and preserves normal text output', () => {
    const output = [
      'I made the requested updates.',
      '```file-actions',
      '[{"action":"create","path":"src/app.ts","content":"console.log(\\"hi\\")"}]',
      '```',
      'Please review the changes.',
    ].join('\n');

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('fenced_block');
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
    expect(parsed.parseMethod).toBe('fenced_block');
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
    expect(parsed.parseMethod).toBe('fenced_block');
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

    expect(parsed.parseMethod).toBe('fenced_block');
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

    expect(parsed.parseMethod).toBe('fenced_block');
    expect(parsed.fileActions).toEqual([{ action: 'delete', path: 'src/old.ts' }]);
  });

  it('falls back to top-level raw json file-actions objects for delete actions', () => {
    const output = JSON.stringify({
      'file-actions': [{ action: 'delete', path: 'foo.html' }],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('fallback_json');
    expect(parsed.fileActions).toEqual([{ action: 'delete', path: 'foo.html' }]);
    expect(parsed.textOutput).toBe(output);
  });

  it('falls back to top-level raw json file-actions objects for write actions with content', () => {
    const output = JSON.stringify({
      'file-actions': [{ action: 'write', path: 'src/app.ts', content: 'export {};\n' }],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('fallback_json');
    expect(parsed.fileActions).toEqual([
      { action: 'write', path: 'src/app.ts', content: 'export {};\n' },
    ]);
  });

  it('rejects non-delete raw json actions missing content', () => {
    const output = JSON.stringify({
      'file-actions': [{ action: 'update', path: 'src/app.ts' }],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('none');
    expect(parsed.fileActions).toEqual([]);
  });

  it('returns empty actions for malformed raw json fallback payloads', () => {
    const output = '{"file-actions":[{"action":"delete","path":"foo.html"}]';

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('none');
    expect(parsed.fileActions).toEqual([]);
    expect(parsed.textOutput).toBe(output);
  });

  it('rejects unsafe raw json fallback paths', () => {
    const output = JSON.stringify({
      'file-actions': [{ action: 'delete', path: '../escape.ts' }],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('none');
    expect(parsed.fileActions).toEqual([]);
  });

  it('returns empty actions when raw json fallback has no file-actions array', () => {
    const output = JSON.stringify({
      actions: [{ action: 'delete', path: 'foo.html' }],
    });

    const parsed = extractFileActionsFromOutput(output);

    expect(parsed.parseMethod).toBe('none');
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

    expect(parsed.parseMethod).toBe('fenced_block');
    expect(parsed.fileActions).toEqual([{ action: 'delete', path: 'from-block.html' }]);
    expect(parsed.textOutput).toContain('"from-raw-json.html"');
  });

  it('keeps non-file-action outputs intact with empty actions', () => {
    const output = 'Here is the explanation without file action blocks.';
    const parsed = extractFileActionsFromOutput(output);
    expect(parsed.parseMethod).toBe('none');
    expect(parsed.fileActions).toEqual([]);
    expect(parsed.textOutput).toBe(output);
  });
});
