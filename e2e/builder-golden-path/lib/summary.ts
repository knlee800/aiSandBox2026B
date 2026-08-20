export type Verdict = 'PASS' | 'FAIL';

export interface PassSummary {
  verdict: 'PASS';
  projectId: string | null;
  sessionId: string | null;
  executionId: string | null;
  provider: string;
  model: string;
  tokensUsed: number | null;
  autoApply: 'YES';
  preview: 'PASS';
  checkpointHash: string | null;
  confirmStatus: number | null;
  confirmTriggered: boolean | null;
  deductionCount: number | null;
  creditsDeducted: number | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  cleanup: string;
  executionGateFinal: string;
}

export interface FailSummary {
  verdict: 'FAIL';
  phase: string;
  error: string;
  projectId?: string | null;
  sessionId?: string | null;
  executionId?: string | null;
  preview?: string;
  cleanup?: string;
  executionGateFinal?: string;
  evidence?: Record<string, unknown>;
}

export type GoldenPathSummary = PassSummary | FailSummary;

function compact(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  return String(value);
}

export function formatPassSummary(summary: PassSummary): string {
  return [
    'verdict=PASS',
    `projectId=${compact(summary.projectId)}`,
    `sessionId=${compact(summary.sessionId)}`,
    `executionId=${compact(summary.executionId)}`,
    `provider=${summary.provider}`,
    `model=${summary.model}`,
    `tokensUsed=${compact(summary.tokensUsed)}`,
    'autoApply=YES',
    'preview=PASS',
    `checkpointHash=${compact(summary.checkpointHash)}`,
    `confirmStatus=${compact(summary.confirmStatus)}`,
    `confirmTriggered=${compact(summary.confirmTriggered)}`,
    `deductionCount=${compact(summary.deductionCount)}`,
    `creditsDeducted=${compact(summary.creditsDeducted)}`,
    `balanceBefore=${compact(summary.balanceBefore)}`,
    `balanceAfter=${compact(summary.balanceAfter)}`,
    `cleanup=${summary.cleanup}`,
    `executionGateFinal=${summary.executionGateFinal}`,
  ].join('\n');
}

export function formatFailSummary(summary: FailSummary): string {
  const lines = [
    'verdict=FAIL',
    `phase=${summary.phase}`,
    `error=${summary.error}`,
    `projectId=${compact(summary.projectId ?? null)}`,
    `sessionId=${compact(summary.sessionId ?? null)}`,
    `executionId=${compact(summary.executionId ?? null)}`,
    `cleanup=${compact(summary.cleanup ?? null)}`,
    `executionGateFinal=${compact(summary.executionGateFinal ?? null)}`,
  ];
  if (summary.preview) {
    lines.push(`preview=${summary.preview}`);
  }
  if (summary.evidence) {
    for (const [key, value] of Object.entries(summary.evidence)) {
      const rendered = typeof value === 'string' ? value : JSON.stringify(value);
      if (rendered.length > 500) {
        lines.push(`${key}=${rendered.slice(0, 500)}…`);
      } else {
        lines.push(`${key}=${rendered}`);
      }
    }
  }
  return lines.join('\n');
}

export function isConcisePassSummary(text: string): boolean {
  const lines = text.trim().split(/\r?\n/);
  return lines.length <= 20 && !/pm2 logs|BEGIN|stack trace/i.test(text);
}
