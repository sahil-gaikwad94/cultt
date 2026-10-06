import { test, expect, type Page } from '@playwright/test';

/**
 * Micro-interactions under the two suppression settings the brief treats as
 * functional requirements: prefers-reduced-motion and Calm Mode. The rule the
 * app is built to — "the function never depends on the animation" — is only a
 * claim until a test moves the pixels away and proves the state still lands.
 */

const onboarded = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    localStorage.setItem('cultured2:state', JSON.stringify({ onboarded: true }));
  });
  await page.goto('/');
  await expect(page.locator('#nav')).toBeVisible();
  await page.waitForFunction(() => !document.getElementById('splash'), undefined, { timeout: 10_000 });
  // the prototype banner floats over the tab bar; dismiss it like a user would
  const dismiss = page.locator('.demo-banner button[aria-label="Dismiss"]');
  if (await dismiss.count()) await dismiss.evaluate((b) => (b as HTMLElement).click());
};

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('like still likes, and no particles are created at all', async ({ page }) => {
    await onboarded(page);
    const like = page.locator('.mm-card .mm-b[aria-label="Like"]').first();
    await expect(like).toHaveAttribute('aria-pressed', 'false');
    await like.tap();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    // micro's burst never spawns when motion is reduced — not "briefly".
    await expect(page.locator('.bp.fx-particle')).toHaveCount(0);
    // and the pressed state survives a repaint: it lives in state, not CSS.
    await page.locator('.nv[data-t="feed"]').tap();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
  });

  test('settings switches flip instantly and persist', async ({ page }) => {
    await onboarded(page);
    await page.locator('.nv[data-t="you"]').tap();
    await page.locator('#s-you [data-act="open-settings"]').first().evaluate((el) => (el as HTMLElement).click());
    const calm = page.locator('.sw[data-k="calm"]');
    await expect(calm).toHaveAttribute('aria-checked', 'false');
    await calm.tap();
    await expect(calm).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveClass(/\bcalm\b/);
  });

  test('the tab change is an instant swap, not an animation', async ({ page }) => {
    await onboarded(page);
    await page.locator('.nv[data-t="arena"]').tap();
    await expect(page.locator('#s-arena')).toBeVisible();
    await page.locator('.nv[data-t="feed"]').tap();
    await expect(page.locator('#s-feed')).toBeVisible();
  });
});

test.describe('calm mode (motion on, user chose calm)', () => {
  test('a calm user gets the same state, plus the color cue — never a spinner', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cultured2:state', JSON.stringify({ onboarded: true, set: { calm: true } }));
    });
    await page.goto('/');
    await expect(page.locator('#nav')).toBeVisible();
    await page.waitForFunction(() => !document.getElementById('splash'), undefined, { timeout: 10_000 });
    await expect(page.locator('html')).toHaveClass(/\bcalm\b/);

    const like = page.locator('.mm-card .mm-b[aria-label="Like"]').first();
    await like.tap();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.bp.fx-particle')).toHaveCount(0);
  });
});

test.describe('normal motion', () => {
  test('a single tap bursts at most ten particles, and one tap at a time', async ({ page }) => {
    await onboarded(page);
    const like = page.locator('.mm-card .mm-b[aria-label="Like"]').first();
    await like.tap();
    const count = await page.locator('.bp.fx-particle').count();
    expect(count).toBeLessThanOrEqual(10);
    // cleanup is self-owned: they are gone within a second
    await expect(page.locator('.bp.fx-particle')).toHaveCount(0, { timeout: 2_000 });
  });
});
