import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'toolkit.spec.ts',
  outputDir: '../reports/readiness-browser',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:18766',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ['--no-sandbox'] },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: '../.venv/bin/python ../tests/readiness_fixture.py --dashboard-port 18766',
    url: 'http://127.0.0.1:18766',
    reuseExistingServer: false,
  },
});
