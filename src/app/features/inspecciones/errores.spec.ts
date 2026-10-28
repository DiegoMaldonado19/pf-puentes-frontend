import { HttpErrorResponse } from '@angular/common/http';
import { TEXTOS } from '../../shared/textos';
import { exigeRecarga, mensajeInspeccion, tipoDeError } from './errores';

function problema(
  status: number,
  tipo?: string,
  detail = 'detalle del servidor',
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: tipo
      ? { type: `https://sgp.cunoc.usac.edu.gt/errores/${tipo}`, status, detail }
      : { status, detail },
  });
}

const t = TEXTOS.inspecciones.errores;

describe('mensajeInspeccion', () => {
  it('compara el tipo por su sufijo kebab y usa el texto propio, no el detail crudo', () => {
    const error = problema(422, 'inspeccion-no-publicable', 'Stack trace interno');
    expect(tipoDeError(error)).toBe('inspeccion-no-publicable');
    expect(mensajeInspeccion(error)).toBe(t.tipos['inspeccion-no-publicable']);
  });

  it('un 404 es siempre genérico: no revela que el borrador ajeno existe (RN-INS-05)', () => {
    expect(mensajeInspeccion(problema(404, 'inspeccion-no-encontrada'))).toBe(t.noEncontrada);
    expect(mensajeInspeccion(problema(404))).toBe(t.noEncontrada);
  });

  it('distingue sin conexión, tamaño excesivo y fallos del servidor', () => {
    expect(mensajeInspeccion(new HttpErrorResponse({ status: 0 }))).toBe(t.sinConexion);
    expect(mensajeInspeccion(problema(413))).toBe(t.demasiadoGrande);
    expect(mensajeInspeccion(problema(500, undefined, 'NullPointerException'))).toBe(t.inesperado);
  });

  it('el 403 de rol y el de publicación directa dicen cosas distintas', () => {
    expect(mensajeInspeccion(problema(403))).toBe(t.sinPermiso);
    expect(mensajeInspeccion(problema(403, 'publicacion-directa-no-permitida'))).toBe(
      t.tipos['publicacion-directa-no-permitida'],
    );
  });

  it('un tipo desconocido cae al detail del servidor, y un error no HTTP a lo inesperado', () => {
    expect(mensajeInspeccion(problema(409, 'tipo-nuevo', 'Mensaje en español'))).toBe(
      'Mensaje en español',
    );
    expect(mensajeInspeccion(new Error('x'))).toBe(t.inesperado);
  });
});

describe('exigeRecarga', () => {
  it('pide recargar cuando la inspección dejó de ser editable o cambió de estado', () => {
    expect(exigeRecarga(problema(409, 'inspeccion-no-editable'))).toBe(true);
    expect(exigeRecarga(problema(409, 'transicion-invalida'))).toBe(true);
    expect(exigeRecarga(problema(409, 'version-desactualizada'))).toBe(false);
    expect(exigeRecarga(problema(422, 'datos-invalidos'))).toBe(false);
  });
});
