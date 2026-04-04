export const CHAT_ORCHESTRATION_MAX_STEPS = 3;

export type WorkspaceChatOrchestrationStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface WorkspaceChatOrchestrationStep {
  id: string;
  instruction: string;
}

export interface WorkspaceChatOrchestrationStepProgress {
  id: string;
  status: WorkspaceChatOrchestrationStepStatus;
  summary?: string;
}

function sanitizeStepInstruction(raw: string): string {
  return raw.replace(/^[-*]\s+/, '').replace(/^\d+[\).]\s+/, '').trim();
}

export function buildWorkspaceChatOrchestrationPlan(
  prompt: string,
  maxSteps: number = CHAT_ORCHESTRATION_MAX_STEPS,
): WorkspaceChatOrchestrationStep[] {
  const boundedMax = Number.isFinite(maxSteps)
    ? Math.max(1, Math.min(Math.trunc(maxSteps), CHAT_ORCHESTRATION_MAX_STEPS))
    : CHAT_ORCHESTRATION_MAX_STEPS;
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    return [{ id: 'step-1', instruction: 'Analyze the request and propose the smallest safe change.' }];
  }

  const lineCandidates = normalizedPrompt
    .split(/\r?\n/g)
    .map((line) => sanitizeStepInstruction(line))
    .filter((line) => line.length > 0);
  const uniqueLineCandidates = Array.from(new Set(lineCandidates));
  const planFromLines = uniqueLineCandidates.slice(0, boundedMax);
  if (planFromLines.length >= 2) {
    return planFromLines.map((instruction, index) => ({
      id: `step-${index + 1}`,
      instruction,
    }));
  }

  const sentenceCandidates = normalizedPrompt
    .split(/(?<=[.!?])\s+/g)
    .map((sentence) => sanitizeStepInstruction(sentence))
    .filter((sentence) => sentence.length > 0);
  const uniqueSentenceCandidates = Array.from(new Set(sentenceCandidates)).slice(0, boundedMax);
  if (uniqueSentenceCandidates.length >= 2) {
    return uniqueSentenceCandidates.map((instruction, index) => ({
      id: `step-${index + 1}`,
      instruction,
    }));
  }

  const fallbackInstructions = [
    `Analyze requirements and constraints for: ${normalizedPrompt}`,
    `Implement the requested changes for: ${normalizedPrompt}`,
    `Verify results and summarize any file actions for: ${normalizedPrompt}`,
  ].slice(0, boundedMax);
  return fallbackInstructions.map((instruction, index) => ({
    id: `step-${index + 1}`,
    instruction,
  }));
}

export function formatWorkspaceChatOrchestrationProgress(input: {
  steps: WorkspaceChatOrchestrationStep[];
  progress: WorkspaceChatOrchestrationStepProgress[];
}): string {
  const progressById = new Map(input.progress.map((entry) => [entry.id, entry]));
  const planLines = input.steps.map((step, index) => `${index + 1}. ${step.instruction}`);
  const progressLines = input.steps.map((step, index) => {
    const entry = progressById.get(step.id);
    const status = entry?.status ?? 'pending';
    const summarySuffix = entry?.summary ? ` — ${entry.summary}` : '';
    return `- Step ${index + 1}: ${status}${summarySuffix}`;
  });

  return [
    `Orchestration mode enabled (max ${CHAT_ORCHESTRATION_MAX_STEPS} steps).`,
    '',
    'Plan:',
    ...planLines,
    '',
    'Progress:',
    ...progressLines,
  ].join('\n');
}
