import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { In } from 'typeorm';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import {
  KNOWLEDGE_ERROR_CODES,
  KNOWLEDGE_ERRORS,
  KNOWLEDGE_MAX_ACCOUNT_BYTES,
  KNOWLEDGE_MAX_ACTIVE_DOCUMENTS,
} from './knowledge-content';
import { KnowledgeService } from './knowledge.service';

function sha(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let documents: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    softDelete: jest.Mock;
    delete: jest.Mock;
    remove: jest.Mock;
  };

  const ownerId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const documentId = '33333333-3333-4333-8333-333333333333';
  const now = new Date('2026-11-05T01:00:00.000Z');

  function row(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
    return {
      id: documentId,
      userId: ownerId,
      scopeId: 'policies',
      title: 'Handbook',
      content: 'Hello',
      contentHash: sha('Hello'),
      byteSize: 5,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      user: undefined,
      ...overrides,
    } as KnowledgeDocument;
  }

  beforeEach(async () => {
    documents = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({
        id: documentId,
        createdAt: now,
        updatedAt: value.updatedAt ?? now,
        deletedAt: null,
        ...value,
      })),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      softDelete: jest.fn(async () => ({ affected: 1 })),
      delete: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: getRepositoryToken(KnowledgeDocument), useValue: documents },
      ],
    }).compile();

    service = module.get(KnowledgeService);
  });

  function expectBadRequest(error: unknown, code: string, message: string): void {
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({ code, message });
  }

  it('creates a document for the owner and stores the normalized hash', async () => {
    const result = await service.upsert(ownerId, {
      scopeId: 'policies',
      title: ' Handbook ',
      content: ' Hello\r\n ',
    });

    expect(result.outcome).toBe('created');
    expect(result.document.id).toBe(documentId);
    expect(result.document.content).toBe('Hello');
    expect(result.document.contentHash).toBe(sha('Hello'));
    expect(result.document.byteSize).toBe(5);
    expect(documents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ownerId,
        scopeId: 'policies',
        title: 'Handbook',
        content: 'Hello',
      }),
    );
    expect(documents.save).toHaveBeenCalledTimes(1);
    expect(documents.delete).not.toHaveBeenCalled();
    expect(documents.remove).not.toHaveBeenCalled();
  });

  it('does not write when the same title and hash already exist', async () => {
    const existing = row();
    documents.findOne.mockResolvedValue(existing);

    const result = await service.upsert(ownerId, {
      scopeId: 'policies',
      title: 'Handbook',
      content: 'Hello\r\n',
    });

    expect(result.outcome).toBe('unchanged');
    expect(result.document).toBe(existing);
    expect(result.document.updatedAt).toBe(now);
    expect(documents.save).not.toHaveBeenCalled();
    expect(documents.find).not.toHaveBeenCalled();
  });

  it('replaces content and keeps the id when the hash changes', async () => {
    const existing = row();
    documents.findOne.mockResolvedValue(existing);
    documents.find.mockResolvedValue([existing]);

    const result = await service.upsert(ownerId, {
      scopeId: 'policies',
      title: 'Handbook',
      content: 'Updated',
    });

    expect(result.outcome).toBe('updated');
    expect(result.document.id).toBe(documentId);
    expect(result.document.content).toBe('Updated');
    expect(result.document.contentHash).toBe(sha('Updated'));
    expect(result.document.byteSize).toBe(7);
    expect(result.document.updatedAt.getTime()).toBeGreaterThan(now.getTime());
    expect(documents.create).not.toHaveBeenCalled();
    expect(documents.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: documentId, content: 'Updated' }),
    );
  });

  it('retries a unique conflict as a replace and keeps the winning id', async () => {
    const winner = row({ content: 'Other', contentHash: sha('Other'), byteSize: 5 });
    documents.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    documents.find.mockResolvedValue([winner]);
    documents.save.mockRejectedValueOnce({ code: '23505' }).mockImplementation(async (value) => value);

    const result = await service.upsert(ownerId, {
      scopeId: 'policies',
      title: 'Handbook',
      content: 'Hello',
    });

    expect(result.outcome).toBe('updated');
    expect(result.document.id).toBe(documentId);
    expect(documents.save).toHaveBeenCalledTimes(2);
  });

  it('blocks the 51st active document and still allows a replace at the cap', async () => {
    documents.findOne.mockResolvedValue(null);
    documents.find.mockResolvedValue(
      Array.from({ length: KNOWLEDGE_MAX_ACTIVE_DOCUMENTS }, () => row({ byteSize: 1 })),
    );

    await expect(
      service.upsert(ownerId, { scopeId: 'policies', title: 'New', content: 'Body' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    try {
      await service.upsert(ownerId, { scopeId: 'policies', title: 'New', content: 'Body' });
    } catch (error) {
      expectBadRequest(
        error,
        KNOWLEDGE_ERROR_CODES.tooManyDocuments,
        KNOWLEDGE_ERRORS.tooManyDocuments,
      );
    }
    expect(documents.save).not.toHaveBeenCalled();

    const existing = row({ byteSize: 1 });
    documents.findOne.mockResolvedValue(existing);
    documents.find.mockResolvedValue(
      Array.from({ length: KNOWLEDGE_MAX_ACTIVE_DOCUMENTS }, () => existing),
    );
    const replaced = await service.upsert(ownerId, {
      scopeId: 'policies',
      title: 'Handbook',
      content: 'Changed',
    });
    expect(replaced.outcome).toBe('updated');
    expect(replaced.document.id).toBe(documentId);
  });

  it('enforces the account byte cap and releases the replaced document size', async () => {
    documents.findOne.mockResolvedValue(null);
    documents.find.mockResolvedValue([row({ byteSize: KNOWLEDGE_MAX_ACCOUNT_BYTES - 1 })]);
    await expect(
      service.upsert(ownerId, { scopeId: 'policies', title: 'New', content: 'ab' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: KNOWLEDGE_ERROR_CODES.accountTooLarge }),
    });

    const existing = row({
      content: 'old',
      contentHash: sha('old'),
      byteSize: KNOWLEDGE_MAX_ACCOUNT_BYTES,
    });
    documents.findOne.mockResolvedValue(existing);
    documents.find.mockResolvedValue([existing]);
    const replaced = await service.upsert(ownerId, {
      scopeId: 'policies',
      title: 'Handbook',
      content: 'hi',
    });
    expect(replaced.outcome).toBe('updated');
    expect(replaced.document.byteSize).toBe(2);

    const kept = row({
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Kept',
      content: 'kept',
      contentHash: sha('kept'),
      byteSize: KNOWLEDGE_MAX_ACCOUNT_BYTES - 4,
    });
    const small = row({
      content: 'old',
      contentHash: sha('old'),
      byteSize: 4,
    });
    documents.findOne.mockResolvedValue(small);
    documents.find.mockResolvedValue([kept, small]);
    documents.save.mockClear();
    await expect(
      service.upsert(ownerId, {
        scopeId: 'policies',
        title: 'Handbook',
        content: 'abcdef',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: KNOWLEDGE_ERROR_CODES.accountTooLarge,
        message: KNOWLEDGE_ERRORS.accountTooLarge,
      }),
    });
    expect(documents.save).not.toHaveBeenCalled();
  });

  it('lists only the owner and can filter by scope', async () => {
    documents.find.mockResolvedValue([row()]);
    await service.list(ownerId);
    expect(documents.find).toHaveBeenCalledWith({
      where: { userId: ownerId },
      order: { updatedAt: 'DESC' },
    });

    await service.list(ownerId, 'policies');
    expect(documents.find).toHaveBeenLastCalledWith({
      where: { userId: ownerId, scopeId: 'policies' },
      order: { updatedAt: 'DESC' },
    });

    await expect(service.list(ownerId, 'legal-contracts')).rejects.toMatchObject({
      response: expect.objectContaining({ code: KNOWLEDGE_ERROR_CODES.unknownScope }),
    });
  });

  it('returns another user document as missing and soft-deletes only the owner row', async () => {
    documents.findOne.mockImplementation(async (options: { where: { id: string; userId: string } }) => {
      if (options.where.userId === ownerId) {
        return row();
      }
      return null;
    });

    await expect(service.findOwned(ownerId, documentId)).resolves.toMatchObject({ id: documentId });
    await expect(service.findOwned(otherId, documentId)).resolves.toBeNull();
    await expect(service.findOwned(ownerId, 'not-a-uuid')).resolves.toBeNull();
    expect(documents.findOne).toHaveBeenCalledTimes(2);

    documents.softDelete.mockResolvedValueOnce({ affected: 0 });
    await expect(service.deleteOwned(otherId, documentId)).rejects.toBeInstanceOf(NotFoundException);
    expect(documents.softDelete).toHaveBeenCalledWith({ id: documentId, userId: otherId });

    documents.softDelete.mockResolvedValueOnce({ affected: 1 });
    await expect(service.deleteOwned(ownerId, documentId)).resolves.toBeUndefined();
    expect(documents.softDelete).toHaveBeenCalledWith({ id: documentId, userId: ownerId });
    expect(documents.delete).not.toHaveBeenCalled();
    expect(documents.remove).not.toHaveBeenCalled();

    await expect(service.deleteOwned(ownerId, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('looks up active documents by id for the owner only', async () => {
    const deletedId = '44444444-4444-4444-8444-444444444444';
    const foreignId = '55555555-5555-4555-8555-555555555555';
    const active = row();
    const deleted = row({ id: deletedId, deletedAt: now });
    const foreign = row({ id: foreignId, userId: otherId });
    documents.find.mockResolvedValue([active, deleted, foreign, row({ id: '66666666-6666-4666-8666-666666666666' })]);

    await expect(service.findActiveOwnedByIds(ownerId, [])).resolves.toEqual([]);
    await expect(service.findActiveOwnedByIds(ownerId, ['not-a-uuid'])).resolves.toEqual([]);
    expect(documents.find).not.toHaveBeenCalled();

    const found = await service.findActiveOwnedByIds(ownerId, [
      documentId.toUpperCase(),
      deletedId,
      foreignId,
      'not-a-uuid',
      documentId,
    ]);

    expect(found).toEqual([active]);
    expect(documents.find).toHaveBeenCalledTimes(1);
    const query = documents.find.mock.calls[0][0];
    expect(query.where.userId).toBe(ownerId);
    expect(query.where.id).toEqual(In([documentId, deletedId, foreignId]));
    expect(query.withDeleted).toBeUndefined();
  });
});
