import axios from 'axios';
import { ContainerManagerHttpClient, encodePathParam } from './container-manager-http.client';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * CM-AUTH-01: every ContainerManagerHttpClient call sends
 * X-Internal-Service-Key (container-manager now refuses every route except
 * GET /api/health without it), and every path parameter is one encoded
 * segment (SCOPE 1).
 */

const key = 'cm-auth-01-client-key';

type Verb = 'get' | 'post' | 'delete';
type Call = {
  method: keyof ContainerManagerHttpClient;
  verb: Verb;
  path: string;
  invoke: (client: ContainerManagerHttpClient, id: string) => Promise<unknown>;
};

// The 18 calls, with the path each sends for session id 's1'.
const CALLS: Call[] = [
  { method: 'startSession', verb: 'post', path: '/api/sessions/s1/start', invoke: (c, id) => c.startSession(id, 'u1') },
  { method: 'stopSession', verb: 'post', path: '/api/sessions/s1/stop', invoke: (c, id) => c.stopSession(id) },
  { method: 'deleteSession', verb: 'delete', path: '/api/sessions/s1', invoke: (c, id) => c.deleteSession(id) },
  { method: 'getContainerStats', verb: 'get', path: '/api/internal/stats', invoke: (c) => c.getContainerStats() },
  {
    method: 'getBillingUsageExport',
    verb: 'get',
    path: '/api/internal/billing-export/user/s1/usage',
    invoke: (c, id) => c.getBillingUsageExport(id, '2026-01-01', '2026-02-01'),
  },
  { method: 'execInSession', verb: 'post', path: '/api/internal/sessions/s1/exec', invoke: (c, id) => c.execInSession(id, ['ls']) },
  { method: 'listSessionDirectory', verb: 'get', path: '/api/internal/sessions/s1/dirs', invoke: (c, id) => c.listSessionDirectory(id) },
  { method: 'readSessionFile', verb: 'get', path: '/api/internal/sessions/s1/files', invoke: (c, id) => c.readSessionFile(id, 'a.ts') },
  { method: 'writeSessionFile', verb: 'post', path: '/api/internal/sessions/s1/files', invoke: (c, id) => c.writeSessionFile(id, 'a.ts', 'x') },
  { method: 'deleteSessionFile', verb: 'delete', path: '/api/internal/sessions/s1/files', invoke: (c, id) => c.deleteSessionFile(id, 'a.ts') },
  { method: 'searchSessionFiles', verb: 'post', path: '/api/internal/sessions/s1/files/search', invoke: (c, id) => c.searchSessionFiles(id, 'q') },
  { method: 'runBrowserSmoke', verb: 'post', path: '/api/internal/sessions/s1/browser-smoke', invoke: (c, id) => c.runBrowserSmoke(id) },
  { method: 'getGitDiff', verb: 'get', path: '/api/git/s1/diff/abc123', invoke: (c, id) => c.getGitDiff(id, 'abc123') },
  {
    method: 'getWorkingTreeDiff',
    verb: 'get',
    path: '/api/internal/git/s1/worktree-diff/abc123',
    invoke: (c, id) => c.getWorkingTreeDiff(id, 'abc123'),
  },
  { method: 'revertToCheckpoint', verb: 'post', path: '/api/git/s1/revert', invoke: (c, id) => c.revertToCheckpoint(id, 'abc123', 'u1') },
  { method: 'createManualCheckpoint', verb: 'post', path: '/api/git/s1/commit', invoke: (c, id) => c.createManualCheckpoint(id, 'u1') },
  {
    method: 'saveCheckpointHistory',
    verb: 'post',
    path: '/api/internal/checkpoint-history/s1/save',
    invoke: (c, id) => c.saveCheckpointHistory(id, 'p1'),
  },
  {
    method: 'restoreCheckpointHistory',
    verb: 'post',
    path: '/api/internal/checkpoint-history/s1/restore',
    invoke: (c, id) => c.restoreCheckpointHistory(id, 'p1'),
  },
];

const NOT_CALLS = new Set([
  'constructor',
  'onModuleInit',
  'throwContainerManagerError',
  'extractLifecycleTerminationReason',
  'reconcileSessionTerminationFromGone',
]);

describe('ContainerManagerHttpClient internal key on every call (CM-AUTH-01)', () => {
  let client: ContainerManagerHttpClient;
  let instance: Record<Verb, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_SERVICE_KEY = key;
    instance = {
      get: jest.fn().mockResolvedValue({ data: {} }),
      post: jest.fn().mockResolvedValue({ data: {} }),
      delete: jest.fn().mockResolvedValue({ data: {} }),
    };
    mockedAxios.create.mockReturnValue(instance as never);
    (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn(() => false);
    client = new ContainerManagerHttpClient();
    client.onModuleInit();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env.INTERNAL_SERVICE_KEY;
    jest.restoreAllMocks();
  });

  function configOf(verb: Verb, args: unknown[]): { headers?: Record<string, string> } {
    // get(url, config), delete(url, config), post(url, body, config)
    return (verb === 'post' ? args[2] : args[1]) as { headers?: Record<string, string> };
  }

  it('covers all 18 container-manager calls of the client', () => {
    const methods = Object.getOwnPropertyNames(ContainerManagerHttpClient.prototype).filter(
      (name) => !NOT_CALLS.has(name),
    );
    expect(methods.sort()).toEqual(CALLS.map((call) => call.method as string).sort());
    expect(CALLS).toHaveLength(18);
  });

  it.each(CALLS.map((call) => [call.method, call] as const))(
    '%s sends X-Internal-Service-Key',
    async (_name, call) => {
      await call.invoke(client, 's1');

      const mock = instance[call.verb];
      expect(mock).toHaveBeenCalledTimes(1);
      const args = mock.mock.calls[0];
      expect(args[0]).toBe(call.path);
      expect(configOf(call.verb, args).headers).toEqual(
        expect.objectContaining({ 'X-Internal-Service-Key': key }),
      );
    },
  );

  it.each(
    CALLS.filter((call) => call.method !== 'getContainerStats').map((call) => [call.method, call] as const),
  )('%s encodes "/", "?" and "#" in its path parameter', async (_name, call) => {
    await call.invoke(client, 'a/b?c#d');

    const args = instance[call.verb].mock.calls[0];
    expect(args[0]).toBe(call.path.replace('/s1', '/a%2Fb%3Fc%23d'));
  });

  it.each(
    CALLS.filter((call) => call.method !== 'getContainerStats').flatMap((call) =>
      ['..', '.', ''].map((value) => [call.method, JSON.stringify(value), call, value] as const),
    ),
  )('%s refuses the path parameter %s without calling container-manager', async (_name, _label, call, value) => {
    await call.invoke(client, value).catch(() => undefined);

    expect(instance.get).not.toHaveBeenCalled();
    expect(instance.post).not.toHaveBeenCalled();
    expect(instance.delete).not.toHaveBeenCalled();
  });

  it('encodes the commit hash too', async () => {
    await client.getGitDiff('s1', '../../files/x');
    await client.getWorkingTreeDiff('s1', 'a?b');

    expect(instance.get.mock.calls[0][0]).toBe('/api/git/s1/diff/..%2F..%2Ffiles%2Fx');
    expect(instance.get.mock.calls[1][0]).toBe('/api/internal/git/s1/worktree-diff/a%3Fb');
    await client.getGitDiff('s1', '..').catch(() => undefined);
    expect(instance.get).toHaveBeenCalledTimes(2);
  });
});

describe('encodePathParam (CM-AUTH-01 SCOPE 1)', () => {
  it('leaves UUIDs and hex hashes unchanged', () => {
    expect(encodePathParam('0b8c3f5e-2a4d-4c1e-9f7a-1d2e3f4a5b6c')).toBe('0b8c3f5e-2a4d-4c1e-9f7a-1d2e3f4a5b6c');
    expect(encodePathParam('a1b2c3d4e5f60718293a4b5c6d7e8f9012345678')).toBe(
      'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    );
  });

  it('encodes separators and query characters', () => {
    expect(encodePathParam('a/b')).toBe('a%2Fb');
    expect(encodePathParam('a\\b')).toBe('a%5Cb');
    expect(encodePathParam('a?b#c')).toBe('a%3Fb%23c');
    expect(encodePathParam('%2e%2e')).toBe('%252e%252e');
    expect(encodePathParam('..x')).toBe('..x');
  });

  it.each(['', '.', '..'])('refuses %j', (value) => {
    expect(() => encodePathParam(value)).toThrow('Invalid container-manager path parameter');
  });

  it('refuses a non-string', () => {
    expect(() => encodePathParam(undefined as unknown as string)).toThrow();
    expect(() => encodePathParam(42 as unknown as string)).toThrow();
  });
});
