import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvent } from '../../entities/webhook-event.entity';
import type { WebhookEventStatus } from '../../entities/webhook-event.entity';

/**
 * BILLING-READY-05D: Webhook event repository.
 *
 * Persistence layer for webhook_events table.
 * Provides idempotent event recording, duplicate detection, and status transitions.
 * No provider API calls. No Stripe SDK.
 */
@Injectable()
export class WebhookEventRepository {
  constructor(
    @InjectRepository(WebhookEvent)
    private readonly repository: Repository<WebhookEvent>,
  ) {}

  /**
   * Find an existing webhook event by provider + providerEventId.
   * Used for idempotency check before processing.
   */
  async findByProviderEventId(
    provider: string,
    providerEventId: string,
  ): Promise<WebhookEvent | null> {
    return await this.repository.findOne({
      where: { provider, providerEventId },
    });
  }

  /**
   * Create and persist a new webhook event record.
   * Initial status is 'received'.
   */
  async createEvent(
    params: Partial<WebhookEvent>,
  ): Promise<WebhookEvent> {
    const entity = this.repository.create({
      ...params,
      status: params.status ?? 'received',
      attempts: params.attempts ?? 1,
      receivedAt: params.receivedAt ?? new Date(),
    });
    return await this.repository.save(entity);
  }

  /**
   * Update the processing status of an existing event.
   * Sets processedAt for terminal statuses.
   */
  async updateEventStatus(
    id: string,
    status: WebhookEventStatus,
    errorMessage?: string,
    errorCode?: string,
  ): Promise<WebhookEvent> {
    const updates: Partial<WebhookEvent> = { status };

    if (
      status === 'processed' ||
      status === 'ignored' ||
      status === 'failed'
    ) {
      updates.processedAt = new Date();
    }

    if (errorMessage !== undefined) {
      updates.errorMessage = errorMessage;
    }
    if (errorCode !== undefined) {
      updates.errorCode = errorCode;
    }

    await this.repository.update({ id }, updates);
    const updated = await this.repository.findOne({ where: { id } });
    if (!updated) {
      throw new Error(`WebhookEvent not found after update: ${id}`);
    }
    return updated;
  }

  /**
   * Increment the attempts counter for a duplicate/retry event.
   */
  async incrementAttempts(id: string): Promise<void> {
    await this.repository.increment({ id }, 'attempts', 1);
  }
}
