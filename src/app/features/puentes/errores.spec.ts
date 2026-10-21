import { HttpErrorResponse } from '@angular/common/http';
import { TEXTOS } from '../../shared/textos';
import { PROBLEMA_DUPLICADO } from './datos-prueba';
import { mensajeDeError, puentesCercanos } from './errores';

const t = TEXTOS.puentes.errores;
const error = (status: number, cuerpo: unknown = null) =>
  new HttpErrorResponse({ status, error: cuerpo });

describe('errores del módulo de puentes', () => {
  it.each([
    [0, t.sinConexion],
    [401, t.sinSesion],
    [403, t.sinPermiso],
    [404, t.noEncontrado],
    [500, t.inesperado],
  ])('traduce el %s a un mensaje en español', (status, mensaje) => {
    expect(mensajeDeError(error(status, { detail: 'detalle interno' }))).toBe(mensaje);
  });

  it('muestra el detalle de negocio del Problem Details y los errores de campo', () => {
    const mensaje = mensajeDeError(
      error(400, {
        detail: 'Datos inválidos.',
        errores: [{ campo: 'latitud', mensaje: 'está fuera de Guatemala' }],
      }),
    );
    expect(mensaje).toBe('Datos inválidos. latitud: está fuera de Guatemala');
    expect(
      mensajeDeError(error(422, { detail: 'El municipio no pertenece al departamento.' })),
    ).toBe('El municipio no pertenece al departamento.');
    expect(mensajeDeError(new Error('x'))).toBe(t.inesperado);
  });

  it('solo reconoce como duplicado el 409 posible-duplicado con su lista', () => {
    expect(puentesCercanos(error(409, PROBLEMA_DUPLICADO))).toEqual(PROBLEMA_DUPLICADO.cercanos);
    expect(
      puentesCercanos(error(409, { ...PROBLEMA_DUPLICADO, type: '/errores/puente-dado-de-baja' })),
    ).toBeNull();
    expect(puentesCercanos(error(422, PROBLEMA_DUPLICADO))).toBeNull();
    expect(puentesCercanos(error(409, 'texto'))).toBeNull();
  });
});
