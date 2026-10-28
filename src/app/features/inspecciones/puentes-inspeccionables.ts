import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TEXTOS } from '../../shared/textos';
import { mensajeInspeccion } from './errores';
import { InspeccionApi, TAMANO_PAGINA } from './inspeccion-api';

@Component({
  selector: 'app-puentes-inspeccionables',
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-5xl p-4" aria-labelledby="titulo-inspeccionables">
      <h1 id="titulo-inspeccionables" class="text-2xl font-bold">{{ t.titulo }}</h1>
      <p class="my-3 text-slate-700">{{ t.descripcion }}</p>
      <a routerLink="/inspecciones" class="text-blue-800 underline">{{ t.verMias }}</a>

      @if (puentes.isLoading() && !puentes.hasValue()) {
        <p role="status" class="mt-4">{{ comun.cargando }}</p>
      } @else if (error()) {
        <p role="alert" class="mt-4 rounded border border-red-700 bg-red-50 p-3 text-red-900">
          {{ error() }}
          <button type="button" class="ml-3 underline" (click)="puentes.reload()">
            {{ comun.reintentar }}
          </button>
        </p>
      } @else if (puentes.value(); as datos) {
        <ul class="mt-4 grid gap-3" [attr.aria-busy]="puentes.isLoading()">
          @for (puente of datos.content; track puente.id) {
            <li
              class="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-300 p-4"
            >
              <div>
                <p class="font-mono text-sm text-slate-700">{{ puente.codigo }}</p>
                <h2 class="text-lg font-semibold">{{ puente.nombre }}</h2>
                <p class="text-sm text-slate-700">
                  {{ t.curso }}: {{ puente.curso_nombre ?? t.sinCurso }}
                </p>
                @if (puente.borrador_en_curso) {
                  <p
                    class="mt-1 inline-block rounded-full border border-amber-700 bg-amber-50 px-2.5 py-0.5 text-sm font-medium text-amber-900"
                  >
                    {{ t.borradorEnCurso }}
                  </p>
                }
              </div>
              @if (puente.borrador_en_curso) {
                <a
                  class="inline-flex min-h-11 items-center rounded bg-blue-700 px-4 font-medium text-white"
                  routerLink="/inspecciones"
                  [queryParams]="{ puente_id: puente.id, estado: 'BORRADOR' }"
                  >{{ t.continuar }}</a
                >
              } @else {
                <a
                  class="inline-flex min-h-11 items-center rounded bg-blue-700 px-4 font-medium text-white"
                  [routerLink]="['/inspecciones/nueva', puente.id]"
                  [queryParams]="puente.curso_id ? { curso: puente.curso_id } : null"
                  >{{ t.inspeccionar }}</a
                >
              }
            </li>
          } @empty {
            <li role="status" class="rounded bg-slate-100 p-8 text-center">{{ t.vacio }}</li>
          }
        </ul>
        <nav class="mt-5 flex items-center gap-4" [attr.aria-label]="comun.paginas">
          <button
            type="button"
            class="min-h-11 rounded border px-3 disabled:opacity-50"
            [disabled]="datos.number === 0 || puentes.isLoading()"
            (click)="pagina.set(datos.number - 1)"
          >
            {{ comun.anterior }}
          </button>
          <span>{{ datos.number + 1 }} / {{ datos.total_pages || 1 }}</span>
          <button
            type="button"
            class="min-h-11 rounded border px-3 disabled:opacity-50"
            [disabled]="datos.number + 1 >= datos.total_pages || puentes.isLoading()"
            (click)="pagina.set(datos.number + 1)"
          >
            {{ comun.siguiente }}
          </button>
        </nav>
      }
    </section>
  `,
})
export class PuentesInspeccionables {
  protected readonly t = TEXTOS.inspecciones.puentes;
  protected readonly comun = TEXTOS.inspecciones.comun;
  protected readonly pagina = signal(0);
  private readonly api = inject(InspeccionApi);

  protected readonly puentes = rxResource({
    params: () => this.pagina(),
    stream: ({ params }) => this.api.puentesInspeccionables(params, TAMANO_PAGINA),
  });
  protected readonly error = computed(() =>
    this.puentes.error() ? mensajeInspeccion(this.puentes.error()) : '',
  );
}
