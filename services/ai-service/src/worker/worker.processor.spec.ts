import { buildExecutionPromptWithFileActionContract } from './worker.processor';

describe('buildExecutionPromptWithFileActionContract', () => {
  it('preserves the existing prompt when workspaceContext is absent', () => {
    expect(buildExecutionPromptWithFileActionContract('List files')).toBe(
      `Execution output contract:
- If the user request requires creating or modifying files, you MUST emit a fenced code block tagged \`file-actions\`.
- The \`file-actions\` block content MUST be valid JSON containing an array of actions.
- Each action MUST use action values "create", "write", or "update" and include string fields: "path" and "content".
- Do not claim that files were created or changed unless matching \`file-actions\` entries are present.
- If the user request does not require file creation or modification, respond normally in plain conversational text and do not emit \`file-actions\` blocks.

User request:
List files`,
    );
  });

  it('prepends compact workspace context when file paths are present', () => {
    expect(
      buildExecutionPromptWithFileActionContract('List files', {
        filePaths: ['README.md', 'src/app.ts'],
        selectedFilePath: 'src/app.ts',
      }),
    ).toBe(
      `Current workspace files:
- README.md
- src/app.ts

Currently open file:
src/app.ts

Execution output contract:
- If the user request requires creating or modifying files, you MUST emit a fenced code block tagged \`file-actions\`.
- The \`file-actions\` block content MUST be valid JSON containing an array of actions.
- Each action MUST use action values "create", "write", or "update" and include string fields: "path" and "content".
- Do not claim that files were created or changed unless matching \`file-actions\` entries are present.
- If the user request does not require file creation or modification, respond normally in plain conversational text and do not emit \`file-actions\` blocks.

User request:
List files`,
    );
  });
});
