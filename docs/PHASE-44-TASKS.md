# PHASE-44-TASKS — Async AI Execution Pipeline Implementation

---

## Status: READY FOR IMPLEMENTATION

**Phase:** 44  
**Nature:** Implementation Task List  
**Date:** 2026-03-04

---

## Task Overview

This document defines the ordered implementation steps for Phase-44 async AI execution pipeline.

Each task includes:
- Task ID and description
- Files likely affected
- Validation criteria
- Minimal implementation scope

---

## Task Execution Rules

1. **Sequential execution** — Tasks MUST be completed in order
2. **One task at a time** — Do NOT start next task until current task is complete
3. **Checkpoint after each task** — Create checkpoint document after task completion
4. **Test before proceeding** — Run tests after each task to verify no regressions
5. **No scope expansion** — Implement ONLY what is specified in the task

---

## TASK-44.1: Add Redis to Docker Compose

**Objective:** Add Redis service to `docker-compose.yml` for queue infrastructure

**Files Affected:**
- `docker-compose.yml`
- `.env.example`

**Implementation:**

1. Add Redis service to `docker-compose.yml`:
   ```yaml
   redis:
     image: redis:7-alpine
     container_name: aisandbox-redis
     restart: unless-stopped
     ports:
       - "6379:6379"
     volumes:
       - redis_data:/data
     command: redis-server --requirepass ${REDIS_PASSWORD}
     healthcheck:
       test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
       interval: 10s
       timeout: 5s
       retries: 5
     networks:
       - aisandbox-network
   ```

2. Add Redis volume to `docker-compose.yml`:
   ```yaml
   volumes:
     redis_data:
       driver: local
   ```

3. Update `.env.example`:
   ```
   REDIS_URL=redis://:password@localhost:6379
   REDIS_PASSWORD=your_redis_password_here
   ```

**Validation Criteria:**
- [ ] Redis container starts successfully
- [ ] Redis healthcheck passes
- [ ] Redis requires password authentication
- [ ] Redis persists data to volume

**Test Command:**
```bash
docker compose up redis -d
docker compose ps redis
redis-cli -h localhost -p 6379 -a password ping
```

---

## TASK-44.2: Install BullMQ in AI Service

**Objective:** Add BullMQ queue library to ai-service

**Files Affected:**
- `services/ai-service/package.json`
- `services/ai-service/src/queue/queue.module.ts` (NEW)
- `services/ai-service/src/queue/queue.service.ts` (NEW)

**Implementation:**

1. Install BullMQ:
   ```bash
   cd services/ai-service
   npm install bullmq ioredis
   npm install --save-dev @types/ioredis
   ```

2. Create `queue.module.ts`:
   ```typescript
   import { Module } from '@nestjs/common';
   import { QueueService } from './queue.service';

   @Module({
     providers: [QueueService],
     exports: [QueueService],
   })
   export class QueueModule {}
   ```

3. Create `queue.service.ts`:
   ```typescript
   import { Injectable, Logger } from '@nestjs/common';
   import { Queue, QueueOptions } from 'bullmq';
   import Redis from 'ioredis';

   @Injectable()
   export class QueueService {
     private readonly logger = new Logger(QueueService.name);
     private connection: Redis;

     constructor() {
       const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
       this.connection = new Redis(redisUrl, {
         maxRetriesPerRequest: null,
       });
     }

     createQueue(name: string, options?: QueueOptions): Queue {
       return new Queue(name, {
         connection: this.connection,
         ...options,
       });
     }

     async onModuleDestroy() {
       await this.connection.quit();
     }
   }
   ```

4. Update `ai-service/src/app.module.ts`:
   ```typescript
   import { QueueModule } from './queue/queue.module';

   @Module({
     imports: [
       // ... existing imports
       QueueModule,
     ],
   })
   export class AppModule {}
   ```

**Validation Criteria:**
- [ ] BullMQ installed successfully
- [ ] QueueService connects to Redis
- [ ] QueueService can create queues
- [ ] No TypeScript errors

**Test Command:**
```bash
cd services/ai-service
npm run build
```

---

## TASK-44.3: Create Job Queue Schema

**Objective:** Define TypeScript types for job queue payloads

**Files Affected:**
- `services/ai-service/src/queue/job.types.ts` (NEW)

**Implementation:**

1. Create `job.types.ts`:
   ```typescript
   export interface AiExecutionJob {
     executionId: string;
     userId: string;
     apiKeyId: string;
     sessionId: string;
     conversationId: string;
     provider: 'openai' | 'anthropic' | 'groq';
     adapter: 'openai' | 'anthropic' | 'groq';
     prompt: string;
     model?: string;
     requestId?: string;
     submittedAt: string; // ISO8601 timestamp
   }

   export interface AiExecutionResult {
     executionId: string;
     status: 'completed' | 'failed' | 'timeout';
     output?: string;
     tokensUsed?: number;
     model?: string;
     executionDurationMs?: number;
     error?: {
       code: string;
       message: string;
     };
   }
   ```

**Validation Criteria:**
- [ ] Types compile without errors
- [ ] Types match PHASE-44-DESIGN.md schema

**Test Command:**
```bash
cd services/ai-service
npm run build
```

---

## TASK-44.4: Implement Queue Submission in API Gateway

**Objective:** Add queue submission logic to api-gateway after ledger intent write

**Files Affected:**
- `services/api-gateway/package.json`
- `services/api-gateway/src/queue/queue.module.ts` (NEW)
- `services/api-gateway/src/queue/queue.service.ts` (NEW)
- `services/api-gateway/src/ai/ai-execution.controller.ts`

**Implementation:**

1. Install BullMQ in api-gateway:
   ```bash
   cd services/api-gateway
   npm install bullmq ioredis
   npm install --save-dev @types/ioredis
   ```

2. Create `queue.module.ts` (same as ai-service)

3. Create `queue.service.ts`:
   ```typescript
   import { Injectable, Logger } from '@nestjs/common';
   import { Queue } from 'bullmq';
   import Redis from 'ioredis';

   export interface AiExecutionJob {
     executionId: string;
     userId: string;
     apiKeyId: string;
     sessionId: string;
     conversationId: string;
     provider: string;
     adapter: string;
     prompt: string;
     model?: string;
     requestId?: string;
     submittedAt: string;
   }

   @Injectable()
   export class QueueService {
     private readonly logger = new Logger(QueueService.name);
     private connection: Redis;
     private queue: Queue<AiExecutionJob>;

     constructor() {
       const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
       this.connection = new Redis(redisUrl, {
         maxRetriesPerRequest: null,
       });

       this.queue = new Queue<AiExecutionJob>('ai-execution-jobs', {
         connection: this.connection,
       });
     }

     async submitJob(job: AiExecutionJob): Promise<string> {
       const result = await this.queue.add('execute', job, {
         attempts: 3,
         backoff: {
           type: 'exponential',
           delay: 1000,
         },
       });
       this.logger.log(`Job submitted: ${result.id}`);
       return result.id!;
     }

     async onModuleDestroy() {
       await this.queue.close();
       await this.connection.quit();
     }
   }
   ```

4. Update `ai-execution.controller.ts`:
   ```typescript
   import { QueueService } from '../queue/queue.service';

   @Controller('ai')
   export class AiExecutionController {
     constructor(
       // ... existing dependencies
       private readonly queueService: QueueService,
     ) {}

     @Post('execute')
     async execute(@Body() request: ExecuteRequest, @Identity() identity: IdentityDto) {
       // ... existing guard logic (auth, quota, etc.)

       // Step 1: Write intent to ledger (existing code)
       const executionId = await this.usageLedgerService.writeExecutionIntent({
         executionId: uuidv4(),
         userId: identity.userId,
         apiKeyId: identity.apiKeyId,
         sessionId: request.sessionId,
         conversationId: request.conversationId,
         provider: request.provider,
         adapter: request.provider,
         requestId,
         metadata: { prompt: request.prompt, model: request.model },
       });

       // Step 2: Submit job to queue (NEW)
       await this.queueService.submitJob({
         executionId,
         userId: identity.userId,
         apiKeyId: identity.apiKeyId,
         sessionId: request.sessionId,
         conversationId: request.conversationId,
         provider: request.provider,
         adapter: request.provider,
         prompt: request.prompt,
         model: request.model,
         requestId,
         submittedAt: new Date().toISOString(),
       });

       // Step 3: Return 202 Accepted (NEW)
       return {
         executionId,
         requestId,
         status: 'pending',
         submittedAt: new Date().toISOString(),
       };
     }
   }
   ```

5. Update `ai-execution.controller.ts` response decorator:
   ```typescript
   @Post('execute')
   @HttpCode(HttpStatus.ACCEPTED) // Change from 200 to 202
   async execute(...) { ... }
   ```

**Validation Criteria:**
- [ ] QueueService connects to Redis
- [ ] Jobs are submitted to queue after ledger write
- [ ] API returns 202 Accepted (not 200 OK)
- [ ] Response includes executionId and status='pending'
- [ ] Existing tests updated to expect 202

**Test Command:**
```bash
cd services/api-gateway
npm run test:unit
```

---

## TASK-44.5: Implement Status Polling Endpoint

**Objective:** Add GET endpoint to poll execution status from ledger

**Files Affected:**
- `services/api-gateway/src/ai/ai-execution.controller.ts`
- `services/api-gateway/src/ai/dto/execution-status.dto.ts` (NEW)

**Implementation:**

1. Create `execution-status.dto.ts`:
   ```typescript
   export class ExecutionStatusDto {
     executionId: string;
     requestId?: string;
     status: 'pending' | 'completed' | 'failed' | 'timeout';
     submittedAt: string;
     completedAt?: string;
     failedAt?: string;
     timeoutAt?: string;
     result?: {
       output: string;
       tokensUsed: number;
       model: string;
     };
     error?: {
       code: string;
       message: string;
     };
   }
   ```

2. Add status endpoint to `ai-execution.controller.ts`:
   ```typescript
   @Get('executions/:executionId')
   async getExecutionStatus(
     @Param('executionId') executionId: string,
     @Identity() identity: IdentityDto,
   ): Promise<ExecutionStatusDto> {
     // Step 1: Fetch execution from ledger
     const record = await this.usageLedgerService.findByExecutionId(executionId);

     if (!record) {
       throw new NotFoundException('Execution not found');
     }

     // Step 2: Verify ownership
     if (record.userId !== identity.userId) {
       throw new ForbiddenException('Not owner of execution');
     }

     // Step 3: Build response
     const response: ExecutionStatusDto = {
       executionId: record.executionId,
       requestId: record.requestId,
       status: record.executionStatus,
       submittedAt: record.timestamp.toISOString(),
     };

     if (record.executionStatus === 'completed') {
       const metadata = record.metadata as any;
       response.completedAt = record.updatedAt?.toISOString();
       response.result = {
         output: metadata?.aiExecutionResult?.output || '',
         tokensUsed: record.tokensUsed || 0,
         model: record.model || '',
       };
     } else if (record.executionStatus === 'failed') {
       const metadata = record.metadata as any;
       response.failedAt = record.updatedAt?.toISOString();
       response.error = metadata?.error || { code: 'UNKNOWN', message: 'Execution failed' };
     } else if (record.executionStatus === 'timeout') {
       response.timeoutAt = record.updatedAt?.toISOString();
     }

     return response;
   }
   ```

3. Add `findByExecutionId` method to `usage-ledger.service.ts`:
   ```typescript
   async findByExecutionId(executionId: string): Promise<UsageRecord | null> {
     return this.usageRecordRepository.findOne({
       where: { executionId },
     });
   }
   ```

**Validation Criteria:**
- [ ] Status endpoint returns execution status from ledger
- [ ] Status endpoint enforces ownership (403 if not owner)
- [ ] Status endpoint returns 404 if execution not found
- [ ] Response format matches ExecutionStatusDto
- [ ] Pending, completed, failed, timeout states handled correctly

**Test Command:**
```bash
cd services/api-gateway
npm run test:unit
```

---

## TASK-44.6: Implement Worker Job Consumer

**Objective:** Create worker process to consume jobs from Redis queue

**Files Affected:**
- `services/ai-service/src/worker/worker.module.ts` (NEW)
- `services/ai-service/src/worker/worker.service.ts` (NEW)
- `services/ai-service/src/worker/worker.processor.ts` (NEW)
- `services/ai-service/src/main.ts`

**Implementation:**

1. Create `worker.module.ts`:
   ```typescript
   import { Module } from '@nestjs/common';
   import { WorkerService } from './worker.service';
   import { WorkerProcessor } from './worker.processor';
   import { QueueModule } from '../queue/queue.module';
   import { AiExecutionModule } from '../ai-execution/ai-execution.module';

   @Module({
     imports: [QueueModule, AiExecutionModule],
     providers: [WorkerService, WorkerProcessor],
   })
   export class WorkerModule {}
   ```

2. Create `worker.service.ts`:
   ```typescript
   import { Injectable, Logger } from '@nestjs/common';
   import { Worker, Job } from 'bullmq';
   import Redis from 'ioredis';
   import { AiExecutionJob } from '../queue/job.types';
   import { WorkerProcessor } from './worker.processor';

   @Injectable()
   export class WorkerService {
     private readonly logger = new Logger(WorkerService.name);
     private connection: Redis;
     private worker: Worker<AiExecutionJob>;

     constructor(private readonly processor: WorkerProcessor) {
       const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
       this.connection = new Redis(redisUrl, {
         maxRetriesPerRequest: null,
       });

       this.worker = new Worker<AiExecutionJob>(
         'ai-execution-jobs',
         async (job: Job<AiExecutionJob>) => {
           return this.processor.process(job);
         },
         {
           connection: this.connection,
           concurrency: 5,
         },
       );

       this.worker.on('completed', (job) => {
         this.logger.log(`Job ${job.id} completed`);
       });

       this.worker.on('failed', (job, err) => {
         this.logger.error(`Job ${job?.id} failed: ${err.message}`);
       });
     }

     async onModuleDestroy() {
       await this.worker.close();
       await this.connection.quit();
     }
   }
   ```

3. Create `worker.processor.ts`:
   ```typescript
   import { Injectable, Logger } from '@nestjs/common';
   import { Job } from 'bullmq';
   import { AiExecutionJob } from '../queue/job.types';

   @Injectable()
   export class WorkerProcessor {
     private readonly logger = new Logger(WorkerProcessor.name);

     async process(job: Job<AiExecutionJob>): Promise<void> {
       const data = job.data;
       this.logger.log(`Processing job ${job.id} for execution ${data.executionId}`);

       // TODO: Implement actual processing logic in next tasks
       // For now, just log the job
       this.logger.log(`Job data: ${JSON.stringify(data)}`);
     }
   }
   ```

4. Update `main.ts`:
   ```typescript
   import { WorkerModule } from './worker/worker.module';

   @Module({
     imports: [
       // ... existing imports
       WorkerModule,
     ],
   })
   export class AppModule {}
   ```

**Validation Criteria:**
- [ ] Worker connects to Redis
- [ ] Worker consumes jobs from queue
- [ ] Worker logs job processing
- [ ] Worker handles job completion
- [ ] Worker handles job failure

**Test Command:**
```bash
cd services/ai-service
npm run build
npm run start
# In another terminal, submit a job via api-gateway and verify worker logs
```

---

## TASK-44.7: Implement Idempotency Check in Worker

**Objective:** Add idempotency check in worker to prevent double execution on duplicate deliveries

**Files Affected:**
- `services/ai-service/src/worker/worker.processor.ts`
- `services/ai-service/src/api-gateway-client/api-gateway-client.service.ts` (NEW)

**Implementation:**

1. Create `api-gateway-client.service.ts`:
   ```typescript
   import { Injectable, Logger } from '@nestjs/common';
   import { HttpService } from '@nestjs/axios';
   import { firstValueFrom } from 'rxjs';

   @Injectable()
   export class ApiGatewayClientService {
     private readonly logger = new Logger(ApiGatewayClientService.name);
     private readonly baseUrl: string;

     constructor(private readonly httpService: HttpService) {
       this.baseUrl = process.env.API_GATEWAY_URL || 'http://localhost:3000';
     }

     async getExecutionStatus(executionId: string): Promise<any> {
       const url = `${this.baseUrl}/api/internal/executions/${executionId}`;
       const response = await firstValueFrom(this.httpService.get(url));
       return response.data;
     }
   }
   ```

2. Update `worker.processor.ts`:
   ```typescript
   import { ApiGatewayClientService } from '../api-gateway-client/api-gateway-client.service';

   @Injectable()
   export class WorkerProcessor {
     constructor(
       private readonly apiGatewayClient: ApiGatewayClientService,
     ) {}

     async process(job: Job<AiExecutionJob>): Promise<void> {
       const data = job.data;

       // Step 1: Check if already completed (idempotency)
       const existingStatus = await this.apiGatewayClient.getExecutionStatus(data.executionId);
       if (existingStatus.status === 'completed') {
         this.logger.log(`Job ${job.id} already completed (duplicate delivery)`);
         return; // Skip processing
       }

       // Step 2: Process job (TODO: implement in next tasks)
       this.logger.log(`Processing job ${job.id} for execution ${data.executionId}`);
     }
   }
   ```

3. Add internal status endpoint to `api-gateway/src/ai/ai-execution.controller.ts`:
   ```typescript
   @Get('internal/executions/:executionId')
   async getInternalExecutionStatus(
     @Param('executionId') executionId: string,
   ): Promise<any> {
     const record = await this.usageLedgerService.findByExecutionId(executionId);
     if (!record) {
       throw new NotFoundException('Execution not found');
     }
     return {
       executionId: record.executionId,
       status: record.executionStatus,
     };
   }
   ```

**Validation Criteria:**
- [ ] Worker checks execution status before processing
- [ ] Worker skips processing if status='completed'
- [ ] Worker logs duplicate deliveries
- [ ] Internal status endpoint returns execution status

**Test Command:**
```bash
cd services/ai-service
npm run test:unit
```

---

## TASK-44.8: Implement AI Provider Call in Worker

**Objective:** Add AI provider call logic to worker processor

**Files Affected:**
- `services/ai-service/src/worker/worker.processor.ts`
- `services/ai-service/src/ai-execution/ai-execution.service.ts`

**Implementation:**

1. Update `worker.processor.ts`:
   ```typescript
   import { AiExecutionService } from '../ai-execution/ai-execution.service';

   @Injectable()
   export class WorkerProcessor {
     constructor(
       private readonly apiGatewayClient: ApiGatewayClientService,
       private readonly aiExecutionService: AiExecutionService,
     ) {}

     async process(job: Job<AiExecutionJob>): Promise<void> {
       const data = job.data;

       // Step 1: Idempotency check (existing code)
       const existingStatus = await this.apiGatewayClient.getExecutionStatus(data.executionId);
       if (existingStatus.status === 'completed') {
         this.logger.log(`Job ${job.id} already completed (duplicate delivery)`);
         return;
       }

       // Step 2: Call AI provider (NEW)
       try {
         const aiResult = await this.aiExecutionService.execute({
           provider: data.provider,
           prompt: data.prompt,
           model: data.model,
         });

         this.logger.log(`AI execution completed: ${aiResult.tokensUsed} tokens`);

         // TODO: Call container-manager and update ledger (next tasks)
       } catch (error) {
         this.logger.error(`AI execution failed: ${error.message}`);
         throw error; // Trigger retry
       }
     }
   }
   ```

**Validation Criteria:**
- [ ] Worker calls AI provider via AiExecutionService
- [ ] Worker logs AI execution results
- [ ] Worker handles AI provider errors
- [ ] Worker retries on transient failures

**Test Command:**
```bash
cd services/ai-service
npm run test:unit
```

---

## TASK-44.9: Implement Container Manager Call in Worker

**Objective:** Add container-manager call logic to worker processor

**Files Affected:**
- `services/ai-service/src/worker/worker.processor.ts`
- `services/ai-service/src/container-manager-client/container-manager-client.service.ts` (NEW)

**Implementation:**

1. Create `container-manager-client.service.ts`:
   ```typescript
   import { Injectable, Logger } from '@nestjs/common';
   import { HttpService } from '@nestjs/axios';
   import { firstValueFrom } from 'rxjs';

   @Injectable()
   export class ContainerManagerClientService {
     private readonly logger = new Logger(ContainerManagerClientService.name);
     private readonly baseUrl: string;

     constructor(private readonly httpService: HttpService) {
       this.baseUrl = process.env.CONTAINER_MANAGER_URL || 'http://localhost:3002';
     }

     async execute(sessionId: string, code: string, language: string): Promise<any> {
       const url = `${this.baseUrl}/api/internal/containers/${sessionId}/execute`;
       const response = await firstValueFrom(
         this.httpService.post(url, { code, language, timeout: 30000 }),
       );
       return response.data;
     }
   }
   ```

2. Update `worker.processor.ts`:
   ```typescript
   import { ContainerManagerClientService } from '../container-manager-client/container-manager-client.service';

   @Injectable()
   export class WorkerProcessor {
     constructor(
       private readonly apiGatewayClient: ApiGatewayClientService,
       private readonly aiExecutionService: AiExecutionService,
       private readonly containerManagerClient: ContainerManagerClientService,
     ) {}

     async process(job: Job<AiExecutionJob>): Promise<void> {
       const data = job.data;

       // Step 1: Idempotency check (existing code)
       // ...

       // Step 2: Call AI provider (existing code)
       const aiResult = await this.aiExecutionService.execute({
         provider: data.provider,
         prompt: data.prompt,
         model: data.model,
       });

       // Step 3: Call container-manager (NEW)
       try {
         const containerResult = await this.containerManagerClient.execute(
           data.sessionId,
           aiResult.output,
           'python', // TODO: Detect language from AI output
         );

         this.logger.log(`Container execution completed: exit code ${containerResult.exitCode}`);

         // TODO: Update ledger (next task)
       } catch (error) {
         this.logger.error(`Container execution failed: ${error.message}`);
         throw error; // Trigger retry
       }
     }
   }
   ```

**Validation Criteria:**
- [ ] Worker calls container-manager via HTTP
- [ ] Worker logs container execution results
- [ ] Worker handles container-manager errors
- [ ] Worker retries on transient failures

**Test Command:**
```bash
cd services/ai-service
npm run test:unit
```

---

## TASK-44.10: Implement Ledger Update in Worker

**Objective:** Add ledger update logic to worker after successful execution

**Files Affected:**
- `services/ai-service/src/worker/worker.processor.ts`
- `services/ai-service/src/api-gateway-client/api-gateway-client.service.ts`
- `services/api-gateway/src/ai/ai-execution.controller.ts`

**Implementation:**

1. Add `updateExecutionResult` method to `api-gateway-client.service.ts`:
   ```typescript
   async updateExecutionResult(executionId: string, result: any): Promise<void> {
     const url = `${this.baseUrl}/api/internal/executions/${executionId}/result`;
     await firstValueFrom(this.httpService.post(url, result));
   }
   ```

2. Add internal result update endpoint to `api-gateway/src/ai/ai-execution.controller.ts`:
   ```typescript
   @Post('internal/executions/:executionId/result')
   async updateInternalExecutionResult(
     @Param('executionId') executionId: string,
     @Body() result: any,
   ): Promise<void> {
     await this.usageLedgerService.updateExecutionResult({
       executionId,
       status: result.status,
       output: result.output,
       tokensUsed: result.tokensUsed,
       model: result.model,
       executionDurationMs: result.executionDurationMs,
     });
   }
   ```

3. Update `worker.processor.ts`:
   ```typescript
   async process(job: Job<AiExecutionJob>): Promise<void> {
     const data = job.data;
     const startTime = Date.now();

     try {
       // Step 1: Idempotency check (existing code)
       // ...

       // Step 2: Call AI provider (existing code)
       const aiResult = await this.aiExecutionService.execute({
         provider: data.provider,
         prompt: data.prompt,
         model: data.model,
       });

       // Step 3: Call container-manager (existing code)
       const containerResult = await this.containerManagerClient.execute(
         data.sessionId,
         aiResult.output,
         'python',
       );

       // Step 4: Update ledger (NEW)
       await this.apiGatewayClient.updateExecutionResult(data.executionId, {
         status: 'completed',
         output: containerResult.stdout,
         tokensUsed: aiResult.tokensUsed,
         model: aiResult.model,
         executionDurationMs: Date.now() - startTime,
       });

       this.logger.log(`Job ${job.id} completed successfully`);
     } catch (error) {
       this.logger.error(`Job ${job.id} failed: ${error.message}`);

       // Update ledger with failure
       await this.apiGatewayClient.updateExecutionResult(data.executionId, {
         status: 'failed',
         error: {
           code: 'EXECUTION_ERROR',
           message: error.message,
         },
       });

       throw error; // Trigger retry or move to DLQ
     }
   }
   ```

**Validation Criteria:**
- [ ] Worker updates ledger after successful execution
- [ ] Worker updates ledger with failure details on error
- [ ] Ledger status transitions to 'completed' or 'failed'
- [ ] Ledger stores aiExecutionResult in metadata

**Test Command:**
```bash
cd services/ai-service
npm run test:unit
```

---

## TASK-44.11: Implement Retry Logic

**Objective:** Configure retry behavior for transient failures

**Files Affected:**
- `services/api-gateway/src/queue/queue.service.ts`
- `services/ai-service/src/worker/worker.service.ts`

**Implementation:**

1. Update `api-gateway/src/queue/queue.service.ts`:
   ```typescript
   async submitJob(job: AiExecutionJob): Promise<string> {
     const result = await this.queue.add('execute', job, {
       attempts: 3, // Max 3 attempts
       backoff: {
         type: 'exponential',
         delay: 1000, // 1s, 2s, 4s
       },
       removeOnComplete: true, // Remove from queue after completion
       removeOnFail: false, // Keep failed jobs for inspection
     });
     return result.id!;
   }
   ```

2. Update `ai-service/src/worker/worker.service.ts`:
   ```typescript
   this.worker = new Worker<AiExecutionJob>(
     'ai-execution-jobs',
     async (job: Job<AiExecutionJob>) => {
       return this.processor.process(job);
     },
     {
       connection: this.connection,
       concurrency: 5,
       settings: {
         stalledInterval: 30000, // Check for stalled jobs every 30s
         maxStalledCount: 1, // Move to failed after 1 stall
       },
     },
   );

   this.worker.on('failed', async (job, err) => {
     if (job && job.attemptsMade >= 3) {
       // Max retries reached, update ledger
       this.logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts`);
       // TODO: Update ledger status to 'failed'
     }
   });
   ```

**Validation Criteria:**
- [ ] Jobs retry up to 3 times on failure
- [ ] Retry delay uses exponential backoff
- [ ] Failed jobs are kept in queue for inspection
- [ ] Completed jobs are removed from queue

**Test Command:**
```bash
cd services/ai-service
npm run test:unit
```

---

## TASK-44.12: Implement Dead-Letter Queue

**Objective:** Configure dead-letter queue for permanently failed jobs

**Files Affected:**
- `services/ai-service/src/worker/worker.service.ts`
- `services/ai-service/src/queue/queue.service.ts`

**Implementation:**

1. Update `queue.service.ts`:
   ```typescript
   createQueue(name: string, options?: QueueOptions): Queue {
     return new Queue(name, {
       connection: this.connection,
       defaultJobOptions: {
         attempts: 3,
         backoff: {
           type: 'exponential',
           delay: 1000,
         },
       },
       ...options,
     });
   }

   createDLQ(name: string): Queue {
     return this.createQueue(`${name}-dlq`);
   }
   ```

2. Update `worker.service.ts`:
   ```typescript
   import { Queue } from 'bullmq';

   @Injectable()
   export class WorkerService {
     private dlq: Queue;

     constructor(private readonly processor: WorkerProcessor) {
       // ... existing code

       // Create DLQ
       this.dlq = new Queue('ai-execution-jobs-dlq', {
         connection: this.connection,
       });

       // Move failed jobs to DLQ
       this.worker.on('failed', async (job, err) => {
         if (job && job.attemptsMade >= 3) {
           this.logger.error(`Moving job ${job.id} to DLQ after ${job.attemptsMade} attempts`);
           await this.dlq.add('failed', job.data, {
             jobId: job.id,
           });
         }
       });
     }

     async onModuleDestroy() {
       await this.worker.close();
       await this.dlq.close();
       await this.connection.quit();
     }
   }
   ```

**Validation Criteria:**
- [ ] Failed jobs (after 3 retries) are moved to DLQ
- [ ] DLQ stores job data for inspection
- [ ] DLQ does not auto-retry jobs

**Test Command:**
```bash
cd services/ai-service
npm run test:unit
```

---

## TASK-44.13: Add Integration Tests

**Objective:** Create integration tests for async execution pipeline

**Files Affected:**
- `services/api-gateway/src/ai/__tests__/ai-execution-async.integration.spec.ts` (NEW)

**Implementation:**

1. Create `ai-execution-async.integration.spec.ts`:
   ```typescript
   import { Test } from '@nestjs/testing';
   import { INestApplication } from '@nestjs/common';
   import * as request from 'supertest';

   describe('Async AI Execution Integration', () => {
     let app: INestApplication;

     beforeAll(async () => {
       // Setup test app
     });

     afterAll(async () => {
       await app.close();
     });

     it('should submit job and return 202 Accepted', async () => {
       const response = await request(app.getHttpServer())
         .post('/ai/execute')
         .set('Authorization', 'Bearer test-token')
         .send({
           sessionId: 'test-session',
           conversationId: 'test-conversation',
           provider: 'stub',
           prompt: 'test prompt',
         });

       expect(response.status).toBe(202);
       expect(response.body).toHaveProperty('executionId');
       expect(response.body.status).toBe('pending');
     });

     it('should poll status and return pending', async () => {
       // Submit job
       const submitResponse = await request(app.getHttpServer())
         .post('/ai/execute')
         .set('Authorization', 'Bearer test-token')
         .send({
           sessionId: 'test-session',
           conversationId: 'test-conversation',
           provider: 'stub',
           prompt: 'test prompt',
         });

       const executionId = submitResponse.body.executionId;

       // Poll status
       const statusResponse = await request(app.getHttpServer())
         .get(`/ai/executions/${executionId}`)
         .set('Authorization', 'Bearer test-token');

       expect(statusResponse.status).toBe(200);
       expect(statusResponse.body.status).toBe('pending');
     });

     it('should return completed status after execution', async () => {
       // TODO: Implement full end-to-end test with worker
     });

     it('should handle duplicate submissions (idempotency)', async () => {
       const requestBody = {
         sessionId: 'test-session',
         conversationId: 'test-conversation',
         provider: 'stub',
         prompt: 'test prompt',
       };

       // First submission
       const response1 = await request(app.getHttpServer())
         .post('/ai/execute')
         .set('Authorization', 'Bearer test-token')
         .set('Idempotency-Key', 'test-idempotency-001')
         .send(requestBody);

       expect(response1.status).toBe(202);
       const executionId1 = response1.body.executionId;

       // Second submission (duplicate)
       const response2 = await request(app.getHttpServer())
         .post('/ai/execute')
         .set('Authorization', 'Bearer test-token')
         .set('Idempotency-Key', 'test-idempotency-001')
         .send(requestBody);

       expect(response2.status).toBe(202);
       expect(response2.body.executionId).toBe(executionId1);
     });
   });
   ```

**Validation Criteria:**
- [ ] Integration tests pass
- [ ] Job submission returns 202
- [ ] Status polling returns correct status
- [ ] Idempotency works correctly

**Test Command:**
```bash
cd services/api-gateway
npm run test:integration
```

---

## TASK-44.14: Update Documentation

**Objective:** Update API documentation and README with async execution details

**Files Affected:**
- `services/api-gateway/README.md`
- `services/ai-service/README.md`
- `README.md` (root)

**Implementation:**

1. Update `services/api-gateway/README.md`:
   - Add async execution endpoint documentation
   - Add status polling endpoint documentation
   - Add example usage with polling

2. Update `services/ai-service/README.md`:
   - Add worker process documentation
   - Add queue configuration details
   - Add troubleshooting guide

3. Update root `README.md`:
   - Add Redis to infrastructure requirements
   - Add worker process to service list
   - Add async execution flow diagram

**Validation Criteria:**
- [ ] Documentation is clear and complete
- [ ] Examples are accurate
- [ ] Diagrams are up-to-date

---

## TASK-44.15: Create Admin Scripts

**Objective:** Create admin scripts for queue inspection and management

**Files Affected:**
- `services/ai-service/scripts/inspect-queue.ts` (NEW)
- `services/ai-service/scripts/inspect-dlq.ts` (NEW)
- `services/ai-service/scripts/retry-dlq-job.ts` (NEW)
- `services/ai-service/scripts/purge-dlq.ts` (NEW)

**Implementation:**

1. Create `inspect-queue.ts`:
   ```typescript
   import { Queue } from 'bullmq';
   import Redis from 'ioredis';

   async function main() {
     const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
     const queue = new Queue('ai-execution-jobs', { connection });

     const waiting = await queue.getWaitingCount();
     const active = await queue.getActiveCount();
     const completed = await queue.getCompletedCount();
     const failed = await queue.getFailedCount();

     console.log('Queue Status:');
     console.log(`  Waiting: ${waiting}`);
     console.log(`  Active: ${active}`);
     console.log(`  Completed: ${completed}`);
     console.log(`  Failed: ${failed}`);

     await queue.close();
     await connection.quit();
   }

   main();
   ```

2. Create `inspect-dlq.ts`:
   ```typescript
   import { Queue } from 'bullmq';
   import Redis from 'ioredis';

   async function main() {
     const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
     const dlq = new Queue('ai-execution-jobs-dlq', { connection });

     const jobs = await dlq.getJobs(['waiting', 'active', 'completed', 'failed']);

     console.log(`DLQ contains ${jobs.length} jobs:`);
     for (const job of jobs) {
       console.log(`  Job ${job.id}: ${job.data.executionId}`);
     }

     await dlq.close();
     await connection.quit();
   }

   main();
   ```

3. Create `retry-dlq-job.ts`:
   ```typescript
   import { Queue } from 'bullmq';
   import Redis from 'ioredis';

   async function main() {
     const jobId = process.argv[2];
     if (!jobId) {
       console.error('Usage: npm run admin:retry-dlq-job <jobId>');
       process.exit(1);
     }

     const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
     const dlq = new Queue('ai-execution-jobs-dlq', { connection });
     const mainQueue = new Queue('ai-execution-jobs', { connection });

     const job = await dlq.getJob(jobId);
     if (!job) {
       console.error(`Job ${jobId} not found in DLQ`);
       process.exit(1);
     }

     await mainQueue.add('execute', job.data);
     await job.remove();

     console.log(`Job ${jobId} moved back to main queue`);

     await dlq.close();
     await mainQueue.close();
     await connection.quit();
   }

   main();
   ```

4. Create `purge-dlq.ts`:
   ```typescript
   import { Queue } from 'bullmq';
   import Redis from 'ioredis';

   async function main() {
     const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
     const dlq = new Queue('ai-execution-jobs-dlq', { connection });

     await dlq.obliterate({ force: true });

     console.log('DLQ purged');

     await dlq.close();
     await connection.quit();
   }

   main();
   ```

5. Add scripts to `package.json`:
   ```json
   {
     "scripts": {
       "admin:inspect-queue": "ts-node scripts/inspect-queue.ts",
       "admin:inspect-dlq": "ts-node scripts/inspect-dlq.ts",
       "admin:retry-dlq-job": "ts-node scripts/retry-dlq-job.ts",
       "admin:purge-dlq": "ts-node scripts/purge-dlq.ts"
     }
   }
   ```

**Validation Criteria:**
- [ ] Scripts run without errors
- [ ] Scripts display correct queue information
- [ ] Retry script moves jobs back to main queue
- [ ] Purge script clears DLQ

**Test Command:**
```bash
cd services/ai-service
npm run admin:inspect-queue
npm run admin:inspect-dlq
```

---

## Summary

Phase-44 implementation consists of 15 sequential tasks:

1. Add Redis to Docker Compose
2. Install BullMQ in AI Service
3. Create Job Queue Schema
4. Implement Queue Submission in API Gateway
5. Implement Status Polling Endpoint
6. Implement Worker Job Consumer
7. Implement Idempotency Check in Worker
8. Implement AI Provider Call in Worker
9. Implement Container Manager Call in Worker
10. Implement Ledger Update in Worker
11. Implement Retry Logic
12. Implement Dead-Letter Queue
13. Add Integration Tests
14. Update Documentation
15. Create Admin Scripts

**Estimated Effort:** 3-5 days (sequential implementation)

**Dependencies:**
- Redis 7+
- BullMQ 4+
- Existing Phase-43 ledger system (LOCKED)

**Validation:**
- All unit tests pass
- All integration tests pass
- Manual end-to-end testing
- Queue metrics monitoring

---

**PHASE-44-TASKS COMPLETE**

**Date:** 2026-03-04  
**Status:** READY FOR IMPLEMENTATION
