import { expect, test } from '@playwright/test';

test('prepara, captura SIECA sin conexión y sincroniza sin duplicar tras perder respuestas reales', async ({
  page,
  context,
}) => {
  const codigo = process.env['OFFLINE_PUENTE']!;
  await page.goto('/login');
  await page.getByLabel('Correo', { exact: true }).fill(process.env['OFFLINE_CORREO']!);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env['OFFLINE_CLAVE']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await page.goto('/offline/local');
  await page.getByRole('button', { name: 'Preparar para uso sin conexión', exact: true }).click();
  await expect(
    page.getByText('Preparación para uso sin conexión completa.', { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  const puente = page.locator('article').filter({ hasText: codigo });
  await expect(puente).toHaveCount(1);
  await puente
    .getByRole('button', { name: 'Iniciar inspección sin conexión', exact: true })
    .click();
  await expect(page).toHaveURL(/\/offline\/captura\/[0-9a-f-]+$/);
  const editor = page.locator('app-captura-local');
  await expect(editor).toHaveCount(1);
  await expect(
    editor.getByRole('heading', { name: 'Datos permanentes', exact: true }),
  ).toBeVisible();
  const inspeccion = page.url().split('/').at(-1)!;
  const motor = editor.locator('app-motor-formulario');
  const diagnostico = editor.locator('#diagnostico-local');
  await context.setOffline(true);
  await expect(motor.locator('#codigo')).toHaveValue(codigo);
  await expect(editor.getByRole('heading', { name: 'Formulario SIECA', exact: true })).toHaveCount(
    0,
  );
  await motor.getByRole('button', { name: /Sección 2:/ }).click();
  await motor.locator('#longitud_total').fill('12');
  await motor.locator('#numero_tramos').fill('1');
  await motor.locator('#ancho_rodadura').fill('6');
  await editor.getByRole('button', { name: 'Confirmar datos permanentes', exact: true }).click();
  await expect(
    editor.getByRole('heading', { name: 'Formulario SIECA', exact: true }),
  ).toBeVisible();
  await motor.getByRole('button', { name: /Sección 3:/ }).click();
  await motor.locator('#tramo_0_longitud').fill('12');
  for (const seccion of [4, 5, 6, 7]) {
    await motor.getByRole('button', { name: new RegExp(`Sección ${seccion}:`) }).click();
    await motor.getByRole('button', { name: 'Sin daños en toda la sección', exact: true }).click();
  }
  const imagen = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 32;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#147';
      ctx.fillRect(0, 0, 32, 32);
      return canvas.toDataURL('image/png').split(',')[1];
    }),
    'base64',
  );
  for (let n = 1; n <= 4; n++) {
    if (n === 4)
      await editor
        .getByLabel('Elemento de la foto (opcional)')
        .selectOption('subestructura.estribo_entrada.grietas');
    await editor.locator('app-captura-foto input[type=file]').setInputFiles({
      name: `puente-${n}.png`,
      mimeType: 'image/png',
      buffer: imagen,
    });
    await expect(
      editor.getByText(`Fotos guardadas: ${n} (mínimo 4 para enviar)`, { exact: true }),
    ).toBeVisible();
  }
  await editor.getByRole('button', { name: 'Encolar envío', exact: true }).click();
  await expect(editor.getByText('Enviada: pendiente de subir', { exact: true })).toBeVisible();
  await expect(diagnostico).toHaveCount(1);
  await expect(
    diagnostico
      .getByRole('status')
      .filter({ hasText: 'Inspecciones pendientes: 1 · Archivos pendientes: 4' }),
  ).toBeVisible();

  let fotoCortada = false,
    fotoProcesadaSinRespuesta = false,
    confirmacionSinRespuesta = false;
  const clavesConfirmacion: string[] = [];
  await page.route('**/api/v1/inspecciones/**', async (route) => {
    const request = route.request();
    if (!['POST', 'PUT'].includes(request.method())) {
      await route.continue();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2100));
    if (request.method() === 'PUT') {
      expect(request.postDataJSON()).not.toHaveProperty('grupos_sin_danos');
    }
    if (request.url().endsWith('/confirmacion-datos-permanentes')) {
      clavesConfirmacion.push(request.headers()['idempotency-key']);
      if (!confirmacionSinRespuesta) {
        const respuesta = await route.fetch();
        expect(respuesta.ok()).toBe(true);
        confirmacionSinRespuesta = true;
        await route.abort('failed');
        return;
      }
    }
    if (request.url().endsWith('/fotos')) {
      if (!fotoCortada) {
        fotoCortada = true;
        await route.abort('failed');
        return;
      }
      if (!fotoProcesadaSinRespuesta) {
        const respuesta = await route.fetch();
        expect(respuesta.ok()).toBe(true);
        fotoProcesadaSinRespuesta = true;
        await route.abort('failed');
        return;
      }
    }
    await route.continue();
  });
  await context.setOffline(false);
  await expect(
    diagnostico
      .getByRole('status')
      .filter({ hasText: 'Inspecciones pendientes: 0 · Archivos pendientes: 0' }),
  ).toBeVisible({ timeout: 180000 });
  await expect(editor.getByText('Sincronizada', { exact: true })).toBeVisible();
  expect(fotoCortada && fotoProcesadaSinRespuesta && confirmacionSinRespuesta).toBe(true);
  expect(clavesConfirmacion.length).toBeGreaterThanOrEqual(2);
  expect(clavesConfirmacion[0]).toBe(clavesConfirmacion[1]);
  expect(clavesConfirmacion[0]).toMatch(/:permanentes$/);
  // Solo lectura: comprueba bytes y cola reales, sin sembrar datos ni usar un transporte simulado.
  const local = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('puentes-offline');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction(['cola_sync', 'fotos'], 'readonly');
      const leer = <T>(request: IDBRequest<T>) =>
        new Promise<T>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const [operaciones, fotos] = await Promise.all([
        leer(tx.objectStore('cola_sync').getAll()),
        leer(tx.objectStore('fotos').getAll()),
      ]);
      return {
        estados: operaciones.filter((o) => o.inspeccion_id === id).map((o) => o.estado),
        fotos: fotos
          .filter((f) => f.inspeccion_id === id)
          .map((f) => ({
            bytes: f.archivo.size,
            miniatura: f.miniatura.size,
            confirmado: f.confirmado,
            elemento_ref: f.elemento_ref,
          })),
      };
    } finally {
      db.close();
    }
  }, inspeccion);
  expect(local.estados.every((estado) => estado === 'confirmada')).toBe(true);
  expect(local.fotos).toHaveLength(4);
  expect(local.fotos.every((foto) => foto.bytes > 0 && foto.miniatura > 0 && foto.confirmado)).toBe(
    true,
  );
  expect(local.fotos.filter((foto) => foto.elemento_ref)).toHaveLength(1);
});
