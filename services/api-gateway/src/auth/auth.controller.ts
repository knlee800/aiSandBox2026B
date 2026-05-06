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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { SessionCookieGuard } from './session-cookie.guard';
import * as acceptLanguageParser from 'accept-language-parser';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = this.getLanguageFromHeader(acceptLanguage);
    const result = await this.authService.login(loginDto.email, loginDto.password, lang);
    response.cookie('aisandbox_session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
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
