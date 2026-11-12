export type WorkspacePreviewState = 'loading' | 'ready' | 'unavailable' | 'error';

export interface WorkspacePreviewStatusResponse {
  running?: boolean;
  /**
   * PREVIEW-PICKER-01: added by the gateway on the platform host. The preview
   * host's origin, or null when no preview host is configured.
   */
  previewOrigin?: string | null;
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
    '[Visual Edit Mode Contract]',
    'User is in Visual Edit Mode.',
    'Treat the selected preview element as the target of the requested change.',
    'Identify the source file responsible for rendering or styling the selected element before proposing edits.',
    'Propose focused file-actions only for files directly required to satisfy this request.',
    'Follow the existing file-action output contract exactly.',
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

/*
 * PREVIEW-PICKER-01: Select Element over postMessage.
 *
 * The preview runs on its own origin (the preview host), so the workspace
 * page cannot reach into the iframe. A bridge script, served by the gateway
 * on the preview host and loaded by a tag container-manager adds to static
 * HTML, talks to this page over postMessage:
 *
 * - bridge to parent: ready, picker-state {active}, element-selected {payload}
 * - parent to bridge: hello (on every iframe load), activate-picker,
 *   deactivate-picker
 *
 * Every message is { aisb: 'preview-bridge', v: 1, type, ... }. The page
 * accepts a message only when event.origin is the preview origin from the
 * status answer and event.source is the preview iframe's window, posts only
 * to the preview origin (never '*'), and drops anything it does not know,
 * silently. The generated app shares the bridge's origin and can forge a
 * message that passes those checks, so every field is validated and a
 * selection is accepted only while the picker is on; it is used as text.
 */

export const PREVIEW_BRIDGE_NAMESPACE = 'preview-bridge';
export const PREVIEW_BRIDGE_VERSION = 1;

/** Stage-start section 3.3. The bridge cuts to these; the page refuses more. */
export const PREVIEW_BRIDGE_LIMITS = Object.freeze({
  tagName: 64,
  selector: 1024,
  textContent: 203,
  classCount: 32,
  className: 128,
  id: 128,
  message: 8192,
});

/**
 * How long the page waits for the bridge's ready after an iframe load
 * before it hides the toggle and turns the picker off.
 */
export const PREVIEW_BRIDGE_READY_TIMEOUT_MS = 3000;

export type PreviewBridgeCommandType = 'hello' | 'activate-picker' | 'deactivate-picker';

export interface PreviewBridgeCommand {
  aisb: typeof PREVIEW_BRIDGE_NAMESPACE;
  v: typeof PREVIEW_BRIDGE_VERSION;
  type: PreviewBridgeCommandType;
}

export type PreviewBridgeMessage =
  | { type: 'ready' }
  | { type: 'picker-state'; active: boolean }
  | { type: 'element-selected'; payload: SelectedPreviewElement };

export function buildPreviewBridgeCommand(type: PreviewBridgeCommandType): PreviewBridgeCommand {
  return { aisb: PREVIEW_BRIDGE_NAMESPACE, v: PREVIEW_BRIDGE_VERSION, type };
}

const TAG_NAME_PATTERN = /^[a-z0-9-]{1,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function serializedLength(value: unknown): number | null {
  try {
    const text = JSON.stringify(value);
    return typeof text === 'string' ? text.length : null;
  } catch {
    return null;
  }
}

/** A selection payload within the limits, copied field by field, or null. */
export function parseSelectedPreviewElement(value: unknown): SelectedPreviewElement | null {
  if (!isRecord(value)) {
    return null;
  }
  const limits = PREVIEW_BRIDGE_LIMITS;
  const { tagName, selector, textContent, classList, boundingBox, id } = value;
  if (typeof tagName !== 'string' || !TAG_NAME_PATTERN.test(tagName)) {
    return null;
  }
  if (!isBoundedString(selector, limits.selector) || !isBoundedString(textContent, limits.textContent)) {
    return null;
  }
  if (!Array.isArray(classList) || classList.length > limits.classCount) {
    return null;
  }
  if (!classList.every((className) => isBoundedString(className, limits.className))) {
    return null;
  }
  if (!(id === null || id === undefined || isBoundedString(id, limits.id))) {
    return null;
  }
  if (!isRecord(boundingBox)) {
    return null;
  }
  const { x, y, width, height } = boundingBox;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) {
    return null;
  }
  return {
    tagName,
    selector,
    textContent,
    classList: [...(classList as string[])],
    boundingBox: { x, y, width, height },
    id: typeof id === 'string' ? id : null,
  };
}

/**
 * A bridge message from the preview, or null for anything that is not one:
 * the wrong envelope or version, an unknown type, a field outside the
 * limits, or a whole message longer than 8192 characters as JSON.
 */
export function parsePreviewBridgeMessage(data: unknown): PreviewBridgeMessage | null {
  if (!isRecord(data) || data.aisb !== PREVIEW_BRIDGE_NAMESPACE || data.v !== PREVIEW_BRIDGE_VERSION) {
    return null;
  }
  const length = serializedLength(data);
  if (length === null || length > PREVIEW_BRIDGE_LIMITS.message) {
    return null;
  }
  switch (data.type) {
    case 'ready':
      return { type: 'ready' };
    case 'picker-state':
      return typeof data.active === 'boolean' ? { type: 'picker-state', active: data.active } : null;
    case 'element-selected': {
      const payload = parseSelectedPreviewElement(data.payload);
      return payload ? { type: 'element-selected', payload } : null;
    }
    default:
      return null;
  }
}

/**
 * The preview origin the page may trust: an http(s) origin that parses back
 * to exactly itself and is not the page's own origin. Anything else is null,
 * and with null every bridge message is refused and the toggle is not shown.
 */
export function readPreviewOrigin(value: unknown, pageOrigin: string | null): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  if (url.origin !== value || value === pageOrigin) {
    return null;
  }
  return value;
}

/**
 * The previewOrigin field of a status answer: a string or null when the
 * gateway sent it, undefined when the answer has no such field (the page
 * then keeps the last value it saw).
 */
export function readStatusPreviewOrigin(status: unknown): string | null | undefined {
  if (!isRecord(status) || !Object.prototype.hasOwnProperty.call(status, 'previewOrigin')) {
    return undefined;
  }
  return typeof status.previewOrigin === 'string' ? status.previewOrigin : null;
}

export interface PreviewPickerState {
  /** The current preview document has loaded and been sent hello. */
  frameLoaded: boolean;
  /** The bridge of the current preview document has answered hello. */
  bridgeReady: boolean;
  /** Picker mode is on. */
  pickerActive: boolean;
}

export const INITIAL_PREVIEW_PICKER_STATE: PreviewPickerState = Object.freeze({
  frameLoaded: false,
  bridgeReady: false,
  pickerActive: false,
});

export type PreviewPickerAction =
  | { kind: 'frame-loaded' }
  | { kind: 'ready-timeout' }
  | { kind: 'toggle' }
  | { kind: 'reset' }
  | { kind: 'message'; message: PreviewBridgeMessage };

export interface PreviewPickerStep {
  state: PreviewPickerState;
  /** A command to post to the bridge, if any. */
  command: PreviewBridgeCommandType | null;
  /** A selection the page accepts, if any. */
  selection: SelectedPreviewElement | null;
  /** The current selection is cleared. */
  clearSelection: boolean;
}

/**
 * The picker's state machine (stage-start section 3.5), with no side
 * effects: the shell posts the command and applies the selection.
 */
export function stepPreviewPicker(state: PreviewPickerState, action: PreviewPickerAction): PreviewPickerStep {
  const step = (
    next: PreviewPickerState,
    command: PreviewBridgeCommandType | null = null,
    extra: Partial<Pick<PreviewPickerStep, 'selection' | 'clearSelection'>> = {},
  ): PreviewPickerStep => ({
    state: next,
    command,
    selection: extra.selection ?? null,
    clearSelection: extra.clearSelection ?? false,
  });

  switch (action.kind) {
    case 'frame-loaded':
      // A new document: not ready until its bridge answers hello. A picker
      // that was on comes back on with the new document's ready.
      return step({ frameLoaded: true, bridgeReady: false, pickerActive: state.pickerActive }, 'hello');
    case 'ready-timeout':
      return state.bridgeReady ? step(state) : step({ ...state, bridgeReady: false, pickerActive: false });
    case 'toggle':
      if (state.pickerActive) {
        return step({ ...state, pickerActive: false }, 'deactivate-picker');
      }
      if (!state.bridgeReady) {
        return step(state);
      }
      return step({ ...state, pickerActive: true }, 'activate-picker', { clearSelection: true });
    case 'reset':
      return step(
        { frameLoaded: false, bridgeReady: false, pickerActive: false },
        state.pickerActive ? 'deactivate-picker' : null,
        { clearSelection: true },
      );
    case 'message': {
      const message = action.message;
      if (message.type === 'ready') {
        // A ready sent before the iframe's load event is not counted: the
        // bridge repeats it in answer to the hello sent on load.
        if (!state.frameLoaded) {
          return step(state);
        }
        return step({ ...state, bridgeReady: true }, state.pickerActive ? 'activate-picker' : null);
      }
      if (message.type === 'picker-state') {
        if (message.active) {
          // The bridge never turns the picker on by itself: resync it.
          return step(state, state.pickerActive ? null : 'deactivate-picker');
        }
        return step({ ...state, pickerActive: false });
      }
      // element-selected: only while the picker is on; one pick turns it off.
      if (!state.pickerActive) {
        return step(state);
      }
      return step({ ...state, pickerActive: false }, null, { selection: message.payload });
    }
    default:
      return step(state);
  }
}

