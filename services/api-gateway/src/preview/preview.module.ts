import { Module } from '@nestjs/common';
import { PreviewController } from './preview.controller';
import { SessionModule } from '../sessions/session.module';
import { PreviewOwnershipGuard } from './preview-ownership.guard';

@Module({
  imports: [SessionModule],
  controllers: [PreviewController],
  providers: [PreviewOwnershipGuard],
})
export class PreviewModule {}
