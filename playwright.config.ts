import { defineConfig, devices } from '@playwright/test';

/**
 * Functional suite. Runs the whole app twice: once as a Pixel 7 (Android
 * Chromium) and once as an iPhone 14 (WebKit), because the two differ in ways
 * this app cares about — safe-area insets, `backdrop-filter` cost, haptics
 * (Android only) and scroll chaining.
 *
 * The sandbox this was written in cannot download Playwright browsers, so the
 * suite is committed and runs anywhere else with:
 *
 *   npx playwright install chromium webkit && npm run test:e2e
 *
 * `CULTURED_CHROME` points at a locally installed build when the CDN is
 * unreachable, so the Chromium project still runs offline.
 */

const exec = process.env.CULTURED_CHROME;
const launchOptions = exec
  ? { executablePath: exec, env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alib' } }
  : {};

const baseURL = process.env.CULTURED_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/.artifacts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  expect: { timeout: 8_000 },
  projects: [
    {
      name: 'pixel7',
      use: { ...devices['Pixel 7'], launchOptions },
    },
    {
      name: 'iphone14',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
