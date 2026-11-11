import type {
  CreateAgentDto,
  CreateAgentFromTemplateDto,
  UpdateAgentDto,
  UserAgent,
  UserAgentApprovalMode,
  UserAgentModel,
  UserAgentNeverDoItem,
  UserAgentOptions,
  UserAgentReplyLanguage,
} from '@/hooks/useUserAgents';

/**
 * BIZ-USER-01B: the pure part of the workflow editor. Field mapping to request
 * bodies, the limits check, refusal-code mapping and the lines the editor shows.
 * No React here, so the tests run it directly.
 */

export const REPLY_LANGUAGE_CHOICES: readonly UserAgentReplyLanguage[] = ['owner', 'en', 'zh-TW', 'zh-CN'];

/** Used only until the options route answers; the server's numbers win. */
export const DEFAULT_WORKFLOW_LIMITS: UserAgentOptions['limits'] = {
  maxInstructionsChars: 4000,
  maxToneChars: 120,
  maxKnowledgeScopes: 9,
  maxBudgetCredits: 1_000_000,
  platformDailyCreditsPerUser: 500,
};

export const MAX_NAME_CHARS = 100;
export const MAX_ROLE_CHARS = 200;
export const MAX_DESCRIPTION_CHARS = 2000;

export interface WorkflowDraft {
  name: string;
  role: string;
  description: string;
  tone: string;
  /** '' means not set. */
  replyLanguage: '' | UserAgentReplyLanguage;
  purpose: string;
  procedure: string;
  result: string;
  knowledgeScopeIds: string[];
  connectorToolIds: string[];
  /** 'server' or a platform model id. */
  modelChoice: string;
  budgetPerRun: string;
  budgetPerDay: string;
  /** USER-TEAMS-01: the ticked team members, in order; at most WORKFLOW_TEAM_MAX. */
  teamMemberIds: string[];
  /** APPROVAL-SET-01: how hand-offs are approved. */
  approvalMode: UserAgentApprovalMode;
  /** The credit limit as typed, for 'credits'; '' otherwise. */
  approvalCreditLimit: string;
}

/** The three approval choices, in the order the form shows them. */
export const APPROVAL_MODES: readonly UserAgentApprovalMode[] = ['every', 'read_only', 'credits'];

/** The server's limit range for the approval credit amount: 1 up to 1,000,000. */
export const APPROVAL_CREDIT_LIMIT_MAX = 1_000_000;

/** A stored mode we do not know reads as 'every', the safe default. */
export function readApprovalMode(value: unknown): UserAgentApprovalMode {
  return value === 'credits' || value === 'read_only' ? value : 'every';
}

/** At most three members; the workflow itself is the lead. Same limit as the Chief of Staff roster. */
export const WORKFLOW_TEAM_MAX = 3;

export function emptyWorkflowDraft(): WorkflowDraft {
  return {
    name: '',
    role: '',
    description: '',
    tone: '',
    replyLanguage: '',
    purpose: '',
    procedure: '',
    result: '',
    knowledgeScopeIds: [],
    connectorToolIds: [],
    modelChoice: 'server',
    budgetPerRun: '',
    budgetPerDay: '',
    teamMemberIds: [],
    approvalMode: 'every',
    approvalCreditLimit: '',
  };
}

/** WORKFLOW-CREATE-01: a template's card text, in the owner's language, used to prefill a copy. */
export interface TemplatePrefill {
  role: string;
  description: string;
}

/**
 * WORKFLOW-CREATE-01: Role and Description when the owner picks where to start.
 * An empty field, or one still holding the previous template's text, takes the
 * next template's text ('' when going back to blank). Text the owner typed stays.
 */
export function templatePrefillPatch(
  draft: Pick<WorkflowDraft, 'role' | 'description'>,
  previous: TemplatePrefill | null,
  next: TemplatePrefill | null,
): Pick<WorkflowDraft, 'role' | 'description'> {
  const swap = (current: string, before: string | undefined, after: string | undefined): string =>
    current.trim() === '' || (before !== undefined && current === before) ? (after ?? '') : current;
  return {
    role: swap(draft.role, previous?.role, next?.role),
    description: swap(draft.description, previous?.description, next?.description),
  };
}

export function workflowDraftFromAgent(agent: UserAgent): WorkflowDraft {
  return {
    name: agent.name,
    role: agent.role,
    description: agent.description,
    tone: agent.tone ?? '',
    replyLanguage: agent.replyLanguage ?? '',
    purpose: agent.purpose ?? '',
    procedure: agent.procedure ?? '',
    result: agent.result ?? '',
    knowledgeScopeIds: [...(agent.knowledgeScopeIds ?? [])],
    connectorToolIds: [...(agent.connectorToolIds ?? [])],
    modelChoice: agent.model?.choice === 'platform' ? agent.model.id : 'server',
    budgetPerRun: agent.budgetPerRunCredits == null ? '' : String(agent.budgetPerRunCredits),
    budgetPerDay: agent.budgetPerDayCredits == null ? '' : String(agent.budgetPerDayCredits),
    teamMemberIds: [...(agent.teamMemberIds ?? [])],
    approvalMode: readApprovalMode(agent.approvalMode),
    approvalCreditLimit:
      readApprovalMode(agent.approvalMode) === 'credits' && typeof agent.approvalCreditLimit === 'number'
        ? String(agent.approvalCreditLimit)
        : '',
  };
}

/** The limit as a number: 1 to APPROVAL_CREDIT_LIMIT_MAX, whole; null when empty or not valid. */
export function parseApprovalLimit(raw: string): number | null {
  const value = parseBudgetInput(raw);
  return value === null || Number.isNaN(value) || value > APPROVAL_CREDIT_LIMIT_MAX ? null : value;
}

// ---- Budgets -------------------------------------------------------------

/** '' is "no budget" (null). A whole number from 1 up is a budget. Anything else is NaN. */
export function parseBudgetInput(raw: string): number | null {
  const text = raw.trim();
  if (text === '') return null;
  if (!/^\d{1,9}$/.test(text)) return Number.NaN;
  const value = Number(text);
  return value >= 1 ? value : Number.NaN;
}

export type BudgetProblem = 'perRunInvalid' | 'perDayInvalid' | 'order';

/** The per-day budget must be at least the per-run budget when both are set. */
export function budgetProblems(
  draft: Pick<WorkflowDraft, 'budgetPerRun' | 'budgetPerDay'>,
  maxBudget: number,
): BudgetProblem[] {
  const problems: BudgetProblem[] = [];
  const perRun = parseBudgetInput(draft.budgetPerRun);
  const perDay = parseBudgetInput(draft.budgetPerDay);
  const runBad = perRun !== null && (Number.isNaN(perRun) || perRun > maxBudget);
  const dayBad = perDay !== null && (Number.isNaN(perDay) || perDay > maxBudget);
  if (runBad) problems.push('perRunInvalid');
  if (dayBad) problems.push('perDayInvalid');
  if (!runBad && !dayBad && perRun !== null && perDay !== null && perDay < perRun) {
    problems.push('order');
  }
  return problems;
}

// ---- Instructions length ---------------------------------------------------

const REPLY_LANGUAGE_PROMPT_NAMES: Record<UserAgentReplyLanguage, string> = {
  owner: 'the language the owner writes in',
  en: 'English',
  'zh-TW': 'Traditional Chinese',
  'zh-CN': 'Simplified Chinese',
};

/**
 * The part of the rendered prompt the owner controls: the identity sentence and
 * the purpose, procedure and result parts, non-empty parts joined by a blank line.
 * Same rule as the gateway's renderAgentInstructions, without the fixed platform rules.
 */
export function ownerPromptLength(
  draft: Pick<WorkflowDraft, 'tone' | 'replyLanguage' | 'purpose' | 'procedure' | 'result'>,
): number {
  const sentences: string[] = [];
  if (draft.tone.trim() !== '') sentences.push(`Tone: ${draft.tone.trim()}.`);
  if (draft.replyLanguage !== '') {
    sentences.push(`Reply in ${REPLY_LANGUAGE_PROMPT_NAMES[draft.replyLanguage]}.`);
  }
  const parts = [sentences.join(' '), draft.purpose, draft.procedure, draft.result].filter(
    (part) => part.length > 0,
  );
  return parts.join('\n\n').length;
}

export interface InstructionsCount {
  used: number;
  max: number;
  /** True when `used` includes the platform's fixed rules (the saved count is known). */
  exact: boolean;
  over: boolean;
}

/**
 * Live `used / max` for the editor. When the server has told us the saved count
 * (`instructionsChars`) the fixed rules are the difference between that count and
 * what the saved owner text renders to, so the live number stays exact. A new
 * workflow has no saved count: the number then covers the typed text only.
 */
export function liveInstructionsCount(
  draft: WorkflowDraft,
  saved: UserAgent | null,
  maxFallback: number,
): InstructionsCount {
  const max = saved?.maxInstructionsChars ?? maxFallback;
  const typed = ownerPromptLength(draft);
  if (saved && typeof saved.instructionsChars === 'number') {
    const savedOwner = ownerPromptLength(workflowDraftFromAgent(saved));
    // Rendered prompt = owner parts, a blank line, then the fixed rules (when there are owner parts).
    const rulesLength = saved.instructionsChars - savedOwner - (savedOwner > 0 ? 2 : 0);
    const total = typed + (typed > 0 ? 2 : 0) + rulesLength;
    return { used: total, max, exact: true, over: total > max };
  }
  return { used: typed, max, exact: false, over: typed > max };
}

// ---- Request bodies -------------------------------------------------------

export function buildModel(choice: string): UserAgentModel {
  return choice === 'server' ? { choice: 'server' } : { choice: 'platform', id: choice };
}

/**
 * POST /api/agents. A workflow left at its defaults sends exactly the three
 * fields the plain create always sent, so a blank create stays byte-compatible.
 */
export function buildBlankBody(draft: WorkflowDraft): CreateAgentDto {
  const body: CreateAgentDto = {
    name: draft.name.trim(),
    role: draft.role.trim(),
    description: draft.description.trim(),
  };
  if (draft.tone.trim() !== '') body.tone = draft.tone.trim();
  if (draft.replyLanguage !== '') body.replyLanguage = draft.replyLanguage;
  if (draft.purpose !== '') body.purpose = draft.purpose;
  if (draft.procedure !== '') body.procedure = draft.procedure;
  if (draft.result !== '') body.result = draft.result;
  if (draft.knowledgeScopeIds.length > 0) body.knowledgeScopeIds = [...draft.knowledgeScopeIds];
  if (draft.connectorToolIds.length > 0) body.connectorToolIds = [...draft.connectorToolIds];
  if (draft.modelChoice !== 'server') body.model = buildModel(draft.modelChoice);
  const perRun = parseBudgetInput(draft.budgetPerRun);
  const perDay = parseBudgetInput(draft.budgetPerDay);
  if (perRun !== null && !Number.isNaN(perRun)) body.budgetPerRunCredits = perRun;
  if (perDay !== null && !Number.isNaN(perDay)) body.budgetPerDayCredits = perDay;
  // A blank create with no team stays byte-compatible; the team goes only when one is ticked.
  if (draft.teamMemberIds.length > 0) body.teamMemberIds = [...draft.teamMemberIds];
  // The default 'every' is left out so a blank create stays byte-compatible.
  if (draft.approvalMode !== 'every') {
    body.approvalMode = draft.approvalMode;
    body.approvalCreditLimit = draft.approvalMode === 'credits' ? parseApprovalLimit(draft.approvalCreditLimit) : null;
  }
  return body;
}

/** POST /api/agents/from-template. The spec, access and model are copied on the server. */
export function buildTemplateBody(templateId: string, draft: WorkflowDraft): CreateAgentFromTemplateDto {
  const body: CreateAgentFromTemplateDto = {
    templateId,
    name: draft.name.trim(),
    role: draft.role.trim(),
  };
  if (draft.description.trim() !== '') body.description = draft.description.trim();
  return body;
}

/**
 * PATCH /api/agents/:id. Sends every editable field; the cleared ones go as null
 * (tone, reply language and both budgets), so the saved row matches the form.
 * The tool profile is never sent: a workflow is read only.
 */
export function buildPatchBody(draft: WorkflowDraft): UpdateAgentDto {
  const perRun = parseBudgetInput(draft.budgetPerRun);
  const perDay = parseBudgetInput(draft.budgetPerDay);
  return {
    name: draft.name.trim(),
    role: draft.role.trim(),
    description: draft.description.trim(),
    tone: draft.tone.trim() === '' ? null : draft.tone.trim(),
    replyLanguage: draft.replyLanguage === '' ? null : draft.replyLanguage,
    purpose: draft.purpose,
    procedure: draft.procedure,
    result: draft.result,
    knowledgeScopeIds: [...draft.knowledgeScopeIds],
    connectorToolIds: [...draft.connectorToolIds],
    model: buildModel(draft.modelChoice),
    budgetPerRunCredits: perRun === null || Number.isNaN(perRun) ? null : perRun,
    budgetPerDayCredits: perDay === null || Number.isNaN(perDay) ? null : perDay,
    // Always sent, so an emptied team saves as [].
    teamMemberIds: [...draft.teamMemberIds],
    // Always sent, so a switch back to 'every' saves; the limit is null unless the mode is 'credits'.
    approvalMode: draft.approvalMode,
    approvalCreditLimit: draft.approvalMode === 'credits' ? parseApprovalLimit(draft.approvalCreditLimit) : null,
  };
}

// ---- Validation ------------------------------------------------------------

/** Field names the editor can show a message next to. */
export type WorkflowErrorField =
  | 'name'
  | 'role'
  | 'description'
  | 'tone'
  | 'instructions'
  | 'knowledge'
  | 'connectors'
  | 'model'
  | 'budgetPerRun'
  | 'budgetPerDay'
  | 'budget'
  | 'team'
  | 'approval'
  | 'start'
  | 'form';

export type WorkflowErrors = Partial<Record<WorkflowErrorField, string>>;

/** Message keys are relative to platform.agentWorkflow. */
export const WORKFLOW_ERROR_KEYS = {
  toneTooLong: 'errors.toneTooLong',
  instructionsOver: 'errors.instructionsOver',
  budgetPerRunInvalid: 'errors.budgetPerRunInvalid',
  budgetPerDayInvalid: 'errors.budgetPerDayInvalid',
  budgetOrder: 'errors.budgetOrder',
  generic: 'errors.generic',
} as const;

export interface DraftCheckInput {
  draft: WorkflowDraft;
  limits: UserAgentOptions['limits'];
  instructions: InstructionsCount;
  /** Plain three-field create, template copy, or the full workflow. */
  scope: 'basic' | 'workflow';
}

/**
 * Client-side checks that match the server's, so the owner sees the problem next
 * to the field. The server stays the authority and answers with a refusal code.
 */
export function checkWorkflowDraft(input: DraftCheckInput): WorkflowErrors {
  const { draft, limits, instructions, scope } = input;
  const errors: WorkflowErrors = {};
  if (scope === 'workflow') {
    if (draft.tone.length > limits.maxToneChars) errors.tone = WORKFLOW_ERROR_KEYS.toneTooLong;
    if (instructions.over) errors.instructions = WORKFLOW_ERROR_KEYS.instructionsOver;
    const problems = budgetProblems(draft, limits.maxBudgetCredits);
    if (problems.includes('perRunInvalid')) errors.budgetPerRun = WORKFLOW_ERROR_KEYS.budgetPerRunInvalid;
    if (problems.includes('perDayInvalid')) errors.budgetPerDay = WORKFLOW_ERROR_KEYS.budgetPerDayInvalid;
    if (problems.includes('order')) errors.budgetPerDay = WORKFLOW_ERROR_KEYS.budgetOrder;
    if (draft.teamMemberIds.length > WORKFLOW_TEAM_MAX) errors.team = 'errors.teamTooMany';
    if (draft.approvalMode === 'credits') {
      if (draft.approvalCreditLimit.trim() === '') errors.approval = 'errors.approvalLimitRequired';
      else if (parseApprovalLimit(draft.approvalCreditLimit) === null) errors.approval = 'errors.approvalLimitInvalid';
    }
  }
  return errors;
}

// ---- Refusal codes ---------------------------------------------------------

export interface RefusalMapping {
  field: WorkflowErrorField;
  /** Relative to platform.agentWorkflow. */
  messageKey: string;
}

/** The gateway's stable 400 codes (BIZ-USER-01A) and where the editor shows each. */
export const REFUSAL_CODE_MAP: Readonly<Record<string, RefusalMapping>> = {
  SPEC_INVALID: { field: 'instructions', messageKey: 'errors.specInvalid' },
  INSTRUCTIONS_TOO_LONG: { field: 'instructions', messageKey: 'errors.instructionsTooLong' },
  TOOL_PROFILE_NOT_ALLOWED: { field: 'form', messageKey: 'errors.toolProfileNotAllowed' },
  KNOWLEDGE_SCOPE_UNKNOWN: { field: 'knowledge', messageKey: 'errors.knowledgeScopeUnknown' },
  CONNECTOR_TOOL_UNKNOWN: { field: 'connectors', messageKey: 'errors.connectorToolUnknown' },
  CONNECTION_MISSING: { field: 'connectors', messageKey: 'errors.connectionMissing' },
  MODEL_INVALID: { field: 'model', messageKey: 'errors.modelInvalid' },
  BUDGET_INVALID: { field: 'budget', messageKey: 'errors.budgetInvalid' },
  TEMPLATE_NOT_ALLOWED: { field: 'start', messageKey: 'errors.templateNotAllowed' },
  // USER-TEAMS-01: the team rule is the Chief of Staff roster rule, so its codes come back as ROSTER_*.
  ROSTER_TOO_MANY: { field: 'team', messageKey: 'errors.teamTooMany' },
  ROSTER_DUPLICATE: { field: 'team', messageKey: 'errors.teamMemberRefused' },
  ROSTER_INVALID_BODY: { field: 'team', messageKey: 'errors.teamMemberRefused' },
  ROSTER_MEMBER_UNKNOWN: { field: 'team', messageKey: 'errors.teamMemberRefused' },
  ROSTER_MEMBER_NOT_ALLOWED: { field: 'team', messageKey: 'errors.teamMemberRefused' },
  ROSTER_MEMBER_NOT_FOUND: { field: 'team', messageKey: 'errors.teamMemberRefused' },
  ROSTER_MEMBER_SELF: { field: 'team', messageKey: 'errors.teamMemberSelf' },
  // APPROVAL-SET-01: the approval setting's refusals.
  APPROVAL_LIMIT_REQUIRED: { field: 'approval', messageKey: 'errors.approvalLimitRequired' },
  APPROVAL_LIMIT_INVALID: { field: 'approval', messageKey: 'errors.approvalLimitInvalid' },
  APPROVAL_MODE_INVALID: { field: 'approval', messageKey: 'errors.approvalModeInvalid' },
};

/** Any other failure (network, 500, a 400 without a known code) gets the generic message. */
export const GENERIC_REFUSAL: RefusalMapping = { field: 'form', messageKey: WORKFLOW_ERROR_KEYS.generic };

/**
 * `message` is the gateway's text for a 400 without a code: the DTO's refusal of a
 * fourth team id (class-validator names `teamMemberIds`) reads as the team limit.
 */
export function mapRefusal(code: string | undefined, message?: string): RefusalMapping {
  if (code && Object.prototype.hasOwnProperty.call(REFUSAL_CODE_MAP, code)) {
    return REFUSAL_CODE_MAP[code];
  }
  if (!code && message && /teamMemberIds/.test(message)) {
    return { field: 'team', messageKey: 'errors.teamTooMany' };
  }
  // The DTO's refusal of a bad mode or limit has no code; class-validator names the field.
  if (!code && message && /approval(Mode|CreditLimit)/.test(message)) {
    return { field: 'approval', messageKey: 'errors.approvalInvalid' };
  }
  return GENERIC_REFUSAL;
}

// ---- What the editor shows ---------------------------------------------------

export const NEVER_DO_CODES = [
  'FILES_NO_CHANGE',
  'FILES_NO_DELETE',
  'MAIL_NONE',
  'MAIL_READ_ONLY',
  'CALENDAR_NONE',
  'CALENDAR_READ_ONLY',
  'KNOWLEDGE_NONE',
  'KNOWLEDGE_ONLY_SCOPES',
  'EXTERNAL_ACTIONS_NONE',
  'DECISIONS_OWNER',
  'ACCESS_FIXED',
] as const;

export interface NeverDoLine {
  code: string;
  /** Relative to platform.agentWorkflow. */
  messageKey: string;
  scopeIds: string[];
}

export function neverDoLines(items: readonly UserAgentNeverDoItem[] | undefined): NeverDoLine[] {
  return (items ?? []).map((item) => ({
    code: item.code,
    messageKey: `neverDo.${item.code}`,
    scopeIds: item.scopeIds ?? [],
  }));
}

export interface ConnectorToolRow {
  id: string;
  kind: string;
  connected: boolean;
}

/**
 * The connector ticks to show. A tool appears when the owner has connected its kind,
 * or when the workflow already holds it (so it can be unticked). `hiddenKinds` drives
 * the hint that links to the Connections page.
 */
export function visibleConnectorTools(
  options: Pick<UserAgentOptions, 'connectorTools' | 'connectedKinds'>,
  currentToolIds: readonly string[],
): { rows: ConnectorToolRow[]; hiddenKinds: string[] } {
  const rows: ConnectorToolRow[] = [];
  const hiddenKinds: string[] = [];
  for (const tool of options.connectorTools) {
    const connected = options.connectedKinds.includes(tool.kind);
    if (connected || currentToolIds.includes(tool.id)) {
      rows.push({ id: tool.id, kind: tool.kind, connected });
    } else if (!hiddenKinds.includes(tool.kind)) {
      hiddenKinds.push(tool.kind);
    }
  }
  return { rows, hiddenKinds };
}

export function fillTemplate(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

/**
 * Ticks or unticks a team member. A fourth tick is refused: the list stays as it was
 * and `limitHit` is true so the form can say why (the roster picker's rule).
 */
export function toggleTeamMember(
  ids: readonly string[],
  id: string,
  max: number = WORKFLOW_TEAM_MAX,
): { ids: string[]; limitHit: boolean } {
  if (ids.includes(id)) return { ids: ids.filter((item) => item !== id), limitHit: false };
  if (ids.length >= max) return { ids: [...ids], limitHit: true };
  return { ids: [...ids, id], limitHit: false };
}

export interface TeamChoiceRow {
  id: string;
  name: string;
  kind: 'system' | 'workflow';
  /** A draft or switched-off workflow can be saved on the team, but it is skipped at start. */
  note: 'draft' | 'off' | null;
}

/**
 * The rows of the Team block: every choice except the row being edited, then any saved
 * member that is no longer a choice (name ''), so the owner can untick it.
 */
export function teamChoiceRows(
  options: Pick<UserAgentOptions, 'teamChoices'>,
  selectedIds: readonly string[],
  selfId: string | null,
): TeamChoiceRow[] {
  const own = selfId === null ? null : selfId.toLowerCase();
  const rows: TeamChoiceRow[] = [];
  for (const choice of options.teamChoices ?? []) {
    if (own !== null && choice.id.toLowerCase() === own) continue;
    rows.push({
      id: choice.id,
      name: choice.name,
      kind: choice.kind,
      note:
        choice.kind !== 'workflow' || choice.status === 'active'
          ? null
          : choice.status === 'draft'
            ? 'draft'
            : 'off',
    });
  }
  const known = new Set(rows.map((row) => row.id));
  for (const id of selectedIds) {
    if (!known.has(id)) rows.push({ id, name: '', kind: 'workflow', note: null });
  }
  return rows;
}

/** The two advisors a team may hold; their names are translated, not read from the server. */
export const TEAM_SYSTEM_MEMBER_IDS: readonly string[] = ['product-strategy', 'technology-advisor'];

/** The name shown for a team member: a translated advisor name, the workflow's own name, or the unknown text. */
export function teamMemberName(
  t: (key: string) => string,
  member: { id: string; kind: 'system' | 'workflow'; name: string },
): string {
  if (member.kind === 'system' && TEAM_SYSTEM_MEMBER_IDS.includes(member.id)) {
    return t(`teamNames.${member.id}`);
  }
  return member.name.trim() !== '' ? member.name : t('teamUnknown');
}

/** The names of a saved team, in order, for the summary line. */
export function teamNamesFor(
  t: (key: string) => string,
  ids: readonly string[],
  choices: UserAgentOptions['teamChoices'],
): string[] {
  return ids.map((id) => {
    const choice = (choices ?? []).find((entry) => entry.id.toLowerCase() === id.toLowerCase());
    if (choice) return teamMemberName(t, choice);
    if (TEAM_SYSTEM_MEMBER_IDS.includes(id)) return t(`teamNames.${id}`);
    return t('teamUnknown');
  });
}

export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}
