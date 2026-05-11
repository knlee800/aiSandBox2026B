import { GoogleStrategy, hasGoogleOAuthConfig } from '../google.strategy';
import { AuthService } from '../auth.service';

describe('hasGoogleOAuthConfig', () => {
  const googleEnvKeys = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
  ] as const;

  afterEach(() => {
    for (const key of googleEnvKeys) {
      delete process.env[key];
    }
  });

  it('returns false when all Google env vars are missing', () => {
    expect(hasGoogleOAuthConfig()).toBe(false);
  });

  it('returns false when only some Google env vars are set', () => {
    process.env.GOOGLE_CLIENT_ID = 'some-id';
    expect(hasGoogleOAuthConfig()).toBe(false);
  });

  it('returns false when a Google env var is empty string', () => {
    process.env.GOOGLE_CLIENT_ID = 'some-id';
    process.env.GOOGLE_CLIENT_SECRET = '';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/api/auth/google/callback';
    expect(hasGoogleOAuthConfig()).toBe(false);
  });

  it('returns false when a Google env var is whitespace-only', () => {
    process.env.GOOGLE_CLIENT_ID = 'some-id';
    process.env.GOOGLE_CLIENT_SECRET = '   ';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/api/auth/google/callback';
    expect(hasGoogleOAuthConfig()).toBe(false);
  });

  it('returns true when all Google env vars are present', () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/api/auth/google/callback';
    expect(hasGoogleOAuthConfig()).toBe(true);
  });
});

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

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CALLBACK_URL;
  });

  it('throws when GOOGLE_CLIENT_ID is missing', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    expect(() => new GoogleStrategy(mockAuthService)).toThrow(
      'Google OAuth disabled: missing Google env configuration',
    );
  });

  it('throws when GOOGLE_CLIENT_SECRET is missing', () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(() => new GoogleStrategy(mockAuthService)).toThrow(
      'Google OAuth disabled: missing Google env configuration',
    );
  });

  it('constructs successfully when all Google env vars are present', () => {
    const strategy = new GoogleStrategy(mockAuthService);
    expect(strategy).toBeInstanceOf(GoogleStrategy);
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
