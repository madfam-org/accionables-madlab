import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { healthRoutes } from './routes/health.js';
import { projectRoutes } from './routes/projects.js';
import { taskRoutes } from './routes/tasks.js';
import { agentRoutes } from './routes/agents.js';
import { waitlistRoutes } from './routes/waitlist.js';
import { phasesRoutes } from './routes/phases.js';
import { userRoutes as usersDomainRoutes } from './routes/users.js';
import { demoProjectRoutes } from './routes/demoProjects.js';
import { closeDatabaseConnection, waitForDatabase } from './config/database.js';
import {
  parseEnv,
  resolveCorsOrigins,
  assertJanuaConfiguredIfProduction,
} from './config/env.js';
import { globalErrorHandler, notFoundHandler } from './config/errorHandler.js';
import { initSentry } from './config/sentry.js';

// ============================================================================
// Configuration — fail fast on bad env / missing prod requirements.
// ============================================================================

let env: ReturnType<typeof parseEnv>;
let corsOrigins: string[];
try {
  env = parseEnv();
  assertJanuaConfiguredIfProduction(env);
  corsOrigins = resolveCorsOrigins(env);
} catch (error) {
  console.error(`❌ ${(error as Error).message}`);
  process.exit(1);
}
const isProduction = env.NODE_ENV === 'production';

// Initialize Sentry BEFORE any Fastify code runs so server-side instrumentation
// is in place when routes start handling traffic. Silently no-ops when
// SENTRY_DSN is unset (local dev). See config/sentry.ts for sample-rate rationale.
initSentry({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });

// ============================================================================
// Fastify bootstrap
// ============================================================================

const fastify = Fastify({
  logger: {
    level: isProduction ? 'info' : 'debug',
    transport: isProduction
      ? undefined
      : {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
  },
  disableRequestLogging: false,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId',
});

// ----- Plugins -----

await fastify.register(helmet, {
  contentSecurityPolicy: isProduction,
});

await fastify.register(cors, {
  origin: corsOrigins,
  credentials: true,
});

// Global rate limit — permissive, catches anomalous automation.
// Per-route tighter limits applied below where needed.
await fastify.register(rateLimit, {
  global: true,
  max: 300,
  timeWindow: '1 minute',
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.ip,
});

// ----- Global error handler — never leak stack traces to clients -----

fastify.setErrorHandler(globalErrorHandler);
fastify.setNotFoundHandler(notFoundHandler);

// ----- Routes -----

fastify.get('/', async () => ({
  service: 'MADLAB API',
  version: '2.0.0',
  environment: env.NODE_ENV,
  timestamp: new Date().toISOString(),
}));

await fastify.register(healthRoutes, { prefix: '/api' });
await fastify.register(projectRoutes, { prefix: '/api' });
await fastify.register(taskRoutes, { prefix: '/api' });
await fastify.register(agentRoutes, { prefix: '/api' });
await fastify.register(waitlistRoutes, { prefix: '/api' });
await fastify.register(phasesRoutes, { prefix: '/api' });
await fastify.register(usersDomainRoutes, { prefix: '/api' });
await fastify.register(demoProjectRoutes, { prefix: '/api' });

// ----- Shutdown -----

const signals = ['SIGINT', 'SIGTERM'] as const;
for (const signal of signals) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server...`);
    await fastify.close();
    await closeDatabaseConnection();
    process.exit(0);
  });
}

// ----- Start -----

// Confirm the DB is reachable BEFORE accepting traffic. K8s cold-starts often
// race the API ahead of Postgres; waitForDatabase retries with bounded
// exponential backoff (~30s budget) before giving up. If we exit here, the
// orchestrator will restart and try again — that's the correct behavior.
try {
  await waitForDatabase({
    onAttempt: ({ attempt, error, nextDelayMs }) => {
      fastify.log.warn(
        { attempt, error, nextDelayMs },
        'Database not ready yet, will retry',
      );
    },
  });
  fastify.log.info('Database connection verified');
} catch (err) {
  fastify.log.error({ err }, 'Database unreachable at startup, aborting');
  process.exit(1);
}

try {
  await fastify.listen({ port: env.PORT, host: env.HOST });
  fastify.log.info(`🚀 MADLAB API server listening on ${env.HOST}:${env.PORT}`);
  fastify.log.info(`📝 Environment: ${env.NODE_ENV}`);
  fastify.log.info(`🔗 Health check: http://localhost:${env.PORT}/api/health`);
  fastify.log.info(`🤖 AI Agents: http://localhost:${env.PORT}/api/agents/status`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
