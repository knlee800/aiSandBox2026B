export type WorkspacePreviewState = 'loading' | 'ready' | 'unavailable' | 'error';

export interface WorkspacePreviewStatusResponse {
  running?: boolean;
}

export interface SelectedPreviewElementBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectedPreviewElement {
  selector: string;
  textContent: string;
  classList: string[];
  boundingBox: SelectedPreviewElementBoundingBox;
  tagName: string;
  id?: string | null;
}

export type VisualEditElementSelectedMessage = {
  type: 'visual-edit:element-selected';
  payload: SelectedPreviewElement;
};

export type VisualEditPickerReadyMessage = {
  type: 'visual-edit:picker-ready';
};

export type VisualEditActivatePickerMessage = {
  type: 'visual-edit:activate-picker';
};

export type VisualEditDeactivatePickerMessage = {
  type: 'visual-edit:deactivate-picker';
};

export type VisualEditMessage =
  | VisualEditElementSelectedMessage
  | VisualEditPickerReadyMessage
  | VisualEditActivatePickerMessage
  | VisualEditDeactivatePickerMessage;

export interface CssSelectorSegment {
  tagName: string;
  id?: string | null;
  classList?: readonly string[];
  nthOfType?: number | null;
}

export interface VisualEditMessageValidationInput {
  expectedOrigin: string | null;
  messageOrigin: string;
  expectedSource: MessageEventSource | null;
  messageSource: MessageEventSource | null;
}

export function isPreviewRunning(status: WorkspacePreviewStatusResponse): boolean {
  return status.running === true;
}

export function buildPreviewProxyUrl(sessionId: string, refreshToken: number): string {
  return `/api/preview/${encodeURIComponent(sessionId)}/proxy?refresh=${refreshToken}`;
}

export function buildCssSelectorFromSegments(segments: readonly CssSelectorSegment[]): string {
  if (segments.length === 0) {
    return '';
  }

  return segments
    .map((segment) => {
      const normalizedTag = normalizeTagName(segment.tagName);
      const normalizedId = normalizeToken(segment.id ?? null);
      if (normalizedId) {
        return `${normalizedTag}#${escapeCssIdentifier(normalizedId)}`;
      }

      const classSelector = (segment.classList ?? [])
        .map((className) => normalizeToken(className))
        .filter((className): className is string => className.length > 0)
        .map((className) => `.${escapeCssIdentifier(className)}`)
        .join('');

      const nthOfType =
        typeof segment.nthOfType === 'number' && Number.isInteger(segment.nthOfType) && segment.nthOfType > 0
          ? `:nth-of-type(${segment.nthOfType})`
          : '';

      return `${normalizedTag}${classSelector}${nthOfType}`;
    })
    .join(' > ');
}

export function isValidVisualEditMessageOriginAndSource(
  input: VisualEditMessageValidationInput,
): boolean {
  if (!input.expectedOrigin || input.messageOrigin !== input.expectedOrigin) {
    return false;
  }

  if (!input.expectedSource || !input.messageSource) {
    return false;
  }

  return input.messageSource === input.expectedSource;
}

function normalizeTagName(tagName: string): string {
  const trimmed = tagName.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : '*';
}

function normalizeToken(value: string | null): string {
  if (!value) {
    return '';
  }

  return value.trim();
}

function escapeCssIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
