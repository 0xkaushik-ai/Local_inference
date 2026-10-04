import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: 'toolkit.spec.ts',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    launchOptions: { args: ['--no-sandbox'] },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
