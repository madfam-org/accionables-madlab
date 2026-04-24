import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { globalErrorHandler, notFoundHandler } from './errorHandler.js';

describe('globalErrorHandler', () => {
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
