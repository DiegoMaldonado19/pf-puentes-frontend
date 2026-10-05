import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e/base-offline',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/base-offline', open: 'never' }]],
  outputDir: 'test-results/base-offline',
  use: {
    baseURL: 'http://localhost:8090',
    trace: 'on',
    screenshot: 'only-on-failure',
    serviceWorkers: 'allow',
    permissions: ['geolocation'],
    geolocation: { latitude: 14.83, longitude: -91.52 },
  },
  projects: [{ name: 'base-offline', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build:base-offline && node scripts/serve-base-offline.mjs',
    url: 'http://localhost:8090',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
