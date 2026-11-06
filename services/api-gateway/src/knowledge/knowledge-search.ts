import {
  KNOWLEDGE_ERROR_CODES,
  KNOWLEDGE_ERRORS,
  knowledgeBadRequest,
} from './knowledge-content';

export const KNOWLEDGE_SEARCH_MAX_QUERY_LENGTH = 120;
export const KNOWLEDGE_SEARCH_MAX_HITS = 20;
export const KNOWLEDGE_SEARCH_MAX_PREVIEW_CHARS = 240;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const ATX_HEADING = /^(#{1,6})[ \t]+(.*)$/;

export interface KnowledgeSearchDocument {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly scopeId: string;
  readonly updatedAt: Date | string | number;
}

export interface KnowledgeSearchHit {
  readonly documentId: string;
  readonly title: string;
  readonly scopeId: string;
  readonly heading: string | null;
  readonly preview: string;
}

export interface KnowledgeSection {
  readonly heading: string | null;
  readonly content: string;
}

interface AtxHeading {
  readonly rank: number;
  readonly text: string;
}

export function normalizeKnowledgeSearchQuery(query: unknown): string {
  if (typeof query !== 'string') {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.queryRequired,
      KNOWLEDGE_ERRORS.queryRequired,
    );
  }
  if (CONTROL_CHARS.test(query)) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.queryUnsupported,
      KNOWLEDGE_ERRORS.queryUnsupported,
    );
  }
  const normalized = query.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.queryRequired,
      KNOWLEDGE_ERRORS.queryRequired,
    );
  }
  if (normalized.length > KNOWLEDGE_SEARCH_MAX_QUERY_LENGTH) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.queryTooLong,
      KNOWLEDGE_ERRORS.queryTooLong,
    );
  }
  return normalized;
}

function parseAtxHeading(line: string): AtxHeading | null {
  const match = ATX_HEADING.exec(line);
  if (!match) {
    return null;
  }
  const text = match[2].trim();
  if (text.length === 0) {
    return null;
  }
  return { rank: match[1].length, text };
}

function updatedAtMs(value: Date | string | number): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function previewFromLine(line: string): string {
  const normalized = line.replace(/\t/g, ' ').trim();
  if (normalized.length <= KNOWLEDGE_SEARCH_MAX_PREVIEW_CHARS) {
    return normalized;
  }
  return `${normalized.slice(0, KNOWLEDGE_SEARCH_MAX_PREVIEW_CHARS - 3)}...`;
}

function precedingHeading(lines: readonly string[], lineIndex: number): string | null {
  for (let index = lineIndex - 1; index >= 0; index -= 1) {
    const parsed = parseAtxHeading(lines[index]);
    if (parsed) {
      return parsed.text;
    }
  }
  return null;
}

/**
 * Case-insensitive substring search. `%` and `_` are literal.
 * One hit per document. Order is updatedAt DESC, then id ascending.
 */
export function searchKnowledgeDocuments(
  documents: readonly KnowledgeSearchDocument[],
  query: string,
): { results: KnowledgeSearchHit[]; truncated: boolean } {
  const needle = query.toLowerCase();
  const matches = documents.filter((document) => {
    if (document.title.toLowerCase().includes(needle)) {
      return true;
    }
    return document.content.toLowerCase().includes(needle);
  });
  matches.sort((left, right) => {
    const byTime = updatedAtMs(right.updatedAt) - updatedAtMs(left.updatedAt);
    if (byTime !== 0) {
      return byTime;
    }
    if (left.id < right.id) {
      return -1;
    }
    if (left.id > right.id) {
      return 1;
    }
    return 0;
  });
  const truncated = matches.length > KNOWLEDGE_SEARCH_MAX_HITS;
  const results = matches.slice(0, KNOWLEDGE_SEARCH_MAX_HITS).map((document) => {
    const lines = document.content.split('\n');
    let lineIndex = -1;
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].toLowerCase().includes(needle)) {
        lineIndex = index;
        break;
      }
    }
    if (lineIndex >= 0) {
      return {
        documentId: document.id,
        title: document.title,
        scopeId: document.scopeId,
        heading: precedingHeading(lines, lineIndex),
        preview: previewFromLine(lines[lineIndex]),
      };
    }
    return {
      documentId: document.id,
      title: document.title,
      scopeId: document.scopeId,
      heading: null,
      preview: previewFromLine(document.title),
    };
  });
  return { results, truncated };
}

function normalizeRequestedHeading(heading: string): string {
  const trimmed = heading.trim();
  const parsed = parseAtxHeading(trimmed);
  if (!parsed) {
    return trimmed;
  }
  return parsed.text;
}

/**
 * No heading returns the whole document. A heading match runs from that line
 * through the line before the next heading of equal or higher rank.
 * The first match wins. Missing headings return null.
 */
export function readKnowledgeSection(
  content: string,
  heading: string | null | undefined,
): KnowledgeSection | null {
  if (heading == null) {
    return { heading: null, content };
  }
  const requested = normalizeRequestedHeading(heading);
  if (requested.length === 0) {
    return { heading: null, content };
  }
  const lines = content.split('\n');
  const requestedKey = requested.toLowerCase();
  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseAtxHeading(lines[index]);
    if (!parsed || parsed.text.toLowerCase() !== requestedKey) {
      continue;
    }
    let end = lines.length;
    for (let next = index + 1; next < lines.length; next += 1) {
      const following = parseAtxHeading(lines[next]);
      if (following && following.rank <= parsed.rank) {
        end = next;
        break;
      }
    }
    return {
      heading: parsed.text,
      content: lines.slice(index, end).join('\n'),
    };
  }
  return null;
}
