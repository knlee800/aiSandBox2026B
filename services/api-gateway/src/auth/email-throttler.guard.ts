import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class EmailThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const email = (req.body as { email?: string } | undefined)?.email;
    const normalizedEmail = email?.trim().toLowerCase();

    if (normalizedEmail) {
      return normalizedEmail;
    }

    return req.ip || 'unknown';
  }
}
