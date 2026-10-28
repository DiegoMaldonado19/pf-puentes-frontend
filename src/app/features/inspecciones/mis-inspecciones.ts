import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { fechaSinHora } from '../puentes/formato';
import { ChipEstadoInspeccion } from './chip-estado-inspeccion';
import { mensajeInspeccion } from './errores';
import { InspeccionApi, TAMANO_PAGINA } from './inspeccion-api';
import { EstadoInspeccion, FiltrosInspecciones } from './modelos';

const ESTADOS: readonly EstadoInspeccion[] = [
  'BORRADOR',
  'ENVIADA',
  'EN_REVISION',
  'CAMBIOS_SOLICITADOS',
  'PUBLICADA',
  'RECHAZADA',
];

@Component({
  selector: 'app-mis-inspecciones',
  imports: [ChipEstadoInspeccion, DatePipe, ReactiveFormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-5xl p-4" aria-labelledby="titulo-mias">
      <h1 id="titulo-mias" class="text-2xl font-bold">{{ t.titulo }}</h1>
      <p class="my-3 text-slate-700">{{ t.descripcion }}</p>
      @if (puedeInspeccionar()) {
        <a
          routerLink="/inspecciones/puentes"
          class="inline-flex min-h-11 items-center rounded bg-blue-700 px-4 font-medium text-white"
          >{{ t.nueva }}</a
        >
      }

      <form
        class="mt-4 grid gap-3 rounded border border-slate-300 p-4 sm:grid-cols-4"
        [formGroup]="filtros"
        [attr.aria-label]="t.filtros"
        (ngSubmit)="aplicar()"
      >
        <label class="grid gap-1 text-sm font-medium">
          {{ comun.estado }}
          <select class="min-h-11 rounded border border-slate-400 px-2" formControlName="estado">
            <option value="">{{ t.todosEstados }}</option>
            @for (estado of estados; track estado) {
              <option [value]="estado">{{ etiquetas[estado] }}</option>
            }
          </select>
        </label>
        <label class="grid gap-1 text-sm font-medium">
          {{ t.desde }}
          <input
            type="date"
            class="min-h-11 rounded border border-slate-400 px-2"
            formControlName="desde"
          />
        </label>
        <label class="grid gap-1 text-sm font-medium">
          {{ t.hasta }}
          <input
            type="date"
            class="min-h-11 rounded border border-slate-400 px-2"
            formControlName="hasta"
          />
        </label>
        <div class="flex items-end gap-2">
          <button type="submit" class="min-h-11 rounded bg-blue-700 px-4 text-white">
            {{ t.aplicar }}
          </button>
          <button type="button" class="min-h-11 rounded border px-4" (click)="limpiar()">
            {{ t.limpiar }}
          </button>
        </div>
      </form>

      @if (inspecciones.isLoading() && !inspecciones.hasValue()) {
        <p role="status" class="mt-4">{{ comun.cargando }}</p>
      } @else if (error()) {
        <p role="alert" class="mt-4 rounded border border-red-700 bg-red-50 p-3 text-red-900">
          {{ error() }}
          <button type="button" class="ml-3 underline" (click)="inspecciones.reload()">
            {{ comun.reintentar }}
          </button>
        </p>
      } @else if (inspecciones.value(); as datos) {
        <p class="mt-4 text-slate-600">{{ t.total }}: {{ datos.total_elements }}</p>
        <ul class="mt-2 grid gap-3" [attr.aria-busy]="inspecciones.isLoading()">
          @for (fila of datos.content; track fila.id) {
            <li class="rounded border border-slate-300 p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="font-mono text-sm text-slate-700">{{ fila.puente.codigo }}</p>
                  <h2 class="text-lg font-semibold">{{ fila.puente.nombre }}</h2>
                  <p class="text-sm text-slate-700">
                    {{ comun.fecha }}: {{ fechaSinHora(fila.fecha_inspeccion) }}
                  </p>
                  <p class="text-xs text-slate-600">
                    {{ fila.creado_en | date: 'dd/MM/yyyy HH:mm' : '-0600' }}
                  </p>
                </div>
                <div class="grid justify-items-end gap-2">
                  <app-chip-estado-inspeccion [estado]="fila.estado" />
                  @if (fila.superada) {
                    <span class="text-sm text-slate-700">{{ comun.superada }}</span>
                  }
                </div>
              </div>
              <div class="mt-3 flex flex-wrap gap-4">
                <a
                  class="inline-flex min-h-11 items-center text-blue-800 underline"
                  [routerLink]="['/inspecciones', fila.id]"
                  >{{ comun.verDetalle }}</a
                >
                <a
                  class="inline-flex min-h-11 items-center text-blue-800 underline"
                  [routerLink]="['/inspecciones', fila.id, 'historial']"
                  >{{ comun.verHistorial }}</a
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
export class MisInspecciones {
  /** Query params enlazados por withComponentInputBinding (p. ej. «Continuar borrador»). */
  readonly puente_id = input<string | undefined>(undefined);
  readonly estado = input<EstadoInspeccion | undefined>(undefined);

  protected readonly t = TEXTOS.inspecciones.mias;
  protected readonly comun = TEXTOS.inspecciones.comun;
  protected readonly etiquetas = TEXTOS.inspecciones.estados;
  protected readonly estados = ESTADOS;
  protected readonly fechaSinHora = fechaSinHora;
  protected readonly pagina = signal(0);
  protected readonly filtros = new FormGroup({
    estado: new FormControl<EstadoInspeccion | ''>('', { nonNullable: true }),
    desde: new FormControl('', { nonNullable: true }),
    hasta: new FormControl('', { nonNullable: true }),
  });
  private readonly aplicados = signal<
    Pick<FiltrosInspecciones, 'estado' | 'fecha_desde' | 'fecha_hasta'>
  >({});

  private readonly api = inject(InspeccionApi);
  private readonly auth = inject(AuthService);
  protected readonly puedeInspeccionar = computed(() => this.auth.rol() !== 'ADMINISTRADOR');

  protected readonly inspecciones = rxResource({
    params: () => ({
      filtros: this.filtrosEfectivos(),
      pagina: this.pagina(),
    }),
    stream: ({ params }) => this.api.listar(params.filtros, params.pagina, TAMANO_PAGINA),
  });
  protected readonly error = computed(() =>
    this.inspecciones.error() ? mensajeInspeccion(this.inspecciones.error()) : '',
  );

  /** Mientras el usuario no toque los filtros rigen los de la URL («Continuar borrador»). */
  private readonly usarIniciales = signal(true);
  private readonly filtrosEfectivos = computed<FiltrosInspecciones>(() =>
    this.usarIniciales()
      ? { puente_id: this.puente_id(), estado: this.estado() }
      : this.aplicados(),
  );

  constructor() {
    effect(() => {
      const estado = this.estado();
      if (estado && this.usarIniciales()) this.filtros.controls.estado.setValue(estado);
    });
  }

  protected aplicar(): void {
    const { estado, desde, hasta } = this.filtros.getRawValue();
    this.usarIniciales.set(false);
    this.pagina.set(0);
    this.aplicados.set({
      estado: estado || undefined,
      fecha_desde: desde || undefined,
      fecha_hasta: hasta || undefined,
    });
  }

  protected limpiar(): void {
    this.filtros.reset();
    this.usarIniciales.set(false);
    this.aplicados.set({});
    this.pagina.set(0);
  }
}
