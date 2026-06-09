import { Module } from '@nestjs/common';
import { PreviewService } from './preview.service';
import { PreviewController } from './preview.controller';
import { PreviewStrategyResolver } from './preview-strategy.resolver';
import { SessionsModule } from '../sessions/sessions.module';
import { DockerModule } from '../docker/docker.module';

@Module({
  imports: [SessionsModule, DockerModule],
  controllers: [PreviewController],
  providers: [PreviewService, PreviewStrategyResolver],
  exports: [PreviewService],
})
export class PreviewModule {}
