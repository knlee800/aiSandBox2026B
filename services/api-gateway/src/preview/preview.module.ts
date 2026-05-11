import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PreviewController } from './preview.controller';
import { SessionModule } from '../sessions/session.module';
import { PreviewOwnershipGuard } from './preview-ownership.guard';

@Module({
  imports: [AuthModule, SessionModule],
  controllers: [PreviewController],
  providers: [PreviewOwnershipGuard],
})
export class PreviewModule {}
