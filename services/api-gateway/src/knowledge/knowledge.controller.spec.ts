import { validate } from 'class-validator';
import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { KNOWLEDGE_MAX_DOCUMENT_BYTES } from './knowledge-content';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeUploadInterceptor } from './knowledge-upload.interceptor';
import { KNOWLEDGE_SCOPES } from './knowledge-scopes';
import { CreateKnowledgeDocumentDto } from './dto/knowledge-document.dto';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

class MemoryKnowledgeRepository {
  rows: KnowledgeDocument[] = [];
  private stamp = 0;

  private timestamp(): Date {
    this.stamp += 1;
    return new Date(Date.now() + this.stamp);
  }

  create(value: Partial<KnowledgeDocument>): KnowledgeDocument {
    return { ...value } as KnowledgeDocument;
  }

  async save(value: KnowledgeDocument): Promise<KnowledgeDocument> {
    if (!value.id) {
      const stored = {
        ...value,
        id: randomUUID(),
        createdAt: value.createdAt ?? this.timestamp(),
        updatedAt: value.updatedAt ?? this.timestamp(),
        deletedAt: null,
      } as KnowledgeDocument;
      this.rows.push(stored);
      return stored;
    }
    const index = this.rows.findIndex((row) => row.id === value.id);
    if (index === -1) {
      this.rows.push(value);
    } else {
      this.rows[index] = value;
    }
    return value;
  }

  async find(options?: {
    where?: { userId?: string; scopeId?: string };
    order?: { updatedAt?: string };
  }): Promise<KnowledgeDocument[]> {
    let result = this.rows.filter(
      (row) => row.deletedAt == null && matches(row, options?.where),
    );
    if (options?.order?.updatedAt === 'DESC') {
      result = [...result].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    }
    return result;
  }

  async findOne(options?: {
    where?: { id?: string; userId?: string; scopeId?: string; title?: string };
  }): Promise<KnowledgeDocument | null> {
    return (
      this.rows.find((row) => row.deletedAt == null && matches(row, options?.where)) ?? null
    );
  }

  async softDelete(criteria: { id: string; userId: string }): Promise<{ affected: number }> {
    const row = this.rows.find(
      (item) => item.deletedAt == null && item.id === criteria.id && item.userId === criteria.userId,
    );
    if (!row) {
      return { affected: 0 };
    }
    row.deletedAt = new Date();
    return { affected: 1 };
  }

  async delete(): Promise<void> {
    throw new Error('hard delete is not used');
  }

  async remove(): Promise<void> {
    throw new Error('hard delete is not used');
  }
}

function matches(
  row: KnowledgeDocument,
  where?: { id?: string; userId?: string; scopeId?: string; title?: string },
): boolean {
  if (!where) {
    return true;
  }
  return Object.entries(where).every(
    ([key, value]) => (row as unknown as Record<string, unknown>)[key] === value,
  );
}

describe('KnowledgeController', () => {
  let app: INestApplication;
  let repo: MemoryKnowledgeRepository;

  beforeEach(async () => {
    repo = new MemoryKnowledgeRepository();
    const module = await Test.createTestingModule({
      controllers: [KnowledgeController],
      providers: [
        KnowledgeService,
        KnowledgeUploadInterceptor,
        { provide: getRepositoryToken(KnowledgeDocument), useValue: repo },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          const headerUser = req.header('x-test-user');
          const entitled = req.header('x-test-entitled');
          if (headerUser === 'anonymous') {
            req.apiKeyIdentity = undefined;
            return true;
          }
          req.apiKeyIdentity = {
            userId: headerUser || OWNER,
            apiKeyId: headerUser === 'no-key' ? '' : 'browser-session',
            scopes: ['ai:execute'],
            harnessEntitled: entitled !== '0',
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function authed(userId = OWNER, entitled = true) {
    const server = request(app.getHttpServer());
    const mark = (req: request.Test) =>
      req.set('x-test-user', userId).set('x-test-entitled', entitled ? '1' : '0');
    return {
      get: (path: string) => mark(server.get(path)),
      post: (path: string) => mark(server.post(path)),
      delete: (path: string) => mark(server.delete(path)),
    };
  }

  it('uses SessionOrApiKeyAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', KnowledgeController);
    expect(guards).toContain(SessionOrApiKeyAuthGuard);
  });

  it('refuses a caller who is not harness entitled on every route', async () => {
    const denied = authed(OWNER, false);
    await denied.get('/api/knowledge/scopes').expect(403);
    await denied.get('/api/knowledge/documents').expect(403);
    await denied.get(`/api/knowledge/documents/${randomUUID()}`).expect(403);
    await denied
      .post('/api/knowledge/documents')
      .send({ scopeId: 'policies', title: 'Handbook', content: 'Hello' })
      .expect(403);
    await denied.delete(`/api/knowledge/documents/${randomUUID()}`).expect(403);
    expect(repo.rows).toHaveLength(0);
  });

  it('returns 401 when credentials are missing', async () => {
    await request(app.getHttpServer())
      .get('/api/knowledge/scopes')
      .set('x-test-user', 'anonymous')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/knowledge/documents')
      .set('x-test-user', 'no-key')
      .expect(401);
  });

  it('returns the server scope registry', async () => {
    const response = await authed().get('/api/knowledge/scopes').expect(200);
    expect(response.body).toEqual({
      scopes: KNOWLEDGE_SCOPES.map((scope) => ({ id: scope.id, type: scope.type })),
    });
  });

  it('creates, replaces and leaves an unchanged document on the same title', async () => {
    const created = await authed()
      .post('/api/knowledge/documents')
      .send({
        scopeId: 'policies',
        title: 'Handbook',
        content: 'Hello',
        userId: OTHER,
      })
      .expect(200);
    expect(created.body.outcome).toBe('created');
    expect(created.body.content).toBe('Hello');
    expect(created.body).not.toHaveProperty('userId');
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].userId).toBe(OWNER);

    const same = await authed()
      .post('/api/knowledge/documents')
      .send({ scopeId: 'policies', title: 'Handbook', content: 'Hello\r\n' })
      .expect(200);
    expect(same.body.outcome).toBe('unchanged');
    expect(same.body.id).toBe(created.body.id);
    expect(repo.rows.filter((row) => row.deletedAt == null)).toHaveLength(1);

    const updated = await authed()
      .post('/api/knowledge/documents')
      .send({ scopeId: 'policies', title: 'Handbook', content: 'Updated' })
      .expect(200);
    expect(updated.body.outcome).toBe('updated');
    expect(updated.body.id).toBe(created.body.id);
    expect(updated.body.content).toBe('Updated');
  });

  it('lists active documents without content and filters by scope', async () => {
    await authed()
      .post('/api/knowledge/documents')
      .send({ scopeId: 'policies', title: 'Older', content: 'secret-body' })
      .expect(200);
    await authed()
      .post('/api/knowledge/documents')
      .send({ scopeId: 'policies', title: 'Newer', content: 'visible-title-only' })
      .expect(200);
    await authed()
      .post('/api/knowledge/documents')
      .send({ scopeId: 'market-data', title: 'Market', content: 'market-secret' })
      .expect(200);

    const listed = await authed().get('/api/knowledge/documents').expect(200);
    expect(listed.body.documents.map((document: { title: string }) => document.title)).toEqual([
      'Market',
      'Newer',
      'Older',
    ]);
    expect(listed.body.documents[0]).not.toHaveProperty('content');
    expect(JSON.stringify(listed.body)).not.toContain('secret-body');
    expect(JSON.stringify(listed.body)).not.toContain('market-secret');

    const filtered = await authed().get('/api/knowledge/documents?scopeId=policies').expect(200);
    expect(filtered.body.documents.map((document: { title: string }) => document.title)).toEqual([
      'Newer',
      'Older',
    ]);

    const unknown = await authed().get('/api/knowledge/documents?scopeId=legal-contracts').expect(400);
    expect(unknown.body).toMatchObject({
      code: 'UNKNOWN_SCOPE',
      message: 'Unknown knowledge scope.',
    });
  });

  it('returns one owned document with content and hides another user', async () => {
    const created = await authed()
      .post('/api/knowledge/documents')
      .send({ scopeId: 'policies', title: 'Handbook', content: 'secret-body' })
      .expect(200);

    const owned = await authed().get(`/api/knowledge/documents/${created.body.id}`).expect(200);
    expect(owned.body.content).toBe('secret-body');
    expect(owned.body).not.toHaveProperty('userId');

    const hidden = await authed(OTHER).get(`/api/knowledge/documents/${created.body.id}`).expect(404);
    expect(hidden.body).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Knowledge document not found.',
    });
    await authed().get('/api/knowledge/documents/not-a-uuid').expect(404);
  });

  it('soft-deletes only the owner document', async () => {
    const created = await authed()
      .post('/api/knowledge/documents')
      .send({ scopeId: 'policies', title: 'Handbook', content: 'Hello' })
      .expect(200);

    await authed(OTHER).delete(`/api/knowledge/documents/${created.body.id}`).expect(404);
    await authed().get(`/api/knowledge/documents/${created.body.id}`).expect(200);

    await authed().delete(`/api/knowledge/documents/${created.body.id}`).expect(204);
    await authed().get(`/api/knowledge/documents/${created.body.id}`).expect(404);
    expect(repo.rows[0].deletedAt).toBeInstanceOf(Date);
    expect(repo.rows.filter((row) => row.deletedAt == null)).toHaveLength(0);
  });

  it('accepts markdown and text uploads and rejects the wrong type', async () => {
    const markdown = await authed()
      .post('/api/knowledge/documents')
      .field('scopeId', 'policies')
      .field('title', 'Notes')
      .attach('file', Buffer.from('hello\r\n', 'utf8'), 'Notes.MD')
      .expect(200);
    expect(markdown.body).toMatchObject({ outcome: 'created', content: 'hello' });

    const text = await authed()
      .post('/api/knowledge/documents')
      .field('scopeId', 'policies')
      .field('title', 'Plain')
      .attach('file', Buffer.from('plain', 'utf8'), 'plain.TXT')
      .expect(200);
    expect(text.body.content).toBe('plain');

    const rejected = await authed()
      .post('/api/knowledge/documents')
      .field('scopeId', 'policies')
      .field('title', 'Bad')
      .attach('file', Buffer.from('nope', 'utf8'), 'notes.pdf')
      .expect(400);
    expect(rejected.body).toMatchObject({
      code: 'WRONG_FILE_TYPE',
      message: 'Only .md and .txt files are supported.',
    });
    expect(repo.rows.filter((row) => row.deletedAt == null)).toHaveLength(2);
  });

  it('returns 400 when a file is over 200 KB', async () => {
    const response = await authed()
      .post('/api/knowledge/documents')
      .field('scopeId', 'policies')
      .field('title', 'Big')
      .attach('file', Buffer.alloc(KNOWLEDGE_MAX_DOCUMENT_BYTES + 1, 0x61), 'big.txt')
      .expect(400);
    expect(response.body).toMatchObject({
      code: 'DOCUMENT_TOO_LARGE',
      message: 'Document exceeds the 200 KB limit.',
    });
    expect(repo.rows).toHaveLength(0);
  });

  it('returns 400 for an empty title or unknown scope', async () => {
    const empty = await authed()
      .post('/api/knowledge/documents')
      .send({ scopeId: 'policies', title: '   ', content: 'Hello' })
      .expect(400);
    expect(empty.body.code).toBe('TITLE_REQUIRED');

    const unknown = await authed()
      .post('/api/knowledge/documents')
      .send({ scopeId: 'legal-contracts', title: 'A', content: 'B' })
      .expect(400);
    expect(unknown.body.code).toBe('UNKNOWN_SCOPE');
  });
});

describe('knowledge DTOs', () => {
  it('rejects an empty document and an unknown scope', async () => {
    const empty = new CreateKnowledgeDocumentDto();
    const emptyErrors = await validate(empty);
    expect(emptyErrors.map((error) => error.property).sort()).toEqual([
      'content',
      'scopeId',
      'title',
    ]);

    const unknown = new CreateKnowledgeDocumentDto();
    unknown.scopeId = 'legal-contracts';
    unknown.title = 'Handbook';
    unknown.content = 'Hello';
    const unknownErrors = await validate(unknown);
    expect(unknownErrors.map((error) => error.property)).toEqual(['scopeId']);
  });

  it('accepts a known scope with title and content', async () => {
    const dto = new CreateKnowledgeDocumentDto();
    dto.scopeId = 'policies';
    dto.title = 'Handbook';
    dto.content = 'Hello';
    expect(await validate(dto)).toEqual([]);
  });
});
