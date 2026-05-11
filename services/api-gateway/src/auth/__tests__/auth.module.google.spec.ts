import { Logger } from '@nestjs/common';
import { GoogleStrategy } from '../google.strategy';
import { AuthService } from '../auth.service';
import { googleStrategyProvider } from '../auth.module';

describe('googleStrategyProvider', () => {
  const mockAuthService = {
    findOrCreateGoogleUser: jest.fn(),
  } as unknown as AuthService;

  const googleEnvKeys = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
  ] as const;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    for (const key of googleEnvKeys) {
      delete process.env[key];
    }
  });

  it('returns null and logs a warning when Google env config is incomplete', () => {
    const loggerWarnSpy = jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);

    const strategy = googleStrategyProvider.useFactory(mockAuthService);

    expect(strategy).toBeNull();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Google OAuth disabled: missing Google env configuration',
      'AuthModule',
    );
  });

  it('constructs GoogleStrategy when all required Google env vars are present', () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/api/auth/google/callback';

    const loggerWarnSpy = jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    const strategy = googleStrategyProvider.useFactory(mockAuthService);

    expect(strategy).toBeInstanceOf(GoogleStrategy);
    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });
});
