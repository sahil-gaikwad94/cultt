import { defineConfig, devices } from '@playwright/test';

/**
 * Config for the motion and screenshot suites.
 *
 * Deliberately has NO `webServer` block. The app is already being served by the
 * managed preview, and starting a second dev server would compete for the same
 * port (which is how the previous run ended up on 4176 with 4173 and 4174 both
 * occupied). Point this at whatever is actually serving:
 *
 *   CULTURED_BASE_URL=http://127.0.0.1:4176 \
 *     npx playwright test --config tests/visual/playwright.config.ts
 */
const baseURL = process.env.CULTURED_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: './.artifacts',
  use: {
    baseURL,
    ...devices['Pixel 5'],
    viewport: { width: 390, height: 844 },
    launchOptions: process.env.CULTURED_CHROME
      ? { executablePath: process.env.CULTURED_CHROME, env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alib' } }
      : {},
  },
  expect: { timeout: 8_000 },
});
