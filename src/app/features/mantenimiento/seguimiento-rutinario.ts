import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, linkedSignal, output } from '@angular/core';
import { TEXTOS } from '../../shared/textos';
import { MantenimientoService } from './mantenimiento.service';
import { OrdenMantenimientoDTO, SeguimientoRutinarioDTO } from './modelos';

@Component({
  selector: 'app-seguimiento-rutinario',
  templateUrl: './seguimiento-rutinario.html',
  styleUrls: ['./bandeja-propuestas.css', './consulta-ordenes.css'],
})
export class SeguimientoRutinario {
  readonly puenteId = input.required<string>();
  readonly puedeConsultar = input.required<boolean>();
  readonly bloqueada = input(false);
  readonly actualizacion = input(0);
  readonly ordenSeleccionada = output<OrdenMantenimientoDTO>();
  readonly accesoDenegado = output<number>();
  protected readonly t = TEXTOS.mantenimiento.rutinarioAnual;
  protected readonly estados = TEXTOS.mantenimiento.estados;
  private readonly servicio = inject(MantenimientoService);
  private readonly contexto = computed(() => ({
    puente: this.puenteId(),
    permiso: this.puedeConsultar(),
    version: this.actualizacion(),
  }));
  private readonly solicitud = linkedSignal({
    source: this.contexto,
    computation: () => ({ page: 0, intento: 0 }),
  });
  private readonly denegado = linkedSignal({ source: this.contexto, computation: () => false });
  protected readonly estado = linkedSignal({
    source: this.contexto,
    computation: (): {
      datos: SeguimientoRutinarioDTO | null;
      cargando: boolean;
      error: number | null;
    } => ({ datos: null, cargando: false, error: null }),
  });

  constructor() {
    effect((limpiar) => {
      const contexto = this.contexto();
      const solicitud = this.solicitud();
      if (!contexto.permiso || this.denegado()) return;
      this.estado.set({ datos: null, cargando: true, error: null });
      const peticion = this.servicio
        .consultarRutinarioAnual(contexto.puente, solicitud.page)
        .subscribe({
          next: (datos) => {
            if (this.contexto() !== contexto || this.solicitud() !== solicitud) return;
            const compatible =
              datos.puente_id === contexto.puente &&
              datos.ordenes.puente_id === contexto.puente &&
              datos.ordenes.content.every(
                (o) =>
                  o.puente_id === contexto.puente &&
                  o.tipo === 'RUTINARIO' &&
                  ['PROGRAMADA', 'EN_EJECUCION'].includes(o.estado),
              );
            this.estado.set({
              datos: compatible ? datos : null,
              cargando: false,
              error: compatible ? null : -1,
            });
          },
          error: (error: unknown) => {
            if (this.contexto() !== contexto || this.solicitud() !== solicitud) return;
            const status = error instanceof HttpErrorResponse ? error.status : 500;
            this.estado.set({ datos: null, cargando: false, error: status });
            if (status === 401 || status === 403) {
              this.denegado.set(true);
              this.accesoDenegado.emit(status);
            }
          },
        });
      limpiar(() => peticion.unsubscribe());
    });
  }

  protected consultar(page = this.solicitud().page) {
    const pagina = this.estado().datos?.ordenes;
    if (
      !this.puedeConsultar() ||
      this.denegado() ||
      this.bloqueada() ||
      this.estado().cargando ||
      page < 0 ||
      (pagina && page > 0 && page >= pagina.total_pages)
    )
      return;
    this.solicitud.update((s) => ({ page, intento: s.intento + 1 }));
  }

  protected seleccionar(orden: OrdenMantenimientoDTO) {
    if (
      !this.puedeConsultar() ||
      this.bloqueada() ||
      this.estado().cargando ||
      this.denegado() ||
      !this.estado().datos?.ordenes.content.includes(orden)
    )
      return;
    this.ordenSeleccionada.emit(orden);
  }

  protected fecha(valor: string | null): string {
    return valor
      ? `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`
      : this.t.sinFecha;
  }

  protected mensaje(status: number): string {
    return status === 401
      ? this.t.sinSesion
      : status === 403
        ? this.t.sinPermiso
        : status === 404
          ? this.t.noPuente
          : status === -1
            ? this.t.incompatible
            : this.t.error;
  }
}
