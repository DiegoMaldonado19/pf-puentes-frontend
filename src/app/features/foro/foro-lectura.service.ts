import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TEXTOS } from '../../shared/textos';
import { ForoApiService } from './foro-api.service';
import { CategoriaHilo, Comentario, Hilo, EstadoRespuestas } from './modelos';

const TAMANO_HILOS = 20;
const TAMANO_COMENTARIOS = 50;
const TAMANO_RESPUESTAS = 20;
const TAMANO_MAXIMO = 100;

const RESPUESTAS_VACIAS: EstadoRespuestas = {
  contenido: [],
  pagina: 0,
  totalPaginas: 0,
  totalElementos: 0,
  cargando: false,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class ForoLecturaService {
  private readonly api = inject(ForoApiService);
  readonly hilos = signal<Hilo[]>([]);
  readonly paginaHilos = signal(0);
  readonly totalPaginasHilos = signal(0);
  readonly totalElementosHilos = signal(0);
  readonly cargandoHilos = signal(false);
  readonly errorHilos = signal<string | null>(null);
  readonly listadoNoEncontrado = signal(false);
  private ultimoListado = 0;
  listadoSolicitado = {
    puenteId: '',
    pagina: 0,
    tamano: TAMANO_HILOS,
    categoria: null as CategoriaHilo | null,
  };

  readonly hilo = signal<Hilo | null>(null);
  readonly cargandoHilo = signal(false);
  readonly errorHilo = signal<string | null>(null);
  readonly detalleNoEncontrado = signal(false);
  private ultimoDetalle = 0;
  detalleSolicitado = { hiloId: '', puenteId: '' };

  readonly comentarios = signal<Comentario[]>([]);
  readonly paginaComentarios = signal(0);
  readonly totalPaginasComentarios = signal(0);
  readonly totalElementosComentarios = signal(0);
  readonly cargandoComentarios = signal(false);
  readonly errorComentarios = signal<string | null>(null);
  private ultimoComentarios = 0;
  comentariosSolicitados = { hiloId: '', pagina: 0, tamano: TAMANO_COMENTARIOS };

  private readonly respuestasPorRaiz = signal<Record<string, EstadoRespuestas>>({});
  private ultimoRespuestas: Record<string, number> = {};
  respuestasSolicitadas: Record<string, { pagina: number; tamano: number }> = {};

  cargarHilos(
    puenteId: string,
    pagina = 0,
    tamano = TAMANO_HILOS,
    categoria: CategoriaHilo | null = null,
    silenciosa = false,
  ): void {
    const { page, size } = normalizarPaginacion(pagina, tamano);
    this.listadoSolicitado = { puenteId, pagina: page, tamano: size, categoria };
    const carga = ++this.ultimoListado;
    if (!silenciosa) {
      this.cargandoHilos.set(true);
      this.errorHilos.set(null);
      this.listadoNoEncontrado.set(false);
    }
    this.api.listarHilos(puenteId, page, size, categoria).subscribe({
      next: (resp) => {
        if (carga !== this.ultimoListado) {
          return;
        }
        this.hilos.set(resp.contenido);
        this.paginaHilos.set(resp.pagina);
        this.totalPaginasHilos.set(resp.total_paginas);
        this.totalElementosHilos.set(resp.total_elementos);
        this.cargandoHilos.set(false);
      },
      error: (err: unknown) => {
        if (carga !== this.ultimoListado) {
          return;
        }
        this.cargandoHilos.set(false);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.listadoNoEncontrado.set(true);
          this.hilos.set([]);
          return;
        }
        this.errorHilos.set(TEXTOS.foro.errorHilos);
      },
    });
  }

  cargarHilo(hiloId: string, puenteId: string, silenciosa = false): void {
    if (this.detalleSolicitado.hiloId && this.detalleSolicitado.hiloId !== hiloId) {
      this.comentarios.set([]);
      this.paginaComentarios.set(0);
      this.totalPaginasComentarios.set(0);
      this.totalElementosComentarios.set(0);
      this.respuestasPorRaiz.set({});
      this.ultimoRespuestas = {};
      this.respuestasSolicitadas = {};
    }
    this.detalleSolicitado = { hiloId, puenteId };
    const carga = ++this.ultimoDetalle;
    if (!silenciosa) {
      this.cargandoHilo.set(true);
      this.errorHilo.set(null);
      this.detalleNoEncontrado.set(false);
    }
    this.api.obtenerHilo(hiloId).subscribe({
      next: (dto) => {
        if (carga !== this.ultimoDetalle) {
          return;
        }
        this.cargandoHilo.set(false);
        if (dto.puente_id !== puenteId) {
          this.hilo.set(null);
          this.detalleNoEncontrado.set(true);
          return;
        }
        this.hilo.set(dto);
      },
      error: (err: unknown) => {
        if (carga !== this.ultimoDetalle) {
          return;
        }
        this.cargandoHilo.set(false);
        this.hilo.set(null);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.detalleNoEncontrado.set(true);
          return;
        }
        this.errorHilo.set(TEXTOS.foro.errorDetalle);
      },
    });
  }

  cargarComentarios(
    hiloId: string,
    pagina = 0,
    tamano = TAMANO_COMENTARIOS,
    silenciosa = false,
  ): void {
    const { page, size } = normalizarPaginacion(pagina, tamano);
    this.comentariosSolicitados = { hiloId, pagina: page, tamano: size };
    const carga = ++this.ultimoComentarios;
    if (!silenciosa) {
      this.cargandoComentarios.set(true);
      this.errorComentarios.set(null);
    }
    this.api.listarComentarios(hiloId, page, size).subscribe({
      next: (resp) => {
        if (carga !== this.ultimoComentarios) {
          return;
        }
        this.comentarios.set(resp.contenido);
        this.paginaComentarios.set(resp.pagina);
        this.totalPaginasComentarios.set(resp.total_paginas);
        this.totalElementosComentarios.set(resp.total_elementos);
        this.cargandoComentarios.set(false);
      },
      error: () => {
        if (carga !== this.ultimoComentarios) {
          return;
        }
        this.cargandoComentarios.set(false);
        this.errorComentarios.set(TEXTOS.foro.errorComentarios);
      },
    });
  }

  estadoRespuestas(raizId: string): EstadoRespuestas {
    return this.respuestasPorRaiz()[raizId] ?? RESPUESTAS_VACIAS;
  }

  cargarRespuestas(
    raizId: string,
    pagina = 0,
    tamano = TAMANO_RESPUESTAS,
    silenciosa = false,
  ): void {
    const { page, size } = normalizarPaginacion(pagina, tamano);
    this.respuestasSolicitadas[raizId] = { pagina: page, tamano: size };
    const carga = (this.ultimoRespuestas[raizId] ?? 0) + 1;
    this.ultimoRespuestas[raizId] = carga;
    if (!silenciosa) {
      this.actualizarRespuestas(raizId, { cargando: true, error: null });
    }
    this.api.listarRespuestas(raizId, page, size).subscribe({
      next: (resp) => {
        if (this.ultimoRespuestas[raizId] !== carga) {
          return; 
        }
        this.actualizarRespuestas(raizId, {
          contenido: resp.contenido,
          pagina: resp.pagina,
          totalPaginas: resp.total_paginas,
          totalElementos: resp.total_elementos,
          cargando: false,
          error: null,
        });
      },
      error: () => {
        if (this.ultimoRespuestas[raizId] !== carga) {
          return;
        }
        this.actualizarRespuestas(raizId, {
          cargando: false,
          error: TEXTOS.foro.errorRespuestas,
        });
      },
    });
  }

  refrescarVistaHilo(hiloId: string, enDetalle: boolean, enListado: boolean): void {
    if (enDetalle && this.detalleSolicitado.hiloId === hiloId) {
      const s = this.detalleSolicitado;
      this.cargarHilo(s.hiloId, s.puenteId, true);
      return;
    }
    if (enListado && this.listadoSolicitado.puenteId) {
      const s = this.listadoSolicitado;
      this.cargarHilos(s.puenteId, s.pagina, s.tamano, s.categoria, true);
    }
  }

  retirarRaizYRespuestas(raizId: string): void {
    this.comentarios.update((lista) => lista.filter((c) => c.id !== raizId));
    if (this.respuestasPorRaiz()[raizId]) {
      this.respuestasPorRaiz.update((mapa) => {
        const copia = { ...mapa };
        delete copia[raizId];
        return copia;
      });
    }
    delete this.respuestasSolicitadas[raizId];
    delete this.ultimoRespuestas[raizId];
  }

  retirarRespuesta(raizId: string, respuestaId: string): void {
    const estado = this.respuestasPorRaiz()[raizId];
    if (!estado) {
      return;
    }
    this.actualizarRespuestas(raizId, {
      contenido: estado.contenido.filter((c) => c.id !== respuestaId),
    });
  }

  reintentarRespuestas(raizId: string): void {
    const s = this.respuestasSolicitadas[raizId];
    if (s) {
      this.cargarRespuestas(raizId, s.pagina, s.tamano);
    }
  }

  private actualizarRespuestas(raizId: string, parcial: Partial<EstadoRespuestas>): void {
    this.respuestasPorRaiz.update((mapa) => ({
      ...mapa,
      [raizId]: { ...(mapa[raizId] ?? RESPUESTAS_VACIAS), ...parcial },
    }));
  }

  buscarComentario(id: string): Comentario | null {
    const raiz = this.comentarios().find((c) => c.id === id);
    if (raiz) {
      return raiz;
    }
    for (const estado of Object.values(this.respuestasPorRaiz())) {
      const respuesta = estado.contenido.find((c) => c.id === id);
      if (respuesta) {
        return respuesta;
      }
    }
    return null;
  }

  reemplazarComentario(dto: Comentario): void {
    this.comentarios.update((lista) => lista.map((c) => (c.id === dto.id ? dto : c)));
    const padreId = dto.padre_id;
    const estado = padreId ? this.respuestasPorRaiz()[padreId] : undefined;
    if (padreId && estado) {
      this.actualizarRespuestas(padreId, {
        contenido: estado.contenido.map((c) => (c.id === dto.id ? dto : c)),
      });
    }
  }

  refrescarContenedor(objetivo: Comentario): void {
    if (!objetivo.padre_id) {
      this.cargarComentarios(
        objetivo.hilo_id,
        this.comentariosSolicitados.pagina,
        this.comentariosSolicitados.tamano,
        true,
      );
      return;
    }
    const s = this.respuestasSolicitadas[objetivo.padre_id];
    if (s) {
      this.cargarRespuestas(objetivo.padre_id, s.pagina, s.tamano, true);
    }
  }

  reintentarHilos(): void {
    const s = this.listadoSolicitado;
    if (s.puenteId) {
      this.cargarHilos(s.puenteId, s.pagina, s.tamano, s.categoria);
    }
  }

  reintentarDetalle(): void {
    const s = this.detalleSolicitado;
    if (s.hiloId) {
      this.cargarHilo(s.hiloId, s.puenteId);
    }
  }

  reintentarComentarios(): void {
    const s = this.comentariosSolicitados;
    if (s.hiloId) {
      this.cargarComentarios(s.hiloId, s.pagina, s.tamano);
    }
  }

  reintentarComentariosSilenciosamente(): void {
    const s = this.comentariosSolicitados;
    this.cargarComentarios(s.hiloId, s.pagina, s.tamano, true);
  }

  marcarHiloCerrado(hiloId: string, actualizarListado = true): void {
    if (actualizarListado) {
      this.hilos.update((lista) =>
        lista.map((h) => (h.id === hiloId ? { ...h, cerrado: true } : h)),
      );
    }
    const detalle = this.hilo();
    if (detalle && detalle.id === hiloId && !detalle.cerrado) {
      this.hilo.set({ ...detalle, cerrado: true });
    }
  }
}

function normalizarPaginacion(pagina: number, tamano: number): { page: number; size: number } {
  return {
    page: Math.max(0, Math.trunc(pagina)),
    size: Math.min(Math.max(1, Math.trunc(tamano)), TAMANO_MAXIMO),
  };
}
