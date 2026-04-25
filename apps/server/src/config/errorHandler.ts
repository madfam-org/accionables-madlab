import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import * as Sentry from '@sentry/node';

/**
 * Global error handler. Logs the full error server-side with request context,
 * but returns a generic 500 body for server errors — never leak stack traces,
 * SQL, or arbitrary exception messages to clients.
 *
 * 4xx errors (including Fastify validation errors, which arrive here with
 * statusCode set) echo the message back, since those are caller-actionable.
 *
 * Sentry capture (added 2026-04-24): only 5xx errors are forwarded to Sentry.
 * 4xx errors are caller errors (validation, auth, not-found) and would just
 * spam our error budget. captureException is a safe no-op when Sentry isn't
 * initialized (local dev with no DSN), so this branch is unconditional.
 */
export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  const statusCode = error.statusCode ?? 500;
  request.log.error({ err: error, reqId: request.id }, 'Unhandled request error');

  if (statusCode >= 400 && statusCode < 500) {
    return reply.code(statusCode).send({
      success: false,
      error: error.name || 'Bad Request',
      message: error.message,
    });
  }

  // 5xx — server-side fault. Forward to Sentry with request context. We pass
  // method/url/reqId only — never headers or body, both of which can carry
  // PII (auth tokens, user input). Operators who need more context can pull
  // it from server logs by reqId.
  Sentry.captureException(error, {
    contexts: {
      request: {
        method: request.method,
        url: request.url,
        reqId: request.id,
      },
    },
    tags: {
      statusCode: String(statusCode),
    },
  });

  return reply.code(500).send({
    success: false,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
}

export function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  return reply.code(404).send({
    success: false,
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
  });
}
