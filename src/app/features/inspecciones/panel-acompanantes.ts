import { Component, input, output } from '@angular/core';
import { TEXTOS } from '../../shared/textos';
import { AcompananteDTO, MAXIMO_NOMBRE_ACOMPANANTE } from './modelos';

/** RN-INS-02: los acompañantes son un dato de captura; el PUT reemplaza la lista completa. */
@Component({
  selector: 'app-panel-acompanantes',
  template: `
    <section class="rounded border border-slate-300 p-4" aria-labelledby="titulo-acompanantes">
      <h2 id="titulo-acompanantes" class="text-lg font-semibold">{{ t.titulo }}</h2>
      <p class="mt-1 text-sm text-slate-700">{{ t.ayuda }}</p>
      <ul class="mt-3 grid gap-2">
        @for (acompanante of acompanantes(); track $index) {
          <li class="flex items-center gap-2">
            @if (editable()) {
              <label class="sr-only" [for]="'acompanante-' + $index">{{ t.nombre }}</label>
              <input
                [id]="'acompanante-' + $index"
                type="text"
                class="min-h-11 flex-1 rounded border border-slate-400 px-2"
                [attr.maxlength]="maximo"
                [value]="acompanante.nombre"
                (input)="cambiar.emit({ indice: $index, nombre: $any($event.target).value })"
              />
              <button
                type="button"
                class="min-h-11 text-red-800 underline"
                (click)="quitar.emit($index)"
              >
                {{ t.quitar }}
              </button>
            } @else {
              <span>{{ acompanante.nombre }}</span>
            }
          </li>
        } @empty {
          <li class="text-sm text-slate-600">{{ t.vacio }}</li>
        }
      </ul>
      @if (editable()) {
        <div class="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            class="min-h-11 rounded border border-blue-700 px-4 text-blue-800"
            (click)="agregar.emit()"
          >
            {{ t.agregar }}
          </button>
          <button
            type="button"
            class="min-h-11 rounded bg-blue-700 px-4 text-white disabled:opacity-50"
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
