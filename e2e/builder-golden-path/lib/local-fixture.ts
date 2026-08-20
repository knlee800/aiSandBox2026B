import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { FROZEN_HTML, PREVIEW_HEADING, PREVIEW_PARAGRAPH } from './constants';

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
