import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import {
  ArchivoLocal,
  Bloqueo,
  HabilitacionLocal,
  InspeccionLocal,
  Operacion,
  PreparacionCompleta,
  ReferenciaLocal,
} from './modelos';

export const ALMACENES_V1 = {
  puentes: '[propietario_id+id], propietario_id',
  esquemas_formulario: '[propietario_id+id], propietario_id',
  inspecciones: 'id, propietario_id, [propietario_id+puente_id]',
  fotos: 'id, propietario_id, [propietario_id+inspeccion_id]',
  documentos: 'id, propietario_id, [propietario_id+inspeccion_id]',
  cola_sync:
    'id, propietario_id, [propietario_id+inspeccion_id], [propietario_id+estado+proximo_intento], *dependencias',
};
@Injectable({ providedIn: 'root', useFactory: () => new BaseLocal() })
export class BaseLocal extends Dexie {
  puentes!: Table<ReferenciaLocal, [string, string]>;
  esquemas_formulario!: Table<ReferenciaLocal, [string, string]>;
  inspecciones!: Table<InspeccionLocal, string>;
  fotos!: Table<ArchivoLocal, string>;
  documentos!: Table<ArchivoLocal, string>;
  cola_sync!: Table<Operacion, string>;
  bloqueos!: Table<Bloqueo, string>;
  acceso_local!: Table<HabilitacionLocal, string>;
  preparaciones!: Table<PreparacionCompleta, string>;
  constructor(nombre = 'puentes-offline') {
    if (typeof indexedDB !== 'undefined' && !Dexie.dependencies.indexedDB) {
      Dexie.dependencies.indexedDB = indexedDB;
    }
    if (typeof IDBKeyRange !== 'undefined' && !Dexie.dependencies.IDBKeyRange) {
      Dexie.dependencies.IDBKeyRange = IDBKeyRange;
    }
    super(nombre);
    this.version(1).stores(ALMACENES_V1);
    this.version(2).stores({ ...ALMACENES_V1, bloqueos: 'propietario_id' });
    this.version(3).stores({ acceso_local: 'id' });
    this.version(4).stores({ preparaciones: 'propietario_id' });
  }
}
