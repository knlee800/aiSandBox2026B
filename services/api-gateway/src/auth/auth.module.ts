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

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change_this_in_production_use_a_long_random_string',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    }),
    TypeOrmModule.forFeature([ApiKey, User]),
  ],
  controllers: [AuthController, ApiKeyController],
  providers: [AuthService, JwtStrategy, ApiKeyAuthGuard, AuthorizationGuard, ApiKeyService],
  exports: [AuthService, ApiKeyAuthGuard, AuthorizationGuard, ApiKeyService],
})
export class AuthModule {}
