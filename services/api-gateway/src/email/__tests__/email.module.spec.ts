import { Test } from '@nestjs/testing';
import { EMAIL_PROVIDER } from '../email-provider.interface';
import { EmailModule } from '../email.module';
import { ResendEmailProvider } from '../resend-email.provider';
import { StubEmailProvider } from '../stub-email.provider';

describe('EmailModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    delete process.env.AUTH_EMAIL_REPLY_TO;
    delete process.env.APP_BASE_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function resolveProvider() {
    const moduleRef = await Test.createTestingModule({
      imports: [EmailModule],
    }).compile();

    try {
      return moduleRef.get(EMAIL_PROVIDER);
    } finally {
      await moduleRef.close();
    }
  }

  it('defaults to StubEmailProvider when EMAIL_PROVIDER is missing and APP_BASE_URL is set', async () => {
    process.env.APP_BASE_URL = 'http://localhost:3000';

    const provider = await resolveProvider();
    expect(provider).toBeInstanceOf(StubEmailProvider);
  });

  it('returns StubEmailProvider when EMAIL_PROVIDER=stub', async () => {
    process.env.APP_BASE_URL = 'http://localhost:3000';
    process.env.EMAIL_PROVIDER = 'stub';

    const provider = await resolveProvider();
    expect(provider).toBeInstanceOf(StubEmailProvider);
  });

  it('returns ResendEmailProvider when EMAIL_PROVIDER=resend and required env vars are set', async () => {
    process.env.APP_BASE_URL = 'http://localhost:3000';
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.AUTH_EMAIL_FROM = 'noreply@example.com';

    const provider = await resolveProvider();
    expect(provider).toBeInstanceOf(ResendEmailProvider);
  });

  it('throws a clear error for unknown provider', async () => {
    process.env.APP_BASE_URL = 'http://localhost:3000';
    process.env.EMAIL_PROVIDER = 'unknown';

    await expect(resolveProvider()).rejects.toThrow(
      'Unknown EMAIL_PROVIDER: "unknown". Supported values: "stub" and "resend".',
    );
  });

  it('throws a clear error when APP_BASE_URL is missing', async () => {
    await expect(resolveProvider()).rejects.toThrow('APP_BASE_URL is required for email auth');
  });

  it('StubEmailProvider.sendEmail resolves', async () => {
    const provider = new StubEmailProvider();

    await expect(
      provider.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>hello</p>',
      }),
    ).resolves.toBeUndefined();
  });
});
