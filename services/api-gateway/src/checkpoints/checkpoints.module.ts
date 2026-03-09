import { Module } from '@nestjs/common';
import { CheckpointsController } from './checkpoints.controller';
import { CheckpointsService } from './checkpoints.service';
import { GitCheckpointModule } from '../git-checkpoints/git-checkpoint.module';
import { SessionModule } from '../sessions/session.module';

/**
 * CheckpointsModule
 * PHASE-68B: Public checkpoint history/control endpoints
 * Exposes git checkpoint system to frontend via REST APIs
 */
@Module({
  imports: [
    GitCheckpointModule, // For GitCheckpointService
    SessionModule, // For SessionService and ContainerManagerHttpClient
  ],
  controllers: [CheckpointsController],
  providers: [CheckpointsService],
  exports: [CheckpointsService],
})
export class CheckpointsModule {}
