import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Headers,
  Res,
  HttpCode,
  HttpStatus,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { SessionCookieGuard } from './session-cookie.guard';
import * as acceptLanguageParser from 'accept-language-parser';
import * as passport from 'passport';
import { Request as ExpressRequest, Response } from 'express';

type OAuthSessionRequest = ExpressRequest & {
  session?: {
    oauthLocale?: string;
  } | null;
  user?: {
    id: string;
    email: string;
    role: string;
    planType?: string;
  };
};

@Controller('auth')
export class AuthController {
  private static readonly SUPPORTED_LOCALES = new Set(['en', 'zh-TW', 'zh-CN']);

  constructor(private authService: AuthService) {}

  private getLanguageFromHeader(acceptLanguage: string | undefined): string {
    if (!acceptLanguage) return 'en';

    const languages = acceptLanguageParser.parse(acceptLanguage);
    if (languages.length === 0) return 'en';

    // Map language codes to our supported locales
    const code = languages[0].code;
    if (code === 'zh') {
      // Check for region to distinguish between Traditional and Simplified
      const region = languages[0].region;
      if (region === 'TW' || region === 'HK') return 'zh-TW';
      if (region === 'CN') return 'zh-CN';
      return 'zh-CN'; // Default to Simplified Chinese
    }

    return 'en'; // Default to English
  }

  private normalizeLocale(locale?: string): string {
    if (!locale || !AuthController.SUPPORTED_LOCALES.has(locale)) {
      return 'en';
    }

    return locale;
  }

  private setSessionCookie(response: Response, sessionToken: string): void {
    response.cookie('aisandbox_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearOauthState(request: OAuthSessionRequest): void {
    request.session = null;
  }

  private getOauthErrorCode(error: unknown): 'oauth_failed' | 'account_conflict' {
    if (!(error instanceof UnauthorizedException)) {
      return 'oauth_failed';
    }

    const response = error.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : typeof response === 'object' &&
            response !== null &&
            'message' in response &&
            typeof response.message === 'string'
          ? response.message
          : Array.isArray((response as { message?: unknown }).message)
            ? (response as { message: string[] }).message.join(' ')
            : '';

    return message.toLowerCase().includes('account conflict') ? 'account_conflict' : 'oauth_failed';
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = this.getLanguageFromHeader(acceptLanguage);
    const result = await this.authService.login(loginDto.email, loginDto.password, lang);
    this.setSessionCookie(response, result.sessionToken);
    return {
      user: result.user,
    };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto.email, registerDto.password);
    return {
      message: 'User registered successfully',
      user,
    };
  }

  @Get('google')
  async googleAuth(
    @Query('locale') locale: string | undefined,
    @Request() req: OAuthSessionRequest,
    @Res() response: Response,
  ) {
    const normalizedLocale = this.normalizeLocale(locale);
    req.session = req.session ?? {};
    req.session.oauthLocale = normalizedLocale;

    passport.authenticate('google', {
      scope: ['email', 'profile'],
      session: false,
    })(req as any, response as any, () => undefined);
  }

  @Get('google/callback')
  async googleCallback(@Request() req: OAuthSessionRequest, @Res() response: Response) {
    const fallbackLocale = this.normalizeLocale(req.session?.oauthLocale);

    await new Promise<void>((resolve, reject) => {
      passport.authenticate(
        'google',
        { session: false },
        async (error: unknown, user?: OAuthSessionRequest['user']) => {
          const locale = this.normalizeLocale(req.session?.oauthLocale || fallbackLocale);

          try {
            if (error || !user) {
              this.clearOauthState(req);
              response.redirect(`/${locale}/login?error=oauth_failed`);
              resolve();
              return;
            }

            const sessionToken = await this.authService.createSession(user.id);
            this.clearOauthState(req);
            this.setSessionCookie(response, sessionToken);
            response.redirect(`/${locale}/app`);
            resolve();
          } catch (callbackError) {
            reject(callbackError);
          }
        },
      )(req as any, response as any, (error: unknown) => {
        if (error) {
          reject(error);
        }
      });
    });
  }

  @Get('apple')
  async appleAuth(
    @Query('locale') locale: string | undefined,
    @Request() req: OAuthSessionRequest,
    @Res() response: Response,
  ) {
    const normalizedLocale = this.normalizeLocale(locale);
    req.session = req.session ?? {};
    req.session.oauthLocale = normalizedLocale;

    passport.authenticate('apple', {
      scope: ['name', 'email'],
      session: false,
    })(req as any, response as any, () => undefined);
  }

  @Post('apple/callback')
  async appleCallback(@Request() req: OAuthSessionRequest, @Res() response: Response) {
    const fallbackLocale = this.normalizeLocale(req.session?.oauthLocale);

    await new Promise<void>((resolve) => {
      passport.authenticate(
        'apple',
        { session: false },
        async (error: unknown, user?: OAuthSessionRequest['user']) => {
          const locale = this.normalizeLocale(req.session?.oauthLocale || fallbackLocale);

          if (error || !user) {
            this.clearOauthState(req);
            response.redirect(`/${locale}/login?error=${this.getOauthErrorCode(error)}`);
            resolve();
            return;
          }

          try {
            const sessionToken = await this.authService.createSession(user.id);
            this.clearOauthState(req);
            this.setSessionCookie(response, sessionToken);
            response.redirect(`/${locale}/app`);
          } catch (callbackError) {
            this.clearOauthState(req);
            response.redirect(`/${locale}/login?error=${this.getOauthErrorCode(callbackError)}`);
          }

          resolve();
        },
      )(req as any, response as any, () => undefined);
    });
  }

  @UseGuards(SessionCookieGuard)
  @Get('me')
  async getProfile(@Request() req) {
    return this.authService.getUserById(req.user.userId);
  }

  @UseGuards(SessionCookieGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @Res({ passthrough: true }) response: Response) {
    await this.authService.revokeSession(req.cookies?.aisandbox_session);
    response.clearCookie('aisandbox_session', {
      path: '/',
    });
    return { ok: true };
  }
}
