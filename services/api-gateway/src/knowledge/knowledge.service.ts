import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import {
  KNOWLEDGE_ERROR_CODES,
  KNOWLEDGE_ERRORS,
  KNOWLEDGE_MAX_ACCOUNT_BYTES,
  KNOWLEDGE_MAX_ACTIVE_DOCUMENTS,
  PreparedKnowledgeDocument,
  isKnowledgeDocumentId,
  knowledgeBadRequest,
  knowledgeNotFound,
  prepareKnowledgeWrite,
} from './knowledge-content';
import { findKnowledgeScope } from './knowledge-scopes';

export type KnowledgeWriteOutcome = 'created' | 'updated' | 'unchanged';

export interface KnowledgeWriteResult {
  document: KnowledgeDocument;
  outcome: KnowledgeWriteOutcome;
}

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly documents: Repository<KnowledgeDocument>,
  ) {}

  async list(userId: string, scopeId?: string): Promise<KnowledgeDocument[]> {
    if (scopeId !== undefined && !findKnowledgeScope(scopeId)) {
      throw knowledgeBadRequest(
        KNOWLEDGE_ERROR_CODES.unknownScope,
        KNOWLEDGE_ERRORS.unknownScope,
      );
    }
    const where: FindOptionsWhere<KnowledgeDocument> =
      scopeId === undefined ? { userId } : { userId, scopeId };
    return this.documents.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  async findOwned(userId: string, id: string): Promise<KnowledgeDocument | null> {
    if (!isKnowledgeDocumentId(id)) {
      return null;
    }
    return this.documents.findOne({ where: { id, userId } });
  }

  async findActiveOwnedByIds(
    userId: string,
    ids: readonly string[],
  ): Promise<KnowledgeDocument[]> {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (!isKnowledgeDocumentId(id)) {
        continue;
      }
      const key = id.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(key);
    }
    if (unique.length === 0) {
      return [];
    }
    const rows = await this.documents.find({
      where: { userId, id: In(unique) },
    });
    return rows.filter(
      (row) =>
        row.deletedAt == null &&
        row.userId === userId &&
        seen.has(row.id.toLowerCase()),
    );
  }

  async upsert(
    userId: string,
    input: { scopeId: unknown; title: unknown; content: unknown },
  ): Promise<KnowledgeWriteResult> {
    const prepared = prepareKnowledgeWrite(input);
    const existing = await this.documents.findOne({
      where: {
        userId,
        scopeId: prepared.scopeId,
        title: prepared.title,
      },
    });
    if (existing) {
      return this.replaceExisting(userId, existing, prepared);
    }

    const usage = await this.accountUsage(userId);
    if (usage.count >= KNOWLEDGE_MAX_ACTIVE_DOCUMENTS) {
      throw knowledgeBadRequest(
        KNOWLEDGE_ERROR_CODES.tooManyDocuments,
        KNOWLEDGE_ERRORS.tooManyDocuments,
      );
    }
    if (usage.bytes + prepared.byteSize > KNOWLEDGE_MAX_ACCOUNT_BYTES) {
      throw knowledgeBadRequest(
        KNOWLEDGE_ERROR_CODES.accountTooLarge,
        KNOWLEDGE_ERRORS.accountTooLarge,
      );
    }

    const created = this.documents.create({
      userId,
      scopeId: prepared.scopeId,
      title: prepared.title,
      content: prepared.content,
      contentHash: prepared.contentHash,
      byteSize: prepared.byteSize,
    });
    try {
      const saved = await this.documents.save(created);
      return { document: saved, outcome: 'created' };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const winner = await this.documents.findOne({
        where: {
          userId,
          scopeId: prepared.scopeId,
          title: prepared.title,
        },
      });
      if (!winner) {
        throw error;
      }
      return this.replaceExisting(userId, winner, prepared);
    }
  }

  async deleteOwned(userId: string, id: string): Promise<void> {
    if (!isKnowledgeDocumentId(id)) {
      throw knowledgeNotFound();
    }
    const result = await this.documents.softDelete({ id, userId });
    if (!result.affected) {
      throw knowledgeNotFound();
    }
  }

  private async replaceExisting(
    userId: string,
    existing: KnowledgeDocument,
    prepared: PreparedKnowledgeDocument,
  ): Promise<KnowledgeWriteResult> {
    if (existing.contentHash === prepared.contentHash) {
      return { document: existing, outcome: 'unchanged' };
    }
    const usage = await this.accountUsage(userId);
    const projected = usage.bytes - existing.byteSize + prepared.byteSize;
    if (projected > KNOWLEDGE_MAX_ACCOUNT_BYTES) {
      throw knowledgeBadRequest(
        KNOWLEDGE_ERROR_CODES.accountTooLarge,
        KNOWLEDGE_ERRORS.accountTooLarge,
      );
    }
    existing.content = prepared.content;
    existing.contentHash = prepared.contentHash;
    existing.byteSize = prepared.byteSize;
    existing.updatedAt = new Date();
    const saved = await this.documents.save(existing);
    return { document: saved, outcome: 'updated' };
  }

  private async accountUsage(userId: string): Promise<{ count: number; bytes: number }> {
    const rows = await this.documents.find({ where: { userId } });
    let bytes = 0;
    for (const row of rows) {
      bytes += Number(row.byteSize) || 0;
    }
    return { count: rows.length, bytes };
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { code?: unknown; driverError?: { code?: unknown } };
  return candidate.code === '23505' || candidate.driverError?.code === '23505';
}
