import { v7, validate } from 'uuid';
import { FotoCapturada } from '../shared/captura-foto/captura-foto';
import { TEXTOS } from '../shared/textos';
import { BaseLocal } from './base-local';
import { ArchivoLocal, InspeccionLocal, Json, Operacion, ReferenciaLocal } from './modelos';

export class PersistenciaOffline {
  constructor(readonly db: BaseLocal) {}
  async guardarReferencias(
    propietario_id: string,
    puentes: ReferenciaLocal[],
    esquemas: ReferenciaLocal[],
  ) {
    this.propietario(propietario_id);
    if ([...puentes, ...esquemas].some((r) => r.propietario_id !== propietario_id))
      throw new Error(TEXTOS.offline.noDisponible);
    await this.db.transaction('rw', this.db.puentes, this.db.esquemas_formulario, async () => {
      await this.db.puentes.bulkPut(structuredClone(puentes));
      // No borrar versiones anteriores: los borradores siguen ligados a su id exacto.
      for (const esquema of esquemas) {
        if (!(await this.db.esquemas_formulario.get([propietario_id, esquema.id])))
          await this.db.esquemas_formulario.add(structuredClone(esquema));
      }
    });
  }
  private propietario(id: string) {
    if (!validate(id)) throw new Error(TEXTOS.offline.propietarioInvalido);
  }
  async inspeccion(propietario_id: string, id: string) {
    this.propietario(propietario_id);
    const registro = await this.db.inspecciones.get(id);
    if (!registro || registro.propietario_id !== propietario_id)
      throw new Error(TEXTOS.offline.noDisponible);
    return registro;
  }
  private operacion(
    inspeccion: InspeccionLocal,
    tipo: Operacion['tipo'],
    entidad_id: string,
    payload: Json,
    dependencias: string[],
  ): Operacion {
    return {
      id: v7(),
      propietario_id: inspeccion.propietario_id,
      modelo_version: 1,
      inspeccion_id: inspeccion.id,
      entidad_id,
      tipo,
      version_local: inspeccion.version_local,
      payload,
      clave: v7(),
      dependencias,
      estado: 'pendiente',
      intentos: 0,
      proximo_intento: 0,
      ultimo_intento: null,
      error: null,
      ejecucion: null,
      resultado: null,
    };
  }
  async crear(
    propietario_id: string,
    puente_id: string,
    formulario_version_id: string,
    respuestas: Json = {},
    metadatos: Json = {},
  ) {
    this.propietario(propietario_id);
    const ahora = new Date().toISOString();
    const registro: InspeccionLocal = {
      id: v7(),
      propietario_id,
      modelo_version: 1,
      puente_id,
      formulario_version_id,
      respuestas: structuredClone(respuestas),
      metadatos: structuredClone(metadatos),
      version_local: 1,
      version_confirmada: 0,
      creada_en: ahora,
      modificada_en: ahora,
      intencion_envio_en: null,
      estado_remoto: null,
    };
    await this.db.transaction('rw', this.db.inspecciones, this.db.cola_sync, async () => {
      await this.db.inspecciones.add(registro);
      await this.db.cola_sync.add(
        this.operacion(registro, 'datos', registro.id, this.payload(registro), []),
      );
    });
    return registro;
  }
  private payload(i: InspeccionLocal): Json {
    return {
      respuestas: i.respuestas,
      formulario_version_id: i.formulario_version_id,
      puente_id: i.puente_id,
      metadatos: i.metadatos,
      creada_en: i.creada_en,
      modificada_en: i.modificada_en,
    };
  }
  async editar(propietario_id: string, id: string, respuestas: Json) {
    return this.db.transaction('rw', this.db.inspecciones, this.db.cola_sync, async () => {
      const i = await this.inspeccion(propietario_id, id);
      const anteriores = await this.operaciones(propietario_id, id);
      i.respuestas = structuredClone(respuestas);
      i.version_local++;
      i.intencion_envio_en = null;
      i.modificada_en = new Date().toISOString();
      await this.db.inspecciones.put(i);
      await this.db.cola_sync.add(
        this.operacion(
          i,
          'datos',
          id,
          this.payload(i),
          anteriores.map((o) => o.id),
        ),
      );
      return i;
    });
  }
  operaciones(propietario_id: string, inspeccion_id?: string) {
    this.propietario(propietario_id);
    return inspeccion_id
      ? this.db.cola_sync
          .where('[propietario_id+inspeccion_id]')
          .equals([propietario_id, inspeccion_id])
          .sortBy('id')
      : this.db.cola_sync.where('propietario_id').equals(propietario_id).sortBy('id');
  }
  async foto(
    propietario_id: string,
    inspeccion_id: string,
    foto: FotoCapturada,
    elemento_ref: string,
  ) {
    if (
      !elemento_ref.trim() ||
      !['image/webp', 'image/jpeg'].includes(foto.archivo.type) ||
      !['image/webp', 'image/jpeg'].includes(foto.miniatura.type)
    )
      throw new Error(TEXTOS.offline.fotoInvalida);
    return this.archivo(propietario_id, inspeccion_id, 'foto', { ...foto, elemento_ref });
  }
  async documento(propietario_id: string, inspeccion_id: string, archivo: Blob) {
    if (archivo.type !== 'application/pdf' || archivo.size > 20 * 1024 * 1024)
      throw new Error(TEXTOS.offline.pdfInvalido);
    return this.archivo(propietario_id, inspeccion_id, 'documento', {
      archivo,
      elemento_ref: null,
      latitud: null,
      longitud: null,
      capturada_en: new Date().toISOString(),
    });
  }
  private async archivo(
    propietario_id: string,
    inspeccion_id: string,
    tipo: 'foto' | 'documento',
    datos: Omit<
      ArchivoLocal,
      | 'id'
      | 'propietario_id'
      | 'modelo_version'
      | 'inspeccion_id'
      | 'mime'
      | 'tamano'
      | 'confirmado'
    >,
  ) {
    const tabla = tipo === 'foto' ? this.db.fotos : this.db.documentos;
    return this.db.transaction('rw', this.db.inspecciones, tabla, this.db.cola_sync, async () => {
      const i = await this.inspeccion(propietario_id, inspeccion_id);
      const anteriores = await this.operaciones(propietario_id, inspeccion_id);
      if (
        (await tabla
          .where('[propietario_id+inspeccion_id]')
          .equals([propietario_id, inspeccion_id])
          .count()) >= (tipo === 'foto' ? 60 : 10)
      )
        throw new Error(TEXTOS.offline.limiteArchivos);
      const registro: ArchivoLocal = {
        ...datos,
        id: v7(),
        propietario_id,
        inspeccion_id,
        modelo_version: 1,
        mime: datos.archivo.type,
        tamano: datos.archivo.size,
        confirmado: false,
      };
      i.version_local++;
      i.modificada_en = new Date().toISOString();
      i.intencion_envio_en = null;
      await this.db.inspecciones.put(i);
      await tabla.add(registro);
      await this.db.cola_sync.add(
        this.operacion(
          i,
          tipo,
          registro.id,
          { archivo_id: registro.id },
          anteriores.map((o) => o.id),
        ),
      );
      return registro;
    });
  }
  async enviar(propietario_id: string, id: string) {
    await this.db.transaction('rw', this.db.inspecciones, this.db.cola_sync, async () => {
      const i = await this.inspeccion(propietario_id, id);
      const anteriores = await this.operaciones(propietario_id, id);
      if (anteriores.some((o) => o.tipo === 'envio' && o.version_local === i.version_local)) return;
      i.intencion_envio_en = new Date().toISOString();
      await this.db.inspecciones.put(i);
      await this.db.cola_sync.add(
        this.operacion(
          i,
          'envio',
          id,
          { intencion_envio_en: i.intencion_envio_en },
          anteriores.map((o) => o.id),
        ),
      );
    });
  }
}
