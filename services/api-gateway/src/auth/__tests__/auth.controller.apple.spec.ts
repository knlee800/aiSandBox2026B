jest.mock('passport', () => ({
  __esModule: true,
  default: {
    authenticate: jest.fn(),
    _strategy: jest.fn(),
  },
}));

import passport from 'passport';
import { AuthController } from '../auth.controller';

describe('AuthController Apple OAuth fallback', () => {
  const authService = {} as never;
  const passportMock = passport as typeof passport & {
    authenticate: jest.Mock;
    _strategy: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to login when Apple strategy is not registered for auth start', async () => {
    passportMock._strategy.mockReturnValue(undefined);
    const controller = new AuthController(authService);
    const request = {
      session: {},
    } as any;
    const response = {
      redirect: jest.fn(),
    } as any;

    await controller.appleAuth('zh-TW', request, response);

    expect(passportMock.authenticate).not.toHaveBeenCalled();
    expect(request.session).toBeNull();
    expect(response.redirect).toHaveBeenCalledWith('/zh-TW/login?error=oauth_failed');
  });

  it('redirects to login when Apple strategy is not registered for callback', async () => {
    passportMock._strategy.mockReturnValue(undefined);
    const controller = new AuthController(authService);
    const request = {
      session: {
        oauthLocale: 'en',
      },
    } as any;
    const response = {
      redirect: jest.fn(),
    } as any;

    await controller.appleCallback(request, response);

    expect(passportMock.authenticate).not.toHaveBeenCalled();
    expect(request.session).toBeNull();
    expect(response.redirect).toHaveBeenCalledWith('/en/login?error=oauth_failed');
  });
});
