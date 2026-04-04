import { PublicSessionsController } from './public-sessions.controller';
import { PublicFilesController } from './public-files.controller';
import { PublicProjectsController } from './public-projects.controller';

describe('Public v1 controller service wiring', () => {
  it('routes session create/list through session services', async () => {
    const sessionService = {
      createSession: jest.fn().mockResolvedValue({ id: 's-1', userId: 'user-1' }),
      getSessionsByUser: jest.fn().mockResolvedValue([{ id: 's-1' }]),
    };
    const cmClient = {
      startSession: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new PublicSessionsController(
      sessionService as any,
      cmClient as any,
    );

    const created = await controller.createSession({
      userId: 'user-1',
      apiKeyId: 'key-1',
      scopes: ['ai:execute'],
    } as any);
    expect(created.id).toBe('s-1');
    expect(cmClient.startSession).toHaveBeenCalledWith('s-1', 'user-1');

    const listed = await controller.listSessions(
      { userId: 'user-1', apiKeyId: 'key-1', scopes: ['ai:execute'] } as any,
      'true',
    );
    expect(listed).toHaveLength(1);
    expect(sessionService.getSessionsByUser).toHaveBeenCalledWith('user-1', true);
  });

  it('routes file read/write/list through dedicated public file controller', async () => {
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        id: 's-1',
        userId: 'user-1',
        terminatedAt: null,
      }),
    };
    const cmClient = {
      listSessionDirectory: jest.fn().mockResolvedValue({
        entries: [{ name: 'a.txt', type: 'file', size: 2, modifiedAt: '2026-01-01' }],
      }),
      readSessionFile: jest.fn().mockResolvedValue({ path: '/a.txt', content: 'ok' }),
      writeSessionFile: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new PublicFilesController(
      sessionService as any,
      cmClient as any,
    );

    const listed = await controller.listFiles(
      { userId: 'user-1', apiKeyId: 'key-1', scopes: ['ai:execute'] } as any,
      { sessionId: 's-1', path: '/' },
    );
    expect(listed[0].name).toBe('a.txt');

    const read = await controller.readFile(
      { userId: 'user-1', apiKeyId: 'key-1', scopes: ['ai:execute'] } as any,
      { sessionId: 's-1', path: '/a.txt' },
    );
    expect(read.content).toBe('ok');

    await controller.writeFile(
      { userId: 'user-1', apiKeyId: 'key-1', scopes: ['ai:execute'] } as any,
      { sessionId: 's-1', path: '/a.txt', content: 'new' },
    );
    expect(cmClient.writeSessionFile).toHaveBeenCalledWith('s-1', '/a.txt', 'new');
  });

  it('routes project management through dedicated public project controller', async () => {
    const projectsService = {
      listProjects: jest.fn().mockResolvedValue([{ id: 'p-1', name: 'One' }]),
      createProject: jest.fn().mockResolvedValue({ id: 'p-2', name: 'Two' }),
    };
    const controller = new PublicProjectsController(projectsService as any);

    const projects = await controller.listProjects({
      userId: 'user-1',
      apiKeyId: 'key-1',
      scopes: ['ai:execute'],
    } as any);
    expect(projects).toHaveLength(1);

    const created = await controller.createProject(
      { userId: 'user-1', apiKeyId: 'key-1', scopes: ['ai:execute'] } as any,
      'Two',
    );
    expect(created.id).toBe('p-2');
    expect(projectsService.createProject).toHaveBeenCalledWith('user-1', 'Two');
  });
});
