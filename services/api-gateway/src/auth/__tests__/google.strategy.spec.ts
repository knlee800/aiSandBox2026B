import { GoogleStrategy } from '../google.strategy';
import { AuthService } from '../auth.service';

describe('GoogleStrategy', () => {
  const mockAuthService = {
    findOrCreateGoogleUser: jest.fn(),
  } as unknown as AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/api/auth/google/callback';
  });

  it('passes normalized google profile data to AuthService', async () => {
    const expectedUser = {
      id: 'user-1',
      email: 'user@example.com',
    };
    mockAuthService.findOrCreateGoogleUser = jest.fn().mockResolvedValue(expectedUser);
    const strategy = new GoogleStrategy(mockAuthService);

    const profile = {
      id: 'google-user-123',
      emails: [{ value: 'User@Example.com' }],
      _json: {
        email_verified: true,
      },
    } as any;

    const result = await strategy.validate('access-token', 'refresh-token', profile);

    expect(mockAuthService.findOrCreateGoogleUser).toHaveBeenCalledWith({
      googleId: 'google-user-123',
      email: 'user@example.com',
      emailVerified: true,
    });
    expect(result).toEqual(expectedUser);
  });

  it('passes null email and false verification when google omits them', async () => {
    mockAuthService.findOrCreateGoogleUser = jest.fn().mockResolvedValue({ id: 'user-2' });
    const strategy = new GoogleStrategy(mockAuthService);

    await strategy.validate(
      'access-token',
      'refresh-token',
      {
        id: 'google-user-456',
        emails: [],
        _json: {},
      } as any,
    );

    expect(mockAuthService.findOrCreateGoogleUser).toHaveBeenCalledWith({
      googleId: 'google-user-456',
      email: null,
      emailVerified: false,
    });
  });
});
