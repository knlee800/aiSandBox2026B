import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createWorkspaceProject,
  loadWorkspaceProjects,
  openWorkspaceProject,
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
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        }),
        { status: 201 },
      );
    };

    const project = await createWorkspaceProject({
      token: 'token',
      name: ' New Project ',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0].url, '/api/projects');
    assert.equal(project.id, 'project-2');
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
});
