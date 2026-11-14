import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatRunDelivery } from '../entities/chat-run-delivery.entity';
import {
  CollaborationStartService,
  type CollaborationStartInput,
} from '../orchestration/collaboration-start.service';
import { WORKFLOW_REFUSAL_CODES } from '../orchestration/collaboration-workflow';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import {
  CHAT_RUN_AUDIT_EVENTS,
  chatRunReply,
  ChatDeliveryService,
  ChatRunReplyKey,
} from './chat-delivery.service';
import { CHAT_AUDIT_CATEGORY, CHAT_CHANNEL_DISCORD, ChatLinkUse } from './chat-link.service';
import { chatReply } from './chat-replies';
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

const REFUSAL_REPLIES: Readonly<Record<ChatRunRefusal, ChatRunReplyKey | 'notEntitled'>> = {
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

class MinuteCounter {
  private readonly hits = new Map<string, number[]>();

  /** Records one hit; false when the key is over the limit (the hit is not recorded). */
  take(key: string, limit: number, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((at) => at > now - CHAT_RUN_LIMITS.windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  return /^[A-Za-z0-9_]{1,64}$/.test(name) ? name : 'Error';
}

@Injectable()
export class ChatRunService {
  private readonly logger = new Logger('ChatRuns');
  private readonly commands = new MinuteCounter();

  constructor(
    private readonly starts: CollaborationStartService,
    private readonly orchestration: OrchestrationService,
    private readonly delivery: ChatDeliveryService,
    @InjectRepository(ChatRunDelivery)
    private readonly deliveries: Repository<ChatRunDelivery>,
    @InjectRepository(AuditEventEntity)
    private readonly audit: Repository<AuditEventEntity>,
  ) {}

  /** /ask for a linked owner who is active and harness-entitled now (checked by the caller). */
  async ask(link: ChatLinkUse, options: ChatAskOptions): Promise<ChatReplyMessage> {
    if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED) {
      return this.refuse(link, 'runs_off', 'precheck');
    }
    if (!this.commands.take(link.userId, CHAT_RUN_LIMITS.commandsPerMinute, Date.now())) {
      return this.refuse(link, 'rate_limited', 'precheck');
    }
    const inProgress = await this.deliveries.count({ where: { linkId: link.linkId, status: 'waiting' } });
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

    try {
      await this.deliveries.insert({
        collaborationRunId: started.collaborationRunId,
        linkId: link.linkId,
        status: 'waiting',
        notifiedReferralIds: [],
        createdAt: new Date(),
        deliveredAt: null,
      });
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
    return { text: chatRunReply(link.locale, 'ask.started') };
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
    if (!this.commands.take(link.userId, CHAT_RUN_LIMITS.commandsPerMinute, Date.now())) {
      return { text: chatRunReply(link.locale, 'ask.tooMany') };
    }
    const waiting = await this.deliveries.find({
      where: { linkId: link.linkId, status: 'waiting' },
      order: { createdAt: 'DESC' },
      take: CHAT_RUN_LIMITS.activeRuns * 4,
    });
    for (const row of waiting) {
      const cancelled = await this.starts.cancelOwnedActiveRun(row.collaborationRunId, link.userId);
      if (cancelled) {
        await this.markDropped(row.collaborationRunId);
        this.logger.log(`chat run cancelled linkId=${link.linkId} runId=${row.collaborationRunId}`);
        return { text: chatRunReply(link.locale, 'cancel.done') };
      }
    }
    return { text: chatRunReply(link.locale, 'cancel.nothing') };
  }

  /** /status: Discord-started runs in progress and their steps waiting for approval (counts only). */
  async statusCounts(link: ChatLinkUse): Promise<{ running: number; waiting: number }> {
    const rows = await this.deliveries.find({
      where: { linkId: link.linkId, status: 'waiting' },
      take: CHAT_RUN_LIMITS.activeRuns * 4,
    });
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
    if (key === 'notEntitled') {
      return { text: chatReply(link.locale, 'notEntitled') };
    }
    return { text: chatRunReply(link.locale, key, names !== undefined ? { names } : undefined) };
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
