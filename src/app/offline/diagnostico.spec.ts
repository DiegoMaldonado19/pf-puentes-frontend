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
