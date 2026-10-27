import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EsquemaFormulario } from '../formulario/modelos';

export type Veredicto = 'APROBADA' | 'CAMBIOS_SOLICITADOS' | 'RECHAZADA';
export interface ObservacionRevision {
  id: string;
  elemento_ref: string;
  texto: string;
  resuelta_en?: string | null;
}

export interface PendienteRevisionEstudiante extends ObservacionRevision {
  revision_id: string;
  inspeccion_id: string;
  estado: string;
  puente_codigo: string;
}
export interface InspeccionRevisada {
  inspeccion_id: string;
  puente_codigo: string;
  estado: string;
}
export interface CicloRevision {
  id: string;
  revisor_id: string;
  veredicto: Veredicto | null;
  observacion: string | null;
  creado_en: string;
  emitida_en: string | null;
  estado: string;
  observaciones: ObservacionRevision[];
}
export interface PaginaSeguimiento<T> {
  content: T[];
  number: number;
  size: number;
  total_elements: number;
  total_pages: number;
}
export interface DetalleRevision {
  id: string;
  inspeccion_id: string;
  estado: string;
  veredicto: Veredicto | null;
  observacion: string | null;
  esquema: EsquemaFormulario;
  datos: Record<string, unknown>;
  campos: { referencia: string; titulo: string; valor: unknown }[];
  observaciones: ObservacionRevision[];
}
export interface DecisionRevision {
  veredicto: Veredicto;
  observacion: string;
  estado_confirmado?: 'BUENO' | 'REGULAR' | 'MALO' | null;
  justificacion_estado?: string | null;
}

export type EstadoRevision = '' | 'ENVIADA' | 'EN_REVISION';
export interface PendienteRevision {
  inspeccion_id: string;
  curso_nombre: string;
  autor_nombre: string;
  puente_codigo: string;
  estado: Exclude<EstadoRevision, ''>;
  enviada_en: string | null;
  revision_id: string | null;
}
export interface PaginaRevisiones {
  content: PendienteRevision[];
  number: number;
  size: number;
  total_elements: number;
  total_pages: number;
}
export interface RevisionAbierta {
  id: string;
  inspeccion_id: string;
  revisor_id: string;
  creado_en: string;
}

export interface ArchivoDTO {
  id: string;
  tipo: string;
  url: string | null;
  miniatura_url: string | null;
  elemento_ref?: string | null;
}

export interface EstimacionPreliminarIcDTO {
  indice_condicion: number;
  estado_calculado: 'BUENO' | 'REGULAR' | 'MALO';
  anulaciones: string[];
  version_pesos_id: string;
  preliminar: boolean;
  rotulo: string;
  advertencia: string;
}

@Injectable({ providedIn: 'root' })
export class RevisionApi {
  private readonly http = inject(HttpClient);
  pendientes(page: number, estado: EstadoRevision) {
    let params = new HttpParams().set('page', page).set('size', 10);
    if (estado) params = params.set('estado', estado);
    return this.http.get<PaginaRevisiones>('/api/v1/revisiones/pendientes', { params });
  }
  abrir(inspeccionId: string) {
    return this.http.post<RevisionAbierta>(
      `/api/v1/inspecciones/${encodeURIComponent(inspeccionId)}/revisiones`,
      {},
    );
  }

  detalle(id: string) {
    return this.http.get<DetalleRevision>(`/api/v1/revisiones/${encodeURIComponent(id)}`);
  }
  decidir(id: string, datos: DecisionRevision) {
    return this.http.post<DetalleRevision>(
      `/api/v1/revisiones/${encodeURIComponent(id)}/veredicto`,
      datos,
    );
  }
  observar(id: string, elemento_ref: string, texto: string) {
    return this.http.post<ObservacionRevision>(
      `/api/v1/revisiones/${encodeURIComponent(id)}/observaciones`,
      { elemento_ref, texto },
    );
  }
  archivos(id: string) {
    return this.http.get<ArchivoDTO[]>(`/api/v1/revisiones/${encodeURIComponent(id)}/archivos`);
  }
  icPreliminar(inspeccionId: string) {
    return this.http.post<EstimacionPreliminarIcDTO>(
      `/api/v1/inspecciones/${encodeURIComponent(inspeccionId)}/ic-preliminar`,
      {},
    );
  }

  misPendientes(page = 0) {
    return this.http.get<PaginaSeguimiento<PendienteRevisionEstudiante>>(
      '/api/v1/revisiones/mis-pendientes',
      { params: { page, size: 10 } },
    );
  }
  misInspecciones(page = 0) {
    return this.http.get<PaginaSeguimiento<InspeccionRevisada>>(
      '/api/v1/revisiones/mis-inspecciones',
      { params: { page, size: 10 } },
    );
  }
  resolver(id: string) {
    return this.http.patch<ObservacionRevision>(
      `/api/v1/observaciones/${encodeURIComponent(id)}/resolucion`,
      {},
    );
  }
  historial(id: string, page = 0) {
    return this.http.get<PaginaSeguimiento<CicloRevision>>(
      `/api/v1/inspecciones/${encodeURIComponent(id)}/revisiones`,
      { params: { page, size: 10 } },
    );
  }
  calificacion(id: string) {
    return this.http.get<{ calificacion: number | null }>(
      `/api/v1/revisiones/${encodeURIComponent(id)}/calificacion`,
    );
  }
  calificar(id: string, calificacion: number | null) {
    return this.http.put<{ calificacion: number | null }>(
      `/api/v1/revisiones/${encodeURIComponent(id)}/calificacion`,
      { calificacion },
    );
  }
}
