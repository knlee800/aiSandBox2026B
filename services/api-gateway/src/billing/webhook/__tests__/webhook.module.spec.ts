import { WebhookModule } from '../webhook.module';

describe('WebhookModule (05D)', () => {
  it('module class is defined', () => {
    expect(WebhookModule).toBeDefined();
  });

  it('module source imports PaymentsModule', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../webhook.module.ts'),
      'utf-8',
    );
    expect(source).toContain('PaymentsModule');
  });

  it('module source imports SubscriptionModule', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../webhook.module.ts'),
      'utf-8',
    );
    expect(source).toContain('SubscriptionModule');
  });

  it('module source registers WebhookController', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../webhook.module.ts'),
      'utf-8',
    );
    expect(source).toContain('WebhookController');
  });

  it('module source registers WebhookService and WebhookEventRepository', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../webhook.module.ts'),
      'utf-8',
    );
    expect(source).toContain('WebhookService');
    expect(source).toContain('WebhookEventRepository');
  });

  it('module source exports WebhookService', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../webhook.module.ts'),
      'utf-8',
    );
    expect(source).toContain('exports: [WebhookService]');
  });

  it('module source imports TypeOrmModule.forFeature with WebhookEvent and User', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../webhook.module.ts'),
      'utf-8',
    );
    expect(source).toContain('TypeOrmModule.forFeature([WebhookEvent, User])');
  });

  it('module does not import stripe', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../webhook.module.ts'),
      'utf-8',
    );
    expect(source).not.toContain("from 'stripe'");
  });

  it('AppModule imports WebhookModule', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(
        __dirname,
        '../../../app.module.ts',
      ),
      'utf-8',
    );
    expect(source).toContain('WebhookModule');
    expect(source).toContain('BILLING-READY-05D');
  });

  it('main.ts has rawBody: true', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(
        __dirname,
        '../../../main.ts',
      ),
      'utf-8',
    );
    expect(source).toContain('rawBody: true');
  });
});
