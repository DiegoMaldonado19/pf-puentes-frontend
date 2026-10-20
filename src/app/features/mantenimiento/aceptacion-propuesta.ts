import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { MantenimientoService } from './mantenimiento.service';
import { OrdenMantenimientoDTO, ReferenciaOrden } from './modelos';

interface IntentoAceptacion {
  readonly origen: OrdenMantenimientoDTO;
  readonly resultado?: OrdenMantenimientoDTO;
  readonly error?: string;
  readonly sinAcceso?: boolean;
}

@Component({
  selector: 'app-aceptacion-propuesta',
  templateUrl: './aceptacion-propuesta.html',
  styleUrl: './aceptacion-propuesta.css',
})
export class AceptacionPropuesta {
  // El contenedor entrega la selección real y deriva el permiso de la sesión de P2.
  readonly orden = input.required<OrdenMantenimientoDTO>();
  readonly puedeAceptar = input.required<boolean>();
  readonly aceptada = output<OrdenMantenimientoDTO>();
  readonly actualizacionRequerida = output<ReferenciaOrden>();

  protected readonly t = TEXTOS.mantenimiento;
  protected readonly enviando = signal(false);
  private readonly servicio = inject(MantenimientoService);
  private readonly destruccion = inject(DestroyRef);
  private readonly intento = signal<IntentoAceptacion | null>(null);
  protected readonly intentoActual = computed(() => {
    const intento = this.intento();
    return intento?.origen === this.orden() ? intento : null;
  });
  protected readonly mostrada = computed(() => {
    const intento = this.intentoActual();
    return intento?.sinAcceso ? null : (intento?.resultado ?? this.orden());
  });
  protected readonly habilitada = computed(
    () =>
      this.puedeAceptar() &&
      this.orden().estado === 'PROPUESTA' &&
      !this.enviando() &&
      this.intentoActual() === null,
  );
  protected readonly fechaProgramada = computed(() => {
    const fecha = this.mostrada()?.fecha_programada;
    // LocalDate representa un día civil: convertirlo a UTC−6 lo desplazaría al día anterior.
    return fecha
      ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`
      : this.t.sinFecha;
  });

  protected aceptar() {
    if (!this.habilitada()) return;
    const origen = this.orden();
    this.intento.set({ origen });
    this.enviando.set(true);
    this.servicio
      .aceptar(origen.puente_id, origen.id)
      .pipe(
        takeUntilDestroyed(this.destruccion),
        finalize(() => this.enviando.set(false)),
      )
      .subscribe({
        next: (resultado) => {
          this.intento.set({ origen, resultado });
          if (this.orden() === origen && this.puedeAceptar()) {
            this.aceptada.emit(resultado);
          } else {
            this.actualizacionRequerida.emit({ puente_id: origen.puente_id, id: origen.id });
          }
        },
        error: (error: unknown) => {
          const status = error instanceof HttpErrorResponse ? error.status : -1;
          this.intento.set({
            origen,
            error: this.mensajeError(status),
            sinAcceso: status === 401 || status === 403,
          });
          this.actualizacionRequerida.emit({ puente_id: origen.puente_id, id: origen.id });
        },
      });
  }

  private mensajeError(status: number): string {
    switch (status) {
      case 401:
        return this.t.sinSesion;
      case 403:
        return this.t.sinPermiso;
      case 404:
        return this.t.noEncontrada;
      case 409:
        return this.t.conflicto;
      case 400:
      case 422:
        return this.t.datosInvalidos;
      default:
        return this.t.resultadoDesconocido;
    }
  }
}
