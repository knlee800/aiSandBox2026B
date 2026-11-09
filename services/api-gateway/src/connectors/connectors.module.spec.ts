import { readFileSync, readdirSync } from 'fs';
import { join, relative, resolve } from 'path';
import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { ConnectorsModule } from './connectors.module';
import { ConnectorsService } from './connectors.service';

describe('ConnectorsModule boot', () => {
  const original = process.env.CONNECTOR_CREDENTIALS_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
    else process.env.CONNECTOR_CREDENTIALS_KEY = original;
  });

  it('imports and instantiates the connector module without CONNECTOR_CREDENTIALS_KEY', async () => {
    delete process.env.CONNECTOR_CREDENTIALS_KEY;
    expect(() => new ConnectorsModule()).not.toThrow();

    const find = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConnectorsService,
        {
          provide: getRepositoryToken(ConnectorConnection),
          useValue: { find, manager: { transaction: jest.fn() } },
        },
      ],
    }).compile();

    const service = moduleRef.get(ConnectorsService);
    await expect(service.list('11111111-1111-4111-8111-111111111111')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(find).not.toHaveBeenCalled();
    await moduleRef.close();

    process.env.CONNECTOR_CREDENTIALS_KEY = 'not-a-valid-key';
    expect(() => new ConnectorsModule()).not.toThrow();
    const invalidKeyModule = await Test.createTestingModule({
      providers: [
        ConnectorsService,
        {
          provide: getRepositoryToken(ConnectorConnection),
          useValue: { find: jest.fn(), manager: { transaction: jest.fn() } },
        },
      ],
    }).compile();
    expect(invalidKeyModule.get(ConnectorsService)).toBeInstanceOf(ConnectorsService);
    await invalidKeyModule.close();
  });

  it('mentions the credentials key only in the crypto helper, and the gateway env template carries an empty value', () => {
    const root = resolve(__dirname, '..');
    const hits: string[] = [];
    walk(root, (file) => {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) return;
      if (readFileSync(file, 'utf8').includes('CONNECTOR_CREDENTIALS_KEY')) {
        hits.push(relative(root, file).replace(/\\/g, '/'));
      }
    });
    expect(hits).toEqual(['connectors/connector-crypto.ts']);

    const appModule = readFileSync(join(root, 'app.module.ts'), 'utf8');
    const main = readFileSync(join(root, 'main.ts'), 'utf8');
    expect(appModule).toContain('ConnectorsModule');
    expect(main.includes('CONNECTOR_CREDENTIALS_KEY')).toBe(false);

    const envDir = resolve(__dirname, '..', '..', '..', '..', 'ops', 'clean-baseline', 'env');
    const gateway = readFileSync(join(envDir, 'gateway.env.template'), 'utf8');
    const ai = readFileSync(join(envDir, 'ai.env.template'), 'utf8');
    expect(gateway).toMatch(/^CONNECTOR_CREDENTIALS_KEY=$/m);
    expect(gateway).toContain('32 random bytes, base64');
    expect(gateway).toContain('STAGING-DEPLOY-CONN-01');
    expect(ai.includes('CONNECTOR_CREDENTIALS_KEY')).toBe(false);
  });
});

function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, visit);
    } else {
      visit(full);
    }
  }
}
