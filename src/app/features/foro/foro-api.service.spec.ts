import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ForoApiService } from './foro-api.service';

describe('ForoApiService', () => {
  let servicio: ForoApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ForoApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía la búsqueda sin espacios y la página solicitada', () => {
    servicio.listarForos('  puente ficticio  ', 2, 10).subscribe();
    const peticion = http.expectOne((r) => r.url === '/api/v1/foro/puentes');
    expect(peticion.request.params.get('q')).toBe('puente ficticio');
    expect(peticion.request.params.get('page')).toBe('2');
    expect(peticion.request.params.get('size')).toBe('10');
    peticion.flush({ contenido: [], pagina: 2, tamano: 10, total_elementos: 0, total_paginas: 0 });
  });

  it('omite el filtro de categoría cuando no se elige uno', () => {
    servicio.listarHilos('puente-prueba', 0, 20, null).subscribe();
    const peticion = http.expectOne((r) => r.url === '/api/v1/puentes/puente-prueba/hilos');
    expect(peticion.request.params.has('categoria')).toBe(false);
    peticion.flush({ contenido: [], pagina: 0, tamano: 20, total_elementos: 0, total_paginas: 0 });
  });

  it('envía la respuesta asociada al comentario padre', () => {
    servicio
      .crearComentario('hilo-prueba', { texto: 'Respuesta ficticia', padre_id: 'padre-prueba' })
      .subscribe();
    const peticion = http.expectOne('/api/v1/hilos/hilo-prueba/comentarios');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      texto: 'Respuesta ficticia',
      padre_id: 'padre-prueba',
    });
    peticion.flush({ id: 'respuesta-prueba' });
  });
});
