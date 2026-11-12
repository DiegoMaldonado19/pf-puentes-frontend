import { Component, input, output } from '@angular/core';
import { TEXTOS } from '../textos';

/**
 * Paginador único (F1): sustituye a los paginadores por pantalla. Con una sola página no se muestra.
 * `pagina` es base cero, como en las respuestas paginadas del backend.
 */
@Component({
  selector: 'app-paginador',
  template: `
    @if (totalPaginas() > 1) {
      <nav [attr.aria-label]="etiqueta()" class="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          class="pagination-btn"
          [disabled]="deshabilitado() || pagina() === 0"
          (click)="paginaCambia.emit(pagina() - 1)"
        >
          {{ t.anterior }}
        </button>
        <span class="text-muted" aria-live="polite"
          >{{ t.pagina }} {{ pagina() + 1 }} {{ t.de }} {{ totalPaginas() }}</span
        >
        <button
          type="button"
          class="pagination-btn"
          [disabled]="deshabilitado() || pagina() + 1 >= totalPaginas()"
          (click)="paginaCambia.emit(pagina() + 1)"
        >
          {{ t.siguiente }}
        </button>
      </nav>
    }
  `,
})
export class Paginador {
  readonly pagina = input.required<number>();
  readonly totalPaginas = input.required<number>();
  readonly deshabilitado = input(false);
  readonly etiqueta = input<string>(TEXTOS.paginador.etiqueta);
  readonly paginaCambia = output<number>();
  protected readonly t = TEXTOS.paginador;
}
