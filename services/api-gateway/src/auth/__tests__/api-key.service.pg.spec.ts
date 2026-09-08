/**
 * AGENT-PLATFORM-EXEC-01C-KEY-REVOKE-01
 *
 * Opt-in PostgreSQL regression for revoked API-key filtering.
 * Runs only when RUN_API_KEY_REVOKE_PG=true.
 *
 * Requires DATABASE_URL and AISB_REVOKE_PG_DB targeting a disposable
 * database. Refuses aisandbox / postgres / template0 / template1.
 * Does not run in default `npm test`.
 */

import { ForbiddenException } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ApiKeyService } from '../api-key.service';
import { ApiKey } from '../../entities/api-key.entity';
import { User } from '../../entities/user.entity';
import { Session } from '../../entities/session.entity';
import { Project } from '../../entities/project.entity';
import { Workspace } from '../../entities/workspace.entity';
import { OauthAccount } from '../../entities/oauth-account.entity';

const SHOULD_RUN = process.env.RUN_API_KEY_REVOKE_PG === 'true';

const FORBIDDEN_DBS = new Set(['aisandbox', 'postgres', 'template0', 'template1', '']);

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORDINARY_SCOPES = ['ai:execute', 'sessions:read'];

function describeIf(condition: boolean) {
  return condition ? describe : describe.skip;
}

function databaseNameFromUrl(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    // Node rejects postgres://user@/dbname (empty host). Repair only for parsing.
    parsed = new URL(
      databaseUrl.replace(/^(postgres(?:ql)?:\/\/[^/@]+)@\//i, '$1@localhost/'),
    );
  }
  return decodeURIComponent(parsed.pathname.replace(/^\//, '')).trim();
}

describeIf(SHOULD_RUN)('ApiKeyService PostgreSQL revocation filter', () => {
  let dataSource: DataSource;
  let repository: Repository<ApiKey>;
  let service: ApiKeyService;
  const plaintextHeld: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const expectedDb = process.env.AISB_REVOKE_PG_DB;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL must be set for API key revocation PostgreSQL regression');
    }
    if (!expectedDb) {
      throw new Error('AISB_REVOKE_PG_DB must be set for API key revocation PostgreSQL regression');
    }

    const urlDb = databaseNameFromUrl(databaseUrl);
    if (FORBIDDEN_DBS.has(urlDb) || FORBIDDEN_DBS.has(expectedDb) || urlDb !== expectedDb) {
      throw new Error(
        `Refusing unexpected database target urlDb=${urlDb} expected=${expectedDb}`,
      );
    }

    dataSource = new DataSource({
      type: 'postgres',
      host: '/var/run/postgresql',
      port: 5432,
      username: 'postgres',
      database: expectedDb,
      entities: [ApiKey, User, Session, Project, Workspace, OauthAccount],
      synchronize: false,
      logging: false,
      extra: {
        application_name: 'aisb-key-revoke-01-pg',
      },
    });
    await dataSource.initialize();

    const currentRows = await dataSource.query('SELECT current_database() AS db');
    const currentDb = currentRows[0] && currentRows[0].db;
    if (currentDb !== expectedDb || FORBIDDEN_DBS.has(String(currentDb))) {
      throw new Error(`Refusing unexpected current_database=${currentDb}`);
    }

    await dataSource.query(
      'INSERT INTO "public"."users" ("id") VALUES ($1), ($2) ON CONFLICT ("id") DO NOTHING',
      [USER_A, USER_B],
    );

    repository = dataSource.getRepository(ApiKey);
    service = new ApiKeyService(repository);
  });

  afterAll(async () => {
    plaintextHeld.length = 0;
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('filters revoked keys with IsNull and real PostgreSQL', async () => {
    const isNullSql = repository
      .createQueryBuilder('api_key')
      .where({ revokedAt: IsNull() })
      .getQuery();
    expect(isNullSql).toMatch(/revoked_at["\s]*IS NULL/i);
    expect(isNullSql).not.toMatch(/revoked_at["\s]*=/i);

    const createdA = await service.createApiKey(USER_A, ORDINARY_SCOPES.slice());
    const createdB = await service.createApiKey(USER_A, ['ai:execute']);
    plaintextHeld.push(createdA.apiKey, createdB.apiKey);

    const activeIdentity = await service.validateApiKey(createdA.apiKey);
    expect(activeIdentity).toEqual({
      userId: USER_A,
      apiKeyId: createdA.id,
      scopes: ORDINARY_SCOPES,
      isInternal: false,
    });

    await expect(service.revokeApiKey(createdA.id, USER_B)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const stillActiveRows = await dataSource.query(
      'SELECT revoked_at FROM "public"."api_keys" WHERE id = $1',
      [createdA.id],
    );
    expect(stillActiveRows[0].revoked_at).toBeNull();
    const stillValidAfterForeign = await service.validateApiKey(createdA.apiKey);
    expect(stillValidAfterForeign && stillValidAfterForeign.apiKeyId).toBe(createdA.id);

    await service.revokeApiKey(createdA.id, USER_A);
    const revokedRows = await dataSource.query(
      'SELECT revoked_at FROM "public"."api_keys" WHERE id = $1',
      [createdA.id],
    );
    expect(revokedRows[0].revoked_at).not.toBeNull();

    const revokedIdentity = await service.validateApiKey(createdA.apiKey);
    expect(revokedIdentity).toBeNull();

    const otherIdentity = await service.validateApiKey(createdB.apiKey);
    expect(otherIdentity).toEqual({
      userId: USER_A,
      apiKeyId: createdB.id,
      scopes: ['ai:execute'],
      isInternal: false,
    });

    const unknown = `sk_${'f'.repeat(64)}`;
    expect(unknown).not.toBe(createdA.apiKey);
    expect(unknown).not.toBe(createdB.apiKey);
    const unknownIdentity = await service.validateApiKey(unknown);
    expect(unknownIdentity).toBeNull();
  });
});
