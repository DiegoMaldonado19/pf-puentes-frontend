import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CrearSolicitudPuenteDTO, EstadoSolicitud, PaginaDTO, SolicitudPuenteDTO } from './modelos';

/** RN-INV-07: el Catedrático solicita; el Administrador aprueba o rechaza con motivo. */
@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/solicitudes-puente';

  solicitar(datos: CrearSolicitudPuenteDTO): Observable<SolicitudPuenteDTO> {
    return this.http.post<SolicitudPuenteDTO>(this.base, datos);
  }

  listar(
    estado: EstadoSolicitud | null,
    page = 0,
    size = 20,
  ): Observable<PaginaDTO<SolicitudPuenteDTO>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (estado) params = params.set('estado', estado);
    return this.http.get<PaginaDTO<SolicitudPuenteDTO>>(this.base, { params });
  }

  aprobar(id: string, confirmarDuplicado: boolean): Observable<SolicitudPuenteDTO> {
    return this.http.post<SolicitudPuenteDTO>(`${this.base}/${encodeURIComponent(id)}/aprobacion`, {
      confirmar_duplicado: confirmarDuplicado,
    });
  }

  rechazar(id: string, motivo: string): Observable<SolicitudPuenteDTO> {
    return this.http.post<SolicitudPuenteDTO>(`${this.base}/${encodeURIComponent(id)}/rechazo`, {
      motivo,
    });
  }
}
