export type ModoFormulario = 'edicion' | 'lectura';

export interface PropiedadEsquema {
  type: string;
  title?: string;
  description?: string;
  enum?: string[];
  format?: string;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  readOnly?: boolean;
  'x-permanente'?: boolean;
  'x-dano'?: boolean;
  'x-grupo'?: string;
  'x-elemento-ref'?: string;
  'x-orden'?: number;
  'x-unidad'?: string;
  'x-anulacion-critica'?: string;
  'x-extra'?: boolean;
  'x-control'?: string;
  properties?: Record<string, PropiedadEsquema>;
  items?: PropiedadEsquema;
  required?: string[];
}

/** Tipos de campo adicional del constructor (B2). Coinciden con el backend. */
export type TipoCampoExtra =
  'texto' | 'texto_largo' | 'numero' | 'entero' | 'si_no' | 'opcion' | 'fecha';

/** Campo adicional tal como lo recibe y envía la API de composición. */
export interface CampoExtraDTO {
  seccion: string;
  clave: string;
  titulo: string;
  tipo: TipoCampoExtra;
  obligatorio?: boolean;
  opciones?: string[] | null;
  minimo?: number | null;
  maximo?: number | null;
  unidad?: string | null;
  ayuda?: string | null;
}

export interface SeccionFormularioDTO {
  clave: string;
  titulo: string;
  admite_campos_extra: boolean;
}

export interface EsquemaBaseDTO {
  esquema: EsquemaFormulario;
  secciones: SeccionFormularioDTO[];
}

/** Error de un campo: `campo` usa rutas como `campos_extra[2].clave`. */
export interface ErrorValidacionCampo {
  campo: string;
  mensaje: string;
}

export interface ResultadoValidacionFormularioDTO {
  valido: boolean;
  errores: ErrorValidacionCampo[];
}

export interface EsquemaFormulario {
  $schema?: string;
  title: string;
  description?: string;
  type: 'object';
  properties: Record<string, PropiedadEsquema>;
  required?: string[];
}

export interface FormularioVersionDTO {
  id: string;
  codigo: string;
  esquema: EsquemaFormulario;
  mapeo?: Record<string, string> | null;
  estado: 'BORRADOR' | 'ACTIVA' | 'RETIRADA';
  publicada_en?: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface PaginaFormularioVersionDTO {
  contenido: FormularioVersionDTO[];
  pagina: number;
  tamano: number;
  total_elementos: number;
  total_paginas: number;
}

/** Con campos_extra la versión se compone sobre el esquema base; esquema es el uso avanzado. */
export interface CrearFormularioVersionDTO {
  codigo: string;
  esquema?: EsquemaFormulario;
  campos_extra?: CampoExtraDTO[];
}

export interface EditarFormularioVersionDTO {
  esquema?: EsquemaFormulario;
  campos_extra?: CampoExtraDTO[];
}

export interface PublicarFormularioVersionDTO {
  mapeo?: Record<string, string>;
}
