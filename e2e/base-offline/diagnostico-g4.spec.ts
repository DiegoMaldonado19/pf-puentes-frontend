import { expect, test } from '@playwright/test';
import { ana as propietario, abrir, autenticarFicticiamente } from '../fixtures/sesion-offline';

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
  await autenticarFicticiamente(context, () => propietario, 'g4-solo-memoria');
  await abrir(page);

  const antes = await page.evaluate(async () => {
    const h = window.__sesionDemo!;
    await h.entrar();
    await h.preparar();
    const [captura] = await h.acceso.inspecciones();
    await h.persistencia.editar(
      h.propietario,
      captura.id,
      { diagnostico: 'G4' },
      captura.version_local,
    );
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
  await expect(
    page.getByText(
      'Prepara tu salida con conexión. Las capturas, fotos y PDF se conservan aquí hasta sincronizar.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toHaveCount(0);

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
