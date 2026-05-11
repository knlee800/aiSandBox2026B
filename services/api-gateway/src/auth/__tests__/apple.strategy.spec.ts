import { AppleStrategy, hasAppleOAuthConfig } from '../apple.strategy';
import { AuthService } from '../auth.service';

describe('AppleStrategy', () => {
  const mockAuthService = {
    findOrCreateAppleUser: jest.fn(),
  } as unknown as AuthService;

  const appleEnvKeys = [
    'APPLE_CLIENT_ID',
    'APPLE_TEAM_ID',
    'APPLE_KEY_ID',
    'APPLE_PRIVATE_KEY',
    'APPLE_CALLBACK_URL',
  ] as const;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPLE_CLIENT_ID = 'apple-client-id';
    process.env.APPLE_TEAM_ID = 'apple-team-id';
    process.env.APPLE_KEY_ID = 'apple-key-id';
    process.env.APPLE_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----';
    process.env.APPLE_CALLBACK_URL = 'http://localhost:3000/api/auth/apple/callback';
  });

  afterEach(() => {
    for (const key of appleEnvKeys) {
      delete process.env[key];
    }
  });

  it('reports Apple OAuth config as disabled when any required env is missing', () => {
    delete process.env.APPLE_PRIVATE_KEY;

    expect(hasAppleOAuthConfig()).toBe(false);
    expect(() => new AppleStrategy(mockAuthService)).toThrow(
      'Apple OAuth disabled: missing Apple env configuration',
    );
  });

  it('reports Apple OAuth config as enabled when all required env vars are present', () => {
    expect(hasAppleOAuthConfig()).toBe(true);
  });

  it('passes normalized apple profile data to AuthService', async () => {
    const expectedUser = {
      id: 'user-1',
      email: 'user@example.com',
    };
    mockAuthService.findOrCreateAppleUser = jest.fn().mockResolvedValue(expectedUser);
    const strategy = new AppleStrategy(mockAuthService);

    const result = await strategy.validate('access-token', 'refresh-token', {
      sub: 'apple-user-123',
      email: 'User@Example.com',
      emailVerified: true,
      isPrivateEmail: false,
      name: {
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    });

    expect(mockAuthService.findOrCreateAppleUser).toHaveBeenCalledWith({
      appleId: 'apple-user-123',
      email: 'user@example.com',
      emailVerified: true,
      isPrivateEmail: false,
      name: {
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    });
    expect(result).toEqual(expectedUser);
  });

  it('passes null email when apple omits it on repeat sign-in', async () => {
    mockAuthService.findOrCreateAppleUser = jest.fn().mockResolvedValue({ id: 'user-2' });
    const strategy = new AppleStrategy(mockAuthService);

    await strategy.validate('access-token', 'refresh-token', {
      id: 'apple-user-456',
    });

    expect(mockAuthService.findOrCreateAppleUser).toHaveBeenCalledWith({
      appleId: 'apple-user-456',
      email: null,
      emailVerified: false,
      isPrivateEmail: false,
      name: null,
    });
  });
});
