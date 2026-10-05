import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { v7 } from 'uuid';
import { ALMACENES_V1, BaseLocal } from './base-local';
import { PersistenciaOffline } from './persistencia';
import { BACKOFF, MotorSync } from './motor-sync';
import { TransporteSimulado } from './demo/transporte-simulado';
import { TransporteSync } from './modelos';
import { consultarAlmacenamiento } from './almacenamiento';

describe('base offline', () => {
  let db: BaseLocal, local: PersistenciaOffline, transporte: TransporteSimulado, motor: MotorSync;
  const propietario = v7(),
    otro = v7();
  let ahora = 1000;
  beforeEach(() => {
    db = new BaseLocal(`test-${v7()}`);
    local = new PersistenciaOffline(db);
    transporte = new TransporteSimulado();
    ahora = 1000;
    motor = new MotorSync(
      db,
      { propietarioActual: () => propietario, preparar: async () => true },
      transporte,
      () => ahora,
      () => true,
    );
  });
  afterEach(async () => {
    motor.detener();
    vi.useRealTimers();
    await db.delete();
  });
  const foto = () => ({
    archivo: new Blob(['foto'], { type: 'image/webp' }),
    miniatura: new Blob(['mini'], { type: 'image/webp' }),
    latitud: 14,
    longitud: -91,
    capturada_en: '2026-10-05T00:00:00Z',
  });
  it('conserva clave y backoff tras recarga y detiene el quinto fallo', async () => {
    const i = await local.crear(propietario, v7(), v7());
    const original = (await local.operaciones(propietario, i.id))[0];
    transporte.resultado = 'transitorio';
    for (let n = 1; n <= 5; n++) {
      await motor.drenar();
      const o = (await local.operaciones(propietario, i.id))[0];
      expect(o.intentos).toBe(n);
      expect(o.clave).toBe(original.clave);
      if (n < 5) {
        expect(o.proximo_intento).toBe(ahora + BACKOFF[n - 1]);
        ahora = o.proximo_intento;
      }
      db.close();
      await db.open();
    }
    await motor.drenar();
    expect(transporte.registro).toHaveLength(5);
    transporte.resultado = 'ack';
    await motor.reintentar(propietario, original.id);
    expect((await db.cola_sync.get(original.id))?.estado).toBe('confirmada');
    expect(transporte.registro.every((r) => r.clave === original.clave)).toBe(true);
  });
  it('ordena datos, archivos uno por uno y envío; bloqueo no detiene otra inspección', async () => {
    const i = await local.crear(propietario, v7(), v7());
    await local.foto(propietario, i.id, foto(), 'campo');
    await local.documento(propietario, i.id, new Blob(['pdf'], { type: 'application/pdf' }));
    await local.enviar(propietario, i.id);
    await motor.drenar();
    expect(transporte.registro.map((r) => r.tipo)).toEqual(['datos', 'foto', 'documento', 'envio']);
    const j = await local.crear(propietario, v7(), v7());
    await local.foto(propietario, j.id, foto(), 'campo');
    await local.enviar(propietario, j.id);
    const k = await local.crear(propietario, v7(), v7());
    const t: TransporteSync = {
      ejecutar: async (o, f, s) =>
        o.tipo === 'foto'
          ? { tipo: 'negocio', mensaje: 'archivo bloqueado' }
          : transporte.ejecutar(o, f, s),
    };
    const m = new MotorSync(
      db,
      { propietarioActual: () => propietario, preparar: async () => true },
      t,
      () => ahora,
      () => true,
    );
    await m.drenar();
    expect(
      (await local.operaciones(propietario, j.id)).find((o) => o.tipo === 'envio')?.estado,
    ).toBe('pendiente');
    expect((await local.operaciones(propietario, k.id))[0].estado).toBe('confirmada');
  });
  it('coordina motores y ACK antiguo conserva la edición nueva', async () => {
    const i = await local.crear(propietario, v7(), v7(), { valor: 1 });
    let aceptar!: () => void;
    let iniciada!: () => void;
    const inicio = new Promise<void>((r) => (iniciada = r));
    const t: TransporteSync = {
      ejecutar: async (o) => {
        iniciada();
        await new Promise<void>((r) => (aceptar = r));
        return {
          tipo: 'ack',
          propietario_id: propietario,
          operacion_id: o.id,
          version_local: o.version_local,
          resultado: null,
        };
      },
    };
    const m = new MotorSync(
      db,
      { propietarioActual: () => propietario, preparar: async () => true },
      t,
      () => ahora,
      () => true,
    );
    const tarea = m.drenar();
    await inicio;
    await motor.drenar();
    expect(transporte.registro).toHaveLength(0);
    await local.editar(propietario, i.id, { valor: 2 });
    // Retrasar la edición nueva para observar el ACK de la versión anterior.
    await db.cola_sync
      .where('propietario_id')
      .equals(propietario)
      .filter((o) => o.version_local === 2)
      .modify({ proximo_intento: 999999 });
    aceptar();
    await tarea;
    const actual = await local.inspeccion(propietario, i.id);
    expect(actual.respuestas).toEqual({ valor: 2 });
    expect(actual.version_confirmada).toBe(1);
    expect((await local.operaciones(propietario, i.id))[1].estado).toBe('pendiente');
  });
  it('recupera ejecución interrumpida por lease vencido', async () => {
    const i = await local.crear(propietario, v7(), v7());
    const o = (await local.operaciones(propietario, i.id))[0];
    await db.bloqueos.put({
      propietario_id: propietario,
      token: 'interrumpido',
      vence_en: ahora - 1,
    });
    await db.cola_sync.update(o.id, { estado: 'en_proceso', ejecucion: 'interrumpido' });
    await motor.drenar();
    expect((await db.cola_sync.get(o.id))?.estado).toBe('confirmada');
    expect(transporte.registro[0].clave).toBe(o.clave);
  });
  it('falla atómicamente si no puede encolar y valida límites y propietario', async () => {
    const i = await local.crear(propietario, v7(), v7());
    const fallar = () => {
      throw new DOMException('Cuota', 'QuotaExceededError');
    };
    db.cola_sync.hook('creating', fallar);
    await expect(local.foto(propietario, i.id, foto(), 'campo')).rejects.toThrow();
    expect(await db.fotos.count()).toBe(0);
    expect(await db.cola_sync.count()).toBe(1);
    db.cola_sync.hook('creating').unsubscribe(fallar);
    await expect(local.editar(otro, i.id, {})).rejects.toThrow();
    await expect(
      local.documento(propietario, i.id, new Blob(['x'], { type: 'text/plain' })),
    ).rejects.toThrow();
    for (let n = 0; n < 10; n++)
      await local.documento(propietario, i.id, new Blob(['x'], { type: 'application/pdf' }));
    await expect(
      local.documento(propietario, i.id, new Blob(['x'], { type: 'application/pdf' })),
    ).rejects.toThrow();
  });
  it('sin transporte no confirma; sesión inválida no consume fallos ni toca otro propietario', async () => {
    const i = await local.crear(propietario, v7(), v7());
    await local.crear(otro, v7(), v7());
    const sesion = { propietarioActual: () => propietario, preparar: async () => true };
    await new MotorSync(
      db,
      sesion,
      undefined,
      () => ahora,
      () => true,
    ).drenar();
    expect((await local.operaciones(propietario, i.id))[0].estado).toBe('pendiente');
    transporte.resultado = 'sesion';
    await motor.drenar();
    await motor.drenar();
    expect(transporte.registro).toHaveLength(1);
    expect((await local.operaciones(propietario, i.id))[0].intentos).toBe(0);
    expect((await local.operaciones(otro))[0].estado).toBe('pendiente');
  });
  it('rechaza ACK incompatible', async () => {
    const i = await local.crear(propietario, v7(), v7());
    const t: TransporteSync = {
      ejecutar: async (o) => ({
        tipo: 'ack',
        propietario_id: otro,
        operacion_id: o.id,
        version_local: o.version_local,
        resultado: null,
      }),
    };
    await new MotorSync(
      db,
      { propietarioActual: () => propietario, preparar: async () => true },
      t,
      () => ahora,
      () => true,
    ).drenar();
    expect((await local.operaciones(propietario, i.id))[0].estado).toBe('requiere_intervencion');
  });
  it('una edición posterior al envío conserva snapshots y no se limpia con su ACK', async () => {
    const i = await local.crear(propietario, v7(), v7(), { respuesta: 1 });
    await local.enviar(propietario, i.id);
    const envio = (await local.operaciones(propietario, i.id))[1];
    await local.editar(propietario, i.id, { respuesta: 2 });
    const nuevo = (await local.operaciones(propietario, i.id))[2];
    await db.cola_sync.update(nuevo.id, { proximo_intento: 999999 });
    await motor.drenar();
    expect(await db.cola_sync.get(envio.id)).toMatchObject({
      clave: envio.clave,
      payload: envio.payload,
      estado: 'confirmada',
    });
    expect(await local.inspeccion(propietario, i.id)).toMatchObject({
      respuestas: { respuesta: 2 },
      version_local: 2,
      version_confirmada: 1,
      estado_remoto: null,
      intencion_envio_en: null,
    });
    expect((await db.cola_sync.get(nuevo.id))?.estado).toBe('pendiente');
  });
  it('espera sin red sin consumir fallos; respeta 60 fotos y 20 MB por PDF', async () => {
    const i = await local.crear(propietario, v7(), v7());
    await new MotorSync(
      db,
      { propietarioActual: () => propietario, preparar: async () => true },
      transporte,
      () => ahora,
      () => false,
    ).drenar();
    expect(transporte.registro).toHaveLength(0);
    expect((await local.operaciones(propietario, i.id))[0].intentos).toBe(0);
    for (let n = 0; n < 60; n++) await local.foto(propietario, i.id, foto(), 'campo');
    await expect(local.foto(propietario, i.id, foto(), 'campo')).rejects.toThrow();
    await expect(
      local.documento(
        propietario,
        i.id,
        new Blob([new Uint8Array(20 * 1024 * 1024 + 1)], { type: 'application/pdf' }),
      ),
    ).rejects.toThrow();
    expect(await db.fotos.count()).toBe(60);
  });
  it('preserva referencia versionada y rechaza preparación de otro propietario', async () => {
    const r = {
      id: v7(),
      propietario_id: propietario,
      modelo_version: 1,
      datos: { version: 1 },
      preparada_en: '2026-10-05T00:00:00Z',
    };
    await local.guardarReferencias(propietario, [r], [r]);
    await local.guardarReferencias(propietario, [], [{ ...r, datos: { version: 2 } }]);
    expect((await db.esquemas_formulario.get([propietario, r.id]))?.datos).toEqual({ version: 1 });
    await expect(local.guardarReferencias(otro, [r], [])).rejects.toThrow();
  });
  it('migra v1 sin borrar borradores, metadatos ni cola (blobs en Playwright)', async () => {
    const nombre = `legacy-${v7()}`;
    const antigua = new Dexie(nombre);
    antigua.version(1).stores(ALMACENES_V1);
    const i = await local.crear(propietario, v7(), v7());
    const f = await local.foto(propietario, i.id, foto(), 'campo');
    await antigua.table('inspecciones').add(i);
    await antigua.table('fotos').add(f);
    await antigua.table('cola_sync').bulkAdd(await local.operaciones(propietario));
    antigua.close();
    const migrada = new BaseLocal(nombre);
    expect(await migrada.fotos.get(f.id)).toMatchObject({
      id: f.id,
      tamano: f.tamano,
      elemento_ref: f.elemento_ref,
      capturada_en: f.capturada_en,
    });
    expect(await migrada.cola_sync.count()).toBe(2);
    expect(await migrada.inspecciones.get(i.id)).toEqual(i);
    expect(migrada.verno).toBe(2);
    await migrada.delete();
  });
  it('informa denegación, ausencia y error de Storage API', async () => {
    const s = {
      persist: async () => false,
      estimate: async () => ({ usage: 10, quota: 100 }),
    } as StorageManager;
    expect((await consultarAlmacenamiento(true, s)).mensaje).toContain('denegada');
    expect((await consultarAlmacenamiento(true, {} as StorageManager)).mensaje).toContain(
      'no disponible',
    );
    expect(
      (
        await consultarAlmacenamiento(true, {
          persist: async () => {
            throw new Error();
          },
        } as unknown as StorageManager)
      ).mensaje,
    ).toContain('No se pudo');
  });
  it('coordina arranque, evento online y activación periódica', async () => {
    let conectado = false;
    const sesion = { propietarioActual: () => propietario, preparar: async () => true };
    const m = new MotorSync(
      db,
      sesion,
      transporte,
      () => ahora,
      () => conectado,
    );
    await local.crear(propietario, v7(), v7());
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      m.iniciar();
      await m.drenar();
      expect(transporte.registro).toHaveLength(0);
      conectado = true;
      window.dispatchEvent(new Event('online'));
      await m.drenar();
      expect(transporte.registro).toHaveLength(1);
      await local.crear(propietario, v7(), v7());
      vi.advanceTimersByTime(1000);
      await m.drenar();
      expect(transporte.registro).toHaveLength(2);
    } finally {
      m.detener();
      vi.useRealTimers();
    }
  });
  it('detener durante adquisición no inicia transporte; fallo de preparar sesión pausa', async () => {
    await local.crear(propietario, v7(), v7());
    const trabajo = motor.drenar();
    motor.detener();
    await trabajo;
    expect(transporte.registro).toHaveLength(0);
    const m = new MotorSync(
      db,
      {
        propietarioActual: () => propietario,
        preparar: async () => {
          throw new Error('renovación fallida');
        },
      },
      transporte,
      () => ahora,
      () => true,
    );
    await m.drenar();
    await m.drenar();
    expect(m.pausa()).toContain('sesión');
    expect((await local.operaciones(propietario))[0]).toMatchObject({
      estado: 'pendiente',
      intentos: 0,
      ultimo_intento: null,
    });
  });
});
