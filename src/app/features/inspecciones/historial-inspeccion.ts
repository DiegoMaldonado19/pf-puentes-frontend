import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { ChipEstadoInspeccion } from './chip-estado-inspeccion';
import { mensajeInspeccion } from './errores';
import { InspeccionApi } from './inspeccion-api';

/** Línea de tiempo de estados; tiene la misma visibilidad que la inspección (404 opaco). */
@Component({
  selector: 'app-historial-inspeccion',
  imports: [ChipEstadoInspeccion, DatePipe, RouterLink],
  template: `
    <section class="mx-auto max-w-3xl p-4" aria-labelledby="titulo-historial">
      <a [routerLink]="['/inspecciones', id()]" class="text-blue-800 underline"
        >← {{ comun.volver }}</a
      >
      <h1 id="titulo-historial" class="mt-3 text-2xl font-bold">{{ t.titulo }}</h1>
      <p class="my-3 text-slate-700">{{ t.descripcion }}</p>

      @if (historial.isLoading() && !historial.hasValue()) {
        <p role="status">{{ comun.cargando }}</p>
      } @else if (error()) {
        <p role="alert" class="rounded border border-red-700 bg-red-50 p-3 text-red-900">
          {{ error() }}
        </p>
      } @else {
        <ol class="grid gap-3 border-l-2 border-slate-300 pl-4">
          @for (transicion of historial.value() ?? []; track transicion.id) {
            <li class="rounded border border-slate-300 p-3">
              <div class="flex flex-wrap items-center gap-2">
                @if (transicion.estado_origen; as origen) {
                  <app-chip-estado-inspeccion [estado]="origen" />
                  <span aria-hidden="true">→</span>
                } @else {
                  <span class="text-sm text-slate-700">{{ t.origen }}</span>
                  <span aria-hidden="true">→</span>
                }
                <app-chip-estado-inspeccion [estado]="transicion.estado_destino" />
              </div>
              <p class="mt-2 text-sm text-slate-700">
                {{ transicion.creado_en | date: 'dd/MM/yyyy HH:mm' : '-0600' }} · {{ t.actor }}:
                {{ actor(transicion.actor_id) }}
              </p>
              @if (transicion.motivo) {
                <p class="mt-1 whitespace-pre-wrap">{{ t.motivo }}: {{ transicion.motivo }}</p>
              }
            </li>
          } @empty {
            <li class="text-slate-600">{{ t.vacio }}</li>
          }
        </ol>
      }
    </section>
  `,
})
export class HistorialInspeccion {
  readonly id = input.required<string>();

  protected readonly t = TEXTOS.inspecciones.historial;
  protected readonly comun = TEXTOS.inspecciones.comun;
  private readonly api = inject(InspeccionApi);
  private readonly auth = inject(AuthService);

  protected readonly historial = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.historial(params),
  });
  protected readonly error = computed(() =>
    this.historial.error() ? mensajeInspeccion(this.historial.error()) : '',
  );

  /** `actor_id` null = Sistema. No hay endpoint de nombres: se muestra un id corto. */
  protected actor(actorId: string | null): string {
    if (actorId === null) return this.t.sistema;
    return actorId === this.auth.usuario()?.id ? this.auth.usuario()!.nombre : actorId.slice(0, 8);
  }
}
