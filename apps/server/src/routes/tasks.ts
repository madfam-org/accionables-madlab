import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/database.js';
import { tasks, users, projects } from '../db/schema.js';
import { verifyJWT } from '../middleware/auth.js';
import {
  idParamSchema,
  taskQuerySchema,
  createTaskSchema,
  updateTaskSchema,
  bulkUpdateTasksSchema,
  validateRequest,
} from '../schemas/validation.js';

export async function taskRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/tasks
   * Get tasks with optional filtering + pagination
   */
  fastify.get('/tasks', { preHandler: verifyJWT }, async (request, reply) => {
    const query = validateRequest(taskQuerySchema, request.query);
    if (!query.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: query.errors,
      });
    }
    const { projectId, assigneeId, status, phase, difficulty, limit, offset } = query.data;

    const conditions = [];
    if (projectId) conditions.push(eq(tasks.projectId, projectId));
    if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId));
    if (status) conditions.push(eq(tasks.status, status));
    if (phase !== undefined) conditions.push(eq(tasks.phase, phase));
    if (difficulty) conditions.push(eq(tasks.difficulty, difficulty));

    try {
      const allTasks = await db
        .select({
          task: tasks,
          assignee: {
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assigneeId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(limit)
        .offset(offset);

      const transformedTasks = allTasks.map(({ task, assignee }) => ({
        ...task,
        assignee: assignee?.name || 'Unassigned',
        assigneeDetails: assignee,
      }));

      return reply.send({
        success: true,
        data: transformedTasks,
        count: transformedTasks.length,
        limit,
        offset,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tasks',
      });
    }
  });

  /**
   * GET /api/tasks/:id
   */
  fastify.get('/tasks/:id', { preHandler: verifyJWT }, async (request, reply) => {
    const params = validateRequest(idParamSchema, request.params);
    if (!params.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: params.errors,
      });
    }

    try {
      const result = await db
        .select({
          task: tasks,
          assignee: {
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatarUrl,
          },
          project: {
            id: projects.id,
            name: projects.name,
            nameEn: projects.nameEn,
          },
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assigneeId, users.id))
        .leftJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(tasks.id, params.data.id))
        .limit(1);

      if (!result.length) {
        return reply.code(404).send({
          success: false,
          error: 'Task not found',
        });
      }

      const { task, assignee, project } = result[0];

      return reply.send({
        success: true,
        data: {
          ...task,
          assignee: assignee?.name || 'Unassigned',
          assigneeDetails: assignee,
          project,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch task',
      });
    }
  });

  /**
   * POST /api/tasks
   */
  fastify.post('/tasks', { preHandler: verifyJWT }, async (request, reply) => {
    const body = validateRequest(createTaskSchema, request.body);
    if (!body.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: body.errors,
      });
    }
    const input = body.data;

    try {
      const newTask = await db
        .insert(tasks)
        .values({
          projectId: input.projectId,
          title: input.title,
          titleEn: input.titleEn,
          description: input.description,
          descriptionEn: input.descriptionEn,
          assigneeId: input.assigneeId,
          status: input.status,
          estimatedHours: input.estimatedHours,
          difficulty: input.difficulty,
          phase: input.phase,
          section: input.section,
          sectionEn: input.sectionEn,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          dependencies: input.dependencies,
          metadata: input.metadata,
        })
        .returning();

      return reply.code(201).send({
        success: true,
        data: newTask[0],
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create task',
      });
    }
  });

  /**
   * PATCH /api/tasks/bulk
   * Registered BEFORE /tasks/:id so Fastify doesn't match "bulk" as an :id.
   */
  fastify.patch('/tasks/bulk', { preHandler: verifyJWT }, async (request, reply) => {
    const body = validateRequest(bulkUpdateTasksSchema, request.body);
    if (!body.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: body.errors,
      });
    }
    const { updates } = body.data;

    try {
      const results = await Promise.all(
        updates.map(async (update) => {
          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          if (update.status) updateData.status = update.status;
          if (update.progress !== undefined) updateData.progress = update.progress;
          if (update.phase !== undefined) updateData.phase = update.phase;
          if (update.startDate) updateData.startDate = new Date(update.startDate);
          if (update.endDate) updateData.endDate = new Date(update.endDate);
          return db.update(tasks).set(updateData).where(eq(tasks.id, update.id)).returning();
        }),
      );

      return reply.send({
        success: true,
        data: results.flat(),
        count: results.length,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to bulk update tasks',
      });
    }
  });

  /**
   * PATCH /api/tasks/:id
   */
  fastify.patch('/tasks/:id', { preHandler: verifyJWT }, async (request, reply) => {
    const params = validateRequest(idParamSchema, request.params);
    if (!params.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: params.errors,
      });
    }
    const body = validateRequest(updateTaskSchema, request.body);
    if (!body.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: body.errors,
      });
    }
    const input = body.data;

    try {
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (input.title !== undefined) updates.title = input.title;
      if (input.titleEn !== undefined) updates.titleEn = input.titleEn;
      if (input.description !== undefined) updates.description = input.description;
      if (input.descriptionEn !== undefined) updates.descriptionEn = input.descriptionEn;
      if (input.status !== undefined) updates.status = input.status;
      if (input.assigneeId !== undefined) updates.assigneeId = input.assigneeId;
      if (input.estimatedHours !== undefined) updates.estimatedHours = input.estimatedHours;
      if (input.actualHours !== undefined) updates.actualHours = input.actualHours;
      if (input.difficulty !== undefined) updates.difficulty = input.difficulty;
      if (input.phase !== undefined) updates.phase = input.phase;
      if (input.progress !== undefined) updates.progress = input.progress;
      if (input.dependencies !== undefined) updates.dependencies = input.dependencies;
      if (input.metadata !== undefined) updates.metadata = input.metadata;

      if (input.startDate !== undefined) {
        updates.startDate = input.startDate ? new Date(input.startDate) : null;
      }
      if (input.endDate !== undefined) {
        updates.endDate = input.endDate ? new Date(input.endDate) : null;
      }
      if (input.completedAt !== undefined) {
        updates.completedAt = input.completedAt ? new Date(input.completedAt) : null;
      }

      if (input.status === 'completed' && updates.completedAt === undefined) {
        updates.completedAt = new Date();
        updates.progress = 100;
      }

      const updatedTask = await db
        .update(tasks)
        .set(updates)
        .where(eq(tasks.id, params.data.id))
        .returning();

      if (!updatedTask.length) {
        return reply.code(404).send({
          success: false,
          error: 'Task not found',
        });
      }

      return reply.send({
        success: true,
        data: updatedTask[0],
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to update task',
      });
    }
  });

  /**
   * DELETE /api/tasks/:id
   */
  fastify.delete('/tasks/:id', { preHandler: verifyJWT }, async (request, reply) => {
    const params = validateRequest(idParamSchema, request.params);
    if (!params.success) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: params.errors,
      });
    }

    try {
      const deleted = await db.delete(tasks).where(eq(tasks.id, params.data.id)).returning();

      if (!deleted.length) {
        return reply.code(404).send({
          success: false,
          error: 'Task not found',
        });
      }

      return reply.send({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to delete task',
      });
    }
  });
}
