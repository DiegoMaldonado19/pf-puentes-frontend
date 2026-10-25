/** Contrato de lectura de HU-P8-IC-04; nombres iguales al JSON del backend. */
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
