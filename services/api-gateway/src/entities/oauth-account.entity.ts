import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Index('uq_oauth_accounts_provider_provider_account_id', ['provider', 'providerAccountId'], {
  unique: true,
})
@Entity('oauth_accounts')
export class OauthAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_oauth_accounts_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.oauthAccounts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 255, name: 'provider_account_id' })
  providerAccountId: string;

  @Column({ type: 'varchar', length: 255, name: 'provider_email', nullable: true })
  providerEmail: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
