import 'fake-indexeddb/auto';
import { v7 } from 'uuid';
import { BaseLocal } from './base-local';
import { PersistenciaOffline } from './persistencia';
import { MotorSync } from './motor-sync';

describe('correcciones locales transaccionales', () => {
  let db: BaseLocal, local: PersistenciaOffline;
  const propietario = v7();
  beforeEach(() => {
    db = new BaseLocal(`correcciones-${v7()}`);
    local = new PersistenciaOffline(db);
  });
  afterEach(async () => {
    await db.delete();
  });

  it('rechaza la versión obsoleta sin perder datos ni añadir operaciones', async () => {
    const i = await local.crear(propietario, v7(), v7());
    await local.editar(propietario, i.id, { primera: true }, i.version_local);
    await expect(
      local.editar(propietario, i.id, { segunda: true }, i.version_local),
    ).rejects.toThrow('Otra pestaña');
    expect((await local.inspeccion(propietario, i.id)).respuestas).toEqual({ primera: true });
    expect(await db.cola_sync.count()).toBe(2);
  });

  it('retira rechazo, deshace solo envío no confirmado y reconstruye dependencias', async () => {
    const i = await local.crear(propietario, v7(), v7());
    const pdf = await local.documento(
      propietario,
      i.id,
      new Blob(['pdf'], { type: 'application/pdf' }),
    );
    await local.enviar(propietario, i.id);
    const [datos, archivo, envio] = await local.operaciones(propietario, i.id);
    await db.cola_sync.update(datos.id, { estado: 'confirmada' });
    await db.cola_sync.update(archivo.id, { estado: 'requiere_intervencion' });
    const actual = await local.inspeccion(propietario, i.id);
    await local.editar(propietario, i.id, { corregida: true }, actual.version_local);
    const dependiente = (await local.operaciones(propietario, i.id)).at(-1)!;
    await local.retirarArchivo(propietario, i.id, pdf.id);
    expect(await db.documentos.get(pdf.id)).toBeUndefined();
    expect(await db.cola_sync.get(envio.id)).toBeUndefined();
    expect(await db.cola_sync.get(datos.id)).toMatchObject({ estado: 'confirmada' });
    expect(await db.cola_sync.get(dependiente.id)).toMatchObject({ dependencias: [datos.id] });
    const reemplazo = await local.documento(
      propietario,
      i.id,
      new Blob(['nuevo'], { type: 'application/pdf' }),
    );
    const nueva = (await local.operaciones(propietario, i.id)).find(
      (o) => o.entidad_id === reemplazo.id,
    )!;
    expect(nueva.clave).not.toBe(archivo.clave);
  });

  it('no borra archivo confirmado', async () => {
    const i = await local.crear(propietario, v7(), v7());
    const pdf = await local.documento(
      propietario,
      i.id,
      new Blob(['pdf'], { type: 'application/pdf' }),
    );
    const op = (await local.operaciones(propietario, i.id))[1];
    await db.cola_sync.update(op.id, { estado: 'requiere_intervencion' });
    await db.documentos.update(pdf.id, { confirmado: true });
    await expect(local.retirarArchivo(propietario, i.id, pdf.id)).rejects.toThrow();
    expect(await db.documentos.count()).toBe(1);
    expect(await db.cola_sync.count()).toBe(2);
  });

  it('revierte archivo, cola e inspección juntos si falla retirar', async () => {
    const i = await local.crear(propietario, v7(), v7());
    const pdf = await local.documento(
      propietario,
      i.id,
      new Blob(['pdf'], { type: 'application/pdf' }),
    );
    const op = (await local.operaciones(propietario, i.id))[1];
    await db.cola_sync.update(op.id, { estado: 'requiere_intervencion' });
    await local.enviar(propietario, i.id);
    const anteriores = await local.operaciones(propietario, i.id);
    const inspeccion = await local.inspeccion(propietario, i.id);
    const archivoAnterior = await db.documentos.get(pdf.id);
    const fallar = () => {
      throw new Error('Sin cuota');
    };
    db.inspecciones.hook('updating', fallar);
    try {
      await expect(local.retirarArchivo(propietario, i.id, pdf.id)).rejects.toThrow('Sin cuota');
      expect(await local.operaciones(propietario, i.id)).toEqual(anteriores);
      expect(await db.documentos.get(pdf.id)).toEqual(archivoAnterior);
      expect(await local.inspeccion(propietario, i.id)).toEqual(inspeccion);
    } finally {
      db.inspecciones.hook('updating').unsubscribe(fallar);
    }
  });

  it('recupera sesión fría solo con trabajo y reintenta renovación transitoria sin pausa', async () => {
    let remoto: string | null = null;
    const preparar = vi.fn(async () => {
      remoto = propietario;
      return true;
    });
    const ejecutar = vi.fn(async (o: import('./modelos').Operacion) => ({
      tipo: 'ack' as const,
      propietario_id: propietario,
      operacion_id: o.id,
      version_local: o.version_local,
      resultado: {},
    }));
    const motor = new MotorSync(
      db,
      {
        propietarioActual: () => remoto,
        recuperarPropietario: async () => propietario,
        preparar,
      },
      { ejecutar },
      () => Date.now(),
      () => true,
    );
    await motor.drenar();
    expect(preparar).not.toHaveBeenCalled();
    await local.crear(propietario, v7(), v7());
    preparar.mockRejectedValueOnce(new Error('502'));
    await motor.drenar();
    expect(motor.pausa()).toBeNull();
    expect(ejecutar).not.toHaveBeenCalled();
    await motor.drenar();
    expect(ejecutar).toHaveBeenCalledOnce();
    expect((await local.operaciones(propietario))[0].estado).toBe('confirmada');
  });
});
