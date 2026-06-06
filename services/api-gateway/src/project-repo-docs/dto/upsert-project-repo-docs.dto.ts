import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ProjectRepoDocInputDto {
  @IsString()
  @MaxLength(500)
  path: string;

  @IsOptional()
  @IsIn(['always'])
  mode?: 'always';
}

export class UpsertProjectRepoDocsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProjectRepoDocInputDto)
  docs: ProjectRepoDocInputDto[];
}
