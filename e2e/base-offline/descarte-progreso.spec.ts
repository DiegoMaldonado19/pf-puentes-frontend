import { expect, test } from '@playwright/test';
import {
  ana,
  abrir,
  autenticarFicticiamente,
  esperarShellOffline,
} from '../fixtures/sesion-offline';

test('P6 — progreso estable y descarte explícito preservan otras capturas tras reabrir offline', async ({
  page,
  context,
}) => {
  await autenticarFicticiamente(context, () => ana);
  await abrir(page);
  const antes = await page.evaluate(async () => {
    const h = window.__sesionDemo!;
    await h.entrar();
    await h.preparar();
    const [hermana] = await h.acceso.inspecciones();
    const i = await h.persistencia.crear(
      h.propietario,
      hermana.puente_id,
      hermana.formulario_version_id,
      { identificacion: { codigo: 'COPIA-OBSOLETA', nombre: 'Descartar solo esta' } },
    );
    await h.persistencia.foto(h.propietario, i.id, {
      archivo: new Blob(['foto pendiente'], { type: 'image/webp' }),
      miniatura: new Blob(['mini pendiente'], { type: 'image/webp' }),
      latitud: null,
      longitud: null,
      capturada_en: new Date().toISOString(),
    });
    await h.persistencia.documento(
      h.propietario,
      i.id,
      new Blob(['%PDF pendiente'], { type: 'application/pdf' }),
    );
    return {
      id: i.id,
      hermana: hermana.id,
      operaciones: await h.persistencia.operaciones(h.propietario, i.id),
      esquemas: await h.db.esquemas_formulario.count(),
    };
  });
  const diagnostico = page.locator('app-vista-local app-diagnostico-offline');
  const barra = diagnostico.getByRole('progressbar', { name: 'Progreso de sincronización' });
  await expect(barra).toHaveAttribute('max', '4');
  await expect(barra).toHaveAttribute('value', '0');
  await expect(diagnostico.locator('details')).not.toHaveAttribute('open');
  await diagnostico.locator('summary').click();
  await diagnostico.locator('details').evaluate((details) => {
    details.setAttribute('data-estable', 'si');
  });
  await page.evaluate(async ({ id, operaciones }) => {
    const h = window.__sesionDemo!;
    await h.db.cola_sync.update(operaciones[0].id, {
      estado: 'confirmada',
      resultado: { version: 1 },
    });
    await h.db.inspecciones.update(id, { version_confirmada: 1 });
    await h.db.cola_sync.update(operaciones[2].id, {
      estado: 'requiere_intervencion',
      error: 'PDF rechazado para esta prueba',
    });
  }, antes);
  await expect(barra).toHaveAttribute('value', '1');
  await expect(barra).toHaveAttribute('max', '4');
  await expect(diagnostico.locator('details')).toHaveAttribute('data-estable', 'si');
  await expect(diagnostico.locator('details')).toHaveAttribute('open', '');
  await diagnostico.locator('summary').click();
  await expect(diagnostico.getByRole('alert')).toHaveText('PDF rechazado para esta prueba');
  const tarjeta = page
    .locator('app-vista-local > div > section')
    .filter({ hasText: 'COPIA-OBSOLETA' });
  await tarjeta.getByRole('button', { name: 'Eliminar copia local', exact: true }).click();
  await expect(tarjeta.getByRole('alertdialog')).toContainText(
    'Operaciones sin confirmar que se perderán: 2',
  );
  expect(
    await page.evaluate(
      async (id) => !!(await window.__sesionDemo!.db.inspecciones.get(id)),
      antes.id,
    ),
  ).toBe(true);
  await tarjeta.getByRole('button', { name: 'Sí, eliminar la copia local', exact: true }).click();
  await expect(tarjeta).toHaveCount(0);
  await expect(
    diagnostico
      .getByRole('status')
      .filter({ hasText: 'Inspecciones pendientes: 1 · Archivos pendientes: 0' }),
  ).toBeVisible();
  await esperarShellOffline(page);
  await context.setOffline(true);
  await abrir(page);
  const despues = await page.evaluate(async (id) => {
    const h = window.__sesionDemo!;
    return {
      id: await h.db.inspecciones.get(id),
      capturas: (await h.acceso.inspecciones()).map((i) => i.id),
      cola: await h.persistencia.operaciones(h.propietario, id),
      fotos: await h.db.fotos
        .where('[propietario_id+inspeccion_id]')
        .equals([h.propietario, id])
        .count(),
      documentos: await h.db.documentos
        .where('[propietario_id+inspeccion_id]')
        .equals([h.propietario, id])
        .count(),
      esquemas: await h.db.esquemas_formulario.count(),
    };
  }, antes.id);
  expect(despues).toEqual({
    id: undefined,
    capturas: [antes.hermana],
    cola: [],
    fotos: 0,
    documentos: 0,
    esquemas: antes.esquemas,
  });
});
