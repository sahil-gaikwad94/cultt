import { defineConfig, devices } from '@playwright/test';
/* The sandbox blocks browser CDN downloads, so when a local build exists
   (CULTURED_CHROME) launch it with its bundled libraries instead. */
const exec = process.env.CULTURED_CHROME;
const launchOptions = exec ? { executablePath: exec, env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alib' } } : {};

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4173', ...devices['Pixel 5'], launchOptions },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
