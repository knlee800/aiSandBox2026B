import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    }

    const from = process.env.AUTH_EMAIL_FROM;
    if (!from) {
      throw new Error('AUTH_EMAIL_FROM is required when EMAIL_PROVIDER=resend');
    }

    this.client = new Resend(apiKey);
    this.from = from;
    this.replyTo = process.env.AUTH_EMAIL_REPLY_TO || undefined;
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const result = await this.client.emails.send({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.text ? { text: options.text } : {}),
      ...(this.replyTo ? { replyTo: this.replyTo } : {}),
    });

    if (result.error) {
      throw new Error(`Failed to send email via Resend: ${result.error.message}`);
    }
  }
}
