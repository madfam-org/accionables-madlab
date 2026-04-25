import { test, expect } from '@playwright/test';

/**
 * Homepage / dashboard smoke tests.
 *
 * Wave 4 (#15) split the SPA into a marketing landing at `/` and the actual
 * task dashboard at `/app`. Tests that want to assert against the dashboard
 * (header, team summary, etc.) must navigate to `/app` directly. Going to
 * `/` would land us on the LandingPage, which has its own header and no
 * task data.
 *
 * Wave 4 also moved tasks/team-members/phases to API endpoints. The CI seed
 * step is `continue-on-error: true`, so we cannot assume specific task counts
 * or phase names exist. Assertions here are deliberately data-shape-agnostic:
 * we check that the dashboard chrome renders, not that it contains 109 tasks.
 */
test.describe('MADLAB Dashboard (/app)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
  });

  test('@smoke loads the dashboard successfully', async ({ page }) => {
    // The dashboard always renders an h1 inside <Header /> with the
    // localized hero title. We don't assert exact text because the language
    // toggle could flip at any time during a test run.
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    // The hero title is a translation containing "MADLAB" in both ES and EN.
    await expect(heading).toContainText(/MADLAB/i);
  });

  test('@smoke has proper page title', async ({ page }) => {
    await expect(page).toHaveTitle(/MADLAB/i);
  });

  test('renders the team summary section', async ({ page }) => {
    // TeamSummary is rendered unconditionally inside the dashboard's
    // list/grid view. Its h2 holds the localized "Team Summary" string.
    // We wait for the loading overlay to clear first so the main content
    // is mounted.
    await page
      .getByRole('heading', { name: /Resumen del Equipo|Team Summary/i, level: 2 })
      .waitFor({ state: 'visible', timeout: 15000 });
  });

  test('is responsive across viewports', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(heading).toBeVisible();

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(heading).toBeVisible();

    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(heading).toBeVisible();
  });
});

test.describe('Marketing Landing (/)', () => {
  test('@smoke landing page renders for unauthenticated visitors', async ({ page }) => {
    await page.goto('/');
    // LandingPage hero: "Project management that gets your brain"
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /Project management/i,
    );
  });
});
