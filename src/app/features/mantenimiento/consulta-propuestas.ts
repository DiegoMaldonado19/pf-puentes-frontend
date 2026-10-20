import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, linkedSignal, output } from '@angular/core';
import { BandejaPropuestas } from './bandeja-propuestas';
import { MantenimientoService } from './mantenimiento.service';
import {
  ConsultaPropuestas as Solicitud,
  OrdenMantenimientoDTO,
  PaginaPropuestas,
} from './modelos';

/** P2 aporta permisos y sesión; el servidor verifica los roles en cada petición. */
@Component({
  selector: 'app-consulta-propuestas',
  imports: [BandejaPropuestas],
  template: `
    <app-bandeja-propuestas
      [puenteId]="puenteId()"
      [pagina]="estado().pagina"
      [cargando]="estado().cargando"
      [codigoError]="estado().error"
      [puedeAceptar]="puedeConsultar() && puedeAceptar()"
      (consultaSolicitada)="consultar($event)"
      (aceptada)="aceptada.emit($event)"
    />
  `,
})
export class ConsultaPropuestas {
  readonly puenteId = input.required<string>();
  readonly puedeConsultar = input.required<boolean>();
  readonly puedeAceptar = input.required<boolean>();
  readonly aceptada = output<OrdenMantenimientoDTO>();
  private readonly servicio = inject(MantenimientoService);
  private readonly contexto = computed(() => ({
    puente: this.puenteId(),
    permiso: this.puedeConsultar(),
  }));
  private readonly solicitud = linkedSignal({
    source: this.contexto,
    computation: () => ({ page: 0, size: 20, intento: 0 }),
  });
  protected readonly estado = linkedSignal({
    source: this.contexto,
    computation: (): {
      pagina: PaginaPropuestas | null;
      cargando: boolean;
      error: number | null;
    } => ({ pagina: null, cargando: false, error: null }),
  });

  constructor() {
    effect((limpiar) => {
      const contexto = this.contexto();
      const solicitud = this.solicitud();
      if (!contexto.permiso) {
        this.estado.set({ pagina: null, cargando: false, error: 403 });
        return;
      }
      this.estado.set({ pagina: null, cargando: true, error: null });
      const peticion = this.servicio
        .listarPropuestas(contexto.puente, solicitud.page, solicitud.size)
        .subscribe({
          next: (pagina) => this.estado.set({ pagina, cargando: false, error: null }),
          error: (error: unknown) =>
            this.estado.set({
              pagina: null,
              cargando: false,
              error: error instanceof HttpErrorResponse ? error.status : 500,
            }),
        });
      limpiar(() => peticion.unsubscribe());
    });
  }

  protected consultar(solicitud: Solicitud) {
    if (!this.puedeConsultar() || solicitud.puente_id !== this.puenteId()) return;
    this.solicitud.update((actual) => ({
      page: solicitud.page,
      size: solicitud.size,
      intento: actual.intento + 1,
    }));
  }
}
