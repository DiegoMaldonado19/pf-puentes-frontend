/** Contrato real de OrdenMantenimientoDTO; fechas civiles ISO y marcas de tiempo UTC. */
export type EstadoOrden =
  'PROPUESTA' | 'PROGRAMADA' | 'EN_EJECUCION' | 'EJECUTADA' | 'DESCARTADA' | 'CANCELADA';
export type TipoOrden = 'RUTINARIO' | 'PREVENTIVO' | 'CORRECTIVO' | 'EMERGENCIA';
export type PrioridadOrden = 'ALTA' | 'MEDIA' | 'BAJA';

export interface OrdenMantenimientoDTO {
  readonly id: string;
  readonly puente_id: string;
  readonly inspeccion_id: string | null;
  readonly tipo: TipoOrden;
  readonly estado: EstadoOrden;
  readonly descripcion: string;
  readonly elemento_ref: string | null;
  readonly prioridad_sugerida: PrioridadOrden | null;
  readonly prioridad: PrioridadOrden;
  readonly justificacion_prioridad: string | null;
  readonly fecha_programada: string | null;
  readonly fecha_ejecucion: string | null;
  readonly responsable: string | null;
  readonly motivo: string | null;
  readonly creado_en: string;
  readonly actualizado_en: string;
}

/** Permite al contenedor refrescar la orden correcta, incluso si cambió la selección. */
export interface ReferenciaOrden {
  readonly puente_id: string;
  readonly id: string;
}

/** Contrato de página de órdenes; conserva el puente también en páginas vacías. */
export interface PaginaOrdenes {
  /** El contenedor conserva el puente consultado, también cuando la página llega vacía. */
  readonly puente_id: string;
  readonly content: readonly OrdenMantenimientoDTO[];
  readonly page: number;
  readonly size: number;
  readonly total_elements: number;
  readonly total_pages: number;
}

/** El GET de propuestas usa la misma estructura, con filtro PROPUESTA en el servidor. */
export type PaginaPropuestas = PaginaOrdenes;

export interface ConsultaPropuestas {
  readonly puente_id: string;
  readonly page: number;
  readonly size: number;
}

/** Contrato de fotos de P1; las URL firmadas son temporales. */
export interface EvidenciaDTO {
  readonly id: string;
  readonly tipo: 'JPEG' | 'WEBP';
  readonly elemento_ref: string | null;
  readonly latitud: number | null;
  readonly longitud: number | null;
  readonly capturada_en: string | null;
  readonly tamano: number;
  readonly url: string | null;
  readonly url_miniatura: string | null;
}
export interface PaginaEvidencias {
  readonly puente_id: string;
  readonly orden_id: string;
  readonly content: readonly EvidenciaDTO[];
  readonly page: number;
  readonly size: number;
  readonly total_elements: number;
  readonly total_pages: number;
}
export interface CierreOrden {
  readonly fecha_ejecucion: string;
  readonly responsable: string;
}

/** RN-MTO-09: motivo escrito, sin cambiar un estado arbitrario desde el cliente. */
export interface DescartarOrden {
  readonly motivo: string;
}
