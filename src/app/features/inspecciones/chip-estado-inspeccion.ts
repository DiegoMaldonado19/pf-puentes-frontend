import { Component, computed, input } from '@angular/core';
import { TEXTOS } from '../../shared/textos';
import { EstadoInspeccion } from './modelos';

const CLASES: Readonly<Record<EstadoInspeccion, string>> = {
  BORRADOR: 'hvc-badge hvc-badge--off',
  ENVIADA: 'hvc-badge hvc-badge--accent',
  EN_REVISION: 'hvc-badge hvc-badge--warn',
  CAMBIOS_SOLICITADOS: 'hvc-badge hvc-badge--warn',
  PUBLICADA: 'hvc-badge hvc-badge--ok',
  RECHAZADA: 'hvc-badge hvc-badge--danger',
};

/** DT-FE-13: el estado se comunica con texto además del color. */
@Component({
  selector: 'app-chip-estado-inspeccion',
  template: `
    <span class="inline-flex items-center gap-1.5" [class]="clase()" [attr.data-estado]="estado()">
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
