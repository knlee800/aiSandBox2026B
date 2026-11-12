// A failed fetch (offline, DNS, refused connection, CORS) rejects with a TypeError whose
// text is the browser's own English. A TypeError thrown by our own code (for example
// "x is not a function") must not be shown as a network error, so the text is checked too.
// AbortError and TimeoutError are not matched: the page does not abort or time out its
// fetches, and a deliberate cancel is not a connection problem.
const FETCH_FAILURE_PATTERNS: readonly RegExp[] = [
  /failed to fetch/i, // Chrome, Edge
  /networkerror when attempting to fetch resource/i, // Firefox
  /load failed/i, // Safari
  /fetch failed/i, // Node / undici
  /network request failed/i, // some polyfills
];

export function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false;
  }
  return FETCH_FAILURE_PATTERNS.some((pattern) => pattern.test(error.message));
}
