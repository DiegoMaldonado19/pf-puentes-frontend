import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { erroresInterceptor, mensajeAdjuntado } from '../errores/errores.interceptor';
import { mensajeDeProblema } from '../errores/problema';
import { AuthService } from './auth';
import { authInterceptor } from './auth.interceptor';
import { SesionDTO } from './modelos';

const sesion = (token = 'tok-1'): SesionDTO => ({
  access_token: token,
  token_type: 'Bearer',
  expires_in: 900,
  usuario: { id: 'u1', nombre: 'Ana Pérez', rol: 'ESTUDIANTE' },
});

const problema = (type: string) => ({
  type: `https://sgp.cunoc.usac.edu.gt/errores/${type}`,
});

describe('authInterceptor', () => {
  let auth: AuthService;
  let cliente: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, erroresInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    auth = TestBed.inject(AuthService);
    cliente = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  async function entrar(token = 'tok-1'): Promise<void> {
    const respuesta = firstValueFrom(auth.iniciarSesion('ana@correo.com', 'Puentes2026ok'));
    http.expectOne('/api/v1/auth/login').flush(sesion(token));
    await respuesta;
  }

  it('propaga el fallo transitorio de renovación sin redirigir ni borrar identidad', async () => {
    await entrar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const respuesta = firstValueFrom(cliente.get('/api/v1/usuarios/me'));
    const rechazo = expect(respuesta).rejects.toMatchObject({ status: 502 });
    http.expectOne('/api/v1/usuarios/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/v1/auth/renovar').flush({}, { status: 502, statusText: 'Bad Gateway' });
    await rechazo;
    expect(auth.usuario()?.id).toBe('u1');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('un 401 privado dispara un solo renovar y reintenta con el token nuevo', async () => {
    await entrar('tok-1');
    const perfil = firstValueFrom(cliente.get('/api/v1/usuarios/me'));
    const primera = http.expectOne('/api/v1/usuarios/me');
    expect(primera.request.headers.get('Authorization')).toBe('Bearer tok-1');
    primera.flush(problema('no-autenticado'), { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/v1/auth/renovar').flush(sesion('tok-2'));
    const reintento = http.expectOne('/api/v1/usuarios/me');
    expect(reintento.request.headers.get('Authorization')).toBe('Bearer tok-2');
    reintento.flush({
      id: 'u1',
      nombre: 'Ana Pérez',
      correo: 'ana@correo.com',
      rol: 'ESTUDIANTE',
      estado: 'ACTIVO',
    });
    await perfil;
    http.expectNone('/api/v1/auth/renovar');
  });

  it('un 401 de login no llama a renovar', async () => {
    const intento = firstValueFrom(auth.iniciarSesion('ana@correo.com', 'mala'));
    http.expectOne('/api/v1/auth/login').flush(problema('credenciales-invalidas'), {
      status: 401,
      statusText: 'Unauthorized',
    });
    await expect(intento).rejects.toBeInstanceOf(HttpErrorResponse);
    http.expectNone('/api/v1/auth/renovar');
    expect(auth.accessToken()).toBeNull();
  });

  it('el mapa público no lleva Authorization si no hay sesión', async () => {
    const listado = firstValueFrom(cliente.get('/api/v1/puentes'));
    const peticion = http.expectOne('/api/v1/puentes');
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush({ contenido: [], pagina: 0, tamano: 20, total_elementos: 0, total_paginas: 0 });
    await listado;
  });

  it('un 401 público sin token no intenta renovar', async () => {
    const listado = firstValueFrom(cliente.get('/api/v1/puentes'));
    http.expectOne('/api/v1/puentes').flush(problema('no-autenticado'), {
      status: 401,
      statusText: 'Unauthorized',
    });
    await expect(listado).rejects.toBeInstanceOf(HttpErrorResponse);
    http.expectNone('/api/v1/auth/renovar');
  });

  it('un 429 no se traduce como credenciales inválidas', async () => {
    const intento = firstValueFrom(auth.iniciarSesion('ana@correo.com', 'Puentes2026ok'));
    http.expectOne('/api/v1/auth/login').flush(problema('demasiadas-solicitudes'), {
      status: 429,
      statusText: 'Too Many Requests',
      headers: new HttpHeaders({ 'Retry-After': '12' }),
    });
    const error = await intento.then(
      () => null,
      (fallo: unknown) => fallo,
    );
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(mensajeDeProblema(error)).toBe(TEXTOS.auth.errores['demasiadas-solicitudes']);
    expect(mensajeAdjuntado.get(error as HttpErrorResponse)).toBe(
      TEXTOS.auth.errores['demasiadas-solicitudes'],
    );
    expect(mensajeDeProblema(error)).not.toBe(TEXTOS.auth.errores['credenciales-invalidas']);
  });
});
