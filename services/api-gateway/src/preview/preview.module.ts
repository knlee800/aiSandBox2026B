import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PreviewController } from './preview.controller';
import { SessionModule } from '../sessions/session.module';
import { PreviewOwnershipGuard } from './preview-ownership.guard';
import { PreviewAccessGuard, previewHostRouteFilter } from './preview-access.guard';
import { PreviewEntryController } from './preview-entry.controller';
import { getProcessPreviewTickets, PreviewTickets } from './preview-ticket';

@Module({
  imports: [AuthModule, SessionModule],
  // PREVIEW-ORIGIN-01: PreviewEntryController first, so its enter route is
  // registered before PreviewController's catch-all.
  controllers: [PreviewEntryController, PreviewController],
  providers: [
    PreviewOwnershipGuard,
    PreviewAccessGuard,
    // One signer per process: the key is random bytes made at gateway start.
    { provide: PreviewTickets, useFactory: getProcessPreviewTickets },
  ],
})
export class PreviewModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // PREVIEW-ORIGIN-01: on the preview host only enter and proxy GET/HEAD
    // are served; a no-op on every other host.
    consumer.apply(previewHostRouteFilter).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
