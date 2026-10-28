import { Component, computed, input } from '@angular/core';
import { TEXTOS } from '../../shared/textos';
import { EstadoInspeccion } from './modelos';

const CLASES: Readonly<Record<EstadoInspeccion, string>> = {
  BORRADOR: 'border-slate-500 bg-slate-100 text-slate-900',
  ENVIADA: 'border-blue-700 bg-blue-50 text-blue-900',
  EN_REVISION: 'border-amber-700 bg-amber-50 text-amber-900',
  CAMBIOS_SOLICITADOS: 'border-orange-700 bg-orange-50 text-orange-900',
  PUBLICADA: 'border-green-700 bg-green-50 text-green-900',
  RECHAZADA: 'border-red-700 bg-red-50 text-red-900',
};

/** DT-FE-13: el estado se comunica con texto además del color. */
@Component({
  selector: 'app-chip-estado-inspeccion',
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium"
      [class]="clase()"
      [attr.data-estado]="estado()"
    >
      <span class="size-2 rounded-full bg-current" aria-hidden="true"></span>
      {{ etiqueta() }}
    </span>
  `,
})
export class ChipEstadoInspeccion {
  readonly estado = input.required<EstadoInspeccion>();
  protected readonly clase = computed(() => CLASES[this.estado()]);
  protected readonly etiqueta = computed(() => TEXTOS.inspecciones.estados[this.estado()]);
}
