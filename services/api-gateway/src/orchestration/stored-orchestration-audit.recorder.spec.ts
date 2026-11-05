import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { OrchestrationModule } from './orchestration.module';
import {
  InMemoryOrchestrationAuditRecorder,
  StoredOrchestrationAuditRecorder,
} from './orchestration-audit.recorder';
import type { OrchestrationAuditEvent } from './orchestration.contracts';

const event: OrchestrationAuditEvent = {
  eventType: 'orchestration.referral_approved',
  collaborationRunId: 'collab_11111111-1111-4111-8111-111111111111',
  referralTraceId: 'trace_secret-trace',
  sourceBuilder: {
    agentRole: 'builder',
    builderProfileId: 'builder-secret',
  },
  targetBuilder: {
    agentRole: 'chief-of-staff',
    builderProfileId: 'builder-target',
  },
  timestamp: '2026-11-05T06:00:00.000Z',
  payload: {
    marker: 'payload-secret-marker',
  },
};

function createRecorder(insert: jest.Mock): StoredOrchestrationAuditRecorder {
  return new StoredOrchestrationAuditRecorder({
    insert,
  } as unknown as Repository<AuditEventEntity>);
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('StoredOrchestrationAuditRecorder', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('inserts one orchestration audit row and keeps the in-memory event and log line', async () => {
    const insert = jest.fn().mockResolvedValue(undefined);
    const recorder = createRecorder(insert);
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    recorder.record(event);
    await settle();

    expect(recorder.getEvents()).toEqual([event]);
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(event));
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      category: 'orchestration',
      eventType: event.eventType,
      subjectType: 'collaboration_run',
      subjectId: event.collaborationRunId,
      userId: null,
      payload: event,
      occurredAt: new Date(event.timestamp),
    });
  });

  it('a rejected insert does not throw and logs a warning naming the event type and run id', async () => {
    const insert = jest.fn().mockRejectedValue(new Error('db down'));
    const recorder = createRecorder(insert);
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    expect(() => recorder.record(event)).not.toThrow();
    await settle();

    expect(recorder.getEvents()).toEqual([event]);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warning = String(warnSpy.mock.calls[0]?.[0]);
    expect(warning).toContain(event.eventType);
    expect(warning).toContain(event.collaborationRunId);
    expect(warning).not.toContain('db down');
    expect(warning).not.toContain('payload-secret-marker');
    expect(warning).not.toContain('trace_secret-trace');
    expect(warning).not.toContain('builder-secret');
  });

  it('a synchronous insert failure does not throw and logs a warning', () => {
    const insert = jest.fn(() => {
      throw new Error('sync down');
    });
    const recorder = createRecorder(insert);
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    expect(() => recorder.record(event)).not.toThrow();

    expect(recorder.getEvents()).toEqual([event]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warning = String(warnSpy.mock.calls[0]?.[0]);
    expect(warning).toContain(event.eventType);
    expect(warning).toContain(event.collaborationRunId);
    expect(warning).not.toContain('sync down');
  });
});

describe('OrchestrationModule stored audit recorder', () => {
  it('provides StoredOrchestrationAuditRecorder for the InMemoryOrchestrationAuditRecorder token', () => {
    const providers = Reflect.getMetadata('providers', OrchestrationModule) as Array<
      | Function
      | { provide?: unknown; useClass?: unknown }
    >;

    expect(providers).toContainEqual({
      provide: InMemoryOrchestrationAuditRecorder,
      useClass: StoredOrchestrationAuditRecorder,
    });
  });

  it('registers AuditEventEntity so the stored recorder can insert', () => {
    const imports = Reflect.getMetadata('imports', OrchestrationModule) as Array<{
      providers?: Array<{ provide?: unknown }>;
    }>;
    const token = getRepositoryToken(AuditEventEntity);
    const feature = imports.find(
      (candidate) =>
        Array.isArray(candidate?.providers) &&
        candidate.providers.some((provider) => provider?.provide === token),
    );

    expect(feature).toBeDefined();
  });
});
