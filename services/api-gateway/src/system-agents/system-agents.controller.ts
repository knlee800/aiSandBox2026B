import { Controller, Get, Header, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { listPublicSystemAgents, type PublicSystemAgent } from './system-agent-registry';

@Controller('system-agents')
@UseGuards(SessionCookieGuard)
export class SystemAgentsController {
  @Get()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, no-store')
  list(): { agents: PublicSystemAgent[] } {
    return { agents: listPublicSystemAgents() };
  }
}
