import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
}));

import * as Sentry from '@sentry/node';
import { initSentry } from './sentry.js';

const initSpy = vi.mocked(Sentry.init);

describe('initSentry', () => {
  beforeEach(() => {
    initSpy.mockClear();
  });

  it('skips init when DSN is undefined — local dev must boot cleanly without DSN', () => {
    const result = initSentry({ dsn: undefined, environment: 'development' });
    expect(result).toBe(false);
    expect(initSpy).not.toHaveBeenCalled();
  });

  it('skips init when DSN is empty string', () => {
    const result = initSentry({ dsn: '', environment: 'development' });
    expect(result).toBe(false);
    expect(initSpy).not.toHaveBeenCalled();
  });

  it('initializes Sentry with the configured options when DSN is present', () => {
    const result = initSentry({
      dsn: 'https://abc@o0.ingest.sentry.io/1',
      environment: 'production',
    });
    expect(result).toBe(true);
    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(initSpy).toHaveBeenCalledWith({
      dsn: 'https://abc@o0.ingest.sentry.io/1',
      environment: 'production',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  });
});
