import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectAiContext } from '../entities/project-ai-context.entity';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectAiContextController } from './project-ai-context.controller';
import { ProjectAiContextService } from './project-ai-context.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectAiContext]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [ProjectAiContextController],
  providers: [ProjectAiContextService],
  exports: [ProjectAiContextService],
})
export class ProjectAiContextModule {}
