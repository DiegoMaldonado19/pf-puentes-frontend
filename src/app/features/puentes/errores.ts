import { HttpErrorResponse } from '@angular/common/http';
import { TEXTOS } from '../../shared/textos';
import { PuenteCercanoDTO } from './modelos';

const t = TEXTOS.puentes.errores;

interface Problema {
  readonly type?: string;
  readonly detail?: string;
  readonly errores?: readonly { campo: string; mensaje: string }[];
  readonly cercanos?: readonly PuenteCercanoDTO[];
}

function problema(error: unknown): Problema | null {
  return error instanceof HttpErrorResponse && error.error && typeof error.error === 'object'
    ? (error.error as Problema)
    : null;
}

/**
 * DT-BE-05: convierte el Problem Details del backend en un mensaje en español. Mientras P2 no
 * entregue su erroresInterceptor (DT-FE-10), el módulo lo hace aquí con el mismo criterio.
 */
export function mensajeDeError(error: unknown, noEncontrado: string = t.noEncontrado): string {
  if (!(error instanceof HttpErrorResponse)) return t.inesperado;
  if (error.status === 0) return t.sinConexion;
  if (error.status === 401) return t.sinSesion;
  if (error.status === 403) return t.sinPermiso;
  if (error.status === 404) return noEncontrado;
  if (error.status >= 500) return t.inesperado;
  const cuerpo = problema(error);
  const campos = cuerpo?.errores?.map((e) => `${e.campo}: ${e.mensaje}`) ?? [];
  // Los 4xx de negocio del backend ya traen un detalle en español para el usuario
  return [cuerpo?.detail ?? t.inesperado, ...campos].join(' ');
}

/** RN-INV-06: el 409 "posible-duplicado" trae los puentes a menos de 100 m. */
export function puentesCercanos(error: unknown): readonly PuenteCercanoDTO[] | null {
  const cuerpo = problema(error);
  return error instanceof HttpErrorResponse &&
    error.status === 409 &&
    cuerpo?.type?.endsWith('/posible-duplicado') &&
    Array.isArray(cuerpo.cercanos)
    ? cuerpo.cercanos
    : null;
}
