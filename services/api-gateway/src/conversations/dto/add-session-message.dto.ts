import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ChatMessageRole } from '../../entities/chat-message-role.enum';

export class AddSessionMessageDto {
  @IsEnum(ChatMessageRole)
  role: ChatMessageRole;

  @IsString()
  @IsNotEmpty()
  content: string;
}
