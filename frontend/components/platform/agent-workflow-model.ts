import type {
  CreateAgentDto,
  CreateAgentFromTemplateDto,
  UpdateAgentDto,
  UserAgent,
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
}

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
  };
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
};

/** Any other failure (network, 500, a 400 without a known code) gets the generic message. */
export const GENERIC_REFUSAL: RefusalMapping = { field: 'form', messageKey: WORKFLOW_ERROR_KEYS.generic };

export function mapRefusal(code: string | undefined): RefusalMapping {
  if (code && Object.prototype.hasOwnProperty.call(REFUSAL_CODE_MAP, code)) {
    return REFUSAL_CODE_MAP[code];
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

export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}
