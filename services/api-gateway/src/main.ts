import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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
