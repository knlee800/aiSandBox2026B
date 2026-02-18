import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Database configuration for TypeORM
 * Connects to PostgreSQL container defined in docker-compose.yml
 *
 * Supports both DATABASE_URL (Docker/production) and individual env vars (local dev).
 */
export const databaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const databaseUrl = process.env.DATABASE_URL;

  // Priority 1: Use DATABASE_URL if provided (Docker/production)
  if (databaseUrl) {
    console.log(`[DB CONFIG] Using DATABASE_URL, env=${process.env.NODE_ENV}`);

    return {
      type: 'postgres',
      url: databaseUrl,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: !isProduction,
      extra: {
        max: 10,
        idleTimeoutMillis: 30000,
      },
    };
  }

  // Priority 2: Construct from individual env vars (local development)
  // Host resolution for local development:
  // Force 'localhost' when POSTGRES_HOST='postgres' in non-production environments
  // This handles cases where .env files contain docker-compose hostname 'postgres'
  // but Node services run outside Docker and need to connect via localhost
  let host = process.env.POSTGRES_HOST ?? (isDevelopment ? 'localhost' : 'postgres');

  if (host === 'postgres' && !isProduction) {
    host = 'localhost';
    console.log(`[DB CONFIG] Overriding POSTGRES_HOST='postgres' → 'localhost' for local development`);
  }

  console.log(`[DB CONFIG] Final host=${host}, port=${process.env.POSTGRES_PORT || '5432'}, env=${process.env.NODE_ENV}`);

  return {
    type: 'postgres',
    host,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER || 'aisandbox',
    password: process.env.POSTGRES_PASSWORD || 'aisandbox_dev_password_change_in_production',
    database: process.env.POSTGRES_DB || 'aisandbox',

    // Auto-load entities from the entities directory
    // Pattern will match: src/**/*.entity{.ts,.js}
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],

    // Synchronize: false (required by task spec)
    // Migrations should be used instead
    synchronize: false,

    // Enable logging in development for debugging
    logging: !isProduction,

    // Connection pool settings
    extra: {
      max: 10, // Maximum pool connections
      idleTimeoutMillis: 30000, // Close idle connections after 30s
    },
  };
};
