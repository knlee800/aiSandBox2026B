import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RuntimeController } from './runtime.controller';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';

describe('RuntimeController guard metadata', () => {
  it('protects the controller with InternalServiceAuthGuard', () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, RuntimeController) ?? [];

    expect(guards).toContain(InternalServiceAuthGuard);
  });
});
