import type { Rol } from '../../core/auth/modelos';
import type { EstadoCondicion } from '../../shared/estado-puente/estado-puente';

/** Contratos de P5 (/api/v1/inspecciones…); nombres iguales al JSON del backend (snake_case). */

export type EstadoInspeccion =
  'BORRADOR' | 'ENVIADA' | 'EN_REVISION' | 'CAMBIOS_SOLICITADOS' | 'PUBLICADA' | 'RECHAZADA';

/** Forma de página de inspeccion/. No reutilizar la de puentes (usa `contenido`). */
export interface PaginaInspecciones<T> {
  readonly content: readonly T[];
  readonly number: number;
  readonly size: number;
  readonly total_elements: number;
  readonly total_pages: number;
}

export interface PuenteResumenDTO {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
}

export interface FormularioResumenDTO {
  readonly id: string;
  readonly codigo: string;
}

export interface AcompananteDTO {
  readonly nombre: string;
  readonly usuario_id: string | null;
}

export interface PuenteInspeccionableDTO {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly curso_id: string | null;
  readonly curso_nombre: string | null;
  readonly borrador_en_curso: boolean;
}

export interface InspeccionResumenDTO {
  readonly id: string;
  readonly puente: PuenteResumenDTO;
  readonly estado: EstadoInspeccion;
  readonly fecha_inspeccion: string;
  readonly curso_id: string | null;
  readonly creado_en: string;
  readonly superada: boolean;
  readonly superada_por: string | null;
}

/** InspeccionDTO usa NON_NULL: los campos opcionales pueden no venir (p. ej. el IC en un borrador). */
export interface InspeccionDTO {
  readonly id: string;
  readonly puente: PuenteResumenDTO;
  readonly formulario: FormularioResumenDTO;
  readonly estado: EstadoInspeccion;
  readonly version: number;
  readonly fecha_inspeccion: string;
  readonly curso_id?: string;
  readonly autor_id: string;
  readonly dispositivo_id?: string;
  readonly creada_en_dispositivo?: string;
  readonly creado_en: string;
  readonly enviada_en?: string;
  readonly sincronizada_en?: string;
  readonly publicada_en?: string;
  readonly datos_permanentes_confirmados_en?: string;
  readonly precargada_de_id?: string;
  readonly gps_disponible: boolean;
  readonly latitud?: number;
  readonly longitud?: number;
  readonly distancia_a_puente_m?: number;
  readonly advertencia_ubicacion?: string;
  readonly datos?: Record<string, unknown>;
  readonly acompanantes?: readonly AcompananteDTO[];
  readonly indice_condicion?: number;
  readonly estado_calculado?: EstadoCondicion;
  readonly estado_confirmado?: EstadoCondicion;
  readonly justificacion_estado?: string;
  readonly superada: boolean;
  readonly superada_por?: string;
  readonly supersede_a_id?: string;
  readonly motivo_correccion?: string;
  readonly advertencias?: readonly string[];
}

export interface DatosPermanentesDTO {
  readonly datos: Record<string, unknown>;
  readonly origen_inspeccion_id: string | null;
  readonly anio_construccion: number | null;
}

export interface HistorialTransicionDTO {
  readonly id: string;
  readonly estado_origen: EstadoInspeccion | null;
  readonly estado_destino: EstadoInspeccion;
  /** null = Sistema. */
  readonly actor_id: string | null;
  readonly motivo: string | null;
  readonly creado_en: string;
}

export interface CrearInspeccionDTO {
  readonly id: string;
  readonly puente_id: string;
  readonly asignacion_id?: string;
  readonly curso_id?: string;
  readonly fecha_inspeccion: string;
  readonly dispositivo_id: string;
  readonly latitud?: number;
  readonly longitud?: number;
  readonly creada_en_dispositivo?: string;
  readonly supersede_a_id?: string;
  readonly motivo_correccion?: string;
}

/** No enviar puente_id/autor_id/formulario_version_id/estado: el servidor responde 422 campo-inmutable. */
export interface GuardarAvanceDTO {
  readonly datos: Record<string, unknown>;
  readonly version: number;
  readonly fecha_inspeccion?: string;
  readonly grupos_sin_danos?: readonly string[];
}

export interface ConfirmarDatosPermanentesDTO {
  readonly datos: Record<string, unknown>;
}

export interface ReemplazarAcompanantesDTO {
  readonly acompanantes: readonly AcompananteDTO[];
}

export interface EnviarInspeccionDTO {
  readonly enviada_en?: string;
}

export interface FiltrosInspecciones {
  readonly puente_id?: string;
  readonly estado?: EstadoInspeccion;
  readonly fecha_desde?: string;
  readonly fecha_hasta?: string;
}

export type TipoArchivo = 'FOTO' | 'DOCUMENTO';

export interface ArchivoDTO {
  readonly id: string;
  readonly tipo: TipoArchivo;
  readonly elemento_ref: string | null;
  readonly latitud: number | null;
  readonly longitud: number | null;
  readonly capturada_en: string | null;
  readonly tamano: number;
  /** Las URL vencen a los 15 min (DT-SEC-09): no son fuente de verdad. */
  readonly url: string;
  readonly url_miniatura: string | null;
}

/** RN-ARC-04 y RN-INS-06. */
export const MAXIMO_FOTOS = 60;
export const MAXIMO_DOCUMENTOS = 10;
export const MINIMO_FOTOS_ENVIO = 4;
export const MAXIMO_BYTES_PDF = 20 * 1024 * 1024;
export const MAXIMO_MOTIVO_CORRECCION = 500;
export const MAXIMO_NOMBRE_ACOMPANANTE = 150;

/** Editable solo si es BORRADOR y propia; el resto abre el motor en lectura (RN-FRM-05). */
export function esEditable(inspeccion: InspeccionDTO, usuarioId: string | null): boolean {
  return (
    inspeccion.estado === 'BORRADOR' && usuarioId !== null && inspeccion.autor_id === usuarioId
  );
}

/** El estudiante nunca publica por su cuenta (RN-REV-01); los demás publican en el mismo acto. */
export function publicaAlEnviar(rol: Rol | null): boolean {
  return rol === 'CATEDRATICO' || rol === 'PROFESIONAL_EXTERNO';
}

/** Mejor estado conocido: el confirmado manda sobre el calculado (RN-IC-06). */
export function estadoDePuente(inspeccion: InspeccionDTO): EstadoCondicion | null {
  return inspeccion.estado_confirmado ?? inspeccion.estado_calculado ?? null;
}
