import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
}));

import * as Sentry from '@sentry/react';
import { initSentry } from '../sentry';

const initSpy = vi.mocked(Sentry.init);

describe('client initSentry', () => {
  beforeEach(() => {
    initSpy.mockClear();
  });

  it('skips init when DSN is undefined — dev must boot without Sentry creds', () => {
    const result = initSentry({ dsn: undefined, environment: 'development' });
    expect(result).toBe(false);
    expect(initSpy).not.toHaveBeenCalled();
  });

  it('initializes Sentry with the configured options when DSN is present', () => {
    const result = initSentry({
      dsn: 'https://abc@o0.ingest.sentry.io/2',
      environment: 'production',
    });
    expect(result).toBe(true);
    expect(initSpy).toHaveBeenCalledWith({
      dsn: 'https://abc@o0.ingest.sentry.io/2',
      environment: 'production',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  });
});
