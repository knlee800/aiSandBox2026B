import { Injectable } from '@nestjs/common';
import {
  DEFAULT_MAX_AGENTS_PER_COLLABORATION,
  DEFAULT_MAX_REFERRAL_DEPTH,
  NO_WRITE_TOOLS_INDICATOR,
  READ_ONLY_ALLOWED_TOOL_IDS,
  READ_ONLY_BLOCKED_TOOL_IDS,
  READ_ONLY_MODE_INDICATOR,
  type ReferralConstraints,
} from './orchestration.contracts';

const DEFAULT_REFERRAL_TIMEOUT_MS = 300_000;

export interface ReadOnlyPolicy {
  readonly mode: typeof READ_ONLY_MODE_INDICATOR;
  readonly noWriteIndicator: typeof NO_WRITE_TOOLS_INDICATOR;
  readonly readOnly: true;
  readonly allowWriteTools: false;
  readonly allowedToolIds: readonly string[];
  readonly blockedToolIds: readonly string[];
}

@Injectable()
export class OrchestrationService {
  private readonly defaultReferralConstraints: ReferralConstraints = {
    timeoutMs: DEFAULT_REFERRAL_TIMEOUT_MS,
    maxDepth: DEFAULT_MAX_REFERRAL_DEPTH,
    maxAgentsPerCollaboration: DEFAULT_MAX_AGENTS_PER_COLLABORATION,
    readOnly: true,
    allowWriteTools: false,
    allowedTools: [...READ_ONLY_ALLOWED_TOOL_IDS],
  };

  getDefaultReferralConstraints(): ReferralConstraints {
    return {
      ...this.defaultReferralConstraints,
      allowedTools: [...this.defaultReferralConstraints.allowedTools],
    };
  }

  getReadOnlyPolicy(): ReadOnlyPolicy {
    return {
      mode: READ_ONLY_MODE_INDICATOR,
      noWriteIndicator: NO_WRITE_TOOLS_INDICATOR,
      readOnly: true,
      allowWriteTools: false,
      allowedToolIds: [...READ_ONLY_ALLOWED_TOOL_IDS],
      blockedToolIds: [...READ_ONLY_BLOCKED_TOOL_IDS],
    };
  }
}
