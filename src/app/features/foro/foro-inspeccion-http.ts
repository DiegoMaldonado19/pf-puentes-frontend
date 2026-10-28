import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { FormularioService } from '../formulario/formulario.service';
import { referenciasDeElemento } from '../inspecciones/esquema';
import { InspeccionApi } from '../inspecciones/inspeccion-api';
import { ForoApiService } from './foro-api.service';
import { Comentario, conMenciones, Hilo, Pagina } from './modelos';
import type {
  ComentarioForoInspeccion,
  EntradaComentarioInspeccion,
  ForoInspeccionApi,
  ForoInspeccionMutacionesApi,
  ResultadoLecturaForoInspeccion,
  ResultadoMutacionForoInspeccion,
} from './puertos';

function comentarioForo(comentario: Comentario): ComentarioForoInspeccion {
  return {
    id: comentario.id,
    autorId: comentario.autor_id,
    autorNombre: comentario.autor_nombre,
    texto: comentario.texto,
    creadoEn: comentario.creado_en,
    padreId: comentario.padre_id,
    eliminado: comentario.eliminado,
    elementoRef: comentario.elemento_ref,
  };
}

@Injectable({ providedIn: 'root' })
export class ForoInspeccionHttp implements ForoInspeccionApi, ForoInspeccionMutacionesApi {
  readonly disponible = true;
  private readonly http = inject(HttpClient);
  private readonly foro = inject(ForoApiService);
  private readonly inspecciones = inject(InspeccionApi);
  private readonly formularios = inject(FormularioService);

  private ruta(id: string): string {
    return `/api/v1/inspecciones/${encodeURIComponent(id)}`;
  }

  leer(id: string, cursor = '0'): Observable<ResultadoLecturaForoInspeccion> {
    return forkJoin({
      hilo: this.http.get<Hilo>(`${this.ruta(id)}/hilo`),
      pagina: this.http.get<Pagina<Comentario>>(`${this.ruta(id)}/comentarios`, {
        params: { page: cursor, size: 50 },
      }),
      inspeccion: this.inspecciones.detalle(id),
    }).pipe(
      switchMap(({ hilo, pagina, inspeccion }) =>
        this.formularios.detalle(inspeccion.formulario.id).pipe(
          map((version): ResultadoLecturaForoInspeccion => ({
            estado: 'PUBLICADA',
            contexto: {
              inspeccionId: id,
              puenteId: hilo.puente_id,
              hiloId: hilo.id,
              cerrado: hilo.cerrado,
            },
            pagina: {
              comentarios: pagina.contenido.map(comentarioForo),
              siguienteCursor:
                pagina.pagina + 1 < pagina.total_paginas ? String(pagina.pagina + 1) : undefined,
              anclajesDisponibles: referenciasDeElemento(version.esquema).map((elementoRef) => ({
                elementoRef,
                etiqueta: elementoRef,
              })),
            },
          })),
        ),
      ),
      catchError((error: unknown) =>
        of<ResultadoLecturaForoInspeccion>(
          error instanceof HttpErrorResponse && [401, 403].includes(error.status)
            ? { estado: 'SIN_PERMISOS' }
            : error instanceof HttpErrorResponse && error.status === 404
              ? { estado: 'NO_PUBLICADA' }
              : { estado: 'ERROR', mensaje: 'No se pudo cargar la discusión de la inspección.' },
        ),
      ),
    );
  }

  crear(
    id: string,
    entrada: EntradaComentarioInspeccion,
  ): Observable<ResultadoMutacionForoInspeccion> {
    return this.publicar(id, entrada);
  }

  responder(
    id: string,
    padreId: string,
    entrada: EntradaComentarioInspeccion,
  ): Observable<ResultadoMutacionForoInspeccion> {
    return this.publicar(id, entrada, padreId);
  }

  private publicar(
    id: string,
    entrada: EntradaComentarioInspeccion,
    padreId?: string,
  ): Observable<ResultadoMutacionForoInspeccion> {
    return this.mutar(
      this.http.post<Comentario>(`${this.ruta(id)}/comentarios`, {
        texto: conMenciones(entrada.texto, entrada.menciones),
        elemento_ref: entrada.elementoRef || null,
        ...(padreId ? { padre_id: padreId } : {}),
      }),
    );
  }

  editar(
    _id: string,
    comentarioId: string,
    texto: string,
  ): Observable<ResultadoMutacionForoInspeccion> {
    return this.mutar(this.foro.editarComentario(comentarioId, texto), true);
  }

  borrar(_id: string, comentarioId: string): Observable<ResultadoMutacionForoInspeccion> {
    return this.mutar(this.foro.borrarComentario(comentarioId));
  }

  ocultarComentario(
    _id: string,
    comentarioId: string,
    motivo: string,
  ): Observable<ResultadoMutacionForoInspeccion> {
    if (!motivo.trim()) return of({ estado: 'MOTIVO_REQUERIDO' });
    return this.mutar(this.foro.ocultarComentario(comentarioId, motivo.trim()));
  }

  cerrarHilo(id: string, motivo: string): Observable<ResultadoMutacionForoInspeccion> {
    if (!motivo.trim()) return of({ estado: 'MOTIVO_REQUERIDO' });
    return this.mutar(
      this.http
        .get<Hilo>(`${this.ruta(id)}/hilo`)
        .pipe(switchMap((hilo) => this.foro.cerrarHilo(hilo.id, motivo.trim()))),
    );
  }

  private mutar(
    peticion: Observable<Comentario | void>,
    edicion = false,
  ): Observable<ResultadoMutacionForoInspeccion> {
    return peticion.pipe(
      map((comentario): ResultadoMutacionForoInspeccion => ({
        estado: 'OK',
        ...(comentario ? { comentario: comentarioForo(comentario) } : {}),
      })),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          if ([401, 403].includes(error.status))
            return of<ResultadoMutacionForoInspeccion>({ estado: 'SIN_PERMISOS' });
          if (error.status === 404)
            return of<ResultadoMutacionForoInspeccion>({ estado: 'NO_PUBLICADA' });
          if (error.status === 409)
            return of<ResultadoMutacionForoInspeccion>({
              estado: edicion ? 'FUERA_DE_PLAZO' : 'CERRADO',
            });
        }
        return of<ResultadoMutacionForoInspeccion>({
          estado: 'ERROR',
          mensaje: 'No se pudo guardar el cambio. Revisa la conexión y vuelve a intentarlo.',
        });
      }),
    );
  }
}
