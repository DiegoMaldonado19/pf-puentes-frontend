export interface PaginaDTO<T> {
  content: T[];
  number: number;
  size: number;
  total_elements: number;
  total_pages: number;
}

export interface GuardarCursoDTO {
  nombre: string;
  anio: number;
  semestre: number;
  vigente: boolean;
}

export interface CursoDTO extends GuardarCursoDTO {
  id: string;
  catedratico_id: string;
  creado_en: string;
  actualizado_en: string;
}

export interface InscripcionDTO {
  id: string;
  curso_id: string;
  estudiante_id: string;
  creado_en: string;
}

export interface AsignacionDTO {
  id: string;
  inscripcion_id: string;
  curso_id: string;
  estudiante_id: string;
  puente_id: string;
  creado_en: string;
}

export interface EstudianteElegibleDTO {
  id: string;
  nombre: string;
  estado: 'ACTIVO' | 'PENDIENTE';
}

export interface PuenteDisponibleDTO {
  id: string;
  codigo: string;
  nombre: string;
}
