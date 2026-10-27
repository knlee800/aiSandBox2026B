import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { GitCheckpoint } from '../entities/git-checkpoint.entity';
import { Session } from '../entities/session.entity';
import { GitCheckpointRepository } from '../repositories/git-checkpoint.repository';
import { GitCheckpointService } from './git-checkpoint.service';
import { InternalGitCheckpointController } from './internal-git-checkpoint.controller';

/**
 * GitCheckpointModule
 * Manages git checkpoint tracking and timeline persistence
 * Append-only ledger for version control history
 */
@Module({
  imports: [
    // Register GitCheckpoint entity for TypeORM
    TypeOrmModule.forFeature([GitCheckpoint, Session]),
  ],
  controllers: [InternalGitCheckpointController],
  providers: [GitCheckpointRepository, GitCheckpointService, ContainerManagerHttpClient],
  exports: [GitCheckpointService, GitCheckpointRepository],
})
export class GitCheckpointModule {}
