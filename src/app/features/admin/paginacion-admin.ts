import { Component, input, output } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

/** Paginación de P2 (PaginaDTO.number). No reutiliza la de puentes. */
@Component({
  selector: 'app-paginacion-admin',
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
export class PaginacionAdmin {
  readonly pagina = input.required<number>();
  readonly totalPaginas = input.required<number>();
  readonly etiqueta = input<string>(TEXTOS.admin.paginacion.etiqueta);
  readonly cambiar = output<number>();
  protected readonly t = TEXTOS.admin.paginacion;
}
