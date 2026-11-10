import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserAgent } from '../entities/user-agent.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { UserAgentController } from './user-agent.controller';
import { UserAgentService } from './user-agent.service';
import { USER_WORKFLOW_SWITCH_ON_CHECK, UserWorkflowSwitchOnSlot } from './user-workflow-switch-on.port';

@Module({
  imports: [
    // BIZ-USER-01A D12: ConnectorConnection is read for the owner's connection kinds only.
    TypeOrmModule.forFeature([UserAgent, ConnectorConnection]),
    AuthModule,
  ],
  controllers: [UserAgentController],
  providers: [
    UserAgentService,
    // WORKFLOW-STATUS-02: switch-on needs a test run at the current version (the Team gate's rule).
    // WORKFLOW-STATUS-03: the port is a slot that OrchestrationModule's check binds itself to;
    // it refuses with 503 until then (fail closed).
    UserWorkflowSwitchOnSlot,
    { provide: USER_WORKFLOW_SWITCH_ON_CHECK, useExisting: UserWorkflowSwitchOnSlot },
  ],
  exports: [UserAgentService, UserWorkflowSwitchOnSlot],
})
export class UserAgentModule {}
