import assert from 'node:assert/strict';
import { test } from 'node:test';
import { casosConflicto, decisiones, escenarios } from './catalogo.mjs';

test('G5 inventaría V01–V21 sin acreditar aceptación integral', () => {
  assert.deepEqual(
    escenarios.map((e) => e.id),
    Array.from({ length: 21 }, (_, i) => `V${String(i + 1).padStart(2, '0')}`),
  );
  for (const escenario of escenarios) {
    assert.equal(escenario.estado, 'no_ejecutable');
    assert.ok(escenario.bloqueadores.length > 0);
    assert.ok(escenario.evidencia.length > 0);
  }
});

test('G5 conserva parámetros P5/#18 pendientes y casos V10/V15 trazables', () => {
  for (const decision of decisiones) {
    assert.equal(decision.valor, null);
    assert.ok(decision.responsable);
    assert.ok(decision.desbloquea.length > 0);
  }
  assert.deepEqual(new Set(casosConflicto.map((c) => c.validacion)), new Set(['V10', 'V15']));
  assert.deepEqual(
    casosConflicto.map((c) => c.id),
    [
      'divergencia',
      'replay',
      'rollback',
      'publicada',
      'ajeno',
      'sin-asignacion',
      'asignacion-vencida',
      'lectura-sin-permiso',
    ],
  );
  for (const caso of casosConflicto) {
    assert.equal(caso.estado, 'no_ejecutable');
    assert.ok(caso.invariantes.length > 0);
    assert.ok(caso.parametros.length > 0);
    for (const parametro of caso.parametros) {
      assert.ok(
        decisiones.some((d) => d.id === parametro),
        parametro,
      );
    }
  }
});
