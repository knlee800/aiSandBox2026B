import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * COS-FRONTDOOR-01 D8: the owner's Chief of Staff roster, one row per owner
 * (migration 1805000000000-CreateCollaborationRostersTable). An absent row is
 * an empty roster. member_ids holds the ordered member ids (system agent ids
 * or the owner's workflow ids); CollaborationRosterService checks every id on
 * save and again at start. No relation decorators: the user foreign key and
 * its cascade live in the migration.
 */
@Entity({ name: 'collaboration_rosters', schema: 'public' })
export class CollaborationRosterEntity {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'jsonb', name: 'member_ids', default: () => "'[]'::jsonb" })
  memberIds: string[];

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
