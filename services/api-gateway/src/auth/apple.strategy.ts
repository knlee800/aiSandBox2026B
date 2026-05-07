import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthService } from './auth.service';

const ApplePassportStrategy = require('@nicokaiser/passport-apple');

type AppleProfile = {
  id?: string;
  sub?: string;
  email?: string;
  emailVerified?: boolean;
  isPrivateEmail?: boolean;
  name?: {
    firstName?: string;
    lastName?: string;
  };
};

@Injectable()
export class AppleStrategy extends PassportStrategy(ApplePassportStrategy, 'apple') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.APPLE_CLIENT_ID || 'missing-apple-client-id',
      teamID: process.env.APPLE_TEAM_ID || 'missing-apple-team-id',
      keyID: process.env.APPLE_KEY_ID || 'missing-apple-key-id',
      key: (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      callbackURL:
        process.env.APPLE_CALLBACK_URL || 'http://localhost:3000/api/auth/apple/callback',
      scope: ['name', 'email'],
      state: true,
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: AppleProfile) {
    return this.authService.findOrCreateAppleUser({
      appleId: profile.id ?? profile.sub ?? '',
      email: profile.email?.trim().toLowerCase() ?? null,
      emailVerified: Boolean(profile.emailVerified),
      isPrivateEmail: Boolean(profile.isPrivateEmail),
      name: profile.name ?? null,
    });
  }
}
