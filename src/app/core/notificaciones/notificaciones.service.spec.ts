import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificacionesService } from './notificaciones.service';
import { Notificacion } from './modelos';

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

  it('marca una notificación como leída y actualiza la bandeja y el contador', () => {
    const aviso: Notificacion = {
      id: 'aviso-prueba',
      tipo: 'MENCION',
      mensaje: 'Aviso ficticio',
      enlace: null,
      creado_en: '2020-01-01T12:00:00Z',
      leida_en: null,
    };
    servicio.establecerUsuario('usuario-prueba');
    http.expectOne('/api/v1/notificaciones/no-leidas/conteo').flush({ total: 1 });
    servicio.cargar();
    http
      .expectOne((r) => r.url === '/api/v1/notificaciones')
      .flush({
        contenido: [aviso],
        pagina: 0,
        tamano: 20,
        total_elementos: 1,
        total_paginas: 1,
      });
    servicio.marcarLeida(aviso.id);
    const peticion = http.expectOne(`/api/v1/notificaciones/${aviso.id}/lectura`);
    expect(peticion.request.method).toBe('PATCH');
    expect(servicio.marcando().has(aviso.id)).toBe(true);
    servicio.marcarLeida(aviso.id);
    http.expectNone((r) => r.method === 'PATCH');
    const leida = { ...aviso, leida_en: '2020-01-01T12:05:00Z' };
    peticion.flush(leida);
    http
      .expectOne((r) => r.url === '/api/v1/notificaciones')
      .flush({
        contenido: [leida],
        pagina: 0,
        tamano: 20,
        total_elementos: 1,
        total_paginas: 1,
      });
    http.expectOne('/api/v1/notificaciones/no-leidas/conteo').flush({ total: 0 });
    expect(servicio.notificaciones()[0].leida_en).toBe(leida.leida_en);
    expect(servicio.noLeidas()).toBe(0);
    expect(servicio.marcando().size).toBe(0);
    servicio.marcarLeida(aviso.id);
    http.expectNone(() => true);
  });
});
