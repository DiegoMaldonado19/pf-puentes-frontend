import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TEXTOS } from '../../shared/textos';
import {
  campoDeFormulario,
  erroresDeCampo,
  mensajeDeProblema,
  segundosDeReintento,
  tipoDeProblema,
} from './problema';

const error = (status: number, cuerpo: unknown = null, headers?: HttpHeaders) =>
  new HttpErrorResponse({ status, error: cuerpo, headers });

const problema = (type: string, extra: Record<string, unknown> = {}) => ({
  type: `https://sgp.cunoc.usac.edu.gt/errores/${type}`,
  ...extra,
});

describe('problema RFC 7807', () => {
  it('lee el último segmento de type', () => {
    expect(tipoDeProblema(error(401, problema('credenciales-invalidas')))).toBe(
      'credenciales-invalidas',
    );
    expect(tipoDeProblema(error(401))).toBeNull();
  });

  it('mapea el campo Java y el JSON al mismo nombre de formulario', () => {
    expect(campoDeFormulario('contrasenaActual')).toBe('contrasena_actual');
    expect(campoDeFormulario('contrasena_actual')).toBe('contrasena_actual');
    expect(
      erroresDeCampo(
        error(
          400,
          problema('datos-invalidos', { errores: [{ campo: 'contrasenaNueva', mensaje: 'x' }] }),
        ),
      ),
    ).toEqual([{ campo: 'contrasena_nueva', mensaje: 'x' }]);
  });

  it('no pinta un 429 como credenciales inválidas', () => {
    const headers = new HttpHeaders({ 'Retry-After': '12' });
    const limitado = error(429, problema('demasiadas-solicitudes'), headers);
    expect(segundosDeReintento(limitado)).toBe(12);
    expect(mensajeDeProblema(limitado)).toBe(TEXTOS.auth.errores['demasiadas-solicitudes']);
    expect(mensajeDeProblema(limitado)).not.toBe(TEXTOS.auth.errores['credenciales-invalidas']);
  });

  it('usa el detalle del bloqueo y el catálogo para el resto de types', () => {
    expect(
      mensajeDeProblema(
        error(403, problema('cuenta-bloqueada', { detail: 'Inténtalo en 14 minutos.' })),
      ),
    ).toBe('Inténtalo en 14 minutos.');
    expect(mensajeDeProblema(error(401, problema('credenciales-invalidas')))).toBe(
      TEXTOS.auth.errores['credenciales-invalidas'],
    );
    expect(mensajeDeProblema(error(500))).toBe(TEXTOS.auth.errores.inesperado);
  });

  it('deja el HttpErrorResponse intacto para P3 y P8', () => {
    const original = error(401, problema('no-autenticado'));
    expect(original).toBeInstanceOf(HttpErrorResponse);
    expect(original.status).toBe(401);
    expect(mensajeDeProblema(original)).toBe(TEXTOS.auth.errores['no-autenticado']);
  });
});
