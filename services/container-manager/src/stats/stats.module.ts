import { Module } from '@nestjs/common';
import { InternalStatsController } from './internal-stats.controller';
import { StatsService } from './stats.service';
import { DockerModule } from '../docker/docker.module';

/**
 * StatsModule
 * 
 * PHASE-41A: Container runtime statistics
 * Provides minimal stats for api-gateway metrics endpoint
 */
@Module({
  imports: [DockerModule],
  controllers: [InternalStatsController],
  providers: [StatsService],
})
export class StatsModule {}
