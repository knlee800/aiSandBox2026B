import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PreviewService } from './preview.service';

describe('PreviewService readStaticPreviewContent', () => {
  let service: PreviewService;

  const sessionsService = {
    assertSessionUsable: jest.fn(),
  };

  const dockerRuntimeService = {
    readFileFromContainer: jest.fn<(sessionId: string, filePath: string) => Promise<string>>(),
  };

  const previewStrategyResolver = {};

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PreviewService(
      sessionsService as any,
      dockerRuntimeService as any,
      previewStrategyResolver as any,
    );
  });

  it('injects a base tag immediately after a plain head tag', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head><title>Preview</title></head><body><a href="page2.html">Next</a></body></html>',
    );

    const result = await service.readStaticPreviewContent('session-123', '/index.html');

    expect(result.contentType).toBe('text/html; charset=utf-8');
    expect(result.content).toContain(
      '<head><base href="/api/preview/session-123/proxy/"><title>Preview</title></head>',
    );
  });

  it('injects a base tag immediately after a head tag with attributes', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head data-test="preview"><title>Preview</title></head></html>',
    );

    const result = await service.readStaticPreviewContent('session-123', '/index.html');

    expect(result.content).toContain(
      '<head data-test="preview"><base href="/api/preview/session-123/proxy/"><title>Preview</title></head>',
    );
  });

  it('prepends a base tag when no head tag is present', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><body><a href="./page2.html">Next</a></body></html>',
    );

    const result = await service.readStaticPreviewContent('session-123', '/index.html');

    expect(result.content.startsWith('<base href="/api/preview/session-123/proxy/">')).toBe(true);
  });

  it('does not double inject when a base tag already exists', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head><base href="/custom/"><title>Preview</title></head></html>',
    );

    const result = await service.readStaticPreviewContent('session-123', '/index.html');

    expect(result.content).toBe(
      '<html><head><base href="/custom/"><title>Preview</title></head></html>',
    );
    expect(result.content.match(/<base\b/gi)).toHaveLength(1);
  });

  it('leaves non-html content unchanged', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('body { color: red; }');

    const result = await service.readStaticPreviewContent('session-123', '/styles.css');

    expect(result.contentType).toBe('text/css; charset=utf-8');
    expect(result.content).toBe('body { color: red; }');
  });

  it('url-encodes the session id in the injected href', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('<html><head></head></html>');

    const result = await service.readStaticPreviewContent('session with spaces', '/index.html');

    expect(result.content).toContain(
      '<base href="/api/preview/session%20with%20spaces/proxy/">',
    );
  });

  it('rejects path traversal attempts', async () => {
    await expect(
      service.readStaticPreviewContent('session-123', '/../etc/passwd'),
    ).rejects.toThrow('Invalid static preview path');
  });

  it('rejects embedded path traversal', async () => {
    await expect(
      service.readStaticPreviewContent('session-123', '/assets/../../etc/passwd'),
    ).rejects.toThrow('Invalid static preview path');
  });
});

describe('PreviewService subdirectory appRoot routing', () => {
  let service: PreviewService;

  const sessionsService = {
    assertSessionUsable: jest.fn(),
  };

  const dockerRuntimeService = {
    readFileFromContainer: jest.fn<(sessionId: string, filePath: string) => Promise<string>>(),
  };

  const previewStrategyResolver = {
    resolve: jest.fn<(...args: any[]) => Promise<any>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new PreviewService(
      sessionsService as any,
      dockerRuntimeService as any,
      previewStrategyResolver as any,
    );

    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'static-html',
      framework: 'Static HTML',
      command: 'npx serve -s . -l tcp://0.0.0.0:$PORT',
      appRoot: '/workspace/WorkspaceA',
      servingMode: 'direct-read',
    });

    await service.startPreview('session-sub');
  });

  it('resolves index from subdirectory appRoot', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head></head><body>Index</body></html>',
    );

    await service.readStaticPreviewContent('session-sub', '/');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-sub',
      'WorkspaceA/index.html',
    );
  });

  it('resolves page2.html from subdirectory appRoot', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head></head><body>Page 2</body></html>',
    );

    await service.readStaticPreviewContent('session-sub', '/page2.html');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-sub',
      'WorkspaceA/page2.html',
    );
  });

  it('resolves style.css from subdirectory appRoot', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('body { color: red; }');

    const result = await service.readStaticPreviewContent('session-sub', '/style.css');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-sub',
      'WorkspaceA/style.css',
    );
    expect(result.contentType).toBe('text/css; charset=utf-8');
  });

  it('resolves script.js from subdirectory appRoot', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('console.log("ok");');

    const result = await service.readStaticPreviewContent('session-sub', '/script.js');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-sub',
      'WorkspaceA/script.js',
    );
    expect(result.contentType).toBe('application/javascript; charset=utf-8');
  });

  it('resolves nested asset paths from subdirectory appRoot', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('PNG_DATA');

    const result = await service.readStaticPreviewContent('session-sub', '/images/logo.png');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-sub',
      'WorkspaceA/images/logo.png',
    );
    expect(result.contentType).toBe('image/png');
  });

  it('injects base tag into subdirectory HTML responses', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head><title>Sub</title></head><body>Hello</body></html>',
    );

    const result = await service.readStaticPreviewContent('session-sub', '/');

    expect(result.content).toContain(
      '<base href="/api/preview/session-sub/proxy/">',
    );
  });
});

describe('PreviewService root appRoot routing', () => {
  let service: PreviewService;

  const sessionsService = {
    assertSessionUsable: jest.fn(),
  };

  const dockerRuntimeService = {
    readFileFromContainer: jest.fn<(sessionId: string, filePath: string) => Promise<string>>(),
  };

  const previewStrategyResolver = {
    resolve: jest.fn<(...args: any[]) => Promise<any>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new PreviewService(
      sessionsService as any,
      dockerRuntimeService as any,
      previewStrategyResolver as any,
    );

    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'static-html',
      framework: 'Static HTML',
      command: 'npx serve -s . -l tcp://0.0.0.0:$PORT',
      appRoot: '/workspace',
      servingMode: 'direct-read',
    });

    await service.startPreview('session-root');
  });

  it('resolves index from workspace root', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head></head><body>Root</body></html>',
    );

    await service.readStaticPreviewContent('session-root', '/');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-root',
      'index.html',
    );
  });

  it('resolves assets from workspace root without subdir prefix', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('body { margin: 0; }');

    await service.readStaticPreviewContent('session-root', '/style.css');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-root',
      'style.css',
    );
  });

  it('resolves nested assets from workspace root', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('JPEG_DATA');

    await service.readStaticPreviewContent('session-root', '/assets/photo.jpg');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-root',
      'assets/photo.jpg',
    );
  });
});
