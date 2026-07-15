import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Subscription } from '../../entities/subscription.entity';

/**
 * BILLING-READY-05B: Subscription repository.
 *
 * Pure data access layer for the subscriptions table.
 * No provider API calls. No Stripe SDK.
 */
@Injectable()
export class SubscriptionRepository {
  constructor(
    @InjectRepository(Subscription)
    private readonly repository: Repository<Subscription>,
  ) {}

  /**
   * Find the active subscription for a user.
   * "Active" means status is one of: active, trialing, past_due.
   * Returns null if no active subscription exists.
   */
  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    return await this.repository.findOne({
      where: {
        userId,
        status: In(['active', 'trialing', 'past_due']),
      },
    });
  }

  /**
   * Find a subscription by Stripe subscription ID.
   */
  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<Subscription | null> {
    return await this.repository.findOne({
      where: { stripeSubscriptionId },
    });
  }

  /**
   * Find all subscriptions for a user (including historical cancelled/expired).
   */
  async findByUserId(userId: string): Promise<Subscription[]> {
    return await this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Persist a new subscription record.
   */
  async createSubscription(
    params: Partial<Subscription>,
  ): Promise<Subscription> {
    const entity = this.repository.create(params);
    return await this.repository.save(entity);
  }

  /**
   * Update an existing subscription's state from already-provided data.
   * No provider calls — caller supplies the updated fields.
   */
  async updateSubscription(
    id: string,
    updates: Partial<Subscription>,
  ): Promise<Subscription> {
    await this.repository.update({ id }, updates);
    const updated = await this.repository.findOne({ where: { id } });
    if (!updated) {
      throw new Error(`Subscription not found after update: ${id}`);
    }
    return updated;
  }
}
