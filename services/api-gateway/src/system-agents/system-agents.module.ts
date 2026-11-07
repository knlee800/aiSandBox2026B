import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemAgentsController } from './system-agents.controller';

@Module({
  imports: [AuthModule],
  controllers: [SystemAgentsController],
})
export class SystemAgentsModule {}
