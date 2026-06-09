import { Injectable } from '@nestjs/common';
import { DockerRuntimeService } from '../docker/docker-runtime.service';

export interface PreviewStrategy {
  type: 'static-html' | 'node-dev-server' | 'unknown';
  framework?: string;
  command?: string;
  port?: number;
  appRoot?: string;
  servingMode: 'direct-read' | 'process-proxy';
  diagnosticMessage?: string;
}

@Injectable()
export class PreviewStrategyResolver {
  constructor(private readonly dockerRuntimeService: DockerRuntimeService) {}

  async resolve(
    sessionId: string,
    providedCommand?: string,
  ): Promise<PreviewStrategy> {
    if (providedCommand) {
      return {
        type: 'node-dev-server',
        command: providedCommand,
        servingMode: 'process-proxy',
      };
    }

    const packageJson = await this.readPackageJson(sessionId);
    if (packageJson) {
      return this.resolveFromPackageJson(packageJson);
    }

    if (await this.fileExists(sessionId, '/workspace/index.html')) {
      return {
        type: 'static-html',
        framework: 'Static HTML',
        command: 'npx serve -s . -l tcp://0.0.0.0:$PORT',
        appRoot: '/workspace',
        servingMode: 'direct-read',
      };
    }

    const subdir = await this.findSubdirWithIndexHtml(sessionId);
    if (subdir) {
      return {
        type: 'static-html',
        framework: 'Static HTML',
        command: 'npx serve -s . -l tcp://0.0.0.0:$PORT',
        appRoot: `/workspace/${subdir}`,
        servingMode: 'direct-read',
      };
    }

    if (await this.hasAnyHtmlAtRoot(sessionId)) {
      return {
        type: 'unknown',
        framework: 'Static HTML (missing-index)',
        servingMode: 'direct-read',
        diagnosticMessage:
          'Static HTML preview requires index.html at the workspace root or in an immediate subdirectory.',
      };
    }

    return {
      type: 'unknown',
      servingMode: 'direct-read',
      diagnosticMessage:
        'No package.json or start command found. Cannot start preview.',
    };
  }

  private resolveFromPackageJson(packageJson: any): PreviewStrategy {
    let framework: string | undefined;
    let command: string | null = null;

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

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

    if (packageJson.scripts) {
      if (packageJson.scripts.dev) {
        command = 'npm run dev';
      } else if (packageJson.scripts.start) {
        command = 'npm start';
      } else if (packageJson.scripts.serve) {
        command = 'npm run serve';
      }
    }

    if (command) {
      return {
        type: 'node-dev-server',
        framework,
        command,
        servingMode: 'process-proxy',
      };
    }

    return {
      type: 'unknown',
      framework,
      servingMode: 'direct-read',
      diagnosticMessage:
        'package.json found but no start or dev script detected.',
    };
  }

  private async readPackageJson(sessionId: string): Promise<any | null> {
    const existsResult = await this.runShell(
      sessionId,
      '[ -f /workspace/package.json ]',
    );
    if (existsResult.exitCode !== 0) return null;

    const readResult = await this.runShell(
      sessionId,
      'cat /workspace/package.json',
    );
    if (readResult.exitCode !== 0) return null;

    try {
      return JSON.parse(readResult.stdout);
    } catch {
      return null;
    }
  }

  private async fileExists(
    sessionId: string,
    path: string,
  ): Promise<boolean> {
    const result = await this.runShell(sessionId, `[ -f ${path} ]`);
    return result.exitCode === 0;
  }

  private async findSubdirWithIndexHtml(
    sessionId: string,
  ): Promise<string | null> {
    const result = await this.runShell(
      sessionId,
      'ls -d /workspace/*/index.html 2>/dev/null | head -1',
    );
    if (result.exitCode !== 0 || !result.stdout.trim()) return null;

    const fullPath = result.stdout.trim();
    const match = fullPath.match(/^\/workspace\/([^/]+)\/index\.html$/);
    return match ? match[1] : null;
  }

  private async hasAnyHtmlAtRoot(sessionId: string): Promise<boolean> {
    const result = await this.runShell(
      sessionId,
      'ls /workspace/*.html >/dev/null 2>&1',
    );
    return result.exitCode === 0;
  }

  private async runShell(
    sessionId: string,
    script: string,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return this.dockerRuntimeService.execInContainerBySessionId(
      sessionId,
      ['sh', '-c', script],
      '/workspace',
      undefined,
      10000,
    );
  }
}
