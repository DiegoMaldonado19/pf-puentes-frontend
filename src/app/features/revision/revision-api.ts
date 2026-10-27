import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

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
}
