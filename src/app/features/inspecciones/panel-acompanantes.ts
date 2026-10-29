import { Component, input, output } from '@angular/core';
import { TEXTOS } from '../../shared/textos';
import { AcompananteDTO, MAXIMO_NOMBRE_ACOMPANANTE } from './modelos';

/** RN-INS-02: los acompañantes son un dato de captura; el PUT reemplaza la lista completa. */
@Component({
  selector: 'app-panel-acompanantes',
  template: `
    <section class="hvc-card" aria-labelledby="titulo-acompanantes">
      <h2 id="titulo-acompanantes" class="text-lg font-semibold">{{ t.titulo }}</h2>
      <p class="text-muted mt-1">{{ t.ayuda }}</p>
      <ul class="mt-3 grid gap-2">
        @for (acompanante of acompanantes(); track $index) {
          <li class="flex items-center gap-2">
            @if (editable()) {
              <label class="sr-only" [for]="'acompanante-' + $index">{{ t.nombre }}</label>
              <input
                [id]="'acompanante-' + $index"
                type="text"
                class="hvc-input flex-1"
                [attr.maxlength]="maximo"
                [value]="acompanante.nombre"
                (input)="cambiar.emit({ indice: $index, nombre: $any($event.target).value })"
              />
              <button type="button" class="btn-hvc-danger" (click)="quitar.emit($index)">
                {{ t.quitar }}
              </button>
            } @else {
              <span>{{ acompanante.nombre }}</span>
            }
          </li>
        } @empty {
          <li class="text-muted">{{ t.vacio }}</li>
        }
      </ul>
      @if (editable()) {
        <div class="mt-3 flex flex-wrap gap-3">
          <button type="button" class="btn-hvc-secondary" (click)="agregar.emit()">
            {{ t.agregar }}
          </button>
          <button
            type="button"
            class="btn-hvc-primary"
            [disabled]="ocupado()"
            (click)="guardar.emit()"
          >
            {{ t.guardar }}
          </button>
        </div>
      }
    </section>
  `,
})
export class PanelAcompanantes {
  readonly acompanantes = input.required<readonly AcompananteDTO[]>();
  readonly editable = input.required<boolean>();
  readonly ocupado = input(false);

  readonly agregar = output();
  readonly cambiar = output<{ indice: number; nombre: string }>();
  readonly quitar = output<number>();
  readonly guardar = output();

  protected readonly t = TEXTOS.inspecciones.acompanantes;
  protected readonly maximo = MAXIMO_NOMBRE_ACOMPANANTE;
}
