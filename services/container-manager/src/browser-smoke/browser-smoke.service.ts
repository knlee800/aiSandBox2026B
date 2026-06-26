import { Injectable } from '@nestjs/common';
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

const SMOKE_SCRIPT = `
const { chromium } = require('/opt/browser-smoke/node_modules/playwright');
const url = process.env.SMOKE_URL;
const timeoutMs = parseInt(process.env.SMOKE_TIMEOUT_MS || '30000', 10);
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

    let baseTarget: string;
    try {
      baseTarget = await this.previewProxyService.getProxyTarget(sessionId);
    } catch (err) {
      return this.failureResult(
        relativeUrl,
        `Preview target not available: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const fullUrl = baseTarget + relativeUrl;

    let execResult: { exitCode: number; stdout: string; stderr: string };
    try {
      execResult = await this.dockerRuntimeService.execInContainerBySessionId(
        sessionId,
        ['sh', '-c', 'echo "$SMOKE_SCRIPT" | node'],
        '/workspace',
        {
          SMOKE_SCRIPT: SMOKE_SCRIPT,
          SMOKE_URL: fullUrl,
          SMOKE_TIMEOUT_MS: String(Math.max(1000, timeoutMs - 10_000)),
        },
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
