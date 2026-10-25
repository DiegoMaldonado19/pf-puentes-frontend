import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, Observable, reduce } from 'rxjs';

export interface AsignacionP7DTO {
  id: string;
  inscripcion_id: string;
  curso_id: string;
  estudiante_id: string;
  puente_id: string;
  curso_nombre: string;
  puente_codigo: string;
  puente_nombre: string;
  creado_en: string;
}

/** P7 usa una página distinta de PaginaDTO de P3. */
export interface PaginaAsignacionesP7DTO {
  content: AsignacionP7DTO[];
  number: number;
  size: number;
  total_elements: number;
  total_pages: number;
}

export interface PuertoAsignacionesP7 {
  consultar(): Observable<AsignacionP7DTO[]>;
}

@Injectable({ providedIn: 'root' })
export class AsignacionesP7 implements PuertoAsignacionesP7 {
  private readonly http = inject(HttpClient);

  /** Una sola emisión al completar todas las páginas; cualquier fallo descarta el acumulado. */
  consultar(): Observable<AsignacionP7DTO[]> {
    return this.pagina(0).pipe(
      expand((pagina) =>
        pagina.number + 1 < pagina.total_pages ? this.pagina(pagina.number + 1) : EMPTY,
      ),
      reduce<PaginaAsignacionesP7DTO, AsignacionP7DTO[]>(
        (todas, pagina) => [...todas, ...pagina.content],
        [],
      ),
    );
  }

  private pagina(page: number): Observable<PaginaAsignacionesP7DTO> {
    const params = new HttpParams().set('page', page).set('size', 20);
    return this.http.get<PaginaAsignacionesP7DTO>('/api/v1/mis-asignaciones', { params });
  }
}
