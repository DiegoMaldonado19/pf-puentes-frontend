import { expect, test } from '@playwright/test';
import type { SesionDemo } from '../../src/app/offline/demo/sesion-demo';

const propietario = '019a0000-0000-7000-8000-000000000001';

declare global {
  interface Window {
    __sesionDemo?: SesionDemo;
  }
}

test('G4 — diagnóstico local G2 accesible, aislado y sin transporte que confirme la cola', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'persisted', {
      configurable: true,
      value: async () => false,
    });
  });
  await context.route('**/api/v1/auth/**', (route) => {
    if (route.request().url().endsWith('cerrar-sesion')) return route.fulfill({ status: 204 });
    return route.fulfill({
      json: {
        access_token: 'g4-solo-memoria',
        token_type: 'Bearer',
        expires_in: 900,
        usuario: { id: propietario, nombre: 'Estudiante G4', rol: 'ESTUDIANTE' },
      },
    });
  });
  await page.goto('/offline/demo?sesion=1');
  await expect(
    page.getByRole('heading', { name: 'Sesión offline G2 — datos ficticios' }),
  ).toBeVisible();
  await page.waitForFunction(() => !!window.__sesionDemo);

  const antes = await page.evaluate(async () => {
    const h = window.__sesionDemo!;
    await h.entrar();
    await h.preparar();
    const [captura] = await h.acceso.inspecciones();
    await h.persistencia.editar(h.propietario, captura.id, { diagnostico: 'G4' });
    await h.persistencia.foto(
      h.propietario,
      captura.id,
      {
        archivo: new Blob(['foto-g4'], { type: 'image/webp' }),
        miniatura: new Blob(['mini-g4'], { type: 'image/webp' }),
        latitud: null,
        longitud: null,
        capturada_en: '2026-10-05T00:00:00Z',
      },
      'fixture.elemento',
    );
    await h.persistencia.documento(
      h.propietario,
      captura.id,
      new Blob(['%PDF-g4'], { type: 'application/pdf' }),
    );
    await h.persistencia.enviar(h.propietario, captura.id);
    return {
      id: captura.id,
      propietario: await h.acceso.propietarioActual(),
      cola: await h.persistencia.operaciones(h.propietario),
      fotos: await h.db.fotos.count(),
      documentos: await h.db.documentos.count(),
      envios: h.envios,
    };
  });
  expect(antes.propietario).toBe(propietario);
  expect(antes.cola.map((operacion) => operacion.estado)).toEqual([
    'pendiente',
    'pendiente',
    'pendiente',
    'pendiente',
    'pendiente',
  ]);
  expect(antes.envios).toBe(0);

  await expect(page.getByRole('heading', { name: 'Capturas locales' })).toBeVisible();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Inspecciones pendientes: 1 · Archivos pendientes: 2' }),
  ).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Persistencia denegada' })).toBeVisible();
  await expect(page.getByText(/Ocupación del origen \(bytes\): \d+/)).toBeVisible();
  await expect(page.getByText(/no hay transporte ni reintento productivos/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sincronizar simulación' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Sin capturas habilitadas' }),
  ).toBeVisible();
  await expect(page.getByText(antes.id, { exact: false })).toHaveCount(0);
  const despues = await page.evaluate(async () => {
    const h = window.__sesionDemo!;
    return {
      propietario: await h.acceso.propietarioActual(),
      cola: await h.persistencia.operaciones(h.propietario),
      fotos: await h.db.fotos.count(),
      documentos: await h.db.documentos.count(),
      inspecciones: await h.db.inspecciones.count(),
    };
  });
  expect(despues.propietario).toBeNull();
  expect(despues.cola).toEqual(antes.cola);
  expect(despues).toMatchObject({ fotos: 1, documentos: 1, inspecciones: 1 });
});
