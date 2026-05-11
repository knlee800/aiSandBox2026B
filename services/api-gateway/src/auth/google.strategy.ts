import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

const REQUIRED_GOOGLE_ENV_VARS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
] as const;

export function hasGoogleOAuthConfig(): boolean {
  return REQUIRED_GOOGLE_ENV_VARS.every((name) => {
    const value = process.env[name]?.trim();
    return Boolean(value);
  });
}

function getRequiredGoogleEnv(name: (typeof REQUIRED_GOOGLE_ENV_VARS)[number]): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error('Google OAuth disabled: missing Google env configuration');
  }

  return value;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: getRequiredGoogleEnv('GOOGLE_CLIENT_ID'),
      clientSecret: getRequiredGoogleEnv('GOOGLE_CLIENT_SECRET'),
      callbackURL: getRequiredGoogleEnv('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      state: true,
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const email = profile.emails?.[0]?.value?.toLowerCase() ?? null;
    const emailVerified = Boolean(
      (profile as Profile & { _json?: { email_verified?: boolean } })._json?.email_verified,
    );

    return this.authService.findOrCreateGoogleUser({
      googleId: profile.id,
      email,
      emailVerified,
    });
  }
}
