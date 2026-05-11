import { Logger } from '@nestjs/common';
import { AppleStrategy } from '../apple.strategy';
import { AuthService } from '../auth.service';
import { appleStrategyProvider } from '../auth.module';

describe('appleStrategyProvider', () => {
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
  });

  afterEach(() => {
    for (const key of appleEnvKeys) {
      delete process.env[key];
    }
  });

  it('returns null and logs a warning when Apple env config is incomplete', () => {
    const loggerWarnSpy = jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);

    const strategy = appleStrategyProvider.useFactory(mockAuthService);

    expect(strategy).toBeNull();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Apple OAuth disabled: missing Apple env configuration',
      'AuthModule',
    );
  });

  it('constructs AppleStrategy when all required Apple env vars are present', () => {
    process.env.APPLE_CLIENT_ID = 'apple-client-id';
    process.env.APPLE_TEAM_ID = 'apple-team-id';
    process.env.APPLE_KEY_ID = 'apple-key-id';
    process.env.APPLE_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----';
    process.env.APPLE_CALLBACK_URL = 'http://localhost:4000/api/auth/apple/callback';

    const loggerWarnSpy = jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    const strategy = appleStrategyProvider.useFactory(mockAuthService);

    expect(strategy).toBeInstanceOf(AppleStrategy);
    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });
});
