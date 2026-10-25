import { expect, test } from '@playwright/test';
import { ana as propietario, abrir, autenticarFicticiamente } from '../fixtures/sesion-offline';

test('G3 — preparación completa alimenta captura y conserva JSON, foto, PDF e intención al reabrir', async ({
  page,
  context,
}) => {
  await autenticarFicticiamente(context, () => propietario, 'g3-solo-memoria');
  await abrir(page);
  await page.evaluate(async () => {
    await window.__sesionDemo!.entrar();
    await window.__sesionDemo!.preparar();
  });
  const snapshot = await page.evaluate(() =>
    window.__sesionDemo!.db.preparaciones.get(window.__sesionDemo!.propietario),
  );
  expect(snapshot).toBeDefined();
  expect(snapshot!.asignaciones).toHaveLength(2);
  expect(snapshot!.publicaciones[0].publicacion).toBeNull();
  const esperado = await page.evaluate(async () => {
    const h = window.__sesionDemo!;
    const [i] = await h.acceso.inspecciones();
    await h.persistencia.editar(h.propietario, i.id, { fixture: true, observacion: 'JSON G3' });
    await h.persistencia.foto(
      h.propietario,
      i.id,
      {
        archivo: new Blob(['foto-g3'], { type: 'image/webp' }),
        miniatura: new Blob(['mini-g3'], { type: 'image/webp' }),
        latitud: null,
        longitud: null,
        capturada_en: '2026-10-05T00:00:00Z',
      },
      'fixture.elemento',
    );
    await h.persistencia.documento(
      h.propietario,
      i.id,
      new Blob(['%PDF-g3'], { type: 'application/pdf' }),
    );
    await h.persistencia.enviar(h.propietario, i.id);
    return {
      captura: await h.persistencia.inspeccion(h.propietario, i.id),
      cola: await h.persistencia.operaciones(h.propietario),
    };
  });
  expect(esperado.captura.formulario_version_id).toBe(snapshot!.formulario_version_id);
  expect(esperado.captura.puente_id).toBe(snapshot!.asignaciones[0].puente_id);
  expect(esperado.captura.metadatos).toMatchObject({ asignacion_id: snapshot!.asignaciones[0].id });
  expect(esperado.captura.intencion_envio_en).not.toBeNull();
  await page.reload();
  await page.waitForFunction(() => !!window.__sesionDemo);
  const recuperado = await page.evaluate(async () => {
    const h = window.__sesionDemo!;
    const [i] = await h.acceso.inspecciones();
    const [foto] = await h.db.fotos.toArray();
    const [pdf] = await h.db.documentos.toArray();
    return {
      captura: i,
      cola: await h.persistencia.operaciones(h.propietario),
      foto: await foto.archivo.text(),
      miniatura: await foto.miniatura!.text(),
      pdf: await pdf.archivo.text(),
      snapshot: await h.db.preparaciones.get(h.propietario),
    };
  });
  expect(recuperado.captura).toEqual(esperado.captura);
  expect(recuperado.cola).toEqual(esperado.cola);
  expect(recuperado.snapshot).toEqual(snapshot);
  expect(recuperado).toMatchObject({ foto: 'foto-g3', miniatura: 'mini-g3', pdf: '%PDF-g3' });
  expect(JSON.stringify(recuperado)).not.toContain('g3-solo-memoria');
});
