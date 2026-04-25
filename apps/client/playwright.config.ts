import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Playwright E2E Testing Configuration
 * @see https://playwright.dev/docs/test-configuration
 *
 * Auth note (2026-04-24): All CRUD endpoints on the API server now require a
 * JWT (`verifyJWT` preHandler). The `globalSetup` script below seeds
 * `localStorage.auth_token` with the dev-mock token so the React app's axios
 * client attaches a valid bearer header to every request. The dev-mock token
 * is only honored by the server when `NODE_ENV === 'development'`, so the
 * `webServer` entries below explicitly set that env var.
 */

// `apps/client/package.json` is `"type": "module"`, so __dirname is undefined.
// Reconstruct it from import.meta.url for stable path resolution.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_STATE_PATH = path.resolve(
  __dirname,
  'e2e/.auth/storage-state.json',
);

export default defineConfig({
  testDir: './e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [
    ['html'],
    ['list'],
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],

  /* Seed authenticated localStorage before any tests run.
   * Path-based form works regardless of CJS/ESM loader semantics. */
  globalSetup: path.resolve(__dirname, 'e2e/global-setup.ts'),

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',

    /* Reuse the seeded localStorage in every test context. */
    storageState: STORAGE_STATE_PATH,

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run the API server and the Vite dev server before starting the tests.
   * The API server MUST run with NODE_ENV=development so that
   * `verifyJWT` accepts the dev-mock token seeded by global-setup.ts. */
  webServer: [
    {
      // API server (Fastify) — gates all CRUD routes on JWT.
      // ALWAYS reuse if something's already on the URL. Locally that's the
      // dev's own `npm run dev:server`; in CI it's the background server
      // started by the e2e job (which does the schema push + seed first).
      // If the URL doesn't respond, Playwright falls back to running this
      // command itself.
      command: 'npm run dev:server',
      cwd: path.resolve(__dirname, '../..'),
      url: 'http://localhost:3001/api/health/live',
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      // Vite dev server — proxies /api to the Fastify server.
      // CI does not start Vite separately, so `reuseExistingServer: false`
      // keeps the original behavior of starting it fresh in CI.
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
});
