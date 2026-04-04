import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
