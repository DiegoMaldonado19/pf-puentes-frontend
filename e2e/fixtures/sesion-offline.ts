import { expect, type BrowserContext, type Page } from '@playwright/test';
import type { SesionDemo } from '../../src/app/offline/demo/sesion-demo';

declare global {
  interface Window {
    __sesionDemo?: SesionDemo;
  }
}

export const ana = '019a0000-0000-7000-8000-000000000001';
export const bea = '019a0000-0000-7000-8000-000000000002';

// Solo para el harness: cada test recibe un BrowserContext/IndexedDB aislado.
export async function autenticarFicticiamente(
  context: BrowserContext,
  propietario: () => string,
  token = 'token-solo-memoria',
) {
  await context.route('**/api/v1/auth/**', (route) => {
    if (route.request().url().endsWith('cerrar-sesion')) {
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      json: {
        access_token: token,
        token_type: 'Bearer',
        expires_in: 900,
        usuario: { id: propietario(), nombre: 'Estudiante', rol: 'ESTUDIANTE' },
      },
    });
  });
}

export async function abrir(page: Page) {
  await page.goto('/offline/demo?sesion=1');
  await expect(
    page.getByRole('heading', { name: 'Sesión offline G2 — datos ficticios' }),
  ).toBeVisible();
  await page.waitForFunction(() => !!window.__sesionDemo);
}

export async function esperarShellOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await fetch('/index.html');
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}
