import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';
import { DockerRuntimeService } from '../docker/docker-runtime.service';
import { PreviewStrategyResolver } from './preview-strategy.resolver';
// BROWSER-SMOKE-01: the port registry that browser smoke reads (through
// PreviewProxyService). Same class name as this service, hence the alias.
import { PreviewService as PreviewPortRegistry } from '../previews/preview.service';
import axios from 'axios';

interface PreviewProcess {
  pid?: number;
  port: number;
  status: 'starting' | 'running' | 'error';
  command: string;
  framework?: string;
  appRoot?: string;
  startedAt: Date;
}

// CM-CONTENT-TYPE-01: standard types for preview fonts, images and modules.
const STANDARD_CONTENT_TYPES: Record<string, string> = {
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.wasm': 'application/wasm',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  // CM-CONTENT-TYPE-02: documents, audio, video, manifest and CSV.
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.csv': 'text/csv; charset=utf-8',
};

@Injectable()
export class PreviewService implements OnModuleInit {
  private activePreviews: Map<string, PreviewProcess> = new Map();
  private portPool: Set<number> = new Set();
  private readonly PORT_RANGE_START = 3001;
  private readonly PORT_RANGE_END = 3100;
  private readonly NPM_INSTALL_TIMEOUT_MS = 120000;
  private readonly VITE_WAIT_TIMEOUT_MS = 20000;
  private readonly VITE_WAIT_POLL_MS = 500;
  private readonly VITE_LAUNCH_COMMAND = 'npm run dev -- --host 0.0.0.0 --port $PORT';

  constructor(
    private sessionsService: SessionsService,
    private dockerRuntimeService: DockerRuntimeService,
    private previewStrategyResolver: PreviewStrategyResolver,
    private previewPortRegistry: PreviewPortRegistry,
  ) {
    // Initialize port pool
    for (let port = this.PORT_RANGE_START; port <= this.PORT_RANGE_END; port++) {
      this.portPool.add(port);
    }
  }

  /**
   * BROWSER-SMOKE-02: drop a session's preview when the session ends.
   * SessionsService cannot inject this service (PreviewModule imports
   * SessionsModule), so this service subscribes to its session-ended hook.
   */
  onModuleInit(): void {
    this.sessionsService.onSessionEnded((sessionId) => this.handleSessionEnded(sessionId));
  }

  /**
   * BROWSER-SMOKE-02: a session ended or its container was removed. Drop its
   * preview entry, return the port to the pool and clear its browser-smoke
   * target. Nothing is run in the container, which is gone or going. A
   * session with no preview is left alone.
   */
  handleSessionEnded(sessionId: string): void {
    const preview = this.activePreviews.get(sessionId);
    if (!preview) {
      return;
    }

    this.activePreviews.delete(sessionId);
    this.releasePort(preview.port);
    this.previewPortRegistry.unregisterPreviewPort(sessionId);
  }

  /**
   * Start a preview server for a session
   */
  async startPreview(sessionId: string, command?: string): Promise<{ port: number; status: string; framework?: string }> {
    this.sessionsService.assertSessionUsable(sessionId);

    // Check if preview already running
    if (this.activePreviews.has(sessionId)) {
      const existing = this.activePreviews.get(sessionId)!;
      return {
        port: existing.port,
        status: existing.status,
        framework: existing.framework,
      };
    }

    const strategy = await this.previewStrategyResolver.resolve(sessionId, command);

    if (strategy.type === 'unknown') {
      if (strategy.framework === 'Static HTML (missing-index)') {
        throw new BadRequestException(
          'Static HTML preview requires /workspace/index.html at the workspace root.',
        );
      }
      throw new BadRequestException(
        strategy.diagnosticMessage || 'No package.json or start command found. Cannot start preview.',
      );
    }

    // Allocate a port
    const port = this.allocatePort();
    if (!port) {
      throw new BadRequestException('No available ports for preview. Maximum concurrent previews reached.');
    }

    const detectedCommand = strategy.command!;
    const framework = strategy.framework;

    console.log(`Starting preview for session ${sessionId} on port ${port} with command: ${detectedCommand}`);

    // Replace PORT placeholder with actual port number
    const finalCommand = detectedCommand.replace(/\$PORT/g, port.toString());

    console.log(`Final command: ${finalCommand}`);

    if (strategy.type === 'static-html') {
      const staticPreview: PreviewProcess = {
        port,
        status: 'running',
        command: detectedCommand,
        framework,
        appRoot: strategy.appRoot,
        startedAt: new Date(),
      };
      this.activePreviews.set(sessionId, staticPreview);
      await this.registerStaticSmokeTarget(sessionId, staticPreview);

      return {
        port,
        status: 'running',
        framework,
      };
    }

    const isViteDev =
      strategy.type === 'node-dev-server' &&
      framework === 'Vite' &&
      detectedCommand === 'npm run dev';

    if (!isViteDev) {
      this.releasePort(port);
      if (framework === 'Vite') {
        throw new BadRequestException('Vite preview requires an npm dev script.');
      }
      throw new BadRequestException(
        `Framework preview currently supports Vite. This workspace looks like ${framework || 'a Node app'}.`,
      );
    }

    const viteFinalCommand = this.VITE_LAUNCH_COMMAND.replace(/\$PORT/g, port.toString());
    console.log(`Vite launch command: ${viteFinalCommand}`);

    try {
      const nodeModules = await this.runShellInSession(
        sessionId,
        '[ -d /workspace/node_modules ]',
      );
      if (nodeModules.exitCode !== 0) {
        const installResult = await this.runShellInSession(
          sessionId,
          'npm install --no-audit --no-fund',
          undefined,
          this.NPM_INSTALL_TIMEOUT_MS,
        );
        if (installResult.exitCode !== 0) {
          throw new BadRequestException('Preview could not install npm dependencies.');
        }
      }
    } catch (error) {
      this.releasePort(port);
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (this.isExecTimeout(error)) {
        throw new BadRequestException('Preview npm install timed out.');
      }
      throw new BadRequestException('Preview could not install npm dependencies.');
    }

    const launchResult = await this.runShellInSession(
      sessionId,
      `(${viteFinalCommand}) >/tmp/preview-${port}.log 2>&1 & echo $!`,
      {
        PORT: port.toString(),
        NODE_ENV: 'development',
      },
      30000,
    );
    if (launchResult.exitCode !== 0) {
      this.releasePort(port);
      throw new BadRequestException(
        `Failed to start preview command (exit ${launchResult.exitCode}). ${launchResult.stderr || launchResult.stdout || 'No output'}`,
      );
    }

    const pid = this.parsePidFromOutput(launchResult.stdout);

    this.activePreviews.set(sessionId, {
      pid,
      port,
      status: 'starting',
      command: viteFinalCommand,
      framework,
      startedAt: new Date(),
    });

    const didStart = await this.waitForPreviewServer(
      sessionId,
      port,
      this.VITE_WAIT_TIMEOUT_MS,
    );

    const previewAfterWait = this.activePreviews.get(sessionId);
    if (!previewAfterWait) {
      throw new BadRequestException('Preview was stopped before it became ready.');
    }

    if (!didStart) {
      try {
        if (pid && Number.isInteger(pid) && pid > 0) {
          await this.killPreviewPid(sessionId, pid, port);
        }
      } finally {
        this.releasePort(port);
        this.activePreviews.delete(sessionId);
        this.previewPortRegistry.unregisterPreviewPort(sessionId);
      }
      throw new BadRequestException('Preview server did not become reachable in time.');
    }

    previewAfterWait.status = 'running';
    await this.registerBrowserSmokeTarget(sessionId, previewAfterWait);

    return {
      port,
      status: previewAfterWait.status,
      framework: previewAfterWait.framework,
    };
  }

  /**
   * Stop a preview server
   */
  async stopPreview(sessionId: string): Promise<{ message: string }> {
    this.sessionsService.assertSessionUsable(sessionId);
    const preview = this.activePreviews.get(sessionId);

    if (!preview) {
      return { message: 'No active preview for this session' };
    }

    try {
      if (preview.framework !== 'Static HTML') {
        await this.killPreviewPid(sessionId, preview.pid, preview.port);
      }
    } catch (error) {
      console.error(`Error stopping preview for session ${sessionId}:`, error);
    }

    this.releasePort(preview.port);
    this.activePreviews.delete(sessionId);
    this.previewPortRegistry.unregisterPreviewPort(sessionId);

    return { message: 'Preview stopped successfully' };
  }

  /**
   * Get preview status
   */
  getPreviewStatus(sessionId: string): { port: number; status: string; framework?: string; uptime?: number } | null {
    const preview = this.activePreviews.get(sessionId);

    if (!preview) {
      return null;
    }

    const uptime = Math.floor((Date.now() - preview.startedAt.getTime()) / 1000);

    return {
      port: preview.port,
      status: preview.status,
      framework: preview.framework,
      uptime,
    };
  }

  async getProxyTargetUrl(sessionId: string): Promise<string> {
    const preview = this.activePreviews.get(sessionId);
    if (!preview) {
      throw new NotFoundException('No active preview for this session');
    }

    const container = await this.dockerRuntimeService.findContainerBySessionId(sessionId);
    const inspect = await container.inspect();
    if (!inspect.State.Running) {
      throw new BadRequestException(`Container for session ${sessionId} is not running`);
    }

    const networks = inspect.NetworkSettings?.Networks || {};
    const networkNames = Object.keys(networks);
    if (networkNames.length === 0) {
      throw new BadRequestException(`Container for session ${sessionId} has no network configuration`);
    }

    const ipAddress = networks[networkNames[0]]?.IPAddress;
    if (!ipAddress) {
      throw new BadRequestException(`Container for session ${sessionId} has no IP address`);
    }

    return `http://${ipAddress}:${preview.port}`;
  }

  /**
   * CM-BINARY-01: static files are read as their exact bytes, so images,
   * fonts and other binary assets reach the browser uncorrupted. Only HTML is
   * decoded (UTF-8, as before), gets the preview base tag, and is re-encoded
   * as UTF-8; every other type is the raw Buffer.
   */
  async readStaticPreviewContent(
    sessionId: string,
    requestPath: string,
  ): Promise<{ content: Buffer; contentType: string }> {
    const preview = this.activePreviews.get(sessionId);
    const sanitizedPath = this.sanitizeStaticPath(requestPath);

    let containerRelativePath = sanitizedPath;
    if (preview?.appRoot && preview.appRoot !== '/workspace') {
      const subdir = preview.appRoot.replace(/^\/workspace\//, '');
      containerRelativePath = `${subdir}/${sanitizedPath}`;
    }

    const bytes = await this.dockerRuntimeService.readFileBufferFromContainer(
      sessionId,
      containerRelativePath,
    );
    const contentType = this.resolveContentType(sanitizedPath);

    return {
      content: contentType.startsWith('text/html')
        ? Buffer.from(this.injectPreviewBaseTag(bytes.toString('utf8'), sessionId), 'utf8')
        : bytes,
      contentType,
    };
  }

  /**
   * BROWSER-SMOKE-01: record a running preview server's port in the registry
   * browser smoke reads, so it can open http://<container ip>:<port>. Only
   * previews with a server listening in the container are registered; a
   * static HTML preview is read straight from the workspace and has nothing
   * listening on its port. A failed registration is logged and does not fail
   * the preview, which works without it.
   */
  private async registerBrowserSmokeTarget(
    sessionId: string,
    preview: PreviewProcess,
  ): Promise<void> {
    try {
      await this.previewPortRegistry.registerPreviewPort(sessionId, preview.port);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Browser smoke target not registered for session ${sessionId} on port ${preview.port}: ${message}`,
      );
      return;
    }

    // A stop during the registration must not leave the old port behind.
    const current = this.activePreviews.get(sessionId);
    if (
      current !== preview &&
      this.previewPortRegistry.getRegisteredPort(sessionId) === preview.port &&
      !(current && current.status === 'running' && current.port === preview.port)
    ) {
      this.previewPortRegistry.unregisterPreviewPort(sessionId);
    }
  }

  /**
   * BROWSER-SMOKE-02: record a running static HTML preview's app root in the
   * registry browser smoke reads, so it can serve the preview's files from
   * the container workspace (nothing listens on a static preview's port).
   * A failed registration is logged and does not fail the preview.
   */
  private async registerStaticSmokeTarget(
    sessionId: string,
    preview: PreviewProcess,
  ): Promise<void> {
    const appRoot = preview.appRoot || '/workspace';
    let registeredRoot: string;
    try {
      registeredRoot = (await this.previewPortRegistry.registerStaticPreview(sessionId, appRoot))
        .appRoot;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Browser smoke static target not registered for session ${sessionId} at ${appRoot}: ${message}`,
      );
      return;
    }

    // A stop during the registration must not leave the old root behind.
    // Only the static root is cleared: a port registered meanwhile belongs
    // to another preview.
    const current = this.activePreviews.get(sessionId);
    if (
      current !== preview &&
      this.previewPortRegistry.getStaticRoot(sessionId) === registeredRoot &&
      !(
        current &&
        current.status === 'running' &&
        current.framework === 'Static HTML' &&
        (current.appRoot || '/workspace') === appRoot
      )
    ) {
      this.previewPortRegistry.unregisterStaticPreview(sessionId);
    }
  }

  /**
   * Allocate a port from the pool
   */
  private allocatePort(): number | null {
    const availablePorts = Array.from(this.portPool);
    if (availablePorts.length === 0) {
      return null;
    }

    const port = availablePorts[0];
    this.portPool.delete(port);
    return port;
  }

  /**
   * Release a port back to the pool
   */
  private releasePort(port: number): void {
    this.portPool.add(port);
  }

  /**
   * Cleanup all previews (called on service shutdown)
   */
  async onModuleDestroy() {
    console.log('Cleaning up all preview processes...');
    for (const [sessionId, preview] of this.activePreviews.entries()) {
      try {
        if (preview.pid && Number.isInteger(preview.pid)) {
          await this.runShellInSession(
            sessionId,
            `kill -TERM ${preview.pid} >/dev/null 2>&1 || true`,
            undefined,
            5000,
          );
        }
        this.releasePort(preview.port);
      } catch (error) {
        console.error(`Error killing preview process for session ${sessionId}:`, error);
      }
      this.previewPortRegistry.unregisterPreviewPort(sessionId);
    }
    this.activePreviews.clear();
  }

  private async runShellInSession(
    sessionId: string,
    script: string,
    env?: Record<string, string>,
    timeoutMs: number = 30000,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return this.dockerRuntimeService.execInContainerBySessionId(
      sessionId,
      ['sh', '-c', script],
      '/workspace',
      env,
      timeoutMs,
    );
  }

  private parsePidFromOutput(output: string): number | undefined {
    const trimmed = (output || '').trim();
    if (!trimmed) {
      return undefined;
    }
    const firstLine = trimmed.split('\n')[0].trim();
    const pid = Number.parseInt(firstLine, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  }

  private isExecTimeout(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /timeout/i.test(message);
  }

  private async killPreviewPid(
    sessionId: string,
    pid: number | undefined,
    port: number,
  ): Promise<void> {
    await this.runShellInSession(
      sessionId,
      this.buildKillPreviewScript(pid, port),
      undefined,
      10000,
    );
  }

  private buildKillPreviewScript(pid: number | undefined, port: number): string {
    const steps: string[] = [];

    if (pid && Number.isInteger(pid) && pid > 0) {
      steps.push(
        `kill -TERM ${pid} >/dev/null 2>&1 || true`,
        `kill -TERM -${pid} >/dev/null 2>&1 || true`,
        'sleep 1',
        `kill -0 ${pid} >/dev/null 2>&1 && kill -KILL ${pid} >/dev/null 2>&1 || true`,
        `kill -KILL -${pid} >/dev/null 2>&1 || true`,
      );
    }

    steps.push(`fuser -k ${port}/tcp >/dev/null 2>&1 || true`);
    steps.push(
      `hexport=$(printf '%04X' ${port}); ` +
        'for inode in $(awk -v hp="$hexport" \'$2 ~ ":" hp "$" { print $10 }\' /proc/net/tcp /proc/net/tcp6 2>/dev/null); do ' +
        '[ "$inode" = "0" ] && continue; ' +
        'for fd in /proc/[0-9]*/fd/[0-9]*; do ' +
        'target=$(readlink "$fd" 2>/dev/null) || continue; ' +
        'if [ "$target" = "socket:[$inode]" ]; then ' +
        'tpid=${fd#/proc/}; tpid=${tpid%%/fd/*}; ' +
        'kill -KILL "$tpid" >/dev/null 2>&1 || true; ' +
        'fi; ' +
        'done; ' +
        'done || true',
    );

    return steps.join('; ');
  }

  private async waitForPreviewServer(
    sessionId: string,
    port: number,
    timeoutMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const target = await this.getProxyTargetUrl(sessionId);
        const response = await axios.get(target, {
          timeout: 1000,
          validateStatus: () => true,
        });
        if (response.status >= 100) {
          return true;
        }
      } catch {
        // keep polling until timeout
      }

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(this.VITE_WAIT_POLL_MS, remainingMs)),
      );
    }

    console.warn(
      `Preview server for session ${sessionId} did not become reachable on port ${port} within ${timeoutMs}ms`,
    );
    return false;
  }

  private sanitizeStaticPath(requestPath: string): string {
    const trimmedPath = (requestPath || '/').split('?')[0].split('#')[0];
    const normalizedPath = trimmedPath === '/' || trimmedPath === ''
      ? 'index.html'
      : trimmedPath.replace(/^\/+/, '');

    if (normalizedPath.includes('..')) {
      throw new BadRequestException('Invalid static preview path');
    }

    return normalizedPath;
  }

  private injectPreviewBaseTag(html: string, sessionId: string): string {
    if (/<base\b/i.test(html)) {
      return html;
    }

    const baseTag = `<base href="/api/preview/${encodeURIComponent(sessionId)}/proxy/">`;
    if (/<head\b[^>]*>/i.test(html)) {
      return html.replace(/<head\b[^>]*>/i, (match) => `${match}${baseTag}`);
    }

    return `${baseTag}${html}`;
  }

  private resolveContentType(filePath: string): string {
    const lowercase = filePath.toLowerCase();
    if (lowercase.endsWith('.html') || lowercase.endsWith('.htm')) {
      return 'text/html; charset=utf-8';
    }
    if (lowercase.endsWith('.css')) {
      return 'text/css; charset=utf-8';
    }
    if (lowercase.endsWith('.js')) {
      return 'text/javascript; charset=utf-8';
    }
    if (lowercase.endsWith('.json')) {
      return 'application/json; charset=utf-8';
    }
    if (lowercase.endsWith('.svg')) {
      return 'image/svg+xml';
    }
    if (lowercase.endsWith('.png')) {
      return 'image/png';
    }
    if (lowercase.endsWith('.jpg') || lowercase.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    const extension = lowercase.includes('.') ? lowercase.slice(lowercase.lastIndexOf('.')) : '';
    const standardType = STANDARD_CONTENT_TYPES[extension];
    if (standardType) {
      return standardType;
    }
    return 'text/plain; charset=utf-8';
  }
}
