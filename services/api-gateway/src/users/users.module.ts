import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { QuotaModule } from '../quota/quota.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SnapshotsModule } from '../snapshots/snapshots.module';

/**
 * UsersModule
 * TASK-68B-2: User dashboard support endpoints module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), QuotaModule, SnapshotsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
