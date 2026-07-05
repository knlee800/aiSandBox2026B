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

const BUILDER_MODEL_PROFILE: AgentModelProfile = {
  defaultModelId: 'gpt-5.3-codex-high',
  fallbackModelId: 'claude-4.6-sonnet-medium-thinking',
  maxTokensPerTurn: 12_000,
  maxTurnsPerSession: 12,
  temperature: 0.2,
  costTier: 'medium',
};

const PLACEHOLDER_MODEL_PROFILE: AgentModelProfile = {
  defaultModelId: 'claude-4.6-sonnet-medium-thinking',
  fallbackModelId: 'gpt-5.3-codex-high',
  maxTokensPerTurn: 8_000,
  maxTurnsPerSession: 8,
  temperature: 0.2,
  costTier: 'low',
};

const BUILDER_TOOL_PERMISSIONS: AgentToolPermissions = {
  allowedTools: [
    'workspace.files.read',
    'workspace.files.write',
    'workspace.preview.run',
    'workspace.checkpoint.create',
    'workspace.validation.run',
  ],
  blockedTools: [],
  requireApprovalTools: ['workspace.files.delete', 'workspace.shell.exec'],
  maxToolCallsPerTurn: 12,
  maxToolCallsPerSession: 200,
};

const PLACEHOLDER_TOOL_PERMISSIONS: AgentToolPermissions = {
  allowedTools: [],
  blockedTools: ['*'],
  requireApprovalTools: [],
  maxToolCallsPerTurn: 1,
  maxToolCallsPerSession: 1,
};

export const AGENT_MANIFESTS: readonly AgentManifest[] = [
  {
    id: 'builder',
    nameKey: 'agents.builder.name',
    roleKey: 'agents.builder.role',
    descriptionKey: 'agents.builder.description',
    route: '/app',
    avatarRef: 'builder',
    spriteRef: 'builder-idle',
    status: 'active',
    enabled: true,
    modelProfile: BUILDER_MODEL_PROFILE,
    toolPermissions: BUILDER_TOOL_PERMISSIONS,
    knowledgeScopes: [
      { id: 'company-monthly-reports', type: 'shared' },
      { id: 'three-year-goals', type: 'shared' },
      { id: 'strategy-docs', type: 'shared' },
      { id: 'policies', type: 'shared' },
      { id: 'meeting-summaries', type: 'shared' },
      { id: 'codebase-context', type: 'specialist' },
    ],
    skills: [],
    referralRules: [],
    approvalRules: [],
    manifestVersion: 1,
  },
  {
    id: 'chief-of-staff',
    nameKey: 'agents.chiefOfStaff.name',
    roleKey: 'agents.chiefOfStaff.role',
    descriptionKey: 'agents.chiefOfStaff.description',
    route: '/agents/chief-of-staff',
    avatarRef: 'chief-of-staff',
    status: 'coming_soon',
    enabled: false,
    modelProfile: PLACEHOLDER_MODEL_PROFILE,
    toolPermissions: PLACEHOLDER_TOOL_PERMISSIONS,
    knowledgeScopes: [
      { id: 'company-monthly-reports', type: 'shared' },
      { id: 'three-year-goals', type: 'shared' },
      { id: 'strategy-docs', type: 'shared' },
      { id: 'policies', type: 'shared' },
      { id: 'meeting-summaries', type: 'shared' },
      { id: 'contract-templates', type: 'specialist' },
    ],
    skills: [],
    referralRules: [],
    approvalRules: [],
    manifestVersion: 1,
  },
  {
    id: 'product-strategy',
    nameKey: 'agents.productStrategy.name',
    roleKey: 'agents.productStrategy.role',
    descriptionKey: 'agents.productStrategy.description',
    route: '/agents/product-strategy',
    avatarRef: 'product-strategy',
    status: 'coming_soon',
    enabled: false,
    modelProfile: PLACEHOLDER_MODEL_PROFILE,
    toolPermissions: PLACEHOLDER_TOOL_PERMISSIONS,
    knowledgeScopes: [
      { id: 'company-monthly-reports', type: 'shared' },
      { id: 'three-year-goals', type: 'shared' },
      { id: 'strategy-docs', type: 'shared' },
      { id: 'policies', type: 'shared' },
      { id: 'meeting-summaries', type: 'shared' },
      { id: 'market-data', type: 'specialist' },
    ],
    skills: [],
    referralRules: [],
    approvalRules: [],
    manifestVersion: 1,
  },
  {
    id: 'technology-advisor',
    nameKey: 'agents.technologyAdvisor.name',
    roleKey: 'agents.technologyAdvisor.role',
    descriptionKey: 'agents.technologyAdvisor.description',
    route: '/agents/technology-advisor',
    avatarRef: 'technology-advisor',
    status: 'coming_soon',
    enabled: false,
    modelProfile: PLACEHOLDER_MODEL_PROFILE,
    toolPermissions: PLACEHOLDER_TOOL_PERMISSIONS,
    knowledgeScopes: [
      { id: 'company-monthly-reports', type: 'shared' },
      { id: 'three-year-goals', type: 'shared' },
      { id: 'strategy-docs', type: 'shared' },
      { id: 'policies', type: 'shared' },
      { id: 'meeting-summaries', type: 'shared' },
      { id: 'tech-landscape', type: 'specialist' },
    ],
    skills: [],
    referralRules: [],
    approvalRules: [],
    manifestVersion: 1,
  },
] as const;

const AGENT_MANIFEST_BY_ID: ReadonlyMap<AgentId, AgentManifest> = new Map(
  AGENT_MANIFESTS.map((agent) => [agent.id, agent] as const),
);

export function listAgents(): readonly AgentManifest[] {
  return AGENT_MANIFESTS;
}

export function getAgentById(id: string): AgentManifest | undefined {
  return AGENT_MANIFEST_BY_ID.get(id as AgentId);
}

export function listEnabledAgents(): readonly AgentManifest[] {
  return AGENT_MANIFESTS.filter((agent) => agent.enabled);
}

export function listAgentsByStatus(status: AgentStatus): readonly AgentManifest[] {
  return AGENT_MANIFESTS.filter((agent) => agent.status === status);
}
