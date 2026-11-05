import { BadRequestException } from '@nestjs/common';
import {
  KNOWLEDGE_ERROR_CODES,
  KNOWLEDGE_ERRORS,
  KNOWLEDGE_MAX_DOCUMENT_BYTES,
  decodeKnowledgeUpload,
  hashKnowledgeContent,
  isKnowledgeFilename,
  normalizeKnowledgeContent,
  prepareKnowledgeWrite,
} from './knowledge-content';

function expectBadRequest(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).getResponse()).toMatchObject({
    statusCode: 400,
    code,
    message,
  });
}

describe('knowledge content', () => {
  it('normalizes BOM, newlines and surrounding whitespace', () => {
    expect(normalizeKnowledgeContent('\uFEFFHello\r\nworld\r ')).toBe('Hello\nworld');
    expect(normalizeKnowledgeContent('  \n  ')).toBe('');
  });

  it('hashes the normalized UTF-8 text', () => {
    const content = 'Hello';
    expect(hashKnowledgeContent(content)).toHaveLength(64);
    expect(hashKnowledgeContent(content)).toBe(hashKnowledgeContent(content));
    expect(hashKnowledgeContent(content)).not.toBe(hashKnowledgeContent('Hello!'));
  });

  it('accepts .md and .txt names and rejects other types', () => {
    expect(isKnowledgeFilename('Notes.MD')).toBe(true);
    expect(isKnowledgeFilename(' notes.TXT ')).toBe(true);
    expect(isKnowledgeFilename('notes.pdf')).toBe(false);
    expect(isKnowledgeFilename('notes.txt.exe')).toBe(false);
    expect(isKnowledgeFilename('')).toBe(false);
  });

  it('rejects invalid UTF-8 and oversized uploads', () => {
    expect(decodeKnowledgeUpload(Buffer.from('hello', 'utf8'))).toBe('hello');
    try {
      decodeKnowledgeUpload(Buffer.from([0xff, 0xfe, 0xfd]));
      throw new Error('expected invalid UTF-8 to throw');
    } catch (error) {
      expectBadRequest(
        error,
        KNOWLEDGE_ERROR_CODES.contentNotUtf8,
        KNOWLEDGE_ERRORS.contentNotUtf8,
      );
    }
    try {
      decodeKnowledgeUpload(Buffer.alloc(KNOWLEDGE_MAX_DOCUMENT_BYTES + 1, 0x61));
      throw new Error('expected oversized upload to throw');
    } catch (error) {
      expectBadRequest(
        error,
        KNOWLEDGE_ERROR_CODES.documentTooLarge,
        KNOWLEDGE_ERRORS.documentTooLarge,
      );
    }
  });

  it('prepares a trimmed document and rejects empty or unknown input', () => {
    const prepared = prepareKnowledgeWrite({
      scopeId: ' policies ',
      title: ' Handbook ',
      content: ' Hello\r\n ',
    });
    expect(prepared).toMatchObject({
      scopeId: 'policies',
      title: 'Handbook',
      content: 'Hello',
      byteSize: Buffer.byteLength('Hello', 'utf8'),
    });
    expect(prepared.contentHash).toBe(hashKnowledgeContent('Hello'));

    const cases: Array<{ input: { scopeId: unknown; title: unknown; content: unknown }; code: string; message: string }> = [
      {
        input: { scopeId: 'legal-contracts', title: 'A', content: 'B' },
        code: KNOWLEDGE_ERROR_CODES.unknownScope,
        message: KNOWLEDGE_ERRORS.unknownScope,
      },
      {
        input: { scopeId: 'policies', title: '   ', content: 'B' },
        code: KNOWLEDGE_ERROR_CODES.titleRequired,
        message: KNOWLEDGE_ERRORS.titleRequired,
      },
      {
        input: { scopeId: 'policies', title: 'A'.repeat(201), content: 'B' },
        code: KNOWLEDGE_ERROR_CODES.titleTooLong,
        message: KNOWLEDGE_ERRORS.titleTooLong,
      },
      {
        input: { scopeId: 'policies', title: 'A', content: ' \r\n ' },
        code: KNOWLEDGE_ERROR_CODES.contentRequired,
        message: KNOWLEDGE_ERRORS.contentRequired,
      },
      {
        input: { scopeId: 'policies', title: 'A', content: 'a'.repeat(KNOWLEDGE_MAX_DOCUMENT_BYTES + 1) },
        code: KNOWLEDGE_ERROR_CODES.documentTooLarge,
        message: KNOWLEDGE_ERRORS.documentTooLarge,
      },
    ];
    for (const entry of cases) {
      try {
        prepareKnowledgeWrite(entry.input);
        throw new Error(`expected ${entry.code} to throw`);
      } catch (error) {
        expectBadRequest(error, entry.code, entry.message);
      }
    }
  });

  it('accepts a document of exactly 200 KB', () => {
    const content = 'a'.repeat(KNOWLEDGE_MAX_DOCUMENT_BYTES);
    const prepared = prepareKnowledgeWrite({
      scopeId: 'policies',
      title: 'Full',
      content,
    });
    expect(prepared.byteSize).toBe(KNOWLEDGE_MAX_DOCUMENT_BYTES);
  });
});
