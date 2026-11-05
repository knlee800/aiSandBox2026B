import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeUploadInterceptor } from './knowledge-upload.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeDocument]), AuthModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeUploadInterceptor],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
