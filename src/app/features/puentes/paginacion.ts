import { Component, input, output } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

@Component({
  selector: 'app-paginacion',
  template: `
    @if (totalPaginas() > 1) {
      <nav [attr.aria-label]="etiqueta()" class="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          class="pagination-btn"
          [disabled]="pagina() === 0"
          (click)="cambiar.emit(pagina() - 1)"
        >
          {{ t.anterior }}
        </button>
        <span class="text-muted" aria-live="polite"
          >{{ t.pagina }} {{ pagina() + 1 }} {{ t.de }} {{ totalPaginas() }}</span
        >
        <button
          type="button"
          class="pagination-btn"
          [disabled]="pagina() + 1 >= totalPaginas()"
          (click)="cambiar.emit(pagina() + 1)"
        >
          {{ t.siguiente }}
        </button>
      </nav>
    }
  `,
})
export class Paginacion {
  readonly pagina = input.required<number>();
  readonly totalPaginas = input.required<number>();
  readonly etiqueta = input<string>(TEXTOS.puentes.paginacion.etiqueta);
  readonly cambiar = output<number>();
  protected readonly t = TEXTOS.puentes.paginacion;
}
