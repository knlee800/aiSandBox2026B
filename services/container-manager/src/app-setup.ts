import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage } from 'http';
import { INTERNAL_SERVICE_KEY_HEADER, internalKeyMatches } from './guards/internal-service-auth.guard';

/** The global route prefix set in configureApp. */
export const API_PREFIX = 'api';

/**
 * SNAPSHOT-SIZE-01 / CM-BODY-ROUTE-01: largest JSON request body accepted on
 * the internal file write route, POST /api/internal/sessions/:id/files. The
 * gateway restores snapshot files through it with base64 content, so the
 * 100 KB default left out any image over about 75 KB. 16 MB covers ordinary
 * images and fonts (about 12 MB of binary after base64) and stays bounded.
 */
export const JSON_BODY_LIMIT = '16mb';

/**
 * CM-BODY-ROUTE-01: JSON body limit on every other route; the same as the
 * body-parser / Nest default.
 */
export const DEFAULT_JSON_BODY_LIMIT = '100kb';

/**
 * CM-BODY-ROUTE-01: the one request path that can get JSON_BODY_LIMIT (only
 * with the valid internal key since CM-BODY-KEY-01).
 *
 * Matched against the raw (still percent-encoded) path without the query
 * string, which is what Express matches routes against. Only the canonical
 * form matches: the literal segments exactly as written (lowercase), one
 * session id segment with no '/', and no trailing slash. The id segment
 * matches what Express's `:id` matches (`[^/]+`), so any session id the route
 * accepts gets the large limit; Express decodes it afterwards and
 * SessionIdPipe still refuses a bad one. Any variant (a trailing slash,
 * other letter case, a percent-encoded literal such as `%66iles`, an extra
 * segment such as `/files/search`) does not match and gets the default
 * limit, so no other route can get the 16 MB parser.
 */
const FILE_WRITE_PATH = new RegExp(`^/${API_PREFIX}/internal/sessions/[^/]+/files$`);

/** True only for POST <canonical file write path>. */
export function isFileWriteRequest(method: string | undefined, pathname: string | undefined): boolean {
  return method === 'POST' && typeof pathname === 'string' && FILE_WRITE_PATH.test(pathname);
}

/** The JSON media type check body-parser applies by default ('application/json'). */
type ExpressRequestLike = IncomingMessage & {
  path?: string;
  is?: (type: string) => string | false | null;
};

function isJsonContent(req: ExpressRequestLike): boolean {
  return typeof req.is === 'function' && Boolean(req.is('application/json'));
}

function requestIsFileWrite(req: ExpressRequestLike): boolean {
  // Express's req.path: the raw pathname of the URL, query string removed.
  return isFileWriteRequest(req.method, req.path);
}

/**
 * CM-BODY-KEY-01: true only when the request carries the valid internal key.
 *
 * The same check the guard makes (InternalServiceAuthGuard): the
 * `x-internal-service-key` header compared in constant time with
 * INTERNAL_SERVICE_KEY by the guard's own internalKeyMatches. A missing,
 * empty or duplicated header (Node joins a repeated header into one longer
 * string; an array is refused) and a key of another length never match. With
 * no expected key (unset or empty) nothing matches. The guard stays the
 * authority: this only decides which body limit applies, never access.
 */
function requestHasInternalKey(req: ExpressRequestLike, expectedKey: string | undefined): boolean {
  if (!expectedKey) {
    return false;
  }
  return internalKeyMatches(req.headers[INTERNAL_SERVICE_KEY_HEADER], expectedKey);
}

/**
 * CM-BODY-KEY-01: the one request that gets JSON_BODY_LIMIT: the canonical
 * file write (isFileWriteRequest) with the valid internal key. Everything
 * else, including a file write without a valid key, gets the default limit.
 */
function requestGetsLargeLimit(req: ExpressRequestLike, expectedKey: string | undefined): boolean {
  return requestIsFileWrite(req) && requestHasInternalKey(req, expectedKey);
}

/**
 * App-wide setup shared by main.ts and the HTTP tests.
 *
 * CM-CLEANUP-01 (F5): CORS is off. Only host processes (the gateway and
 * ai-service, with the internal key) call container-manager; no browser does,
 * so there is no cross-origin caller to allow. The old setting allowed any
 * origin with credentials.
 *
 * CM-BODY-ROUTE-01: Express parses bodies before Nest guards run, so the
 * large limit is scoped to the file write route. Two JSON parsers are
 * registered here, before the app initialises, so Nest skips its default
 * JSON parser (it adds one only when no parser named jsonParser exists).
 * Their `type` checks are mutually exclusive: the file write route is parsed
 * only by the 16 MB parser, every other JSON request only by the 100 KB
 * parser. body-parser also skips a request already parsed (req._body), so a
 * body is never parsed twice. The urlencoded parser stays at Nest's default.
 *
 * CM-BODY-KEY-01: the 16 MB parser also requires the valid internal key
 * (requestHasInternalKey), so a caller without it cannot make the service
 * parse a large body before the guard answers: its file write falls to the
 * 100 KB parser (413 when larger, the guard's 403 otherwise). The expected
 * key is read here once, like the guard reads it once when it is built;
 * main.ts loads the environment before either. Call this before listen/init.
 */
export function configureApp(app: INestApplication): void {
  const expressApp = app as NestExpressApplication;
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;

  expressApp.useBodyParser('json', {
    limit: JSON_BODY_LIMIT,
    type: (req: IncomingMessage) =>
      isJsonContent(req as ExpressRequestLike) && requestGetsLargeLimit(req as ExpressRequestLike, expectedKey),
  });
  expressApp.useBodyParser('json', {
    limit: DEFAULT_JSON_BODY_LIMIT,
    type: (req: IncomingMessage) =>
      isJsonContent(req as ExpressRequestLike) && !requestGetsLargeLimit(req as ExpressRequestLike, expectedKey),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix(API_PREFIX);
}
