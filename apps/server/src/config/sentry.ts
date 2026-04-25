import * as Sentry from '@sentry/node';

/**
 * Sentry initialization for the API server.
 *
 * We init lazily via this helper rather than at module top-level so that:
 *   1. Tests can import Sentry without auto-initing.
 *   2. Local dev silently skips when SENTRY_DSN is unset (no DSN = no init,
 *      no warnings, no broken capture calls — captureException is a no-op
 *      when the SDK isn't initialized).
 *
 * Sample rate is intentionally low (0.1). The team budget assumes ~10%
 * traces are enough for stability/error visibility without burning quota.
 */
export interface SentryInitOptions {
  dsn: string | undefined;
  environment: string;
}

export function initSentry({ dsn, environment }: SentryInitOptions): boolean {
  if (!dsn) {
    // Silent skip — local dev / unconfigured environments must boot cleanly.
    return false;
  }
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0.1,
    // We never want PII flowing to Sentry by default. Operators can opt-in by
    // setting this to true at the SDK level if they need session replay etc.
    sendDefaultPii: false,
  });
  return true;
}
