import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { MantenimientoService } from './mantenimiento.service';
import { OrdenMantenimientoDTO } from './modelos';

/** RN-MTO-04/09: acción explícita sobre una PROPUESTA, conservando el motivo escrito. */
@Component({
  selector: 'app-descarte-propuesta',
  imports: [ReactiveFormsModule],
  templateUrl: './descarte-propuesta.html',
  styleUrls: ['./bandeja-propuestas.css', './descarte-propuesta.css'],
})
export class DescartePropuesta {
  readonly orden = input.required<OrdenMantenimientoDTO>();
  readonly puedeConsultar = input.required<boolean>();
  readonly puedeDescartar = input(false);
  readonly bloqueada = input(false);
  readonly descartada = output<OrdenMantenimientoDTO>();
  /** 401/403 retiran datos del host; conflicto/resultado incierto exigen relectura. */
  readonly actualizacionRequerida = output<number>();
  private readonly servicio = inject(MantenimientoService);
  private readonly destruccion = inject(DestroyRef);
  protected readonly t = TEXTOS.mantenimiento.descarte;
  private readonly contexto = computed(() => ({
    orden: this.orden(),
    lectura: this.puedeConsultar(),
    permiso: this.puedeDescartar(),
  }));
  protected readonly error = linkedSignal({
    source: this.contexto,
    computation: (): string | null => null,
  });
  protected readonly denegado = linkedSignal({ source: this.contexto, computation: () => false });
  protected readonly enviando = signal(false);
  readonly envioPendiente = this.enviando.asReadonly();
  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [(control) => (String(control.value).trim() ? null : { motivoRequerido: true })],
  });

  constructor() {
    effect(() => {
      this.contexto();
      this.motivo.reset();
    });
  }

  protected descartar() {
    const contexto = this.contexto();
    if (
      !contexto.lectura ||
      !contexto.permiso ||
      contexto.orden.estado !== 'PROPUESTA' ||
      this.denegado() ||
      this.enviando() ||
      this.bloqueada()
    )
      return;
    if (this.motivo.invalid) {
      this.motivo.markAsTouched();
      this.error.set(this.t.motivoRequerido);
      return;
    }
    const motivo = this.motivo.value;
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .descartar(contexto.orden.puente_id, contexto.orden.id, { motivo })
      .pipe(
        takeUntilDestroyed(this.destruccion),
        finalize(() => this.enviando.set(false)),
      )
      .subscribe({
        next: (resultado) => {
          if (this.contexto() !== contexto) return;
          if (
            resultado.id !== contexto.orden.id ||
            resultado.puente_id !== contexto.orden.puente_id ||
            resultado.estado !== 'DESCARTADA' ||
            resultado.motivo !== motivo
          ) {
            this.error.set(this.t.resultadoDesconocido);
            this.actualizacionRequerida.emit(500);
            return;
          }
          this.descartada.emit(resultado);
        },
        error: (error: unknown) => {
          if (this.contexto() !== contexto) return;
          const status = error instanceof HttpErrorResponse ? error.status : 500;
          const mensaje =
            status === 401
              ? this.t.sinSesion
              : status === 403
                ? this.t.sinPermiso
                : status === 404
                  ? this.t.noEncontrada
                  : status === 409
                    ? this.t.conflicto
                    : status === 400 || status === 422
                      ? this.t.datosInvalidos
                      : this.t.resultadoDesconocido;
          this.error.set(mensaje);
          if (status === 401 || status === 403) {
            this.denegado.set(true);
            this.motivo.reset();
          }
          // Con validación fallida se conserva el motivo; las demás respuestas se reconcilian por GET.
          if (status !== 400 && status !== 422) this.actualizacionRequerida.emit(status);
        },
      });
  }
}
