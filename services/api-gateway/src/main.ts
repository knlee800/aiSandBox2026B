import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieSession from 'cookie-session';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Enable CORS for frontend
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const oauthStateSecret =
    process.env.OAUTH_STATE_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    'change_this_in_production_use_a_long_random_string';

  // Short-lived OAuth state cookie only; this is separate from the auth session cookie.
  app.use(
    cookieSession({
      name: 'aisandbox_oauth_state',
      keys: [oauthStateSecret],
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    }),
  );
  app.use(cookieParser());
  app.use((req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    if (!req.cookies?.aisandbox_csrf) {
      res.cookie('aisandbox_csrf', randomBytes(32).toString('hex'), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    next();
  });

  // Enable global exception filter (PHASE-42A-4: Preserve quota error body shape)
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Set global prefix
  app.setGlobalPrefix('api');

  // Use PORT (required by startup guard), fallback to API_PORT for backward compatibility
  const port = process.env.PORT || process.env.API_PORT || 4000;
  await app.listen(port);

  console.log('🚀 API Gateway started!');
  console.log(`📡 Listening on: http://localhost:${port}`);
  console.log(`🔗 API Docs: http://localhost:${port}/api`);
  console.log(`💚 Health Check: http://localhost:${port}/api/health`);
}

bootstrap();
