import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';
import { DockerRuntimeService } from '../docker/docker-runtime.service';
import axios from 'axios';

interface PreviewProcess {
  pid?: number;
  port: number;
  status: 'starting' | 'running' | 'error';
  command: string;
  framework?: string;
  startedAt: Date;
}

@Injectable()
export class PreviewService {
  private activePreviews: Map<string, PreviewProcess> = new Map();
  private portPool: Set<number> = new Set();
  private readonly PORT_RANGE_START = 3001;
  private readonly PORT_RANGE_END = 3100;

  constructor(
    private sessionsService: SessionsService,
    private dockerRuntimeService: DockerRuntimeService,
  ) {
    // Initialize port pool
    for (let port = this.PORT_RANGE_START; port <= this.PORT_RANGE_END; port++) {
      this.portPool.add(port);
    }
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

    // Auto-detect framework and command if not provided
    const { detectedCommand, framework } = await this.detectFramework(sessionId, command);

    if (!detectedCommand) {
      throw new BadRequestException('No package.json or start command found. Cannot start preview.');
    }

    // Allocate a port
    const port = this.allocatePort();
    if (!port) {
      throw new BadRequestException('No available ports for preview. Maximum concurrent previews reached.');
    }

    console.log(`Starting preview for session ${sessionId} on port ${port} with command: ${detectedCommand}`);

    // Replace PORT placeholder with actual port number
    const finalCommand = detectedCommand.replace(/\$PORT/g, port.toString());

    console.log(`Final command: ${finalCommand}`);

    if (framework === 'Static HTML') {
      this.activePreviews.set(sessionId, {
        port,
        status: 'running',
        command: detectedCommand,
        framework,
        startedAt: new Date(),
      });

      return {
        port,
        status: 'running',
        framework,
      };
    }

    const launchResult = await this.runShellInSession(
      sessionId,
      `(${finalCommand}) >/tmp/preview-${port}.log 2>&1 & echo $!`,
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

    // Store preview info
    this.activePreviews.set(sessionId, {
      pid,
      port,
      status: 'starting',
      command: detectedCommand,
      framework,
      startedAt: new Date(),
    });

    const didStart = await this.waitForPreviewServer(sessionId, port, 5000);
    const previewAfterStart = this.activePreviews.get(sessionId);
    if (previewAfterStart) {
      previewAfterStart.status = didStart ? 'running' : 'starting';
    }

    const preview = this.activePreviews.get(sessionId);
    return {
      port,
      status: preview?.status || 'starting',
      framework: preview?.framework,
    };
  }

  /**
   * Stop a preview server
   */
  async stopPreview(sessionId: string): Promise<{ message: string }> {
    this.sessionsService.assertSessionUsable(sessionId);
    const preview = this.activePreviews.get(sessionId);

    if (!preview) {
      throw new NotFoundException('No active preview for this session');
    }

    try {
      if (preview.pid && Number.isInteger(preview.pid)) {
        await this.runShellInSession(
          sessionId,
          `kill -TERM ${preview.pid} >/dev/null 2>&1 || true; sleep 1; kill -0 ${preview.pid} >/dev/null 2>&1 && kill -KILL ${preview.pid} >/dev/null 2>&1 || true`,
          undefined,
          10000,
        );
      }

      this.releasePort(preview.port);
      this.activePreviews.delete(sessionId);

      return { message: 'Preview stopped successfully' };
    } catch (error) {
      console.error(`Error stopping preview for session ${sessionId}:`, error);
      throw new BadRequestException('Failed to stop preview');
    }
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

  async readStaticPreviewContent(
    sessionId: string,
    requestPath: string,
  ): Promise<{ content: string; contentType: string }> {
    const sanitizedPath = this.sanitizeStaticPath(requestPath);
    const content = await this.dockerRuntimeService.readFileFromContainer(
      sessionId,
      sanitizedPath,
    );

    return {
      content,
      contentType: this.resolveContentType(sanitizedPath),
    };
  }

  /**
   * Auto-detect framework and command from workspace
   */
  private async detectFramework(sessionId: string, providedCommand?: string): Promise<{ detectedCommand: string | null; framework?: string }> {
    // If command provided, use it
    if (providedCommand) {
      return { detectedCommand: providedCommand };
    }

    const packageJson = await this.readPackageJsonInSession(sessionId);

    if (packageJson) {
      // Detect framework
      let framework: string | undefined;
      let command: string | null = null;

      // Check dependencies for framework detection
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps['next']) {
        framework = 'Next.js';
        command = 'npm run dev';
      } else if (deps['react-scripts']) {
        framework = 'Create React App';
        command = 'npm start';
      } else if (deps['vite']) {
        framework = 'Vite';
        command = 'npm run dev';
      } else if (deps['@vue/cli-service']) {
        framework = 'Vue CLI';
        command = 'npm run serve';
      } else if (deps['vue']) {
        framework = 'Vue';
        command = 'npm run dev';
      } else if (deps['express']) {
        framework = 'Express';
        command = 'node server.js';
      }

      // Override with package.json scripts if available
      if (packageJson.scripts) {
        if (packageJson.scripts.dev) {
          command = 'npm run dev';
        } else if (packageJson.scripts.start) {
          command = 'npm start';
        } else if (packageJson.scripts.serve) {
          command = 'npm run serve';
        }
      }

      return { detectedCommand: command, framework };
    }

    const hasHtml = await this.hasAnyHtmlInSessionWorkspace(sessionId);
    if (hasHtml) {
      return {
        detectedCommand: 'npx serve -s . -l tcp://0.0.0.0:$PORT',
        framework: 'Static HTML',
      };
    }

    return { detectedCommand: null };
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

  private async readPackageJsonInSession(sessionId: string): Promise<any | null> {
    const existsResult = await this.runShellInSession(
      sessionId,
      '[ -f /workspace/package.json ]',
      undefined,
      10000,
    );
    if (existsResult.exitCode !== 0) {
      return null;
    }

    const readResult = await this.runShellInSession(
      sessionId,
      'cat /workspace/package.json',
      undefined,
      10000,
    );
    if (readResult.exitCode !== 0) {
      return null;
    }

    try {
      return JSON.parse(readResult.stdout);
    } catch {
      return null;
    }
  }

  private async hasAnyHtmlInSessionWorkspace(sessionId: string): Promise<boolean> {
    const htmlResult = await this.runShellInSession(
      sessionId,
      'ls /workspace/*.html >/dev/null 2>&1',
      undefined,
      10000,
    );
    return htmlResult.exitCode === 0;
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

  private async waitForPreviewServer(
    sessionId: string,
    port: number,
    timeoutMs: number,
  ): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
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

      await new Promise((resolve) => setTimeout(resolve, 400));
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

  private resolveContentType(filePath: string): string {
    const lowercase = filePath.toLowerCase();
    if (lowercase.endsWith('.html') || lowercase.endsWith('.htm')) {
      return 'text/html; charset=utf-8';
    }
    if (lowercase.endsWith('.css')) {
      return 'text/css; charset=utf-8';
    }
    if (lowercase.endsWith('.js')) {
      return 'application/javascript; charset=utf-8';
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
    return 'text/plain; charset=utf-8';
  }
}
