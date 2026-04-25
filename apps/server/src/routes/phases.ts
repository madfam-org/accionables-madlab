import { FastifyInstance } from 'fastify';
import { verifyJWT } from '../middleware/auth.js';
import { DEFAULT_PROJECT_PHASES } from '../data/phases.js';

/**
 * Phases route — exposes the canonical project phase metadata to the client.
 *
 * Auth posture: authenticated. Phases describe the MADLAB project and are
 * surfaced inside the dashboard, which is gated by `verifyJWT`. The landing
 * page does not need them.
 *
 * Source of truth: `data/phases.ts::DEFAULT_PROJECT_PHASES`. We expose them
 * via API (rather than letting the client import a static module) so:
 *   1. The client bundle doesn't need to ship phase metadata.
 *   2. We can swap to a per-project override (`projects.metadata.phases`)
 *      later without touching the client.
 */
export async function phasesRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/phases
   * Returns the default MADLAB project phases.
   */
  fastify.get('/phases', { preHandler: verifyJWT }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: DEFAULT_PROJECT_PHASES,
    });
  });
}
