/**
 * PREVIEW-PICKER-01: the preview bridge script.
 *
 * The gateway serves it on the preview host only, at
 * GET /api/preview/<sid>/proxy/__aisb/bridge.js, behind the unchanged
 * PreviewAccessGuard. Container-manager adds one script tag for it to static
 * HTML. It runs in the preview's own origin and lets the workspace page (the
 * platform origin, its parent frame) drive the Select Element picker over
 * postMessage:
 *
 * - bridge to parent: ready, picker-state {active}, element-selected {payload}
 * - parent to bridge: hello, activate-picker, deactivate-picker
 *
 * Every message is { aisb: 'preview-bridge', v: 1, type, ... }.
 *
 * The script text is fixed except for one value: the platform origin, from
 * APP_BASE_URL, written in as a JSON string. It holds no cookie name, key or
 * token, makes no network request and reads no cookie or storage. It acts
 * only on messages whose origin is the platform origin and whose source is
 * its parent window, posts only to the platform origin (never '*'), and does
 * nothing when it is not framed. Anything else is dropped silently.
 */

export const PREVIEW_BRIDGE_NAMESPACE = 'preview-bridge';
export const PREVIEW_BRIDGE_VERSION = 1;

/** The limits of stage-start section 3.3; the bridge cuts to them. */
export const PREVIEW_BRIDGE_LIMITS = Object.freeze({
  tagName: 64,
  selector: 1024,
  /** Text is cut to 200 characters plus '...' (203 at most). */
  text: 200,
  classCount: 32,
  className: 128,
  id: 128,
  message: 8192,
});

/** True only for an http(s) origin that parses back to exactly itself. */
export function isUsableBridgeOrigin(origin: unknown): origin is string {
  if (typeof origin !== 'string' || origin.length === 0) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.origin === origin;
}

/**
 * The bridge source with the platform origin written in, or null when the
 * origin is not a usable http(s) origin (the route then answers 404).
 */
export function buildPreviewBridgeScript(platformOrigin: string): string | null {
  if (!isUsableBridgeOrigin(platformOrigin)) return null;
  const limits = PREVIEW_BRIDGE_LIMITS;
  return `(function () {
  'use strict';
  var PLATFORM_ORIGIN = ${JSON.stringify(platformOrigin)};
  var NAMESPACE = '${PREVIEW_BRIDGE_NAMESPACE}';
  var VERSION = ${PREVIEW_BRIDGE_VERSION};
  var MAX_TAG = ${limits.tagName};
  var MAX_SELECTOR = ${limits.selector};
  var MAX_TEXT = ${limits.text};
  var MAX_CLASSES = ${limits.classCount};
  var MAX_CLASS = ${limits.className};
  var MAX_ID = ${limits.id};
  var MAX_MESSAGE = ${limits.message};
  var MAX_DEPTH = 32;

  var win = window;
  var host;
  try {
    host = win.parent;
  } catch (error) {
    return;
  }
  // Not framed (opened in its own tab): do nothing at all.
  if (!host || host === win) return;
  if (win.__aisbPreviewBridge === true) return;
  win.__aisbPreviewBridge = true;

  var doc = win.document;
  var active = false;
  var overlay = null;
  var highlight = null;

  function post(message) {
    try {
      host.postMessage(message, PLATFORM_ORIGIN);
    } catch (error) {
      // Nothing to report: the parent treats silence as no bridge.
    }
  }

  function envelope(type) {
    return { aisb: NAMESPACE, v: VERSION, type: type };
  }

  function stateMessage(isActive) {
    var message = envelope('picker-state');
    message.active = isActive === true;
    return message;
  }

  function cut(value, max) {
    var text = typeof value === 'string' ? value : '';
    return text.length > max ? text.slice(0, max) : text;
  }

  function escapeIdent(value) {
    try {
      if (win.CSS && typeof win.CSS.escape === 'function') return String(win.CSS.escape(value));
    } catch (error) {
      // Fall back to the plain escape below.
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');
  }

  function tagOf(el) {
    var raw = typeof el.tagName === 'string' ? el.tagName.toLowerCase() : '';
    return cut(raw.replace(/[^a-z0-9-]/g, ''), MAX_TAG);
  }

  function idOf(el) {
    return typeof el.id === 'string' && el.id.length > 0 ? cut(el.id, MAX_ID) : null;
  }

  function classesOf(el) {
    var list = [];
    var source = el.classList;
    if (!source) return list;
    for (var i = 0; i < source.length && list.length < MAX_CLASSES; i += 1) {
      var name = source[i];
      if (typeof name === 'string' && name.length > 0) list.push(cut(name, MAX_CLASS));
    }
    return list;
  }

  function segmentOf(el) {
    var tag = tagOf(el) || '*';
    var id = idOf(el);
    if (id) return { text: tag + '#' + escapeIdent(id), stop: true };
    var text = tag;
    var classes = classesOf(el);
    for (var i = 0; i < classes.length; i += 1) text += '.' + escapeIdent(classes[i]);
    var parent = el.parentElement;
    if (parent && parent.children) {
      var count = 0;
      var index = 0;
      for (var j = 0; j < parent.children.length; j += 1) {
        var sibling = parent.children[j];
        if (sibling && sibling.tagName === el.tagName) {
          count += 1;
          if (sibling === el) index = count;
        }
      }
      if (count > 1 && index > 0) text += ':nth-of-type(' + index + ')';
    }
    return { text: text, stop: false };
  }

  function selectorOf(el) {
    var parts = [];
    var length = 0;
    var current = el;
    var depth = 0;
    while (current && current !== doc.body && current !== doc.documentElement && depth < MAX_DEPTH) {
      var segment = segmentOf(current);
      var extra = segment.text.length + (parts.length > 0 ? 3 : 0);
      if (parts.length > 0 && length + extra > MAX_SELECTOR) break;
      parts.unshift(segment.text);
      length += extra;
      if (segment.stop) break;
      current = current.parentElement;
      depth += 1;
    }
    return cut(parts.join(' > '), MAX_SELECTOR);
  }

  function textOf(el) {
    var raw = typeof el.textContent === 'string' ? el.textContent.trim() : '';
    return raw.length > MAX_TEXT ? raw.slice(0, MAX_TEXT) + '...' : raw;
  }

  function finite(value) {
    return typeof value === 'number' && isFinite(value) ? value : 0;
  }

  function boxOf(el) {
    var rect = null;
    try {
      rect = el.getBoundingClientRect();
    } catch (error) {
      rect = null;
    }
    return {
      x: finite(rect && rect.left),
      y: finite(rect && rect.top),
      width: finite(rect && rect.width),
      height: finite(rect && rect.height)
    };
  }

  function fits(message) {
    try {
      return JSON.stringify(message).length <= MAX_MESSAGE;
    } catch (error) {
      return false;
    }
  }

  function selectedMessage(el) {
    var tag = tagOf(el);
    if (!tag) return null;
    var message = envelope('element-selected');
    message.payload = {
      tagName: tag,
      selector: selectorOf(el),
      textContent: textOf(el),
      classList: classesOf(el),
      boundingBox: boxOf(el),
      id: idOf(el)
    };
    if (!fits(message)) message.payload.classList = [];
    if (!fits(message)) message.payload.textContent = '';
    if (!fits(message)) message.payload.selector = tag;
    if (!fits(message)) message.payload.id = null;
    return fits(message) ? message : null;
  }

  function isOurs(node) {
    return node === overlay || node === highlight;
  }

  function place(el) {
    if (!highlight) return;
    var rect;
    try {
      rect = el.getBoundingClientRect();
    } catch (error) {
      return;
    }
    highlight.style.left = rect.left + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.style.display = 'block';
  }

  function block(event) {
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  }

  function onMove(event) {
    var target = event.target;
    if (target && target.nodeType === 1 && !isOurs(target)) place(target);
  }

  function onClick(event) {
    block(event);
    var target = event.target;
    if (!target || target.nodeType !== 1 || isOurs(target)) return;
    var message = selectedMessage(target);
    stop();
    // Single shot: one pick turns the picker off.
    post(message || stateMessage(false));
  }

  function onKey(event) {
    if (event.key !== 'Escape' && event.key !== 'Esc') return;
    block(event);
    stop();
    post(stateMessage(false));
  }

  function start() {
    if (active) return;
    var root = doc && (doc.body || doc.documentElement);
    if (!root) return;
    overlay = doc.createElement('div');
    overlay.setAttribute('data-aisb-preview-picker', '');
    overlay.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;margin:0;padding:0;border:0;' +
      'background:transparent;pointer-events:none;z-index:2147483647;';
    highlight = doc.createElement('div');
    highlight.style.cssText =
      'position:absolute;display:none;box-sizing:border-box;border:2px solid #7c3aed;' +
      'border-radius:2px;background:rgba(124,58,237,0.08);pointer-events:none;';
    overlay.appendChild(highlight);
    root.appendChild(overlay);
    doc.addEventListener('mousemove', onMove, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('keydown', onKey, true);
    active = true;
  }

  function stop() {
    if (doc) {
      doc.removeEventListener('mousemove', onMove, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('keydown', onKey, true);
    }
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    highlight = null;
    active = false;
  }

  function onMessage(event) {
    if (!event || event.origin !== PLATFORM_ORIGIN || event.source !== host) return;
    var data = event.data;
    if (!data || typeof data !== 'object' || data.aisb !== NAMESPACE || data.v !== VERSION) return;
    if (data.type === 'hello') {
      post(envelope('ready'));
    } else if (data.type === 'activate-picker') {
      start();
      post(stateMessage(active));
    } else if (data.type === 'deactivate-picker') {
      stop();
      post(stateMessage(false));
    }
  }

  win.addEventListener('message', onMessage, false);
  post(envelope('ready'));
})();
`;
}
