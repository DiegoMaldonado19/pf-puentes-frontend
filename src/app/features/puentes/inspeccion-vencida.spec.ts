import { sinInspeccionDesde12Meses } from './inspeccion-vencida';

describe('sinInspeccionDesde12Meses', () => {
  const ahora = new Date(2026, 10, 11); // 11 de noviembre de 2026

  it('avisa cuando la última inspección tiene más de 12 meses', () => {
    expect(sinInspeccionDesde12Meses('2025-10-01', ahora)).toBe(true);
  });

  it('no avisa dentro de los 12 meses, ni en el mismo día del límite', () => {
    expect(sinInspeccionDesde12Meses('2025-11-12', ahora)).toBe(false);
    expect(sinInspeccionDesde12Meses('2025-11-11', ahora)).toBe(false);
    expect(sinInspeccionDesde12Meses('2026-10-15', ahora)).toBe(false);
  });

  it('sin fecha no hay banner: el puente nunca se ha inspeccionado', () => {
    expect(sinInspeccionDesde12Meses(null, ahora)).toBe(false);
    expect(sinInspeccionDesde12Meses(undefined, ahora)).toBe(false);
  });

  it('usa la fecha local y no desplaza el día por zona horaria', () => {
    // El límite es 11 de noviembre de 2025 a medianoche local: el 10 ya está fuera
    expect(sinInspeccionDesde12Meses('2025-11-10', ahora)).toBe(true);
  });
});
