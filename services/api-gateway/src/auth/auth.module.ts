import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { AuthorizationGuard } from './authorization.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change_this_in_production_use_a_long_random_string',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ApiKeyAuthGuard, AuthorizationGuard],
  exports: [AuthService, ApiKeyAuthGuard, AuthorizationGuard],
})
export class AuthModule {}
