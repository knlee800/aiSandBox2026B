import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAiInstructions } from '../entities/user-ai-instructions.entity';

@Injectable()
export class UserAiInstructionsService {
  constructor(
    @InjectRepository(UserAiInstructions)
    private readonly userAiInstructionsRepository: Repository<UserAiInstructions>,
  ) {}

  async getByUserId(userId: string): Promise<string | null> {
    const record = await this.userAiInstructionsRepository.findOne({
      where: { userId },
    });
    return record?.globalInstructions ?? null;
  }

  async upsert(
    userId: string,
    globalInstructions: string | null,
  ): Promise<string | null> {
    const existingRecord = await this.userAiInstructionsRepository.findOne({
      where: { userId },
    });

    if (existingRecord) {
      existingRecord.globalInstructions = globalInstructions;
      const savedRecord = await this.userAiInstructionsRepository.save(existingRecord);
      return savedRecord.globalInstructions ?? null;
    }

    const createdRecord = this.userAiInstructionsRepository.create({
      userId,
      globalInstructions,
    });
    const savedRecord = await this.userAiInstructionsRepository.save(createdRecord);
    return savedRecord.globalInstructions ?? null;
  }
}
