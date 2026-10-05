import { test, expect, Page, TestInfo } from '@playwright/test';
import type { DemoOffline } from '../../src/app/offline/demo/demo';

declare global {
  interface Window {
    __offlineDemo?: DemoOffline;
  }
}
async function abrir(page: Page) {
  page.on('pageerror', (error) => console.error('Error del navegador:', error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('Consola:', message.text());
  });
  await page.goto('/offline/demo?automatico=0');
  await expect(page.getByRole('heading', { name: 'Base offline — datos ficticios' })).toBeVisible();
  await page.waitForFunction(() => !!window.__offlineDemo);
  await page.evaluate(() => window.__offlineDemo!.motor.detener());
}
async function crear(page: Page) {
  return page.evaluate(async () => {
    const h = window.__offlineDemo!;
    return h.persistencia.crear(
      h.propietario(),
      '019a0000-0000-7000-8000-000000000003',
      '019a0000-0000-7000-8000-000000000004',
      { fixture: true },
    );
  });
}
async function captura(page: Page) {
  return page.evaluate(async () => {
    const h = window.__offlineDemo!;
    const hash = async (blob: Blob) =>
      Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())));
    return {
      i: await h.db.inspecciones.toArray(),
      fotos: await Promise.all(
        (await h.db.fotos.toArray()).map(async (f) => {
          const imagen = await createImageBitmap(f.archivo),
            mini = await createImageBitmap(f.miniatura!);
          const dimensiones = {
            lado: Math.max(imagen.width, imagen.height),
            lado_mini: Math.max(mini.width, mini.height),
          };
          imagen.close();
          mini.close();
          return {
            id: f.id,
            mime: f.mime,
            latitud: f.latitud,
            longitud: f.longitud,
            capturada_en: f.capturada_en,
            elemento_ref: f.elemento_ref,
            bytes: f.archivo.size,
            mini: f.miniatura!.size,
            hash: await hash(f.archivo),
            hash_mini: await hash(f.miniatura!),
            ...dimensiones,
          };
        }),
      ),
      pdf: await Promise.all(
        (await h.db.documentos.toArray()).map(async (d) => ({
          id: d.id,
          bytes: d.archivo.size,
          hash: await hash(d.archivo),
        })),
      ),
    };
  });
}
async function evidencia(page: Page, info: TestInfo, nombre: string) {
  if (page.isClosed()) return;
  const estado = await page
    .evaluate(async () => {
      const h = window.__offlineDemo;
      if (!h) return null;
      return {
        inspecciones: await h.db.inspecciones.toArray(),
        cola: await h.db.cola_sync.toArray(),
        fotos: (await h.db.fotos.toArray()).map((f) => ({
          id: f.id,
          tamano: f.archivo.size,
          miniatura: f.miniatura?.size,
          confirmado: f.confirmado,
        })),
      };
    })
    .catch(() => null);
  await info.attach(nombre, {
    body: JSON.stringify(estado, null, 2),
    contentType: 'application/json',
  });
}
test.beforeEach(async ({ page }, info) => {
  await abrir(page);
  await evidencia(page, info, 'estado-local-inicial');
});
test.afterEach(async ({ page }, info) => evidencia(page, info, 'estado-local-final'));

test('B01 — app shell frío y fixtures offline; UUID v7 antes del transporte', async ({
  page,
  context,
}, info) => {
  const api: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) api.push(r.url());
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // ready/controller preceden a initializeFully: una petición al shell espera el prefetch.
  expect(await page.evaluate(async () => (await fetch('/index.html')).ok)).toBe(true);
  const i = await crear(page);
  expect(i.id[14]).toBe('7');
  expect(await page.evaluate(() => window.__offlineDemo!.transporte.registro.length)).toBe(0);
  await context.setOffline(true);
  await page.close();
  const nueva = await context.newPage();
  await abrir(nueva);
  expect(
    await nueva.evaluate(async () => (await window.__offlineDemo!.db.puentes.toArray()).length),
  ).toBe(2);
  await expect(nueva.getByRole('heading', { name: `Inspección ${i.id}` })).toBeVisible();
  expect(api).toEqual([]);
  await evidencia(nueva, info, 'estado-local-final');
  await nueva.close();
});

test('B02 — captura real de cuatro fotos, PDF y respuestas sobreviven reapertura', async ({
  page,
  context,
}, info) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(await page.evaluate(async () => (await fetch('/index.html')).ok)).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Crear inspección ficticia' }).click();
  await expect(page.getByRole('heading', { name: /^Inspección / })).toHaveCount(1);
  await page.getByLabel('Respuestas JSON').fill('{"fixture":"editada"}');
  await page.getByRole('button', { name: 'Guardar respuestas' }).click();
  await expect(page.getByText('Guardado local confirmado', { exact: true })).toBeVisible();
  const imagen = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0080ff';
    ctx.fillRect(0, 0, 1800, 1000);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const png = Buffer.from(imagen, 'base64');
  for (let n = 0; n < 4; n++) {
    await page
      .locator('app-captura-foto input')
      .setInputFiles({ name: `foto-${n}.png`, mimeType: 'image/png', buffer: png });
    await expect(
      page.getByText(`Fotos guardadas: ${n + 1} · PDF guardados: 0`, { exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel('Adjuntar PDF').setInputFiles({
    name: 'fixture.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\nfixture\n%%EOF'),
  });
  await expect(
    page.getByText('Fotos guardadas: 4 · PDF guardados: 1', { exact: true }),
  ).toBeVisible();
  const antes = await captura(page);
  await page.close();
  const nueva = await context.newPage();
  await abrir(nueva);
  const despues = await captura(nueva);
  expect(despues).toEqual(antes);
  await info.attach('captura-antes-despues', {
    body: JSON.stringify({ antes, despues }, null, 2),
    contentType: 'application/json',
  });
  await info.attach('demo-reabierta-sin-red', {
    body: await nueva.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await evidencia(nueva, info, 'estado-local-final');
  expect(despues.i[0].respuestas).toEqual({ fixture: 'editada' });
  expect(
    despues.fotos.every(
      (f) =>
        f.id[14] === '7' &&
        f.bytes > 0 &&
        f.mini! > 0 &&
        f.lado <= 1600 &&
        f.lado_mini <= 300 &&
        f.latitud === 14.83 &&
        f.elemento_ref === 'fixture.elemento',
    ),
  ).toBe(true);
  await nueva.close();
});

test('B03 — cuota atómica visible, persistencia denegada y migración real', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'persist', { value: async () => false });
  });
  await abrir(page);
  await expect(
    page
      .getByText('Persistencia denegada: el navegador puede eliminar los datos', { exact: true })
      .first(),
  ).toBeVisible();
  const i = await crear(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'cola_sync') throw new DOMException('Cuota simulada', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.getByLabel('Adjuntar PDF').setInputFiles({
    name: 'fixture.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 fixture'),
  });
  await expect(
    page.getByRole('alert').filter({ hasText: 'No hay cuota suficiente' }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__offlineDemo!.db.documentos.count())).toBe(0);
  expect(await page.evaluate(() => window.__offlineDemo!.db.cola_sync.count())).toBe(1);
  // Reabrir quita la instrumentación de cuota; migrar una BD legacy con Blob real.
  await abrir(page);
  const migracion = await page.evaluate(async (id) => {
    const h = window.__offlineDemo!;
    const f = await h.persistencia.foto(
      h.propietario(),
      id,
      {
        archivo: new Blob(['foto'], { type: 'image/webp' }),
        miniatura: new Blob(['mini'], { type: 'image/webp' }),
        latitud: 14,
        longitud: -91,
        capturada_en: '2026-10-05T00:00:00Z',
      },
      'fixture',
    );
    const i = await h.db.inspecciones.get(id),
      ops = await h.db.cola_sync.toArray();
    const legacy = h.crearBaseV1('e2e-migracion');
    await legacy.table('inspecciones').put(i);
    await legacy.table('fotos').put(f);
    await legacy.table('cola_sync').bulkPut(ops);
    legacy.close();
    const migrada = h.crearBase('e2e-migracion');
    const foto = await migrada.fotos.get(f.id);
    const resultado = {
      version: migrada.verno,
      fotos: await foto!.archivo.text(),
      mini: await foto!.miniatura!.text(),
      cola: await migrada.cola_sync.count(),
      i: await migrada.inspecciones.get(id),
    };
    await migrada.delete();
    return resultado;
  }, i.id);
  expect(migracion).toMatchObject({
    version: 2,
    fotos: 'foto',
    mini: 'mini',
    cola: 2,
    i: { id: i.id },
  });
});

test('B04 — cinco fallos persistidos, recarga y reintento con clave original', async ({ page }) => {
  const i = await crear(page);
  const clave = await page.evaluate(
    async (id) =>
      (
        await window.__offlineDemo!.persistencia.operaciones(
          window.__offlineDemo!.propietario(),
          id,
        )
      )[0].clave,
    i.id,
  );
  for (let n = 1; n <= 5; n++) {
    const o = await page.evaluate(async () => {
      const h = window.__offlineDemo!;
      h.transporte.resultado = 'transitorio';
      const anterior = (await h.persistencia.operaciones(h.propietario()))[0];
      h.desfase = Math.max(0, anterior.proximo_intento - Date.now() + 1);
      await h.motor.drenar();
      return (await h.persistencia.operaciones(h.propietario()))[0];
    });
    expect(o.intentos).toBe(n);
    expect(o.clave).toBe(clave);
    if (n < 5) {
      expect(o.proximo_intento - o.ultimo_intento!).toBeGreaterThanOrEqual(
        [2000, 4000, 8000, 16000][n - 1],
      );
      await abrir(page);
      await page.evaluate(async () => {
        const h = window.__offlineDemo!;
        const o = (await h.persistencia.operaciones(h.propietario()))[0];
        h.desfase = o.proximo_intento - Date.now() + 1;
      });
    }
  }
  await abrir(page);
  await page.evaluate(() => window.__offlineDemo!.motor.drenar());
  expect(await page.evaluate(() => window.__offlineDemo!.transporte.registro.length)).toBe(0);
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => (await window.__offlineDemo!.db.cola_sync.toArray())[0].estado),
    )
    .toBe('confirmada');
  expect(await page.evaluate(() => window.__offlineDemo!.transporte.registro[0].clave)).toBe(clave);
});

test('B05 — dependencia bloqueada y trabajos independientes, orden serial', async ({ page }) => {
  const resultado = await page.evaluate(async () => {
    const h = window.__offlineDemo!,
      p = h.propietario();
    const a = await h.persistencia.crear(p, 'puente', 'version');
    const f = {
      archivo: new Blob(['foto'], { type: 'image/webp' }),
      miniatura: new Blob(['mini'], { type: 'image/webp' }),
      latitud: null,
      longitud: null,
      capturada_en: '2026-10-05T00:00:00Z',
    };
    await h.persistencia.foto(p, a.id, f, 'fixture');
    await h.persistencia.foto(p, a.id, f, 'fixture');
    await h.persistencia.enviar(p, a.id);
    const ops = await h.persistencia.operaciones(p, a.id);
    await h.db.cola_sync.update(ops[1].id, {
      estado: 'requiere_intervencion',
      error: 'Archivo bloqueado',
    });
    const b = await h.persistencia.crear(p, 'puente', 'version');
    await h.motor.drenar();
    const bloqueados = await h.persistencia.operaciones(p, a.id);
    const independiente = (await h.persistencia.operaciones(p, b.id))[0].estado;
    await h.motor.reintentar(p, ops[1].id);
    return {
      bloqueados,
      independiente,
      orden: h.transporte.registro.map((r) => r.tipo),
      maximo: h.transporte.maximo_activos,
    };
  });
  expect(resultado.bloqueados.map((o) => o.estado)).toEqual([
    'confirmada',
    'requiere_intervencion',
    'pendiente',
    'pendiente',
  ]);
  expect(resultado.independiente).toBe('confirmada');
  expect(resultado.orden).toEqual(['datos', 'datos', 'foto', 'foto', 'envio']);
  expect(resultado.maximo).toBe(1);
});

test('B06 — indicador cuenta entidades y diagnóstico accesible coincide con IndexedDB', async ({
  page,
}) => {
  const i = await crear(page);
  await page.evaluate(async (id) => {
    const h = window.__offlineDemo!,
      p = h.propietario();
    await h.persistencia.editar(p, id, { valor: 2 });
    await h.persistencia.documento(p, id, new Blob(['pdf'], { type: 'application/pdf' }));
    h.transporte.resultado = 'negocio';
    await h.motor.drenar();
  }, i.id);
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Inspecciones pendientes: 1 · Archivos pendientes: 1' }),
  ).toBeVisible();
  await expect(page.getByText(/Ocupación del origen \(bytes\): \d+/)).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Rechazo de negocio' })).toBeVisible();
  await expect(page.getByText(/Último intento: \d+/)).toBeVisible();
  await page.evaluate(() => (window.__offlineDemo!.transporte.resultado = 'ack'));
  await page.getByRole('button', { name: 'Sincronizar simulación' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Inspecciones pendientes: 0 · Archivos pendientes: 0' }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () =>
      (await window.__offlineDemo!.db.cola_sync.toArray()).every((o) => o.estado === 'confirmada'),
    ),
  ).toBe(true);
});

test('B07 — dos pestañas, cierre en vuelo, recuperación y ACK anterior', async ({
  page,
  context,
}, info) => {
  const i = await crear(page);
  const otra = await context.newPage();
  await abrir(otra);
  await page.evaluate(() => {
    const h = window.__offlineDemo!;
    h.transporte.demora = 1000;
    void h.motor.drenar();
  });
  await expect.poll(() => page.evaluate(() => window.__offlineDemo!.transporte.activos)).toBe(1);
  await otra.evaluate(() => window.__offlineDemo!.motor.drenar());
  expect(await otra.evaluate(() => window.__offlineDemo!.transporte.registro.length)).toBe(0);
  await otra.evaluate(async (id) => {
    const h = window.__offlineDemo!;
    await h.persistencia.editar(h.propietario(), id, { nueva: true });
    const ops = await h.persistencia.operaciones(h.propietario());
    await h.db.cola_sync.update(ops[1].id, { proximo_intento: Date.now() + 999999 });
  }, i.id);
  await expect
    .poll(() =>
      otra.evaluate(async () => (await window.__offlineDemo!.db.cola_sync.toArray())[0].estado),
    )
    .toBe('confirmada');
  const despues = await otra.evaluate(
    async (id) => window.__offlineDemo!.db.inspecciones.get(id),
    i.id,
  );
  expect(despues).toMatchObject({
    respuestas: { nueva: true },
    version_local: 2,
    version_confirmada: 1,
  });
  // Interrumpir la segunda operación; su lease vence tras el cierre físico de pestaña.
  await page.evaluate(async () => {
    const h = window.__offlineDemo!;
    h.transporte.demora = 30000;
    await h.db.cola_sync
      .where('propietario_id')
      .equals(h.propietario())
      .filter((o) => o.estado === 'pendiente')
      .modify({ proximo_intento: 0 });
    void h.motor.drenar();
  });
  await expect.poll(() => page.evaluate(() => window.__offlineDemo!.transporte.activos)).toBe(1);
  await page.close();
  await otra.waitForTimeout(15500);
  await otra.evaluate(() => window.__offlineDemo!.motor.drenar());
  expect(
    await otra.evaluate(async () =>
      (await window.__offlineDemo!.db.cola_sync.toArray()).every((o) => o.estado === 'confirmada'),
    ),
  ).toBe(true);
  await evidencia(otra, info, 'estado-local-final');
  await otra.close();
});

test('B08 — propietarios y BD de demo aislados; sin transporte real no hay ACK', async ({
  page,
}) => {
  const i = await crear(page);
  await page
    .getByLabel('Propietario ficticio')
    .selectOption('019a0000-0000-7000-8000-000000000002');
  await page.evaluate(() => window.__offlineDemo!.motor.detener());
  await expect(page.getByRole('heading', { name: /^Inspección / })).toHaveCount(0);
  expect(await page.evaluate(() => window.__offlineDemo!.transporte.registro.length)).toBe(0);
  await page.getByLabel('Propietario ficticio').selectOption(i.propietario_id);
  await page.evaluate(() => window.__offlineDemo!.motor.detener());
  await expect(page.getByRole('heading', { name: `Inspección ${i.id}` })).toBeVisible();
  const resultado = await page.evaluate(async () => {
    const h = window.__offlineDemo!;
    const real = h.crearBase('puentes-offline');
    // Mismo núcleo, pero constructor sin adaptador: jamás usa el simulador.
    const Motor = h.motor
      .constructor as typeof import('../../src/app/offline/motor-sync').MotorSync;
    const o = (await h.db.cola_sync.toArray())[0];
    await real.cola_sync.put(o);
    await new Motor(real, {
      propietarioActual: () => h.propietario(),
      preparar: async () => true,
    }).drenar();
    await h.motor.drenar();
    const operacion = await real.cola_sync.get(o.id);
    const demo = await h.db.cola_sync.get(o.id);
    await real.delete();
    return { real: operacion?.estado, demo: demo?.estado, contenido: JSON.stringify(o) };
  });
  expect(resultado.real).toBe('pendiente');
  expect(resultado.demo).toBe('confirmada');
  expect(resultado.contenido).not.toMatch(
    /Authorization|HttpRequest|FormData|access_token|refresh_token/,
  );
});
