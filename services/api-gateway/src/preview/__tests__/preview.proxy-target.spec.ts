import axios from 'axios';
import { PreviewController } from '../preview.controller';

jest.mock('axios');

type MockResponse = {
  setHeader: jest.Mock;
  status: jest.Mock;
  send: jest.Mock;
  json: jest.Mock;
};

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    json: jest.fn(),
  };
  return res;
}

describe('PreviewController proxy target configuration', () => {
  const originalContainerManagerUrl = process.env.CONTAINER_MANAGER_URL;
  const mockedAxios = axios as jest.MockedFunction<typeof axios>;

  beforeEach(() => {
    mockedAxios.mockResolvedValue({
      status: 200,
      headers: {},
      data: { ok: true },
      statusText: 'OK',
      config: {},
    } as never);
  });

  afterEach(() => {
    if (originalContainerManagerUrl === undefined) {
      delete process.env.CONTAINER_MANAGER_URL;
    } else {
      process.env.CONTAINER_MANAGER_URL = originalContainerManagerUrl;
    }
    jest.clearAllMocks();
  });

  it('uses http://localhost:4002 when CONTAINER_MANAGER_URL is unset', async () => {
    delete process.env.CONTAINER_MANAGER_URL;
    const controller = new PreviewController();
    const res = createMockResponse();

    await controller.proxyToContainerManager(
      {
        method: 'GET',
        path: '/api/preview/session-123/status',
        body: undefined,
        query: {},
        headers: {},
      } as never,
      res as never,
    );

    expect(mockedAxios).toHaveBeenCalledTimes(1);
    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://localhost:4002/api/preview/session-123/status',
      }),
    );
    expect(JSON.stringify(mockedAxios.mock.calls[0][0])).not.toContain(
      'http://localhost:4001',
    );
  });

  it('uses explicit CONTAINER_MANAGER_URL when set', async () => {
    process.env.CONTAINER_MANAGER_URL = 'http://container-manager:4010';
    const controller = new PreviewController();
    const res = createMockResponse();

    await controller.proxyToContainerManager(
      {
        method: 'POST',
        path: '/api/preview/session-999/start',
        body: { action: 'start' },
        query: {},
        headers: {},
      } as never,
      res as never,
    );

    expect(mockedAxios).toHaveBeenCalledTimes(1);
    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://container-manager:4010/api/preview/session-999/start',
      }),
    );
  });

  it('does not fallback to http://localhost:4001', async () => {
    delete process.env.CONTAINER_MANAGER_URL;
    const controller = new PreviewController();
    const res = createMockResponse();

    await controller.proxyToContainerManager(
      {
        method: 'GET',
        path: '/api/preview/session-abc/proxy/index.html',
        body: undefined,
        query: {},
        headers: {},
      } as never,
      res as never,
    );

    expect(JSON.stringify(mockedAxios.mock.calls[0][0])).not.toContain(
      'localhost:4001',
    );
    expect(JSON.stringify(mockedAxios.mock.calls[0][0])).toContain(
      'localhost:4002',
    );
  });
});
