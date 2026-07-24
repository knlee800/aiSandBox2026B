import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Phase 26-28: Deterministic startup with fail-fast validation
 *
 * CRITICAL: dotenv must load BEFORE AppModule is imported.
 * AppModule is imported via require() AFTER dotenv runs.
 */

// Load environment variables ONCE at startup BEFORE any module imports
// Order matters: load service-local .env first, then root .env as fallback.
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '..', '.env'),
];
const existingEnvPaths = [...new Set(envPaths)].filter((envPath) =>
  fs.existsSync(envPath),
);

if (existingEnvPaths.length > 0) {
  let loadedAnyKeys = false;

  for (const envPath of existingEnvPaths) {
    const result = dotenv.config({ path: envPath, override: false });
    const loadedKeys = Object.keys(result.parsed || {}).length;

    if (loadedKeys > 0) {
      loadedAnyKeys = true;
      console.log(`✓ Loaded ${loadedKeys} environment variables from ${envPath}`);
      continue;
    }

    console.warn(`⚠️  .env file exists but loaded 0 variables: ${envPath}`);
    if (result.error) {
      console.warn(`   dotenv warning: ${result.error.message}`);
    }
  }

  // Fail-fast only if .env files existed but none loaded usable variables
  if (!loadedAnyKeys) {
    console.error('❌ STARTUP ABORTED: .env files exist but loaded 0 variables');
    console.error('   Possible causes:');
    console.error('   - Empty .env file(s)');
    console.error('   - File encoding issue (Windows CRLF vs LF)');
    console.error('   - File permissions');
    console.error('   - Invalid .env syntax');
    process.exit(1);
  }
} else {
  // Production/Docker: .env not required (env vars from container)
  console.log('ℹ️  No .env file found - using environment variables');
}

// NOW import AppModule after dotenv has loaded
const { AppModule } = require('./app.module');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Set global prefix (Phase-52A: exclude /metrics for Prometheus scraping)
  app.setGlobalPrefix('api', { exclude: ['metrics'] });

  const port = process.env.PORT || 4001;
  await app.listen(port);

  const aiProvider = process.env.AI_PROVIDER || 'stub';
  console.log('🤖 AI Service started!');
  console.log(`📡 Listening on: http://localhost:${port}`);
  console.log(`🧠 AI Provider: ${aiProvider}`);
  console.log(`💚 Health Check: http://localhost:${port}/api/health`);
  console.log(`💬 Chat: http://localhost:${port}/api/chat`);
}

bootstrap();
