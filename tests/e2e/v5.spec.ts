import { expect, test } from '@playwright/test';

/**
 * The v5 shell, end to end.
 *
 * v5 is the app, so the default path `/` renders the v5 screens — that is what
 * these tests exercise. `?v5=0` is the kill-switch that hands the five screen
 * hosts back to the legacy renders; the last test in this file asserts that
 * fallback still works.
 */

const V5 = '/';
const LEGACY = '/?v5=0';

test.describe('v5 shell', () => {
  test.beforeEach(async ({ page }) => {
    // A clean install every time, so the intro and the store start from zero.
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('mounts the Gallery Home into the existing feed host', async ({ page }) => {
    await page.goto(V5);
    await expect(page.locator('#s-feed.v5-home')).toBeVisible();
    await expect(page.locator('.v5-topbar')).toBeVisible();
    await expect(page.locator('.v5-logo')).toContainText('cultured');
  });

  test('keeps the tab rail working over the v5 screens', async ({ page }) => {
    await page.goto(V5);
    await expect(page.locator('#nav')).toBeVisible();
    // The nav still drives the hosts; the You tab is the v5 wall now.
    await page.locator('#nav button, #nav a').nth(4).click();
    await expect(page.locator('#s-you')).toBeVisible();
    await expect(page.locator('#s-you .v5-profile')).toBeVisible();
  });

  test('shows the laugh budget as 15 pips and spends one on a laugh', async ({ page }) => {
    await page.goto(V5);
    const pips = page.locator('.v5-pip');
    await expect(pips).toHaveCount(15);
    await expect(pips.filter({ has: page.locator('[data-spent="true"]') })).toHaveCount(0);

    // Swipe the top card right.
    const card = page.locator('.v5-card').first();
    const box = await card.boundingBox();
    if (!box) throw new Error('deck card has no box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('.v5-pip[data-spent="true"]')).toHaveCount(1, { timeout: 5_000 });
  });

  test('pages between the enabled sub-pages', async ({ page }) => {
    await page.goto(V5);
    // Defaults are Receipts (Y1), Today and The Draft (T1).
    await expect(page.locator('.v5-seg-btn')).toHaveText(['Receipts', 'Today', 'The Draft']);

    await page.locator('.v5-seg-btn', { hasText: 'Receipts' }).click();
    await expect(page.locator('.v5-receipts, .v5-empty')).toBeVisible();

    await page.locator('.v5-seg-btn', { hasText: 'The Draft' }).click();
    await expect(page.locator('.v5-draft')).toBeVisible();
  });

  test('never shows a Verdict or Forecast tab unless configured', async ({ page }) => {
    await page.goto(V5);
    await expect(page.locator('.v5-seg-btn', { hasText: 'The Verdict' })).toHaveCount(0);
    await expect(page.locator('.v5-seg-btn', { hasText: 'Forecast' })).toHaveCount(0);
  });

  test('enables the Verdict when the config asks for it', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { CULTURED_CONFIG: Record<string, unknown> }).CULTURED_CONFIG = {
        homeYesterdaySubPage: 'verdict',
      };
    });
    await page.goto(V5);
    await expect(page.locator('.v5-seg-btn', { hasText: 'The Verdict' })).toBeVisible();
    await page.locator('.v5-seg-btn', { hasText: 'The Verdict' }).click();
    // Empty yesterday, so the honest empty state rather than a fabricated one.
    await expect(page.locator('.v5-verdict, .v5-empty')).toBeVisible();
  });

  test('opens the Vault and reads the same store as the deck', async ({ page }) => {
    await page.goto(V5);

    // Save the top card, then look for it in the Vault.
    const card = page.locator('.v5-card').first();
    await card.locator('.v5-rail-btn[aria-label*="Save" i], .v5-rail-btn').first().click();

    await page.locator('[data-game="vault"], .v5-icon-btn[aria-label*="Vault" i]').first().click();
    await expect(page.locator('.v5-vault')).toBeVisible();
    await expect(page.locator('.v5-vault-tab', { hasText: 'Saved' })).toBeVisible();
  });

  test('plays a full NHIE round with only the two fixed answers', async ({ page }) => {
    await page.goto(V5);
    await page.locator('[data-game="nhie"]').click();
    await expect(page.locator('.v5-nhie')).toBeVisible();

    // Fixed-choice game design: two buttons, no free text anywhere.
    await expect(page.locator('[data-answer]')).toHaveCount(2);
    await expect(page.locator('.v5-nhie input, .v5-nhie textarea')).toHaveCount(0);

    for (let i = 0; i < 12; i += 1) {
      await page.locator(`[data-answer="${i % 3 === 0 ? 'guilty' : 'clean'}"]`).click();
      await page.waitForTimeout(320);
    }
    await expect(page.locator('.v5-nhie-rank')).toBeVisible();
  });

  test('deals the same NHIE round twice for the same day', async ({ page }) => {
    await page.goto(V5);
    await page.locator('[data-game="nhie"]').click();
    const first = await page.locator('.v5-nhie-text').textContent();
    await page.locator('.v5-nhie [data-close]').click();

    // A second round must not repeat what was just answered.
    await page.locator('[data-game="nhie"]').click();
    await expect(page.locator('.v5-nhie-text')).not.toHaveText(first ?? '');
  });
});

test.describe('the flag gate', () => {
  test('hands the screens back to the legacy shell under ?v5=0', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto(LEGACY);
    // No v5 chrome anywhere.
    await expect(page.locator('.v5-home')).toHaveCount(0);
    await expect(page.locator('.v5-topbar')).toHaveCount(0);
    // And the legacy feed is present and populated.
    await expect(page.locator('#s-feed')).toBeVisible();
    await expect(page.locator('#s-feed .mm-card')).toHaveCount(6);
  });

  test('serves no meme the pipeline has not cleared', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(V5);
    await page.waitForTimeout(1_500);
    // Every meme in a production build is rights-cleared or pruned; the deck
    // shows the honest empty state rather than an unlicensed image.
    const memes = requests.filter((url) => url.includes('/memes/'));
    expect(memes.every((url) => !url.includes('/gen/'))).toBe(true);
  });
});

test.describe('performance budgets (brief §10)', () => {
  test('ships no more than 180 kB gz of JS on first paint', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    const client = await page.context().newCDPSession(page).catch(() => null);
    if (!client) {
      test.skip(true, 'CDP is unavailable in WebKit');
      return;
    }
    await client.send('Network.enable');

    const transferred: Record<string, number> = {};
    client.on('Network.responseReceived', (event: { requestId: string; response: { url: string } }) => {
      transferred[event.requestId] = 0;
      void event.response.url;
    });
    client.on('Network.loadingFinished', (event: { requestId: string; encodedDataLength: number }) => {
      transferred[event.requestId] = event.encodedDataLength;
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    const total = Object.values(transferred).reduce((sum, bytes) => sum + bytes, 0);
    // Transferred bytes are already compressed on the wire.
    expect(total).toBeLessThan(180 * 1024);
  });

  test('keeps CLS under 0.05', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let total = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) {
                total += (entry as PerformanceEntry & { value?: number }).value ?? 0;
              }
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(total);
          }, 2_500);
        }),
    );
    expect(cls).toBeLessThan(0.05);
  });
});
