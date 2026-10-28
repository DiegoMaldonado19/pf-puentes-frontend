import { defineConfig, devices } from '@playwright/test';

if (
  process.env['OFFLINE_RECORRIDO_AISLADO'] !== '1' ||
  process.env['P8_RECORRIDO_AISLADO'] !== '1' ||
  !process.env['OFFLINE_CORREO'] ||
  !process.env['OFFLINE_CLAVE'] ||
  !process.env['OFFLINE_PUENTE']
) {
  throw new Error('Inicia este recorrido desde RecorridoOfflineNavegador con su base aislada.');
}

export default defineConfig({
  testDir: './e2e/offline-real',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/offline-real', open: 'never' }]],
  outputDir: 'test-results/offline-real',
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env['P8_CHROME_CHANNEL'],
    launchOptions: {
      executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'],
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
    baseURL: 'http://127.0.0.1:8093',
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'only-on-failure',
    permissions: ['geolocation'],
    geolocation: { latitude: 14.835, longitude: -91.515 },
  },
  webServer: {
    command: 'npm run build && node scripts/serve-p8.mjs',
    url: 'http://127.0.0.1:8093',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
