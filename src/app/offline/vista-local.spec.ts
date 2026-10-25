import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { v7 } from 'uuid';
import { routes } from '../app.routes';
import { rutaExigeSesion } from '../core/auth/rutas-sesion';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { PersistenciaOffline } from './persistencia';
import { VistaLocal } from './vista-local';

describe('navegación de acceso local', () => {
  let db: BaseLocal;
  afterEach(async () => {
    TestBed.resetTestingModule();
    await db?.delete();
  });
  it('ofrece una ruta separada sin guardia de sesión o rol', () => {
    const ruta = routes.find((r) => r.path === 'offline/local');
    expect(ruta?.loadComponent).toBeDefined();
    expect(ruta?.canActivate).toBeUndefined();
    expect(rutaExigeSesion('/offline/local')).toBe(false);
    expect(rutaExigeSesion('/perfil')).toBe(true);
  });
  it('muestra capturas autorizadas y las retira al invalidar sin esperar otra lectura', async () => {
    db = new BaseLocal(`vista-${v7()}`);
    let invalidar!: () => void;
    let propietario: string | null = v7();
    const propietarioInicial = propietario;
    const liberar = vi.fn();
    const acceso = {
      alInvalidar: (fn: () => void) => {
        invalidar = fn;
        return liberar;
      },
      propietarioActual: async () => propietario,
      inspecciones: async () =>
        propietario ? [{ id: 'preparada', respuestas: { dato: 'propio' } }] : [],
      consultarPropias: async <T>(id: string, leer: () => Promise<T>) =>
        id === propietario ? leer() : undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AccesoLocal, useValue: acceso },
        { provide: BaseLocal, useValue: db },
      ],
    });
    const fixture = TestBed.createComponent(VistaLocal);
    await vi.waitFor(() => expect(fixture.componentInstance.capturas()).toHaveLength(1));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('propio');
    propietario = null;
    invalidar();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('propio');
    expect(fixture.nativeElement.textContent).toContain('login online');
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain('Estado del almacenamiento:'),
    );
    fixture.destroy();
    expect(liberar).toHaveBeenCalledOnce();
    expect(propietarioInicial).not.toBeNull();
  });

  it('integra el diagnóstico consultivo y conserva la cola al revocar el propietario', async () => {
    db = new BaseLocal(`vista-${v7()}`);
    const propietarioInicial = v7();
    const ajeno = v7();
    let propietario: string | null = propietarioInicial;
    let invalidar!: () => void;
    const liberar = vi.fn();
    const persistencia = new PersistenciaOffline(db);
    const captura = await persistencia.crear(propietarioInicial, v7(), v7(), { privada: true });
    await persistencia.crear(ajeno, v7(), v7(), { ajena: true });
    const colaAntes = await persistencia.operaciones(propietarioInicial);
    const acceso = {
      alInvalidar: (fn: () => void) => {
        invalidar = fn;
        return liberar;
      },
      propietarioActual: async () => propietario,
      inspecciones: async () => (propietario ? [captura] : []),
      consultarPropias: async <T>(id: string, leer: () => Promise<T>) =>
        id === propietario ? leer() : undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AccesoLocal, useValue: acceso },
        { provide: BaseLocal, useValue: db },
      ],
    });
    const fixture = TestBed.createComponent(VistaLocal);
    await vi.waitFor(() => expect(fixture.componentInstance.capturas()).toHaveLength(1));
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain(
        'Inspecciones pendientes: 1 · Archivos pendientes: 0',
      ),
    );
    expect(fixture.nativeElement.textContent).toContain(
      'no hay transporte ni reintento productivos',
    );
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
    expect(fixture.nativeElement.textContent).not.toContain(ajeno);

    propietario = null;
    invalidar();
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.nativeElement.textContent).not.toContain(captura.id));
    expect(await persistencia.inspeccion(propietarioInicial, captura.id)).toEqual(captura);
    expect(await persistencia.operaciones(propietarioInicial)).toEqual(colaAntes);
    fixture.destroy();
    expect(liberar).toHaveBeenCalledOnce();
  });
});
