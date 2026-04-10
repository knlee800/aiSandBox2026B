import { Module } from '@nestjs/common';
import { PreviewService } from './preview.service';
import { PreviewController } from './preview.controller';
import { SessionsModule } from '../sessions/sessions.module';
import { DockerModule } from '../docker/docker.module';

@Module({
  imports: [SessionsModule, DockerModule],
  controllers: [PreviewController],
  providers: [PreviewService],
  exports: [PreviewService],
})
export class PreviewModule {}
