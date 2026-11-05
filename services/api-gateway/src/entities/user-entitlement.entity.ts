import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * ACCESS-01B: One entitlement row per user.
 * An absent row means every column default. No relation decorators.
 * The positive daily-token-limit CHECK lives in the migration.
 */
@Entity('user_entitlements')
export class UserEntitlementEntity {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @Column({ type: 'boolean', name: 'harness_enabled', default: false })
  harnessEnabled: boolean;

  @Column({ type: 'boolean', name: 'agent_write_enabled', default: false })
  agentWriteEnabled: boolean;

  @Column({ type: 'varchar', length: 50, name: 'plan_override', nullable: true })
  planOverride: string | null;

  @Column({ type: 'integer', name: 'daily_token_limit_override', nullable: true })
  dailyTokenLimitOverride: number | null;

  @Column({ type: 'uuid', name: 'updated_by' })
  updatedBy: string;

  @Column({
    type: 'timestamptz',
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
