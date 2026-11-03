export const WORK_DIFF_PROMPT_HEADING = 'Diff against the save point:';
export const WORK_DIFF_PROMPT_UNAVAILABLE =
  'The diff against the save point could not be loaded.';

/** Puts the writer diff after the task text. A failed fetch becomes a note and does not throw. */
export function appendSavePointDiff(
  prompt: string,
  diffText: string,
  unavailable: boolean,
): string {
  const section = unavailable
    ? WORK_DIFF_PROMPT_UNAVAILABLE
    : `${WORK_DIFF_PROMPT_HEADING}\n${diffText}`;
  return `${prompt}\n\n${section}`;
}
