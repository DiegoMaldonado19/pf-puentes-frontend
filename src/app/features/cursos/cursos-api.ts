import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TEXTOS } from '../../shared/textos';
import { INTEGRACION_SESION_CURSOS, SESION_CURSOS } from './sesion-cursos';
import {
  AsignacionDTO,
  CursoDTO,
  EstudianteElegibleDTO,
  GuardarCursoDTO,
  InscripcionDTO,
  PaginaDTO,
  PuenteDisponibleDTO,
} from './modelos';

@Injectable({ providedIn: 'root' })
export class CursosApi {
  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SESION_CURSOS);
  private readonly integracion = inject(INTEGRACION_SESION_CURSOS);
  private readonly base = '/api/v1';

  listar(pagina = 0) {
    return this.http.get<PaginaDTO<CursoDTO>>(`${this.base}/cursos`, this.opciones(pagina));
  }
  obtener(id: string) {
    return this.http.get<CursoDTO>(`${this.base}/cursos/${id}`, this.opciones());
  }
  crear(datos: GuardarCursoDTO) {
    return this.http.post<CursoDTO>(`${this.base}/cursos`, datos, this.opciones());
  }
  actualizar(id: string, datos: GuardarCursoDTO) {
    return this.http.patch<CursoDTO>(`${this.base}/cursos/${id}`, datos, this.opciones());
  }
  inscripciones(cursoId: string, pagina = 0) {
    return this.http.get<PaginaDTO<InscripcionDTO>>(
      `${this.base}/cursos/${cursoId}/inscripciones`,
      this.opciones(pagina),
    );
  }
  inscribir(cursoId: string, estudianteId: string) {
    return this.http.post<InscripcionDTO>(
      `${this.base}/cursos/${cursoId}/inscripciones`,
      { estudiante_id: estudianteId },
      this.opciones(),
    );
  }
  asignaciones(cursoId: string, inscripcionId: string, pagina = 0) {
    return this.http.get<PaginaDTO<AsignacionDTO>>(
      `${this.base}/cursos/${cursoId}/inscripciones/${inscripcionId}/asignaciones`,
      this.opciones(pagina),
    );
  }
  asignar(cursoId: string, inscripcionId: string, puenteId: string) {
    return this.http.post<AsignacionDTO>(
      `${this.base}/cursos/${cursoId}/inscripciones/${inscripcionId}/asignaciones`,
      { puente_id: puenteId },
      this.opciones(),
    );
  }
  propias(pagina = 0) {
    return this.http.get<PaginaDTO<AsignacionDTO>>(
      `${this.base}/mis-asignaciones`,
      this.opciones(pagina),
    );
  }
  estudiantes(pagina = 0, busqueda = '') {
    return this.http.get<PaginaDTO<EstudianteElegibleDTO>>(
      `${this.base}/cursos/estudiantes-elegibles`,
      this.opciones(pagina, busqueda),
    );
  }
  puentes(pagina = 0, busqueda = '') {
    return this.http.get<PaginaDTO<PuenteDisponibleDTO>>(
      `${this.base}/cursos/puentes-disponibles`,
      this.opciones(pagina, busqueda),
    );
  }

  private opciones(
    pagina?: number,
    busqueda = '',
  ): { headers: HttpHeaders; params: Record<string, string> } {
    // Al conectarse P2, solo su interceptor administra Authorization y renovación.
    const token = this.integracion ? null : this.sesion()?.token;
    const params: Record<string, string> =
      pagina === undefined ? {} : { page: String(pagina), size: '20' };
    if (busqueda.trim()) params['q'] = busqueda.trim();
    return {
      headers: new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {}),
      params,
    };
  }
}

export function mensajeErrorCursos(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return TEXTOS.cursos.sesionRequerida;
    if (error.status === 403) return TEXTOS.cursos.sinPermiso;
    if (error.status === 503) return TEXTOS.cursos.activacionPendiente;
    const cuerpo: unknown = error.error;
    if (
      cuerpo &&
      typeof cuerpo === 'object' &&
      'detail' in cuerpo &&
      typeof cuerpo.detail === 'string'
    ) {
      return cuerpo.detail;
    }
  }
  return TEXTOS.cursos.error;
}
