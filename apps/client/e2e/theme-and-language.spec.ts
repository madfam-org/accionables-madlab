import { test, expect } from '@playwright/test';

/**
 * Theme + language toggle spec.
 *
 * These exercise UI-only state (Zustand + DOM class toggles), so they don't
 * depend on any API data. We still navigate to /app instead of / because
 * the marketing LandingPage has its own theme button with different
 * semantics.
 */
test.describe('Theme and Language Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    // Wait for the dashboard header to mount before we start clicking
    // theme/language buttons.
    await page
      .getByRole('heading', { level: 1 })
      .waitFor({ state: 'visible', timeout: 15000 });
  });

  test('@smoke switches between themes', async ({ page }) => {
    // The Header renders three theme buttons with aria-labels matching the
    // localized theme names (Auto / Light/Claro / Dark/Oscuro).
    const lightButton = page
      .getByRole('button', { name: /^(light|claro)$/i })
      .first();
    const darkButton = page
      .getByRole('button', { name: /^(dark|oscuro)$/i })
      .first();

    await lightButton.click();
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);

    await darkButton.click();
    await expect(html).toHaveClass(/dark/);
  });

  test('switches language between Spanish and English', async ({ page }) => {
    // The language button shows "ES" or "EN" depending on current language.
    // Its accessible name is "Switch language. Current: ES|EN" so we match
    // on the prefix.
    const languageButton = page.getByRole('button', {
      name: /switch language/i,
    });
    await expect(languageButton).toBeVisible();

    // Capture the current label, click, and assert it flipped.
    const before = await languageButton.textContent();
    await languageButton.click();
    const after = await languageButton.textContent();
    expect(before).not.toEqual(after);
    expect(['ES', 'EN']).toContain((after || '').trim());
  });

  test('persists theme selection across page reload', async ({ page }) => {
    const darkButton = page
      .getByRole('button', { name: /^(dark|oscuro)$/i })
      .first();
    await darkButton.click();

    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    await page.reload();
    // After reload the dashboard re-mounts; wait for the heading then
    // re-check the html class. App.tsx applies the persisted theme in a
    // useEffect on mount.
    await page
      .getByRole('heading', { level: 1 })
      .waitFor({ state: 'visible', timeout: 15000 });
    await expect(html).toHaveClass(/dark/);
  });
});
