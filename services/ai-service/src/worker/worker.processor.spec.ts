import { buildExecutionPromptWithFileActionContract } from './worker.processor';

describe('buildExecutionPromptWithFileActionContract', () => {
  it('preserves the existing prompt when workspaceContext is absent', () => {
    expect(buildExecutionPromptWithFileActionContract('List files')).toBe(
      `Execution output contract:
- If the user request requires creating, modifying, or deleting files, you MUST emit a fenced code block tagged \`file-actions\`.
- The \`file-actions\` block content MUST be valid JSON containing an array of actions.
- Each action MUST use action value "create", "write", "update", or "delete".
- "create", "write", and "update" actions MUST include string fields: "path" and "content".
- "delete" actions MUST include string field "path" and MUST NOT include or require "content".
- Do not claim that files were created, changed, or deleted unless matching \`file-actions\` entries are present.
- If the user request does not require file creation, modification, or deletion, respond normally in plain conversational text and do not emit \`file-actions\` blocks.

User request:
List files`,
    );
  });

  it('prepends project/workspace metadata and selected file content when workspace context is present', () => {
    expect(
      buildExecutionPromptWithFileActionContract('List files', {
        filePaths: ['README.md', 'src/app.ts'],
        projectName: 'Sandbox Project',
        workspaceName: 'Personal',
        selectedFilePath: 'src/app.ts',
        selectedFileContent: 'export const app = true;',
      }),
    ).toBe(
      `Current project:
Sandbox Project

Current workspace:
Personal

Current workspace files:
- README.md
- src/app.ts

Currently open file:
src/app.ts

Selected file content:
export const app = true;

Execution output contract:
- If the user request requires creating, modifying, or deleting files, you MUST emit a fenced code block tagged \`file-actions\`.
- The \`file-actions\` block content MUST be valid JSON containing an array of actions.
- Each action MUST use action value "create", "write", "update", or "delete".
- "create", "write", and "update" actions MUST include string fields: "path" and "content".
- "delete" actions MUST include string field "path" and MUST NOT include or require "content".
- Do not claim that files were created, changed, or deleted unless matching \`file-actions\` entries are present.
- If the user request does not require file creation, modification, or deletion, respond normally in plain conversational text and do not emit \`file-actions\` blocks.

User request:
List files`,
    );
  });

  it('passes through a truncation marker when selected file content is truncated upstream', () => {
    expect(
      buildExecutionPromptWithFileActionContract('Explain this file', {
        filePaths: ['src/app.ts'],
        selectedFilePath: 'src/app.ts',
        selectedFileContent: 'const x = 1;\n[...truncated at 8000 characters]',
      }),
    ).toContain(`Selected file content:
const x = 1;
[...truncated at 8000 characters]`);
  });

  it('appends named file content blocks when provided', () => {
    expect(
      buildExecutionPromptWithFileActionContract('Explain utils.ts', {
        filePaths: ['src/app.ts', 'src/utils.ts'],
        namedFileContents: [
          {
            path: 'src/utils.ts',
            content: 'export const util = true;',
          },
        ],
      }),
    ).toContain(`Named file content: src/utils.ts
export const util = true;`);
  });

  it('appends workspace search results when provided', () => {
    expect(
      buildExecutionPromptWithFileActionContract('Where is login implemented?', {
        filePaths: ['src/app.ts'],
        searchResults: {
          query: 'login',
          results: [{ path: 'src/app.ts', line: 12, preview: 'const login = true;' }],
          truncated: true,
        },
      }),
    ).toContain(`Workspace search results for: login
- src/app.ts:12 - const login = true;
[...results truncated]`);
  });
});
