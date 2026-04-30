import { BadRequestException } from '@nestjs/common';
import * as os from 'os';
import * as path from 'path';
import * as nodeFs from 'fs/promises';
import { FilesService } from './files.service';

describe('FilesService searchFiles', () => {
  let tempWorkspacePath: string;
  let service: FilesService;

  const sessionsService = {
    getWorkspacePath: jest.fn(),
  };

  const httpService = {
    post: jest.fn(),
  };

  async function writeWorkspaceFile(relativePath: string, content: string | Buffer): Promise<void> {
    const fullPath = path.join(tempWorkspacePath, relativePath);
    await nodeFs.mkdir(path.dirname(fullPath), { recursive: true });
    await nodeFs.writeFile(fullPath, content);
  }

  beforeEach(async () => {
    tempWorkspacePath = await nodeFs.mkdtemp(path.join(os.tmpdir(), 'aisandbox-search-'));
    sessionsService.getWorkspacePath.mockReturnValue(tempWorkspacePath);
    service = new FilesService(sessionsService as any, httpService as any);
  });

  afterEach(async () => {
    await nodeFs.rm(tempWorkspacePath, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('skips sensitive, binary, vendor, and generated paths while capping matches', async () => {
    const manyMatches = Array.from({ length: 25 }, (_, index) => `login match ${index + 1}`).join('\n');

    await Promise.all([
      writeWorkspaceFile('README.md', 'workspace login overview'),
      writeWorkspaceFile('src/many.ts', manyMatches),
      writeWorkspaceFile('node_modules/pkg/index.js', 'login from dependency'),
      writeWorkspaceFile('vendor/templates/example.txt', 'login from vendor'),
      writeWorkspaceFile('generated/types.ts', 'login from generated code'),
      writeWorkspaceFile('.env', 'LOGIN_SECRET=123'),
      writeWorkspaceFile('assets/logo.png', Buffer.from([0, 159, 146, 150])),
      writeWorkspaceFile('package-lock.json', '{"login": true}'),
    ]);

    const result = await service.searchFiles('session-1', 'login');

    expect(result.query).toBe('login');
    expect(result.results).toHaveLength(20);
    expect(result.truncated).toBe(true);
    expect(result.results.every((entry) => entry.preview.length <= 240)).toBe(true);
    expect(result.results.every((entry) => !entry.path.startsWith('node_modules/'))).toBe(true);
    expect(result.results.every((entry) => !entry.path.startsWith('vendor/'))).toBe(true);
    expect(result.results.every((entry) => !entry.path.startsWith('generated/'))).toBe(true);
    expect(result.results.every((entry) => entry.path !== '.env')).toBe(true);
    expect(result.results.every((entry) => entry.path !== 'package-lock.json')).toBe(true);
    expect(result.results.every((entry) => entry.path !== 'assets/logo.png')).toBe(true);
  });

  it('rejects empty and too-long queries', async () => {
    await expect(service.searchFiles('session-1', '   ')).rejects.toThrow(BadRequestException);
    await expect(service.searchFiles('session-1', 'x'.repeat(121))).rejects.toThrow(
      BadRequestException,
    );
  });
});
