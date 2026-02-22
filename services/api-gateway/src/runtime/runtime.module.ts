import { Module } from '@nestjs/common';
import { RuntimeController } from './runtime.controller';
import { RuntimeService } from './runtime.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';

/**
 * RuntimeModule
 * 
 * PHASE-41A: Runtime metrics and observability
 * Provides diagnostic visibility into session and container runtime state
 */
@Module({
  controllers: [RuntimeController],
  providers: [RuntimeService, ContainerManagerHttpClient],
})
export class RuntimeModule {}
