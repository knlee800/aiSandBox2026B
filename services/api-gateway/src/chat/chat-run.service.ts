import { HttpException, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatRunDelivery } from '../entities/chat-run-delivery.entity';
import { User } from '../entities/user.entity';
import {
  CollaborationRunStartedNotifier,
  CollaborationStartService,
  type CollaborationRunStartedEvent,
  type CollaborationStartInput,
} from '../orchestration/collaboration-start.service';
import { WORKFLOW_REFUSAL_CODES } from '../orchestration/collaboration-workflow';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { CHAT_RUN_AUDIT_EVENTS, ChatDeliveryService } from './chat-delivery.service';
import { ChatLimits } from './chat-limits';
import { CHAT_AUDIT_CATEGORY, CHAT_CHANNEL_DISCORD, ChatLinkUse } from './chat-link.service';
import { chatReply, ChatReplyKey } from './chat-replies';
import { isChatDiscordEnabled } from './chat-switch';
import type { ChatReplyMessage } from './chat-transport';

/**
 * CHAT-DISCORD-01 slice C1 (stage-start sections 6.1, 6.2, 6.4, 6.5): runs
 * started from the chat channel.
 *
 * /ask text [agent]: as the linked owner, through CollaborationStartService
 * (the Team page's own start and approve code, decision D1):
 *  1. runs switched off (GLOBAL_EXECUTION_ENABLED): refused, nothing created;
 *  2. per-owner limits: 10 /ask or /cancel a minute, 3 Discord runs in progress;
 *  3. the agent option (or a leading @name in the text) is resolved against the
 *     owner's own workflow list; no agent is the Chief of Staff;
 *  4. the body is the page's body, { team: 'chief-of-staff', task } or
 *     { workflowId, task }, read by the page's own parser; never a sessionId
 *     (D2: so the run is read-profile only by the existing rule);
 *  5. the start makes the run and its first hand-off waiting for approval;
 *  6. the delivery row (ids only) is written;
 *  7. the first step is approved as the owner (Keith's Q7): approveReferral
 *     with every existing check (provider switch, global switch and daily
 *     caps, abort guard, credits, token quota, workflow checks, tests gate);
 *     a refusal cancels the run and answers a translated refusal.
 * The identity is the one the session guard builds (D7: apiKeyId
 * 'browser-session'); the channel is recorded on the delivery row and the
 * audit row instead.
 *
 * Nothing in a Discord message sets provider, model, instructions, grants,
 * approval settings, entitlements or budgets (D3): only the text and agent
 * options are read. The text is the task; it is never logged, audited or
 * echoed. Audit rows (category chat) and log lines hold ids, reason codes
 * and counts only.
 *
 * CHAT-RESULTS-OTHER-01: every run the owner starts anywhere (Team page,
 * public API route, schedules, triggers, Discord) gets a delivery row, so its
 * approval notices and result arrive in the linked Discord. The listener on
 * CollaborationRunStartedNotifier (onRunStarted) inserts the row when the
 * chat switch is on and the owner is active with a Discord link, then wakes
 * the delivery. Both that insert and /ask's own insert are insert-or-ignore
 * on the run id, so a Discord-started run has exactly one row whichever comes
 * first. The listener never breaks a start: failures are logged with ids and
 * a reason code only. The /ask limit of 3 runs in progress, /cancel and
 * /status still count only runs started from Discord: a waiting row whose run
 * has this owner's run_started chat audit row (written by /ask only).
 *
 * CHAT-STATE-PERSIST-01: the row says where it came from (origin): /ask
 * writes 'chat' (and sets it when the listener's row came first); the
 * listener names no origin, so the column default 'platform' is stored. The
 * /ask limit, /cancel and /status count rows whose origin is 'chat'; rows
 * from before migration 1817 (origin NULL) are still read through the
 * run_started audit rows.
 *
 * CHAT-STATE-PERSIST-01: the 10-a-minute /ask and /cancel limit is counted
 * in chat_limit_hits (ChatLimits, bucket command, the owner id), so a restart
 * does not reset it; a store error answers the fixed error line and starts or
 * cancels nothing.
 */

export const CHAT_RUN_LIMITS = {
  /** /ask and /cancel per owner per minute. */
  commandsPerMinute: 10,
  windowMs: 60 * 1000,
  /** Discord-started runs in progress (waiting delivery rows) per link. */
  activeRuns: 3,
  /** Workflow names listed in a refusal. */
  listedNames: 10,
  listedNameChars: 60,
  /** CHAT-RESULTS-OTHER-01: waiting rows read to find the link's Discord-started runs (newest first). */
  waitingRowsRead: 100,
} as const;

/** Why /ask did not start a run (audit reason codes; never text from Discord). */
export type ChatRunRefusal =
  | 'runs_off'
  | 'not_entitled'
  | 'inactive'
  | 'rate_limited'
  | 'too_many_runs'
  | 'bad_task'
  | 'unknown_agent'
  | 'ambiguous_agent'
  | 'no_agents'
  | 'provider_off'
  | 'no_credits'
  | 'over_cap'
  | 'workflow_off'
  | 'workflow_not_tested'
  | 'workflow_invalid'
  | 'workflow_budget'
  | 'workflow_not_found'
  | 'refused';

const REFUSAL_REPLIES: Readonly<Record<ChatRunRefusal, ChatReplyKey>> = {
  runs_off: 'ask.runsOff',
  not_entitled: 'notEntitled',
  inactive: 'notEntitled',
  rate_limited: 'ask.tooMany',
  too_many_runs: 'ask.tooManyRuns',
  bad_task: 'ask.badTask',
  unknown_agent: 'ask.unknownAgent',
  ambiguous_agent: 'ask.ambiguousAgent',
  no_agents: 'ask.noAgents',
  provider_off: 'ask.providerOff',
  no_credits: 'ask.noCredits',
  over_cap: 'ask.overCap',
  workflow_off: 'ask.workflowOff',
  workflow_not_tested: 'ask.workflowNotTested',
  workflow_invalid: 'ask.workflowInvalid',
  workflow_budget: 'ask.workflowBudget',
  workflow_not_found: 'ask.refused',
  refused: 'ask.refused',
};

const WORKFLOW_REFUSALS: Readonly<Record<string, ChatRunRefusal>> = {
  [WORKFLOW_REFUSAL_CODES.notFound]: 'workflow_not_found',
  [WORKFLOW_REFUSAL_CODES.disabled]: 'workflow_off',
  [WORKFLOW_REFUSAL_CODES.invalid]: 'workflow_invalid',
  [WORKFLOW_REFUSAL_CODES.notTested]: 'workflow_not_tested',
  [WORKFLOW_REFUSAL_CODES.budgetDay]: 'workflow_budget',
  [WORKFLOW_REFUSAL_CODES.budgetRun]: 'workflow_budget',
};

/** Maps a start or approve refusal to a reason code. Reads only the status, a code and the platform's own message. */
export function chatRunRefusalOf(error: unknown): ChatRunRefusal {
  if (!(error instanceof HttpException)) {
    return 'refused';
  }
  const status = error.getStatus();
  const response = error.getResponse();
  const body = typeof response === 'object' && response !== null ? (response as Record<string, unknown>) : {};
  const message = typeof response === 'string' ? response : typeof body.message === 'string' ? body.message : '';
  const code = typeof body.code === 'string' ? body.code : '';
  if (code && WORKFLOW_REFUSALS[code]) {
    return WORKFLOW_REFUSALS[code];
  }
  if (status === 402) {
    return 'no_credits';
  }
  if (status === 429) {
    return 'over_cap';
  }
  if (status === 503) {
    if (message.includes('disabled for maintenance')) return 'runs_off';
    if (/^Provider \S+ temporarily unavailable$/.test(message)) return 'provider_off';
    if (message === 'Insufficient credit balance') return 'no_credits';
    if (message === 'Token quota exceeded') return 'over_cap';
    return 'refused';
  }
  if (status === 400 && /^task (is required|must be at most)/.test(message)) {
    return 'bad_task';
  }
  return 'refused';
}

export interface ChatAskOptions {
  text?: string;
  agent?: string;
}

interface OwnerWorkflow {
  id: string;
  name: string;
  status: string;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  return /^[A-Za-z0-9_]{1,64}$/.test(name) ? name : 'Error';
}

@Injectable()
export class ChatRunService implements OnModuleDestroy {
  private readonly logger = new Logger('ChatRuns');
  /** CHAT-STATE-PERSIST-01: the persisted limits (in memory only when built without ChatModule's provider). */
  private readonly limits: ChatLimits;
  private readonly stopListening: (() => void) | null;

  constructor(
    private readonly starts: CollaborationStartService,
    private readonly orchestration: OrchestrationService,
    private readonly delivery: ChatDeliveryService,
    @InjectRepository(ChatRunDelivery)
    private readonly deliveries: Repository<ChatRunDelivery>,
    @InjectRepository(AuditEventEntity)
    private readonly audit: Repository<AuditEventEntity>,
    @Optional() @InjectRepository(ChatLink)
    private readonly links?: Repository<ChatLink>,
    @Optional() @InjectRepository(User)
    private readonly users?: Repository<User>,
    @Optional() startedRuns?: CollaborationRunStartedNotifier,
    // CHAT-STATE-PERSIST-01: present in ChatModule.
    @Optional() limits?: ChatLimits,
  ) {
    this.limits = limits ?? ChatLimits.inMemory();
    // CHAT-RESULTS-OTHER-01: start never waits for this; onRunStarted never throws.
    this.stopListening = startedRuns ? startedRuns.onStarted((event) => this.onRunStarted(event)) : null;
  }

  onModuleDestroy(): void {
    this.stopListening?.();
  }

  /**
   * CHAT-RESULTS-OTHER-01: a run was started anywhere. With the chat switch on
   * and the owner active with a Discord link, its delivery row is inserted
   * (insert-or-ignore on the run id) and the delivery is woken. True when the
   * row was written or was already there. Never throws; a failure is logged
   * with ids and a reason code only.
   */
  async onRunStarted(event: CollaborationRunStartedEvent): Promise<boolean> {
    const runId = event.collaborationRunId;
    try {
      if (!isChatDiscordEnabled() || !this.links || !this.users) {
        return false;
      }
      const link = await this.links.findOne({ where: { userId: event.userId, channel: CHAT_CHANNEL_DISCORD } });
      if (!link) {
        return false;
      }
      const owner = await this.users.findOne({ where: { id: event.userId }, select: ['id', 'isActive'] });
      if (!owner || owner.isActive !== true) {
        return false;
      }
      try {
        await this.insertDeliveryRow(runId, link.id);
      } catch (error) {
        this.logger.warn(`chat run delivery row failed runId=${runId} linkId=${link.id} reason=${errorName(error)}`);
        return false;
      }
      this.logger.log(`chat run delivery row runId=${runId} linkId=${link.id}`);
      this.delivery.wake();
      return true;
    } catch (error) {
      this.logger.warn(`chat run started listener failed runId=${runId} reason=${errorName(error)}`);
      return false;
    }
  }

  /** /ask for a linked owner who is active and harness-entitled now (checked by the caller). */
  async ask(link: ChatLinkUse, options: ChatAskOptions): Promise<ChatReplyMessage> {
    if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED) {
      return this.refuse(link, 'runs_off', 'precheck');
    }
    const command = await this.takeCommand(link);
    if (command === null) {
      return { text: chatReply(link.locale, 'error') };
    }
    if (!command) {
      return this.refuse(link, 'rate_limited', 'precheck');
    }
    const inProgress = (await this.discordWaitingRows(link)).length;
    if (inProgress >= CHAT_RUN_LIMITS.activeRuns) {
      return this.refuse(link, 'too_many_runs', 'precheck');
    }

    const target = await this.resolveTarget(link, options);
    if ('refusal' in target) {
      return this.refuse(link, target.refusal, 'precheck', target.names);
    }

    // The page's own parser: trim, required, at most 8000 characters. The body
    // never has a sessionId, so the run is the read-profile business run (D2).
    let input: CollaborationStartInput;
    try {
      input = this.starts.readStartBody(
        target.workflowId ? { workflowId: target.workflowId, task: target.task } : { team: 'chief-of-staff', task: target.task },
      );
    } catch (error) {
      return this.refuse(link, chatRunRefusalOf(error), 'start');
    }
    if (input.sessionId !== undefined) {
      return this.refuse(link, 'refused', 'start');
    }

    let started: { collaborationRunId: string; referralId: string };
    try {
      started = await this.starts.start(this.identityFor(link), input);
    } catch (error) {
      return this.refuse(link, chatRunRefusalOf(error), 'start');
    }

    // CHAT-RESULTS-OTHER-01: insert-or-ignore; the start's listener may have written it already.
    // CHAT-STATE-PERSIST-01: either way the row is marked as started from the chat.
    try {
      await this.insertDeliveryRow(started.collaborationRunId, link.linkId, 'chat');
      await this.deliveries.update(
        { collaborationRunId: started.collaborationRunId, linkId: link.linkId },
        { origin: 'chat' },
      );
    } catch (error) {
      await this.cancelRefused(started.collaborationRunId, link, 'delivery_row');
      this.logger.warn(`chat run delivery row failed linkId=${link.linkId} reason=${errorName(error)}`);
      return { text: chatReply(link.locale, 'error') };
    }

    // Keith's Q7: the command is the owner's request for the first step.
    try {
      await this.starts.approveStep({
        collaborationRunId: started.collaborationRunId,
        referralId: started.referralId,
        decidedBy: link.userId,
        approveWithoutPassingTests: false,
      });
    } catch (error) {
      const reason = chatRunRefusalOf(error);
      await this.cancelRefused(started.collaborationRunId, link, reason);
      await this.markDropped(started.collaborationRunId);
      return this.refuse(link, reason, 'approve', undefined, started.collaborationRunId);
    }

    await this.writeAudit(CHAT_RUN_AUDIT_EVENTS.runStarted, link, started.collaborationRunId, {
      channel: CHAT_CHANNEL_DISCORD,
      linkId: link.linkId,
      collaborationRunId: started.collaborationRunId,
      target: target.workflowId ? 'workflow' : 'chief-of-staff',
      ...(target.workflowId ? { workflowId: target.workflowId } : {}),
    });
    this.logger.log(
      `chat run started linkId=${link.linkId} runId=${started.collaborationRunId} target=${target.workflowId ? 'workflow' : 'chief-of-staff'}`,
    );
    this.delivery.wake();
    return { text: chatReply(link.locale, 'ask.started') };
  }

  /** /ask from an owner who is inactive or no longer entitled: one audit row, the fixed refusal. */
  async refuseOwner(link: ChatLinkUse, reason: 'inactive' | 'not_entitled'): Promise<ChatReplyMessage> {
    return this.refuse(link, reason, 'precheck');
  }

  /**
   * /cancel: cancels the owner's latest Discord-started run that is still
   * active, through the page's cancel (cancelCollaboration, owner, omitted
   * reason). Its delivery row is dropped: the owner asked for no result.
   */
  async cancel(link: ChatLinkUse): Promise<ChatReplyMessage> {
    const command = await this.takeCommand(link);
    if (command === null) {
      return { text: chatReply(link.locale, 'error') };
    }
    if (!command) {
      return { text: chatReply(link.locale, 'ask.tooMany') };
    }
    const waiting = (await this.discordWaitingRows(link)).slice(0, CHAT_RUN_LIMITS.activeRuns * 4);
    for (const row of waiting) {
      const cancelled = await this.starts.cancelOwnedActiveRun(row.collaborationRunId, link.userId);
      if (cancelled) {
        await this.markDropped(row.collaborationRunId);
        this.logger.log(`chat run cancelled linkId=${link.linkId} runId=${row.collaborationRunId}`);
        return { text: chatReply(link.locale, 'cancel.done') };
      }
    }
    return { text: chatReply(link.locale, 'cancel.nothing') };
  }

  /** /status: Discord-started runs in progress and their steps waiting for approval (counts only). */
  async statusCounts(link: ChatLinkUse): Promise<{ running: number; waiting: number }> {
    const rows = (await this.discordWaitingRows(link)).slice(0, CHAT_RUN_LIMITS.activeRuns * 4);
    let running = 0;
    let waiting = 0;
    for (const row of rows) {
      const run = await this.orchestration.getCollaborationRun(row.collaborationRunId);
      if (!run || run.userId !== link.userId || run.status !== 'active') {
        continue;
      }
      running += 1;
      for (const referralId of run.referralIds) {
        const referral = await this.orchestration.getReferral(referralId);
        if (referral?.status === 'pending_approval') {
          waiting += 1;
        }
      }
    }
    return { running, waiting };
  }

  /**
   * CHAT-RESULTS-OTHER-01: one delivery row (ids only), insert-or-ignore on
   * the run id (ON CONFLICT DO NOTHING). Throws when the insert fails.
   * CHAT-STATE-PERSIST-01: /ask passes origin 'chat'; the listener passes
   * none, so the column default ('platform') is stored.
   */
  private async insertDeliveryRow(collaborationRunId: string, linkId: string, origin?: 'chat'): Promise<void> {
    await this.deliveries
      .createQueryBuilder()
      .insert()
      .into(ChatRunDelivery)
      .values({
        collaborationRunId,
        linkId,
        status: 'waiting',
        notifiedReferralIds: [],
        createdAt: new Date(),
        deliveredAt: null,
        ...(origin ? { origin } : {}),
      })
      .orIgnore()
      .execute();
  }

  /**
   * CHAT-RESULTS-OTHER-01: the link's waiting rows of runs started from
   * Discord, newest first. Rows of runs started elsewhere also wait now.
   * CHAT-STATE-PERSIST-01: a row counts when its origin is 'chat'; a row
   * with origin 'platform' does not; a row from before migration 1817
   * (origin NULL) counts only when the owner has the run's run_started chat
   * audit row (/ask writes it after the first step is approved), as before.
   */
  private async discordWaitingRows(link: ChatLinkUse): Promise<ChatRunDelivery[]> {
    const rows = await this.deliveries.find({
      where: { linkId: link.linkId, status: 'waiting' },
      order: { createdAt: 'DESC' },
      take: CHAT_RUN_LIMITS.waitingRowsRead,
    });
    if (rows.length === 0) {
      return [];
    }
    const unmarked = rows.filter((row) => row.origin === null || row.origin === undefined);
    if (unmarked.length === 0) {
      return rows.filter((row) => row.origin === 'chat');
    }
    const started = await this.audit.find({
      where: {
        category: CHAT_AUDIT_CATEGORY,
        eventType: CHAT_RUN_AUDIT_EVENTS.runStarted,
        subjectType: 'collaboration_run',
        subjectId: In(unmarked.map((row) => row.collaborationRunId)),
        userId: link.userId,
      },
      select: ['subjectId'],
    });
    const fromDiscord = new Set(started.map((row) => row.subjectId));
    return rows.filter(
      (row) =>
        row.origin === 'chat' ||
        ((row.origin === null || row.origin === undefined) && fromDiscord.has(row.collaborationRunId)),
    );
  }

  /**
   * CHAT-STATE-PERSIST-01: one /ask or /cancel against the owner's 10 a
   * minute. True: counted. False: over the limit (not counted). Null: the
   * store failed (logged with a reason code only).
   */
  private async takeCommand(link: ChatLinkUse): Promise<boolean | null> {
    try {
      const taken = await this.limits.take(
        'command',
        link.userId,
        { limit: CHAT_RUN_LIMITS.commandsPerMinute, windowMs: CHAT_RUN_LIMITS.windowMs },
        Date.now(),
      );
      return taken.allowed;
    } catch (error) {
      this.logger.warn(`chat run limit store failed linkId=${link.linkId} reason=${errorName(error)}`);
      return null;
    }
  }

  /** The identity the session guard builds for the owner (D7), harness access already checked. */
  private identityFor(link: ChatLinkUse): ApiKeyIdentity {
    return {
      userId: link.userId,
      apiKeyId: 'browser-session',
      scopes: ['ai:execute'],
      isInternal: true,
      harnessEntitled: true,
    };
  }

  private async resolveTarget(
    link: ChatLinkUse,
    options: ChatAskOptions,
  ): Promise<{ task: string; workflowId: string | null } | { refusal: ChatRunRefusal; names?: string }> {
    let text = typeof options.text === 'string' ? options.text : '';
    let agent = typeof options.agent === 'string' && options.agent.trim().length > 0 ? options.agent : null;
    const leadingName = agent === null && text.trimStart().startsWith('@');
    if (agent === null && !leadingName) {
      return { task: text, workflowId: null };
    }

    let workflows: OwnerWorkflow[];
    try {
      workflows = (await this.starts.listOwnerWorkflows(link.userId)).map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
      }));
    } catch {
      return { refusal: 'no_agents' };
    }

    if (leadingName) {
      const rest = text.trimStart().slice(1);
      const named = this.leadingWorkflowName(rest, workflows);
      agent = named.name;
      text = named.rest;
    }
    const wanted = normalizeName(agent ?? '');
    const matches = workflows.filter((workflow) => normalizeName(workflow.name) === wanted);
    if (matches.length === 1) {
      return { task: text, workflowId: matches[0].id };
    }
    const names = this.switchedOnNames(workflows);
    if (names.length === 0) {
      return { refusal: 'no_agents' };
    }
    return { refusal: matches.length === 0 ? 'unknown_agent' : 'ambiguous_agent', names };
  }

  /** "@Name rest": the longest workflow name the text starts with, else the first word. */
  private leadingWorkflowName(rest: string, workflows: readonly OwnerWorkflow[]): { name: string; rest: string } {
    const lower = rest.toLowerCase();
    const byLength = [...workflows].sort((a, b) => b.name.length - a.name.length);
    for (const workflow of byLength) {
      const name = workflow.name.trim();
      if (name.length === 0) continue;
      if (lower.startsWith(name.toLowerCase()) && (rest.length === name.length || /\s/.test(rest[name.length]))) {
        return { name, rest: rest.slice(name.length) };
      }
    }
    const match = /^(\S*)([\s\S]*)$/.exec(rest);
    return { name: match?.[1] ?? '', rest: match?.[2] ?? '' };
  }

  /** The owner's switched-on workflow names, for a refusal. Their own data, cut and counted. */
  private switchedOnNames(workflows: readonly OwnerWorkflow[]): string {
    const names = workflows
      .filter((workflow) => workflow.status === 'active')
      .map((workflow) => Array.from(workflow.name.trim()).slice(0, CHAT_RUN_LIMITS.listedNameChars).join(''))
      .filter((name) => name.length > 0)
      .slice(0, CHAT_RUN_LIMITS.listedNames);
    return names.join(', ');
  }

  private async refuse(
    link: ChatLinkUse,
    reason: ChatRunRefusal,
    stage: 'precheck' | 'start' | 'approve',
    names?: string,
    collaborationRunId?: string,
  ): Promise<ChatReplyMessage> {
    await this.writeAudit(CHAT_RUN_AUDIT_EVENTS.runRefused, link, collaborationRunId ?? link.linkId, {
      channel: CHAT_CHANNEL_DISCORD,
      linkId: link.linkId,
      reason,
      stage,
      ...(collaborationRunId ? { collaborationRunId } : {}),
    });
    this.logger.log(
      `chat run refused linkId=${link.linkId} reason=${reason} stage=${stage}${collaborationRunId ? ` runId=${collaborationRunId}` : ''}`,
    );
    const key = REFUSAL_REPLIES[reason];
    return { text: chatReply(link.locale, key, names !== undefined ? { names } : undefined) };
  }

  /** A run that was created and then refused is cancelled (the page's cancel with a reason code). */
  private async cancelRefused(collaborationRunId: string, link: ChatLinkUse, reason: string): Promise<void> {
    try {
      await this.orchestration.cancelCollaboration({
        collaborationRunId,
        cancelledByUserId: link.userId,
        cancelReason: `chat_refused:${reason}`,
      });
    } catch (error) {
      this.logger.warn(`chat run cancel failed linkId=${link.linkId} runId=${collaborationRunId} reason=${errorName(error)}`);
    }
  }

  private async markDropped(collaborationRunId: string): Promise<void> {
    try {
      await this.deliveries.update({ collaborationRunId, status: 'waiting' }, { status: 'dropped' });
    } catch (error) {
      this.logger.warn(`chat delivery drop failed runId=${collaborationRunId} reason=${errorName(error)}`);
    }
  }

  private async writeAudit(
    eventType: string,
    link: ChatLinkUse,
    subjectId: string,
    payload: Record<string, string | number>,
  ): Promise<void> {
    try {
      await this.audit.insert({
        category: CHAT_AUDIT_CATEGORY,
        eventType,
        subjectType: payload.collaborationRunId ? 'collaboration_run' : 'chat_link',
        subjectId,
        userId: link.userId,
        payload,
        occurredAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(`chat run audit insert failed event=${eventType} reason=${errorName(error)}`);
    }
  }
}
