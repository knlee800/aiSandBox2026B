import { Module } from '@nestjs/common';
import { SnapshotPersistenceService } from './snapshot-persistence.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';

@Module({
  providers: [SnapshotPersistenceService, ContainerManagerHttpClient],
  exports: [SnapshotPersistenceService],
})
export class SnapshotsModule {}
