import { HttpErrorResponse } from '@angular/common/http';
import { detalleDeProblema, tipoDeProblema } from '../../core/errores/problema';
import { TEXTOS } from '../../shared/textos';

const t = TEXTOS.inspecciones.errores;

type TipoConocido = keyof typeof t.tipos;

function esConocido(tipo: string | null): tipo is TipoConocido {
  return tipo !== null && tipo in t.tipos;
}

/** Tipo kebab de RFC 7807 (`inspeccion-no-publicable`), no la URL completa. */
export function tipoDeError(error: unknown): string | null {
  return tipoDeProblema(error);
}

export function estadoHttp(error: unknown): number | null {
  return error instanceof HttpErrorResponse ? error.status : null;
}

/**
 * Mensaje de UI en español. Prefiere el texto propio de cada tipo al `detail` crudo (DT-FE-12);
 * el 404 de fila es siempre genérico para no revelar que un borrador ajeno existe (RN-INS-05).
 */
export function mensajeInspeccion(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return t.inesperado;
  if (error.status === 0) return t.sinConexion;
  if (error.status === 404) return t.noEncontrada;
  if (error.status === 413) return t.demasiadoGrande;
  if (error.status >= 500) return t.inesperado;
  const tipo = tipoDeProblema(error);
  if (esConocido(tipo)) return t.tipos[tipo];
  if (error.status === 401) return t.sinSesion;
  if (error.status === 403) return t.sinPermiso;
  return detalleDeProblema(error) ?? t.inesperado;
}

/** Errores tras los que la pantalla debe recargar el detalle y pasar a solo lectura. */
export function exigeRecarga(error: unknown): boolean {
  const tipo = tipoDeProblema(error);
  return tipo === 'inspeccion-no-editable' || tipo === 'transicion-invalida';
}
