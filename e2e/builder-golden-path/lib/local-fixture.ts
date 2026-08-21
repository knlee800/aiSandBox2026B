import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { FROZEN_ARTIFACT_PATH, FROZEN_HTML, PREVIEW_HEADING, PREVIEW_PARAGRAPH } from './constants';

export interface LocalFixtureServer {
  url: string;
  close(): Promise<void>;
}

const LOGIN_PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Login</title></head>
<body>
  <h1>Login</h1>
  <form>
    <label for="email">Email</label>
    <input id="email" type="email" />
    <label for="password">Password</label>
    <input id="password" type="password" />
    <button type="submit">Log in</button>
  </form>
  <script>
    document.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        window.location.href = '/en/app';
      }
    });
  </script>
</body>
</html>`;

const APP_PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Workspace</title></head>
<body>
  <h1>Workspace</h1>
  <button data-testid="workspace-chat-intent-build" type="button">Build</button>
  <textarea data-testid="workspace-chat-prompt-input"></textarea>
  <button data-testid="workspace-chat-submit" type="button">Send</button>
  <ul data-testid="workspace-file-tree"></ul>
  <button data-testid="workspace-preview-start" type="button">Start Preview</button>
  <iframe data-testid="workspace-preview-iframe" title="Session Preview"></iframe>
  <button id="fire-confirm" type="button">Fire confirm</button>
  <script>
    document.querySelector('[data-testid="workspace-preview-start"]').addEventListener('click', () => {
      document.querySelector('[data-testid="workspace-preview-iframe"]').src = '/preview';
    });
    document.getElementById('fire-confirm').addEventListener('click', async () => {
      await fetch('/api/ai/executions/exec-fixture/confirm-build-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applyStatus: 'applied', totalActions: 1, successCount: 1 }),
      });
    });
  </script>
</body>
</html>`;

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function html(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

export type SessionRaceMode =
  | 'auto-on-create'
  | 'session-before-project'
  | 'on-card-click'
  | 'never'
  | 'project-response-stalls'
  | 'project-body-stalls'
  | 'card-not-actionable'
  | 'auto-open-removes-card';

const AUTO_OPEN_SESSION_DELAY_MS = 150;
const AUTO_OPEN_CARD_LIFETIME_MS = 200;

export const SESSION_RACE_PROJECT_ID = 'project-race-1';
export const SESSION_RACE_SESSION_ID = 'session-race-1';

export interface SessionRaceFixtureServer extends LocalFixtureServer {
  sessionPostCount(): number;
}

function sessionRaceAppPage(mode: SessionRaceMode): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Session race fixture</title></head>
<body>
  <button data-testid="workspace-sidebar-nav-projects" type="button">Projects</button>
  <button data-testid="workspace-projects-new-project-button" type="button">New project</button>
  <input data-testid="workspace-projects-new-project-input" />
  <button data-testid="workspace-projects-create-confirm-button" type="button">Create</button>
  <div id="cards"></div>
  <textarea data-testid="workspace-chat-prompt-input" hidden></textarea>
  <script>
    const PROJECT_ID = ${JSON.stringify(SESSION_RACE_PROJECT_ID)};
    const MODE = ${JSON.stringify(mode)};
    window.__cardClicks = 0;
    function showPrompt() {
      document.querySelector('[data-testid="workspace-chat-prompt-input"]').hidden = false;
    }
    function removeCard() {
      const card = document.querySelector('[data-testid="workspace-project-card-' + PROJECT_ID + '"]');
      card?.remove();
    }
    function showCard() {
      if (document.querySelector('[data-testid="workspace-project-card-' + PROJECT_ID + '"]')) {
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-testid', 'workspace-project-card-' + PROJECT_ID);
      button.textContent = 'Open project';
      if (MODE === 'card-not-actionable') {
        button.disabled = true;
      }
      button.addEventListener('click', async () => {
        window.__cardClicks += 1;
        if (MODE === 'never' || MODE === 'card-not-actionable') {
          return;
        }
        const sessionRes = await fetch('/api/sessions', { method: 'POST' });
        await sessionRes.json();
        showPrompt();
      });
      document.getElementById('cards').appendChild(button);
    }
    document.querySelector('[data-testid="workspace-projects-create-confirm-button"]')
      .addEventListener('click', async () => {
        if (MODE === 'session-before-project') {
          const sessionRes = await fetch('/api/sessions', { method: 'POST' });
          await sessionRes.json();
          await new Promise((resolve) => setTimeout(resolve, 80));
          const projectRes = await fetch('/api/projects', { method: 'POST' });
          await projectRes.json();
          showPrompt();
          return;
        }
        const projectRes = await fetch('/api/projects', { method: 'POST' });
        await projectRes.json();
        if (MODE === 'auto-on-create') {
          const sessionRes = await fetch('/api/sessions', { method: 'POST' });
          await sessionRes.json();
          showPrompt();
          showCard();
          return;
        }
        if (MODE === 'auto-open-removes-card') {
          const sessionRes = await fetch('/api/sessions', { method: 'POST' });
          await sessionRes.json();
          showCard();
          showPrompt();
          setTimeout(removeCard, ${AUTO_OPEN_CARD_LIFETIME_MS});
          return;
        }
        showCard();
      });
  </script>
</body>
</html>`;
}

export function createSessionRaceFixtureServer(
  mode: SessionRaceMode,
): Promise<SessionRaceFixtureServer> {
  let sessionPosts = 0;
  const appPage = sessionRaceAppPage(mode);
  const sockets = new Set<Socket>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/en/app') {
      html(res, 200, appPage);
      return;
    }
    if (req.method === 'POST' && /\/api\/projects\/?$/.test(url.pathname)) {
      if (mode === 'project-response-stalls') {
        // Accepted server-side, but the page never observes a response.
        return;
      }
      if (mode === 'project-body-stalls') {
        // Headers arrive, so Playwright reports an ok response, but the body never completes.
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.write('{');
        return;
      }
      json(res, 201, { id: SESSION_RACE_PROJECT_ID });
      return;
    }
    if (req.method === 'POST' && /\/api\/sessions\/?$/.test(url.pathname)) {
      sessionPosts += 1;
      if (mode === 'auto-open-removes-card') {
        const timer = setTimeout(() => {
          timers.delete(timer);
          json(res, 201, { id: SESSION_RACE_SESSION_ID });
        }, AUTO_OPEN_SESSION_DELAY_MS);
        timers.add(timer);
        return;
      }
      json(res, 201, { id: SESSION_RACE_SESSION_ID });
      return;
    }
    json(res, 404, { error: 'not found' });
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        sessionPostCount: () => sessionPosts,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            for (const timer of timers) {
              clearTimeout(timer);
            }
            timers.clear();
            server.close((error) => {
              if (error) {
                closeReject(error);
              } else {
                closeResolve();
              }
            });
            // Stalled requests hold their sockets open, which would otherwise
            // block server.close() from ever completing.
            for (const socket of sockets) {
              socket.destroy();
            }
            sockets.clear();
          }),
      });
    });
    server.on('error', reject);
  });
}

export type AutoApplyFixtureMode =
  | 'auto-apply-on-preview-tab'
  | 'no-write'
  | 'awaiting-confirmation'
  | 'wrong-path'
  | 'wrong-session'
  | 'failed-write'
  | 'malformed-body'
  | 'real-execute-202'
  | 'execute-missing'
  | 'execute-status-500'
  | 'execute-malformed-json'
  | 'execute-missing-id'
  | 'execute-empty-id'
  | 'execute-body-stalls';

export const AUTO_APPLY_PROJECT_ID = 'project-auto-apply-1';
export const AUTO_APPLY_SESSION_ID = 'session-auto-apply-1';
export const AUTO_APPLY_OTHER_SESSION_ID = 'session-auto-apply-other';
export const AUTO_APPLY_WRONG_PATH = 'other.html';
export const AUTO_APPLY_EXECUTION_ID = 'exec-auto-apply-1';
export const REAL_EXECUTE_EXECUTION_ID = 'exec-real-flow';

export interface AutoApplyFixtureServer extends LocalFixtureServer {
  fileWriteCount(): number;
  writtenPaths(): string[];
  sessionPostCount(): number;
  executePostCount(): number;
  executionsCollectionPostCount(): number;
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function autoApplyAppPage(mode: AutoApplyFixtureMode): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Auto-apply fixture</title></head>
<body>
  <button data-testid="workspace-sidebar-nav-projects" type="button">Projects</button>
  <button data-testid="workspace-projects-new-project-button" type="button">New project</button>
  <input data-testid="workspace-projects-new-project-input" />
  <button data-testid="workspace-projects-create-confirm-button" type="button">Create</button>
  <div id="cards"></div>
  <button data-testid="workspace-chat-intent-build" type="button">Build</button>
  <textarea data-testid="workspace-chat-prompt-input" hidden></textarea>
  <button data-testid="workspace-chat-submit" type="button">Send</button>
  <aside data-testid="workspace-chat-aside">
    <div id="chat-results"></div>
  </aside>
  <div data-testid="workspace-tab-bar">
    <button data-testid="workspace-tab-preview" type="button" data-active="true">Preview</button>
    <button data-testid="workspace-tab-codeFiles" type="button" data-active="false">Code &amp; Files</button>
  </div>
  <div id="tab-panels"></div>
  <script>
    const PROJECT_ID = ${JSON.stringify(AUTO_APPLY_PROJECT_ID)};
    const SESSION_ID = ${JSON.stringify(AUTO_APPLY_SESSION_ID)};
    const OTHER_SESSION_ID = ${JSON.stringify(AUTO_APPLY_OTHER_SESSION_ID)};
    const ARTIFACT_PATH = ${JSON.stringify(FROZEN_ARTIFACT_PATH)};
    const WRONG_PATH = ${JSON.stringify(AUTO_APPLY_WRONG_PATH)};
    const FROZEN_HTML = ${JSON.stringify(FROZEN_HTML)};
    const MODE = ${JSON.stringify(mode)};
    const workspaceFiles = {};
    let activeTabId = 'preview';
    window.__sendClicks = 0;
    const skipExecute = MODE === 'execute-missing';

    function showPrompt() {
      document.querySelector('[data-testid="workspace-chat-prompt-input"]').hidden = false;
    }

    function renderPanels() {
      const previewActive = activeTabId === 'preview';
      document.querySelector('[data-testid="workspace-tab-preview"]').setAttribute('data-active', previewActive ? 'true' : 'false');
      document.querySelector('[data-testid="workspace-tab-codeFiles"]').setAttribute('data-active', previewActive ? 'false' : 'true');
      const panels = document.getElementById('tab-panels');
      if (previewActive) {
        panels.innerHTML = '<div data-testid="preview-panel-shell"><button data-testid="workspace-preview-start" type="button">Start Preview</button><iframe data-testid="workspace-preview-iframe" title="Session Preview"></iframe></div>';
        document.querySelector('[data-testid="workspace-preview-start"]').addEventListener('click', () => {
          document.querySelector('[data-testid="workspace-preview-iframe"]').src = '/preview';
        });
        return;
      }
      const nodes = Object.keys(workspaceFiles).map((path) =>
        '<li data-testid="workspace-file-node-' + path + '">' + path + '</li>'
      ).join('');
      panels.innerHTML = '<div data-testid="editor-panel-shell"><ul data-testid="workspace-file-tree">' + nodes + '</ul></div>';
    }

    function setActiveTab(tabId) {
      activeTabId = tabId;
      renderPanels();
    }

    function showChatApplied(path) {
      document.getElementById('chat-results').innerHTML =
        '<div data-testid="workspace-chat-file-actions"><ul data-testid="workspace-chat-file-actions-list"><li>create ' + path + '</li></ul></div>';
    }

    function showAwaitingConfirmation() {
      document.getElementById('chat-results').innerHTML =
        '<div data-testid="workspace-chat-file-actions-awaiting-confirmation">Awaiting confirmation</div>';
    }

    document.querySelector('[data-testid="workspace-tab-preview"]').addEventListener('click', () => setActiveTab('preview'));
    document.querySelector('[data-testid="workspace-tab-codeFiles"]').addEventListener('click', () => setActiveTab('codeFiles'));
    document.querySelector('[data-testid="workspace-projects-create-confirm-button"]').addEventListener('click', async () => {
      const projectRes = await fetch('/api/projects', { method: 'POST' });
      await projectRes.json();
      const sessionRes = await fetch('/api/sessions', { method: 'POST' });
      await sessionRes.json();
      showPrompt();
    });
    document.querySelector('[data-testid="workspace-chat-submit"]').addEventListener('click', async () => {
      window.__sendClicks += 1;
      const writeSessionId = MODE === 'wrong-session' ? OTHER_SESSION_ID : SESSION_ID;
      const writePath = MODE === 'wrong-path' ? WRONG_PATH : ARTIFACT_PATH;
      if (!skipExecute) {
        await fetch('/api/ai/execute', { method: 'POST' });
      }
      if (MODE !== 'no-write' && MODE !== 'execute-missing') {
        const body = MODE === 'malformed-body'
          ? '{not-json'
          : JSON.stringify({ path: writePath, content: FROZEN_HTML });
        const writeRes = await fetch('/api/sessions/' + writeSessionId + '/files/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (writeRes.ok && MODE !== 'malformed-body') {
          workspaceFiles[writePath] = true;
          if (MODE === 'awaiting-confirmation') {
            showAwaitingConfirmation();
          } else {
            showChatApplied(writePath);
          }
        }
      }
      renderPanels();
    });
    renderPanels();
  </script>
</body>
</html>`;
}

export function createAutoApplyFixtureServer(
  mode: AutoApplyFixtureMode = 'auto-apply-on-preview-tab',
): Promise<AutoApplyFixtureServer> {
  const appPage = autoApplyAppPage(mode);
  const sockets = new Set<Socket>();
  const writtenPaths: string[] = [];
  let fileWrites = 0;
  let sessionPosts = 0;
  let executePosts = 0;
  let executionsCollectionPosts = 0;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && (url.pathname === '/en/login' || url.pathname === '/login')) {
      html(res, 200, LOGIN_PAGE);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      res.setHeader('Set-Cookie', [
        'aisandbox_session=fixture-session; Path=/; HttpOnly',
        'aisandbox_csrf=fixture-csrf; Path=/',
      ]);
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/en/app') {
      html(res, 200, appPage);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/preview') {
      html(res, 200, FROZEN_HTML);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/en/billing') {
      html(res, 200, '<!doctype html><title>Billing</title><h1>Billing</h1>');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/billing/balance') {
      json(res, 200, { balance: 30577, monthlyAllocation: 0 });
      return;
    }
    if (req.method === 'POST' && /\/api\/projects\/?$/.test(url.pathname)) {
      json(res, 201, { id: AUTO_APPLY_PROJECT_ID });
      return;
    }
    if (req.method === 'POST' && /\/api\/sessions\/?$/.test(url.pathname)) {
      sessionPosts += 1;
      json(res, 201, { id: AUTO_APPLY_SESSION_ID });
      return;
    }
    if (req.method === 'POST' && /\/api\/ai\/execute\/?$/.test(url.pathname)) {
      executePosts += 1;
      if (mode === 'execute-body-stalls') {
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.write('{');
        return;
      }
      if (mode === 'execute-status-500') {
        json(res, 500, { error: 'execute failed' });
        return;
      }
      if (mode === 'execute-malformed-json') {
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end('{not-json');
        return;
      }
      if (mode === 'execute-missing-id') {
        json(res, 202, { status: 'queued' });
        return;
      }
      if (mode === 'execute-empty-id') {
        json(res, 202, { executionId: '', status: 'queued' });
        return;
      }
      if (mode === 'real-execute-202') {
        json(res, 202, { executionId: REAL_EXECUTE_EXECUTION_ID, status: 'queued' });
        return;
      }
      json(res, 202, { executionId: AUTO_APPLY_EXECUTION_ID, status: 'queued' });
      return;
    }
    if (req.method === 'POST' && /\/api\/ai\/executions\/?$/.test(url.pathname)) {
      executionsCollectionPosts += 1;
      json(res, 404, { error: 'no collection POST' });
      return;
    }
    if (
      req.method === 'POST' &&
      /\/api\/ai\/executions\/[^/]+\/confirm-build-apply\/?$/.test(url.pathname)
    ) {
      json(res, 200, { triggered: true, reason: 'completed', executionId: AUTO_APPLY_EXECUTION_ID });
      return;
    }
    if (req.method === 'POST' && /\/api\/sessions\/[^/]+\/files\/write\/?$/.test(url.pathname)) {
      void readRequestBody(req).then((raw) => {
        fileWrites += 1;
        try {
          const parsed = JSON.parse(raw) as { path?: unknown };
          if (typeof parsed.path === 'string' && parsed.path.length > 0) {
            writtenPaths.push(parsed.path);
          }
        } catch {
          // Malformed bodies are still counted as write attempts.
        }
        if (mode === 'failed-write') {
          json(res, 500, { error: 'write failed' });
          return;
        }
        res.writeHead(204);
        res.end();
      });
      return;
    }
    json(res, 404, { error: 'not found' });
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        fileWriteCount: () => fileWrites,
        writtenPaths: () => [...writtenPaths],
        sessionPostCount: () => sessionPosts,
        executePostCount: () => executePosts,
        executionsCollectionPostCount: () => executionsCollectionPosts,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
              } else {
                closeResolve();
              }
            });
            for (const socket of sockets) {
              socket.destroy();
            }
            sockets.clear();
          }),
      });
    });
    server.on('error', reject);
  });
}

export function createLocalFixtureServer(): Promise<LocalFixtureServer> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && (url.pathname === '/en/login' || url.pathname === '/login')) {
      html(res, 200, LOGIN_PAGE);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      res.setHeader('Set-Cookie', [
        'aisandbox_session=fixture-session; Path=/; HttpOnly',
        'aisandbox_csrf=fixture-csrf; Path=/',
      ]);
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/en/app') {
      html(res, 200, APP_PAGE);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/preview') {
      html(res, 200, FROZEN_HTML);
      return;
    }
    if (
      req.method === 'POST' &&
      /\/api\/ai\/executions\/[^/]+\/confirm-build-apply$/.test(url.pathname)
    ) {
      json(res, 200, { triggered: true, reason: 'completed', executionId: 'exec-fixture' });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/billing/balance') {
      json(res, 200, { balance: 30577, monthlyAllocation: 0 });
      return;
    }
    json(res, 404, { error: 'not found' });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
              } else {
                closeResolve();
              }
            });
          }),
      });
    });
    server.on('error', reject);
  });
}

export { PREVIEW_HEADING, PREVIEW_PARAGRAPH };
