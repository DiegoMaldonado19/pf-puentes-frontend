import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { JuegoPesosDTO, PaginaPesosDTO, PesoElementoDTO } from './modelos';

/** Consume la API administrativa real; la sesión corresponde a los interceptores globales de P2. */
@Injectable({ providedIn: 'root' })
export class PesosService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

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
}
