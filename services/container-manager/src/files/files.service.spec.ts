import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
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

  const apiGatewayClient = {
    notifyFileChanged: jest.fn(async () => undefined),
  };

  async function writeWorkspaceFile(relativePath: string, content: string | Buffer): Promise<void> {
    const fullPath = path.join(tempWorkspacePath, relativePath);
    await nodeFs.mkdir(path.dirname(fullPath), { recursive: true });
    await nodeFs.writeFile(fullPath, content);
  }

  beforeEach(async () => {
    tempWorkspacePath = await nodeFs.mkdtemp(path.join(os.tmpdir(), 'aisandbox-search-'));
    sessionsService.getWorkspacePath.mockReturnValue(tempWorkspacePath);
    service = new FilesService(
      sessionsService as any,
      httpService as any,
      apiGatewayClient as any,
    );
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

describe('FilesService workspace path containment (CM-PATH-01)', () => {
  let parentPath: string;
  let workspacePath: string;
  let siblingPath: string;
  let service: FilesService;

  const sessionsService = {
    getWorkspacePath: jest.fn(),
    updateActivity: jest.fn(async () => undefined),
  };

  const apiGatewayClient = {
    notifyFileChanged: jest.fn(async () => undefined),
  };

  beforeEach(async () => {
    parentPath = await nodeFs.mkdtemp(path.join(os.tmpdir(), 'aisandbox-cm-path-'));
    workspacePath = path.join(parentPath, 'abc');
    siblingPath = path.join(parentPath, 'abcX');
    await nodeFs.mkdir(path.join(workspacePath, 'src'), { recursive: true });
    await nodeFs.writeFile(path.join(workspacePath, 'src', 'index.ts'), 'inside');
    await nodeFs.mkdir(siblingPath, { recursive: true });
    await nodeFs.writeFile(path.join(siblingPath, 'file.txt'), 'sibling secret');
    await nodeFs.writeFile(path.join(parentPath, 'outside.txt'), 'outside secret');
    sessionsService.getWorkspacePath.mockReturnValue(workspacePath);
    service = new FilesService(sessionsService as any, {} as any, apiGatewayClient as any);
  });

  afterEach(async () => {
    await nodeFs.rm(parentPath, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('refuses the sibling-prefix path ../abcX/file on every file route', async () => {
    const sibling = '../abcX/file.txt';
    await expect(service.readFile('abc', sibling)).rejects.toThrow('Invalid path: outside workspace');
    await expect(service.writeFile('abc', sibling, 'x')).rejects.toThrow(BadRequestException);
    await expect(service.deleteFile('abc', sibling)).rejects.toThrow(BadRequestException);
    await expect(service.listFiles('abc', '../abcX')).rejects.toThrow(BadRequestException);
    await expect(service.createDirectory('abc', '../abcX/new')).rejects.toThrow(BadRequestException);

    expect(await nodeFs.readFile(path.join(siblingPath, 'file.txt'), 'utf-8')).toBe('sibling secret');
    await expect(nodeFs.stat(path.join(siblingPath, 'new'))).rejects.toThrow();
    expect(apiGatewayClient.notifyFileChanged).not.toHaveBeenCalled();
  });

  it('refuses .. escapes', async () => {
    await expect(service.readFile('abc', '../outside.txt')).rejects.toThrow(BadRequestException);
    await expect(service.readFile('abc', 'src/../../outside.txt')).rejects.toThrow(BadRequestException);
    await expect(service.listFiles('abc', '..')).rejects.toThrow(BadRequestException);
    await expect(service.writeFile('abc', '../../escape.txt', 'x')).rejects.toThrow(BadRequestException);
  });

  it('allows the workspace root and nested paths', async () => {
    const rootEntries = await service.listFiles('abc', '/');
    expect(rootEntries.map((entry) => entry.name)).toEqual(['src']);

    const nested = await service.readFile('abc', 'src/index.ts');
    expect(nested.content).toBe('inside');

    const viaDotDot = await service.readFile('abc', 'src/../src/index.ts');
    expect(viaDotDot.content).toBe('inside');

    await service.writeFile('abc', 'src/nested/new.ts', 'new');
    expect(await nodeFs.readFile(path.join(workspacePath, 'src', 'nested', 'new.ts'), 'utf-8')).toBe('new');

    await service.createDirectory('abc', '..config');
    expect((await nodeFs.stat(path.join(workspacePath, '..config'))).isDirectory()).toBe(true);
  });

  it('refuses an absolute path outside the workspace', () => {
    const validatePath = (fullPath: string) =>
      (service as any).validatePath(workspacePath, fullPath);

    expect(() => validatePath(path.join(parentPath, 'outside.txt'))).toThrow(BadRequestException);
    expect(() => validatePath(path.join(siblingPath, 'file.txt'))).toThrow(BadRequestException);
    expect(() => validatePath(path.parse(workspacePath).root)).toThrow(BadRequestException);
    expect(() => validatePath(workspacePath)).not.toThrow();
    expect(() => validatePath(path.join(workspacePath, 'src', 'index.ts'))).not.toThrow();
  });

  it('keeps a leading-slash path inside the workspace', async () => {
    const result = await service.readFile('abc', '/src/index.ts');
    expect(result.content).toBe('inside');
    await expect(service.readFile('abc', '/../abcX/file.txt')).rejects.toThrow(BadRequestException);
  });
});
