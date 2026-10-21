import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, Observable, reduce } from 'rxjs';
import {
  CrearPuenteDTO,
  EditarPuenteDTO,
  FiltrosPuentes,
  PaginaDTO,
  PuenteCercanoDTO,
  PuenteDTO,
} from './modelos';

/** DT-BE-08: el backend no devuelve más de 100 por página. */
export const TAMANO_MAXIMO_PAGINA = 100;

@Injectable({ providedIn: 'root' })
export class PuentesService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/puentes';

  listar(filtros: FiltrosPuentes, page = 0, size = 20): Observable<PaginaDTO<PuenteDTO>> {
    let params = new HttpParams().set('page', page).set('size', size);
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== null && valor !== undefined && valor !== '' && valor !== false) {
        params = params.set(clave, String(valor).trim());
      }
    }
    return this.http.get<PaginaDTO<PuenteDTO>>(this.base, { params });
  }

  /** Para el mapa: recorre una a una las páginas de 100 hasta traer todos los puentes activos. */
  todosActivos(): Observable<PuenteDTO[]> {
    return this.listar({}, 0, TAMANO_MAXIMO_PAGINA).pipe(
      expand((pagina) =>
        pagina.pagina + 1 < pagina.total_paginas
          ? this.listar({}, pagina.pagina + 1, TAMANO_MAXIMO_PAGINA)
          : EMPTY,
      ),
      reduce<PaginaDTO<PuenteDTO>, PuenteDTO[]>(
        (todos, pagina) => [...todos, ...pagina.contenido],
        [],
      ),
    );
  }

  detalle(id: string): Observable<PuenteDTO> {
    return this.http.get<PuenteDTO>(`${this.base}/${encodeURIComponent(id)}`);
  }

  cercanos(latitud: number, longitud: number, excluir?: string): Observable<PuenteCercanoDTO[]> {
    let params = new HttpParams().set('latitud', latitud).set('longitud', longitud);
    if (excluir) params = params.set('excluir', excluir);
    return this.http.get<PuenteCercanoDTO[]>(`${this.base}/cercanos`, { params });
  }

  crear(datos: CrearPuenteDTO): Observable<PuenteDTO> {
    return this.http.post<PuenteDTO>(this.base, datos);
  }

  editar(id: string, datos: EditarPuenteDTO): Observable<PuenteDTO> {
    return this.http.put<PuenteDTO>(`${this.base}/${encodeURIComponent(id)}`, datos);
  }

  darDeBaja(id: string, motivo: string): Observable<PuenteDTO> {
    return this.http.post<PuenteDTO>(`${this.base}/${encodeURIComponent(id)}/baja`, { motivo });
  }
}
