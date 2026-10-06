import { test, expect, type Page } from '@playwright/test';

/**
 * The duel link growth engine, end to end: a creator inside the app, a
 * recipient in a second tab of the same browser context, one localStorage
 * between them. This is the test that proves the reveal is genuinely two-party
 * — nothing here fakes the other side.
 */

const boot = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    localStorage.setItem('cultured2:state', JSON.stringify({ onboarded: true }));
  });
  await page.goto('/');
  await expect(page.locator('#nav')).toBeVisible();
  await page.waitForFunction(() => !document.getElementById('splash'), undefined, { timeout: 10_000 });
};

test.describe('duel link', () => {
  test('creator answers five, recipient answers five, and only then does anyone see a verdict', async ({
    page,
    context,
  }) => {
    await boot(page);

    // --- creator side, inside the app
    await page.locator('.nv[data-t="arena"]').click();
    const duelCta = page.locator('[data-act="pulse-duel"]');
    await expect(duelCta).toBeVisible();
    await duelCta.click();

    const sheet = page.locator('#sheetwrap .sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.duel-link code')).toContainText(/\/d\/[a-z0-9]{6}$/);
    await expect(sheet.locator('.duel-status')).toContainText('Send the link when you’re ready');
    await expect(sheet.locator('.duel2-q')).toHaveCount(1);

    // the five prompts, five taps; no free-text fields anywhere in the sheet
    await expect(sheet.locator('input, textarea')).toHaveCount(0);
    for (let i = 0; i < 5; i++) {
      const opt = sheet.locator('.duel2-opt').first();
      await expect(opt).toBeVisible();
      // dispatch, not tap: the last pick re-renders the sheet mid-gesture and
      // hit-target retries can't settle against a repainting sheet
      await opt.evaluate((el) => (el as HTMLElement).click());
      // the progress pips are the reliable witness: one locks per pick
      await expect(sheet.locator('.duel2-prog i.done, .duel2-prog i.cur').first()).toBeVisible();
    }
    await expect(sheet.locator('.duel2-q')).toContainText('Your five are locked');
    await expect(sheet.locator('.duel-status')).toContainText('Link is live');

    const link = (await sheet.locator('.duel-link code').textContent())!;

    // the in-app card is never watermarked with the growth CTA
    await expect(sheet).not.toContainText('duel your friends');

    // --- recipient side, second tab
    const other = await context.newPage();
    await other.goto(link);
    const dp = other.locator('#duel-page');
    await expect(dp).toBeVisible();
    await expect(dp).toContainText('sent you a');

    // nothing reveals the creator's picks before the recipient is in
    await expect(dp).not.toContainText('Same damage');

    await dp.locator('[data-act="dp-start"]').click();
    for (let i = 0; i < 5; i++) {
      const opt = dp.locator('.dp-opts .duel2-opt').first();
      await expect(opt).toBeVisible();
      await opt.evaluate((el) => (el as HTMLElement).click());
      await other.waitForTimeout(120);
    }
    // creator submitted first, so both sides are in and the reveal is live
    await expect(dp.locator('.duel2-verdict')).toBeVisible();
    await expect(dp.locator('.dv')).toContainText('/5');
    // external-artifact affordances exist on the recipient side (they may share)
    await expect(dp.locator('[data-act="dp-save"]')).toBeVisible();

    // --- and the creator's open sheet wakes up without a reload
    await expect(sheet.locator('.duel2-verdict')).toBeVisible({ timeout: 8_000 });
    await expect(sheet.locator('.duel-status')).toContainText('Revealed');
    // the arena card behind the sheet reflects the finished duel truthfully
    await expect(page.locator('.duel-cardwrap')).toHaveCount(1);
  });

  test('a link to a duel that never existed says so plainly', async ({ page }) => {
    await page.goto('/d/zzzzzz');
    const dp = page.locator('#duel-page');
    await expect(dp).toContainText('This duel has ended');
    await expect(page.locator('#nav')).toBeHidden(); // chromeless: no fake logged-in shell
  });
});
