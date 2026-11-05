export const KNOWLEDGE_MAX_DOCUMENT_BYTES = 200 * 1024;
export const KNOWLEDGE_MAX_ACTIVE_DOCUMENTS = 50;
export const KNOWLEDGE_MAX_ACCOUNT_BYTES = 4 * 1024 * 1024;
export const KNOWLEDGE_MAX_TITLE_LENGTH = 200;

export function formatKnowledgeKilobytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0';
  }
  const rounded = Math.round((bytes / 1024) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function fillKnowledgeTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([A-Za-z0-9]+)\}/g, (full: string, key: string) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key];
    }
    return full;
  });
}

export function isKnowledgeUploadName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.endsWith('.md') || normalized.endsWith('.txt');
}
