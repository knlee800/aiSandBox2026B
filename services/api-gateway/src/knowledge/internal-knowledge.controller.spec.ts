import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { InternalKnowledgeController } from './internal-knowledge.controller';
import { KnowledgeService } from './knowledge.service';

describe('InternalKnowledgeController', () => {
  let app: INestApplication;
  let documents: { find: jest.Mock; findOne: jest.Mock };
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const internalKey = 'know-02-internal-key';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const policyId = '33333333-3333-4333-8333-333333333333';
  const deletedId = '44444444-4444-4444-8444-444444444444';
  const otherScopeId = '55555555-5555-4555-8555-555555555555';
  const foreignId = '66666666-6666-4666-8666-666666666666';
  const sectionId = '77777777-7777-4777-8777-777777777777';
  const now = new Date('2026-11-06T00:00:00.000Z');
  let store: KnowledgeDocument[];

  function row(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
    return {
      id: policyId,
      userId: ownerId,
      scopeId: 'policies',
      title: 'Handbook',
      content: '# Policies\nEmployees may take leave.',
      contentHash: 'hash',
      byteSize: 40,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      user: undefined,
      ...overrides,
    } as KnowledgeDocument;
  }

  beforeEach(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;
    store = [
      row(),
      row({
        id: deletedId,
        title: 'Deleted doc',
        content: 'Employees may take leave.',
        deletedAt: now,
      }),
      row({
        id: otherScopeId,
        scopeId: 'market-data',
        title: 'Market note',
        content: 'Employees may take leave.',
      }),
      row({
        id: foreignId,
        userId: otherId,
        title: 'Foreign handbook',
        content: 'Employees may take leave.',
      }),
      row({
        id: sectionId,
        title: 'Sections',
        content: [
          '# Overview',
          'intro',
          '## Leave',
          'Employees may take leave.',
          '### Notes',
          'Bring a form.',
          '## Other',
          'end',
        ].join('\n'),
      }),
    ];
    documents = {
      find: jest.fn(async () => store.slice()),
      findOne: jest.fn(async (options: { where: { id: string; userId: string } }) => {
        return (
          store.find(
            (entry) =>
              entry.id === options.where.id && entry.userId === options.where.userId,
          ) ?? null
        );
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [InternalKnowledgeController],
      providers: [
        KnowledgeService,
        { provide: getRepositoryToken(KnowledgeDocument), useValue: documents },
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
    await app.close();
  });

  function authed(path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('X-Internal-Service-Key', internalKey);
  }

  it('has no second guard on the internal controller', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'internal-knowledge.controller.ts'),
      'utf8',
    );
    expect(source).toContain("@Controller('internal/knowledge')");
    expect(source).not.toContain('@UseGuards');
    expect(source).not.toContain('SessionOrApiKeyAuthGuard');
  });

  it('rejects a missing or wrong key and accepts the key without a session cookie', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/knowledge/search')
      .send({ userId: ownerId, scopes: ['policies'], query: 'leave' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/internal/knowledge/search')
      .set('X-Internal-Service-Key', 'wrong-key')
      .send({ userId: ownerId, scopes: ['policies'], query: 'leave' })
      .expect(401);
    expect(documents.find).not.toHaveBeenCalled();

    const response = await authed('/api/internal/knowledge/search')
      .send({ userId: ownerId, scopes: ['policies'], query: 'leave' })
      .expect(200);
    expect(response.body.query).toBe('leave');
    expect(response.body.results.map((hit: { title: string }) => hit.title)).toEqual([
      'Handbook',
      'Sections',
    ]);
    for (const hit of response.body.results) {
      expect(hit).not.toHaveProperty('content');
    }
    expect(JSON.stringify(response.body)).not.toContain('Foreign handbook');
    expect(JSON.stringify(response.body)).not.toContain('Deleted doc');
    expect(JSON.stringify(response.body)).not.toContain('Market note');
    expect(documents.find.mock.calls[0][0].withDeleted).toBeUndefined();
    expect(documents.find.mock.calls[0][0].order).toEqual({ updatedAt: 'DESC' });
    expect(documents.find.mock.calls[0][0].where.userId).toBe(ownerId);
  });

  it('uses the body user id and ignores a query-string user id', async () => {
    await authed(`/api/internal/knowledge/search?userId=${otherId}`)
      .send({
        userId: ownerId,
        scopes: ['policies'],
        query: 'leave',
        content: 'should-be-ignored',
      })
      .expect(200);
    expect(documents.find.mock.calls[0][0].where.userId).toBe(ownerId);
  });

  it('rejects an invalid user, an empty or malformed scope list, and an unknown scope', async () => {
    const invalidUser = await authed('/api/internal/knowledge/search')
      .send({ userId: 'nope', scopes: ['policies'], query: 'leave' })
      .expect(400);
    expect(invalidUser.body.code).toBe('USER_INVALID');

    const empty = await authed('/api/internal/knowledge/search')
      .send({ userId: ownerId, scopes: [], query: 'leave' })
      .expect(400);
    expect(empty.body.code).toBe('SCOPES_INVALID');
    expect(empty.body.message).toBe('The knowledge scope list is not valid.');

    const duplicate = await authed('/api/internal/knowledge/search')
      .send({ userId: ownerId, scopes: ['policies', 'policies'], query: 'leave' })
      .expect(400);
    expect(duplicate.body.code).toBe('SCOPES_INVALID');

    const unknown = await authed('/api/internal/knowledge/search')
      .send({ userId: ownerId, scopes: ['not-a-scope'], query: 'leave' })
      .expect(400);
    expect(unknown.body.code).toBe('UNKNOWN_SCOPE');
    expect(unknown.body.message).toBe('Unknown knowledge scope.');
    expect(documents.find).not.toHaveBeenCalled();
  });

  it('rejects a blank, unsupported, or over-long query and returns the normalized query', async () => {
    const required = await authed('/api/internal/knowledge/search')
      .send({ userId: ownerId, scopes: ['policies'], query: '   ' })
      .expect(400);
    expect(required.body.code).toBe('QUERY_REQUIRED');

    const unsupported = await authed('/api/internal/knowledge/search')
      .send({ userId: ownerId, scopes: ['policies'], query: 'hello\n' })
      .expect(400);
    expect(unsupported.body.code).toBe('QUERY_UNSUPPORTED');

    const tooLong = await authed('/api/internal/knowledge/search')
      .send({ userId: ownerId, scopes: ['policies'], query: 'a'.repeat(121) })
      .expect(400);
    expect(tooLong.body.code).toBe('QUERY_TOO_LONG');

    const normalized = await authed('/api/internal/knowledge/search')
      .send({ userId: ownerId, scopes: ['policies'], query: '  hello   world  ' })
      .expect(200);
    expect(normalized.body).toEqual({
      query: 'hello world',
      results: [],
      truncated: false,
    });
  });

  it('returns one 404 with no content for a bad id, another owner, another scope, a deleted row, or a missing heading', async () => {
    const cases = [
      { documentId: 'not-a-uuid', scopes: ['policies'] },
      { documentId: foreignId, scopes: ['policies'] },
      { documentId: otherScopeId, scopes: ['policies'] },
      { documentId: deletedId, scopes: ['policies'] },
      { documentId: sectionId, scopes: ['policies'], heading: 'Missing' },
    ];
    const bodies = [];
    for (const body of cases) {
      const response = await authed('/api/internal/knowledge/read')
        .send({ userId: ownerId, ...body })
        .expect(404);
      expect(response.body).not.toHaveProperty('content');
      expect(response.body.code).toBe('NOT_FOUND');
      expect(response.body.message).toBe('Knowledge document not found.');
      bodies.push(JSON.stringify(response.body));
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it('returns the matching section and the whole document when no heading is sent', async () => {
    const section = await authed('/api/internal/knowledge/read')
      .send({ userId: ownerId, scopes: ['policies'], documentId: sectionId, heading: '# Leave' })
      .expect(200);
    expect(section.body).toEqual({
      documentId: sectionId,
      title: 'Sections',
      scopeId: 'policies',
      heading: 'Leave',
      content: ['## Leave', 'Employees may take leave.', '### Notes', 'Bring a form.'].join('\n'),
      truncated: false,
    });

    const whole = await authed('/api/internal/knowledge/read')
      .send({ userId: ownerId, scopes: ['policies'], documentId: policyId })
      .expect(200);
    expect(whole.body.heading).toBeNull();
    expect(whole.body.content).toBe('# Policies\nEmployees may take leave.');
    expect(whole.body.truncated).toBe(false);
  });
});
