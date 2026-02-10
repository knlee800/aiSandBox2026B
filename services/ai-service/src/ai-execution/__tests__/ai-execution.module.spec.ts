import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AIExecutionModule } from '../ai-execution.module';
import { AIExecutionService } from '../ai-execution.service';

/**
 * AIExecutionModule Tests
 *
 * Phase 28: Per-request provider selection (caller-owned)
 *
 * NOTE: Phase 28 removed DI-based adapter selection (AI_ADAPTER token).
 * Adapters are now instantiated per-request based on request.provider field.
 * 
 * This test suite verifies:
 * - AIExecutionModule can be imported successfully
 * - AIExecutionService can be resolved from DI
 * - Module has required dependencies (ConfigModule)
 */
describe('AIExecutionModule - Phase 28', () => {
  describe('Module registration', () => {
    it('should import AIExecutionModule with ConfigModule successfully', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          AIExecutionModule,
        ],
      }).compile();

      const service = module.get<AIExecutionService>(AIExecutionService);

      expect(service).toBeDefined();
      expect(module).toBeDefined();
      
      await module.close();
    });

    it('should resolve AIExecutionService from module', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          AIExecutionModule,
        ],
      }).compile();

      const service = module.get<AIExecutionService>(AIExecutionService);

      expect(service).toBeDefined();
      expect(service.execute).toBeDefined();
      expect(typeof service.execute).toBe('function');
      
      await module.close();
    });
  });

  describe('Phase 28 Architecture Verification', () => {
    it('should verify AIExecutionService does not depend on AI_ADAPTER token', async () => {
      // Phase 28: AI_ADAPTER token was removed
      // This test verifies the module can initialize without it
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          AIExecutionModule,
        ],
      }).compile();

      const service = module.get<AIExecutionService>(AIExecutionService);

      // Service should be defined without AI_ADAPTER token
      expect(service).toBeDefined();
      
      await module.close();
    });
  });
});
