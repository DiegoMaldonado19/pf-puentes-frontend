import 'fake-indexeddb/auto';
import { computed, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { v7 } from 'uuid';
import { routes } from '../app.routes';
import { rutaExigeSesion } from '../core/auth/rutas-sesion';
import { AuthService, EventoSesion } from '../core/auth/auth';
import { Rol, UsuarioSesionDTO } from '../core/auth/modelos';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { PersistenciaOffline } from './persistencia';
import { PreparacionLocal, ProgresoPreparacion, ResultadoPreparacion } from './preparacion';
import { VistaLocal } from './vista-local';

interface SesionDePrueba {
  auth: AuthService;
  eventos: Subject<EventoSesion>;
  usuario: WritableSignal<UsuarioSesionDTO | null>;
}

function crearSesion(rol: Rol | null = null, id = v7()): SesionDePrueba {
  const usuario = signal<UsuarioSesionDTO | null>(rol ? { id, nombre: 'Estudiante', rol } : null);
  const accessToken = signal<string | null>(rol ? 'token' : null);
  const eventos = new Subject<EventoSesion>();
  return {
    auth: {
      usuario,
      accessToken,
      autenticado: computed(() => accessToken() !== null && usuario() !== null),
      rol: computed(() => usuario()?.rol ?? null),
      eventosSesion: eventos.asObservable(),
    } as unknown as AuthService,
    eventos,
    usuario,
  };
}

function resultadoCompleto(): ResultadoPreparacion {
  return {
    completa: true,
    proveedores: { referencia: 'completo', publicacion: 'completo', esquema: 'completo' },
  };
}

function configurar(
  db: BaseLocal,
  acceso: object,
  preparacion: object = { preparar: vi.fn(async () => resultadoCompleto()) },
  sesion = crearSesion(),
): SesionDePrueba {
  TestBed.configureTestingModule({
    providers: [
      { provide: AccesoLocal, useValue: acceso },
      { provide: BaseLocal, useValue: db },
      { provide: AuthService, useValue: sesion.auth },
      { provide: PreparacionLocal, useValue: preparacion },
    ],
  });
  return sesion;
}

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
    configurar(db, acceso);
    const fixture = TestBed.createComponent(VistaLocal);
    await vi.waitFor(() => expect(fixture.componentInstance.capturas()).toHaveLength(1));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('propio');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
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
    configurar(db, acceso);
    const fixture = TestBed.createComponent(VistaLocal);
    await vi.waitFor(() => expect(fixture.componentInstance.capturas()).toHaveLength(1));
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain(
        'Inspecciones pendientes: 1 · Archivos pendientes: 0',
      ),
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Esta vista no incluye editor, nueva captura, transporte ni motor de reintentos.',
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

  it('ofrece preparación solo a una sesión remota de estudiante', () => {
    db = new BaseLocal(`vista-${v7()}`);
    for (const rol of ['ADMINISTRADOR', 'CATEDRATICO', 'PROFESIONAL_EXTERNO'] as const) {
      configurar(
        db,
        {
          alInvalidar: () => vi.fn(),
          propietarioActual: async () => null,
          inspecciones: async () => [],
        },
        undefined,
        crearSesion(rol),
      );
      const fixture = TestBed.createComponent(VistaLocal);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Preparar para uso sin conexión');
      fixture.destroy();
      TestBed.resetTestingModule();
    }

    configurar(db, {
      alInvalidar: () => vi.fn(),
      propietarioActual: async () => null,
      inspecciones: async () => [],
    });
    const fixture = TestBed.createComponent(VistaLocal);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Preparar para uso sin conexión');
    fixture.destroy();
  });

  it('prepara con la identidad remota vigente, muestra progreso y bloquea clics repetidos', async () => {
    db = new BaseLocal(`vista-${v7()}`);
    const idRemoto = v7();
    const propietarioLocalAnterior = v7();
    const sesion = crearSesion('ESTUDIANTE', idRemoto);
    let resolver!: (resultado: ResultadoPreparacion) => void;
    const pendiente = new Promise<ResultadoPreparacion>((resolve) => (resolver = resolve));
    const preparar = vi.fn((id: string, progreso?: (estado: ProgresoPreparacion) => void) => {
      progreso?.({ proveedor: 'referencia', estado: 'descargando' });
      return pendiente;
    });
    const acceso = {
      alInvalidar: () => vi.fn(),
      propietarioActual: async () => propietarioLocalAnterior,
      inspecciones: async () => [],
      consultarPropias: async <T>(_id: string, leer: () => Promise<T>) => leer(),
    };
    configurar(db, acceso, { preparar }, sesion);
    const fixture = TestBed.createComponent(VistaLocal);
    fixture.detectChanges();
    const boton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(boton.textContent).toContain('Preparar para uso sin conexión');
    boton.click();
    fixture.detectChanges();
    expect(boton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Puentes y asignaciones: Descargando…');
    boton.click();
    expect(preparar).toHaveBeenCalledOnce();
    expect(preparar).toHaveBeenCalledWith(idRemoto, expect.any(Function));

    resolver(resultadoCompleto());
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain(
        'Preparación para uso sin conexión completa.',
      ),
    );
    expect(fixture.nativeElement.textContent).toContain('Formulario activo: Completo');
    fixture.destroy();
  });

  it('presenta el fallo de preparación sin exponer el error técnico', async () => {
    db = new BaseLocal(`vista-${v7()}`);
    const sesion = crearSesion('ESTUDIANTE');
    const fallida: ResultadoPreparacion = {
      completa: false,
      proveedores: { referencia: 'completo', publicacion: 'completo', esquema: 'fallo' },
      error: 'error técnico interno',
    };
    const preparar = vi.fn(async () => fallida);
    configurar(
      db,
      {
        alInvalidar: () => vi.fn(),
        propietarioActual: async () => null,
        inspecciones: async () => [],
      },
      { preparar },
      sesion,
    );
    const fixture = TestBed.createComponent(VistaLocal);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain(
        'No se completó la preparación para uso sin conexión.',
      ),
    );
    expect(fixture.nativeElement.textContent).toContain('Formulario activo: No completado');
    expect(fixture.nativeElement.textContent).not.toContain('error técnico interno');
    fixture.destroy();
  });

  it('retira el resultado visible cuando cambia la identidad remota', async () => {
    db = new BaseLocal(`vista-${v7()}`);
    const idInicial = v7();
    const sesion = crearSesion('ESTUDIANTE', idInicial);
    const preparar = vi.fn(
      async (_id: string, progreso?: (estado: ProgresoPreparacion) => void) => {
        progreso?.({ proveedor: 'referencia', estado: 'descargando' });
        return resultadoCompleto();
      },
    );
    configurar(
      db,
      {
        alInvalidar: () => vi.fn(),
        propietarioActual: async () => v7(),
        inspecciones: async () => [],
      },
      { preparar },
      sesion,
    );
    const fixture = TestBed.createComponent(VistaLocal);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain(
        'Preparación para uso sin conexión completa.',
      ),
    );

    sesion.usuario.set({ id: v7(), nombre: 'Otra estudiante', rol: 'ESTUDIANTE' });
    sesion.eventos.next({ tipo: 'cambio', propietario_id: idInicial });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Preparación para uso sin conexión completa.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Formulario activo: Completo');
    expect(preparar).toHaveBeenCalledWith(idInicial, expect.any(Function));
    fixture.destroy();
  });

  it('retira progreso y descarta el resultado tardío al cambiar de identidad', async () => {
    db = new BaseLocal(`vista-${v7()}`);
    const idInicial = v7();
    const sesion = crearSesion('ESTUDIANTE', idInicial);
    let resolver!: (resultado: ResultadoPreparacion) => void;
    const pendiente = new Promise<ResultadoPreparacion>((resolve) => (resolver = resolve));
    const preparar = vi.fn((_id: string, progreso?: (estado: ProgresoPreparacion) => void) => {
      progreso?.({ proveedor: 'referencia', estado: 'descargando' });
      return pendiente;
    });
    configurar(
      db,
      {
        alInvalidar: () => vi.fn(),
        propietarioActual: async () => v7(),
        inspecciones: async () => [],
      },
      { preparar },
      sesion,
    );
    const fixture = TestBed.createComponent(VistaLocal);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Puentes y asignaciones: Descargando…');

    const idNuevo = v7();
    sesion.usuario.set({ id: idNuevo, nombre: 'Otra estudiante', rol: 'ESTUDIANTE' });
    sesion.eventos.next({ tipo: 'cambio', propietario_id: idInicial });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Puentes y asignaciones: Descargando…');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Preparación para uso sin conexión completa.',
    );

    resolver(resultadoCompleto());
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Preparación para uso sin conexión completa.',
    );
    expect(preparar).toHaveBeenCalledWith(idInicial, expect.any(Function));
    fixture.destroy();
  });

  it('limpia el progreso y descarta una preparación tardía al destruir la vista', async () => {
    db = new BaseLocal(`vista-${v7()}`);
    const sesion = crearSesion('ESTUDIANTE');
    let resolver!: (resultado: ResultadoPreparacion) => void;
    const pendiente = new Promise<ResultadoPreparacion>((resolve) => (resolver = resolve));
    const preparar = vi.fn((_id: string, progreso?: (estado: ProgresoPreparacion) => void) => {
      progreso?.({ proveedor: 'referencia', estado: 'descargando' });
      return pendiente;
    });
    configurar(
      db,
      {
        alInvalidar: () => vi.fn(),
        propietarioActual: async () => null,
        inspecciones: async () => [],
      },
      { preparar },
      sesion,
    );
    const fixture = TestBed.createComponent(VistaLocal);
    fixture.detectChanges();
    fixture.componentInstance.preparar();
    fixture.detectChanges();
    expect(fixture.componentInstance.progreso()).not.toBeNull();
    fixture.destroy();
    expect(fixture.componentInstance.progreso()).toBeNull();
    expect(fixture.componentInstance.preparando()).toBe(false);

    resolver(resultadoCompleto());
    await Promise.resolve();
    await Promise.resolve();
    expect(fixture.componentInstance.resultado()).toBeNull();
  });
});
