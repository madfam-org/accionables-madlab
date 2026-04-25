import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// Mock @sentry/node BEFORE importing the SUT so the import inside
// errorHandler.ts resolves to our spy. vitest hoists vi.mock to the top of
// the file regardless of declaration position.
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
}));

import * as Sentry from '@sentry/node';
import { globalErrorHandler, notFoundHandler } from './errorHandler.js';

const captureExceptionSpy = vi.mocked(Sentry.captureException);

describe('globalErrorHandler', () => {
  beforeEach(() => {
    captureExceptionSpy.mockClear();
  });

  it('echoes 4xx error messages', async () => {
    const app = Fastify({ logger: false });
    app.setErrorHandler(globalErrorHandler);
    app.get('/bad', async () => {
      const err = new Error('you did it wrong') as any;
      err.statusCode = 400;
      throw err;
    });
    const res = await app.inject({ method: 'GET', url: '/bad' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.message).toBe('you did it wrong');
    expect(JSON.stringify(body)).not.toMatch(/at Object/);
    await app.close();
  });

  it('returns a generic 500 for uncaught exceptions — does not leak the message or stack', async () => {
    const app = Fastify({ logger: false });
    app.setErrorHandler(globalErrorHandler);
    app.get('/boom', async () => {
      throw new Error('SELECT * FROM users WHERE secret=123 -- internal detail');
    });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error).toBe('Internal Server Error');
    expect(body.message).toBe('An unexpected error occurred');
    // Regression guard: the original error message must NOT appear in the response.
    expect(JSON.stringify(body)).not.toMatch(/SELECT \*/);
    expect(JSON.stringify(body)).not.toMatch(/secret=123/);
    await app.close();
  });

  it('forwards 5xx errors to Sentry with request context', async () => {
    const app = Fastify({ logger: false });
    app.setErrorHandler(globalErrorHandler);
    const boom = new Error('database exploded');
    app.get('/boom', async () => {
      throw boom;
    });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);

    expect(captureExceptionSpy).toHaveBeenCalledTimes(1);
    const [capturedErr, rawOpts] = captureExceptionSpy.mock.calls[0]!;
    // captureContext is a union (Scope | EventHint | ScopeContext); narrowing
    // here for readable assertions on a known shape.
    const opts = rawOpts as {
      contexts: { request: Record<string, unknown> };
      tags: Record<string, string>;
    };
    expect(capturedErr).toBe(boom);
    // Request context attached for triage. We deliberately do NOT include
    // headers or body so PII / tokens never reach Sentry.
    expect(opts).toMatchObject({
      contexts: {
        request: {
          method: 'GET',
          url: '/boom',
        },
      },
      tags: { statusCode: '500' },
    });
    expect(opts.contexts.request).toHaveProperty('reqId');
    // Negative assertions: confirm no PII channels leak through.
    expect(opts.contexts.request).not.toHaveProperty('headers');
    expect(opts.contexts.request).not.toHaveProperty('body');
    await app.close();
  });

  it('does NOT forward 4xx errors to Sentry — caller-actionable noise stays out of Sentry', async () => {
    const app = Fastify({ logger: false });
    app.setErrorHandler(globalErrorHandler);
    app.get('/bad', async () => {
      const err = new Error('you did it wrong') as any;
      err.statusCode = 400;
      throw err;
    });
    const res = await app.inject({ method: 'GET', url: '/bad' });
    expect(res.statusCode).toBe(400);
    expect(captureExceptionSpy).not.toHaveBeenCalled();
  });

  it('does NOT forward 404 (handled here as 4xx) to Sentry', async () => {
    const app = Fastify({ logger: false });
    app.setErrorHandler(globalErrorHandler);
    app.get('/teapot', async () => {
      const err = new Error('nope') as any;
      err.statusCode = 404;
      throw err;
    });
    const res = await app.inject({ method: 'GET', url: '/teapot' });
    expect(res.statusCode).toBe(404);
    expect(captureExceptionSpy).not.toHaveBeenCalled();
  });
});

describe('notFoundHandler', () => {
  it('returns a structured 404 with the method and url', async () => {
    const app = Fastify({ logger: false });
    app.setNotFoundHandler(notFoundHandler);
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/GET \/nope/);
  });
});
