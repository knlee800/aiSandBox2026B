import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AgentSchedule } from '../entities/agent-schedule.entity';
import { AgentScheduleRun } from '../entities/agent-schedule-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { User } from '../entities/user.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { SafetyModule } from '../safety/safety.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleRunService } from './schedule-run.service';
import { ScheduleService } from './schedule.service';
import { ScheduleTimer } from './schedule-timer';

/**
 * TRIGGER-01: schedules that start a workflow (stage-start sections 2 to 7).
 * Slice S1: the two tables (migration 1810), the owner's schedule routes with
 * their audit rows, and the SCHEDULES_ENABLED switch (schedule-switch.ts).
 * Slice S2: the 60-second timer (schedule-timer.ts; silent while
 * SCHEDULES_ENABLED is off), the due rule (schedule-due.ts), the claim, the
 * pre-checks, the start and first approval through OrchestrationModule's
 * CollaborationStartService (the Team page's code), the refusal mapping
 * (schedule-refusal.ts) and the run and skip audit rows
 * (schedule-run.service.ts). SafetyModule gives the read-only daily cap
 * check; AuthModule the live harness access read. Nothing is exported.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AgentSchedule, AgentScheduleRun, AuditEventEntity, UserAgent, User]),
    AuthModule,
    OrchestrationModule,
    SafetyModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleRunService, ScheduleTimer],
  exports: [],
})
export class TriggersModule {}
