import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserAgent } from '../entities/user-agent.entity';
import { UserAgentController } from './user-agent.controller';
import { UserAgentService } from './user-agent.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserAgent]), AuthModule],
  controllers: [UserAgentController],
  providers: [UserAgentService],
  exports: [UserAgentService],
})
export class UserAgentModule {}
