import { Component, computed, input } from '@angular/core';
import { TEXTOS } from '../textos';

export type EstadoCondicion = 'BUENO' | 'REGULAR' | 'MALO';

/** Contrato 10: muestra el estado recibido; P3 entrega null si no hay inspección publicada. */
@Component({
  selector: 'app-estado-puente',
  template: `
    <span class="estado" [attr.data-estado]="estado() ?? 'SIN_EVALUAR'">
      <span class="indicador" aria-hidden="true"></span>
      <span>{{ etiqueta() }}</span>
    </span>
  `,
  styleUrl: './estado-puente.css',
})
export class EstadoPuente {
  readonly estado = input.required<EstadoCondicion | null>();
  protected readonly etiqueta = computed(() => TEXTOS.estadoPuente[this.estado() ?? 'SIN_EVALUAR']);
}
