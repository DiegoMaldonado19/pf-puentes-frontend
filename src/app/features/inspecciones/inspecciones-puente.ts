import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { fechaSinHora } from '../puentes/formato';
import { ChipEstadoInspeccion } from './chip-estado-inspeccion';
import { mensajeInspeccion } from './errores';
import { InspeccionApi, TAMANO_PAGINA } from './inspeccion-api';

/** `/puentes/:id/inspecciones`: publicadas del puente más los borradores propios (RN-INS-05). */
@Component({
  selector: 'app-inspecciones-puente',
  imports: [ChipEstadoInspeccion, DatePipe, RouterLink],
  template: `
    <section class="mx-auto max-w-5xl p-4" aria-labelledby="titulo-del-puente">
      <a [routerLink]="['/puentes', id()]" class="text-blue-800 underline">← {{ comun.volver }}</a>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 id="titulo-del-puente" class="text-2xl font-bold">{{ t.titulo }}</h1>
        @if (puedeInspeccionar()) {
          <a
            class="inline-flex min-h-11 items-center rounded bg-blue-700 px-4 font-medium text-white"
            [routerLink]="['/inspecciones/nueva', id()]"
            >{{ t.iniciar }}</a
          >
        }
      </div>
      <p class="my-3 text-slate-700">{{ t.descripcion }}</p>

      @if (inspecciones.isLoading() && !inspecciones.hasValue()) {
        <p role="status">{{ comun.cargando }}</p>
      } @else if (error()) {
        <p role="alert" class="rounded border border-red-700 bg-red-50 p-3 text-red-900">
          {{ error() }}
        </p>
      } @else if (inspecciones.value(); as datos) {
        <ul class="grid gap-3" [attr.aria-busy]="inspecciones.isLoading()">
          @for (fila of datos.content; track fila.id) {
            <li
              class="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-300 p-4"
            >
              <div>
                <p class="font-medium">
                  {{ comun.fecha }}: {{ fechaSinHora(fila.fecha_inspeccion) }}
                </p>
                <p class="text-xs text-slate-600">
                  {{ fila.creado_en | date: 'dd/MM/yyyy HH:mm' : '-0600' }}
                </p>
                @if (fila.superada) {
                  <p class="text-sm text-slate-700">{{ comun.superada }}</p>
                }
              </div>
              <div class="flex flex-wrap items-center gap-4">
                <app-chip-estado-inspeccion [estado]="fila.estado" />
                <a
                  class="inline-flex min-h-11 items-center text-blue-800 underline"
                  [routerLink]="['/inspecciones', fila.id]"
                  >{{ comun.verDetalle }}</a
                >
              </div>
            </li>
          } @empty {
            <li role="status" class="rounded bg-slate-100 p-8 text-center">{{ t.vacio }}</li>
          }
        </ul>
        <nav class="mt-5 flex items-center gap-4" [attr.aria-label]="comun.paginas">
          <button
            type="button"
            class="min-h-11 rounded border px-3 disabled:opacity-50"
            [disabled]="datos.number === 0 || inspecciones.isLoading()"
            (click)="pagina.set(datos.number - 1)"
          >
            {{ comun.anterior }}
          </button>
          <span>{{ datos.number + 1 }} / {{ datos.total_pages || 1 }}</span>
          <button
            type="button"
            class="min-h-11 rounded border px-3 disabled:opacity-50"
            [disabled]="datos.number + 1 >= datos.total_pages || inspecciones.isLoading()"
            (click)="pagina.set(datos.number + 1)"
          >
            {{ comun.siguiente }}
          </button>
        </nav>
      }
    </section>
  `,
})
export class InspeccionesPuente {
  readonly id = input.required<string>();

  protected readonly t = TEXTOS.inspecciones.delPuente;
  protected readonly comun = TEXTOS.inspecciones.comun;
  protected readonly fechaSinHora = fechaSinHora;
  protected readonly pagina = signal(0);
  private readonly api = inject(InspeccionApi);
  private readonly auth = inject(AuthService);

  /** El Administrador consulta pero no inspecciona (decisión 1 de las historias). */
  protected readonly puedeInspeccionar = computed(
    () => this.auth.rol() !== null && this.auth.rol() !== 'ADMINISTRADOR',
  );
  protected readonly inspecciones = rxResource({
    params: () => ({ id: this.id(), pagina: this.pagina() }),
    stream: ({ params }) => this.api.deUnPuente(params.id, params.pagina, TAMANO_PAGINA),
  });
  protected readonly error = computed(() =>
    this.inspecciones.error() ? mensajeInspeccion(this.inspecciones.error()) : '',
  );
}
