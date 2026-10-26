import { EstadoCondicion } from '../../../shared/estado-puente/estado-puente';

/** Contrato de lectura de HU-P8-IC-04 y recálculo HU-P8-IC-07; nombres iguales al JSON del backend. */
export type AnulacionIc = 'SOCAVACION' | 'ASENTAMIENTO' | 'PERDIDA_SECCION' | 'AUSENCIA_PORTANTE';

export interface FormularioConPesosDTO {
  readonly id: string;
  readonly codigo: string;
}

export interface JuegoPesosDTO {
  readonly id: string;
  readonly formulario_version_id: string;
  readonly acta: string | null;
  readonly vigente_desde: string;
}

export interface CrearJuegoPesosDTO {
  readonly acta: string | null;
  readonly pesos: readonly { readonly elemento_ref: string; readonly peso: number }[];
}

export interface PesoElementoDTO {
  readonly id: string;
  readonly elemento_ref: string;
  readonly peso: number;
}

export interface PaginaPesosDTO<T> {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly total_elements: number;
  readonly total_pages: number;
}

export interface RecalculoIcDTO {
  readonly id: string;
  readonly inspeccion_id: string;
  readonly version_pesos_id: string;
  readonly formulario_version_id: string;
  readonly acta: string | null;
  readonly vigente_desde: string;
  readonly indice_condicion: number;
  readonly estado_calculado: EstadoCondicion;
  readonly anulacion: AnulacionIc | null;
  readonly creado_en: string;
}

export interface ResultadoOriginalIcDTO {
  readonly inspeccion_id: string;
  readonly puente_id: string;
  readonly formulario_version_id: string;
  readonly version_pesos_id: string;
  readonly acta: string | null;
  readonly vigente_desde: string;
  readonly indice_condicion: number;
  readonly estado_calculado: EstadoCondicion;
  readonly anulacion: AnulacionIc | null;
  readonly estado_confirmado: EstadoCondicion;
  readonly justificacion_estado: string | null;
  readonly publicada_en: string;
}

export interface ComparacionRecalculoIcDTO {
  readonly original: ResultadoOriginalIcDTO;
  readonly recalculos: PaginaPesosDTO<RecalculoIcDTO>;
}

export interface SolicitarRecalculoIcDTO {
  readonly version_pesos_id: string;
}
