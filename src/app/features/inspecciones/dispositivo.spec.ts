import { hoyGuatemala, idDispositivo, nuevaClave, nuevoId, recortarClave } from './dispositivo';

describe('identificadores', () => {
  it('genera UUID v7 (el backend responde 400 si es v4)', () => {
    expect(nuevoId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('las claves de idempotencia nunca pasan de 100 caracteres', () => {
    expect(nuevaClave().length).toBeLessThanOrEqual(100);
    expect(Array.from(recortarClave('á'.repeat(150)))).toHaveLength(100);
    expect(recortarClave('  clave  ')).toBe('clave');
  });

  it('el id de dispositivo es estable entre llamadas', () => {
    expect(idDispositivo()).toBe(idDispositivo());
    expect(idDispositivo().length).toBeGreaterThanOrEqual(1);
    expect(idDispositivo().length).toBeLessThanOrEqual(100);
  });
});

describe('hoyGuatemala', () => {
  it('usa el día de calendario de Guatemala (UTC-6), no el de UTC', () => {
    // 03:00 UTC del 28 es todavía el 27 a las 21:00 en Guatemala
    expect(hoyGuatemala(new Date('2026-10-28T03:00:00Z'))).toBe('2026-10-27');
    expect(hoyGuatemala(new Date('2026-10-28T07:00:00Z'))).toBe('2026-10-28');
  });
});
