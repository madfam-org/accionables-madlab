import { FastifyInstance } from 'fastify';
import { eq, count } from 'drizzle-orm';
import { db } from '../config/database.js';
import { projects, tasks, projectMembers, users } from '../db/schema.js';
import { verifyJWT } from '../middleware/auth.js';
import { upsertLocalUser } from '../services/users.js';
import {
  idParamSchema,
  createProjectSchema,
  validateRequest,
} from '../schemas/validation.js';

export async function projectRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/projects
   * Get all projects with member counts and task statistics
   */
  fastify.get('/projects', { preHandler: verifyJWT }, async (_request, reply) => {
    try {
      const allProjects = await db.select().from(projects);

      const projectsWithStats = await Promise.all(
        allProjects.map(async (project) => {
          const taskCount = await db
            .select({ count: count() })
            .from(tasks)
            .where(eq(tasks.projectId, project.id));

          const memberCount = await db
            .select({ count: count() })
            .from(projectMembers)
            .where(eq(projectMembers.projectId, project.id));

          const tasksByStatus = await db
            .select({
              status: tasks.status,
              count: count(),
            })
            .from(tasks)
            .where(eq(tasks.projectId, project.id))
            .groupBy(tasks.status);

          return {
            ...project,
            stats: {
              totalTasks: taskCount[0]?.count || 0,
              memberCount: memberCount[0]?.count || 0,
              tasksByStatus: tasksByStatus.reduce(
                (acc, { status, count }) => {
                  acc[status] = count;
                  return acc;
                },
                {} as Record<string, number>,
              ),
            },
          };
        }),
      );

      return reply.send({
        success: true,
        data: projectsWithStats,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch projects',
      });
    }
  });

  /**
   * GET /api/projects/:id
   */
  fastify.get('/projects/:id', { preHandler: verifyJWT }, async (request, reply) => {
    const params = validateRequest(idParamSchema, request.params);
    if (!params.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: params.errors,
      });
    }

    try {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, params.data.id))
        .limit(1);

      if (!project.length) {
        return reply.code(404).send({
          success: false,
          error: 'Project not found',
        });
      }

      const members = await db
        .select({
          id: projectMembers.id,
          role: projectMembers.role,
          joinedAt: projectMembers.joinedAt,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(projectMembers)
        .leftJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, params.data.id));

      const taskCount = await db
        .select({ count: count() })
        .from(tasks)
        .where(eq(tasks.projectId, params.data.id));

      return reply.send({
        success: true,
        data: {
          ...project[0],
          members,
          taskCount: taskCount[0]?.count || 0,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch project',
      });
    }
  });

  /**
   * POST /api/projects
   * createdBy is derived from the authenticated user via a Janua→local-user
   * upsert. The client cannot supply it.
   */
  fastify.post('/projects', { preHandler: verifyJWT }, async (request, reply) => {
    const body = validateRequest(createProjectSchema, request.body);
    if (!body.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: body.errors,
      });
    }
    const input = body.data;

    let createdBy: string;
    try {
      createdBy = await upsertLocalUser(request.user!);
    } catch (error) {
      fastify.log.error(error, 'Failed to upsert local user for project creation');
      return reply.code(500).send({
        success: false,
        error: 'Failed to resolve authenticated user',
      });
    }

    try {
      const newProject = await db
        .insert(projects)
        .values({
          name: input.name,
          nameEn: input.nameEn,
          description: input.description,
          descriptionEn: input.descriptionEn,
          status: input.status,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          createdBy,
          metadata: input.metadata,
        })
        .returning();

      return reply.code(201).send({
        success: true,
        data: newProject[0],
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create project',
      });
    }
  });
}
