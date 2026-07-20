import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { USER_AGENT_STATUSES } from '../../entities/user-agent.entity';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  role: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsIn([...USER_AGENT_STATUSES])
  status?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4)
  @Matches(/^[A-Za-z0-9]+$/)
  initials?: string;
}
