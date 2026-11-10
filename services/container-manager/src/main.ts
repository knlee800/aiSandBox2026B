import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app-setup';
import { resolveListenHost } from './listen-host';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Validation pipe and the 'api' prefix. CM-CLEANUP-01 (F5): no CORS.
  configureApp(app);

  const port = process.env.PORT || 4002;
  // AI-SERVICE-AUTH-01: LISTEN_HOST, default 127.0.0.1 (host-local callers only)
  const host = resolveListenHost(process.env);
  await app.listen(port, host);

  console.log('🐳 Container Manager started!');
  console.log(`📡 Listening on: http://${host}:${port}`);
  console.log(`💚 Health Check: http://${host}:${port}/api/health`);
  console.log(`📁 Workspaces: /home/vibecode/workspace/aiSandBox/workspaces`);
}

bootstrap();
