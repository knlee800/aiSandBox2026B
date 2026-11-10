import { Controller, Get } from '@nestjs/common';
import { InternalKeyExempt } from '../guards/internal-key-exempt.decorator';

@Controller('health')
export class HealthController {
  // CM-AUTH-01 (D2): the only container-manager route open without the key.
  @InternalKeyExempt()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'container-manager',
      timestamp: new Date().toISOString(),
    };
  }
}
