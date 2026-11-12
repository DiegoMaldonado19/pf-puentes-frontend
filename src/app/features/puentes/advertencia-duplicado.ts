import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TEXTOS } from '../../shared/textos';
import { PuenteCercanoDTO } from './modelos';

/** RN-INV-06: advierte, no bloquea; el usuario decide si continúa. */
@Component({
  selector: 'app-advertencia-duplicado',
  imports: [DecimalPipe, RouterLink],
  template: `
    <section
      role="alert"
      aria-labelledby="titulo-duplicado"
      class="hvc-alert hvc-alert--warn bg-regular-tinte"
    >
      <h2 id="titulo-duplicado" class="text-lg font-semibold">{{ t.titulo }}</h2>
      <p class="mt-1">{{ t.explicacion }}</p>
      <ul class="mt-2 list-disc pl-6">
        @for (puente of cercanos(); track puente.id) {
          <li>
            <a [routerLink]="['/puentes', puente.id]" target="_blank" class="hvc-link">
              {{ puente.codigo }} — {{ puente.nombre }}
            </a>
            ({{ puente.distancia_metros | number: '1.0-1' }} {{ t.metros }})
          </li>
        }
      </ul>
      <div class="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded bg-regular-texto px-4 py-2 font-medium text-superficie hover:bg-regular-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-regular disabled:opacity-50"
          [disabled]="enviando()"
          (click)="confirmar.emit()"
        >
          {{ textoConfirmar() }}
        </button>
        <button
          type="button"
          class="rounded border border-regular px-4 py-2 font-medium hover:bg-regular-tinte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-regular"
          [disabled]="enviando()"
          (click)="cancelar.emit()"
        >
          {{ t.cancelar }}
        </button>
      </div>
    </section>
  `,
})
export class AdvertenciaDuplicado {
  readonly cercanos = input.required<readonly PuenteCercanoDTO[]>();
  readonly enviando = input(false);
  readonly textoConfirmar = input<string>(TEXTOS.puentes.duplicado.confirmar);
  readonly confirmar = output();
  readonly cancelar = output();
  protected readonly t = TEXTOS.puentes.duplicado;
}
