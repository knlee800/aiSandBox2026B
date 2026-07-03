import {
  createRunValidationHandler,
  ValidationToolHandlerDeps,
} from './validation-tool-handlers';

function makeDeps(
  overrides?: Partial<ValidationToolHandlerDeps>,
): ValidationToolHandlerDeps {
  return {
    client: {
      runWorkspaceValidation: jest.fn().mockResolvedValue({
        exitCode: 0,
        stdout: 'PASS',
        stderr: '',
      }),
    } as any,
    sessionId: 'session-1',
    allowedValidationCommands: ['npm test', 'npm run build', 'npx tsc --noEmit'],
    validationTimeoutMs: 120_000,
    maxValidationOutputBytes: 131_072,
    ...overrides,
  };
}

describe('createRunValidationHandler', () => {
  describe('allowed commands', () => {
    it('returns structured result for npm test', async () => {
      const deps = makeDeps();
      const handler = createRunValidationHandler(deps);

      const result = await handler({ command: 'npm test' });

      expect(result).toMatchObject({
        command: 'npm test',
        success: true,
        exitCode: 0,
        timedOut: false,
        truncated: false,
      });
      expect(typeof result.durationMs).toBe('number');
      expect(deps.client.runWorkspaceValidation).toHaveBeenCalledWith(
        'session-1',
        'npm test',
        120_000,
        undefined,
      );
    });

    it('returns structured result for npm run build', async () => {
      const deps = makeDeps();
      (deps.client.runWorkspaceValidation as jest.Mock).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'Build error',
      });
      const handler = createRunValidationHandler(deps);

      const result = await handler({ command: 'npm run build' });

      expect(result).toMatchObject({
        command: 'npm run build',
        success: false,
        exitCode: 1,
      });
    });

    it('returns structured result for npx tsc --noEmit', async () => {
      const deps = makeDeps();
      const handler = createRunValidationHandler(deps);

      const result = await handler({ command: 'npx tsc --noEmit' });

      expect(result).toMatchObject({
        command: 'npx tsc --noEmit',
        success: true,
        exitCode: 0,
      });
    });
  });

  describe('disallowed commands', () => {
    it('rejects rm -rf /', async () => {
      const handler = createRunValidationHandler(makeDeps());

      await expect(handler({ command: 'rm -rf /' })).rejects.toThrow(
        'COMMAND_NOT_ALLOWED',
      );
    });

    it('rejects npm install', async () => {
      const handler = createRunValidationHandler(makeDeps());

      await expect(handler({ command: 'npm install' })).rejects.toThrow(
        'COMMAND_NOT_ALLOWED',
      );
    });

    it('rejects curl command', async () => {
      const handler = createRunValidationHandler(makeDeps());

      await expect(
        handler({ command: 'curl https://evil.com' }),
      ).rejects.toThrow('COMMAND_NOT_ALLOWED');
    });

    it('does not forward disallowed command to HTTP client', async () => {
      const deps = makeDeps();
      const handler = createRunValidationHandler(deps);

      await handler({ command: 'npm install' }).catch(() => {});

      expect(deps.client.runWorkspaceValidation).not.toHaveBeenCalled();
    });
  });

  describe('input validation', () => {
    it('rejects empty command', async () => {
      const handler = createRunValidationHandler(makeDeps());

      await expect(handler({ command: '' })).rejects.toThrow(
        'command is required',
      );
    });

    it('rejects whitespace-only command', async () => {
      const handler = createRunValidationHandler(makeDeps());

      await expect(handler({ command: '   ' })).rejects.toThrow(
        'command is required',
      );
    });

    it('rejects missing command', async () => {
      const handler = createRunValidationHandler(makeDeps());

      await expect(handler({})).rejects.toThrow('command is required');
    });

    it('rejects non-string command', async () => {
      const handler = createRunValidationHandler(makeDeps());

      await expect(handler({ command: 123 })).rejects.toThrow(
        'command is required',
      );
    });

    it('matches allowed command after trimming whitespace', async () => {
      const deps = makeDeps();
      const handler = createRunValidationHandler(deps);

      const result = await handler({ command: '  npm test  ' });

      expect(result).toMatchObject({
        command: 'npm test',
        success: true,
      });
      expect(deps.client.runWorkspaceValidation).toHaveBeenCalledWith(
        'session-1',
        'npm test',
        120_000,
        undefined,
      );
    });

    it('passes AbortSignal to client.runWorkspaceValidation', async () => {
      const deps = makeDeps();
      const handler = createRunValidationHandler(deps);
      const signal = new AbortController().signal;

      await handler({ command: 'npm test' }, signal);

      expect(deps.client.runWorkspaceValidation).toHaveBeenCalledWith(
        'session-1',
        'npm test',
        120_000,
        signal,
      );
    });
  });

  describe('output truncation', () => {
    it('truncates stdout exceeding maxValidationOutputBytes and sets truncated true', async () => {
      const deps = makeDeps({ maxValidationOutputBytes: 50 });
      const longOutput = 'x'.repeat(200);
      (deps.client.runWorkspaceValidation as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: longOutput,
        stderr: '',
      });
      const handler = createRunValidationHandler(deps);

      const result = await handler({ command: 'npm test' });

      expect(result.truncated).toBe(true);
      expect(Buffer.byteLength(result.stdout as string, 'utf-8')).toBeLessThan(
        200,
      );
      expect((result.stdout as string)).toContain('[...truncated at 50 bytes]');
    });

    it('truncates stderr exceeding maxValidationOutputBytes and sets truncated true', async () => {
      const deps = makeDeps({ maxValidationOutputBytes: 50 });
      (deps.client.runWorkspaceValidation as jest.Mock).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'e'.repeat(200),
      });
      const handler = createRunValidationHandler(deps);

      const result = await handler({ command: 'npm test' });

      expect(result.truncated).toBe(true);
      expect((result.stderr as string)).toContain('[...truncated at 50 bytes]');
    });

    it('does not truncate output within limits', async () => {
      const deps = makeDeps({ maxValidationOutputBytes: 131_072 });
      (deps.client.runWorkspaceValidation as jest.Mock).mockResolvedValue({
        exitCode: 0,
        stdout: 'short output',
        stderr: '',
      });
      const handler = createRunValidationHandler(deps);

      const result = await handler({ command: 'npm test' });

      expect(result.truncated).toBe(false);
      expect(result.stdout).toBe('short output');
    });
  });

  describe('timeout handling', () => {
    it('returns timedOut true and success false on timeout error', async () => {
      const deps = makeDeps();
      (deps.client.runWorkspaceValidation as jest.Mock).mockRejectedValue(
        new Error('Execution timeout after 120000ms'),
      );
      const handler = createRunValidationHandler(deps);

      const result = await handler({ command: 'npm test' });

      expect(result).toMatchObject({
        command: 'npm test',
        success: false,
        exitCode: 1,
        timedOut: true,
      });
      expect(typeof result.durationMs).toBe('number');
    });
  });

  describe('upstream error handling', () => {
    it('propagates non-timeout errors from client', async () => {
      const deps = makeDeps();
      (deps.client.runWorkspaceValidation as jest.Mock).mockRejectedValue(
        new Error('Container not running'),
      );
      const handler = createRunValidationHandler(deps);

      await expect(handler({ command: 'npm test' })).rejects.toThrow(
        'Container not running',
      );
    });
  });

  describe('security invariant', () => {
    it('forwards the matched allow-list command, not arbitrary model text', async () => {
      const deps = makeDeps();
      const handler = createRunValidationHandler(deps);

      await handler({ command: 'npm test' });

      const callArgs = (deps.client.runWorkspaceValidation as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe('npm test');
    });
  });
});
