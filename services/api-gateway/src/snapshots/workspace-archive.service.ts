import { BadRequestException, Injectable } from '@nestjs/common';
import { deflateRawSync, inflateRawSync } from 'zlib';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const MAX_ZIP_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMPORTED_FILE_COUNT = 500;
const MAX_IMPORTED_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_IMPORTED_FILE_BYTES = 512 * 1024;

interface WorkspaceFileRecord {
  path: string;
  content: string;
}

interface ZipDecodedEntry {
  path: string;
  content: Buffer;
}

@Injectable()
export class WorkspaceArchiveService {
  constructor(
    private readonly containerManagerHttpClient: ContainerManagerHttpClient,
  ) {}

  async exportWorkspaceArchive(sessionId: string): Promise<Buffer> {
    const files = await this.collectWorkspaceFiles(sessionId);
    return createZipArchive(
      files.map((file) => ({
        path: file.path,
        content: Buffer.from(file.content, 'utf8'),
      })),
    );
  }

  async importWorkspaceArchive(sessionId: string, zipBuffer: Buffer): Promise<{
    importedFileCount: number;
  }> {
    if (zipBuffer.byteLength === 0) {
      throw new BadRequestException('Archive is empty.');
    }
    if (zipBuffer.byteLength > MAX_ZIP_UPLOAD_BYTES) {
      throw new BadRequestException('Archive exceeds the maximum allowed size (5MB).');
    }

    const decodedEntries = decodeZipArchive(zipBuffer, {
      maxFileCount: MAX_IMPORTED_FILE_COUNT,
      maxTotalBytes: MAX_IMPORTED_TOTAL_BYTES,
      maxFileBytes: MAX_IMPORTED_FILE_BYTES,
    });

    if (decodedEntries.length === 0) {
      throw new BadRequestException('Archive contains no importable files.');
    }

    const importableFiles = decodedEntries.map((entry) => ({
      path: entry.path,
      content: decodeUtf8Text(entry.content),
    }));

    await this.containerManagerHttpClient.execInSession(sessionId, [
      'sh',
      '-c',
      'find /workspace -mindepth 1 -maxdepth 1 -exec rm -rf {} +',
    ]);

    for (const file of importableFiles) {
      await this.containerManagerHttpClient.writeSessionFile(
        sessionId,
        file.path,
        file.content,
      );
    }

    return { importedFileCount: importableFiles.length };
  }

  private async collectWorkspaceFiles(
    sessionId: string,
  ): Promise<WorkspaceFileRecord[]> {
    const collectedFilePaths = await this.collectFilePathsRecursively(sessionId, '/');
    const files: WorkspaceFileRecord[] = [];
    for (const filePath of collectedFilePaths) {
      const response = await this.containerManagerHttpClient.readSessionFile(
        sessionId,
        filePath,
      );
      files.push({ path: filePath, content: response.content });
    }
    return files;
  }

  private async collectFilePathsRecursively(
    sessionId: string,
    directoryPath: string,
  ): Promise<string[]> {
    const response = await this.containerManagerHttpClient.listSessionDirectory(
      sessionId,
      directoryPath,
    );
    const filePaths: string[] = [];
    for (const entry of response.entries) {
      const nextPath =
        directoryPath === '/'
          ? `/${entry.name}`
          : `${directoryPath.replace(/\/$/, '')}/${entry.name}`;
      if (entry.type === 'dir') {
        filePaths.push(
          ...(await this.collectFilePathsRecursively(sessionId, nextPath)),
        );
      } else {
        filePaths.push(nextPath.replace(/^\//, ''));
      }
    }
    return filePaths;
  }
}

function decodeUtf8Text(buffer: Buffer): string {
  const asText = buffer.toString('utf8');
  if (!Buffer.from(asText, 'utf8').equals(buffer)) {
    throw new BadRequestException('Archive contains non-UTF8 file content.');
  }
  return asText;
}

function ensureSafeRelativePath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, '/').trim();
  if (!normalized || normalized === '.' || normalized === '..') {
    throw new BadRequestException('Archive contains an invalid file path.');
  }
  if (normalized.startsWith('/') || normalized.includes('\0')) {
    throw new BadRequestException('Archive contains an unsafe file path.');
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..' || segment.length === 0)) {
    throw new BadRequestException('Archive contains path traversal content.');
  }
  return normalized;
}

function createZipArchive(entries: Array<{ path: string; content: Buffer }>): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const safePath = ensureSafeRelativePath(entry.path);
    const fileNameBuffer = Buffer.from(safePath, 'utf8');
    const crc32 = crc32Buffer(entry.content);
    const compressed = deflateRawSync(entry.content);
    const localHeader = Buffer.alloc(30 + fileNameBuffer.length);
    localHeader.writeUInt32LE(ZIP_LOCAL_SIGNATURE, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc32 >>> 0, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.content.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    fileNameBuffer.copy(localHeader, 30);
    localHeaders.push(localHeader, compressed);

    const central = Buffer.alloc(46 + fileNameBuffer.length);
    central.writeUInt32LE(ZIP_CENTRAL_SIGNATURE, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc32 >>> 0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(fileNameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    fileNameBuffer.copy(central, 46);
    centralHeaders.push(central);

    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralHeaders);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_EOCD_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centralHeaders.length, 8);
  end.writeUInt16LE(centralHeaders.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, centralDirectory, end]);
}

function decodeZipArchive(
  zipBuffer: Buffer,
  limits: { maxFileCount: number; maxTotalBytes: number; maxFileBytes: number },
): ZipDecodedEntry[] {
  const eocdOffset = findEocdOffset(zipBuffer);
  if (eocdOffset < 0) {
    throw new BadRequestException('Archive is malformed (missing central directory).');
  }
  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  if (
    centralDirectoryOffset + centralDirectorySize > zipBuffer.length ||
    totalEntries > limits.maxFileCount
  ) {
    throw new BadRequestException('Archive is malformed or exceeds file-count limits.');
  }

  let cursor = centralDirectoryOffset;
  let totalBytes = 0;
  const entries: ZipDecodedEntry[] = [];
  for (let index = 0; index < totalEntries; index += 1) {
    if (zipBuffer.readUInt32LE(cursor) !== ZIP_CENTRAL_SIGNATURE) {
      throw new BadRequestException('Archive is malformed (invalid central directory record).');
    }
    const compressionMethod = zipBuffer.readUInt16LE(cursor + 10);
    const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(cursor + 24);
    const fileNameLength = zipBuffer.readUInt16LE(cursor + 28);
    const extraLength = zipBuffer.readUInt16LE(cursor + 30);
    const commentLength = zipBuffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const rawPath = zipBuffer.toString('utf8', fileNameStart, fileNameEnd);
    const isDirectory = rawPath.endsWith('/');
    const safePath = ensureSafeRelativePath(rawPath.replace(/\/$/, ''));

    if (!isDirectory) {
      const content = readZipFileContent(
        zipBuffer,
        localHeaderOffset,
        compressedSize,
        uncompressedSize,
        compressionMethod,
      );
      if (content.length > limits.maxFileBytes) {
        throw new BadRequestException('Archive file exceeds per-file size limit.');
      }
      totalBytes += content.length;
      if (totalBytes > limits.maxTotalBytes) {
        throw new BadRequestException('Archive exceeds total extracted size limit.');
      }
      entries.push({ path: safePath, content });
    }

    cursor = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

function readZipFileContent(
  zipBuffer: Buffer,
  localHeaderOffset: number,
  compressedSize: number,
  expectedUncompressedSize: number,
  compressionMethod: number,
): Buffer {
  if (zipBuffer.readUInt32LE(localHeaderOffset) !== ZIP_LOCAL_SIGNATURE) {
    throw new BadRequestException('Archive is malformed (invalid local file header).');
  }
  const fileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataOffset + compressedSize;
  if (dataEnd > zipBuffer.length) {
    throw new BadRequestException('Archive is malformed (truncated entry data).');
  }

  const compressed = zipBuffer.subarray(dataOffset, dataEnd);
  let uncompressed: Buffer;
  if (compressionMethod === 0) {
    uncompressed = Buffer.from(compressed);
  } else if (compressionMethod === 8) {
    uncompressed = inflateRawSync(compressed);
  } else {
    throw new BadRequestException('Archive uses an unsupported compression method.');
  }

  if (uncompressed.length !== expectedUncompressedSize) {
    throw new BadRequestException('Archive is malformed (size mismatch).');
  }
  return uncompressed;
}

function findEocdOffset(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - (0xffff + 22));
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === ZIP_EOCD_SIGNATURE) {
      return i;
    }
  }
  return -1;
}

function crc32Buffer(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();
