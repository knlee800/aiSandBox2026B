import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { AgentChainTrigger } from '../entities/agent-chain-trigger.entity';
import { AgentChainTriggerRun } from '../entities/agent-chain-trigger-run.entity';
import { AgentEventTrigger } from '../entities/agent-event-trigger.entity';
import { AgentEventTriggerRun } from '../entities/agent-event-trigger-run.entity';
import { AgentKnowledgeTrigger } from '../entities/agent-knowledge-trigger.entity';
import { AgentKnowledgeTriggerRun } from '../entities/agent-knowledge-trigger-run.entity';
import { AgentMailTrigger } from '../entities/agent-mail-trigger.entity';
import { AgentMailTriggerRun } from '../entities/agent-mail-trigger-run.entity';
import { AgentSchedule } from '../entities/agent-schedule.entity';
import { AgentScheduleRun } from '../entities/agent-schedule-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { User } from '../entities/user.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { SafetyModule } from '../safety/safety.module';
import { ChainTriggerController } from './chain-trigger.controller';
import { ChainTriggerService } from './chain-trigger.service';
import { EventTriggerCalendar } from './event-trigger-calendar';
import { EventTriggerController } from './event-trigger.controller';
import { EventTriggerRunService } from './event-trigger-run.service';
import { EventTriggerService } from './event-trigger.service';
import { EventTriggerTimer } from './event-trigger-timer';
import { KnowledgeTriggerController } from './knowledge-trigger.controller';
import { KnowledgeTriggerRunService } from './knowledge-trigger-run.service';
import { KnowledgeTriggerService } from './knowledge-trigger.service';
import { KnowledgeTriggerTimer } from './knowledge-trigger-timer';
import { MailTriggerController } from './mail-trigger.controller';
import { MailTriggerMailbox } from './mail-trigger-mailbox';
import { MailTriggerRunService } from './mail-trigger-run.service';
import { MailTriggerService } from './mail-trigger.service';
import { MailTriggerTimer } from './mail-trigger-timer';
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
 *
 * TRIGGER-MAIL-01 S2: mail triggers ("when new mail from this sender arrives
 * in my Inbox"): the two tables (migration 1812), the owner's routes under
 * /api/mail-triggers with their audit rows (mail-trigger.controller.ts,
 * mail-trigger.service.ts, mail-trigger-validation.ts) and the
 * MAIL_TRIGGERS_ENABLED switch (mail-trigger-switch.ts). ConnectorConnection
 * is read only to say whether the owner has a mail connection (a count of
 * imap rows; no secret is read, no broker call). No timer, no mailbox read
 * and no run start in S2.
 *
 * TRIGGER-MAIL-01 S3: the mail timer (mail-trigger-timer.ts; its own
 * 60-second interval, silent while MAIL_TRIGGERS_ENABLED is off), the
 * 10-minute mailbox reads with the hourly back-off after three failures
 * (mail-trigger-mailbox.ts, through ConnectorsModule's
 * ConnectorBroker.readRecentMail; nothing from a read is kept past its tick),
 * the match rule (mail-trigger-match.ts), the row cap, claim, day limit,
 * pre-checks, start and first approval through the same
 * CollaborationStartService as schedules, and the skip reasons
 * (mail-trigger-reasons.ts) with their audit rows (mail-trigger-run.service.ts).
 *
 * TRIGGER-MORE-01 S1: knowledge triggers ("when a file is added to or
 * replaced in this Knowledge folder"): the two tables (migration 1813), the
 * owner's routes under /api/knowledge-triggers with their audit rows
 * (knowledge-trigger.controller.ts, knowledge-trigger.service.ts,
 * knowledge-trigger-validation.ts) and the KNOWLEDGE_TRIGGERS_ENABLED switch
 * (knowledge-trigger-switch.ts). No timer, no knowledge_documents read and no
 * run start in S1.
 *
 * TRIGGER-MORE-01 S2: the knowledge timer (knowledge-trigger-timer.ts; its own
 * 60-second interval, silent while KNOWLEDGE_TRIGGERS_ENABLED is off), one
 * read a tick of knowledge_documents through its own KnowledgeDocument
 * repository (id, owner, folder, content hash and change time only; never a
 * title or content; nothing under knowledge/ is used or changed), the match
 * and batch rule (knowledge-trigger-match.ts), the row cap, claims, day
 * limit, pre-checks, start and first approval through the same
 * CollaborationStartService as schedules, and the skip reasons
 * (knowledge-trigger-reasons.ts) with their audit rows
 * (knowledge-trigger-run.service.ts).
 *
 * TRIGGER-CHAIN-01 S1: chain triggers ("when one of my workflows completes a
 * run"): the two tables (migration 1814), the owner's routes under
 * /api/chain-triggers with their audit rows, the same-workflow and save-time
 * cycle refusals (chain-trigger.controller.ts, chain-trigger.service.ts,
 * chain-trigger-validation.ts) and the CHAIN_TRIGGERS_ENABLED switch
 * (chain-trigger-switch.ts). No timer, no collaboration_runs read and no run
 * start in S1.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AgentSchedule, AgentScheduleRun, AgentEventTrigger, AgentEventTriggerRun, AgentMailTrigger, AgentMailTriggerRun, AgentKnowledgeTrigger, AgentKnowledgeTriggerRun, AgentChainTrigger, AgentChainTriggerRun, KnowledgeDocument, AuditEventEntity, ConnectorConnection, UserAgent, User]),
    AuthModule,
    ConnectorsModule,
    OrchestrationModule,
    SafetyModule,
  ],
  controllers: [ScheduleController, EventTriggerController, MailTriggerController, KnowledgeTriggerController, ChainTriggerController],
  providers: [
    ScheduleService,
    ScheduleRunService,
    ScheduleTimer,
    EventTriggerService,
    EventTriggerCalendar,
    EventTriggerRunService,
    EventTriggerTimer,
    MailTriggerService,
    MailTriggerMailbox,
    MailTriggerRunService,
    MailTriggerTimer,
    KnowledgeTriggerService,
    KnowledgeTriggerRunService,
    KnowledgeTriggerTimer,
    ChainTriggerService,
  ],
  exports: [],
})
export class TriggersModule {}
