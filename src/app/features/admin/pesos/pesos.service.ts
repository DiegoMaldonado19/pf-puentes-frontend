import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, Observable, reduce } from 'rxjs';
import {
  ComparacionRecalculoIcDTO,
  CrearJuegoPesosDTO,
  FormularioConPesosDTO,
  JuegoPesosDTO,
  PaginaPesosDTO,
  PesoElementoDTO,
  RecalculoIcDTO,
  SolicitarRecalculoIcDTO,
} from './modelos';

/** Consume la API administrativa real; la sesión corresponde a los interceptores globales de P2. */
@Injectable({ providedIn: 'root' })
export class PesosService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

  referenciasParaCrear(id: string): Observable<readonly string[]> {
    return this.listarElementosDano(id, 0, 100).pipe(
      expand((pagina) =>
        pagina.page + 1 < pagina.total_pages
          ? this.listarElementosDano(id, pagina.page + 1, 100)
          : EMPTY,
      ),
      reduce((referencias, pagina) => [...referencias, ...pagina.content], [] as string[]),
      map((referencias) => {
        if (new Set(referencias).size !== referencias.length)
          throw new Error('Referencias modificadas durante la consulta.');
        return referencias;
      }),
    );
  }

  crearJuego(id: string, datos: CrearJuegoPesosDTO): Observable<JuegoPesosDTO> {
    return this.http.post<JuegoPesosDTO>(
      `${this.base}/formularios/${encodeURIComponent(id)}/juegos-pesos`,
      datos,
    );
  }

  listarElementosDano(
    formularioVersionId: string,
    page = 0,
    size = 20,
  ): Observable<PaginaPesosDTO<string>> {
    return this.http.get<PaginaPesosDTO<string>>(
      `${this.base}/formularios/${encodeURIComponent(formularioVersionId)}/elementos-dano`,
      { params: { page, size } },
    );
  }

  listarFormularios(page = 0, size = 20): Observable<PaginaPesosDTO<FormularioConPesosDTO>> {
    return this.http.get<PaginaPesosDTO<FormularioConPesosDTO>>(
      `${this.base}/juegos-pesos/formularios`,
      { params: { page, size } },
    );
  }

  listarJuegos(
    formularioVersionId: string,
    page = 0,
    size = 20,
  ): Observable<PaginaPesosDTO<JuegoPesosDTO>> {
    return this.http.get<PaginaPesosDTO<JuegoPesosDTO>>(
      `${this.base}/formularios/${encodeURIComponent(formularioVersionId)}/juegos-pesos`,
      { params: { page, size } },
    );
  }

  obtenerJuego(juegoId: string): Observable<JuegoPesosDTO> {
    return this.http.get<JuegoPesosDTO>(`${this.base}/juegos-pesos/${encodeURIComponent(juegoId)}`);
  }

  listarPesos(juegoId: string, page = 0, size = 20): Observable<PaginaPesosDTO<PesoElementoDTO>> {
    return this.http.get<PaginaPesosDTO<PesoElementoDTO>>(
      `${this.base}/juegos-pesos/${encodeURIComponent(juegoId)}/pesos`,
      { params: { page, size } },
    );
  }

  consultarRecalculos(
    inspeccionId: string,
    page = 0,
    size = 20,
  ): Observable<ComparacionRecalculoIcDTO> {
    return this.http.get<ComparacionRecalculoIcDTO>(
      `${this.base}/inspecciones/${encodeURIComponent(inspeccionId)}/recalculos-ic`,
      { params: { page, size } },
    );
  }

  recalcularIc(inspeccionId: string, datos: SolicitarRecalculoIcDTO): Observable<RecalculoIcDTO> {
    return this.http.post<RecalculoIcDTO>(
      `${this.base}/inspecciones/${encodeURIComponent(inspeccionId)}/recalculos-ic`,
      datos,
    );
  }
}
