import { CampoExtraDTO, EsquemaFormulario } from '../../formulario/modelos';
import {
  claveDesdeTitulo,
  claveEsValida,
  componerVistaPrevia,
  extrasDesdeEsquema,
  TIPOS_CAMPO,
} from './campos-extra';

const base: EsquemaFormulario = {
  title: 'SIECA',
  type: 'object',
  properties: {
    identificacion: {
      type: 'object',
      title: 'Identificación',
      properties: { codigo: { type: 'string', title: 'Código', 'x-orden': 1 } },
    },
    otros: {
      type: 'object',
      title: 'Otros',
      properties: { senales: { type: 'string', title: 'Señales', 'x-orden': 3 } },
    },
  },
};

function campo(partial: Partial<CampoExtraDTO>): CampoExtraDTO {
  return {
    seccion: 'otros',
    clave: 'campo_prueba',
    titulo: 'Campo de prueba',
    tipo: 'texto',
    obligatorio: false,
    opciones: null,
    minimo: null,
    maximo: null,
    unidad: null,
    ayuda: null,
    ...partial,
  };
}

describe('claveDesdeTitulo', () => {
  it('quita tildes, pasa a minúsculas y separa con guion bajo', () => {
    expect(claveDesdeTitulo('Estado del drenaje')).toBe('estado_del_drenaje');
    expect(claveDesdeTitulo('Ñandú de Cuchumatanes')).toBe('nandu_de_cuchumatanes');
  });

  it('antepone una letra cuando el título empieza por número y limpia los símbolos', () => {
    expect(claveDesdeTitulo('3 niveles')).toBe('campo_3_niveles');
    expect(claveDesdeTitulo('Caudal (m³/s)')).toBe('caudal_m_s');
  });

  it('nunca supera 41 caracteres ni termina en guion bajo', () => {
    const clave = claveDesdeTitulo('a'.repeat(60) + ' ');
    expect(clave.length).toBeLessThanOrEqual(41);
    expect(clave.endsWith('_')).toBe(false);
    expect(claveEsValida(clave)).toBe(true);
  });

  it('un título vacío produce una clave válida', () => {
    expect(claveEsValida(claveDesdeTitulo(''))).toBe(true);
  });
});

describe('claveEsValida', () => {
  it('sigue el patrón del servidor: letra inicial y de 3 a 41 caracteres', () => {
    expect(claveEsValida('abc')).toBe(true);
    expect(claveEsValida('ab')).toBe(false);
    expect(claveEsValida('Abc')).toBe(false);
    expect(claveEsValida('a'.repeat(42))).toBe(false);
    expect(claveEsValida('1abc')).toBe(false);
  });
});

describe('componerVistaPrevia', () => {
  it('añade el campo a su sección con x-extra y un orden posterior a los existentes', () => {
    const copia = componerVistaPrevia(base, [campo({ clave: 'estado_drenaje' })]);

    expect(copia.properties['otros'].properties?.['estado_drenaje']).toMatchObject({
      title: 'Campo de prueba',
      type: 'string',
      'x-extra': true,
      'x-orden': 4,
    });
  });

  it('marca como required los obligatorios y no toca la base original', () => {
    const copia = componerVistaPrevia(base, [campo({ clave: 'obligatorio_x', obligatorio: true })]);

    expect(copia.properties['otros'].required).toEqual(['obligatorio_x']);
    expect(base.properties['otros'].required).toBeUndefined();
  });

  it('traduce cada tipo al JSON Schema que valida el motor', () => {
    const copia = componerVistaPrevia(base, [
      campo({ clave: 'lista', tipo: 'opcion', opciones: [' Sí ', 'No'] }),
      campo({ clave: 'cifra', tipo: 'numero', minimo: 0, maximo: 10, unidad: 'm' }),
      campo({ clave: 'cuenta', tipo: 'entero' }),
      campo({ clave: 'bandera', tipo: 'si_no' }),
      campo({ clave: 'cuando', tipo: 'fecha' }),
      campo({ clave: 'nota', tipo: 'texto_largo' }),
    ]);
    const props = copia.properties['otros'].properties ?? {};

    expect(props['lista'].enum).toEqual(['Sí', 'No']);
    expect(props['cifra']).toMatchObject({
      type: 'number',
      minimum: 0,
      maximum: 10,
      'x-unidad': 'm',
    });
    expect(props['cuenta'].type).toBe('integer');
    expect(props['bandera'].type).toBe('boolean');
    expect(props['cuando']).toMatchObject({ type: 'string', format: 'date' });
    expect(props['nota']).toMatchObject({ 'x-control': 'textarea', maxLength: 4000 });
  });

  it('ofrece los siete tipos del constructor', () => {
    expect(TIPOS_CAMPO.map((tipo) => tipo.valor)).toEqual([
      'texto',
      'texto_largo',
      'numero',
      'entero',
      'si_no',
      'opcion',
      'fecha',
    ]);
  });
});

describe('extrasDesdeEsquema', () => {
  it('recupera los campos adicionales tal como se compusieron', () => {
    const extras = [
      campo({
        clave: 'estado_drenaje',
        tipo: 'opcion',
        opciones: ['Bueno', 'Malo'],
        obligatorio: true,
      }),
      campo({
        clave: 'altura_libre',
        titulo: 'Altura libre',
        tipo: 'numero',
        minimo: 1,
        maximo: 5,
        unidad: 'm',
      }),
    ];

    const recuperados = extrasDesdeEsquema(componerVistaPrevia(base, extras));

    expect(recuperados).toEqual([
      expect.objectContaining({
        seccion: 'otros',
        clave: 'estado_drenaje',
        tipo: 'opcion',
        opciones: ['Bueno', 'Malo'],
        obligatorio: true,
      }),
      expect.objectContaining({
        clave: 'altura_libre',
        tipo: 'numero',
        minimo: 1,
        maximo: 5,
        unidad: 'm',
      }),
    ]);
  });

  it('ignora las propiedades del base, que no tienen x-extra', () => {
    expect(extrasDesdeEsquema(base)).toEqual([]);
  });
});
