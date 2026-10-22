import { contrasenaValida, MENSAJE_POLITICA_CONTRASENA } from './politica-contrasena';

describe('política de contraseña', () => {
  it('acepta una contraseña que cumple la política', () => {
    expect(contrasenaValida('Puentes2026ok')).toBe(true);
  });

  it('rechaza menos de 10 caracteres, sin letra o sin dígito', () => {
    expect(contrasenaValida('Puentes1')).toBe(false);
    expect(contrasenaValida('puentespuentes')).toBe(false);
    expect(contrasenaValida('1234567890')).toBe(false);
  });

  it('rechaza más de 72 bytes UTF-8', () => {
    expect(contrasenaValida(`${'ñ'.repeat(36)}1`)).toBe(false);
    expect(contrasenaValida(`${'a'.repeat(71)}1`)).toBe(true);
  });

  it('conserva el mensaje que pinta el backend', () => {
    expect(MENSAJE_POLITICA_CONTRASENA).toBe(
      'No cumple la política: mínimo 10 caracteres, con al menos una letra y un dígito',
    );
  });
});
