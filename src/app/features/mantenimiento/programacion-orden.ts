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
import { OrdenMantenimientoDTO } from './modelos';

@Component({
  selector: 'app-programacion-orden',
  imports: [ReactiveFormsModule],
  templateUrl: './programacion-orden.html',
  styleUrls: ['./bandeja-propuestas.css', './programacion-orden.css'],
})
export class ProgramacionOrden {
  readonly orden = input.required<OrdenMantenimientoDTO>();
  readonly puedeConsultar = input.required<boolean>();
  readonly puedeProgramar = input(false);
  readonly bloqueada = input(false);
  readonly programada = output<OrdenMantenimientoDTO>();
  readonly actualizacionRequerida = output<number>();
  private readonly servicio = inject(MantenimientoService);
  private readonly destruccion = inject(DestroyRef);
  protected readonly t = TEXTOS.mantenimiento.programacion;
  private readonly contexto = computed(() => ({
    orden: this.orden(),
    lectura: this.puedeConsultar(),
    permiso: this.puedeProgramar(),
  }));
  protected readonly editable = computed(() => this.orden().estado === 'PROGRAMADA');
  protected readonly error = linkedSignal({
    source: this.contexto,
    computation: (): string | null => null,
  });
  protected readonly denegado = linkedSignal({ source: this.contexto, computation: () => false });
  protected readonly enviando = signal(false);
  readonly envioPendiente = this.enviando.asReadonly();
  protected readonly formulario = new FormGroup({
    fecha_programada: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    effect(() => {
      const contexto = this.contexto();
      this.formulario.reset({ fecha_programada: contexto.orden.fecha_programada ?? '' });
    });
  }

  protected programar() {
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
    if (datos.fecha_programada && datos.fecha_programada === contexto.orden.fecha_programada) {
      this.error.set(this.t.sinCambio);
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set(this.t.fechaRequerida);
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    this.servicio
      .programarFecha(contexto.orden.puente_id, contexto.orden.id, datos)
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
            resultado.estado !== 'PROGRAMADA' ||
            resultado.fecha_programada !== datos.fecha_programada
          ) {
            this.error.set(this.t.resultadoDesconocido);
            this.actualizacionRequerida.emit(500);
            return;
          }
          this.programada.emit(resultado);
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
