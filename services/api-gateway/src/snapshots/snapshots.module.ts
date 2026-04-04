import { Module } from '@nestjs/common';
import { SnapshotPersistenceService } from './snapshot-persistence.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { WorkspaceArchiveService } from './workspace-archive.service';

@Module({
  providers: [
    SnapshotPersistenceService,
    WorkspaceArchiveService,
    ContainerManagerHttpClient,
  ],
  exports: [SnapshotPersistenceService, WorkspaceArchiveService],
})
export class SnapshotsModule {}
