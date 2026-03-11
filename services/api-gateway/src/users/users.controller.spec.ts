import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('UsersController (TASK-68B-2)', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const mockUsersService = {
      getCurrentUser: jest.fn(),
      getUsage: jest.fn(),
      getQuotas: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  it('applies JwtAuthGuard at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', UsersController) || [];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('GET /api/users/me returns current user info', async () => {
    usersService.getCurrentUser.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com',
      createdAt: '2026-03-10T10:00:00.000Z',
    });

    const result = await controller.getCurrentUser({
      user: { userId: 'user-1' },
    });

    expect(usersService.getCurrentUser).toHaveBeenCalledWith('user-1');
    expect(result.userId).toBe('user-1');
  });

  it('GET /api/users/me/usage returns usage summary', async () => {
    usersService.getUsage.mockResolvedValue({
      activeSessions: 3,
      sessionsCreated24h: 8,
      tokensUsed24h: 45230,
      estimatedCost: 0.452,
      resetAt: '2026-03-10T20:00:00.000Z',
    });

    const result = await controller.getUsage({
      user: { userId: 'user-1' },
    });

    expect(usersService.getUsage).toHaveBeenCalledWith('user-1');
    expect(result.tokensUsed24h).toBe(45230);
  });

  it('GET /api/users/me/quotas returns quota summary', async () => {
    usersService.getQuotas.mockResolvedValue({
      maxActiveSessions: 5,
      currentActiveSessions: 3,
      maxSessions24h: 20,
      currentSessions24h: 8,
      maxTokens24h: 100000,
      currentTokens24h: 45230,
      resetAt: '2026-03-10T20:00:00.000Z',
    });

    const result = await controller.getQuotas({
      user: { userId: 'user-1' },
    });

    expect(usersService.getQuotas).toHaveBeenCalledWith('user-1');
    expect(result.maxTokens24h).toBe(100000);
  });

  it('propagates service errors for invalid user state', async () => {
    usersService.getCurrentUser.mockRejectedValue(
      new UnauthorizedException('User not found'),
    );

    await expect(
      controller.getCurrentUser({ user: { userId: 'missing-user' } }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('propagates service errors for usage/quota endpoints', async () => {
    usersService.getUsage.mockRejectedValue(
      new UnauthorizedException('User not found'),
    );
    usersService.getQuotas.mockRejectedValue(
      new UnauthorizedException('User not found'),
    );

    await expect(
      controller.getUsage({ user: { userId: 'missing-user' } }),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      controller.getQuotas({ user: { userId: 'missing-user' } }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
