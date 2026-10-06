import { test, expect } from '@playwright/test';

/**
 * The Cold Open is the first thing anyone sees, so its contract is checked
 * rather than assumed:
 *
 *   * it appears before onboarding step 1,
 *   * its CTA is genuinely not yet reachable while the timeline is running,
 *   * a tap fast-forwards to the settled final frame,
 *   * the CTA advances into onboarding step 1,
 *   * and under reduced motion the settled frame is there immediately.
 */

const SHOTS = 'tests/visual/updated';

test.describe('Cold Open', () => {
  test('plays, skips to the settled frame, then advances onboarding', async ({ page }) => {
    await page.goto('/');

    const root = page.locator('#onboard .co');
    await expect(root).toBeVisible();

    const cta = page.locator('.co-cta');
    await expect(cta).toHaveText('Start with the good stuff');
    // While the script plays, the CTA must not be the thing you can press.
    await expect(cta).toHaveCSS('opacity', '0');

    await page.screenshot({ path: `${SHOTS}/cold-open-start-390x844.png` });

    // Tap to skip. Well below the top edge, which is where the prototype
    // banner sits once onboarding is over.
    await root.click({ position: { x: 24, y: 420 } });
    await expect(cta).toHaveCSS('opacity', '1');
    await page.screenshot({ path: `${SHOTS}/cold-open-settled-390x844.png` });

    // The CTA is the only way forward; pressing it enters step 1.
    await cta.click();
    await expect(page.locator('#onboard .co')).toHaveCount(0);
    await expect(page.locator('#onboard')).toContainText('A little trust, first.');
  });

  test('at 360x800 the intro fits without clipping the CTA', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    const root = page.locator('#onboard .co');
    await expect(root).toBeVisible();
    await root.click({ position: { x: 20, y: 400 } });

    const cta = page.locator('.co-cta');
    await expect(cta).toHaveCSS('opacity', '1');

    // The CTA must be inside the viewport on the smaller device.
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(800);

    await page.screenshot({ path: `${SHOTS}/cold-open-settled-360x800.png` });
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('shows the settled final frame immediately, with no timeline to wait for', async ({
      page,
    }) => {
      await page.goto('/');

      const root = page.locator('#onboard .co');
      await expect(root).toBeVisible();
      await expect(root).toHaveClass(/co-static/);

      // No skip needed and no waiting: the CTA is already the live affordance.
      const cta = page.locator('.co-cta');
      await expect(cta).toHaveCSS('opacity', '1');
      // The scaffolding of the moving beats is hidden rather than replayed.
      await expect(page.locator('.co-canvas')).toHaveCSS('opacity', '0');
      await expect(page.locator('.co-skip')).toBeHidden();

      await page.screenshot({ path: `${SHOTS}/cold-open-reduced-motion-390x844.png` });

      await cta.click();
      await expect(page.locator('#onboard')).toContainText('A little trust, first.');
    });
  });

  test('Calm Mode from the product setting also lands on the settled frame', async ({ page }) => {
    // Calm Mode is the app's own switch, persisted next to the rest of state.
    await page.addInitScript(() => {
      window.localStorage.setItem('cultured2:state', JSON.stringify({ set: { calm: true } }));
    });
    await page.goto('/');
    await page.locator('#onboard .co').waitFor();
    // The class may be applied after the settings merge, so settle first.
    await expect(page.locator('html')).toHaveClass(/calm/);
    await page.reload();
    await expect(page.locator('#onboard .co')).toHaveClass(/co-static/);
    await expect(page.locator('.co-cta')).toHaveCSS('opacity', '1');
  });
});
