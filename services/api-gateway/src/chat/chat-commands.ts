import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntitlementService } from '../auth/entitlement.service';
import { User } from '../entities/user.entity';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import {
  CHAT_LINK_LOCALES,
  ChatLinkClaimOutcome,
  ChatLinkLocale,
  ChatLinkService,
  ChatLinkUse,
  normalizeChatLocale,
} from './chat-link.service';
import { chatLanguageName, chatReply, ChatReplyKey } from './chat-replies';
import { chatRunReply } from './chat-delivery.service';
import { ChatRunService } from './chat-run.service';
import { isChatDiscordEnabled } from './chat-switch';
import type { ChatCommandInvocation, ChatReplyMessage } from './chat-transport';
import { ChatCommandName, isChatCommandName } from './discord/discord-commands';

/**
 * CHAT-DISCORD-01 slices B and C1 (stage-start sections 5, 6.1, 6.2, 6.4,
 * 6.5): what each slash command does.
 *
 * - /link code: ChatLinkService.claim; one fixed reply per outcome, nothing
 *   for a silenced user. A claim alone links nothing.
 * - /unlink: removes the link of this outside account.
 * - /status: linked, runs on or off, the reply language, and (C1) the counts
 *   of Discord-started runs in progress and their steps waiting for approval.
 * - /language: stores the reply language on the link.
 * - /help: fixed text.
 * - /ask (C1): starts a run as the linked owner through ChatRunService (the
 *   Team page's start and approve code); runs off: refused, nothing created.
 * - /cancel is not registered yet: ChatRunService.cancel is built and tested,
 *   but adding the command changes the registered count that
 *   discord/discord-transport.spec.ts pins (outside slice C1's write set).
 *
 * An unlinked outside user gets fixed text only (/help, or "link first"). A
 * linked owner who is inactive or has lost harness access gets one fixed
 * refusal for /status, /language and /ask; /help and /unlink still work.
 *
 * Every invocation field is untrusted. Only the command name (checked against
 * the fixed list) and the declared options are read. Option values are
 * passed only to claim (the code), to the language check and (C1) to
 * ChatRunService as the task and the agent name; no value from Discord is
 * ever logged or put into a reply. Log lines carry the command
 * name, an outcome code and the link's own uuid.
 */

const CHANNEL = 'discord' as const;

function message(locale: ChatLinkLocale, key: ChatReplyKey, values?: Record<string, string>): ChatReplyMessage {
  return { text: chatReply(locale, key, values) };
}

const CLAIM_REPLIES: Readonly<Record<ChatLinkClaimOutcome, ChatReplyKey | null>> = {
  claimed: 'link.claimed',
  invalid: 'link.invalid',
  already_linked: 'link.alreadyLinked',
  silenced: null,
  paused: 'link.paused',
  unavailable: 'notAvailable',
};

@Injectable()
export class ChatCommandService {
  private readonly logger = new Logger('ChatCommands');

  constructor(
    private readonly links: ChatLinkService,
    private readonly entitlements: EntitlementService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly runs: ChatRunService,
  ) {}

  /** The transport's handler. Never throws. */
  async handle(invocation: ChatCommandInvocation): Promise<ChatReplyMessage | null> {
    const fallback = normalizeChatLocale(invocation.locale);
    const command: ChatCommandName | null = isChatCommandName(invocation.command) ? invocation.command : null;
    try {
      if (!isChatDiscordEnabled()) {
        return this.done(command, 'not_available', null, message(fallback, 'notAvailable'));
      }
      if (!invocation.directMessage) {
        return this.done(command, 'not_direct_message', null, message(fallback, 'useDirectMessage'));
      }
      if (!command) {
        return this.done(null, 'unknown_command', null, message(fallback, 'unknownCommand'));
      }
      if (command === 'link') {
        return await this.link(invocation);
      }

      const link = await this.links.useLinkByExternalUser(CHANNEL, invocation.externalUserId);
      if (command === 'help') {
        return this.done(command, 'ok', link, message(link?.locale ?? fallback, 'help'));
      }
      if (!link) {
        return this.done(command, 'not_linked', null, message(fallback, 'linkFirst'));
      }
      if (command === 'unlink') {
        const removed = await this.links.unlinkByExternalUser(CHANNEL, invocation.externalUserId);
        return removed.removed
          ? this.done(command, 'removed', link, message(link.locale, 'unlink.done'))
          : this.done(command, 'not_linked', link, message(link.locale, 'linkFirst'));
      }
      const owner = await this.ownerState(link.userId);
      if (owner !== 'ok') {
        if (command === 'ask') {
          return this.done(command, owner, link, await this.runs.refuseOwner(link, owner));
        }
        return this.done(command, 'not_entitled', link, message(link.locale, 'notEntitled'));
      }
      switch (command) {
        case 'status':
          return this.done(command, 'ok', link, await this.status(link));
        case 'language':
          return await this.language(invocation, link);
        case 'ask':
          return this.done(
            command,
            'handled',
            link,
            await this.runs.ask(link, { text: invocation.options.text, agent: invocation.options.agent }),
          );
        default:
          return this.done(command, 'unknown_command', link, message(link.locale, 'unknownCommand'));
      }
    } catch (error) {
      const reason = error instanceof Error && /^[A-Za-z0-9_]{1,64}$/.test(error.name) ? error.name : 'Error';
      this.logger.warn(`chat command failed name=${command ?? 'unknown'} reason=${reason}`);
      return message(fallback, 'error');
    }
  }

  private async link(invocation: ChatCommandInvocation): Promise<ChatReplyMessage | null> {
    const result = await this.links.claim(
      invocation.options.code,
      invocation.externalUserId,
      invocation.displayName,
      invocation.locale,
    );
    const key = CLAIM_REPLIES[result.outcome];
    return this.done('link', result.outcome, null, key ? message(result.locale, key) : null);
  }

  private async status(link: ChatLinkUse): Promise<ChatReplyMessage> {
    const runs = chatReply(link.locale, KillSwitchConfig.GLOBAL_EXECUTION_ENABLED ? 'status.runsOn' : 'status.runsOff');
    const counts = await this.runs.statusCounts(link);
    const summary = chatReply(link.locale, 'status.summary', { runs, language: chatLanguageName(link.locale) });
    const lines = chatRunReply(link.locale, 'status.runCounts', {
      running: String(counts.running),
      waiting: String(counts.waiting),
    });
    return { text: [summary, lines].join('\n') };
  }

  private async language(invocation: ChatCommandInvocation, link: ChatLinkUse): Promise<ChatReplyMessage> {
    const requested = invocation.options.language;
    const locale = (CHAT_LINK_LOCALES as readonly string[]).includes(requested)
      ? (requested as ChatLinkLocale)
      : null;
    if (!locale) {
      return this.done('language', 'invalid_language', link, message(link.locale, 'unknownCommand'));
    }
    const stored = await this.links.setLinkLocaleByExternalUser(CHANNEL, invocation.externalUserId, locale);
    if (!stored) {
      return this.done('language', 'not_linked', link, message(link.locale, 'linkFirst'));
    }
    return this.done('language', 'ok', link, message(locale, 'language.set', { language: chatLanguageName(locale) }));
  }

  /** The owner must be active and harness-entitled now (read live on every command). */
  private async ownerState(userId: string): Promise<'ok' | 'inactive' | 'not_entitled'> {
    const user = await this.users.findOne({ where: { id: userId }, select: ['id', 'isActive'] });
    if (!user || user.isActive !== true) {
      return 'inactive';
    }
    return (await this.entitlements.resolveHarnessEntitled(userId)) ? 'ok' : 'not_entitled';
  }

  private done<T extends ChatReplyMessage | null>(
    command: ChatCommandName | null,
    outcome: string,
    link: ChatLinkUse | null,
    reply: T,
  ): T {
    const linkPart = link ? ` linkId=${link.linkId}` : '';
    this.logger.log(`chat command name=${command ?? 'unknown'} outcome=${outcome}${linkPart}`);
    return reply;
  }
}
