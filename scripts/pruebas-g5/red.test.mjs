import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearRedDePrueba } from './red.mjs';

test('calendario reproducible: 2–3 s, 20 % abortos y registro sin datos privados', async () => {
  async function ejecutar() {
    const esperas = [];
    const efectos = [];
    const red = crearRedDePrueba({ esperar: async (ms) => esperas.push(ms) });
    for (let i = 0; i < 10; i++) {
      await red.atender({
        abort: async (causa) => efectos.push(['aborto', causa]),
        continue: async () => efectos.push(['continua']),
        // No debe inspeccionar ni registrar peticiones/cabeceras/cuerpos.
        request: () => {
          throw new Error('No leer credenciales');
        },
      });
    }
    return { esperas, efectos, registro: red.registro() };
  }
  const resultado = await ejecutar();
  assert.deepEqual(resultado, await ejecutar());
  assert.deepEqual(resultado.esperas, [2000, 2500, 3000, 2000, 2500, 3000, 2000, 2500, 3000, 2000]);
  assert.deepEqual(
    resultado.efectos,
    Array.from({ length: 10 }, (_, i) =>
      (i + 1) % 5 === 0 ? ['aborto', 'connectionfailed'] : ['continua'],
    ),
  );
  assert.equal(resultado.registro.filter((r) => r.accion === 'abortar_antes').length, 2);
  assert.deepEqual(Object.keys(resultado.registro[0]), ['orden', 'demora_ms', 'accion']);
});

test('el registro es defensivo y registra solo efectos completados', async () => {
  const red = crearRedDePrueba({ esperar: async () => {} });
  await assert.rejects(
    red.atender({
      continue: async () => {
        throw new Error('ruta cerrada');
      },
    }),
    /ruta cerrada/,
  );
  assert.deepEqual(red.registro(), []);
  await red.atender({ continue: async () => {} });
  const copia = red.registro();
  copia[0].orden = 99;
  copia.push({});
  assert.deepEqual(red.registro(), [{ orden: 2, demora_ms: 2500, accion: 'continuar' }]);
});
