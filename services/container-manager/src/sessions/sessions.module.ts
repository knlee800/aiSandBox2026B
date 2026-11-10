import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { InternalSessionsController } from './internal-sessions.controller';
import { SessionsService } from './sessions.service';
import { ClientsModule } from '../clients/clients.module';
import { DockerModule } from '../docker/docker.module';
import { PreviewService } from '../previews/preview.service';
import { PreviewProxyService } from '../previews/preview-proxy.service';
import { InternalPreviewsController } from '../previews/internal-previews.controller';
import { GovernanceEventsService } from '../governance/governance-events.service';
import { UsageModule } from '../usage/usage.module';
import { BrowserSmokeService } from '../browser-smoke/browser-smoke.service';

@Module({
  imports: [ClientsModule, DockerModule, UsageModule],
  controllers: [
    SessionsController,
    InternalSessionsController,
    InternalPreviewsController,
  ],
  providers: [SessionsService, PreviewService, PreviewProxyService, GovernanceEventsService, BrowserSmokeService],
  exports: [SessionsService],
})
export class SessionsModule {}
