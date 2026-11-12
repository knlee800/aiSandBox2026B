import { Injectable, NotFoundException } from '@nestjs/common';
import { DockerRuntimeService } from '../docker/docker-runtime.service';
import { PreviewProxyService } from '../previews/preview-proxy.service';

export interface BrowserSmokeRequest {
  sessionId: string;
  url?: string;
  timeoutMs?: number;
}

export interface BrowserSmokeResult {
  success: boolean;
  url: string;
  pageTitle: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  networkErrors: string[];
  visibleTextSnippet: string;
  durationMs: number;
  error?: string;
  truncated: boolean;
}

const DEFAULT_BROWSER_SMOKE_TIMEOUT_MS = 120_000;
const MAX_CONSOLE_ENTRIES = 10;
const MAX_CONSOLE_ENTRY_CHARS = 500;
const MAX_NETWORK_ENTRY_CHARS = 300;
const MAX_VISIBLE_TEXT_CHARS = 2000;
const MAX_RESULT_JSON_BYTES = 32_768;

/**
 * BROWSER-SMOKE-02: a static HTML preview has nothing listening. Browser
 * smoke opens this origin instead and Playwright answers its requests from
 * the preview's app root. `.invalid` is reserved (RFC 2606) and never
 * resolves, so nothing outside the route can answer for it.
 */
export const STATIC_PREVIEW_ORIGIN = 'http://static-preview.invalid';

/**
 * BROWSER-SMOKE-02: the in-container path check for static mode, embedded
 * verbatim in SMOKE_SCRIPT and evaluated as-is by the unit tests.
 *
 * resolveStaticFile(pathLib, fs, root, pathname) decodes the URL pathname,
 * resolves it under root, and answers:
 * - { status: 400 } for a pathname that does not decode or holds a NUL;
 * - { status: 403 } for anything outside root, lexically or through a
 *   symlink (resolved === root or starts with root + sep);
 * - { status: 404 } for a missing file, or a directory with no index.html;
 * - { status: 200, filePath } otherwise (a directory serves its index.html).
 *
 * The script is piped through `echo` in sh, which may expand backslash
 * escapes, so this source (like the whole script) holds no backslash.
 */
export const STATIC_FILE_RESOLVER_SOURCE = `
function resolveStaticFile(pathLib, fs, root, pathname) {
  var decoded;
  try {
    decoded = decodeURIComponent(pathname || '/');
  } catch (e) {
    return { status: 400 };
  }
  if (decoded.indexOf(String.fromCharCode(0)) !== -1) return { status: 400 };
  var base = pathLib.resolve(root);
  var resolved = pathLib.resolve(base, '.' + pathLib.sep + decoded);
  if (resolved !== base && resolved.indexOf(base + pathLib.sep) !== 0) return { status: 403 };
  var stat;
  try {
    stat = fs.statSync(resolved);
  } catch (e) {
    return { status: 404 };
  }
  if (stat.isDirectory()) {
    resolved = pathLib.join(resolved, 'index.html');
    try {
      stat = fs.statSync(resolved);
    } catch (e) {
      return { status: 404 };
    }
  }
  if (!stat.isFile()) return { status: 404 };
  var realBase;
  var realFile;
  try {
    realBase = fs.realpathSync(base);
    realFile = fs.realpathSync(resolved);
  } catch (e) {
    return { status: 404 };
  }
  if (realFile !== realBase && realFile.indexOf(realBase + pathLib.sep) !== 0) return { status: 403 };
  return { status: 200, filePath: realFile };
}
`.trim();

const SMOKE_SCRIPT = `
const { chromium } = require('/opt/browser-smoke/node_modules/playwright');
const url = process.env.SMOKE_URL;
const timeoutMs = parseInt(process.env.SMOKE_TIMEOUT_MS || '30000', 10);
const staticRoot = process.env.SMOKE_STATIC_ROOT || '';
const STATIC_ORIGIN = '${STATIC_PREVIEW_ORIGIN}';
const STATIC_STATUS_TEXT = { 400: 'Bad request', 403: 'Forbidden', 404: 'Not found' };
${STATIC_FILE_RESOLVER_SOURCE}
(async () => {
  let browser;
  const startMs = Date.now();
  const consoleErrors = [];
  const consoleWarnings = [];
  const networkErrors = [];
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      else if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', err => { consoleErrors.push(String(err)); });
    page.on('requestfailed', req => {
      networkErrors.push(req.url() + ' ' + (req.failure()?.errorText || 'failed'));
    });
    if (staticRoot) {
      const pathLib = require('path').posix;
      const fs = require('fs');
      await page.route((u) => u.origin === STATIC_ORIGIN, async (route) => {
        try {
          const target = resolveStaticFile(pathLib, fs, staticRoot, new URL(route.request().url()).pathname);
          if (target.filePath) {
            await route.fulfill({ path: target.filePath });
          } else {
            await route.fulfill({ status: target.status, contentType: 'text/plain', body: STATIC_STATUS_TEXT[target.status] || 'Error' });
          }
        } catch (err) {
          await route.fulfill({ status: 500, contentType: 'text/plain', body: 'Error' }).catch(() => {});
        }
      });
    }
    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    const title = await page.title();
    const text = await page.evaluate(() => (document.body && document.body.innerText) ? document.body.innerText.slice(0, 2500) : '');
    const durationMs = Date.now() - startMs;
    console.log(JSON.stringify({ success: true, url, pageTitle: title, consoleErrors, consoleWarnings, networkErrors, visibleTextSnippet: text, durationMs }));
  } catch (err) {
    const durationMs = Date.now() - startMs;
    console.log(JSON.stringify({ success: false, url, pageTitle: '', consoleErrors, consoleWarnings, networkErrors, visibleTextSnippet: '', durationMs, error: String(err && err.message ? err.message : err) }));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
})();
`.trim();

@Injectable()
export class BrowserSmokeService {
  constructor(
    private readonly dockerRuntimeService: DockerRuntimeService,
    private readonly previewProxyService: PreviewProxyService,
  ) {}

  async run(request: BrowserSmokeRequest): Promise<BrowserSmokeResult> {
    const { sessionId } = request;
    const timeoutMs = request.timeoutMs ?? DEFAULT_BROWSER_SMOKE_TIMEOUT_MS;

    const relativeUrl = this.validateAndNormalizeUrl(request.url);

    // A registered port wins. BROWSER-SMOKE-02: with no port, a running
    // static HTML preview is served from its app root (static mode).
    let baseTarget: string;
    let staticRoot: string | null = null;
    try {
      baseTarget = await this.previewProxyService.getProxyTarget(sessionId);
    } catch (err) {
      if (err instanceof NotFoundException) {
        staticRoot = this.previewProxyService.getStaticRoot(sessionId);
      }
      if (!staticRoot) {
        return this.failureResult(
          relativeUrl,
          `Preview target not available: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      baseTarget = STATIC_PREVIEW_ORIGIN;
    }

    const fullUrl = baseTarget + relativeUrl;

    const env: Record<string, string> = {
      SMOKE_SCRIPT: SMOKE_SCRIPT,
      SMOKE_URL: fullUrl,
      SMOKE_TIMEOUT_MS: String(Math.max(1000, timeoutMs - 10_000)),
    };
    if (staticRoot) {
      env.SMOKE_STATIC_ROOT = staticRoot;
    }

    let execResult: { exitCode: number; stdout: string; stderr: string };
    try {
      execResult = await this.dockerRuntimeService.execInContainerBySessionId(
        sessionId,
        ['sh', '-c', 'echo "$SMOKE_SCRIPT" | node'],
        '/workspace',
        env,
        timeoutMs + 5_000,
      );
    } catch (err) {
      return this.failureResult(
        fullUrl,
        `Exec failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.parseExecOutput(execResult, fullUrl);
  }

  private validateAndNormalizeUrl(url?: string): string {
    if (!url || url.trim().length === 0) {
      return '/';
    }

    const trimmed = url.trim();

    if (trimmed.includes('://')) {
      throw new Error('Absolute URLs are not allowed; provide a relative path starting with /');
    }

    if (!trimmed.startsWith('/')) {
      throw new Error('URL must be a relative path starting with /');
    }

    return trimmed;
  }

  private parseExecOutput(
    execResult: { exitCode: number; stdout: string; stderr: string },
    fullUrl: string,
  ): BrowserSmokeResult {
    const stdout = execResult.stdout || '';

    const jsonStart = stdout.indexOf('{');
    if (jsonStart === -1) {
      return this.failureResult(
        fullUrl,
        execResult.exitCode !== 0
          ? `Script exited with code ${execResult.exitCode}: ${(execResult.stderr || '').slice(0, 500)}`
          : 'No JSON output from browser smoke script',
      );
    }

    const jsonStr = stdout.slice(jsonStart);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return this.failureResult(
        fullUrl,
        `Failed to parse script output: ${jsonStr.slice(0, 200)}`,
      );
    }

    return this.buildResult(parsed, fullUrl);
  }

  private buildResult(
    parsed: Record<string, unknown>,
    fallbackUrl: string,
  ): BrowserSmokeResult {
    let truncated = false;

    const consoleErrors = this.truncateStringArray(
      parsed.consoleErrors,
      MAX_CONSOLE_ENTRIES,
      MAX_CONSOLE_ENTRY_CHARS,
    );
    if (consoleErrors.wasTruncated) truncated = true;

    const consoleWarnings = this.truncateStringArray(
      parsed.consoleWarnings,
      MAX_CONSOLE_ENTRIES,
      MAX_CONSOLE_ENTRY_CHARS,
    );
    if (consoleWarnings.wasTruncated) truncated = true;

    const networkErrors = this.truncateStringArray(
      parsed.networkErrors,
      MAX_CONSOLE_ENTRIES,
      MAX_NETWORK_ENTRY_CHARS,
    );
    if (networkErrors.wasTruncated) truncated = true;

    let visibleTextSnippet = typeof parsed.visibleTextSnippet === 'string'
      ? parsed.visibleTextSnippet
      : '';
    if (visibleTextSnippet.length > MAX_VISIBLE_TEXT_CHARS) {
      visibleTextSnippet = visibleTextSnippet.slice(0, MAX_VISIBLE_TEXT_CHARS);
      truncated = true;
    }

    const result: BrowserSmokeResult = {
      success: parsed.success === true,
      url: typeof parsed.url === 'string' ? parsed.url : fallbackUrl,
      pageTitle: typeof parsed.pageTitle === 'string' ? parsed.pageTitle.slice(0, 500) : '',
      consoleErrors: consoleErrors.items,
      consoleWarnings: consoleWarnings.items,
      networkErrors: networkErrors.items,
      visibleTextSnippet,
      durationMs: typeof parsed.durationMs === 'number' ? parsed.durationMs : 0,
      truncated,
    };

    if (parsed.success !== true && typeof parsed.error === 'string') {
      result.error = parsed.error.slice(0, 1000);
    }

    const resultJson = JSON.stringify(result);
    if (Buffer.byteLength(resultJson, 'utf-8') > MAX_RESULT_JSON_BYTES) {
      result.visibleTextSnippet = result.visibleTextSnippet.slice(0, 500);
      result.consoleErrors = result.consoleErrors.slice(0, 5);
      result.consoleWarnings = result.consoleWarnings.slice(0, 5);
      result.networkErrors = result.networkErrors.slice(0, 5);
      result.truncated = true;
    }

    return result;
  }

  private truncateStringArray(
    raw: unknown,
    maxEntries: number,
    maxChars: number,
  ): { items: string[]; wasTruncated: boolean } {
    if (!Array.isArray(raw)) {
      return { items: [], wasTruncated: false };
    }

    let wasTruncated = false;
    const items: string[] = [];

    for (let i = 0; i < raw.length && items.length < maxEntries; i++) {
      const entry = typeof raw[i] === 'string' ? raw[i] : String(raw[i] ?? '');
      if (entry.length > maxChars) {
        items.push(entry.slice(0, maxChars));
        wasTruncated = true;
      } else {
        items.push(entry);
      }
    }

    if (raw.length > maxEntries) {
      wasTruncated = true;
    }

    return { items, wasTruncated };
  }

  private failureResult(url: string, error: string): BrowserSmokeResult {
    return {
      success: false,
      url,
      pageTitle: '',
      consoleErrors: [],
      consoleWarnings: [],
      networkErrors: [],
      visibleTextSnippet: '',
      durationMs: 0,
      error: error.slice(0, 1000),
      truncated: false,
    };
  }
}
