import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Global error handler. Logs the full error server-side with request context,
 * but returns a generic 500 body for server errors — never leak stack traces,
 * SQL, or arbitrary exception messages to clients.
 *
 * 4xx errors (including Fastify validation errors, which arrive here with
 * statusCode set) echo the message back, since those are caller-actionable.
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
