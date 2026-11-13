import { Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { EntitlementService } from '../auth/entitlement.service';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatLinkCode } from '../entities/chat-link-code.entity';
import { User } from '../entities/user.entity';
import { ChatCommandService } from './chat-commands';
import { ChatLinkController } from './chat-link.controller';
import { ChatLinkService } from './chat-link.service';
import type { ChatTransport } from './chat-transport';
import { DiscordTransport } from './discord/discord-transport';

/**
 * Starts and stops the chat transports with the gateway (slice B). Under Jest
 * it does nothing unless a test passes testEnvironment false with a fake
 * transport; the Discord transport refuses its real library under Jest too.
 */
export class ChatChannelRunner {
  private readonly logger = new Logger('ChatChannelRunner');
  private started = false;

  constructor(
    private readonly transport: ChatTransport,
    private readonly commands: ChatCommandService,
    private readonly testEnvironment: boolean = process.env.JEST_WORKER_ID !== undefined,
  ) {}

  /** True when the transport started a connection. Never throws: the gateway always boots. */
  async start(): Promise<boolean> {
    if (this.testEnvironment || this.started) {
      return false;
    }
    this.started = true;
    try {
      return await this.transport.connect((invocation) => this.commands.handle(invocation));
    } catch {
      this.logger.warn('chat channel start failed');
      return false;
    }
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.started = false;
    try {
      await this.transport.disconnect();
    } catch {
      this.logger.warn('chat channel stop failed');
    }
  }
}

/**
 * CHAT-DISCORD-01: chat channels. Slice A1: the account link (tables, codes,
 * routes, audit). Slice B: the Discord bot connection (outbound only, intents
 * 0, CHAT_DISCORD_ENABLED and DISCORD_BOT_TOKEN) and the slash commands
 * without runs.
 *
 * The command service and the transport are built here, not registered as
 * providers: the module keeps its frozen A1 shape (one controller, one
 * provider, one export) and the bot has no injectable surface for other
 * modules.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ChatLink, ChatLinkCode, AuditEventEntity, User]), AuthModule],
  controllers: [ChatLinkController],
  providers: [ChatLinkService],
  exports: [ChatLinkService],
})
export class ChatModule implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly runner: ChatChannelRunner;

  constructor(
    links: ChatLinkService,
    entitlements: EntitlementService,
    @InjectRepository(User) users: Repository<User>,
  ) {
    this.runner = new ChatChannelRunner(
      new DiscordTransport(),
      new ChatCommandService(links, entitlements, users),
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.runner.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.runner.stop();
  }
}
