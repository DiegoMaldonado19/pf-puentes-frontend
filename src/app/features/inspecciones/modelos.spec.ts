import { esEditable, estadoDePuente, InspeccionDTO, publicaAlEnviar } from './modelos';

const BASE: InspeccionDTO = {
  id: 'i1',
  puente: { id: 'p1', codigo: 'GT-1', nombre: 'Las Rosas' },
  formulario: { id: 'f1', codigo: 'V1.0.0' },
  estado: 'BORRADOR',
  version: 3,
  fecha_inspeccion: '2026-10-27',
  autor_id: 'autor',
  creado_en: '2026-10-27T12:00:00Z',
  gps_disponible: true,
  superada: false,
};

describe('esEditable', () => {
  it('es editable solo si es BORRADOR y el usuario es el autor', () => {
    expect(esEditable(BASE, 'autor')).toBe(true);
  });

  it('un catedrático que ve el borrador de su estudiante no lo edita', () => {
    expect(esEditable(BASE, 'catedratico')).toBe(false);
  });

  it('sin sesión nunca es editable', () => {
    expect(esEditable(BASE, null)).toBe(false);
  });

  it.each(['ENVIADA', 'EN_REVISION', 'CAMBIOS_SOLICITADOS', 'PUBLICADA', 'RECHAZADA'] as const)(
    'el autor tampoco edita en %s',
    (estado) => {
      expect(esEditable({ ...BASE, estado }, 'autor')).toBe(false);
    },
  );
});

describe('publicaAlEnviar', () => {
  it('solo catedrático y profesional publican en el mismo acto (RN-REV-01/02)', () => {
    expect(publicaAlEnviar('CATEDRATICO')).toBe(true);
    expect(publicaAlEnviar('PROFESIONAL_EXTERNO')).toBe(true);
    expect(publicaAlEnviar('ESTUDIANTE')).toBe(false);
    expect(publicaAlEnviar('ADMINISTRADOR')).toBe(false);
    expect(publicaAlEnviar(null)).toBe(false);
  });
});

describe('estadoDePuente', () => {
  it('el estado confirmado manda sobre el calculado', () => {
    expect(
      estadoDePuente({ ...BASE, estado_calculado: 'BUENO', estado_confirmado: 'REGULAR' }),
    ).toBe('REGULAR');
    expect(estadoDePuente({ ...BASE, estado_calculado: 'BUENO' })).toBe('BUENO');
    expect(estadoDePuente(BASE)).toBeNull();
  });
});
