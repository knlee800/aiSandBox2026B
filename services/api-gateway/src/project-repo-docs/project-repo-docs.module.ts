import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectRepoDoc } from '../entities/project-repo-doc.entity';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectRepoDocsController } from './project-repo-docs.controller';
import { ProjectRepoDocsService } from './project-repo-docs.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectRepoDoc]), AuthModule, ProjectsModule],
  controllers: [ProjectRepoDocsController],
  providers: [ProjectRepoDocsService],
  exports: [ProjectRepoDocsService],
})
export class ProjectRepoDocsModule {}
