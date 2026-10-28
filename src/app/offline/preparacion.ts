import { v7 } from 'uuid';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import {
  Json,
  LecturaReferencia,
  PreparacionCompleta,
  ReferenciaLocal,
  ReferenciaOffline,
  SesionOffline,
} from './modelos';
import { PersistenciaOffline } from './persistencia';
import { PuertoReferenciaP3 } from './referencia-p3';

export interface PuertoPublicacion {
  /** Última publicación P5 de este puente; null es una ausencia válida. */
  consultar(propietario_id: string, puente_id: string): Promise<ReferenciaLocal | null>;
}
export interface PuertoEsquema {
  /** Esquema activo P4 con su id exacto, independiente del historial P5. */
  descargar(propietario_id: string): Promise<ReferenciaLocal | null>;
}
export interface ProveedoresPreparacion {
  referencia?: PuertoReferenciaP3;
  publicacion?: PuertoPublicacion;
  esquema?: PuertoEsquema;
}
export type ProveedorPreparacion = keyof ProveedoresPreparacion;
export type EstadoPreparacion =
  'pendiente' | 'descargando' | 'completo' | 'ausente' | 'sin_esquema' | 'fallo';
export interface ProgresoPreparacion {
  proveedor: ProveedorPreparacion;
  estado: EstadoPreparacion;
}
export interface ResultadoPreparacion {
  completa: boolean;
  proveedores: Record<ProveedorPreparacion, EstadoPreparacion>;
  error?: string;
}

function comprobarReferencia(registro: ReferenciaLocal, propietario_id: string): void {
  if (
    !registro.id.trim() ||
    registro.propietario_id !== propietario_id ||
    !Number.isInteger(registro.modelo_version) ||
    registro.modelo_version < 1
  ) {
    throw new Error('La referencia no tiene versión exacta o pertenece a otro propietario.');
  }
}

/** Sin proveedores por defecto: la integración productiva P4/P5 sigue pendiente. */
export class PreparacionLocal implements ReferenciaOffline {
  private readonly local: PersistenciaOffline;

  constructor(
    private readonly db: BaseLocal,
    private readonly acceso: AccesoLocal,
    private readonly sesion: SesionOffline,
    private readonly proveedores: ProveedoresPreparacion,
  ) {
    this.local = new PersistenciaOffline(db);
  }

  async preparar(
    propietario_id: string,
    progreso?: (estado: ProgresoPreparacion) => void,
  ): Promise<ResultadoPreparacion> {
    const resultado: ResultadoPreparacion = {
      completa: false,
      proveedores: { referencia: 'pendiente', publicacion: 'pendiente', esquema: 'pendiente' },
    };
    let invalidada = false;
    const liberar = this.sesion.alInvalidar?.(() => {
      invalidada = true;
    });
    const vigente = () => !invalidada && this.sesion.propietarioActual() === propietario_id;
    const comprobar = () => {
      if (!vigente()) throw new Error('La sesión cambió durante la preparación.');
    };
    const estado = (proveedor: ProveedorPreparacion, valor: EstadoPreparacion) => {
      resultado.proveedores[proveedor] = valor;
      progreso?.({ proveedor, estado: valor });
    };
    let actual: ProveedorPreparacion = 'referencia';
    try {
      comprobar();
      const descargar = async <T>(proveedor: ProveedorPreparacion, tarea: () => Promise<T>) => {
        actual = proveedor;
        estado(proveedor, 'descargando');
        const datos = structuredClone(await tarea());
        comprobar();
        return datos;
      };
      if (!this.proveedores.referencia) {
        estado('referencia', 'ausente');
        return resultado;
      }
      const referencia = await descargar('referencia', () =>
        this.proveedores.referencia!.descargar(propietario_id),
      );
      if (
        referencia.asignaciones.some(
          (a) =>
            a.estudiante_id !== propietario_id ||
            !referencia.puentes.some((p) => p.id === a.puente_id),
        )
      ) {
        throw new Error('La referencia asignada está incompleta o pertenece a otro propietario.');
      }
      estado('referencia', 'completo');
      if (!this.proveedores.publicacion) {
        estado('publicacion', 'ausente');
        return resultado;
      }
      const publicaciones = await descargar('publicacion', async () => {
        const registros: PreparacionCompleta['publicaciones'] = [];
        // Deduplicar la consulta por puente, nunca los contextos de asignación.
        for (const puente_id of new Set(referencia.puentes.map((p) => p.id))) {
          const publicacion = structuredClone(
            await this.proveedores.publicacion!.consultar(propietario_id, puente_id),
          );
          comprobar();
          if (publicacion !== null) comprobarReferencia(publicacion, propietario_id);
          registros.push({ puente_id, publicacion });
        }
        return registros;
      });
      estado('publicacion', 'completo');
      if (!this.proveedores.esquema) {
        estado('esquema', 'ausente');
        return resultado;
      }
      const esquema = await descargar('esquema', () =>
        this.proveedores.esquema!.descargar(propietario_id),
      );
      if (esquema === null) {
        estado('esquema', 'sin_esquema');
        return resultado;
      }
      comprobarReferencia(esquema, propietario_id);
      estado('esquema', 'completo');
      const preparada_en = new Date().toISOString();
      const snapshot: PreparacionCompleta = {
        id: v7(),
        propietario_id,
        modelo_version: 1,
        preparada_en,
        formulario_version_id: esquema.id,
        asignaciones: referencia.asignaciones,
        ...(referencia.inspeccionables ? { inspeccionables: referencia.inspeccionables } : {}),
        publicaciones,
        puentes: referencia.puentes.map((puente) => ({
          id: puente.id,
          propietario_id,
          modelo_version: 1,
          preparada_en,
          datos: puente as unknown as Json,
        })),
        esquemas_formulario: [esquema],
      };
      comprobar();
      resultado.completa = await this.acceso.habilitarPreparada(propietario_id, {
        tablas: [this.db.preparaciones, this.db.puentes, this.db.esquemas_formulario],
        vigente,
        publicar: async () => {
          // Comprobar dentro de la transacción para serializar preparaciones concurrentes.
          const historico = await this.db.esquemas_formulario.get([propietario_id, esquema.id]);
          if (
            historico &&
            (historico.modelo_version !== esquema.modelo_version ||
              JSON.stringify(historico.datos) !== JSON.stringify(esquema.datos))
          ) {
            throw new Error('La versión de esquema ya existe con otro contenido.');
          }
          await this.local.guardarReferencias(propietario_id, snapshot.puentes, [esquema]);
          await this.db.preparaciones.put(snapshot);
        },
      });
      if (!resultado.completa) resultado.error = 'No se pudo habilitar la preparación local.';
      return resultado;
    } catch (error) {
      if (resultado.proveedores[actual] === 'descargando') estado(actual, 'fallo');
      resultado.error = error instanceof Error ? error.message : 'Falló la preparación local.';
      return resultado;
    } finally {
      liberar?.();
    }
  }

  async consultar(propietario_id: string): Promise<LecturaReferencia> {
    const preparacion = await this.acceso.consultarPropias(propietario_id, () =>
      this.db.preparaciones.get(propietario_id),
    );
    return preparacion
      ? {
          preparacion,
          puentes: preparacion.puentes,
          esquemas_formulario: preparacion.esquemas_formulario,
        }
      : { puentes: [], esquemas_formulario: [] };
  }
}
