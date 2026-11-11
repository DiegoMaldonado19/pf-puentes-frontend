import { Component, computed, input } from '@angular/core';
import { TEXTOS } from '../../shared/textos';
import { EstadoOrden } from './modelos';

/** Transiciones válidas de una orden. Espejo de `EstadoOrden.permite` en el backend. */
export const TRANSICIONES_ORDEN: Readonly<Record<EstadoOrden, readonly EstadoOrden[]>> = {
  PROPUESTA: ['PROGRAMADA', 'DESCARTADA'],
  PROGRAMADA: ['EN_EJECUCION', 'CANCELADA'],
  EN_EJECUCION: ['EJECUTADA'],
  EJECUTADA: [],
  DESCARTADA: [],
  CANCELADA: [],
};

/** Camino principal de una orden; DESCARTADA y CANCELADA son salidas laterales. */
const CAMINO: readonly EstadoOrden[] = ['PROPUESTA', 'PROGRAMADA', 'EN_EJECUCION', 'EJECUTADA'];

/** Línea de estados (B9): marca el paso actual y lista solo los pasos válidos desde él. */
@Component({
  selector: 'app-linea-estados-orden',
  template: `
    <section class="mt-4" [attr.aria-label]="t.titulo">
      <h3 class="text-sm font-semibold">{{ t.titulo }}</h3>
      <ol class="mt-2 flex flex-wrap items-center gap-2 text-sm">
        @for (paso of camino; track paso) {
          <li
            class="rounded-full border px-3 py-1"
            [class.bg-primario-700]="paso === estado()"
            [class.text-superficie]="paso === estado()"
            [class.font-bold]="paso === estado()"
            [attr.aria-current]="paso === estado() ? 'step' : null"
          >
            {{ etiquetas[paso] }}
          </li>
        }
      </ol>
      @if (ramaLateral(); as lateral) {
        <p class="mt-2 text-sm font-semibold">{{ lateral }}</p>
      }
      <p class="mt-2 text-sm">
        {{ t.siguientes }}: {{ siguientes().length ? nombresSiguientes() : t.cerrada }}
      </p>
    </section>
  `,
})
export class LineaEstadosOrden {
  readonly estado = input.required<EstadoOrden>();

  protected readonly t = TEXTOS.lineaEstadosOrden;
  protected readonly etiquetas = TEXTOS.mantenimiento.estados;
  protected readonly camino = CAMINO;
  protected readonly siguientes = computed(() => TRANSICIONES_ORDEN[this.estado()]);
  protected readonly nombresSiguientes = computed(() =>
    this.siguientes()
      .map((paso) => this.etiquetas[paso])
      .join(', '),
  );
  protected readonly ramaLateral = computed(() => {
    const estado = this.estado();
    return CAMINO.includes(estado) ? null : this.etiquetas[estado];
  });
}
