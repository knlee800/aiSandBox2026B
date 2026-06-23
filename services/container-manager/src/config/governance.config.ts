import { Injectable } from '@nestjs/common';

/**
 * GovernanceConfig
 * Task 8.1A: Define Governance Config (NO behavior change)
 *
 * Centralized configuration for Phase 8 resource governance limits.
 * Reads environment variables with safe defaults.
 *
 * This config is READ-ONLY in Task 8.1A.
 * Future tasks will consume these values to enforce limits.
 */
@Injectable()
export class GovernanceConfig {
  /**
   * Session max lifetime in milliseconds
   * Default: 86400000 (24 hours)
   * After this duration, session should be marked for cleanup
   */
  readonly sessionMaxLifetimeMs: number;

  /**
   * Session idle timeout in milliseconds
   * Default: 1800000 (30 minutes)
   * After this duration of inactivity, session should be stopped
   */
  readonly sessionIdleTimeoutMs: number;

  /**
   * Container CPU limit (CPU shares)
   * Default: 0.5 (half a CPU core)
   * Docker CPUs parameter
   */
  readonly containerCpuLimit: number;

  /**
   * Container memory limit in MB
   * Default: 512 MB
   * Docker Memory parameter (converted to bytes)
   */
  readonly containerMemoryLimitMb: number;

  /**
   * Container PIDs limit
   * Default: 256
   * Maximum number of processes allowed in container
   */
  readonly containerPidsLimit: number;

  /**
   * Maximum concurrent exec operations per session
   * Default: 2
   * Prevents resource exhaustion from parallel executions
   */
  readonly maxConcurrentExecsPerSession: number;

  /**
   * AGENT-HARNESS-05B1: Browser-capable container CPU limit
   * Default: 1.0 (one full CPU core)
   * Applied only to containers created with browserCapable: true
   */
  readonly browserContainerCpuLimit: number;

  /**
   * AGENT-HARNESS-05B1: Browser-capable container memory limit in MB
   * Default: 768 MB
   * Chromium + Node + user app require more memory than the standard 512 MB
   */
  readonly browserContainerMemoryLimitMb: number;

  /**
   * AGENT-HARNESS-05B1: Browser-capable container PIDs limit
   * Default: 512
   * Chromium spawns multiple processes (browser, GPU, renderer, utility)
   */
  readonly browserContainerPidsLimit: number;

  /**
   * AGENT-HARNESS-05B1: Browser-capable container /dev/shm size in MB
   * Default: 256 MB
   * Chromium requires at least 256 MB /dev/shm for stability (Docker default is 64 MB)
   */
  readonly browserContainerShmSizeMb: number;

  constructor() {
    // Session Limits
    this.sessionMaxLifetimeMs = this.parseEnvInt(
      'SESSION_MAX_LIFETIME_MS',
      86400000, // 24 hours
    );

    this.sessionIdleTimeoutMs = this.parseEnvInt(
      'SESSION_IDLE_TIMEOUT_MS',
      1800000, // 30 minutes
    );

    // Container Resource Limits
    this.containerCpuLimit = this.parseEnvFloat(
      'CONTAINER_CPU_LIMIT',
      0.5, // Half CPU
    );

    this.containerMemoryLimitMb = this.parseEnvInt(
      'CONTAINER_MEMORY_LIMIT_MB',
      512, // 512 MB
    );

    this.containerPidsLimit = this.parseEnvInt(
      'CONTAINER_PIDS_LIMIT',
      256, // 256 processes
    );

    // Execution Limits
    this.maxConcurrentExecsPerSession = this.parseEnvInt(
      'MAX_CONCURRENT_EXECS_PER_SESSION',
      2, // 2 concurrent execs
    );

    // AGENT-HARNESS-05B1: Browser-capable container resource limits
    this.browserContainerCpuLimit = this.parseEnvFloat(
      'CONTAINER_BROWSER_CPU_LIMIT',
      1.0,
    );

    this.browserContainerMemoryLimitMb = this.parseEnvInt(
      'CONTAINER_BROWSER_MEMORY_LIMIT_MB',
      768,
    );

    this.browserContainerPidsLimit = this.parseEnvInt(
      'CONTAINER_BROWSER_PIDS_LIMIT',
      512,
    );

    this.browserContainerShmSizeMb = this.parseEnvInt(
      'CONTAINER_BROWSER_SHM_SIZE_MB',
      256,
    );

    // Log configuration on startup
    console.log('✓ Governance config loaded:');
    console.log(`  - Session max lifetime: ${this.sessionMaxLifetimeMs}ms`);
    console.log(`  - Session idle timeout: ${this.sessionIdleTimeoutMs}ms`);
    console.log(`  - Container CPU limit: ${this.containerCpuLimit}`);
    console.log(`  - Container memory limit: ${this.containerMemoryLimitMb}MB`);
    console.log(`  - Container PIDs limit: ${this.containerPidsLimit}`);
    console.log(
      `  - Max concurrent execs: ${this.maxConcurrentExecsPerSession}`,
    );
    console.log(`  - Browser container CPU limit: ${this.browserContainerCpuLimit}`);
    console.log(`  - Browser container memory limit: ${this.browserContainerMemoryLimitMb}MB`);
    console.log(`  - Browser container PIDs limit: ${this.browserContainerPidsLimit}`);
    console.log(`  - Browser container SHM size: ${this.browserContainerShmSizeMb}MB`);
  }

  /**
   * Parse environment variable as integer with fallback to default
   */
  private parseEnvInt(key: string, defaultValue: number): number {
    const value = process.env[key];

    if (!value) {
      return defaultValue;
    }

    const parsed = parseInt(value, 10);

    if (isNaN(parsed)) {
      console.warn(
        `⚠ Invalid ${key}="${value}", using default: ${defaultValue}`,
      );
      return defaultValue;
    }

    return parsed;
  }

  /**
   * Parse environment variable as float with fallback to default
   */
  private parseEnvFloat(key: string, defaultValue: number): number {
    const value = process.env[key];

    if (!value) {
      return defaultValue;
    }

    const parsed = parseFloat(value);

    if (isNaN(parsed)) {
      console.warn(
        `⚠ Invalid ${key}="${value}", using default: ${defaultValue}`,
      );
      return defaultValue;
    }

    return parsed;
  }

  /**
   * Get container memory limit in bytes (for Docker API)
   */
  getContainerMemoryLimitBytes(): number {
    return this.containerMemoryLimitMb * 1024 * 1024;
  }

  /**
   * AGENT-HARNESS-05B1: Get browser container memory limit in bytes (for Docker API)
   */
  getBrowserContainerMemoryLimitBytes(): number {
    return this.browserContainerMemoryLimitMb * 1024 * 1024;
  }

  /**
   * AGENT-HARNESS-05B1: Get browser container /dev/shm size in bytes (for Docker API)
   */
  getBrowserContainerShmSizeBytes(): number {
    return this.browserContainerShmSizeMb * 1024 * 1024;
  }
}
