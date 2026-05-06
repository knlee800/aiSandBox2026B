import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { ProjectsController } from './projects.controller';
import { PublicProjectsController } from './public-projects.controller';
import { ProjectsService } from './projects.service';

class HeaderJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers?.authorization;
    if (!authHeader) {
      return false;
    }
    req.user = { userId: 'user-1' };
    return true;
  }
}

describe('Projects routing collision guardrail (PROJ-01-02)', () => {
  let app: INestApplication;
  const projectsService = {
    getProjectByIdForUser: jest.fn(),
    listPublicProjects: jest.fn(),
    getPublicProjectById: jest.fn(),
  };

  beforeAll(async () => {
    const moduleBuilder: TestingModuleBuilder = Test.createTestingModule({
      controllers: [ProjectsController, PublicProjectsController],
      providers: [
        { provide: ProjectsService, useValue: projectsService },
      ],
    });

    moduleBuilder.overrideGuard(SessionCookieGuard).useClass(HeaderJwtGuard);
    const moduleRef = await moduleBuilder.compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes GET /projects/public to public list endpoint without auth interception', async () => {
    projectsService.listPublicProjects.mockResolvedValue([
      {
        id: '5f17f2a1-65fd-4d6f-9f15-eef1cd0dd88d',
        name: 'Public Project',
        visibility: 'public',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    const unauthResponse = await request(app.getHttpServer()).get('/projects/public');
    const authResponse = await request(app.getHttpServer())
      .get('/projects/public')
      .set('Authorization', 'Bearer any-token');

    expect(unauthResponse.status).toBe(200);
    expect(authResponse.status).toBe(200);
    expect(projectsService.listPublicProjects).toHaveBeenCalledTimes(2);
  });

  it('preserves authenticated GET /projects/:id behavior', async () => {
    const projectId = '5f17f2a1-65fd-4d6f-9f15-eef1cd0dd88d';
    projectsService.getProjectByIdForUser.mockResolvedValue({
      id: projectId,
      userId: 'user-1',
      name: 'Owned Project',
    });

    const unauthResponse = await request(app.getHttpServer()).get(
      `/projects/${projectId}`,
    );
    const authResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('Authorization', 'Bearer any-token');

    expect(unauthResponse.status).toBe(403);
    expect(authResponse.status).toBe(200);
    expect(projectsService.getProjectByIdForUser).toHaveBeenCalledWith(
      'user-1',
      projectId,
    );
  });

  it('preserves unauthenticated public detail behavior', async () => {
    const projectId = '5f17f2a1-65fd-4d6f-9f15-eef1cd0dd88d';
    projectsService.getPublicProjectById.mockResolvedValue({
      id: projectId,
      name: 'Public Detail Project',
      visibility: 'public',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const response = await request(app.getHttpServer()).get(
      `/projects/public/${projectId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.readOnly).toBe(true);
    expect(projectsService.getPublicProjectById).toHaveBeenCalledWith(projectId);
  });
});
