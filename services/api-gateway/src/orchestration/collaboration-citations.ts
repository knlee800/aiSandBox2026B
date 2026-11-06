import { businessRoleProfileIds } from './collaboration-teams';

/**
 * Citations are derived when a Team hand-off is read. The stored answer is not rewritten.
 *
 * A marker is `[source: <documentId>]` or `[source: <documentId>#<heading>]`.
 * The tag is exact lowercase `[source:`. Spaces around the id and heading are ignored.
 * A heading is everything after the first `#`, so a later `#` stays in the heading.
 * Markers inside code fences count. An unclosed marker, a non-UUID id, or an empty
 * heading is invalid and dropped.
 */

const SOURCE_OPEN = '[source:';
const DOCUMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Business-role profile ids. An answer with no valid source is labelled for these. */
export const BUSINESS_ROLE_PROFILE_IDS: readonly string[] = Object.freeze([
  ...businessRoleProfileIds(),
]);

export interface CollaborationSourceMarker {
  documentId: string;
  heading: string | null;
}

export interface CollaborationSource {
  documentId: string;
  title: string;
  scopeId: string;
  heading: string | null;
}

export interface CitationDocument {
  id: string;
  userId: string;
  title: string;
  scopeId: string;
  deletedAt: Date | string | null;
}

export interface CollaborationCitationFields {
  sources: CollaborationSource[];
  droppedSourceCount: number;
  unsourced: boolean;
  showUnsourced: boolean;
}

export function parseCollaborationSourceMarkers(answer: string): {
  markers: CollaborationSourceMarker[];
  invalidCount: number;
} {
  const markers: CollaborationSourceMarker[] = [];
  let invalidCount = 0;
  let cursor = 0;
  while (cursor < answer.length) {
    const openAt = answer.indexOf(SOURCE_OPEN, cursor);
    if (openAt < 0) {
      break;
    }
    const innerStart = openAt + SOURCE_OPEN.length;
    const closeAt = closeOfMarker(answer, innerStart);
    if (closeAt < 0) {
      invalidCount += 1;
      cursor = innerStart;
      continue;
    }
    const parsed = parseMarkerBody(answer.slice(innerStart, closeAt));
    if (parsed) {
      markers.push(parsed);
    } else {
      invalidCount += 1;
    }
    cursor = closeAt + 1;
  }
  return { markers, invalidCount };
}

export function collaborationAnswerCitations(input: {
  completed: boolean;
  answer: string;
  targetProfileId: string;
  ownerId: string;
  documents: readonly CitationDocument[];
  businessRoleProfileIds?: readonly string[];
}): CollaborationCitationFields {
  if (!input.completed) {
    return {
      sources: [],
      droppedSourceCount: 0,
      unsourced: false,
      showUnsourced: false,
    };
  }

  const parsed = parseCollaborationSourceMarkers(input.answer);
  const activeOwned = new Map<string, CitationDocument>();
  for (const document of input.documents) {
    if (document.deletedAt) {
      continue;
    }
    if (document.userId !== input.ownerId) {
      continue;
    }
    if (!DOCUMENT_ID_PATTERN.test(document.id)) {
      continue;
    }
    activeOwned.set(document.id.toLowerCase(), document);
  }

  const sources: CollaborationSource[] = [];
  const seen = new Set<string>();
  let droppedSourceCount = parsed.invalidCount;
  for (const marker of parsed.markers) {
    const document = activeOwned.get(marker.documentId);
    if (!document) {
      droppedSourceCount += 1;
      continue;
    }
    const key = `${marker.documentId}\n${marker.heading ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sources.push({
      documentId: document.id,
      title: document.title,
      scopeId: document.scopeId,
      heading: marker.heading,
    });
  }

  const unsourced = sources.length === 0;
  const roles = input.businessRoleProfileIds ?? BUSINESS_ROLE_PROFILE_IDS;
  return {
    sources,
    droppedSourceCount,
    unsourced,
    showUnsourced: unsourced && roles.includes(input.targetProfileId),
  };
}

function closeOfMarker(answer: string, innerStart: number): number {
  for (let index = innerStart; index < answer.length; index += 1) {
    const char = answer[index];
    if (char === ']') {
      return index;
    }
    if (char === '\n' || char === '\r') {
      return -1;
    }
  }
  return -1;
}

function parseMarkerBody(body: string): CollaborationSourceMarker | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const hash = trimmed.indexOf('#');
  const idPart = (hash < 0 ? trimmed : trimmed.slice(0, hash)).trim();
  if (!DOCUMENT_ID_PATTERN.test(idPart)) {
    return null;
  }
  if (hash < 0) {
    return { documentId: idPart.toLowerCase(), heading: null };
  }
  const heading = trimmed.slice(hash + 1).trim();
  if (heading.length === 0) {
    return null;
  }
  return { documentId: idPart.toLowerCase(), heading };
}
