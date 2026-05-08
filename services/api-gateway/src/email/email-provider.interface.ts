export interface EmailProvider {
  sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
