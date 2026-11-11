import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

/**
 * SNAPSHOT-SIZE-01: largest JSON request body container-manager accepts.
 * The gateway restores snapshot files through POST
 * /api/internal/sessions/:id/files with base64 content, so Express's default
 * of 100 KB left out any image over about 75 KB. 16 MB covers ordinary
 * images and fonts (about 12 MB of binary after base64) and stays bounded.
 * Only host-local callers reach this service (LISTEN_HOST, internal key).
 */
export const JSON_BODY_LIMIT = '16mb';

/**
 * App-wide setup shared by main.ts and the HTTP tests.
 *
 * CM-CLEANUP-01 (F5): CORS is off. Only host processes (the gateway and
 * ai-service, with the internal key) call container-manager; no browser does,
 * so there is no cross-origin caller to allow. The old setting allowed any
 * origin with credentials.
 *
 * SNAPSHOT-BINARY-01 / SNAPSHOT-SIZE-01: the JSON parser is registered here,
 * before the app initialises, so Nest skips its default 100 KB JSON parser
 * (it adds a default only for a parser type not yet registered). The
 * urlencoded parser stays at Nest's default. Call this before listen/init.
 */
export function configureApp(app: INestApplication): void {
  (app as NestExpressApplication).useBodyParser('json', { limit: JSON_BODY_LIMIT });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');
}
