import { Injectable } from '@nestjs/common';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class StubEmailProvider implements EmailProvider {
  async sendEmail(_: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    // Intentionally no-op in stub mode to prevent network calls in local/test environments.
  }
}
