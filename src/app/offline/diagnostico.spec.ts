import 'fake-indexeddb/auto';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { v7 } from 'uuid';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { DiagnosticoOffline } from './diagnostico';
import { MotorSync } from './motor-sync';
import { PersistenciaOffline } from './persistencia';
import { TEXTOS } from '../shared/textos';

const propietario = '019a0000-0000-7000-8000-000000000001';
const ajeno = '019a0000-0000-7000-8000-000000000002';

describe('DiagnosticoOffline', () => {
  let db: BaseLocal;
  let descriptorAlmacenamiento: PropertyDescriptor | undefined;

  beforeEach(() => {
    db = new BaseLocal(`diagnostico-${v7()}`);
    descriptorAlmacenamiento = Object.getOwnPropertyDescriptor(navigator, 'storage');
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: async () => false,
        estimate: async () => ({ usage: 42, quota: 100 }),
      },
    });
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    await db.delete();
    if (descriptorAlmacenamiento)
      Object.defineProperty(navigator, 'storage', descriptorAlmacenamiento);
    else Reflect.deleteProperty(navigator, 'storage');
  });

  it('permite diagnóstico de solo lectura sin motor y protege el propietario habilitado', async () => {
    const persistencia = new PersistenciaOffline(db);
    await persistencia.crear(propietario, v7(), v7());
    await persistencia.crear(ajeno, v7(), v7());
    const colaAntes = await persistencia.operaciones(propietario);
    const acceso = {
      consultarPropias: async <T>(id: string, leer: () => Promise<T>) =>
        id === propietario ? leer() : undefined,
    };
    await TestBed.configureTestingModule({
      imports: [DiagnosticoOffline],
      providers: [{ provide: AccesoLocal, useValue: acceso }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DiagnosticoOffline);
    fixture.componentRef.setInput('db', db);
    fixture.componentRef.setInput('propietario', propietario);
    fixture.detectChanges();

    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain(
        'Inspecciones pendientes: 1 · Archivos pendientes: 0',
      ),
    );
    expect(fixture.nativeElement.textContent).toContain('Persistencia denegada');
    expect(fixture.nativeElement.textContent).toContain('Ocupación del origen (bytes): 42');
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
    expect(await persistencia.operaciones(propietario)).toEqual(colaAntes);
  });

  it('muestra progreso por ACK sin historial, conserva el desplegable y deja errores visibles plegado', async () => {
    const local = new PersistenciaOffline(db);
    const historica = await local.crear(propietario, v7(), v7());
    await db.cola_sync.toCollection().modify({ estado: 'confirmada' });
    const i = await local.crear(propietario, v7(), v7());
    await local.editar(propietario, i.id, { nueva: true }, i.version_local);
    const [primera, segunda] = await local.operaciones(propietario, i.id);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AccesoLocal,
          useValue: {
            consultarPropias: async <T>(_id: string, leer: () => Promise<T>) => leer(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(DiagnosticoOffline);
    fixture.componentRef.setInput('db', db);
    fixture.componentRef.setInput('propietario', propietario);
    fixture.detectChanges();
    const vista = fixture.componentInstance;
    await vi.waitFor(() =>
      expect(vista.progreso()).toEqual({ total: 2, confirmadas: 0, porcentaje: 0 }),
    );
    fixture.detectChanges();
    const detalle = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    const barra = fixture.nativeElement.querySelector('progress') as HTMLProgressElement;
    expect(detalle.open).toBe(false);
    detalle.open = true;
    await db.cola_sync.update(primera.id, { estado: 'en_proceso' });
    await vi.waitFor(() => expect(vista.estadoSync()).toBe(TEXTOS.offline.sincronizando));
    await db.cola_sync.update(primera.id, { estado: 'confirmada', resultado: { version: 1 } });
    await db.cola_sync.update(segunda.id, {
      estado: 'requiere_intervencion',
      error: 'Revisa los datos',
    });
    await vi.waitFor(() =>
      expect(vista.progreso()).toEqual({ total: 2, confirmadas: 1, porcentaje: 50 }),
    );
    await vi.waitFor(() => expect(vista.errores()).toEqual(['Revisa los datos']));
    fixture.detectChanges();
    expect(barra.value).toBe(1);
    expect(barra.max).toBe(2);
    expect(fixture.nativeElement.querySelector('progress')).toBe(barra);
    expect(fixture.nativeElement.querySelector('details')).toBe(detalle);
    expect(detalle.open).toBe(true);
    detalle.open = false;
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Revisa los datos',
    );
    expect(vista.estadoSync()).toBe(TEXTOS.offline.intervencion);
    await db.cola_sync.update(segunda.id, { estado: 'pendiente', intentos: 0, error: null });
    await vi.waitFor(() => expect(vista.errores()).toEqual([]));
    expect(vista.progreso().porcentaje).toBe(50);
    await db.cola_sync.update(segunda.id, { estado: 'confirmada' });
    await vi.waitFor(() => expect(vista.progreso().porcentaje).toBe(100));
    await local.crear(propietario, v7(), v7());
    await vi.waitFor(() =>
      expect(vista.progreso()).toEqual({ total: 1, confirmadas: 0, porcentaje: 0 }),
    );
    expect(vista.grupos().some((g) => g.id === historica.id)).toBe(true);
    fixture.componentRef.setInput('propietario', null);
    fixture.detectChanges();
    expect(vista.progreso().total).toBe(0);
    expect(vista.operaciones()).toEqual([]);
  });

  it('preserva el reintento del harness y anuncia su error de escritura como alerta', async () => {
    const reintentar = vi.fn().mockRejectedValue(new Error('fallo de prueba'));
    const motor = { pausa: signal<string | null>(null), reintentar } as unknown as MotorSync;
    const acceso = {
      consultarPropias: async <T>(_id: string, leer: () => Promise<T>) => leer(),
    };
    await TestBed.configureTestingModule({
      imports: [DiagnosticoOffline],
      providers: [{ provide: AccesoLocal, useValue: acceso }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DiagnosticoOffline);
    fixture.componentRef.setInput('db', db);
    fixture.componentRef.setInput('propietario', propietario);
    fixture.componentRef.setInput('motor', motor);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button')?.click();

    await vi.waitFor(() =>
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        TEXTOS.offline.escrituraError,
      ),
    );
    expect(reintentar).toHaveBeenCalledWith(propietario, undefined);
  });
});
