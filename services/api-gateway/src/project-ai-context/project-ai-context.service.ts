import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectAiContext } from '../entities/project-ai-context.entity';

@Injectable()
export class ProjectAiContextService {
  constructor(
    @InjectRepository(ProjectAiContext)
    private readonly projectAiContextRepository: Repository<ProjectAiContext>,
  ) {}

  async getByProjectId(projectId: string): Promise<string | null> {
    const record = await this.projectAiContextRepository.findOne({
      where: { projectId },
    });
    return record?.projectInstructions ?? null;
  }

  async upsert(
    projectId: string,
    projectInstructions: string | null,
  ): Promise<string | null> {
    const existingRecord = await this.projectAiContextRepository.findOne({
      where: { projectId },
    });

    if (existingRecord) {
      existingRecord.projectInstructions = projectInstructions;
      const savedRecord = await this.projectAiContextRepository.save(existingRecord);
      return savedRecord.projectInstructions ?? null;
    }

    const createdRecord = this.projectAiContextRepository.create({
      projectId,
      projectInstructions,
    });
    const savedRecord = await this.projectAiContextRepository.save(createdRecord);
    return savedRecord.projectInstructions ?? null;
  }
}
