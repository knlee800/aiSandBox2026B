import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createHarnessEntitlementProof } from '../ai/ai-execution.controller';
import { ExecutionResultService } from '../ai/execution-result.service';
import { isConnectorCallGranted } from '../connectors/connector-grant-token';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { QueueService } from '../queue/queue.service';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { resolveConnectorGrantJobFields } from './collaboration-connector-grants';
import * as toolProfile from './collaboration-tool-profile';
import { OrchestrationService } from './orchestration.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const KEY = randomBytes(32).toString('base64');
const HARNESS_SECRET = 'test-hmac-secret-conn-grant-01';
const APP_PASSWORD = 'imap-app-password-secret';
const ICAL_URL = 'https://calendar.example.com/private-secret-ical-link.ics';

type Row = { userId: string; kind: string; secretCiphertext: string; preset: string | null };

function connectionRows(rows: Row[]) {
  return {
    find: jest.fn(async (options: { where: { userId: string } }) =>
      rows.filter((row) => row.userId === options.where.userId).map((row) => ({ ...row })),
    ),
  };
}

function mapRepo<T>(store: Map<string, T>, pk: string) {
  const matches = (row: unknown, where?: Record<string, unknown>) =>
    !where ||
    Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
  const repo = {
    findOne: async ({ where }: { where: Record<string, unknown> }) => {
      for (const row of store.values()) if (matches(row, where)) return { ...(row as object) } as T;
      return null;
    },
    find: async (opts: { where?: Record<string, unknown> } = {}) =>
      [...store.values()].filter((row) => matches(row, opts.where)).map((row) => ({ ...(row as object) }) as T),
    save: async (entity: T) => {
      store.set(String((entity as Record<string, unknown>)[pk]), { ...(entity as object) } as T);
      return { ...(entity as object) } as T;
    },
    manager: undefined as unknown,
  };
  return repo;
}

describe('CONN-GRANT-01 resolveConnectorGrantJobFields', () => {
  const originalKey = process.env.CONNECTOR_CREDENTIALS_KEY;
  beforeEach(() => {
    process.env.CONNECTOR_CREDENTIALS_KEY = KEY;
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
    else process.env.CONNECTOR_CREDENTIALS_KEY = originalKey;
  });

  const base = {
    executionId: 'exec-unit',
    userId: OWNER,
    harnessVersion: 'v1',
    harnessToolProfile: 'read',
    nowMs: Date.now(),
  };

  it('grants only the listed tools whose kind the owner has connected, sorted, with a token', async () => {
    const connections = connectionRows([
      { userId: OWNER, kind: 'imap', secretCiphertext: 'v1.x.y.z', preset: 'gmail' },
      { userId: OTHER, kind: 'ical', secretCiphertext: 'v1.x.y.z', preset: null },
    ]);
    const both = await resolveConnectorGrantJobFields({
      ...base,
      roleToolIds: ['mail_list_unread_metadata', 'calendar_list_today', 'not_a_tool'],
      connections,
    });
    expect(both.outcome).toBe('granted');
    expect(both.fields.connectorGrants).toEqual(['mail_list_unread_metadata']);
    expect(
      isConnectorCallGranted({
        grantToken: both.fields.connectorGrantToken,
        executionId: 'exec-unit',
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        nowMs: Date.now(),
      }),
    ).toBe(true);
    expect(
      isConnectorCallGranted({
        grantToken: both.fields.connectorGrantToken,
        executionId: 'exec-unit',
        userId: OWNER,
        toolId: 'calendar_list_today',
        nowMs: Date.now(),
      }),
    ).toBe(false);
    expect(connections.find).toHaveBeenCalledWith({
      where: { userId: OWNER },
      select: ['userId', 'kind'],
    });
  });

  it('returns {} when the role lists nothing, the connection is missing, the key is missing, the lookup fails, or the profile is not read', async () => {
    const connected = connectionRows([
      { userId: OWNER, kind: 'imap', secretCiphertext: 'c', preset: 'gmail' },
      { userId: OWNER, kind: 'ical', secretCiphertext: 'c', preset: null },
    ]);
    const tools = ['mail_list_unread_metadata', 'calendar_list_today'];
    const none = await resolveConnectorGrantJobFields({ ...base, roleToolIds: [], connections: connected });
    expect(none).toEqual({ fields: {}, outcome: 'no_role_tools' });
    expect(connected.find).not.toHaveBeenCalled();

    const noConnection = await resolveConnectorGrantJobFields({
      ...base,
      roleToolIds: ['calendar_list_today'],
      connections: connectionRows([{ userId: OWNER, kind: 'imap', secretCiphertext: 'c', preset: 'gmail' }]),
    });
    expect(noConnection).toEqual({ fields: {}, outcome: 'no_connection' });

    for (const profile of ['review', 'write', 'agent-write', undefined]) {
      const result = await resolveConnectorGrantJobFields({
        ...base,
        harnessToolProfile: profile,
        roleToolIds: tools,
        connections: connected,
      });
      expect(result).toEqual({ fields: {}, outcome: 'not_eligible' });
    }
    const plain = await resolveConnectorGrantJobFields({
      ...base,
      harnessVersion: undefined,
      roleToolIds: tools,
      connections: connected,
    });
    expect(plain.fields).toEqual({});

    const noRepo = await resolveConnectorGrantJobFields({ ...base, roleToolIds: tools });
    expect(noRepo.fields).toEqual({});

    const failing = await resolveConnectorGrantJobFields({
      ...base,
      roleToolIds: tools,
      connections: { find: jest.fn().mockRejectedValue(new Error('db down')) },
    });
    expect(failing).toEqual({ fields: {}, outcome: 'lookup_failed' });

    delete process.env.CONNECTOR_CREDENTIALS_KEY;
    const unconfigured = await resolveConnectorGrantJobFields({ ...base, roleToolIds: tools, connections: connected });
    expect(unconfigured).toEqual({ fields: {}, outcome: 'not_configured' });
  });

  it('lists no connector tools for any role today', () => {
    expect(toolProfile.COLLABORATION_ROLE_CONNECTOR_TOOLS).toEqual({});
    for (const id of ['lead', 'writer', 'reviewer', 'chief-of-staff', 'builder', 'constructor']) {
      expect(toolProfile.collaborationRoleConnectorToolIds(id)).toEqual([]);
    }
  });
});

describe('CONN-GRANT-01 connector grants on collaboration jobs', () => {
  const originalKey = process.env.CONNECTOR_CREDENTIALS_KEY;
  const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
  let service: OrchestrationService;
  let queue: { enqueueExecution: jest.Mock };
  let connections: ReturnType<typeof connectionRows>;
  let rows: Row[];
  const logs: string[] = [];
  let logSpies: jest.SpyInstance[] = [];

  beforeEach(async () => {
    process.env.CONNECTOR_CREDENTIALS_KEY = KEY;
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
    logs.length = 0;
    logSpies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((method) =>
      jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
        logs.push(args.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' '));
      }),
    );
    rows = [
      { userId: OWNER, kind: 'imap', secretCiphertext: `cipher-of-${APP_PASSWORD}`, preset: 'gmail' },
      { userId: OWNER, kind: 'ical', secretCiphertext: `cipher-of-${ICAL_URL}`, preset: null },
    ];
    connections = connectionRows(rows);
    queue = { enqueueExecution: jest.fn().mockResolvedValue(undefined) };
    const runs = new Map<string, CollaborationRunEntity>();
    const referrals = new Map<string, CollaborationReferralEntity>();
    const runRepo = mapRepo(runs, 'collaborationRunId');
    const referralRepo = mapRepo(referrals, 'referralId');
    const manager = {
      transaction: async <R>(cb: (em: unknown) => Promise<R>) => cb(manager),
      getRepository: (entity: unknown) => (entity === CollaborationRunEntity ? runRepo : referralRepo),
    };
    runRepo.manager = manager;
    referralRepo.manager = manager;
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        { provide: getRepositoryToken(CollaborationRunEntity), useValue: runRepo },
        { provide: getRepositoryToken(CollaborationReferralEntity), useValue: referralRepo },
        { provide: getRepositoryToken(ConnectorConnection), useValue: connections },
        { provide: QueueService, useValue: queue },
        { provide: ExecutionResultService, useValue: { requestCancel: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(OrchestrationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    logSpies = [];
    if (originalKey === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
    else process.env.CONNECTOR_CREDENTIALS_KEY = originalKey;
    if (originalSecret === undefined) delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    else process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = originalSecret;
  });

  async function startJob(input: {
    id: string;
    target: string;
    fileAccess: boolean;
    userId?: string;
  }): Promise<Record<string, unknown>> {
    const userId = input.userId ?? OWNER;
    await service.createCollaborationRun({
      collaborationRunId: `run-${input.id}`,
      userId,
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });
    const referral = await service.createReferral({
      referralId: `ref-${input.id}`,
      referralTraceId: `trace-${input.id}`,
      collaborationRunId: `run-${input.id}`,
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
      targetBuilder: { agentRole: 'chief-of-staff', builderProfileId: input.target },
      idempotencyKey: `key-${input.id}`,
      pendingJob: {
        sessionId: 'session-01',
        conversationId: 'conv-01',
        apiKeyId: 'apikey-01',
        prompt: 'Brief me.',
        provider: 'stub',
        adapter: 'stub',
        model: null,
        workspaceContext: null,
        globalInstructions: null,
        projectInstructions: null,
        orchestrationPriority: null,
        decidedBy: null,
        decisionReason: null,
        fileAccess: input.fileAccess,
      },
    });
    await service.startReferralExecution({
      referralId: referral.referralId,
      executionId: `exec-${input.id}`,
      sessionId: 'session-01',
      conversationId: 'conv-01',
      userId,
      apiKeyId: 'apikey-01',
      prompt: 'Brief me.',
      provider: 'stub',
      adapter: 'stub',
      submittedAt: '2026-11-09T08:00:00.000Z',
    });
    const calls = queue.enqueueExecution.mock.calls;
    return calls[calls.length - 1][0] as Record<string, unknown>;
  }

  function listRoleTools(map: Record<string, string[]>) {
    jest
      .spyOn(toolProfile, 'collaborationRoleConnectorToolIds')
      .mockImplementation((id: string) => map[id] ?? []);
  }

  function expectNoSecrets(payload: Record<string, unknown>) {
    const { connectorGrantToken, ...rest } = payload;
    const text = JSON.stringify(rest);
    expect(text.includes(APP_PASSWORD)).toBe(false);
    expect(text.includes(ICAL_URL)).toBe(false);
    expect(text.includes('cipher-of-')).toBe(false);
    expect(text.includes(KEY)).toBe(false);
    if (typeof connectorGrantToken === 'string') {
      // The token travels only in its own field, signed by the proof.
      expect(text.includes(connectorGrantToken)).toBe(false);
      expect(logs.join('\n').includes(connectorGrantToken)).toBe(false);
    }
    expect(logs.join('\n').includes(APP_PASSWORD)).toBe(false);
    expect(logs.join('\n').includes(KEY)).toBe(false);
  }

  it('adds connectorGrants and a grant token when the role lists the tool and the owner has the connection, covered by the proof', async () => {
    listRoleTools({ 'chief-of-staff': ['mail_list_unread_metadata', 'calendar_list_today'] });
    const payload = await startJob({ id: 'granted', target: 'chief-of-staff', fileAccess: true });

    expect(payload.harnessVersion).toBe('v1');
    expect(payload.harnessToolProfile).toBe('read');
    expect(payload.connectorGrants).toEqual(['calendar_list_today', 'mail_list_unread_metadata']);
    expect(typeof payload.connectorGrantToken).toBe('string');
    for (const toolId of ['calendar_list_today', 'mail_list_unread_metadata']) {
      expect(
        isConnectorCallGranted({
          grantToken: payload.connectorGrantToken,
          executionId: 'exec-granted',
          userId: OWNER,
          toolId,
          nowMs: Date.now(),
        }),
      ).toBe(true);
    }
    // Knowledge scopes travel as before.
    expect(payload.knowledgeScopes).toEqual(
      toolProfile.knowledgeScopesJobFields('chief-of-staff').knowledgeScopes,
    );
    expect((payload.knowledgeScopes as string[]).length).toBeGreaterThan(0);

    const { harnessEntitlementProof, ...signed } = payload;
    const expected = createHarnessEntitlementProof({
      executionId: String(signed.executionId),
      userId: String(signed.userId),
      apiKeyId: String(signed.apiKeyId),
      issuedAt: String(signed.submittedAt),
      payloadWithoutProof: signed,
      secret: HARNESS_SECRET,
    });
    expect(harnessEntitlementProof).toEqual(expected);
    for (const changed of [
      { ...signed, connectorGrants: ['calendar_list_today'] },
      { ...signed, connectorGrants: ['calendar_list_today', 'mail_list_unread_metadata', 'mail_list_unread_metadata'] },
      { ...signed, connectorGrantToken: `${String(signed.connectorGrantToken)}x` },
    ]) {
      const tampered = createHarnessEntitlementProof({
        executionId: String(signed.executionId),
        userId: String(signed.userId),
        apiKeyId: String(signed.apiKeyId),
        issuedAt: String(signed.submittedAt),
        payloadWithoutProof: changed,
        secret: HARNESS_SECRET,
      });
      expect(tampered.payloadDigest).not.toBe(expected.payloadDigest);
    }
    expect(connections.find).toHaveBeenCalledWith({
      where: { userId: OWNER },
      select: ['userId', 'kind'],
    });
    expectNoSecrets(payload);
  });

  it('grants only the kinds the owner has connected', async () => {
    rows.splice(1, 1);
    listRoleTools({ 'chief-of-staff': ['mail_list_unread_metadata', 'calendar_list_today'] });
    const payload = await startJob({ id: 'mail-only', target: 'chief-of-staff', fileAccess: true });
    expect(payload.connectorGrants).toEqual(['mail_list_unread_metadata']);
    expect(
      isConnectorCallGranted({
        grantToken: payload.connectorGrantToken,
        executionId: 'exec-mail-only',
        userId: OWNER,
        toolId: 'calendar_list_today',
        nowMs: Date.now(),
      }),
    ).toBe(false);
  });

  it('omits both fields when the role lists no connector tool, as for every role today', async () => {
    const payload = await startJob({ id: 'unlisted', target: 'chief-of-staff', fileAccess: true });
    expect(payload.harnessVersion).toBe('v1');
    expect(payload).not.toHaveProperty('connectorGrants');
    expect(payload).not.toHaveProperty('connectorGrantToken');
    expect(connections.find).not.toHaveBeenCalled();
  });

  it('omits both fields when the owner has no connection of that kind, or another user has it', async () => {
    rows.splice(0, rows.length, { userId: OTHER, kind: 'imap', secretCiphertext: 'c', preset: 'gmail' });
    listRoleTools({ 'chief-of-staff': ['mail_list_unread_metadata'] });
    const payload = await startJob({ id: 'unconnected', target: 'chief-of-staff', fileAccess: true });
    expect(payload).not.toHaveProperty('connectorGrants');
    expect(payload).not.toHaveProperty('connectorGrantToken');
    expect(JSON.stringify(payload).includes('connectorGrant')).toBe(false);
  });

  it('never grants on a plain job, a write job or a review job, and not without the credentials key', async () => {
    listRoleTools({
      'chief-of-staff': ['mail_list_unread_metadata'],
      writer: ['mail_list_unread_metadata'],
      reviewer: ['mail_list_unread_metadata'],
    });
    const plain = await startJob({ id: 'plain', target: 'chief-of-staff', fileAccess: false });
    expect(plain).not.toHaveProperty('harnessVersion');
    expect(plain).not.toHaveProperty('connectorGrants');
    expect(plain).not.toHaveProperty('connectorGrantToken');

    const write = await startJob({ id: 'write', target: 'writer', fileAccess: true });
    expect(write.harnessToolProfile).toBe('write');
    expect(write).not.toHaveProperty('connectorGrants');
    expect(write).not.toHaveProperty('connectorGrantToken');

    const review = await startJob({ id: 'review', target: 'reviewer', fileAccess: true });
    expect(review.harnessToolProfile).toBe('review');
    expect(review).not.toHaveProperty('connectorGrants');
    expect(connections.find).not.toHaveBeenCalled();

    delete process.env.CONNECTOR_CREDENTIALS_KEY;
    const unconfigured = await startJob({ id: 'nokey', target: 'chief-of-staff', fileAccess: true });
    expect(unconfigured.harnessVersion).toBe('v1');
    expect(unconfigured).not.toHaveProperty('connectorGrants');
    expect(unconfigured).not.toHaveProperty('connectorGrantToken');
  });

  it('leaves the Builder execute path without connector grants', () => {
    const source = readFileSync(join(__dirname, '..', 'ai', 'ai-execution.controller.ts'), 'utf8');
    expect(source.includes('connectorGrant')).toBe(false);
    expect(source.includes('collaboration-connector-grants')).toBe(false);
  });
});
