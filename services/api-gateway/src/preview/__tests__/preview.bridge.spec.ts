import * as vm from 'vm';
import {
  buildPreviewBridgeScript,
  isUsableBridgeOrigin,
  PREVIEW_BRIDGE_LIMITS,
  PREVIEW_BRIDGE_NAMESPACE,
  PREVIEW_BRIDGE_VERSION,
} from '../preview-bridge-script';
import {
  isPreviewBridgeSuffix,
  isReservedPreviewSuffix,
  PREVIEW_BRIDGE_SUFFIX,
  readPlatformOrigin,
} from '../preview-host';

/**
 * PREVIEW-PICKER-01 (stage-start 4.4, "Gateway bridge"): the bridge script
 * is built with the platform origin and nothing else, and run here in
 * node:vm against stub window and document objects.
 */

const PLATFORM_ORIGIN = 'https://staging.ainow.biz';
const PREVIEW_ORIGIN = 'https://preview.staging.ainow.biz';

type Listener = (event: any) => void;
type Posted = { message: any; target: unknown };

type StubElement = {
  nodeType: number;
  tagName: string;
  id: string;
  classList: string[];
  textContent: string;
  parentElement: StubElement | null;
  parentNode: StubElement | null;
  children: StubElement[];
  style: Record<string, string>;
  attributes: Record<string, string>;
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
  setAttribute: (name: string, value: string) => void;
  appendChild: (child: StubElement) => StubElement;
  removeChild: (child: StubElement) => StubElement;
};

function makeElement(tagName: string, init: Partial<StubElement> = {}): StubElement {
  const element: StubElement = {
    nodeType: 1,
    tagName,
    id: '',
    classList: [],
    textContent: '',
    parentElement: null,
    parentNode: null,
    children: [],
    style: {},
    attributes: {},
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 30, height: 40 }),
    setAttribute(name, value) {
      element.attributes[name] = value;
    },
    appendChild(child) {
      element.children.push(child);
      child.parentElement = element;
      child.parentNode = element;
      return child;
    },
    removeChild(child) {
      element.children = element.children.filter((item) => item !== child);
      child.parentElement = null;
      child.parentNode = null;
      return child;
    },
    ...init,
  };
  return element;
}

function runBridge(options: { framed?: boolean; origin?: string } = {}) {
  const script = buildPreviewBridgeScript(options.origin ?? PLATFORM_ORIGIN);
  if (!script) throw new Error('no script');

  const posted: Posted[] = [];
  const parentWindow = {
    postMessage(message: unknown, target: unknown) {
      posted.push({ message: JSON.parse(JSON.stringify(message)), target });
    },
  };
  const otherWindow = { postMessage() {} };
  const windowListeners: Record<string, Listener[]> = {};
  const documentListeners: Record<string, Listener[]> = {};
  const html = makeElement('HTML');
  const body = makeElement('BODY');
  html.appendChild(body);

  const document = {
    body,
    documentElement: html,
    createElement: (tag: string) => makeElement(tag.toUpperCase()),
    addEventListener(type: string, listener: Listener, capture?: boolean) {
      expect(capture).toBe(true);
      (documentListeners[type] ??= []).push(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      documentListeners[type] = (documentListeners[type] ?? []).filter((item) => item !== listener);
    },
  };
  const win: Record<string, unknown> = {
    document,
    addEventListener(type: string, listener: Listener) {
      (windowListeners[type] ??= []).push(listener);
    },
  };
  win.parent = options.framed === false ? win : parentWindow;

  vm.runInNewContext(script, { window: win });

  const send = (data: unknown, from: { origin?: string; source?: unknown } = {}) => {
    for (const listener of windowListeners.message ?? []) {
      listener({ origin: from.origin ?? PLATFORM_ORIGIN, source: 'source' in from ? from.source : parentWindow, data });
    }
  };
  const command = (type: string) => ({ aisb: PREVIEW_BRIDGE_NAMESPACE, v: PREVIEW_BRIDGE_VERSION, type });
  const fire = (type: string, event: Record<string, unknown>) => {
    const calls = { prevented: 0, stopped: 0 };
    const full = {
      preventDefault: () => (calls.prevented += 1),
      stopPropagation: () => (calls.stopped += 1),
      stopImmediatePropagation: () => undefined,
      ...event,
    };
    for (const listener of [...(documentListeners[type] ?? [])]) listener(full);
    return calls;
  };
  const overlayCount = () =>
    body.children.filter((child) => 'data-aisb-preview-picker' in child.attributes).length;
  const pickerListening = () =>
    ['mousemove', 'click', 'keydown'].some((type) => (documentListeners[type] ?? []).length > 0);

  return {
    posted,
    parentWindow,
    otherWindow,
    windowListeners,
    body,
    html,
    win,
    send,
    command,
    fire,
    overlayCount,
    pickerListening,
  };
}

describe('preview bridge script source (PREVIEW-PICKER-01)', () => {
  it('writes the platform origin in as a JSON string, and nothing else changes with it', () => {
    const one = buildPreviewBridgeScript(PLATFORM_ORIGIN)!;
    const two = buildPreviewBridgeScript('http://localhost:3000')!;
    expect(one).toContain(`var PLATFORM_ORIGIN = ${JSON.stringify(PLATFORM_ORIGIN)};`);
    expect(one.split(PLATFORM_ORIGIN)).toHaveLength(2);
    expect(one.replace(JSON.stringify(PLATFORM_ORIGIN), '"X"')).toBe(
      two.replace(JSON.stringify('http://localhost:3000'), '"X"'),
    );
  });

  it('holds no secret, cookie access, storage access or network call, and posts only to the platform origin', () => {
    const source = buildPreviewBridgeScript(PLATFORM_ORIGIN)!;
    for (const forbidden of [
      'aisandbox_',
      '__Host-',
      'cookie',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'fetch(',
      'XMLHttpRequest',
      'WebSocket',
      'sendBeacon',
      'X-Internal-Service-Key',
      'eval(',
      'Function(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).toContain('host.postMessage(message, PLATFORM_ORIGIN)');
    expect(source.match(/postMessage\(/g)).toHaveLength(1);
  });

  it.each([
    [''],
    ['not a url'],
    ['ftp://staging.ainow.biz'],
    ['javascript:alert(1)'],
    ['https://staging.ainow.biz/'],
    ['https://staging.ainow.biz/app'],
    ['https://user:pw@staging.ainow.biz'],
    ['https://STAGING.ainow.biz'],
    ['https://staging.ainow.biz:443'],
  ])('refuses %p as the platform origin', (origin) => {
    expect(isUsableBridgeOrigin(origin)).toBe(false);
    expect(buildPreviewBridgeScript(origin)).toBeNull();
  });

  it('accepts http and https origins with a port', () => {
    expect(buildPreviewBridgeScript('http://localhost:3000')).toContain('"http://localhost:3000"');
    expect(buildPreviewBridgeScript('https://staging.ainow.biz:8443')).toContain('"https://staging.ainow.biz:8443"');
  });

  it('keeps the limits of stage-start section 3.3', () => {
    expect(PREVIEW_BRIDGE_LIMITS).toEqual({
      tagName: 64,
      selector: 1024,
      text: 200,
      classCount: 32,
      className: 128,
      id: 128,
      message: 8192,
    });
  });
});

describe('preview bridge script at run time (PREVIEW-PICKER-01)', () => {
  it('does nothing when it is not framed', () => {
    const bridge = runBridge({ framed: false });
    expect(bridge.posted).toHaveLength(0);
    expect(bridge.windowListeners.message ?? []).toHaveLength(0);
    expect(bridge.win.__aisbPreviewBridge).toBeUndefined();
  });

  it('says ready once on load, to the platform origin only', () => {
    const bridge = runBridge();
    expect(bridge.posted).toEqual([
      { message: { aisb: 'preview-bridge', v: 1, type: 'ready' }, target: PLATFORM_ORIGIN },
    ]);
  });

  it('answers hello from the platform parent with ready', () => {
    const bridge = runBridge();
    bridge.posted.length = 0;
    bridge.send(bridge.command('hello'));
    expect(bridge.posted).toEqual([
      { message: { aisb: 'preview-bridge', v: 1, type: 'ready' }, target: PLATFORM_ORIGIN },
    ]);
  });

  it.each([
    ['another origin', { origin: 'https://evil.example' }],
    ['the preview origin itself (the app posting to its own window)', { origin: PREVIEW_ORIGIN }],
    ['the opaque origin', { origin: 'null' }],
    ['another source window', { source: 'other' }],
    ['no source', { source: null }],
  ])('ignores commands from %s', (_label, from) => {
    const bridge = runBridge();
    bridge.posted.length = 0;
    const source = (from as { source?: unknown }).source === 'other' ? bridge.otherWindow : (from as { source?: unknown }).source;
    const sender = 'source' in from ? { ...from, source } : from;
    bridge.send(bridge.command('hello'), sender);
    bridge.send(bridge.command('activate-picker'), sender);
    expect(bridge.posted).toHaveLength(0);
    expect(bridge.overlayCount()).toBe(0);
    expect(bridge.pickerListening()).toBe(false);
  });

  it.each([
    ['no envelope', { type: 'activate-picker' }],
    ['the wrong namespace', { aisb: 'other', v: 1, type: 'activate-picker' }],
    ['version 2', { aisb: 'preview-bridge', v: 2, type: 'activate-picker' }],
    ['version "1"', { aisb: 'preview-bridge', v: '1', type: 'activate-picker' }],
    ['an unknown type', { aisb: 'preview-bridge', v: 1, type: 'run-script' }],
    ['a string', 'activate-picker'],
    ['null', null],
  ])('ignores %s silently', (_label, data) => {
    const bridge = runBridge();
    bridge.posted.length = 0;
    bridge.send(data);
    expect(bridge.posted).toHaveLength(0);
    expect(bridge.overlayCount()).toBe(0);
  });

  it('turns picker mode on and off for the platform parent', () => {
    const bridge = runBridge();
    bridge.posted.length = 0;

    bridge.send(bridge.command('activate-picker'));
    expect(bridge.overlayCount()).toBe(1);
    expect(bridge.pickerListening()).toBe(true);
    expect(bridge.posted.at(-1)).toEqual({
      message: { aisb: 'preview-bridge', v: 1, type: 'picker-state', active: true },
      target: PLATFORM_ORIGIN,
    });

    // A second activate does not add a second overlay.
    bridge.send(bridge.command('activate-picker'));
    expect(bridge.overlayCount()).toBe(1);

    bridge.send(bridge.command('deactivate-picker'));
    expect(bridge.overlayCount()).toBe(0);
    expect(bridge.pickerListening()).toBe(false);
    expect(bridge.posted.at(-1)).toEqual({
      message: { aisb: 'preview-bridge', v: 1, type: 'picker-state', active: false },
      target: PLATFORM_ORIGIN,
    });
  });

  it('a click selects one element, is not passed to the app, and turns the picker off', () => {
    const bridge = runBridge();
    const target = makeElement('BUTTON', {
      id: '',
      classList: ['cta', 'big'],
      textContent: '  Buy now  ',
    });
    bridge.body.appendChild(target);
    bridge.send(bridge.command('activate-picker'));
    bridge.posted.length = 0;

    bridge.fire('mousemove', { target });
    const calls = bridge.fire('click', { target });

    expect(calls.prevented).toBe(1);
    expect(calls.stopped).toBe(1);
    expect(bridge.overlayCount()).toBe(0);
    expect(bridge.pickerListening()).toBe(false);
    expect(bridge.posted).toEqual([
      {
        message: {
          aisb: 'preview-bridge',
          v: 1,
          type: 'element-selected',
          payload: {
            tagName: 'button',
            selector: 'button.cta.big',
            textContent: 'Buy now',
            classList: ['cta', 'big'],
            boundingBox: { x: 10, y: 20, width: 30, height: 40 },
            id: null,
          },
        },
        target: PLATFORM_ORIGIN,
      },
    ]);
  });

  it('escapes ids and classes in the selector and stops at the first id', () => {
    const bridge = runBridge();
    const section = makeElement('SECTION', { id: 'main"]{x}' });
    const first = makeElement('P');
    const second = makeElement('P', { classList: ['a:b', 'c d'] });
    bridge.body.appendChild(section);
    section.appendChild(first);
    section.appendChild(second);
    bridge.send(bridge.command('activate-picker'));
    bridge.posted.length = 0;

    bridge.fire('click', { target: second });

    const payload = bridge.posted[0].message.payload;
    expect(payload.selector).toBe('section#main\\"\\]\\{x\\} > p.a\\:b.c\\ d:nth-of-type(2)');
  });

  it('cuts the payload to the limits and keeps the whole message within 8192 characters', () => {
    const bridge = runBridge();
    const target = makeElement('MY-VERY-LONG-ELEMENT-NAME-' + 'X'.repeat(100), {
      id: 'i'.repeat(500),
      classList: Array.from({ length: 40 }, (_, index) => `c${index}-${'k'.repeat(300)}`),
      textContent: 't'.repeat(5000),
    });
    bridge.body.appendChild(target);
    bridge.send(bridge.command('activate-picker'));
    bridge.posted.length = 0;

    bridge.fire('click', { target });

    expect(bridge.posted).toHaveLength(1);
    const { message, target: postedTo } = bridge.posted[0];
    expect(postedTo).toBe(PLATFORM_ORIGIN);
    expect(message.type).toBe('element-selected');
    const payload = message.payload;
    expect(payload.tagName.length).toBeLessThanOrEqual(64);
    expect(payload.tagName).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(payload.selector.length).toBeLessThanOrEqual(1024);
    expect(payload.textContent.length).toBeLessThanOrEqual(203);
    expect(payload.classList.length).toBeLessThanOrEqual(32);
    for (const name of payload.classList) expect(name.length).toBeLessThanOrEqual(128);
    expect(payload.id === null || payload.id.length <= 128).toBe(true);
    expect(JSON.stringify(message).length).toBeLessThanOrEqual(8192);
  });

  it('cuts text to 200 characters plus "..."', () => {
    const bridge = runBridge();
    const target = makeElement('P', { textContent: 'a'.repeat(250) });
    bridge.body.appendChild(target);
    bridge.send(bridge.command('activate-picker'));
    bridge.posted.length = 0;

    bridge.fire('click', { target });

    expect(bridge.posted[0].message.payload.textContent).toBe(`${'a'.repeat(200)}...`);
  });

  it('Escape in the preview turns the picker off and tells the parent', () => {
    const bridge = runBridge();
    bridge.send(bridge.command('activate-picker'));
    bridge.posted.length = 0;

    bridge.fire('keydown', { key: 'Enter' });
    expect(bridge.overlayCount()).toBe(1);

    bridge.fire('keydown', { key: 'Escape' });
    expect(bridge.overlayCount()).toBe(0);
    expect(bridge.pickerListening()).toBe(false);
    expect(bridge.posted).toEqual([
      {
        message: { aisb: 'preview-bridge', v: 1, type: 'picker-state', active: false },
        target: PLATFORM_ORIGIN,
      },
    ]);
  });

  it('runs once per document even if the tag appears twice', () => {
    const bridge = runBridge();
    const script = buildPreviewBridgeScript(PLATFORM_ORIGIN)!;
    vm.runInNewContext(script, { window: bridge.win });
    expect(bridge.windowListeners.message).toHaveLength(1);
    expect(bridge.posted).toHaveLength(1);
  });

  it('posts to the platform origin only, never to "*"', () => {
    const bridge = runBridge();
    const target = makeElement('DIV');
    bridge.body.appendChild(target);
    bridge.send(bridge.command('hello'));
    bridge.send(bridge.command('activate-picker'));
    bridge.fire('click', { target });
    bridge.send(bridge.command('activate-picker'));
    bridge.fire('keydown', { key: 'Escape' });
    bridge.send(bridge.command('deactivate-picker'));
    expect(bridge.posted.length).toBeGreaterThan(4);
    for (const entry of bridge.posted) expect(entry.target).toBe(PLATFORM_ORIGIN);
  });
});

describe('reserved preview paths and the platform origin (PREVIEW-PICKER-01)', () => {
  it.each([
    ['proxy/__aisb/bridge.js', true],
    ['proxy/__aisb/other.js', true],
    ['proxy/__aisb', true],
    ['proxy/__aisb/', true],
    ['proxy/%5F%5Faisb/bridge.js', true],
    ['proxy/__AISB/bridge.js', true],
    ['proxy', false],
    ['proxy/', false],
    ['proxy/index.html', false],
    ['proxy/assets/__aisb/bridge.js', false],
    ['proxy/__aisbx/bridge.js', false],
    ['status', false],
  ])('%s reserved: %s', (suffix, reserved) => {
    expect(isReservedPreviewSuffix(suffix)).toBe(reserved);
  });

  it('serves only the exact raw bridge path', () => {
    expect(PREVIEW_BRIDGE_SUFFIX).toBe('proxy/__aisb/bridge.js');
    expect(isPreviewBridgeSuffix('proxy/__aisb/bridge.js')).toBe(true);
    for (const other of ['proxy/__aisb/bridge.js/', 'proxy/%5F%5Faisb/bridge.js', 'proxy/__AISB/bridge.js', 'proxy/__aisb/Bridge.js']) {
      expect(isPreviewBridgeSuffix(other)).toBe(false);
    }
  });

  it('reads the platform origin from APP_BASE_URL', () => {
    expect(readPlatformOrigin({ APP_BASE_URL: 'https://staging.ainow.biz' })).toBe('https://staging.ainow.biz');
    expect(readPlatformOrigin({ APP_BASE_URL: 'https://staging.ainow.biz/app/' })).toBe('https://staging.ainow.biz');
    expect(readPlatformOrigin({ APP_BASE_URL: 'http://localhost:3000' })).toBe('http://localhost:3000');
    for (const value of [undefined, '', '  ', 'ftp://x', 'nonsense', 'https://u:p@staging.ainow.biz']) {
      expect(readPlatformOrigin({ APP_BASE_URL: value })).toBeNull();
    }
  });
});
