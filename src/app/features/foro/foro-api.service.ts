import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CategoriaHilo,
  Comentario,
  Hilo,
  Pagina,
  PeticionCrearComentario,
  PeticionCrearHilo,
  PuenteForo,
} from './modelos';

const API = '/api/v1';

@Injectable({ providedIn: 'root' })
export class ForoApiService {
  private readonly http = inject(HttpClient);

  listarForos(busqueda = '', pagina = 0, tamano = 12): Observable<Pagina<PuenteForo>> {
    const params = new HttpParams()
      .set('q', busqueda.trim())
      .set('page', pagina)
      .set('size', tamano);
    return this.http.get<Pagina<PuenteForo>>(`${API}/foro/puentes`, { params });
  }

  listarHilos(
    puenteId: string,
    pagina: number,
    tamano: number,
    categoria: CategoriaHilo | null,
  ): Observable<Pagina<Hilo>> {
    let params = new HttpParams().set('page', pagina).set('size', tamano);
    if (categoria) params = params.set('categoria', categoria);
    return this.http.get<Pagina<Hilo>>(`${API}/puentes/${puenteId}/hilos`, { params });
  }

  obtenerHilo(hiloId: string): Observable<Hilo> {
    return this.http.get<Hilo>(`${API}/hilos/${hiloId}`);
  }

  listarComentarios(
    hiloId: string,
    pagina: number,
    tamano: number,
  ): Observable<Pagina<Comentario>> {
    return this.http.get<Pagina<Comentario>>(`${API}/hilos/${hiloId}/comentarios`, {
      params: { page: pagina, size: tamano },
    });
  }

  listarRespuestas(raizId: string, pagina: number, tamano: number): Observable<Pagina<Comentario>> {
    return this.http.get<Pagina<Comentario>>(`${API}/comentarios/${raizId}/respuestas`, {
      params: { page: pagina, size: tamano },
    });
  }

  crearHilo(puenteId: string, peticion: PeticionCrearHilo): Observable<Hilo> {
    return this.http.post<Hilo>(`${API}/puentes/${puenteId}/hilos`, peticion);
  }

  crearComentario(hiloId: string, peticion: PeticionCrearComentario): Observable<Comentario> {
    return this.http.post<Comentario>(`${API}/hilos/${hiloId}/comentarios`, peticion);
  }

  editarComentario(comentarioId: string, texto: string): Observable<Comentario> {
    return this.http.patch<Comentario>(`${API}/comentarios/${comentarioId}`, { texto });
  }

  borrarComentario(comentarioId: string): Observable<void> {
    return this.http.delete<void>(`${API}/comentarios/${comentarioId}`);
  }

  ocultarComentario(comentarioId: string, motivo: string): Observable<void> {
    return this.http.patch<void>(`${API}/comentarios/${comentarioId}/ocultamiento`, { motivo });
  }

  cerrarHilo(hiloId: string, motivo: string): Observable<void> {
    return this.http.patch<void>(`${API}/hilos/${hiloId}/cierre`, { motivo });
  }
}
