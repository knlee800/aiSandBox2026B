import { resolveSocketCorsOrigin } from '../websocket/websocket.gateway';

export function resolveHttpCorsOrigin(
  requestOrigin: string | undefined,
  callback: (err: Error | null, allow?: boolean | string) => void,
): void {
  resolveSocketCorsOrigin(requestOrigin, callback);
}
