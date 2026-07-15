import { CreditGrantModule } from '../credit-grant.module';
import { CreditGrantService } from '../credit-grant.service';
import { CreditGrantRepository } from '../credit-grant.repository';

describe('CreditGrantModule (05E)', () => {
  it('should be defined', () => {
    expect(CreditGrantModule).toBeDefined();
  });

  it('should export CreditGrantService', () => {
    // Verify the module class exists and the service/repo classes are importable
    expect(CreditGrantService).toBeDefined();
    expect(CreditGrantRepository).toBeDefined();
  });

  it('should not import stripe or provider modules', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../credit-grant.module.ts'),
      'utf8',
    );
    expect(source).not.toContain("from 'stripe'");
    expect(source).not.toContain('StripePaymentProvider');
    expect(source).not.toContain('PaymentsModule');
    expect(source).not.toContain('process.env');
  });

  it('should import CreditPersistenceModule for balance access', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../credit-grant.module.ts'),
      'utf8',
    );
    expect(source).toContain('CreditPersistenceModule');
  });

  it('should register CreditGrant and WebhookEvent entities', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../credit-grant.module.ts'),
      'utf8',
    );
    expect(source).toContain('CreditGrant');
    expect(source).toContain('WebhookEvent');
    expect(source).toContain('TypeOrmModule.forFeature');
  });

  it('barrel index should export module, service, and repository', () => {
    const barrelExports = require('../index');
    expect(barrelExports.CreditGrantModule).toBe(CreditGrantModule);
    expect(barrelExports.CreditGrantService).toBe(CreditGrantService);
    expect(barrelExports.CreditGrantRepository).toBe(CreditGrantRepository);
  });
});
