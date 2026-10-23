export type ModoFormulario = 'edicion' | 'lectura';

export interface PropiedadEsquema {
  type: string;
  title?: string;
  description?: string;
  enum?: string[];
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
  properties?: Record<string, PropiedadEsquema>;
  items?: PropiedadEsquema;
  required?: string[];
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

export interface CrearFormularioVersionDTO {
  codigo: string;
  esquema: EsquemaFormulario;
}

export interface EditarFormularioVersionDTO {
  esquema: EsquemaFormulario;
}

export interface PublicarFormularioVersionDTO {
  mapeo?: Record<string, string>;
}
