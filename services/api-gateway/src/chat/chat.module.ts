import {
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
  Provider,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatLinkCode } from '../entities/chat-link-code.entity';
import { User } from '../entities/user.entity';
import { ChatCommandService } from './chat-commands';
import { ChatLinkController } from './chat-link.controller';
import { ChatLinkService } from './chat-link.service';
import { CHAT_TRANSPORT, ChatTransport } from './chat-transport';
import { DiscordTransport } from './discord/discord-transport';

/**
 * Optional provider token. Only tests provide it (true) to run the runner
 * under Jest with a fake transport.
 */
export const CHAT_RUNNER_ALLOW_UNDER_JEST = Symbol('CHAT_RUNNER_ALLOW_UNDER_JEST');

/** The app's transport: the Discord transport. Tests override CHAT_TRANSPORT with a fake. */
export function createChatTransport(): ChatTransport {
  return new DiscordTransport();
}

export const CHAT_TRANSPORT_PROVIDER: Provider = {
  provide: CHAT_TRANSPORT,
  useFactory: createChatTransport,
};

/**
 * Starts the chat transport when the app has booted and stops it when the
 * module is destroyed (slice B). Under Jest it does nothing unless
 * CHAT_RUNNER_ALLOW_UNDER_JEST is provided; the Discord transport refuses its
 * real library under Jest too. connect() never blocks on the network, so the
 * gateway boot never waits for Discord.
 */
@Injectable()
export class ChatChannelRunner implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('ChatChannelRunner');
  private readonly testEnvironment: boolean;
  private started = false;

  constructor(
    @Inject(CHAT_TRANSPORT) private readonly transport: ChatTransport,
    private readonly commands: ChatCommandService,
    @Optional() @Inject(CHAT_RUNNER_ALLOW_UNDER_JEST) allowUnderJest?: boolean,
  ) {
    this.testEnvironment = process.env.JEST_WORKER_ID !== undefined && allowUnderJest !== true;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

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
 * without runs. Only ChatLinkService is exported.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ChatLink, ChatLinkCode, AuditEventEntity, User]), AuthModule],
  controllers: [ChatLinkController],
  providers: [ChatLinkService, ChatCommandService, CHAT_TRANSPORT_PROVIDER, ChatChannelRunner],
  exports: [ChatLinkService],
})
export class ChatModule {}
