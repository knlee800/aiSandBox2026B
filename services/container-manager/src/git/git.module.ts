import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GitController } from './git.controller';
import { InternalCheckpointHistoryController } from './internal-checkpoint-history.controller';
import { InternalWorktreeDiffController } from './internal-worktree-diff.controller';
import { GitService } from './git.service';
import { SessionsModule } from '../sessions/sessions.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [SessionsModule, HttpModule, ClientsModule],
  controllers: [GitController, InternalCheckpointHistoryController, InternalWorktreeDiffController],
  providers: [GitService],
  exports: [GitService],
})
export class GitModule {}
