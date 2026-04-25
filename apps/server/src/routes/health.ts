import { FastifyInstance } from 'fastify';
import { pingDatabase } from '../config/database.js';

/**
 * Health and readiness probes.
 *
 * Design notes:
 * - /api/health does a real `SELECT 1` with a tight 500ms timeout. The handler
 *   never retries — if the pool is sick we want that surfaced fast so load
 *   balancers can drain the instance.
 * - /api/health/ready mirrors /api/health for K8s readiness semantics.
 * - /api/health/live is a pure process-alive probe — it deliberately does NOT
 *   touch the DB so a transient DB blip never restarts the pod.
 */
export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/health
   * Health check endpoint for monitoring and load balancers.
   * 200 → process up AND database reachable.
   * 503 → degraded (database unreachable / slow).
   */
  fastify.get('/health', async (_request, reply) => {
    const probe = await pingDatabase(500);

    if (probe.ok) {
      return reply.code(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV ?? 'development',
        checks: { database: 'ok' },
      });
    }

    return reply.code(503).send({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
      checks: { database: 'fail', error: probe.error ?? 'unknown' },
    });
  });

  /**
   * GET /api/health/ready
   * Readiness probe for Kubernetes/container orchestration.
   * 200 only when DB is reachable — otherwise the pod should be removed
   * from the service endpoints.
   */
  fastify.get('/health/ready', async (_request, reply) => {
    const probe = await pingDatabase(500);
    if (probe.ok) {
      return reply.code(200).send({ ready: true });
    }
    return reply
      .code(503)
      .send({ ready: false, reason: 'database_unavailable', error: probe.error });
  });

  /**
   * GET /api/health/live
   * Liveness probe — pure process check. Never touches the DB.
   */
  fastify.get('/health/live', async (_request, reply) => {
    return reply.code(200).send({ alive: true });
  });
}
