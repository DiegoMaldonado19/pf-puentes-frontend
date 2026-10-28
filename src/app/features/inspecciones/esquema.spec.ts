import { EsquemaFormulario } from '../formulario/modelos';
import {
  erroresParaMotor,
  esquemaSoloPermanentes,
  extraerPermanentes,
  fusionarProfundo,
  podarVacios,
  referenciasDeElemento,
} from './esquema';

const ESQUEMA: EsquemaFormulario = {
  title: 'SIECA V1.0.0',
  type: 'object',
  required: ['datos_generales'],
  properties: {
    datos_generales: {
      type: 'object',
      properties: {
        longitud_total: { type: 'number', 'x-permanente': true },
        observaciones: { type: 'string' },
      },
    },
    tramos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          numero_tramo: { type: 'number', 'x-permanente': true },
          grietas: { type: 'number', 'x-dano': true, 'x-elemento-ref': 'tramo.grietas' },
        },
      },
    },
    subestructura: {
      type: 'object',
      properties: {
        estribo_entrada: {
          type: 'number',
          'x-dano': true,
          'x-grupo': 'estribos',
          'x-elemento-ref': 'subestructura.estribo',
        },
      },
    },
  },
};

describe('esquemaSoloPermanentes', () => {
  it('conserva únicamente los campos x-permanente y descarta secciones de solo daño', () => {
    const filtrado = esquemaSoloPermanentes(ESQUEMA);
    expect(Object.keys(filtrado.properties)).toEqual(['datos_generales', 'tramos']);
    expect(Object.keys(filtrado.properties['datos_generales'].properties!)).toEqual([
      'longitud_total',
    ]);
    expect(Object.keys(filtrado.properties['tramos'].items!.properties!)).toEqual(['numero_tramo']);
  });

  it('no exige campos obligatorios al confirmar permanentes', () => {
    expect(esquemaSoloPermanentes(ESQUEMA).required).toEqual([]);
  });

  it('no muta el esquema original', () => {
    esquemaSoloPermanentes(ESQUEMA);
    expect(Object.keys(ESQUEMA.properties['datos_generales'].properties!)).toHaveLength(2);
  });
});

describe('extraerPermanentes', () => {
  it('nunca incluye un campo de daño aunque venga en los datos (RN-INS-10)', () => {
    const datos = {
      datos_generales: { longitud_total: 42, observaciones: 'x' },
      tramos: [{ numero_tramo: 1, grietas: 3 }],
      subestructura: { estribo_entrada: 4 },
    };
    expect(extraerPermanentes(datos, ESQUEMA)).toEqual({
      datos_generales: { longitud_total: 42 },
      tramos: [{ numero_tramo: 1 }],
    });
  });

  it('devuelve un objeto vacío si no hay permanentes', () => {
    expect(extraerPermanentes({ subestructura: { estribo_entrada: 0 } }, ESQUEMA)).toEqual({});
  });
});

describe('podarVacios', () => {
  it('quita null, undefined y cadenas en blanco, pero conserva 0 y false', () => {
    expect(
      podarVacios({
        a: { b: null, c: 0, d: '  ', e: false, f: 'ok' },
        vacio: { solo: null },
        tramos: [{ numero_tramo: 1, nota: null }],
      }),
    ).toEqual({ a: { c: 0, e: false, f: 'ok' }, tramos: [{ numero_tramo: 1 }] });
  });

  it('devuelve un objeto (nunca un arreglo) cuando todo está vacío', () => {
    expect(podarVacios({ a: null })).toEqual({});
  });
});

describe('referenciasDeElemento', () => {
  it('reúne las x-elemento-ref únicas y ordenadas, también dentro de arreglos', () => {
    expect(referenciasDeElemento(ESQUEMA)).toEqual(['subestructura.estribo', 'tramo.grietas']);
  });
});

describe('erroresParaMotor', () => {
  it('convierte camelCase del backend a las rutas snake_case del motor', () => {
    expect(
      erroresParaMotor([
        { campo: 'fechaInspeccion', mensaje: 'No puede ser futura.' },
        { campo: 'subestructura.estribo_entrada', mensaje: 'Fuera de rango.' },
        { campo: 'subestructura.estribo_entrada', mensaje: 'Obligatorio.' },
      ]),
    ).toEqual({
      fecha_inspeccion: 'No puede ser futura.',
      'subestructura.estribo_entrada': 'Fuera de rango. Obligatorio.',
    });
  });
});

describe('fusionarProfundo', () => {
  it('mezcla objetos anidados, deja mandar a `sobre` y reemplaza arreglos completos', () => {
    expect(
      fusionarProfundo({ a: { x: 1, y: 2 }, t: [1, 2] }, { a: { y: 9 }, t: [3], nuevo: true }),
    ).toEqual({ a: { x: 1, y: 9 }, t: [3], nuevo: true });
  });
});
