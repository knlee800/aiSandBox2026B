import axios from 'axios';
import { ContainerManagerHttpClient } from './container-manager-http.client';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ContainerManagerHttpClient file delete', () => {
  let client: ContainerManagerHttpClient;
  let mockAxiosInstance: { delete: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_SERVICE_KEY = 'test-internal-key';

    mockAxiosInstance = {
      delete: jest.fn(),
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
});
