import 'fake-indexeddb/auto';
import { v7 } from 'uuid';
import { BaseLocal } from './base-local';
import { TransporteSimulado } from './demo/transporte-simulado';
import { MotorSync } from './motor-sync';
import { PersistenciaOffline } from './persistencia';

describe('regresiones de sincronización productiva', () => {
  const propietario = v7();
  let db: BaseLocal, local: PersistenciaOffline, motor: MotorSync, transporte: TransporteSimulado;
  let ahora: number;
  const preparar = vi.fn(async () => true);
  beforeEach(() => {
    db = new BaseLocal(`sync-${v7()}`);
    local = new PersistenciaOffline(db);
    transporte = new TransporteSimulado();
    ahora = 1000;
    preparar.mockClear();
    motor = new MotorSync(
      db,
      { propietarioActual: () => propietario, preparar },
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

  it('cancela una preparación invalidada, libera solo su lease y no deja pausado al propietario nuevo', async () => {
    const otro = v7();
    let actual = propietario;
    let invalidar!: () => void, continuar!: (valor: boolean) => void, anunciar!: () => void;
    const inicio = new Promise<void>((resolve) => (anunciar = resolve));
    const espera = new Promise<boolean>((resolve) => (continuar = resolve));
    preparar.mockImplementationOnce(() => {
      anunciar();
      return espera;
    });
    motor = new MotorSync(
      db,
      {
        propietarioActual: () => actual,
        preparar,
        alInvalidar: (fn) => {
          invalidar = fn;
          return () => undefined;
        },
      },
      transporte,
      () => ahora,
      () => true,
    );
    const a = await local.crear(propietario, v7(), v7());
    const b = await local.crear(otro, v7(), v7());
    const trabajo = motor.drenar();
    await inicio;
    actual = otro;
    invalidar();
    continuar(false);
    await trabajo;
    expect(await db.bloqueos.count()).toBe(0);
    expect(motor.pausa()).toBeNull();
    expect((await local.operaciones(propietario, a.id))[0].estado).toBe('pendiente');
    await motor.drenar();
    expect((await local.operaciones(otro, b.id))[0].estado).toBe('confirmada');
    expect(transporte.registro.map((o) => o.id)).toEqual(
      (await local.operaciones(otro, b.id)).map((o) => o.id),
    );
  });

  it('no renueva ni toma el candado sin trabajo reclamable, incluso con dependencias bloqueadas', async () => {
    await motor.drenar();
    expect(preparar).not.toHaveBeenCalled();
    expect(await db.bloqueos.count()).toBe(0);
    const i = await local.crear(propietario, v7(), v7());
    await local.editar(propietario, i.id, { editada: true }, i.version_local);
    const [primera, dependiente] = await local.operaciones(propietario, i.id);
    await db.cola_sync.update(primera.id, { estado: 'requiere_intervencion' });
    await motor.drenar();
    expect(preparar).not.toHaveBeenCalled();
    expect(await db.bloqueos.count()).toBe(0);
    expect((await db.cola_sync.get(dependiente.id))?.estado).toBe('pendiente');
    await db.cola_sync.update(primera.id, { estado: 'pendiente', proximo_intento: ahora + 1000 });
    await motor.drenar();
    expect(preparar).not.toHaveBeenCalled();
    ahora += 1000;
    await motor.drenar();
    expect(preparar).toHaveBeenCalledOnce();
    expect(transporte.registro).toHaveLength(2);
    await motor.drenar();
    expect(preparar).toHaveBeenCalledOnce();
  });

  it('el intervalo conserva pausa y online o reanudar la limpia sin cambiar claves', async () => {
    const i = await local.crear(propietario, v7(), v7());
    const [o] = await local.operaciones(propietario, i.id);
    transporte.resultado = 'sesion';
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    motor.iniciar();
    await motor.drenar();
    expect(motor.pausa()).not.toBeNull();
    vi.advanceTimersByTime(3000);
    await motor.drenar();
    expect(preparar).toHaveBeenCalledOnce();
    transporte.resultado = 'ack';
    window.dispatchEvent(new Event('online'));
    await motor.drenar();
    expect(motor.pausa()).toBeNull();
    expect((await db.cola_sync.get(o.id))?.estado).toBe('confirmada');
    expect(transporte.registro.every((r) => r.clave === o.clave)).toBe(true);
    const j = await local.crear(propietario, v7(), v7());
    motor.pausa.set('Sesión vencida');
    motor.reanudar();
    await motor.drenar();
    expect((await local.operaciones(propietario, j.id))[0].estado).toBe('confirmada');
  });

  it('fusiona metadatos de edición y revierte datos, metadatos y cola si falla la transacción', async () => {
    const i = await local.crear(propietario, v7(), v7(), {}, { curso_id: 'curso' });
    const guardada = await local.editar(
      propietario,
      i.id,
      { identificacion: 'puente' },
      i.version_local,
      {
        permanentes: { identificacion: 'puente' },
        permanentes_confirmados_en: 'ahora',
      },
    );
    expect(guardada.metadatos).toEqual({
      curso_id: 'curso',
      permanentes: { identificacion: 'puente' },
      permanentes_confirmados_en: 'ahora',
    });
    const fallar = () => {
      throw new Error('Sin cuota');
    };
    db.cola_sync.hook('creating', fallar);
    await expect(
      local.editar(propietario, i.id, { otra: 1 }, guardada.version_local, { curso_id: 'ajeno' }),
    ).rejects.toThrow();
    expect(await local.inspeccion(propietario, i.id)).toEqual(guardada);
    expect(await db.cola_sync.count()).toBe(2);
    db.cola_sync.hook('creating').unsubscribe(fallar);
  });
});
