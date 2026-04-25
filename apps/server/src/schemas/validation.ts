/**
 * Re-export of the shared API contract.
 *
 * The schemas, validation helper, and inferred types live in
 * `@madlab/shared` so the client uses the same source of truth — no more
 * hand-maintained types drifting from the server.
 *
 * Existing route imports `from '../schemas/validation.js'` keep working;
 * new code can import directly from `@madlab/shared`.
 */
export * from '@madlab/shared';
