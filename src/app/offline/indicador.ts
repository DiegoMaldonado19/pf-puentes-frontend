import { Component, computed, input } from '@angular/core';
import { TEXTOS } from '../shared/textos';
import { Operacion } from './modelos';

/** La navegación puede reutilizar el indicador sin montar el diagnóstico. */
@Component({
  selector: 'app-indicador-offline',
  template: `<p role="status">
    {{ t.inspecciones }}: {{ inspecciones() }} · {{ t.archivos }}: {{ archivos() }}
  </p>`,
})
export class IndicadorOffline {
  readonly operaciones = input.required<readonly Operacion[]>();
  readonly t = TEXTOS.offline;
  private readonly pendientes = computed(() =>
    this.operaciones().filter((o) => o.estado !== 'confirmada'),
  );
  readonly inspecciones = computed(
    () => new Set(this.pendientes().map((o) => o.inspeccion_id)).size,
  );
  readonly archivos = computed(
    () =>
      new Set(
        this.pendientes()
          .filter((o) => o.tipo === 'foto' || o.tipo === 'documento')
          .map((o) => o.entidad_id),
      ).size,
  );
}
