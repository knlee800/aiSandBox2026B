import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createWorkspace,
  deleteWorkspace,
  loadWorkspace,
  loadWorkspaces,
  updateWorkspace,
} from './workspace-workspaces.logic';

describe('workspace-workspaces.logic', () => {
  test('loadWorkspaces fetches the current user workspace list', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify([
          {
            id: 'workspace-1',
            userId: 'user-1',
            name: 'Personal',
            slug: 'personal',
            isDefault: true,
            createdAt: '2026-04-28T00:00:00.000Z',
            updatedAt: '2026-04-28T00:00:00.000Z',
          },
        ]),
        { status: 200 },
      );
    };

    const workspaces = await loadWorkspaces({
      token: 'token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0]?.url, '/api/workspaces');
    assert.equal(workspaces.length, 1);
    assert.equal(workspaces[0]?.isDefault, true);
  });

  test('loadWorkspace fetches a single workspace by id', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          id: 'workspace-2',
          userId: 'user-1',
          name: 'Client Work',
          slug: 'client-work',
          isDefault: false,
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:00:00.000Z',
        }),
        { status: 200 },
      );
    };

    const workspace = await loadWorkspace({
      token: 'token',
      workspaceId: 'workspace-2',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0]?.url, '/api/workspaces/workspace-2');
    assert.equal(workspace.slug, 'client-work');
  });

  test('createWorkspace posts trimmed workspace name', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          id: 'workspace-3',
          userId: 'user-1',
          name: 'Design',
          slug: 'design',
          isDefault: false,
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:00:00.000Z',
        }),
        { status: 201 },
      );
    };

    const workspace = await createWorkspace({
      token: 'token',
      name: ' Design ',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0]?.url, '/api/workspaces');
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { name: 'Design' });
    assert.equal(workspace.name, 'Design');
  });

  test('updateWorkspace patches trimmed workspace name', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          id: 'workspace-2',
          userId: 'user-1',
          name: 'Renamed Workspace',
          slug: 'renamed-workspace',
          isDefault: false,
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:10:00.000Z',
        }),
        { status: 200 },
      );
    };

    const workspace = await updateWorkspace({
      token: 'token',
      workspaceId: 'workspace-2',
      name: ' Renamed Workspace ',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0]?.url, '/api/workspaces/workspace-2');
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { name: 'Renamed Workspace' });
    assert.equal(workspace.slug, 'renamed-workspace');
  });

  test('deleteWorkspace calls delete endpoint and returns deletion marker', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ deleted: true }), { status: 200 });
    };

    const result = await deleteWorkspace({
      token: 'token',
      workspaceId: 'workspace-2',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0]?.url, '/api/workspaces/workspace-2');
    assert.equal(calls[0]?.init?.method, 'DELETE');
    assert.deepEqual(result, { deleted: true });
  });
});
