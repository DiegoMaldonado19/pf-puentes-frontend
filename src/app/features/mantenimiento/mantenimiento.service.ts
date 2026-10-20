import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OrdenMantenimientoDTO, PaginaOrdenes, PaginaPropuestas } from './modelos';

/** La sesión la aporta la cadena HTTP global de P2; no administra tokens ni simula órdenes. */
@Injectable({ providedIn: 'root' })
export class MantenimientoService {
  private readonly http = inject(HttpClient);

  listarOrdenes(puenteId: string, page = 0, size = 20): Observable<PaginaOrdenes> {
    return this.http.get<PaginaOrdenes>(
      `/api/v1/puentes/${encodeURIComponent(puenteId)}/ordenes-mantenimiento`,
      { params: { page, size } },
    );
  }

  obtenerOrden(puenteId: string, ordenId: string): Observable<OrdenMantenimientoDTO> {
    return this.http.get<OrdenMantenimientoDTO>(
      `/api/v1/puentes/${encodeURIComponent(puenteId)}/ordenes-mantenimiento/${encodeURIComponent(ordenId)}`,
    );
  }

  listarPropuestas(puenteId: string, page = 0, size = 20): Observable<PaginaPropuestas> {
    return this.http.get<PaginaPropuestas>(
      `/api/v1/puentes/${encodeURIComponent(puenteId)}/ordenes-mantenimiento/propuestas`,
      { params: { page, size } },
    );
  }

  iniciarEjecucion(puenteId: string, ordenId: string): Observable<OrdenMantenimientoDTO> {
    return this.http.post<OrdenMantenimientoDTO>(
      `/api/v1/puentes/${encodeURIComponent(puenteId)}/ordenes-mantenimiento/${encodeURIComponent(ordenId)}/inicio-ejecucion`,
      null,
    );
  }

  aceptar(puenteId: string, ordenId: string): Observable<OrdenMantenimientoDTO> {
    return this.http.post<OrdenMantenimientoDTO>(
      `/api/v1/puentes/${encodeURIComponent(puenteId)}/ordenes-mantenimiento/${encodeURIComponent(ordenId)}/aceptacion`,
      null,
    );
  }
}
