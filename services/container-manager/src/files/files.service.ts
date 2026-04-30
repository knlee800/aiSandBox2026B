import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { SessionsService } from '../sessions/sessions.service';

const WORKSPACE_SEARCH_MAX_QUERY_LENGTH = 120;
const WORKSPACE_SEARCH_MAX_FILES_SCANNED = 200;
const WORKSPACE_SEARCH_MAX_MATCHES = 20;
const WORKSPACE_SEARCH_MAX_PREVIEW_CHARS = 240;
const WORKSPACE_SEARCH_MAX_TOTAL_RESPONSE_CHARS = 8000;
const WORKSPACE_SEARCH_MAX_FILE_BYTES = 262_144;

const SEARCH_EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.turbo',
  '.cache',
  'build',
  'coverage',
  'dist',
  'generated',
  'node_modules',
  'vendor',
]);

const SEARCH_EXCLUDED_EXTENSIONS = new Set([
  '.bin',
  '.dll',
  '.eot',
  '.exe',
  '.gif',
  '.gz',
  '.ico',
  '.jpeg',
  '.jpg',
  '.lock',
  '.map',
  '.mp3',
  '.mp4',
  '.pdf',
  '.pem',
  '.png',
  '.secret',
  '.so',
  '.svg',
  '.tar',
  '.ttf',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
]);

export interface WorkspaceSearchMatch {
  path: string;
  line: number;
  preview: string;
}

export interface WorkspaceSearchResults {
  query: string;
  results: WorkspaceSearchMatch[];
  truncated: boolean;
}

@Injectable()
export class FilesService {
  constructor(
    private sessionsService: SessionsService,
    private httpService: HttpService,
  ) {}

  async readFile(sessionId: string, filePath: string) {
    const workspacePath = this.sessionsService.getWorkspacePath(sessionId);
    const fullPath = this.resolvePath(workspacePath, filePath);

    this.validatePath(workspacePath, fullPath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);

      return {
        path: filePath,
        content,
        size: stats.size,
        modified: stats.mtime,
      };
    } catch (error) {
      throw new NotFoundException(`File not found: ${filePath}`);
    }
  }

  async writeFile(sessionId: string, filePath: string, content: string) {
    const workspacePath = this.sessionsService.getWorkspacePath(sessionId);
    const fullPath = this.resolvePath(workspacePath, filePath);

    this.validatePath(workspacePath, fullPath);

    // Check if file exists to determine action
    const exists = fsSync.existsSync(fullPath);
    const action = exists ? 'updated' : 'created';

    // Create directory if it doesn't exist
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(fullPath, content, 'utf-8');

    // Update session activity
    await this.sessionsService.updateActivity(sessionId);

    // Emit file change event
    await this.emitFileChange(sessionId, filePath, action);

    return {
      path: filePath,
      size: Buffer.byteLength(content, 'utf-8'),
      message: 'File written successfully',
    };
  }

  async deleteFile(sessionId: string, filePath: string) {
    const workspacePath = this.sessionsService.getWorkspacePath(sessionId);
    const fullPath = this.resolvePath(workspacePath, filePath);

    this.validatePath(workspacePath, fullPath);

    try {
      await fs.unlink(fullPath);

      // Emit file change event
      await this.emitFileChange(sessionId, filePath, 'deleted');

      return { message: 'File deleted successfully' };
    } catch (error) {
      throw new NotFoundException(`File not found: ${filePath}`);
    }
  }

  async listFiles(sessionId: string, dirPath: string = '/') {
    const workspacePath = this.sessionsService.getWorkspacePath(sessionId);
    const fullPath = this.resolvePath(workspacePath, dirPath);

    this.validatePath(workspacePath, fullPath);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      const files = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(fullPath, entry.name);
          const stats = await fs.stat(entryPath);
          const relativePath = path.relative(workspacePath, entryPath);

          return {
            name: entry.name,
            path: relativePath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime,
          };
        })
      );

      return files;
    } catch (error) {
      throw new NotFoundException(`Directory not found: ${dirPath}`);
    }
  }

  async createDirectory(sessionId: string, dirPath: string) {
    const workspacePath = this.sessionsService.getWorkspacePath(sessionId);
    const fullPath = this.resolvePath(workspacePath, dirPath);

    this.validatePath(workspacePath, fullPath);

    await fs.mkdir(fullPath, { recursive: true });

    return {
      path: dirPath,
      message: 'Directory created successfully',
    };
  }

  async searchFiles(sessionId: string, query: string): Promise<WorkspaceSearchResults> {
    const workspacePath = this.sessionsService.getWorkspacePath(sessionId);
    const normalizedQuery = this.normalizeSearchQuery(query);
    const normalizedQueryLower = normalizedQuery.toLowerCase();
    const results: WorkspaceSearchMatch[] = [];
    let filesScanned = 0;
    let totalResponseChars = 0;
    let truncated = false;

    const scanDirectory = async (directoryPath: string): Promise<boolean> => {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of sortedEntries) {
        const entryPath = path.join(directoryPath, entry.name);
        const relativePath = this.toRelativeWorkspacePath(workspacePath, entryPath);

        if (entry.isDirectory()) {
          if (this.shouldSkipSearchDirectory(entry.name, relativePath)) {
            continue;
          }
          if (await scanDirectory(entryPath)) {
            return true;
          }
          continue;
        }

        if (!entry.isFile() || this.shouldSkipSearchFile(relativePath)) {
          continue;
        }

        if (filesScanned >= WORKSPACE_SEARCH_MAX_FILES_SCANNED) {
          truncated = true;
          return true;
        }
        filesScanned += 1;

        const matches = await this.searchFileForQuery(
          entryPath,
          relativePath,
          normalizedQueryLower,
          normalizedQuery.length,
        );

        for (const match of matches) {
          const nextResultCharCount =
            match.path.length + match.preview.length + String(match.line).length + 8;
          if (
            results.length >= WORKSPACE_SEARCH_MAX_MATCHES ||
            totalResponseChars + nextResultCharCount > WORKSPACE_SEARCH_MAX_TOTAL_RESPONSE_CHARS
          ) {
            truncated = true;
            return true;
          }
          results.push(match);
          totalResponseChars += nextResultCharCount;
        }
      }

      return false;
    };

    await scanDirectory(workspacePath);

    return {
      query: normalizedQuery,
      results,
      truncated,
    };
  }

  private resolvePath(workspacePath: string, relativePath: string): string {
    // Remove leading slash if present
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    return path.join(workspacePath, cleanPath);
  }

  private normalizeSearchQuery(query: string): string {
    if (typeof query !== 'string') {
      throw new BadRequestException('query is required');
    }

    if (/[\u0000\r\n]/.test(query)) {
      throw new BadRequestException('query contains unsupported control characters');
    }

    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    if (!normalizedQuery) {
      throw new BadRequestException('query is required');
    }
    if (normalizedQuery.length > WORKSPACE_SEARCH_MAX_QUERY_LENGTH) {
      throw new BadRequestException(
        `query must be at most ${WORKSPACE_SEARCH_MAX_QUERY_LENGTH} characters`,
      );
    }

    return normalizedQuery;
  }

  private toRelativeWorkspacePath(workspacePath: string, fullPath: string): string {
    return path.relative(workspacePath, fullPath).split(path.sep).join('/');
  }

  private shouldSkipSearchDirectory(directoryName: string, relativePath: string): boolean {
    const normalizedDirectoryName = directoryName.trim().toLowerCase();
    if (SEARCH_EXCLUDED_DIRECTORIES.has(normalizedDirectoryName)) {
      return true;
    }

    const normalizedRelativePath = relativePath.trim().toLowerCase();
    return (
      normalizedRelativePath.includes('/node_modules/') ||
      normalizedRelativePath.includes('/vendor/') ||
      normalizedRelativePath.includes('/generated/')
    );
  }

  private shouldSkipSearchFile(relativePath: string): boolean {
    const normalizedPath = relativePath.trim().toLowerCase();
    const fileName = path.basename(normalizedPath);
    const extension = path.extname(fileName);

    if (
      fileName === '.env' ||
      fileName.startsWith('.env.') ||
      fileName.endsWith('.env') ||
      fileName.includes('.env.') ||
      fileName.endsWith('.credentials') ||
      fileName.endsWith('.cert') ||
      fileName.endsWith('.key') ||
      fileName.endsWith('.lock') ||
      fileName.endsWith('.min.css') ||
      fileName.endsWith('.min.js') ||
      fileName.endsWith('.secret') ||
      fileName === 'package-lock.json' ||
      fileName === 'pnpm-lock.yaml' ||
      fileName === 'yarn.lock' ||
      SEARCH_EXCLUDED_EXTENSIONS.has(extension)
    ) {
      return true;
    }

    return (
      normalizedPath.includes('/.git/') ||
      normalizedPath.includes('/.next/') ||
      normalizedPath.includes('/.turbo/') ||
      normalizedPath.includes('/build/') ||
      normalizedPath.includes('/coverage/') ||
      normalizedPath.includes('/dist/') ||
      normalizedPath.includes('/generated/') ||
      normalizedPath.includes('/node_modules/') ||
      normalizedPath.includes('/vendor/')
    );
  }

  private async searchFileForQuery(
    fullPath: string,
    relativePath: string,
    normalizedQueryLower: string,
    queryLength: number,
  ): Promise<WorkspaceSearchMatch[]> {
    const fileBuffer = await fs.readFile(fullPath);
    if (
      fileBuffer.length === 0 ||
      fileBuffer.length > WORKSPACE_SEARCH_MAX_FILE_BYTES ||
      !this.isLikelyTextFile(fileBuffer)
    ) {
      return [];
    }

    const fileContent = fileBuffer.toString('utf-8');
    const lines = fileContent.split(/\r?\n/);
    const matches: WorkspaceSearchMatch[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      const matchIndex = line.toLowerCase().indexOf(normalizedQueryLower);
      if (matchIndex < 0) {
        continue;
      }

      const preview = this.buildSearchPreview(line, matchIndex, queryLength);
      if (!preview) {
        continue;
      }

      matches.push({
        path: relativePath,
        line: index + 1,
        preview,
      });
    }

    return matches;
  }

  private isLikelyTextFile(fileBuffer: Buffer): boolean {
    const bytesToInspect = Math.min(fileBuffer.length, 1024);
    for (let index = 0; index < bytesToInspect; index += 1) {
      if (fileBuffer[index] === 0) {
        return false;
      }
    }
    return true;
  }

  private buildSearchPreview(line: string, matchIndex: number, queryLength: number): string {
    const normalizedLine = line.replace(/\t/g, ' ').trim();
    if (!normalizedLine) {
      return '';
    }

    const previewStart = Math.max(0, matchIndex - 80);
    const previewEnd = Math.min(
      normalizedLine.length,
      matchIndex + Math.max(queryLength, 1) + 120,
    );

    let preview = normalizedLine.slice(previewStart, previewEnd).trim();
    if (previewStart > 0) {
      preview = `...${preview}`;
    }
    if (previewEnd < normalizedLine.length) {
      preview = `${preview}...`;
    }
    if (preview.length > WORKSPACE_SEARCH_MAX_PREVIEW_CHARS) {
      preview = `${preview.slice(0, WORKSPACE_SEARCH_MAX_PREVIEW_CHARS - 3)}...`;
    }

    return preview;
  }

  private validatePath(workspacePath: string, fullPath: string) {
    // Ensure the path is within the workspace (prevent directory traversal)
    const resolvedPath = path.resolve(fullPath);
    const resolvedWorkspace = path.resolve(workspacePath);

    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      throw new BadRequestException('Invalid path: outside workspace');
    }
  }

  private async emitFileChange(sessionId: string, filePath: string, action: 'created' | 'updated' | 'deleted') {
    try {
      await firstValueFrom(
        this.httpService.post('http://localhost:4000/api/events/file-changed', {
          sessionId,
          file: {
            path: filePath,
            action,
            timestamp: new Date().toISOString(),
          },
        }),
      );
    } catch (error) {
      console.error('Failed to emit file change event:', error.message);
    }
  }
}
