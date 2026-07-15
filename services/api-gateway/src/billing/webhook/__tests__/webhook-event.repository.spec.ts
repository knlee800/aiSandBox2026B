import { WebhookEventRepository } from '../webhook-event.repository';
import { WebhookEvent } from '../../../entities/webhook-event.entity';

describe('WebhookEventRepository (05D)', () => {
  let repository: WebhookEventRepository;
  let mockRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    increment: jest.Mock;
  };

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn(),
      create: jest.fn((data: any) => ({ ...data } as WebhookEvent)),
      save: jest.fn((entity: any) => Promise.resolve({ id: 'evt-uuid-1', ...entity })),
      update: jest.fn(() => Promise.resolve()),
      increment: jest.fn(() => Promise.resolve()),
    };

    repository = new WebhookEventRepository(mockRepo as any);
  });

  describe('findByProviderEventId', () => {
    it('queries by provider and providerEventId', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await repository.findByProviderEventId('stripe', 'evt_123');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { provider: 'stripe', providerEventId: 'evt_123' },
      });
      expect(result).toBeNull();
    });

    it('returns existing event when found', async () => {
      const existing = {
        id: 'uuid-1',
        providerEventId: 'evt_123',
        provider: 'stripe',
        status: 'processed',
        attempts: 1,
      } as WebhookEvent;
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await repository.findByProviderEventId('stripe', 'evt_123');
      expect(result).toBe(existing);
    });
  });

  describe('createEvent', () => {
    it('creates event with default status received', async () => {
      await repository.createEvent({
        providerEventId: 'evt_456',
        provider: 'stripe',
        eventType: 'checkout.session.completed',
        internalEventType: 'checkout_completed',
        payloadHash: 'hash123',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          providerEventId: 'evt_456',
          provider: 'stripe',
          eventType: 'checkout.session.completed',
          status: 'received',
          attempts: 1,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('preserves explicit status if provided', async () => {
      await repository.createEvent({
        providerEventId: 'evt_789',
        provider: 'stripe',
        eventType: 'invoice.paid',
        status: 'verified',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'verified' }),
      );
    });
  });

  describe('updateEventStatus', () => {
    it('updates status and sets processedAt for terminal statuses', async () => {
      const updated = { id: 'uuid-1', status: 'processed' } as WebhookEvent;
      mockRepo.findOne.mockResolvedValue(updated);

      const result = await repository.updateEventStatus('uuid-1', 'processed');
      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'uuid-1' },
        expect.objectContaining({
          status: 'processed',
          processedAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe('processed');
    });

    it('sets processedAt for ignored status', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'uuid-1', status: 'ignored' });
      await repository.updateEventStatus('uuid-1', 'ignored');
      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'uuid-1' },
        expect.objectContaining({
          status: 'ignored',
          processedAt: expect.any(Date),
        }),
      );
    });

    it('sets processedAt for failed status', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'uuid-1', status: 'failed' });
      await repository.updateEventStatus(
        'uuid-1',
        'failed',
        'Something went wrong',
        'PROCESSING_ERROR',
      );
      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'uuid-1' },
        expect.objectContaining({
          status: 'failed',
          processedAt: expect.any(Date),
          errorMessage: 'Something went wrong',
          errorCode: 'PROCESSING_ERROR',
        }),
      );
    });

    it('does not set processedAt for non-terminal statuses', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'uuid-1', status: 'verified' });
      await repository.updateEventStatus('uuid-1', 'verified');
      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'uuid-1' },
        { status: 'verified' },
      );
    });

    it('throws if event not found after update', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        repository.updateEventStatus('missing-id', 'processed'),
      ).rejects.toThrow('WebhookEvent not found after update: missing-id');
    });
  });

  describe('incrementAttempts', () => {
    it('increments attempts by 1', async () => {
      await repository.incrementAttempts('uuid-1');
      expect(mockRepo.increment).toHaveBeenCalledWith(
        { id: 'uuid-1' },
        'attempts',
        1,
      );
    });
  });

  describe('no Stripe SDK or provider API imports', () => {
    it('does not import stripe package', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../webhook-event.repository.ts'),
        'utf-8',
      );
      expect(source).not.toContain("from 'stripe'");
      expect(source).not.toContain('require("stripe")');
      expect(source).not.toContain("require('stripe')");
    });
  });
});
