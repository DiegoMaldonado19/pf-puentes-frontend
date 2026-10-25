import 'fake-indexeddb/auto';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Dexie from 'dexie';
import { firstValueFrom } from 'rxjs';
import { v7 } from 'uuid';
import { AuthService, EventoSesion } from '../core/auth/auth';
import { authInterceptor } from '../core/auth/auth.interceptor';
import { SesionDTO } from '../core/auth/modelos';
import { BaseLocal } from './base-local';
import { MotorSync } from './motor-sync';
import { PersistenciaOffline } from './persistencia';
import { SesionOffline } from './sesion-offline';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const ana = v7(),
  bea = v7();
const sesion = (id = ana, token = 'solo-memoria'): SesionDTO => ({
  access_token: token,
  token_type: 'Bearer',
  expires_in: 900,
  usuario: { id, nombre: 'Estudiante', rol: 'ESTUDIANTE' },
});

describe('sesión remota offline P2 (sin transporte productivo)', () => {
  let auth: AuthService, adaptador: SesionOffline, http: HttpTestingController;
  let db: BaseLocal, local: PersistenciaOffline, motor: MotorSync | undefined;
  let eventos: EventoSesion[];
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'puentes', children: [] }]),
      ],
    });
    auth = TestBed.inject(AuthService);
    adaptador = TestBed.inject(SesionOffline);
    http = TestBed.inject(HttpTestingController);
    db = new BaseLocal(`sesion-${v7()}`);
    local = new PersistenciaOffline(db);
    eventos = [];
    auth.eventosSesion.subscribe((evento) => eventos.push(evento));
  });
  afterEach(async () => {
    motor?.detener();
    motor = undefined;
    await db.delete();
    try {
      http.verify();
    } finally {
      vi.restoreAllMocks();
      TestBed.resetTestingModule();
    }
  });
  async function entrar(id = ana) {
    const entrada = firstValueFrom(auth.iniciarSesion('estudiante@correo.com', 'clave'));
    http.expectOne('/api/v1/auth/login').flush(sesion(id));
    await entrada;
  }
  function observarRenovacion(): Promise<void> {
    const renovar = auth.renovar.bind(auth);
    return new Promise((resolve) => {
      vi.spyOn(auth, 'renovar').mockImplementation(() => {
        resolve();
        return renovar();
      });
    });
  }

  it('sin identidad remota no prepara ni renueva aunque se seleccione un UUID', async () => {
    expect(await adaptador.preparar(ana)).toBe(false);
    expect(adaptador.propietarioActual()).toBeNull();
    http.expectNone('/api/v1/auth/renovar');
    await entrar();
    expect(await adaptador.preparar(bea)).toBe(false);
    http.expectNone('/api/v1/auth/renovar');
  });

  it('comparte renovación con el interceptor y conserva su reintento Bearer', async () => {
    await entrar();
    const lectura = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/privado'));
    http.expectOne('/api/v1/privado').flush(null, { status: 401, statusText: 'Unauthorized' });
    const preparada = adaptador.preparar(ana);
    http.expectOne('/api/v1/auth/renovar').flush(sesion(ana, 'nuevo'));
    const repetida = http.expectOne('/api/v1/privado');
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer nuevo');
    repetida.flush({ ok: true });
    expect(await preparada).toBe(true);
    await lectura;
    http.expectNone('/api/v1/auth/renovar');
  });

  it.each(['red', 'invalida'] as const)(
    'arranque con %s no concede sesión remota ni emite cierre',
    async (tipo) => {
      const arranque = firstValueFrom(auth.hidratarAlArrancar());
      const peticion = http.expectOne('/api/v1/auth/renovar');
      if (tipo === 'red') peticion.error(new ProgressEvent('error'));
      else peticion.flush(null, { status: 401, statusText: 'Unauthorized' });
      await arranque;
      expect(auth.autenticado()).toBe(false);
      expect(await adaptador.preparar(ana)).toBe(false);
      expect(eventos).toEqual([{ tipo, propietario_id: null }]);
    },
  );

  it('cambio durante preparación rechaza la identidad anterior y una respuesta tardía', async () => {
    await entrar();
    const preparada = adaptador.preparar(ana);
    const renovacion = http.expectOne('/api/v1/auth/renovar');
    await entrar(bea);
    renovacion.flush(sesion(ana, 'tardio'));
    expect(await preparada).toBe(false);
    expect(adaptador.propietarioActual()).toBe(bea);
    expect(eventos).toContainEqual({ tipo: 'cambio', propietario_id: ana });
  });

  it.each([401, 0])(
    'renovación fallida %s pausa sin enviar ni consumir intentos',
    async (estado) => {
      await entrar();
      const i = await local.crear(ana, v7(), v7());
      const originales = await local.operaciones(ana);
      const ejecutar = vi.fn();
      motor = new MotorSync(db, adaptador, { ejecutar }, Date.now, () => true);
      const inicio = observarRenovacion();
      const trabajo = motor.drenar();
      await inicio;
      const peticion = http.expectOne('/api/v1/auth/renovar');
      if (estado === 0) peticion.error(new ProgressEvent('error'));
      else peticion.flush(null, { status: estado, statusText: 'Unauthorized' });
      await trabajo;
      expect(ejecutar).not.toHaveBeenCalled();
      expect(motor.pausa()).not.toBeNull();
      expect(await local.operaciones(ana)).toEqual(originales);
      expect(await local.inspeccion(ana, i.id)).toEqual(i);
    },
  );

  it.each([
    ['cierre', 'transporte'],
    ['cambio', 'transporte'],
    ['cierre', 'confirmacion'],
    ['cambio', 'confirmacion'],
  ] as const)(
    '%s durante %s cancela señal, ignora ACK tardío y conserva datos sin tokens',
    async (tipo, etapa) => {
      await entrar();
      const i = await local.crear(ana, v7(), v7(), { respuesta: 1 });
      const original = (await local.operaciones(ana, i.id))[0];
      let iniciada!: () => void, aceptar!: () => void;
      let enviada!: AbortSignal;
      const inicio = new Promise<void>((r) => (iniciada = r));
      const espera = new Promise<void>((r) => (aceptar = r));
      let invalidacion: Promise<void> | undefined;
      const invalidar = () => {
        if (tipo === 'cambio') return entrar(bea);
        const cierre = firstValueFrom(auth.cerrarSesion());
        http.expectOne('/api/v1/auth/cerrar-sesion').error(new ProgressEvent('error'));
        return cierre;
      };
      if (etapa === 'confirmacion') {
        const leer = db.cola_sync.get.bind(db.cola_sync);
        vi.spyOn(db.cola_sync, 'get').mockImplementationOnce((id) =>
          leer(id).then((registro) => {
            // Invalidar entre la lectura asíncrona y la aplicación del ACK.
            invalidacion = invalidar();
            iniciada();
            return registro;
          }),
        );
      }
      motor = new MotorSync(
        db,
        adaptador,
        {
          ejecutar: async (o, _archivo, signal) => {
            enviada = signal;
            if (etapa === 'transporte') {
              iniciada();
              await espera;
            }
            return {
              tipo: 'ack',
              propietario_id: o.propietario_id,
              operacion_id: o.id,
              version_local: o.version_local,
              resultado: null,
            };
          },
        },
        Date.now,
        () => true,
      );
      const renovacion = observarRenovacion();
      const trabajo = motor.drenar();
      await renovacion;
      http.expectOne('/api/v1/auth/renovar').flush(sesion());
      await inicio;
      if (etapa === 'transporte') invalidacion = invalidar();
      await invalidacion;
      expect(enviada.aborted).toBe(true);
      aceptar();
      await trabajo;
      expect(await local.inspeccion(ana, i.id)).toEqual(i);
      expect((await local.operaciones(ana, i.id))[0]).toEqual({
        ...original,
        ultimo_intento: expect.any(Number),
      });
      expect(JSON.stringify(await local.operaciones(ana))).not.toContain('solo-memoria');
    },
  );
});
