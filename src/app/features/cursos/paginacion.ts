import { Component, input, output } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

@Component({
  selector: 'app-paginacion-cursos',
  template: `
    <nav [attr.aria-label]="etiqueta()">
      <button
        type="button"
        [disabled]="ocupado() || pagina() === 0"
        (click)="cambio.emit(pagina() - 1)"
      >
        {{ textos.anterior }}
      </button>
      <span>{{ textos.pagina }} {{ paginas() ? pagina() + 1 : 0 }} / {{ paginas() }}</span>
      <button
        type="button"
        [disabled]="ocupado() || pagina() + 1 >= paginas()"
        (click)="cambio.emit(pagina() + 1)"
      >
        {{ textos.siguiente }}
      </button>
    </nav>
  `,
  styles: `
    nav {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1rem 0;
    }
    button {
      min-height: 44px;
      padding: 0.5rem 1rem;
      color: #1e40af;
      background: #fff;
      border: 1px solid #1e40af;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      background: #eff6ff;
    }
    button:disabled {
      color: #6b7280;
      border-color: #d1d5db;
      cursor: default;
    }
    button:focus-visible {
      outline: 3px solid #2563eb;
      outline-offset: 3px;
    }
  `,
})
export class PaginacionCursos {
  readonly textos = TEXTOS.cursos;
  readonly pagina = input(0);
  readonly paginas = input(0);
  readonly ocupado = input(false);
  readonly etiqueta = input.required<string>();
  readonly cambio = output<number>();
}
