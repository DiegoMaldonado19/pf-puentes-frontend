import {
  CampoExtraDTO,
  EsquemaFormulario,
  PropiedadEsquema,
  TipoCampoExtra,
} from '../../formulario/modelos';

/** Tipos que ofrece el constructor, con su etiqueta en español. */
export const TIPOS_CAMPO: readonly { readonly valor: TipoCampoExtra; readonly etiqueta: string }[] =
  [
    { valor: 'texto', etiqueta: 'Texto corto' },
    { valor: 'texto_largo', etiqueta: 'Texto largo' },
    { valor: 'numero', etiqueta: 'Número decimal' },
    { valor: 'entero', etiqueta: 'Número entero' },
    { valor: 'si_no', etiqueta: 'Sí / no' },
    { valor: 'opcion', etiqueta: 'Opción (lista)' },
    { valor: 'fecha', etiqueta: 'Fecha' },
  ];

export const MAXIMO_CAMPOS_EXTRA = 40;

const CLAVE_VALIDA = /^[a-z][a-z0-9_]{2,40}$/;

/**
 * Sugiere la clave a partir del título: sin tildes, en minúsculas, con guion bajo y empezando por
 * letra. La clave final la valida el servidor; el usuario puede cambiarla.
 */
export function claveDesdeTitulo(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const conLetra = /^[a-z]/.test(base) ? base : `campo_${base}`;
  return conLetra.slice(0, 41).replace(/_+$/, '');
}

/** Igual que el servidor: la clave debe empezar por letra y tener entre 3 y 41 caracteres. */
export function claveEsValida(clave: string): boolean {
  return CLAVE_VALIDA.test(clave);
}

/** Lee los campos adicionales de una versión existente: son las propiedades con x-extra. */
export function extrasDesdeEsquema(esquema: EsquemaFormulario): CampoExtraDTO[] {
  const extras: CampoExtraDTO[] = [];
  for (const [seccion, nodo] of Object.entries(esquema.properties)) {
    const requeridos = new Set(nodo.required ?? []);
    for (const [clave, propiedad] of Object.entries(nodo.properties ?? {})) {
      if (propiedad['x-extra'] === true) {
        extras.push(extraDesdePropiedad(seccion, clave, propiedad, requeridos.has(clave)));
      }
    }
  }
  return extras;
}

/**
 * Vista previa: el esquema base con los campos adicionales. Replica la composición del servidor
 * solo para mostrarla; al guardar, el servidor compone y valida de nuevo.
 */
export function componerVistaPrevia(
  base: EsquemaFormulario,
  extras: readonly CampoExtraDTO[],
): EsquemaFormulario {
  const copia: EsquemaFormulario = structuredClone(base);
  for (const extra of extras) {
    const seccion = copia.properties[extra.seccion];
    if (!seccion?.properties) continue;
    seccion.properties[extra.clave] = definicion(extra, maximoOrden(seccion.properties) + 1);
    if (extra.obligatorio) {
      seccion.required = [...(seccion.required ?? []), extra.clave];
    }
  }
  return copia;
}

function extraDesdePropiedad(
  seccion: string,
  clave: string,
  propiedad: PropiedadEsquema,
  obligatorio: boolean,
): CampoExtraDTO {
  return {
    seccion,
    clave,
    titulo: propiedad.title ?? clave,
    tipo: tipoDesde(propiedad),
    obligatorio,
    opciones: propiedad.enum ?? null,
    minimo: propiedad.minimum ?? null,
    maximo: propiedad.maximum ?? null,
    unidad: propiedad['x-unidad'] ?? null,
    ayuda: propiedad.description ?? null,
  };
}

function tipoDesde(propiedad: PropiedadEsquema): TipoCampoExtra {
  if (propiedad.enum) return 'opcion';
  if (propiedad.type === 'boolean') return 'si_no';
  if (propiedad.type === 'integer') return 'entero';
  if (propiedad.type === 'number') return 'numero';
  if (propiedad.format === 'date') return 'fecha';
  if (propiedad['x-control'] === 'textarea') return 'texto_largo';
  return 'texto';
}

function definicion(extra: CampoExtraDTO, orden: number): PropiedadEsquema {
  const def: PropiedadEsquema = {
    type: 'string',
    title: extra.titulo.trim(),
    'x-extra': true,
    'x-orden': orden,
  };
  if (extra.ayuda?.trim()) def.description = extra.ayuda.trim();
  switch (extra.tipo) {
    case 'texto':
      def.maxLength = 500;
      break;
    case 'texto_largo':
      def.maxLength = 4000;
      def['x-control'] = 'textarea';
      break;
    case 'numero':
      def.type = 'number';
      break;
    case 'entero':
      def.type = 'integer';
      break;
    case 'si_no':
      def.type = 'boolean';
      break;
    case 'opcion':
      def.enum = (extra.opciones ?? []).map((opcion) => opcion.trim());
      break;
    case 'fecha':
      def.format = 'date';
      break;
  }
  if (extra.tipo === 'numero' || extra.tipo === 'entero') {
    if (extra.minimo != null) def.minimum = extra.minimo;
    if (extra.maximo != null) def.maximum = extra.maximo;
    if (extra.unidad?.trim()) def['x-unidad'] = extra.unidad.trim();
  }
  return def;
}

function maximoOrden(propiedades: Record<string, PropiedadEsquema>): number {
  return Object.values(propiedades).reduce((mayor, campo) => {
    const orden = campo['x-orden'];
    return typeof orden === 'number' && orden > mayor ? orden : mayor;
  }, 0);
}
