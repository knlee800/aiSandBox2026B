import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as path from 'path';
import { SessionsService } from '../sessions/sessions.service';
import { DockerRuntimeService } from '../docker/docker-runtime.service';

/**
 * PreviewService (Phase 7.3)
 * Task 7.3A: Preview Port Registration (Internal Only)
 *
 * Manages preview port registrations for session containers.
 * Stores port mappings in memory only (no database persistence).
 *
 * BROWSER-SMOKE-01: filled by preview/PreviewService when a preview server
 * is running and cleared when it stops; exported by SessionsModule.
 * BROWSER-SMOKE-02: also holds the app root of a running static HTML
 * preview, which has no server listening, so browser smoke can serve its
 * files from the container workspace instead.
 */
@Injectable()
export class PreviewService {
  // In-memory store: sessionId -> port
  private portRegistry: Map<string, number> = new Map();

  // BROWSER-SMOKE-02: in-memory store: sessionId -> static preview app root
  private staticRoots: Map<string, string> = new Map();

  constructor(
    private sessionsService: SessionsService,
    private dockerRuntimeService: DockerRuntimeService,
  ) {}

  /**
   * Register a preview port for a session container
   * Task 8.4A: Enforce Session Termination (HTTP 410)
   *
   * Validations:
   * - Session must not be terminated (410 if terminated)
   * - Port must be between 1024 and 65535
   * - Session must exist
   * - Container must be running
   *
   * @param sessionId - The session ID
   * @param port - The container port to expose (1024-65535)
   * @returns Registration confirmation
   * @throws NotFoundException if session does not exist
   * @throws GoneException if session is terminated
   * @throws BadRequestException if port is invalid
   * @throws InternalServerErrorException if container validation fails
   */
  async registerPreviewPort(
    sessionId: string,
    port: number,
  ): Promise<{ sessionId: string; port: number; registered: true }> {
    // Task 8.4A: Check session termination FIRST (DB-backed via SessionsService)
    this.sessionsService.assertSessionUsable(sessionId);

    // Validate port range
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new BadRequestException(
        'Port must be an integer between 1024 and 65535',
      );
    }

    // Validate session exists and container is running
    await this.validateSessionContainer(sessionId);

    // Register port in memory
    this.portRegistry.set(sessionId, port);

    return {
      sessionId,
      port,
      registered: true,
    };
  }

  /**
   * Get registered port for a session
   *
   * @param sessionId - The session ID
   * @returns The registered port, or null if not registered
   */
  getRegisteredPort(sessionId: string): number | null {
    return this.portRegistry.get(sessionId) ?? null;
  }

  /**
   * BROWSER-SMOKE-02: register the app root of a running static HTML preview
   * for a session container.
   *
   * Validations, as for a port:
   * - Session must not be terminated (410 if terminated)
   * - The app root must be /workspace or a path under /workspace, with no
   *   '.' or '..' segment
   * - Container must be running
   *
   * @param sessionId - The session ID
   * @param appRoot - The preview's app root inside the container
   * @returns Registration confirmation
   * @throws GoneException if session is terminated
   * @throws BadRequestException if the app root is outside /workspace
   * @throws InternalServerErrorException if container validation fails
   */
  async registerStaticPreview(
    sessionId: string,
    appRoot: string,
  ): Promise<{ sessionId: string; appRoot: string; registered: true }> {
    this.sessionsService.assertSessionUsable(sessionId);

    const root = this.normalizeStaticRoot(appRoot);

    await this.validateSessionContainer(sessionId);

    this.staticRoots.set(sessionId, root);

    return {
      sessionId,
      appRoot: root,
      registered: true,
    };
  }

  /**
   * BROWSER-SMOKE-02: get the registered static preview app root
   *
   * @param sessionId - The session ID
   * @returns The app root, or null if none is registered
   */
  getStaticRoot(sessionId: string): string | null {
    return this.staticRoots.get(sessionId) ?? null;
  }

  /**
   * BROWSER-SMOKE-02: clear only the static preview app root, leaving any
   * registered port (used when a static preview stops during registration).
   *
   * @param sessionId - The session ID
   */
  unregisterStaticPreview(sessionId: string): void {
    this.staticRoots.delete(sessionId);
  }

  /**
   * Unregister a session's browser-smoke target: the preview port and
   * (BROWSER-SMOKE-02) the static preview app root.
   *
   * @param sessionId - The session ID
   */
  unregisterPreviewPort(sessionId: string): void {
    this.portRegistry.delete(sessionId);
    this.staticRoots.delete(sessionId);
  }

  /**
   * BROWSER-SMOKE-02: the app root must be /workspace or a path under it,
   * written plainly: absolute, no '.' or '..' segment, no empty segment, no
   * backslash and no NUL. A trailing slash is dropped.
   */
  private normalizeStaticRoot(appRoot: unknown): string {
    const invalid = () =>
      new BadRequestException('Static preview root must be /workspace or a path under /workspace');

    if (typeof appRoot !== 'string') {
      throw invalid();
    }
    const trimmed = appRoot.length > 1 ? appRoot.replace(/\/+$/, '') : appRoot;
    if (trimmed.includes('\0') || trimmed.includes('\\')) {
      throw invalid();
    }
    const segments = trimmed.split('/');
    if (
      segments[0] !== '' ||
      segments[1] !== 'workspace' ||
      segments.slice(1).some((segment) => segment === '' || segment === '.' || segment === '..')
    ) {
      throw invalid();
    }
    // Belt and braces: the plain path is its own normal form.
    if (path.posix.normalize(trimmed) !== trimmed) {
      throw invalid();
    }
    return trimmed;
  }

  /**
   * Validate that session exists and container is running
   *
   * @throws InternalServerErrorException if container not found or not running
   */
  private async validateSessionContainer(sessionId: string): Promise<void> {
    try {
      // Find container by session ID
      const container =
        await this.dockerRuntimeService.findContainerBySessionId(sessionId);

      // Verify container is running
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        throw new InternalServerErrorException(
          `Container for session ${sessionId} is not running`,
        );
      }
    } catch (error) {
      if (
        error instanceof InternalServerErrorException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Container not found or other docker error
      throw new InternalServerErrorException(
        `Failed to validate container for session ${sessionId}: ${error.message}`,
      );
    }
  }
}
