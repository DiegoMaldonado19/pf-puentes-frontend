import { campoDeFormulario, ErrorDeCampo } from '../../core/errores/problema';
import { EsquemaFormulario, PropiedadEsquema } from '../formulario/modelos';

/**
 * P5 no declara las secciones SIECA: todo sale de los metadatos `x-*` del esquema que sirve P4.
 * Estas funciones son puras para poder probarlas sin el motor.
 */

type Objeto = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function filtrarPropiedad(propiedad: PropiedadEsquema): PropiedadEsquema | null {
  if (propiedad['x-permanente']) return propiedad;
  if (propiedad.properties) {
    const hijas = filtrarPropiedades(propiedad.properties);
    return Object.keys(hijas).length ? { ...propiedad, properties: hijas } : null;
  }
  if (propiedad.items?.properties) {
    const hijas = filtrarPropiedades(propiedad.items.properties);
    return Object.keys(hijas).length
      ? { ...propiedad, items: { ...propiedad.items, properties: hijas } }
      : null;
  }
  return null;
}

function filtrarPropiedades(
  propiedades: Record<string, PropiedadEsquema>,
): Record<string, PropiedadEsquema> {
  const resultado: Record<string, PropiedadEsquema> = {};
  for (const [clave, propiedad] of Object.entries(propiedades)) {
    const filtrada = filtrarPropiedad(propiedad);
    if (filtrada) resultado[clave] = filtrada;
  }
  return resultado;
}

/** Subesquema con solo los campos `x-permanente` (RN-INS-09); los daños nunca entran (RN-INS-10). */
export function esquemaSoloPermanentes(esquema: EsquemaFormulario): EsquemaFormulario {
  return { ...esquema, properties: filtrarPropiedades(esquema.properties), required: [] };
}

function extraer(valor: unknown, propiedad: PropiedadEsquema): unknown {
  if (valor === undefined || valor === null) return undefined;
  if (propiedad['x-permanente']) return valor;
  if (propiedad.properties && esObjeto(valor)) return extraerObjeto(valor, propiedad.properties);
  if (propiedad.items?.properties && Array.isArray(valor)) {
    const filas = valor
      .map((fila) =>
        esObjeto(fila) ? extraerObjeto(fila, propiedad.items!.properties!) : undefined,
      )
      .filter((fila) => fila !== undefined);
    return filas.length ? filas : undefined;
  }
  return undefined;
}

function extraerObjeto(
  datos: Objeto,
  propiedades: Record<string, PropiedadEsquema>,
): Objeto | undefined {
  const resultado: Objeto = {};
  for (const [clave, propiedad] of Object.entries(propiedades)) {
    const valor = extraer(datos[clave], propiedad);
    if (valor !== undefined) resultado[clave] = valor;
  }
  return Object.keys(resultado).length ? resultado : undefined;
}

/** Cuerpo de la confirmación: solo permanentes; el servidor responde 422 si llega un daño. */
export function extraerPermanentes(datos: Objeto, esquema: EsquemaFormulario): Objeto {
  return extraerObjeto(datos, esquema.properties) ?? {};
}

function podar(valor: unknown): unknown {
  if (valor === null || valor === undefined) return undefined;
  if (typeof valor === 'string') return valor.trim() === '' ? undefined : valor;
  if (Array.isArray(valor)) {
    const filas = valor.map(podar).filter((fila) => fila !== undefined);
    return filas.length ? filas : undefined;
  }
  if (esObjeto(valor)) {
    const resultado: Objeto = {};
    for (const [clave, hijo] of Object.entries(valor)) {
      const podado = podar(hijo);
      if (podado !== undefined) resultado[clave] = podado;
    }
    return Object.keys(resultado).length ? resultado : undefined;
  }
  return valor;
}

/**
 * El motor emite `null` en cada control vacío; un borrador parcial solo envía lo respondido.
 * El 0 y el `false` son respuestas válidas y se conservan.
 */
export function podarVacios(datos: Objeto): Objeto {
  const podado = podar(datos);
  return esObjeto(podado) ? podado : {};
}

/** Referencias de elemento (`x-elemento-ref`) a las que puede anclarse una foto (RN-ARC-01). */
export function referenciasDeElemento(esquema: EsquemaFormulario): string[] {
  const referencias = new Set<string>();
  const recorrer = (propiedades: Record<string, PropiedadEsquema>) => {
    for (const propiedad of Object.values(propiedades)) {
      const referencia = propiedad['x-elemento-ref'];
      if (referencia) referencias.add(referencia);
      if (propiedad.properties) recorrer(propiedad.properties);
      if (propiedad.items?.properties) recorrer(propiedad.items.properties);
    }
  };
  recorrer(esquema.properties);
  return [...referencias].sort((a, b) => a.localeCompare(b));
}

/** `errores[]` del 422 → mapa ruta→mensaje que lee el motor (`seccion.campo`, `tramos[0].campo`). */
export function erroresParaMotor(errores: readonly ErrorDeCampo[]): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const error of errores) {
    const ruta = campoDeFormulario(error.campo);
    mapa[ruta] = mapa[ruta] ? `${mapa[ruta]} ${error.mensaje}` : error.mensaje;
  }
  return mapa;
}

/** Mezcla profunda de objetos; `sobre` manda y los arreglos se reemplazan completos. */
export function fusionarProfundo(base: Objeto, sobre: Objeto): Objeto {
  const resultado: Objeto = { ...base };
  for (const [clave, valor] of Object.entries(sobre)) {
    const previo = resultado[clave];
    resultado[clave] =
      esObjeto(previo) && esObjeto(valor) ? fusionarProfundo(previo, valor) : valor;
  }
  return resultado;
}
