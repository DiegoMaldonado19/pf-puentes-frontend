import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { CalificacionRevision } from './calificacion-revision';
import { CicloRevision, PaginaSeguimiento, RevisionApi } from './revision-api';

@Component({
  selector: 'app-historial-revisiones',
  imports: [DatePipe, CalificacionRevision],
  template: `
    <section class="my-6" [attr.aria-label]="t.historial" [attr.aria-busy]="ocupado()">
      <h2 class="my-4 text-xl font-semibold">{{ t.historial }}</h2>
      <p class="text-slate-600">{{ t.historialDescripcion }}</p>
      @if (error()) {
        <p role="alert" class="my-3 rounded bg-red-50 p-3 text-red-800">{{ error() }}</p>
      }
      <button
        type="button"
        class="my-3 min-h-11 rounded border border-slate-400 px-3"
        [disabled]="ocupado()"
        (click)="cargar(pagina()?.number ?? 0)"
      >
        {{ t.actualizar }}
      </button>
      @if (pagina(); as datos) {
        <ol class="grid gap-4">
          @for (ciclo of datos.content; track ciclo.id) {
            <li class="rounded border border-slate-300 p-4">
              <h3 class="font-semibold">{{ ciclo.veredicto || t.enRevision }}</h3>
              <p class="break-all text-sm text-slate-600">
                {{ t.ciclo }}: {{ ciclo.id }} ·
                {{ ciclo.creado_en | date: 'dd/MM/yyyy HH:mm' : '-0600' }}
              </p>
              <p class="my-2 whitespace-pre-wrap">{{ ciclo.observacion }}</p>
              <ul class="grid gap-3">
                @for (observacion of ciclo.observaciones; track observacion.id) {
                  <li class="rounded bg-slate-50 p-3">
                    <strong class="break-all">{{ observacion.elemento_ref }}</strong>
                    <p class="whitespace-pre-wrap">{{ observacion.texto }}</p>
                    @if (observacion.resuelta_en) {
                      <p class="text-sm text-green-800">
                        {{ t.resuelta }}:
                        {{ observacion.resuelta_en | date: 'dd/MM/yyyy HH:mm' : '-0600' }}
                      </p>
                    } @else if (
                      puedeResolver() && ciclo.estado === 'BORRADOR' && ciclo.emitida_en
                    ) {
                      <button
                        class="mt-2 min-h-11 rounded bg-blue-700 px-3 text-white disabled:opacity-50"
                        type="button"
                        [disabled]="ocupado()"
                        (click)="resolver(observacion.id)"
                      >
                        {{ t.resolver }}
                      </button>
                    } @else {
                      <p class="text-sm text-slate-600">{{ t.pendiente }}</p>
                    }
                  </li>
                }
              </ul>
              <app-calificacion-revision [revisionId]="ciclo.id" />
            </li>
          } @empty {
            <li class="rounded bg-slate-100 p-4">{{ t.sinHistorial }}</li>
          }
        </ol>
        <nav class="mt-4 flex items-center gap-4" [attr.aria-label]="t.paginas">
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
    </section>
  `,
})
export class HistorialRevisiones {
  readonly inspeccionId = input.required<string>();
  readonly puedeResolver = input(false);
  readonly t = TEXTOS.revision;
  readonly pagina = signal<PaginaSeguimiento<CicloRevision> | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  private readonly api = inject(RevisionApi);
  private readonly auth = inject(AuthService);
  private readonly destruir = inject(DestroyRef);
  private generacion = 0;

  constructor() {
    effect(() => {
      this.inspeccionId();
      const actor = this.auth.usuario()?.id;
      this.generacion++;
      this.pagina.set(null);
      this.ocupado.set(false);
      if (actor) untracked(() => this.cargar());
    });
  }
  cargar(numero = 0) {
    const generacion = ++this.generacion;
    this.ocupado.set(true);
    this.error.set('');
    this.pagina.set(null);
    this.api
      .historial(this.inspeccionId(), numero)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (pagina) => {
          if (generacion === this.generacion) {
            this.pagina.set(pagina);
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
    if (!this.puedeResolver() || this.ocupado()) return;
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
            this.error.set(this.t.errorSeguimiento);
          }
        },
      });
  }
}
