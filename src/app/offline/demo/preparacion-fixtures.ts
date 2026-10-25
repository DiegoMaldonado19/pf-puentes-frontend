import { BaseLocal } from '../base-local';
import { ProveedoresPreparacion } from '../preparacion';
import { FORMULARIO, PROPIETARIOS, PUENTE } from './fixtures';

/** Puertos de prueba: nunca importarlos desde rutas o proveedores productivos. */
export function proveedoresFicticios(db: BaseLocal): ProveedoresPreparacion {
  if (db.name !== 'puentes-offline-sesion-demo')
    throw new Error('Proveedores ficticios solo en el harness de sesión');
  const fecha = '2026-10-05T00:00:00Z';
  const comprobar = (propietario: string) => {
    if (!PROPIETARIOS.includes(propietario)) throw new Error('Propietario ajeno al harness');
  };
  return {
    referencia: {
      descargar: async (propietario_id) => {
        comprobar(propietario_id);
        return {
          asignaciones: ['curso-a', 'curso-b'].map((curso_id, indice) => ({
            id: `${propietario_id}-${indice}`,
            curso_id,
            inscripcion_id: `${curso_id}-inscripcion`,
            estudiante_id: propietario_id,
            puente_id: PUENTE,
            curso_nombre: curso_id,
            puente_codigo: 'DEMO',
            puente_nombre: 'Puente ficticio',
            creado_en: fecha,
          })),
          puentes: [
            {
              id: PUENTE,
              codigo: 'DEMO',
              nombre: 'Puente ficticio',
              ruta: 'RN1',
              departamento: { codigo: '01', nombre: 'Ficticio' },
              municipio: { codigo: '0101', nombre: 'Ficticio', departamento_codigo: '01' },
              latitud: 14.83,
              longitud: -91.52,
              utm: { zona: 15, hemisferio: 'N', este: 1, norte: 1 },
              anio_construccion: null,
              activo: true,
              motivo_baja: null,
              estado_actual: null,
              indice_condicion_actual: null,
              fecha_ultima_inspeccion: null,
              creado_en: fecha,
              actualizado_en: fecha,
            },
          ],
        };
      },
    },
    esquema: {
      descargar: async (propietario_id) => {
        comprobar(propietario_id);
        return {
          id: FORMULARIO,
          propietario_id,
          modelo_version: 1,
          preparada_en: fecha,
          datos: { fixture: true, version: 1 },
        };
      },
    },
    // No tener publicación previa no impide preparar un puente nuevo.
    publicacion: {
      consultar: async (propietario_id) => {
        comprobar(propietario_id);
        return null;
      },
    },
  };
}
