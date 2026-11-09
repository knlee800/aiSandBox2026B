import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * CONN-02A: One connector credential row per owner per kind.
 * secret_ciphertext is the only copy of the app password or iCal link.
 */
@Entity('connector_connections')
@Index('uq_connector_connections_user_id_kind', ['userId', 'kind'], { unique: true })
export class ConnectorConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 16 })
  kind: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  preset: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  username: string | null;

  @Column({ type: 'text', name: 'secret_ciphertext' })
  secretCiphertext: string;

  @Column({ type: 'smallint', name: 'key_version', default: 1 })
  keyVersion: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', name: 'last_verified_at', nullable: true })
  lastVerifiedAt: Date | null;
}
