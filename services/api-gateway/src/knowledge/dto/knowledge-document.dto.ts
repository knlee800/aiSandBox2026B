import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { KNOWLEDGE_MAX_TITLE_LENGTH } from '../knowledge-content';
import { KNOWLEDGE_SCOPE_ID_VALUES } from '../knowledge-scopes';

/**
 * JSON create shape. Multipart uploads omit content and are checked by
 * prepareKnowledgeWrite, which also trims title and content and enforces
 * the byte limit. These decorators document the JSON contract.
 */
export class CreateKnowledgeDocumentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(KNOWLEDGE_SCOPE_ID_VALUES)
  scopeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(KNOWLEDGE_MAX_TITLE_LENGTH)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ListKnowledgeDocumentsDto {
  @IsOptional()
  @IsString()
  @IsIn(KNOWLEDGE_SCOPE_ID_VALUES)
  scopeId?: string;
}
