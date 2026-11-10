import { randomUUID } from 'crypto';
import { FindOperator } from 'typeorm';
import { SessionStatus } from '../entities/session-status.enum';
import {
  COLLABORATION_BUSINESS_PROJECT_NAME,
  COLLABORATION_BUSINESS_RUN_NOTE,
  CollaborationBusinessSessionService,
  collaborationBusinessProjectSlug,
} from './collaboration-business-session';

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

type Row = Record<string, unknown> & { id: string; createdAt: Date };

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) =>
    expected instanceof FindOperator && expected.type === 'isNull'
      ? row[key] === null || row[key] === undefined
      : row[key] === expected,
  );
}

function fakeRepo(rows: Row[]) {
  return {
    create: jest.fn((input: Record<string, unknown>) => ({ ...input })),
    save: jest.fn(async (input: Record<string, unknown>) => {
      const row = { createdAt: new Date(), ...input, id: randomUUID() } as Row;
      rows.push(row);
      return { ...row };
    }),
    findOne: jest.fn(async (opts: { where: Record<string, unknown> }) => {
      const found = rows
        .filter((row) => matches(row, opts.where))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
      return found[0] ? { ...found[0] } : null;
    }),
    update: jest.fn(async (criteria: Record<string, unknown>, partial: Record<string, unknown>) => {
      for (const row of rows) {
        if (matches(row, criteria)) {
          Object.assign(row, partial);
        }
      }
      return { affected: 1 };
    }),
  };
}

describe('CollaborationBusinessSessionService (TEAM-NO-SESSION-02)', () => {
  let projects: Row[];
  let sessions: Row[];
  let projectRepo: ReturnType<typeof fakeRepo>;
  let sessionRepo: ReturnType<typeof fakeRepo>;
  let service: CollaborationBusinessSessionService;

  beforeEach(() => {
    projects = [];
    sessions = [];
    projectRepo = fakeRepo(projects);
    sessionRepo = fakeRepo(sessions);
    service = new CollaborationBusinessSessionService(projectRepo as never, sessionRepo as never);
  });

  it('creates one project and one session on first use with the exact values', async () => {
    const anchor = await service.ensureForOwner(OWNER_ID);

    expect(projects).toHaveLength(1);
    expect(sessions).toHaveLength(1);
    const project = projects[0];
    const session = sessions[0];
    expect(anchor).toEqual({ sessionId: session.id, projectId: project.id });
    expect(project).toMatchObject({
      userId: OWNER_ID,
      name: COLLABORATION_BUSINESS_PROJECT_NAME,
      slug: `business-${OWNER_ID}`,
      visibility: 'private',
      workspaceId: null,
    });
    expect(String(project.slug)).toHaveLength(45);
    expect(project.name).toBe('Business workflows');
    expect(session).toMatchObject({
      userId: OWNER_ID,
      projectId: project.id,
      containerId: null,
      status: SessionStatus.STOPPED,
      terminatedAt: null,
      terminationReason: null,
    });
    expect((session.expiresAt as Date).getTime()).toBeLessThanOrEqual(session.createdAt.getTime());
    expect((session.lastActivityAt as Date).getTime()).toBe(session.createdAt.getTime());
  });

  it('reuses both rows and touches lastActivityAt on a later start', async () => {
    const first = await service.ensureForOwner(OWNER_ID);
    const before = (sessions[0].lastActivityAt as Date).getTime();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await service.ensureForOwner(OWNER_ID);

    expect(second).toEqual(first);
    expect(projects).toHaveLength(1);
    expect(sessions).toHaveLength(1);
    expect((sessions[0].lastActivityAt as Date).getTime()).toBeGreaterThan(before);
    expect(sessionRepo.update).toHaveBeenCalledWith(
      { id: first.sessionId, userId: OWNER_ID },
      { lastActivityAt: expect.any(Date) },
    );
    // The expiry and status are not changed by a reuse.
    expect(sessions[0].status).toBe(SessionStatus.STOPPED);
    expect((sessions[0].expiresAt as Date).getTime()).toBeLessThanOrEqual(
      sessions[0].createdAt.getTime(),
    );
  });

  it('creates a new session on the same project after the old one is terminated', async () => {
    const first = await service.ensureForOwner(OWNER_ID);
    sessions[0].terminatedAt = new Date();

    const second = await service.ensureForOwner(OWNER_ID);

    expect(second.projectId).toBe(first.projectId);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(projects).toHaveLength(1);
    expect(sessions).toHaveLength(2);
    expect(sessions[1]).toMatchObject({ status: SessionStatus.STOPPED, terminatedAt: null });
  });

  it('never uses a workspace session opened on the business project', async () => {
    const first = await service.ensureForOwner(OWNER_ID);
    sessions.push({
      id: randomUUID(),
      createdAt: new Date(0),
      userId: OWNER_ID,
      projectId: first.projectId,
      containerId: 'container-1',
      status: SessionStatus.ACTIVE,
      terminatedAt: null,
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const second = await service.ensureForOwner(OWNER_ID);
    expect(second.sessionId).toBe(first.sessionId);
  });

  it('never takes a project of the owner with a look-alike slug in a workspace', async () => {
    projects.push({
      id: randomUUID(),
      createdAt: new Date(0),
      userId: OWNER_ID,
      name: 'Mine',
      slug: collaborationBusinessProjectSlug(OWNER_ID),
      workspaceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      visibility: 'private',
    });

    const anchor = await service.ensureForOwner(OWNER_ID);

    expect(projects).toHaveLength(2);
    expect(anchor.projectId).toBe(projects[1].id);
    expect(projects[1].workspaceId).toBeNull();
  });

  it('keeps owners apart: each owner gets and finds only their own rows', async () => {
    const mine = await service.ensureForOwner(OWNER_ID);
    expect(await service.findForOwner(OTHER_ID)).toBeNull();
    const theirs = await service.ensureForOwner(OTHER_ID);

    expect(theirs.projectId).not.toBe(mine.projectId);
    expect(theirs.sessionId).not.toBe(mine.sessionId);
    expect(projects.map((row) => row.userId).sort()).toEqual([OWNER_ID, OTHER_ID].sort());
    expect(sessions.find((row) => row.id === theirs.sessionId)?.userId).toBe(OTHER_ID);
    expect(await service.findForOwner(OWNER_ID)).toEqual({ projectId: mine.projectId });
    expect(await service.findForOwner(OTHER_ID)).toEqual({ projectId: theirs.projectId });

    for (const call of projectRepo.findOne.mock.calls) {
      const where = call[0].where;
      expect(typeof where.userId).toBe('string');
      expect(where.slug).toBe(`business-${where.userId}`);
      expect(where.workspaceId).toBeInstanceOf(FindOperator);
    }
    for (const call of sessionRepo.findOne.mock.calls) {
      const where = call[0].where;
      expect(typeof where.userId).toBe('string');
      expect(where.status).toBe(SessionStatus.STOPPED);
      expect(where.containerId).toBeInstanceOf(FindOperator);
      expect(where.terminatedAt).toBeInstanceOf(FindOperator);
    }
  });

  it('findForOwner reads only and never creates a row', async () => {
    expect(await service.findForOwner(OWNER_ID)).toBeNull();
    expect(projectRepo.save).not.toHaveBeenCalled();
    expect(sessionRepo.save).not.toHaveBeenCalled();
    expect(sessionRepo.findOne).not.toHaveBeenCalled();
    expect(projects).toHaveLength(0);
    expect(sessions).toHaveLength(0);
  });

  it('settles on the oldest project when two first starts both inserted one', async () => {
    projects.push({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      createdAt: new Date(1000),
      userId: OWNER_ID,
      name: COLLABORATION_BUSINESS_PROJECT_NAME,
      slug: collaborationBusinessProjectSlug(OWNER_ID),
      workspaceId: null,
      visibility: 'private',
    });
    projects.push({
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: new Date(2000),
      userId: OWNER_ID,
      name: COLLABORATION_BUSINESS_PROJECT_NAME,
      slug: collaborationBusinessProjectSlug(OWNER_ID),
      workspaceId: null,
      visibility: 'private',
    });

    const anchor = await service.ensureForOwner(OWNER_ID);
    expect(anchor.projectId).toBe('ffffffff-ffff-4fff-8fff-ffffffffffff');
    expect(projectRepo.findOne.mock.calls[0][0]).toMatchObject({
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  });

  it('has a one-sentence caller note about the missing workspace', () => {
    expect(COLLABORATION_BUSINESS_RUN_NOTE).toBe(
      'This run has no project files or workspace. Do not use the file tools.',
    );
  });
});
