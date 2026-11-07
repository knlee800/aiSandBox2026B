export const AGENT_STATUSES = ['active', 'coming_soon', 'disabled'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const AGENT_IDS = [
  'builder',
  'chief-of-staff',
  'product-strategy',
  'technology-advisor',
] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export type AgentModelCostTier = 'low' | 'medium' | 'high';

export interface AgentModelProfile {
  defaultModelId: string;
  fallbackModelId?: string;
  maxTokensPerTurn: number;
  maxTurnsPerSession: number;
  temperature: number;
  costTier: AgentModelCostTier;
}

export interface AgentToolPermissions {
  allowedTools: readonly string[];
  blockedTools: readonly string[];
  requireApprovalTools: readonly string[];
  maxToolCallsPerTurn: number;
  maxToolCallsPerSession: number;
}

export type AgentKnowledgeScopeType = 'shared' | 'specialist';

export interface AgentKnowledgeScopeRef {
  id: string;
  type: AgentKnowledgeScopeType;
}

export type AgentSkillCategory = 'core' | 'specialist' | 'integration';

export interface AgentSkillRef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  category: AgentSkillCategory;
  promptTemplateRef?: string;
  toolSet?: readonly string[];
  knowledgeScopeOverrides?: readonly string[];
}

export type AgentReferralType = 'review' | 'handoff' | 'consultation' | 'approval';
export type AgentReferralPriority = 'normal' | 'urgent';

export interface AgentReferralRule {
  id: string;
  triggerCondition: string;
  targetAgentId: AgentId;
  referralType: AgentReferralType;
  priority: AgentReferralPriority;
  autoCreate: boolean;
  requiresOwnerApproval: boolean;
}

export type AgentApprovalDefaultOnTimeout = 'block' | 'allow';

export interface AgentApprovalRule {
  id: string;
  actionType: string;
  requiresHumanApproval: boolean;
  requiresAgentApproval: readonly AgentId[];
  approvalTimeoutHours: number;
  defaultOnTimeout: AgentApprovalDefaultOnTimeout;
}

export type AgentTextTranslationKey = `agents.${string}`;

export interface AgentManifest {
  id: AgentId;
  nameKey: AgentTextTranslationKey;
  roleKey: AgentTextTranslationKey;
  descriptionKey: AgentTextTranslationKey;
  route: string;
  avatarRef: string;
  spriteRef?: string;
  status: AgentStatus;
  enabled: boolean;
  modelProfile: AgentModelProfile;
  toolPermissions: AgentToolPermissions;
  knowledgeScopes: readonly AgentKnowledgeScopeRef[];
  skills: readonly AgentSkillRef[];
  referralRules: readonly AgentReferralRule[];
  approvalRules: readonly AgentApprovalRule[];
  manifestVersion: number;
}

export interface PublicSystemAgent {
  id: string;
  nameKey: string;
  roleKey: string;
  descriptionKey: string;
  status: AgentStatus;
  enabled: boolean;
  knowledgeScopes: readonly AgentKnowledgeScopeRef[];
  version: string;
}

const VERSION_PATTERN = /^[0-9a-f]{64}$/;

export const BUILDER_FALLBACK_AGENT: PublicSystemAgent = {
  id: 'builder',
  nameKey: 'agents.builder.name',
  roleKey: 'agents.builder.role',
  descriptionKey: 'agents.builder.description',
  status: 'active',
  enabled: true,
  knowledgeScopes: [],
  version: 'fallback',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isAgentStatus(value: unknown): value is AgentStatus {
  return value === 'active' || value === 'coming_soon' || value === 'disabled';
}

function parseScope(value: unknown): AgentKnowledgeScopeRef | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  if (value.type !== 'shared' && value.type !== 'specialist') {
    return null;
  }
  return { id: value.id, type: value.type };
}

function parsePublicAgent(value: unknown): PublicSystemAgent | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  if (typeof value.nameKey !== 'string' || value.nameKey.length === 0) {
    return null;
  }
  if (typeof value.roleKey !== 'string' || value.roleKey.length === 0) {
    return null;
  }
  if (typeof value.descriptionKey !== 'string' || value.descriptionKey.length === 0) {
    return null;
  }
  if (!isAgentStatus(value.status) || typeof value.enabled !== 'boolean') {
    return null;
  }
  if (!Array.isArray(value.knowledgeScopes)) {
    return null;
  }
  const knowledgeScopes: AgentKnowledgeScopeRef[] = [];
  for (const scope of value.knowledgeScopes) {
    const parsed = parseScope(scope);
    if (!parsed) {
      return null;
    }
    knowledgeScopes.push(parsed);
  }
  if (typeof value.version !== 'string' || !VERSION_PATTERN.test(value.version)) {
    return null;
  }
  return {
    id: value.id,
    nameKey: value.nameKey,
    roleKey: value.roleKey,
    descriptionKey: value.descriptionKey,
    status: value.status,
    enabled: value.enabled,
    knowledgeScopes,
    version: value.version,
  };
}

export function parseSystemAgents(payload: unknown): PublicSystemAgent[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.agents) || payload.agents.length === 0) {
    return null;
  }
  const agents: PublicSystemAgent[] = [];
  for (const item of payload.agents) {
    const parsed = parsePublicAgent(item);
    if (!parsed) {
      return null;
    }
    agents.push(parsed);
  }
  return agents;
}

export function getAgentById(
  agents: readonly PublicSystemAgent[],
  id: string,
): PublicSystemAgent | undefined {
  return agents.find((agent) => agent.id === id);
}

export function listEnabledAgents(agents: readonly PublicSystemAgent[]): PublicSystemAgent[] {
  return agents.filter((agent) => agent.enabled);
}

export function listAgentsByStatus(
  agents: readonly PublicSystemAgent[],
  status: AgentStatus,
): PublicSystemAgent[] {
  return agents.filter((agent) => agent.status === status);
}
