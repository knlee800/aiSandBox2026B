import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TokenUsageController } from './token-usage.controller';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';

describe('TokenUsageController guard metadata', () => {
  it('protects the controller with InternalServiceAuthGuard', () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, TokenUsageController) ?? [];

    expect(guards).toContain(InternalServiceAuthGuard);
  });
});
