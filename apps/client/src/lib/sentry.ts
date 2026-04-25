import * as Sentry from '@sentry/react';

/**
 * Sentry initialization for the React client.
 *
 * Init is gated on a DSN being present. With no DSN we silently no-op so
 * `npm run dev` works without Sentry credentials and we don't ship browser
 * traffic to a misconfigured project. captureException calls become no-ops
 * automatically when init was skipped.
 *
 * Sample rate is fixed at 0.1 — enough signal for stability without burning
 * the team's quota on every page load. Tune via SDK config in production
 * only after confirming budget headroom.
 */
export interface SentryClientInitOptions {
  dsn: string | undefined;
  environment: string;
}

export function initSentry({ dsn, environment }: SentryClientInitOptions): boolean {
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0.1,
    // Default to no PII. Browser SDK will otherwise attach IP / cookies; we
    // explicitly opt out so users' identifiers don't leak into the issue
    // tracker without an explicit policy decision.
    sendDefaultPii: false,
  });
  return true;
}
