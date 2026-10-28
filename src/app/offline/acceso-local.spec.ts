import 'fake-indexeddb/auto';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Dexie from 'dexie';
import { firstValueFrom, Subject } from 'rxjs';
import { v7 } from 'uuid';
import { inicializarSesion } from '../app.config';
import { AuthService, EventoSesion } from '../core/auth/auth';
import { AccesoLocal, crearAccesoLocal } from './acceso-local';
import { ALMACENES_V1, BaseLocal } from './base-local';
import { PersistenciaOffline } from './persistencia';
import { MotorSync } from './motor-sync';
import { TransporteSimulado } from './demo/transporte-simulado';
import { SesionOffline } from './sesion-offline';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const ana = v7(),
  bea = v7();

describe('habilitación local durable y coordinación de pestañas', () => {
  let db: BaseLocal, local: PersistenciaOffline, acceso: AccesoLocal;
  let auth: AuthService, remoto: SesionOffline, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    remoto = TestBed.inject(SesionOffline);
    http = TestBed.inject(HttpTestingController);
    db = new BaseLocal(`acceso-${v7()}`);
    local = new PersistenciaOffline(db);
    acceso = new AccesoLocal(db, auth, remoto);
  });
  afterEach(async () => {
    acceso.detener();
    await db.delete();
    http.verify();
    TestBed.resetTestingModule();
  });
  async function entrar(id = ana) {
    const entrada = firstValueFrom(auth.iniciarSesion('estudiante@correo.com', 'clave'));
    http.expectOne('/api/v1/auth/login').flush(respuesta(id));
    await entrada;
  }
  function respuesta(id = ana) {
    return {
      access_token: 'secreto-no-persistir',
      token_type: 'Bearer',
      expires_in: 900,
      usuario: { id, nombre: 'Estudiante', rol: 'ESTUDIANTE' },
    };
  }
  function observarRenovacion() {
    return new Promise<void>((resolve) => {
      vi.spyOn(auth, 'renovar').mockImplementationOnce(() => {
        resolve();
        return AuthService.prototype.renovar.call(auth);
      });
    });
  }
  async function preparar() {
    await entrar();
    const inicio = observarRenovacion();
    const preparada = acceso.habilitarPreparada(ana);
    await inicio;
    http.expectOne('/api/v1/auth/renovar').flush(respuesta());
    expect(await preparada).toBe(true);
  }
  async function reabrir() {
    acceso.detener();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    remoto = TestBed.inject(SesionOffline);
    http = TestBed.inject(HttpTestingController);
    db.close();
    await db.open();
    acceso = new AccesoLocal(db, auth, remoto);
    const arranque = firstValueFrom(auth.hidratarAlArrancar());
    http.expectOne('/api/v1/auth/renovar').error(new ProgressEvent('error'));
    await arranque;
  }

  it('inicializa antes de hidratar y revoca una cuenta distinta aunque no se abra la vista', async () => {
    await preparar();
    acceso.detener();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BaseLocal, useValue: db },
        { provide: AccesoLocal, useFactory: crearAccesoLocal },
      ],
    });
    const arranque = TestBed.runInInjectionContext(inicializarSesion);
    auth = TestBed.inject(AuthService);
    remoto = TestBed.inject(SesionOffline);
    acceso = TestBed.inject(AccesoLocal);
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/auth/renovar').flush(respuesta(bea));
    await arranque;
    await reabrir();
    expect(await acceso.propietarioActual()).toBeNull();
  });
  it('no desbloquea por UUID ni habilita una identidad ajena', async () => {
    expect(await acceso.habilitarPreparada(ana)).toBe(false);
    await entrar();
    expect(await acceso.habilitarPreparada(bea)).toBe(false);
    expect(await acceso.propietarioActual()).toBeNull();
    http.expectNone('/api/v1/auth/renovar');
  });
  it('recupera solo capturas propias tras reinicio sin red, sin autenticar ni drenar', async () => {
    const propia = await local.crear(ana, v7(), v7());
    await local.crear(bea, v7(), v7());
    const cola = await local.operaciones(ana);
    await preparar();
    await reabrir();
    expect(await acceso.propietarioActual()).toBe(ana);
    expect(await acceso.inspecciones()).toEqual([propia]);
    expect(auth.autenticado()).toBe(false);
    expect(remoto.propietarioActual()).toBeNull();
    expect(await remoto.preparar(ana)).toBe(false);
    expect(await local.operaciones(ana)).toEqual(cola);
    const registros = await Promise.all(db.tables.map((tabla) => tabla.toArray()));
    expect(JSON.stringify(registros)).not.toMatch(
      /secreto-no-persistir|access_token|Authorization/,
    );
    http.expectNone('/api/v1/auth/renovar');
  });
  it.each(['cierre', 'cambio'] as const)(
    '%s revoca durablemente sin purgar y solo login del dueño restaura',
    async (tipo) => {
      const captura = await local.crear(ana, v7(), v7());
      const cola = await local.operaciones(ana);
      await preparar();
      if (tipo === 'cierre') auth.cerrarSesionLocal();
      else await entrar(bea);
      expect(await acceso.inspecciones()).toEqual([]);
      await reabrir();
      expect(await acceso.propietarioActual()).toBeNull();
      expect(await acceso.habilitarPreparada(ana)).toBe(false);
      // Renovación válida no sustituye el login requerido tras revocación.
      const renovacion = firstValueFrom(auth.renovar());
      http.expectOne('/api/v1/auth/renovar').flush(respuesta());
      await renovacion;
      expect(await acceso.propietarioActual()).toBeNull();
      expect(await acceso.habilitarPreparada(ana)).toBe(false);
      await entrar();
      expect(await acceso.inspecciones()).toEqual([captura]);
      expect(await local.operaciones(ana)).toEqual(cola);
    },
  );
  it.each(['cierre', 'cambio'] as const)(
    'no publica capturas si %s coincide con la última lectura',
    async (tipo) => {
      const captura = await local.crear(ana, v7(), v7());
      const cola = await local.operaciones(ana);
      await preparar();
      const get = db.acceso_local.get.bind(db.acceso_local);
      let lecturas = 0;
      let cambio: Promise<void> | undefined;
      const lectura = vi.spyOn(db.acceso_local, 'get').mockImplementation((key) =>
        get(key).then((registro) => {
          if (++lecturas === 2) {
            if (tipo === 'cierre') auth.cerrarSesionLocal();
            else cambio = entrar(bea);
          }
          return registro;
        }),
      );
      try {
        expect(await acceso.inspecciones()).toEqual([]);
        expect(lecturas).toBeGreaterThanOrEqual(2);
        expect(await local.inspeccion(ana, captura.id)).toEqual(captura);
        expect(await local.operaciones(ana)).toEqual(cola);
      } finally {
        lectura.mockRestore();
        await cambio;
        await acceso.propietarioActual();
      }
    },
  );
  it('cierre durante renovación no publica una habilitación tardía', async () => {
    await entrar();
    const inicio = observarRenovacion();
    const preparada = acceso.habilitarPreparada(ana);
    await inicio;
    const renovacion = http.expectOne('/api/v1/auth/renovar');
    auth.cerrarSesionLocal();
    renovacion.flush(respuesta());
    expect(await preparada).toBe(false);
    await reabrir();
    expect(await acceso.propietarioActual()).toBeNull();
  });
  it('otra instancia con sesión antigua consulta la revocación durable', async () => {
    await preparar();
    const otraBase = new BaseLocal(db.name);
    const eventos = new Subject<EventoSesion>();
    const sesionAntigua = { eventosSesion: eventos.asObservable() } as AuthService;
    const remotoAntiguo = {
      propietarioActual: () => ana,
      coordinarAcceso: vi.fn(),
      cancelarEjecucion: vi.fn(),
    } as unknown as SesionOffline;
    const otra = new AccesoLocal(otraBase, sesionAntigua, remotoAntiguo);
    try {
      expect(await otra.propietarioActual()).toBe(ana);
      auth.cerrarSesionLocal();
      expect(await acceso.propietarioActual()).toBeNull();
      expect(await otra.propietarioActual()).toBeNull();
    } finally {
      otra.detener();
      otraBase.close();
    }
  });
  it('notifica activamente revocación entre instancias y bloquea renovación remota antigua', async () => {
    await preparar();
    const otraBase = new BaseLocal(db.name);
    const otra = new AccesoLocal(otraBase, auth, remoto);
    const invalidada = vi.fn();
    const liberar = otra.alInvalidar(invalidada);
    try {
      await vi.waitFor(() => expect(invalidada).toHaveBeenCalled());
      invalidada.mockClear();
      auth.cerrarSesionLocal();
      await vi.waitFor(() => expect(invalidada).toHaveBeenCalled());
      expect(await otra.inspecciones()).toEqual([]);
      // Una sesión antigua de otra pestaña no puede reactivar el drenaje.
      auth.usuario.set(respuesta().usuario as NonNullable<ReturnType<typeof auth.usuario>>);
      auth.accessToken.set('antiguo');
      expect(await remoto.preparar(ana)).toBe(false);
      http.expectNone('/api/v1/auth/renovar');
    } finally {
      liberar();
      otra.detener();
      otraBase.close();
    }
  });
  function abrirOtraPestana() {
    const inyector = createEnvironmentInjector(
      [provideHttpClient(), provideHttpClientTesting(), AuthService, SesionOffline],
      TestBed.inject(EnvironmentInjector),
    );
    const auth = inyector.get(AuthService);
    const http = inyector.get(HttpTestingController);
    const base = new BaseLocal(db.name);
    const acceso = new AccesoLocal(base, auth, inyector.get(SesionOffline));
    return {
      acceso,
      auth,
      entrar: async (id: string) => {
        const entrada = firstValueFrom(auth.iniciarSesion('otra@correo.com', 'clave'));
        http.expectOne('/api/v1/auth/login').flush(respuesta(id));
        await entrada;
      },
      detener: () => {
        acceso.detener();
        http.verify();
        inyector.destroy();
        base.close();
      },
    };
  }
  it('una lectura desde una cuenta antigua no revoca el login restaurado del dueño', async () => {
    const captura = await local.crear(ana, v7(), v7());
    await local.crear(bea, v7(), v7());
    const cola = await local.operaciones(ana);
    await preparar();
    const otra = abrirOtraPestana();
    try {
      await otra.entrar(bea);
      expect(await otra.acceso.inspecciones()).toEqual([]);
      expect(await acceso.inspecciones()).toEqual([]);
      await entrar();
      expect(await acceso.inspecciones()).toEqual([captura]);
      // La pestaña B sigue sin ver A, pero consultar no equivale a cambiar cuenta.
      expect(await otra.acceso.inspecciones()).toEqual([]);
      expect(await acceso.inspecciones()).toEqual([captura]);
      expect(await local.operaciones(ana)).toEqual(cola);
    } finally {
      otra.detener();
    }
  });
  it.each(['cierre', 'cambio'] as const)(
    '%s en otra pestaña cancela el transporte en vuelo sin ACK ni siguiente operación',
    async (tipo) => {
      const captura = await local.crear(ana, v7(), v7(), { primera: true });
      await local.editar(ana, captura.id, { nueva: true }, captura.version_local);
      const original = await local.inspeccion(ana, captura.id);
      const cola = await local.operaciones(ana);
      await preparar();
      const otra = abrirOtraPestana();
      const transporte = new TransporteSimulado();
      transporte.demora = 30000;
      const ejecutar = vi.spyOn(transporte, 'ejecutar');
      const motor = new MotorSync(db, remoto, transporte, Date.now, () => true);
      let trabajo: Promise<void> | undefined;
      try {
        await otra.entrar(ana);
        await otra.acceso.propietarioActual();
        const renovacion = observarRenovacion();
        trabajo = motor.drenar();
        await renovacion;
        http.expectOne('/api/v1/auth/renovar').flush(respuesta());
        await vi.waitFor(() => expect(transporte.activos).toBe(1));
        const signal = ejecutar.mock.calls[0][2];
        expect(signal.aborted).toBe(false);
        if (tipo === 'cierre') otra.auth.cerrarSesionLocal();
        else await otra.entrar(bea);
        await vi.waitFor(() => expect(signal.aborted).toBe(true));
        await trabajo;
        expect(auth.autenticado()).toBe(true); // Esta pestaña no recibió eventos P2.
        expect(transporte.registro).toHaveLength(1);
        expect(await local.inspeccion(ana, captura.id)).toEqual(original);
        expect(await local.operaciones(ana)).toEqual([
          { ...cola[0], ultimo_intento: expect.any(Number) },
          cola[1],
        ]);
        expect(await remoto.preparar(ana)).toBe(false);
        http.expectNone('/api/v1/auth/renovar');
      } finally {
        motor.detener();
        await trabajo;
        otra.detener();
      }
      await reabrir();
      expect(await acceso.propietarioActual()).toBeNull();
      expect(await local.inspeccion(ana, captura.id)).toEqual(original);
    },
  );
  it('sustituye al propietario solo tras preparar, no con un simple login', async () => {
    await preparar();
    await entrar(bea);
    expect(await acceso.propietarioActual()).toBeNull();
    const inicio = observarRenovacion();
    const preparada = acceso.habilitarPreparada(bea);
    expect(await Promise.race([inicio.then(() => true), preparada])).toBe(true);
    http.expectOne('/api/v1/auth/renovar').flush(respuesta(bea));
    expect(await preparada).toBe(true);
    expect(await acceso.propietarioActual()).toBe(bea);
    await reabrir();
    expect(await acceso.propietarioActual()).toBe(bea);
    const renovacion = firstValueFrom(auth.renovar());
    http.expectOne('/api/v1/auth/renovar').flush(respuesta(ana));
    await renovacion;
    expect(await acceso.habilitarPreparada(ana)).toBe(false);
    expect(await acceso.propietarioActual()).toBeNull();
  });
  it('migra v2 preservando captura, cola y metadatos sin inventar habilitación', async () => {
    const captura = await local.crear(ana, v7(), v7());
    const cola = await local.operaciones(ana);
    const nombre = `v2-${v7()}`;
    const anterior = new Dexie(nombre);
    anterior.version(2).stores({ ...ALMACENES_V1, bloqueos: 'propietario_id' });
    await anterior.table('inspecciones').add(captura);
    await anterior.table('cola_sync').bulkAdd(cola);
    anterior.close();
    const migrada = new BaseLocal(nombre);
    const servicio = new AccesoLocal(migrada, auth, remoto);
    try {
      expect(await servicio.propietarioActual()).toBeNull();
      expect(await new PersistenciaOffline(migrada).inspeccion(ana, captura.id)).toEqual(captura);
      expect(await new PersistenciaOffline(migrada).operaciones(ana)).toEqual(cola);
      expect(migrada.verno).toBe(4);
    } finally {
      servicio.detener();
      await migrada.delete();
    }
  });
});
