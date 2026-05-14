export type LineDiffType = 'added' | 'removed' | 'context';

export interface LineDiff {
  type: LineDiffType;
  lineNumber: number;
  content: string;
}

export interface FileDiffResult {
  path: string;
  action: 'create' | 'write' | 'update' | 'delete';
  lines: LineDiff[];
  truncated: boolean;
}

interface InternalDiffLine {
  type: LineDiffType;
  oldLineNumber: number;
  newLineNumber: number;
  content: string;
}

const DIFF_CONTEXT_RADIUS = 3;
export const DIFF_MAX_LINES = 200;

function splitContentLines(content: string): string[] {
  if (content.length === 0) {
    return [];
  }
  return content.split('\n');
}

function buildLcsTable(currentLines: readonly string[], proposedLines: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: currentLines.length + 1 }, () =>
    Array.from({ length: proposedLines.length + 1 }, () => 0),
  );
  for (let currentIndex = 1; currentIndex <= currentLines.length; currentIndex += 1) {
    for (let proposedIndex = 1; proposedIndex <= proposedLines.length; proposedIndex += 1) {
      if (currentLines[currentIndex - 1] === proposedLines[proposedIndex - 1]) {
        table[currentIndex][proposedIndex] = table[currentIndex - 1][proposedIndex - 1] + 1;
      } else {
        table[currentIndex][proposedIndex] = Math.max(
          table[currentIndex - 1][proposedIndex],
          table[currentIndex][proposedIndex - 1],
        );
      }
    }
  }
  return table;
}

function buildInternalDiffLines(
  currentLines: readonly string[],
  proposedLines: readonly string[],
  lcsTable: number[][],
): InternalDiffLine[] {
  const reversedDiff: InternalDiffLine[] = [];
  let currentIndex = currentLines.length;
  let proposedIndex = proposedLines.length;

  while (currentIndex > 0 || proposedIndex > 0) {
    if (
      currentIndex > 0 &&
      proposedIndex > 0 &&
      currentLines[currentIndex - 1] === proposedLines[proposedIndex - 1]
    ) {
      reversedDiff.push({
        type: 'context',
        oldLineNumber: currentIndex,
        newLineNumber: proposedIndex,
        content: currentLines[currentIndex - 1],
      });
      currentIndex -= 1;
      proposedIndex -= 1;
      continue;
    }

    if (
      proposedIndex > 0 &&
      (currentIndex === 0 ||
        lcsTable[currentIndex][proposedIndex - 1] >= lcsTable[currentIndex - 1][proposedIndex])
    ) {
      reversedDiff.push({
        type: 'added',
        oldLineNumber: currentIndex,
        newLineNumber: proposedIndex,
        content: proposedLines[proposedIndex - 1],
      });
      proposedIndex -= 1;
      continue;
    }

    reversedDiff.push({
      type: 'removed',
      oldLineNumber: currentIndex,
      newLineNumber: proposedIndex,
      content: currentLines[currentIndex - 1],
    });
    currentIndex -= 1;
  }

  return reversedDiff.reverse();
}

function collectWindowedDiffLines(lines: readonly InternalDiffLine[]): InternalDiffLine[] {
  const changedLineIndexes = lines
    .map((line, index) => (line.type === 'context' ? null : index))
    .filter((index): index is number => index !== null);
  if (changedLineIndexes.length === 0) {
    return [];
  }

  const includeIndex = Array.from({ length: lines.length }, () => false);
  for (const changedIndex of changedLineIndexes) {
    const windowStart = Math.max(0, changedIndex - DIFF_CONTEXT_RADIUS);
    const windowEnd = Math.min(lines.length - 1, changedIndex + DIFF_CONTEXT_RADIUS);
    for (let cursor = windowStart; cursor <= windowEnd; cursor += 1) {
      includeIndex[cursor] = true;
    }
  }

  return lines.filter((_, index) => includeIndex[index]);
}

function convertToPublicDiffLine(line: InternalDiffLine): LineDiff {
  return {
    type: line.type,
    lineNumber: line.type === 'added' ? line.newLineNumber : line.oldLineNumber,
    content: line.content,
  };
}

export function computeLineDiff(
  currentContent: string,
  proposedContent: string,
): { lines: LineDiff[]; truncated: boolean } {
  const currentLines = splitContentLines(currentContent);
  const proposedLines = splitContentLines(proposedContent);
  const lcsTable = buildLcsTable(currentLines, proposedLines);
  const allDiffLines = buildInternalDiffLines(currentLines, proposedLines, lcsTable);
  const windowedDiffLines = collectWindowedDiffLines(allDiffLines).map(convertToPublicDiffLine);
  const truncated = windowedDiffLines.length > DIFF_MAX_LINES;
  return {
    lines: truncated ? windowedDiffLines.slice(0, DIFF_MAX_LINES) : windowedDiffLines,
    truncated,
  };
}
