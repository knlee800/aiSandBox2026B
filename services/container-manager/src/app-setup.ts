import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * App-wide setup shared by main.ts and the HTTP tests.
 *
 * CM-CLEANUP-01 (F5): CORS is off. Only host processes (the gateway and
 * ai-service, with the internal key) call container-manager; no browser does,
 * so there is no cross-origin caller to allow. The old setting allowed any
 * origin with credentials.
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');
}
