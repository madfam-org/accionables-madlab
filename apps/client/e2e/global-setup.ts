/**
 * Playwright Global Setup — Auth Seeding
 *
 * After Wave 0–2, every CRUD route on the API server is gated by `verifyJWT`.
 * The Playwright suite makes API calls indirectly via the React app's axios
 * client (`apps/client/src/api/client.ts`), which reads
 * `localStorage.auth_token` and attaches it as `Authorization: Bearer <token>`.
 *
 * Without a token in storage, every request returns 401 and the suite hangs
 * waiting for data that never arrives. To unblock E2E without standing up a
 * full Janua test fixture, this setup seeds localStorage with the dev-mock
 * token (`dev-token-mock-user`) that the server's `verifyJWT` middleware
 * accepts ONLY when `NODE_ENV === 'development'` (see
 * `apps/server/src/middleware/auth.ts`). The Playwright `webServer` config is
 * responsible for ensuring the API runs in development mode.
 *
 * The resulting browser storage state is written to a JSON file referenced by
 * `use.storageState` in `playwright.config.ts`, so every test run starts with
 * an authenticated browser context.
 *
 * Reference: https://playwright.dev/docs/auth#authenticate-with-a-setup-project
 */

import { chromium, type FullConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve __dirname in an ESM-safe way (apps/client is `"type": "module"`).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const STORAGE_STATE_PATH = path.resolve(
  __dirname,
  '.auth/storage-state.json',
);

// Must match `DEV_MOCK_TOKEN` in apps/server/src/middleware/auth.ts.
const DEV_MOCK_TOKEN = 'dev-token-mock-user';
// Must match `AUTH_TOKEN_KEY` in apps/client/src/api/client.ts.
const AUTH_TOKEN_KEY = 'auth_token';

async function globalSetup(config: FullConfig): Promise<void> {
  // Resolve the baseURL the same way tests do, falling back to localhost:5173
  // (matches `use.baseURL` in playwright.config.ts).
  const baseURL =
    config.projects[0]?.use?.baseURL ?? 'http://localhost:5173';

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the app so we have an origin in which to set localStorage.
    // We don't need the app to fully render — just to be on the right origin
    // so that `localStorage.setItem` writes to the correct storage partition.
    await page.goto(baseURL);

    await page.evaluate(
      ([key, token]) => {
        window.localStorage.setItem(key, token);
      },
      [AUTH_TOKEN_KEY, DEV_MOCK_TOKEN] as const,
    );

    await context.storageState({ path: STORAGE_STATE_PATH });
  } finally {
    await browser.close();
  }
}

export default globalSetup;
