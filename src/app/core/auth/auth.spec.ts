import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROL_PUENTES } from '../../features/puentes/rol-puentes';
import { AuthService } from './auth';
import { authInterceptor } from './auth.interceptor';
import { SesionDTO } from './modelos';

const sesion = (
  rol: SesionDTO['usuario']['rol'] = 'ADMINISTRADOR',
  token = 'tok-1',
): SesionDTO => ({
  access_token: token,
  token_type: 'Bearer',
  expires_in: 900,
  usuario: { id: 'u1', nombre: 'Ana Pérez', rol },
});

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'puentes', children: [] }]),
        { provide: ROL_PUENTES, useFactory: () => inject(AuthService).rol },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      vi.restoreAllMocks();
      TestBed.resetTestingModule();
    }
  });

  it('guarda el token en memoria y no toca localStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const respuesta = firstValueFrom(auth.iniciarSesion('Ana@Correo.com', 'Puentes2026ok'));
    const peticion = http.expectOne('/api/v1/auth/login');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.withCredentials).toBe(true);
    expect(peticion.request.body).toEqual({
      correo: 'ana@correo.com',
      contrasena: 'Puentes2026ok',
    });
    peticion.flush(sesion());
    expect(await respuesta).toEqual(sesion());
    expect(auth.accessToken()).toBe('tok-1');
    expect(auth.rol()).toBe('ADMINISTRADOR');
    expect(auth.autenticado()).toBe(true);
    expect(auth.esGestorMantenimiento()).toBe(true);
    expect(TestBed.inject(ROL_PUENTES)()).toBe('ADMINISTRADOR');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('el cierre explícito invalida inmediatamente y una renovación tardía no restaura sesión', async () => {
    const entrada = firstValueFrom(auth.iniciarSesion('ana@correo.com', 'clave'));
    http.expectOne('/api/v1/auth/login').flush(sesion());
    await entrada;
    const renovacion = firstValueFrom(auth.renovar());
    const pendiente = http.expectOne('/api/v1/auth/renovar');
    const cierre = firstValueFrom(auth.cerrarSesion());
    expect(auth.autenticado()).toBe(false);
    pendiente.flush(sesion('ESTUDIANTE', 'tardio'));
    expect(await renovacion).toBeNull();
    http.expectOne('/api/v1/auth/cerrar-sesion').error(new ProgressEvent('error'));
    await cierre;
    expect(auth.usuario()).toBeNull();
  });

  it('no trata al estudiante como gestor de mantenimiento', async () => {
    const respuesta = firstValueFrom(auth.iniciarSesion('ana@correo.com', 'Puentes2026ok'));
    http.expectOne('/api/v1/auth/login').flush(sesion('ESTUDIANTE'));
    await respuesta;
    expect(auth.esGestorMantenimiento()).toBe(false);
  });

  it('al hidratar con 401 deja visitante y no navega a login', async () => {
    const hidratar = firstValueFrom(auth.hidratarAlArrancar());
    http
      .expectOne('/api/v1/auth/renovar')
      .flush(
        { type: 'https://sgp.cunoc.usac.edu.gt/errores/sesion-invalida' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await hidratar;
    expect(auth.autenticado()).toBe(false);
    expect(auth.listo()).toBe(true);
    expect(auth.accessToken()).toBeNull();
  });

  it('cierra la sesión local después del 204 y va al inventario', async () => {
    const respuesta = firstValueFrom(auth.iniciarSesion('ana@correo.com', 'Puentes2026ok'));
    http.expectOne('/api/v1/auth/login').flush(sesion());
    await respuesta;
    const cierre = firstValueFrom(auth.cerrarSesion());
    const peticion = http.expectOne('/api/v1/auth/cerrar-sesion');
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    await cierre;
    expect(auth.accessToken()).toBeNull();
    expect(auth.autenticado()).toBe(false);
  });
});
