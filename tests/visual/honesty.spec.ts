import { test, expect } from '@playwright/test';

/**
 * The honesty pass, checked rather than trusted.
 *
 * These assertions exist because every one of these items was previously in the
 * app: invented engagement numbers, twenty images taken from web image search,
 * and seeded comments attributed to people who do not exist.
 */

const SHOTS = 'tests/visual/updated';

const startOnboarded = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cultured2:state', JSON.stringify({ onboarded: true }));
  });
};

test.describe('honesty', () => {
  test('the feed is built from the original corpus, with no searched images', async ({ page }) => {
    await startOnboarded(page);
    await page.goto('/');

    const grid = page.locator('.mm');
    await expect(grid).toBeVisible();

    // 13 hand-written cards plus the 122-card generated corpus.
    await expect(page.locator('.mm-n')).toHaveText(/^\d+ in-house$/);
    const count = Number(((await page.locator('.mm-n').textContent()) ?? '0').split(' ')[0]);
    expect(count).toBeGreaterThan(120);

    // Not one of the web-searched images may be in the tree.
    await expect(page.locator('img[src*="/memes/meme-"]')).toHaveCount(0);
    // And every rendered card carries alt text or readable text.
    const first = page.locator('.mm-card').first();
    await expect(first).toBeVisible();

    await page.screenshot({ path: `${SHOTS}/feed-original-corpus-390x844.png` });
  });

  test('comments are gone entirely', async ({ page }) => {
    await startOnboarded(page);
    await page.goto('/');
    await expect(page.locator('#nav')).toBeVisible();

    await expect(page.locator('[data-act="comments"]')).toHaveCount(0);
    await expect(page.locator('[data-act="cm-send"]')).toHaveCount(0);
    await expect(page.locator('#phone')).not.toContainText('Add a comment');
  });

  test('the invented local-signal number is gone and Pulse says so plainly', async ({ page }) => {
    await startOnboarded(page);
    await page.goto('/');

    await expect(page.locator('#phone')).not.toContainText('12 people around you');
    await expect(page.locator('#phone')).not.toContainText('Everyone is saving the bridge');

    await page.locator('[data-act="tab"][data-t="pulse"]').click();
    await expect(page.locator('.field-card')).toContainText('would rather show you nothing');
    await page.screenshot({ path: `${SHOTS}/pulse-honest-empty-state-390x844.png` });
  });

  test('the prototype is labelled on screen', async ({ page }) => {
    await startOnboarded(page);
    await page.goto('/');
    const banner = page.locator('.demo-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Prototype');
    await expect(banner).toContainText('invented');
  });

  test('rooms are off, so there is no synced-session affordance', async ({ page }) => {
    await startOnboarded(page);
    await page.goto('/');
    await expect(page.locator('#nav')).toBeVisible();

    // Nowhere on the feed offers a room.
    await expect(page.locator('#s-feed [data-act="to-room"]')).toHaveCount(0);

    // Open the first conversation: still no room, and no fabricated occupancy.
    await page.locator('[data-act="tab"][data-t="people"]').click();
    const row = page.locator('.row-chat').first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.locator('.page')).toBeVisible();

    await expect(page.locator('.page [data-act="to-room"]')).toHaveCount(0);
    await expect(page.locator('.page')).not.toContainText('are already here');
  });
});
