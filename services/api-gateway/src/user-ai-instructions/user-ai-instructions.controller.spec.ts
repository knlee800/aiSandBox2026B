import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { UpsertUserAiInstructionsDto } from './dto/upsert-user-ai-instructions.dto';
import { UserAiInstructionsController } from './user-ai-instructions.controller';
import { UserAiInstructionsService } from './user-ai-instructions.service';

describe('UserAiInstructionsController (AI-CONTEXT-01A)', () => {
  let controller: UserAiInstructionsController;
  let userAiInstructionsService: jest.Mocked<UserAiInstructionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAiInstructionsController],
      providers: [
        {
          provide: UserAiInstructionsService,
          useValue: {
            getByUserId: jest.fn(),
            upsert: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SessionCookieGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserAiInstructionsController>(
      UserAiInstructionsController,
    );
    userAiInstructionsService = module.get(UserAiInstructionsService);
  });

  it('applies SessionCookieGuard at controller level', () => {
    const guards =
      Reflect.getMetadata('__guards__', UserAiInstructionsController) || [];
    expect(guards).toContain(SessionCookieGuard);
  });

  it('GET maps response shape to { globalInstructions }', async () => {
    userAiInstructionsService.getByUserId.mockResolvedValue('Use repo docs first');

    const result = await controller.getGlobalInstructions({
      user: { userId: 'user-1' },
    });

    expect(userAiInstructionsService.getByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ globalInstructions: 'Use repo docs first' });
  });

  it('PUT maps response shape to { globalInstructions }', async () => {
    userAiInstructionsService.upsert.mockResolvedValue('Updated instructions');

    const result = await controller.upsertGlobalInstructions(
      { user: { userId: 'user-1' } },
      { globalInstructions: 'Updated instructions' },
    );

    expect(userAiInstructionsService.upsert).toHaveBeenCalledWith(
      'user-1',
      'Updated instructions',
    );
    expect(result).toEqual({ globalInstructions: 'Updated instructions' });
  });

  it('DTO rejects globalInstructions over 4000 chars', async () => {
    const dto = new UpsertUserAiInstructionsDto();
    dto.globalInstructions = 'x'.repeat(4001);

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('globalInstructions');
    expect(errors[0].constraints?.maxLength).toBeDefined();
  });
});
