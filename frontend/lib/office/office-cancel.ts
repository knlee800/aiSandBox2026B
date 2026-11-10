import { collaborationFetch } from '@/lib/collaboration/api';
import type { OfficeDesk } from './office.logic';

/** Where the cancel control is in its flow for one Team run. */
export type OfficeCancelOutcome = 'cancelled' | 'finished' | 'notFound' | 'failed';

export type OfficeCancelPhase = 'confirming' | 'cancelling' | OfficeCancelOutcome;

export interface OfficeCancelState {
  deskId: string;
  collaborationRunId: string;
  phase: OfficeCancelPhase;
}

export type OfficeCollaborationFetch = (path: string, init?: RequestInit) => Promise<Response>;

export function officeCancelPath(collaborationRunId: string): string {
  return `/api/collaboration/runs/${encodeURIComponent(collaborationRunId)}/cancel`;
}

/** 409 means the run already ended, 404 means it is gone (or not the caller's). */
export function officeCancelOutcomeFromStatus(status: number): OfficeCancelOutcome {
  if (status >= 200 && status < 300) {
    return 'cancelled';
  }
  if (status === 409) {
    return 'finished';
  }
  if (status === 404) {
    return 'notFound';
  }
  return 'failed';
}

/** True once the cancel attempt has an answer to show. */
export function officeCancelPhaseIsResult(
  phase: OfficeCancelPhase | null,
): phase is OfficeCancelOutcome {
  return (
    phase === 'cancelled' || phase === 'finished' || phase === 'notFound' || phase === 'failed'
  );
}

/**
 * The same request the Team page sends: POST /api/collaboration/runs/:id/cancel through
 * collaborationFetch, which adds the CSRF header and credentials.
 */
export async function cancelOfficeCollaborationRun(
  collaborationRunId: string,
  fetcher: OfficeCollaborationFetch = collaborationFetch,
): Promise<OfficeCancelOutcome> {
  try {
    const response = await fetcher(officeCancelPath(collaborationRunId), {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return officeCancelOutcomeFromStatus(response.status);
  } catch {
    return 'failed';
  }
}

/** A Team run can be cancelled while it is queued or working. Stopping runs are already ending. */
export function officeCancellableRunId(
  desk: Pick<OfficeDesk, 'phase' | 'currentRun'> | null,
): string | null {
  if (!desk || (desk.phase !== 'queued' && desk.phase !== 'working')) {
    return null;
  }
  const id = desk.currentRun?.collaborationRunId?.trim();
  return id ? id : null;
}

const CANCEL_RESULT_KEY: Record<OfficeCancelOutcome, string> = {
  cancelled: 'cancelRunCancelled',
  finished: 'cancelRunFinished',
  notFound: 'cancelRunNotFound',
  failed: 'cancelRunFailed',
};

/** Message key (under office.) for a finished cancel attempt. */
export function officeCancelResultKey(outcome: OfficeCancelOutcome): string {
  return CANCEL_RESULT_KEY[outcome];
}
