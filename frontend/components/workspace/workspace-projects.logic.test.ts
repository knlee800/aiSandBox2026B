import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  associateWorkspaceProjectSession,
  createWorkspaceProject,
  forkPublicWorkspaceProject,
  loadPublicWorkspaceProjectDetail,
  loadPublicWorkspaceProjects,
  loadWorkspaceProjects,
  openWorkspaceProject,
  updateWorkspaceProjectVisibility,
} from './workspace-projects.logic';

describe('workspace-projects.logic', () => {
  test('loadWorkspaceProjects fetches project list for current user', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify([
          {
            id: 'project-1',
            userId: 'user-1',
            name: 'Main Project',
            workspaceId: 'workspace-1',
            createdAt: '2026-04-03T00:00:00.000Z',
            updatedAt: '2026-04-03T00:00:00.000Z',
          },
        ]),
        { status: 200 },
      );
    };

    const projects = await loadWorkspaceProjects({
      token: 'token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0].url, '/api/projects');
    assert.equal(projects.length, 1);
    assert.equal(projects[0].name, 'Main Project');
  });

  test('createWorkspaceProject posts name and returns project', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          id: 'project-2',
          userId: 'user-1',
          name: 'New Project',
          visibility: 'private',
          workspaceId: 'workspace-2',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        }),
        { status: 201 },
      );
    };

    const project = await createWorkspaceProject({
      token: 'token',
      name: ' New Project ',
      workspaceId: ' workspace-2 ',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0].url, '/api/projects');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      name: 'New Project',
      workspaceId: 'workspace-2',
    });
    assert.equal(project.id, 'project-2');
    assert.equal(project.workspaceId, 'workspace-2');
  });

  test('createWorkspaceProject omits workspaceId when not provided', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          id: 'project-3',
          userId: 'user-1',
          name: 'Default Workspace Project',
          visibility: 'private',
          workspaceId: 'workspace-default',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        }),
        { status: 201 },
      );
    };

    await createWorkspaceProject({
      token: 'token',
      name: ' Default Workspace Project ',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      name: 'Default Workspace Project',
    });
  });

  test('updateWorkspaceProjectVisibility updates project share state', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          id: 'project-1',
          userId: 'user-1',
          name: 'Main Project',
          visibility: 'public',
          workspaceId: 'workspace-1',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:01:00.000Z',
        }),
        { status: 200 },
      );

    const updated = await updateWorkspaceProjectVisibility({
      token: 'token',
      projectId: 'project-1',
      visibility: 'public',
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(updated.visibility, 'public');
  });

  test('openWorkspaceProject opens into existing session', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          projectId: 'project-1',
          sessionId: 'session-1',
          restoredSnapshotId: 'snapshot-1',
        }),
        { status: 200 },
      );
    };

    const result = await openWorkspaceProject({
      token: 'token',
      projectId: 'project-1',
      sessionId: 'session-1',
      snapshotId: 'snapshot-1',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0].url, '/api/projects/project-1/open');
    assert.equal(result.restoredSnapshotId, 'snapshot-1');
  });

  test('associateWorkspaceProjectSession binds selected session without restore', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          id: 'project-1',
          userId: 'user-1',
          name: 'Main Project',
          visibility: 'private',
          workspaceId: 'workspace-1',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        }),
        { status: 200 },
      );
    };

    const result = await associateWorkspaceProjectSession({
      token: 'token',
      projectId: 'project-1',
      sessionId: 'session-1',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0].url, '/api/projects/project-1/sessions/session-1');
    assert.equal(result.id, 'project-1');
  });

  test('loadPublicWorkspaceProjects returns bounded public list', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify([
          {
            id: 'project-public-1',
            name: 'Shared',
            visibility: 'public',
            createdAt: '2026-04-03T00:00:00.000Z',
            updatedAt: '2026-04-03T00:00:00.000Z',
          },
        ]),
        { status: 200 },
      );

    const list = await loadPublicWorkspaceProjects(fetchImpl as typeof fetch);
    assert.equal(list.length, 1);
    assert.equal(list[0].visibility, 'public');
  });

  test('loadPublicWorkspaceProjectDetail returns read-only payload', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          id: 'project-public-1',
          name: 'Shared',
          visibility: 'public',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
          readOnly: true,
        }),
        { status: 200 },
      );

    const detail = await loadPublicWorkspaceProjectDetail({
      projectId: 'project-public-1',
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(detail.readOnly, true);
  });

  test('forkPublicWorkspaceProject creates requester-owned fork', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          id: 'fork-1',
          name: 'Fork of Shared',
          visibility: 'private',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        }),
        { status: 201 },
      );

    const forked = await forkPublicWorkspaceProject({
      token: 'token',
      projectId: 'project-public-1',
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(forked.id, 'fork-1');
    assert.equal(forked.visibility, 'private');
  });
});
