import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import {
  InspeccionRevisada,
  PaginaSeguimiento,
  PendienteRevisionEstudiante,
  RevisionApi,
} from './revision-api';

@Component({
  selector: 'app-mis-revisiones',
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-6xl p-4" [attr.aria-busy]="ocupado()">
      <h1 class="text-2xl font-bold">{{ t.misPendientes }}</h1>
      <p class="my-3 text-slate-700">{{ t.resolucionDescripcion }}</p>
      <button
        class="my-3 min-h-11 rounded border border-blue-700 px-4 text-blue-800"
        type="button"
        [disabled]="ocupado()"
        (click)="cargar(pagina()?.number ?? 0)"
      >
        {{ t.actualizar }}
      </button>
      @if (error()) {
        <p role="alert" class="my-3 rounded bg-red-50 p-4 text-red-800">{{ error() }}</p>
      }
      @if (pagina(); as datos) {
        <p class="mb-3 text-slate-600">{{ t.totalPendientes }}: {{ datos.total_elements }}</p>
        <ul class="grid gap-4">
          @for (observacion of datos.content; track observacion.id) {
            <li class="rounded border border-slate-300 p-5">
              <h2 class="text-lg font-semibold">{{ observacion.puente_codigo }}</h2>
              <p class="break-all text-sm text-slate-600">
                {{ observacion.elemento_ref }} · {{ observacion.estado }}
              </p>
              <p class="my-3 whitespace-pre-wrap">{{ observacion.texto }}</p>
              <a
                class="mr-4 inline-flex min-h-11 items-center text-blue-800 underline"
                [routerLink]="['/historial-revisiones', observacion.inspeccion_id]"
                >{{ t.verHistorial }}</a
              >
              @if (observacion.estado === 'BORRADOR') {
                <button
                  type="button"
                  class="min-h-11 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
                  [disabled]="ocupado()"
                  (click)="resolver(observacion.id)"
                >
                  {{ t.resolver }}
                </button>
              } @else {
                <p class="text-sm text-slate-600">{{ t.soloBorrador }}</p>
              }
            </li>
          } @empty {
            <li role="status" class="rounded bg-slate-100 p-8 text-center">
              {{ t.sinPendientes }}
            </li>
          }
        </ul>
        <nav class="mt-5 flex items-center gap-4" [attr.aria-label]="t.paginas">
          <button
            type="button"
            class="min-h-11 rounded border px-3 disabled:opacity-50"
            [disabled]="ocupado() || datos.number === 0"
            (click)="cargar(datos.number - 1)"
          >
            {{ t.anterior }}
          </button>
          <span>{{ datos.number + 1 }} / {{ datos.total_pages || 1 }}</span>
          <button
            type="button"
            class="min-h-11 rounded border px-3 disabled:opacity-50"
            [disabled]="ocupado() || datos.number + 1 >= datos.total_pages"
            (click)="cargar(datos.number + 1)"
          >
            {{ t.siguientePagina }}
          </button>
        </nav>
      }
      @if (inspecciones(); as historial) {
        <h2 class="mb-4 mt-8 text-xl font-semibold">{{ t.misInspecciones }}</h2>
        <ul class="grid gap-3">
          @for (fila of historial.content; track fila.inspeccion_id) {
            <li class="rounded border border-slate-300 p-4">
              <strong>{{ fila.puente_codigo }}</strong
              ><span class="mx-3 text-slate-600">{{ fila.estado }}</span
              ><a
                class="text-blue-800 underline"
                [routerLink]="['/historial-revisiones', fila.inspeccion_id]"
                >{{ t.verHistorial }}</a
              >
            </li>
          } @empty {
            <li class="rounded bg-slate-100 p-4">{{ t.sinHistorial }}</li>
          }
        </ul>
        <nav class="mt-4 flex items-center gap-4" [attr.aria-label]="t.historial">
          <button
            type="button"
            class="min-h-11 rounded border px-3"
            [disabled]="ocupado() || historial.number === 0"
            (click)="cargar(pagina()?.number ?? 0, historial.number - 1)"
          >
            {{ t.anterior }}
          </button>
          <span>{{ historial.number + 1 }} / {{ historial.total_pages || 1 }}</span>
          <button
            type="button"
            class="min-h-11 rounded border px-3"
            [disabled]="ocupado() || historial.number + 1 >= historial.total_pages"
            (click)="cargar(pagina()?.number ?? 0, historial.number + 1)"
          >
            {{ t.siguientePagina }}
          </button>
        </nav>
      }
    </section>
  `,
})
export class MisRevisiones {
  readonly t = TEXTOS.revision;
  readonly pagina = signal<PaginaSeguimiento<PendienteRevisionEstudiante> | null>(null);
  readonly inspecciones = signal<PaginaSeguimiento<InspeccionRevisada> | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  private readonly auth = inject(AuthService);
  private readonly api = inject(RevisionApi);
  private readonly router = inject(Router);
  private readonly destruir = inject(DestroyRef);
  private generacion = 0;
  constructor() {
    effect(() => {
      const actor = this.auth.usuario()?.id;
      const permitido = this.auth.autenticado() && this.auth.rol() === 'ESTUDIANTE';
      this.generacion++;
      this.pagina.set(null);
      this.inspecciones.set(null);
      this.ocupado.set(false);
      if (actor && permitido) untracked(() => this.cargar());
      else void this.router.navigateByUrl('/login');
    });
  }
  cargar(numero = 0, paginaHistorial = this.inspecciones()?.number ?? 0) {
    const generacion = ++this.generacion;
    this.pagina.set(null);
    this.inspecciones.set(null);
    this.ocupado.set(true);
    this.error.set('');
    forkJoin({
      pendientes: this.api.misPendientes(numero),
      inspecciones: this.api.misInspecciones(paginaHistorial),
    })
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (datos) => {
          if (generacion === this.generacion) {
            this.pagina.set(datos.pendientes);
            this.inspecciones.set(datos.inspecciones);
            this.ocupado.set(false);
          }
        },
        error: () => {
          if (generacion === this.generacion) {
            this.ocupado.set(false);
            this.error.set(this.t.errorSeguimiento);
          }
        },
      });
  }
  resolver(id: string) {
    if (this.ocupado()) return;
    const numero = this.pagina()?.number ?? 0;
    const generacion = this.generacion;
    this.ocupado.set(true);
    this.api
      .resolver(id)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: () => {
          if (generacion === this.generacion) this.cargar(numero);
        },
        error: () => {
          if (generacion === this.generacion) {
            this.ocupado.set(false);
            this.pagina.set(null);
            this.error.set(this.t.errorSeguimiento);
          }
        },
      });
  }
}
