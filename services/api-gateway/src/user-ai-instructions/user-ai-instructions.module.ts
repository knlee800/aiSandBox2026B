import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserAiInstructions } from '../entities/user-ai-instructions.entity';
import { UserAiInstructionsController } from './user-ai-instructions.controller';
import { UserAiInstructionsService } from './user-ai-instructions.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserAiInstructions]), AuthModule],
  controllers: [UserAiInstructionsController],
  providers: [UserAiInstructionsService],
  exports: [UserAiInstructionsService],
})
export class UserAiInstructionsModule {}
