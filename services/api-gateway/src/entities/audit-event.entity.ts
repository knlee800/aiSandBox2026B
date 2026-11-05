import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * COLLAB-AUDIT-01: Append-only audit row.
 * Immutability is enforced by trg_audit_events_refuse_change.
 * This mapping has no update or delete helpers.
 * user_id is not a foreign key.
 */
@Entity('audit_events')
@Index('idx_audit_events_subject_occurred', [
  'subjectType',
  'subjectId',
  'occurredAt',
])
export class AuditEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  category: string;

  @Column({ type: 'varchar', length: 64, name: 'event_type' })
  eventType: string;

  @Column({ type: 'varchar', length: 32, name: 'subject_type' })
  subjectType: string;

  @Column({ type: 'varchar', length: 64, name: 'subject_id' })
  subjectId: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'jsonb' })
  payload: object;

  @Column({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt: Date;

  @Column({
    type: 'timestamptz',
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
