import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { RevisionApi } from './revision-api';

@Component({
  selector: 'app-calificacion-revision',
  imports: [ReactiveFormsModule],
  template: `
    <section class="hvc-card my-4" [attr.aria-label]="t.calificacionPrivada">
      <h3 class="text-h3">{{ t.calificacionPrivada }}</h3>
      <p class="text-muted">{{ t.privacidadNota }}</p>
      @if (error()) {
        <p role="status" class="text-muted my-2">{{ error() }}</p>
      }
      @if (visible()) {
        <p class="my-2">{{ nota() === null ? t.sinCalificacion : nota() + ' / 100' }}</p>
        @if (editable()) {
          <form
            class="mt-3 flex flex-wrap items-end gap-3"
            (submit)="$event.preventDefault(); guardar()"
          >
            <label
              >{{ t.nota
              }}<input
                type="number"
                min="0"
                max="100"
                step="0.01"
                [formControl]="control"
                class="hvc-input mt-1 block"
            /></label>
            <button type="submit" class="btn-hvc-primary" [disabled]="ocupado() || control.invalid">
              {{ t.guardarNota }}
            </button>
          </form>
          <p class="text-muted mt-2">{{ t.notaOpcional }}</p>
        }
      }
    </section>
  `,
})
export class CalificacionRevision {
  readonly revisionId = input.required<string>();
  readonly editable = input(false);
  readonly t = TEXTOS.revision;
  readonly nota = signal<number | null>(null);
  readonly visible = signal(false);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly control = new FormControl<number | null>(null, [
    Validators.min(0),
    Validators.max(100),
    Validators.pattern(/^\d+(\.\d{1,2})?$/),
  ]);
  private readonly api = inject(RevisionApi);
  private readonly auth = inject(AuthService);
  private readonly destruir = inject(DestroyRef);
  private generacion = 0;

  constructor() {
    effect(() => {
      const id = this.revisionId();
      const actor = this.auth.usuario()?.id;
      const generacion = ++this.generacion;
      this.nota.set(null);
      this.visible.set(false);
      this.error.set('');
      this.ocupado.set(false);
      this.control.enable();
      this.control.reset();
      if (!actor) return;
      untracked(() => {
        this.ocupado.set(true);
        this.api
          .calificacion(id)
          .pipe(takeUntilDestroyed(this.destruir))
          .subscribe({
            next: (datos) => {
              if (generacion === this.generacion) {
                this.nota.set(datos.calificacion);
                this.control.setValue(datos.calificacion);
                this.visible.set(true);
                this.ocupado.set(false);
              }
            },
            error: (error) => {
              if (generacion === this.generacion) {
                this.ocupado.set(false);
                this.error.set(
                  error instanceof HttpErrorResponse && error.status === 404
                    ? this.t.notaNoDisponible
                    : this.t.errorNota,
                );
              }
            },
          });
      });
    });
  }

  guardar() {
    if (!this.editable() || this.ocupado() || this.control.invalid || !this.visible()) return;
    const generacion = this.generacion;
    this.ocupado.set(true);
    this.control.disable();
    this.error.set('');
    this.api
      .calificar(this.revisionId(), this.control.value)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (datos) => {
          if (generacion === this.generacion) {
            this.nota.set(datos.calificacion);
            this.ocupado.set(false);
            this.control.enable();
          }
        },
        error: (error) => {
          if (generacion === this.generacion) {
            this.ocupado.set(false);
            this.control.enable();
            if (
              error instanceof HttpErrorResponse &&
              (error.status === 401 || error.status === 403)
            ) {
              this.visible.set(false);
              this.nota.set(null);
              this.control.reset();
            }
            this.error.set(this.t.errorNota);
          }
        },
      });
  }
}
