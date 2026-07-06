import type {
  AgentAccessEntitlement,
  CollaborationEntitlement,
  KnowledgeEntitlement,
  ToolAccessEntitlement,
} from './user-entitlement';

export const PLAN_IDS = ['free', 'starter', 'pro', 'team'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/**
 * Stable monthly credit allocations for the first credit-ledger foundation slice.
 */
export const MONTHLY_CREDIT_ALLOCATIONS: Readonly<Record<PlanId, number>> = {
  free: 500,
  starter: 5000,
  pro: 25000,
  team: 100000,
} as const;

export interface IncludedEntitlement {
  agentAccess: AgentAccessEntitlement;
  toolAccess: ToolAccessEntitlement;
  knowledgeAccess: KnowledgeEntitlement;
  collaborationAccess: CollaborationEntitlement;
}

export interface PlanDefinition {
  id: PlanId;
  displayName: string;
  order: number;
  monthlyCredits: number;
  includedEntitlements: IncludedEntitlement;
}
