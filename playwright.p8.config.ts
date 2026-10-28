import { defineConfig, devices } from '@playwright/test';

if (process.env['P8_RECORRIDO_AISLADO'] !== '1') {
  throw new Error('Inicia este recorrido desde RecorridoP8Navegador, con su base aislada.');
}

export default defineConfig({
  testDir: './e2e/p8',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/p8', open: 'never' }]],
  outputDir: 'test-results/p8',
  use: {
    ...devices['Desktop Chrome'],
    launchOptions: { executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] },
    channel: process.env['P8_CHROME_CHANNEL'],
    baseURL: 'http://127.0.0.1:8093',
    serviceWorkers: 'block',
    trace: 'off', // Los intercambios reales incluyen credenciales y tokens: no persistirlos.
    screenshot: 'only-on-failure',
    permissions: ['geolocation'],
    geolocation: { latitude: 14.62, longitude: -90.51 },
  },
  webServer: {
    command: 'npm run build && node scripts/serve-p8.mjs',
    url: 'http://127.0.0.1:8093',
    reuseExistingServer: false,
    timeout: 90000,
  },
});
