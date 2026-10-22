import { HttpErrorResponse } from '@angular/common/http';
import { TEXTOS } from '../../shared/textos';

export interface ErrorDeCampo {
  readonly campo: string;
  readonly mensaje: string;
}

export interface Problema {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly errores?: readonly ErrorDeCampo[];
}

const ALIAS_CAMPO: Readonly<Record<string, string>> = {
  contrasenaActual: 'contrasena_actual',
  contrasenaNueva: 'contrasena_nueva',
  numeroColegiado: 'numero_colegiado',
};

export function problema(error: unknown): Problema | null {
  return error instanceof HttpErrorResponse && error.error && typeof error.error === 'object'
    ? (error.error as Problema)
    : null;
}

/** Último segmento kebab-case de `type`, p. ej. credenciales-invalidas. */
export function tipoDeProblema(error: unknown): string | null {
  const type = problema(error)?.type;
  if (!type) return null;
  const segmento = type.split('/').filter(Boolean).at(-1);
  return segmento ?? null;
}

export function detalleDeProblema(error: unknown): string | null {
  return problema(error)?.detail ?? null;
}

export function campoDeFormulario(campo: string): string {
  return ALIAS_CAMPO[campo] ?? campo.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);
}

export function erroresDeCampo(error: unknown): readonly ErrorDeCampo[] {
  return (
    problema(error)?.errores?.map((item) => ({
      campo: campoDeFormulario(item.campo),
      mensaje: item.mensaje,
    })) ?? []
  );
}

/** Segundos de Retry-After; el 429 no es el bloqueo de cuenta. */
export function segundosDeReintento(error: unknown): number | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const crudo = error.headers.get('Retry-After');
  if (!crudo) return null;
  const segundos = Number.parseInt(crudo, 10);
  return Number.isFinite(segundos) && segundos >= 0 ? segundos : null;
}

export function mensajeDeProblema(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return TEXTOS.auth.errores.inesperado;
  if (error.status === 0) return TEXTOS.auth.errores.sinConexion;
  if (error.status >= 500) return TEXTOS.auth.errores.inesperado;
  const tipo = tipoDeProblema(error);
  if (tipo === 'demasiadas-solicitudes' || error.status === 429) {
    return TEXTOS.auth.errores['demasiadas-solicitudes'];
  }
  if (tipo === 'cuenta-bloqueada') {
    return detalleDeProblema(error) ?? TEXTOS.auth.errores['cuenta-bloqueada'];
  }
  if (tipo && tipo in TEXTOS.auth.errores) {
    return TEXTOS.auth.errores[tipo as keyof typeof TEXTOS.auth.errores];
  }
  return detalleDeProblema(error) ?? TEXTOS.auth.errores.inesperado;
}
