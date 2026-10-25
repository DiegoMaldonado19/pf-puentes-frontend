import { expect, test } from '@playwright/test';
import { crearRedDePrueba } from '../../scripts/pruebas-g5/red.mjs';

test('G5 — adaptador de red aislado continúa cuatro peticiones y aborta la quinta antes del envío', async ({
  browser,
}, testInfo) => {
  // Solo este contexto de instrumentación bloquea SW; las pruebas PWA lo conservan.
  const context = await browser.newContext({
    baseURL: 'http://localhost:8090',
    serviceWorkers: 'block',
  });
  try {
    const page = await context.newPage();
    const demoras: number[] = [];
    const red = crearRedDePrueba({
      esperar: async (ms: number) => {
        demoras.push(ms);
      },
    });
    await context.route('**/g5-sonda-inexistente', (route) => red.atender(route));
    await page.goto('/index.html');
    const resultados = await page.evaluate(async () => {
      const respuestas: (number | string)[] = [];
      for (let i = 0; i < 5; i++) {
        try {
          respuestas.push((await fetch('/g5-sonda-inexistente')).status);
        } catch {
          respuestas.push('red-interrumpida');
        }
      }
      return respuestas;
    });
    expect(resultados).toEqual([404, 404, 404, 404, 'red-interrumpida']);
    expect(demoras).toEqual([2000, 2500, 3000, 2000, 2500]);
    expect(red.registro()).toEqual(
      demoras.map((demora_ms, i) => ({
        orden: i + 1,
        demora_ms,
        accion: i === 4 ? 'abortar_antes' : 'continuar',
      })),
    );
    await testInfo.attach('G5-herramienta-aislada-no-V05-V06-V07', {
      body: JSON.stringify({ resultados, calendario: red.registro() }),
      contentType: 'application/json',
    });
  } finally {
    await context.close();
  }
});
