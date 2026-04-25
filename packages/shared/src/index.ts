/**
 * @madlab/shared — single source of truth for the API contract.
 *
 * Both client and server import from here. Anything that crosses the wire
 * (request bodies, response shapes, query params, enums) lives here.
 *
 * Server uses the Zod schemas to validate incoming requests. Client uses the
 * inferred types for request payloads and the entity types for responses.
 * react-hook-form callers can pass these schemas directly to zodResolver().
 */
export * from './schemas.js';
export * from './entities.js';
export * from './responses.js';
