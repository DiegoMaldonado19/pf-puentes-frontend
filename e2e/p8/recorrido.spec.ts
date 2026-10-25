import { expect, Page, test } from '@playwright/test';

const puente = '019a0035-0000-7000-8000-000000000001';
const orden = '019a0035-0000-7000-8000-000000000018';
const descarte = '019a0035-0000-7000-8000-000000000022';
const base = `/api/v1/puentes/${puente}/ordenes-mantenimiento`;
const hoy = process.env['P8_HOY']!;
const clave = process.env['P8_CLAVE_PRUEBA']!;

async function entrar(page: Page, cuenta: string) {
  await page.goto('/login');
  await page.getByLabel('Correo', { exact: true }).fill(`${cuenta}@anual-prueba.com`);
  await page.getByLabel('Contraseña', { exact: true }).fill(clave);
  const respuesta = page.waitForResponse((r) => r.url().endsWith('/api/v1/auth/login'));
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  expect((await respuesta).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}

async function escritura(page: Page, ruta: string, metodo: string, accion: () => Promise<unknown>) {
  const respuesta = page.waitForResponse(
    (r) => r.url().endsWith(ruta) && r.request().method() === metodo,
  );
  await accion();
  const resultado = await respuesta;
  expect(resultado.ok(), `Respuesta de ${metodo} ${ruta}`).toBe(true);
  return resultado;
}

async function detalle(page: Page, descripcion: string) {
  await page
    .getByRole('table', { name: 'Órdenes del puente', exact: true })
    .getByRole('row')
    .filter({ hasText: descripcion })
    .getByRole('button', { name: 'Ver detalle', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Detalle de la orden', exact: true }),
  ).toBeVisible();
}

test('Administrador: versión → juego → elementos, sin editar pesos', async ({ page }) => {
  await entrar(page, 'admin');
  await page.getByRole('link', { name: 'Pesos del índice de condición', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/pesos$/);
  await page
    .getByRole('row')
    .filter({ hasText: 'P8-CONSULTA-A' })
    .getByRole('button', { name: /Consultar juegos/ })
    .click();
  await page.getByRole('button', { name: 'Ver pesos', exact: true }).first().click();
  await expect(page.getByRole('row').filter({ hasText: 'elemento-a' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Peso', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'P8-CONSULTA-A' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
});

test('Administrador: aceptar, programar, justificar prioridad, iniciar, foto, cierre y descarte', async ({
  page,
}) => {
  test.setTimeout(90000);
  await entrar(page, 'admin');
  await page.goto(`/puentes/${puente}`);
  await page.getByRole('link', { name: 'Gestionar mantenimiento', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/puentes/${puente}/mantenimiento$`));
  await page.getByRole('button', { name: 'Propuestas pendientes', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Propuesta no es programación' })
    .getByRole('button', { name: 'Revisar propuesta', exact: true })
    .click();
  await escritura(page, `${base}/${orden}/aceptacion`, 'POST', () =>
    page.getByRole('button', { name: 'Aceptar propuesta', exact: true }).click(),
  );
  await page.getByRole('button', { name: 'Historial y seguimiento anual', exact: true }).click();
  await detalle(page, 'Propuesta no es programación');
  const prioridad = page.getByRole('region', { name: 'Ajustar prioridad', exact: true });
  await prioridad.getByLabel('Nueva prioridad').selectOption('ALTA');
  await prioridad
    .getByLabel('Justificación del cambio')
    .fill('Prioridad justificada en el recorrido aislado');
  await escritura(page, `${base}/${orden}/prioridad`, 'PATCH', () =>
    prioridad.getByRole('button', { name: 'Guardar prioridad', exact: true }).click(),
  );
  const programacion = page.getByRole('region', {
    name: 'Programar fecha de intervención',
    exact: true,
  });
  await programacion.getByLabel('Fecha programada', { exact: true }).fill(hoy);
  await escritura(page, `${base}/${orden}/fecha-programada`, 'PATCH', () =>
    programacion.getByRole('button', { name: 'Guardar fecha programada', exact: true }).click(),
  );
  await escritura(page, `${base}/${orden}/inicio-ejecucion`, 'POST', () =>
    page.getByRole('button', { name: 'Iniciar ejecución', exact: true }).click(),
  );
  const fotos = page.getByRole('region', { name: 'Fotografías de evidencia', exact: true });
  await fotos.getByLabel('Fecha de ejecución', { exact: true }).fill(hoy);
  await fotos
    .getByLabel('Responsable de ejecución', { exact: true })
    .fill('Responsable del recorrido P8');
  await fotos.getByRole('button', { name: 'Cerrar como ejecutada', exact: true }).click();
  await expect(
    fotos.getByText('Guarda al menos una fotografía de esta orden antes de cerrarla.', {
      exact: true,
    }),
  ).toBeVisible();
  // Un icono local es solo el archivo de prueba. El componente lo comprime y lo sube a MinIO real.
  await fotos.locator('input[type=file]').setInputFiles('public/icons/icon-72x72.png');
  await expect(
    fotos.getByRole('button', { name: 'Guardar fotografía', exact: true }),
  ).toBeEnabled();
  await escritura(page, `${base}/${orden}/evidencias`, 'POST', () =>
    fotos.getByRole('button', { name: 'Guardar fotografía', exact: true }).click(),
  );
  await expect(fotos.getByRole('img')).toBeVisible();
  const imagen = await fotos.getByRole('img').getAttribute('src');
  expect(imagen).toBeTruthy();
  expect((await page.request.get(imagen!)).ok()).toBe(true);
  await escritura(page, `${base}/${orden}/cierre`, 'POST', () =>
    fotos.getByRole('button', { name: 'Cerrar como ejecutada', exact: true }).click(),
  );
  await expect(
    page.getByText('La orden quedó Ejecutada. Su evidencia sigue disponible para consulta.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await detalle(page, 'Propuesta no es programación');
  await expect(page.getByRole('img', { name: 'Miniatura de la evidencia' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Cerrar como ejecutada', exact: true }),
  ).toHaveCount(0);
  await detalle(page, 'Propuesta de descarte del recorrido');
  const descartar = page.getByRole('region', { name: 'Descartar propuesta', exact: true });
  await descartar
    .getByLabel('Motivo del descarte')
    .fill('Intervención descartada durante el recorrido aislado');
  await escritura(page, `${base}/${descarte}/descarte`, 'POST', () =>
    descartar.getByRole('button', { name: 'Confirmar descarte', exact: true }).click(),
  );
  await page.reload();
  await detalle(page, 'Propuesta de descarte del recorrido');
  await expect(
    page.getByText('Intervención descartada durante el recorrido aislado', { exact: true }),
  ).toBeVisible();
});

test('Catedrático: puede consultar mantenimiento pero no administración de pesos', async ({
  page,
}) => {
  await entrar(page, 'cate');
  await page.goto(`/puentes/${puente}/mantenimiento`);
  await expect(
    page.getByRole('heading', { name: 'Seguimiento rutinario anual', exact: true }),
  ).toBeVisible();
  await page.goto('/admin/pesos');
  await expect(page).toHaveURL(/\/puentes$/);
  await expect(
    page.getByRole('link', { name: 'Pesos del índice de condición', exact: true }),
  ).toHaveCount(0);
});

for (const cuenta of ['estudiante', 'profesional']) {
  test(`${cuenta}: rutas y API rechazan acceso a mantenimiento y pesos`, async ({ page }) => {
    await entrar(page, cuenta);
    await page.goto(`/puentes/${puente}/mantenimiento`);
    await expect(page).toHaveURL(/\/puentes$/);
    await page.goto('/admin/pesos');
    await expect(page).toHaveURL(/\/puentes$/);
    const sesion = await page.request.post('/api/v1/auth/login', {
      data: { correo: `${cuenta}@anual-prueba.com`, contrasena: clave },
    });
    expect(sesion.ok()).toBe(true);
    const { access_token } = await sesion.json();
    const headers = { Authorization: `Bearer ${access_token}` };
    expect((await page.request.get(base, { headers })).status()).toBe(403);
    expect((await page.request.get('/api/v1/juegos-pesos/formularios', { headers })).status()).toBe(
      403,
    );
  });
}
