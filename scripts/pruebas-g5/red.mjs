import { setTimeout } from 'node:timers/promises';

/** Adaptador de rutas Playwright exclusivo de pruebas. No observa bytes ni commits. */
export function crearRedDePrueba({ esperar = setTimeout } = {}) {
  let orden = 0;
  const registro = [];
  return {
    async atender(route) {
      const turno = ++orden;
      const demora_ms = [2000, 2500, 3000][(turno - 1) % 3];
      const accion = turno % 5 === 0 ? 'abortar_antes' : 'continuar';
      await esperar(demora_ms);
      if (accion === 'abortar_antes') await route.abort('connectionfailed');
      else await route.continue();
      registro.push({ orden: turno, demora_ms, accion });
    },
    registro: () => registro.map((evento) => ({ ...evento })),
  };
}
