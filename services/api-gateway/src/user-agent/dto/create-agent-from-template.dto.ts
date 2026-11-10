import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { USER_WORKFLOW_TEMPLATE_IDS } from '../user-workflow-rules';

/**
 * POST /api/agents/from-template (BIZ-USER-01A D6b).
 *
 * The spec, access and model are copied from the system agent on the
 * server; nothing of them is read from the body.
 */
export class CreateAgentFromTemplateDto {
  @IsString()
  @IsIn([...USER_WORKFLOW_TEMPLATE_IDS])
  templateId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  role: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
