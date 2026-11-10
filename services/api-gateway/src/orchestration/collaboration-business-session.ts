import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Session } from '../entities/session.entity';
import { SessionStatus } from '../entities/session-status.enum';

/**
 * TEAM-NO-SESSION-02 D1-D4: a user workflow (always the read profile) can start
 * from the Team page without a workspace session. The run still needs a
 * project id and a real `sessions` row (the ledger anchor), so each owner gets
 * one business project and one business session, created on first use and
 * reused after.
 *
 * The business session is stopped, already expired and has no container, so it
 * never counts toward the session quota, is never usable in the workspace and
 * is unknown to container-manager. The business project has no workspace, so
 * the workspace project list leaves it out.
 *
 * Every lookup is by owner: an owner can never reach another owner's rows.
 * Nothing here is called by a read route except `findForOwner`, which never
 * creates a row.
 */

export const COLLABORATION_BUSINESS_PROJECT_NAME = 'Business workflows';

/** D2: the only durable marker without a new column. Unique per owner because the user id is. */
export function collaborationBusinessProjectSlug(userId: string): string {
  return `business-${userId}`;
}

/**
 * D7 (DECISION D): caller instructions for a run with no session. Caller text,
 * not part of the rendered workflow spec, so the version hash is unchanged.
 */
export const COLLABORATION_BUSINESS_RUN_NOTE =
  'This run has no project files or workspace. Do not use the file tools.';

export interface CollaborationBusinessAnchor {
  sessionId: string;
  projectId: string;
}

@Injectable()
export class CollaborationBusinessSessionService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
  ) {}

  /** D10: the owner's business project, if one exists. Read only: never creates a row. */
  async findForOwner(userId: string): Promise<{ projectId: string } | null> {
    const project = await this.findProject(userId);
    return project ? { projectId: project.id } : null;
  }

  /**
   * D5: the business session and project for a session-less workflow start.
   * Called only after every workflow refusal has run.
   */
  async ensureForOwner(userId: string): Promise<CollaborationBusinessAnchor> {
    const project = (await this.findProject(userId)) ?? (await this.createProject(userId));
    const now = new Date();
    let session = await this.findSession(userId, project.id);
    if (session) {
      await this.sessions.update({ id: session.id, userId }, { lastActivityAt: now });
    } else {
      session = await this.createSession(userId, project.id, now);
    }
    return { sessionId: session.id, projectId: project.id };
  }

  private async findProject(userId: string): Promise<Project | null> {
    // workspaceId null: a project the owner created through the projects routes
    // always has a workspace, so a look-alike slug never becomes the business project.
    return this.projects.findOne({
      where: {
        userId,
        slug: collaborationBusinessProjectSlug(userId),
        workspaceId: IsNull(),
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  private async createProject(userId: string): Promise<Project> {
    await this.projects.save(
      this.projects.create({
        userId,
        name: COLLABORATION_BUSINESS_PROJECT_NAME,
        slug: collaborationBusinessProjectSlug(userId),
        visibility: 'private',
        workspaceId: null,
      }),
    );
    // Two first starts at once may both insert; the oldest row wins for both.
    const project = await this.findProject(userId);
    if (!project) {
      throw new Error('Business project was not created');
    }
    return project;
  }

  private async findSession(userId: string, projectId: string): Promise<Session | null> {
    // Stopped with no container: a workspace session opened on this project later
    // (which gets a container) is never used as the business session.
    return this.sessions.findOne({
      where: {
        userId,
        projectId,
        status: SessionStatus.STOPPED,
        containerId: IsNull(),
        terminatedAt: IsNull(),
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  private async createSession(userId: string, projectId: string, now: Date): Promise<Session> {
    await this.sessions.save(
      this.sessions.create({
        userId,
        projectId,
        containerId: null,
        status: SessionStatus.STOPPED,
        createdAt: now,
        expiresAt: now,
        lastActivityAt: now,
        terminatedAt: null,
        terminationReason: null,
      }),
    );
    const session = await this.findSession(userId, projectId);
    if (!session) {
      throw new Error('Business session was not created');
    }
    return session;
  }
}
