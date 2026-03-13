export type WorkspacePreviewState = 'loading' | 'ready' | 'unavailable' | 'error';

export interface WorkspacePreviewStatusResponse {
  running?: boolean;
}

export function isPreviewRunning(status: WorkspacePreviewStatusResponse): boolean {
  return status.running === true;
}

export function buildPreviewProxyUrl(sessionId: string, refreshToken: number): string {
  return `/api/preview/${encodeURIComponent(sessionId)}/proxy?refresh=${refreshToken}`;
}
