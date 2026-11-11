import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage } from 'http';

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
 * CM-BODY-ROUTE-01: the one request that gets JSON_BODY_LIMIT.
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
 * Call this before listen/init.
 */
export function configureApp(app: INestApplication): void {
  const expressApp = app as NestExpressApplication;

  expressApp.useBodyParser('json', {
    limit: JSON_BODY_LIMIT,
    type: (req: IncomingMessage) =>
      requestIsFileWrite(req as ExpressRequestLike) && isJsonContent(req as ExpressRequestLike),
  });
  expressApp.useBodyParser('json', {
    limit: DEFAULT_JSON_BODY_LIMIT,
    type: (req: IncomingMessage) =>
      !requestIsFileWrite(req as ExpressRequestLike) && isJsonContent(req as ExpressRequestLike),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix(API_PREFIX);
}
