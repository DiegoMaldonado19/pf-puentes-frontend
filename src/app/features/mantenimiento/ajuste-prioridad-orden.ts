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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { MantenimientoService } from './mantenimiento.service';
import { OrdenMantenimientoDTO, PrioridadOrden } from './modelos';

@Component({
  selector: 'app-ajuste-prioridad-orden',
  imports: [ReactiveFormsModule],
  templateUrl: './ajuste-prioridad-orden.html',
  styleUrls: ['./bandeja-propuestas.css', './ajuste-prioridad-orden.css'],
})
export class AjustePrioridadOrden {
  readonly orden = input.required<OrdenMantenimientoDTO>();
  readonly puedeConsultar = input.required<boolean>();
  readonly puedeAjustar = input(false);
  readonly bloqueada = input(false);
  readonly ajustada = output<OrdenMantenimientoDTO>();
  readonly actualizacionRequerida = output<number>();
  private readonly servicio = inject(MantenimientoService);
  private readonly destruccion = inject(DestroyRef);
  protected readonly t = TEXTOS.mantenimiento.ajustePrioridad;
  protected readonly prioridades = TEXTOS.mantenimiento.prioridades;
  protected readonly opciones: readonly PrioridadOrden[] = ['BAJA', 'MEDIA', 'ALTA'];
  private readonly contexto = computed(() => ({
    orden: this.orden(),
    lectura: this.puedeConsultar(),
    permiso: this.puedeAjustar(),
  }));
  protected readonly editable = computed(() =>
    ['PROPUESTA', 'PROGRAMADA', 'EN_EJECUCION'].includes(this.orden().estado),
  );
  protected readonly error = linkedSignal({
    source: this.contexto,
    computation: (): string | null => null,
  });
  protected readonly denegado = linkedSignal({ source: this.contexto, computation: () => false });
  protected readonly enviando = signal(false);
  readonly envioPendiente = this.enviando.asReadonly();
  protected readonly formulario = new FormGroup({
    prioridad: new FormControl<PrioridadOrden>('MEDIA', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    justificacion: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => (String(control.value).trim() ? null : { justificacionRequerida: true }),
      ],
    }),
  });

  constructor() {
    effect(() => {
      const contexto = this.contexto();
      this.formulario.reset({ prioridad: contexto.orden.prioridad, justificacion: '' });
    });
  }

  protected ajustar() {
    const contexto = this.contexto();
    if (
      !contexto.lectura ||
      !contexto.permiso ||
      !this.editable() ||
      this.denegado() ||
      this.enviando() ||
      this.bloqueada()
    )
      return;
    const datos = this.formulario.getRawValue();
    if (datos.prioridad === contexto.orden.prioridad) {
      this.error.set(this.t.sinCambio);
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set(this.t.justificacionRequerida);
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .ajustarPrioridad(contexto.orden.puente_id, contexto.orden.id, datos)
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
            !['PROPUESTA', 'PROGRAMADA', 'EN_EJECUCION'].includes(resultado.estado) ||
            resultado.prioridad !== datos.prioridad ||
            resultado.justificacion_prioridad !== datos.justificacion ||
            resultado.prioridad_sugerida !== contexto.orden.prioridad_sugerida
          ) {
            this.error.set(this.t.resultadoDesconocido);
            this.actualizacionRequerida.emit(500);
            return;
          }
          this.ajustada.emit(resultado);
        },
        error: (error: unknown) => {
          if (this.contexto() !== contexto) return;
          const status = error instanceof HttpErrorResponse ? error.status : 500;
          this.error.set(
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
                      : this.t.resultadoDesconocido,
          );
          if (status === 401 || status === 403) {
            this.denegado.set(true);
            this.formulario.reset();
          }
          if (status !== 400 && status !== 422) this.actualizacionRequerida.emit(status);
        },
      });
  }
}
