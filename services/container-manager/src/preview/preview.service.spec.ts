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
});
