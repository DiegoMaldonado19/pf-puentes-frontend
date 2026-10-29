import { expect, test } from '@playwright/test';
import {
  ana,
  bea,
  abrir,
  autenticarFicticiamente,
  esperarShellOffline,
} from '../fixtures/sesion-offline';

for (const causa of ['cierre', 'cambio'] as const) {
  test(`G2 — reinicio offline, edición y revocación por ${causa} entre pestañas`, async ({
    page,
    context,
  }) => {
    let propietario = ana;
    await autenticarFicticiamente(context, () => propietario);
    await abrir(page);
    await page.evaluate(() => window.__sesionDemo!.entrar());
    await page.getByRole('button', { name: 'Preparar captura ficticia' }).click();
    await expect(page.getByText('versión 1', { exact: false })).toBeVisible();
    await esperarShellOffline(page);
    await context.unroute('**/api/v1/auth/**');
    await context.setOffline(true);
    await page.close();
    const local = await context.newPage();
    await abrir(local);
    expect(await local.evaluate(() => window.__sesionDemo!.auth.autenticado())).toBe(false);
    await local.evaluate(() => window.__sesionDemo!.editar());
    await expect(local.getByText('versión 2', { exact: false })).toBeVisible();
    const estado = await local.evaluate(async () => {
      const h = window.__sesionDemo!;
      await h.motor.drenar();
      return {
        cola: await h.persistencia.operaciones(h.propietario),
        envios: h.envios,
        datos: JSON.stringify(await Promise.all(h.db.tables.map((t) => t.toArray()))),
      };
    });
    expect(estado.envios).toBe(0);
    expect(estado.datos).not.toMatch(/token-solo-memoria|access_token|Authorization/);
    await context.setOffline(false);
    await autenticarFicticiamente(context, () => propietario);
    const otra = await context.newPage();
    await abrir(otra);
    if (causa === 'cambio') {
      propietario = bea;
      await otra.evaluate(() => window.__sesionDemo!.entrar());
    } else await otra.evaluate(() => window.__sesionDemo!.salir());
    await expect(local.getByText('versión 2', { exact: false })).toHaveCount(0);
    await context.unroute('**/api/v1/auth/**');
    await context.setOffline(true);
    await local.close();
    const reabierta = await context.newPage();
    await abrir(reabierta);
    expect(
      await reabierta.evaluate(() => window.__sesionDemo!.acceso.propietarioActual()),
    ).toBeNull();
    expect(
      await reabierta.evaluate(() =>
        window.__sesionDemo!.persistencia.operaciones(window.__sesionDemo!.propietario),
      ),
    ).toEqual(estado.cola);
    await context.setOffline(false);
    propietario = ana;
    await autenticarFicticiamente(context, () => propietario);
    await reabierta.evaluate(() => window.__sesionDemo!.entrar());
    await expect(reabierta.getByText('versión 2', { exact: false })).toBeVisible();
  });
}
