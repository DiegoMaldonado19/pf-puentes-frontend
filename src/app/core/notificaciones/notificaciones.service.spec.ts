import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificacionesService } from './notificaciones.service';

describe('NotificacionesService', () => {
  let servicio: NotificacionesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(NotificacionesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no consulta ni modifica notificaciones sin sesión', () => {
    servicio.cargar();
    servicio.refrescarConteo();
    servicio.marcarLeida('aviso-prueba');
    http.expectNone(() => true);
    expect(servicio.notificaciones()).toEqual([]);
  });

  it('carga el conteo y acepta una bandeja vacía', () => {
    servicio.establecerUsuario('usuario-prueba');
    http.expectOne('/api/v1/notificaciones/no-leidas/conteo').flush({ total: 0 });
    servicio.cargar();
    http
      .expectOne((r) => r.url === '/api/v1/notificaciones')
      .flush({
        contenido: [],
        pagina: 0,
        tamano: 20,
        total_elementos: 0,
        total_paginas: 0,
      });
    expect(servicio.noLeidas()).toBe(0);
    expect(servicio.notificaciones()).toEqual([]);
    expect(servicio.cargando()).toBe(false);
    expect(servicio.error()).toBeNull();
  });

  it('cancela las consultas y limpia el conteo al cerrar sesión', () => {
    servicio.establecerUsuario('usuario-prueba');
    http.expectOne('/api/v1/notificaciones/no-leidas/conteo').flush({ total: 3 });
    servicio.cargar();
    const peticion = http.expectOne((r) => r.url === '/api/v1/notificaciones');
    servicio.establecerUsuario(null);
    expect(peticion.cancelled).toBe(true);
    expect(servicio.noLeidas()).toBe(0);
    expect(servicio.notificaciones()).toEqual([]);
    expect(servicio.sesionActiva()).toBe(false);
  });

  it('permite reintentar después de un error de carga', () => {
    servicio.establecerUsuario('usuario-prueba');
    http.expectOne('/api/v1/notificaciones/no-leidas/conteo').flush({ total: 0 });
    servicio.cargar();
    http
      .expectOne((r) => r.url === '/api/v1/notificaciones')
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(servicio.error()).not.toBeNull();
    expect(servicio.cargando()).toBe(false);
    servicio.reintentar();
    http
      .expectOne((r) => r.url === '/api/v1/notificaciones')
      .flush({
        contenido: [],
        pagina: 0,
        tamano: 20,
        total_elementos: 0,
        total_paginas: 0,
      });
    http.expectOne('/api/v1/notificaciones/no-leidas/conteo').flush({ total: 0 });
    expect(servicio.error()).toBeNull();
  });
});
