import { test, expect } from '@playwright/test';

/**
 * Accessibility smoke spec.
 *
 * These tests rely on UI structure (heading hierarchy, ARIA, keyboard nav)
 * rather than seeded data. Per Wave 4, we navigate to /app directly so we
 * are testing the dashboard chrome, not the marketing landing.
 */
test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page
      .getByRole('heading', { level: 1 })
      .waitFor({ state: 'visible', timeout: 15000 });
  });

  test('@smoke has proper heading hierarchy', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    // App.tsx renders exactly one h1 inside <Header />.
    expect(await h1.count()).toBe(1);
  });

  test('all rendered buttons have accessible names', async ({ page }) => {
    const buttons = await page.getByRole('button').all();
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');
      const text = await button.textContent();
      const accessibleName = ariaLabel || title || (text || '').trim();
      expect(accessibleName).toBeTruthy();
    }
  });

  test('initial Tab focuses an interactive element', async ({ page }) => {
    await page.keyboard.press('Tab');
    const firstFocusable = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(
      firstFocusable || '',
    );

    // Tab through a few more elements; each focused element should be a
    // visible interactive element.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        return {
          tag: el.tagName,
          // checkVisibility() is supported in Chromium 105+.
          visible:
            typeof (el as HTMLElement).checkVisibility === 'function'
              ? (el as HTMLElement).checkVisibility()
              : true,
        };
      });
      if (focused) {
        expect(focused.visible).toBe(true);
      }
    }
  });

  test('progress bars expose required ARIA attributes', async ({ page }) => {
    // Progress bars only render when there are tasks. Skip the assertion
    // gracefully if none are present (post-Wave-4 the seed may be empty).
    const progressBars = page.locator('[role="progressbar"]');
    const count = await progressBars.count();
    if (count === 0) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'No progressbars on screen — DB likely empty.',
      });
      return;
    }
    const first = progressBars.first();
    await expect(first).toHaveAttribute('aria-valuenow', /.+/);
    await expect(first).toHaveAttribute('aria-valuemin', /.+/);
    await expect(first).toHaveAttribute('aria-valuemax', /.+/);
  });

  test('body has a non-transparent background color', async ({ page }) => {
    const body = page.locator('body');
    const backgroundColor = await body.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    expect(backgroundColor).toBeTruthy();
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('@smoke html element has a language attribute', async ({ page }) => {
    const html = page.locator('html');
    const lang = await html.getAttribute('lang');
    expect(lang).toBeTruthy();
    // index.html ships with lang="en". The app does not currently mutate
    // this when the language toggle flips, so allow either value.
    expect(['es', 'en', 'es-ES', 'en-US']).toContain(lang || '');
  });

  test('all rendered links have descriptive text or aria-label', async ({ page }) => {
    const links = await page.getByRole('link').all();
    for (const link of links) {
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const hasDescription =
        (text && text.trim().length > 0) ||
        (ariaLabel && ariaLabel.trim().length > 0);
      expect(hasDescription).toBe(true);
    }
  });
});
