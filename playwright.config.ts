import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', use: { baseURL: 'http://127.0.0.1:4173', ...devices['Pixel 5'] }, webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4173', reuseExistingServer: true } });
