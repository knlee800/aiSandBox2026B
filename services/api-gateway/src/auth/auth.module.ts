import { Module } from '@nestjs/common';
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
import { ApiKey } from '../entities/api-key.entity';
import { User } from '../entities/user.entity';
import { OauthAccount } from '../entities/oauth-account.entity';
import { VerificationToken } from '../entities/verification-token.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { SessionCookieGuard } from './session-cookie.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change_this_in_production_use_a_long_random_string',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    }),
    TypeOrmModule.forFeature([ApiKey, User, OauthAccount, VerificationToken, AuthSession]),
  ],
  controllers: [AuthController, ApiKeyController],
  providers: [
    AuthService,
    JwtStrategy,
    SessionCookieGuard,
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
