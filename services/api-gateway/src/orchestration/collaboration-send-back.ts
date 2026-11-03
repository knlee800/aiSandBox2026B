import {
  COLLABORATION_REVIEWER_PROFILE_ID,
  COLLABORATION_WRITER_PROFILE_ID,
} from './collaboration-team';
import { MAX_SEND_BACK_ROUNDS } from './orchestration.contracts';

export type SendBackEdge = 'open' | 'capped' | 'ordinary';

export interface SendBackGraphEdge {
  readonly sourceProfileId: string;
  readonly targetProfileId: string;
  readonly createdAtMs: number;
}

function isReviewerToWriter(edge: {
  sourceProfileId: string;
  targetProfileId: string;
}): boolean {
  return (
    edge.sourceProfileId === COLLABORATION_REVIEWER_PROFILE_ID &&
    edge.targetProfileId === COLLABORATION_WRITER_PROFILE_ID
  );
}

function isWriterToReviewer(edge: {
  sourceProfileId: string;
  targetProfileId: string;
}): boolean {
  return (
    edge.sourceProfileId === COLLABORATION_WRITER_PROFILE_ID &&
    edge.targetProfileId === COLLABORATION_REVIEWER_PROFILE_ID
  );
}

/**
 * Reviewer to writer is a send-back round (at most two).
 * Writer to reviewer is open only for one return after each send-back.
 * Anything else, including a third send-back, stays an ordinary edge.
 */
export function classifySendBackEdge(
  sourceProfileId: string,
  targetProfileId: string,
  existing: readonly SendBackGraphEdge[],
): SendBackEdge {
  const ordered = existing
    .map((edge, index) => ({ edge, index }))
    .sort(
      (left, right) =>
        left.edge.createdAtMs - right.edge.createdAtMs || left.index - right.index,
    )
    .map((entry) => entry.edge);

  let sendBacks = 0;
  let writerToReviewer = 0;
  let writerToReviewerBeforeSendBack = 0;
  for (const edge of ordered) {
    if (isReviewerToWriter(edge)) {
      sendBacks += 1;
    }
    if (isWriterToReviewer(edge)) {
      writerToReviewer += 1;
      if (sendBacks === 0) {
        writerToReviewerBeforeSendBack += 1;
      }
    }
  }

  const proposed = { sourceProfileId, targetProfileId };
  if (isReviewerToWriter(proposed)) {
    return sendBacks >= MAX_SEND_BACK_ROUNDS ? 'capped' : 'open';
  }
  if (isWriterToReviewer(proposed)) {
    const returnsUsed = writerToReviewer - writerToReviewerBeforeSendBack;
    if (sendBacks > 0 && returnsUsed < sendBacks) {
      return 'open';
    }
  }
  return 'ordinary';
}
