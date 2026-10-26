import { EstadoCondicion } from '../../shared/estado-puente/estado-puente';

/** Contrato de la API de inventario (P3); nombres iguales al JSON del backend. */
export interface DepartamentoDTO {
  readonly codigo: string;
  readonly nombre: string;
}

export interface MunicipioDTO {
  readonly codigo: string;
  readonly nombre: string;
  readonly departamento_codigo: string;
}

export interface UtmDTO {
  readonly zona: number;
  readonly hemisferio: 'N' | 'S';
  readonly este: number;
  readonly norte: number;
}

export interface PuenteDTO {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly ruta: string;
  readonly departamento: DepartamentoDTO;
  readonly municipio: MunicipioDTO;
  readonly latitud: number;
  readonly longitud: number;
  readonly utm: UtmDTO;
  readonly anio_construccion: number | null;
  readonly activo: boolean;
  readonly motivo_baja: string | null;
  /** null = Sin evaluar: no hay inspección publicada (RN-INV-10). */
  readonly estado_actual: EstadoCondicion | null;
  readonly indice_condicion_actual: number | null;
  /** Fecha sin hora (yyyy-MM-dd). */
  readonly fecha_ultima_inspeccion: string | null;
  readonly creado_en: string;
  readonly actualizado_en: string;
}

export interface PaginaDTO<T> {
  readonly contenido: readonly T[];
  readonly pagina: number;
  readonly tamano: number;
  readonly total_elementos: number;
  readonly total_paginas: number;
}

export interface PuenteCercanoDTO {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly distancia_metros: number;
}

export type EstadoFiltro = EstadoCondicion | 'SIN_EVALUAR';

export interface FiltrosPuentes {
  readonly departamento?: string | null;
  readonly municipio?: string | null;
  readonly estado?: EstadoFiltro | null;
  readonly q?: string | null;
  readonly incluir_bajas?: boolean;
}

export interface CrearPuenteDTO {
  readonly nombre: string;
  readonly departamento_codigo: string;
  readonly municipio_codigo: string;
  readonly ruta: string;
  readonly latitud: number;
  readonly longitud: number;
  readonly anio_construccion: number | null;
  readonly confirmar_duplicado: boolean;
}

export interface EditarPuenteDTO {
  readonly nombre: string;
  readonly ruta: string;
  readonly latitud: number;
  readonly longitud: number;
  readonly anio_construccion: number | null;
  readonly confirmar_duplicado: boolean;
}

export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export interface CrearSolicitudPuenteDTO {
  readonly nombre: string;
  readonly departamento_codigo: string;
  readonly municipio_codigo: string;
  readonly ruta: string;
  readonly latitud: number;
  readonly longitud: number;
  readonly confirmar_duplicado: boolean;
}

export interface SolicitudPuenteDTO {
  readonly id: string;
  readonly catedratico_id: string;
  readonly nombre: string;
  readonly departamento: DepartamentoDTO;
  readonly municipio: MunicipioDTO;
  readonly ruta: string;
  readonly latitud: number;
  readonly longitud: number;
  readonly utm: UtmDTO;
  readonly estado: EstadoSolicitud;
  readonly motivo_rechazo: string | null;
  readonly administrador_id: string | null;
  readonly puente_id: string | null;
  readonly creado_en: string;
  readonly actualizado_en: string;
}
