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

export function buildPromptWithSelectedPreviewElement(
  prompt: string,
  selectedPreviewElement: SelectedPreviewElement | null,
): string {
  if (!selectedPreviewElement) {
    return prompt;
  }

  const bounds = selectedPreviewElement.boundingBox;
  return [
    '[Selected preview element]',
    `Tag: ${selectedPreviewElement.tagName}`,
    `Selector: ${selectedPreviewElement.selector}`,
    `Text: ${formatSelectedPreviewElementTextContent(selectedPreviewElement.textContent)}`,
    `Classes: ${formatSelectedPreviewElementClasses(selectedPreviewElement.classList)}`,
    `Bounds: x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height}`,
    '',
    'User request:',
    prompt,
  ].join('\n');
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

function formatSelectedPreviewElementTextContent(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : '(empty)';
}

function formatSelectedPreviewElementClasses(classList: readonly string[]): string {
  const normalized = classList
    .map((className) => className.trim())
    .filter((className) => className.length > 0);
  return normalized.length > 0 ? normalized.join(' ') : '(none)';
}

export function isVisualEditElementSelectedMessage(
  data: unknown,
): data is VisualEditElementSelectedMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const record = data as Record<string, unknown>;
  if (record.type !== 'visual-edit:element-selected') {
    return false;
  }

  const payload = record.payload;
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const p = payload as Record<string, unknown>;
  return (
    typeof p.tagName === 'string' &&
    typeof p.selector === 'string' &&
    typeof p.textContent === 'string' &&
    Array.isArray(p.classList) &&
    typeof p.boundingBox === 'object' &&
    p.boundingBox !== null
  );
}

const PICKER_SCRIPT_ID = '__visual_edit_picker_script__';
const PICKER_OVERLAY_ID = '__visual_edit_picker_overlay__';
const MAX_TEXT_CONTENT_LENGTH = 200;

export function getPickerScriptId(): string {
  return PICKER_SCRIPT_ID;
}

export function getPickerOverlayId(): string {
  return PICKER_OVERLAY_ID;
}

export function getMaxTextContentLength(): number {
  return MAX_TEXT_CONTENT_LENGTH;
}

export function generatePickerScriptSource(): string {
  return `(function() {
  'use strict';

  var SCRIPT_ID = '${PICKER_SCRIPT_ID}';
  var OVERLAY_ID = '${PICKER_OVERLAY_ID}';
  var MAX_TEXT = ${MAX_TEXT_CONTENT_LENGTH};

  if (document.getElementById(SCRIPT_ID + '-active')) return;
  var marker = document.createElement('meta');
  marker.id = SCRIPT_ID + '-active';
  document.head.appendChild(marker);

  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(overlay);

  var highlight = document.createElement('div');
  highlight.style.cssText = 'position:absolute;border:2px solid #7c3aed;background:rgba(124,58,237,0.08);pointer-events:none;transition:all 0.05s ease;display:none;';
  overlay.appendChild(highlight);

  function showHighlight(el) {
    var rect = el.getBoundingClientRect();
    highlight.style.left = rect.left + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.style.display = 'block';
  }

  function hideHighlight() {
    highlight.style.display = 'none';
  }

  function truncate(str, max) {
    if (!str) return '';
    var trimmed = str.trim();
    return trimmed.length > max ? trimmed.slice(0, max) + '...' : trimmed;
  }

  function buildSelector(el) {
    var parts = [];
    var current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      var tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(tag + '#' + current.id);
        break;
      }
      var classes = Array.prototype.slice.call(current.classList || []);
      var siblingsOfType = current.parentElement
        ? Array.prototype.slice.call(current.parentElement.children).filter(function(c) { return c.tagName === current.tagName; })
        : [];
      var nth = siblingsOfType.length > 1 ? ':nth-of-type(' + (siblingsOfType.indexOf(current) + 1) + ')' : '';
      parts.unshift(tag + (classes.length > 0 ? '.' + classes.join('.') : '') + nth);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  function handleMouseMove(e) {
    if (e.target && e.target !== overlay && e.target !== highlight) {
      showHighlight(e.target);
    }
  }

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var el = e.target;
    if (!el || el === overlay || el === highlight) return;

    var rect = el.getBoundingClientRect();
    var payload = {
      tagName: el.tagName.toLowerCase(),
      selector: buildSelector(el),
      textContent: truncate(el.textContent, MAX_TEXT),
      classList: Array.prototype.slice.call(el.classList || []),
      boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      id: el.id || null
    };

    window.parent.postMessage({ type: 'visual-edit:element-selected', payload: payload }, '*');
    cleanup();
  }

  function cleanup() {
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    hideHighlight();
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    var m = document.getElementById(SCRIPT_ID + '-active');
    if (m && m.parentNode) m.parentNode.removeChild(m);
  }

  function handleParentMessage(e) {
    if (e.data && e.data.type === 'visual-edit:deactivate-picker') {
      cleanup();
      window.removeEventListener('message', handleParentMessage);
    }
  }

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  window.addEventListener('message', handleParentMessage);
})();`;
}
