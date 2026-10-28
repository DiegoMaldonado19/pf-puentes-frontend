import 'fake-indexeddb/auto';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { v7 } from 'uuid';
import { appConfig } from '../app.config';
import { AuthService, EventoSesion } from '../core/auth/auth';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { MotorSync } from './motor-sync';
import { PersistenciaOffline } from './persistencia';
import { proveerSync } from './proveedores-sync';
import { SesionOffline } from './sesion-offline';
import { TransporteHttp } from './transporte-http';

describe('proveedor de sincronización productiva', () => {
  let db: BaseLocal;
  afterEach(async () => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    await db?.delete();
  });
  it('registra el motor real y reanuda en login; destruye su suscripción y temporizador', async () => {
    expect(appConfig.providers).toContain(proveerSync);
    db = new BaseLocal(`proveedor-sync-${v7()}`);
    const propietario = v7();
    const eventos = new Subject<EventoSesion>();
    const preparar = vi.fn(async () => true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        proveerSync,
        { provide: BaseLocal, useValue: db },
        { provide: AccesoLocal, useValue: {} },
        { provide: AuthService, useValue: { eventosSesion: eventos.asObservable() } },
        { provide: SesionOffline, useValue: { propietarioActual: () => propietario, preparar } },
      ],
    });
    const transporte = TestBed.inject(TransporteHttp);
    const ejecutar = vi.spyOn(transporte, 'ejecutar').mockImplementation(async (o) => ({
      tipo: 'ack',
      propietario_id: o.propietario_id,
      operacion_id: o.id,
      version_local: o.version_local,
      resultado: { version: 1 },
    }));
    const motor = TestBed.inject(MotorSync);
    const local = new PersistenciaOffline(db);
    await local.crear(propietario, v7(), v7());
    motor.pausa.set('Sesión vencida');
    eventos.next({ tipo: 'login', propietario_id: propietario });
    await motor.drenar();
    expect(motor.pausa()).toBeNull();
    expect(preparar).toHaveBeenCalledWith(propietario);
    expect(ejecutar).toHaveBeenCalledOnce();
    const detener = vi.spyOn(motor, 'detener');
    const reanudar = vi.spyOn(motor, 'reanudar');
    TestBed.resetTestingModule();
    expect(detener).toHaveBeenCalledOnce();
    eventos.next({ tipo: 'login', propietario_id: propietario });
    expect(reanudar).not.toHaveBeenCalled();
  });
});
