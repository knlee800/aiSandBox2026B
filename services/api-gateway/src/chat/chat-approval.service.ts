import { HttpException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { EntitlementService } from '../auth/entitlement.service';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatRunDelivery } from '../entities/chat-run-delivery.entity';
import { User } from '../entities/user.entity';
import { FRONT_DOOR_LEAD_ID } from '../orchestration/collaboration-front-door';
import { CollaborationReferralEntity } from '../orchestration/collaboration-referral.entity';
import { CollaborationStartService } from '../orchestration/collaboration-start.service';
import { COLLABORATION_OMITTED_REJECT_REASON } from '../orchestration/collaboration-team';
import { TESTS_NOT_PASSED_CODE } from '../orchestration/collaboration-tests-gate';
import {
  autoApprovalTargetIsReadOnly,
  connectorToolIdsAreReadOnly,
  WORKFLOW_REFUSAL_CODES,
} from '../orchestration/collaboration-workflow';
import type { ReferralPendingWorkflow } from '../orchestration/orchestration.contracts';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { systemAgentById } from '../system-agents/system-agent-registry';
import {
  CHAT_AUDIT_CATEGORY,
  CHAT_CHANNEL_DISCORD,
  ChatLinkLocale,
  ChatLinkService,
  ChatLinkUse,
  normalizeChatLocale,
} from './chat-link.service';
import { chatAgentName, chatReply, ChatReplyKey } from './chat-replies';
import { isChatDiscordEnabled } from './chat-switch';
import type {
  ChatComponentPress,
  ChatComponentResponse,
  ChatReplyMessage,
} from './chat-transport';

/**
 * CHAT-DISCORD-01 slice C2 (stage-start sections 6.3, 6.5, 7; Keith's Q6:
 * approvals in Discord for read-only steps): the Approve and Reject buttons
 * on the direct message that tells the owner a step of a Discord-started run
 * is waiting.
 *
 * Buttons (custom ids). Each approval message gets one random token of 128
 * bits (crypto.randomBytes(16), base64url, 22 characters). The custom ids are
 * `ap1:a:<token>` (Approve) and `ap1:r:<token>` (Reject). The token is opaque:
 * it carries no id. The server keeps, in memory only, what the token stands
 * for: the link, the owner, the run, the step and its expiry (24 hours, the
 * hand-off's own timeout and the delivery's drop age). A custom id that is
 * not of that exact form, or whose token is not in the map, or has expired,
 * does nothing. So a custom id cannot be forged into another owner's step:
 * guessing a live token means guessing 128 random bits, and even a live
 * token is honoured only for the Discord user whose link made it, while
 * that same link (same link id) exists. The map is bounded (oldest dropped
 * first) and is lost on a gateway restart: an older button then answers
 * "no longer works" and the step is decided on the Team page.
 *
 * A press, in this order, each failure answering one fixed ephemeral line
 * and changing nothing:
 *  1. the switch is on and the press is in the direct message;
 *  2. the custom id has the exact form and its token is live (not expired);
 *  3. the presser's Discord account is linked, to the same link and owner the
 *     token was made for (another Discord user, or after unlink: nothing);
 *  4. the owner is active and harness-entitled now (read live);
 *  5. the run is still a Discord-started run of that link (its delivery row
 *     waits), owned by the owner and active; the step is in that run and
 *     still waiting for approval (a decided step: nothing);
 *  6. Approve only: the step is positively read-only (chatStepIsReadOnly);
 *     anything else answers "decide it on the Team page" and is not approved.
 * Then:
 *  - Approve: CollaborationStartService.approveStep, the Team page's own
 *    approve call (OrchestrationService.approveReferral with the owner as
 *    decidedBy and enforceTestsGate true, approveWithoutPassingTests false),
 *    so every existing check runs. A refusal is answered by a translated line
 *    and the step keeps waiting.
 *  - Reject: OrchestrationService.rejectReferral, the Team page's own reject
 *    call, with the owner as decidedBy and the page's omitted-reason token
 *    (`omitted`, the reason the page stores when no reason is typed).
 *  - The message is edited to show the decision and its buttons are removed;
 *    the token is spent. Audit: approval_decided (ids, decision, reason code).
 *
 * The request text is sent cut to 1000 characters (acceptance 4). Log lines
 * and audit rows carry ids, outcome and reason codes only: never the request
 * text, the token, the custom id or the Discord user id.
 */

export const CHAT_APPROVAL_AUDIT_EVENTS = {
  decided: 'approval_decided',
  refused: 'approval_refused',
} as const;

export const CHAT_APPROVAL_LIMITS = {
  /** A button works for 24 hours (the hand-off times out after 24 hours; the delivery drops at 24 hours). */
  tokenLifetimeMs: 24 * 60 * 60 * 1000,
  /** At most this many live buttons are remembered; the oldest go first. */
  maxTokens: 2000,
  /** The request text is cut to this many characters (acceptance 4). */
  requestChars: 1000,
  /** A workflow name in the message is cut to this many characters. */
  agentNameChars: 60,
} as const;

/** The custom id form: version, action (a approve, r reject), a 22-character base64url token. */
export const CHAT_APPROVAL_CUSTOM_ID = /^ap1:([ar]):([A-Za-z0-9_-]{22})$/;

/** Optional provider token: tests pass a clock. */
export const CHAT_APPROVAL_OPTIONS = Symbol('CHAT_APPROVAL_OPTIONS');

export interface ChatApprovalOptions {
  now?: () => number;
}

/** Why a press did not decide (log and audit reason codes; never Discord text). */
export type ChatApprovalRefusal =
  | 'not_available'
  | 'unavailable'
  | 'not_entitled'
  | 'not_read_only'
  | 'tests_blocked'
  | 'runs_off'
  | 'provider_off'
  | 'no_credits'
  | 'over_cap'
  | 'workflow'
  | 'refused';

const REFUSAL_REPLIES: Readonly<Record<ChatApprovalRefusal, ChatReplyKey>> = {
  not_available: 'notAvailable',
  unavailable: 'approval.unavailable',
  not_entitled: 'notEntitled',
  not_read_only: 'approval.notReadOnly',
  tests_blocked: 'approval.testsBlocked',
  runs_off: 'approval.runsOff',
  provider_off: 'approval.providerOff',
  no_credits: 'approval.noCredits',
  over_cap: 'approval.overCap',
  workflow: 'approval.workflow',
  refused: 'approval.refused',
};

const WORKFLOW_CODES: ReadonlySet<string> = new Set(Object.values(WORKFLOW_REFUSAL_CODES));

interface ApprovalToken {
  linkId: string;
  userId: string;
  collaborationRunId: string;
  referralId: string;
  step: number;
  expiresAt: number;
}

/** The link fields the delivery passes in (a ChatLink row). */
export interface ChatApprovalLink {
  id: string;
  userId: string;
  locale: string;
}

type StepFacts = Pick<
  CollaborationReferralEntity,
  'targetBuilderProfileId' | 'constraintReadOnly' | 'constraintAllowWriteTools' | 'pendingJob'
>;

/** The step's own workflow snapshot (the orchestration rule: its id is the target's). */
function stepWorkflowOf(step: StepFacts): ReferralPendingWorkflow | null {
  const workflow = step.pendingJob?.workflow;
  if (!workflow || typeof workflow !== 'object') {
    return null;
  }
  return workflow.id === step.targetBuilderProfileId ? workflow : null;
}

/**
 * Acceptance 2, fail-closed: a step may be approved from Discord only when it
 * is positively read-only:
 *  - its stored constraints are read-only with no write tools
 *    (constraintReadOnly true, constraintAllowWriteTools false); and
 *  - its target is positively read-only by the existing APPROVAL-SET-01B D6
 *    rule (autoApprovalTargetIsReadOnly: a roster system agent whose registry
 *    profile is `read`, or a user workflow whose own snapshot is on the step,
 *    and every connector tool in the allowlist with readOnly true); or the
 *    target is the Chief of Staff, the lead of every Discord-started team
 *    run, whose registry profile is `read` and whose connector tools are all
 *    readOnly (the D6 rule leaves leads out only because a lead cannot sit in
 *    a team, not because it can write).
 * Everything else (profile null, review or write, an unknown id, a workflow
 * step without its snapshot, a connector tool without readOnly true) is not.
 */
export function chatStepIsReadOnly(step: StepFacts | null | undefined): boolean {
  if (!step || step.constraintReadOnly !== true || step.constraintAllowWriteTools !== false) {
    return false;
  }
  const target = step.targetBuilderProfileId;
  if (typeof target !== 'string' || target.length === 0) {
    return false;
  }
  const stepWorkflow = stepWorkflowOf(step);
  if (autoApprovalTargetIsReadOnly(target, stepWorkflow)) {
    return true;
  }
  if (target !== FRONT_DOOR_LEAD_ID || stepWorkflow) {
    return false;
  }
  const lead = systemAgentById(target);
  return Boolean(lead && lead.toolProfile === 'read' && connectorToolIdsAreReadOnly(lead.connectorToolIds));
}

/** The request text, cut to 1000 characters (code points); a cut ends with an ellipsis. */
export function cutApprovalRequest(text: string): string {
  const chars = Array.from(text.trim());
  if (chars.length <= CHAT_APPROVAL_LIMITS.requestChars) {
    return chars.join('');
  }
  return `${chars.slice(0, CHAT_APPROVAL_LIMITS.requestChars - 1).join('')}…`;
}

/** Maps an approve refusal to a reason code. Reads only the status, a code and the platform's own message. */
export function chatApprovalRefusalOf(error: unknown): ChatApprovalRefusal {
  if (!(error instanceof HttpException)) {
    const message = error instanceof Error ? error.message : '';
    return message.includes('not found') ? 'unavailable' : 'refused';
  }
  const status = error.getStatus();
  const response = error.getResponse();
  const body = typeof response === 'object' && response !== null ? (response as Record<string, unknown>) : {};
  const message = typeof response === 'string' ? response : typeof body.message === 'string' ? body.message : '';
  const code = typeof body.code === 'string' ? body.code : '';
  if (code === TESTS_NOT_PASSED_CODE) return 'tests_blocked';
  if (code && WORKFLOW_CODES.has(code)) return 'workflow';
  if (status === 409 || status === 404) return 'unavailable';
  if (status === 402) return 'no_credits';
  if (status === 429) return 'over_cap';
  if (status === 503) {
    if (message.includes('disabled for maintenance')) return 'runs_off';
    if (/^Provider \S+ temporarily unavailable$/.test(message)) return 'provider_off';
    if (message === 'Insufficient credit balance') return 'no_credits';
    if (message === 'Token quota exceeded') return 'over_cap';
  }
  return 'refused';
}

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  return /^[A-Za-z0-9_]{1,64}$/.test(name) ? name : 'Error';
}

function ephemeral(locale: ChatLinkLocale, key: ChatReplyKey): ChatComponentResponse {
  return { kind: 'ephemeral', message: { text: chatReply(locale, key) } };
}

@Injectable()
export class ChatApprovalService {
  private readonly logger = new Logger('ChatApprovals');
  private readonly now: () => number;
  private readonly tokens = new Map<string, ApprovalToken>();

  constructor(
    private readonly starts: CollaborationStartService,
    private readonly orchestration: OrchestrationService,
    private readonly links: ChatLinkService,
    private readonly entitlements: EntitlementService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(ChatRunDelivery)
    private readonly deliveries: Repository<ChatRunDelivery>,
    @InjectRepository(CollaborationReferralEntity)
    private readonly referrals: Repository<CollaborationReferralEntity>,
    @InjectRepository(AuditEventEntity)
    private readonly audit: Repository<AuditEventEntity>,
    @Optional() @Inject(CHAT_APPROVAL_OPTIONS) options?: ChatApprovalOptions,
  ) {
    this.now = options?.now ?? Date.now;
  }

  /** Live buttons remembered now (for tests and the bound). */
  get liveTokens(): number {
    return this.tokens.size;
  }

  /**
   * The message for a step newly waiting for approval in a Discord-started
   * run: with Approve and Reject buttons when the step is positively
   * read-only, otherwise the plain "decide on the Team page" line.
   */
  async approvalMessage(
    link: ChatApprovalLink,
    collaborationRunId: string,
    referralId: string,
    step: number,
  ): Promise<ChatReplyMessage> {
    const locale = normalizeChatLocale(link.locale);
    const plain: ChatReplyMessage = { text: chatReply(locale, 'result.waitingApproval') };
    const entity = await this.referrals.findOne({ where: { referralId } });
    if (
      !entity ||
      entity.collaborationRunId !== collaborationRunId ||
      entity.status !== 'pending_approval' ||
      !chatStepIsReadOnly(entity)
    ) {
      return plain;
    }
    const request = typeof entity.pendingJob?.prompt === 'string' ? cutApprovalRequest(entity.pendingJob.prompt) : '';
    const token = this.issue({
      linkId: link.id,
      userId: link.userId,
      collaborationRunId,
      referralId,
      step,
      expiresAt: this.now() + CHAT_APPROVAL_LIMITS.tokenLifetimeMs,
    });
    const header = chatReply(locale, 'approval.request', {
      step: String(step),
      agent: this.agentName(locale, entity),
    });
    return {
      text: request.length > 0 ? `${header}\n${request}` : header,
      buttons: [
        { customId: `ap1:a:${token}`, label: chatReply(locale, 'approval.approveButton'), style: 'approve' },
        { customId: `ap1:r:${token}`, label: chatReply(locale, 'approval.rejectButton'), style: 'reject' },
      ],
    };
  }

  /** Forgets the buttons of a message that could not be sent. */
  revoke(message: ChatReplyMessage): void {
    for (const button of message.buttons ?? []) {
      const parsed = CHAT_APPROVAL_CUSTOM_ID.exec(button.customId);
      if (parsed) {
        this.tokens.delete(parsed[2]);
      }
    }
  }

  /** The transport's component handler. Never throws. */
  async handlePress(press: ChatComponentPress): Promise<ChatComponentResponse> {
    const fallback = normalizeChatLocale(press.locale);
    try {
      if (!isChatDiscordEnabled()) {
        return this.refuse(null, null, 'not_available', fallback);
      }
      if (!press.directMessage) {
        return this.refuse(null, null, 'unavailable', fallback);
      }
      const parsed = typeof press.customId === 'string' ? CHAT_APPROVAL_CUSTOM_ID.exec(press.customId) : null;
      const action = parsed?.[1] === 'a' ? 'approve' : 'reject';
      const tokenKey = parsed?.[2] ?? '';
      const token = parsed ? this.tokens.get(tokenKey) : undefined;
      if (!token) {
        return this.refuse(null, null, 'unavailable', fallback);
      }
      if (token.expiresAt <= this.now()) {
        this.tokens.delete(tokenKey);
        return this.refuse(null, token, 'unavailable', fallback);
      }

      const link = await this.links.useLinkByExternalUser(CHAT_CHANNEL_DISCORD, press.externalUserId);
      if (!link || link.linkId !== token.linkId || link.userId !== token.userId) {
        return this.refuse(null, token, 'unavailable', link?.locale ?? fallback);
      }
      if (!(await this.ownerOk(link.userId))) {
        return this.refuse(link, token, 'not_entitled', link.locale);
      }

      const entity = await this.stepOf(link, token);
      if (!entity) {
        this.tokens.delete(tokenKey);
        return this.refuse(link, token, 'unavailable', link.locale);
      }

      if (action === 'approve') {
        if (!chatStepIsReadOnly(entity)) {
          await this.writeAudit(CHAT_APPROVAL_AUDIT_EVENTS.refused, link, token, { reason: 'not_read_only' });
          return this.refuse(link, token, 'not_read_only', link.locale);
        }
        try {
          await this.starts.approveStep({
            collaborationRunId: token.collaborationRunId,
            referralId: token.referralId,
            decidedBy: link.userId,
            approveWithoutPassingTests: false,
          });
        } catch (error) {
          const reason = chatApprovalRefusalOf(error);
          if (reason === 'unavailable') {
            this.tokens.delete(tokenKey);
          } else {
            await this.writeAudit(CHAT_APPROVAL_AUDIT_EVENTS.refused, link, token, { reason });
          }
          return this.refuse(link, token, reason, link.locale);
        }
      } else {
        try {
          await this.orchestration.rejectReferral({
            collaborationRunId: token.collaborationRunId,
            referralId: token.referralId,
            decidedBy: link.userId,
            reason: COLLABORATION_OMITTED_REJECT_REASON,
          });
        } catch (error) {
          const reason = chatApprovalRefusalOf(error);
          if (reason === 'unavailable') {
            this.tokens.delete(tokenKey);
          }
          return this.refuse(link, token, reason === 'unavailable' ? 'unavailable' : 'refused', link.locale);
        }
      }

      this.tokens.delete(tokenKey);
      const decision = action === 'approve' ? 'approved' : 'rejected';
      await this.writeAudit(CHAT_APPROVAL_AUDIT_EVENTS.decided, link, token, {
        decision,
        reason: action === 'approve' ? 'owner' : COLLABORATION_OMITTED_REJECT_REASON,
      });
      this.logger.log(
        `chat approval decided linkId=${link.linkId} runId=${token.collaborationRunId} referralId=${token.referralId} decision=${decision}`,
      );
      const values = { step: String(token.step), agent: this.agentName(link.locale, entity) };
      return {
        kind: 'update',
        message: { text: chatReply(link.locale, action === 'approve' ? 'approval.approved' : 'approval.rejected', values) },
      };
    } catch (error) {
      this.logger.warn(`chat approval failed reason=${errorName(error)}`);
      return ephemeral(fallback, 'error');
    }
  }

  /** Step 5: a Discord-started run of this link, the owner's and active; the step in it and still waiting. */
  private async stepOf(link: ChatLinkUse, token: ApprovalToken): Promise<CollaborationReferralEntity | null> {
    const delivery = await this.deliveries.findOne({
      where: { collaborationRunId: token.collaborationRunId, linkId: link.linkId, status: 'waiting' },
    });
    if (!delivery) {
      return null;
    }
    const run = await this.orchestration.getCollaborationRun(token.collaborationRunId);
    if (!run || run.userId !== link.userId || run.status !== 'active') {
      return null;
    }
    const entity = await this.referrals.findOne({ where: { referralId: token.referralId } });
    if (!entity || entity.collaborationRunId !== token.collaborationRunId || entity.status !== 'pending_approval') {
      return null;
    }
    return entity;
  }

  /** The owner must be active and harness-entitled now (read live on every press). */
  private async ownerOk(userId: string): Promise<boolean> {
    const user = await this.users.findOne({ where: { id: userId }, select: ['id', 'isActive'] });
    if (!user || user.isActive !== true) {
      return false;
    }
    return (await this.entitlements.resolveHarnessEntitled(userId)) === true;
  }

  /** The target's name: a translated system agent name, the workflow's own name (cut), or "an agent". */
  private agentName(locale: ChatLinkLocale, step: StepFacts): string {
    const workflow = stepWorkflowOf(step);
    if (workflow && typeof workflow.name === 'string' && workflow.name.trim().length > 0) {
      return Array.from(workflow.name.trim().replace(/\s+/g, ' ')).slice(0, CHAT_APPROVAL_LIMITS.agentNameChars).join('');
    }
    return chatAgentName(locale, step.targetBuilderProfileId);
  }

  private issue(entry: ApprovalToken): string {
    const now = this.now();
    for (const [key, value] of this.tokens) {
      if (value.expiresAt <= now) this.tokens.delete(key);
    }
    while (this.tokens.size >= CHAT_APPROVAL_LIMITS.maxTokens) {
      const oldest = this.tokens.keys().next().value;
      if (oldest === undefined) break;
      this.tokens.delete(oldest);
    }
    let key = randomBytes(16).toString('base64url');
    while (this.tokens.has(key)) {
      key = randomBytes(16).toString('base64url');
    }
    this.tokens.set(key, entry);
    return key;
  }

  private refuse(
    link: ChatLinkUse | null,
    token: ApprovalToken | null,
    reason: ChatApprovalRefusal,
    locale: ChatLinkLocale,
  ): ChatComponentResponse {
    const linkPart = link ? ` linkId=${link.linkId}` : '';
    const stepPart = token && link ? ` runId=${token.collaborationRunId} referralId=${token.referralId}` : '';
    this.logger.log(`chat approval refused reason=${reason}${linkPart}${stepPart}`);
    return ephemeral(locale, REFUSAL_REPLIES[reason]);
  }

  private async writeAudit(
    eventType: string,
    link: ChatLinkUse,
    token: ApprovalToken,
    payload: Record<string, string>,
  ): Promise<void> {
    try {
      await this.audit.insert({
        category: CHAT_AUDIT_CATEGORY,
        eventType,
        subjectType: 'collaboration_run',
        subjectId: token.collaborationRunId,
        userId: link.userId,
        payload: {
          channel: CHAT_CHANNEL_DISCORD,
          linkId: link.linkId,
          collaborationRunId: token.collaborationRunId,
          referralId: token.referralId,
          ...payload,
        },
        occurredAt: new Date(this.now()),
      });
    } catch (error) {
      this.logger.warn(`chat approval audit insert failed event=${eventType} reason=${errorName(error)}`);
    }
  }
}
