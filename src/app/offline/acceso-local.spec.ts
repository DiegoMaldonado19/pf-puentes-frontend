import 'fake-indexeddb/auto';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Dexie from 'dexie';
import { firstValueFrom, Subject } from 'rxjs';
import { v7 } from 'uuid';
import { AuthService, EventoSesion } from '../core/auth/auth';
import { AccesoLocal } from './acceso-local';
import { ALMACENES_V1, BaseLocal } from './base-local';
import { PersistenciaOffline } from './persistencia';
import { SesionOffline } from './sesion-offline';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const ana = v7(),
  bea = v7();

describe('habilitación local durable (sin navegación productiva)', () => {
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
    const remotoAntiguo = { propietarioActual: () => ana } as SesionOffline;
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
      expect(migrada.verno).toBe(3);
    } finally {
      servicio.detener();
      await migrada.delete();
    }
  });
});
