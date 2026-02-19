/**
 * TypeORM Data Source Configuration
 *
 * Used by TypeORM CLI for migrations.
 * DATABASE_URL is the ONLY source of connection configuration.
 *
 * This file does NOT read POSTGRES_* environment variables.
 * Set DATABASE_URL before running migrations.
 */

import { DataSource } from 'typeorm';
import * as path from 'path';

// DATABASE_URL is the single source of truth
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    '[DATA SOURCE] DATABASE_URL is required. ' +
    'Set it before running migrations:\n' +
    '  Example: DATABASE_URL=postgresql://aisandbox:password@localhost:5432/aisandbox'
  );
}

// EXACTLY ONE EXPORT: TypeORM CLI requires this
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [path.join(__dirname, 'src/**/*.entity{.ts,.js}')],
  migrations: [__dirname + '/src/migrations/*.{ts,js}'],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
});
