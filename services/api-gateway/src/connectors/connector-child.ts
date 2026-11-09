import { ChildProcess, spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import {
  CONNECTOR_CALL_TIMEOUT_MS,
  CONNECTOR_MCP_COMMAND,
  CONNECTOR_MCP_ENTRY,
  CONNECTOR_UNAVAILABLE_MESSAGE,
} from './connector-servers';

export interface ConnectorMcpClient {
  listTools(): Promise<{ tools: Array<{ name: string; description?: string }> }>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export interface ConnectorMcpSession {
  listTools(): Promise<{ tools: Array<{ name: string; description?: string }> }>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
  kill(): void;
  onExit(listener: () => void): void;
}

export type ConnectorSessionOpener = () => Promise<ConnectorMcpSession>;

export const CONNECTOR_SESSION_OPENER = Symbol('CONNECTOR_SESSION_OPENER');

export const CONNECTOR_TIMERS = Symbol('CONNECTOR_TIMERS');

export interface ConnectorTimers {
  delay(ms: number, onFire: () => void): { cancel(): void };
}

export function systemConnectorTimers(): ConnectorTimers {
  return {
    delay(ms: number, onFire: () => void) {
      const handle = setTimeout(onFire, ms);
      if (typeof handle.unref === 'function') handle.unref();
      return { cancel: () => clearTimeout(handle) };
    },
  };
}

export function connectorChildEnv(
  source: NodeJS.ProcessEnv = process.env,
): { PATH: string; NODE_ENV: string } {
  return {
    PATH: typeof source.PATH === 'string' ? source.PATH : '',
    NODE_ENV: typeof source.NODE_ENV === 'string' ? source.NODE_ENV : 'production',
  };
}

export function spawnConnectorChild(entry: string = CONNECTOR_MCP_ENTRY): ChildProcess {
  return spawn(CONNECTOR_MCP_COMMAND, [entry], {
    env: connectorChildEnv(),
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

class ChildStdioTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  private readonly buffer = new ReadBuffer();
  private closed = false;

  constructor(private readonly child: ChildProcess) {}

  async start(): Promise<void> {
    if (this.child.exitCode !== null) {
      throw new Error(CONNECTOR_UNAVAILABLE_MESSAGE);
    }
    this.child.stderr?.on('data', () => undefined);
    this.child.stdout?.on('data', (chunk: Buffer) => {
      try {
        this.buffer.append(chunk);
        for (;;) {
          const message = this.buffer.readMessage();
          if (!message) break;
          this.onmessage?.(message);
        }
      } catch {
        this.onerror?.(new Error(CONNECTOR_UNAVAILABLE_MESSAGE));
      }
    });
    this.child.on('exit', () => {
      if (this.closed) return;
      this.closed = true;
      this.onclose?.();
    });
    this.child.on('error', () => {
      this.onerror?.(new Error(CONNECTOR_UNAVAILABLE_MESSAGE));
    });
    if (typeof this.child.pid === 'number') return;
    await new Promise<void>((resolve, reject) => {
      const fail = () => {
        cleanup();
        reject(new Error(CONNECTOR_UNAVAILABLE_MESSAGE));
      };
      const ready = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        this.child.off('spawn', ready);
        this.child.off('error', fail);
        this.child.off('exit', fail);
      };
      this.child.on('spawn', ready);
      this.child.on('error', fail);
      this.child.on('exit', fail);
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    const stdin = this.child.stdin;
    if (!stdin || this.closed) {
      throw new Error(CONNECTOR_UNAVAILABLE_MESSAGE);
    }
    const wire = serializeMessage(message);
    await new Promise<void>((resolve, reject) => {
      stdin.write(wire, (error) => {
        if (error) reject(new Error(CONNECTOR_UNAVAILABLE_MESSAGE));
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const child = this.child;
    try {
      child.stdin?.end();
    } catch {
      // The child may already be gone.
    }
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // The child may already be gone.
        }
        resolve();
      }, 2000);
      if (typeof timer.unref === 'function') timer.unref();
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      try {
        child.kill('SIGTERM');
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });
    this.onclose?.();
  }
}

async function connectWithSdk(child: ChildProcess): Promise<ConnectorMcpClient> {
  const client = new Client(
    { name: 'aisandbox-connector-broker', version: '0.1.0' },
    { capabilities: {} },
  );
  await client.connect(new ChildStdioTransport(child));
  return {
    async listTools() {
      const listed = await client.listTools();
      return {
        tools: listed.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
      };
    },
    callTool(name: string, args: Record<string, unknown>) {
      return client.callTool({ name, arguments: args }, undefined, {
        timeout: CONNECTOR_CALL_TIMEOUT_MS,
        resetTimeoutOnProgress: false,
      });
    },
    close: () => client.close(),
  };
}

/**
 * StdioClientTransport merges getDefaultEnvironment() into any env we pass, so the
 * child would also receive the platform's inherited names. Spawn here with PATH and
 * NODE_ENV only. The SDK Client still speaks MCP on the child's stdio.
 */
export async function openConnectorMcpSession(
  connect: (child: ChildProcess) => Promise<ConnectorMcpClient> = connectWithSdk,
): Promise<ConnectorMcpSession> {
  const child = spawnConnectorChild();
  const listeners: Array<() => void> = [];
  let exited = false;
  const notify = () => {
    if (exited) return;
    exited = true;
    for (const listener of listeners.splice(0)) listener();
  };
  child.on('exit', notify);
  child.on('error', notify);
  try {
    const client = await connect(child);
    return {
      listTools: () => client.listTools(),
      callTool: (name, args) => client.callTool(name, args),
      close: async () => {
        await client.close();
        notify();
      },
      kill: () => {
        try {
          child.kill('SIGKILL');
        } catch {
          // The child may already be gone.
        }
        notify();
      },
      onExit: (listener) => {
        if (exited) listener();
        else listeners.push(listener);
      },
    };
  } catch (error) {
    try {
      child.kill('SIGKILL');
    } catch {
      // The child may already be gone.
    }
    notify();
    throw error;
  }
}
