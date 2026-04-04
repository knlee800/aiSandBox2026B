import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Session } from '../entities/session.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SessionModule } from '../sessions/session.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Session]),
    SessionModule,
    SnapshotsModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
