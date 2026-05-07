import { AppleStrategy } from '../apple.strategy';
import { AuthService } from '../auth.service';

describe('AppleStrategy', () => {
  const mockAuthService = {
    findOrCreateAppleUser: jest.fn(),
  } as unknown as AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPLE_CLIENT_ID = 'apple-client-id';
    process.env.APPLE_TEAM_ID = 'apple-team-id';
    process.env.APPLE_KEY_ID = 'apple-key-id';
    process.env.APPLE_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----';
    process.env.APPLE_CALLBACK_URL = 'http://localhost:3000/api/auth/apple/callback';
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
