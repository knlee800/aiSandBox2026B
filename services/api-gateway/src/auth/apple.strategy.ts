import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthService } from './auth.service';

const ApplePassportStrategy = require('@nicokaiser/passport-apple');
const REQUIRED_APPLE_ENV_VARS = [
  'APPLE_CLIENT_ID',
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY',
  'APPLE_CALLBACK_URL',
] as const;

const APPLE_OAUTH_MISSING_CONFIG_MESSAGE = 'Apple OAuth disabled: missing Apple env configuration';

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

function getRequiredAppleEnv(name: (typeof REQUIRED_APPLE_ENV_VARS)[number]): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(APPLE_OAUTH_MISSING_CONFIG_MESSAGE);
  }

  return value;
}

export function hasAppleOAuthConfig(): boolean {
  return REQUIRED_APPLE_ENV_VARS.every((name) => {
    const value = process.env[name]?.trim();
    return Boolean(value);
  });
}

@Injectable()
export class AppleStrategy extends PassportStrategy(ApplePassportStrategy, 'apple') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: getRequiredAppleEnv('APPLE_CLIENT_ID'),
      teamID: getRequiredAppleEnv('APPLE_TEAM_ID'),
      keyID: getRequiredAppleEnv('APPLE_KEY_ID'),
      key: getRequiredAppleEnv('APPLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
      callbackURL: getRequiredAppleEnv('APPLE_CALLBACK_URL'),
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
