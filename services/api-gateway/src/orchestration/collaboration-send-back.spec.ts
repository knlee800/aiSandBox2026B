import {
  COLLABORATION_REVIEWER_PROFILE_ID,
  COLLABORATION_SEND_BACK_WRITER_INSTRUCTION,
  COLLABORATION_TEAM,
  COLLABORATION_WRITER_PROFILE_ID,
} from './collaboration-team';
import { classifySendBackEdge, type SendBackGraphEdge } from './collaboration-send-back';
import {
  WORK_DIFF_PROMPT_HEADING,
  WORK_DIFF_PROMPT_UNAVAILABLE,
  appendSavePointDiff,
} from './collaboration-work-diff';
import { MAX_SEND_BACK_ROUNDS } from './orchestration.contracts';

function edge(source: string, target: string, createdAtMs: number): SendBackGraphEdge {
  return { sourceProfileId: source, targetProfileId: target, createdAtMs };
}

describe('classifySendBackEdge', () => {
  const writer = COLLABORATION_WRITER_PROFILE_ID;
  const reviewer = COLLABORATION_REVIEWER_PROFILE_ID;

  it('allows two reviewer-to-writer rounds and the matching returns, then caps the third', () => {
    const chain: SendBackGraphEdge[] = [];
    expect(classifySendBackEdge('lead', writer, chain)).toBe('ordinary');
    chain.push(edge('lead', writer, 1));
    expect(classifySendBackEdge(writer, reviewer, chain)).toBe('ordinary');
    chain.push(edge(writer, reviewer, 2));

    expect(classifySendBackEdge(reviewer, writer, chain)).toBe('open');
    chain.push(edge(reviewer, writer, 3));
    expect(classifySendBackEdge(writer, reviewer, chain)).toBe('open');
    chain.push(edge(writer, reviewer, 4));

    expect(classifySendBackEdge(reviewer, writer, chain)).toBe('open');
    chain.push(edge(reviewer, writer, 5));
    expect(classifySendBackEdge(writer, reviewer, chain)).toBe('open');
    chain.push(edge(writer, reviewer, 6));

    expect(classifySendBackEdge(reviewer, writer, chain)).toBe('capped');
    expect(classifySendBackEdge(reviewer, 'lead', chain)).toBe('ordinary');
    expect(classifySendBackEdge(writer, 'lead', chain)).toBe('ordinary');
    expect(MAX_SEND_BACK_ROUNDS).toBe(2);
  });

  it('does not open a second writer-to-reviewer return for the same send-back', () => {
    const chain = [
      edge('lead', writer, 1),
      edge(writer, reviewer, 2),
      edge(reviewer, writer, 3),
      edge(writer, reviewer, 4),
    ];
    expect(classifySendBackEdge(writer, reviewer, chain)).toBe('ordinary');
  });

  it('opens the first writer-to-reviewer after a send-back that happened first', () => {
    const chain = [edge('lead', reviewer, 1), edge(reviewer, writer, 2)];
    expect(classifySendBackEdge(writer, reviewer, chain)).toBe('open');
  });
});

describe('send-back instructions and diff prompt', () => {
  it('tells the reviewer to send a real bug back and the writer to fix only the list', () => {
    const reviewer = COLLABORATION_TEAM.find((agent) => agent.name === 'reviewer');
    expect(reviewer?.instructions).toContain(
      'If you find a real bug, send the work back to writer with a specific list of what to fix.',
    );
    expect(reviewer?.instructions).toContain('Otherwise give the verdict and finish.');
    expect(COLLABORATION_SEND_BACK_WRITER_INSTRUCTION).toContain('Fix only the listed items');
    expect(COLLABORATION_SEND_BACK_WRITER_INSTRUCTION).toContain('hand it to reviewer');
  });

  it('places the diff after the task and uses a note when the diff is missing', () => {
    const prompt = appendSavePointDiff('Fix the form.\n\nUpdated the form.', 'diff --git a/a b/a\n', false);
    expect(prompt.indexOf('Fix the form.')).toBeLessThan(prompt.indexOf(WORK_DIFF_PROMPT_HEADING));
    expect(prompt).toContain('diff --git a/a b/a\n');
    expect(appendSavePointDiff('Fix the form.', '', true)).toContain(WORK_DIFF_PROMPT_UNAVAILABLE);
  });
});
