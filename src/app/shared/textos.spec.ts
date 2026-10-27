import { TEXTOS } from './textos';

describe('Textos compartidos después de integrar cursos', () => {
  it('conserva los contratos de P1, P6 y estado del puente en la raíz', () => {
    expect(TEXTOS.cursos.misCursos).toBe('Mis cursos');
    expect(TEXTOS.estadoPuente.SIN_EVALUAR).toBe('Sin evaluar');
    expect(TEXTOS.offline.sesion).toBe('Sesión inválida');
    expect(TEXTOS.capturaFoto.boton).toBe('Tomar o elegir foto');
    expect(TEXTOS.cursos).not.toHaveProperty('offline');
    expect(TEXTOS.cursos).not.toHaveProperty('estadoPuente');
    expect(TEXTOS.cursos).not.toHaveProperty('capturaFoto');
  });
});
