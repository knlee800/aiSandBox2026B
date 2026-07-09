import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationService } from '../orchestration.service';
import {
  DEFAULT_MAX_AGENTS_PER_COLLABORATION,
  DEFAULT_MAX_REFERRAL_DEPTH,
  NO_WRITE_TOOLS_INDICATOR,
  READ_ONLY_BLOCKED_TOOL_IDS,
  READ_ONLY_MODE_INDICATOR,
} from '../orchestration.contracts';

describe('OrchestrationService', () => {
  let service: OrchestrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrchestrationService],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
  });

  it('is defined via Nest testing module', () => {
    expect(service).toBeDefined();
  });

  it('returns default read-only referral constraints', () => {
    const constraints = service.getDefaultReferralConstraints();

    expect(constraints.maxDepth).toBe(DEFAULT_MAX_REFERRAL_DEPTH);
    expect(constraints.maxAgentsPerCollaboration).toBe(
      DEFAULT_MAX_AGENTS_PER_COLLABORATION,
    );
    expect(constraints.readOnly).toBe(true);
    expect(constraints.allowWriteTools).toBe(false);
    expect(constraints.allowedTools).toEqual(['list_files', 'read_file']);
  });

  it('returns a read-only policy that blocks write tools', () => {
    const policy = service.getReadOnlyPolicy();

    expect(policy.mode).toBe(READ_ONLY_MODE_INDICATOR);
    expect(policy.noWriteIndicator).toBe(NO_WRITE_TOOLS_INDICATOR);
    expect(policy.readOnly).toBe(true);
    expect(policy.allowWriteTools).toBe(false);
    expect(policy.blockedToolIds).toEqual([...READ_ONLY_BLOCKED_TOOL_IDS]);
  });
});
