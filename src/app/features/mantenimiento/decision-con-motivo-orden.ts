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

/** RN-MTO-04/09: formulario compartido para descarte y cancelación con motivo conservado. */
@Component({
  selector: 'app-decision-con-motivo-orden',
  imports: [ReactiveFormsModule],
  templateUrl: './decision-con-motivo-orden.html',
  styleUrls: ['./bandeja-propuestas.css', './decision-con-motivo-orden.css'],
})
export class DecisionConMotivoOrden {
  readonly orden = input.required<OrdenMantenimientoDTO>();
  readonly puedeConsultar = input.required<boolean>();
  readonly puedeDecidir = input(false);
  readonly operacion = input<'descarte' | 'cancelacion'>('descarte');
  readonly bloqueada = input(false);
  readonly confirmada = output<OrdenMantenimientoDTO>();
  /** 401/403 retiran datos del host; conflicto/resultado incierto exigen relectura. */
  readonly actualizacionRequerida = output<number>();
  private readonly servicio = inject(MantenimientoService);
  private readonly destruccion = inject(DestroyRef);
  protected readonly t = computed(() => TEXTOS.mantenimiento[this.operacion()]);
  private readonly contexto = computed(() => ({
    orden: this.orden(),
    lectura: this.puedeConsultar(),
    permiso: this.puedeDecidir(),
    operacion: this.operacion(),
    origen: this.operacion() === 'descarte' ? 'PROPUESTA' : 'PROGRAMADA',
    destino: this.operacion() === 'descarte' ? 'DESCARTADA' : 'CANCELADA',
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

  protected decidir() {
    const contexto = this.contexto();
    if (
      !contexto.lectura ||
      !contexto.permiso ||
      contexto.orden.estado !== contexto.origen ||
      this.denegado() ||
      this.enviando() ||
      this.bloqueada()
    )
      return;
    if (this.motivo.invalid) {
      this.motivo.markAsTouched();
      this.error.set(this.t().motivoRequerido);
      return;
    }
    const motivo = this.motivo.value;
    this.error.set(null);
    this.enviando.set(true);
    const peticion =
      contexto.operacion === 'descarte'
        ? this.servicio.descartar(contexto.orden.puente_id, contexto.orden.id, { motivo })
        : this.servicio.cancelar(contexto.orden.puente_id, contexto.orden.id, { motivo });
    peticion
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
            resultado.estado !== contexto.destino ||
            resultado.motivo !== motivo
          ) {
            this.error.set(this.t().resultadoDesconocido);
            this.actualizacionRequerida.emit(500);
            return;
          }
          this.confirmada.emit(resultado);
        },
        error: (error: unknown) => {
          if (this.contexto() !== contexto) return;
          const status = error instanceof HttpErrorResponse ? error.status : 500;
          const mensaje =
            status === 401
              ? this.t().sinSesion
              : status === 403
                ? this.t().sinPermiso
                : status === 404
                  ? this.t().noEncontrada
                  : status === 409
                    ? this.t().conflicto
                    : status === 400 || status === 422
                      ? this.t().datosInvalidos
                      : this.t().resultadoDesconocido;
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
