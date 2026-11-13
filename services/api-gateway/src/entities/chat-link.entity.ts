import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * CHAT-DISCORD-01 A1: one linked outside chat account
 * (migration 1808000000000-CreateChatLinkTables).
 * Unique (channel, external_user_id): one owner per outside account.
 * Unique (user_id, channel): one outside account per owner per channel.
 * Stores the outside user id and the reply language only: no name, e-mail or
 * avatar. No relation decorators: the user foreign key and its cascade live
 * in the migration. The id is made by the service (randomUUID).
 */
@Entity({ name: 'chat_links', schema: 'public' })
@Index('uq_chat_links_channel_external_user_id', ['channel', 'externalUserId'], { unique: true })
@Index('uq_chat_links_user_id_channel', ['userId', 'channel'], { unique: true })
export class ChatLink {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  channel: string;

  @Column({ type: 'varchar', length: 32, name: 'external_user_id' })
  externalUserId: string;

  @Column({ type: 'varchar', length: 10, default: () => "'en'" })
  locale: string;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'last_used_at', nullable: true })
  lastUsedAt: Date | null;
}
