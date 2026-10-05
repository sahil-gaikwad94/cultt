import { test, expect } from '@playwright/test';

test('cultured shell renders its core navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#phone')).toBeVisible();
  await expect(page.locator('#nav')).toBeVisible();
  await expect(page.locator('#s-feed')).toBeVisible();
});
