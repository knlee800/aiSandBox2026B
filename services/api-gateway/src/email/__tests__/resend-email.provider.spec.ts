const mockSend = jest.fn();
const mockResendConstructor = jest.fn().mockImplementation(() => ({
  emails: {
    send: mockSend,
  },
}));

jest.mock('resend', () => ({
  Resend: mockResendConstructor,
}));

import { ResendEmailProvider } from '../resend-email.provider';

describe('ResendEmailProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    delete process.env.AUTH_EMAIL_REPLY_TO;
    mockSend.mockReset();
    mockResendConstructor.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws when RESEND_API_KEY is missing', () => {
    process.env.AUTH_EMAIL_FROM = 'noreply@example.com';

    expect(() => new ResendEmailProvider()).toThrow(
      'RESEND_API_KEY is required when EMAIL_PROVIDER=resend',
    );
  });

  it('throws when AUTH_EMAIL_FROM is missing', () => {
    process.env.RESEND_API_KEY = 're_test_key';

    expect(() => new ResendEmailProvider()).toThrow(
      'AUTH_EMAIL_FROM is required when EMAIL_PROVIDER=resend',
    );
  });

  it('constructs with valid environment values', () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.AUTH_EMAIL_FROM = 'noreply@example.com';

    const provider = new ResendEmailProvider();

    expect(provider).toBeInstanceOf(ResendEmailProvider);
    expect(mockResendConstructor).toHaveBeenCalledWith('re_test_key');
  });

  it('sendEmail calls SDK with from/to/subject/html', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.AUTH_EMAIL_FROM = 'noreply@example.com';
    mockSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });

    const provider = new ResendEmailProvider();
    await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>Hello</p>',
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>Hello</p>',
    });
  });

  it('includes text when provided', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.AUTH_EMAIL_FROM = 'noreply@example.com';
    mockSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });

    const provider = new ResendEmailProvider();
    await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Hello',
      }),
    );
  });

  it('includes replyTo only when AUTH_EMAIL_REPLY_TO is set', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.AUTH_EMAIL_FROM = 'noreply@example.com';
    process.env.AUTH_EMAIL_REPLY_TO = 'support@example.com';
    mockSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });

    const provider = new ResendEmailProvider();
    await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>Hello</p>',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'support@example.com',
      }),
    );
  });

  it('omits replyTo when AUTH_EMAIL_REPLY_TO is not set', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.AUTH_EMAIL_FROM = 'noreply@example.com';
    mockSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });

    const provider = new ResendEmailProvider();
    await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>Hello</p>',
    });

    const callPayload = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callPayload).not.toHaveProperty('replyTo');
  });

  it('throws when SDK returns an error', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.AUTH_EMAIL_FROM = 'noreply@example.com';
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'provider failure' },
    });

    const provider = new ResendEmailProvider();

    await expect(
      provider.sendEmail({
        to: 'user@example.com',
        subject: 'Subject',
        html: '<p>Hello</p>',
      }),
    ).rejects.toThrow('Failed to send email via Resend: provider failure');
  });
});
