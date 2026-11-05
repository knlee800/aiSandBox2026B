import { getRepositoryToken } from '@nestjs/typeorm';
import { CreditDeductionRecord } from '../entities/credit-deduction-record.entity';
import { DailyCreditCapService } from './daily-credit-cap.service';
import { SafetyModule } from './safety.module';

describe('SafetyModule daily credit cap wiring', () => {
  it('provides and exports the cap service and registers the deduction repository', () => {
    const providers = Reflect.getMetadata('providers', SafetyModule) as unknown[];
    const exported = Reflect.getMetadata('exports', SafetyModule) as unknown[];
    const imports = Reflect.getMetadata('imports', SafetyModule) as Array<{
      providers?: Array<{ provide?: unknown }>;
    }>;

    expect(providers).toContain(DailyCreditCapService);
    expect(exported).toContain(DailyCreditCapService);

    const repositoryToken = getRepositoryToken(CreditDeductionRecord);
    const registered = imports.some((imported) =>
      (imported?.providers ?? []).some(
        (provider) => provider?.provide === repositoryToken,
      ),
    );
    expect(registered).toBe(true);
  });
});
