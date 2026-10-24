import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  CrearFormularioVersionDTO,
  EditarFormularioVersionDTO,
  FormularioVersionDTO,
  PaginaFormularioVersionDTO,
  PublicarFormularioVersionDTO,
} from './modelos';
import { BaseLocal } from '../../offline/base-local';
import { Json, ReferenciaLocal } from '../../offline/modelos';

@Injectable({ providedIn: 'root' })
export class FormularioService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/formularios';
  private readonly db = new BaseLocal();

  obtenerActivo(): Observable<FormularioVersionDTO> {
    return this.http.get<FormularioVersionDTO>(`${this.base}/activo`).pipe(
      tap((version) => {
        // Almacena en Dexie para soporte offline (P6)
        try {
          const ref: ReferenciaLocal = {
            id: version.id,
            propietario_id: 'sistema',
            modelo_version: 1,
            datos: version as unknown as Json,
            preparada_en: new Date().toISOString(),
          };
          this.db.esquemas_formulario.put(ref);
        } catch {
          // Ignora si falla IndexedDB en entornos donde no esté disponible
        }
      }),
    );
  }

  obtenerPorCodigo(codigo: string): Observable<FormularioVersionDTO> {
    return this.http.get<FormularioVersionDTO>(
      `${this.base}/versiones/${encodeURIComponent(codigo)}`,
    );
  }

  detalle(id: string): Observable<FormularioVersionDTO> {
    return this.http.get<FormularioVersionDTO>(`${this.base}/${encodeURIComponent(id)}`);
  }

  listar(page = 0, size = 20): Observable<PaginaFormularioVersionDTO> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PaginaFormularioVersionDTO>(this.base, { params });
  }

  crearBorrador(datos: CrearFormularioVersionDTO): Observable<FormularioVersionDTO> {
    return this.http.post<FormularioVersionDTO>(this.base, datos);
  }

  editarBorrador(id: string, datos: EditarFormularioVersionDTO): Observable<FormularioVersionDTO> {
    return this.http.put<FormularioVersionDTO>(`${this.base}/${encodeURIComponent(id)}`, datos);
  }

  publicar(id: string, datos?: PublicarFormularioVersionDTO): Observable<FormularioVersionDTO> {
    return this.http.post<FormularioVersionDTO>(
      `${this.base}/${encodeURIComponent(id)}/publicar`,
      datos ?? {},
    );
  }
}
