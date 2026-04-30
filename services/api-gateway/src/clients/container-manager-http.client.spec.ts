import axios from 'axios';
import { ContainerManagerHttpClient } from './container-manager-http.client';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ContainerManagerHttpClient file operations', () => {
  let client: ContainerManagerHttpClient;
  let mockAxiosInstance: { delete: jest.Mock; post: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_SERVICE_KEY = 'test-internal-key';

    mockAxiosInstance = {
      delete: jest.fn(),
      post: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

    client = new ContainerManagerHttpClient();
    client.onModuleInit();
  });

  afterEach(() => {
    delete process.env.INTERNAL_SERVICE_KEY;
  });

  it('calls the existing container-manager file delete endpoint', async () => {
    mockAxiosInstance.delete.mockResolvedValue({ data: undefined });

    await client.deleteSessionFile('session-123', 'src/old.ts');

    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/files/session-123/delete', {
      data: { path: 'src/old.ts' },
      headers: {
        'X-Internal-Service-Key': 'test-internal-key',
      },
    });
  });

  it('calls the bounded container-manager file search endpoint', async () => {
    const expected = {
      query: 'login',
      results: [{ path: 'src/app.ts', line: 12, preview: 'const login = true;' }],
      truncated: false,
    };
    mockAxiosInstance.post.mockResolvedValue({ data: expected });

    const result = await client.searchSessionFiles('session-123', 'login');

    expect(result).toEqual(expected);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/files/session-123/search',
      { query: 'login' },
      {
        headers: {
          'X-Internal-Service-Key': 'test-internal-key',
        },
      },
    );
  });
});
