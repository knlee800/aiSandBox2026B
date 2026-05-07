import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ChatMessageController } from './chat-message.controller';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';

describe('ChatMessageController guard metadata', () => {
  it('protects the controller with InternalServiceAuthGuard', () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, ChatMessageController) ?? [];

    expect(guards).toContain(InternalServiceAuthGuard);
  });
});
