import { FastifyInstance } from 'fastify';
import { buildDemoProjects } from '../data/demoProjects.js';

/**
 * Demo project templates served to the public landing page.
 *
 * Auth posture: PUBLIC (no `verifyJWT`). The landing page renders before any
 * authentication step, so this endpoint must be reachable without a bearer
 * token. The data is non-sensitive marketing fixtures — no PII, no row IDs
 * that map to real records.
 *
 * Per-request `event.date` recomputation: the original client implementation
 * baked "now + N days" into the SPA bundle at build time, which made the
 * demo dates drift relative to "now" the longer the bundle was cached.
 * Computing on the server per request keeps the dates fresh.
 */
export async function demoProjectRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/demo-projects
   * Returns 6 demo project templates with `event.date` set relative to now.
   */
  fastify.get('/demo-projects', async (_request, reply) => {
    return reply.send({
      success: true,
      data: buildDemoProjects(),
    });
  });
}
