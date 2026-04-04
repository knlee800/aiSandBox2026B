import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardController (TASK-68B-3)', () => {
  let controller: AdminDashboardController;
  let service: jest.Mocked<AdminDashboardService>;

  beforeEach(async () => {
    const mockService = {
      getAdminUsers: jest.fn(),
      getAdminSessions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        {
          provide: AdminDashboardService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
    service = module.get(AdminDashboardService);
  });

  it('GET /api/internal/admin/users returns admin user visibility summary', async () => {
    service.getAdminUsers.mockResolvedValue({
      users: [
        {
          userId: 'user-1',
          email: 'user@example.com',
          role: 'user',
          planCode: 'free',
          planName: 'Free',
          planType: 'free',
          planStatus: 'active',
          isActive: true,
          activeSessions: 2,
          totalSessions: 5,
          sessionsCreated24h: 3,
          tokensUsed24h: 1000,
          estimatedCost: 0.01,
          quotaStatus: 'OK',
          createdAt: '2026-03-10T10:00:00.000Z',
        },
      ],
    });

    const result = await controller.getUsers('user@example.com', 'OK');

    expect(service.getAdminUsers).toHaveBeenCalledWith({
      search: 'user@example.com',
      quotaStatus: 'OK',
    });
    expect(result.users).toHaveLength(1);
  });

  it('GET /api/internal/admin/sessions returns admin session visibility summary', async () => {
    service.getAdminSessions.mockResolvedValue({
      sessions: [
        {
          sessionId: 'session-1',
          userId: 'user-1',
          userEmail: 'user@example.com',
          status: 'active',
          isTerminated: false,
          terminationReason: null,
          createdAt: '2026-03-10T10:00:00.000Z',
          lastActivityAt: '2026-03-10T10:10:00.000Z',
          expiresAt: '2026-03-10T12:00:00.000Z',
        },
      ],
    });

    const result = await controller.getSessions(
      'active',
      'user-1',
      '24h',
      undefined,
      undefined,
    );

    expect(service.getAdminSessions).toHaveBeenCalledWith({
      status: 'active',
      userId: 'user-1',
      dateRange: '24h',
      startDate: undefined,
      endDate: undefined,
    });
    expect(result.sessions).toHaveLength(1);
  });
});
