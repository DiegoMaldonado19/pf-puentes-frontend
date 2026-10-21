import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { DepartamentoDTO, MunicipioDTO } from './modelos';

/** Catálogo INE público. No cambia entre despliegues: se pide una vez por sesión de la app. */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private departamentos$?: Observable<readonly DepartamentoDTO[]>;
  private readonly municipios$ = new Map<string, Observable<readonly MunicipioDTO[]>>();

  departamentos(): Observable<readonly DepartamentoDTO[]> {
    this.departamentos$ ??= this.http
      .get<readonly DepartamentoDTO[]>('/api/v1/departamentos')
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.departamentos$;
  }

  municipios(departamento: string): Observable<readonly MunicipioDTO[]> {
    let municipios = this.municipios$.get(departamento);
    if (!municipios) {
      municipios = this.http
        .get<readonly MunicipioDTO[]>(
          `/api/v1/departamentos/${encodeURIComponent(departamento)}/municipios`,
        )
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.municipios$.set(departamento, municipios);
    }
    return municipios;
  }
}
