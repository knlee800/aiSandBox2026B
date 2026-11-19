import { HttpException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { EntitlementService } from '../auth/entitlement.service';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatApprovalToken } from '../entities/chat-approval-token.entity';
import { ChatRunDelivery } from '../entities/chat-run-delivery.entity';
import { User } from '../entities/user.entity';
import { FRONT_DOOR_LEAD_ID } from '../orchestration/collaboration-front-door';
import { CollaborationReferralEntity } from '../orchestration/collaboration-referral.entity';
import { CollaborationStartService } from '../orchestration/collaboration-start.service';
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
import {
  ChatActivityNotifier,
  type ChatComponentPress,
  type ChatComponentResponse,
  type ChatModal,
  type ChatReplyMessage,
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
 * it carries no id. The server keeps what the token stands for: the link,
 * the owner, the run, the step and its expiry (24 hours, the hand-off's own
 * timeout and the delivery's drop age); since CHAT-STATE-PERSIST-01 in
 * chat_approval_tokens under the token's SHA-256 (see below). A custom id
 * that is not of that exact form, or whose token has no row, or has expired,
 * does nothing. So a custom id cannot be forged into another owner's step:
 * guessing a live token means guessing 128 random bits, and even a live
 * token is honoured only for the Discord user whose link made it, while
 * that same link (same link id) exists. A button that no longer works
 * answers "no longer works" and the step is decided on the Team page.
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
 *    call, with the owner as decidedBy (CHAT-TIDY-01: from the reason form,
 *    with the typed reason or "Rejected in Discord"; see below).
 *  - The message is edited to show the decision and its buttons are removed;
 *    the token is spent. Audit: approval_decided (ids, decision, reason code).
 *
 * The request text is sent cut to 1000 characters (acceptance 4). Log lines
 * and audit rows carry ids, outcome and reason codes only: never the request
 * text, the token, the custom id or the Discord user id.
 *
 * CHAT-USER-INSTALL-01: every press in the direct message (switch on), even
 * one on a button that no longer works, tells ChatActivityNotifier that this
 * outside user is active, so results and notices held after a refused direct
 * message go out now, as follow-ups after this press's own answer.
 *
 * CHAT-STATE-PERSIST-01 (stage-start section 2.2, option A): what a token
 * stands for is a chat_approval_tokens row, keyed by the SHA-256 hex of the
 * token (the token itself is never stored), so buttons keep working across a
 * restart and in another process. The custom id form and the six checks of a
 * press above are unchanged; a press looks the row up by the hash. A new
 * message for a step replaces that step's row (one per step, unique on the
 * step), so only the newest message's buttons work. The row is deleted on a
 * decision, when the step or run is no longer available, when the message
 * could not be sent (revoke), at expiry (on every issue and every delivery
 * pass) and by cascade with its delivery row (unlink). The 2000-token cap is
 * gone: rows are bounded by waiting steps and the 24-hour expiry.
 * needsFreshButtons is the delivery's repair rule: a waiting, positively
 * read-only step with no live token gets one fresh message.
 *
 * CHAT-TIDY-01:
 * - Reject with a reason: pressing Reject decides nothing; it opens a form
 *   (custom id `ap1:f:<token>`, the same token) with one optional one-line
 *   field of at most 500 characters. Closing the form leaves the step
 *   waiting and the token live. Sending the form is the press that decides:
 *   it runs the six checks above (the same token, the same order), then
 *   rejects with the typed reason, trimmed and cut to 500 characters, or,
 *   when empty, the translated fixed text "Rejected in Discord" in the
 *   link's language. The reason is stored as the Team page stores one
 *   (OrchestrationService.rejectReferral) and is never logged or audited
 *   (the audit row says typed or default). A form custom id is read only
 *   from a form submit and a button custom id only from a button press.
 * - One decision per token: before the decision the token row is deleted,
 *   and the delete must remove exactly one row. When it removes none (a
 *   second press of the same button, or Approve and a form sent together),
 *   the press decides nothing and answers "no longer works". When the
 *   decision is then refused for a reason that leaves the step waiting
 *   (switched off, credits, caps, tests, workflow), the row is put back so
 *   the buttons keep working, as before.
 */

export const CHAT_APPROVAL_AUDIT_EVENTS = {
  decided: 'approval_decided',
  refused: 'approval_refused',
} as const;

export const CHAT_APPROVAL_LIMITS = {
  /** A button works for 24 hours (the hand-off times out after 24 hours; the delivery drops at 24 hours). */
  tokenLifetimeMs: 24 * 60 * 60 * 1000,
  /** The request text is cut to this many characters (acceptance 4). */
  requestChars: 1000,
  /** A workflow name in the message is cut to this many characters. */
  agentNameChars: 60,
  /** CHAT-TIDY-01: a reject reason typed in Discord is cut to this many characters. */
  rejectReasonChars: 500,
} as const;

/** The custom id form: version, action (a approve, r reject), a 22-character base64url token. */
export const CHAT_APPROVAL_CUSTOM_ID = /^ap1:([ar]):([A-Za-z0-9_-]{22})$/;

/** CHAT-TIDY-01: the reject form's custom id: the same token as the buttons. */
export const CHAT_APPROVAL_REASON_FORM_ID = /^ap1:f:([A-Za-z0-9_-]{22})$/;

/** CHAT-TIDY-01: the custom id of the reject form's one field. */
export const CHAT_APPROVAL_REASON_FIELD = 'reason';

/**
 * CHAT-TIDY-01: the reason typed into the reject form: trimmed and cut to
 * 500 characters (code points); null when nothing is typed.
 */
export function chatRejectReason(modalValues: Readonly<Record<string, string>> | undefined): string | null {
  const typed =
    modalValues && Object.prototype.hasOwnProperty.call(modalValues, CHAT_APPROVAL_REASON_FIELD)
      ? modalValues[CHAT_APPROVAL_REASON_FIELD]
      : '';
  if (typeof typed !== 'string') {
    return null;
  }
  const cut = Array.from(typed.trim()).slice(0, CHAT_APPROVAL_LIMITS.rejectReasonChars).join('').trim();
  return cut.length > 0 ? cut : null;
}

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

/** CHAT-STATE-PERSIST-01: the stored form of a button token: its SHA-256 hex. */
export function hashApprovalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

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
    @InjectRepository(ChatApprovalToken)
    private readonly tokens: Repository<ChatApprovalToken>,
    @Optional() @Inject(CHAT_APPROVAL_OPTIONS) options?: ChatApprovalOptions,
    @Optional() private readonly activity?: ChatActivityNotifier,
  ) {
    this.now = options?.now ?? Date.now;
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
    const token = await this.issue({
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

  /** Forgets the buttons of a message that could not be sent (deletes their token rows). Never throws. */
  async revoke(message: ChatReplyMessage): Promise<void> {
    const hashes = new Set<string>();
    for (const button of message.buttons ?? []) {
      const parsed = CHAT_APPROVAL_CUSTOM_ID.exec(button.customId);
      if (parsed) {
        hashes.add(hashApprovalToken(parsed[2]));
      }
    }
    if (hashes.size === 0) {
      return;
    }
    try {
      await this.tokens.delete({ tokenHash: In([...hashes]) });
    } catch (error) {
      this.logger.warn(`chat approval revoke failed reason=${errorName(error)}`);
    }
  }

  /** CHAT-STATE-PERSIST-01: deletes expired token rows (the delivery pass). Returns the rows deleted. */
  async pruneExpired(): Promise<number> {
    const result = await this.tokens.delete({ expiresAt: LessThanOrEqual(new Date(this.now())) });
    return result.affected ?? 0;
  }

  /**
   * CHAT-STATE-PERSIST-01, the repair rule (stage-start section 4): true when
   * the step is still waiting in that run, positively read-only, and has no
   * live token row (its buttons died with an old process or a rollback).
   * Steps that only get the Team page line are never sent again.
   */
  async needsFreshButtons(collaborationRunId: string, referralId: string): Promise<boolean> {
    const entity = await this.referrals.findOne({ where: { referralId } });
    if (
      !entity ||
      entity.collaborationRunId !== collaborationRunId ||
      entity.status !== 'pending_approval' ||
      !chatStepIsReadOnly(entity)
    ) {
      return false;
    }
    const live = await this.tokens.findOne({
      where: { referralId, expiresAt: MoreThan(new Date(this.now())) },
    });
    return !live;
  }

  /** The transport's component handler (button presses and, CHAT-TIDY-01, reject form submits). Never throws. */
  async handlePress(press: ChatComponentPress): Promise<ChatComponentResponse> {
    const fallback = normalizeChatLocale(press.locale);
    try {
      if (!isChatDiscordEnabled()) {
        return this.refuse(null, null, 'not_available', fallback);
      }
      if (!press.directMessage) {
        return this.refuse(null, null, 'unavailable', fallback);
      }
      this.activity?.notify(CHAT_CHANNEL_DISCORD, press.externalUserId);
      const customId = typeof press.customId === 'string' ? press.customId : '';
      const fromForm = press.modalValues !== undefined;
      // CHAT-TIDY-01: a button custom id only from a button press, a form custom id only from a form submit.
      const button = fromForm ? null : CHAT_APPROVAL_CUSTOM_ID.exec(customId);
      const form = fromForm ? CHAT_APPROVAL_REASON_FORM_ID.exec(customId) : null;
      if (button?.[1] === 'r') {
        // CHAT-TIDY-01: Reject opens the reason form; nothing is read, decided or spent until it is sent.
        this.logger.log('chat approval reject form opened');
        return { kind: 'modal', modal: this.rejectForm(fallback, button[2]) };
      }
      const action: 'approve' | 'reject' = button ? 'approve' : 'reject';
      const rawToken = button?.[2] ?? form?.[1] ?? null;
      const tokenKey = rawToken ? hashApprovalToken(rawToken) : '';
      const token = rawToken ? await this.lookup(tokenKey) : null;
      if (!token) {
        return this.refuse(null, null, 'unavailable', fallback);
      }
      if (token.expiresAt <= this.now()) {
        await this.spend(tokenKey);
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
        await this.spend(tokenKey);
        return this.refuse(link, token, 'unavailable', link.locale);
      }

      if (action === 'approve' && !chatStepIsReadOnly(entity)) {
        await this.writeAudit(CHAT_APPROVAL_AUDIT_EVENTS.refused, link, token, { reason: 'not_read_only' });
        return this.refuse(link, token, 'not_read_only', link.locale);
      }

      // CHAT-TIDY-01: one decision per token: the delete must remove exactly one row.
      if (!(await this.spendOnce(tokenKey))) {
        return this.refuse(link, token, 'unavailable', link.locale, 'already_spent');
      }

      const typedReason = action === 'reject' ? chatRejectReason(press.modalValues) : null;
      if (action === 'approve') {
        try {
          await this.starts.approveStep({
            collaborationRunId: token.collaborationRunId,
            referralId: token.referralId,
            decidedBy: link.userId,
            approveWithoutPassingTests: false,
          });
        } catch (error) {
          const reason = chatApprovalRefusalOf(error);
          if (reason !== 'unavailable') {
            await this.restore(tokenKey, token);
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
            // CHAT-TIDY-01: the typed reason (stored as the Team page stores one), else the translated fixed text.
            reason: typedReason ?? chatReply(link.locale, 'approval.rejectDefaultReason'),
          });
        } catch (error) {
          const reason = chatApprovalRefusalOf(error);
          if (reason !== 'unavailable') {
            await this.restore(tokenKey, token);
          }
          return this.refuse(link, token, reason === 'unavailable' ? 'unavailable' : 'refused', link.locale);
        }
      }

      const decision = action === 'approve' ? 'approved' : 'rejected';
      await this.writeAudit(CHAT_APPROVAL_AUDIT_EVENTS.decided, link, token, {
        decision,
        // A reason code only; the typed reason is never audited or logged.
        reason: action === 'approve' ? 'owner' : typedReason ? 'typed' : 'default',
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

  /**
   * CHAT-STATE-PERSIST-01: a new random token for the step. Expired rows are
   * deleted, the step's earlier row is replaced, and only the token's SHA-256
   * is stored. Returns the token (it goes only into the custom ids).
   */
  private async issue(entry: ApprovalToken): Promise<string> {
    const now = this.now();
    await this.tokens.delete({ expiresAt: LessThanOrEqual(new Date(now)) });
    await this.tokens.delete({ referralId: entry.referralId });
    const token = randomBytes(16).toString('base64url');
    await this.tokens.insert({
      tokenHash: hashApprovalToken(token),
      collaborationRunId: entry.collaborationRunId,
      linkId: entry.linkId,
      userId: entry.userId,
      referralId: entry.referralId,
      step: entry.step,
      expiresAt: new Date(entry.expiresAt),
      createdAt: new Date(now),
    });
    return token;
  }

  /** The token row by its hash, as the press reads it. */
  private async lookup(tokenHash: string): Promise<ApprovalToken | null> {
    const row = await this.tokens.findOne({ where: { tokenHash } });
    if (!row) {
      return null;
    }
    return {
      linkId: row.linkId,
      userId: row.userId,
      collaborationRunId: row.collaborationRunId,
      referralId: row.referralId,
      step: row.step,
      expiresAt: new Date(row.expiresAt).getTime(),
    };
  }

  /** The button is spent: its row is deleted (a clean-up; no count is needed). */
  private async spend(tokenHash: string): Promise<void> {
    await this.tokens.delete({ tokenHash });
  }

  /**
   * CHAT-TIDY-01: spends the token before the decision. True only when the
   * delete removed exactly one row; none means another press spent it first.
   */
  private async spendOnce(tokenHash: string): Promise<boolean> {
    const result = await this.tokens.delete({ tokenHash });
    return (result.affected ?? 0) === 1;
  }

  /**
   * CHAT-TIDY-01: the decision was refused and the step still waits: the
   * token row is put back, so the buttons keep working. A newer message for
   * the step (its own row) wins; a failure is logged with a reason code only.
   */
  private async restore(tokenHash: string, token: ApprovalToken): Promise<void> {
    try {
      await this.tokens.insert({
        tokenHash,
        collaborationRunId: token.collaborationRunId,
        linkId: token.linkId,
        userId: token.userId,
        referralId: token.referralId,
        step: token.step,
        expiresAt: new Date(token.expiresAt),
        createdAt: new Date(this.now()),
      });
    } catch (error) {
      this.logger.warn(`chat approval token not restored reason=${errorName(error)}`);
    }
  }

  /** CHAT-TIDY-01: the reject form in the presser's language; its custom id carries the same token. */
  private rejectForm(locale: ChatLinkLocale, token: string): ChatModal {
    return {
      customId: `ap1:f:${token}`,
      title: chatReply(locale, 'approval.rejectFormTitle'),
      field: {
        customId: CHAT_APPROVAL_REASON_FIELD,
        label: chatReply(locale, 'approval.rejectReasonLabel'),
        maxLength: CHAT_APPROVAL_LIMITS.rejectReasonChars,
      },
    };
  }

  private refuse(
    link: ChatLinkUse | null,
    token: ApprovalToken | null,
    reason: ChatApprovalRefusal,
    locale: ChatLinkLocale,
    detail?: 'already_spent',
  ): ChatComponentResponse {
    const linkPart = link ? ` linkId=${link.linkId}` : '';
    const stepPart = token && link ? ` runId=${token.collaborationRunId} referralId=${token.referralId}` : '';
    const detailPart = detail ? ` detail=${detail}` : '';
    this.logger.log(`chat approval refused reason=${reason}${detailPart}${linkPart}${stepPart}`);
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
