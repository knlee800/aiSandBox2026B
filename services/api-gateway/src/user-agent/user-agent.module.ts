import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserAgent } from '../entities/user-agent.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { UserAgentController } from './user-agent.controller';
import { UserAgentService } from './user-agent.service';

@Module({
  imports: [
    // BIZ-USER-01A D12: ConnectorConnection is read for the owner's connection kinds only.
    TypeOrmModule.forFeature([UserAgent, ConnectorConnection]),
    AuthModule,
  ],
  controllers: [UserAgentController],
  providers: [UserAgentService],
  exports: [UserAgentService],
})
export class UserAgentModule {}
