import { conMenciones, nombrarMenciones } from './modelos';

const ana = '019a0000-0000-7000-8000-000000000001';
const luis = '019a0000-0000-7000-8000-000000000002';

describe('menciones en el texto', () => {
  it('agrega un token @uuid por persona al final del texto', () => {
    expect(conMenciones('Revisar', [ana, luis])).toBe(`Revisar @${ana} @${luis}`);
    expect(conMenciones('Revisar')).toBe('Revisar');
  });

  it('muestra el nombre de las personas conocidas y nunca el id de las demás', () => {
    expect(
      nombrarMenciones(`Revisar @${ana} y @{${luis}}`, [{ id: ana, etiqueta: 'Ana Pérez' }]),
    ).toBe('Revisar @Ana Pérez y @usuario');
    expect(nombrarMenciones(`@{${ana}}`, [{ id: ana, etiqueta: 'Ana $& Pérez' }])).toBe(
      '@Ana $& Pérez',
    );
    expect(nombrarMenciones(`correo@${ana}`, [])).toBe(`correo@${ana}`);
  });
});
