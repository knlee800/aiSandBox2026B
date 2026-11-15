import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AgentSchedule } from '../entities/agent-schedule.entity';
import { AgentScheduleRun } from '../entities/agent-schedule-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

/**
 * TRIGGER-01: schedules that start a workflow (stage-start sections 2 and 7).
 * Slice S1: the two tables (migration 1810), the owner's schedule routes with
 * their audit rows, and the SCHEDULES_ENABLED switch (schedule-switch.ts).
 * No timer and no run start: those are slice S2. The module boots the same
 * whether SCHEDULES_ENABLED is set or not; it reads the switch only when a
 * route is called.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AgentSchedule, AgentScheduleRun, AuditEventEntity, UserAgent]),
    AuthModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [],
})
export class TriggersModule {}
