import {
  MONTHLY_CREDIT_ALLOCATIONS,
  type PlanDefinition,
} from '../types';

const BUILDER_AGENT_ID = 'builder';

/**
 * Static plan definitions for BILLING-READY-01 foundation.
 * These are additive domain config values only (no payment/runtime behavior).
 */
export const PLAN_DEFINITIONS = [
  {
    id: 'free',
    displayName: 'Free',
    order: 1,
    monthlyCredits: MONTHLY_CREDIT_ALLOCATIONS.free,
    includedEntitlements: {
      agentAccess: {
        accessTier: 'builder_only',
        allowedAgentIds: [BUILDER_AGENT_ID],
        futureSpecialistAllowance: 0,
      },
      toolAccess: {
        accessTier: 'core',
        allowedToolIds: ['editor', 'terminal'],
      },
      knowledgeAccess: {
        ingestionEnabled: false,
        summarizationEnabled: false,
        maxKnowledgeItemsPerMonth: 0,
      },
      collaborationAccess: {
        referralEnabled: false,
        contributionEnabled: false,
        maxCollaborators: 0,
      },
    },
  },
  {
    id: 'starter',
    displayName: 'Starter',
    order: 2,
    monthlyCredits: MONTHLY_CREDIT_ALLOCATIONS.starter,
    includedEntitlements: {
      agentAccess: {
        accessTier: 'builder_only',
        allowedAgentIds: [BUILDER_AGENT_ID],
        futureSpecialistAllowance: 0,
      },
      toolAccess: {
        accessTier: 'standard',
        allowedToolIds: ['editor', 'terminal', 'browser'],
      },
      knowledgeAccess: {
        ingestionEnabled: true,
        summarizationEnabled: true,
        maxKnowledgeItemsPerMonth: 25,
      },
      collaborationAccess: {
        referralEnabled: true,
        contributionEnabled: false,
        maxCollaborators: 2,
      },
    },
  },
  {
    id: 'pro',
    displayName: 'Pro',
    order: 3,
    monthlyCredits: MONTHLY_CREDIT_ALLOCATIONS.pro,
    includedEntitlements: {
      agentAccess: {
        accessTier: 'builder_plus_one_future_specialist',
        allowedAgentIds: [BUILDER_AGENT_ID],
        futureSpecialistAllowance: 1,
      },
      toolAccess: {
        accessTier: 'standard',
        allowedToolIds: ['editor', 'terminal', 'browser', 'validation'],
      },
      knowledgeAccess: {
        ingestionEnabled: true,
        summarizationEnabled: true,
        maxKnowledgeItemsPerMonth: 250,
      },
      collaborationAccess: {
        referralEnabled: true,
        contributionEnabled: true,
        maxCollaborators: 10,
      },
    },
  },
  {
    id: 'team',
    displayName: 'Team',
    order: 4,
    monthlyCredits: MONTHLY_CREDIT_ALLOCATIONS.team,
    includedEntitlements: {
      agentAccess: {
        accessTier: 'all_current_and_future',
        allowedAgentIds: ['*'],
        futureSpecialistAllowance: Number.MAX_SAFE_INTEGER,
      },
      toolAccess: {
        accessTier: 'all',
        allowedToolIds: ['*'],
      },
      knowledgeAccess: {
        ingestionEnabled: true,
        summarizationEnabled: true,
        maxKnowledgeItemsPerMonth: 5000,
      },
      collaborationAccess: {
        referralEnabled: true,
        contributionEnabled: true,
        maxCollaborators: 100,
      },
    },
  },
] as const satisfies readonly PlanDefinition[];
