import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * CHAT-DISCORD-01 A1: a one-time link code
 * (migration 1808000000000-CreateChatLinkTables).
 * code_hash is the SHA-256 hex of the code; the code itself is never stored.
 * One live code per owner per channel; rows are deleted on confirm, cancel,
 * replacement and expiry. claimed_display_name is held only while the row
 * lives (at most 10 minutes). No relation decorators: the user foreign key and
 * its cascade live in the migration. The id is made by the service.
 */
@Entity({ name: 'chat_link_codes', schema: 'public' })
@Index('uq_chat_link_codes_code_hash', ['codeHash'], { unique: true })
@Index('idx_chat_link_codes_user_id_channel', ['userId', 'channel'])
export class ChatLinkCode {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  channel: string;

  @Column({ type: 'varchar', length: 64, name: 'code_hash' })
  codeHash: string;

  @Column({ type: 'varchar', length: 10, default: () => "'en'" })
  locale: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 32, name: 'claimed_external_user_id', nullable: true })
  claimedExternalUserId: string | null;

  @Column({ type: 'varchar', length: 64, name: 'claimed_display_name', nullable: true })
  claimedDisplayName: string | null;

  @Column({ type: 'timestamptz', name: 'claimed_at', nullable: true })
  claimedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
