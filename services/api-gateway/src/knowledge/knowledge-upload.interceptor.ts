import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import {
  KNOWLEDGE_ERROR_CODES,
  KNOWLEDGE_ERRORS,
  KNOWLEDGE_MAX_DOCUMENT_BYTES,
  isFileTooLargeError,
  isKnowledgeFilename,
  knowledgeBadRequest,
} from './knowledge-content';

@Injectable()
export class KnowledgeUploadInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor;

  constructor() {
    const Interceptor = FileInterceptor('file', {
      limits: { fileSize: KNOWLEDGE_MAX_DOCUMENT_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!isKnowledgeFilename(file.originalname || '')) {
          callback(
            knowledgeBadRequest(
              KNOWLEDGE_ERROR_CODES.wrongFileType,
              KNOWLEDGE_ERRORS.wrongFileType,
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    });
    this.inner = new Interceptor();
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, unknown> }>();
    const header = request.headers?.['content-type'];
    const contentType = typeof header === 'string' ? header.toLowerCase() : '';
    if (!contentType.includes('multipart/form-data')) {
      return next.handle();
    }

    try {
      return await this.inner.intercept(context, next);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (isFileTooLargeError(error)) {
        throw knowledgeBadRequest(
          KNOWLEDGE_ERROR_CODES.documentTooLarge,
          KNOWLEDGE_ERRORS.documentTooLarge,
        );
      }
      throw error;
    }
  }
}
