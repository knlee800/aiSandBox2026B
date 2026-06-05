import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAiInstructions } from '../entities/user-ai-instructions.entity';
import { UserAiInstructionsService } from './user-ai-instructions.service';

describe('UserAiInstructionsService (AI-CONTEXT-01A)', () => {
  let service: UserAiInstructionsService;
  let userAiInstructionsRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    userAiInstructionsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAiInstructionsService,
        {
          provide: getRepositoryToken(UserAiInstructions),
          useValue: userAiInstructionsRepository,
        },
      ],
    }).compile();

    service = module.get<UserAiInstructionsService>(UserAiInstructionsService);
  });

  it('getByUserId returns null when no record exists', async () => {
    userAiInstructionsRepository.findOne.mockResolvedValue(null);

    const result = await service.getByUserId('user-1');

    expect(userAiInstructionsRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(result).toBeNull();
  });

  it('upsert creates a new row when no record exists', async () => {
    userAiInstructionsRepository.findOne.mockResolvedValue(null);
    userAiInstructionsRepository.create.mockReturnValue({
      userId: 'user-1',
      globalInstructions: 'Be concise and cite docs',
    });
    userAiInstructionsRepository.save.mockResolvedValue({
      id: 'instructions-1',
      userId: 'user-1',
      globalInstructions: 'Be concise and cite docs',
    });

    const result = await service.upsert('user-1', 'Be concise and cite docs');

    expect(userAiInstructionsRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      globalInstructions: 'Be concise and cite docs',
    });
    expect(userAiInstructionsRepository.save).toHaveBeenCalledWith({
      userId: 'user-1',
      globalInstructions: 'Be concise and cite docs',
    });
    expect(result).toBe('Be concise and cite docs');
  });

  it('upsert updates existing row when record already exists', async () => {
    const existing = {
      id: 'instructions-1',
      userId: 'user-1',
      globalInstructions: 'Old value',
    };
    userAiInstructionsRepository.findOne.mockResolvedValue(existing);
    userAiInstructionsRepository.save.mockResolvedValue({
      ...existing,
      globalInstructions: 'Updated value',
    });

    const result = await service.upsert('user-1', 'Updated value');

    expect(userAiInstructionsRepository.create).not.toHaveBeenCalled();
    expect(userAiInstructionsRepository.save).toHaveBeenCalledWith({
      id: 'instructions-1',
      userId: 'user-1',
      globalInstructions: 'Updated value',
    });
    expect(result).toBe('Updated value');
  });
});
