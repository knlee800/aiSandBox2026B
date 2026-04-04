import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildWorkspaceChatOrchestrationPlan,
  CHAT_ORCHESTRATION_MAX_STEPS,
  formatWorkspaceChatOrchestrationProgress,
} from './workspace-chat-orchestration.logic';

describe('workspace chat orchestration logic', () => {
  test('builds a bounded deterministic plan from multiple lines', () => {
    const plan = buildWorkspaceChatOrchestrationPlan(
      `1. Inspect current implementation\n2. Apply focused change\n3. Verify behavior\n4. Extra line`,
      3,
    );
    assert.equal(plan.length, 3);
    assert.deepEqual(
      plan.map((step) => step.instruction),
      ['Inspect current implementation', 'Apply focused change', 'Verify behavior'],
    );
  });

  test('falls back to generated 3-step plan when prompt has one sentence', () => {
    const prompt = 'Add a bounded orchestration mode.';
    const plan = buildWorkspaceChatOrchestrationPlan(prompt);
    assert.equal(plan.length, CHAT_ORCHESTRATION_MAX_STEPS);
    assert.match(plan[0].instruction, /Analyze requirements and constraints/);
    assert.match(plan[1].instruction, /Implement the requested changes/);
    assert.match(plan[2].instruction, /Verify results and summarize any file actions/);
  });

  test('formats orchestration progress for chat-thread visibility', () => {
    const content = formatWorkspaceChatOrchestrationProgress({
      steps: [
        { id: 'step-1', instruction: 'Plan' },
        { id: 'step-2', instruction: 'Implement' },
      ],
      progress: [
        { id: 'step-1', status: 'completed', summary: 'execution complete' },
        { id: 'step-2', status: 'running' },
      ],
    });
    assert.match(content, /Orchestration mode enabled/);
    assert.match(content, /1\. Plan/);
    assert.match(content, /Step 1: completed — execution complete/);
    assert.match(content, /Step 2: running/);
  });
});
