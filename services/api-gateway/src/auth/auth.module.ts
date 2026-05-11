import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { AuthorizationGuard } from './authorization.guard';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { GoogleStrategy, hasGoogleOAuthConfig } from './google.strategy';
import { AppleStrategy, hasAppleOAuthConfig } from './apple.strategy';
import { ApiKey } from '../entities/api-key.entity';
import { User } from '../entities/user.entity';
import { OauthAccount } from '../entities/oauth-account.entity';
import { VerificationToken } from '../entities/verification-token.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { SessionCookieGuard } from './session-cookie.guard';
import { EmailThrottlerGuard } from './email-throttler.guard';
import { EmailModule } from '../email/email.module';

export const googleStrategyProvider = {
  provide: GoogleStrategy,
  inject: [AuthService],
  useFactory: (authService: AuthService) => {
    if (!hasGoogleOAuthConfig()) {
      Logger.warn('Google OAuth disabled: missing Google env configuration', 'AuthModule');
      return null;
    }

    return new GoogleStrategy(authService);
  },
};

export const appleStrategyProvider = {
  provide: AppleStrategy,
  inject: [AuthService],
  useFactory: (authService: AuthService) => {
    if (!hasAppleOAuthConfig()) {
      Logger.warn('Apple OAuth disabled: missing Apple env configuration', 'AuthModule');
      return null;
    }

    return new AppleStrategy(authService);
  },
};

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change_this_in_production_use_a_long_random_string',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    }),
    EmailModule,
    TypeOrmModule.forFeature([ApiKey, User, OauthAccount, VerificationToken, AuthSession]),
  ],
  controllers: [AuthController, ApiKeyController],
  providers: [
    AuthService,
    JwtStrategy,
    googleStrategyProvider,
    appleStrategyProvider,
    SessionCookieGuard,
    EmailThrottlerGuard,
    ApiKeyAuthGuard,
    AuthorizationGuard,
    ApiKeyService,
  ],
  exports: [
    AuthService,
    SessionCookieGuard,
    ApiKeyAuthGuard,
    AuthorizationGuard,
    ApiKeyService,
  ],
})
export class AuthModule {}
