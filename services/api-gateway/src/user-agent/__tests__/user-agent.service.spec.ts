import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAgent } from '../../entities/user-agent.entity';
import { UserAgentService } from '../user-agent.service';

describe('UserAgentService', () => {
  let service: UserAgentService;
  let userAgentRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    softDelete: jest.Mock;
    delete: jest.Mock;
    remove: jest.Mock;
    softRemove: jest.Mock;
  };

  const ownerUserId = 'user-a-uuid-111';
  const otherUserId = 'user-b-uuid-222';
  const agentId = 'agent-uuid-001';

  beforeEach(async () => {
    userAgentRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      softRemove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAgentService,
        {
          provide: getRepositoryToken(UserAgent),
          useValue: userAgentRepository,
        },
      ],
    }).compile();

    service = module.get<UserAgentService>(UserAgentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteByIdAndUserId', () => {
    it('soft-deletes the profile scoped by both id and userId', async () => {
      userAgentRepository.softDelete.mockResolvedValue({ affected: 1 });

      await expect(
        service.deleteByIdAndUserId(agentId, ownerUserId),
      ).resolves.toBeUndefined();

      expect(userAgentRepository.softDelete).toHaveBeenCalledTimes(1);
      expect(userAgentRepository.softDelete).toHaveBeenCalledWith({
        id: agentId,
        userId: ownerUserId,
      });
    });

    it('does not call repository hard-delete methods', async () => {
      userAgentRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.deleteByIdAndUserId(agentId, ownerUserId);

      expect(userAgentRepository.delete).not.toHaveBeenCalled();
      expect(userAgentRepository.remove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no owned row matches', async () => {
      userAgentRepository.softDelete.mockResolvedValue({ affected: 0 });

      await expect(
        service.deleteByIdAndUserId(agentId, ownerUserId),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(userAgentRepository.softDelete).toHaveBeenCalledWith({
        id: agentId,
        userId: ownerUserId,
      });
    });

    it('throws NotFoundException for a non-owned profile (never 403)', async () => {
      userAgentRepository.softDelete.mockResolvedValue({ affected: 0 });

      await expect(
        service.deleteByIdAndUserId(agentId, otherUserId),
      ).rejects.toThrow(NotFoundException);

      expect(userAgentRepository.softDelete).toHaveBeenCalledWith({
        id: agentId,
        userId: otherUserId,
      });
      expect(userAgentRepository.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for already-soft-deleted or missing profiles', async () => {
      userAgentRepository.softDelete.mockResolvedValue({ affected: 0 });

      await expect(
        service.deleteByIdAndUserId('missing-or-deleted-id', ownerUserId),
      ).rejects.toThrow('Not Found');
    });

    it('does not succeed silently when affected is null or undefined', async () => {
      userAgentRepository.softDelete.mockResolvedValue({ affected: null });

      await expect(
        service.deleteByIdAndUserId(agentId, ownerUserId),
      ).rejects.toBeInstanceOf(NotFoundException);

      userAgentRepository.softDelete.mockResolvedValue({});

      await expect(
        service.deleteByIdAndUserId(agentId, ownerUserId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('existing TypeORM soft-delete filtering', () => {
    it('listByUserId queries by userId without withDeleted', async () => {
      userAgentRepository.find.mockResolvedValue([]);

      await service.listByUserId(ownerUserId);

      expect(userAgentRepository.find).toHaveBeenCalledWith({
        where: { userId: ownerUserId },
        order: { createdAt: 'DESC' },
      });
      const findArgs = userAgentRepository.find.mock.calls[0][0];
      expect(findArgs).not.toHaveProperty('withDeleted');
    });

    it('findOneByIdAndUserId queries by id and userId without withDeleted', async () => {
      userAgentRepository.findOne.mockResolvedValue(null);

      await service.findOneByIdAndUserId(agentId, ownerUserId);

      expect(userAgentRepository.findOne).toHaveBeenCalledWith({
        where: { id: agentId, userId: ownerUserId },
      });
      const findOneArgs = userAgentRepository.findOne.mock.calls[0][0];
      expect(findOneArgs).not.toHaveProperty('withDeleted');
    });
  });
});
