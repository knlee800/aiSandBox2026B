import { getMetadataArgsStorage } from 'typeorm';
import {
  WebhookEvent,
  WEBHOOK_EVENT_STATUSES,
  WEBHOOK_PROVIDERS,
} from '../../../entities/webhook-event.entity';

describe('WebhookEvent Entity (05D)', () => {
  const entityMeta = () =>
    getMetadataArgsStorage().tables.find((t) => t.target === WebhookEvent);

  const columnMeta = () =>
    getMetadataArgsStorage().columns.filter((c) => c.target === WebhookEvent);

  const indexMeta = () =>
    getMetadataArgsStorage().indices.filter((i) => i.target === WebhookEvent);

  const uniqueMeta = () =>
    getMetadataArgsStorage().uniques.filter((u) => u.target === WebhookEvent);

  describe('table mapping', () => {
    it('maps to webhook_events table', () => {
      const table = entityMeta();
      expect(table).toBeDefined();
      expect(table!.name).toBe('webhook_events');
    });
  });

  describe('columns', () => {
    it('has id as uuid primary key', () => {
      const cols = columnMeta();
      const id = cols.find((c) => c.propertyName === 'id');
      expect(id).toBeDefined();
    });

    it('has providerEventId column mapped to provider_event_id', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'providerEventId');
      expect(col).toBeDefined();
      expect(col!.options.name).toBe('provider_event_id');
      expect(col!.options.type).toBe('varchar');
      expect(col!.options.length).toBe(255);
    });

    it('has provider column with varchar(50)', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'provider');
      expect(col).toBeDefined();
      expect(col!.options.type).toBe('varchar');
      expect(col!.options.length).toBe(50);
    });

    it('has eventType column mapped to event_type', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'eventType');
      expect(col).toBeDefined();
      expect(col!.options.name).toBe('event_type');
      expect(col!.options.type).toBe('varchar');
      expect(col!.options.length).toBe(100);
    });

    it('has internalEventType column nullable mapped to internal_event_type', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'internalEventType');
      expect(col).toBeDefined();
      expect(col!.options.name).toBe('internal_event_type');
      expect(col!.options.nullable).toBe(true);
    });

    it('has status column with varchar(20)', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'status');
      expect(col).toBeDefined();
      expect(col!.options.type).toBe('varchar');
      expect(col!.options.length).toBe(20);
    });

    it('has payloadHash column nullable mapped to payload_hash', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'payloadHash');
      expect(col).toBeDefined();
      expect(col!.options.name).toBe('payload_hash');
      expect(col!.options.nullable).toBe(true);
    });

    it('has errorMessage column nullable of type text', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'errorMessage');
      expect(col).toBeDefined();
      expect(col!.options.type).toBe('text');
      expect(col!.options.nullable).toBe(true);
    });

    it('has errorCode column nullable mapped to error_code', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'errorCode');
      expect(col).toBeDefined();
      expect(col!.options.name).toBe('error_code');
      expect(col!.options.nullable).toBe(true);
    });

    it('has attempts column integer default 1', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'attempts');
      expect(col).toBeDefined();
      expect(col!.options.type).toBe('integer');
      expect(col!.options.default).toBe(1);
    });

    it('has receivedAt column timestamptz', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'receivedAt');
      expect(col).toBeDefined();
      expect(col!.options.type).toBe('timestamptz');
    });

    it('has processedAt column nullable timestamptz', () => {
      const cols = columnMeta();
      const col = cols.find((c) => c.propertyName === 'processedAt');
      expect(col).toBeDefined();
      expect(col!.options.nullable).toBe(true);
    });

    it('has createdAt and updatedAt auto-columns', () => {
      const cols = columnMeta();
      const createdAt = cols.find((c) => c.propertyName === 'createdAt');
      const updatedAt = cols.find((c) => c.propertyName === 'updatedAt');
      expect(createdAt).toBeDefined();
      expect(updatedAt).toBeDefined();
    });
  });

  describe('indexes', () => {
    it('has index on event_type', () => {
      const indexes = indexMeta();
      const idx = indexes.find(
        (i) => i.name === 'idx_webhook_events_event_type',
      );
      expect(idx).toBeDefined();
    });

    it('has index on status', () => {
      const indexes = indexMeta();
      const idx = indexes.find(
        (i) => i.name === 'idx_webhook_events_status',
      );
      expect(idx).toBeDefined();
    });

    it('has index on received_at', () => {
      const indexes = indexMeta();
      const idx = indexes.find(
        (i) => i.name === 'idx_webhook_events_received_at',
      );
      expect(idx).toBeDefined();
    });
  });

  describe('unique constraints', () => {
    it('has unique constraint on provider + providerEventId', () => {
      const uniques = uniqueMeta();
      const uq = uniques.find(
        (u) => u.name === 'uq_webhook_events_provider_event_id',
      );
      expect(uq).toBeDefined();
    });
  });

  describe('constants', () => {
    it('exports WEBHOOK_EVENT_STATUSES with correct values', () => {
      expect(WEBHOOK_EVENT_STATUSES).toEqual([
        'received',
        'verified',
        'processing',
        'processed',
        'ignored',
        'failed',
      ]);
    });

    it('exports WEBHOOK_PROVIDERS with stripe', () => {
      expect(WEBHOOK_PROVIDERS).toContain('stripe');
    });
  });

  describe('entity instantiation', () => {
    it('creates a valid instance with all properties', () => {
      const event = new WebhookEvent();
      event.providerEventId = 'evt_test_123';
      event.provider = 'stripe';
      event.eventType = 'checkout.session.completed';
      event.internalEventType = 'checkout_completed';
      event.status = 'received';
      event.payloadHash = 'abc123';
      event.attempts = 1;
      event.receivedAt = new Date();

      expect(event.providerEventId).toBe('evt_test_123');
      expect(event.provider).toBe('stripe');
      expect(event.eventType).toBe('checkout.session.completed');
      expect(event.internalEventType).toBe('checkout_completed');
      expect(event.status).toBe('received');
      expect(event.payloadHash).toBe('abc123');
      expect(event.attempts).toBe(1);
    });

    it('allows nullable fields to be null', () => {
      const event = new WebhookEvent();
      event.internalEventType = null;
      event.payloadHash = null;
      event.errorMessage = null;
      event.errorCode = null;
      event.processedAt = null;

      expect(event.internalEventType).toBeNull();
      expect(event.payloadHash).toBeNull();
      expect(event.errorMessage).toBeNull();
      expect(event.errorCode).toBeNull();
      expect(event.processedAt).toBeNull();
    });
  });

  describe('no Stripe SDK or provider API imports', () => {
    it('does not import stripe package', () => {
      const entitySource = require('fs').readFileSync(
        require('path').resolve(
          __dirname,
          '../../../entities/webhook-event.entity.ts',
        ),
        'utf-8',
      );
      expect(entitySource).not.toContain("from 'stripe'");
      expect(entitySource).not.toContain('require("stripe")');
      expect(entitySource).not.toContain("require('stripe')");
    });
  });
});
