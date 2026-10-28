import { inject, InjectionToken, Signal, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { MarcaAnclada } from '../../shared/marcador-anclado/marcador-anclado';
import { ForoInspeccionHttp } from './foro-inspeccion-http';

export interface PersonaMencion {
  readonly id: string;
  readonly etiqueta: string;
}

export interface SesionP2 {
  readonly disponible: boolean;
  readonly usuarioId: Signal<string | null>;
  readonly roles: Signal<readonly string[]>;
}

export interface MencionesP2 {
  readonly disponible: boolean;
  readonly personas: Signal<readonly PersonaMencion[]>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  cargar(): void;
}

const SESION_NO_DISPONIBLE: SesionP2 = {
  disponible: false,
  usuarioId: signal(null),
  roles: signal([]),
};

const MENCIONES_NO_DISPONIBLE: MencionesP2 = {
  disponible: false,
  personas: signal([]),
  cargando: signal(false),
  error: signal(null),
  cargar: () => undefined,
};

export const SESION_P2 = new InjectionToken<SesionP2>('SESION_P2', {
  providedIn: 'root',
  factory: () => SESION_NO_DISPONIBLE,
});

export const MENCIONES_P2 = new InjectionToken<MencionesP2>('MENCIONES_P2', {
  providedIn: 'root',
  factory: () => MENCIONES_NO_DISPONIBLE,
});

export interface ComentarioForoInspeccion {
  readonly id: string;
  readonly autorId: string;
  readonly autorNombre?: string | null;
  readonly texto: string | null;

  readonly creadoEn: string;

  readonly padreId?: string | null;

  readonly eliminado?: boolean;

  readonly elementoRef?: string | null;
}

export interface OpcionAnclajeInspeccion {
  readonly elementoRef: string;
  readonly etiqueta: string;
}

export type MarcasPorElemento = Readonly<Record<string, readonly MarcaAnclada[]>>;

export interface PaginaComentariosInspeccion {
  readonly comentarios: readonly ComentarioForoInspeccion[];
  readonly siguienteCursor?: string;

  readonly marcasPorElemento?: MarcasPorElemento;

  readonly anclajesDisponibles?: readonly OpcionAnclajeInspeccion[];
}

export interface ContextoForoInspeccion {
  readonly inspeccionId: string;
  readonly puenteId: string;
  readonly hiloId?: string;
  readonly cerrado?: boolean;
}

export type ResultadoLecturaForoInspeccion =
  | {
      readonly estado: 'PUBLICADA';
      readonly contexto: ContextoForoInspeccion;
      readonly pagina: PaginaComentariosInspeccion;
    }
  | { readonly estado: 'NO_PUBLICADA' }
  | { readonly estado: 'SIN_PERMISOS' }
  | { readonly estado: 'ERROR'; readonly mensaje: string }
  | { readonly estado: 'NO_INTEGRADO' };

export interface EntradaComentarioInspeccion {
  readonly texto: string;
  readonly elementoRef?: string | null;
  readonly menciones?: readonly string[];
}

export type ResultadoMutacionForoInspeccion =
  | { readonly estado: 'OK'; readonly comentario?: ComentarioForoInspeccion }
  | { readonly estado: 'NO_INTEGRADO' }
  | { readonly estado: 'SIN_PERMISOS' }
  | { readonly estado: 'NO_PUBLICADA' }
  | { readonly estado: 'CERRADO' }
  | { readonly estado: 'FUERA_DE_PLAZO' }
  | { readonly estado: 'MOTIVO_REQUERIDO' }
  | { readonly estado: 'ERROR'; readonly mensaje: string };

export interface SeleccionContextoInspeccion {
  readonly elementoRef: string;
  readonly marca: MarcaAnclada;
  readonly comentarioId: string;
}

export interface ForoInspeccionApi {
  readonly disponible: boolean;
  leer(inspeccionId: string, cursor?: string): Observable<ResultadoLecturaForoInspeccion>;
}

export interface ForoInspeccionMutacionesApi {
  readonly disponible: boolean;
  crear(
    inspeccionId: string,
    entrada: EntradaComentarioInspeccion,
  ): Observable<ResultadoMutacionForoInspeccion>;
  responder(
    inspeccionId: string,
    padreId: string,
    entrada: EntradaComentarioInspeccion,
  ): Observable<ResultadoMutacionForoInspeccion>;
  editar(
    inspeccionId: string,
    comentarioId: string,
    texto: string,
  ): Observable<ResultadoMutacionForoInspeccion>;
  borrar(inspeccionId: string, comentarioId: string): Observable<ResultadoMutacionForoInspeccion>;
  ocultarComentario(
    inspeccionId: string,
    comentarioId: string,
    motivo: string,
  ): Observable<ResultadoMutacionForoInspeccion>;
  cerrarHilo(inspeccionId: string, motivo: string): Observable<ResultadoMutacionForoInspeccion>;
}

export const FORO_INSPECCION_API = new InjectionToken<ForoInspeccionApi>('FORO_INSPECCION_API', {
  providedIn: 'root',
  factory: () => inject(ForoInspeccionHttp),
});

export const FORO_INSPECCION_MUTACIONES_API = new InjectionToken<ForoInspeccionMutacionesApi>(
  'FORO_INSPECCION_MUTACIONES_API',
  {
    providedIn: 'root',
    factory: () => inject(ForoInspeccionHttp),
  },
);
