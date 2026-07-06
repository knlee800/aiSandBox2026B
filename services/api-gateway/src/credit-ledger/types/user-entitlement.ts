/**
 * Agent access entitlement model.
 */
export type AgentAccessTier =
  | 'builder_only'
  | 'builder_plus_one_future_specialist'
  | 'all_current_and_future';

export interface AgentAccessEntitlement {
  accessTier: AgentAccessTier;
  allowedAgentIds: readonly string[];
  futureSpecialistAllowance: number;
}

/**
 * Tool access entitlement model.
 */
export type ToolAccessTier = 'core' | 'standard' | 'all';

export interface ToolAccessEntitlement {
  accessTier: ToolAccessTier;
  allowedToolIds: readonly string[];
}

/**
 * Knowledge entitlement model.
 */
export interface KnowledgeEntitlement {
  ingestionEnabled: boolean;
  summarizationEnabled: boolean;
  maxKnowledgeItemsPerMonth: number;
}

/**
 * Collaboration entitlement model.
 */
export interface CollaborationEntitlement {
  referralEnabled: boolean;
  contributionEnabled: boolean;
  maxCollaborators: number;
}

/**
 * Combined entitlement model for a user or plan.
 */
export interface UserEntitlement {
  userId: string;
  planId: string;
  agentAccess: AgentAccessEntitlement;
  toolAccess: ToolAccessEntitlement;
  knowledgeAccess: KnowledgeEntitlement;
  collaborationAccess: CollaborationEntitlement;
}
