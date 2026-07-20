import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAgent } from '../entities/user-agent.entity';
import { CreateAgentDto } from './dto/create-agent.dto';

@Injectable()
export class UserAgentService {
  constructor(
    @InjectRepository(UserAgent)
    private readonly userAgentRepository: Repository<UserAgent>,
  ) {}

  async create(userId: string, dto: CreateAgentDto): Promise<UserAgent> {
    const initials = dto.initials ?? this.computeInitials(dto.name);

    const agent = this.userAgentRepository.create({
      userId,
      name: dto.name,
      role: dto.role,
      description: dto.description,
      status: dto.status ?? 'active',
      initials,
    });

    return this.userAgentRepository.save(agent);
  }

  async listByUserId(userId: string): Promise<UserAgent[]> {
    return this.userAgentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<UserAgent | null> {
    return this.userAgentRepository.findOne({
      where: { id, userId },
    });
  }

  private computeInitials(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return words[0].substring(0, 2).toUpperCase();
  }
}
