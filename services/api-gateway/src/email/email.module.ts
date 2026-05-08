import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { ResendEmailProvider } from './resend-email.provider';
import { StubEmailProvider } from './stub-email.provider';

function assertRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for email auth`);
  }
  return value;
}

export const emailProviderFactory = {
  provide: EMAIL_PROVIDER,
  useFactory: () => {
    assertRequiredEnv('APP_BASE_URL');

    const configuredProvider = (process.env.EMAIL_PROVIDER ?? 'stub').trim().toLowerCase();

    if (configuredProvider === 'stub') {
      return new StubEmailProvider();
    }

    if (configuredProvider === 'resend') {
      return new ResendEmailProvider();
    }

    throw new Error(
      `Unknown EMAIL_PROVIDER: "${configuredProvider}". Supported values: "stub" and "resend".`,
    );
  },
};

@Module({
  providers: [emailProviderFactory],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
