import { EstadoCondicion } from '../../shared/estado-puente/estado-puente';
import type { PersonaMencion } from './puertos';

export interface PuenteForo {
  id: string;
  codigo: string;
  nombre: string;
  ruta: string;
  municipio: string;
  departamento: string;
  estado_actual: EstadoCondicion | null;
  cantidad_hilos: number;
}

export interface Hilo {
  id: string;
  puente_id: string;
  titulo: string;
  categoria: CategoriaHilo;

  autor_id: string | null;
  autor_nombre: string | null;

  creado_en: string;

  cerrado: boolean;
}

export interface Comentario {
  id: string;
  hilo_id: string;
  autor_id: string;
  autor_nombre: string | null;

  texto: string | null;

  creado_en: string;

  padre_id: string | null;

  eliminado: boolean;
  elemento_ref?: string | null;
}

export const CATEGORIAS_HILO = [
  'discusion_tecnica',
  'propuesta_intervencion',
  'consulta',
  'referencia_documental',
  'alerta',
] as const;

export type CategoriaHilo = (typeof CATEGORIAS_HILO)[number];

export interface Pagina<T> {
  contenido: T[];

  pagina: number;
  tamano: number;
  total_elementos: number;
  total_paginas: number;
}

export interface PeticionCrearHilo {
  titulo: string;
  categoria: CategoriaHilo;
}

export interface PeticionCrearComentario {
  texto: string;

  padre_id?: string | null;
  elemento_ref?: string | null;
}

const FORMATO_FECHA_UTC = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export function formatearFechaUtc(iso: string): string {
  return FORMATO_FECHA_UTC.format(new Date(iso));
}

export const VENTANA_EDICION_MS = 15 * 60 * 1000;

export function dentroDeVentanaEdicion(creadoEn: string, ahora: number = Date.now()): boolean {
  const creado = Date.parse(creadoEn);
  return Number.isFinite(creado) && ahora - creado < VENTANA_EDICION_MS;
}

export function tieneRolModeracion(roles: readonly string[]): boolean {
  return roles.some((rol) => rol === 'CATEDRATICO' || rol === 'ADMINISTRADOR');
}

export const LIMITE_TITULO = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: string | null | undefined): valor is string {
  return !!valor && UUID.test(valor);
}

export function conMenciones(texto: string, ids: readonly string[] = []): string {
  return [texto, ...ids.map((id) => `@${id}`)].join(' ');
}

// Mismo patrón que ForoService del backend; sin la lista de personas (visitante) no se muestra el id
const MENCION = /(?<!\w)@\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?/gi;

export function nombrarMenciones(texto: string, personas: readonly PersonaMencion[]): string {
  const nombres = new Map(personas.map((persona) => [persona.id.toLowerCase(), persona.etiqueta]));
  return texto.replace(
    MENCION,
    (_, id: string) => `@${nombres.get(id.toLowerCase()) ?? 'usuario'}`,
  );
}

export interface EstadoRespuestas {
  contenido: Comentario[];
  pagina: number;
  totalPaginas: number;
  totalElementos: number;
  cargando: boolean;
  error: string | null;
}
