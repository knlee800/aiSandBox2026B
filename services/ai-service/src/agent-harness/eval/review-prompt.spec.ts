import * as fs from 'fs';
import * as path from 'path';
import { loadReviewTasks } from './review-loader';

/**
 * The page starts a coding run with no caller instructions, so
 * buildCollaborationProjectInstructions returns the brief alone.
 * Other agents keep coding-team order: lead, then writer.
 */
describe('coding team reviewer prompt', () => {
  it('matches the gateway brief built from the registry instructions', () => {
    const registryPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'api-gateway',
      'src',
      'system-agents',
      'system-agent-registry.ts',
    );
    const source = fs.readFileSync(registryPath, 'utf8').replace(/\r\n/g, '\n');
    const reviewer = extractInstruction(source, 'CODING_REVIEWER_INSTRUCTIONS');
    const lead = oneLine(extractInstruction(source, 'CODING_LEAD_INSTRUCTIONS'));
    const writer = oneLine(extractInstruction(source, 'CODING_WRITER_INSTRUCTIONS'));
    const expected = [
      'You are reviewer.',
      reviewer,
      '',
      'Other agents:',
      `- lead: ${lead}`,
      `- writer: ${writer}`,
      '',
      'Ask another agent only when you genuinely need them. At most one request, alone at the very end of the answer, exactly <handoff to="name">task</handoff>. Otherwise no request.',
    ].join('\n');

    const tasks = loadReviewTasks(path.join(__dirname, 'review-tasks'));
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(task.reviewerPrompt.startsWith('You are reviewer.')).toBe(true);
      expect(task.reviewerPrompt).toContain(reviewer);
      expect(task.reviewerPrompt).toContain(lead);
      expect(task.reviewerPrompt).toContain(writer);
      expect(task.reviewerPrompt).toBe(expected);
    }
  });
});

function extractInstruction(source: string, name: string): string {
  const marker = `const ${name} =\n  '`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`missing ${name}`);
  }
  const valueStart = start + marker.length;
  const end = source.indexOf("';", valueStart);
  if (end < 0) {
    throw new Error(`unterminated ${name}`);
  }
  const value = source.slice(valueStart, end);
  if (value.includes('\\') || value.includes("'")) {
    throw new Error(`${name} is not a plain single-quoted line`);
  }
  return value;
}

function oneLine(value: string): string {
  let out = '';
  let pendingSpace = false;
  for (const char of value) {
    if (char.trim() === '') {
      pendingSpace = out.length > 0;
      continue;
    }
    if (pendingSpace) {
      out += ' ';
      pendingSpace = false;
    }
    out += char;
  }
  return out;
}
