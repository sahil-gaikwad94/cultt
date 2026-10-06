import { test, expect } from '@playwright/test';

/**
 * Current-state captures of the main screens at both shipping viewports.
 *
 * These are the "look at the screenshots" part of the work loop: every build
 * step refreshes `tests/visual/updated/` and the diff against `baseline/` is
 * reviewed before committing. Any unexpected pixel change in an existing
 * screen is a bug (brief §3).
 */

const SHOTS = 'tests/visual/updated';

const startOnboarded = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cultured2:state', JSON.stringify({ onboarded: true }));
  });
};

test.describe('screens', () => {
  test('home feed and arena at both viewports', async ({ page }) => {
    await startOnboarded(page);
    await page.goto('/');
    await expect(page.locator('#nav')).toBeVisible();

    await expect(page.locator('.mm-n')).toContainText('in-house');
    await page.screenshot({ path: `${SHOTS}/feed-390x844.png` });

    // Arena (renamed from Pulse): honest local-signal card + the games row.
    await page.locator('#nav [data-act="tab"][data-t="arena"]').click();
    await expect(page.locator('#s-arena')).toHaveClass(/on/);
    await expect(page.locator('#s-arena .wordmark')).toContainText('Arena');
    await expect(page.locator('.field-card')).toContainText('would rather show you nothing');
    await expect(page.locator('.nhi-card')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/arena-390x844.png` });

    await page.setViewportSize({ width: 360, height: 800 });
    await page.locator('#nav [data-act="tab"][data-t="feed"]').click();
    await expect(page.locator('.mm-n')).toContainText('in-house');
    await page.screenshot({ path: `${SHOTS}/feed-360x800.png` });

    await page.locator('#nav [data-act="tab"][data-t="arena"]').click();
    await expect(page.locator('#s-arena')).toHaveClass(/on/);
    await page.screenshot({ path: `${SHOTS}/arena-360x800.png` });
  });
});
