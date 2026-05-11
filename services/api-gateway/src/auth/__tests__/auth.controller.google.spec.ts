jest.mock('passport', () => ({
  __esModule: true,
  default: {
    authenticate: jest.fn(),
    _strategy: jest.fn(),
  },
}));

import passport from 'passport';
import { AuthController } from '../auth.controller';

describe('AuthController Google OAuth fallback', () => {
  const authService = {} as never;
  const passportMock = passport as typeof passport & {
    authenticate: jest.Mock;
    _strategy: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to login when Google strategy is not registered for auth start', async () => {
    passportMock._strategy.mockReturnValue(undefined);
    const controller = new AuthController(authService);
    const request = {
      session: {},
    } as any;
    const response = {
      redirect: jest.fn(),
    } as any;

    await controller.googleAuth('en', request, response);

    expect(passportMock.authenticate).not.toHaveBeenCalled();
    expect(request.session).toBeNull();
    expect(response.redirect).toHaveBeenCalledWith('/en/login?error=oauth_failed');
  });

  it('redirects to login when Google strategy is not registered for callback', async () => {
    passportMock._strategy.mockReturnValue(undefined);
    const controller = new AuthController(authService);
    const request = {
      session: {
        oauthLocale: 'zh-TW',
      },
    } as any;
    const response = {
      redirect: jest.fn(),
    } as any;

    await controller.googleCallback(request, response);

    expect(passportMock.authenticate).not.toHaveBeenCalled();
    expect(request.session).toBeNull();
    expect(response.redirect).toHaveBeenCalledWith('/zh-TW/login?error=oauth_failed');
  });

  it('calls passport.authenticate when Google strategy is registered', async () => {
    passportMock._strategy.mockReturnValue({});
    passportMock.authenticate.mockReturnValue(() => undefined);
    const controller = new AuthController(authService);
    const request = {
      session: {},
    } as any;
    const response = {
      redirect: jest.fn(),
    } as any;

    await controller.googleAuth('en', request, response);

    expect(passportMock.authenticate).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({ scope: ['email', 'profile'] }),
    );
  });
});
