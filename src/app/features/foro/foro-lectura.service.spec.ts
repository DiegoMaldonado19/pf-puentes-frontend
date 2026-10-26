import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { ForoLecturaService } from './foro-lectura.service';

describe('ForoLecturaService', () => {
  let servicio: ForoLecturaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ForoLecturaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('acepta un listado vacío y termina la carga', () => {
    servicio.cargarHilos('puente-prueba');
    expect(servicio.cargandoHilos()).toBe(true);
    http
      .expectOne((r) => r.url.endsWith('/puente-prueba/hilos'))
      .flush({
        contenido: [],
        pagina: 0,
        tamano: 20,
        total_elementos: 0,
        total_paginas: 0,
      });
    expect(servicio.hilos()).toEqual([]);
    expect(servicio.cargandoHilos()).toBe(false);
    expect(servicio.errorHilos()).toBeNull();
  });

  it('distingue un foro inexistente de un error del servidor', () => {
    servicio.cargarHilos('puente-prueba');
    http
      .expectOne((r) => r.url.endsWith('/puente-prueba/hilos'))
      .flush(null, { status: 404, statusText: 'Not Found' });
    expect(servicio.listadoNoEncontrado()).toBe(true);
    servicio.reintentarHilos();
    http
      .expectOne((r) => r.url.endsWith('/puente-prueba/hilos'))
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(servicio.listadoNoEncontrado()).toBe(false);
    expect(servicio.errorHilos()).toBe(TEXTOS.foro.errorHilos);
    expect(servicio.cargandoHilos()).toBe(false);
  });

  it('rechaza un hilo que pertenece a otro puente', () => {
    servicio.cargarHilo('hilo-prueba', 'puente-prueba');
    http
      .expectOne('/api/v1/hilos/hilo-prueba')
      .flush({ id: 'hilo-prueba', puente_id: 'otro-puente' });
    expect(servicio.hilo()).toBeNull();
    expect(servicio.detalleNoEncontrado()).toBe(true);
  });
});
