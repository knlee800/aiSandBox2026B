import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { AgentEventTrigger } from '../entities/agent-event-trigger.entity';
import { AgentEventTriggerRun } from '../entities/agent-event-trigger-run.entity';
import { AgentSchedule } from '../entities/agent-schedule.entity';
import { AgentScheduleRun } from '../entities/agent-schedule-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { User } from '../entities/user.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { SafetyModule } from '../safety/safety.module';
import { EventTriggerCalendar } from './event-trigger-calendar';
import { EventTriggerController } from './event-trigger.controller';
import { EventTriggerRunService } from './event-trigger-run.service';
import { EventTriggerService } from './event-trigger.service';
import { EventTriggerTimer } from './event-trigger-timer';
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
 *
 * TRIGGER-EVENT-01 S2: event triggers ("N minutes before an event on my
 * calendar"): the two tables (migration 1811), the owner's routes under
 * /api/event-triggers with their audit rows (event-trigger.controller.ts,
 * event-trigger.service.ts, event-trigger-validation.ts) and the
 * EVENT_TRIGGERS_ENABLED switch (event-trigger-switch.ts). ConnectorConnection
 * is read only to say whether the owner has a calendar connection (a count;
 * no secret is read, no broker call). No timer, no calendar read and no run
 * start in S2.
 *
 * TRIGGER-EVENT-01 S3: the event timer (event-trigger-timer.ts; its own
 * 60-second interval, silent while EVENT_TRIGGERS_ENABLED is off), the
 * 10-minute calendar reads held in memory (event-trigger-calendar.ts, through
 * ConnectorsModule's ConnectorBroker.readCalendarWindow), the due rule
 * (event-trigger-due.ts), the claim, day limit, confirm read, pre-checks,
 * start and first approval through the same CollaborationStartService as
 * schedules, and the skip reasons (event-trigger-reasons.ts) with their audit
 * rows (event-trigger-run.service.ts).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AgentSchedule, AgentScheduleRun, AgentEventTrigger, AgentEventTriggerRun, AuditEventEntity, ConnectorConnection, UserAgent, User]),
    AuthModule,
    ConnectorsModule,
    OrchestrationModule,
    SafetyModule,
  ],
  controllers: [ScheduleController, EventTriggerController],
  providers: [
    ScheduleService,
    ScheduleRunService,
    ScheduleTimer,
    EventTriggerService,
    EventTriggerCalendar,
    EventTriggerRunService,
    EventTriggerTimer,
  ],
  exports: [],
})
export class TriggersModule {}
