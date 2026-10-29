import 'fake-indexeddb/auto';
import { v7 } from 'uuid';
import { TEXTOS } from '../shared/textos';
import { BaseLocal } from './base-local';
import { PersistenciaOffline } from './persistencia';

describe('descarte explícito de una copia local', () => {
  let db: BaseLocal, local: PersistenciaOffline;
  const propietario = v7(),
    ajeno = v7();

  beforeEach(async () => {
    db = new BaseLocal(`descarte-${v7()}`);
    local = new PersistenciaOffline(db);
    await db.acceso_local.put({ id: 'ultima', propietario_id: propietario, revocados: [] });
  });
  afterEach(async () => {
    await db.delete();
  });

  async function preparar() {
    const i = await local.crear(propietario, v7(), v7(), { dato: 'sin subir' });
    await local.foto(propietario, i.id, {
      archivo: new Blob(['foto'], { type: 'image/webp' }),
      miniatura: new Blob(['mini'], { type: 'image/webp' }),
      latitud: null,
      longitud: null,
      capturada_en: new Date().toISOString(),
    });
    await local.documento(propietario, i.id, new Blob(['%PDF'], { type: 'application/pdf' }));
    await local.enviar(propietario, i.id);
    return local.inspeccion(propietario, i.id);
  }
  async function estado() {
    return Promise.all([
      db.inspecciones.toArray(),
      db.fotos.toArray(),
      db.documentos.toArray(),
      db.cola_sync.toArray(),
      db.acceso_local.toArray(),
      db.bloqueos.toArray(),
    ]);
  }

  it('elimina captura, archivos y toda su cola sin tocar otras capturas ni referencias', async () => {
    const i = await preparar();
    const hermana = await local.crear(propietario, i.puente_id, i.formulario_version_id);
    await local.crear(ajeno, i.puente_id, i.formulario_version_id);
    await local.guardarReferencias(
      propietario,
      [
        {
          id: i.puente_id,
          propietario_id: propietario,
          modelo_version: 1,
          preparada_en: i.creada_en,
          datos: {},
        },
      ],
      [
        {
          id: i.formulario_version_id,
          propietario_id: propietario,
          modelo_version: 1,
          preparada_en: i.creada_en,
          datos: {},
        },
      ],
    );
    const anteriores = await local.operaciones(propietario, hermana.id);
    await local.descartar(propietario, i.id, i.version_local);
    expect(await db.inspecciones.get(i.id)).toBeUndefined();
    expect(await db.inspecciones.count()).toBe(2);
    expect(await db.fotos.count()).toBe(0);
    expect(await db.documentos.count()).toBe(0);
    expect(await local.operaciones(propietario, i.id)).toEqual([]);
    expect(await local.operaciones(propietario, hermana.id)).toEqual(anteriores);
    expect(await db.puentes.count()).toBe(1);
    expect(await db.esquemas_formulario.count()).toBe(1);
    expect((await db.acceso_local.get('ultima'))?.propietario_id).toBe(propietario);
  });

  it('también permite liberar una copia confirmada por decisión explícita', async () => {
    const i = await preparar();
    await db.cola_sync.toCollection().modify({ estado: 'confirmada' });
    await db.inspecciones.update(i.id, { estado_remoto: { estado: 'ENVIADA' } });
    await local.descartar(propietario, i.id, i.version_local);
    expect(await db.inspecciones.count()).toBe(0);
    expect(await db.cola_sync.count()).toBe(0);
  });

  it.each([
    'ajena',
    'revocada',
    'sin_habilitacion',
    'version',
    'lease',
    'en_proceso',
    'dependencia',
  ] as const)('conserva todo ante %s', async (caso) => {
    const i = await preparar();
    let actor = propietario,
      version = i.version_local;
    if (caso === 'ajena') {
      actor = ajeno;
      await db.acceso_local.update('ultima', { propietario_id: ajeno });
    }
    if (caso === 'revocada') await db.acceso_local.update('ultima', { revocados: [propietario] });
    if (caso === 'sin_habilitacion') await db.acceso_local.clear();
    if (caso === 'version') version--;
    if (caso === 'lease')
      await db.bloqueos.put({
        propietario_id: propietario,
        token: v7(),
        vence_en: Date.now() + 60000,
      });
    if (caso === 'en_proceso')
      await db.cola_sync.update((await local.operaciones(propietario, i.id))[0].id, {
        estado: 'en_proceso',
      });
    if (caso === 'dependencia') {
      const hermana = await local.crear(propietario, v7(), v7());
      await db.cola_sync.update((await local.operaciones(propietario, hermana.id))[0].id, {
        dependencias: [(await local.operaciones(propietario, i.id))[0].id],
      });
    }
    const antes = await estado();
    await expect(local.descartar(actor, i.id, version)).rejects.toThrow();
    expect(await estado()).toEqual(antes);
  });

  it('revierte también los blobs y operaciones borrados si falla al eliminar la inspección', async () => {
    const i = await preparar();
    const antes = await estado();
    const fallar = () => {
      throw new Error('fallo de escritura');
    };
    db.inspecciones.hook('deleting', fallar);
    try {
      await expect(local.descartar(propietario, i.id, i.version_local)).rejects.toThrow(
        'fallo de escritura',
      );
      expect(await estado()).toEqual(antes);
    } finally {
      db.inspecciones.hook('deleting').unsubscribe(fallar);
    }
  });

  it('no descarta una intención de envío encolada después de abrir la confirmación', async () => {
    const i = await local.crear(propietario, v7(), v7());
    const esperadas = (await local.operaciones(propietario, i.id)).map((o) => o.id);
    await local.enviar(propietario, i.id);
    const antes = await estado();
    await expect(
      local.descartar(propietario, i.id, i.version_local, () => true, esperadas),
    ).rejects.toThrow(TEXTOS.offline.descarteVersion);
    expect(await estado()).toEqual(antes);
  });

  it('revierte el descarte si la identidad se invalida durante la transacción', async () => {
    const i = await preparar();
    const antes = await estado();
    let vigente = true;
    const invalidar = () => {
      vigente = false;
    };
    db.inspecciones.hook('deleting', invalidar);
    try {
      await expect(
        local.descartar(propietario, i.id, i.version_local, () => vigente),
      ).rejects.toThrow(TEXTOS.offline.descarteSinAcceso);
      expect(await estado()).toEqual(antes);
    } finally {
      db.inspecciones.hook('deleting').unsubscribe(invalidar);
    }
  });
});
